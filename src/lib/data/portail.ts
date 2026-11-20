import { sql, uneLigne } from "../db";
import { donneesBulletin } from "./notes";
import type {
  BulletinEleve,
  Frequence,
  Matiere,
  Offre,
  StatutEcole,
  StatutFrais,
  Trimestre,
  TypeFrais,
} from "../types";

// ---------------------------------------------------------------------------
//  Portail parent public : lectures strictement limitées à une école.
// ---------------------------------------------------------------------------

export type EcolePublique = {
  id: string;
  nom: string;
  slug: string;
  adresse: string | null;
  telephone: string | null;
  logo_url: string | null;
  offre: Offre;
  statut: StatutEcole;
};

export async function ecolePublique(slug: string): Promise<EcolePublique | null> {
  if (!slug) return null;
  return uneLigne<EcolePublique>(
    `select id, nom, slug, adresse, telephone, logo_url, offre, statut
       from ecoles
      where slug = $1
        and actif = true`,
    [slug],
  );
}

export type ClassePublique = {
  id: string;
  nom: string;
  nb_eleves: number;
};

/** Classes qui ont au moins un élève actif et visible sur le portail. */
export async function listerClassesPubliques(
  ecoleId: string,
  annee: string,
): Promise<ClassePublique[]> {
  return sql<ClassePublique>(
    `select c.id, c.nom, count(e.id)::int as nb_eleves
       from classes c
       join eleves e
         on e.classe_id = c.id
        and e.ecole_id = c.ecole_id
        and e.annee_scolaire = $2
        and e.statut = 'actif'
        and e.masque_portail = false
      where c.ecole_id = $1
      group by c.id
     having count(e.id) > 0
      order by c.ordre, c.nom`,
    [ecoleId, annee],
  );
}

export type ElevePortail = {
  id: string;
  nom: string;
  prenom: string;
  sexe: "M" | "F" | null;
  photo_url: string | null;
  classe_id: string;
  classe_nom: string;
  frequence_paiement: Frequence;
};

const MIN_RECHERCHE = 3;
const MAX_RESULTATS = 8;

/** Recherche accent-insensible, limitée à une classe et aux élèves visibles. */
export async function rechercherElevesPubliques(
  ecoleId: string,
  annee: string,
  classeId: string,
  recherche: string,
): Promise<ElevePortail[]> {
  const terme = recherche.trim().slice(0, 60);
  if (terme.length < MIN_RECHERCHE) return [];

  return sql<ElevePortail>(
    `select e.id, e.nom, e.prenom, e.sexe, e.photo_url,
            e.classe_id, c.nom as classe_nom, c.frequence_paiement
       from eleves e
       join classes c on c.id = e.classe_id
      where e.ecole_id = $1
        and e.annee_scolaire = $2
        and e.classe_id = $3
        and e.statut = 'actif'
        and e.masque_portail = false
        and (
          select coalesce(bool_and(
            normaliser_texte(e.nom || ' ' || e.prenom || ' ' || e.prenom || ' ' || e.nom)
              like '%' || mot || '%'
          ), true)
            from unnest(regexp_split_to_array(normaliser_texte($4), '\\s+')) as mot
           where mot <> ''
        )
      order by e.nom, e.prenom
      limit ${MAX_RESULTATS}`,
    [ecoleId, annee, classeId, terme],
  );
}

export async function getElevePublique(
  ecoleId: string,
  eleveId: string,
  annee: string,
): Promise<ElevePortail | null> {
  return uneLigne<ElevePortail>(
    `select e.id, e.nom, e.prenom, e.sexe, e.photo_url,
            e.classe_id, c.nom as classe_nom, c.frequence_paiement
       from eleves e
       join classes c on c.id = e.classe_id
      where e.id = $1
        and e.ecole_id = $2
        and e.annee_scolaire = $3
        and e.statut = 'actif'
        and e.masque_portail = false`,
    [eleveId, ecoleId, annee],
  );
}

export async function trimestresNotes(
  ecoleId: string,
  eleveId: string,
  annee: string,
): Promise<Trimestre[]> {
  const lignes = await sql<{ trimestre: Trimestre }>(
    // On n'annonce que les trimestres dont au moins une note est publiée par
    // le directeur : un brouillon de professeur ne doit pas apparaître.
    `select distinct n.trimestre
       from notes n
       join eleves e on e.id = n.eleve_id
       join saisies_notes s
         on s.ecole_id = n.ecole_id
        and s.annee_scolaire = n.annee_scolaire
        and s.trimestre = n.trimestre
        and s.matiere_id = n.matiere_id
        and s.classe_id = e.classe_id
        and s.statut = 'VALIDE'
      where n.ecole_id = $1 and n.eleve_id = $2 and n.annee_scolaire = $3
      order by n.trimestre`,
    [ecoleId, eleveId, annee],
  );
  return lignes.map((ligne) => ligne.trimestre);
}

