import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { anneeActive } from "@/lib/data/annees";
import { rechercherEleves } from "@/lib/data/eleves";
import { consommerLimite, infosRequete } from "@/lib/securite";
import {
  ENTETES_PRIVES,
  messageValidation,
  schemaRecherche,
} from "@/lib/validation";

export const dynamic = "force-dynamic";

/** Recherche d'élèves pour l'écran d'encaissement (limité à 8 résultats). */
export async function GET(requete: Request) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json(
      { error: "Non autorisé" },
      { status: 401, headers: ENTETES_PRIVES },
    );
  }

  // Une école en lecture seule garde la consultation : la recherche d'élèves
  // reste donc autorisée, seules les écritures sont refusées.

  // Chaque frappe de la secrétaire déclenche une requête : la limite reste
  // large, mais elle coupe un balayage automatisé de l'annuaire.
  const { ip } = await infosRequete();
  if (!(await consommerLimite(`api:eleves:${session.userId}:${ip}`, 300, 60))) {
    return NextResponse.json(
      { error: "Trop de recherches. Patientez un instant." },
      { status: 429, headers: ENTETES_PRIVES },
    );
  }

  const url = new URL(requete.url);
  const valide = schemaRecherche.safeParse({
    q: url.searchParams.get("q") ?? undefined,
  });
  if (!valide.success) {
    return NextResponse.json(
      { error: messageValidation(valide.error) },
      { status: 400, headers: ENTETES_PRIVES },
    );
  }

  const recherche = valide.data.q;
  if (recherche.length < 2) {
    return NextResponse.json({ eleves: [] }, { headers: ENTETES_PRIVES });
  }

  const eleves = await rechercherEleves(
    session.ecoleId,
    await anneeActive(session.ecoleId),
    recherche,
  );
  return NextResponse.json({ eleves }, { headers: ENTETES_PRIVES });
}
