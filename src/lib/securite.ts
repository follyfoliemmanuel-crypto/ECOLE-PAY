import { createHmac, timingSafeEqual } from "node:crypto";
import { headers } from "next/headers";
import { sql, uneLigne } from "./db";

/**
 * Sécurité serveur : anti-triche des essais gratuits, anti-brute-force,
 * captcha simple, rate limiting et identification de la requête.
 *
 * Toutes les décisions (blocage, refus d'essai, captcha) sont prises côté
 * serveur. Le navigateur ne fait qu'afficher le résultat.
 */

export const MESSAGE_ESSAI_REFUSE =
  "Vous avez déjà bénéficié de votre essai gratuit de 30 jours pour cette école, veuillez payer 15.000F par mois pour STARTER, 25.000F pour STANDARD ou 35.000F pour PREMIUM au +228 70309744 ou contactez follyfoliemmanuel@gmail.com.";

export const MESSAGE_CONNEXION = "Email ou mot de passe incorrect.";

/** 24 h d'inactivité : au-delà, la session est considérée comme expirée. */
export const INACTIVITE_MAX_MS = 24 * 60 * 60 * 1000;
/** On rafraîchit la dernière activité au maximum toutes les 5 minutes. */
export const RAFRAICHISSEMENT_ACTIVITE_MS = 5 * 60 * 1000;

// ---------------------------------------------------------------------------
//  Requête : IP et appareil
// ---------------------------------------------------------------------------
export async function infosRequete(): Promise<{ ip: string; appareil: string }> {
  const entetes = await headers();

  const transmise = entetes.get("x-forwarded-for")?.split(",")[0]?.trim();
  let ip =
    transmise ||
    entetes.get("x-real-ip") ||
    entetes.get("cf-connecting-ip") ||
    "inconnue";

  // IPv6 mappée sur IPv4 et longueur bornée (colonne texte, pas de confiance).
  ip = ip.replace(/^::ffff:/, "").slice(0, 64);

  const appareil = (entetes.get("user-agent") ?? "inconnu").slice(0, 255);
  return { ip, appareil };
}

// ---------------------------------------------------------------------------
//  Normalisation d'un nom d'école
// ---------------------------------------------------------------------------
/**
 * Minuscules, accents retirés, espaces et ponctuation supprimés.
 * Doit rester aligné avec la fonction SQL `normaliser_nom_ecole`.
 */
export function normaliserNomEcole(nom: string): string {
  return nom
    .replace(/œ/gi, "oe")
    .replace(/æ/gi, "ae")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]/g, "");
}

// ---------------------------------------------------------------------------
//  Rate limiting générique (stocké en base, multi-instance)
// ---------------------------------------------------------------------------
/**
 * Consomme une unité de la limite. Retourne false si le quota est dépassé.
 * Fenêtre fixe : la clé inclut l'action, l'identité (IP ou email) et la durée.
 */
export async function consommerLimite(
  cle: string,
  maximum: number,
  fenetreSecondes: number,
): Promise<boolean> {
  const ligne = await uneLigne<{ compteur: number }>(
    `insert into rate_limits (cle, fenetre, compteur)
     values (
       $1,
       to_timestamp(floor(extract(epoch from now()) / $2::numeric) * $2::numeric),
       1
     )
     on conflict (cle, fenetre)
     do update set compteur = rate_limits.compteur + 1
     returning compteur`,
    [cle, fenetreSecondes],
  );

  // Nettoyage opportuniste (1 appel sur 20) pour éviter l'accumulation.
  if (Math.random() < 0.05) {
    await sql(`delete from rate_limits where fenetre < now() - interval '1 day'`);
  }

  return (ligne?.compteur ?? 1) <= maximum;
}

// ---------------------------------------------------------------------------
//  Tentatives de connexion et blocage progressif
// ---------------------------------------------------------------------------
export type EtatLimiteConnexion = {
  echecs: number;
  bloqueJusqua: Date | null;
  exigerCaptcha: boolean;
};

