import { createHash, randomBytes, timingSafeEqual } from "node:crypto";
import { cache } from "react";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import bcrypt from "bcryptjs";
import { SignJWT, jwtVerify } from "jose";
import { sql, uneLigne } from "./db";
import { accesAutorise, emailSuperAdmin } from "./activation";
import { INACTIVITE_MAX_MS, RAFRAICHISSEMENT_ACTIVITE_MS } from "./securite";
import type { Offre, Role, Session, StatutEcole } from "./types";

const COOKIE = "ecolepay_session";
const COOKIE_SUPER = "ecolepay_super";
const DUREE_SESSION = 60 * 60 * 24 * 30; // 30 jours
const DUREE_SUPER = 60 * 60 * 8; // 8 heures

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
  return bcrypt.hash(motDePasse, 12);
}

export async function verifierMotDePasse(
  motDePasse: string,
  hash: string,
): Promise<boolean> {
  return bcrypt.compare(motDePasse, hash);
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
  jar.set(COOKIE, jeton, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: DUREE_SESSION,
  });
}

export async function supprimerSession(): Promise<void> {
  const jar = await cookies();
  jar.set(COOKIE, "", { httpOnly: true, path: "/", maxAge: 0 });
}

/**
 * Lit le cookie, vérifie la signature, puis recharge l'utilisateur en base.
 * Le rechargement garantit qu'un compte désactivé perd immédiatement l'accès.
 */
export const getSession = cache(async (): Promise<Session | null> => {
  const jar = await cookies();
  const jeton = jar.get(COOKIE)?.value;
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
  }>(
    `select u.id, u.ecole_id, u.nom, u.email, u.identifiant, u.role,
            u.token_version, p.id as prof_id,
            extract(epoch from u.derniere_activite)::float8 as derniere_activite,
            e.nom as ecole_nom, e.logo_url, e.offre, e.statut,
            e.date_fin_essai::text as date_fin_essai,
            e.date_fin_abonnement::text as date_fin_abonnement
       from users u
       join ecoles e on e.id = u.ecole_id
       left join profs p on p.user_id = u.id and p.ecole_id = u.ecole_id
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
      offre: ligne.offre,
      statut: ligne.statut,
      dateFinEssai: ligne.date_fin_essai,
      dateFinAbonnement: ligne.date_fin_abonnement,
    },
  };
});

export async function exigerSession(): Promise<Session> {
  const session = await getSession();
  if (!session) redirect("/connexion");
  // Un professeur n'a accès qu'à son espace de saisie : il ne voit jamais les
  // paiements, les paramètres ni les autres écoles.
  if (session.role === "prof") redirect("/prof");
  if (!accesAutorise(session.ecole)) redirect("/blocage");
  return session;
}

/**
 * Garde de l'espace professeur. Le directeur et les autres rôles sont renvoyés
 * vers leur tableau de bord.
 */
export async function exigerProf(): Promise<Session> {
  const session = await getSession();
  if (!session) redirect("/connexion?suivant=/prof");
  if (session.role !== "prof") redirect("/app");
  if (!accesAutorise(session.ecole)) redirect("/blocage");
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
  const attendu = process.env.SUPER_ADMIN_PASSWORD ?? "";
  if (attendu.length < 12 || saisie.length === 0) return false;

  const a = createHash("sha256").update(saisie).digest();
  const b = createHash("sha256").update(attendu).digest();
  return timingSafeEqual(a, b);
}

export async function creerSessionSuperAdmin(): Promise<void> {
  const jeton = await new SignJWT({ typ: "super", email: emailSuperAdmin() } satisfies ChargeSuper)
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime(`${DUREE_SUPER}s`)
    .sign(secret());

  const jar = await cookies();
  jar.set(COOKIE_SUPER, jeton, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: DUREE_SUPER,
  });
}

export async function supprimerSessionSuperAdmin(): Promise<void> {
  const jar = await cookies();
  jar.set(COOKIE_SUPER, "", { httpOnly: true, path: "/", maxAge: 0 });
}

/** Email du super admin connecté, ou null. */
export async function getSuperAdmin(): Promise<string | null> {
  const jar = await cookies();
  const jeton = jar.get(COOKIE_SUPER)?.value;
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
