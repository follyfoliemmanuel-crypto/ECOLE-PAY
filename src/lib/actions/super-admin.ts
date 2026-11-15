"use server";

import { revalidatePath } from "next/cache";
import { exigerSuperAdmin } from "../auth";
import { transaction, uneLigne } from "../db";
import { estOffre, OFFRES } from "../offres";
import { estUuid } from "./helpers";
import type { Offre, ResultatAction } from "../types";

type Duree = 30 | 90;

async function activer(
  ecoleId: string,
  offre: Offre,
  jours: Duree,
): Promise<ResultatAction> {
  await exigerSuperAdmin();

  if (!estUuid(ecoleId)) return { error: "École introuvable." };
  if (!estOffre(offre)) return { error: "Offre inconnue." };

  const ligne = await uneLigne<{ nom: string; date_fin: string }>(
    `update ecoles
        set statut = 'ACTIF',
            offre = $2,
            date_fin_abonnement = (
              case
                when statut = 'ACTIF' and date_fin_abonnement is not null
                  then greatest(date_fin_abonnement, current_date) + make_interval(days => $3::int)
                else current_date + make_interval(days => $3::int)
              end
            )::date,
            updated_at = now()
      where id = $1
      returning nom,
                to_char(date_fin_abonnement, 'DD/MM/YYYY') as date_fin`,
    [ecoleId, offre, jours],
  );

  if (!ligne) return { error: "École introuvable." };

  revalidatePath("/super-admin");
  revalidatePath("/app", "layout");
  return {
    success: `${ligne.nom} activée en ${offre} jusqu'au ${ligne.date_fin}. Les fonctions ${OFFRES[offre].nom} sont disponibles immédiatement.`,
  };
}

/**
 * Bascule d'offre en un clic.
 *
 * Contrairement aux six boutons d'activation, cette action ne touche ni au
 * statut ni à la date de fin d'abonnement : elle change seulement le niveau de
 * fonctionnalités. Comme `getSession()` relit l'offre en base à chaque requête,
 * le déblocage (PREMIUM) et le verrouillage (STARTER/PRO) sont immédiats, sans
 * reconnexion. Aucune donnée n'est supprimée.
 */
export async function changerOffre(
  ecoleId: string,
  offre: Offre,
): Promise<ResultatAction> {
  await exigerSuperAdmin();

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

  revalidatePath("/super-admin");
  // Le layout couvre toutes les pages /app : dashboard, profs, notes, portail…
  revalidatePath("/app", "layout");
  revalidatePath("/prof", "layout");
  revalidatePath("/premium");

  const fonctions =
    offre === "PREMIUM"
      ? "comptes profs, saisie et validation des notes, portail parent, QR code et envoi WhatsApp débloqués"
      : "comptes profs, portail parent et envoi WhatsApp verrouillés";
  const blocage =
    ligne.statut === "BLOQUE"
      ? " L'école reste bloquée : activez une offre pour rouvrir l'accès."
      : ligne.statut === "ESSAI"
        ? " L'essai en cours continue avec toutes les fonctions PREMIUM."
        : "";

  return {
    success: `${ligne.nom} passe en ${offre} : ${fonctions} immédiatement.${blocage}`,
  };
}

// Les six combinaisons demandées par le super admin ---------------------------
export async function activerStarter1Mois(ecoleId: string) {
  return activer(ecoleId, "STARTER", 30);
}export async function activerPro1Mois(ecoleId: string) {
  return activer(ecoleId, "PRO", 30);
}
export async function activerPremium1Mois(ecoleId: string) {
  return activer(ecoleId, "PREMIUM", 30);
}
export async function activerStarter3Mois(ecoleId: string) {
  return activer(ecoleId, "STARTER", 90);
}
export async function activerPro3Mois(ecoleId: string) {
  return activer(ecoleId, "PRO", 90);
}
export async function activerPremium3Mois(ecoleId: string) {
  return activer(ecoleId, "PREMIUM", 90);
}

/** BLOQUER : coupe immédiatement l'accès à l'application, sans effacer les données. */
export async function bloquerEcole(ecoleId: string): Promise<ResultatAction> {
  await exigerSuperAdmin();

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

  revalidatePath("/super-admin");
  revalidatePath("/app", "layout");
  return {
    success: `${ligne.nom} est maintenant bloquée. Ses données restent conservées.`,
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
  return {
    success: `Nouvel essai autorisé pour ${resultat.nom}. Le directeur peut se réinscrire avec le même nom d'école ou le même téléphone.`,
  };
}

