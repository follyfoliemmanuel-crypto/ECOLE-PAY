"use client";

import { useActionState, useMemo, useState } from "react";
import Link from "next/link";
import {
  CheckCircle2,
  Loader2,
  LockKeyhole,
  Save,
  Send,
  TriangleAlert,
} from "lucide-react";
import { moyenneEvaluations } from "@/lib/saisies";
import { formatDate } from "@/lib/format";
import type {
  LigneSaisieNotes,
  ResultatAction,
  StatutSaisie,
} from "@/lib/types";
import { Bouton } from "@/components/ui/button";
import { Alerte } from "@/components/ui/empty-state";
import { cx } from "@/lib/cx";

type Cellules = {
  devoir1: string;
  devoir2: string;
  composition: string;
};

const CHAMPS: { cle: keyof Cellules; libelle: string }[] = [
  { cle: "devoir1", libelle: "Devoir 1" },
  { cle: "devoir2", libelle: "Devoir 2" },
  { cle: "composition", libelle: "Composition" },
];

function versTexte(valeur: number | null): string {
  if (valeur === null) return "";
  return String(valeur).replace(".", ",");
}

function versNombre(valeur: string): number | null {
  const propre = valeur.trim().replace(",", ".");
  if (propre === "") return null;
  const nombre = Number.parseFloat(propre);
  return Number.isFinite(nombre) ? nombre : null;
}

function celluleValide(valeur: string): boolean {
  if (valeur.trim() === "") return true;
  const nombre = versNombre(valeur);
  return nombre !== null && nombre >= 0 && nombre <= 20;
}

function formatMoyenne(valeur: number | null): string {
  if (valeur === null) return "—";
  return valeur.toFixed(2).replace(".", ",");
}

