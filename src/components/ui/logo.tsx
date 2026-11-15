import { cx } from "@/lib/cx";

/**
 * Marque ECOLE PAY.
 * L'emblème officiel (chapeau, livre ouvert) est posé sur une pastille blanche :
 * il reste lisible sur le fond papier comme sur la barre latérale bleu profond.
 */
export function Logo({
  ton = "sombre",
  compact = false,
  className,
}: {
  ton?: "sombre" | "clair";
  compact?: boolean;
  className?: string;
}) {
  const clair = ton === "clair";
  return (
    <span className={cx("inline-flex items-center gap-2.5", className)}>
      <span
        className={cx(
          "grid size-9 shrink-0 place-items-center overflow-hidden rounded-[7px] border bg-white",
          clair ? "border-white/25" : "border-line",
        )}
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src="/marque-ecole-pay.png"
          alt=""
          width={34}
          height={34}
          className="size-[34px] object-contain p-px"
        />
      </span>
      {!compact && (
        <span className="flex flex-col leading-none">
          <span
            className={cx(
              "text-[16px] font-bold tracking-[-0.03em]",
              clair ? "text-white" : "text-ink",
            )}
          >
            ÉCOLE PAY
          </span>
          <span
            className={cx(
              "mt-1 text-[9px] font-semibold uppercase tracking-[0.18em]",
              clair ? "text-white/55" : "text-muted",
            )}
          >
            Frais scolaires
          </span>
        </span>
      )}
    </span>
  );
}
