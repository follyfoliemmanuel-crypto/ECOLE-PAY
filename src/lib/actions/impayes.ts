"use server";

import { exigerSession } from "../auth";
import { nombreTranchesMax } from "../data/classes";
import { toutesLesImpayes } from "../data/impayes";
import { formatTelephone } from "../format";
import { anneeScolaire } from "../mois";
import { peut } from "../offres";
import {
  frequenceDepuisParametre,
  periodeDepuisParametre,
} from "../periodes";
import type { PdfImpaye } from "../pdf";

/**
 * Charge la liste complète des impayés pour l'export PDF, à la demande.
 * La page reste paginée à 20 lignes ; seule l'export paie le coût de la
 * lecture complète, sans jamais bloquer l'affichage.
 */
export async function chargerImpayesExport(
  frequenceParam?: string,
  periodeParam?: string,
): Promise<PdfImpaye[]> {
  const session = await exigerSession();
  if (!peut(session.ecole, "exports")) return [];

  const annee = anneeScolaire();
  const frequence = frequenceDepuisParametre(frequenceParam);
  const nbTranches =
    frequence === "TRANCHES"
      ? await nombreTranchesMax(session.ecoleId)
      : undefined;
  const periode = periodeDepuisParametre(
    periodeParam,
    frequence,
    undefined,
    nbTranches,
  );

  const lignes = await toutesLesImpayes(
    session.ecoleId,
    annee,
    frequence,
    periode,
  );

  return lignes.map((eleve) => ({
    nom: eleve.nom,
    prenom: eleve.prenom,
    classe: eleve.classe_nom,
    parent: eleve.nom_parent,
    telephone: formatTelephone(eleve.telephone_parent),
    montant_du: eleve.montant_du,
    montant_paye: eleve.montant_paye,
    reste: eleve.reste,
    statut: eleve.statut,
  }));
}
