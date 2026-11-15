import Link from "next/link";
import type { ReactNode } from "react";
import {
  LogOut,
  Plus,
  Settings,
  ShieldCheck,
} from "lucide-react";
import { deconnecter } from "@/lib/actions/auth";
import { joursEssaiRestants } from "@/lib/data/ecole";
import { offreEffective } from "@/lib/offres";
import { LIBELLES_ROLE, type Session } from "@/lib/types";
import { Logo } from "@/components/ui/logo";
import { BanniereMiseAJour } from "@/components/desktop/banniere-maj";
import { NavigationLaterale, NavigationMobile } from "./navigation";
import { cx } from "@/lib/cx";

function AvatarEcole({
  session,
  taille = "md",
}: {
  session: Session;
  taille?: "sm" | "md";
}) {
  const initiales = session.ecole.nom
    .split(/\s+/)
    .slice(0, 2)
    .map((mot) => mot.charAt(0))
    .join("")
    .toUpperCase();

  return (
    <span
      className={cx(
        "grid shrink-0 place-items-center overflow-hidden rounded-sm border border-white/15 bg-white/10 font-semibold text-white",
        taille === "md" ? "size-9 text-[11px]" : "size-8 text-[10px]",
      )}
      aria-hidden
    >
      {session.ecole.logoUrl ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={session.ecole.logoUrl}
          alt=""
          className="size-full object-cover"
        />
      ) : (
        initiales
      )}
    </span>
  );
}

function BanniereEssai({ session }: { session: Session }) {
  const { statut, offre, dateFinEssai, dateFinAbonnement } = session.ecole;

  if (statut === "ACTIF") {
    const jours = joursEssaiRestants(dateFinAbonnement);
    if (jours === null || jours > 7) return null;

    return (
      <div className="mb-6 flex flex-wrap items-center justify-between gap-2 rounded-sm border border-impaye/25 bg-impaye-soft px-3.5 py-2.5 text-[12.5px] text-impaye">
        <p className="flex items-center gap-2">
          <ShieldCheck size={14} aria-hidden />
          Offre {offre} ·{" "}
          {jours > 0
            ? `expire dans ${jours} jour${jours > 1 ? "s" : ""}.`
            : "arrivée à échéance aujourd'hui."}
        </p>
        <Link
          href="/app/parametres#abonnement"
          className="font-semibold underline underline-offset-2 hover:no-underline"
        >
          Renouveler
        </Link>
      </div>
    );
  }

  if (statut !== "ESSAI") return null;
  const jours = joursEssaiRestants(dateFinEssai);

  return (
    <div
      className={cx(
        "mb-6 flex flex-wrap items-center justify-between gap-2 rounded-sm border px-3.5 py-2.5 text-[12.5px]",
        jours !== null && jours <= 5
          ? "border-impaye/25 bg-impaye-soft text-impaye"
          : "border-ochre/30 bg-[#fbf1de] text-[#7a5010]",
      )}
    >
      <p className="flex items-center gap-2">
        <ShieldCheck size={14} aria-hidden />
        {jours === null
          ? "Essai PREMIUM en cours · toutes les fonctions offertes"
          : jours > 0
            ? `Essai PREMIUM · ${jours} jour${jours > 1 ? "s" : ""} restant${jours > 1 ? "s" : ""} · toutes les fonctions offertes`
            : "Votre essai gratuit est terminé. Choisissez une offre pour continuer à encaisser."}
      </p>
      <Link
        href="/app/parametres#abonnement"
        className="font-semibold underline underline-offset-2 hover:no-underline"
      >
        Voir les offres
      </Link>
    </div>
  );
}

export function AppShell({
  session,
  children,
}: {
  session: Session;
  children: ReactNode;
}) {
  const offre = offreEffective(session.ecole);

  return (
    <div className="min-h-dvh lg:grid lg:grid-cols-[248px_minmax(0,1fr)]">
      {/* ---------------- Barre latérale (desktop) ---------------- */}
      <aside className="sticky top-0 hidden h-dvh flex-col border-r border-white/5 bg-brand-deep lg:flex">
        <div className="flex h-16 items-center border-b border-white/10 px-5">
          <Link href="/app" aria-label="Accueil ECOLE PAY">
            <Logo ton="clair" />
          </Link>
        </div>

        <div className="px-4 pt-5">
          <Link
            href="/app/paiements/nouveau"
            className="inline-flex h-10 w-full items-center justify-center gap-2 rounded-sm bg-[#ffce00] text-[13px] font-semibold text-brand-deep transition-colors hover:bg-[#f0c000]"
          >
            <Plus size={16} strokeWidth={2.4} aria-hidden />
            Encaisser un paiement
          </Link>
        </div>

        <NavigationLaterale offre={offre} />

        <div className="mt-auto border-t border-white/10 p-3">
          <div className="flex items-center gap-2.5 rounded-sm px-2 py-2">
            <AvatarEcole session={session} />
            <div className="min-w-0 flex-1">
              <p className="truncate text-[12px] font-semibold text-white">
                {session.ecole.nom}
              </p>
              <p className="truncate text-[10.5px] text-white/45">
                {LIBELLES_ROLE[session.role]} ·{" "}
                {session.ecole.statut === "ESSAI" ? "Essai PREMIUM" : offre}
              </p>
            </div>
          </div>

          <div className="mt-1 flex items-center gap-1">
            <Link
              href="/app/parametres"
              className="inline-flex h-8 flex-1 items-center gap-2 rounded-sm px-2 text-[11.5px] text-white/55 transition-colors hover:bg-white/[0.06] hover:text-white"
            >
              <Settings size={14} aria-hidden />
              Paramètres
            </Link>
            <form action={deconnecter}>
              <button
                type="submit"
                className="inline-flex size-8 items-center justify-center rounded-sm text-white/45 transition-colors hover:bg-white/[0.06] hover:text-white"
                aria-label="Se déconnecter"
                title="Se déconnecter"
              >
                <LogOut size={14} aria-hidden />
              </button>
            </form>
          </div>
        </div>
      </aside>

      {/* ---------------- Contenu ---------------- */}
      <div className="flex min-h-dvh flex-col">
        <header className="sticky top-0 z-30 border-b border-line bg-canvas/95 backdrop-blur lg:hidden">
          <div className="flex h-14 items-center justify-between gap-3 px-4">
            <Link href="/app" aria-label="Accueil ECOLE PAY">
              <Logo compact />
            </Link>
            <div className="min-w-0 flex-1">
              <p className="truncate text-[13px] font-semibold text-ink">
                {session.ecole.nom}
              </p>
              <p className="text-[10px] uppercase tracking-[0.1em] text-muted">
                {LIBELLES_ROLE[session.role]}
              </p>
            </div>
            <Link
              href="/app/parametres"
              className="grid size-9 place-items-center rounded-sm border border-line bg-surface text-ink-2"
              aria-label="Paramètres"
            >
              <Settings size={17} aria-hidden />
            </Link>
            <form action={deconnecter}>
              <button
                type="submit"
                className="grid size-9 place-items-center rounded-sm border border-line bg-surface text-muted"
                aria-label="Se déconnecter"
              >
                <LogOut size={16} aria-hidden />
              </button>
            </form>
          </div>
        </header>

        <main className="mx-auto w-full max-w-[1320px] flex-1 px-4 pb-28 pt-5 sm:px-6 sm:pt-6 lg:px-9 lg:pb-12 lg:pt-8">
          <BanniereEssai session={session} />
          <BanniereMiseAJour />
          {children}
        </main>
      </div>

      <NavigationMobile offre={offre} />
    </div>
  );
}
