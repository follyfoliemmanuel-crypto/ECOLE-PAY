"use client";

import { useActionState, useState } from "react";
import Link from "next/link";
import { ArrowRight, CheckCircle2, Loader2, Save, TriangleAlert } from "lucide-react";
import { enregistrerNotes } from "@/lib/actions/notes";
import type {
  Matiere,
  NotesEleve,
  ResultatAction,
  Trimestre,
} from "@/lib/types";
import type { EleveNotes } from "@/lib/data/notes";
import { Bouton } from "@/components/ui/button";
import { Alerte } from "@/components/ui/empty-state";
import { cx } from "@/lib/cx";

function nombreSaisi(valeur: string): number | null {
  if (valeur.trim() === "") return null;
  const nombre = Number.parseFloat(valeur.replace(",", "."));
  return Number.isFinite(nombre) ? nombre : null;
}

function noteValide(note: number | null, brut: string): boolean {
  if (brut.trim() === "") return true;
  return note !== null && note >= 0 && note <= 20;
}

function formatMoyenne(valeur: number | null): string {
  if (valeur === null) return "—";
  return valeur.toFixed(2).replace(".", ",");
}

export function SaisieNotes({
  classeId,
  classeNom,
  annee,
  trimestre,
  eleves,
  matieres,
  notes,
}: {
  classeId: string;
  classeNom: string;
  annee: string;
  trimestre: Trimestre;
  eleves: EleveNotes[];
  matieres: Matiere[];
  notes: Record<string, NotesEleve>;
}) {
  const [etat, action, enCours] = useActionState<ResultatAction | null, FormData>(
    enregistrerNotes,
    null,
  );

  // La grille est contrôlée pour calculer les moyennes en direct.
  const [valeurs, setValeurs] = useState<Record<string, string>>(() => {
    const initial: Record<string, string> = {};
    for (const eleve of eleves) {
      for (const matiere of matieres) {
        const note = notes[eleve.id]?.[matiere.id];
        initial[`${eleve.id}:${matiere.id}`] =
          note === null || note === undefined ? "" : String(note).replace(".", ",");
      }
    }
    return initial;
  });

  return (
    <div>
      <div className="sans-impression mb-4 flex flex-wrap items-center justify-between gap-2 rounded-sm border border-brand/20 bg-brand-soft px-3.5 py-2.5">
        <p className="text-[12px] font-medium text-brand">
          {classeNom} · trimestre {trimestre} · {eleves.length} élève
          {eleves.length > 1 ? "s" : ""} · {matieres.length} matière
          {matieres.length > 1 ? "s" : ""}
        </p>
        <Link
          href={`/app/notes/bulletins?classe=${classeId}&trimestre=${trimestre}`}
          className="inline-flex items-center gap-1.5 text-[11.5px] font-semibold text-brand hover:underline"
        >
          Voir les bulletins
          <ArrowRight size={12} aria-hidden />
        </Link>
      </div>

      <form action={action} className="space-y-4">
        <input type="hidden" name="classe_id" value={classeId} />
        <input type="hidden" name="annee" value={annee} />
        <input type="hidden" name="trimestre" value={String(trimestre)} />
        <input type="hidden" name="notes" value={JSON.stringify(valeurs)} />

        <div className="card overflow-hidden">
          <div className="flex flex-wrap items-center justify-between gap-2 border-b border-line bg-surface-2 px-4 py-3">
            <div>
              <h2 className="text-[13.5px] font-semibold text-ink">
                Saisie des notes sur 20
              </h2>
              <p className="mt-0.5 text-[11px] text-muted">
                Une case vide signifie « non noté ». Les moyennes se calculent
                avec les coefficients.
              </p>
            </div>
            <Bouton type="submit" taille="sm" disabled={enCours}>
              {enCours ? (
                <Loader2 size={14} className="animate-spin" aria-hidden />
              ) : (
                <Save size={14} aria-hidden />
              )}
              {enCours ? "Enregistrement…" : "Enregistrer les notes"}
            </Bouton>
          </div>

          <div className="overflow-x-auto">
            <table className="tableau min-w-max">
              <thead>
                <tr>
                  <th className="sticky left-0 z-10 bg-surface-2">Élève</th>
                  {matieres.map((matiere) => (
                    <th key={matiere.id} className="text-center">
                      <span className="block max-w-[110px] truncate">
                        {matiere.nom}
                      </span>
                      <span className="mt-0.5 block text-[9px] font-normal normal-case tracking-normal text-muted">
                        coef. {matiere.coefficient}
                      </span>
                    </th>
                  ))}
                  <th className="text-right">Moyenne</th>
                </tr>
              </thead>
              <tbody>
                {eleves.map((eleve) => {
                  let points = 0;
                  let coefficients = 0;
                  for (const matiere of matieres) {
                    const note = nombreSaisi(
                      valeurs[`${eleve.id}:${matiere.id}`] ?? "",
                    );
                    if (note !== null && note >= 0 && note <= 20) {
                      points += note * matiere.coefficient;
                      coefficients += matiere.coefficient;
                    }
                  }
                  const moyenne = coefficients > 0 ? points / coefficients : null;

                  return (
                    <tr key={eleve.id}>
                      <td className="sticky left-0 z-10 bg-surface">
                        <span className="text-[13px] font-medium text-ink">
                          {eleve.prenom} {eleve.nom}
                        </span>
                      </td>
                      {matieres.map((matiere) => {
                        const cle = `${eleve.id}:${matiere.id}`;
                        const brut = valeurs[cle] ?? "";
                        const valide = noteValide(nombreSaisi(brut), brut);
                        return (
                          <td key={matiere.id} className="text-center">
                            <input
                              aria-label={`Note de ${eleve.prenom} ${eleve.nom} en ${matiere.nom}`}
                              value={brut}
                              onChange={(evenement) =>
                                setValeurs((actuelles) => ({
                                  ...actuelles,
                                  [cle]: evenement.target.value,
                                }))
                              }
                              inputMode="decimal"
                              autoComplete="off"
                              placeholder="—"
                              className={cx(
                                "h-9 w-[62px] rounded-sm border bg-surface px-1.5 text-center text-[13px] outline-none transition-colors focus:border-brand focus:ring-2 focus:ring-brand/15",
                                valide
                                  ? "border-line-strong"
                                  : "border-impaye bg-impaye-soft/40 text-impaye",
                              )}
                            />
                          </td>
                        );
                      })}
                      <td className="text-right">
                        <span
                          className={cx(
                            "chiffre text-[13px] font-semibold",
                            moyenne === null
                              ? "text-muted"
                              : moyenne >= 10
                                ? "text-paye"
                                : "text-impaye",
                          )}
                        >
                          {formatMoyenne(moyenne)}
                        </span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {eleves.length === 0 && (
            <p className="px-4 py-10 text-center text-[13px] text-muted">
              Cette classe n&apos;a aucun élève actif pour l&apos;année {annee}.
            </p>
          )}
          {matieres.length === 0 && (
            <p className="px-4 py-10 text-center text-[13px] text-muted">
              Ajoutez d&apos;abord des matières sur la page Notes &amp; bulletins.
            </p>
          )}
        </div>

        {etat?.error && (
          <Alerte>
            <span className="flex items-start gap-2">
              <TriangleAlert size={15} className="mt-0.5 shrink-0" aria-hidden />
              {etat.error}
            </span>
          </Alerte>
        )}
        {etat?.success && (
          <Alerte ton="succes">
            <span className="flex items-center gap-2">
              <CheckCircle2 size={15} aria-hidden />
              {etat.success}
            </span>
          </Alerte>
        )}

        <div className="sans-impression flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-[11.5px] text-muted">
            Les notes sont enregistrées pour l&apos;année {annee}. Vous pouvez
            revenir les modifier à tout moment.
          </p>
          <Bouton type="submit" disabled={enCours}>
            {enCours ? (
              <Loader2 size={15} className="animate-spin" aria-hidden />
            ) : (
              <Save size={15} aria-hidden />
            )}
            {enCours ? "Enregistrement…" : "Enregistrer les notes"}
          </Bouton>
        </div>
      </form>
    </div>
  );
}
