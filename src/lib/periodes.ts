import {
  MOIS_SCOLAIRES,
  libelleAnnee,
  moisScolaireCourant,
} from "./mois";
import type { Frequence, TypeFrais } from "./types";

/**
 * Périodes de l'année scolaire.
 *
 * Une classe choisit son rythme :
 *   • MENSUEL   → 10 périodes (Septembre → Juin)
 *   • TRANCHES  → autant de tranches que l'école le décide (2, 3, 4…), avec
 *                 un nom, un montant et une date limite propres à la classe.
 *   • ANNUEL    → 1 période (l'année entière)
 *
 * L'inscription et la réinscription sont des échéances spéciales, hors période
 * de scolarité : elles portent la période 0 en base.
 */

export const FREQUENCES: {
  valeur: Frequence;
  libelle: string;
  court: string;
  /** 0 = nombre libre, défini par la classe. */
  nbPeriodes: number;
  suffixe: string;
}[] = [
  {
    valeur: "MENSUEL",
    libelle: "Mensuel",
    court: "Mois",
    nbPeriodes: 10,
    suffixe: "/ mois",
  },
  {
    valeur: "TRANCHES",
    libelle: "Tranches libres",
    court: "Tranche",
    nbPeriodes: 0,
    suffixe: "",
  },
  {
    valeur: "ANNUEL",
    libelle: "Annuel",
    court: "Année",
    nbPeriodes: 1,
    suffixe: "/ an",
  },
];

export const LIBELLES_FREQUENCE: Record<Frequence, string> = {
  MENSUEL: "Mensuel",
  TRANCHES: "Tranches libres",
  ANNUEL: "Annuel",
};

export const LIBELLES_FREQUENCE_COURT: Record<Frequence, string> = {
  MENSUEL: "Mois",
  TRANCHES: "Tranche",
  ANNUEL: "Année",
};

export const LIBELLES_TYPE_FRAIS: Record<TypeFrais, string> = {
  SCOLARITE: "Scolarité",
  INSCRIPTION: "Inscription",
  REINSCRIPTION: "Réinscription",
};

const FREQUENCES_VALIDES: Frequence[] = ["MENSUEL", "TRANCHES", "ANNUEL"];

export function estFrequence(valeur: unknown): valeur is Frequence {
  return FREQUENCES_VALIDES.includes(valeur as Frequence);
}

/** 0 pour les tranches libres : le nombre vient de la classe. */
export function nombrePeriodes(frequence: Frequence): number {
  switch (frequence) {
    case "TRANCHES":
      return 0;
    case "ANNUEL":
      return 1;
    default:
      return 10;
  }
}

/** "/ mois", "" (tranches) ou "/ an" pour les libellés de tarif. */
export function suffixePeriode(frequence: Frequence): string {
  return FREQUENCES.find((f) => f.valeur === frequence)?.suffixe ?? "/ mois";
}

/** Lit un paramètre d'URL et renvoie une fréquence valide. */
export function frequenceDepuisParametre(
  valeur: string | undefined,
  defaut: Frequence = "MENSUEL",
): Frequence {
  return estFrequence(valeur) ? valeur : defaut;
}

export type Periode = {
  /** 1 = première période de l'année (Septembre, T1 ou l'année). */
  numero: number;
  court: string;
  long: string;
};

/** Toutes les périodes d'une fréquence, avec leurs libellés. */
export function periodesDe(
  frequence: Frequence,
  annee: string,
  nbTranches = 3,
  inclureToutes = true,
): Periode[] {
  const base: Periode[] = [];
  if (inclureToutes) {
    base.push({
      numero: 0,
      court: frequence === "TRANCHES" ? "Toutes" : "Toutes",
      long:
        frequence === "TRANCHES"
          ? "Toutes les tranches"
          : frequence === "ANNUEL"
            ? `Toute l'année (${libelleAnnee(annee)})`
            : "Toutes les périodes (global)",
    });
  }

  if (frequence === "TRANCHES") {
    const total = Math.max(1, Math.min(20, nbTranches));
    for (let index = 0; index < total; index++) {
      base.push({
        numero: index + 1,
        court: `Tr. ${index + 1}`,
        long: `Tranche ${index + 1}`,
      });
    }
    return base;
  }

  if (frequence === "ANNUEL") {
    if (!inclureToutes) {
      base.push({
        numero: 1,
        court: "Année",
        long: `Année ${libelleAnnee(annee)}`,
      });
    }
    return base;
  }

  return base.concat(
    MOIS_SCOLAIRES.map((mois) => ({
      numero: mois.numero,
      court: mois.court,
      long: mois.long,
    })),
  );
}

