import { NextResponse } from "next/server";
import { anneeScolaire } from "@/lib/mois";
import { MESSAGE_PREMIUM, peut } from "@/lib/offres";
import {
  ecolePublique,
  ficheBulletin,
  getElevePublique,
  trimestresNotes,
} from "@/lib/data/portail";
import { construirePdfBulletin } from "@/lib/pdf-bulletin";
import { slugifier } from "@/lib/portail";
import { estUuid } from "@/lib/actions/helpers";
import { slugValide } from "@/lib/validation";
import type { Trimestre } from "@/lib/types";

// Génération PDF : runtime Node obligatoire (pdfkit) et marge de temps pour
// les fonctions serverless de Vercel.
export const runtime = "nodejs";
export const maxDuration = 30;

function trimestreValide(valeur: string | null): Trimestre | null {
  const nombre = Number.parseInt(valeur ?? "", 10);
  return nombre === 1 || nombre === 2 || nombre === 3 ? nombre : null;
}

export async function GET(
  request: Request,
  {
    params,
  }: {
    params: Promise<{ slug: string; id: string }>;
  },
) {
  const { slug, id } = await params;
  if (!slugValide(slug) || !estUuid(id)) {
    return new NextResponse("Bulletin introuvable.", { status: 404 });
  }

  const ecole = await ecolePublique(slug);
  if (!ecole) {
    return new NextResponse("École introuvable.", { status: 404 });
  }
  if (!peut({ offre: ecole.offre, statut: ecole.statut }, "portail_parent")) {
    return new NextResponse(MESSAGE_PREMIUM, { status: 403 });
  }

  const annee = anneeScolaire();
  const eleve = await getElevePublique(ecole.id, id, annee);
  if (!eleve) {
    return new NextResponse("Bulletin introuvable.", { status: 404 });
  }

  const url = new URL(request.url);
  const disponibles = await trimestresNotes(ecole.id, eleve.id, annee);
  const trimestre =
    trimestreValide(url.searchParams.get("trimestre")) ??
    disponibles[disponibles.length - 1] ??
    1;

  const fiche = await ficheBulletin(
    ecole.id,
    annee,
    eleve.classe_id,
    eleve.id,
    trimestre,
  );

  if (!fiche || fiche.matieres_notees === 0) {
    return new NextResponse("Aucune note publiée pour ce trimestre.", {
      status: 404,
    });
  }

  const pdf = construirePdfBulletin({
    ecole: {
      nom: fiche.ecole.nom,
      adresse: fiche.ecole.adresse,
      telephone: fiche.ecole.telephone,
    },
    eleve: { nom: fiche.eleve.nom, prenom: fiche.eleve.prenom },
    classe: fiche.classe_nom,
    annee: fiche.annee,
    trimestre: fiche.trimestre,
    lignes: fiche.eleve.lignes,
    total_coefficients: fiche.eleve.total_coefficients,
    total_points: fiche.eleve.total_points,
    moyenne: fiche.eleve.moyenne,
    rang: fiche.eleve.rang,
    effectif: fiche.effectif,
    mention: fiche.eleve.mention,
  });

  const fichier = `bulletin-${slugifier(fiche.eleve.nom)}-${slugifier(
    fiche.eleve.prenom,
  )}-t${trimestre}.pdf`;

  return new NextResponse(Buffer.from(pdf), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="${fichier}"`,
      "Cache-Control": "private, max-age=300",
      "X-Robots-Tag": "noindex, nofollow",
    },
  });
}
