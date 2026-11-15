"use client";

import { useState } from "react";
import {
  AlertTriangle,
  CheckCircle2,
  Download,
  Loader2,
  MonitorDown,
  Power,
  RefreshCw,
} from "lucide-react";
import type { StatutMiseAJour } from "@/types/desktop";
import { Bouton, LienBouton } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useEtatBureau } from "./use-etat-bureau";

const LIBELLES: Record<StatutMiseAJour, string> = {
  inactif: "Prêt",
  verification: "Vérification",
  "a-jour": "À jour",
  disponible: "Mise à jour trouvée",
  telechargement: "Téléchargement",
  pret: "Prête à installer",
  erreur: "Vérification impossible",
  indisponible: "Version de développement",
};

const TONS: Record<
  StatutMiseAJour,
  "neutre" | "brand" | "ochre" | "succes"
> = {
  inactif: "neutre",
  verification: "brand",
  "a-jour": "succes",
  disponible: "ochre",
  telechargement: "ochre",
  pret: "succes",
  erreur: "neutre",
  indisponible: "neutre",
};

/**
 * Carte « Application bureau » de la page Paramètres.
 * Sur le web, elle propose le téléchargement du .exe.
 * Dans l'application Windows, elle affiche la version et gère les mises à jour.
 */
export function EtatBureau() {
  const etat = useEtatBureau();
  const [action, setAction] = useState<"verifier" | "installer" | null>(null);

  // Variable publique inlinée par Next.js au build (accès littéral obligatoire).
  const lienTelechargement =
    process.env.NEXT_PUBLIC_DESKTOP_DOWNLOAD_URL || null;

  // ---------------- Version web ----------------
  if (etat === false) {
    return (
      <section className="rounded-md border border-line bg-surface p-4">
        <div className="flex items-start gap-3">
          <span className="grid size-9 shrink-0 place-items-center rounded-sm border border-line bg-surface-2 text-brand">
            <MonitorDown size={16} aria-hidden />
          </span>
          <div className="min-w-0">
            <h2 className="text-[13px] font-semibold text-ink">
              Application Windows
            </h2>
            <p className="mt-1 text-[11.5px] leading-relaxed text-muted">
              Vous utilisez la version web. L&apos;application de bureau
              s&apos;installe en un clic et se met à jour toute seule : vous
              n&apos;aurez jamais à réinstaller la V2.
            </p>
            {lienTelechargement ? (
              <LienBouton
                href={lienTelechargement}
                variante="secondaire"
                taille="sm"
                className="mt-3"
                target="_blank"
                rel="noopener noreferrer"
              >
                <Download size={13} aria-hidden />
                Télécharger le .exe
              </LienBouton>
            ) : (
              <p className="mt-2 text-[11px] italic text-muted">
                Le lien de téléchargement sera publié ici.
              </p>
            )}
          </div>
        </div>
      </section>
    );
  }

  // ---------------- Détection en cours ----------------
  if (etat === null) return null;

  // ---------------- Application de bureau ----------------
  const occupe =
    etat.statut === "verification" ||
    etat.statut === "telechargement" ||
    action !== null;

  async function verifier() {
    const pont = window.ecolepayDesktop;
    if (!pont) return;
    setAction("verifier");
    try {
      await pont.verifierMisesAJour();
    } finally {
      setAction(null);
    }
  }

  async function installer() {
    const pont = window.ecolepayDesktop;
    if (!pont) return;
    setAction("installer");
    const lance = await pont.installerMiseAJour();
    if (!lance) setAction(null);
  }

  return (
    <section className="overflow-hidden rounded-md border border-line bg-surface">
      <div className="border-b border-line px-4 py-3.5">
        <div className="flex items-start justify-between gap-2">
          <h2 className="flex items-center gap-2 text-[14px] font-semibold text-ink">
            <MonitorDown size={15} className="text-muted" aria-hidden />
            Application bureau
          </h2>
          <Badge ton={TONS[etat.statut]}>{LIBELLES[etat.statut]}</Badge>
        </div>
        <p className="mt-0.5 text-[11.5px] text-muted">
          Version installée :{" "}
          <span className="chiffre text-ink-2">{etat.version}</span>
          {etat.versionDisponible && etat.statut !== "a-jour" && (
            <>
              {" "}
              · disponible :{" "}
              <span className="chiffre text-ink-2">
                {etat.versionDisponible}
              </span>
            </>
          )}
        </p>
      </div>

      <div className="p-4">
        <p className="flex items-start gap-2 text-[11.5px] leading-relaxed text-muted">
          {etat.statut === "pret" ? (
            <CheckCircle2 size={14} className="mt-0.5 shrink-0 text-paye" aria-hidden />
          ) : etat.statut === "erreur" ? (
            <AlertTriangle size={14} className="mt-0.5 shrink-0 text-impaye" aria-hidden />
          ) : (
            <RefreshCw size={14} className="mt-0.5 shrink-0 text-muted" aria-hidden />
          )}
          <span>{etat.message}</span>
        </p>

        {(etat.statut === "telechargement" || etat.statut === "disponible") && (
          <div className="mt-3">
            <div className="h-1.5 w-full overflow-hidden rounded-full bg-line">
              <span
                className="block h-full rounded-full bg-brand transition-[width] duration-300"
                style={{ width: `${Math.max(4, etat.progression)}%` }}
              />
            </div>
            <p className="chiffre mt-1 text-right text-[10.5px] text-muted">
              {etat.progression} %
            </p>
          </div>
        )}

        <div className="mt-3 flex flex-wrap items-center gap-2">
          {etat.statut === "pret" ? (
            <Bouton
              taille="sm"
              onClick={installer}
              disabled={action === "installer"}
            >
              {action === "installer" ? (
                <Loader2 size={13} className="animate-spin" aria-hidden />
              ) : (
                <Power size={13} aria-hidden />
              )}
              Redémarrer et installer
            </Bouton>
          ) : null}

          <Bouton
            variante="secondaire"
            taille="sm"
            onClick={verifier}
            disabled={occupe}
          >
            {etat.statut === "verification" || action === "verifier" ? (
              <Loader2 size={13} className="animate-spin" aria-hidden />
            ) : (
              <RefreshCw size={13} aria-hidden />
            )}
            Vérifier les mises à jour
          </Bouton>
        </div>

        <p className="mt-3 border-t border-line pt-3 text-[10.5px] leading-relaxed text-muted">
          Les écrans et les corrections arrivent automatiquement, sans
          téléchargement. Seule cette coque Windows se met à jour ici — jamais
          besoin de réinstaller la V2.
        </p>
      </div>
    </section>
  );
}
