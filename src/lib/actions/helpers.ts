/** Petites aides partagées par les Server Actions. */

/**
 * Longueur maximale d'un champ texte issu d'un formulaire.
 *
 * Borne de sécurité : un client malveillant peut envoyer un champ de plusieurs
 * centaines de kilo-octets. Aucun champ réel (nom, téléphone, modèle de reçu,
 * adresse) n'approche cette limite.
 */
const LONGUEUR_TEXTE_MAX = 2000;

export function texte(donnees: FormData, nom: string): string {
  const valeur = donnees.get(nom);
  return typeof valeur === "string"
    ? valeur.trim().slice(0, LONGUEUR_TEXTE_MAX)
    : "";
}

export function entier(donnees: FormData, nom: string): number {
  const valeur = texte(donnees, nom).replace(/[^\d-]/g, "");
  const nombre = Number.parseInt(valeur, 10);
  return Number.isFinite(nombre) ? nombre : Number.NaN;
}

export function estUuid(valeur: string): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
    valeur,
  );
}

export function estEmail(valeur: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(valeur);
}

/** Message utilisable tel quel dans l'interface (jamais de SQL brut). */
export function messageErreurBdd(erreur: unknown): string {
  const e = erreur as { code?: string; message?: string; constraint?: string };

  if (e?.code === "23505") {
    if (e.constraint?.includes("identifiant")) {
      return "Cet identifiant de connexion est déjà utilisé. Choisissez-en un autre.";
    }
    if (e.constraint?.includes("email")) {
      return "Un compte existe déjà avec cet email.";
    }
    if (e.constraint?.includes("classes_ecole_nom")) {
      return "Une classe porte déjà ce nom.";
    }
    return "Cette information existe déjà.";
  }

  if (e?.message?.includes("MONTANT_DEPASSE")) {
    return "Le montant dépasse le reste dû pour cette échéance.";
  }

  if (e?.message?.includes("SALAIRE_DEPASSE")) {
    return "Le montant dépasse le reste à verser pour ce salaire.";
  }

  if (e?.code === "23514" || e?.code === "23503") {
    return "Cette opération n'est pas autorisée par les règles de gestion.";
  }

  // Journalisation bornée : jamais l'objet d'erreur complet, dont le champ
  // `detail` de PostgreSQL peut recopier des valeurs personnelles
  // (email, téléphone, nom) dans les journaux.
  console.error("Erreur base de données :", {
    code: e?.code,
    contrainte: e?.constraint,
    message: String(e?.message ?? "").slice(0, 200),
  });
  return "Une erreur est survenue. Vérifiez la connexion puis réessayez.";
}

export function estErreurRedirect(erreur: unknown): boolean {
  return (
    typeof erreur === "object" &&
    erreur !== null &&
    "digest" in erreur &&
    String((erreur as { digest?: string }).digest).startsWith("NEXT_REDIRECT")
  );
}
