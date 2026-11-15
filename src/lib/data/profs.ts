import { sql } from "../db";
import type { Prof, SalaireMois, VersementSalaire } from "../types";

/** Tous les professeurs, actifs d'abord, avec leur compte de connexion. */
export async function listerProfs(ecoleId: string): Promise<Prof[]> {
  return sql<Prof>(
    `select p.id, p.nom, p.prenom, p.telephone, p.email, p.matiere,
            p.classes_assurees, p.salaire_mensuel,
            p.date_embauche::text as date_embauche, p.actif, p.notes,
            p.user_id, u.identifiant, u.actif as compte_actif
       from profs p
       left join users u on u.id = p.user_id
      where p.ecole_id = $1
      order by p.actif desc, p.nom, p.prenom`,
    [ecoleId],
  );
}

/**
 * Situation de paie d'un mois : un professeur actif sans ligne de salaire est
 * affiché avec son salaire théorique et le statut NON_PREPARE.
 */
export async function situationSalaires(
  ecoleId: string,
  annee: number,
  mois: number,
): Promise<SalaireMois[]> {
  return sql<SalaireMois>(
    `select p.id as prof_id, p.nom, p.prenom, p.telephone, p.salaire_mensuel,
            s.id as salaire_id,
            coalesce(s.montant_du, p.salaire_mensuel)::int as montant_du,
            coalesce(s.montant_paye, 0)::int as montant_paye,
            coalesce(s.reste, greatest(p.salaire_mensuel, 0))::int as reste,
            coalesce(s.statut, 'NON_PREPARE') as statut
       from profs p
       left join salaires s
         on s.prof_id = p.id
        and s.ecole_id = p.ecole_id
        and s.annee = $2
        and s.mois = $3
      where p.ecole_id = $1
        and p.actif = true
      order by p.nom, p.prenom`,
    [ecoleId, annee, mois],
  );
}

/** Derniers versements de salaires, tous professeurs confondus. */
export async function versementsRecents(
  ecoleId: string,
  limite = 15,
): Promise<VersementSalaire[]> {
  return sql<VersementSalaire>(
    `select v.id, v.salaire_id, s.prof_id,
            p.nom as prof_nom, p.prenom as prof_prenom,
            s.annee, s.mois, v.montant, v.mode_paiement,
            v.date_versement::text as date_versement, v.observation,
            u.nom as enregistre_par_nom
       from versements_salaires v
       join salaires s on s.id = v.salaire_id
       join profs p on p.id = s.prof_id
       left join users u on u.id = v.enregistre_par
      where v.ecole_id = $1
      order by v.date_versement desc, v.date_creation desc
      limit $2`,
    [ecoleId, limite],
  );
}
