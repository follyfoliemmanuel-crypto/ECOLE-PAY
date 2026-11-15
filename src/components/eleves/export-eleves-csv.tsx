"use client";

import { Download } from "lucide-react";

export type EleveExportLigne = {
  nom: string;
  prenom: string;
  sexe: string | null;
  classe: string;
  type_inscription: string;
  parent: string;
  telephone: string;
  montant_du: number | null;
  montant_paye: number | null;
  reste: number | null;
  statut: string;
  inscription_du: number | null;
  inscription_paye: number | null;
  inscription_reste: number | null;
  inscription_statut: string;
};

export function ExportElevesCSV({
  eleves,
  periode,
}: {
  eleves: EleveExportLigne[];
  periode: string;
}) {
  function exporter() {
    if (eleves.length === 0) return;

    const entetes =
      "Nom;Prénom;Sexe;Classe;Type;Parent;Téléphone WhatsApp;Scolarité Dû (FCFA);Scolarité Payé (FCFA);Scolarité Reste (FCFA);Statut Scolarité;Inscription Dû (FCFA);Inscription Payé (FCFA);Inscription Reste (FCFA);Statut Inscription\n";

    const lignes = eleves.map((e) =>
      [
        `"${e.nom.replace(/"/g, '""')}"`,
        `"${e.prenom.replace(/"/g, '""')}"`,
        `"${e.sexe ?? ""}"`,
        `"${e.classe.replace(/"/g, '""')}"`,
        `"${e.type_inscription === "ANCIEN" ? "Ancien" : "Nouveau"}"`,
        `"${e.parent.replace(/"/g, '""')}"`,
        `"${e.telephone}"`,
        e.montant_du ?? 0,
        e.montant_paye ?? 0,
        e.reste ?? 0,
        `"${e.statut}"`,
        e.inscription_du ?? 0,
        e.inscription_paye ?? 0,
        e.inscription_reste ?? 0,
        `"${e.inscription_statut}"`,
      ].join(";"),
    );

    const csvContenu = `\uFEFF${entetes}${lignes.join("\n")}`;
    const blob = new Blob([csvContenu], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const lien = document.createElement("a");
    lien.href = url;
    lien.download = `Eleves_ECOLE_PAY_${periode.replace(/\s+/g, "_")}.csv`;
    lien.click();
    URL.revokeObjectURL(url);
  }

  return (
    <button
      type="button"
      onClick={exporter}
      disabled={eleves.length === 0}
      className="inline-flex h-9 items-center gap-1.5 rounded-sm border border-line bg-surface px-3 text-[12px] font-semibold text-ink transition-colors hover:bg-surface-2 disabled:opacity-40"
      title="Télécharger la liste au format Excel / CSV"
    >
      <Download size={13} aria-hidden />
      Export Excel
    </button>
  );
}
