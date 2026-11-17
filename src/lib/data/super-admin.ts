import { sql, uneLigne } from "../db";
import type { Offre, StatutEcole } from "../types";

export type EcoleSuperAdmin = {
  id: string;
  nom: string;
  telephone: string | null;
  email: string;
  offre: Offre;
  statut: StatutEcole;
  date_fin_essai: string | null;
  date_fin_abonnement: string | null;
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

  const [lignes, total] = await Promise.all([
    sql<EcoleSuperAdmin>(
      `select e.id, e.nom, e.telephone, e.email, e.offre, e.statut,
              e.date_fin_essai::text as date_fin_essai,
              e.date_fin_abonnement::text as date_fin_abonnement,
              (select count(*)::int from eleves el
                where el.ecole_id = e.id
                  and el.annee_scolaire = $1
                  and el.statut = 'actif') as nb_eleves,
              (select count(*)::int from classes c
                where c.ecole_id = e.id) as nb_classes,
              to_char(e.date_creation, 'YYYY-MM-DD"T"HH24:MI:SS"Z"') as date_creation
         from ecoles e
        order by
          case e.statut when 'BLOQUE' then 0 when 'ESSAI' then 1 else 2 end,
          e.date_creation desc
        limit $2 offset $3`,
      [annee, parPage, offset],
    ),
    uneLigne<{ total: number }>(`select count(*)::int as total from ecoles`),
  ]);

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
            count(*) filter (where statut = 'ACTIF')::int as actives,
            count(*) filter (where statut = 'ESSAI')::int as essais,
            count(*) filter (where statut = 'BLOQUE')::int as bloquees,
            (select count(*)::int from eleves el
              where el.annee_scolaire = $1
                and el.statut = 'actif') as eleves
       from ecoles`,
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
