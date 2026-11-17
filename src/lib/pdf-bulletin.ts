import { jsPDF } from "jspdf";
import autoTable from "jspdf-autotable";
import { formatDate } from "./format";
import type { LigneBulletin, Trimestre } from "./types";

const BLEU: [number, number, number] = [13, 59, 102];
const BLEU_PROFOND: [number, number, number] = [8, 43, 75];
const GRIS: [number, number, number] = [102, 115, 126];
const LIGNE: [number, number, number] = [227, 221, 207];
const VERT: [number, number, number] = [6, 122, 67];
const ROUGE: [number, number, number] = [193, 18, 31];

export type PdfBulletin = {
  ecole: { nom: string; adresse: string | null; telephone: string | null };
  eleve: { nom: string; prenom: string };
  classe: string;
  annee: string;
  trimestre: Trimestre;
  lignes: LigneBulletin[];
  total_coefficients: number;
  total_points: number;
  moyenne: number | null;
  rang: number | null;
  effectif: number;
  mention: string;
};

function note(valeur: number | null): string {
  if (valeur === null) return "—";
  return valeur.toFixed(2).replace(".", ",");
}

function libelleTrimestre(trimestre: Trimestre): string {
  return ["1er trimestre", "2e trimestre", "3e trimestre"][trimestre - 1] ?? "";
}

function libelleRang(rang: number | null, effectif: number): string {
  if (rang === null) return "Non classé";
  return `${rang === 1 ? "1er" : `${rang}ème`} sur ${effectif} élève${effectif > 1 ? "s" : ""}`;
}

