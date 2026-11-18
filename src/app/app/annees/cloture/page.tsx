import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { CalendarCheck2 } from "lucide-react";
import { exigerSession } from "@/lib/auth";
import { anneeActive, apercuCloture } from "@/lib/data/annees";
import { EntetePage } from "@/components/app/entete-page";
import { FormulaireCloture } from "@/components/annees/formulaire-cloture";

export const metadata: Metadata = { title: "Clôturer l'année" };

export default async function PageCloture() {
  const session = await exigerSession();
  if (session.role !== "directeur") {
    return (
      <>
        <EntetePage
          surtitre="Fin d'année"
          titre="Clôture réservée au directeur"
          description="Seul le directeur peut valider les décisions de fin d'année."
        />
        <div className="card px-4 py-5 text-[13px] text-muted">
          Vous pouvez consulter les années et l&apos;archive, mais la clôture
          reste une décision du directeur.
        </div>
      </>
    );
  }

  const annee = await anneeActive(session.ecoleId);
  const apercu = await apercuCloture(session.ecoleId, annee);
  if (apercu.statut === "ABSENTE") notFound();

  return (
    <>
      <EntetePage
        surtitre="Fin d'année"
        titre={`Clôturer ${annee}`}
        description="Vérifiez les décisions proposées. Les classes d'examen attendent votre décision manuelle ; les classes normales utilisent la moyenne annuelle (10/20)."
      />

      <div className="mb-5 flex items-start gap-3 rounded-sm border border-ochre/25 bg-surface-2 px-4 py-3">
        <CalendarCheck2 size={17} className="mt-0.5 shrink-0 text-ochre" aria-hidden />
        <div className="text-[12.5px] leading-relaxed text-ink-2">
          <p className="font-semibold text-ink">À faire pendant les vacances</p>
          <p className="mt-0.5 text-muted">
            Après la clôture, l&apos;école travaille sur {apercu.annee_suivante}.
            Les notes nationales (CEPD, BEPC, BAC) ne sont pas saisies ici :
            vous choisissez simplement « admis » ou « échoué ».
          </p>
        </div>
      </div>

      {apercu.statut === "CLOTUREE" ? (
        <div className="card px-4 py-5 text-[13px] text-muted">
          L&apos;année {annee} est déjà clôturée. Consultez-la dans l&apos;archive.
        </div>
      ) : (
        <FormulaireCloture apercu={apercu} />
      )}
    </>
  );
}
