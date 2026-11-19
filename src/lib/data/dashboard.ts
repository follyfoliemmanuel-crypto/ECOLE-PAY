import { sql, uneLigne } from "../db";
import type { Frequence, Paiement, StatutFrais } from "../types";

export type ResumePeriode = {
  eleves: number;
  attendu: number;
  encaisse: number;
  restant: number;
  payes: number;
  partiels: number;
  impayes: number;
};

/** Argent des inscriptions / réinscriptions, séparé de la scolarité. */
export type ResumeInscriptions = {
  attendu: number;
  encaisse: number;
  restant: number;
  payes: number;
  enAttente: number;
  elevesInscrits: number;
  totalEleves: number;
};

export type LigneClasse = {
  id: string;
  nom: string;
  montant_periode: number;
  frequence_paiement: Frequence;
  nb_eleves: number;
  payes: number;
  partiels: number;
  impayes: number;
  attendu: number;
  encaisse: number;
  restant: number;
  nb_tranches: number;
  total_tranches: number;
};

export type Impaye = {
  frais_id: string;
  eleve_id: string;
  nom: string;
  prenom: string;
  classe_nom: string;
  nom_parent: string;
  telephone_parent: string;
  type_frais: "SCOLARITE" | "INSCRIPTION" | "REINSCRIPTION";
  frequence_paiement: Frequence;
  periode: number;
  /** Nom figé de l'échéance (« 1ère tranche », « Octobre »…). */
  libelle: string | null;
  montant_du: number;
  montant_paye: number;
  reste: number;
  statut: StatutFrais;
};

export type PointPeriode = {
  periode: number;
  libelle: string | null;
  attendu: number;
  encaisse: number;
};

export type Dashboard = {
  resume: ResumePeriode;
  inscriptions: ResumeInscriptions;
  classes: LigneClasse[];
  impayes: Impaye[];
  serie: PointPeriode[];
  derniersPaiements: Paiement[];
  /**
   * Recettes réellement encaissées pendant le mois de la période (mensuel).
   *
   * `total` additionne TOUS les paiements de scolarité mensuelle reçus ce
   * mois-là, même ceux affectés à une autre échéance (avance pour décembre,
   * ou retard d'octobre). C'est le chiffre qui bouge à chaque encaissement.
   */
  recettes: RecettesMois | null;
};

export type RecettesMois = {
  /** Année calendaire du mois concerné (2026). */
  annee: number;
  /** Mois calendaire (1..12). */
  mois: number;
  /** Tout l'encaissé du mois, toutes échéances mensuelles confondues. */
  total: number;
  /** Part affectée à la période affichée. */
  pourPeriode: number;
  /** Parts affectées à d'autres mois (avances ou retards). */
  autres: { periode: number; montant: number }[];
};

const RESUME_VIDE: ResumePeriode = {
  eleves: 0,
  attendu: 0,
  encaisse: 0,
  restant: 0,
  payes: 0,
  partiels: 0,
  impayes: 0,
};

const INSCRIPTIONS_VIDES: ResumeInscriptions = {
  attendu: 0,
  encaisse: 0,
  restant: 0,
  payes: 0,
  enAttente: 0,
  elevesInscrits: 0,
  totalEleves: 0,
};

/**
 * Mois calendaire d'une période mensuelle.
 *
 * Période 1 = septembre (mois 9), période 4 = décembre (mois 12),
 * période 5 = janvier de l'année suivante (mois 1).
 */
function moisCalendaire(
  annee: string,
  periode: number,
): { annee: number; mois: number } {
  const debut = Number.parseInt(annee.slice(0, 4), 10);
  const numero = 8 + periode; // 9 … 18
  return numero > 12
    ? { annee: debut + 1, mois: numero - 12 }
    : { annee: debut, mois: numero };
}