/** Bulletin d'un seul élève, en mémoire, prêt à télécharger ou à envoyer. */
export function construirePdfBulletin(donnees: PdfBulletin): Uint8Array {
  const doc = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });
  const largeur = doc.internal.pageSize.getWidth();
  const hauteur = doc.internal.pageSize.getHeight();

  // Bandeau établissement
  doc.setFillColor(...BLEU_PROFOND);
  doc.rect(0, 0, largeur, 34, "F");

  doc.setTextColor(255, 206, 0);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(8.5);
  doc.text("SCHOOL PAY", 14, 12);

  doc.setTextColor(255, 255, 255);
  doc.setFontSize(15);
  doc.text(donnees.ecole.nom, 14, 21);

  doc.setFont("helvetica", "normal");
  doc.setFontSize(8);
  const coordonnees = [
    donnees.ecole.adresse,
    donnees.ecole.telephone ? `Tél. ${donnees.ecole.telephone}` : null,
  ]
    .filter(Boolean)
    .join(" · ");
  if (coordonnees) doc.text(coordonnees, largeur - 14, 12, { align: "right" });
  doc.text(`Année scolaire ${donnees.annee}`, largeur - 14, 21, {
    align: "right",
  });

  // Titre
  doc.setTextColor(20, 33, 43);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(17);
  doc.text("Bulletin de notes", 14, 46);

  doc.setTextColor(...GRIS);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);
  doc.text(libelleTrimestre(donnees.trimestre), 14, 52);
  doc.text(`Édité le ${formatDate(new Date())}`, largeur - 14, 46, {
    align: "right",
  });

  // Identité de l'élève
  doc.setFillColor(250, 248, 242);
  doc.setDrawColor(...LIGNE);
  doc.roundedRect(14, 58, largeur - 28, 24, 2, 2, "FD");

  doc.setTextColor(...GRIS);
  doc.setFontSize(7.5);
  doc.text("ÉLÈVE", 19, 66);
  doc.text("CLASSE", 108, 66);
  doc.text("EFFECTIF", 148, 66);

  doc.setTextColor(20, 33, 43);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(12);
  doc.text(`${donnees.eleve.prenom} ${donnees.eleve.nom}`, 19, 73);
  doc.setFontSize(10);
  doc.text(donnees.classe, 108, 73);
  doc.text(`${donnees.effectif} élève${donnees.effectif > 1 ? "s" : ""}`, 148, 73);

  // Tableau des matières
  autoTable(doc, {
    startY: 88,
    head: [
      [
        "Matière",
        "Coef.",
        "Devoir 1",
        "Devoir 2",
        "Compo.",
        "Note / 20",
        "Points",
        "Appréciation",
      ],
    ],
    body: donnees.lignes.map((ligne) => [
      ligne.nom,
      String(ligne.coefficient),
      note(ligne.devoir1),
      note(ligne.devoir2),
      note(ligne.composition),
      note(ligne.note),
      note(ligne.points),
      ligne.appreciation?.trim() || "—",
    ]),
    foot: [
      [
        "TOTAL",
        String(donnees.total_coefficients),
        "",
        "",
        "",
        "",
        note(donnees.total_points),
        "",
      ],
    ],
    styles: { font: "helvetica", fontSize: 9, cellPadding: 2.2 },
    headStyles: {
      fillColor: BLEU,
      textColor: [255, 255, 255],
      fontStyle: "bold",
      fontSize: 7,
    },
    footStyles: {
      fillColor: [250, 248, 242],
      textColor: [20, 33, 43],
      fontStyle: "bold",
    },
    alternateRowStyles: { fillColor: [250, 248, 242] },
    columnStyles: {
      0: { cellWidth: 48 },
      1: { halign: "center", cellWidth: 12 },
      2: { halign: "center", cellWidth: 16 },
      3: { halign: "center", cellWidth: 16 },
      4: { halign: "center", cellWidth: 16 },
      5: { halign: "center", fontStyle: "bold", cellWidth: 20 },
      6: { halign: "center", cellWidth: 18 },
      7: { cellWidth: 36 },
    },
    margin: { left: 14, right: 14 },
  });

  const position = (doc as unknown as { lastAutoTable?: { finalY: number } })
    .lastAutoTable?.finalY ?? 150;

  // Synthèse
  const blocs = [
    {
      titre: "MOYENNE GÉNÉRALE",
      valeur: `${note(donnees.moyenne)} / 20`,
      couleur: BLEU,
    },
    {
      titre: "RANG DANS LA CLASSE",
      valeur: libelleRang(donnees.rang, donnees.effectif),
      couleur: [20, 33, 43] as [number, number, number],
    },
    {
      titre: "MENTION",
      valeur: donnees.mention,
      couleur:
        donnees.moyenne !== null && donnees.moyenne >= 10 ? VERT : ROUGE,
    },
  ];

  const largeurBloc = (largeur - 28 - 8) / 3;
  blocs.forEach((bloc, index) => {
    const x = 14 + index * (largeurBloc + 4);
    const y = position + 10;
    doc.setFillColor(255, 255, 255);
    doc.setDrawColor(...LIGNE);
    doc.roundedRect(x, y, largeurBloc, 22, 2, 2, "FD");
    doc.setTextColor(...GRIS);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(6.8);
    doc.text(bloc.titre, x + 4, y + 7);
    doc.setTextColor(...bloc.couleur);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(11);
    doc.text(bloc.valeur, x + 4, y + 16);
  });

  // Signatures
  const bas = Math.max(position + 45, 225);
  doc.setDrawColor(...LIGNE);
  doc.line(14, bas, largeur - 14, bas);

  doc.setTextColor(...GRIS);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(8.5);
  doc.text("Le Directeur", 28, bas + 8);
  doc.text("Le Parent", largeur - 48, bas + 8);
  doc.line(20, bas + 26, 58, bas + 26);
  doc.line(largeur - 56, bas + 26, largeur - 18, bas + 26);

  doc.setFontSize(7);
  doc.setTextColor(...GRIS);
  doc.text(
    "Bulletin généré par SCHOOL PAY. Seules les notes de cet élève figurent sur ce document.",
    14,
    hauteur - 10,
  );

  return new Uint8Array(doc.output("arraybuffer"));
}
