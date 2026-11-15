"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { CheckCircle2, Loader2, ShieldCheck } from "lucide-react";
import { forcerNouvelEssai } from "@/lib/actions/super-admin";
import { Bouton } from "@/components/ui/button";
import { Dialogue } from "@/components/ui/dialogue";
import { Alerte } from "@/components/ui/empty-state";

/**
 * Bouton du journal d'audit : neutralise les essais actifs de l'identité
 * refusée (nom, téléphone, WhatsApp) pour autoriser un vrai nouvel essai.
 * Réservé au super admin, vérifié à nouveau côté serveur.
 */
export function BoutonForcerEssai({
  auditId,
  nom,
  traite,
}: {
  auditId: string;
  nom: string;
  traite: boolean;
}) {
  const router = useRouter();
  const [ouvert, setOuvert] = useState(false);
  const [erreur, setErreur] = useState<string>();
  const [succes, setSucces] = useState<string>();
  const [enCours, demarrer] = useTransition();

  function forcer() {
    setErreur(undefined);
    setSucces(undefined);

    demarrer(async () => {
      const resultat = await forcerNouvelEssai(auditId);
      if (resultat.error) {
        setErreur(resultat.error);
        return;
      }
      setOuvert(false);
      setSucces(resultat.success);
      router.refresh();
    });
  }

  if (traite) {
    return (
      <span className="inline-flex items-center gap-1.5 text-[11px] font-semibold text-paye">
        <CheckCircle2 size={13} aria-hidden />
        Essai forcé
      </span>
    );
  }

  return (
    <div className="min-w-[150px]">
      <Bouton
        type="button"
        taille="sm"
        variante="secondaire"
        onClick={() => setOuvert(true)}
        title="Autoriser un nouvel essai gratuit pour ce directeur"
        className="w-full"
      >
        <ShieldCheck size={12} aria-hidden />
        FORCER UN NOUVEL ESSAI
      </Bouton>

      {erreur && (
        <p role="alert" className="mt-1.5 text-[11px] font-medium text-impaye">
          {erreur}
        </p>
      )}
      {succes && (
        <p role="status" className="mt-1.5 text-[11px] font-medium text-paye">
          {succes}
        </p>
      )}

      <Dialogue
        ouvert={ouvert}
        onFermer={() => setOuvert(false)}
        titre={`Forcer un nouvel essai pour ${nom} ?`}
        description="Les essais déjà utilisés avec ce nom d'école, ce téléphone ou ce WhatsApp seront neutralisés. Le directeur pourra se réinscrire et bénéficier à nouveau de 30 jours gratuits. L'historique est conservé dans le journal d'audit."
      >
        <div className="space-y-4">
          {erreur && <Alerte>{erreur}</Alerte>}
          <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
            <Bouton
              type="button"
              variante="secondaire"
              onClick={() => setOuvert(false)}
              disabled={enCours}
            >
              Annuler
            </Bouton>
            <Bouton
              type="button"
              variante="succes"
              onClick={forcer}
              disabled={enCours}
            >
              {enCours ? (
                <Loader2 size={14} className="animate-spin" aria-hidden />
              ) : (
                <ShieldCheck size={14} aria-hidden />
              )}
              Autoriser l&apos;essai
            </Bouton>
          </div>
        </div>
      </Dialogue>
    </div>
  );
}
