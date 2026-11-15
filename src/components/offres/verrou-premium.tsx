"use client";

import { useState, type ReactNode } from "react";
import Link from "next/link";
import {
  ArrowRight,
  LockKeyhole,
  MessageCircle,
  QrCode,
  Smartphone,
} from "lucide-react";
import {
  MESSAGE_UPGRADE_PREMIUM,
  PRIX_PREMIUM_TEXTE,
} from "@/lib/offres";
import { Dialogue } from "@/components/ui/dialogue";
import { cx } from "@/lib/cx";

/**
 * Fenêtre de passage à PREMIUM.
 *
 * Utilisée par tous les boutons verrouillés de l'interface directeur. Le texte
 * est le message commercial exact demandé, avec le numéro Mobile Money et
 * l'email de contact.
 */
export function DialoguePremium({
  ouvert,
  onFermer,
  contexte,
}: {
  ouvert: boolean;
  onFermer: () => void;
  contexte?: string;
}) {
  return (
    <Dialogue
      ouvert={ouvert}
      onFermer={onFermer}
      titre={`Débloquer ${contexte ?? "cette fonctionnalité"}`}
      description={`Offre PREMIUM ${PRIX_PREMIUM_TEXTE} par mois`}
    >
      <div className="space-y-4">
        <div className="flex items-start gap-3 rounded-sm border border-ochre/25 bg-[#fbf6ea] px-4 py-3.5">
          <span className="grid size-9 shrink-0 place-items-center rounded-sm bg-[#7a5010] text-white">
            <LockKeyhole size={16} aria-hidden />
          </span>
          <p className="text-[12.5px] leading-relaxed text-[#7a5010]">
            {MESSAGE_UPGRADE_PREMIUM}
          </p>
        </div>

        <div className="grid gap-2 sm:grid-cols-2">
          <div className="rounded-sm border border-line bg-surface-2 px-3.5 py-3">
            <p className="flex items-center gap-1.5 text-[9.5px] font-semibold uppercase tracking-[0.1em] text-muted">
              <Smartphone size={11} aria-hidden />
              Mobile Money
            </p>
            <p className="chiffre mt-1 text-[14px] font-semibold text-ink">
              +228 70309744
            </p>
            <p className="mt-0.5 text-[10.5px] text-muted">Flooz / TMoney</p>
          </div>
          <div className="rounded-sm border border-line bg-surface-2 px-3.5 py-3">
            <p className="text-[9.5px] font-semibold uppercase tracking-[0.1em] text-muted">
              Email
            </p>
            <p className="mt-1 break-all text-[11.5px] font-semibold text-ink">
              follyfoliemmanuel@gmail.com
            </p>
            <p className="mt-0.5 text-[10.5px] text-muted">
              Nom de l&apos;école + capture
            </p>
          </div>
        </div>

        <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
          <button
            type="button"
            onClick={onFermer}
            className="inline-flex h-10 items-center justify-center rounded-sm border border-line-strong bg-surface px-4 text-[13px] font-semibold text-ink-2 transition-colors hover:bg-surface-2"
          >
            Plus tard
          </button>
          <Link
            href="/premium"
            onClick={onFermer}
            className="inline-flex h-10 items-center justify-center gap-2 rounded-sm bg-paye px-4 text-[13px] font-semibold text-white transition-colors hover:bg-paye/90"
          >
            <MessageCircle size={15} aria-hidden />
            JE VEUX PASSER PREMIUM
          </Link>
        </div>
      </div>
    </Dialogue>
  );
}

/**
 * Bouton générique verrouillé : ouvre la fenêtre PREMIUM au clic.
 * `apparence="nav"` reprend le style de la navigation latérale.
 */
export function DeclencheurPremium({
  children,
  className,
  contexte,
  ariaLabel,
  apparence = "bouton",
}: {
  children: ReactNode;
  className?: string;
  contexte?: string;
  ariaLabel?: string;
  apparence?: "bouton" | "nav" | "mobile";
}) {
  const [ouvert, setOuvert] = useState(false);
  return (
    <>
      <button
        type="button"
        onClick={() => setOuvert(true)}
        aria-haspopup="dialog"
        aria-label={ariaLabel}
        title={`PREMIUM ${PRIX_PREMIUM_TEXTE} — cliquer pour découvrir`}
        className={cx(
          apparence === "nav"
            ? "group flex h-10 w-full items-center gap-3 rounded-sm pl-3 pr-2 text-left text-[13px] font-medium text-white/35 transition-colors hover:bg-white/[0.05] hover:text-white/60"
            : apparence === "mobile"
              ? "flex min-w-[62px] shrink-0 flex-col items-center gap-1 rounded-sm pt-2 text-[9px] font-medium leading-tight text-muted"
              : "inline-flex items-center justify-center gap-1.5 rounded-sm border border-line-strong bg-surface-2 font-semibold text-muted transition-colors hover:border-ochre/40 hover:bg-[#fbf6ea] hover:text-[#7a5010]",
          className,
        )}
      >
        {children}
      </button>
      <DialoguePremium
        ouvert={ouvert}
        onFermer={() => setOuvert(false)}
        contexte={contexte}
      />
    </>
  );
}