export function TableauNotes({
  saisieId,
  lignes,
  action,
  lectureSeule,
  statut,
  mode,
  retourHref,
  envoyeLe,
}: {
  saisieId: string;
  lignes: LigneSaisieNotes[];
  action: (
    etat: ResultatAction | null,
    donnees: FormData,
  ) => Promise<ResultatAction>;
  lectureSeule: boolean;
  statut: StatutSaisie;
  mode: "prof" | "directeur";
  retourHref: string;
  envoyeLe: string | null;
}) {
  const [etat, soumettre, enCours] = useActionState<
    ResultatAction | null,
    FormData
  >(action, null);

  const [valeurs, setValeurs] = useState<Record<string, Cellules>>(() => {
    const initial: Record<string, Cellules> = {};
    for (const ligne of lignes) {
      initial[ligne.eleve_id] = {
        devoir1: versTexte(ligne.devoir1),
        devoir2: versTexte(ligne.devoir2),
        composition: versTexte(ligne.composition),
      };
    }
    return initial;
  });

  function changer(eleveId: string, champ: keyof Cellules, valeur: string) {
    if (!/^[0-9.,]{0,5}$/.test(valeur)) return;
    setValeurs((actuel) => ({
      ...actuel,
      [eleveId]: {
        ...(actuel[eleveId] ?? { devoir1: "", devoir2: "", composition: "" }),
        [champ]: valeur,
      },
    }));
  }

  const analyse = useMemo(() => {
    let remplies = 0;
    let invalides = 0;
    const charge: Record<string, Cellules> = {};

    for (const ligne of lignes) {
      const cellules =
        valeurs[ligne.eleve_id] ?? { devoir1: "", devoir2: "", composition: "" };
      charge[ligne.eleve_id] = cellules;

      for (const champ of CHAMPS) {
        const valeur = cellules[champ.cle];
        if (!celluleValide(valeur)) invalides += 1;
      }

      const moyenne = moyenneEvaluations(
        versNombre(cellules.devoir1),
        versNombre(cellules.devoir2),
        versNombre(cellules.composition),
      );
      if (moyenne !== null) remplies += 1;
    }

    return { charge, remplies, invalides };
  }, [lignes, valeurs]);

  const bloque = lectureSeule || enCours;

  return (
    <form action={soumettre} className="space-y-4">
      <input type="hidden" name="saisie_id" value={saisieId} />
      <input
        type="hidden"
        name="notes"
        value={JSON.stringify(analyse.charge)}
      />

      {statut === "ENVOYE" && (
        <Alerte ton="info">
          <span className="inline-flex items-center gap-2">
            <CheckCircle2 size={15} aria-hidden />
            Notes envoyées{envoyeLe ? ` le ${formatDate(envoyeLe)}` : ""} au
            directeur. Elles seront publiées après sa validation.
          </span>
        </Alerte>
      )}
      {statut === "VALIDE" && (
        <Alerte ton="succes">
          <span className="inline-flex items-center gap-2">
            <CheckCircle2 size={15} aria-hidden />
            Notes validées et publiées sur le portail parent.
          </span>
        </Alerte>
      )}
      {mode === "prof" && lectureSeule && statut === "EN_COURS" && (
        <Alerte ton="info">
          <span className="inline-flex items-center gap-2">
            <LockKeyhole size={15} aria-hidden />
            Cette combinaison est traitée par un autre professeur.
          </span>
        </Alerte>
      )}
      {mode === "directeur" && statut === "LIBERE" && (
        <Alerte ton="info">
          <span className="inline-flex items-center gap-2">
            <LockKeyhole size={15} aria-hidden />
            Cette combinaison est libre : un professeur peut la reprendre.
            Les notes déjà saisies restent enregistrées mais ne sont plus
            publiées tant qu&apos;une nouvelle saisie n&apos;est pas validée.
          </span>
        </Alerte>
      )}

      {etat?.error && <Alerte ton="erreur">{etat.error}</Alerte>}
      {etat?.success && <Alerte ton="succes">{etat.success}</Alerte>}

      {analyse.invalides > 0 && !lectureSeule && (
        <Alerte ton="erreur">
          <span className="inline-flex items-center gap-2">
            <TriangleAlert size={15} aria-hidden />
            {analyse.invalides} cellule{analyse.invalides > 1 ? "s" : ""} hors
            barème. Chaque note doit être comprise entre 0 et 20.
          </span>
        </Alerte>
      )}

      <div className="card overflow-hidden">
        <div className="hidden border-b border-line bg-surface-2 px-4 py-2.5 sm:grid sm:grid-cols-[minmax(0,1fr)_88px_88px_96px_84px] sm:items-center sm:gap-2">
          <span className="text-[10.5px] font-semibold uppercase tracking-[0.1em] text-muted">
            Nom et prénom
          </span>
          {CHAMPS.map((champ) => (
            <span
              key={champ.cle}
              className="text-center text-[10.5px] font-semibold uppercase tracking-[0.1em] text-muted"
            >
              {champ.libelle}
            </span>
          ))}
          <span className="text-right text-[10.5px] font-semibold uppercase tracking-[0.1em] text-muted">
            Moyenne
          </span>
        </div>

        {lignes.length === 0 ? (
          <div className="px-4 py-10 text-center text-[13px] text-muted">
            Aucun élève actif dans cette classe.
          </div>
        ) : (
          <div>
            {lignes.map((ligne, index) => {
              const cellules =
                valeurs[ligne.eleve_id] ?? {
                  devoir1: "",
                  devoir2: "",
                  composition: "",
                };
              const moyenne = moyenneEvaluations(
                versNombre(cellules.devoir1),
                versNombre(cellules.devoir2),
                versNombre(cellules.composition),
              );

              return (
                <div
                  key={ligne.eleve_id}
                  className={cx(
                    "grid gap-2 border-b border-line px-3 py-3 last:border-b-0 sm:grid-cols-[minmax(0,1fr)_88px_88px_96px_84px] sm:items-center sm:gap-2 sm:px-4",
                    index % 2 === 1 && "bg-surface-2/60",
                  )}
                >
                  <div className="flex items-baseline justify-between gap-3 sm:block">
                    <p className="min-w-0 truncate text-[13.5px] font-semibold text-ink">
                      <span className="mr-1.5 text-[11px] font-normal text-muted sm:hidden">
                        {index + 1}.
                      </span>
                      {ligne.nom} {ligne.prenom}
                    </p>
                    <p className="shrink-0 text-[12px] font-semibold tabular-nums text-brand sm:hidden">
                      Moy. {formatMoyenne(moyenne)}
                    </p>
                  </div>

                  <div className="grid grid-cols-3 gap-2 sm:col-span-3">
                    {CHAMPS.map((champ) => {
                      const valeur = cellules[champ.cle];
                      const valide = celluleValide(valeur);
                      return (
                        <label key={champ.cle} className="min-w-0">
                          <span className="mb-1 block text-[10px] font-semibold uppercase tracking-[0.06em] text-muted sm:hidden">
                            {champ.libelle}
                          </span>
                          <input
                            type="text"
                            inputMode="decimal"
                            autoComplete="off"
                            value={valeur}
                            onChange={(evenement) =>
                              changer(
                                ligne.eleve_id,
                                champ.cle,
                                evenement.target.value,
                              )
                            }
                            disabled={bloque}
                            aria-label={`${champ.libelle} de ${ligne.nom} ${ligne.prenom}`}
                            aria-invalid={!valide}
                            placeholder="—"
                            className={cx(
                              "input h-11 w-full px-1 text-center text-[15px] font-semibold tabular-nums disabled:opacity-70",
                              !valide && "input-erreur",
                            )}
                          />
                        </label>
                      );
                    })}
                  </div>

                  <p className="hidden text-right text-[13.5px] font-semibold tabular-nums text-brand sm:block">
                    {formatMoyenne(moyenne)}
                  </p>
                </div>
              );
            })}
          </div>
        )}
      </div>

      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-[12.5px] text-muted">
          {analyse.remplies} élève{analyse.remplies > 1 ? "s" : ""} noté
          {analyse.remplies > 1 ? "s" : ""} sur {lignes.length}.
        </p>

        {!lectureSeule && (
          <div className="flex w-full flex-wrap gap-2 sm:w-auto">
            {mode === "prof" ? (
              <>
                <Bouton
                  type="submit"
                  name="intention"
                  value="brouillon"
                  variante="secondaire"
                  taille="lg"
                  disabled={bloque || analyse.invalides > 0}
                  className="flex-1 sm:flex-none"
                >
                  {enCours ? (
                    <Loader2 size={16} className="animate-spin" aria-hidden />
                  ) : (
                    <Save size={16} aria-hidden />
                  )}
                  ENREGISTRER BROUILLON
                </Bouton>
                <Bouton
                  type="submit"
                  name="intention"
                  value="envoyer"
                  taille="lg"
                  disabled={bloque || analyse.invalides > 0}
                  className="flex-1 sm:flex-none"
                >
                  <Send size={16} aria-hidden />
                  ENVOYER AU DIRECTEUR
                </Bouton>
              </>
            ) : (
              <Bouton
                type="submit"
                taille="lg"
                disabled={bloque || analyse.invalides > 0}
              >
                {enCours ? (
                  <Loader2 size={16} className="animate-spin" aria-hidden />
                ) : (
                  <Save size={16} aria-hidden />
                )}
                ENREGISTRER LES CORRECTIONS
              </Bouton>
            )}
          </div>
        )}

        <Link
          href={retourHref}
          className="text-[12.5px] font-semibold text-brand underline underline-offset-2 hover:no-underline"
        >
          {mode === "prof" ? "Mes saisies" : "Retour à la validation"}
        </Link>
      </div>
    </form>
  );
}
