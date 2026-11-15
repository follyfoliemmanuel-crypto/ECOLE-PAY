import type { ReactNode } from "react";
import { cx } from "@/lib/cx";

export function EmptyState({
  icone,
  titre,
  description,
  action,
  className,
}: {
  icone?: ReactNode;
  titre: string;
  description: string;
  action?: ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cx(
        "flex flex-col items-center justify-center px-6 py-14 text-center",
        className,
      )}
    >
      {icone && (
        <div className="mb-4 grid size-11 place-items-center rounded-full border border-line bg-surface-2 text-muted">
          {icone}
        </div>
      )}
      <p className="text-[15px] font-semibold text-ink">{titre}</p>
      <p className="mt-1.5 max-w-sm text-[13.5px] leading-relaxed text-muted">
        {description}
      </p>
      {action && <div className="mt-5">{action}</div>}
    </div>
  );
}

export function Alerte({
  ton = "erreur",
  children,
}: {
  ton?: "erreur" | "succes" | "info";
  children: ReactNode;
}) {
  const styles = {
    erreur: "border-impaye/25 bg-impaye-soft text-impaye",
    succes: "border-paye/25 bg-paye-soft text-paye",
    info: "border-brand/20 bg-brand-soft text-brand",
  };
  return (
    <div
      role={ton === "erreur" ? "alert" : "status"}
      className={cx("rounded-sm border px-3.5 py-2.5 text-[13px] leading-relaxed", styles[ton])}
    >
      {children}
    </div>
  );
}

export function TitreSection({
  titre,
  description,
  action,
}: {
  titre: string;
  description?: string;
  action?: ReactNode;
}) {
  return (
    <div className="flex flex-wrap items-end justify-between gap-3">
      <div>
        <h2 className="text-[15px] font-semibold text-ink">{titre}</h2>
        {description && (
          <p className="mt-1 text-[13px] text-muted">{description}</p>
        )}
      </div>
      {action}
    </div>
  );
}
