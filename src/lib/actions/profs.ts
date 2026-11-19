"use server";

import { revalidatePath } from "next/cache";
import { hacherMotDePasse, getSession, refusEcriture } from "../auth";
import { sql, transaction, uneLigne } from "../db";
import { peut } from "../offres";
import { formatFCFA, normaliserTelephone } from "../format";
import { journaliser } from "../journal";
import { validerMotDePasse } from "../mot-de-passe";
import type { ResultatAction, Session } from "../types";
import { estEmail, estUuid, messageErreurBdd, texte } from "./helpers";

type Acces = { session: Session } | { error: string };

async function accesProfs(): Promise<Acces> {
  const session = await getSession();
  if (!session) return { error: "Votre session a expiré." };
  const refusAbo = refusEcriture(session);
  if (refusAbo) return { error: refusAbo };
  if (!peut(session.ecole, "comptes_profs")) {
    return {
      error:
        "Cette fonctionnalité est réservée à l'offre PREMIUM 35.000F. Passez à PREMIUM pour débloquer les comptes profs.",
    };
  }
  return { session };
}

function estDirecteur(role: string): boolean {
  return role === "directeur";
}

function peutPayer(role: string): boolean {
  return role === "directeur" || role === "comptable";
}

function rafraichirProfs() {
  revalidatePath("/app/profs");
  revalidatePath("/app");
  revalidatePath("/prof");
}

// ---------------------------------------------------------------------------
//  Compte de connexion du professeur
// ---------------------------------------------------------------------------

/** Identifiant de connexion : 3 à 30 caractères, minuscules, sans espace. */
const IDENTIFIANT_VALIDE = /^[a-z0-9][a-z0-9._-]{2,29}$/;

function normaliserIdentifiant(brut: string): string {
  return brut.trim().toLowerCase();
}

/**
 * Découpe un nom complet en prénom + nom.
 * « Koffi AMEGAN » → prénom Koffi, nom AMEGAN.
 * « Koffi » → prénom Koffi, nom vide (l'affichage reste « Koffi »).
 */
function decouperNomComplet(nomComplet: string): { prenom: string; nom: string } {
  const mots = nomComplet.trim().split(/\s+/).filter(Boolean);
  if (mots.length === 0) return { prenom: "", nom: "" };
  if (mots.length === 1) return { prenom: mots[0], nom: "" };
  return { prenom: mots[0], nom: mots.slice(1).join(" ") };
}

function identifiantDejaPris(
  identifiant: string,
  saufUserId: string | null = null,
): Promise<{ id: string } | null> {
  return uneLigne<{ id: string }>(
    `select id from users
      where lower(identifiant) = $1
        and ($2::uuid is null or id <> $2::uuid)
      limit 1`,
    [identifiant, saufUserId],
  );
}

type ValeursProf = {
  nom: string;
  prenom: string;
  telephone: string | null;
  email: string | null;
  matiere: string;
  classes_assurees: string;
  salaire_mensuel: number;
  date_embauche: string | null;
  notes: string;
};

function lireProf(donnees: FormData): { error?: string; valeurs?: ValeursProf } {
  const nom = texte(donnees, "nom").slice(0, 80);
  const prenom = texte(donnees, "prenom").slice(0, 80);
  const telephoneBrut = texte(donnees, "telephone");
  const email = texte(donnees, "email").slice(0, 160);
  const matiere = texte(donnees, "matiere").slice(0, 120);
  const classesAssurees = texte(donnees, "classes_assurees").slice(0, 160);
  const notes = texte(donnees, "notes").slice(0, 500);
  const salaire = Number.parseInt(texte(donnees, "salaire_mensuel") || "0", 10);
  const dateBrute = texte(donnees, "date_embauche");

  if (nom.length < 1) return { error: "Indiquez le nom du professeur." };
  if (prenom.length < 1) return { error: "Indiquez le prénom du professeur." };

  let telephone: string | null = null;
  if (telephoneBrut) {
    telephone = normaliserTelephone(telephoneBrut);
    if (!telephone) {
      return {
        error:
          "Le téléphone doit être un numéro togolais valide (8 chiffres, ex. 90 12 34 56).",
      };
    }
  }

  if (email && !estEmail(email)) {
    return { error: "L'adresse email du professeur n'est pas valide." };
  }

  if (!Number.isFinite(salaire) || salaire < 0 || salaire > 10_000_000) {
    return {
      error: "Le salaire mensuel doit être un montant valide (0 à 10 000 000 F).",
    };
  }

  if (dateBrute && !/^\d{4}-\d{2}-\d{2}$/.test(dateBrute)) {
    return { error: "La date d'embauche n'est pas valide." };
  }

  return {
    valeurs: {
      nom,
      prenom,
      telephone,
      email: email || null,
      matiere,
      classes_assurees: classesAssurees,
      salaire_mensuel: salaire,
      date_embauche: dateBrute || null,
      notes,
    },
  };
}

