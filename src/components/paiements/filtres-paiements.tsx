"use client";

import { SlidersHorizontal } from "lucide-react";
import { LIBELLES_MODE, type Frequence, type ModePaiement } from "@/lib/types";

/**
 * Filtre par mode de paiement en formulaire GET.
 * La fréquence et la période sont conservées dans l'URL.
 */
export function FiltresPaiements({
  mode,
  frequence,
  periode,
}: {
  mode: ModePaiement | "tous";
  frequence: Frequence;
  periode: number;
}) {
  return (
    <form method="get" className="flex flex-wrap items-end gap-2">
      <input type="hidden" name="frequence" value={frequence} />
      <input type="hidden" name="periode" value={periode} />

      <label className="relative">
        <span className="sr-only">Filtrer par mode de paiement</span>
        <SlidersHorizontal
          size={15}
          className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-muted"
          aria-hidden
        />
        <select
          name="mode"
          defaultValue={mode}
          onChange={(evenement) => evenement.currentTarget.form?.requestSubmit()}
          className="input h-9 appearance-none pl-9 pr-8 text-[12.5px]"
        >
          <option value="tous">Tous les modes</option>
          {(Object.keys(LIBELLES_MODE) as ModePaiement[]).map((valeur) => (
            <option key={valeur} value={valeur}>
              {LIBELLES_MODE[valeur]}
            </option>
          ))}
        </select>
      </label>

      <button
        type="submit"
        className="h-9 rounded-sm border border-line-strong bg-surface px-3 text-[12.5px] font-semibold text-ink transition-colors hover:bg-surface-2"
      >
        Filtrer
      </button>
    </form>
  );
}
