import Link from "next/link";
import { ArrowLeft, Check, MessageCircle, ShieldCheck, Wallet } from "lucide-react";
import { Logo } from "@/components/ui/logo";

export default function LayoutAuth({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="min-h-dvh bg-canvas lg:grid lg:grid-cols-[minmax(0,1fr)_minmax(480px,44%)]">
      {/* Panneau de marque — desktop */}
      <aside className="relative hidden overflow-hidden bg-brand-deep lg:flex lg:flex-col lg:justify-between lg:p-12">
        <div className="absolute inset-x-0 top-0 flex h-1">
          <span className="flex-1 bg-[#006a4e]" />
          <span className="flex-1 bg-[#ffce00]" />
          <span className="flex-1 bg-[#d21034]" />
        </div>

        <div>
          <Link
            href="/"
            aria-label="Retour à l'accueil"
            className="inline-block rounded-md bg-white px-4 py-2.5 shadow-sm"
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src="/logo-school-pay.png"
              alt="SCHOOL PAY — Apprendre, réussir, payer facilement"
              width={230}
              height={153}
              className="h-auto w-[230px]"
            />
          </Link>

          <p className="mt-16 max-w-md text-[11px] font-semibold uppercase tracking-[0.18em] text-white/45">
            Frais de scolarité · Lomé
          </p>
          <h1 className="mt-4 max-w-md text-[34px] font-semibold leading-[1.15] tracking-[-0.03em] text-white">
            Le cahier de frais, sans les litiges.
          </h1>
          <p className="mt-4 max-w-md text-[14px] leading-relaxed text-white/65">
            Encaissez, imprimez le reçu, envoyez-le sur WhatsApp. Le directeur
            voit ce qui est rentré, ce qui manque, et qui relancer.
          </p>

          <ul className="mt-8 space-y-3.5">
            {[
              {
                icone: MessageCircle,
                texte: "Reçu WhatsApp au parent après chaque paiement",
              },
              {
                icone: Wallet,
                texte: "Montant encaissé et impayés, mois par mois",
              },
              {
                icone: ShieldCheck,
                texte: "Chaque école ne voit que ses propres données",
              },
            ].map(({ icone: Icone, texte }) => (
              <li key={texte} className="flex items-center gap-3 text-[13.5px] text-white/80">
                <span className="grid size-7 shrink-0 place-items-center rounded-full border border-white/15 bg-white/5">
                  <Icone size={14} className="text-[#ffce00]" aria-hidden />
                </span>
                {texte}
              </li>
            ))}
          </ul>
        </div>

        {/* Mini reçu — illustre le produit sans capture d'écran lourde */}
        <div className="mt-12 max-w-[340px] rounded-md border border-white/12 bg-white/[0.04]">
          <div className="flex items-center justify-between border-b border-dashed border-white/15 px-4 py-3">
            <span className="text-[10px] font-semibold uppercase tracking-[0.14em] text-white/45">
              Reçu de caisse
            </span>
            <span className="font-mono text-[10.5px] text-white/70">REC-2026-00042</span>
          </div>
          <div className="space-y-2 px-4 py-4 text-[12px]">
            <div className="flex justify-between text-white/55">
              <span>Élève</span>
              <span className="text-white">Kossi Adjovi</span>
            </div>
            <div className="flex justify-between text-white/55">
              <span>Classe</span>
              <span className="text-white">6ème A</span>
            </div>
            <div className="flex justify-between text-white/55">
              <span>Novembre</span>
              <span className="font-mono text-white">25 000 F</span>
            </div>
            <div className="mt-3 flex items-center justify-between border-t border-white/12 pt-3">
              <span className="inline-flex items-center gap-1.5 text-[11px] text-[#7ddba4]">
                <Check size={13} aria-hidden /> Payé
              </span>
              <span className="inline-flex items-center gap-1.5 text-[11px] text-[#ffce00]">
                <MessageCircle size={13} aria-hidden /> WhatsApp envoyé
              </span>
            </div>
          </div>
        </div>

        <p className="mt-8 text-[11px] text-white/35">
          SCHOOL PAY · Conçu pour les écoles privées du Togo
        </p>
      </aside>

      {/* Formulaire */}
      <main className="flex min-h-dvh flex-col">
        <div className="flex items-center justify-between border-b border-line bg-brand-deep px-5 py-4 lg:hidden">
          <Link href="/" aria-label="Retour à l'accueil">
            <Logo ton="clair" />
          </Link>
          <Link
            href="/"
            className="inline-flex items-center gap-1.5 text-[12px] font-medium text-white/70 hover:text-white"
          >
            <ArrowLeft size={14} aria-hidden /> Accueil
          </Link>
        </div>

        <div className="flex flex-1 items-center justify-center px-5 py-10 sm:px-8 lg:py-16">
          <div className="w-full max-w-[420px]">{children}</div>
        </div>

        <div className="px-5 pb-6 text-center lg:px-8">
          <p className="text-[11.5px] text-muted">
            © {new Date().getFullYear()} SCHOOL PAY · Lomé, Togo
          </p>
        </div>
      </main>
    </div>
  );
}
