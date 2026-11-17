"use server";

import { revalidatePath } from "next/cache";
import { exigerSuperAdmin } from "../auth";
import { journaliser } from "../journal";
import { qrCodeDataUrl } from "../qr";
import { uriOtpauth, verifierTOTP } from "../totp";
import {
  activerDeuxFacteurs,
  desactiverDeuxFacteurs,
  etatDeuxFacteurs,
  genererCodesSecours,
  nouveauSecret,
  regenererCodesSecours,
  verifierDeuxiemeFacteur,
} from "../two-facteurs";
import { texte } from "./helpers";

export type EtatDemarrage = {
  secret?: string;
  uri?: string;
  qr?: string;
  error?: string;
} | null;

export type EtatDeuxFacteursAction = {
  error?: string;
  success?: string;
  /** Codes de secours affichés une seule fois. */
  codes?: string[];
} | null;

/** Étape 1 : génère un secret et son QR code, sans rien enregistrer. */
export async function demarrerActivation(
  _etat: EtatDemarrage,
  _donnees: FormData,
): Promise<EtatDemarrage> {
  const email = await exigerSuperAdmin();

  const etat = await etatDeuxFacteurs(email);
  if (etat.actif) {
    return { error: "La double authentification est déjà active." };
  }

  const secret = nouveauSecret();
  const uri = uriOtpauth(secret, email);
  return { secret, uri, qr: await qrCodeDataUrl(uri) };
}

/** Étape 2 : vérifie un premier code et active la 2FA. */
export async function confirmerActivation(
  _etat: EtatDeuxFacteursAction,
  donnees: FormData,
): Promise<EtatDeuxFacteursAction> {
  const email = await exigerSuperAdmin();

  const etat = await etatDeuxFacteurs(email);
  if (etat.actif) {
    return { error: "La double authentification est déjà active." };
  }

  const secret = texte(donnees, "secret")
    .toUpperCase()
    .replace(/[^A-Z2-7]/g, "");
  const code = texte(donnees, "code");

  if (secret.length < 16) {
    return { error: "Le secret d'activation est invalide." };
  }

  if (!verifierTOTP(secret, code).valide) {
    return {
      error:
        "Ce code n'est pas valide. Vérifiez l'heure de votre téléphone puis réessayez.",
    };
  }

  const codes = genererCodesSecours();
  await activerDeuxFacteurs(email, secret, codes);
  await journaliser({
    action: "DEUX_FACTEURS_ACTIVEE",
    libelle: "Double authentification activée sur le compte super admin.",
    auteur: email,
    cible: "Super admin",
  });

  revalidatePath("/super-admin/securite");
  return {
    success:
      "Double authentification activée. Conservez les codes de secours ci-dessous : ils ne seront plus affichés.",
    codes,
  };
}

/** Remplace les codes de secours après vérification d'un code valide. */
export async function regenererCodes(
  _etat: EtatDeuxFacteursAction,
  donnees: FormData,
): Promise<EtatDeuxFacteursAction> {
  const email = await exigerSuperAdmin();
  const code = texte(donnees, "code");

  if (!(await verifierDeuxiemeFacteur(email, code))) {
    return { error: "Code incorrect ou déjà utilisé." };
  }

  const codes = await regenererCodesSecours(email);
  await journaliser({
    action: "CODES_SECOURS_REGENERES",
    libelle: "Codes de secours 2FA régénérés.",
    auteur: email,
    cible: "Super admin",
  });

  revalidatePath("/super-admin/securite");
  return {
    success:
      "Nouveaux codes de secours. Les anciens ne fonctionnent plus. Conservez-les maintenant.",
    codes,
  };
}

/** Désactive la 2FA après vérification d'un code valide. */
export async function desactiver(
  _etat: EtatDeuxFacteursAction,
  donnees: FormData,
): Promise<EtatDeuxFacteursAction> {
  const email = await exigerSuperAdmin();
  const code = texte(donnees, "code");

  const etat = await etatDeuxFacteurs(email);
  if (!etat.actif) {
    return { error: "La double authentification n'est pas active." };
  }

  if (!(await verifierDeuxiemeFacteur(email, code))) {
    return { error: "Code incorrect ou déjà utilisé." };
  }

  await desactiverDeuxFacteurs(email);
  await journaliser({
    action: "DEUX_FACTEURS_DESACTIVEE",
    libelle: "Double authentification désactivée sur le compte super admin.",
    auteur: email,
    cible: "Super admin",
  });

  revalidatePath("/super-admin/securite");
  return {
    success:
      "Double authentification désactivée. Réactivez-la dès que possible : un seul mot de passe protège toutes les écoles.",
  };
}
