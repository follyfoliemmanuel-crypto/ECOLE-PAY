/**
 * Validation des entrées au bord de l'application.
 *
 * Chaque route API valide explicitement ce qu'elle reçoit (query string,
 * paramètres de chemin) avant d'appeler la couche données. Un champ non prévu,
 * trop long ou d'un type inattendu est rejeté avec un 400 : il n'atteint jamais
 * le SQL ni la logique métier.
 *
 * Les Server Actions valident déjà champ par champ (`texte`, `entier`), ce
 * module couvre les points d'entrée HTTP qui ne passent pas par elles.
 */
import { z } from "zod";

/** Longueur maximale d'une recherche libre (nom, prénom, parent). */
export const RECHERCHE_MAX = 60;

/** Caractères de contrôle : jamais légitimes dans un nom, toujours suspects. */
const CONTROLES = /[\u0000-\u001f\u007f]/g;

/**
 * Recherche libre : bornée en taille et nettoyée avant l'ILIKE.
 *
 * Une valeur plus longue que `RECHERCHE_MAX` est refusée plutôt que tronquée
 * silencieusement : le client doit savoir que sa requête a été rejetée.
 */
export const schemaRecherche = z.object({
  q: z
    .string()
    .max(RECHERCHE_MAX, `La recherche est limitée à ${RECHERCHE_MAX} caractères.`)
    .optional()
    .default("")
    .transform((valeur) => valeur.replace(CONTROLES, "").trim()),
});

const UUID =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

/** Identifiant technique (élève, classe, frais…) : UUID v1 à v5 uniquement. */
export const schemaUuid = z
  .string()
  .max(36, "Identifiant invalide.")
  .regex(UUID, "Identifiant invalide.");

/** Premier message d'erreur lisible d'un échec de validation. */
export function messageValidation(erreur: z.ZodError): string {
  return erreur.issues[0]?.message ?? "Requête invalide.";
}

/** En-têtes à appliquer aux réponses contenant des données personnelles. */
export const ENTETES_PRIVES = {
  "Cache-Control": "private, no-store, max-age=0",
  "X-Content-Type-Options": "nosniff",
} as const;
