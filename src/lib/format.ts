/** Formatage des montants, dates et téléphones (Togo). */

const NBSP = /[\u00a0\u202f]/g;

function nombre(n: number): string {
  return Math.round(n).toLocaleString("fr-FR").replace(NBSP, " ");
}

/** 25000 → "25 000 FCFA" */
export function formatFCFA(montant: number): string {
  return `${nombre(montant)} FCFA`;
}

/** 25000 → "25 000 F" (format compact utilisé dans les messages WhatsApp). */
export function formatF(montant: number): string {
  return `${nombre(montant)} F`;
}

export function formatNombre(montant: number): string {
  return nombre(montant);
}

export function formatDate(valeur: Date | string): string {
  const date = typeof valeur === "string" ? new Date(valeur) : valeur;
  return date.toLocaleDateString("fr-FR", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

export function formatDateHeure(valeur: Date | string): string {
  const date = typeof valeur === "string" ? new Date(valeur) : valeur;
  return date.toLocaleDateString("fr-FR", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

/** Date au format input[type=date] (AAAA-MM-JJ), en heure locale. */
export function dateInput(valeur: Date | string = new Date()): string {
  const date = typeof valeur === "string" ? new Date(valeur) : valeur;
  const decalage = date.getTimezoneOffset() * 60_000;
  return new Date(date.getTime() - decalage).toISOString().slice(0, 10);
}

export function initiales(nom: string, prenom: string): string {
  return `${prenom.charAt(0)}${nom.charAt(0)}`.toUpperCase();
}

export function nomComplet(nom: string, prenom: string): string {
  return `${prenom} ${nom}`;
}

/**
 * Normalise un numéro togolais sur 8 chiffres.
 * Accepte "90 12 34 56", "+228 90123456", "22890123456".
 */
export function normaliserTelephone(brut: string): string | null {
  let chiffres = (brut ?? "").replace(/\D/g, "");
  if (chiffres.startsWith("228")) chiffres = chiffres.slice(3);
  if (!/^(90|91|92|93|70|99)\d{6}$/.test(chiffres)) return null;
  return chiffres;
}

export function formatTelephone(tel: string): string {
  const chiffres = (tel ?? "").replace(/\D/g, "").slice(-8);
  if (chiffres.length !== 8) return tel;
  return `${chiffres.slice(0, 2)} ${chiffres.slice(2, 4)} ${chiffres.slice(4, 6)} ${chiffres.slice(6, 8)}`;
}

/** Pourcentage entier, sans division par zéro. */
export function pourcentage(partie: number, total: number): number {
  if (!total) return 0;
  return Math.round((partie / total) * 100);
}

export function nomFichier(prefixe: string): string {
  return `${prefixe}-${new Date().toISOString().slice(0, 10)}.pdf`;
}
