/**
 * Contrôles de démarrage (Next.js `instrumentation`).
 *
 * Les erreurs de configuration ne bloquent pas le serveur : elles sont écrites
 * dans les logs Vercel pour être vues immédiatement après un déploiement.
 * Le contrôle complet (avec la base) se fait avec `npm run env:check`.
 */
export async function register() {
  if (process.env.NEXT_RUNTIME !== "nodejs") return;

  const manquants = [];
  if (!process.env.DATABASE_URL) manquants.push("DATABASE_URL");
  if (!process.env.AUTH_SECRET) manquants.push("AUTH_SECRET");
  if (!process.env.SUPER_ADMIN_EMAIL) manquants.push("SUPER_ADMIN_EMAIL");
  if (!process.env.SUPER_ADMIN_PASSWORD) manquants.push("SUPER_ADMIN_PASSWORD");
  if (manquants.length > 0) {
    console.error(
      `[SCHOOL PAY] Variables d'environnement manquantes : ${manquants.join(", ")}`,
    );
  }

  const secret = process.env.AUTH_SECRET ?? "";
  if (secret.length > 0 && secret.length < 32) {
    console.error("[SCHOOL PAY] AUTH_SECRET doit contenir au moins 32 caractères.");
  }

  if (
    process.env.NODE_ENV === "production" &&
    process.env.NEXT_PUBLIC_SITE_URL &&
    !process.env.NEXT_PUBLIC_SITE_URL.startsWith("https://")
  ) {
    console.error(
      "[SCHOOL PAY] NEXT_PUBLIC_SITE_URL doit être une URL HTTPS en production.",
    );
  }
}
