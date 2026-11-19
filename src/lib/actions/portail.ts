"use server";

import { revalidatePath } from "next/cache";
import { after } from "next/server";
import { estDirecteur, getSession, refusEcriture } from "../auth";
import { sql, uneLigne } from "../db";
import { peut } from "../offres";
import { anneeScolaire } from "../mois";
import { consommerLimite, infosRequete } from "../securite";
import {
  MESSAGE_AUCUN_ELEVE,
  MESSAGE_RECHERCHE_COURTE,
  libelleTrimestre,
  lienBulletinPdf,
  lienPublicEleve,
} from "../portail";
import { donneesBulletin } from "../data/notes";
import {
  ecolePublique,
  rechercherElevesPubliques,
  type EcolePublique,
} from "../data/portail";
import { lienWhatsApp } from "../whatsapp";
import { whatsappCloudConfigure } from "../whatsapp-cloud";
import { empilerTache } from "../file-attente";
import { viderFile } from "../worker-taches";
import { estUuid, messageErreurBdd, texte } from "./helpers";
import { slugValide } from "../validation";
import type { ResultatAction, Trimestre } from "../types";

// ---------------------------------------------------------------------------
//  Recherche publique (aucune authentification)
// ---------------------------------------------------------------------------

export type EleveRecherchePublique = {
  id: string;
  nom: string;
  prenom: string;
  classe_nom: string;
  photo_url: string | null;
};

export type ResultatRecherchePublique = {
  ok: boolean;
  message?: string;
  eleves: EleveRecherchePublique[];
};

function lireTrimestre(valeur: string): Trimestre | null {
  const nombre = Number.parseInt(valeur, 10);
  return nombre === 1 || nombre === 2 || nombre === 3 ? nombre : null;
}

function accesPortail(ecole: EcolePublique): boolean {
  return peut({ offre: ecole.offre, statut: ecole.statut }, "portail_parent");
}

export async function rechercherElevesPortail(
  _etat: ResultatRecherchePublique | null,
  donnees: FormData,
): Promise<ResultatRecherchePublique> {
  const vide: EleveRecherchePublique[] = [];
  const slug = texte(donnees, "slug");
  const classeId = texte(donnees, "classe_id");
  // L'année n'est jamais lue depuis le navigateur : le portail public ne
  // montre que l'année scolaire en cours.
  const annee = anneeScolaire();
  const recherche = texte(donnees, "recherche");

  if (recherche.length < 3) {
    return { ok: false, eleves: vide, message: MESSAGE_RECHERCHE_COURTE };
  }

  if (!slug || !slugValide(slug) || !estUuid(classeId)) {
    return { ok: false, eleves: vide, message: MESSAGE_AUCUN_ELEVE };
  }

  const ecole = await ecolePublique(slug);
  if (!ecole || !accesPortail(ecole)) {
    return {
      ok: false,
      eleves: vide,
      message:
        "Le portail des notes n'est pas disponible pour cet établissement. Contactez l'école.",
    };
  }

  // Limite généreuse : plusieurs familles peuvent partager la connexion de
  // l'école, mais un robot ne peut pas balayer tout l'annuaire.
  const { ip } = await infosRequete();
  if (
    !(await consommerLimite(
      `portail:recherche:${ecole.id}:${ip}`,
      600,
      600,
    ))
  ) {
    return {
      ok: false,
      eleves: vide,
      message: "Trop de recherches. Patientez quelques minutes puis réessayez.",
    };
  }

  const classe = await uneLigne<{ id: string }>(
    `select id from classes where id = $1 and ecole_id = $2`,
    [classeId, ecole.id],
  );
  if (!classe) {
    return { ok: false, eleves: vide, message: MESSAGE_AUCUN_ELEVE };
  }

  const eleves = await rechercherElevesPubliques(
    ecole.id,
    annee,
    classeId,
    recherche,
  );

  if (eleves.length === 0) {
    return { ok: false, eleves: vide, message: MESSAGE_AUCUN_ELEVE };
  }

  return {
    ok: true,
    eleves: eleves.map((eleve) => ({
      id: eleve.id,
      nom: eleve.nom,
      prenom: eleve.prenom,
      classe_nom: eleve.classe_nom,
      photo_url: eleve.photo_url,
    })),
  };
}

// ---------------------------------------------------------------------------
//  Masquage d'un élève côté directeur
// ---------------------------------------------------------------------------

