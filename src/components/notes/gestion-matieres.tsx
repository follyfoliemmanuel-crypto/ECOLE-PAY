"use client";

import { useActionState, useEffect, useRef, useState } from "react";
import { BookOpen, Loader2, Pencil, Plus, Save, Trash2 } from "lucide-react";
import {
  creerMatiere,
  modifierMatiere,
  supprimerMatiere,
} from "@/lib/actions/notes";
import type { Matiere, ResultatAction } from "@/lib/types";
import { Bouton } from "@/components/ui/button";
import { BoutonConfirmation } from "@/components/ui/bouton-confirmation";
import { Dialogue } from "@/components/ui/dialogue";
import { Alerte, EmptyState } from "@/components/ui/empty-state";

export function GestionMatieres({
  matieres,
  directeur,
}: {
  matieres: Matiere[];
  directeur: boolean;
}) {
  return (
    <section className="card mb-5 overflow-hidden">
      <div className="flex flex-wrap items-start justify-between gap-3 border-b border-line bg-surface-2 px-4 py-3.5">
        <div>
          <h2 className="flex items-center gap-2 text-[14px] font-semibold text-ink">
            <BookOpen size={15} aria-hidden />
            Matières et coefficients
          </h2>
          <p className="mt-0.5 text-[11.5px] text-muted">
            La moyenne du bulletin est pondérée par le coefficient de chaque
            matière.
          </p>
        </div>
        <span className="chiffre rounded-sm border border-line bg-surface px-2 py-1 text-[10.5px] text-ink-2">
          {matieres.length} matière{matieres.length > 1 ? "s" : ""}
        </span>
      </div>

      {directeur && (
        <div className="border-b border-line px-4 py-3.5">
          <NouvelleMatiere />
        </div>
      )}

      {matieres.length === 0 ? (
        <EmptyState
          icone={<BookOpen size={18} />}
          titre="Aucune matière enregistrée"
          description={
            directeur
              ? "Ajoutez les matières de votre programme (Français, Mathématiques, SVT…) avec leur coefficient. Vous pourrez ensuite saisir les notes par classe."
              : "Le directeur n'a pas encore ajouté les matières de l'école."
          }
        />
      ) : (
        <ul className="divide-y divide-line">
          {matieres.map((matiere) => (
            <li
              key={matiere.id}
              className="flex flex-wrap items-center justify-between gap-2 px-4 py-2.5"
            >
              <div className="flex min-w-0 items-center gap-2.5">
                <span className="grid size-7 shrink-0 place-items-center rounded-sm bg-brand-soft text-[10px] font-semibold text-brand">
                  {matiere.nom.slice(0, 2).toUpperCase()}
                </span>
                <span className="truncate text-[13px] font-medium text-ink">
                  {matiere.nom}
                </span>
                <span className="shrink-0 rounded-full border border-line bg-surface-2 px-2 py-0.5 text-[9.5px] font-semibold uppercase tracking-[0.06em] text-muted">
                  coef. {matiere.coefficient}
                </span>
              </div>

              {directeur && (
                <div className="flex items-center gap-1.5">
                  <ModifierMatiere matiere={matiere} />
                  <BoutonConfirmation
                    action={supprimerMatiere}
                    champs={{ id: matiere.id }}
                    titre={`Supprimer ${matiere.nom} ?`}
                    description="Toutes les notes saisies pour cette matière seront supprimées. Les moyennes et les bulletins seront recalculés."
                    libelle=""
                    libelleConfirmer="Supprimer la matière"
                    variante="fantome"
                    icone={<Trash2 size={13} aria-hidden />}
                  />
                </div>
              )}
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

function NouvelleMatiere() {
  const [etat, action, enCours] = useActionState<ResultatAction | null, FormData>(
    creerMatiere,
    null,
  );
  const formulaire = useRef<HTMLFormElement>(null);

  useEffect(() => {
    if (etat?.success) formulaire.current?.reset();
  }, [etat]);

  return (
    <form ref={formulaire} action={action} className="space-y-2.5">
      <div className="grid gap-2 sm:grid-cols-[1fr_130px_auto] sm:items-end">
        <div>
          <label className="label" htmlFor="matiere-nom">
            Nouvelle matière
          </label>
          <input
            id="matiere-nom"
            name="nom"
            required
            maxLength={80}
            placeholder="Mathématiques"
            className="input h-9"
            autoComplete="off"
          />
        </div>
        <div>
          <label className="label" htmlFor="matiere-coefficient">
            Coefficient
          </label>
          <input
            id="matiere-coefficient"
            name="coefficient"
            type="number"
            min={1}
            max={20}
            defaultValue={1}
            required
            className="input h-9"
          />
        </div>
        <Bouton type="submit" taille="sm" disabled={enCours} className="h-9">
          {enCours ? (
            <Loader2 size={14} className="animate-spin" aria-hidden />
          ) : (
            <Plus size={14} aria-hidden />
          )}
          {enCours ? "Ajout…" : "Ajouter"}
        </Bouton>
      </div>
      {etat?.error && <Alerte>{etat.error}</Alerte>}
      {etat?.success && <Alerte ton="succes">{etat.success}</Alerte>}
    </form>
  );
}

function ModifierMatiere({ matiere }: { matiere: Matiere }) {
  const [ouvert, setOuvert] = useState(false);
  const [etat, action, enCours] = useActionState<ResultatAction | null, FormData>(
    modifierMatiere,
    null,
  );

  useEffect(() => {
    if (etat?.success) {
      const minuteur = setTimeout(() => setOuvert(false), 700);
      return () => clearTimeout(minuteur);
    }
  }, [etat]);

  return (
    <>
      <button
        type="button"
        onClick={() => setOuvert(true)}
        className="inline-flex h-8 items-center gap-1.5 rounded-sm border border-line-strong px-2.5 text-[11.5px] font-semibold text-ink transition-colors hover:bg-surface-2"
      >
        <Pencil size={12} aria-hidden />
        Modifier
      </button>

      <Dialogue
        ouvert={ouvert}
        onFermer={() => setOuvert(false)}
        titre={`Modifier ${matiere.nom}`}
        description="Le nouveau coefficient s'applique immédiatement aux moyennes et aux bulletins."
      >
        <form action={action} className="space-y-3">
          <input type="hidden" name="id" value={matiere.id} />
          <div>
            <label className="label" htmlFor={`matiere-nom-${matiere.id}`}>
              Nom de la matière
            </label>
            <input
              id={`matiere-nom-${matiere.id}`}
              name="nom"
              required
              maxLength={80}
              defaultValue={matiere.nom}
              className="input"
            />
          </div>
          <div>
            <label className="label" htmlFor={`matiere-coef-${matiere.id}`}>
              Coefficient
            </label>
            <input
              id={`matiere-coef-${matiere.id}`}
              name="coefficient"
              type="number"
              min={1}
              max={20}
              required
              defaultValue={matiere.coefficient}
              className="input"
            />
          </div>

          {etat?.error && <Alerte>{etat.error}</Alerte>}
          {etat?.success && <Alerte ton="succes">{etat.success}</Alerte>}

          <div className="flex flex-col-reverse gap-2 pt-1 sm:flex-row sm:justify-end">
            <Bouton
              type="button"
              variante="secondaire"
              onClick={() => setOuvert(false)}
            >
              Annuler
            </Bouton>
            <Bouton type="submit" disabled={enCours}>
              {enCours ? (
                <Loader2 size={14} className="animate-spin" aria-hidden />
              ) : (
                <Save size={14} aria-hidden />
              )}
              Enregistrer
            </Bouton>
          </div>
        </form>
      </Dialogue>
    </>
  );
}
