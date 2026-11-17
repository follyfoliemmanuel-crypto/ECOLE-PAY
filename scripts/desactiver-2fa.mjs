/**
 * Procédure de secours : désactive la double authentification du super admin.
 *
 * À utiliser uniquement si le téléphone ET les codes de secours sont perdus.
 * Le mot de passe n'est pas modifié : l'accès redevient possible avec lui seul.
 *
 * Usage :
 *   node scripts/desactiver-2fa.mjs
 *   node scripts/desactiver-2fa.mjs autre-adresse@exemple.tg
 *
 * Le script lit DATABASE_URL et SUPER_ADMIN_EMAIL depuis .env.local.
 */
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { Client } from "pg";

function chargerEnv() {
  for (const fichier of [".env.local", ".env"]) {
    try {
      const contenu = readFileSync(resolve(process.cwd(), fichier), "utf8");
      for (const ligne of contenu.split(/\r?\n/)) {
        const m = ligne.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/i);
        if (!m) continue;
        const valeur = m[2].replace(/^["']|["']$/g, "");
        if (!process.env[m[1]]) process.env[m[1]] = valeur;
      }
      break;
    } catch {
      /* fichier absent : on continue */
    }
  }
}

chargerEnv();

const url = process.env.DATABASE_URL;
if (!url) {
  console.error("❌ DATABASE_URL manquant. Copiez .env.example vers .env.local.");
  process.exit(1);
}

const email = (process.argv[2] ?? process.env.SUPER_ADMIN_EMAIL ?? "")
  .trim()
  .toLowerCase();
if (!email) {
  console.error(
    "❌ Indiquez l'email du super admin en argument ou via SUPER_ADMIN_EMAIL.",
  );
  process.exit(1);
}

const ssl = /sslmode=(require|verify)/.test(url) || /neon\.tech|supabase\.co/.test(url)
  ? { rejectUnauthorized: false }
  : undefined;

const client = new Client({ connectionString: url, ssl });

try {
  await client.connect();
  const resultat = await client.query(
    `update super_admin_2fa
        set actif = false, updated_at = now()
      where email = $1 and actif = true
      returning email`,
    [email],
  );

  if (resultat.rowCount === 0) {
    console.log(
      `ℹ️  Aucune double authentification active pour ${email}. Rien à faire.`,
    );
  } else {
    console.log(`✅ Double authentification désactivée pour ${email}.`);
    console.log(
      "   Reconnectez-vous avec votre mot de passe, puis réactivez la 2FA",
    );
    console.log("   depuis /super-admin/securite et notez les nouveaux codes.");
  }
} catch (erreur) {
  console.error("❌ Échec :", erreur.message);
  process.exitCode = 1;
} finally {
  await client.end();
}
