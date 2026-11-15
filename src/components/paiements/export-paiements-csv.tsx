"use client";

import { Download } from "lucide-react";

export type PaiementExportLigne = {
  date: string;
  numero_recu: string;
  eleve: string;
  classe: string;
  nature: string;
  echeance: string;
  mode: string;
  montant: number;
  reste_apres: number;
  enregistre_par: string;
  statut: string;
};

export function ExportPaiementsCSV({
  paiements,
  periode,
}: {
  paiements: PaiementExportLigne[];
  periode: string;
}) {
  function exporter() {
    if (paiements.length === 0) return;

    const entetes =
      "Date;N° Reçu;Élève;Classe;Nature;Période;Mode de Paiement;Montant Encaissé (FCFA);Reste Après (FCFA);Enregistré Par;Statut\n";

    const lignes = paiements.map((p) =>
      [
        `"${p.date}"`,
        `"${p.numero_recu}"`,
        `"${p.eleve.replace(/"/g, '""')}"`,
        `"${p.classe.replace(/"/g, '""')}"`,
        `"${p.nature}"`,
        `"${p.echeance}"`,
        `"${p.mode}"`,
        p.montant,
        p.reste_apres,
        `"${p.enregistre_par.replace(/"/g, '""')}"`,
        `"${p.statut}"`,
      ].join(";"),
    );

    const csvContenu = `\uFEFF${entetes}${lignes.join("\n")}`;
    const blob = new Blob([csvContenu], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const lien = document.createElement("a");
    lien.href = url;
    lien.download = `Encaissements_ECOLE_PAY_${periode.replace(/\s+/g, "_")}.csv`;
    lien.click();
    URL.revokeObjectURL(url);
  }

  return (
    <button
      type="button"
      onClick={exporter}
      disabled={paiements.length === 0}
      className="inline-flex h-9 items-center gap-1.5 rounded-sm border border-line bg-surface px-3 text-[12px] font-semibold text-ink transition-colors hover:bg-surface-2 disabled:opacity-40"
      title="Télécharger les encaissements au format Excel / CSV"
    >
      <Download size={13} aria-hidden />
      Export Excel
    </button>
  );
}