export async function basculerMasquagePortail(
  donnees: FormData,
): Promise<ResultatAction> {
  const session = await getSession();
  if (!session) return { error: "Votre session a expiré." };
  const refusAbo = refusEcriture(session);
  if (refusAbo) return { error: refusAbo };
  if (!estDirecteur(session)) {
    return { error: "Seul le directeur peut masquer un élève du portail parent." };
  }
  if (!peut(session.ecole, "portail_parent")) {
    return {
      error:
        "Cette fonctionnalité est réservée à l'offre PREMIUM 35.000F. Passez à PREMIUM pour débloquer le portail parent.",
    };
  }

  const id = texte(donnees, "id");
  if (!estUuid(id)) return { error: "Élève introuvable." };

  try {
    const modifie = await uneLigne<{ masque_portail: boolean }>(
      `update eleves
          set masque_portail = not masque_portail
        where id = $1 and ecole_id = $2
        returning masque_portail`,
      [id, session.ecoleId],
    );
    if (!modifie) return { error: "Élève introuvable." };

    const ecole = await uneLigne<{ slug: string }>(
      `select slug from ecoles where id = $1`,
      [session.ecoleId],
    );

    revalidatePath(`/app/eleves/${id}`);
    revalidatePath("/app/eleves");
    if (ecole?.slug) {
      revalidatePath(`/parent/${ecole.slug}`, "page");
      revalidatePath(`/parent/${ecole.slug}/eleve/${id}`, "page");
    }

    return {
      success: modifie.masque_portail
        ? "Élève masqué : ses notes ne sont plus visibles sur le portail parent."
        : "Élève affiché : ses notes sont de nouveau visibles sur le portail parent.",
    };
  } catch (erreur) {
    return { error: messageErreurBdd(erreur) };
  }
}

// ---------------------------------------------------------------------------
//  Publication des bulletins (PREMIUM) et envoi WhatsApp
// ---------------------------------------------------------------------------

export type ResultatPublication = ResultatAction & {
  envoyes?: number;
  liens?: number;
  erreurs?: number;
};