/** Blocage court après 5 échecs. */
const DUREE_BLOCAGE_5_MS = 5 * 60 * 1000;
/** Blocage maximum après 10 échecs (volontairement borné à 10 minutes). */
const DUREE_BLOCAGE_10_MS = 10 * 60 * 1000;

function finDeBlocage(echecs: number, dernier: string | null): Date | null {
  if (!dernier || echecs < 5) return null;

  // 5 échecs → 5 minutes ; 10 échecs → 10 minutes.
  const duree = echecs >= 10 ? DUREE_BLOCAGE_10_MS : DUREE_BLOCAGE_5_MS;
  const fin = new Date(dernier).getTime() + duree;
  return fin > Date.now() ? new Date(fin) : null;
}

/**
 * Compte les échecs :
 *  - par email : depuis la dernière connexion réussie (max 24 h) ;
 *  - par IP : sur la dernière heure.
 *
 * Le compteur inclut les tentatives refusées pendant un blocage, afin que
 * 5 échecs puis 10 échecs fassent bien passer de 5 à 10 minutes. En revanche,
 * la fin du blocage est ancrée sur la dernière tentative *non bloquée* :
 * marteler pendant le blocage ne repousse pas indéfiniment la peine.
 */
export async function etatLimiteConnexion(
  email: string,
  ip: string,
): Promise<EtatLimiteConnexion> {
  const ligne = await uneLigne<{
    echecs_email: number;
    dernier_email: string | null;
    echecs_ip: number;
    dernier_ip: string | null;
  }>(
    `select
       (select count(*)::int
          from login_attempts
         where succes = false and email = $1
           and date_creation > now() - interval '24 hours'
           and date_creation > coalesce(
             (select max(date_creation)
                from login_attempts
               where email = $1 and succes = true),
             'epoch'::timestamptz
           )) as echecs_email,
       (select max(date_creation)::text
          from login_attempts
         where succes = false and bloque = false and email = $1
           and date_creation > now() - interval '24 hours'
           and date_creation > coalesce(
             (select max(date_creation)
                from login_attempts
               where email = $1 and succes = true),
             'epoch'::timestamptz
           )) as dernier_email,
       (select count(*)::int
          from login_attempts
         where succes = false and ip = $2
           and date_creation > now() - interval '1 hour') as echecs_ip,
       (select max(date_creation)::text
          from login_attempts
         where succes = false and bloque = false and ip = $2
           and date_creation > now() - interval '1 hour') as dernier_ip`,
    [email, ip],
  );

  const echecsEmail = ligne?.echecs_email ?? 0;
  const echecsIp = ligne?.echecs_ip ?? 0;
  const echecs = Math.max(echecsEmail, echecsIp);

  const blocs = [
    finDeBlocage(echecsEmail, ligne?.dernier_email ?? null),
    finDeBlocage(echecsIp, ligne?.dernier_ip ?? null),
  ].filter((date): date is Date => date !== null);

  const bloqueJusqua =
    blocs.length > 0
      ? new Date(Math.max(...blocs.map((date) => date.getTime())))
      : null;

  return {
    echecs,
    bloqueJusqua,
    exigerCaptcha: echecs >= 3,
  };
}

export function messageBlocage(bloqueJusqua: Date): string {
  const minutes = Math.max(
    1,
    Math.ceil((bloqueJusqua.getTime() - Date.now()) / 60_000),
  );
  return `Trop de tentatives. Réessayez dans ${minutes} minute${minutes > 1 ? "s" : ""}.`;
}

export async function enregistrerTentativeConnexion(params: {
  email: string;
  ip: string;
  appareil: string;
  succes: boolean;
  bloque?: boolean;
}): Promise<void> {
  await sql(
    `insert into login_attempts (email, ip, appareil, succes, bloque)
     values ($1, $2, $3, $4, $5)`,
    [
      params.email,
      params.ip,
      params.appareil,
      params.succes,
      params.bloque ?? false,
    ],
  );
}

// ---------------------------------------------------------------------------
//  Captcha arithmétique simple (signé, sans état en base)
// ---------------------------------------------------------------------------
type ChargeCaptcha = { a: number; b: number; exp: number };

