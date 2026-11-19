import { motifLectureSeule } from "../activation";
import { uneLigne } from "../db";
import { offreDepuisPlan } from "../offres";
import type { MotifLectureSeule, Offre, StatutAbo, StatutEcole } from "../types";

/** Ligne minimale nécessaire pour savoir si l'école est en lecture seule. */
export type LigneAcces = {
  statut: StatutEcole;
  date_fin_essai: string | null;
  abo_status: string | null;
  abo_date_fin: string | null;
};

/** Applique la règle de paiement à une ligne issue de la base. */
export function motifLectureSeuleDepuis(
  ligne: LigneAcces,
): MotifLectureSeule | null {
  return motifLectureSeule({
    statut: ligne.statut,
    dateFinEssai: ligne.date_fin_essai,
    abonnement:
      ligne.abo_status && ligne.abo_date_fin
        ? {
            statut: ligne.abo_status === "blocked" ? "blocked" : "active",
            dateFin: ligne.abo_date_fin,
          }
        : null,
  });
}

export type AbonnementComplet = {
  plan: Offre;
  planBrut: string;
  statut: StatutAbo;
  dateDebut: string;
  dateFin: string;
  dernierPaiement: string | null;
  montant: number;
  moisPayes: number;
  moisOfferts: number;
};

/** Abonnement courant d'une école (table subscriptions), ou null. */
export async function abonnementEcole(
  ecoleId: string,
): Promise<AbonnementComplet | null> {
  const ligne = await uneLigne<{
    plan: string;
    status: string;
    date_debut: string;
    date_fin: string;
    dernier_paiement: string | null;
    montant: number;
    mois_payes: number;
    mois_offerts: number;
  }>(
    `select plan, status,
            date_debut::text as date_debut,
            date_fin::text as date_fin,
            dernier_paiement::text as dernier_paiement,
            montant, mois_payes, mois_offerts
       from subscriptions
      where school_id = $1`,
    [ecoleId],
  );

  if (!ligne) return null;

  return {
    plan: offreDepuisPlan(ligne.plan),
    planBrut: ligne.plan,
    statut: ligne.status === "blocked" ? "blocked" : "active",
    dateDebut: ligne.date_debut,
    dateFin: ligne.date_fin,
    dernierPaiement: ligne.dernier_paiement,
    montant: ligne.montant,
    moisPayes: ligne.mois_payes,
    moisOfferts: ligne.mois_offerts,
  };
}
