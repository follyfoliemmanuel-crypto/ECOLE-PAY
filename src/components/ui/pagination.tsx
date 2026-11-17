import Link from "next/link";
import { ChevronLeft, ChevronRight } from "lucide-react";

/** Pagination par liens (aucun JavaScript requis). */
export function Pagination({
  page,
  total,
  parPage,
  basePath,
  parametres,
  libelle = "élèves",
}: {
  page: number;
  total: number;
  parPage: number;
  basePath: string;
  parametres: Record<string, string | undefined>;
  /** Nom au pluriel de ce qui est compté (« élèves », « paiements »…). */
  libelle?: string;
}) {
  const pages = Math.max(1, Math.ceil(total / parPage));
  if (pages <= 1) return null;

  function lien(cible: number) {
    const recherche = new URLSearchParams();
    for (const [cle, valeur] of Object.entries(parametres)) {
      if (valeur) recherche.set(cle, valeur);
    }
    recherche.set("page", String(cible));
    return `${basePath}?${recherche.toString()}`;
  }

  return (
    <div className="flex items-center justify-between border-t border-line px-4 py-3 text-[13px] text-muted">
      <span>
        <span className="chiffre text-ink">{total}</span>{" "}
        {total > 1 ? libelle : libelle.replace(/s$/, "")}
      </span>
      <div className="flex items-center gap-1">
        {page > 1 ? (
          <Link
            href={lien(page - 1)}
            className="inline-flex size-8 items-center justify-center rounded-sm border border-line-strong text-ink hover:bg-surface-2"
            aria-label="Page précédente"
          >
            <ChevronLeft size={16} />
          </Link>
        ) : (
          <span className="inline-flex size-8 items-center justify-center rounded-sm border border-line text-line-strong">
            <ChevronLeft size={16} />
          </span>
        )}
        <span className="px-2">
          Page <span className="chiffre text-ink">{page}</span> /{" "}
          <span className="chiffre">{pages}</span>
        </span>
        {page < pages ? (
          <Link
            href={lien(page + 1)}
            className="inline-flex size-8 items-center justify-center rounded-sm border border-line-strong text-ink hover:bg-surface-2"
            aria-label="Page suivante"
          >
            <ChevronRight size={16} />
          </Link>
        ) : (
          <span className="inline-flex size-8 items-center justify-center rounded-sm border border-line text-line-strong">
            <ChevronRight size={16} />
          </span>
        )}
      </div>
    </div>
  );
}
