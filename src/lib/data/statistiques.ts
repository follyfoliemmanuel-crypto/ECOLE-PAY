import { sql, uneLigne } from "../db";
import {
  listerClassesAvecStats,
  type ClasseStats,
} from "./classes";
import type { Frequence, ModePaiement, TypeFrais } from "../types";

export type ResumeStats = {
  eleves: number;
  attendu: number;
  encaisse: number;
  restant: number;
  payes: number;
  partiels: number;
  impayes: number;
};

export type ResumeInscriptionsStats = {
  attendu: number;
  encaisse: number;
  restant: number;
  payes: number;
  total: number;
};

export type ModeStats = {
  mode: ModePaiement;
  total: number;
  montant: number;
};

export type PointSerie = {
  periode: number;
  libelle: string | null;
  attendu: number;
  encaisse: number;
  restant: number;
};

export type NatureStats = {
  type_frais: TypeFrais;
  attendu: number;
  encaisse: number;
  restant: number;
};

export type ImpayeStats = {
  nom: string;
  prenom: string;
  classe_nom: string;
  telephone_parent: string;
  type_frais: TypeFrais;
  frequence_paiement: Frequence;
  periode: number;
  libelle: string | null;
  reste: number;
};

export type TendanceStats = {
  mois: string;
  montant: number;
};

export type Statistiques = {
  resume: ResumeStats;
  inscriptions: ResumeInscriptionsStats;
  classes: ClasseStats[];
  modes: ModeStats[];
  serie: PointSerie[];
  natures: NatureStats[];
  impayes: ImpayeStats[];
  tendance: TendanceStats[];
};

const RESUME_VIDE: ResumeStats = {
  eleves: 0,
  attendu: 0,
  encaisse: 0,
  restant: 0,
  payes: 0,
  partiels: 0,
  impayes: 0,
};

const INSCRIPTIONS_VIDES: ResumeInscriptionsStats = {
  attendu: 0,
  encaisse: 0,
  restant: 0,
  payes: 0,
  total: 0,
};

export async function getStatistiques(
  ecoleId: string,
  annee: string,
  frequence: Frequence,
  periode: number,
): Promise<Statistiques> {
  const [
    resume,
    inscriptions,
    classes,
    modes,
    serie,
    natures,
    impayes,
    tendance,
  ] = await Promise.all([
    uneLigne<ResumeStats>(
      `select count(distinct e.id)::int as eleves,
              coalesce(sum(f.montant_du), 0)::int as attendu,
              coalesce(sum(f.montant_paye), 0)::int as encaisse,
              coalesce(sum(f.reste), 0)::int as restant,
              count(f.id) filter (where f.statut = 'PAYE')::int as payes,
              count(f.id) filter (where f.statut = 'PARTIEL')::int as partiels,
              count(f.id) filter (where f.statut = 'NON_PAYE')::int as impayes
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
    uneLigne<ResumeInscriptionsStats>(
      `select coalesce(sum(f.montant_du), 0)::int as attendu,
              coalesce(sum(f.montant_paye), 0)::int as encaisse,
              coalesce(sum(f.reste), 0)::int as restant,
              count(*) filter (where f.statut = 'PAYE')::int as payes,
              count(*)::int as total
         from frais f
         join eleves e on e.id = f.eleve_id
        where f.ecole_id = $1
          and f.annee_scolaire = $2
          and f.type_frais in ('INSCRIPTION', 'REINSCRIPTION')
          and e.statut = 'actif'
          and e.annee_scolaire = $2`,
      [ecoleId, annee],
    ),
    listerClassesAvecStats(ecoleId, annee, frequence, periode),
    sql<ModeStats>(
      `select p.mode_paiement as mode,
              count(*)::int as total,
              coalesce(sum(p.montant), 0)::int as montant
         from paiements p
         join frais f on f.id = p.frais_id
        where p.ecole_id = $1
          and f.annee_scolaire = $2
          and p.annule = false
          and (
            ($4::int = 0 and p.type_frais = 'SCOLARITE')
            or (p.type_frais = 'SCOLARITE'
              and p.frequence_paiement = $3
              and p.periode = $4)
            or p.type_frais in ('INSCRIPTION', 'REINSCRIPTION')
          )
        group by p.mode_paiement
        order by montant desc`,
      [ecoleId, annee, frequence, periode],
    ),
    sql<PointSerie>(
      `select f.periode,
              min(f.libelle) as libelle,
              coalesce(sum(f.montant_du), 0)::int as attendu,
              coalesce(sum(f.montant_paye), 0)::int as encaisse,
              coalesce(sum(f.reste), 0)::int as restant
         from frais f
         join eleves e on e.id = f.eleve_id
        where f.ecole_id = $1
          and f.annee_scolaire = $2
          and f.type_frais = 'SCOLARITE'
          and f.frequence_paiement = $3
          and e.statut = 'actif'
          and e.annee_scolaire = $2
        group by f.periode
        order by f.periode`,
      [ecoleId, annee, frequence],
    ),
    sql<NatureStats>(
      `select f.type_frais,
              coalesce(sum(f.montant_du), 0)::int as attendu,
              coalesce(sum(f.montant_paye), 0)::int as encaisse,
              coalesce(sum(f.reste), 0)::int as restant
         from frais f
         join eleves e on e.id = f.eleve_id
        where f.ecole_id = $1
          and f.annee_scolaire = $2
          and e.statut = 'actif'
          and e.annee_scolaire = $2
        group by f.type_frais`,
      [ecoleId, annee],
    ),
    sql<ImpayeStats>(
      `select e.nom, e.prenom, c.nom as classe_nom, e.telephone_parent,
              f.type_frais, f.frequence_paiement, f.periode, f.libelle,
              f.reste
         from frais f
         join eleves e on e.id = f.eleve_id
         join classes c on c.id = e.classe_id
        where f.ecole_id = $1
          and f.annee_scolaire = $2
          and f.statut <> 'PAYE'
          and e.statut = 'actif'
          and (
            ($4::int = 0 and f.type_frais = 'SCOLARITE')
            or (f.type_frais = 'SCOLARITE'
              and f.frequence_paiement = $3
              and f.periode = $4)
            or f.type_frais in ('INSCRIPTION', 'REINSCRIPTION')
          )
        order by f.reste desc, e.nom
        limit 8`,
      [ecoleId, annee, frequence, periode],
    ),
    sql<TendanceStats>(
      `select to_char(p.date_paiement, 'YYYY-MM') as mois,
              coalesce(sum(p.montant), 0)::int as montant
         from paiements p
         join frais f on f.id = p.frais_id
        where p.ecole_id = $1
          and f.annee_scolaire = $2
          and p.annule = false
        group by to_char(p.date_paiement, 'YYYY-MM')
        order by mois`,
      [ecoleId, annee],
    ),
  ]);

  return {
    resume: resume ?? RESUME_VIDE,
    inscriptions: inscriptions ?? INSCRIPTIONS_VIDES,
    classes,
    modes,
    serie,
    natures,
    impayes,
    tendance,
  };
}
