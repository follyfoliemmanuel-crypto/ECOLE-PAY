/**
 * Limiteur de tentatives en mémoire.
 * Suffisant pour un déploiement mono-instance ; pour du multi-instance sur
 * Vercel, remplacer par Upstash Redis (même interface).
 */
type Etat = { tentatives: number; reinitialisation: number };

const compteurs = new Map<string, Etat>();

export function tentativesRestantes(
  cle: string,
  maximum = 8,
  fenetreMs = 10 * 60 * 1000,
): number {
  const maintenant = Date.now();
  const etat = compteurs.get(cle);
  if (!etat || etat.reinitialisation < maintenant) return maximum;
  return Math.max(0, maximum - etat.tentatives);
}

export function enregistrerTentative(
  cle: string,
  maximum = 8,
  fenetreMs = 10 * 60 * 1000,
): void {
  const maintenant = Date.now();
  const etat = compteurs.get(cle);

  if (!etat || etat.reinitialisation < maintenant) {
    compteurs.set(cle, { tentatives: 1, reinitialisation: maintenant + fenetreMs });
    return;
  }
  etat.tentatives += 1;
  compteurs.set(cle, etat);
}

/** Nettoyage opportuniste pour éviter que la Map ne grossisse sans fin. */
export function nettoyerCompteurs(): void {
  const maintenant = Date.now();
  for (const [cle, etat] of compteurs) {
    if (etat.reinitialisation < maintenant) compteurs.delete(cle);
  }
}

/** À appeler après une connexion réussie. */
export function reinitialiserTentatives(cle: string): void {
  compteurs.delete(cle);
}