function signerCaptcha(charge: string): string {
  // Pas de secret de repli : un captcha signé avec une valeur connue serait
  // forgeable. On échoue explicitement si la configuration manque.
  const secret = process.env.AUTH_SECRET;
  if (!secret || secret.length < 32) {
    throw new Error(
      "AUTH_SECRET doit contenir au moins 32 caractères pour signer le captcha. Voir .env.example.",
    );
  }
  return createHmac("sha256", secret).update(charge).digest("base64url");
}

export type Captcha = { question: string; token: string };

export function creerCaptcha(): Captcha {
  const a = 1 + Math.floor(Math.random() * 9);
  const b = 1 + Math.floor(Math.random() * 9);
  const charge: ChargeCaptcha = { a, b, exp: Date.now() + 10 * 60 * 1000 };
  const encode = Buffer.from(JSON.stringify(charge)).toString("base64url");

  return {
    question: `Combien font ${a} + ${b} ?`,
    token: `${encode}.${signerCaptcha(encode)}`,
  };
}

export function verifierCaptcha(token: string, reponse: string): boolean {
  const [charge, signature] = token.split(".");
  if (!charge || !signature) return false;

  const attendu = signerCaptcha(charge);
  if (signature.length !== attendu.length) return false;
  if (
    !timingSafeEqual(Buffer.from(signature, "utf8"), Buffer.from(attendu, "utf8"))
  ) {
    return false;
  }

  try {
    const donnees = JSON.parse(
      Buffer.from(charge, "base64url").toString("utf8"),
    ) as ChargeCaptcha;
    if (!Number.isFinite(donnees.exp) || Date.now() > donnees.exp) return false;
    return Number.parseInt(reponse.trim(), 10) === donnees.a + donnees.b;
  } catch {
    return false;
  }
}

// ---------------------------------------------------------------------------
//  Registre des essais gratuits
// ---------------------------------------------------------------------------
export type EssaiExistant = {
  id: string;
  nom_ecole: string;
  nom_normalise: string;
  telephone: string | null;
  telephone_normalise: string | null;
  whatsapp: string | null;
  whatsapp_normalise: string | null;
  email: string;
  date_creation: string;
};

/** Cherche un essai actif avec le même nom, le même téléphone ou le même WhatsApp. */
export async function trouverEssaiExistant(params: {
  nomNormalise: string;
  telephoneNormalise: string | null;
  whatsappNormalise: string | null;
}): Promise<EssaiExistant | null> {
  return uneLigne<EssaiExistant>(
    `select id, nom_ecole, nom_normalise, telephone, telephone_normalise,
            whatsapp, whatsapp_normalise, email,
            to_char(date_creation, 'YYYY-MM-DD"T"HH24:MI:SS"Z"') as date_creation
       from essais_utilises
      where actif = true
        and (
          nom_normalise = $1
          or ($2::text is not null and telephone_normalise = $2::text)
          or ($3::text is not null and whatsapp_normalise = $3::text)
        )
      limit 1`,
    [
      params.nomNormalise,
      params.telephoneNormalise,
      params.whatsappNormalise,
    ],
  );
}

export async function journaliserRefusEssai(params: {
  nomEcole: string;
  nomNormalise: string;
  telephone: string | null;
  telephoneNormalise: string | null;
  whatsapp: string | null;
  whatsappNormalise: string | null;
  email: string;
  ip: string;
  appareil: string;
  motif: string;
  essaiId?: string | null;
}): Promise<void> {
  await sql(
    `insert into inscriptions_audit
       (type, nom_ecole, nom_normalise, telephone, telephone_normalise,
        whatsapp, whatsapp_normalise, email, ip, appareil, motif, essai_id)
     values ('REFUS', $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)`,
    [
      params.nomEcole,
      params.nomNormalise,
      params.telephone,
      params.telephoneNormalise,
      params.whatsapp,
      params.whatsappNormalise,
      params.email,
      params.ip,
      params.appareil,
      params.motif,
      params.essaiId ?? null,
    ],
  );
}
