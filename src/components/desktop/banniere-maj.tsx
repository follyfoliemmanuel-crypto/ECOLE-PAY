"use client";

import { useState } from "react";
import { ArrowUpRight, Download, X } from "lucide-react";
import { useEtatBureau } from "./use-etat-bureau";

/**
 * Bandeau discret affiché uniquement quand une mise à jour de la coque
 * Windows est téléchargée et prête. Hors Electron, il ne rend rien.
 */
export function BanniereMiseAJour() {
  const etat = useEtatBureau();
  const [masquee, setMasquee] = useState(false);

  if (etat === false || etat === null) return null;
  if (masquee || etat.statut !== "pret") return null;

  return (
    <div className="mb-6 flex flex-wrap items-center justify-between gap-2 rounded-sm border border-paye/25 bg-paye-soft px-3.5 py-2.5 text-[12.5px] text-paye">
      <p className="flex items-center gap-2">
        <Download size={14} aria-hidden />
        <span>
          ECOLE PAY{" "}
          <span className="chiffre font-semibold">
            {etat.versionDisponible ?? ""}
          </span>{" "}
          est prête. Elle s&apos;installera à la fermeture de l&apos;application.
        </span>
      </p>
      <span className="flex items-center gap-1.5">
        <button
          type="button"
          onClick={() => {
            window.ecolepayDesktop?.installerMiseAJour();
          }}
          className="inline-flex h-7 items-center gap-1 rounded-sm bg-paye px-2.5 text-[11.5px] font-semibold text-white hover:bg-paye/90"
        >
          <ArrowUpRight size={12} aria-hidden />
          Redémarrer
        </button>
        <button
          type="button"
          onClick={() => setMasquee(true)}
          className="grid size-7 place-items-center rounded-sm text-paye/70 hover:bg-paye/10 hover:text-paye"
          aria-label="Masquer le bandeau de mise à jour"
        >
          <X size={14} aria-hidden />
        </button>
      </span>
    </div>
  );
}
