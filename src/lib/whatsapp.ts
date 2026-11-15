import { formatF } from "./format";

/**
 * Messages WhatsApp.
 * Les modèles sont modifiables par le directeur (table `ecoles`).
 * Variables disponibles : {ecole} {eleve} {classe} {parent} {nature} {periode}
 * {mois} (alias de {periode}) {montant} {reste} {montant_du} {annee}
 * {recu} {mode} {date}.
 */

export type VariablesMessage = {
  ecole: string;
  eleve?: string;
  classe?: string;
  parent?: string;
  /** « Scolarité », « Frais d'inscription »… */
  nature?: string;
  /** « Septembre », « Tranche 1 », « Année 2026 – 2027 »… */
  periode?: string;
  /** @deprecated Ancien nom de {periode}, conservé pour les modèles existants. */
  mois?: string;
  montant?: number | string;
  reste?: number | string;
  montant_du?: number | string;
  annee?: string;
  /** Numéro du reçu, ex. REC-2026-00042. */
  recu?: string;
  /** Mode de paiement lisible (Espèces, Flooz, TMoney). */
  mode?: string;
  /** Date et heure du paiement, déjà formatées. */
  date?: string;
};

function valeur(v: unknown): string {
  if (typeof v === "number") return formatF(v);
  return v === undefined || v === null ? "" : String(v);
}

export function rendreMessage(modele: string, variables: VariablesMessage): string {
  const donnees: Record<string, unknown> = { ...variables };
  return modele
    .replace(/\{(\w+)\}/g, (_, cle: string) =>
      cle in donnees ? valeur(donnees[cle]) : `{${cle}}`,
    )
    .replace(/[ \t]+/g, " ")
    .trim();
}

/**
 * Lien wa.me — V1. Le message est pré-rempli, l'utilisateur appuie sur
 * « Envoyer » dans WhatsApp. Aucune API payante nécessaire.
 */
export function lienWhatsApp(telephone: string, message: string): string {
  const chiffres = (telephone ?? "").replace(/\D/g, "");
  const numero = chiffres.startsWith("228") ? chiffres : `228${chiffres}`;
  return `https://wa.me/${numero}?text=${encodeURIComponent(message)}`;
}
