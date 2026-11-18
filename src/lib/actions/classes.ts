"use server";

import { revalidatePath } from "next/cache";
import { sql, transaction, uneLigne } from "../db";
import type { PoolClient } from "pg";
import { getSession } from "../auth";
import { estFrequence, LIBELLES_FREQUENCE } from "../periodes";
import { compterClasses, limitesOffre } from "../data/ecole";
import { offreEffective } from "../offres";
import { estUuid, entier, messageErreurBdd, texte } from "./helpers";
import type {
  ExamenNational,
  Frequence,
  ResultatAction,
  TypeFinClasse,
} from "../types";

function estDirecteur(role: string): boolean {
  return role === "directeur";
}

function entierOptionnel(donnees: FormData, nom: string): number {
  const brut = texte(donnees, nom);
  if (brut === "") return 0;
  return entier(donnees, nom);
}

/** Une tranche telle que saisie dans le formulaire. */
type TrancheSaisie = {
  nom: string;
  montant: number;
  /** AAAA-MM-JJ ou null. */
  date_limite: string | null;
};

type ValeursClasse = {
  nom: string;
  frequence: Frequence;
  montant: number;
  inscription: number;
  reinscription: number;
  tranches: TrancheSaisie[];
  typeFin: TypeFinClasse;
  examen: ExamenNational | null;
  classeSuivanteId: string | null;
};

const EXAMENS: ExamenNational[] = ["CEPD", "BEPC", "BAC"];

const MAX_TRANCHES = 20;

/** Lit le champ caché `tranches` (JSON) et valide chaque ligne. */
function lireTranches(brut: string): {
  error?: string;
  tranches?: TrancheSaisie[];
} {
  if (!brut.trim()) {
    return { error: "Ajoutez au moins une tranche (nom, montant, date limite)." };
  }

  let donnees: unknown;
  try {
    donnees = JSON.parse(brut);
  } catch {
    return { error: "La liste des tranches est illisible. Réessayez." };
  }

  if (!Array.isArray(donnees) || donnees.length === 0) {
    return { error: "Ajoutez au moins une tranche." };
  }
  if (donnees.length > MAX_TRANCHES) {
    return { error: `Une classe est limitée à ${MAX_TRANCHES} tranches.` };
  }

  const tranches: TrancheSaisie[] = [];
  for (let index = 0; index < donnees.length; index += 1) {
    const ligne = donnees[index] as {
      nom?: unknown;
      montant?: unknown;
      date_limite?: unknown;
    };
    const nom = String(ligne?.nom ?? "").trim().slice(0, 80);
    const montantBrut = String(ligne?.montant ?? "").replace(/[^\d]/g, "");
    const montant = Number.parseInt(montantBrut, 10);
    const dateBrute = String(ligne?.date_limite ?? "").trim();

    if (nom.length < 1) {
      return { error: `Tranche ${index + 1} : indiquez un nom.` };
    }
    if (!Number.isFinite(montant) || montant < 0 || montant > 10_000_000) {
      return {
        error: `Tranche ${index + 1} : le montant doit être un nombre valide (0 à 10 000 000).`,
      };
    }
    if (dateBrute && !/^\d{4}-\d{2}-\d{2}$/.test(dateBrute)) {
      return { error: `Tranche ${index + 1} : la date limite n'est pas valide.` };
    }

    tranches.push({
      nom,
      montant,
      date_limite: dateBrute || null,
    });
  }

  return { tranches };
}

function lireClasse(donnees: FormData): {
  error?: string;
  valeurs?: ValeursClasse;
} {
  const nom = texte(donnees, "nom");
  const frequenceBrute = texte(donnees, "frequence_paiement") || "MENSUEL";
  const inscription = entierOptionnel(donnees, "frais_inscription");
  const reinscription = entierOptionnel(donnees, "frais_reinscription");
  const typeFinBrut = texte(donnees, "type_fin") || "NORMALE";
  const examenBrut = texte(donnees, "examen");
  const suivanteBrute = texte(donnees, "classe_suivante_id");

  if (nom.length < 1) return { error: "Indiquez le nom de la classe." };
  if (!estFrequence(frequenceBrute)) {
    return { error: "Choisissez la fréquence de paiement." };
  }
  if (typeFinBrut !== "NORMALE" && typeFinBrut !== "EXAMEN") {
    return { error: "Choisissez la fin de cycle de la classe." };
  }

  let examen: ExamenNational | null = null;
  if (typeFinBrut === "EXAMEN") {
    if (!EXAMENS.includes(examenBrut as ExamenNational)) {
      return {
        error: "Choisissez l'examen préparé : CEPD, BEPC ou BAC.",
      };
    }
    examen = examenBrut as ExamenNational;
  }

  let classeSuivanteId: string | null = null;
  if (suivanteBrute) {
    if (!estUuid(suivanteBrute)) {
      return { error: "La classe suivante est invalide." };
    }
    classeSuivanteId = suivanteBrute;
  }

  let montant = 0;
  let tranches: TrancheSaisie[] = [];

  if (frequenceBrute === "TRANCHES") {
    const lecture = lireTranches(texte(donnees, "tranches"));
    if (lecture.error) return { error: lecture.error };
    tranches = lecture.tranches ?? [];
  } else {
    montant = entier(
      donnees,
      donnees.get("montant_periode") !== null
        ? "montant_periode"
        : "montant_mensuel",
    );
    if (
      !Number.isFinite(montant) ||
      montant < 0 ||
      montant > 10_000_000
    ) {
      return {
        error:
          "Le montant de la période doit être un nombre valide (0 à 10 000 000).",
      };
    }
  }

  if (!Number.isFinite(inscription) || inscription < 0 || inscription > 10_000_000) {
    return { error: "Les frais d'inscription doivent être un nombre valide." };
  }
  if (
    !Number.isFinite(reinscription) ||
    reinscription < 0 ||
    reinscription > 10_000_000
  ) {
    return { error: "Les frais de réinscription doivent être un nombre valide." };
  }

  return {
    valeurs: {
      nom,
      frequence: frequenceBrute,
      montant,
      inscription,
      reinscription,
      tranches,
      typeFin: typeFinBrut,
      examen,
      classeSuivanteId,
    },
  };
}

