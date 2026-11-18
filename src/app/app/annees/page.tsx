import type { Metadata } from "next";
import Link from "next/link";
import { Archive, ArrowRight, CalendarRange, LockKeyhole, Plus } from "lucide-react";
import { exigerSession } from "@/lib/auth";
import { anneeActive, listerAnnees } from "@/lib/data/annees";
import { formatDate } from "@/lib/format";
import { EntetePage } from "@/components/app/entete-page";
import { EmptyState } from "@/components/ui/empty-state";
import { LienBouton } from "@/components/ui/button";

export const metadata: Metadata = { title: "Années scolaires" };

export default async function PageAnnees() {
  const session = await exigerSession();
  const active = await anneeActive(session.ecoleId);
  const annees = await listerAnnees(session.ecoleId);

  return (
    <>
      <EntetePage
        surtitre="Parcours scolaire"
        titre="Années scolaires"
        description="Une année est ouverte à la fois. La clôture prépare la rentrée suivante et archive l'année écoulée, sans jamais supprimer un élève."
        actions={
          session.role === "directeur" ? (
            <LienBouton href="/app/annees/cloture" variante="principal">
              <LockKeyhole size={15} aria-hidden />
              Clôturer l&apos;année
            </LienBouton>
          ) : undefined
        }
      />

      <div className="mb-5 grid grid-cols-2 divide-x divide-line overflow-hidden rounded-lg border border-line bg-surface sm:grid-cols-3">
        {[
          { libelle: "Année de travail", valeur: active },
          { libelle: "Années suivies", valeur: String(annees.length) },
          {
            libelle: "Archivées",
            valeur: String(annees.filter((a) => a.statut === "CLOTUREE").length),
          },
        ].map((bloc) => (
          <div key={bloc.libelle} className="px-4 py-3.5">
            <p className="text-[9.5px] font-semibold uppercase tracking-[0.11em] text-muted">
              {bloc.libelle}
            </p>
            <p className="chiffre mt-1 text-[15px] font-medium text-ink">
              {bloc.valeur}
            </p>
          </div>
        ))}
      </div>

      {annees.length === 0 ? (
        <div className="card">
          <EmptyState
            icone={<CalendarRange size={18} />}
            titre="Aucune année enregistrée"
            description="L'année scolaire est créée automatiquement dès le premier élève inscrit."
          />
        </div>
      ) : (
        <div className="card overflow-hidden">
          <div className="flex items-center justify-between gap-3 border-b border-line px-4 py-3">
            <h2 className="text-[14px] font-semibold text-ink">
              Historique des années
            </h2>
            <Link
              href="/app/archive"
              className="inline-flex items-center gap-1 text-[11.5px] font-semibold text-brand hover:underline"
            >
              <Archive size={13} aria-hidden />
              Ouvrir l&apos;archive
            </Link>
          </div>

          <div className="overflow-x-auto">
            <table className="tableau min-w-[720px]">
              <thead>
                <tr>
                  <th>Année</th>
                  <th>Période</th>
                  <th className="text-right">Élèves</th>
                  <th className="text-right">Sortis</th>
                  <th>Statut</th>
                  <th>Clôture</th>
                  <th className="text-right">Action</th>
                </tr>
              </thead>
              <tbody>
                {annees.map((annee) => {
                  const ouverte = annee.statut === "OUVERTE";
                  return (
                    <tr key={annee.id}>
                      <td>
                        <span className="chiffre text-[13px] font-semibold text-ink">
                          {annee.libelle}
                        </span>
                        {annee.libelle === active && (
                          <span className="ml-2 rounded-full border border-brand/20 bg-brand-soft px-2 py-0.5 text-[9.5px] font-semibold uppercase tracking-[0.06em] text-brand">
                            En cours
                          </span>
                        )}
                      </td>
                      <td className="text-[11.5px] text-muted">
                        {formatDate(annee.date_debut)} → {formatDate(annee.date_fin)}
                      </td>
                      <td className="chiffre text-right text-[12.5px]">
                        {annee.nb_eleves}
                      </td>
                      <td className="chiffre text-right text-[12.5px] text-muted">
                        {annee.nb_sortis}
                      </td>
                      <td>
                        <span
                          className={
                            ouverte
                              ? "inline-flex items-center gap-1.5 rounded-full border border-paye/25 bg-paye-soft px-2 py-0.5 text-[10.5px] font-semibold text-paye"
                              : "inline-flex items-center gap-1.5 rounded-full border border-line-strong bg-surface-2 px-2 py-0.5 text-[10.5px] font-semibold text-muted"
                          }
                        >
                          <span
                            className={
                              ouverte
                                ? "size-1.5 rounded-full bg-paye"
                                : "size-1.5 rounded-full bg-muted"
                            }
                            aria-hidden
                          />
                          {ouverte ? "Ouverte" : "Clôturée"}
                        </span>
                      </td>
                      <td className="text-[11.5px] text-muted">
                        {annee.cloturee_le ? formatDate(annee.cloturee_le) : "—"}
                      </td>
                      <td className="text-right">
                        <Link
                          href={
                            ouverte
                              ? "/app/annees/cloture"
                              : `/app/archive/${annee.libelle}`
                          }
                          className="inline-flex items-center gap-1 text-[11.5px] font-semibold text-brand hover:underline"
                        >
                          {ouverte ? (
                            <>
                              <Plus size={12} aria-hidden />
                              Clôturer
                            </>
                          ) : (
                            <>
                              <Archive size={12} aria-hidden />
                              Consulter
                            </>
                          )}
                          <ArrowRight size={12} aria-hidden />
                        </Link>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </>
  );
}
