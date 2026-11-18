import { jsPDF } from "jspdf";
import { formatDate } from "./format";

const BLEU_PROFOND: [number, number, number] = [8, 43, 75];
const GRIS: [number, number, number] = [102, 115, 126];
const LIGNE: [number, number, number] = [227, 221, 207];
const OR: [number, number, number] = [196, 162, 65];

export type PdfCertificat = {
  ecole: {
    nom: string;
    adresse: string | null;
    telephone: string | null;
  };
  eleve: {
    nom: string;
    prenom: string;
    sexe: "M" | "F" | null;
    nom_parent: string;
  };
  classe: string;
  annee: string;
  directeur: string | null;
  /** Date de délivrance (AAAA-MM-JJ), par défaut aujourd'hui. */
  date: string;
  numero: string;
};

export type PdfCertificatTransfert = PdfCertificat & {
  destination: string;
  date_sortie: string;
  moyenne_annuelle: number | null;
};

function enToutesLettres(date: string): string {
  return formatDate(new Date(`${date.slice(0, 10)}T12:00:00`));
}

function enTete(doc: jsPDF, certificat: PdfCertificat): number {
  const largeur = doc.internal.pageSize.getWidth();

  doc.setFont("helvetica", "bold");
  doc.setFontSize(9);
  doc.setTextColor(...BLEU_PROFOND);
  doc.text("RÉPUBLIQUE TOGOLAISE", largeur / 2, 22, { align: "center" });
  doc.setFont("helvetica", "normal");
  doc.setFontSize(7.5);
  doc.setTextColor(...GRIS);
  doc.text("Ministère des Enseignements", largeur / 2, 28, {
    align: "center",
  });
  doc.text("Primaire, Secondaire, Technique et Artisanal", largeur / 2, 33, {
    align: "center",
  });

  doc.setDrawColor(...LIGNE);
  doc.line(20, 38, largeur - 20, 38);

  doc.setFont("helvetica", "bold");
  doc.setFontSize(14);
  doc.setTextColor(20, 33, 43);
  doc.text(certificat.ecole.nom, largeur / 2, 48, { align: "center" });

  doc.setFont("helvetica", "normal");
  doc.setFontSize(8);
  doc.setTextColor(...GRIS);
  const coordonnees = [
    certificat.ecole.adresse,
    certificat.ecole.telephone ? `Tél. ${certificat.ecole.telephone}` : null,
  ]
    .filter(Boolean)
    .join(" · ");
  if (coordonnees) doc.text(coordonnees, largeur / 2, 54, { align: "center" });

  return 74;
}

function signature(doc: jsPDF, certificat: PdfCertificat, y: number): void {
  const largeur = doc.internal.pageSize.getWidth();
  const hauteur = doc.internal.pageSize.getHeight();

  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);
  doc.setTextColor(20, 33, 43);
  doc.text(`Fait le ${enToutesLettres(certificat.date)}`, 24, y + 10);

  doc.setFont("helvetica", "bold");
  doc.text("Le Directeur", largeur - 60, y + 10);
  if (certificat.directeur) {
    doc.setFont("helvetica", "normal");
    doc.setFontSize(8.5);
    doc.text(certificat.directeur, largeur - 60, y + 16);
  }
  doc.setDrawColor(...LIGNE);
  doc.line(largeur - 72, y + 32, largeur - 24, y + 32);

  doc.setFont("helvetica", "normal");
  doc.setFontSize(7);
  doc.setTextColor(...GRIS);
  doc.text(
    `Référence ${certificat.numero} · Certificat généré par SCHOOL PAY.`,
    24,
    hauteur - 14,
  );
}

