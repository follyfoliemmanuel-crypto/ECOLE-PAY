import type { Metadata } from "next";
import Link from "next/link";
import { Archive, ArrowRight } from "lucide-react";
import { exigerSession } from "@/lib/auth";
import { listerAnnees } from "@/lib/data/annees";
import { formatDate } from "@/lib/format";
import { EntetePage } from "@/components/app/entete-page";
import { EmptyState } from "@/components/ui/empty-state";

export const metadata: Metadata = { title: "Archive" };

export default async function PageArchive() {
  const session = await exigerSession();
  const annees = await listerAnnees(session.ecoleId);

  return (
    <>
      <EntetePage
        surtitre="Mémoire de l'école"
        titre="Archive"
        description="Une ligne par année scolaire. Chaque année s'ouvre en lecture seule : élèves, paiements, notes, absences, bulletins et rapport annuel restent consultables."
      />

      {annees.length === 0 ? (
        <div className="card">
          <EmptyState
            icone={<Archive size={18} />}
            titre="Aucune année à archiver"
            description="Les années apparaissent ici au fur et à mesure des inscriptions."
          />
        </div>
      ) : (
        <div className="space-y-2">
          {annees.map((annee) => (
            <Link
              key={annee.id}
              href={`/app/archive/${annee.libelle}`}
              className="card flex flex-wrap items-center justify-between gap-3 px-4 py-3.5 transition-colors hover:border-brand/40 hover:bg-brand-soft/20"
            >
              <div className="flex items-center gap-3">
                <span className="grid size-9 shrink-0 place-items-center rounded-sm border border-line bg-surface-2 text-muted">
                  <Archive size={15} aria-hidden />
                </span>
                <div>
                  <p className="chiffre text-[14px] font-semibold text-ink">
                    {annee.libelle}
                  </p>
                  <p className="mt-0.5 text-[11.5px] text-muted">
                    {formatDate(annee.date_debut)} → {formatDate(annee.date_fin)}
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-5">
                <div className="text-right">
                  <p className="chiffre text-[13px] font-semibold text-ink">
                    {annee.nb_eleves}
                  </p>
                  <p className="text-[10px] uppercase tracking-[0.08em] text-muted">
                    élèves
                  </p>
                </div>
                <span
                  className={
                    annee.statut === "OUVERTE"
                      ? "inline-flex items-center gap-1.5 rounded-full border border-paye/25 bg-paye-soft px-2 py-0.5 text-[10.5px] font-semibold text-paye"
                      : "inline-flex items-center gap-1.5 rounded-full border border-line-strong bg-surface-2 px-2 py-0.5 text-[10.5px] font-semibold text-muted"
                  }
                >
                  {annee.statut === "OUVERTE" ? "En cours" : "Clôturée"}
                </span>
                <ArrowRight size={15} className="text-muted" aria-hidden />
              </div>
            </Link>
          ))}
        </div>
      )}
    </>
  );
}
