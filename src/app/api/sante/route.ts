import { NextResponse } from "next/server";
import { uneLigne } from "@/lib/db";

/**
 * Sonde de santé utilisée après un déploiement (Vercel) et par une supervision
 * externe. Aucune donnée métier ni secret n'est exposé.
 */
export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET() {
  const entetes = { "Cache-Control": "no-store" };
  try {
    await uneLigne("select 1 as ok");
    return NextResponse.json({ statut: "ok", base: "ok" }, { headers: entetes });
  } catch {
    return NextResponse.json(
      { statut: "degrade", base: "indisponible" },
      { status: 503, headers: entetes },
    );
  }
}
