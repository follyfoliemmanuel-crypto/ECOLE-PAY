import { createHash, randomBytes, timingSafeEqual } from "node:crypto";
import { cache } from "react";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import bcrypt from "bcryptjs";
import { SignJWT, jwtVerify } from "jose";
import { sql, uneLigne } from "./db";
import {
  emailSuperAdmin,
  motifLectureSeule,
} from "./activation";
import { OFFRE_ESSAI, offreDepuisPlan } from "./offres";
import { INACTIVITE_MAX_MS, RAFRAICHISSEMENT_ACTIVITE_MS } from "./securite";
import {
  NOM_COOKIE_SESSION,
  NOM_COOKIE_SUPER,
  optionsCookie,
} from "./cookies";
import { validerChamp } from "./validation";
import type {
  AbonnementEcole,
  Offre,
  Role,
  Session,
  StatutEcole,
} from "./types";

const DUREE_SESSION = 60 * 60 * 24 * 30; // 30 jours
const DUREE_SUPER = 60 * 60 * 2; // 2 heures : le super admin agit sur toutes les écoles
/** Durée de vie du défi « mot de passe validé, code 2FA attendu ». */
const DUREE_DEFI_2FA = 5 * 60; // 5 minutes

/**
 * Hash bcrypt factice. Comparé quand l'utilisateur n'existe pas, pour que la
 * réponse prenne le même temps qu'un vrai échec de mot de passe : sans cela,
 * l'écart de durée révèle quels emails sont enregistrés.
 */
const HASH_FACTICE =
  "$2b$12$c1hiPW472QPXVfZaKVVOwe0.38PvzQnGnEWt8D8vKzWfyketDNbW2";

function secret(): Uint8Array {
  const valeur = process.env.AUTH_SECRET;
  if (!valeur || valeur.length < 32) {
    throw new Error(
      "AUTH_SECRET doit contenir au moins 32 caractères. Voir .env.example.",
    );
  }
  return new TextEncoder().encode(valeur);
}

// ---------------------------------------------------------------------------
//  Mots de passe
// ---------------------------------------------------------------------------
export async function hacherMotDePasse(motDePasse: string): Promise<string> {
  // Validation du mot de passe avant hachage
  if (!motDePasse || motDePasse.length < 8) {
    throw new Error("Mot de passe trop court (minimum 8 caractères)");
  }
  
  // Rejeter les mots de passe trop communes (liste de base)
  const commonPasswords = ["admin", "password", "123456", "hello", "demo", "12345678", "qwerty", "letmein"];
  if (commonPasswords.includes(motDePasse.toLowerCase())) {
    throw new Error("Mot de passe trop commun");
  }

  try {
    return await bcrypt.hash(motDePasse, 12);
  } catch (erreur) {
    throw new Error("Échec du hachage de mot de passe");
  }
}

export async function verifierMotDePasse(
  motDePasse: string,
  hash: string,
): Promise<boolean> {
  return bcrypt.compare(motDePasse, hash);
}

/**
 * Consomme le même temps qu'une vérification réelle, sans révéler si le compte
 * existe. À appeler sur les chemins d'échec où aucun hash réel n'est comparé.
 */
export async function comparerMotDePasseFactice(
  motDePasse: string,
): Promise<void> {
  // Sécuriser la comparaison pour éviter l'analyse temporelle
  if (!motDePasse) return Promise.resolve();
  
  try {
    await bcrypt.compare(motDePasse, HASH_FACTICE).catch(() => false);
  } catch {
    // Intentionally ignore errors - cette fonction est une protection anti-fuite de données
  }
}

export function hacherJeton(jeton: string): string {
  return createHash("sha256").update(jeton).digest("hex");
}

export function genererJeton(): string {
  return randomBytes(32).toString("hex");
}

// ---------------------------------------------------------------------------
//  Session (JWT httpOnly, vérifiée côté serveur à chaque requête)
// ---------------------------------------------------------------------------
type ChargeUtile = { sub?: string; typ: "session"; ver: number };

export async function creerSession(
  userId: string,
  versionJeton = 0,
): Promise<void> {
  const jeton = await new SignJWT({ typ: "session", ver: versionJeton } satisfies ChargeUtile)
    .setProtectedHeader({ alg: "HS256" })
    .setSubject(userId)
    .setIssuedAt()
    .setExpirationTime(`${DUREE_SESSION}s`)
    .sign(secret());

  const jar = await cookies();
  jar.set(NOM_COOKIE_SESSION, jeton, optionsCookie(DUREE_SESSION));
}

export async function supprimerSession(): Promise<void> {
  const jar = await cookies();
  jar.set(NOM_COOKIE_SESSION, "", optionsCookie(0));
}

/**
 * Lit le cookie, vérifie la signature, puis recharge l'utilisateur en base.
 * Le rechargement garantit qu'un compte désactivé perd immédiatement l'accès.
 */