export type FicheBulletin = {
  eleve: BulletinEleve;
  effectif: number;
  matieres: Matiere[];
  classe_nom: string;
  ecole: {
    nom: string;
    adresse: string | null;
    telephone: string | null;
    logo_url: string | null;
  };
  annee: string;
  trimestre: Trimestre;
  /** Nombre de matières effectivement notées. */
  matieres_notees: number;
};

/**
 * Bulletin d'un seul élève : le classement complet reste côté serveur.
 * L'effectif affiché est celui de la classe, sans révéler les autres noms.
 */
export async function ficheBulletin(
  ecoleId: string,
  annee: string,
  classeId: string,
  eleveId: string,
  trimestre: Trimestre,
): Promise<FicheBulletin | null> {
  const bulletin = await donneesBulletin(ecoleId, annee, classeId, trimestre);
  if (!bulletin) return null;

  const eleve = bulletin.eleves.find((element) => element.id === eleveId);
  if (!eleve) return null;

  return {
    eleve,
    effectif: bulletin.eleves.length,
    matieres: bulletin.matieres,
    classe_nom: bulletin.classe.nom,
    ecole: bulletin.ecole,
    annee,
    trimestre,
    matieres_notees: eleve.lignes.filter((ligne) => ligne.note !== null).length,
  };
}

export type EcheancePublique = {
  id: string;
  type_frais: TypeFrais;
  libelle: string | null;
  periode: number;
  montant_du: number;
  montant_paye: number;
  reste: number;
  statut: StatutFrais;
  date_limite: string | null;
  /** Faux tant que la date limite de l'échéance n'est pas atteinte. */
  echue: boolean;
};

export type SituationPaiements = {
  total_du: number;
  total_paye: number;
  total_reste: number;
  prochaine: EcheancePublique | null;
  echeances: EcheancePublique[];
};

/** Situation de scolarité d'un élève, sans aucun détail sur les autres. */
export async function situationPaiements(
  ecoleId: string,
  eleveId: string,
  annee: string,
): Promise<SituationPaiements> {
  const echeances = await sql<EcheancePublique>(
    `select f.id, f.type_frais, f.libelle, f.periode,
            f.montant_du, f.montant_paye, f.reste, f.statut,
            t.date_limite::text as date_limite,
            coalesce(
              date_echeance_frais(
                f.type_frais, f.frequence_paiement, f.periode,
                f.annee_scolaire, f.tranche_id, e.date_inscription
              ) <= current_date,
              true
            ) as echue
       from frais f
       join eleves e on e.id = f.eleve_id
       left join tranches t on t.id = f.tranche_id
      where f.ecole_id = $1
        and f.eleve_id = $2
        and f.annee_scolaire = $3
        and f.type_frais = 'SCOLARITE'
      order by f.periode`,
    [ecoleId, eleveId, annee],
  );

  const totalDu = echeances.reduce((somme, ligne) => somme + ligne.montant_du, 0);
  const totalPaye = echeances.reduce((somme, ligne) => somme + ligne.montant_paye, 0);
  const totalReste = echeances.reduce((somme, ligne) => somme + ligne.reste, 0);

  return {
    total_du: totalDu,
    total_paye: totalPaye,
    total_reste: totalReste,
    prochaine: echeances.find((ligne) => ligne.reste > 0) ?? null,
    echeances,
  };
}

// ---------------------------------------------------------------------------
//  Envois de bulletins (offre PREMIUM)
// ---------------------------------------------------------------------------

export type EnvoiBulletin = {
  eleve_id: string;
  statut: "EN_ATTENTE" | "LIEN_PRET" | "ENVOYE" | "ECHEC";
  url_whatsapp: string | null;
  erreur: string | null;
  envoye_le: string | null;
};

export async function envoisBulletins(
  ecoleId: string,
  annee: string,
  trimestre: Trimestre,
): Promise<EnvoiBulletin[]> {
  return sql<EnvoiBulletin>(
    `select eleve_id, statut, url_whatsapp, erreur,
            to_char(envoye_le, 'YYYY-MM-DD"T"HH24:MI:SS"Z"') as envoye_le
       from bulletin_envois
      where ecole_id = $1
        and annee_scolaire = $2
        and trimestre = $3`,
    [ecoleId, annee, trimestre],
  );
}
