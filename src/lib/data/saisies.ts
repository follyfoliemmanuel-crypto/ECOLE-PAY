import { sql, uneLigne } from "../db";
import type {
  LigneSaisieNotes,
  Prof,
  SaisieNotes,
  SuiviProf,
  Trimestre,
} from "../types";

/**
 * Lectures de la saisie des notes par les professeurs.
 * Toutes les requêtes sont filtrées par `ecole_id` : une école ne voit jamais
 * les saisies d'une autre.
 */

const CHAMPS_SAISIE = `
  s.id, s.annee_scolaire, s.trimestre,
  s.classe_id, c.nom as classe_nom,
  s.matiere_id, m.nom as matiere_nom,
  s.prof_id, p.nom as prof_nom, p.prenom as prof_prenom,
  s.statut,
  to_char(s.envoye_le, 'YYYY-MM-DD"T"HH24:MI:SS') as envoye_le,
  to_char(s.valide_le, 'YYYY-MM-DD"T"HH24:MI:SS') as valide_le,
  to_char(s.libere_le, 'YYYY-MM-DD"T"HH24:MI:SS') as libere_le,
  s.motif_liberation,
  to_char(s.updated_at, 'YYYY-MM-DD"T"HH24:MI:SS') as updated_at,
  (select count(*)::int
     from notes n2
     join eleves e2 on e2.id = n2.eleve_id
    where n2.ecole_id = s.ecole_id
      and n2.annee_scolaire = s.annee_scolaire
      and n2.trimestre = s.trimestre
      and n2.matiere_id = s.matiere_id
      and e2.classe_id = s.classe_id) as nb_notes`;

/** Toutes les saisies actives (hors lignes libérées) d'un trimestre. */
export async function saisiesTrimestre(
  ecoleId: string,
  annee: string,
  trimestre: Trimestre,
): Promise<SaisieNotes[]> {
  return sql<SaisieNotes>(
    `select ${CHAMPS_SAISIE}
       from saisies_notes s
       join classes c on c.id = s.classe_id
       join matieres m on m.id = s.matiere_id
       left join profs p on p.id = s.prof_id
      where s.ecole_id = $1
        and s.annee_scolaire = $2
        and s.trimestre = $3
        and s.statut <> 'LIBERE'
      order by
        case s.statut when 'ENVOYE' then 0 when 'EN_COURS' then 1 else 2 end,
        c.ordre, c.nom, m.ordre, m.nom`,
    [ecoleId, annee, trimestre],
  );
}

export async function saisieParId(
  ecoleId: string,
  id: string,
): Promise<SaisieNotes | null> {
  return uneLigne<SaisieNotes>(
    `select ${CHAMPS_SAISIE}
       from saisies_notes s
       join classes c on c.id = s.classe_id
       join matieres m on m.id = s.matiere_id
       left join profs p on p.id = s.prof_id
      where s.id = $1 and s.ecole_id = $2`,
    [id, ecoleId],
  );
}

/** Grille d'un élève par ligne : Devoir 1, Devoir 2, Composition. */
export async function grilleSaisie(
  ecoleId: string,
  annee: string,
  saisie: Pick<SaisieNotes, "classe_id" | "matiere_id" | "trimestre">,
): Promise<LigneSaisieNotes[]> {
  return sql<LigneSaisieNotes>(
    `select e.id as eleve_id, e.nom, e.prenom,
            n.devoir1::float8 as devoir1,
            n.devoir2::float8 as devoir2,
            n.composition::float8 as composition
       from eleves e
       left join notes n
         on n.eleve_id = e.id
        and n.ecole_id = e.ecole_id
        and n.matiere_id = $4
        and n.annee_scolaire = $2
        and n.trimestre = $5
      where e.ecole_id = $1
        and e.annee_scolaire = $2
        and e.classe_id = $3
        and e.statut = 'actif'
      order by e.nom, e.prenom`,
    [ecoleId, annee, saisie.classe_id, saisie.matiere_id, saisie.trimestre],
  );
}

export type EcheanceNotes = {
  date_limite: string;
  jours_restants: number;
};

