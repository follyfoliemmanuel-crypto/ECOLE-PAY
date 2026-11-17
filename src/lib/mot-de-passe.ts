/**
 * Politique de mot de passe commune à tous les comptes.
 *
 * Deux contraintes techniques imposent des bornes précises :
 *  • bcrypt n'utilise que les 72 premiers **octets** : au-delà, la fin du mot
 *    de passe est silencieusement ignorée. On refuse donc explicitement les
 *    mots de passe trop longs au lieu de laisser croire qu'ils protègent ;
 *  • une longueur minimale de 10 caractères est le meilleur compromis
 *    sécurité / saisie sur un téléphone.
 */

export const LONGUEUR_MIN_MOT_DE_PASSE = 10;
export const LONGUEUR_MAX_OCTETS_MOT_DE_PASSE = 72;

/**
 * Mots de passe les plus utilisés (extrait de listes publiques) et variantes
 * évidentes du produit. Comparaison insensible à la casse.
 */
const INTERDITS = new Set([
  "1234567890",
  "12345678910",
  "azertyuiop",
  "azerty1234",
  "motdepasse",
  "motdepasse1",
  "motdepasse123",
  "password",
  "password1",
  "password123",
  "passer123",
  "passer1234",
  "qwertyuiop",
  "qwerty1234",
  "soleil1234",
  "bonjour123",
  "bonjour1234",
  "administrateur",
  "administrateur1",
  "demo1234",
  "demo123456",
  "ecolepay",
  "ecolepay123",
  "ecolepay2025",
  "ecolepay2026",
  "scolarite123",
  "togotogo123",
  "lome123456",
  "abcdefghij",
  "0123456789",
]);

/** Message d'erreur, ou `null` si le mot de passe est acceptable. */
export function validerMotDePasse(motDePasse: string): string | null {
  if (motDePasse.length < LONGUEUR_MIN_MOT_DE_PASSE) {
    return `Le mot de passe doit contenir au moins ${LONGUEUR_MIN_MOT_DE_PASSE} caractères.`;
  }
  if (
    Buffer.byteLength(motDePasse, "utf8") > LONGUEUR_MAX_OCTETS_MOT_DE_PASSE
  ) {
    return "Le mot de passe ne doit pas dépasser 72 octets (bcrypt ignore le reste).";
  }
  if (!/[a-zA-Z]/.test(motDePasse) || !/\d/.test(motDePasse)) {
    return "Le mot de passe doit contenir au moins une lettre et un chiffre.";
  }
  if (INTERDITS.has(motDePasse.toLowerCase())) {
    return "Ce mot de passe est trop courant. Choisissez-en un autre.";
  }
  if (/^(.)\1+$/.test(motDePasse)) {
    return "Ce mot de passe est trop simple : variez les caractères.";
  }
  if (motDePasse.toLowerCase().includes("ecolepay")) {
    return "Ne réutilisez pas le nom du service dans votre mot de passe.";
  }
  return null;
}
