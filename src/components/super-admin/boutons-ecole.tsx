"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Ban, CalendarPlus, Loader2, ShieldCheck, Unlock } from "lucide-react";
import {
  activerPremium1Mois,
  activerPremiumAnnee,
  activerStandard1Mois,
  activerStandardAnnee,
  activerStarter1Mois,
  activerStarterAnnee,
  bloquerEcole,
  changerOffre,
  debloquerEcole,
} from "@/lib/actions/super-admin";
import { OFFRES } from "@/lib/offres";
import type { Offre } from "@/lib/types";
import { Bouton } from "@/components/ui/button";
import { Dialogue } from "@/components/ui/dialogue";
import { Alerte } from "@/components/ui/empty-state";
import { cx } from "@/lib/cx";

type ActionPaiement = (
  id: string,
) => Promise<{ error?: string; success?: string }>;

const ACTIONS: Record<Offre, { mois: ActionPaiement; annee: ActionPaiement }> = {
  STARTER: { mois: activerStarter1Mois, annee: activerStarterAnnee },
  STANDARD: { mois: activerStandard1Mois, annee: activerStandardAnnee },
  PREMIUM: { mois: activerPremium1Mois, annee: activerPremiumAnnee },
};

const ORDRES: Offre[] = ["STARTER", "STANDARD", "PREMIUM"];

function fcfa(valeur: number): string {
  return `${valeur.toLocaleString("fr-FR").replace(/\u202f/g, " ")} F`;
}

/** Encaissement mensuel/annuel, bascule d'offre et blocage — super admin. */
export function BoutonsEcole({
  ecoleId,
  nom,
  statut,
  offre,
  lectureSeule,
  dateFin,
}: {
  ecoleId: string;
  nom: string;
  statut: "ESSAI" | "ACTIF" | "BLOQUE";
  offre: Offre;
  lectureSeule: boolean;
  dateFin: string | null;
}) {
  const router = useRouter();
  const [enCours, setEnCours] = useState<string | null>(null);
  const [erreur, setErreur] = useState<string>();
  const [succes, setSucces] = useState<string>();
  const [blocageOuvert, setBlocageOuvert] = useState(false);

  async function encaisser(cible: Offre, duree: "mois" | "annee") {
    setErreur(undefined);
    setSucces(undefined);
    setEnCours(`${cible}-${duree}`);

    const resultat = await ACTIONS[cible][duree](ecoleId);

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

  async function debloquer() {
    setErreur(undefined);
    setSucces(undefined);
    setEnCours("debloquer");

    const resultat = await debloquerEcole(ecoleId);

    setEnCours(null);
    if (resultat.error) {
      setErreur(resultat.error);
      return;
    }
    setSucces(resultat.success);
    router.refresh();
  }

  const occupe = enCours !== null;

  return (
    <div className="min-w-[300px]">
      <p className="mb-1 text-[9px] font-semibold uppercase tracking-[0.08em] text-muted">
        Basculer l&apos;offre · 1 clic
      </p>
      <div className="grid grid-cols-3 gap-1 rounded-sm border border-line bg-surface-2 p-1">
        {ORDRES.map((cible) => {
          const actif = !lectureSeule && offre === cible;
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
                  : `Passer immédiatement en ${cible} (${fcfa(OFFRES[cible].prix)} / mois)`
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
        Effet immédiat, sans reconnexion. Ne change ni la date de fin ni le
        statut de paiement.
      </p>

      <p className="mb-1 text-[9px] font-semibold uppercase tracking-[0.08em] text-muted">
        Encaisser un paiement
      </p>
      <div className="space-y-1.5">
        {ORDRES.map((cible) => {
          const actuelle = !lectureSeule && offre === cible && statut !== "ESSAI";
          return (
            <div key={cible} className="flex items-center gap-1.5">
              <span
                className={`w-[62px] shrink-0 text-[9.5px] font-semibold uppercase tracking-[0.06em] ${
                  actuelle ? "text-paye" : "text-muted"
                }`}
                title={`${fcfa(OFFRES[cible].prix)} / mois`}
              >
                {cible}
                {actuelle ? " ✓" : ""}
              </span>
              <Bouton
                type="button"
                taille="sm"
                variante={actuelle ? "succes" : "secondaire"}
                disabled={occupe}
                onClick={() => encaisser(cible, "mois")}
                title={`Encaisser 1 mois de ${cible} (${fcfa(OFFRES[cible].prix)})`}
                className="flex-1"
              >
                {enCours === `${cible}-mois` ? (
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
                onClick={() => encaisser(cible, "annee")}
                title={`Encaisser l'année scolaire : 9 mois payés = 12 mois d'accès (${fcfa(OFFRES[cible].prixAnnuel)})`}
                className="flex-1"
              >
                {enCours === `${cible}-annee` ? (
                  <Loader2 size={12} className="animate-spin" aria-hidden />
                ) : (
                  <CalendarPlus size={12} aria-hidden />
                )}
                Année
              </Bouton>
            </div>
          );
        })}
      </div>

      <p className="mt-2 text-[9.5px] leading-tight text-muted">
        Année scolaire : 9 mois payés, 12 mois d&apos;accès. Le paiement part de
        la fin de la période en cours.
        {dateFin ? ` Fin actuelle : ${dateFin}.` : ""}
      </p>

      {lectureSeule || statut === "BLOQUE" ? (
        <Bouton
          type="button"
          taille="sm"
          variante="secondaire"
          disabled={occupe}
          onClick={debloquer}
          title="Rétablir les modifications sans encaisser de paiement"
          className="mt-2 w-full"
        >
          {enCours === "debloquer" ? (
            <Loader2 size={12} className="animate-spin" aria-hidden />
          ) : (
            <Unlock size={12} aria-hidden />
          )}
          Débloquer (lecture seule)
        </Bouton>
      ) : (
        <Bouton
          type="button"
          taille="sm"
          variante="danger"
          disabled={occupe}
          onClick={() => setBlocageOuvert(true)}
          title="Passer immédiatement le compte en lecture seule"
          className="mt-2 w-full"
        >
          <Ban size={12} aria-hidden />
          Bloquer
        </Bouton>
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
        titre={`Passer ${nom} en lecture seule ?`}
        description="Le directeur pourra encore consulter ses élèves, paiements et notes, mais plus rien modifier. Aucune donnée n'est supprimée : un paiement encaissé rétablit immédiatement l'accès complet."
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
