import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { uneLigne } from "@/lib/db";
import {
  construirePdfCertificatScolarite,
  construirePdfCertificatTransfert,
  type PdfCertificat,
} from "@/lib/pdf-certificats";
import { slugifier } from "@/lib/portail";
import { estUuid } from "@/lib/actions/helpers";
import { estAnneeScolaire } from "@/lib/annees";

export const runtime = "nodejs";
export const maxDuration = 30;

function aujourdhui(): string {
  const date = new Date();
  const mois = String(date.getMonth() + 1).padStart(2, "0");
  const jour = String(date.getDate()).padStart(2, "0");
  return `${date.getFullYear()}-${mois}-${jour}`;
}

/**
 * Certificat de scolarité ou de transfert d'un élève.
 * `?type=scolarite|transfert` et, facultativement, `&annee=2026-2027`.
 */
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
    return new NextResponse("Élève introuvable.", { status: 404 });
  }

  const url = new URL(request.url);
  const type = url.searchParams.get("type") === "transfert" ? "transfert" : "scolarite";
  const anneeSaisie = url.searchParams.get("annee") ?? "";
  const annee = estAnneeScolaire(anneeSaisie) ? anneeSaisie : null;

  const [ecole, eleve, inscription, directeur] = await Promise.all([
    uneLigne<{ nom: string; adresse: string | null; telephone: string | null }>(
      `select nom, adresse, telephone from ecoles where id = $1`,
      [session.ecoleId],
    ),
    uneLigne<{
      id: string;
      nom: string;
      prenom: string;
      sexe: "M" | "F" | null;
      nom_parent: string;
      statut: string;
      date_sortie: string | null;
      ecole_destination: string | null;
    }>(
      `select id, nom, prenom, sexe, nom_parent, statut,
              date_sortie::text as date_sortie,
              ecole_destination
         from eleves
        where id = $1 and ecole_id = $2`,
      [id, session.ecoleId],
    ),
    uneLigne<{
      annee_scolaire: string;
      classe_nom: string;
      statut: string;
      date_sortie: string | null;
      ecole_destination: string | null;
      moyenne_annuelle: number | null;
    }>(
      `select i.annee_scolaire, c.nom as classe_nom, i.statut,
              coalesce(i.date_sortie, e.date_sortie)::text as date_sortie,
              coalesce(i.ecole_destination, e.ecole_destination) as ecole_destination,
              i.moyenne_annuelle::float8 as moyenne_annuelle
         from inscriptions i
         join eleves e on e.id = i.eleve_id and e.ecole_id = i.ecole_id
         join classes c on c.id = i.classe_id
        where i.eleve_id = $1 and i.ecole_id = $2
          and ($3::text is null or i.annee_scolaire = $3::text)
        order by i.annee_scolaire desc
        limit 1`,
      [id, session.ecoleId, annee],
    ),
    uneLigne<{ nom: string }>(
      `select nom from users
        where ecole_id = $1 and role = 'directeur' and actif = true
        order by date_creation
        limit 1`,
      [session.ecoleId],
    ),
  ]);

  if (!ecole || !eleve) {
    return new NextResponse("Élève introuvable.", { status: 404 });
  }
  if (!inscription) {
    return new NextResponse("Aucune inscription pour cet élève.", {
      status: 404,
    });
  }

  const base: PdfCertificat = {
    ecole,
    eleve: {
      nom: eleve.nom,
      prenom: eleve.prenom,
      sexe: eleve.sexe,
      nom_parent: eleve.nom_parent,
    },
    classe: inscription.classe_nom,
    annee: inscription.annee_scolaire,
    directeur: directeur?.nom ?? null,
    date: aujourdhui(),
    numero: `${type === "transfert" ? "CT" : "CS"}-${inscription.annee_scolaire.replace("-", "/")}-${id.slice(0, 6).toUpperCase()}`,
  };

  let pdf: Uint8Array;
  let fichier: string;

  if (type === "transfert") {
    const destination =
      inscription.ecole_destination ?? eleve.ecole_destination ?? "";
    if (!destination) {
      return new NextResponse(
        "Aucune école de destination enregistrée pour cet élève.",
        { status: 400 },
      );
    }

    pdf = construirePdfCertificatTransfert({
      ...base,
      destination,
      date_sortie: inscription.date_sortie ?? eleve.date_sortie ?? aujourdhui(),
      moyenne_annuelle: inscription.moyenne_annuelle,
    });
    fichier = `certificat-transfert-${slugifier(eleve.nom)}-${slugifier(
      eleve.prenom,
    )}.pdf`;
  } else {
    pdf = construirePdfCertificatScolarite(base);
    fichier = `certificat-scolarite-${slugifier(eleve.nom)}-${slugifier(
      eleve.prenom,
    )}.pdf`;
  }

  return new NextResponse(Buffer.from(pdf), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="${fichier}"`,
      "Cache-Control": "private, no-store",
      "X-Robots-Tag": "noindex, nofollow",
    },
  });
}