export async function creerProf(
  _etat: ResultatAction | null,
  donnees: FormData,
): Promise<ResultatAction> {
  const acces = await accesProfs();
  if ("error" in acces) return { error: acces.error };
  const { session } = acces;

  if (!estDirecteur(session.role)) {
    return { error: "Seul le directeur peut ajouter un professeur." };
  }

  const lecture = lireProf(donnees);
  if (!lecture.valeurs) return { error: lecture.error };
  const v = lecture.valeurs;

  try {
    await sql(
      `insert into profs
         (ecole_id, nom, prenom, telephone, email, matiere, classes_assurees,
          salaire_mensuel, date_embauche, notes)
       values ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)`,
      [
        session.ecoleId,
        v.nom,
        v.prenom,
        v.telephone,
        v.email,
        v.matiere,
        v.classes_assurees,
        v.salaire_mensuel,
        v.date_embauche,
        v.notes,
      ],
    );
  } catch (erreur) {
    return { error: messageErreurBdd(erreur) };
  }

  rafraichirProfs();
  return { success: `${v.prenom} ${v.nom} a été ajouté au corps enseignant.` };
}

/**
 * Crée un professeur ET son compte de connexion en une seule étape.
 * Le directeur ne choisit aucune classe ni matière : le professeur les
 * sélectionnera lui-même dans son espace.
 */
export async function creerCompteProf(
  _etat: ResultatAction | null,
  donnees: FormData,
): Promise<ResultatAction> {
  const acces = await accesProfs();
  if ("error" in acces) return { error: acces.error };
  const { session } = acces;

  if (!estDirecteur(session.role)) {
    return { error: "Seul le directeur peut créer un compte professeur." };
  }

  const nomComplet = texte(donnees, "nom_complet").slice(0, 120);
  const telephoneBrut = texte(donnees, "telephone");
  const identifiant = normaliserIdentifiant(texte(donnees, "identifiant"));
  const motDePasse = texte(donnees, "mot_de_passe");

  if (nomComplet.length < 2) {
    return { error: "Indiquez le nom complet du professeur." };
  }

  let telephone: string | null = null;
  if (telephoneBrut) {
    telephone = normaliserTelephone(telephoneBrut);
    if (!telephone) {
      return {
        error:
          "Le téléphone doit être un numéro togolais valide (8 chiffres, ex. 90 12 34 56).",
      };
    }
  }

  if (!IDENTIFIANT_VALIDE.test(identifiant)) {
    return {
      error:
        "L'identifiant doit contenir 3 à 30 caractères : lettres sans accent, chiffres, point, tiret ou souligné (ex. koffi123).",
    };
  }

  const problemeMotDePasse = validerMotDePasse(motDePasse);
  if (problemeMotDePasse) return { error: problemeMotDePasse };

  if (await identifiantDejaPris(identifiant)) {
    return {
      error: `L'identifiant « ${identifiant} » est déjà utilisé. Choisissez-en un autre.`,
    };
  }

  const { prenom, nom } = decouperNomComplet(nomComplet);
  const hachage = await hacherMotDePasse(motDePasse);

  try {
    await transaction(async (client) => {
      const prof = await client.query<{ id: string }>(
        `insert into profs (ecole_id, nom, prenom, telephone, actif)
         values ($1, $2, $3, $4, true)
         returning id`,
        [session.ecoleId, nom, prenom, telephone],
      );
      const profId = prof.rows[0]?.id;
      if (!profId) throw new Error("PROF_NON_CREE");

      const compte = await client.query<{ id: string }>(
        `insert into users
           (ecole_id, nom, email, identifiant, mot_de_passe, role, actif)
         values ($1, $2, null, $3, $4, 'prof', true)
         returning id`,
        [session.ecoleId, nomComplet, identifiant, hachage],
      );
      const userId = compte.rows[0]?.id;
      if (!userId) throw new Error("COMPTE_NON_CREE");

      await client.query(
        `update profs set user_id = $1 where id = $2 and ecole_id = $3`,
        [userId, profId, session.ecoleId],
      );
    });
  } catch (erreur) {
    return { error: messageErreurBdd(erreur) };
  }

  await journaliser({
    action: "PROF_CREE",
    libelle: `Compte professeur créé pour ${nomComplet}.`,
    auteur: session.email ?? session.identifiant ?? session.userId,
    cible: identifiant,
    details: { nom: nomComplet, ecole: session.ecole.nom },
  });

  rafraichirProfs();
  return {
    success:
      `Compte créé pour ${nomComplet}. Identifiant : « ${identifiant} ». ` +
      "Donnez-le au professeur : il choisira lui-même ses classes et matières.",
  };
}

