import { sql, uneLigne } from "../db";
import { motifLectureSeuleDepuis } from "./abonnement";
import { offreDepuisPlan } from "../offres";
import type { MotifLectureSeule, Offre, StatutAbo, StatutEcole } from "../types";

export type EcoleSuperAdmin = {
  id: string;
  nom: string;
  telephone: string | null;
  email: string;
  offre: Offre;
  statut: StatutEcole;
  date_fin_essai: string | null;
  date_fin_abonnement: string | null;
  /** Abonnement mensuel (table subscriptions). */
  abo_plan: Offre | null;
  abo_status: StatutAbo | null;
  abo_date_debut: string | null;
  abo_date_fin: string | null;
  abo_dernier_paiement: string | null;
  abo_montant: number;
  abo_mois: number;
  /** Vrai quand l'école est limitée à la consultation. */
  lecture_seule: boolean;
  motif: MotifLectureSeule | null;
  nb_eleves: number;
  nb_classes: number;
  date_creation: string;
};

export type Page<T> = { lignes: T[]; total: number };

/** Une page d'écoles, sans filtre tenant : réservé au super admin. */
export async function listerEcolesSuperAdmin(
  annee: string,
  { page = 1, parPage = 20 }: { page?: number; parPage?: number } = {},
): Promise<Page<EcoleSuperAdmin>> {
  const offset = Math.max(0, (page - 1) * parPage);

  const [lignesBrutes, total] = await Promise.all([
    sql<Omit<EcoleSuperAdmin, "lecture_seule" | "motif" | "abo_plan"> & {
      abo_plan: string | null;
    }>(
      `select e.id, e.nom, e.telephone, e.email, e.offre, e.statut,
              e.date_fin_essai::text as date_fin_essai,
              e.date_fin_abonnement::text as date_fin_abonnement,
              s.plan as abo_plan,
              s.status as abo_status,
              s.date_debut::text as abo_date_debut,
              s.date_fin::text as abo_date_fin,
              s.dernier_paiement::text as abo_dernier_paiement,
              coalesce(s.montant, 0) as abo_montant,
              coalesce(s.mois_payes, 0) as abo_mois,
              (select count(*)::int from eleves el
                where el.ecole_id = e.id
                  and el.annee_scolaire = $1
                  and el.statut = 'actif') as nb_eleves,
              (select count(*)::int from classes c
                where c.ecole_id = e.id) as nb_classes,
              to_char(e.date_creation, 'YYYY-MM-DD"T"HH24:MI:SS"Z"') as date_creation
         from ecoles e
         left join subscriptions s on s.school_id = e.id
        order by
          case
            when s.status = 'blocked' then 0
            when s.date_fin is not null and current_date > s.date_fin + 5 then 1
            when e.statut = 'ESSAI' then 2
            else 3
          end,
          e.date_creation desc
        limit $2 offset $3`,
      [annee, parPage, offset],
    ),
    uneLigne<{ total: number }>(`select count(*)::int as total from ecoles`),
  ]);

  const lignes = lignesBrutes.map((ligne) => {
    const motif = motifLectureSeuleDepuis(ligne);
    return {
      ...ligne,
      abo_plan: ligne.abo_plan ? offreDepuisPlan(ligne.abo_plan) : null,
      lecture_seule: motif !== null,
      motif,
    };
  }) as EcoleSuperAdmin[];

  return { lignes, total: total?.total ?? 0 };
}

/** Compteurs globaux : calculés en base, jamais sur la page affichée. */
export async function statistiquesEcoles(annee: string): Promise<{
  total: number;
  actives: number;
  essais: number;
  bloquees: number;
  eleves: number;
}> {
  const ligne = await uneLigne<{
    total: number;
    actives: number;
    essais: number;
    bloquees: number;
    eleves: number;
  }>(
    `select count(*)::int as total,
            count(*) filter (
              where s.status = 'active' and current_date <= s.date_fin + 5
            )::int as actives,
            count(*) filter (
              where e.statut = 'ESSAI'
                and e.date_fin_essai is not null
                and current_date <= e.date_fin_essai
            )::int as essais,
            count(*) filter (
              where s.status = 'blocked'
                 or (s.date_fin is not null and current_date > s.date_fin + 5)
                 or (e.statut = 'ESSAI' and e.date_fin_essai < current_date)
                 or (s.id is null and e.statut <> 'ESSAI')
            )::int as bloquees,
            (select count(*)::int from eleves el
              where el.annee_scolaire = $1
                and el.statut = 'actif') as eleves
       from ecoles e
       left join subscriptions s on s.school_id = e.id`,
    [annee],
  );
  return {
    total: ligne?.total ?? 0,
    actives: ligne?.actives ?? 0,
    essais: ligne?.essais ?? 0,
    bloquees: ligne?.bloquees ?? 0,
    eleves: ligne?.eleves ?? 0,
  };
}

export type TentativeRefusee = {
  id: string;
  nom_ecole: string;
  telephone: string | null;
  whatsapp: string | null;
  email: string;
  ip: string | null;
  appareil: string | null;
  motif: string | null;
  essai_id: string | null;
  traite: boolean;
  date_creation: string;
};

/**
 * Journal d'audit des inscriptions refusées (anti-triche des essais).
 * Les lignes forcées par le super admin restent visibles avec `traite = true`.
 */
export async function listerTentativesRefusees(
  { page = 1, parPage = 20 }: { page?: number; parPage?: number } = {},
): Promise<Page<TentativeRefusee> & { enAttente: number }> {
  const offset = Math.max(0, (page - 1) * parPage);

  const [lignes, total] = await Promise.all([
    sql<TentativeRefusee>(
      `select id, nom_ecole, telephone, whatsapp, email, ip, appareil, motif,
              essai_id, traite,
              to_char(date_creation, 'YYYY-MM-DD"T"HH24:MI:SS"Z"') as date_creation
         from inscriptions_audit
        where type = 'REFUS'
        order by traite asc, date_creation desc
        limit $1 offset $2`,
      [parPage, offset],
    ),
    uneLigne<{ total: number; en_attente: number }>(
      `select count(*)::int as total,
              count(*) filter (where traite = false)::int as en_attente
         from inscriptions_audit
        where type = 'REFUS'`,
    ),
  ]);

  return {
    lignes,
    total: total?.total ?? 0,
    enAttente: total?.en_attente ?? 0,
  };
}

export type ActionJournalisee = {
  id: string;
  action: string;
  libelle: string;
  auteur: string;
  cible: string | null;
  ip: string | null;
  date_creation: string;
};

/** Dernières actions sensibles enregistrées, toutes écoles confondues. */
export async function listerJournal(
  { page = 1, parPage = 20 }: { page?: number; parPage?: number } = {},
): Promise<Page<ActionJournalisee>> {
  const offset = Math.max(0, (page - 1) * parPage);

  const [lignes, total] = await Promise.all([
    sql<ActionJournalisee>(
      `select id, action, libelle, auteur, cible, ip,
              to_char(date_creation, 'YYYY-MM-DD"T"HH24:MI:SS"Z"') as date_creation
         from journal_actions
        order by date_creation desc
        limit $1 offset $2`,
      [parPage, offset],
    ),
    uneLigne<{ total: number }>(`select count(*)::int as total from journal_actions`),
  ]);

  return { lignes, total: total?.total ?? 0 };
}
