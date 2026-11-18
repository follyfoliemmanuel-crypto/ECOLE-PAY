import type { Metadata } from "next";
import { Download, FileText } from "lucide-react";
import { exigerSession } from "@/lib/auth";
import { anneeActive, listerAnnees, listerRapports } from "@/lib/data/annees";
import { formatDateHeure } from "@/lib/format";
import { EntetePage } from "@/components/app/entete-page";
import { EmptyState } from "@/components/ui/empty-state";
import { FormulaireRapport } from "@/components/rapports/formulaire-rapport";
import { RafraichirRapports } from "@/components/rapports/rafraichir-rapports";

export const metadata: Metadata = { title: "Rapports" };

const LIBELLES_STATUT: Record<string, string> = {
  EN_ATTENTE: "En file d'attente",
  EN_COURS: "En préparation",
  PRET: "Prêt",
  ECHEC: "Échec",
};

export default async function PageRapports() {
  const session = await exigerSession();
  const [active, annees, rapports] = await Promise.all([
    anneeActive(session.ecoleId),
    listerAnnees(session.ecoleId),
    listerRapports(session.ecoleId),
  ]);

  const enAttente = rapports.some(
    (rapport) => rapport.statut === "EN_ATTENTE" || rapport.statut === "EN_COURS",
  );

  return (
    <>
      <EntetePage
        surtitre="Pilotage"
        titre="Rapports"
        description="Rapports trimestriels et annuels dans tous les plans. La génération se fait en file d'attente : vous pouvez quitter la page, le rapport sera prêt au téléchargement."
      />

      <section className="card mb-5 p-4 sm:p-5">
        <h2 className="mb-3 text-[14px] font-semibold text-ink">
          Nouveau rapport
        </h2>
        <FormulaireRapport
          annees={annees.map((annee) => annee.libelle)}
          anneeActive={active}
        />
      </section>

      <section className="card overflow-hidden">
        <div className="flex items-center gap-2 border-b border-line px-4 py-3">
          <FileText size={15} className="text-muted" aria-hidden />
          <h2 className="text-[14px] font-semibold text-ink">
            Rapports générés
          </h2>
          {enAttente && <RafraichirRapports />}
        </div>

        {rapports.length === 0 ? (
          <EmptyState
            icone={<FileText size={18} />}
            titre="Aucun rapport pour le moment"
            description="Générez un rapport trimestriel pour suivre les moyennes, la réussite et les paiements, ou le rapport annuel pour préparer la clôture."
          />
        ) : (
          <div className="overflow-x-auto">
            <table className="tableau min-w-[640px]">
              <thead>
                <tr>
                  <th>Rapport</th>
                  <th>Année</th>
                  <th>Statut</th>
                  <th>Demandé le</th>
                  <th className="text-right">Action</th>
                </tr>
              </thead>
              <tbody>
                {rapports.map((rapport) => (
                  <tr key={rapport.id}>
                    <td className="text-[12.5px] font-medium text-ink">
                      {rapport.type === "ANNUEL"
                        ? "Rapport annuel"
                        : `Rapport ${rapport.trimestre}${rapport.trimestre === 1 ? "er" : "e"} trimestre`}
                    </td>
                    <td className="chiffre text-[12px] text-ink-2">
                      {rapport.annee_scolaire}
                    </td>
                    <td>
                      <span
                        className={
                          rapport.statut === "PRET"
                            ? "inline-flex items-center gap-1.5 rounded-full border border-paye/25 bg-paye-soft px-2 py-0.5 text-[10.5px] font-semibold text-paye"
                            : rapport.statut === "ECHEC"
                              ? "inline-flex items-center gap-1.5 rounded-full border border-impaye/25 bg-impaye-soft px-2 py-0.5 text-[10.5px] font-semibold text-impaye"
                              : "inline-flex items-center gap-1.5 rounded-full border border-partiel/25 bg-partiel-soft px-2 py-0.5 text-[10.5px] font-semibold text-partiel"
                        }
                      >
                        {LIBELLES_STATUT[rapport.statut] ?? rapport.statut}
                      </span>
                      {rapport.statut === "ECHEC" && rapport.erreur && (
                        <p className="mt-0.5 max-w-[220px] text-[10px] text-muted">
                          {rapport.erreur}
                        </p>
                      )}
                    </td>
                    <td className="text-[11px] text-muted">
                      {formatDateHeure(rapport.date_creation)}
                    </td>
                    <td className="text-right">
                      {rapport.statut === "PRET" ? (
                        <a
                          href={`/api/rapports/${rapport.id}`}
                          className="inline-flex items-center gap-1 text-[11.5px] font-semibold text-brand hover:underline"
                        >
                          <Download size={12} aria-hidden />
                          Télécharger le PDF
                        </a>
                      ) : (
                        <span className="text-[11px] text-muted">—</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </>
  );
}
