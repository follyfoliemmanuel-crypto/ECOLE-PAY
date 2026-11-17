import { NextResponse, type NextRequest } from "next/server";
import { jwtVerify } from "jose";
import { NOM_COOKIE_SESSION } from "@/lib/cookies";

/**
 * Protection rapide des routes /app.
 * La vérification complète (utilisateur actif, école active) est refaite
 * côté serveur dans chaque page via getSession().
 */
export async function middleware(requete: NextRequest) {
  const jeton = requete.cookies.get(NOM_COOKIE_SESSION)?.value;

  if (!jeton) {
    const url = new URL("/connexion", requete.url);
    url.searchParams.set("suivant", requete.nextUrl.pathname);
    return NextResponse.redirect(url);
  }

  const secret = process.env.AUTH_SECRET;
  if (!secret) return NextResponse.next();

  try {
    await jwtVerify(jeton, new TextEncoder().encode(secret), {
      algorithms: ["HS256"],
    });
    return NextResponse.next();
  } catch {
    const url = new URL("/connexion", requete.url);
    const reponse = NextResponse.redirect(url);
    reponse.cookies.delete(NOM_COOKIE_SESSION);
    return reponse;
  }
}

export const config = {
  matcher: ["/app/:path*", "/prof/:path*"],
};
