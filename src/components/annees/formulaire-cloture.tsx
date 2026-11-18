"use client";

import { useActionState } from "react";
import { Loader2, LockKeyhole } from "lucide-react";
import { cloturerAnnee } from "@/lib/actions/annees";
import type { ApercuCloture } from "@/lib/data/annees";
import type { ResultatAction } from "@/lib/types";
import { Alerte } from "@/components/ui/empty-state";
import { Bouton } from "@/components/ui/button";
import { cx } from "@/lib/cx";

function moyenne(valeur: number | null): string {
  if (valeur === null) return "—";
  return valeur.toFixed(2).replace(".", ",");
}

const LIBELLES_DECISION: Record<string, string> = {
  PASSE: "Passe en classe supérieure",
  REDOUBLE: "Redouble",
  DIPLOME: "Diplômé (fin de cycle)",
  TRANSFERE: "Transféré",
  INACTIF: "Inactif",
  EXAMEN: "Décision d'examen à saisir",
};

export function FormulaireCloture({ apercu }: { apercu: ApercuCloture }) {
  const [etat, action, enCours] = useActionState<ResultatAction | null, FormData>(
    cloturerAnnee,
    null,
  );

  const parClasse = new Map<string, typeof apercu.eleves>();
  for (const eleve of apercu.eleves) {
    const liste = parClasse.get(eleve.classe_id) ?? [];
    liste.push(eleve);
    parClasse.set(eleve.classe_id, liste);
  }

  return (
    <form action={action} className="space-y-5">
      <input type="hidden" name="annee" value={apercu.annee} />

      {etat?.error && <Alerte>{etat.error}</Alerte>}
      {etat?.success && <Alerte ton="succes">{etat.success}</Alerte>}

      {apercu.avertissements.length > 0 && (
        <Alerte ton="info">
          <ul className="list-disc space-y-1 pl-4">
            {apercu.avertissements.map((message) => (
              <li key={message}>{message}</li>
            ))}
          </ul>
        </Alerte>
      )}

      {apercu.bloquants.length > 0 && (
        <Alerte>
          <p className="font-semibold">La clôture est bloquée :</p>
          <ul className="mt-1 list-disc space-y-1 pl-4">
            {apercu.bloquants.map((message) => (
              <li key={message}>{message}</li>
            ))}
          </ul>
        </Alerte>
      )}

      <div className="grid grid-cols-2 divide-x divide-line overflow-hidden rounded-lg border border-line bg-surface sm:grid-cols-4">
        {[
          { libelle: "Élèves", valeur: String(apercu.eleves.length) },
          { libelle: "Classes", valeur: String(apercu.classes.length) },
          {
            libelle: "Passages",
            valeur: String(
              apercu.eleves.filter((e) => e.decision_auto === "PASSE").length,
            ),
            accent: "text-paye",
          },
          {
            libelle: "Redoublements",
            valeur: String(
              apercu.eleves.filter((e) => e.decision_auto === "REDOUBLE").length,
            ),
            accent: "text-impaye",
          },
        ].map((bloc) => (
          <div key={bloc.libelle} className="px-4 py-3.5">
            <p className="text-[9.5px] font-semibold uppercase tracking-[0.11em] text-muted">
              {bloc.libelle}
            </p>
            <p
              className={cx(
                "chiffre mt-1 text-[15px] font-medium",
                bloc.accent ?? "text-ink",
              )}
            >
              {bloc.valeur}
            </p>
          </div>
        ))}
      </div>

      {Array.from(parClasse.entries()).map(([classeId, eleves]) => {
        const classe = eleves[0];
        return (
          <section
            key={classeId}
            className="overflow-hidden rounded-md border border-line bg-surface"
          >
            <div className="flex flex-wrap items-center justify-between gap-2 border-b border-line bg-surface-2 px-4 py-3">
              <div>
                <h2 className="text-[14px] font-semibold text-ink">
                  {classe.classe_nom}
                </h2>
                <p className="mt-0.5 text-[11.5px] text-muted">
                  {classe.type_fin === "EXAMEN"
                    ? `Classe d'examen${classe.examen ? ` · ${classe.examen}` : " · examen non renseigné"}`
                    : `Classe normale${classe.classe_suivante_nom ? ` → ${classe.classe_suivante_nom}` : " · classe suivante non configurée"}`}
                </p>
              </div>
              <span className="text-[11px] text-muted">
                {eleves.length} élève{eleves.length > 1 ? "s" : ""}
              </span>
            </div>

            <div className="overflow-x-auto">
              <table className="tableau min-w-[680px]">
                <thead>
                  <tr>
                    <th>Élève</th>
                    <th className="text-right">Moyenne</th>
                    <th>Décision proposée</th>
                    <th>Destination</th>
                  </tr>
                </thead>
                <tbody>
                  {eleves.map((eleve) => {
                    const sorti =
                      eleve.statut_eleve === "transfere" ||
                      eleve.statut_eleve === "diplome" ||
                      eleve.statut_eleve === "inactif";
                    return (
                      <tr key={eleve.eleve_id}>
                        <td>
                          <span className="text-[12.5px] font-medium text-ink">
                            {eleve.prenom} {eleve.nom}
                          </span>
                          {sorti && (
                            <span className="ml-2 text-[10.5px] text-muted">
                              déjà sorti
                            </span>
                          )}
                        </td>
                        <td className="chiffre text-right text-[12.5px]">
                          {moyenne(eleve.moyenne_annuelle)}
                        </td>
                        <td>
                          {eleve.decision_auto === "EXAMEN" ? (
                            <div className="flex flex-wrap gap-2">
                              {[
                                { valeur: "ADMIS", libelle: "Admis à l'examen" },
                                { valeur: "ECHOUE", libelle: "Échoué" },
                              ].map((option) => (
                                <label
                                  key={option.valeur}
                                  className={cx(
                                    "inline-flex h-8 cursor-pointer items-center gap-1.5 rounded-sm border px-2.5 text-[11.5px] font-medium transition-colors",
                                    "has-[:checked]:border-brand has-[:checked]:bg-brand-soft has-[:checked]:text-brand",
                                    "border-line-strong bg-surface text-ink-2 hover:bg-surface-2",
                                  )}
                                >
                                  <input
                                    type="radio"
                                    name={`decision_${eleve.eleve_id}`}
                                    value={option.valeur}
                                    required
                                    className="sr-only"
                                  />
                                  {option.libelle}
                                </label>
                              ))}
                            </div>
                          ) : (
                            <span
                              className={cx(
                                "text-[12px] font-medium",
                                eleve.decision_auto === "PASSE"
                                  ? "text-paye"
                                  : eleve.decision_auto === "DIPLOME"
                                    ? "text-brand"
                                    : eleve.decision_auto === "REDOUBLE"
                                      ? "text-impaye"
                                      : "text-muted",
                              )}
                            >
                              {LIBELLES_DECISION[eleve.decision_auto] ??
                                eleve.decision_auto}
                            </span>
                          )}
                        </td>
                        <td className="text-[11.5px] text-muted">
                          {sorti
                            ? "Archive conservée"
                            : eleve.type_fin === "EXAMEN"
                              ? eleve.classe_suivante_nom ?? "Diplôme"
                              : eleve.decision_auto === "PASSE"
                                ? (eleve.classe_suivante_nom ?? "Diplôme")
                                : eleve.classe_nom}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </section>
        );
      })}

      <div className="flex flex-wrap items-center justify-between gap-3 rounded-md border border-line bg-surface-2 px-4 py-3">
        <p className="max-w-lg text-[12px] leading-relaxed text-muted">
          La clôture fige l&apos;année {apercu.annee} dans l&apos;archive et ouvre{" "}
          {apercu.annee_suivante}. Aucun élève n&apos;est supprimé : les
          paiements, notes, absences et bulletins restent consultables.
        </p>
        <Bouton
          type="submit"
          variante="principal"
          disabled={enCours || !apercu.peut_cloturer}
        >
          {enCours ? (
            <Loader2 className="animate-spin" size={15} aria-hidden />
          ) : (
            <LockKeyhole size={15} aria-hidden />
          )}
          {enCours ? "Clôture en cours…" : `Clôturer ${apercu.annee}`}
        </Bouton>
      </div>
    </form>
  );
}