/**
 * Réinitialise l'accès d'un professeur : identifiant, mot de passe, ou les
 * deux. Sert aussi à créer un compte pour une fiche créée avant cette
 * fonctionnalité.
 */
export async function reinitialiserAccesProf(
  _etat: ResultatAction | null,
  donnees: FormData,
): Promise<ResultatAction> {
  const acces = await accesProfs();
  if ("error" in acces) return { error: acces.error };
  const { session } = acces;

  if (!estDirecteur(session.role)) {
    return { error: "Seul le directeur peut modifier un accès professeur." };
  }

  const profId = texte(donnees, "prof_id");
  const identifiant = normaliserIdentifiant(texte(donnees, "identifiant"));
  const motDePasse = texte(donnees, "mot_de_passe");
  if (!estUuid(profId)) return { error: "Professeur introuvable." };

  if (!IDENTIFIANT_VALIDE.test(identifiant)) {
    return {
      error:
        "L'identifiant doit contenir 3 à 30 caractères : lettres sans accent, chiffres, point, tiret ou souligné.",
    };
  }
  if (motDePasse) {
    const problemeMotDePasse = validerMotDePasse(motDePasse);
    if (problemeMotDePasse) return { error: problemeMotDePasse };
  }

  const prof = await uneLigne<{
    id: string;
    nom: string;
    prenom: string;
    user_id: string | null;
  }>(
    `select id, nom, prenom, user_id from profs where id = $1 and ecole_id = $2`,
    [profId, session.ecoleId],
  );
  if (!prof) return { error: "Professeur introuvable." };

  if (await identifiantDejaPris(identifiant, prof.user_id)) {
    return {
      error: `L'identifiant « ${identifiant} » est déjà utilisé. Choisissez-en un autre.`,
    };
  }

  if (!prof.user_id) {
    if (!motDePasse) {
      return {
        error:
          "Ce professeur n'a pas encore de compte : indiquez un mot de passe pour le créer.",
      };
    }
    const hachage = await hacherMotDePasse(motDePasse);
    try {
      await transaction(async (client) => {
        const compte = await client.query<{ id: string }>(
          `insert into users
             (ecole_id, nom, email, identifiant, mot_de_passe, role, actif)
           values ($1, $2, null, $3, $4, 'prof', true)
           returning id`,
          [
            session.ecoleId,
            `${prof.prenom} ${prof.nom}`.trim(),
            identifiant,
            hachage,
          ],
        );
        const userId = compte.rows[0]?.id;
        if (!userId) throw new Error("COMPTE_NON_CREE");
        await client.query(
          `update profs set user_id = $1 where id = $2 and ecole_id = $3`,
          [userId, profId, session.ecoleId],
        );
      });
    } catch (erreur) {
      return { error: messageErreurBdd(erreur) };
    }

    rafraichirProfs();
    return {
      success: `Compte créé pour ${prof.prenom} ${prof.nom}. Identifiant : « ${identifiant} ».`,
    };
  }

  const hachage = motDePasse ? await hacherMotDePasse(motDePasse) : null;
  try {
    await sql(
      `update users
          set identifiant = $1,
              mot_de_passe = coalesce($2::text, mot_de_passe),
              actif = true,
              token_version = token_version + 1
        where id = $3 and ecole_id = $4`,
      [identifiant, hachage, prof.user_id, session.ecoleId],
    );
  } catch (erreur) {
    return { error: messageErreurBdd(erreur) };
  }

  rafraichirProfs();
  return {
    success: motDePasse
      ? `Accès de ${prof.prenom} ${prof.nom} réinitialisé (identifiant « ${identifiant} », nouveau mot de passe).`
      : `Identifiant de ${prof.prenom} ${prof.nom} modifié en « ${identifiant} ».`,
  };
}

