/**
 * Adresse publique du portail parent.
 *
 * Ces fonctions sont réservées aux composants serveur : elles lisent
 * `process.env` dynamiquement. Le lien affiché au directeur et le QR code
 * pointent toujours vers le domaine public configuré.
 */

const SITE_PAR_DEFAUT = "https://ecolepay.tg";

function site(): string {
  const valeur = process.env.NEXT_PUBLIC_SITE_URL?.trim();
  return (valeur && valeur !== "" ? valeur : SITE_PAR_DEFAUT).replace(/\/+$/, "");
}

/** https://ecolepay.tg/parent/college-la-grace */
export function lienPublicEcole(slug: string): string {
  return `${site()}/parent/${encodeURIComponent(slug)}`;
}

/** Fiche publique d'un élève (identifiant non devinable : UUID). */
export function lienPublicEleve(slug: string, eleveId: string): string {
  return `${lienPublicEcole(slug)}/eleve/${eleveId}`;
}

/** Téléchargement du bulletin PDF d'un élève. */
export function lienBulletinPdf(
  slug: string,
  eleveId: string,
  trimestre: number,
): string {
  return `${lienPublicEleve(slug, eleveId)}/bulletin?trimestre=${trimestre}`;
}

/** ecolepay.tg/parent/college-la-grace (sans protocole, pour les messages). */
export function adressePubliqueEcole(slug: string): string {
  return lienPublicEcole(slug).replace(/^https?:\/\//, "");
}

/** Message WhatsApp prêt à envoyer aux parents. */
export function messagePartageParent(slug: string): string {
  return `Bonjour chers parents, pour voir les notes de vos enfants, cliquez ici : ${adressePubliqueEcole(slug)}. Choisissez la classe et tapez le nom de votre enfant.`;
}

/** Même règle que la fonction SQL `slug_ecole`, pour les aperçus côté app. */
export function slugifier(valeur: string): string {
  const slug = valeur
    .replace(/œ/gi, "oe")
    .replace(/æ/gi, "ae")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
  return slug || "ecole";
}

export const TRIMESTRES_PORTAIL = [
  { valeur: 1 as const, libelle: "1er trimestre", court: "T1" },
  { valeur: 2 as const, libelle: "2e trimestre", court: "T2" },
  { valeur: 3 as const, libelle: "3e trimestre", court: "T3" },
];

export function libelleTrimestre(valeur: number): string {
  return (
    TRIMESTRES_PORTAIL.find((trimestre) => trimestre.valeur === valeur)
      ?.libelle ?? "1er trimestre"
  );
}

/** "3ème sur 45 élèves" (1er pour la première place). */
export function libelleRang(rang: number, effectif: number): string {
  const ordinal = rang === 1 ? "1er" : `${rang}ème`;
  return `${ordinal} sur ${effectif} élève${effectif > 1 ? "s" : ""}`;
}

/**
 * AVERTISSEMENT : ne jamais importer ce module dans un composant client.
 * Il contient l'adresse serveur et des textes destinés au rendu serveur.
 */
export const MESSAGE_AUCUN_ELEVE =
  "Aucun élève trouvé vérifiez le nom et la classe ou contactez l'école.";
export const MESSAGE_RECHERCHE_COURTE =
  "Tapez au moins 3 lettres du nom ou du prénom de votre enfant.";
