"use server";

import { revalidatePath } from "next/cache";
import { sql, uneLigne } from "../db";
import {
  creerSession,
  getSession,
  hacherMotDePasse,
  verifierMotDePasse,
} from "../auth";
import { estEmail, estUuid, messageErreurBdd, texte } from "./helpers";
import { compterUtilisateurs, limitesOffre } from "../data/ecole";
import { aFonctionnalite, offreEffective } from "../offres";
import type { ResultatAction, Role } from "../types";

/** Vérifie que l'appelant est bien le directeur de l'école. */
async function directeur() {
  const session = await getSession();
  if (!session) return { erreur: "Votre session a expiré. Reconnectez-vous." as const };
  if (session.role !== "directeur") {
    return { erreur: "Cette action est réservée au directeur." as const };
  }
  return { session };
}

function texteMultiligne(donnees: FormData, nom: string): string {
  const valeur = donnees.get(nom);
  return typeof valeur === "string" ? valeur.trim() : "";
}

// ---------------------------------------------------------------------------
//  Informations de l'école + modèles WhatsApp
// ---------------------------------------------------------------------------
export async function mettreAJourEcole(
  _etat: ResultatAction | null,
  donnees: FormData,
): Promise<ResultatAction> {
  const controle = await directeur();
  if ("erreur" in controle) return { error: controle.erreur };
  const { session } = controle;

  const nom = texte(donnees, "nom");
  const adresse = texte(donnees, "adresse");
  const telephone = texte(donnees, "telephone");
  const email = texte(donnees, "email").toLowerCase();
  const modeleRecu = texteMultiligne(donnees, "modele_recu");
  const modeleRelance = texteMultiligne(donnees, "modele_relance");

  if (nom.length < 2) return { error: "Le nom de l'école est obligatoire." };
  if (!estEmail(email)) return { error: "L'email de l'école n'est pas valide." };
  if (modeleRecu.length < 20) {
    return { error: "Le modèle de reçu semble trop court." };
  }
  if (modeleRelance.length < 20) {
    return { error: "Le modèle de relance semble trop court." };
  }

  const actuel = await uneLigne<{ logo_url: string | null }>(
    `select logo_url from ecoles where id = $1`,
    [session.ecoleId],
  );

  let logo = actuel?.logo_url ?? null;
  if (texte(donnees, "supprimer_logo") === "1") logo = null;

  const fichier = donnees.get("logo");
  if (fichier instanceof File && fichier.size > 0) {
    if (!["image/png", "image/jpeg", "image/webp"].includes(fichier.type)) {
      return { error: "Le logo doit être une image PNG, JPG ou WebP." };
    }
    if (fichier.size > 250_000) {
      return { error: "Le logo ne doit pas dépasser 250 Ko." };
    }
    const octets = Buffer.from(await fichier.arrayBuffer());
    logo = `data:${fichier.type};base64,${octets.toString("base64")}`;
  }

  try {
    await sql(
      `update ecoles
          set nom = $1, adresse = $2, telephone = $3, email = $4,
              logo_url = $5, modele_recu = $6, modele_relance = $7
        where id = $8`,
      [
        nom,
        adresse || null,
        telephone || null,
        email,
        logo,
        modeleRecu,
        modeleRelance,
        session.ecoleId,
      ],
    );
  } catch (erreur) {
    return { error: messageErreurBdd(erreur) };
  }

  revalidatePath("/app", "layout");
  revalidatePath("/app/parametres");
  return { success: "Les informations de l'école ont été enregistrées." };
}

