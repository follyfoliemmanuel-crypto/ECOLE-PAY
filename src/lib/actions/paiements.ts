"use server";

import { revalidatePath } from "next/cache";
import { transaction, uneLigne } from "../db";
import { getSession } from "../auth";
import { anneeScolaire, libelleAnnee } from "../mois";
import { libelleNature, libellePeriodeFrais } from "../periodes";
import { dateInput, formatDateHeure, formatF } from "../format";
import { lienWhatsApp, rendreMessage } from "../whatsapp";
import { estUuid, entier, messageErreurBdd, texte } from "./helpers";
import {
  LIBELLES_MODE,
  type Frequence,
  type ModePaiement,
  type ResultatPaiement,
  type TypeFrais,
} from "../types";

const MODES: ModePaiement[] = ["ESPECES", "FLOOZ", "TMONEY"];

/**
 * Enregistrement d'un paiement sur une échéance précise (scolarité d'une
 * période ou frais d'inscription).
 * Tout est fait dans une transaction : numéro de reçu, paiement, recalcul de
 * l'échéance. Le trigger PostgreSQL refuse un montant supérieur au reste dû,
 * même si deux secrétaires valident en même temps.
 */
export async function enregistrerPaiement(
  _etat: ResultatPaiement | null,
  donnees: FormData,
): Promise<ResultatPaiement> {
  const session = await getSession();
  if (!session) return { error: "Votre session a expiré. Reconnectez-vous." };

  const eleveId = texte(donnees, "eleve_id");
  const fraisId = texte(donnees, "frais_id");
  const montant = entier(donnees, "montant");
  const mode = texte(donnees, "mode_paiement") as ModePaiement;
  const dateSaisie = texte(donnees, "date_paiement");

  if (!estUuid(eleveId)) return { error: "Choisissez un élève." };
  if (!estUuid(fraisId)) return { error: "Choisissez la période concernée." };
  if (!MODES.includes(mode)) return { error: "Choisissez le mode de paiement." };
  if (!Number.isInteger(montant) || montant <= 0) {
    return { error: "Saisissez un montant valide." };
  }

  let datePaiement: string | null = null;
  if (dateSaisie) {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(dateSaisie)) {
      return { error: "La date du paiement n'est pas valide." };
    }
    const aujourdhui = dateInput();
    if (dateSaisie > aujourdhui) {
      return { error: "La date du paiement ne peut pas être dans le futur." };
    }
    datePaiement = `${dateSaisie}T12:00:00Z`;
  }

  const annee = anneeScolaire();

  try {
    const resultat = await transaction(async (client) => {
      // 1. Lire et verrouiller l'échéance concernée.
      const lecture = await client.query<{
        id: string;
        montant_du: number;
        montant_paye: number;
        reste: number;
        statut: string;
        type_frais: TypeFrais;
        frequence_paiement: Frequence;
        periode: number;
        libelle: string | null;
        nom: string;
        prenom: string;
        nom_parent: string;
        telephone_parent: string;
        classe_nom: string;
        ecole_nom: string;
        modele_recu: string;
      }>(
        `select f.id, f.montant_du, f.montant_paye, f.reste, f.statut,
                f.type_frais, f.frequence_paiement, f.periode, f.libelle,
                e.nom, e.prenom, e.nom_parent, e.telephone_parent,
                c.nom as classe_nom, ec.nom as ecole_nom, ec.modele_recu
           from frais f
           join eleves e on e.id = f.eleve_id
           join classes c on c.id = e.classe_id
           join ecoles ec on ec.id = f.ecole_id
          where f.ecole_id = $1
            and f.eleve_id = $2
            and f.id = $3
            and f.annee_scolaire = $4
            and e.statut = 'actif'
          for update of f`,
        [session.ecoleId, eleveId, fraisId, annee],
      );

      const frais = lecture.rows[0];
      if (!frais) {
        throw new ErreurMetier(
          "Échéance introuvable pour cet élève. Vérifiez sa classe.",
        );
      }
      if (frais.statut === "PAYE" || frais.reste <= 0) {
        throw new ErreurMetier(
          frais.type_frais === "SCOLARITE"
            ? "Cette période est déjà entièrement payée."
            : "Ces frais sont déjà entièrement payés.",
        );
      }
      if (montant > frais.reste) {
        throw new ErreurMetier(
          `Le montant dépasse le reste dû (${formatF(frais.reste)}).`,
        );
      }

      // 2. Numéro de reçu séquentiel, propre à l'école.
      const compteur = await client.query<{ recu_compteur: number }>(
        `update ecoles set recu_compteur = recu_compteur + 1
          where id = $1
          returning recu_compteur`,
        [session.ecoleId],
      );
      const numero = `REC-${annee.slice(0, 4)}-${String(
        compteur.rows[0].recu_compteur,
      ).padStart(5, "0")}`;

      // 3. Écriture du paiement (le trigger met à jour l'échéance et remplit
      //    l'instantané de la nature / période).
      const paiement = await client.query<{ id: string; date_paiement: string }>(
        `insert into paiements
           (ecole_id, eleve_id, frais_id, montant, mode_paiement,
            numero_recu, date_paiement, enregistre_par, reste_apres)
         values ($1, $2, $3, $4, $5, $6, coalesce($7::timestamptz, now()), $8, $9)
         returning id,
                   to_char(date_paiement, 'YYYY-MM-DD"T"HH24:MI:SS"Z"') as date_paiement`,
        [
          session.ecoleId,
          eleveId,
          frais.id,
          montant,
          mode,
          numero,
          datePaiement,
          session.userId,
          frais.reste - montant,
        ],
      );

      const maj = await client.query<{ reste: number; montant_paye: number }>(
        `select reste, montant_paye from frais where id = $1`,
        [frais.id],
      );

      return {
        id: paiement.rows[0].id,
        numero,
        date: paiement.rows[0].date_paiement,
        reste: maj.rows[0].reste,
        frais,
      };
    });

    const periodeLabel = libellePeriodeFrais(
      resultat.frais.type_frais,
      resultat.frais.frequence_paiement,
      resultat.frais.periode,
      annee,
      resultat.frais.libelle,
    );

    const message = rendreMessage(resultat.frais.modele_recu, {
      ecole: resultat.frais.ecole_nom,
      eleve: `${resultat.frais.prenom} ${resultat.frais.nom}`,
      classe: resultat.frais.classe_nom,
      parent: resultat.frais.nom_parent,
      nature: libelleNature(resultat.frais.type_frais),
      // Pour l'inscription, le libellé de période est déjà le nom des frais :
      // on affiche l'année scolaire à la place pour éviter un doublon.
      periode:
        resultat.frais.type_frais === "SCOLARITE"
          ? periodeLabel
          : libelleAnnee(annee),
      mois:
        resultat.frais.type_frais === "SCOLARITE"
          ? periodeLabel
          : libelleAnnee(annee),
      montant: montant,
      reste: resultat.reste,
      montant_du: resultat.frais.montant_du,
      annee,
      recu: resultat.numero,
      mode: LIBELLES_MODE[mode],
      date: formatDateHeure(resultat.date),
    });

    revalidatePath("/app");
    revalidatePath("/app/paiements");
    revalidatePath("/app/eleves");
    revalidatePath(`/app/eleves/${eleveId}`);
    revalidatePath("/app/impayes");

    return {
      ok: true,
      paiement: {
        id: resultat.id,
        numero_recu: resultat.numero,
        montant,
        reste: resultat.reste,
        type_frais: resultat.frais.type_frais,
        frequence_paiement: resultat.frais.frequence_paiement,
        periode: resultat.frais.periode,
        libelle: periodeLabel,
        eleve: `${resultat.frais.prenom} ${resultat.frais.nom}`,
        classe: resultat.frais.classe_nom,
        parent: resultat.frais.nom_parent,
        telephone: resultat.frais.telephone_parent,
        ecole: resultat.frais.ecole_nom,
        date: resultat.date,
        mode,
      },
      urlWhatsApp: lienWhatsApp(resultat.frais.telephone_parent, message),
    };
  } catch (erreur) {
    if (erreur instanceof ErreurMetier) return { error: erreur.message };
    return { error: messageErreurBdd(erreur) };
  }
}