export async function modifierProf(
  _etat: ResultatAction | null,
  donnees: FormData,
): Promise<ResultatAction> {
  const acces = await accesProfs();
  if ("error" in acces) return { error: acces.error };
  const { session } = acces;

  if (!estDirecteur(session.role)) {
    return { error: "Seul le directeur peut modifier une fiche professeur." };
  }

  const id = texte(donnees, "id");
  if (!estUuid(id)) return { error: "Professeur introuvable." };

  const lecture = lireProf(donnees);
  if (!lecture.valeurs) return { error: lecture.error };
  const v = lecture.valeurs;

  try {
    const modifie = await sql<{ id: string }>(
      `update profs
          set nom = $1, prenom = $2, telephone = $3, email = $4,
              matiere = $5, classes_assurees = $6, salaire_mensuel = $7,
              date_embauche = $8, notes = $9
        where id = $10 and ecole_id = $11
        returning id`,
      [
        v.nom,
        v.prenom,
        v.telephone,
        v.email,
        v.matiere,
        v.classes_assurees,
        v.salaire_mensuel,
        v.date_embauche,
        v.notes,
        id,
        session.ecoleId,
      ],
    );
    if (modifie.length === 0) return { error: "Professeur introuvable." };
  } catch (erreur) {
    return { error: messageErreurBdd(erreur) };
  }

  rafraichirProfs();
  return { success: "Fiche professeur mise à jour." };
}

export async function basculerProf(donnees: FormData): Promise<ResultatAction> {
  const acces = await accesProfs();
  if ("error" in acces) return { error: acces.error };
  const { session } = acces;

  if (!estDirecteur(session.role)) {
    return { error: "Seul le directeur peut désactiver un professeur." };
  }

  const id = texte(donnees, "id");
  if (!estUuid(id)) return { error: "Professeur introuvable." };

  const prof = await uneLigne<{
    actif: boolean;
    nom: string;
    prenom: string;
    user_id: string | null;
  }>(
    `select actif, nom, prenom, user_id
       from profs where id = $1 and ecole_id = $2`,
    [id, session.ecoleId],
  );
  if (!prof) return { error: "Professeur introuvable." };

  const nouvelEtat = !prof.actif;

  try {
    await transaction(async (client) => {
      await client.query(
        `update profs set actif = $1 where id = $2 and ecole_id = $3`,
        [nouvelEtat, id, session.ecoleId],
      );
      if (prof.user_id) {
        // Un professeur désactivé perd immédiatement l'accès : le compte est
        // désactivé et les sessions ouvertes sont invalidées.
        await client.query(
          `update users
              set actif = $1,
                  token_version = token_version + 1
            where id = $2 and ecole_id = $3`,
          [nouvelEtat, prof.user_id, session.ecoleId],
        );
      }
    });
  } catch (erreur) {
    return { error: messageErreurBdd(erreur) };
  }

  rafraichirProfs();
  return {
    success: `${prof.prenom} ${prof.nom} est maintenant ${nouvelEtat ? "actif" : "inactif"}.`,
  };
}