export const getSession = cache(async (): Promise<Session | null> => {
  const jar = await cookies();
  const jeton = jar.get(NOM_COOKIE_SESSION)?.value;
  if (!jeton) return null;

  let userId: string;
  let versionJeton: number;
  try {
    const { payload } = await jwtVerify(jeton, secret(), {
      algorithms: ["HS256"],
    });
    if (!payload.sub || payload.typ !== "session") return null;
    userId = payload.sub;
    versionJeton = Number(payload.ver ?? 0);
  } catch {
    return null;
  }

  const ligne = await uneLigne<{
    id: string;
    ecole_id: string;
    nom: string;
    email: string | null;
    identifiant: string | null;
    prof_id: string | null;
    role: Role;
    token_version: number;
    derniere_activite: number;
    ecole_nom: string;
    logo_url: string | null;
    offre: Offre;
    statut: StatutEcole;
    date_fin_essai: string | null;
    date_fin_abonnement: string | null;
    abo_plan: string | null;
    abo_statut: string | null;
    abo_debut: string | null;
    abo_fin: string | null;
    abo_dernier_paiement: string | null;
    abo_montant: number | null;
    abo_mois: number | null;
  }>(
    `select u.id, u.ecole_id, u.nom, u.email, u.identifiant, u.role,
            u.token_version, p.id as prof_id,
            extract(epoch from u.derniere_activite)::float8 as derniere_activite,
            e.nom as ecole_nom, e.logo_url, e.offre, e.statut,
            e.date_fin_essai::text as date_fin_essai,
            e.date_fin_abonnement::text as date_fin_abonnement,
            s.plan as abo_plan,
            s.status as abo_statut,
            s.date_debut::text as abo_debut,
            s.date_fin::text as abo_fin,
            s.dernier_paiement::text as abo_dernier_paiement,
            s.montant as abo_montant,
            s.mois_payes as abo_mois
       from users u
       join ecoles e on e.id = u.ecole_id
       left join profs p on p.user_id = u.id and p.ecole_id = u.ecole_id
       left join subscriptions s on s.school_id = e.id
      where u.id = $1
        and u.actif = true
        and e.actif = true`,
    [userId],
  );

  if (!ligne || ligne.token_version !== versionJeton) return null;

  // Déconnexion automatique après 24 h d'inactivité. On ne supprime pas le
  // cookie ici (interdit pendant le rendu d'un composant serveur) : la session
  // est simplement ignorée, puis remplacée à la prochaine connexion.
  const activite = Number(ligne.derniere_activite) * 1000;
  if (!Number.isFinite(activite) || Date.now() - activite > INACTIVITE_MAX_MS) {
    return null;
  }

  // On rafraîchit la date au maximum toutes les 5 minutes pour éviter une
  // écriture à chaque requête.
  if (Date.now() - activite > RAFRAICHISSEMENT_ACTIVITE_MS) {
    await sql(`update users set derniere_activite = now() where id = $1`, [
      ligne.id,
    ]);
  }

  const abonnement: AbonnementEcole | null = ligne.abo_plan
    ? {
        plan: offreDepuisPlan(ligne.abo_plan),
        statut: ligne.abo_statut === "blocked" ? "blocked" : "active",
        dateDebut: ligne.abo_debut ?? new Date().toISOString().slice(0, 10),
        dateFin: ligne.abo_fin ?? new Date().toISOString().slice(0, 10),
        dernierPaiement: ligne.abo_dernier_paiement,
        montant: ligne.abo_montant ?? 0,
        moisPayes: ligne.abo_mois ?? 1,
      }
    : null;

  // `subscriptions` est la source de vérité. L'offre et le mode lecture seule
  // sont recalculés à chaque requête : aucun redémarrage n'est nécessaire
  // après un paiement ou un blocage.
  const offre: Offre =
    ligne.statut === "ESSAI"
      ? OFFRE_ESSAI
      : (abonnement?.plan ?? ligne.offre);

  const motif = motifLectureSeule({
    statut: ligne.statut,
    dateFinEssai: ligne.date_fin_essai,
    abonnement: abonnement
      ? { statut: abonnement.statut, dateFin: abonnement.dateFin }
      : null,
  });

  return {
    userId: ligne.id,
    ecoleId: ligne.ecole_id,
    role: ligne.role,
    nom: ligne.nom,
    email: ligne.email,
    identifiant: ligne.identifiant,
    profId: ligne.prof_id,
    ecole: {
      id: ligne.ecole_id,
      nom: ligne.ecole_nom,
      logoUrl: ligne.logo_url,
      offre,
      statut: ligne.statut,
      dateFinEssai: ligne.date_fin_essai,
      dateFinAbonnement: abonnement?.dateFin ?? ligne.date_fin_abonnement,
      abonnement,
      lectureSeule: motif !== null,
      motifLectureSeule: motif,
    },
  };
});

