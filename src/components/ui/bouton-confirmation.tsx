"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition, type ReactNode } from "react";
import { AlertTriangle, Trash2 } from "lucide-react";
import { Dialogue } from "./dialogue";
import { Bouton, type VarianteBouton } from "./button";
import { Alerte } from "./empty-state";
import type { ResultatAction } from "@/lib/types";

type ActionServeur = (donnees: FormData) => Promise<ResultatAction | void>;

/**
 * Confirmation avant une action destructrice.
 * Le serveur reste seul juge (rôle, appartenance à l'école).
 */
export function BoutonConfirmation({
  action,
  champs,
  titre,
  description,
  libelle,
  libelleConfirmer = "Confirmer",
  variante = "danger",
  icone,
  texteConfirmation,
  redirigerVers,
  children,
}: {
  action: ActionServeur;
  champs: Record<string, string>;
  titre: string;
  description: string;
  libelle: string;
  libelleConfirmer?: string;
  variante?: VarianteBouton;
  icone?: ReactNode;
  texteConfirmation?: string;
  redirigerVers?: string;
  children?: ReactNode;
}) {
  const router = useRouter();
  const [ouvert, setOuvert] = useState(false);
  const [saisie, setSaisie] = useState("");
  const [erreur, setErreur] = useState<string>();
  const [enCours, demarrer] = useTransition();

  function confirmer() {
    setErreur(undefined);
    const donnees = new FormData();
    for (const [cle, valeur] of Object.entries(champs)) {
      donnees.set(cle, valeur);
    }
    demarrer(async () => {
      try {
        const resultat = await action(donnees);
        if (resultat && "error" in resultat && resultat.error) {
          setErreur(resultat.error);
          return;
        }
        setOuvert(false);
        setSaisie("");
        if (redirigerVers) {
          router.push(redirigerVers);
          router.refresh();
        }
      } catch {
        setErreur("L'opération a échoué. Vérifiez la connexion puis réessayez.");
      }
    });
  }

  const autorise =
    !texteConfirmation || saisie.trim().toUpperCase() === texteConfirmation.toUpperCase();

  return (
    <>
      <Bouton
        type="button"
        variante={variante}
        taille="sm"
        onClick={() => setOuvert(true)}
      >
        {icone}
        {children ?? libelle}
      </Bouton>

      <Dialogue
        ouvert={ouvert}
        onFermer={() => setOuvert(false)}
        titre={titre}
        description={description}
      >
        <div className="space-y-4">
          <div className="flex gap-3 rounded-sm border border-impaye/20 bg-impaye-soft/60 p-3">
            <AlertTriangle size={18} className="mt-0.5 shrink-0 text-impaye" aria-hidden />
            <p className="text-[13px] leading-relaxed text-ink-2">
              {description}
            </p>
          </div>

          {texteConfirmation && (
            <label className="block">
              <span className="label">
                Tapez « {texteConfirmation} » pour confirmer
              </span>
              <input
                className="input"
                value={saisie}
                onChange={(evenement) => setSaisie(evenement.target.value)}
                autoComplete="off"
                placeholder={texteConfirmation}
              />
            </label>
          )}

          {erreur && <Alerte>{erreur}</Alerte>}

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
              onClick={confirmer}
              disabled={enCours || !autorise}
            >
              <Trash2 size={15} aria-hidden />
              {enCours ? "Traitement…" : libelleConfirmer}
            </Bouton>
          </div>
        </div>
      </Dialogue>
    </>
  );
}