export async function supprimerProf(donnees: FormData): Promise<ResultatAction> {
  const acces = await accesProfs();
  if ("error" in acces) return { error: acces.error };
  const { session } = acces;

  if (!estDirecteur(session.role)) {
    return { error: "Seul le directeur peut supprimer un professeur." };
  }

  const id = texte(donnees, "id");
  if (!estUuid(id)) return { error: "Professeur introuvable." };

  const salaires = await uneLigne<{ total: number }>(
    `select count(*)::int as total from salaires where prof_id = $1 and ecole_id = $2`,
    [id, session.ecoleId],
  );

  if ((salaires?.total ?? 0) > 0) {
    return {
      error:
        "Ce professeur a déjà des salaires ou des versements enregistrés. Désactivez sa fiche pour conserver l'historique.",
    };
  }

  const saisies = await uneLigne<{ total: number }>(
    `select count(*)::int as total
       from saisies_notes
      where prof_id = $1 and ecole_id = $2`,
    [id, session.ecoleId],
  );

  if ((saisies?.total ?? 0) > 0) {
    return {
      error:
        "Ce professeur a déjà des saisies de notes enregistrées. Désactivez sa fiche pour conserver l'historique.",
    };
  }

  const prof = await uneLigne<{
    nom: string;
    prenom: string;
    user_id: string | null;
  }>(
    `select nom, prenom, user_id from profs where id = $1 and ecole_id = $2`,
    [id, session.ecoleId],
  );
  if (!prof) return { error: "Professeur introuvable." };

  try {
    await transaction(async (client) => {
      await client.query(
        `delete from profs where id = $1 and ecole_id = $2`,
        [id, session.ecoleId],
      );
      if (prof.user_id) {
        await client.query(
          `delete from users
            where id = $1 and ecole_id = $2 and role = 'prof'`,
          [prof.user_id, session.ecoleId],
        );
      }
    });
  } catch (erreur) {
    return { error: messageErreurBdd(erreur) };
  }

  await journaliser({
    action: "PROF_SUPPRIME",
    libelle: `Professeur supprimé : ${prof.prenom} ${prof.nom}.`,
    auteur: session.email ?? session.identifiant ?? session.userId,
    cible: `${prof.prenom} ${prof.nom}`,
    cibleId: id,
    details: { ecole: session.ecole.nom },
  });

  rafraichirProfs();
  return { success: `${prof.prenom} ${prof.nom} a été supprimé.` };
}

function lireMoisAnnee(
  donnees: FormData,
): { error: string } | { annee: number; mois: number } {
  const annee = Number.parseInt(texte(donnees, "annee"), 10);
  const mois = Number.parseInt(texte(donnees, "mois"), 10);
  if (!Number.isFinite(annee) || annee < 2000 || annee > 2100) {
    return { error: "Année invalide." };
  }
  if (!Number.isFinite(mois) || mois < 1 || mois > 12) {
    return { error: "Mois invalide." };
  }
  return { annee, mois };
}

/** Crée les lignes de salaire du mois pour tous les professeurs actifs. */
export async function preparerSalaires(
  _etat: ResultatAction | null,
  donnees: FormData,
): Promise<ResultatAction> {
  const acces = await accesProfs();
  if ("error" in acces) return { error: acces.error };
  const { session } = acces;

  if (!estDirecteur(session.role)) {
    return { error: "Seul le directeur peut préparer les salaires du mois." };
  }

  const periode = lireMoisAnnee(donnees);
  if ("error" in periode) return { error: periode.error };

  try {
    const crees = await sql<{ id: string }>(
      `insert into salaires (ecole_id, prof_id, annee, mois, montant_du)
       select p.ecole_id, p.id, $2, $3, p.salaire_mensuel
         from profs p
        where p.ecole_id = $1
          and p.actif = true
          and p.salaire_mensuel > 0
       on conflict (prof_id, annee, mois) do nothing
       returning id`,
      [session.ecoleId, periode.annee, periode.mois],
    );

    rafraichirProfs();
    return {
      success:
        crees.length > 0
          ? `${crees.length} salaire${crees.length > 1 ? "s" : ""} préparé${crees.length > 1 ? "s" : ""} pour le mois.`
          : "Les salaires de ce mois étaient déjà préparés.",
    };
  } catch (erreur) {
    return { error: messageErreurBdd(erreur) };
  }
}

