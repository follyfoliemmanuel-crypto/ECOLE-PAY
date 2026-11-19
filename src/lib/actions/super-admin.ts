"use server";

import { revalidatePath } from "next/cache";
import { exigerSuperAdmin } from "../auth";
import { transaction, uneLigne } from "../db";
import { dateDuJour } from "../activation";
import {
  MOIS_ACCES_ANNEE,
  MOIS_PAYES_ANNEE,
  OFFRES,
  estOffre,
  planDepuisOffre,
} from "../offres";
import { journaliser } from "../journal";
import { estUuid } from "./helpers";
import type { Offre, ResultatAction } from "../types";

/** Durées proposées : 1 mois, ou l'année scolaire (9 mois payés = 12 mois). */
type Duree = 1 | typeof MOIS_PAYES_ANNEE;

const MOIS_ACCES: Record<Duree, number> = {
  1: 1,
  [MOIS_PAYES_ANNEE]: MOIS_ACCES_ANNEE,
};

function ajouterJours(dateIso: string, jours: number): string {
  const date = new Date(`${dateIso}T00:00:00Z`);
  date.setUTCDate(date.getUTCDate() + jours);
  return date.toISOString().slice(0, 10);
}

function ajouterMois(dateIso: string, mois: number): string {
  const date = new Date(`${dateIso}T00:00:00Z`);
  const jour = date.getUTCDate();
  date.setUTCDate(1);
  date.setUTCMonth(date.getUTCMonth() + mois);
  const dernierJour = new Date(
    Date.UTC(date.getUTCFullYear(), date.getUTCMonth() + 1, 0),
  ).getUTCDate();
  date.setUTCDate(Math.min(jour, dernierJour));
  return date.toISOString().slice(0, 10);
}

/**
 * Encaisse un abonnement mensuel et prolonge la période couverte.
 *
 * `duree` = 1 : un mois. `duree` = 9 : option annuelle, 9 mois payés pour
 * 12 mois d'accès (toute l'année scolaire). Le paiement part de la fin de la
 * période en cours quand elle est encore valide, sinon du jour même.
 */
async function activer(
  ecoleId: string,
  offre: Offre,
  duree: Duree,
): Promise<ResultatAction> {
  const auteur = await exigerSuperAdmin();

  if (!estUuid(ecoleId)) return { error: "École introuvable." };
  if (!estOffre(offre)) return { error: "Offre inconnue." };

  const plan = planDepuisOffre(offre);
  const aujourdhui = dateDuJour();
  const prixMensuel = OFFRES[offre].prix;
  const montant = prixMensuel * duree;
  const moisAcces = MOIS_ACCES[duree];
  const moisOfferts = moisAcces - duree;

  const resultat = await transaction(async (client) => {
    const ecole = await client.query<{ nom: string }>(
      `select nom from ecoles where id = $1 for update`,
      [ecoleId],
    );
    if (!ecole.rows[0]) return null;

    const abo = await client.query<{
      date_debut: string;
      date_fin: string;
    }>(
      `select date_debut::text as date_debut, date_fin::text as date_fin
         from subscriptions
        where school_id = $1
        for update`,
      [ecoleId],
    );

    const existant = abo.rows[0];
    const enCours = Boolean(existant && existant.date_fin >= aujourdhui);
    const base = enCours ? existant!.date_fin : ajouterJours(aujourdhui, -1);
    const dateFin = ajouterMois(base, moisAcces);
    const dateDebut = existant?.date_debut ?? aujourdhui;

    await client.query(
      `insert into subscriptions
         (school_id, plan, status, date_debut, date_fin, dernier_paiement,
          montant, mois_payes, mois_offerts)
       values ($1, $2, 'active', $3, $4, current_date, $5, $6, $7)
       on conflict (school_id) do update
          set plan = excluded.plan,
              status = 'active',
              date_debut = excluded.date_debut,
              date_fin = excluded.date_fin,
              dernier_paiement = current_date,
              montant = excluded.montant,
              mois_payes = excluded.mois_payes,
              mois_offerts = excluded.mois_offerts,
              updated_at = now()`,
      [
        ecoleId,
        plan,
        dateDebut,
        dateFin,
        montant,
        duree,
        moisOfferts,
      ],
    );

    return { nom: ecole.rows[0].nom, dateDebut, dateFin };
  });

  if (!resultat) return { error: "École introuvable." };

  const libelleDuree =
    duree === 1 ? "1 mois" : `${MOIS_ACCES_ANNEE} mois (9 payés)`;

  await journaliser({
    action: "OFFRE_ACTIVEE",
    libelle: `${resultat.nom} activée en ${offre} pour ${libelleDuree} jusqu'au ${resultat.dateFin}.`,
    auteur,
    cible: resultat.nom,
    cibleId: ecoleId,
    details: {
      plan,
      duree,
      montant,
      date_debut: resultat.dateDebut,
      date_fin: resultat.dateFin,
    },
  });

  revalidatePath("/super-admin");
  revalidatePath("/app", "layout");
  revalidatePath("/abonnement");
  return {
    success: `${resultat.nom} activée en ${offre} jusqu'au ${resultat.dateFin} (${libelleDuree}). Les modifications sont débloquées immédiatement.`,
  };
}