/** Erreur métier : message directement affichable à l'utilisateur. */
class ErreurMetier extends Error {}

// ---------------------------------------------------------------------------
//  Annuler un paiement (directeur uniquement)
//  On n'efface jamais une ligne : la trace reste, l'échéance est recalculée.
// ---------------------------------------------------------------------------
export async function annulerPaiement(
  donnees: FormData,
): Promise<{ error?: string; success?: string }> {
  const session = await getSession();
  if (!session) return { error: "Votre session a expiré." };
  if (session.role !== "directeur") {
    return { error: "Seul le directeur peut annuler un paiement." };
  }

  const id = texte(donnees, "id");
  const motif = texte(donnees, "motif");
  if (!estUuid(id)) return { error: "Paiement introuvable." };
  if (motif.length < 3) {
    return { error: "Indiquez le motif de l'annulation (3 caractères minimum)." };
  }

  const paiement = await uneLigne<{ id: string; annule: boolean }>(
    `select id, annule from paiements where id = $1 and ecole_id = $2`,
    [id, session.ecoleId],
  );
  if (!paiement) return { error: "Paiement introuvable." };
  if (paiement.annule) return { error: "Ce paiement est déjà annulé." };

  try {
    await transaction(async (client) => {
      await client.query(
        `update paiements
            set annule = true,
                annule_par = $1,
                annule_le = now(),
                motif_annulation = $2
          where id = $3 and ecole_id = $4`,
        [session.userId, motif, id, session.ecoleId],
      );
    });
  } catch (erreur) {
    return { error: messageErreurBdd(erreur) };
  }

  revalidatePath("/app");
  revalidatePath("/app/paiements");
  revalidatePath("/app/eleves");
  revalidatePath("/app/impayes");
  return { success: "Paiement annulé. L'échéance a été recalculée." };
}
