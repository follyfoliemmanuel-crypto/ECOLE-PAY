import { jsPDF } from "jspdf";
import autoTable from "jspdf-autotable";
import { formatDate, formatFCFA } from "./format";
import type { ContenuRapport } from "./data/annees";

const BLEU: [number, number, number] = [13, 59, 102];
const BLEU_PROFOND: [number, number, number] = [8, 43, 75];
const GRIS: [number, number, number] = [102, 115, 126];
const LIGNE: [number, number, number] = [227, 221, 207];
const VERT: [number, number, number] = [6, 122, 67];
const ROUGE: [number, number, number] = [193, 18, 31];

function note(valeur: number | null): string {
  if (valeur === null) return "—";
  return valeur.toFixed(2).replace(".", ",");
}

function pourcent(valeur: number | null): string {
  if (valeur === null) return "—";
  return `${valeur} %`;
}

function titreRapport(contenu: ContenuRapport): string {
  return contenu.type === "ANNUEL" ? "Rapport annuel" : "Rapport trimestriel";
}

/** Rapport trimestriel ou annuel d'une école, en mémoire, prêt à télécharger. */
export function construirePdfRapport(contenu: ContenuRapport): Uint8Array {
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
  doc.text(contenu.ecole.nom, 14, 21);

  doc.setFont("helvetica", "normal");
  doc.setFontSize(8);
  const coordonnees = [
    contenu.ecole.adresse,
    contenu.ecole.telephone ? `Tél. ${contenu.ecole.telephone}` : null,
  ]
    .filter(Boolean)
    .join(" · ");
  if (coordonnees) doc.text(coordonnees, largeur - 14, 12, { align: "right" });
  doc.text(`Année scolaire ${contenu.annee}`, largeur - 14, 21, {
    align: "right",
  });

  // Titre
  doc.setTextColor(20, 33, 43);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(17);
  doc.text(titreRapport(contenu), 14, 46);

  doc.setTextColor(...GRIS);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);
  doc.text(contenu.libelle_periode, 14, 52);
  doc.text(
    `Généré le ${formatDate(new Date(contenu.genere_le))}`,
    largeur - 14,
    46,
    { align: "right" },
  );

  // Indicateurs principaux
  const blocs: Array<{ titre: string; valeur: string; couleur: [number, number, number] }> = [
    { titre: "ÉLÈVES", valeur: String(contenu.resume.eleves), couleur: BLEU },
    { titre: "CLASSES", valeur: String(contenu.resume.classes), couleur: BLEU },
    {
      titre: "MOYENNE GÉNÉRALE",
      valeur: `${note(contenu.resume.moyenne)} / 20`,
      couleur:
        contenu.resume.moyenne !== null && contenu.resume.moyenne >= 10
          ? VERT
          : ROUGE,
    },
    {
      titre: "TAUX DE RÉUSSITE",
      valeur: pourcent(contenu.resume.taux_reussite),
      couleur:
        contenu.resume.taux_reussite !== null &&
        contenu.resume.taux_reussite >= 50
          ? VERT
          : ROUGE,
    },
  ];

  const largeurBloc = (largeur - 28 - 12) / 4;
  blocs.forEach((bloc, index) => {
    const x = 14 + index * (largeurBloc + 4);
    const y = 60;
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

  // Finances
  doc.setTextColor(20, 33, 43);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(11);
  doc.text("Bilan financier", 14, 96);

  doc.setTextColor(...GRIS);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);
  doc.text(
    `Attendu : ${formatFCFA(contenu.resume.attendu)}     Encaissé : ${formatFCFA(contenu.resume.encaisse)}     Impayé : ${formatFCFA(contenu.resume.impaye)}`,
    14,
    103,
  );
  doc.text(`Absences enregistrées : ${contenu.resume.absences}`, 14, 109);

  // Détail par classe
  autoTable(doc, {
    startY: 116,
    head: [
      [
        "Classe",
        "Élèves",
        "Moyenne",
        "Réussite",
        "Attendu",
        "Encaissé",
        "Impayé",
        "Absences",
      ],
    ],
    body: contenu.classes.map((classe) => [
      classe.nom,
      String(classe.effectif),
      note(classe.moyenne),
      pourcent(classe.taux_reussite),
      formatFCFA(classe.attendu),
      formatFCFA(classe.encaisse),
      formatFCFA(classe.impaye),
      String(classe.absences),
    ]),
    styles: { font: "helvetica", fontSize: 8, cellPadding: 2 },
    headStyles: {
      fillColor: BLEU,
      textColor: [255, 255, 255],
      fontStyle: "bold",
      fontSize: 6.8,
    },
    alternateRowStyles: { fillColor: [250, 248, 242] },
    columnStyles: {
      0: { cellWidth: 30 },
      1: { halign: "center", cellWidth: 14 },
      2: { halign: "center", cellWidth: 17 },
      3: { halign: "center", cellWidth: 18 },
      4: { halign: "right", cellWidth: 26 },
      5: { halign: "right", cellWidth: 26 },
      6: { halign: "right", cellWidth: 24 },
      7: { halign: "center", cellWidth: 18 },
    },
    margin: { left: 14, right: 14 },
  });

  let position =
    (doc as unknown as { lastAutoTable?: { finalY: number } }).lastAutoTable
      ?.finalY ?? 150;

  // Bilan par trimestre (rapport annuel)
  if (contenu.type === "ANNUEL" && contenu.trimestres?.length) {
    position += 12;
    if (position > hauteur - 70) {
      doc.addPage();
      position = 24;
    }

    doc.setTextColor(20, 33, 43);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(11);
    doc.text("Les trois trimestres", 14, position);

    autoTable(doc, {
      startY: position + 6,
      head: [["Trimestre", "Moyenne", "Réussite", "Encaissé", "Absences"]],
      body: contenu.trimestres.map((ligne) => [
        ["1er trimestre", "2e trimestre", "3e trimestre"][ligne.trimestre - 1] ??
          `Trimestre ${ligne.trimestre}`,
        note(ligne.moyenne),
        pourcent(ligne.taux_reussite),
        formatFCFA(ligne.encaisse),
        String(ligne.absences),
      ]),
      styles: { font: "helvetica", fontSize: 8.5, cellPadding: 2 },
      headStyles: {
        fillColor: BLEU,
        textColor: [255, 255, 255],
        fontStyle: "bold",
        fontSize: 7,
      },
      alternateRowStyles: { fillColor: [250, 248, 242] },
      columnStyles: {
        0: { cellWidth: 42 },
        1: { halign: "center" },
        2: { halign: "center" },
        3: { halign: "right" },
        4: { halign: "center" },
      },
      margin: { left: 14, right: 14 },
    });

    position =
      (doc as unknown as { lastAutoTable?: { finalY: number } }).lastAutoTable
        ?.finalY ?? position;
  }

  // Décisions de fin d'année
  if (contenu.type === "ANNUEL" && contenu.decisions) {
    position += 12;
    if (position > hauteur - 50) {
      doc.addPage();
      position = 24;
    }

    doc.setTextColor(20, 33, 43);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(11);
    doc.text("Décisions de fin d'année", 14, position);

    doc.setTextColor(...GRIS);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(9);
    doc.text(
      `Promus : ${contenu.decisions.promus}     Redoublants : ${contenu.decisions.redoublants}     Diplômés : ${contenu.decisions.diplomes}     Transférés : ${contenu.decisions.transferes}`,
      14,
      position + 7,
    );
    position += 12;
  }

  // Pied de page
  doc.setDrawColor(...LIGNE);
  doc.line(14, hauteur - 18, largeur - 14, hauteur - 18);
  doc.setFontSize(7);
  doc.setTextColor(...GRIS);
  doc.text(
    "Rapport généré par SCHOOL PAY. Données consolidées de l'école, sans information individuelle de paiement.",
    14,
    hauteur - 12,
  );

  return new Uint8Array(doc.output("arraybuffer"));
}
