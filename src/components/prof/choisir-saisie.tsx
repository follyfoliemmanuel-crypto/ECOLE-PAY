"use client";

import { useActionState } from "react";
import { GraduationCap, Loader2, Play } from "lucide-react";
import { demarrerSaisie } from "@/lib/actions/saisies";
import { TRIMESTRES_SAISIE, libelleTrimestreSaisie } from "@/lib/saisies";
import type { Matiere, ResultatAction, Trimestre } from "@/lib/types";
import { Bouton } from "@/components/ui/button";
import { Alerte } from "@/components/ui/empty-state";

export type ClasseChoix = {
  id: string;
  nom: string;
  nb_eleves: number;
};

export function ChoisirSaisie({
  classes,
  matieres,
  trimestre,
  nomProf,
}: {
  classes: ClasseChoix[];
  matieres: Matiere[];
  trimestre: Trimestre;
  nomProf: string;
}) {
  const [etat, action, enCours] = useActionState<ResultatAction | null, FormData>(
    demarrerSaisie,
    null,
  );

  const pretes = classes.filter((classe) => classe.nb_eleves > 0);

  if (pretes.length === 0 || matieres.length === 0) {
    return (
      <div className="card p-5 sm:p-6">
        <h2 className="text-[15px] font-semibold text-ink">
          La saisie n&apos;est pas encore possible
        </h2>
        <p className="mt-1.5 max-w-xl text-[13px] leading-relaxed text-muted">
          {pretes.length === 0
            ? "Aucune classe ne contient d'élève actif cette année. Demandez au directeur d'inscrire les élèves."
            : "Aucune matière n'est configurée. Demandez au directeur d'ajouter les matières de l'école."}
        </p>
      </div>
    );
  }

  return (
    <form action={action} className="card p-5 sm:p-6">
      <div className="flex items-start gap-3">
        <span className="mt-0.5 grid size-9 shrink-0 place-items-center rounded-full border border-brand/15 bg-brand-soft text-brand">
          <GraduationCap size={17} aria-hidden />
        </span>
        <div>
          <h2 className="text-[15px] font-semibold text-ink">
            Choisissez la classe et la matière
          </h2>
          <p className="mt-1 text-[13px] leading-relaxed text-muted">
            {nomProf ? `${nomProf}, ` : ""}vous pouvez saisir n&apos;importe
            quelle classe et n&apos;importe quelle matière, sans attendre une
            affectation. La combinaison est réservée dès que vous commencez.
          </p>
        </div>
      </div>

      <div className="mt-5 grid gap-4 sm:grid-cols-2 lg:grid-cols-[1fr_1fr_0.9fr]">
        <div>
          <label className="label" htmlFor="classe_id">
            Classe
          </label>
          <select id="classe_id" name="classe_id" className="input" required>
            <option value="">Choisir la classe…</option>
            {pretes.map((classe) => (
              <option key={classe.id} value={classe.id}>
                {classe.nom} ({classe.nb_eleves} élève
                {classe.nb_eleves > 1 ? "s" : ""})
              </option>
            ))}
          </select>
        </div>

        <div>
          <label className="label" htmlFor="matiere_id">
            Matière
          </label>
          <select id="matiere_id" name="matiere_id" className="input" required>
            <option value="">Choisir la matière…</option>
            {matieres.map((matiere) => (
              <option key={matiere.id} value={matiere.id}>
                {matiere.nom}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label className="label" htmlFor="trimestre">
            Trimestre
          </label>
          <select
            id="trimestre"
            name="trimestre"
            className="input"
            defaultValue={String(trimestre)}
            required
          >
            {TRIMESTRES_SAISIE.map((element) => (
              <option key={element.valeur} value={element.valeur}>
                {element.libelle}
              </option>
            ))}
          </select>
        </div>
      </div>

      {etat?.error && (
        <div className="mt-4">
          <Alerte ton="erreur">{etat.error}</Alerte>
        </div>
      )}
      {etat?.success && (
        <div className="mt-4">
          <Alerte ton="succes">{etat.success}</Alerte>
        </div>
      )}

      <div className="mt-5 flex flex-wrap items-center gap-3">
        <Bouton type="submit" taille="lg" disabled={enCours}>
          {enCours ? (
            <Loader2 size={17} className="animate-spin" aria-hidden />
          ) : (
            <Play size={16} strokeWidth={2.4} aria-hidden />
          )}
          COMMENCER LA SAISIE
        </Bouton>
        <p className="text-[12px] text-muted">
          {libelleTrimestreSaisie(trimestre)} · année en cours
        </p>
      </div>
    </form>
  );
}
