"use client";

import { Search, SlidersHorizontal } from "lucide-react";
import type { Classe, Frequence } from "@/lib/types";

/**
 * Recherche + filtre classe en formulaire GET :
 * fonctionne même sans JavaScript, avec une connexion instable.
 */
export function FiltreEleves({
  recherche,
  classeId,
  classes,
  frequence,
  periode,
}: {
  recherche: string;
  classeId: string;
  classes: Classe[];
  frequence: Frequence;
  periode: number;
}) {
  return (
    <form method="get" className="flex flex-col gap-2 sm:flex-row sm:items-center">
      <input type="hidden" name="frequence" value={frequence} />
      <input type="hidden" name="periode" value={periode} />
      <label className="relative flex-1 sm:max-w-xs">
        <span className="sr-only">Rechercher un élève</span>
        <Search
          size={16}
          className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-muted"
          aria-hidden
        />
        <input
          type="search"
          name="q"
          defaultValue={recherche}
          placeholder="Nom de l'élève ou du parent"
          className="input h-10 pl-9"
          autoComplete="off"
        />
      </label>

      <label className="relative">
        <span className="sr-only">Filtrer par classe</span>
        <SlidersHorizontal
          size={15}
          className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-muted"
          aria-hidden
        />
        <select
          name="classe"
          defaultValue={classeId}
          onChange={(evenement) => evenement.currentTarget.form?.requestSubmit()}
          className="input h-10 appearance-none pl-9 pr-8 text-[13px]"
        >
          <option value="toutes">Toutes les classes</option>
          {classes.map((classe) => (
            <option key={classe.id} value={classe.id}>
              {classe.nom} ({classe.nb_eleves})
            </option>
          ))}
        </select>
      </label>

      <button
        type="submit"
        className="h-10 rounded-sm border border-line-strong bg-surface px-4 text-[13px] font-semibold text-ink transition-colors hover:bg-surface-2"
      >
        Filtrer
      </button>
    </form>
  );
}