/**
 * Bascule d'offre en un clic.
 *
 * Contrairement à l'encaissement, cette action ne touche ni au statut ni aux
 * dates : elle change seulement le niveau de fonctionnalités. Comme
 * `getSession()` relit l'offre en base à chaque requête, le déblocage
 * (PREMIUM) et le verrouillage (STARTER/STANDARD) sont immédiats, sans
 * reconnexion. Aucune donnée n'est supprimée.
 */
export async function changerOffre(
  ecoleId: string,
  offre: Offre,
): Promise<ResultatAction> {
  const auteur = await exigerSuperAdmin();

  if (!estUuid(ecoleId)) return { error: "École introuvable." };
  if (!estOffre(offre)) return { error: "Offre inconnue." };

  const ligne = await uneLigne<{ nom: string; statut: string }>(
    `update ecoles
        set offre = $2,
            updated_at = now()
      where id = $1
      returning nom, statut`,
    [ecoleId, offre],
  );

  if (!ligne) return { error: "École introuvable." };

  // Le plan de l'abonnement suit l'offre ; le statut et les dates ne bougent
  // pas (seul un paiement les modifie).
  await uneLigne(
    `update subscriptions
        set plan = $2,
            updated_at = now()
      where school_id = $1`,
    [ecoleId, planDepuisOffre(offre)],
  );

  await journaliser({
    action: "OFFRE_CHANGEE",
    libelle: `Bascule d'offre de ${ligne.nom} vers ${offre}.`,
    auteur,
    cible: ligne.nom,
    cibleId: ecoleId,
    details: { offre, statut: ligne.statut },
  });

  revalidatePath("/super-admin");
  // Le layout couvre toutes les pages /app : dashboard, profs, notes, portail…
  revalidatePath("/app", "layout");
  revalidatePath("/prof", "layout");
  revalidatePath("/premium");
  revalidatePath("/abonnement");

  const fonctions =
    offre === "PREMIUM"
      ? "rapports graphiques, export Excel, SMS illimités, comptes profs et portail parent débloqués"
      : offre === "STANDARD"
        ? "paiements des parents et absences débloqués, fonctions PREMIUM verrouillées"
        : "paiements des parents et fonctions PREMIUM verrouillés";
  const blocage =
    ligne.statut === "BLOQUE"
      ? " L'école reste en lecture seule : encaissez un paiement pour la débloquer."
      : ligne.statut === "ESSAI"
        ? " L'essai en cours continue avec toutes les fonctions PREMIUM."
        : "";

  return {
    success: `${ligne.nom} passe en ${offre} : ${fonctions} immédiatement.${blocage}`,
  };
}

// Les combinaisons proposées au super admin ----------------------------------
export async function activerStarter1Mois(ecoleId: string) {
  return activer(ecoleId, "STARTER", 1);
}
export async function activerStandard1Mois(ecoleId: string) {
  return activer(ecoleId, "STANDARD", 1);
}
export async function activerPremium1Mois(ecoleId: string) {
  return activer(ecoleId, "PREMIUM", 1);
}
export async function activerStarterAnnee(ecoleId: string) {
  return activer(ecoleId, "STARTER", MOIS_PAYES_ANNEE);
}
export async function activerStandardAnnee(ecoleId: string) {
  return activer(ecoleId, "STANDARD", MOIS_PAYES_ANNEE);
}
export async function activerPremiumAnnee(ecoleId: string) {
  return activer(ecoleId, "PREMIUM", MOIS_PAYES_ANNEE);
}

/**
 * BLOQUER : passe l'abonnement en lecture seule immédiatement, sans effacer
 * la moindre donnée. Un paiement encaissé ensuite rouvre l'accès complet.
 */
export async function bloquerEcole(ecoleId: string): Promise<ResultatAction> {
  const auteur = await exigerSuperAdmin();

  if (!estUuid(ecoleId)) return { error: "École introuvable." };

  const ligne = await uneLigne<{ nom: string }>(
    `update ecoles
        set statut = 'BLOQUE',
            updated_at = now()
      where id = $1
      returning nom`,
    [ecoleId],
  );

  if (!ligne) return { error: "École introuvable." };

  await uneLigne(
    `update subscriptions
        set status = 'blocked',
            updated_at = now()
      where school_id = $1`,
    [ecoleId],
  );

  await journaliser({
    action: "ECOLE_BLOQUEE",
    libelle: `${ligne.nom} a été passée en lecture seule.`,
    auteur,
    cible: ligne.nom,
    cibleId: ecoleId,
  });

  revalidatePath("/super-admin");
  revalidatePath("/app", "layout");
  return {
    success: `${ligne.nom} est maintenant en lecture seule : consultation possible, modifications bloquées. Ses données restent conservées.`,
  };
}

