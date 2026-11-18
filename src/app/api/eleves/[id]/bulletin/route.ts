import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { uneLigne } from "@/lib/db";
import { donneesBulletin } from "@/lib/data/notes";
import { construirePdfBulletin } from "@/lib/pdf-bulletin";
import { slugifier } from "@/lib/portail";
import { estUuid } from "@/lib/actions/helpers";
import { estAnneeScolaire } from "@/lib/annees";
import type { Trimestre } from "@/lib/types";

export const runtime = "nodejs";
export const maxDuration = 30;

function trimestreValide(valeur: string | null): Trimestre | null {
  const nombre = Number.parseInt(valeur ?? "", 10);
  return nombre === 1 || nombre === 2 || nombre === 3 ? nombre : null;
}

/** Bulletin PDF d'un élève pour une année et un trimestre, y compris archivés. */
export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = await getSession();
  if (!session) {
    return new NextResponse("Session expirée.", { status: 401 });
  }

  const { id } = await params;
  if (!estUuid(id)) {
    return new NextResponse("Bulletin introuvable.", { status: 404 });
  }

  const url = new URL(request.url);
  const anneeSaisie = url.searchParams.get("annee") ?? "";
  const annee = estAnneeScolaire(anneeSaisie) ? anneeSaisie : null;
  const trimestre = trimestreValide(url.searchParams.get("trimestre"));

  const inscription = await uneLigne<{
    eleve_nom: string;
    eleve_prenom: string;
    classe_id: string;
    classe_nom: string;
    annee_scolaire: string;
  }>(
    `select e.nom as eleve_nom, e.prenom as eleve_prenom,
            i.classe_id, c.nom as classe_nom, i.annee_scolaire
       from eleves e
       join inscriptions i
         on i.eleve_id = e.id and i.ecole_id = e.ecole_id
       join classes c on c.id = i.classe_id
      where e.id = $1 and e.ecole_id = $2
        and ($3::text is null or i.annee_scolaire = $3::text)
      order by i.annee_scolaire desc
      limit 1`,
    [id, session.ecoleId, annee],
  );
  if (!inscription) {
    return new NextResponse("Bulletin introuvable.", { status: 404 });
  }

  const trimestreChoisi = trimestre ?? 3;
  const bulletin = await donneesBulletin(
    session.ecoleId,
    inscription.annee_scolaire,
    inscription.classe_id,
    trimestreChoisi,
    true,
  );
  if (!bulletin) {
    return new NextResponse("Bulletin indisponible.", { status: 404 });
  }

  const eleve = bulletin.eleves.find((ligne) => ligne.id === id);
  if (!eleve || eleve.lignes.every((ligne) => ligne.note === null)) {
    return new NextResponse("Aucune note publiée pour ce trimestre.", {
      status: 404,
    });
  }

  const pdf = construirePdfBulletin({
    ecole: bulletin.ecole,
    eleve: { nom: eleve.nom, prenom: eleve.prenom },
    classe: bulletin.classe.nom,
    annee: bulletin.annee,
    trimestre: trimestreChoisi,
    lignes: eleve.lignes,
    total_coefficients: eleve.total_coefficients,
    total_points: eleve.total_points,
    moyenne: eleve.moyenne,
    rang: eleve.rang,
    effectif: bulletin.eleves.length,
    mention: eleve.mention,
  });

  const fichier = `bulletin-${slugifier(eleve.nom)}-${slugifier(
    eleve.prenom,
  )}-${inscription.annee_scolaire}-t${trimestreChoisi}.pdf`;

  return new NextResponse(Buffer.from(pdf), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="${fichier}"`,
      "Cache-Control": "private, no-store",
      "X-Robots-Tag": "noindex, nofollow",
    },
  });
}
