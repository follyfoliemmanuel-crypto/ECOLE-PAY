import { createHmac, randomBytes, timingSafeEqual } from "node:crypto";

/**
 * TOTP (RFC 6238) : codes à 6 chiffres, pas de 30 secondes, HMAC-SHA1.
 *
 * C'est le format accepté par Google Authenticator, Authy, Microsoft
 * Authenticator, FreeOTP, etc. Aucune dépendance externe : tout est calculé
 * avec `node:crypto`, ce qui évite d'ajouter une bibliothèque pour 30 lignes.
 */

const ALPHABET_BASE32 = "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567";
const PAS_MS = 30_000;
const CHIFFRES = 6;

export function base32Encode(octets: Buffer): string {
  let bits = 0;
  let valeur = 0;
  let sortie = "";

  for (const octet of octets) {
    valeur = (valeur << 8) | octet;
    bits += 8;
    while (bits >= 5) {
      sortie += ALPHABET_BASE32[(valeur >>> (bits - 5)) & 31];
      bits -= 5;
    }
  }
  if (bits > 0) {
    sortie += ALPHABET_BASE32[(valeur << (5 - bits)) & 31];
  }
  return sortie;
}

export function base32Decode(valeur: string): Buffer {
  const propre = valeur.toUpperCase().replace(/[^A-Z2-7]/g, "");
  let bits = 0;
  let tampon = 0;
  const octets: number[] = [];

  for (const caractere of propre) {
    const index = ALPHABET_BASE32.indexOf(caractere);
    if (index === -1) continue;
    tampon = ((tampon << 5) | index) & 0x7fff;
    bits += 5;
    if (bits >= 8) {
      octets.push((tampon >>> (bits - 8)) & 0xff);
      bits -= 8;
    }
  }
  return Buffer.from(octets);
}

/** Secret aléatoire de 160 bits, au format base32 (recommandation RFC 4226). */
export function genererSecretTOTP(): string {
  return base32Encode(randomBytes(20));
}

function compteur(instant: number): number {
  return Math.floor(instant / PAS_MS);
}

/** Code TOTP pour un compteur donné (ou l'instant courant). */
export function codeTOTP(secret: string, instant = Date.now()): string {
  const cle = base32Decode(secret);
  if (cle.length === 0) return "";

  const message = Buffer.alloc(8);
  message.writeBigUInt64BE(BigInt(compteur(instant)));

  const hmac = createHmac("sha1", cle).update(message).digest();
  const decalage = hmac[hmac.length - 1] & 0x0f;
  const binaire =
    ((hmac[decalage] & 0x7f) << 24) |
    ((hmac[decalage + 1] & 0xff) << 16) |
    ((hmac[decalage + 2] & 0xff) << 8) |
    (hmac[decalage + 3] & 0xff);

  return String(binaire % 10 ** CHIFFRES).padStart(CHIFFRES, "0");
}

export type ResultatVerificationTOTP = {
  valide: boolean;
  /** Compteur accepté, pour empêcher la réutilisation du même code. */
  compteurAccepte: number | null;
};

/**
 * Vérifie un code avec une tolérance de ±1 pas (30 s dans chaque sens), pour
 * absorber une petite dérive d'horloge entre le serveur et le téléphone.
 */
export function verifierTOTP(
  secret: string,
  code: string,
  instant = Date.now(),
): ResultatVerificationTOTP {
  const saisie = code.replace(/[\s-]/g, "");
  if (!/^\d{6}$/.test(saisie)) {
    return { valide: false, compteurAccepte: null };
  }

  const base = compteur(instant);
  for (let ecart = -1; ecart <= 1; ecart += 1) {
    const attendu = codeTOTP(secret, (base + ecart) * PAS_MS);
    if (attendu.length !== saisie.length) continue;
    if (
      timingSafeEqual(Buffer.from(attendu, "utf8"), Buffer.from(saisie, "utf8"))
    ) {
      return { valide: true, compteurAccepte: base + ecart };
    }
  }
  return { valide: false, compteurAccepte: null };
}

/** URI `otpauth://` à encoder dans le QR code d'activation. */
export function uriOtpauth(
  secret: string,
  compte: string,
  emetteur = "ECOLE PAY",
): string {
  const label = `${encodeURIComponent(emetteur)}:${encodeURIComponent(compte)}`;
  const parametres = new URLSearchParams({
    secret,
    issuer: emetteur,
    algorithm: "SHA1",
    digits: String(CHIFFRES),
    period: String(PAS_MS / 1000),
  });
  return `otpauth://totp/${label}?${parametres.toString()}`;
}
