"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useTransition } from "react";
import { CalendarDays } from "lucide-react";
import { MOIS_SCOLAIRES } from "@/lib/mois";
import { cx } from "@/lib/cx";

/** Sélecteur de mois qui met à jour l'URL (donc les données serveur). */
export function MoisSelect({
  mois,
  className,
}: {
  mois: number;
  className?: string;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const parametres = useSearchParams();
  const [enCours, demarrer] = useTransition();

  function changer(valeur: string) {
    const suivants = new URLSearchParams(parametres.toString());
    suivants.set("mois", valeur);
    suivants.delete("page");
    demarrer(() => router.push(`${pathname}?${suivants.toString()}`));
  }

  return (
    <label
      className={cx(
        "inline-flex h-9 items-center gap-2 rounded-sm border border-line-strong bg-surface pl-3 pr-2 text-[13px] text-ink",
        enCours && "opacity-60",
        className,
      )}
    >
      <CalendarDays size={15} className="text-muted" aria-hidden />
      <span className="sr-only">Mois affiché</span>
      <select
        value={mois}
        onChange={(evenement) => changer(evenement.target.value)}
        className="cursor-pointer appearance-none bg-transparent py-1 pr-4 text-[13px] font-medium focus:outline-none"
      >
        {MOIS_SCOLAIRES.map((m) => (
          <option key={m.numero} value={m.numero}>
            {m.long}
          </option>
        ))}
      </select>
    </label>
  );
}
