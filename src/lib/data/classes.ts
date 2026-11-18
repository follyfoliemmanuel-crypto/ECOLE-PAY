import { sql, uneLigne } from "../db";
import type { Classe, Frequence, Tranche } from "../types";

/** Charge les tranches de plusieurs classes en une seule requête. */
async function attacherTranches<T extends Classe>(
  ecoleId: string,
  classes: T[],
): Promise<T[]> {
  if (classes.length === 0) return classes;

  const tranches = await sql<Tranche>(
    `select id, classe_id, ordre, nom, montant,
            date_limite::text as date_limite
       from tranches
      where ecole_id = $1
      order by classe_id, ordre`,
    [ecoleId],
  );

  const parClasse = new Map<string, Tranche[]>();
  for (const tranche of tranches) {
    const liste = parClasse.get(tranche.classe_id) ?? [];
    liste.push(tranche);
    parClasse.set(tranche.classe_id, liste);
  }

  return classes.map((classe) => ({
    ...classe,
    tranches: parClasse.get(classe.id) ?? [],
  }));
}

export async function listerClasses(
  ecoleId: string,
  annee: string,
): Promise<Classe[]> {
  const classes = await sql<Classe>(
    `select c.id, c.nom, c.montant_periode, c.frequence_paiement,
            c.frais_inscription, c.frais_reinscription,
            c.type_fin, c.examen, c.classe_suivante_id,
            cs.nom as classe_suivante_nom,
            count(e.id)::int as nb_eleves
       from classes c
       left join classes cs on cs.id = c.classe_suivante_id
       left join eleves e
         on e.classe_id = c.id
        and e.ecole_id = c.ecole_id
        and e.annee_scolaire = $2
        and e.statut = 'actif'
      where c.ecole_id = $1
      group by c.id, cs.nom
      order by c.ordre, c.nom`,
    [ecoleId, annee],
  );
  return attacherTranches(ecoleId, classes);
}

export async function getClasse(
  ecoleId: string,
  classeId: string,
): Promise<Classe | null> {
  const classe = await uneLigne<Classe>(
    `select c.id, c.nom, c.montant_periode, c.frequence_paiement,
            c.frais_inscription, c.frais_reinscription,
            c.type_fin, c.examen, c.classe_suivante_id,
            cs.nom as classe_suivante_nom,
            (select count(*)::int from eleves e
              where e.classe_id = c.id and e.statut = 'actif') as nb_eleves
       from classes c
       left join classes cs on cs.id = c.classe_suivante_id
      where c.id = $1 and c.ecole_id = $2`,
    [classeId, ecoleId],
  );
  if (!classe) return null;
  const [avecTranches] = await attacherTranches(ecoleId, [classe]);
  return avecTranches;
}

export type ClasseStats = Classe & {
  payes: number;
  partiels: number;
  impayes: number;
  attendu: number;
  encaisse: number;
  restant: number;
};

/**
 * Classes + situation de la scolarité pour une fréquence et une période.
 * Les classes d'une autre fréquence restent listées avec des compteurs à zéro :
 * l'interface affiche « — » plutôt qu'un faux impayé.
 */
export async function listerClassesAvecStats(
  ecoleId: string,
  annee: string,
  frequence: Frequence,
  periode: number,
): Promise<ClasseStats[]> {
  const classes = await sql<ClasseStats>(
    `select c.id, c.nom, c.montant_periode, c.frequence_paiement,
            c.frais_inscription, c.frais_reinscription,
            c.type_fin, c.examen, c.classe_suivante_id,
            cs.nom as classe_suivante_nom,
            count(distinct e.id)::int as nb_eleves,
            count(f.id) filter (where f.statut = 'PAYE')::int as payes,
            count(f.id) filter (where f.statut = 'PARTIEL')::int as partiels,
            count(f.id) filter (where f.statut = 'NON_PAYE')::int as impayes,
            coalesce(sum(f.montant_du), 0)::int as attendu,
            coalesce(sum(f.montant_paye), 0)::int as encaisse,
            coalesce(sum(f.reste), 0)::int as restant
       from classes c
       left join classes cs on cs.id = c.classe_suivante_id
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
        and f.frequence_paiement = $3
        and f.periode = $4
      where c.ecole_id = $1
      group by c.id, cs.nom
      order by c.ordre, c.nom`,
    [ecoleId, annee, frequence, periode],
  );
  return attacherTranches(ecoleId, classes);
}

/** Nombre maximal de tranches parmi les classes de l'école (pour les filtres). */
export async function nombreTranchesMax(ecoleId: string): Promise<number> {
  const ligne = await uneLigne<{ maximum: number }>(
    `select coalesce(max(t.ordre), 0)::int as maximum
       from tranches t
      where t.ecole_id = $1`,
    [ecoleId],
  );
  return Math.max(1, ligne?.maximum ?? 1);
}