export async function exigerSession(): Promise<Session> {
  const session = await getSession();
  if (!session) redirect("/connexion");
  // Un professeur n'a accès qu'à son espace de saisie : il ne voit jamais les
  // paiements, les paramètres ni les autres écoles.
  if (session.role === "prof") redirect("/prof");
  // Un impayé ne coupe plus l'accès : l'école passe en lecture seule et garde
  // la consultation de toutes ses données. Les écritures sont refusées par
  // `refusEcriture()` dans chaque Server Action.
  return session;
}

/**
 * Garde des Server Actions qui modifient les données.
 * Retourne un message d'erreur quand l'abonnement n'est pas réglé.
 */
export function refusEcriture(session: Session): string | null {
  if (!session.ecole.lectureSeule) return null;
  return "Votre abonnement SCHOOL PAY n'est pas réglé : le compte est en lecture seule. Ouvrez la page Abonnement pour payer et débloquer immédiatement les modifications.";
}

/**
 * Garde de l'espace professeur. Le directeur et les autres rôles sont renvoyés
 * vers leur tableau de bord.
 */
export async function exigerProf(): Promise<Session> {
  const session = await getSession();
  if (!session) redirect("/connexion?suivant=/prof");
  if (session.role !== "prof") redirect("/app");
  if (!session.profId) redirect("/connexion");
  return session;
}

export function estDirecteur(session: Session): boolean {
  return session.role === "directeur";
}

// ---------------------------------------------------------------------------
//  Session super admin (page d'activation, email unique)
// ---------------------------------------------------------------------------
type ChargeSuper = { typ: "super"; email: string };

/** Vérifie le mot de passe super admin défini par variable d'environnement. */
export function verifierMotDePasseSuperAdmin(saisie: string): boolean {
  const attendu = process.env.SUPER_ADMIN_PASSWORD;
  if (!attendu || attendu.length < 12 || !saisie) return false;

  const hashSaisi = createHash("sha256").update(saisie).digest();
  const hashAttendu = createHash("sha256").update(attendu).digest();

  // Utiliser timingSafeEqual pour éviter les attaques temporelles
  try {
    return timingSafeEqual(hashSaisi, hashAttendu);
  } catch {
    return false;
  }
}

/**
 * Défi signé émis après un mot de passe super admin correct : il autorise la
 * saisie du code 2FA sans redemander le mot de passe. Sa courte durée de vie
 * et son lien à l'email empêchent toute réutilisation.
 */
type ChargeDefi2FA = { typ: "super-defi"; email: string };

export async function creerDefiDeuxFacteurs(email: string): Promise<string> {
  return new SignJWT({
    typ: "super-defi",
    email: email.toLowerCase(),
  } satisfies ChargeDefi2FA)
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime(`${DUREE_DEFI_2FA}s`)
    .sign(secret());
}

export async function verifierDefiDeuxFacteurs(
  defi: string,
  email: string,
): Promise<boolean> {
  const emailDuDefi = await emailDuDefiDeuxFacteurs(defi);
  return emailDuDefi !== null && emailDuDefi === email.toLowerCase();
}

/** Email porté par un défi 2FA valide, ou null s'il est expiré/forgé. */
export async function emailDuDefiDeuxFacteurs(
  defi: string,
): Promise<string | null> {
  if (!defi) return null;
  try {
    const { payload } = await jwtVerify(defi, secret(), {
      algorithms: ["HS256"],
    });
    return payload.typ === "super-defi" && typeof payload.email === "string"
      ? payload.email.toLowerCase()
      : null;
  } catch {
    return null;
  }
}

export async function creerSessionSuperAdmin(): Promise<void> {
  const jeton = await new SignJWT({ typ: "super", email: emailSuperAdmin() } satisfies ChargeSuper)
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime(`${DUREE_SUPER}s`)
    .sign(secret());

  const jar = await cookies();
  jar.set(NOM_COOKIE_SUPER, jeton, optionsCookie(DUREE_SUPER));
}

export async function supprimerSessionSuperAdmin(): Promise<void> {
  const jar = await cookies();
  jar.set(NOM_COOKIE_SUPER, "", optionsCookie(0));
}

/** Email du super admin connecté, ou null. */
export async function getSuperAdmin(): Promise<string | null> {
  const jar = await cookies();
  const jeton = jar.get(NOM_COOKIE_SUPER)?.value;
  if (!jeton) return null;

  try {
    const { payload } = await jwtVerify(jeton, secret(), {
      algorithms: ["HS256"],
    });
    if (payload.typ !== "super" || typeof payload.email !== "string") return null;
    return payload.email.toLowerCase() === emailSuperAdmin()
      ? payload.email
      : null;
  } catch {
    return null;
  }
}

/** Garde de la page super admin : seul l'email autorisé passe. */
export async function exigerSuperAdmin(): Promise<string> {
  const email = await getSuperAdmin();
  if (!email) redirect("/connexion");
  return email;
}
