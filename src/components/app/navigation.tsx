"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  AlertTriangle,
  Archive,
  BarChart3,
  Building2,
  CalendarRange,
  FileText,
  GraduationCap,
  LayoutDashboard,
  LockKeyhole,
  NotebookPen,
  Plus,
  School,
  Users,
  Wallet,
} from "lucide-react";
import type { Offre } from "@/lib/types";
import { aFonctionnalite } from "@/lib/offres";
import { DeclencheurPremium } from "@/components/offres/verrou-premium";
import { cx } from "@/lib/cx";

type Lien = {
  href: string;
  libelle: string;
  icone: typeof LayoutDashboard;
  exact?: boolean;
  /** Visible mais grisé : ouvre la fenêtre PREMIUM au clic. */
  verrouille?: boolean;
};

const LIENS_BASE: Lien[] = [
  { href: "/app", libelle: "Tableau de bord", icone: LayoutDashboard, exact: true },
  { href: "/app/eleves", libelle: "Élèves", icone: Users },
  { href: "/app/paiements", libelle: "Paiements", icone: Wallet },
  { href: "/app/impayes", libelle: "Impayés", icone: AlertTriangle },
  { href: "/app/rapports", libelle: "Rapports", icone: FileText },
  { href: "/app/classes", libelle: "Classes", icone: School },
  { href: "/app/annees", libelle: "Années", icone: CalendarRange },
  { href: "/app/archive", libelle: "Archive", icone: Archive },
];

/** Les modules PREMIUM restent visibles mais verrouillés hors PREMIUM. */
function liensPour(offre: Offre): Lien[] {
  const liens = [...LIENS_BASE];
  if (aFonctionnalite(offre, "notes_bulletins")) {
    liens.push({ href: "/app/notes", libelle: "Notes & bulletins", icone: NotebookPen });
  }
  if (aFonctionnalite(offre, "comptes_profs")) {
    liens.push({ href: "/app/profs", libelle: "Profs & salaires", icone: GraduationCap });
  } else {
    liens.push({
      href: "/app/profs",
      libelle: "Profs & salaires",
      icone: GraduationCap,
      verrouille: true,
    });
  }
  if (aFonctionnalite(offre, "stats_avancees")) {
    liens.push({ href: "/app/statistiques", libelle: "Statistiques", icone: BarChart3 });
  }
  if (aFonctionnalite(offre, "multi_ecoles")) {
    liens.push({ href: "/app/etablissements", libelle: "Multi-écoles", icone: Building2 });
  }
  return liens;
}

function estActif(chemin: string, href: string, exact?: boolean) {
  if (exact) return chemin === href;
  return chemin === href || chemin.startsWith(`${href}/`);
}

export function NavigationLaterale({ offre }: { offre: Offre }) {
  const chemin = usePathname();
  const liens = liensPour(offre);

  return (
    <nav className="mt-2 flex-1 space-y-0.5 overflow-y-auto px-3" aria-label="Navigation principale">
      {liens.map(({ href, libelle, icone: Icone, exact, verrouille }) => {
        const actif = estActif(chemin, href, exact);

        if (verrouille) {
          return (
            <DeclencheurPremium
              key={href}
              apparence="nav"
              contexte="les comptes professeurs et les salaires"
              ariaLabel={`${libelle} — réservé à PREMIUM`}
            >
              <span
                className="h-4 w-[2px] rounded-full bg-transparent"
                aria-hidden
              />
              <Icone size={16} className="text-white/30" aria-hidden />
              <span className="min-w-0 flex-1 truncate">{libelle}</span>
              <span className="inline-flex shrink-0 items-center gap-1 rounded-full border border-white/15 bg-white/[0.06] px-1.5 py-0.5 text-[8px] font-bold uppercase tracking-[0.06em] text-white/45">
                <LockKeyhole size={8} aria-hidden />
                PREMIUM
              </span>
            </DeclencheurPremium>
          );
        }

        return (
          <Link
            key={href}
            href={href}
            aria-current={actif ? "page" : undefined}
            className={cx(
              "group flex h-10 items-center gap-3 rounded-sm pl-3 pr-2 text-[13px] font-medium transition-colors",
              actif
                ? "bg-white/[0.09] text-white"
                : "text-white/60 hover:bg-white/[0.05] hover:text-white/90",
            )}
          >
            <span
              className={cx(
                "h-4 w-[2px] rounded-full",
                actif ? "bg-[#ffce00]" : "bg-transparent",
              )}
              aria-hidden
            />
            <Icone size={16} className={actif ? "text-[#ffce00]" : "text-white/50"} aria-hidden />
            {libelle}
          </Link>
        );
      })}
    </nav>
  );
}

export function NavigationMobile({ offre }: { offre: Offre }) {
  const chemin = usePathname();
  const liens = liensPour(offre);

  return (
    <nav
      className="fixed inset-x-0 bottom-0 z-40 border-t border-line bg-surface/95 backdrop-blur lg:hidden"
      style={{ paddingBottom: "env(safe-area-inset-bottom)" }}
      aria-label="Navigation mobile"
    >
      <div
        className={cx(
          "mx-auto flex h-16 max-w-md items-end gap-0.5 overflow-x-auto px-1.5 pb-1.5",
          liens.length > 5 ? "justify-start" : "justify-around",
        )}
      >
        {liens.map(({ href, libelle, icone: Icone, exact, verrouille }) => {
          const actif = estActif(chemin, href, exact);

          if (verrouille) {
            return (
              <DeclencheurPremium
                key={href}
                apparence="mobile"
                contexte="les comptes professeurs et les salaires"
                ariaLabel={`${libelle} — réservé à PREMIUM`}
              >
                <span className="relative inline-flex">
                  <Icone size={18} aria-hidden />
                  <LockKeyhole
                    size={9}
                    className="absolute -right-1.5 -top-1 text-ochre"
                    aria-hidden
                  />
                </span>
                <span className="max-w-[62px] truncate">{libelle}</span>
                <span className="text-[7px] font-bold uppercase tracking-[0.06em] text-ochre">
                  PREMIUM
                </span>
              </DeclencheurPremium>
            );
          }

          return (
            <Link
              key={href}
              href={href}
              aria-current={actif ? "page" : undefined}
              className={cx(
                "flex min-w-[62px] shrink-0 flex-col items-center gap-1 rounded-sm pt-2 text-[9px] font-medium leading-tight transition-colors",
                actif ? "text-brand" : "text-muted",
              )}
            >
              <Icone size={18} strokeWidth={actif ? 2.2 : 1.8} aria-hidden />
              <span className="max-w-[62px] truncate">{libelle}</span>
            </Link>
          );
        })}
      </div>

      <Link
        href="/app/paiements/nouveau"
        aria-label="Encaisser un paiement"
        className="absolute bottom-[calc(env(safe-area-inset-bottom)+18px)] left-1/2 grid size-14 -translate-x-1/2 place-items-center rounded-full border-4 border-canvas bg-[#ffce00] text-brand-deep shadow-[0_8px_20px_-8px_rgba(8,43,75,0.6)] transition-transform active:scale-95"
      >
        <Plus size={24} strokeWidth={2.4} aria-hidden />
      </Link>
    </nav>
  );
}