/** Une classe suivante doit exister dans la même école et ne pas être la classe elle-même. */
async function verifierClasseSuivante(
  ecoleId: string,
  classeId: string | null,
  suivanteId: string | null,
): Promise<string | null> {
  if (!suivanteId) return null;
  if (classeId && suivanteId === classeId) {
    return "Une classe ne peut pas être sa propre classe suivante.";
  }
  const ligne = await uneLigne<{ id: string }>(
    `select id from classes where id = $1 and ecole_id = $2`,
    [suivanteId, ecoleId],
  );
  if (!ligne) return "La classe suivante est introuvable dans votre école.";

  if (classeId) {
    // Empêche une boucle A → B → A qui rendrait la clôture infinie.
    const boucle = await uneLigne<{ id: string }>(
      `with recursive chaine as (
         select id, classe_suivante_id, 1 as profondeur
           from classes where id = $1 and ecole_id = $2
         union all
         select c.id, c.classe_suivante_id, ch.profondeur + 1
           from classes c
           join chaine ch on c.id = ch.classe_suivante_id
          where ch.profondeur < 20
       )
       select id from chaine where id = $3 limit 1`,
      [suivanteId, ecoleId, classeId],
    );
    if (boucle) {
      return "Cette classe suivante créerait une boucle dans le parcours des élèves.";
    }
  }

  return null;
}

/** Écrit la liste des tranches d'une classe (création ou mise à jour). */
async function enregistrerTranches(
  client: PoolClient,
  ecoleId: string,
  classeId: string,
  tranches: TrancheSaisie[],
) {
  for (let index = 0; index < tranches.length; index += 1) {
    const tranche = tranches[index];
    await client.query(
      `insert into tranches (ecole_id, classe_id, ordre, nom, montant, date_limite)
       values ($1, $2, $3, $4, $5, $6)
       on conflict (classe_id, ordre) do update
         set nom = excluded.nom,
             montant = excluded.montant,
             date_limite = excluded.date_limite`,
      [
        ecoleId,
        classeId,
        index + 1,
        tranche.nom,
        tranche.montant,
        tranche.date_limite,
      ],
    );
  }

  await client.query(
    `delete from tranches where classe_id = $1 and ecole_id = $2 and ordre > $3`,
    [classeId, ecoleId, tranches.length],
  );
}

export async function creerClasse(
  _etat: ResultatAction | null,
  donnees: FormData,
): Promise<ResultatAction> {
  const session = await getSession();
  if (!session) return { error: "Votre session a expiré." };
  if (!estDirecteur(session.role)) {
    return { error: "Seul le directeur peut créer une classe." };
  }

  const lecture = lireClasse(donnees);
  if (!lecture.valeurs) return { error: lecture.error };
  const v = lecture.valeurs;

  const erreurSuivante = await verifierClasseSuivante(
    session.ecoleId,
    null,
    v.classeSuivanteId,
  );
  if (erreurSuivante) return { error: erreurSuivante };

  const offre = offreEffective(session.ecole);
  const limite = limitesOffre(offre);
  const actuelles = await compterClasses(session.ecoleId);
  if (limite.classes !== null && actuelles >= limite.classes) {
    return {
      error: `Votre offre ${offre} est limitée à ${limite.classes} classes. Contactez SCHOOL PAY pour l'étendre.`,
    };
  }

  try {
    const classeId = await transaction(async (client) => {
      const creee = await client.query<{ id: string }>(
        `insert into classes
           (ecole_id, nom, montant_periode, frequence_paiement,
            frais_inscription, frais_reinscription,
            type_fin, examen, classe_suivante_id)
         values ($1, $2, $3, $4, $5, $6, $7, $8, $9)
         returning id`,
        [
          session.ecoleId,
          v.nom,
          v.montant,
          v.frequence,
          v.inscription,
          v.reinscription,
          v.typeFin,
          v.examen,
          v.classeSuivanteId,
        ],
      );
      const id = creee.rows[0].id;
      if (v.frequence === "TRANCHES") {
        await enregistrerTranches(client, session.ecoleId, id, v.tranches);
      }
      return id;
    });
    void classeId;
  } catch (erreur) {
    return { error: messageErreurBdd(erreur) };
  }

  revalidatePath("/app/classes");
  revalidatePath("/app");
  return { success: `La classe ${v.nom} a été créée.` };
}

