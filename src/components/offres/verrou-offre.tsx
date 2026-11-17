import Link from "next/link";
import { ArrowRight, Check, LockKeyhole, MessageCircle } from "lucide-react";
import {
  COMMERCIAL,
  lienWhatsAppCommercial,
} from "@/lib/config";
import {
  OFFRES,
  offreRequise,
  type CleFonctionnalite,
} from "@/lib/offres";
import type { Offre } from "@/lib/types";
import { formatFCFA } from "@/lib/format";

/**
 * Écran affiché lorsqu'une fonctionnalité n'est pas incluse dans l'offre
 * active. Aucune donnée n'est supprimée : le module réapparaît dès que le
 * super admin active l'offre supérieure.
 */
export function VerrouOffre({
  titre,
  description,
  cle,
  offreActuelle,
  fonctionnalites,
}: {
  titre: string;
  description: string;
  cle: CleFonctionnalite;
  offreActuelle: Offre;
  fonctionnalites?: string[];
}) {
  const requise = offreRequise(cle);
  const info = OFFRES[requise];
  const message = `Bonjour SCHOOL PAY, je souhaite passer à l'offre ${requise} pour débloquer ${titre}.`;

  return (
    <div className="mx-auto max-w-2xl py-8">
      <section className="card overflow-hidden">
        <div className="border-b border-line bg-surface-2 px-5 py-6 sm:px-7">
          <span className="inline-flex items-center gap-1.5 rounded-full border border-ochre/30 bg-[#fbf1de] px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.1em] text-[#7a5010]">
            <LockKeyhole size={11} aria-hidden />
            Offre {requise} requise
          </span>
          <h1 className="mt-3 text-[22px] font-semibold tracking-[-0.03em] text-ink">
            {titre}
          </h1>
          <p className="mt-1.5 text-[13px] leading-relaxed text-muted">
            {description}
          </p>
        </div>

        <div className="space-y-5 px-5 py-6 sm:px-7">
          <p className="text-[12.5px] leading-relaxed text-ink-2">
            Votre offre actuelle est <strong>{offreActuelle}</strong>. Cette
            fonctionnalité fait partie de l&apos;offre{" "}
            <strong>{info.nom}</strong> à {formatFCFA(info.prix)} par mois. Le
            super admin peut l&apos;activer immédiatement : aucune réinstallation
            et aucune donnée n&apos;est supprimée.
          </p>

          <ul className="space-y-2 rounded-sm border border-line bg-surface-2 p-4">
            {(fonctionnalites ?? info.fonctionnalites).map((element) => (
              <li
                key={element}
                className="flex items-start gap-2 text-[12.5px] leading-relaxed text-ink-2"
              >
                <Check size={13} className="mt-0.5 shrink-0 text-paye" aria-hidden />
                {element}
              </li>
            ))}
          </ul>

          <div className="flex flex-col gap-2 sm:flex-row">
            <Link
              href="/app/parametres#abonnement"
              className="inline-flex h-10 flex-1 items-center justify-center gap-2 rounded-sm bg-brand px-4 text-[13px] font-semibold text-white transition-colors hover:bg-brand-deep"
            >
              Voir les offres et les prix
              <ArrowRight size={14} aria-hidden />
            </Link>
            <a
              href={lienWhatsAppCommercial(message)}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex h-10 flex-1 items-center justify-center gap-2 rounded-sm border border-paye/25 bg-paye-soft px-4 text-[13px] font-semibold text-paye transition-colors hover:bg-paye/10"
            >
              <MessageCircle size={14} aria-hidden />
              Demander l&apos;activation
            </a>
          </div>

          <p className="text-[11px] leading-relaxed text-muted">
            Paiement Flooz ou TMoney au{" "}
            <strong className="chiffre text-ink">{COMMERCIAL.whatsappAffichage}</strong>,
            puis capture envoyée sur WhatsApp ou par email à{" "}
            {COMMERCIAL.email} en précisant l&apos;offre choisie.
          </p>
        </div>
      </section>
    </div>
  );
}