/** Certificat de scolarité d'un élève inscrit dans l'école. */
export function construirePdfCertificatScolarite(
  certificat: PdfCertificat,
): Uint8Array {
  const doc = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });
  const largeur = doc.internal.pageSize.getWidth();
  const hauteur = doc.internal.pageSize.getHeight();

  let y = enTete(doc, certificat);

  doc.setFont("helvetica", "bold");
  doc.setFontSize(20);
  doc.setTextColor(...BLEU_PROFOND);
  doc.text("CERTIFICAT DE SCOLARITÉ", largeur / 2, y, { align: "center" });

  doc.setDrawColor(...OR);
  doc.setLineWidth(0.8);
  doc.line(largeur / 2 - 40, y + 4, largeur / 2 + 40, y + 4);
  doc.setLineWidth(0.2);

  y += 24;
  doc.setFont("helvetica", "normal");
  doc.setFontSize(12);
  doc.setTextColor(20, 33, 43);

  const sexe =
    certificat.eleve.sexe === "F"
      ? "Mademoiselle"
      : certificat.eleve.sexe === "M"
        ? "Monsieur"
        : "L'élève";

  const paragraphes = [
    `Je soussigné(e), Directeur(rice) de l'établissement ${certificat.ecole.nom},`,
    `certifie que ${sexe} ${certificat.eleve.prenom} ${certificat.eleve.nom}`,
    `est régulièrement inscrit(e) en classe de ${certificat.classe}`,
    `pour l'année scolaire ${certificat.annee}.`,
  ];

  for (const ligne of paragraphes) {
    doc.text(ligne, largeur / 2, y, { align: "center" });
    y += 9;
  }

  y += 8;
  doc.setFillColor(250, 248, 242);
  doc.setDrawColor(...LIGNE);
  doc.roundedRect(24, y, largeur - 48, 34, 2, 2, "FD");
  doc.setFontSize(9.5);
  doc.setTextColor(...GRIS);
  doc.text("ÉLÈVE", 30, y + 9);
  doc.text("CLASSE", 110, y + 9);
  doc.text("ANNÉE", 150, y + 9);
  doc.setTextColor(20, 33, 43);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(11);
  doc.text(`${certificat.eleve.prenom} ${certificat.eleve.nom}`, 30, y + 18);
  doc.text(certificat.classe, 110, y + 18);
  doc.text(certificat.annee, 150, y + 18);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(8.5);
  doc.setTextColor(...GRIS);
  doc.text(`Parent / tuteur : ${certificat.eleve.nom_parent}`, 30, y + 27);

  y += 50;
  doc.setFont("helvetica", "normal");
  doc.setFontSize(11);
  doc.setTextColor(20, 33, 43);
  doc.text(
    `Délivré le ${enToutesLettres(certificat.date)} pour servir et valoir ce que de droit.`,
    largeur / 2,
    y,
    { align: "center" },
  );

  signature(doc, certificat, Math.max(y + 24, hauteur - 90));

  return new Uint8Array(doc.output("arraybuffer"));
}

/** Certificat de transfert vers un autre établissement. */
export function construirePdfCertificatTransfert(
  certificat: PdfCertificatTransfert,
): Uint8Array {
  const doc = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });
  const largeur = doc.internal.pageSize.getWidth();
  const hauteur = doc.internal.pageSize.getHeight();

  let y = enTete(doc, certificat);

  doc.setFont("helvetica", "bold");
  doc.setFontSize(20);
  doc.setTextColor(...BLEU_PROFOND);
  doc.text("CERTIFICAT DE TRANSFERT", largeur / 2, y, { align: "center" });

  doc.setDrawColor(...OR);
  doc.setLineWidth(0.8);
  doc.line(largeur / 2 - 40, y + 4, largeur / 2 + 40, y + 4);
  doc.setLineWidth(0.2);

  y += 24;
  doc.setFont("helvetica", "normal");
  doc.setFontSize(12);
  doc.setTextColor(20, 33, 43);

  const moyenne =
    certificat.moyenne_annuelle !== null
      ? ` Sa moyenne annuelle est de ${certificat.moyenne_annuelle.toFixed(2).replace(".", ",")} / 20.`
      : "";

  const paragraphes = [
    `Je soussigné(e), Directeur(rice) de l'établissement ${certificat.ecole.nom},`,
    `certifie que l'élève ${certificat.eleve.prenom} ${certificat.eleve.nom}`,
    `a été régulièrement inscrit(e) en classe de ${certificat.classe}`,
    `au cours de l'année scolaire ${certificat.annee}.`,
    `L'élève quitte l'établissement le ${enToutesLettres(certificat.date_sortie)}`,
    `pour poursuivre sa scolarité à : ${certificat.destination}.${moyenne}`,
  ];

  for (const ligne of paragraphes) {
    const lignes = doc.splitTextToSize(ligne, largeur - 60) as string[];
    for (const texte of lignes) {
      doc.text(texte, largeur / 2, y, { align: "center" });
      y += 8;
    }
  }

  y += 10;
  doc.setFillColor(250, 248, 242);
  doc.setDrawColor(...LIGNE);
  doc.roundedRect(24, y, largeur - 48, 34, 2, 2, "FD");
  doc.setFontSize(9.5);
  doc.setTextColor(...GRIS);
  doc.text("ÉLÈVE", 30, y + 9);
  doc.text("DERNIÈRE CLASSE", 110, y + 9);
  doc.text("ANNÉE", 158, y + 9);
  doc.setTextColor(20, 33, 43);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(11);
  doc.text(`${certificat.eleve.prenom} ${certificat.eleve.nom}`, 30, y + 18);
  doc.text(certificat.classe, 110, y + 18);
  doc.text(certificat.annee, 158, y + 18);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(8.5);
  doc.setTextColor(...GRIS);
  doc.text(`Parent / tuteur : ${certificat.eleve.nom_parent}`, 30, y + 27);

  y += 50;
  doc.setFont("helvetica", "normal");
  doc.setFontSize(11);
  doc.setTextColor(20, 33, 43);
  doc.text(
    `Délivré le ${enToutesLettres(certificat.date)} pour servir et valoir ce que de droit.`,
    largeur / 2,
    y,
    { align: "center" },
  );

  signature(doc, certificat, Math.max(y + 24, hauteur - 90));

  return new Uint8Array(doc.output("arraybuffer"));
}