/** Date limite de dépôt des notes pour le trimestre, si le directeur l'a fixée. */
export async function echeanceNotes(
  ecoleId: string,
  annee: string,
  trimestre: Trimestre,
): Promise<EcheanceNotes | null> {
  return uneLigne<EcheanceNotes>(
    `select date_limite::text as date_limite,
            (date_limite - current_date)::int as jours_restants
       from notes_echeances
      where ecole_id = $1 and annee_scolaire = $2 and trimestre = $3`,
    [ecoleId, annee, trimestre],
  );
}

/** Professeurs actifs + volume de saisies pour le trimestre. */
export async function suiviProfs(
  ecoleId: string,
  annee: string,
  trimestre: Trimestre,
): Promise<SuiviProf[]> {
  return sql<SuiviProf>(
    `select p.id as prof_id, p.nom, p.prenom, p.telephone,
            u.identifiant, u.actif as compte_actif,
            count(s.id) filter (where s.statut = 'EN_COURS')::int as en_cours,
            count(s.id) filter (where s.statut = 'ENVOYE')::int as envoyes,
            count(s.id) filter (where s.statut = 'VALIDE')::int as valides,
            to_char(max(s.envoye_le), 'YYYY-MM-DD"T"HH24:MI:SS') as dernier_envoi
       from profs p
       left join users u on u.id = p.user_id
       left join saisies_notes s
         on s.prof_id = p.id
        and s.ecole_id = p.ecole_id
        and s.annee_scolaire = $2
        and s.trimestre = $3
        and s.statut <> 'LIBERE'
      where p.ecole_id = $1
        and p.actif = true
      group by p.id, p.nom, p.prenom, p.telephone, u.identifiant, u.actif
      order by p.nom, p.prenom`,
    [ecoleId, annee, trimestre],
  );
}

export type CompteursSaisies = {
  en_cours: number;
  envoyes: number;
  valides: number;
  profs: number;
  profs_compte: number;
  notes_publiees: number;
};

export async function compteursSaisies(
  ecoleId: string,
  annee: string,
  trimestre: Trimestre,
): Promise<CompteursSaisies> {
  const ligne = await uneLigne<CompteursSaisies>(
    `select
        (select count(*) from saisies_notes s
          where s.ecole_id = $1 and s.annee_scolaire = $2
            and s.trimestre = $3 and s.statut = 'EN_COURS')::int as en_cours,
        (select count(*) from saisies_notes s
          where s.ecole_id = $1 and s.annee_scolaire = $2
            and s.trimestre = $3 and s.statut = 'ENVOYE')::int as envoyes,
        (select count(*) from saisies_notes s
          where s.ecole_id = $1 and s.annee_scolaire = $2
            and s.trimestre = $3 and s.statut = 'VALIDE')::int as valides,
        (select count(*) from profs p
          where p.ecole_id = $1 and p.actif = true)::int as profs,
        (select count(*) from profs p
          join users u on u.id = p.user_id
          where p.ecole_id = $1 and p.actif = true and u.actif = true)::int as profs_compte,
        (select count(*) from notes n
           join eleves e on e.id = n.eleve_id
           join saisies_notes s
             on s.ecole_id = n.ecole_id
            and s.annee_scolaire = n.annee_scolaire
            and s.trimestre = n.trimestre
            and s.matiere_id = n.matiere_id
            and s.classe_id = e.classe_id
            and s.statut = 'VALIDE'
          where n.ecole_id = $1 and n.annee_scolaire = $2
            and n.trimestre = $3)::int as notes_publiees`,
    [ecoleId, annee, trimestre],
  );

  return (
    ligne ?? {
      en_cours: 0,
      envoyes: 0,
      valides: 0,
      profs: 0,
      profs_compte: 0,
      notes_publiees: 0,
    }
  );
}

/** Fiche professeur liée au compte connecté, pour l'en-tête de l'espace prof. */
export async function profConnecte(
  ecoleId: string,
  profId: string,
): Promise<Prof | null> {
  return uneLigne<Prof>(
    `select p.id, p.nom, p.prenom, p.telephone, p.email, p.matiere,
            p.classes_assurees, p.salaire_mensuel,
            p.date_embauche::text as date_embauche, p.actif, p.notes,
            p.user_id, u.identifiant, u.actif as compte_actif
       from profs p
       left join users u on u.id = p.user_id
      where p.id = $1 and p.ecole_id = $2`,
    [profId, ecoleId],
  );
}
