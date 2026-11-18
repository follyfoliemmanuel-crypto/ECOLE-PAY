import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { uneLigne } from "@/lib/db";import { construirePdfRapport } from "@/lib/pdf-rapport";
import { estUuid } from "@/lib/actions/helpers";
import type { ContenuRapport } from "@/lib/data/annees";
import type { StatutRapport } from "@/lib/types";

export const runtime = "nodejs";
export const maxDuration = 30;

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = await getSession();
  if (!session) {
    return new NextResponse("Session expirée.", { status: 401 });
  }

  const { id } = await params;
  if (!estUuid(id)) {
    return new NextResponse("Rapport introuvable.", { status: 404 });
  }

  const rapport = await uneLigne<{
    annee_scolaire: string;
    type: "TRIMESTRIEL" | "ANNUEL";
    trimestre: number;
    statut: StatutRapport;
    contenu: ContenuRapport | null;
  }>(
    `select annee_scolaire, type, trimestre, statut, contenu
       from rapports
      where id = $1 and ecole_id = $2`,
    [id, session.ecoleId],
  );
  if (!rapport) {
    return new NextResponse("Rapport introuvable.", { status: 404 });
  }
  if (rapport.statut !== "PRET" || !rapport.contenu) {
    return new NextResponse("Le rapport est encore en préparation.", {
      status: 409,
      headers: { "Retry-After": "5" },
    });
  }

  const pdf = construirePdfRapport(rapport.contenu);
  const suffixe =
    rapport.type === "ANNUEL" ? "annuel" : `t${rapport.trimestre}`;
  const fichier = `rapport-${suffixe}-${rapport.annee_scolaire}.pdf`;

  return new NextResponse(Buffer.from(pdf), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="${fichier}"`,
      "Cache-Control": "private, no-store",
      "X-Robots-Tag": "noindex, nofollow",
    },
  });
}
