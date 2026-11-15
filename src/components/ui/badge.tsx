import { cx } from "@/lib/cx";
import { LIBELLES_STATUT, type StatutFrais } from "@/lib/types";

const styles: Record<
  StatutFrais,
  { fond: string; point: string }
> = {
  PAYE: { fond: "bg-paye-soft text-paye border-paye/20", point: "bg-paye" },
  PARTIEL: {
    fond: "bg-partiel-soft text-partiel border-partiel/20",
    point: "bg-partiel",
  },
  NON_PAYE: {
    fond: "bg-impaye-soft text-impaye border-impaye/20",
    point: "bg-impaye",
  },
};

export function BadgeStatut({
  statut,
  className,
}: {
  statut: StatutFrais;
  className?: string;
}) {
  const style = styles[statut];
  return (
    <span
      className={cx(
        "inline-flex items-center gap-1.5 rounded-full border px-2 py-0.5 text-[11px] font-semibold leading-5 whitespace-nowrap",
        style.fond,
        className,
      )}
    >
      <span className={cx("size-1.5 rounded-full", style.point)} aria-hidden />
      {LIBELLES_STATUT[statut]}
    </span>
  );
}

export function Badge({
  children,
  ton = "neutre",
  className,
}: {
  children: React.ReactNode;
  ton?: "neutre" | "brand" | "ochre" | "succes";
  className?: string;
}) {
  const tons = {
    neutre: "bg-surface-2 text-muted border-line",
    brand: "bg-brand-soft text-brand border-brand/15",
    ochre: "bg-[#fbf1de] text-[#8a5a10] border-ochre/25",
    succes: "bg-paye-soft text-paye border-paye/20",
  };
  return (
    <span
      className={cx(
        "inline-flex items-center rounded-full border px-2 py-0.5 text-[11px] font-semibold leading-5 whitespace-nowrap",
        tons[ton],
        className,
      )}
    >
      {children}
    </span>
  );
}
