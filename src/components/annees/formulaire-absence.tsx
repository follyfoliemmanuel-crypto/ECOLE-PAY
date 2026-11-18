"use client";

import { useActionState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { Loader2, Plus } from "lucide-react";
import {
  enregistrerAbsence,
  supprimerAbsence,
} from "@/lib/actions/annees";
import type { ResultatAction } from "@/lib/types";
import { Alerte } from "@/components/ui/empty-state";
import { Bouton } from "@/components/ui/button";

function aujourdhui(): string {
  const date = new Date();
  const mois = String(date.getMonth() + 1).padStart(2, "0");
  const jour = String(date.getDate()).padStart(2, "0");
  return `${date.getFullYear()}-${mois}-${jour}`;
}

export function FormulaireAbsence({ eleveId }: { eleveId: string }) {
  const router = useRouter();
  const formulaire = useRef<HTMLFormElement>(null);
  const [etat, action, enCours] = useActionState<ResultatAction | null, FormData>(
    enregistrerAbsence,
    null,
  );

  useEffect(() => {
    if (!etat?.success) return;
    formulaire.current?.reset();
    router.refresh();
  }, [etat, router]);

  return (
    <form
      ref={formulaire}
      action={action}
      className="flex flex-wrap items-end gap-2"
    >
      <input type="hidden" name="eleve_id" value={eleveId} />

      <div className="min-w-[130px] flex-1">
        <label className="label" htmlFor="date_absence">
          Date
        </label>
        <input
          id="date_absence"
          name="date_absence"
          type="date"
          required
          defaultValue={aujourdhui()}
          className="input"
        />
      </div>

      <div className="min-w-[160px] flex-[2]">
        <label className="label" htmlFor="motif">
          Motif
        </label>
        <input
          id="motif"
          name="motif"
          maxLength={300}
          placeholder="Maladie, rendez-vous…"
          className="input"
          autoComplete="off"
        />
      </div>

      <label className="flex h-10 cursor-pointer items-center gap-2 rounded-sm border border-line-strong bg-surface px-3 text-[12px] font-medium text-ink-2">
        <input type="checkbox" name="justifiee" value="1" className="size-3.5" />
        Justifiée
      </label>

      <Bouton type="submit" variante="secondaire" disabled={enCours}>
        {enCours ? (
          <Loader2 className="animate-spin" size={13} aria-hidden />
        ) : (
          <Plus size={13} aria-hidden />
        )}
        Ajouter
      </Bouton>

      {etat?.error && (
        <div className="w-full">
          <Alerte>{etat.error}</Alerte>
        </div>
      )}
    </form>
  );
}

export function BoutonSupprimerAbsence({
  id,
  eleveId,
}: {
  id: string;
  eleveId: string;
}) {
  const router = useRouter();
  const [etat, action, enCours] = useActionState<ResultatAction | null, FormData>(
    supprimerAbsence,
    null,
  );

  useEffect(() => {
    if (etat?.success) router.refresh();
  }, [etat, router]);

  return (
    <form action={action}>
      <input type="hidden" name="id" value={id} />
      <input type="hidden" name="eleve_id" value={eleveId} />
      <button
        type="submit"
        disabled={enCours}
        title={etat?.error ?? "Supprimer cette absence"}
        className="text-[11px] font-semibold text-muted transition-colors hover:text-impaye disabled:opacity-50"
      >
        {enCours ? "…" : "Retirer"}
      </button>
    </form>
  );
}
