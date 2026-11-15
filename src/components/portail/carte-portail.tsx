import Link from "next/link";
import {
  ArrowUpRight,
  MessageCircle,
  QrCode,
  ShieldCheck,
  Smartphone,
} from "lucide-react";
import { BoutonCopierLien } from "./bouton-copier";
import { LienBouton } from "@/components/ui/button";

/**
 * Carte du tableau de bord : lien public, copie, partage WhatsApp et QR code.
 * Réservée aux offres qui incluent le portail parent.
 */
export function CartePortailParent({
  slug,
  lien,
  message,
  qrDataUrl,
  envoiAutomatique,
}: {
  slug: string;
  lien: string;
  message: string;
  qrDataUrl: string;
  envoiAutomatique: boolean;
}) {
  const lienAffiche = lien.replace(/^https?:\/\//, "");
  const lienWhatsApp = `https://wa.me/?text=${encodeURIComponent(message)}`;

  return (
    <section className="mt-5 overflow-hidden rounded-lg border border-brand/20 bg-surface">
      <div className="grid lg:grid-cols-[1.45fr_0.75fr]">
        <div className="p-5 sm:p-6">
          <div className="flex flex-wrap items-center gap-2">
            <span className="inline-flex items-center gap-1.5 rounded-full border border-brand/25 bg-brand-soft px-2.5 py-0.5 text-[10px] font-semibold uppercase tracking-[0.08em] text-brand">
              <Smartphone size={11} aria-hidden />
              Portail parent
            </span>
            <span className="inline-flex items-center gap-1 text-[10.5px] text-muted">
              <ShieldCheck size={12} aria-hidden />
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

          <div className="mt-4 flex items-center gap-2 rounded-sm border border-line-strong bg-surface-2 px-3 py-2.5">
            <span className="min-w-0 flex-1 break-all font-mono text-[11.5px] text-ink-2">
              {lienAffiche}
            </span>
            <Link
              href={`/parent/${slug}`}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex shrink-0 items-center gap-1 text-[11px] font-semibold text-brand hover:underline"
            >
              Ouvrir
              <ArrowUpRight size={12} aria-hidden />
            </Link>
          </div>

          <div className="mt-3 flex flex-wrap gap-2">
            <BoutonCopierLien lien={lien} />
            <a
              href={lienWhatsApp}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex h-9 items-center justify-center gap-1.5 rounded-sm border border-paye/30 bg-paye-soft px-3 text-[11.5px] font-semibold text-paye transition-colors hover:bg-paye/10"
            >
              <MessageCircle size={14} aria-hidden />
              PARTAGER SUR WHATSAPP
            </a>
            <LienBouton
              href="/app/portail/affiche"
              variante="secondaire"
              taille="sm"
              className="h-9 text-[11.5px]"
            >
              <QrCode size={14} aria-hidden />
              Affiche + QR code
            </LienBouton>
          </div>

          <p className="mt-3 text-[10.5px] leading-relaxed text-muted">
            {envoiAutomatique
              ? "Offre PREMIUM : le bulletin PDF est aussi envoyé sur le WhatsApp du parent lors de la publication des notes."
              : "Partage du lien et QR code inclus. L'envoi automatique des bulletins est réservé au PREMIUM."}
          </p>
        </div>

        <div className="flex flex-row items-center gap-4 border-t border-line bg-surface-2 px-5 py-4 lg:flex-col lg:justify-center lg:border-l lg:border-t-0">
          {qrDataUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={qrDataUrl}
              alt="QR code du portail parent"
              className="size-24 rounded-sm border border-line bg-white p-1 sm:size-28"
            />
          ) : (
            <span className="grid size-24 place-items-center rounded-sm border border-line bg-white text-muted sm:size-28">
              <QrCode size={32} aria-hidden />
            </span>
          )}
          <div className="min-w-0 lg:text-center">
            <p className="text-[10px] font-semibold uppercase tracking-[0.1em] text-muted">
              QR code d&apos;entrée
            </p>
            <p className="mt-1 text-[11px] leading-relaxed text-ink-2">
              À imprimer et coller à l&apos;entrée de l&apos;école.
            </p>
          </div>
        </div>
      </div>
    </section>
  );
}
