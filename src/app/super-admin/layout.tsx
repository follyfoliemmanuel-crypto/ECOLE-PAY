import type { Metadata } from "next";
import Link from "next/link";
import { LogOut, ShieldCheck } from "lucide-react";
import { exigerSuperAdmin } from "@/lib/auth";
import { deconnecterSuperAdmin } from "@/lib/actions/auth";
import { Logo } from "@/components/ui/logo";

export const metadata: Metadata = {
  title: "Super admin",
  robots: { index: false, follow: false },
};

export const dynamic = "force-dynamic";

export default async function LayoutSuperAdmin({
  children,
}: {
  children: React.ReactNode;
}) {
  const email = await exigerSuperAdmin();

  return (
    <div className="min-h-dvh bg-canvas">
      <div className="flex h-1 w-full">
        <span className="flex-1 bg-[#006a4e]" />
        <span className="flex-1 bg-[#ffce00]" />
        <span className="flex-1 bg-[#d21034]" />
      </div>

      <header className="border-b border-white/10 bg-brand-deep">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-3 px-4 py-3.5 sm:px-6">
          <div className="flex items-center gap-4">
            <Link href="/super-admin" aria-label="Accueil super admin">
              <Logo ton="clair" />
            </Link>
            <span className="hidden rounded-full border border-[#ffce00]/40 bg-[#ffce00]/10 px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-[0.14em] text-[#ffce00] sm:inline-flex">
              Super admin
            </span>
          </div>

          <div className="flex items-center gap-3">
            <Link
              href="/super-admin/securite"
              className="inline-flex items-center gap-1.5 rounded-sm border border-white/15 px-2.5 py-1.5 text-[11.5px] font-medium text-white/70 transition-colors hover:bg-white/10 hover:text-white"
            >
              <ShieldCheck size={13} aria-hidden />
              Sécurité
            </Link>
            <span className="hidden text-[11.5px] text-white/55 sm:inline">
              {email}
            </span>
            <form action={deconnecterSuperAdmin}>
              <button
                type="submit"
                className="inline-flex items-center gap-1.5 rounded-sm border border-white/15 px-2.5 py-1.5 text-[11.5px] font-medium text-white/70 transition-colors hover:bg-white/10 hover:text-white"
              >
                <LogOut size={13} aria-hidden />
                Déconnexion
              </button>
            </form>
          </div>
        </div>
      </header>

      <main className="mx-auto w-full max-w-6xl px-4 py-7 sm:px-6 sm:py-9">
        {children}
      </main>
    </div>
  );
}
