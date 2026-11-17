import { headers } from "next/headers";
import { sql } from "./db";

/**
 * Journal d'audit des actions sensibles.
 *
 * Écriture « au mieux » : une panne du journal ne doit jamais faire échouer
 * l'action métier (paiement, changement d'offre, suppression…). L'échec est
 * signalé dans les journaux du serveur, sans donnée personnelle.
 */

export type EntreeJournal = {
  /** Code stable, en majuscules : OFFRE_CHANGEE, ELEVE_SUPPRIME… */
  action: string;
  /** Phrase lisible affichée au super admin. */
  libelle: string;
  /** Email ou identifiant de l'auteur de l'action. */
  auteur?: string | null;
  /** Nom de l'école ou du compte concerné. */
  cible?: string | null;
  /** UUID de la cible si elle en a un. */
  cibleId?: string | null;
  /** Contexte structuré (ancienne/nouvelle valeur, montant…). */
  details?: Record<string, unknown>;
};

export async function journaliser(entree: EntreeJournal): Promise<void> {
  try {
    let ip: string | null = null;
    try {
      const entetes = await headers();
      const brute =
        entetes.get("x-forwarded-for")?.split(",")[0]?.trim() ||
        entetes.get("x-real-ip") ||
        null;
      ip = brute ? brute.replace(/^::ffff:/, "").slice(0, 64) : null;
    } catch {
      // Hors requête HTTP (script, test) : pas d'IP.
    }

    await sql(
      `insert into journal_actions
         (action, libelle, auteur, cible, cible_id, ip, details)
       values ($1, $2, $3, $4, $5, $6, $7::jsonb)`,
      [
        entree.action.slice(0, 60),
        entree.libelle.slice(0, 500),
        (entree.auteur ?? "système").slice(0, 160),
        entree.cible ? entree.cible.slice(0, 200) : null,
        entree.cibleId ?? null,
        ip,
        JSON.stringify(entree.details ?? {}),
      ],
    );
  } catch (erreur) {
    console.error(
      "[journal] écriture impossible :",
      (erreur as Error).message.slice(0, 200),
    );
  }
}
