"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useTransition } from "react";
import { CalendarDays } from "lucide-react";
import {
  FREQUENCES,
  LIBELLES_FREQUENCE,
  periodeCourante,
  periodesDe,
} from "@/lib/periodes";
import type { Frequence } from "@/lib/types";
import { cx } from "@/lib/cx";

/**
 * Sélecteur fréquence + période qui met à jour l'URL (donc les données
 * serveur). Fonctionne comme un simple formulaire, sans état complexe.
 */
export function PeriodeSelect({
  frequence,
  periode,
  annee,
  nbTranches = 3,
  className,
}: {
  frequence: Frequence;
  periode: number;
  annee: string;
  /** Nombre de tranches à proposer quand la fréquence est TRANCHES. */
  nbTranches?: number;
  className?: string;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const parametres = useSearchParams();
  const [enCours, demarrer] = useTransition();

  function changer(cle: "frequence" | "periode", valeur: string) {
    const suivants = new URLSearchParams(parametres.toString());
    suivants.set(cle, valeur);
    if (cle === "frequence") {
      suivants.set("periode", "0");
    }
    suivants.delete("page");
    demarrer(() => router.push(`${pathname}?${suivants.toString()}`));
  }

  return (
    <div
      className={cx(
        "inline-flex h-9 items-center gap-1.5 rounded-sm border border-line-strong bg-surface pl-2.5 pr-1.5 text-[12.5px] text-ink",
        enCours && "opacity-60",
        className,
      )}
    >
      <CalendarDays size={14} className="text-muted" aria-hidden />
      <label className="sr-only" htmlFor="select-frequence">
        Fréquence de paiement
      </label>
      <select
        id="select-frequence"
        value={frequence}
        onChange={(evenement) => changer("frequence", evenement.target.value)}
        className="h-7 cursor-pointer bg-transparent pr-1 text-[12.5px] font-medium text-ink outline-none"
        title="Fréquence de paiement"
      >
        {FREQUENCES.map((option) => (
          <option key={option.valeur} value={option.valeur}>
            {LIBELLES_FREQUENCE[option.valeur]}
          </option>
        ))}
      </select>
      <span className="text-line-strong" aria-hidden>
        |
      </span>
      <label className="sr-only" htmlFor="select-periode">
        Période
      </label>
      <select
        id="select-periode"
        value={String(periode)}
        onChange={(evenement) => changer("periode", evenement.target.value)}
        className="h-7 cursor-pointer bg-transparent pr-1 text-[12.5px] font-medium text-ink outline-none"
        title="Période"
      >
        {periodesDe(frequence, annee, nbTranches).map((option) => (
          <option key={option.numero} value={option.numero}>
            {option.long}
          </option>
        ))}
      </select>
    </div>
  );
}
