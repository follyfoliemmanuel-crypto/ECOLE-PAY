/**
 * Applique db/schema.sql sur la base pointée par DATABASE_URL.
 * Usage : npm run db:push
 */
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { Client } from "pg";

// Chargement minimal de .env.local (sans dépendance supplémentaire).
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

const schema = readFileSync(resolve(process.cwd(), "db/schema.sql"), "utf8");
const ssl = /sslmode=(require|verify)/.test(url) || /neon\.tech|supabase\.co/.test(url)
  ? { rejectUnauthorized: false }
  : undefined;

const client = new Client({ connectionString: url, ssl });

try {
  await client.connect();
  console.log("→ Application du schéma…");
  await client.query(schema);
  console.log("✅ Schéma SCHOOL PAY appliqué.");
} catch (erreur) {
  console.error("❌ Échec :", erreur.message);
  process.exitCode = 1;
} finally {
  await client.end();
}
