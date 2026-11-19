"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import {
  CheckCircle2,
  ExternalLink,
  Loader2,
  MessageCircle,
  Send,
  TriangleAlert,
} from "lucide-react";
import { publierBulletins } from "@/lib/actions/portail";
import { cx } from "@/lib/cx";

export type EnvoiAffiche = {
  eleve_id: string;
  eleve_nom: string;
  eleve_prenom: string;
  statut: "EN_ATTENTE" | "LIEN_PRET" | "ENVOYE" | "ECHEC";
  url_whatsapp: string | null;
  erreur: string | null;
  envoye_le: string | null;
};

const LIBELLES: Record<EnvoiAffiche["statut"], string> = {
  EN_ATTENTE: "En attente",
  LIEN_PRET: "Lien prêt",
  ENVOYE: "Envoyé",
  ECHEC: "Échec",
};

const STYLES: Record<EnvoiAffiche["statut"], string> = {
  EN_ATTENTE: "border-line bg-surface-2 text-muted",
  LIEN_PRET: "border-ochre/30 bg-[#fbf6ea] text-[#7a5010]",
  ENVOYE: "border-paye/25 bg-paye-soft text-paye",
  ECHEC: "border-impaye/25 bg-impaye-soft text-impaye",
};

/**
 * Publication des bulletins sur le portail parent et envoi WhatsApp.
 * L'envoi automatique WhatsApp est réservé au PREMIUM.
 */
export function PublicationBulletins({
  classeId,
  classeNom,
  trimestre,
  annee,
  nombreEleves,
  envoiAutomatique,
  envois,
}: {
  classeId: string;
  classeNom: string;
  trimestre: number;
  annee: string;
  nombreEleves: number;
  envoiAutomatique: boolean;
  envois: EnvoiAffiche[];
}) {
  const router = useRouter();
  const [enCours, demarrer] = useTransition();
  const [erreur, setErreur] = useState<string>();
  const [succes, setSucces] = useState<string>();

  const envoyes = envois.filter((envoi) => envoi.statut === "ENVOYE").length;
  const liens = envois.filter((envoi) => envoi.statut === "LIEN_PRET").length;
  const echecs = envois.filter((envoi) => envoi.statut === "ECHEC").length;

  function publier() {
    setErreur(undefined);
    setSucces(undefined);

    const donnees = new FormData();
    donnees.set("classe_id", classeId);
    donnees.set("trimestre", String(trimestre));
    donnees.set("annee", annee);

    demarrer(async () => {
      const resultat = await publierBulletins(donnees);
      if (resultat.error) {
        setErreur(resultat.error);
        return;
      }
      setSucces(resultat.success);
      router.refresh();
    });
  }

  return (
    <section className="sans-impression card mb-4 overflow-hidden">
      <div className="flex flex-wrap items-start justify-between gap-3 border-b border-line px-4 py-3.5 sm:px-5">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <h2 className="text-[13.5px] font-semibold text-ink">
              {envoiAutomatique
                ? "Publier et envoyer les bulletins sur WhatsApp"
                : "Publier les bulletins sur le portail parent"}
            </h2>
            <span
              className={cx(
                "rounded-full border px-2 py-0.5 text-[10px] font-semibold uppercase tracking-[0.06em]",
                envoiAutomatique
                  ? "border-brand/25 bg-brand-soft text-brand"
                  : "border-line-strong bg-surface-2 text-muted",
              )}
            >
              {envoiAutomatique ? "PREMIUM" : "Portail"}
            </span>
          </div>
          <p className="mt-1 max-w-2xl text-[11.5px] leading-relaxed text-muted">
            {classeNom} · {nombreEleves} élève{nombreEleves > 1 ? "s" : ""} ·
            trimestre {trimestre}.{" "}
            {envoiAutomatique
              ? "Chaque parent reçoit le lien de la fiche et le bulletin PDF sur son WhatsApp."
              : "Les parents accèdent aux notes via le lien public de l'école. L'envoi automatique du PDF sur WhatsApp est inclus dans l'offre PREMIUM."}
          </p>
        </div>

        <button
          type="button"
          onClick={publier}
          disabled={enCours}
          className="inline-flex h-9 shrink-0 items-center justify-center gap-1.5 rounded-sm bg-brand px-3.5 text-[11.5px] font-semibold text-white transition-colors hover:bg-brand-deep disabled:opacity-60"
        >
          {enCours ? (
            <Loader2 size={14} className="animate-spin" aria-hidden />
          ) : envoiAutomatique ? (
            <Send size={14} aria-hidden />
          ) : (
            <CheckCircle2 size={14} aria-hidden />
          )}
          {enCours
            ? "Publication…"
            : envoiAutomatique
              ? "PUBLIER ET ENVOYER SUR WHATSAPP"
              : "PUBLIER SUR LE PORTAIL"}
        </button>
      </div>

      {(erreur || succes) && (
        <div className="border-b border-line px-4 py-3 sm:px-5">
          {erreur && (
            <p className="flex items-start gap-2 text-[12px] leading-relaxed text-impaye">
              <TriangleAlert size={14} className="mt-0.5 shrink-0" aria-hidden />
              {erreur}
            </p>
          )}
          {succes && !erreur && (
            <p className="flex items-start gap-2 text-[12px] leading-relaxed text-paye">
              <CheckCircle2 size={14} className="mt-0.5 shrink-0" aria-hidden />
              {succes}
            </p>
          )}
        </div>
      )}

      {envois.length > 0 && (
        <div className="px-4 py-3.5 sm:px-5">
          <div className="flex flex-wrap items-center gap-3 text-[11px] text-muted">
            {envoiAutomatique && (
              <span className="font-semibold text-paye">{envoyes} envoyé(s)</span>
            )}
            {liens > 0 && (
              <span className="font-semibold text-[#7a5010]">
                {liens} lien(s) prêt(s)
              </span>
            )}
            {echecs > 0 && (
              <span className="font-semibold text-impaye">
                {echecs} échec(s)
              </span>
            )}
          </div>

          <ul className="mt-2 divide-y divide-line overflow-hidden rounded-sm border border-line">
            {envois.map((envoi) => (
              <li
                key={envoi.eleve_id}
                className="flex flex-wrap items-center justify-between gap-2 bg-surface px-3.5 py-2.5"
              >
                <span className="min-w-0 text-[12px] font-medium text-ink">
                  {envoi.eleve_prenom} {envoi.eleve_nom}
                  {envoi.erreur && envoi.statut === "ECHEC" && (
                    <span className="mt-0.5 block max-w-md truncate text-[10.5px] font-normal text-impaye">
                      {envoi.erreur}
                    </span>
                  )}
                </span>
                <span className="flex shrink-0 items-center gap-2">
                  <span
                    className={cx(
                      "inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[10px] font-semibold",
                      STYLES[envoi.statut],
                    )}
                  >
                    {LIBELLES[envoi.statut]}
                  </span>
                  {envoi.url_whatsapp && envoi.statut !== "ENVOYE" && (
                    <a
                      href={envoi.url_whatsapp}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1 text-[10.5px] font-semibold text-paye hover:underline"
                    >
                      <MessageCircle size={11} aria-hidden />
                      Ouvrir WhatsApp
                      <ExternalLink size={10} aria-hidden />
                    </a>
                  )}
                </span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </section>
  );
}