export async function getDashboard(
  ecoleId: string,
  annee: string,
  frequence: Frequence,
  periode: number,
): Promise<Dashboard> {
  const mois =
    frequence === "MENSUEL" && periode > 0
      ? moisCalendaire(annee, periode)
      : {
          annee: new Date().getFullYear(),
          mois: new Date().getMonth() + 1,
        };

  const [resume, inscriptions, classes, impayes, serie, derniersPaiements, recettesLignes] =
    await Promise.all([
      uneLigne<ResumePeriode>(
        `select count(distinct e.id)::int as eleves,
                coalesce(sum(f.montant_du), 0)::int as attendu,
                coalesce(sum(f.montant_paye), 0)::int as encaisse,
                coalesce(sum(f.reste), 0)::int as restant,
                count(distinct e.id) filter (
                  where not exists (
                    select 1 from frais f2
                     where f2.eleve_id = e.id
                       and f2.ecole_id = $1
                       and f2.annee_scolaire = $2
                       and f2.type_frais = 'SCOLARITE'
                       and (
                         $4::int = 0
                         or (f2.frequence_paiement = $3 and f2.periode = $4)
                       )
                       and f2.reste > 0
                  )
                )::int as payes,
                count(distinct e.id) filter (
                  where exists (
                    select 1 from frais f2
                     where f2.eleve_id = e.id
                       and f2.ecole_id = $1
                       and f2.annee_scolaire = $2
                       and f2.type_frais = 'SCOLARITE'
                       and (
                         $4::int = 0
                         or (f2.frequence_paiement = $3 and f2.periode = $4)
                       )
                       and f2.montant_paye > 0
                  )
                  and exists (
                    select 1 from frais f2
                     where f2.eleve_id = e.id
                       and f2.ecole_id = $1
                       and f2.annee_scolaire = $2
                       and f2.type_frais = 'SCOLARITE'
                       and (
                         $4::int = 0
                         or (f2.frequence_paiement = $3 and f2.periode = $4)
                       )
                       and f2.reste > 0
                  )
                )::int as partiels,
                count(distinct e.id) filter (
                  where exists (
                    select 1 from frais f2
                     where f2.eleve_id = e.id
                       and f2.ecole_id = $1
                       and f2.annee_scolaire = $2
                       and f2.type_frais = 'SCOLARITE'
                       and (
                         $4::int = 0
                         or (f2.frequence_paiement = $3 and f2.periode = $4)
                       )
                  )
                  and not exists (
                    select 1 from frais f2
                     where f2.eleve_id = e.id
                       and f2.ecole_id = $1
                       and f2.annee_scolaire = $2
                       and f2.type_frais = 'SCOLARITE'
                       and (
                         $4::int = 0
                         or (f2.frequence_paiement = $3 and f2.periode = $4)
                       )
                       and f2.montant_paye > 0
                  )
                )::int as impayes
           from frais f
           join eleves e on e.id = f.eleve_id
          where f.ecole_id = $1
            and f.annee_scolaire = $2
            and f.type_frais = 'SCOLARITE'
            and (
              $4::int = 0
              or (f.frequence_paiement = $3 and f.periode = $4)
            )
            and e.statut = 'actif'
            and e.annee_scolaire = $2`,
        [ecoleId, annee, frequence, periode],
      ),
      uneLigne<ResumeInscriptions>(
        `select coalesce(sum(f.montant_du), 0)::int as attendu,
                coalesce(sum(f.montant_paye), 0)::int as encaisse,
                coalesce(sum(f.reste), 0)::int as restant,
                count(*) filter (where f.statut = 'PAYE')::int as payes,
                count(*) filter (where f.statut <> 'PAYE')::int as "enAttente",
                count(distinct f.eleve_id)::int as "totalEleves",
                count(distinct f.eleve_id) filter (where f.statut = 'PAYE')::int
                  as "elevesInscrits"
           from frais f
           join eleves e on e.id = f.eleve_id
          where f.ecole_id = $1
            and f.annee_scolaire = $2
            and f.type_frais in ('INSCRIPTION', 'REINSCRIPTION')
            and e.statut = 'actif'
            and e.annee_scolaire = $2`,
        [ecoleId, annee],
      ),
      sql<LigneClasse>(
        `select c.id, c.nom, c.montant_periode, c.frequence_paiement,
                count(distinct e.id)::int as nb_eleves,
                count(distinct e.id) filter (
                  where not exists (
                    select 1 from frais f2
                     where f2.eleve_id = e.id
                       and f2.ecole_id = c.ecole_id
                       and f2.annee_scolaire = $2
                       and f2.type_frais = 'SCOLARITE'
                       and ($4::int = 0 or (f2.frequence_paiement = $3 and f2.periode = $4))
                       and f2.reste > 0
                  )
                )::int as payes,
                count(distinct e.id) filter (
                  where exists (
                    select 1 from frais f2
                     where f2.eleve_id = e.id
                       and f2.ecole_id = c.ecole_id
                       and f2.annee_scolaire = $2
                       and f2.type_frais = 'SCOLARITE'
                       and ($4::int = 0 or (f2.frequence_paiement = $3 and f2.periode = $4))
                       and f2.montant_paye > 0
                  )
                  and exists (
                    select 1 from frais f2
                     where f2.eleve_id = e.id
                       and f2.ecole_id = c.ecole_id
                       and f2.annee_scolaire = $2
                       and f2.type_frais = 'SCOLARITE'
                       and ($4::int = 0 or (f2.frequence_paiement = $3 and f2.periode = $4))
                       and f2.reste > 0
                  )
                )::int as partiels,
                count(distinct e.id) filter (
                  where exists (
                    select 1 from frais f2
                     where f2.eleve_id = e.id
                       and f2.ecole_id = c.ecole_id
                       and f2.annee_scolaire = $2
                       and f2.type_frais = 'SCOLARITE'
                       and ($4::int = 0 or (f2.frequence_paiement = $3 and f2.periode = $4))
                  )
                  and not exists (
                    select 1 from frais f2
                     where f2.eleve_id = e.id
                       and f2.ecole_id = c.ecole_id
                       and f2.annee_scolaire = $2
                       and f2.type_frais = 'SCOLARITE'
                       and ($4::int = 0 or (f2.frequence_paiement = $3 and f2.periode = $4))
                       and f2.montant_paye > 0
                  )
                )::int as impayes,
                coalesce(sum(f.montant_du), 0)::int as attendu,
                coalesce(sum(f.montant_paye), 0)::int as encaisse,
                coalesce(sum(f.reste), 0)::int as restant,
                (select count(*)::int from tranches t
                  where t.classe_id = c.id) as nb_tranches,
                (select coalesce(sum(t.montant), 0)::int from tranches t
                  where t.classe_id = c.id) as total_tranches
           from classes c
           left join eleves e
             on e.classe_id = c.id
            and e.ecole_id = c.ecole_id
            and e.annee_scolaire = $2
            and e.statut = 'actif'
           left join frais f
             on f.eleve_id = e.id
            and f.ecole_id = c.ecole_id
            and f.annee_scolaire = $2
            and f.type_frais = 'SCOLARITE'
            and f.frequence_paiement = c.frequence_paiement
            and ($4::int = 0 or (f.frequence_paiement = $3 and f.periode = $4))
          where c.ecole_id = $1
          group by c.id
          order by c.ordre, c.nom`,
        [ecoleId, annee, frequence, periode],
      ),
      sql<Impaye>(
        `select f.id as frais_id, e.id as eleve_id, e.nom, e.prenom,
                c.nom as classe_nom, e.nom_parent, e.telephone_parent,
                f.type_frais, f.frequence_paiement, f.periode, f.libelle,
                f.montant_du, f.montant_paye, f.reste, f.statut
           from frais f
           join eleves e on e.id = f.eleve_id
           join classes c on c.id = e.classe_id
          where f.ecole_id = $1
            and f.annee_scolaire = $2
            and f.statut <> 'PAYE'
            and e.statut = 'actif'
            and (
              ($4::int = 0 and f.type_frais = 'SCOLARITE')
              or ($4::int > 0 and f.type_frais = 'SCOLARITE'
                  and f.frequence_paiement = $3 and f.periode = $4)
              or f.type_frais in ('INSCRIPTION', 'REINSCRIPTION')
            )
          order by f.reste desc, e.nom
          limit 10`,
        [ecoleId, annee, frequence, periode],
      ),
      sql<PointPeriode>(
        `select f.periode,
                min(f.libelle) as libelle,
                coalesce(sum(f.montant_du), 0)::int as attendu,
                coalesce(sum(f.montant_paye), 0)::int as encaisse
           from frais f
           join eleves e on e.id = f.eleve_id
          where f.ecole_id = $1
            and f.annee_scolaire = $2
            and f.type_frais = 'SCOLARITE'
            and f.frequence_paiement = $3
            and e.statut = 'actif'
          group by f.periode
          order by f.periode`,
        [ecoleId, annee, frequence],
      ),
      sql<Paiement>(
        `select p.id, p.numero_recu, p.montant, p.mode_paiement,
                to_char(p.date_paiement, 'YYYY-MM-DD"T"HH24:MI:SS"Z"') as date_paiement,
                p.annule, p.reste_apres, p.eleve_id, p.frais_id,
                e.nom as eleve_nom, e.prenom as eleve_prenom,
                c.nom as classe_nom,
                p.type_frais, p.frequence_paiement, p.periode,
                p.libelle, p.tranche_id,
                f.montant_du, f.reste,
                u.nom as enregistre_par_nom
           from paiements p
           join eleves e on e.id = p.eleve_id
           join classes c on c.id = e.classe_id
           join frais f on f.id = p.frais_id
           left join users u on u.id = p.enregistre_par
          where p.ecole_id = $1 and p.annule = false
          order by p.date_paiement desc
          limit 5`,
        [ecoleId],
      ),
      sql<{ periode: number; montant: number }>(
        `select p.periode, coalesce(sum(p.montant), 0)::int as montant
           from paiements p
           join frais f on f.id = p.frais_id
          where p.ecole_id = $1
            and f.annee_scolaire = $4
            and p.annule = false
            and (
              $5::boolean
              or (p.date_paiement >= make_date($2::int, $3::int, 1)
                  and p.date_paiement < make_date($2::int, $3::int, 1) + interval '1 month')
            )
          group by p.periode
          order by montant desc`,
        [ecoleId, mois.annee, mois.mois, annee, periode === 0],
      ),
    ]);

  // « Toutes les périodes » = tout l'encaissé de l'année scolaire, quelle que
  // soit la fréquence des classes et le mois du paiement. C'est ce total qui
  // doit bouger dès qu'un encaissement est validé, même en milieu de période.
  if (periode === 0) {
    const totalAnnee = recettesLignes.reduce(
      (somme, ligne) => somme + ligne.montant,
      0,
    );
    return {
      resume: resume ?? RESUME_VIDE,
      inscriptions: inscriptions ?? INSCRIPTIONS_VIDES,
      classes,
      impayes,
      serie,
      derniersPaiements,
      recettes: {
        annee: mois.annee,
        mois: mois.mois,
        total: totalAnnee,
        pourPeriode: totalAnnee,
        autres: [],
      },
    };
  }

  const recettes: RecettesMois = {
    annee: mois.annee,
    mois: mois.mois,
    total: recettesLignes.reduce((somme, ligne) => somme + ligne.montant, 0),
    pourPeriode:
      periode === 0
        ? recettesLignes.reduce((somme, ligne) => somme + ligne.montant, 0)
        : (recettesLignes.find((ligne) => ligne.periode === periode)?.montant ?? 0),
    autres:
      periode === 0
        ? []
        : recettesLignes.filter((ligne) => ligne.periode !== periode),
  };

  return {
    resume: resume ?? RESUME_VIDE,
    inscriptions: inscriptions ?? INSCRIPTIONS_VIDES,
    classes,
    impayes,
    serie,
    derniersPaiements,
    recettes,
  };
}
