"use client";

import { useActionState, useState } from "react";
import { FileText, Loader2 } from "lucide-react";
import { demanderRapport } from "@/lib/actions/annees";
import type { ResultatAction } from "@/lib/types";
import { Alerte } from "@/components/ui/empty-state";
import { Bouton } from "@/components/ui/button";

export function FormulaireRapport({
  annees,
  anneeActive,
}: {
  annees: string[];
  anneeActive: string;
}) {
  const [type, setType] = useState<"TRIMESTRIEL" | "ANNUEL">("TRIMESTRIEL");
  const [etat, action, enCours] = useActionState<ResultatAction | null, FormData>(
    demanderRapport,
    null,
  );

  return (
    <form action={action} className="space-y-4">
      {etat?.error && <Alerte>{etat.error}</Alerte>}
      {etat?.success && <Alerte ton="succes">{etat.success}</Alerte>}

      <div className="grid gap-3 sm:grid-cols-3">
        <div>
          <label className="label" htmlFor="annee">
            Année scolaire
          </label>
          <select
            id="annee"
            name="annee"
            className="input"
            defaultValue={anneeActive}
          >
            {annees.map((annee) => (
              <option key={annee} value={annee}>
                {annee}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label className="label" htmlFor="type">
            Type de rapport
          </label>
          <select
            id="type"
            name="type"
            className="input"
            value={type}
            onChange={(evenement) =>
              setType(evenement.target.value as "TRIMESTRIEL" | "ANNUEL")
            }
          >
            <option value="TRIMESTRIEL">Trimestriel</option>
            <option value="ANNUEL">Annuel</option>
          </select>
        </div>

        <div className={type === "ANNUEL" ? "opacity-50" : undefined}>
          <label className="label" htmlFor="trimestre">
            Trimestre
          </label>
          <select
            id="trimestre"
            name="trimestre"
            className="input"
            disabled={type === "ANNUEL"}
            defaultValue="1"
          >
            <option value="1">1er trimestre</option>
            <option value="2">2e trimestre</option>
            <option value="3">3e trimestre</option>
          </select>
        </div>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="max-w-md text-[12px] leading-relaxed text-muted">
          Le rapport est préparé en arrière-plan : élèves, moyennes, réussite,
          paiements reçus et impayés, absences. L&apos;annuel ajoute les trois
          trimestres et les décisions de fin d&apos;année.
        </p>
        <Bouton type="submit" disabled={enCours}>
          {enCours ? (
            <Loader2 className="animate-spin" size={15} aria-hidden />
          ) : (
            <FileText size={15} aria-hidden />
          )}
          Générer le rapport
        </Bouton>
      </div>
    </form>
  );
}
