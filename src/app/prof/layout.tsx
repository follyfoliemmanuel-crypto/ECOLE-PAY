import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { LogOut } from "lucide-react";
import { exigerProf } from "@/lib/auth";
import { peut } from "@/lib/offres";
import { deconnecter } from "@/lib/actions/auth";
import { profConnecte } from "@/lib/data/saisies";
import { nomCompletProf } from "@/lib/saisies";
import { Logo } from "@/components/ui/logo";

export const metadata: Metadata = { title: "Espace professeur" };

export default async function LayoutProf({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await exigerProf();

  // Verrou serveur : la saisie des notes par un professeur n'existe qu'en
  // PREMIUM. Un retour d'offre coupe l'accès dès la requête suivante.
  if (!peut(session.ecole, "comptes_profs")) {
    redirect(
      `/premium?depuis=${encodeURIComponent("l'espace professeur")}`,
    );
  }

  const prof = await profConnecte(session.ecoleId, session.profId as string);
  const nom = prof ? nomCompletProf(prof.prenom, prof.nom) : session.nom;

  return (
    <div className="flex min-h-dvh flex-col bg-canvas">
      <header className="sticky top-0 z-30 border-b border-line bg-canvas/95 backdrop-blur">
        <div className="mx-auto flex h-16 w-full max-w-5xl items-center gap-3 px-4 sm:px-6">
          <Link href="/prof" aria-label="Mon espace" className="shrink-0">
            <Logo compact />
          </Link>

          <div className="min-w-0 flex-1">
            <p className="truncate text-[13px] font-semibold text-ink">
              {session.ecole.nom}
            </p>
            <p className="text-[10.5px] uppercase tracking-[0.1em] text-muted">
              Espace professeur
            </p>
          </div>

          <div className="hidden min-w-0 text-right sm:block">
            <p className="truncate text-[12.5px] font-semibold text-ink">
              {nom}
            </p>
            {session.identifiant && (
              <p className="truncate text-[10.5px] text-muted">
                {session.identifiant}
              </p>
            )}
          </div>

          <form action={deconnecter}>
            <button
              type="submit"
              className="grid size-9 place-items-center rounded-sm border border-line bg-surface text-muted transition-colors hover:text-ink"
              aria-label="Se déconnecter"
              title="Se déconnecter"
            >
              <LogOut size={16} aria-hidden />
            </button>
          </form>
        </div>
      </header>

      <main className="mx-auto w-full max-w-5xl flex-1 px-4 pb-16 pt-6 sm:px-6 sm:pt-8">
        {children}
      </main>

      <footer className="border-t border-line px-4 py-4 text-center text-[11px] text-muted">
        SCHOOL PAY · Saisie des notes · Les notes ne sont visibles par les
        parents qu&apos;après validation du directeur.
      </footer>
    </div>
  );
}
