import { jsPDF } from "jspdf";
import autoTable from "jspdf-autotable";
import { formatDate } from "./format";

/** Données minimales nécessaires aux exports PDF. */
export type PdfEcole = {
  nom: string;
  adresse?: string | null;
  telephone?: string | null;
};

export type PdfResume = {
  eleves: number;
  payes: number;
  partiels: number;
  impayes: number;
  attendu: number;
  encaisse: number;
  restant: number;
};

export type PdfClasse = {
  nom: string;
  nb_eleves: number;
  payes: number;
  partiels: number;
  impayes: number;
  attendu: number;
  encaisse: number;
  restant: number;
};

export type PdfImpaye = {
  nom: string;
  prenom: string;
  classe: string;
  parent: string;
  telephone: string;
  montant_du: number;
  montant_paye: number;
  reste: number;
  statut: string;
};

const BLEU: [number, number, number] = [13, 59, 102];
const GRIS: [number, number, number] = [102, 115, 126];
const LIGNE: [number, number, number] = [227, 221, 207];

function nombre(valeur: number): string {
  return Math.round(valeur)
    .toLocaleString("fr-FR")
    .replace(/[\u00a0\u202f]/g, " ");
}

function enTete(
  doc: jsPDF,
  ecole: PdfEcole,
  titre: string,
  sousTitre: string,
): number {
  const largeur = doc.internal.pageSize.getWidth();

  doc.setFillColor(...BLEU);
  doc.rect(0, 0, largeur, 30, "F");

  doc.setTextColor(255, 255, 255);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(9);
  doc.text("SCHOOL PAY", 14, 12);
  doc.setFontSize(15);
  doc.text(ecole.nom, 14, 21);

  doc.setFont("helvetica", "normal");
  doc.setFontSize(8);
  const coordonnees = [ecole.adresse, ecole.telephone ? `Tél. ${ecole.telephone}` : null]
    .filter(Boolean)
    .join(" · ");
  if (coordonnees) doc.text(coordonnees, largeur - 14, 12, { align: "right" });

  doc.setTextColor(20, 33, 43);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(16);
  doc.text(titre, 14, 43);

  doc.setTextColor(...GRIS);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);
  doc.text(sousTitre, 14, 49);
  doc.text(`Édité le ${formatDate(new Date())}`, largeur - 14, 43, {
    align: "right",
  });

  doc.setDrawColor(...LIGNE);
  doc.setLineWidth(0.3);
  doc.line(14, 53, largeur - 14, 53);

  return 60;
}

function piedDePage(doc: jsPDF) {
  const pages = doc.getNumberOfPages();
  const largeur = doc.internal.pageSize.getWidth();
  const hauteur = doc.internal.pageSize.getHeight();

  for (let page = 1; page <= pages; page += 1) {
    doc.setPage(page);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(7.5);
    doc.setTextColor(...GRIS);
    doc.text(
      "Document généré par SCHOOL PAY — à conserver avec les justificatifs de caisse.",
      14,
      hauteur - 10,
    );
    doc.text(`Page ${page} / ${pages}`, largeur - 14, hauteur - 10, {
      align: "right",
    });
  }
}

function nomFichier(prefixe: string): string {
  return `${prefixe}-${new Date().toISOString().slice(0, 10)}.pdf`;
}

// ---------------------------------------------------------------------------
//  Export 1 : liste des impayés de la période
// ---------------------------------------------------------------------------
export function exporterImpayesPdf({
  ecole,
  periode,
  annee,
  impayes,
  resume,
}: {
  ecole: PdfEcole;
  periode: string;
  annee: string;
  impayes: PdfImpaye[];
  resume: PdfResume;
}) {
  const doc = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });
  const debut = enTete(
    doc,
    ecole,
    "Impayés de la période",
    `${periode} · Année scolaire ${annee}`,
  );

  doc.setFontSize(9);
  doc.setTextColor(20, 33, 43);
  doc.text(
    `${impayes.length} élève${impayes.length > 1 ? "s" : ""} · Total à recouvrer : ${nombre(
      resume.restant,
    )} FCFA`,
    14,
    debut,
  );

  autoTable(doc, {
    startY: debut + 4,
    head: [["Classe", "Élève", "Parent", "Téléphone", "Dû", "Payé", "Reste"]],
    body: impayes.map((ligne) => [
      ligne.classe,
      `${ligne.prenom} ${ligne.nom}`,
      ligne.parent,
      ligne.telephone,
      `${nombre(ligne.montant_du)} F`,
      `${nombre(ligne.montant_paye)} F`,
      `${nombre(ligne.reste)} F`,
    ]),
    foot: [
      [
        { content: "TOTAL", colSpan: 4 },
        "",
        "",
        "",
        `${nombre(impayes.reduce((s, l) => s + l.reste, 0))} F`,
      ],
    ],
    styles: { font: "helvetica", fontSize: 8, cellPadding: 2 },
    headStyles: {
      fillColor: BLEU,
      textColor: [255, 255, 255],
      fontStyle: "bold",
      fontSize: 7.5,
    },
    footStyles: { fillColor: [250, 248, 242], textColor: [20, 33, 43], fontStyle: "bold" },
    alternateRowStyles: { fillColor: [250, 248, 242] },
    columnStyles: {
      4: { halign: "right" },
      5: { halign: "right" },
      6: { halign: "right", fontStyle: "bold" },
    },
    margin: { left: 14, right: 14 },
  });

  piedDePage(doc);
  doc.save(nomFichier(`impayes-${periode.toLowerCase()}`));
}

