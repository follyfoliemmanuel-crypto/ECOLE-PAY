/**
 * Noms et options des cookies de session.
 *
 * En production, le préfixe `__Host-` interdit à un sous-domaine (ou à une
 * page servie depuis un autre hôte) d'écrire ou d'écraser le cookie : le
 * navigateur exige alors `Secure`, `Path=/` et l'absence de `Domain`.
 * En développement (http://localhost), le préfixe est refusé car le cookie
 * n'est pas `Secure` : on garde le nom simple.
 */
const PRODUCTION = process.env.NODE_ENV === "production";

function nom(base: string): string {
  return PRODUCTION ? `__Host-${base}` : base;
}

export const NOM_COOKIE_SESSION = nom("ecolepay_session");
export const NOM_COOKIE_SUPER = nom("ecolepay_super");

/** Options communes à tous les cookies de session. */
export function optionsCookie(maxAge: number) {
  return {
    httpOnly: true,
    sameSite: "lax" as const,
    secure: PRODUCTION,
    path: "/",
    maxAge,
  };
}
