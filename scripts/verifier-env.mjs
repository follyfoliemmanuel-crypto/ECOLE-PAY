/**
 * Vérifie la configuration avant un déploiement (Vercel ou serveur classique).
 *
 * Usage :
 *   npm run env:check
 *
 * Sur Vercel, lancez-la dans un terminal avec les variables de production
 * exportées, ou ajoutez-la à un job de pré-déploiement. Le script ne se connecte
 * pas à la base et n'affiche jamais les valeurs secrètes.
 */
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

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
      return fichier;
    } catch {
      /* fichier absent : on continue avec l'environnement courant */
    }
  }
  return null;
}

const source = chargerEnv();
const production =
  process.env.VERCEL_ENV === "production" ||
  process.env.NODE_ENV === "production";

const erreurs = [];
const avertissements = [];

const valeur = (nom) => (process.env[nom] ?? "").trim();

function exiger(nom, condition, message) {
  if (!condition) erreurs.push(`${nom} : ${message}`);
}

const base = valeur("DATABASE_URL");
exiger("DATABASE_URL", base !== "", "variable absente.");
if (base) {
  let url;
  try {
    url = new URL(base);
  } catch {
    erreurs.push("DATABASE_URL : format d'URL invalide.");
  }
  if (url) {
    const local = ["127.0.0.1", "localhost"].includes(url.hostname);
    if (production && local) {
      erreurs.push("DATABASE_URL : adresse locale en production.");
    }
    if (production && !local && !/sslmode=require/.test(base)) {
      erreurs.push(
        "DATABASE_URL : ajoutez ?sslmode=require (Neon refuse le sans-TLS).",
      );
    }
    if (production && /neon\.tech/.test(url.hostname) && !url.hostname.includes("-pooler")) {
      avertissements.push(
        "DATABASE_URL : utilisez la connexion « Pooled » de Neon pour les fonctions serverless.",
      );
    }
  }
}

const secret = valeur("AUTH_SECRET");
exiger("AUTH_SECRET", secret.length >= 32, "32 caractères minimum.");
if (/changez-moi|change-moi/i.test(secret)) {
  erreurs.push("AUTH_SECRET : valeur d'exemple encore présente.");
}

const emailAdmin = valeur("SUPER_ADMIN_EMAIL").toLowerCase();
exiger("SUPER_ADMIN_EMAIL", /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(emailAdmin), "email invalide.");

const motDePasseAdmin = valeur("SUPER_ADMIN_PASSWORD");
exiger(
  "SUPER_ADMIN_PASSWORD",
  motDePasseAdmin.length >= 12,
  "12 caractères minimum.",
);
if (/choisissez|exemple|motdepasse/i.test(motDePasseAdmin)) {
  erreurs.push("SUPER_ADMIN_PASSWORD : valeur d'exemple encore présente.");
}

const site = valeur("NEXT_PUBLIC_SITE_URL");
if (production) {
  exiger(
    "NEXT_PUBLIC_SITE_URL",
    site.startsWith("https://"),
    "URL HTTPS publique obligatoire en production.",
  );
  if (/localhost|127\.0\.0\.1/.test(site)) {
    erreurs.push("NEXT_PUBLIC_SITE_URL : adresse locale en production.");
  }
} else if (!site) {
  avertissements.push(
    "NEXT_PUBLIC_SITE_URL absent : le portail utilisera https://schoolpay.tg.",
  );
}

const emailFrom = valeur("EMAIL_FROM");
const resend = valeur("RESEND_API_KEY");
if (resend && !emailFrom) {
  avertissements.push(
    "RESEND_API_KEY défini sans EMAIL_FROM : expéditeur par défaut utilisé.",
  );
}
if (resend && /onboarding@resend\.dev/.test(emailFrom)) {
  avertissements.push(
    "EMAIL_FROM utilise le sandbox Resend : envoi limité à l'adresse du compte.",
  );
}

const whatsapp = ["WHATSAPP_TOKEN", "WHATSAPP_PHONE_ID"].map(valeur);
if (whatsapp.some(Boolean) && !whatsapp.every(Boolean)) {
  erreurs.push(
    "WHATSAPP_TOKEN et WHATSAPP_PHONE_ID doivent être définis ensemble (ou aucun des deux).",
  );
}

const cronSecret = valeur("CRON_SECRET");
if (production && cronSecret.length < 32) {
  erreurs.push(
    "CRON_SECRET : 32 caractères minimum (worker /api/taches et cron Vercel).",
  );
}
if (whatsapp.every(Boolean) && !cronSecret) {
  avertissements.push(
    "CRON_SECRET absent : les bulletins WhatsApp seront mis en file mais le worker ne pourra pas être déclenché par le cron.",
  );
}

console.log(
  `Vérification de l'environnement (${production ? "production" : "développement"}${source ? `, ${source}` : ""})`,
);
for (const avertissement of avertissements) console.log(`⚠️  ${avertissement}`);
for (const erreur of erreurs) console.error(`❌ ${erreur}`);

if (erreurs.length === 0) {
  console.log("✅ Configuration valide.");
  process.exit(0);
}
console.error(
  `\n${erreurs.length} erreur(s) à corriger avant le déploiement.`,
);
process.exit(1);
