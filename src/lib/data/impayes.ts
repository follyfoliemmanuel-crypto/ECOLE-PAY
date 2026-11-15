import { sql } from "../db";
import type { Frequence } from "../types";
import type { Impaye } from "./dashboard";

export type ImpayeParClasse = {
  classe: string;
  total: number;
  eleves: Impaye[];
};

/**
 * Toutes les échéances non soldées de la période sélectionnée, plus les
 * inscriptions / réinscriptions encore impayées, regroupées par classe.
 */
export async function listerImpayes(
  ecoleId: string,
  annee: string,
  frequence: Frequence,
  periode: number,
): Promise<{
  groupes: ImpayeParClasse[];
  total: number;
  nbEleves: number;
  nbInscriptions: number;
}> {
  const lignes = await sql<Impaye & { classe_ordre: number }>(
    `select f.id as frais_id, e.id as eleve_id, e.nom, e.prenom,
            c.nom as classe_nom, c.ordre as classe_ordre,
            e.nom_parent, e.telephone_parent,
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
          (f.type_frais = 'SCOLARITE'
            and f.frequence_paiement = $3
            and f.periode = $4)
          or f.type_frais in ('INSCRIPTION', 'REINSCRIPTION')
        )
      order by c.ordre, c.nom,
               case when f.type_frais = 'SCOLARITE' then 1 else 0 end,
               f.periode, f.reste desc, e.nom, e.prenom`,
    [ecoleId, annee, frequence, periode],
  );

  const parClasse = new Map<string, ImpayeParClasse>();
  const eleves = new Set<string>();
  let nbInscriptions = 0;

  for (const ligne of lignes) {
    const groupe = parClasse.get(ligne.classe_nom) ?? {
      classe: ligne.classe_nom,
      total: 0,
      eleves: [],
    };
    groupe.eleves.push(ligne);
    groupe.total += ligne.reste;
    parClasse.set(ligne.classe_nom, groupe);
    eleves.add(ligne.eleve_id);
    if (ligne.type_frais !== "SCOLARITE") nbInscriptions += 1;
  }

  return {
    groupes: [...parClasse.values()],
    total: lignes.reduce((somme, l) => somme + l.reste, 0),
    nbEleves: eleves.size,
    nbInscriptions,
  };
}
