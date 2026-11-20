/**
 * Une échéance n'est « impayée » qu'à partir de sa date limite.
 *
 * Le site suit la réalité : tant que la période convenue n'est pas échue, un
 * élève n'est pas en retard. Concrètement :
 *   • tranche libre → la date limite saisie sur la tranche (null = exigible) ;
 *   • mensuel      → le 5 du mois concerné (septembre = période 1) ;
 *   • annuel       → le 5 septembre de l'année scolaire ;
 *   • inscription / réinscription → le jour de l'inscription.
 *
 * La règle est centralisée dans la fonction SQL `date_echeance_frais` pour que
 * le Dashboard, les impayés, les statistiques et les exports donnent tous le
 * même résultat.
 *
 * `alias` désigne la table `frais` ; la table `eleves` doit être jointe sous
 * l'alias `e` (elle fournit la date d'inscription).
 */
export function echeanceDue(alias = "f"): string {
  return `coalesce(
    date_echeance_frais(
      ${alias}.type_frais, ${alias}.frequence_paiement, ${alias}.periode,
      ${alias}.annee_scolaire, ${alias}.tranche_id, e.date_inscription
    ),
    current_date
  ) <= current_date`;
}