/**
 * DÉBLOQUER : rétablit les modifications sans encaisser de paiement.
 * Utile après un blocage manuel ou une erreur de règlement.
 */
export async function debloquerEcole(ecoleId: string): Promise<ResultatAction> {
  const auteur = await exigerSuperAdmin();

  if (!estUuid(ecoleId)) return { error: "École introuvable." };

  const abo = await uneLigne<{ date_fin: string }>(
    `update subscriptions
        set status = 'active',
            updated_at = now()
      where school_id = $1
      returning date_fin::text as date_fin`,
    [ecoleId],
  );

  const ligne = await uneLigne<{ nom: string }>(
    `update ecoles
        set statut = 'ACTIF',
            updated_at = now()
      where id = $1
      returning nom`,
    [ecoleId],
  );

  if (!ligne) return { error: "École introuvable." };

  await journaliser({
    action: "ECOLE_DEBLOQUEE",
    libelle: `${ligne.nom} a été rétablie en écriture.`,
    auteur,
    cible: ligne.nom,
    cibleId: ecoleId,
    details: { date_fin: abo?.date_fin ?? null },
  });

  revalidatePath("/super-admin");
  revalidatePath("/app", "layout");

  const expire = abo && abo.date_fin < dateDuJour();
  return {
    success: expire
      ? `${ligne.nom} est débloquée, mais la période couverte est terminée : encaissez un paiement pour prolonger l'accès.`
      : `${ligne.nom} est de nouveau autorisée à modifier ses données.`,
  };
}

// ---------------------------------------------------------------------------
//  Anti-triche des essais : forcer un nouvel essai pour un vrai directeur
// ---------------------------------------------------------------------------
/**
 * Réinitialise le registre des essais pour l'identité d'une inscription
 * refusée : les lignes `essais_utilises` correspondantes passent à
 * `actif = false`, ce qui autorise un nouvel essai de 30 jours.
 *
 * Rien n'est supprimé : l'historique reste consultable et une ligne FORCE est
 * ajoutée au journal d'audit avec l'email du super admin.
 */
export async function forcerNouvelEssai(
  auditId: string,
): Promise<ResultatAction> {
  const auteur = await exigerSuperAdmin();

  if (!estUuid(auditId)) return { error: "Tentative introuvable." };

  const resultat = await transaction(async (client) => {
    const audit = await client.query<{
      nom_ecole: string;
      nom_normalise: string;
      telephone: string | null;
      telephone_normalise: string | null;
      whatsapp: string | null;
      whatsapp_normalise: string | null;
      email: string;
      ip: string | null;
      appareil: string | null;
      traite: boolean;
    }>(
      `select nom_ecole, nom_normalise, telephone, telephone_normalise,
              whatsapp, whatsapp_normalise, email, ip, appareil, traite
         from inscriptions_audit
        where id = $1 and type = 'REFUS'
        for update`,
      [auditId],
    );

    const ligne = audit.rows[0];
    if (!ligne) return { introuvable: true as const };
    if (ligne.traite) return { dejaTraite: true as const, nom: ligne.nom_ecole };

    // Tous les essais actifs qui bloqueraient cette identité sont neutralisés.
    await client.query(
      `update essais_utilises
          set actif = false
        where actif = true
          and (
            nom_normalise = $1
            or ($2::text is not null and telephone_normalise = $2::text)
            or ($3::text is not null and whatsapp_normalise = $3::text)
          )`,
      [
        ligne.nom_normalise,
        ligne.telephone_normalise,
        ligne.whatsapp_normalise,
      ],
    );

    await client.query(
      `update inscriptions_audit set traite = true where id = $1`,
      [auditId],
    );

    await client.query(
      `insert into inscriptions_audit
         (type, nom_ecole, nom_normalise, telephone, telephone_normalise,
          whatsapp, whatsapp_normalise, email, ip, appareil, motif, auteur,
          traite)
       values ('FORCE', $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, true)`,
      [
        ligne.nom_ecole,
        ligne.nom_normalise,
        ligne.telephone,
        ligne.telephone_normalise,
        ligne.whatsapp,
        ligne.whatsapp_normalise,
        ligne.email,
        ligne.ip,
        ligne.appareil,
        "Nouvel essai autorisé manuellement par le super admin.",
        auteur,
      ],
    );

    return { nom: ligne.nom_ecole };
  });

  if ("introuvable" in resultat) return { error: "Tentative introuvable." };
  if ("dejaTraite" in resultat) {
    return { error: `Un nouvel essai a déjà été accordé pour ${resultat.nom}.` };
  }

  revalidatePath("/super-admin");
  await journaliser({
    action: "ESSAI_FORCE",
    libelle: `Nouvel essai accordé à ${resultat.nom}.`,
    auteur,
    cible: resultat.nom,
    details: { audit_id: auditId },
  });
  return {
    success: `Nouvel essai autorisé pour ${resultat.nom}. Le directeur peut se réinscrire avec le même nom d'école ou le même téléphone.`,
  };
}

