import { sql, uneLigne } from "../db";
import type { Frequence } from "../types";
import type { Impaye } from "./dashboard";
import { echeanceDue } from "./echeances";

export type ImpayeParClasse = {
  classe: string;
  total: number;
  eleves: Impaye[];
};

const FILTRE_PERIODE = `
  f.ecole_id = $1
  and f.annee_scolaire = $2
  and f.statut <> 'PAYE'
  and e.statut = 'actif'
  and ${echeanceDue("f")}
  and (
    ($4::int = 0 and f.type_frais = 'SCOLARITE')
    or
    ($4::int > 0
      and f.type_frais = 'SCOLARITE'
      and f.frequence_paiement = $3
      and f.periode = $4)
    or f.type_frais in ('INSCRIPTION', 'REINSCRIPTION')
  )
`;

/**
 * Échéances non soldées de la période, plus les inscriptions / réinscriptions
 * encore impayées. Les totaux sont calculés en base (une requête agrégée),
 * puis seules 20 lignes sont rapatriées : une école de 500 élèves ne fait
 * jamais transiter 5 500 lignes dans la page.
 */
export async function listerImpayes(
  ecoleId: string,
  annee: string,
  frequence: Frequence,
  periode: number,
  { page = 1, parPage = 20 }: { page?: number; parPage?: number } = {},
): Promise<{
  groupes: ImpayeParClasse[];
  total: number;
  nbEleves: number;
  nbInscriptions: number;
  nbLignes: number;
  totauxClasses: Record<string, { total: number; nb: number }>;
}> {
  const offset = Math.max(0, (page - 1) * parPage);

  const [lignes, totaux, parClasseTotal] = await Promise.all([
    sql<Impaye & { classe_ordre: number }>(
      `select f.id as frais_id, e.id as eleve_id, e.nom, e.prenom,
              c.nom as classe_nom, c.ordre as classe_ordre,
              e.nom_parent, e.telephone_parent,
              f.type_frais, f.frequence_paiement, f.periode, f.libelle,
              f.montant_du, f.montant_paye, f.reste, f.statut
         from frais f
         join eleves e on e.id = f.eleve_id
         join classes c on c.id = e.classe_id
        where ${FILTRE_PERIODE}
        order by c.ordre, c.nom,
                 case when f.type_frais = 'SCOLARITE' then 1 else 0 end,
                 f.periode, f.reste desc, e.nom, e.prenom
        limit $5 offset $6`,
      [ecoleId, annee, frequence, periode, parPage, offset],
    ),
    uneLigne<{
      total: number;
      nb_eleves: number;
      nb_inscriptions: number;
      nb_lignes: number;
    }>(
      `select coalesce(sum(f.reste), 0)::int as total,
              count(distinct e.id)::int as nb_eleves,
              count(*) filter (where f.type_frais <> 'SCOLARITE')::int as nb_inscriptions,
              count(*)::int as nb_lignes
         from frais f
         join eleves e on e.id = f.eleve_id
        where ${FILTRE_PERIODE}`,
      [ecoleId, annee, frequence, periode],
    ),
    sql<{ classe: string; total: number; nb: number }>(
      `select c.nom as classe,
              coalesce(sum(f.reste), 0)::int as total,
              count(*)::int as nb
         from frais f
         join eleves e on e.id = f.eleve_id
         join classes c on c.id = e.classe_id
        where ${FILTRE_PERIODE}
        group by c.nom`,
      [ecoleId, annee, frequence, periode],
    ),
  ]);

  const parClasse = new Map<string, ImpayeParClasse>();
  for (const ligne of lignes) {
    const groupe = parClasse.get(ligne.classe_nom) ?? {
      classe: ligne.classe_nom,
      total: 0,
      eleves: [],
    };
    groupe.eleves.push(ligne);
    groupe.total += ligne.reste;
    parClasse.set(ligne.classe_nom, groupe);
  }

  return {
    groupes: [...parClasse.values()],
    total: totaux?.total ?? 0,
    nbEleves: totaux?.nb_eleves ?? 0,
    nbInscriptions: totaux?.nb_inscriptions ?? 0,
    nbLignes: totaux?.nb_lignes ?? 0,
    totauxClasses: Object.fromEntries(
      parClasseTotal.map((ligne) => [
        ligne.classe,
        { total: ligne.total, nb: ligne.nb },
      ]),
    ),
  };
}

/** Toutes les lignes, sans pagination : réservé à l'export PDF à la demande. */
export async function toutesLesImpayes(
  ecoleId: string,
  annee: string,
  frequence: Frequence,
  periode: number,
): Promise<Impaye[]> {
  return sql<Impaye>(
    `select f.id as frais_id, e.id as eleve_id, e.nom, e.prenom,
            c.nom as classe_nom,
            e.nom_parent, e.telephone_parent,
            f.type_frais, f.frequence_paiement, f.periode, f.libelle,
            f.montant_du, f.montant_paye, f.reste, f.statut
       from frais f
       join eleves e on e.id = f.eleve_id
       join classes c on c.id = e.classe_id
      where ${FILTRE_PERIODE}
      order by c.ordre, c.nom,
               case when f.type_frais = 'SCOLARITE' then 1 else 0 end,
               f.periode, f.reste desc, e.nom, e.prenom`,
    [ecoleId, annee, frequence, periode],
  );
}
