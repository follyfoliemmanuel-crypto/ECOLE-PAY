import { createHash, timingSafeEqual } from "node:crypto";
import { NextResponse, after } from "next/server";
import { TACHES_PAR_PASSAGE, traiterTaches } from "@/lib/worker-taches";

/**
 * Worker de la file d'attente.
 *
 * Déclenché par le cron Vercel (`vercel.json`) ou manuellement :
 *
 *   curl -H "Authorization: Bearer $CRON_SECRET" https://…/api/taches
 *
 * Il exécute les tâches en attente (envoi WhatsApp des bulletins) puis purge
 * les tables techniques. Aucune requête utilisateur n'attend ce traitement.
 */
export const dynamic = "force-dynamic";
export const runtime = "nodejs";
export const maxDuration = 60;

function memeSecret(fourni: string, attendu: string): boolean {
  const a = createHash("sha256").update(fourni).digest();
  const b = createHash("sha256").update(attendu).digest();
  return timingSafeEqual(a, b);
}

function autorise(requete: Request): boolean {
  const secret = process.env.CRON_SECRET?.trim();
  if (!secret) return false;

  const entete = requete.headers.get("authorization") ?? "";
  const porteur = entete.replace(/^Bearer\s+/i, "").trim();
  const parametre = new URL(requete.url).searchParams.get("secret")?.trim() ?? "";
  const fourni = porteur || parametre;

  return fourni.length > 0 && memeSecret(fourni, secret);
}

async function executer(requete: Request) {
  const entetes = { "Cache-Control": "no-store" };

  if (!autorise(requete)) {
    return NextResponse.json(
      { erreur: "Non autorisé." },
      { status: 401, headers: entetes },
    );
  }

  const url = new URL(requete.url);
  const profondeur =
    Math.max(0, Number.parseInt(url.searchParams.get("profondeur") ?? "0", 10) || 0);

  try {
    const resultat = await traiterTaches({ purge: profondeur === 0 });

    // S'il reste du travail, on relance un passage : indispensable sur Hobby où
    // le cron n'est autorisé qu'une fois par jour.
    if (resultat.traitees >= TACHES_PAR_PASSAGE && profondeur < 5) {
      const secret = process.env.CRON_SECRET?.trim();
      if (secret) {
        const suivant = new URL(url);
        suivant.searchParams.set("profondeur", String(profondeur + 1));
        suivant.searchParams.delete("secret");
        after(async () => {
          try {
            await fetch(suivant, {
              headers: { authorization: `Bearer ${secret}` },
              cache: "no-store",
            });
          } catch {
            /* le prochain cron reprendra le reste */
          }
        });
      }
    }

    return NextResponse.json({ statut: "ok", ...resultat }, { headers: entetes });
  } catch (erreur) {
    console.error("Worker taches :", {
      message: erreur instanceof Error ? erreur.message : "inconnue",
    });
    return NextResponse.json(
      { statut: "erreur" },
      { status: 500, headers: entetes },
    );
  }
}

export async function GET(requete: Request) {
  return executer(requete);
}

export async function POST(requete: Request) {
  return executer(requete);
}
