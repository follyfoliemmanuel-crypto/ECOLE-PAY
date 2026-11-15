import { sql, uneLigne } from "../db";
import type {
  Eleve,
  EleveAvecPeriode,
  EleveOption,
  ElevePaiement,
  FraisPeriode,
  Frequence,
  Paiement,
} from "../types";

export type FiltresEleves = {
  ecoleId: string;
  annee: string;
  frequence: Frequence;
  periode: number;
  recherche?: string;
  classeId?: string;
  page?: number;
  parPage?: number;
};

export async function listerEleves({
  ecoleId,
  annee,
  frequence,
  periode,
  recherche = "",
  classeId,
  page = 1,
  parPage = 40,
}: FiltresEleves): Promise<{ eleves: EleveAvecPeriode[]; total: number }> {
  const terme = recherche.trim();
  const filtreClasse = classeId && classeId !== "toutes" ? classeId : null;
  const offset = Math.max(0, (page - 1) * parPage);

  const conditions = `
    e.ecole_id = $1
    and e.annee_scolaire = $2
    and e.statut = 'actif'
    and ($3::text = '' or (e.nom || ' ' || e.prenom || ' ' || e.nom_parent) ilike '%' || $3 || '%')
    and ($4::uuid is null or e.classe_id = $4::uuid)
  `;

  const [lignes, total] = await Promise.all([
    sql<EleveAvecPeriode>(
      `select e.id, e.nom, e.prenom, e.sexe, e.classe_id, c.nom as classe_nom,
              c.montant_periode, c.frequence_paiement, e.nom_parent,
              e.telephone_parent, e.annee_scolaire, e.type_inscription,
              e.statut, e.date_inscription::text as date_inscription,
              e.masque_portail, e.photo_url,
              f.id as frais_id, f.montant_du, f.montant_paye, f.reste,
              f.statut as statut_periode, f.libelle,
              fi.id as inscription_id, fi.type_frais as inscription_type,
              fi.montant_du as inscription_du, fi.montant_paye as inscription_paye,
              fi.reste as inscription_reste, fi.statut as inscription_statut
         from eleves e
         join classes c on c.id = e.classe_id
         left join frais f
           on f.eleve_id = e.id
          and f.annee_scolaire = $2
          and f.type_frais = 'SCOLARITE'
          and f.frequence_paiement = $5
          and f.periode = $6
         left join frais fi
           on fi.eleve_id = e.id
          and fi.annee_scolaire = $2
          and fi.type_frais in ('INSCRIPTION', 'REINSCRIPTION')
        where ${conditions}
        order by c.ordre, c.nom, e.nom, e.prenom
        limit $7 offset $8`,
      [ecoleId, annee, terme, filtreClasse, frequence, periode, parPage, offset],
    ),
    uneLigne<{ total: number }>(
      `select count(*)::int as total
         from eleves e
        where e.ecole_id = $1
          and e.annee_scolaire = $2
          and e.statut = 'actif'
          and ($3::text = '' or (e.nom || ' ' || e.prenom || ' ' || e.nom_parent) ilike '%' || $3 || '%')
          and ($4::uuid is null or e.classe_id = $4::uuid)`,
      [ecoleId, annee, terme, filtreClasse],
    ),
  ]);

  return { eleves: lignes, total: total?.total ?? 0 };
}

export async function getEleve(
  ecoleId: string,
  eleveId: string,
): Promise<Eleve | null> {
  return uneLigne<Eleve>(
    `select e.id, e.nom, e.prenom, e.sexe, e.classe_id, c.nom as classe_nom,
            c.montant_periode, c.frequence_paiement, e.nom_parent,
            e.telephone_parent, e.annee_scolaire, e.type_inscription,
            e.statut, e.date_inscription::text as date_inscription,
            e.masque_portail, e.photo_url
       from eleves e
       join classes c on c.id = e.classe_id
      where e.id = $1 and e.ecole_id = $2`,
    [eleveId, ecoleId],
  );
}

export async function listerFraisEleve(
  ecoleId: string,
  eleveId: string,
  annee: string,
): Promise<FraisPeriode[]> {
  return sql<FraisPeriode>(
    `select id, eleve_id, type_frais, frequence_paiement, periode,
            tranche_id, libelle,
            montant_du, montant_paye, reste, statut
       from frais
      where ecole_id = $1 and eleve_id = $2 and annee_scolaire = $3
      order by case when type_frais = 'SCOLARITE' then 1 else 0 end, periode`,
    [ecoleId, eleveId, annee],
  );
}

export async function listerPaiementsEleve(
  ecoleId: string,
  eleveId: string,
): Promise<Paiement[]> {
  return sql<Paiement>(
    `select p.id, p.numero_recu, p.montant, p.mode_paiement,
            to_char(p.date_paiement, 'YYYY-MM-DD"T"HH24:MI:SS"Z"') as date_paiement,
            p.annule, p.reste_apres, p.frais_id, p.motif_annulation, p.eleve_id,
            to_char(p.annule_le, 'YYYY-MM-DD"T"HH24:MI:SS"Z"') as annule_le,
            e.nom as eleve_nom, e.prenom as eleve_prenom,
            c.nom as classe_nom,
            p.type_frais, p.frequence_paiement, p.periode,
            p.tranche_id, p.libelle,
            f.montant_du, f.reste,
            u.nom as enregistre_par_nom, a.nom as annule_par_nom
       from paiements p
       join eleves e on e.id = p.eleve_id
       join classes c on c.id = e.classe_id
       join frais f on f.id = p.frais_id
       left join users u on u.id = p.enregistre_par
       left join users a on a.id = p.annule_par
      where p.ecole_id = $1 and p.eleve_id = $2
      order by p.date_paiement desc
      limit 100`,
    [ecoleId, eleveId],
  );
}

