"use client";

import { useActionState, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  CheckCircle2,
  Loader2,
  LockOpen,
  Save,
  ShieldCheck,
  Unlock,
} from "lucide-react";
import {
  definirEcheanceNotes,
  libererSaisie,
  validerEtPublier,
} from "@/lib/actions/saisies";
import type { ResultatAction, StatutSaisie, Trimestre } from "@/lib/types";
import { Bouton } from "@/components/ui/button";
import { Dialogue } from "@/components/ui/dialogue";
import { Alerte } from "@/components/ui/empty-state";

// ---------------------------------------------------------------------------
//  Date limite de dépôt des notes
// ---------------------------------------------------------------------------

export function FormEcheance({
  trimestre,
  dateLimite,
}: {
  trimestre: Trimestre;
  dateLimite: string | null;
}) {
  const [etat, action, enCours] = useActionState<ResultatAction | null, FormData>(
    definirEcheanceNotes,
    null,
  );

  return (
    <form action={action} className="space-y-3">
      <input type="hidden" name="trimestre" value={trimestre} />
      <div className="flex flex-wrap items-end gap-2">
        <label className="min-w-0 flex-1">
          <span className="label">Notes à envoyer avant le</span>
          <input
            type="date"
            name="date_limite"
            className="input"
            defaultValue={dateLimite ?? ""}
            required
          />
        </label>
        <Bouton type="submit" variante="secondaire" disabled={enCours}>
          {enCours ? (
            <Loader2 size={15} className="animate-spin" aria-hidden />
          ) : (
            <Save size={15} aria-hidden />
          )}
          Enregistrer
        </Bouton>
      </div>
      {etat?.error && <Alerte ton="erreur">{etat.error}</Alerte>}
      {etat?.success && <Alerte ton="succes">{etat.success}</Alerte>}
    </form>
  );
}

// ---------------------------------------------------------------------------
//  Validation / publication et libération d'une combinaison
// ---------------------------------------------------------------------------

export function ActionsValidation({
  saisieId,
  statut,
  classeNom,
  matiereNom,
  profNom,
}: {
  saisieId: string;
  statut: StatutSaisie;
  classeNom: string;
  matiereNom: string;
  profNom: string | null;
}) {
  const router = useRouter();
  const [resultat, setResultat] = useState<ResultatAction | null>(null);
  const [enCours, demarrer] = useTransition();
  const [ouvert, setOuvert] = useState(false);
  const [motif, setMotif] = useState("");

  function valider() {
    setResultat(null);
    const donnees = new FormData();
    donnees.set("saisie_id", saisieId);
    demarrer(async () => {
      const reponse = await validerEtPublier(donnees);
      setResultat(reponse);
      router.refresh();
    });
  }

  function liberer() {
    setResultat(null);
    const donnees = new FormData();
    donnees.set("saisie_id", saisieId);
    donnees.set("motif", motif);
    demarrer(async () => {
      const reponse = await libererSaisie(null, donnees);
      setResultat(reponse);
      if (reponse.success) {
        setOuvert(false);
        setMotif("");
      }
      router.refresh();
    });
  }

  return (
    <div className="space-y-3">
      {resultat?.error && <Alerte ton="erreur">{resultat.error}</Alerte>}
      {resultat?.success && <Alerte ton="succes">{resultat.success}</Alerte>}

      <div className="flex flex-wrap gap-2">
        {statut === "ENVOYE" && (
          <Bouton
            type="button"
            variante="succes"
            taille="lg"
            onClick={valider}
            disabled={enCours}
          >
            {enCours ? (
              <Loader2 size={16} className="animate-spin" aria-hidden />
            ) : (
              <ShieldCheck size={17} aria-hidden />
            )}
            VALIDER ET PUBLIER
          </Bouton>
        )}
        {statut === "VALIDE" && (
          <p className="inline-flex items-center gap-2 rounded-sm border border-paye/25 bg-paye-soft px-3.5 py-2.5 text-[13px] font-semibold text-paye">
            <CheckCircle2 size={16} aria-hidden />
            Notes publiées sur le portail parent
          </p>
        )}
        {statut === "LIBERE" ? (
          <p className="inline-flex items-center gap-2 rounded-sm border border-line bg-surface-2 px-3.5 py-2.5 text-[13px] font-semibold text-muted">
            <LockOpen size={16} aria-hidden />
            Combinaison libre : un professeur peut la reprendre
          </p>
        ) : (
          <Bouton
            type="button"
            variante="danger"
            taille="lg"
            onClick={() => setOuvert(true)}
            disabled={enCours}
          >
            <Unlock size={16} aria-hidden />
            LIBÉRER LA COMBINAISON
          </Bouton>
        )}
      </div>

      <Dialogue
        ouvert={ouvert}
        onFermer={() => setOuvert(false)}
        titre="Libérer la combinaison"
        description={`${matiereNom} · ${classeNom}${profNom ? ` — ${profNom}` : ""}`}
      >
        <div className="space-y-4">
          <p className="rounded-sm border border-impaye/20 bg-impaye-soft/60 p-3 text-[13px] leading-relaxed text-ink-2">
            {statut === "VALIDE"
              ? "Les notes déjà validées ne seront plus publiées sur le portail parent tant qu'aucune nouvelle saisie n'est validée. Un professeur pourra reprendre la combinaison."
              : "Le professeur perd l'accès à cette combinaison et un autre professeur pourra la reprendre. Les notes déjà saisies restent enregistrées."}
          </p>

          <label className="block">
            <span className="label">Motif (facultatif)</span>
            <textarea
              className="input min-h-20 resize-y"
              value={motif}
              onChange={(evenement) => setMotif(evenement.target.value)}
              placeholder="Ex. ce n'est pas le bon professeur, changement de service…"
              maxLength={300}
            />
          </label>

          {resultat?.error && <Alerte ton="erreur">{resultat.error}</Alerte>}

          <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
            <Bouton
              type="button"
              variante="secondaire"
              onClick={() => setOuvert(false)}
            >
              Annuler
            </Bouton>
            <Bouton
              type="button"
              variante="danger"
              onClick={liberer}
              disabled={enCours}
            >
              {enCours ? (
                <Loader2 size={15} className="animate-spin" aria-hidden />
              ) : (
                <LockOpen size={15} aria-hidden />
              )}
              Libérer maintenant
            </Bouton>
          </div>
        </div>
      </Dialogue>
    </div>
  );
}