// ---------------------------------------------------------------------------
//  Équipe : ajouter une secrétaire
// ---------------------------------------------------------------------------
export async function ajouterUtilisateur(
  _etat: ResultatAction | null,
  donnees: FormData,
): Promise<ResultatAction> {
  const controle = await directeur();
  if ("erreur" in controle) return { error: controle.erreur };
  const { session } = controle;

  const nom = texte(donnees, "nom");
  const email = texte(donnees, "email").toLowerCase();
  const motDePasse = texte(donnees, "mot_de_passe");
  const roleSaisi = texte(donnees, "role");
  const offre = offreEffective(session.ecole);

  if (!aFonctionnalite(offre, "equipe")) {
    return {
      error:
        "Votre offre STARTER est limitée à un seul utilisateur. Passez à PRO ou PREMIUM pour ajouter un comptable ou une secrétaire.",
    };
  }

  const limite = limitesOffre(offre);
  const comptes = await compterUtilisateurs(session.ecoleId);
  if (limite.utilisateurs !== null && comptes >= limite.utilisateurs) {
    return {
      error: `Votre offre ${offre} est limitée à ${limite.utilisateurs} utilisateurs actifs. Désactivez un compte ou passez à PREMIUM pour en ajouter davantage.`,
    };
  }

  const role: Role =
    roleSaisi === "comptable" || roleSaisi === "secretaire"
      ? roleSaisi
      : "secretaire";

  if (nom.length < 2) return { error: "Indiquez le nom du nouvel utilisateur." };
  if (!estEmail(email)) return { error: "Cet email n'est pas valide." };
  if (motDePasse.length < 8) {
    return { error: "Le mot de passe doit contenir au moins 8 caractères." };
  }

  const existe = await uneLigne<{ existe: boolean }>(
    `select exists(
       select 1 from users where lower(email) = $1
       union all
       select 1 from ecoles where lower(email) = $1
     ) as existe`,
    [email],
  );
  if (existe?.existe) return { error: "Cet email est déjà utilisé." };

  try {
    const hash = await hacherMotDePasse(motDePasse);
    await sql(
      `insert into users (ecole_id, nom, email, mot_de_passe, role)
       values ($1, $2, $3, $4, $5)`,
      [session.ecoleId, nom, email, hash, role],
    );
  } catch (erreur) {
    return { error: messageErreurBdd(erreur) };
  }

  revalidatePath("/app/parametres");
  return {
    success: `${nom} peut maintenant se connecter avec son email et enregistrer des paiements.`,
  };
}

// ---------------------------------------------------------------------------
//  Équipe : activer / désactiver un compte
// ---------------------------------------------------------------------------
export async function basculerUtilisateur(donnees: FormData): Promise<void> {
  const controle = await directeur();
  if ("erreur" in controle) return;

  const { session } = controle;
  const id = texte(donnees, "id");
  if (!estUuid(id) || id === session.userId) return;

  const cible = await uneLigne<{ role: string; actif: boolean }>(
    `select role, actif from users where id = $1 and ecole_id = $2`,
    [id, session.ecoleId],
  );
  if (!cible) return;

  if (cible.actif && cible.role === "directeur") {
    const autres = await uneLigne<{ total: number }>(
      `select count(*)::int as total
         from users
        where ecole_id = $1 and role = 'directeur' and actif = true and id <> $2`,
      [session.ecoleId, id],
    );
    if ((autres?.total ?? 0) === 0) return; // ne jamais laisser l'école sans directeur
  }

  await sql(
    `update users
        set actif = not actif,
            token_version = token_version + 1
      where id = $1 and ecole_id = $2`,
    [id, session.ecoleId],
  );
  revalidatePath("/app/parametres");
}

// ---------------------------------------------------------------------------
//  Mon mot de passe
// ---------------------------------------------------------------------------
export async function changerMotDePasse(
  _etat: ResultatAction | null,
  donnees: FormData,
): Promise<ResultatAction> {
  const session = await getSession();
  if (!session) return { error: "Votre session a expiré. Reconnectez-vous." };

  const actuel = texte(donnees, "actuel");
  const nouveau = texte(donnees, "nouveau");
  const confirmation = texte(donnees, "confirmation");

  if (nouveau.length < 8) {
    return { error: "Le nouveau mot de passe doit contenir au moins 8 caractères." };
  }
  if (nouveau !== confirmation) {
    return { error: "Les deux nouveaux mots de passe ne sont pas identiques." };
  }

  const ligne = await uneLigne<{ mot_de_passe: string; token_version: number }>(
    `select mot_de_passe, token_version from users where id = $1`,
    [session.userId],
  );
  if (!ligne) return { error: "Compte introuvable." };

  const valide = await verifierMotDePasse(actuel, ligne.mot_de_passe);
  if (!valide) return { error: "Le mot de passe actuel est incorrect." };

  const hash = await hacherMotDePasse(nouveau);
  await sql(
    `update users
        set mot_de_passe = $1, token_version = token_version + 1
      where id = $2`,
    [hash, session.userId],
  );

  // L'appareil courant reste connecté, les autres sessions sont invalidées.
  await creerSession(session.userId, ligne.token_version + 1);
  revalidatePath("/app/parametres");
  return { success: "Votre mot de passe a été mis à jour." };
}