/**
 * Tous les élèves actifs + leurs échéances, pour l'écran d'encaissement rapide.
 * Deux requêtes seulement : utilisable même sur une connexion faible.
 */
export type ElevePourPaiement = {
  id: string;
  nom: string;
  prenom: string;
  classe_id: string;
  classe_nom: string;
  frequence_paiement: Frequence;
  nom_parent: string;
  telephone_parent: string;
  frais: {
    id: string;
    type_frais: "SCOLARITE" | "INSCRIPTION" | "REINSCRIPTION";
    frequence_paiement: Frequence;
    periode: number;
    tranche_id: string | null;
    libelle: string | null;
    montant_du: number;
    montant_paye: number;
    reste: number;
    statut: string;
  }[];
};

export async function elevesPourPaiement(
  ecoleId: string,
  annee: string,
): Promise<ElevePourPaiement[]> {
  return sql<ElevePourPaiement>(
    `select e.id, e.nom, e.prenom, e.classe_id, c.nom as classe_nom,
            c.frequence_paiement, e.nom_parent, e.telephone_parent,
            coalesce(json_agg(json_build_object(
              'id', f.id, 'type_frais', f.type_frais,
              'frequence_paiement', f.frequence_paiement,
              'periode', f.periode, 'tranche_id', f.tranche_id,
              'libelle', f.libelle, 'montant_du', f.montant_du,
              'montant_paye', f.montant_paye, 'reste', f.reste, 'statut', f.statut
            ) order by case when f.type_frais = 'SCOLARITE' then 1 else 0 end,
                       f.periode)
              filter (where f.id is not null), '[]') as frais
       from eleves e
       join classes c on c.id = e.classe_id
       left join frais f
         on f.eleve_id = e.id and f.annee_scolaire = $2
      where e.ecole_id = $1
        and e.annee_scolaire = $2
        and e.statut = 'actif'
      group by e.id, c.id
      order by c.ordre, c.nom, e.nom, e.prenom`,
    [ecoleId, annee],
  );
}

export async function compterElevesClasse(
  ecoleId: string,
  classeId: string,
): Promise<number> {
  const ligne = await uneLigne<{ total: number }>(
    `select count(*)::int as total from eleves
      where ecole_id = $1 and classe_id = $2 and statut = 'actif'`,
    [ecoleId, classeId],
  );
  return ligne?.total ?? 0;
}

// ---------------------------------------------------------------------------
//  Encaissement rapide : recherche puis chargement d'un seul élève
// ---------------------------------------------------------------------------
export async function rechercherEleves(
  ecoleId: string,
  annee: string,
  recherche: string,
): Promise<EleveOption[]> {
  // Borne côté données aussi : même appelée directement, la recherche ne peut
  // pas envoyer une chaîne démesurée à l'ILIKE.
  const terme = recherche.trim().slice(0, 60);
  if (terme.length < 2) return [];

  return sql<EleveOption>(
    `select e.id, e.nom, e.prenom, c.nom as classe_nom,
            e.nom_parent, e.telephone_parent
       from eleves e
       join classes c on c.id = e.classe_id
      where e.ecole_id = $1
        and e.annee_scolaire = $2
        and e.statut = 'actif'
        and (e.nom || ' ' || e.prenom || ' ' || e.nom_parent) ilike '%' || $3 || '%'
      order by e.nom, e.prenom
      limit 8`,
    [ecoleId, annee, terme],
  );
}

export async function getElevePaiement(
  ecoleId: string,
  eleveId: string,
  annee: string,
): Promise<ElevePaiement | null> {
  return uneLigne<ElevePaiement>(
    `select e.id, e.nom, e.prenom, e.classe_id, c.nom as classe_nom,
            c.frequence_paiement, e.nom_parent, e.telephone_parent,
            coalesce(json_agg(json_build_object(
              'id', f.id, 'eleve_id', f.eleve_id,
              'type_frais', f.type_frais,
              'frequence_paiement', f.frequence_paiement,
              'periode', f.periode, 'tranche_id', f.tranche_id,
              'libelle', f.libelle, 'montant_du', f.montant_du,
              'montant_paye', f.montant_paye, 'reste', f.reste, 'statut', f.statut
            ) order by case when f.type_frais = 'SCOLARITE' then 1 else 0 end,
                       f.periode)
              filter (where f.id is not null), '[]') as frais
       from eleves e
       join classes c on c.id = e.classe_id
       left join frais f
         on f.eleve_id = e.id and f.annee_scolaire = $3
      where e.id = $2
        and e.ecole_id = $1
        and e.annee_scolaire = $3
        and e.statut = 'actif'
      group by e.id, c.id`,
    [ecoleId, eleveId, annee],
  );
}