export async function modifierClasse(
  _etat: ResultatAction | null,
  donnees: FormData,
): Promise<ResultatAction> {
  const session = await getSession();
  if (!session) return { error: "Votre session a expiré." };
  if (!estDirecteur(session.role)) {
    return { error: "Seul le directeur peut modifier une classe." };
  }

  const id = texte(donnees, "id");
  if (!estUuid(id)) return { error: "Classe introuvable." };

  const lecture = lireClasse(donnees);
  if (!lecture.valeurs) return { error: lecture.error };
  const v = lecture.valeurs;

  const erreurSuivante = await verifierClasseSuivante(
    session.ecoleId,
    id,
    v.classeSuivanteId,
  );
  if (erreurSuivante) return { error: erreurSuivante };

  const classe = await uneLigne<{
    id: string;
    montant_periode: number;
    frequence_paiement: Frequence;
    frais_inscription: number;
    frais_reinscription: number;
  }>(
    `select id, montant_periode, frequence_paiement,
            frais_inscription, frais_reinscription
       from classes where id = $1 and ecole_id = $2`,
    [id, session.ecoleId],
  );
  if (!classe) return { error: "Classe introuvable." };

  try {
    await transaction(async (client) => {
      // Le trigger PostgreSQL réajuste les échéances non payées des élèves.
      await client.query(
        `update classes
            set nom = $1, montant_periode = $2, frequence_paiement = $3,
                frais_inscription = $4, frais_reinscription = $5,
                type_fin = $6, examen = $7, classe_suivante_id = $8
          where id = $9 and ecole_id = $10`,
        [
          v.nom,
          v.montant,
          v.frequence,
          v.inscription,
          v.reinscription,
          v.typeFin,
          v.examen,
          v.classeSuivanteId,
          id,
          session.ecoleId,
        ],
      );

      if (v.frequence === "TRANCHES") {
        await enregistrerTranches(client, session.ecoleId, id, v.tranches);
      } else {
        // Retour au mensuel / annuel : les tranches ne servent plus.
        await client.query(
          `delete from tranches where classe_id = $1 and ecole_id = $2`,
          [id, session.ecoleId],
        );
      }
    });
  } catch (erreur) {
    return { error: messageErreurBdd(erreur) };
  }

  revalidatePath("/app/classes");
  revalidatePath("/app/eleves");
  revalidatePath("/app");
  return {
    success:
      v.frequence === "TRANCHES"
        ? `Classe mise à jour avec ${v.tranches.length} tranche${v.tranches.length > 1 ? "s" : ""}. Les échéances non payées ont été recalculées.`
        : classe.montant_periode !== v.montant
          ? `Classe mise à jour. Les échéances non payées passent à ${v.montant} F.`
          : `Classe mise à jour (${LIBELLES_FREQUENCE[v.frequence].toLowerCase()}).`,
  };
}

export async function supprimerClasse(donnees: FormData): Promise<ResultatAction> {
  const session = await getSession();
  if (!session) return { error: "Votre session a expiré." };
  if (!estDirecteur(session.role)) {
    return { error: "Seul le directeur peut supprimer une classe." };
  }

  const id = texte(donnees, "id");
  if (!estUuid(id)) return { error: "Classe introuvable." };

  const eleves = await uneLigne<{ total: number }>(
    `select (select count(*)::int from eleves
              where classe_id = $1 and ecole_id = $2)
          + (select count(*)::int from inscriptions i
              join eleves e on e.id = i.eleve_id
             where i.classe_id = $1 and i.ecole_id = $2
               and e.classe_id <> $1) as total`,
    [id, session.ecoleId],
  );

  if ((eleves?.total ?? 0) > 0) {
    return {
      error:
        "Cette classe figure dans le parcours d'élèves (année en cours ou archive). Réaffectez les élèves avant de supprimer la classe.",
    };
  }

  await sql(`delete from classes where id = $1 and ecole_id = $2`, [
    id,
    session.ecoleId,
  ]);

  revalidatePath("/app/classes");
  revalidatePath("/app");
  return { success: "Classe supprimée." };
}
