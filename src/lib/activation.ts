import type {
  MotifLectureSeule,
  StatutAbo,
  StatutEcole,
} from "./types";

/**
 * Coordonnées d'activation commerciale.
 * Le super admin encaisse les abonnements ; les écoles en lecture seule
 * renvoient vers ces mêmes coordonnées.
 */
export const ACTIVATION = {
  prix: 15_000,
  /** Numéro unique Flooz / TMoney / WhatsApp (format international). */
  numero: "22870309744",
  numeroAffichage: "+228 70309744",
  email: "follyfoliemmanuel@gmail.com",
} as const;

/**
 * Jour du mois au-delà duquel un impayé bascule l'école en lecture seule.
 * Le directeur paie au début du mois : sans paiement le 5, l'accès est
 * limité à la consultation jusqu'à réception du règlement.
 */
export const JOUR_LIMITE_PAIEMENT = 5;

/** Jours de tolérance après la fin de la période couverte. */
export const JOURS_GRACE = JOUR_LIMITE_PAIEMENT;

export type AbonnementAcces = {
  statut: StatutAbo;
  dateFin: string;
};

export type EcoleAcces = {
  statut: StatutEcole;
  dateFinEssai: string | null;
  /** Abonnement mensuel courant (table `subscriptions`), ou null. */
  abonnement: AbonnementAcces | null;
};

/** @deprecated Conservé pour les appels existants. */
export type EcoleActivation = EcoleAcces;

/** Date du jour au format AAAA-MM-JJ (Togo = UTC). */
export function dateDuJour(): string {
  return new Date().toISOString().slice(0, 10);
}

function ajouterJours(dateIso: string, jours: number): string {
  const date = new Date(`${dateIso}T00:00:00Z`);
  date.setUTCDate(date.getUTCDate() + jours);
  return date.toISOString().slice(0, 10);
}

/** Nombre de jours entre deux dates ISO (b - a). */
function ecartJours(a: string, b: string): number {
  const debut = Date.parse(`${a}T00:00:00Z`);
  const fin = Date.parse(`${b}T00:00:00Z`);
  return Math.round((fin - debut) / 86_400_000);
}

/**
 * Dernier jour où le paiement est encore accepté sans blocage.
 * Exemple : période couverte jusqu'au 30 septembre -> limite le 5 octobre.
 */
export function dateLimitePaiement(dateFin: string): string {
  return ajouterJours(dateFin, JOURS_GRACE);
}

/**
 * Pourquoi l'école est en lecture seule, ou null si elle peut modifier.
 * Une école en essai valide conserve toutes les fonctions PREMIUM.
 */
export function motifLectureSeule(
  ecole: EcoleAcces,
  aujourdhui = dateDuJour(),
): MotifLectureSeule | null {
  const abonnement = ecole.abonnement;

  if (abonnement) {
    if (abonnement.statut === "blocked") return "BLOQUE";
    return aujourdhui > dateLimitePaiement(abonnement.dateFin)
      ? "ABONNEMENT_TERMINE"
      : null;
  }

  if (ecole.statut === "ESSAI") {
    return ecole.dateFinEssai && ecole.dateFinEssai < aujourdhui
      ? "ESSAI_TERMINE"
      : null;
  }

  if (ecole.statut === "BLOQUE") return "BLOQUE";

  // École marquée active sans abonnement enregistré : on refuse les
  // modifications par sécurité, la consultation reste possible.
  return "ABONNEMENT_TERMINE";
}

/** @deprecated Utiliser `motifLectureSeule`. */
export const motifBlocage = motifLectureSeule;

/** Vrai si les modifications sont autorisées (paiement à jour). */
export function accesAutorise(
  ecole: EcoleAcces,
  aujourdhui = dateDuJour(),
): boolean {
  return motifLectureSeule(ecole, aujourdhui) === null;
}

/** Vrai quand l'école peut seulement consulter ses données. */
export function estEnLectureSeule(
  ecole: EcoleAcces,
  aujourdhui = dateDuJour(),
): boolean {
  return motifLectureSeule(ecole, aujourdhui) !== null;
}

/** Jours restants avant la limite de paiement (négatif = dépassé). */
export function joursAvantLimite(
  ecole: EcoleAcces,
  aujourdhui = dateDuJour(),
): number | null {
  const dateFin = ecole.abonnement?.dateFin ?? ecole.dateFinEssai;
  if (!dateFin) return null;
  return ecartJours(aujourdhui, dateLimitePaiement(dateFin));
}

/** Jours restants de période couverte (négatif = période terminée). */
export function joursCouverts(
  ecole: EcoleAcces,
  aujourdhui = dateDuJour(),
): number | null {
  const dateFin = ecole.abonnement?.dateFin ?? ecole.dateFinEssai;
  if (!dateFin) return null;
  return ecartJours(aujourdhui, dateFin);
}

/** Libellé court du motif, pour le bandeau et la page d'abonnement. */
export function libelleMotif(motif: MotifLectureSeule): string {
  switch (motif) {
    case "ESSAI_TERMINE":
      return "Essai gratuit terminé";
    case "ABONNEMENT_TERMINE":
      return "Abonnement du mois non réglé";
    default:
      return "Compte suspendu";
  }
}

/** Email du seul compte autorisé sur la page super admin. */
export function emailSuperAdmin(): string {
  const valeur = process.env.SUPER_ADMIN_EMAIL?.trim().toLowerCase();
  return valeur && valeur.length > 0 ? valeur : "follyfoliemmanuel@gmail.com";
}

export function estEmailSuperAdmin(email: string): boolean {
  return email.trim().toLowerCase() === emailSuperAdmin();
}