export async function publierBulletins(
  donnees: FormData,
): Promise<ResultatPublication> {
  const session = await getSession();
  if (!session) return { error: "Votre session a expiré." };
  const refusAbo = refusEcriture(session);
  if (refusAbo) return { error: refusAbo };
  if (!estDirecteur(session)) {
    return { error: "Seul le directeur peut publier les bulletins." };
  }
  if (!peut(session.ecole, "portail_parent")) {
    return {
      error:
        "Cette fonctionnalité est réservée à l'offre PREMIUM 35.000F. Passez à PREMIUM pour publier les bulletins sur le portail parent.",
    };
  }
  if (!peut(session.ecole, "envoi_bulletins_whatsapp")) {
    return {
      error:
        "L'envoi automatique des bulletins sur WhatsApp est réservé à l'offre PREMIUM 35.000F.",
    };
  }

  const classeId = texte(donnees, "classe_id");
  const trimestre = lireTrimestre(texte(donnees, "trimestre"));
  const anneeSaisie = texte(donnees, "annee");
  if (!estUuid(classeId) || !trimestre) {
    return { error: "Classe ou trimestre invalide." };
  }
  const annee = /^\d{4}-\d{4}$/.test(anneeSaisie)
    ? anneeSaisie
    : anneeScolaire();

  const ecole = await uneLigne<{
    id: string;
    nom: string;
    slug: string;
    adresse: string | null;
    telephone: string | null;
    logo_url: string | null;
  }>(
    `select id, nom, slug, adresse, telephone, logo_url
       from ecoles where id = $1`,
    [session.ecoleId],
  );
  if (!ecole) return { error: "École introuvable." };

  const bulletin = await donneesBulletin(
    session.ecoleId,
    annee,
    classeId,
    trimestre,
  );
  if (!bulletin) return { error: "Classe introuvable." };

  const elevesAvecNotes = bulletin.eleves.filter((eleve) =>
    eleve.lignes.some((ligne) => ligne.note !== null),
  );
  if (elevesAvecNotes.length === 0) {
    return { error: "Aucune note publiée pour ce trimestre." };
  }

  const contacts = await sql<{ id: string; telephone_parent: string }>(
    `select id, telephone_parent
       from eleves
      where ecole_id = $1
        and annee_scolaire = $2
        and classe_id = $3
        and statut = 'actif'`,
    [session.ecoleId, annee, classeId],
  );
  const telephoneParEleve = new Map(
    contacts.map((contact) => [contact.id, contact.telephone_parent]),
  );

  const cloud = whatsappCloudConfigure();
  let envoyes = 0;
  let liens = 0;
  let erreurs = 0;

  for (const eleve of elevesAvecNotes) {
    const telephone = telephoneParEleve.get(eleve.id);
    if (!telephone) continue;

    const lienEleve = lienPublicEleve(ecole.slug, eleve.id);
    const lienPdf = lienBulletinPdf(ecole.slug, eleve.id, trimestre);
    const message = `Bonjour, le bulletin de ${eleve.prenom} ${eleve.nom} (${bulletin.classe.nom}) pour le ${libelleTrimestre(trimestre)} est disponible. Notes et rang : ${lienEleve} — PDF : ${lienPdf}. ${ecole.nom}.`;

    let statut: "EN_ATTENTE" | "ENVOYE" | "LIEN_PRET" | "ECHEC" = "LIEN_PRET";
    let erreur: string | null = null;
    const urlWhatsApp = lienWhatsApp(telephone, message);

    if (cloud) {
      // Aucun PDF, aucun appel HTTP dans cette requête : on empile la tâche et
      // on rend la main immédiatement. Le worker `/api/taches` génère le PDF
      // et envoie le message quelques secondes plus tard.
      const tache = await empilerTache({
        ecoleId: session.ecoleId,
        type: "BULLETIN_WHATSAPP",
        charge: {
          eleve_id: eleve.id,
          telephone,
          annee,
          trimestre,
          message,
        },
      });

      if (tache) {
        statut = "EN_ATTENTE";
        envoyes += 1;
      } else {
        statut = "ECHEC";
        erreur = "File d'attente indisponible.";
        erreurs += 1;
      }
    } else {
      liens += 1;
    }

    try {
      await sql(
        `insert into bulletin_envois
           (ecole_id, eleve_id, annee_scolaire, trimestre, telephone,
            statut, message, url_whatsapp, erreur, envoye_le)
         values ($1, $2, $3, $4, $5, $6, $7, $8, $9, null)
         on conflict (eleve_id, annee_scolaire, trimestre)
         do update set telephone = excluded.telephone,
                       statut = excluded.statut,
                       message = excluded.message,
                       url_whatsapp = excluded.url_whatsapp,
                       erreur = excluded.erreur,
                       envoye_le = null,
                       date_creation = now()`,
        [
          session.ecoleId,
          eleve.id,
          annee,
          trimestre,
          telephone,
          statut,
          message,
          urlWhatsApp,
          erreur,
        ],
      );
    } catch (exception) {
      erreurs += 1;
      // On ne journalise que le code technique : le message peut contenir le
      // numéro de téléphone du parent.
      const e = exception as { code?: string; constraint?: string };
      console.error("Journalisation bulletin :", {
        code: e?.code,
        contrainte: e?.constraint,
      });
    }
  }

  revalidatePath("/app/notes/bulletins");
  revalidatePath("/app/notes");

  // Démarre l'envoi juste après la réponse : le directeur n'attend pas les
  // PDF, et le cron `/api/taches` reprend tout ce qui resterait en file.
  if (cloud && envoyes > 0) {
    after(async () => {
      try {
        await viderFile({ limite: 5, secondesMax: 20 });
      } catch (exception) {
        console.error("Envoi des bulletins en arrière-plan :", {
          message:
            exception instanceof Error ? exception.message : "inconnue",
        });
      }
    });
  }

  const resume = cloud
    ? `${envoyes} bulletin${envoyes > 1 ? "s" : ""} mis en file d'envoi WhatsApp${erreurs > 0 ? ` · ${erreurs} échec${erreurs > 1 ? "s" : ""}` : ""}. L'envoi se poursuit en arrière-plan : vous pouvez continuer à travailler.`
    : `${liens} lien${liens > 1 ? "s" : ""} WhatsApp prêt${liens > 1 ? "s" : ""}. WhatsApp Cloud API n'est pas encore configurée : les liens sont disponibles ci-dessous pour un envoi immédiat.`;

  return {
    success: resume,
    envoyes,
    liens,
    erreurs,
  };
}
