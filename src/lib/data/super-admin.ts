import { sql } from "../db";
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

/** Toutes les écoles, sans filtre tenant : réservé à la page super admin. */
export async function listerEcolesSuperAdmin(
  annee: string,
): Promise<EcoleSuperAdmin[]> {
  return sql<EcoleSuperAdmin>(
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
        e.date_creation desc`,
    [annee],
  );
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
  limite = 100,
): Promise<TentativeRefusee[]> {
  return sql<TentativeRefusee>(
    `select id, nom_ecole, telephone, whatsapp, email, ip, appareil, motif,
            essai_id, traite,
            to_char(date_creation, 'YYYY-MM-DD"T"HH24:MI:SS"Z"') as date_creation
       from inscriptions_audit
      where type = 'REFUS'
      order by traite asc, date_creation desc
      limit $1`,
    [limite],
  );
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
  limite = 40,
): Promise<ActionJournalisee[]> {
  return sql<ActionJournalisee>(
    `select id, action, libelle, auteur, cible, ip,
            to_char(date_creation, 'YYYY-MM-DD"T"HH24:MI:SS"Z"') as date_creation
       from journal_actions
      order by date_creation desc
      limit $1`,
    [limite],
  );
}