export async function verserSalaire(
  _etat: ResultatAction | null,
  donnees: FormData,
): Promise<ResultatAction> {
  const acces = await accesProfs();
  if ("error" in acces) return { error: acces.error };
  const { session } = acces;

  if (!peutPayer(session.role)) {
    return {
      error: "Seul le directeur ou le comptable peut enregistrer un versement.",
    };
  }

  const salaireId = texte(donnees, "salaire_id");
  const montant = Number.parseInt(texte(donnees, "montant") || "0", 10);
  const mode = texte(donnees, "mode_paiement") || "ESPECES";
  const dateBrute = texte(donnees, "date_versement");
  const observation = texte(donnees, "observation").slice(0, 300);

  if (!estUuid(salaireId)) return { error: "Salaire introuvable." };
  if (!Number.isFinite(montant) || montant < 1) {
    return { error: "Indiquez un montant supérieur à zéro." };
  }
  if (!["ESPECES", "FLOOZ", "TMONEY"].includes(mode)) {
    return { error: "Choisissez un mode de paiement valide." };
  }
  if (dateBrute && !/^\d{4}-\d{2}-\d{2}$/.test(dateBrute)) {
    return { error: "La date du versement n'est pas valide." };
  }

  const salaire = await uneLigne<{
    montant_du: number;
    montant_paye: number;
    nom: string;
    prenom: string;
  }>(
    `select s.montant_du, s.montant_paye, p.nom, p.prenom
       from salaires s
       join profs p on p.id = s.prof_id
      where s.id = $1 and s.ecole_id = $2`,
    [salaireId, session.ecoleId],
  );
  if (!salaire) return { error: "Salaire introuvable." };

  const reste = Math.max(0, salaire.montant_du - salaire.montant_paye);
  if (reste <= 0) {
    return { error: "Ce salaire est déjà entièrement versé." };
  }
  if (montant > reste) {
    return {
      error: `Le reste à verser est de ${formatFCFA(reste)}. Réduisez le montant.`,
    };
  }

  try {
    await sql(
      `insert into versements_salaires
         (ecole_id, salaire_id, montant, mode_paiement, date_versement,
          observation, enregistre_par)
       values ($1, $2, $3, $4, coalesce($5::date, current_date), $6, $7)`,
      [
        session.ecoleId,
        salaireId,
        montant,
        mode,
        dateBrute || null,
        observation || null,
        session.userId,
      ],
    );
  } catch (erreur) {
    return { error: messageErreurBdd(erreur) };
  }

  rafraichirProfs();
  return {
    success: `${formatFCFA(montant)} versé${montant > 1 ? "s" : ""} à ${salaire.prenom} ${salaire.nom}.`,
  };
}

export async function supprimerVersement(
  donnees: FormData,
): Promise<ResultatAction> {
  const acces = await accesProfs();
  if ("error" in acces) return { error: acces.error };
  const { session } = acces;

  if (!estDirecteur(session.role)) {
    return { error: "Seul le directeur peut annuler un versement." };
  }

  const id = texte(donnees, "id");
  if (!estUuid(id)) return { error: "Versement introuvable." };

  const supprime = await sql<{ montant: number }>(
    `delete from versements_salaires
      where id = $1 and ecole_id = $2
      returning montant`,
    [id, session.ecoleId],
  );
  if (supprime.length === 0) return { error: "Versement introuvable." };

  rafraichirProfs();
  return {
    success: `Versement de ${formatFCFA(supprime[0].montant)} supprimé. Le salaire est recalculé.`,
  };
}