// ---------------------------------------------------------------------------
//  Export 2 : bilan de la période (par classe)
// ---------------------------------------------------------------------------
export function exporterBilanPdf({
  ecole,
  periode,
  annee,
  classes,
  resume,
}: {
  ecole: PdfEcole;
  periode: string;
  annee: string;
  classes: PdfClasse[];
  resume: PdfResume;
}) {
  const doc = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });
  const debut = enTete(
    doc,
    ecole,
    "Bilan de la période",
    `${periode} · Année scolaire ${annee}`,
  );

  // Trois indicateurs clés
  const largeur = doc.internal.pageSize.getWidth();
  const blocs = [
    { titre: "Encaissé", valeur: `${nombre(resume.encaisse)} FCFA`, couleur: [6, 122, 67] },
    { titre: "Restant", valeur: `${nombre(resume.restant)} FCFA`, couleur: [193, 18, 31] },
    {
      titre: "Taux de paiement",
      valeur: `${
        resume.eleves ? Math.round((resume.payes / resume.eleves) * 100) : 0
      } %`,
      couleur: BLEU,
    },
  ];

  blocs.forEach((bloc, index) => {
    const x = 14 + index * ((largeur - 28) / 3);
    const largeurBloc = (largeur - 28) / 3 - 3;
    doc.setFillColor(250, 248, 242);
    doc.setDrawColor(...LIGNE);
    doc.roundedRect(x, debut, largeurBloc, 22, 1.5, 1.5, "FD");
    doc.setTextColor(...GRIS);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(7.5);
    doc.text(bloc.titre.toUpperCase(), x + 4, debut + 7);
    doc.setTextColor(...(bloc.couleur as [number, number, number]));
    doc.setFont("helvetica", "bold");
    doc.setFontSize(11);
    doc.text(bloc.valeur, x + 4, debut + 16);
  });

  doc.setTextColor(20, 33, 43);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(8.5);
  doc.text(
    `${resume.eleves} élèves · ${resume.payes} à jour · ${resume.partiels} partiels · ${resume.impayes} non payés`,
    14,
    debut + 30,
  );

  autoTable(doc, {
    startY: debut + 35,
    head: [
      ["Classe", "Élèves", "À jour", "Partiels", "Impayés", "Attendu", "Encaissé", "Restant"],
    ],
    body: classes.map((classe) => [
      classe.nom,
      String(classe.nb_eleves),
      String(classe.payes),
      String(classe.partiels),
      String(classe.impayes),
      `${nombre(classe.attendu)} F`,
      `${nombre(classe.encaisse)} F`,
      `${nombre(classe.restant)} F`,
    ]),
    foot: [
      [
        "TOTAL",
        String(resume.eleves),
        String(resume.payes),
        String(resume.partiels),
        String(resume.impayes),
        `${nombre(resume.attendu)} F`,
        `${nombre(resume.encaisse)} F`,
        `${nombre(resume.restant)} F`,
      ],
    ],
    styles: { font: "helvetica", fontSize: 8, cellPadding: 2 },
    headStyles: {
      fillColor: BLEU,
      textColor: [255, 255, 255],
      fontStyle: "bold",
      fontSize: 7,
    },
    footStyles: { fillColor: [250, 248, 242], textColor: [20, 33, 43], fontStyle: "bold" },
    alternateRowStyles: { fillColor: [250, 248, 242] },
    columnStyles: {
      1: { halign: "center" },
      2: { halign: "center" },
      3: { halign: "center" },
      4: { halign: "center" },
      5: { halign: "right" },
      6: { halign: "right" },
      7: { halign: "right" },
    },
    margin: { left: 14, right: 14 },
  });

  piedDePage(doc);
  doc.save(nomFichier(`bilan-${periode.toLowerCase()}`));
}
