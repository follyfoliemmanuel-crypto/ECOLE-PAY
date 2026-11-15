import { sql, uneLigne } from "../db";
import type { Frequence, ModePaiement, Paiement } from "../types";

export type PaiementAvecContexte = Paiement & {
  ecole_nom: string;
  ecole_telephone: string | null;
  modele_recu: string;
  modele_relance: string;
  nom_parent: string;
  telephone_parent: string;
  montant_paye_echeance: number;
};

/** Un paiement + tout ce qu'il faut pour composer le message WhatsApp. */
export async function getPaiementAvecContexte(
  paiementId: string,
  ecoleId: string,
): Promise<PaiementAvecContexte | null> {
  return uneLigne<PaiementAvecContexte>(
    `select p.id, p.numero_recu, p.montant, p.mode_paiement,
            to_char(p.date_paiement, 'YYYY-MM-DD"T"HH24:MI:SS"Z"') as date_paiement,
            p.annule, p.reste_apres, p.eleve_id, p.frais_id,
            e.nom as eleve_nom, e.prenom as eleve_prenom,
            c.nom as classe_nom,
            p.type_frais, p.frequence_paiement, p.periode,
            p.tranche_id, p.libelle,
            f.montant_du, f.reste, f.montant_paye as montant_paye_echeance,
            u.nom as enregistre_par_nom,
            ec.nom as ecole_nom, ec.telephone as ecole_telephone,
            ec.modele_recu, ec.modele_relance,
            e.nom_parent, e.telephone_parent
       from paiements p
       join eleves e on e.id = p.eleve_id
       join classes c on c.id = e.classe_id
       join frais f on f.id = p.frais_id
       join ecoles ec on ec.id = p.ecole_id
       left join users u on u.id = p.enregistre_par
      where p.id = $1 and p.ecole_id = $2`,
    [paiementId, ecoleId],
  );
}

export type FiltresPaiements = {
  ecoleId: string;
  annee: string;
  frequence: Frequence;
  periode: number;
  mode?: ModePaiement | "tous";
  limite?: number;
};

/** Paiement enrichi du parent : nécessaire pour préparer le reçu WhatsApp. */
export type PaiementListe = Paiement & {
  nom_parent: string;
  telephone_parent: string;
};

export async function listerPaiements({
  ecoleId,
  annee,
  frequence,
  periode,
  mode = "tous",
  limite = 80,
}: FiltresPaiements): Promise<{
  paiements: PaiementListe[];
  total: number;
  montant: number;
  montantInscriptions: number;
  annules: number;
}> {
  const filtreMode = mode === "tous" ? null : mode;

  const [paiements, total] = await Promise.all([
    sql<PaiementListe>(
      `select p.id, p.numero_recu, p.montant, p.mode_paiement,
              to_char(p.date_paiement, 'YYYY-MM-DD"T"HH24:MI:SS"Z"') as date_paiement,
              p.annule, p.reste_apres, p.frais_id, p.motif_annulation, p.eleve_id,
              to_char(p.annule_le, 'YYYY-MM-DD"T"HH24:MI:SS"Z"') as annule_le,
              e.nom as eleve_nom, e.prenom as eleve_prenom,
              e.nom_parent, e.telephone_parent,
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
        where p.ecole_id = $1
          and f.annee_scolaire = $2
          and (
            (p.type_frais = 'SCOLARITE'
              and p.frequence_paiement = $3
              and p.periode = $4)
            or p.type_frais in ('INSCRIPTION', 'REINSCRIPTION')
          )
          and ($5::text is null or p.mode_paiement = $5)
        order by p.date_paiement desc
        limit $6`,
      [ecoleId, annee, frequence, periode, filtreMode, limite],
    ),
    uneLigne<{
      total: number;
      montant: number;
      montant_inscriptions: number;
      annules: number;
    }>(
      `select count(*)::int as total,
              coalesce(sum(case when p.annule = false then p.montant else 0 end), 0)::int as montant,
              coalesce(sum(case when p.annule = false
                                 and p.type_frais in ('INSCRIPTION', 'REINSCRIPTION')
                                then p.montant else 0 end), 0)::int as montant_inscriptions,
              count(*) filter (where p.annule = true)::int as annules
         from paiements p
         join frais f on f.id = p.frais_id
        where p.ecole_id = $1
          and f.annee_scolaire = $2
          and (
            (p.type_frais = 'SCOLARITE'
              and p.frequence_paiement = $3
              and p.periode = $4)
            or p.type_frais in ('INSCRIPTION', 'REINSCRIPTION')
          )
          and ($5::text is null or p.mode_paiement = $5)`,
      [ecoleId, annee, frequence, periode, filtreMode],
    ),
  ]);

  return {
    paiements,
    total: total?.total ?? 0,
    montant: total?.montant ?? 0,
    montantInscriptions: total?.montant_inscriptions ?? 0,
    annules: total?.annules ?? 0,
  };
}

/** Somme des encaissements valides de scolarité pour une période. */
export async function totalEncaissePeriode(
  ecoleId: string,
  annee: string,
  frequence: Frequence,
  periode: number,
): Promise<number> {
  const ligne = await uneLigne<{ total: number }>(
    `select coalesce(sum(p.montant), 0)::int as total
       from paiements p
       join frais f on f.id = p.frais_id
      where p.ecole_id = $1
        and f.annee_scolaire = $2
        and p.type_frais = 'SCOLARITE'
        and p.frequence_paiement = $3
        and p.periode = $4
        and p.annule = false`,
    [ecoleId, annee, frequence, periode],
  );
  return ligne?.total ?? 0;
}