/** Libellé d'une période de scolarité. */
export function libellePeriode(
  frequence: Frequence,
  periode: number,
  annee: string,
  court = false,
  nbTranches = 3,
): string {
  if (periode === 0) {
    if (frequence === "TRANCHES") {
      return court ? "Toutes" : "Toutes les tranches";
    }
    if (frequence === "ANNUEL") {
      return court ? "Année" : `Année ${libelleAnnee(annee)}`;
    }
    return court ? "Toutes" : "Toutes les périodes";
  }
  const trouvee = periodesDe(frequence, annee, nbTranches, false).find(
    (p) => p.numero === periode,
  );
  if (!trouvee) return frequence === "TRANCHES" ? `Tranche ${periode}` : "";
  return court ? trouvee.court : trouvee.long;
}

/**
 * Période en cours pour une fréquence donnée.
 * Juillet et août sont hors année scolaire : on retombe sur la première période.
 */
export function periodeCourante(
  frequence: Frequence,
  date: Date = new Date(),
): number {
  if (frequence === "ANNUEL" || frequence === "TRANCHES") return 1;

  return moisScolaireCourant(date);
}

/** Lit un paramètre d'URL et renvoie une période valide pour la fréquence. */
export function periodeDepuisParametre(
  valeur: string | undefined,
  frequence: Frequence,
  defaut: number = 0,
  nbTranches = 20,
): number {
  if (
    valeur === undefined ||
    valeur === "" ||
    valeur === "0" ||
    valeur === "toutes" ||
    valeur === "tous"
  ) {
    return defaut;
  }
  const n = Number.parseInt(valeur, 10);
  const maximum =
    frequence === "TRANCHES" ? Math.max(1, nbTranches) : nombrePeriodes(frequence);
  if (!Number.isFinite(n) || n < 0 || n > maximum) {
    return defaut;
  }
  return n;
}

/** « Scolarité », « Frais d'inscription », « Frais de réinscription ». */
export function libelleNature(type: TypeFrais): string {
  switch (type) {
    case "INSCRIPTION":
      return "Frais d'inscription";
    case "REINSCRIPTION":
      return "Frais de réinscription";
    default:
      return "Scolarité";
  }
}

/**
 * Texte de la période pour un message WhatsApp.
 * On privilégie le libellé figé de l'échéance (« 1ère tranche », « Octobre »).
 */
export function libellePeriodeFrais(
  type: TypeFrais,
  frequence: Frequence,
  periode: number,
  annee: string,
  libelle?: string | null,
): string {
  if (libelle) return libelle;
  if (type === "SCOLARITE") {
    return libellePeriode(frequence, periode, annee);
  }
  return LIBELLES_TYPE_FRAIS[type];
}

/** Libellé court d'une échéance, pour les tableaux et les boutons. */
export function libelleFrais(
  type: TypeFrais,
  frequence: Frequence,
  periode: number,
  annee: string,
  court = false,
): string {
  if (type === "SCOLARITE") {
    return libellePeriode(frequence, periode, annee, court);
  }
  return LIBELLES_TYPE_FRAIS[type];
}

/**
 * Libellé d'une ligne d'échéance réelle (frais ou paiement) : on utilise le
 * nom figé en base, sinon on retombe sur le libellé calculé.
 */
export function libelleEcheance(
  echeance: {
    type_frais: TypeFrais;
    frequence_paiement: Frequence;
    periode: number;
    libelle?: string | null;
  },
  annee: string,
  court = false,
): string {
  if (echeance.libelle) return echeance.libelle;
  return libelleFrais(
    echeance.type_frais,
    echeance.frequence_paiement,
    echeance.periode,
    annee,
    court,
  );
}
