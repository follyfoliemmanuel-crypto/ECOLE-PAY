"use server";

import { revalidatePath } from "next/cache";
import { sql, transaction, uneLigne } from "../db";
import type { PoolClient } from "pg";
import { getSession } from "../auth";
import { estFrequence, LIBELLES_FREQUENCE } from "../periodes";
import { compterClasses, limitesOffre } from "../data/ecole";
import { offreEffective } from "../offres";
import { estUuid, entier, messageErreurBdd, texte } from "./helpers";
import type { Frequence, ResultatAction } from "../types";

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
};

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

  if (nom.length < 1) return { error: "Indiquez le nom de la classe." };
  if (!estFrequence(frequenceBrute)) {
    return { error: "Choisissez la fréquence de paiement." };
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
    },
  };
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

  const offre = offreEffective(session.ecole);
  const limite = limitesOffre(offre);
  const actuelles = await compterClasses(session.ecoleId);
  if (limite.classes !== null && actuelles >= limite.classes) {
    return {
      error: `Votre offre ${offre} est limitée à ${limite.classes} classes. Contactez ECOLE PAY pour l'étendre.`,
    };
  }

  try {
    const classeId = await transaction(async (client) => {
      const creee = await client.query<{ id: string }>(
        `insert into classes
           (ecole_id, nom, montant_periode, frequence_paiement,
            frais_inscription, frais_reinscription)
         values ($1, $2, $3, $4, $5, $6)
         returning id`,
        [
          session.ecoleId,
          v.nom,
          v.montant,
          v.frequence,
          v.inscription,
          v.reinscription,
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
                frais_inscription = $4, frais_reinscription = $5
          where id = $6 and ecole_id = $7`,
        [
          v.nom,
          v.montant,
          v.frequence,
          v.inscription,
          v.reinscription,
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
    `select count(*)::int as total from eleves where classe_id = $1 and ecole_id = $2`,
    [id, session.ecoleId],
  );

  if ((eleves?.total ?? 0) > 0) {
    return {
      error:
        "Cette classe contient encore des élèves. Déplacez-les ou supprimez-les avant de supprimer la classe.",
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
