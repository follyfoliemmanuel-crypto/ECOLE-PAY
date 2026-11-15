"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { Ban, Loader2 } from "lucide-react";
import { annulerPaiement } from "@/lib/actions/paiements";
import { Dialogue } from "@/components/ui/dialogue";
import { Bouton } from "@/components/ui/button";
import { Alerte } from "@/components/ui/empty-state";

/** Annulation d'un paiement — réservée au directeur, avec motif obligatoire. */
export function BoutonAnnulationPaiement({
  paiementId,
  numeroRecu,
  montant,
}: {
  paiementId: string;
  numeroRecu: string;
  montant: string;
}) {
  const router = useRouter();
  const [ouvert, setOuvert] = useState(false);
  const [motif, setMotif] = useState("");
  const [erreur, setErreur] = useState<string>();
  const [enCours, demarrer] = useTransition();

  function confirmer() {
    setErreur(undefined);
    const donnees = new FormData();
    donnees.set("id", paiementId);
    donnees.set("motif", motif);

    demarrer(async () => {
      try {
        const resultat = await annulerPaiement(donnees);
        if (resultat.error) {
          setErreur(resultat.error);
          return;
        }
        setOuvert(false);
        setMotif("");
        router.refresh();
      } catch {
        setErreur("L'annulation a échoué. Vérifiez la connexion.");
      }
    });
  }

  return (
    <>
      <button
        type="button"
        onClick={() => setOuvert(true)}
        className="inline-flex items-center gap-1 rounded-sm px-1.5 py-1 text-[11px] font-medium text-muted transition-colors hover:bg-impaye-soft hover:text-impaye"
        title="Annuler ce paiement"
      >
        <Ban size={12} aria-hidden />
        Annuler
      </button>

      <Dialogue
        ouvert={ouvert}
        onFermer={() => setOuvert(false)}
        titre="Annuler ce paiement ?"
        description={`Reçu ${numeroRecu} · ${montant}. Le mois sera recalculé automatiquement.`}
      >
        <div className="space-y-4">
          <div>
            <label className="label" htmlFor="motif">
              Motif de l&apos;annulation
            </label>
            <textarea
              id="motif"
              value={motif}
              onChange={(evenement) => setMotif(evenement.target.value)}
              rows={3}
              placeholder="Ex. montant saisi par erreur, doublon…"
              className="input resize-none"
              autoFocus
            />
            <p className="aide">
              L&apos;opération reste dans l&apos;historique avec votre nom et la
              date. Elle ne peut pas être supprimée.
            </p>
          </div>

          {erreur && <Alerte>{erreur}</Alerte>}

          <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
            <Bouton type="button" variante="secondaire" onClick={() => setOuvert(false)}>
              Retour
            </Bouton>
            <Bouton
              type="button"
              variante="danger"
              onClick={confirmer}
              disabled={enCours || motif.trim().length < 3}
            >
              {enCours ? (
                <Loader2 size={14} className="animate-spin" aria-hidden />
              ) : (
                <Ban size={14} aria-hidden />
              )}
              Confirmer l&apos;annulation
            </Bouton>
          </div>
        </div>
      </Dialogue>
    </>
  );
}
