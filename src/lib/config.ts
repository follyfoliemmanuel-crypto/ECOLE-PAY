/**
 * Coordonnées commerciales d'ECOLE PAY.
 *
 * ⚠️ Ce module est réservé aux composants serveur : il lit `process.env`
 * dynamiquement. Dans un composant client, utilisez la variable littérale
 * `process.env.NEXT_PUBLIC_...` pour que Next.js l'inline au build.
 *
 * Un seul endroit à modifier avant la mise en production ; chaque valeur peut
 * aussi être pilotée par variable d'environnement (préfixe NEXT_PUBLIC_).
 */
const env = (nom: string, defaut: string) => {
  const valeur = process.env[nom];
  return valeur && valeur.trim() !== "" ? valeur.trim() : defaut;
};

export const COMMERCIAL = {
  /** Email de contact et d'activation des formules. */
  email: env("NEXT_PUBLIC_CONTACT_EMAIL", "follyfoliemmanuel@gmail.com"),
  /** Numéro WhatsApp commercial, format international sans « + » (wa.me). */
  whatsapp: env("NEXT_PUBLIC_CONTACT_WHATSAPP", "22870309744"),
  /** Même numéro, format lisible. */
  whatsappAffichage: env(
    "NEXT_PUBLIC_CONTACT_WHATSAPP_AFFICHAGE",
    "+228 70309744",
  ),
  /** Numéro Flooz (Moov Togo) pour le paiement des formules. */
  flooz: env("NEXT_PUBLIC_FLOOZ_NUMBER", "+228 70309744"),
  /** Numéro TMoney (Togocom) pour le paiement des formules. */
  tmoney: env("NEXT_PUBLIC_TMONEY_NUMBER", "+228 70309744"),
  /** Nom du bénéficiaire des transferts Mobile Money. */
  beneficiaire: env("NEXT_PUBLIC_MONEY_BENEFICIAIRE", "ECOLE PAY SARL"),
  /** Adresse publique du site. */
  siteUrl: env("NEXT_PUBLIC_SITE_URL", "https://ecolepay.tg"),
  /** Lien de téléchargement de l'application Windows (.exe). */
  telechargementBureau: env("NEXT_PUBLIC_DESKTOP_DOWNLOAD_URL", ""),
} as const;

/** Lien wa.me prêt à l'emploi. */
export function lienWhatsAppCommercial(message: string): string {
  return `https://wa.me/${COMMERCIAL.whatsapp}?text=${encodeURIComponent(message)}`;
}
