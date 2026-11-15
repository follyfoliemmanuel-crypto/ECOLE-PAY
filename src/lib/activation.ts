import type { StatutEcole } from "./types";

/**
 * Coordonnées d'activation commerciale.
 * Le super admin active les écoles payantes ; les écoles bloquées renvoient
 * vers ces mêmes coordonnées.
 */
export const ACTIVATION = {
  prix: 15_000,
  /** Numéro unique Flooz / TMoney / WhatsApp (format international). */
  numero: "22870309744",
  numeroAffichage: "+228 70309744",
  email: "follyfoliemmanuel@gmail.com",
} as const;

export type EcoleActivation = {
  statut: StatutEcole;
  dateFinEssai: string | null;
  dateFinAbonnement: string | null;
};

export type MotifBlocage = "ESSAI_TERMINE" | "ABONNEMENT_TERMINE" | "BLOQUE";

/** Date du jour au format AAAA-MM-JJ (Togo = UTC). */
export function dateDuJour(): string {
  return new Date().toISOString().slice(0, 10);
}

/** Pourquoi l'école n'a plus accès, ou null si l'accès est autorisé. */
export function motifBlocage(
  ecole: EcoleActivation,
  aujourdhui = dateDuJour(),
): MotifBlocage | null {
  if (ecole.statut === "BLOQUE") return "BLOQUE";

  if (ecole.statut === "ESSAI") {
    return ecole.dateFinEssai && ecole.dateFinEssai < aujourdhui
      ? "ESSAI_TERMINE"
      : null;
  }

  if (ecole.statut === "ACTIF") {
    return ecole.dateFinAbonnement && ecole.dateFinAbonnement < aujourdhui
      ? "ABONNEMENT_TERMINE"
      : null;
  }

  // Statut inconnu : on refuse par sécurité.
  return "BLOQUE";
}

export function accesAutorise(
  ecole: EcoleActivation,
  aujourdhui = dateDuJour(),
): boolean {
  return motifBlocage(ecole, aujourdhui) === null;
}

/** Email du seul compte autorisé sur la page super admin. */
export function emailSuperAdmin(): string {
  const valeur = process.env.SUPER_ADMIN_EMAIL?.trim().toLowerCase();
  return valeur && valeur.length > 0 ? valeur : "follyfoliemmanuel@gmail.com";
}

export function estEmailSuperAdmin(email: string): boolean {
  return email.trim().toLowerCase() === emailSuperAdmin();
}