const TAILLES = {
  sm: "h-8 px-2.5 text-[11.5px]",
  md: "h-10 px-4 text-[13px]",
  lg: "h-11 px-5 text-[14px]",
} as const;

/** Bouton grisé avec cadenas + mention PREMIUM. */
export function BoutonPremium({
  children,
  taille = "md",
  className,
  contexte,
}: {
  children: ReactNode;
  taille?: keyof typeof TAILLES;
  className?: string;
  contexte?: string;
}) {
  return (
    <DeclencheurPremium
      className={cx(TAILLES[taille], className)}
      contexte={contexte}
    >
      <LockKeyhole size={13} aria-hidden />
      {children}
      <span className="rounded-full border border-ochre/30 bg-[#fbf1de] px-1.5 py-0.5 text-[8.5px] font-bold uppercase tracking-[0.06em] text-[#7a5010]">
        PREMIUM
      </span>
    </DeclencheurPremium>
  );
}

/**
 * Carte « Portail parent » affichée en STARTER/PRO : le contenu est visible mais
 * grisé, les actions (portail, WhatsApp, QR code) ouvrent la fenêtre PREMIUM.
 */
export function CartePortailPremium({ ecole }: { ecole: string }) {
  return (
    <section className="mt-5 overflow-hidden rounded-lg border border-line bg-surface">
      <div className="grid lg:grid-cols-[1.45fr_0.75fr]">
        <div className="p-5 sm:p-6">
          <div className="flex flex-wrap items-center gap-2">
            <span className="inline-flex items-center gap-1.5 rounded-full border border-line-strong bg-surface-2 px-2.5 py-0.5 text-[10px] font-semibold uppercase tracking-[0.08em] text-muted">
              <LockKeyhole size={11} aria-hidden />
              Portail parent · PREMIUM
            </span>
            <span className="inline-flex items-center gap-1 text-[10.5px] text-muted">
              Sans compte, sans mot de passe
            </span>
          </div>

          <h2 className="mt-3 text-[18px] font-semibold leading-tight tracking-[-0.03em] text-ink sm:text-[20px]">
            Vos parents consultent les notes depuis leur téléphone
          </h2>
          <p className="mt-1.5 max-w-xl text-[12px] leading-relaxed text-muted">
            Un seul lien pour toute l&apos;école : le parent choisit la classe,
            tape le nom de son enfant et voit uniquement ses notes, sa moyenne,
            son rang, son bulletin PDF et ses paiements.
          </p>

          <div className="mt-4 flex items-center gap-2 rounded-sm border border-dashed border-line-strong bg-surface-2 px-3 py-2.5">
            <span className="min-w-0 flex-1 break-all font-mono text-[11.5px] text-muted">
              /parent/{ecole}
            </span>
            <span className="inline-flex shrink-0 items-center gap-1 text-[11px] font-semibold text-muted">
              <LockKeyhole size={11} aria-hidden />
              Verrouillé
            </span>
          </div>

          <div className="mt-3 flex flex-wrap gap-2">
            <BoutonPremium taille="sm" contexte="le portail parent">
              PORTAIL PARENT
            </BoutonPremium>
            <BoutonPremium taille="sm" contexte="l'envoi WhatsApp">
              <MessageCircle size={13} aria-hidden />
              ENVOYER SUR WHATSAPP
            </BoutonPremium>
            <BoutonPremium taille="sm" contexte="le QR code du portail">
              <QrCode size={13} aria-hidden />
              QR CODE
            </BoutonPremium>
          </div>

          <p className="mt-3 text-[10.5px] leading-relaxed text-muted">
            Inclus dans PREMIUM {PRIX_PREMIUM_TEXTE} : lien unique par école,
            recherche parent, notes, moyenne, rang, bulletin PDF, masquage d&apos;un
            élève et envoi automatique du bulletin sur WhatsApp.
          </p>
        </div>

        <div className="flex flex-row items-center gap-4 border-t border-line bg-surface-2 px-5 py-4 lg:flex-col lg:justify-center lg:border-l lg:border-t-0">
          <span className="grid size-24 place-items-center rounded-sm border border-dashed border-line-strong bg-surface text-muted sm:size-28">
            <LockKeyhole size={28} aria-hidden />
          </span>
          <div className="min-w-0 lg:text-center">
            <p className="text-[10px] font-semibold uppercase tracking-[0.1em] text-muted">
              QR code d&apos;entrée
            </p>
            <p className="mt-1 text-[11px] leading-relaxed text-muted">
              Disponible avec l&apos;offre PREMIUM.
            </p>
          </div>
        </div>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-2 border-t border-line px-5 py-3">
        <p className="text-[11.5px] text-muted">
          Cette fonctionnalité est réservée à l&apos;offre PREMIUM{" "}
          {PRIX_PREMIUM_TEXTE}.
        </p>
        <Link
          href="/premium"
          className="inline-flex items-center gap-1 text-[11.5px] font-semibold text-brand hover:underline"
        >
          Voir l&apos;offre PREMIUM
          <ArrowRight size={12} aria-hidden />
        </Link>
      </div>
    </section>
  );
}
