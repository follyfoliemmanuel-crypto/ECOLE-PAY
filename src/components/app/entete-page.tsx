import type { ReactNode } from "react";
import { cx } from "@/lib/cx";

/** En-tête commun aux pages de l'application. */
export function EntetePage({
  surtitre,
  titre,
  description,
  actions,
  className,
}: {
  surtitre?: string;
  titre: string;
  description?: string;
  actions?: ReactNode;
  className?: string;
}) {
  return (
    <div className={cx("mb-6 flex flex-wrap items-start justify-between gap-4", className)}>
      <div className="min-w-0">
        {surtitre && (
          <p className="text-[10.5px] font-semibold uppercase tracking-[0.14em] text-ochre">
            {surtitre}
          </p>
        )}
        <h1 className="mt-1 text-[24px] font-semibold leading-tight tracking-[-0.035em] text-ink sm:text-[27px]">
          {titre}
        </h1>
        {description && (
          <p className="mt-1.5 max-w-xl text-[13px] leading-relaxed text-muted">
            {description}
          </p>
        )}
      </div>
      {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
    </div>
  );
}
