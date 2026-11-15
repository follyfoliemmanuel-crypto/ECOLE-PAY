"use client";

import { Printer } from "lucide-react";

/** Bouton d'impression : la zone `.zone-impression` est seule visible. */
export function BoutonImprimer({
  libelle = "Imprimer",
  className,
}: {
  libelle?: string;
  className?: string;
}) {
  return (
    <button
      type="button"
      onClick={() => window.print()}
      className={
        className ??
        "inline-flex h-10 items-center justify-center gap-2 rounded-sm border border-line-strong bg-surface px-4 text-[13px] font-semibold text-ink transition-colors hover:bg-surface-2"
      }
    >
      <Printer size={15} aria-hidden />
      {libelle}
    </button>
  );
}
