import { randomBytes } from "node:crypto";
import bcrypt from "bcryptjs";
import { sql, uneLigne } from "./db";
import { genererSecretTOTP, verifierTOTP } from "./totp";

/**
 * Double authentification du super admin, stockée en base (et non en variable
 * d'environnement) pour pouvoir l'activer depuis l'application.
 *
 * Le secret TOTP est en clair dans la base : c'est nécessaire pour calculer
 * les codes. La base doit donc être protégée (rôle applicatif à privilèges
 * réduits, sauvegardes chiffrées). Les codes de secours, eux, sont hachés.
 */

export type EtatDeuxFacteurs = {
  actif: boolean;
  activeLe: string | null;
  codesRestants: number;
};

type LigneDeuxFacteurs = {
  secret: string;
  actif: boolean;
  codes_secours: unknown;
  dernier_compteur: string | number;
};

function codesDepuisJson(valeur: unknown): string[] {
  return Array.isArray(valeur)
    ? valeur.filter((element): element is string => typeof element === "string")
    : [];
}

export async function etatDeuxFacteurs(
  email: string,
): Promise<EtatDeuxFacteurs> {
  const ligne = await uneLigne<{
    actif: boolean;
    active_le: string | null;
    codes: number;
  }>(
    `select actif,
            to_char(active_le, 'YYYY-MM-DD"T"HH24:MI:SS"Z"') as active_le,
            jsonb_array_length(codes_secours) as codes
       from super_admin_2fa
      where email = $1`,
    [email.toLowerCase()],
  );

  if (!ligne || !ligne.actif) {
    return { actif: false, activeLe: null, codesRestants: 0 };
  }
  return {
    actif: true,
    activeLe: ligne.active_le,
    codesRestants: Number(ligne.codes ?? 0),
  };
}

/** Secret actif, ou null si la 2FA n'est pas activée. */
export async function secretDeuxFacteurs(
  email: string,
): Promise<string | null> {
  const ligne = await uneLigne<{ secret: string }>(
    `select secret from super_admin_2fa where email = $1 and actif = true`,
    [email.toLowerCase()],
  );
  return ligne?.secret ?? null;
}

/** Codes de secours lisibles : 10 caractères hexadécimaux, groupés par 5. */
export function genererCodesSecours(nombre = 8): string[] {
  return Array.from({ length: nombre }, () => {
    const brut = randomBytes(5).toString("hex").toUpperCase();
    return `${brut.slice(0, 5)}-${brut.slice(5)}`;
  });
}

async function hacherCodes(codes: string[]): Promise<string[]> {
  return Promise.all(
    codes.map((code) => bcrypt.hash(code.replace(/[\s-]/g, ""), 10)),
  );
}

/** Active la 2FA : le secret a déjà été vérifié par un premier code. */
export async function activerDeuxFacteurs(
  email: string,
  secret: string,
  codesSecours: string[],
): Promise<void> {
  const hashes = await hacherCodes(codesSecours);
  await sql(
    `insert into super_admin_2fa
       (email, secret, actif, codes_secours, dernier_compteur, active_le, updated_at)
     values ($1, $2, true, $3::jsonb, 0, now(), now())
     on conflict (email) do update
       set secret = excluded.secret,
           actif = true,
           codes_secours = excluded.codes_secours,
           dernier_compteur = 0,
           active_le = now(),
           updated_at = now()`,
    [email.toLowerCase(), secret, JSON.stringify(hashes)],
  );
}

export async function desactiverDeuxFacteurs(email: string): Promise<void> {
  await sql(
    `update super_admin_2fa
        set actif = false, updated_at = now()
      where email = $1`,
    [email.toLowerCase()],
  );
}

/** Remplace les codes de secours ; renvoie les nouveaux codes en clair. */
export async function regenererCodesSecours(
  email: string,
  nombre = 8,
): Promise<string[]> {
  const codes = genererCodesSecours(nombre);
  const hashes = await hacherCodes(codes);
  await sql(
    `update super_admin_2fa
        set codes_secours = $2::jsonb, updated_at = now()
      where email = $1 and actif = true`,
    [email.toLowerCase(), JSON.stringify(hashes)],
  );
  return codes;
}

/**
 * Vérifie un code TOTP ou un code de secours.
 *
 * Un code TOTP déjà utilisé est refusé (protection contre le rejeu), même
 * s'il reste dans la fenêtre de 30 secondes. Un code de secours est consommé
 * dès qu'il sert.
 */
export async function verifierDeuxiemeFacteur(
  email: string,
  code: string,
): Promise<boolean> {
  const ligne = await uneLigne<LigneDeuxFacteurs>(
    `select secret, actif, codes_secours, dernier_compteur
       from super_admin_2fa
      where email = $1`,
    [email.toLowerCase()],
  );
  if (!ligne?.actif) return false;

  const saisie = code.replace(/[\s-]/g, "").toUpperCase();
  if (saisie.length === 0) return false;

  if (/^\d{6}$/.test(saisie)) {
    const resultat = verifierTOTP(ligne.secret, saisie);
    if (resultat.valide && resultat.compteurAccepte !== null) {
      // Rejeu : le même pas de 30 s ne peut pas servir deux fois.
      if (resultat.compteurAccepte <= Number(ligne.dernier_compteur)) {
        return false;
      }
      await sql(
        `update super_admin_2fa
            set dernier_compteur = $2, updated_at = now()
          where email = $1`,
        [email.toLowerCase(), resultat.compteurAccepte],
      );
      return true;
    }
  }

  const codes = codesDepuisJson(ligne.codes_secours);
  for (let index = 0; index < codes.length; index += 1) {
    if (await bcrypt.compare(saisie, codes[index])) {
      const restants = codes.filter((_, position) => position !== index);
      await sql(
        `update super_admin_2fa
            set codes_secours = $2::jsonb, updated_at = now()
          where email = $1`,
        [email.toLowerCase(), JSON.stringify(restants)],
      );
      return true;
    }
  }

  return false;
}

/** Secret prêt à être affiché dans le QR code d'activation. */
export function nouveauSecret(): string {
  return genererSecretTOTP();
}
