import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { accesAutorise } from "@/lib/activation";
import { anneeActive } from "@/lib/data/annees";
import { getElevePaiement } from "@/lib/data/eleves";
import {
  ENTETES_PRIVES,
  messageValidation,
  schemaUuid,
} from "@/lib/validation";

export const dynamic = "force-dynamic";

/** Charge un élève et ses 10 mois au moment où la secrétaire le sélectionne. */
export async function GET(
  _requete: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json(
      { error: "Non autorisé" },
      { status: 401, headers: ENTETES_PRIVES },
    );
  }
  if (!accesAutorise(session.ecole)) {
    return NextResponse.json(
      { error: "Compte bloqué" },
      { status: 403, headers: ENTETES_PRIVES },
    );
  }

  const brut = await params;
  const valide = schemaUuid.safeParse(brut.id);
  if (!valide.success) {
    return NextResponse.json(
      { error: messageValidation(valide.error) },
      { status: 400, headers: ENTETES_PRIVES },
    );
  }
  const id = valide.data;

  const eleve = await getElevePaiement(session.ecoleId, id, await anneeActive(session.ecoleId));
  if (!eleve) {
    return NextResponse.json(
      { error: "Élève introuvable" },
      { status: 404, headers: ENTETES_PRIVES },
    );
  }

  return NextResponse.json({ eleve }, { headers: ENTETES_PRIVES });
}
