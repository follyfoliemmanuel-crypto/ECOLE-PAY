"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Ban, CalendarPlus, Loader2, ShieldCheck } from "lucide-react";
import {
  activerPro1Mois,
  activerPro3Mois,
  activerPremium1Mois,
  activerPremium3Mois,
  activerStarter1Mois,
  activerStarter3Mois,
  bloquerEcole,
  changerOffre,
} from "@/lib/actions/super-admin";
import { OFFRES } from "@/lib/offres";
import type { Offre } from "@/lib/types";
import { Bouton } from "@/components/ui/button";
import { Dialogue } from "@/components/ui/dialogue";
import { Alerte } from "@/components/ui/empty-state";
import { cx } from "@/lib/cx";

const ACTIONS: Record<
  Offre,
  { un: (id: string) => Promise<{ error?: string; success?: string }>; trois: (id: string) => Promise<{ error?: string; success?: string }> }
> = {
  STARTER: { un: activerStarter1Mois, trois: activerStarter3Mois },
  PRO: { un: activerPro1Mois, trois: activerPro3Mois },
  PREMIUM: { un: activerPremium1Mois, trois: activerPremium3Mois },
};

const ORDRES: Offre[] = ["STARTER", "PRO", "PREMIUM"];

/** Les 6 activations + le blocage, réservés au super admin. */
export function BoutonsEcole({
  ecoleId,
  nom,
  statut,
  offre,
}: {
  ecoleId: string;
  nom: string;
  statut: "ESSAI" | "ACTIF" | "BLOQUE";
  offre: Offre;
}) {
  const router = useRouter();
  const [enCours, setEnCours] = useState<string | null>(null);
  const [erreur, setErreur] = useState<string>();
  const [succes, setSucces] = useState<string>();
  const [blocageOuvert, setBlocageOuvert] = useState(false);

  async function activer(cible: Offre, mois: 1 | 3) {
    setErreur(undefined);
    setSucces(undefined);
    setEnCours(`${cible}-${mois}`);

    const resultat =
      mois === 1
        ? await ACTIONS[cible].un(ecoleId)
        : await ACTIONS[cible].trois(ecoleId);

    setEnCours(null);
    if (resultat.error) {
      setErreur(resultat.error);
      return;
    }
    setSucces(resultat.success);
    router.refresh();
  }

  async function basculer(cible: Offre) {
    setErreur(undefined);
    setSucces(undefined);
    setEnCours(`offre-${cible}`);

    const resultat = await changerOffre(ecoleId, cible);

    setEnCours(null);
    if (resultat.error) {
      setErreur(resultat.error);
      return;
    }
    setSucces(resultat.success);
    router.refresh();
  }

  async function bloquer() {
    setErreur(undefined);
    setSucces(undefined);
    setEnCours("bloquer");

    const resultat = await bloquerEcole(ecoleId);

    setEnCours(null);
    if (resultat.error) {
      setErreur(resultat.error);
      return;
    }
    setBlocageOuvert(false);
    setSucces(resultat.success);
    router.refresh();
  }

  const occupe = enCours !== null;

  return (
    <div className="min-w-[290px]">
      <p className="mb-1 text-[9px] font-semibold uppercase tracking-[0.08em] text-muted">
        Basculer l&apos;offre · 1 clic
      </p>
      <div className="grid grid-cols-3 gap-1 rounded-sm border border-line bg-surface-2 p-1">
        {ORDRES.map((cible) => {
          const actif = statut === "ACTIF" && offre === cible;
          return (
            <button
              key={cible}
              type="button"
              disabled={occupe || actif}
              onClick={() => basculer(cible)}
              aria-pressed={actif}
              title={
                actif
                  ? `L'école est déjà en ${cible}`
                  : `Passer immédiatement en ${cible} (${OFFRES[cible].prix.toLocaleString("fr-FR")} F / mois)`
              }
              className={cx(
                "inline-flex h-8 items-center justify-center gap-1 rounded-sm border text-[10px] font-bold uppercase tracking-[0.06em] transition-colors",
                actif
                  ? "border-paye/30 bg-paye-soft text-paye"
                  : "border-transparent bg-surface text-ink-2 hover:border-line-strong hover:bg-surface-2",
                occupe && "opacity-60",
              )}
            >
              {enCours === `offre-${cible}` && (
                <Loader2 size={11} className="animate-spin" aria-hidden />
              )}
              {cible}
            </button>
          );
        })}
      </div>
      <p className="mb-2.5 mt-1 text-[9.5px] leading-tight text-muted">
        Effet immédiat, sans reconnexion. Ne change pas la date de fin
        d&apos;abonnement.
      </p>

      <p className="mb-1 text-[9px] font-semibold uppercase tracking-[0.08em] text-muted">
        Activer avec une durée
      </p>
      <div className="space-y-1.5">
        {ORDRES.map((cible) => {
          const actuelle =
            statut !== "ESSAI" && offre === cible && statut === "ACTIF";
          return (
            <div key={cible} className="flex items-center gap-1.5">
              <span
                className={`w-[62px] shrink-0 text-[9.5px] font-semibold uppercase tracking-[0.06em] ${
                  actuelle ? "text-paye" : "text-muted"
                }`}
                title={`${OFFRES[cible].prix.toLocaleString("fr-FR")} F / mois`}
              >
                {cible}
                {actuelle ? " ✓" : ""}
              </span>
              <Bouton
                type="button"
                taille="sm"
                variante={actuelle ? "succes" : "secondaire"}
                disabled={occupe}
                onClick={() => activer(cible, 1)}
                title={`Activer ${cible} 1 mois (${OFFRES[cible].prix.toLocaleString("fr-FR")} F)`}
                className="flex-1"
              >
                {enCours === `${cible}-1` ? (
                  <Loader2 size={12} className="animate-spin" aria-hidden />
                ) : (
                  <ShieldCheck size={12} aria-hidden />
                )}
                1 mois
              </Bouton>
              <Bouton
                type="button"
                taille="sm"
                variante="fantome"
                disabled={occupe}
                onClick={() => activer(cible, 3)}
                title={`Activer ${cible} 3 mois`}
                className="flex-1"
              >
                {enCours === `${cible}-3` ? (
                  <Loader2 size={12} className="animate-spin" aria-hidden />
                ) : (
                  <CalendarPlus size={12} aria-hidden />
                )}
                3 mois
              </Bouton>
            </div>
          );
        })}
      </div>

      {statut !== "BLOQUE" ? (
        <Bouton
          type="button"
          taille="sm"
          variante="danger"
          disabled={occupe}
          onClick={() => setBlocageOuvert(true)}
          title="Couper immédiatement l'accès à l'application"
          className="mt-2 w-full"
        >
          <Ban size={12} aria-hidden />
          Bloquer
        </Bouton>
      ) : (
        <p className="mt-2 text-[10.5px] font-medium text-impaye">
          École bloquée — activez une offre pour la rouvrir.
        </p>
      )}

      {erreur && (
        <p role="alert" className="mt-2 text-[11.5px] font-medium text-impaye">
          {erreur}
        </p>
      )}
      {succes && (
        <p role="status" className="mt-2 text-[11.5px] font-medium text-paye">
          {succes}
        </p>
      )}

      <Dialogue
        ouvert={blocageOuvert}
        onFermer={() => setBlocageOuvert(false)}
        titre={`Bloquer ${nom} ?`}
        description="L'école ne pourra plus accéder au tableau de bord, aux élèves ni aux paiements. Vous pourrez la réactiver à tout moment : aucune donnée n'est supprimée."
      >
        <div className="space-y-4">
          {erreur && <Alerte>{erreur}</Alerte>}
          <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
            <Bouton
              type="button"
              variante="secondaire"
              onClick={() => setBlocageOuvert(false)}
              disabled={occupe}
            >
              Annuler
            </Bouton>
            <Bouton
              type="button"
              variante="danger"
              onClick={bloquer}
              disabled={occupe}
            >
              {enCours === "bloquer" ? (
                <Loader2 size={14} className="animate-spin" aria-hidden />
              ) : (
                <Ban size={14} aria-hidden />
              )}
              Confirmer le blocage
            </Bouton>
          </div>
        </div>
      </Dialogue>
    </div>
  );
}
