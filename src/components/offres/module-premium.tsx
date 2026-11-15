import Link from "next/link";
import { ArrowRight, CheckCircle2, Sparkles } from "lucide-react";
import type { Offre } from "@/lib/types";
import { EntetePage } from "@/components/app/entete-page";

/** Contenu des modules PREMIUM déjà débloqués par l'offre active. */
export function ModulePremium({
  surtitre,
  titre,
  description,
  offre,
  etapes,
  elements,
}: {
  surtitre: string;
  titre: string;
  description: string;
  offre: Offre;
  etapes: string[];
  elements: string[];
}) {
  return (
    <div>
      <EntetePage surtitre={surtitre} titre={titre} description={description} />

      <div className="mb-5 flex flex-wrap items-center justify-between gap-3 rounded-sm border border-paye/25 bg-paye-soft px-4 py-3">
        <p className="flex items-center gap-2 text-[12.5px] font-medium text-paye">
          <CheckCircle2 size={15} aria-hidden />
          Module débloqué par votre offre {offre}.
        </p>
        <Link
          href="/app/parametres#abonnement"
          className="text-[11.5px] font-semibold text-paye underline underline-offset-2"
        >
          Voir mon abonnement
        </Link>
      </div>

      <div className="grid items-start gap-5 lg:grid-cols-[1.2fr_0.8fr]">
        <section className="card overflow-hidden">
          <div className="border-b border-line px-4 py-3.5 sm:px-5">
            <h2 className="flex items-center gap-2 text-[14px] font-semibold text-ink">
              <Sparkles size={15} className="text-ochre" aria-hidden />
              Mise en route
            </h2>
            <p className="mt-0.5 text-[11.5px] text-muted">
              Ce module est inclus dans votre offre. Voici les étapes de
              configuration.
            </p>
          </div>
          <ol className="divide-y divide-line">
            {etapes.map((etape, index) => (
              <li key={etape} className="flex items-start gap-3 px-4 py-3 sm:px-5">
                <span className="chiffre mt-0.5 grid size-6 shrink-0 place-items-center rounded-full bg-brand-soft text-[10.5px] font-semibold text-brand">
                  {index + 1}
                </span>
                <p className="text-[12.5px] leading-relaxed text-ink-2">{etape}</p>
              </li>
            ))}
          </ol>
          <div className="border-t border-line bg-surface-2 px-4 py-3 text-[11.5px] text-muted sm:px-5">
            Les données saisies restent enregistrées même si vous changez
            d&apos;offre plus tard : un retour à STARTER ou PRO masque seulement
            le module.
          </div>
        </section>

        <aside className="card p-4 sm:p-5">
          <p className="text-[10.5px] font-semibold uppercase tracking-[0.1em] text-muted">
            Inclus dans {offre}
          </p>
          <ul className="mt-3 space-y-2">
            {elements.map((element) => (
              <li
                key={element}
                className="flex items-start gap-2 text-[12px] leading-relaxed text-ink-2"
              >
                <CheckCircle2
                  size={13}
                  className="mt-0.5 shrink-0 text-paye"
                  aria-hidden
                />
                {element}
              </li>
            ))}
          </ul>
          <Link
            href="/app/parametres"
            className="mt-4 inline-flex h-9 w-full items-center justify-center gap-1.5 rounded-sm border border-line-strong bg-surface text-[12px] font-semibold text-ink transition-colors hover:bg-surface-2"
          >
            Configurer mon école
            <ArrowRight size={13} aria-hidden />
          </Link>
        </aside>
      </div>
    </div>
  );
}
