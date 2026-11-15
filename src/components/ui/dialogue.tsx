"use client";

import { useEffect, useId, type ReactNode } from "react";
import { X } from "lucide-react";

export function Dialogue({
  ouvert,
  onFermer,
  titre,
  description,
  children,
}: {
  ouvert: boolean;
  onFermer: () => void;
  titre: string;
  description?: string;
  children: ReactNode;
}) {
  const id = useId();

  useEffect(() => {
    if (!ouvert) return;
    const surTouche = (evenement: KeyboardEvent) => {
      if (evenement.key === "Escape") onFermer();
    };
    document.addEventListener("keydown", surTouche);
    const precedent = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", surTouche);
      document.body.style.overflow = precedent;
    };
  }, [ouvert, onFermer]);

  if (!ouvert) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center p-0 sm:items-center sm:p-6">
      <div
        className="absolute inset-0 bg-brand-deep/55"
        onClick={onFermer}
        aria-hidden
      />
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby={id}
        className="relative w-full max-w-lg rounded-t-lg border border-line bg-surface shadow-2xl sm:rounded-lg"
      >
        <div className="flex items-start justify-between gap-4 border-b border-line px-5 py-4">
          <div>
            <h2 id={id} className="text-[15px] font-semibold text-ink">
              {titre}
            </h2>
            {description && (
              <p className="mt-1 text-[13px] leading-relaxed text-muted">
                {description}
              </p>
            )}
          </div>
          <button
            type="button"
            onClick={onFermer}
            className="-mr-1.5 -mt-1 rounded-sm p-1.5 text-muted transition-colors hover:bg-surface-2 hover:text-ink"
            aria-label="Fermer"
          >
            <X size={18} />
          </button>
        </div>
        <div className="px-5 py-4">{children}</div>
      </div>
    </div>
  );
}
