import type { Metadata } from "next";
import { redirect } from "next/navigation";
import {
  Check,
  LockKeyhole,
  LogOut,
  Mail,
  MessageCircle,
  Smartphone,
} from "lucide-react";
import { getSession } from "@/lib/auth";
import { ACTIVATION, accesAutorise, motifBlocage } from "@/lib/activation";
import { OFFRE_ESSAI, OFFRES, messagePaiement } from "@/lib/offres";
import { deconnecter } from "@/lib/actions/auth";
import { formatDate, formatFCFA } from "@/lib/format";
import { Logo } from "@/components/ui/logo";
import type { Offre } from "@/lib/types";

export const metadata: Metadata = { title: "Accès suspendu" };

const TITRES = {
  ESSAI_TERMINE: "Votre essai est terminé",
  ABONNEMENT_TERMINE: "Votre abonnement est terminé",
  BLOQUE: "Votre compte est bloqué",
} as const;

const ORDRES: Offre[] = ["STARTER", "PRO", "PREMIUM"];

export default async function PageBlocage() {
  const session = await getSession();
  if (!session) redirect("/connexion");

  if (accesAutorise(session.ecole)) redirect("/app");

  const motif = motifBlocage(session.ecole) ?? "BLOQUE";
  const dateFin =
    motif === "ABONNEMENT_TERMINE"
      ? session.ecole.dateFinAbonnement
      : session.ecole.dateFinEssai;

  const intro =
    motif === "ESSAI_TERMINE"
      ? `Vos 30 jours d'essai PREMIUM sont terminés. Choisissez l'offre qui correspond à votre école pour continuer à encaisser.`
      : motif === "ABONNEMENT_TERMINE"
        ? `Votre abonnement est arrivé à échéance. Choisissez une offre pour rouvrir immédiatement votre tableau de bord.`
        : `L'accès de votre école est temporairement suspendu. Choisissez une offre pour le rétablir.`;

  const messageWhatsApp = (offre: Offre) =>
    encodeURIComponent(
      `Bonjour ECOLE PAY, je souhaite activer l'offre ${offre} (${formatFCFA(OFFRES[offre].prix)} / mois) pour mon école "${session.ecole.nom}". Compte : ${session.email}. Je vous envoie la capture du paiement Flooz / TMoney.`,
    );

  return (
    <div className="min-h-dvh bg-canvas">
      <div className="flex h-1 w-full">
        <span className="flex-1 bg-[#006a4e]" />
        <span className="flex-1 bg-[#ffce00]" />
        <span className="flex-1 bg-[#d21034]" />
      </div>

      <header className="border-b border-line bg-surface">
        <div className="mx-auto flex max-w-5xl items-center justify-between gap-4 px-5 py-4">
          <Logo />
          <form action={deconnecter}>
            <button
              type="submit"
              className="inline-flex items-center gap-1.5 rounded-sm px-2.5 py-1.5 text-[12px] font-medium text-muted transition-colors hover:bg-surface-2 hover:text-ink"
            >
              <LogOut size={14} aria-hidden />
              Se déconnecter
            </button>
          </form>
        </div>
      </header>

      <main className="mx-auto w-full max-w-5xl px-5 py-10 sm:py-14">
        <section className="card overflow-hidden">
          <div className="border-b border-line bg-brand-deep px-5 py-7 text-white sm:px-8 sm:py-9">
            <div className="flex items-center gap-4">
              <span className="grid size-12 shrink-0 place-items-center rounded-sm border border-white/15 bg-white/10">
                <LockKeyhole size={22} aria-hidden />
              </span>
              <div>
                <p className="text-[10.5px] font-semibold uppercase tracking-[0.16em] text-[#ffce00]">
                  {session.ecole.nom}
                </p>
                <h1 className="mt-1 text-[24px] font-semibold leading-tight tracking-[-0.03em] sm:text-[28px]">
                  {TITRES[motif]}
                </h1>
              </div>
            </div>
          </div>

          <div className="space-y-6 px-5 py-7 sm:px-8 sm:py-9">
            <p className="max-w-3xl text-[14px] leading-relaxed text-ink-2">
              {intro}
            </p>

            {dateFin && (
              <p className="rounded-sm border border-line bg-surface-2 px-3.5 py-2.5 text-[12.5px] text-muted">
                {motif === "ABONNEMENT_TERMINE"
                  ? "Abonnement arrivé à échéance le"
                  : "Essai arrivé à échéance le"}{" "}
                <strong className="font-semibold text-ink">
                  {formatDate(dateFin)}
                </strong>
                . Vos données restent conservées : élèves, paiements, reçus et
                notes sont toujours en base.
              </p>
            )}

            {/* Les 3 offres */}
            <div className="grid gap-3 md:grid-cols-3">
              {ORDRES.map((offre) => {
                const info = OFFRES[offre];
                const vedette = offre === "PRO";
                return (
                  <article
                    key={offre}
                    className={`relative flex flex-col rounded-lg border bg-surface p-4 ${
                      vedette
                        ? "border-brand shadow-[0_18px_40px_-28px_rgba(13,59,102,0.55)]"
                        : "border-line"
                    }`}
                  >
                    {vedette && (
                      <span className="absolute -top-2.5 left-4 rounded-full bg-brand px-2 py-0.5 text-[9px] font-semibold uppercase tracking-[0.1em] text-white">
                        Le plus choisi
                      </span>
                    )}
                    <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-muted">
                      {info.nom}
                    </p>
                    <p className="mt-2 flex items-baseline gap-1">
                      <span className="chiffre text-[25px] font-semibold tracking-tight text-ink">
                        {formatFCFA(info.prix)}
                      </span>
                    </p>
                    <p className="text-[11px] text-muted">par mois</p>
                    <p className="mt-2 text-[11.5px] leading-relaxed text-muted">
                      {info.resume}
                    </p>

                    <ul className="mt-3 flex-1 space-y-1.5 border-t border-line pt-3">
                      {info.fonctionnalites.map((element) => (
                        <li
                          key={element}
                          className="flex items-start gap-1.5 text-[11px] leading-relaxed text-ink-2"
                        >
                          <Check
                            size={12}
                            className="mt-0.5 shrink-0 text-paye"
                            aria-hidden
                          />
                          {element}
                        </li>
                      ))}
                    </ul>

                    <a
                      href={`https://wa.me/${ACTIVATION.numero}?text=${messageWhatsApp(offre)}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className={`mt-4 inline-flex h-9 items-center justify-center gap-1.5 rounded-sm px-3 text-[12px] font-semibold transition-colors ${
                        vedette
                          ? "bg-brand text-white hover:bg-brand-deep"
                          : "border border-line-strong bg-surface text-ink hover:bg-surface-2"
                      }`}
                    >
                      <MessageCircle size={13} aria-hidden />
                      Choisir {offre}
                    </a>
                  </article>
                );
              })}
            </div>

            {/* Instructions de paiement */}
            <div className="rounded-sm border border-brand/15 bg-brand-soft/60 p-4 sm:p-5">
              <div className="flex items-start gap-3">
                <span className="grid size-10 shrink-0 place-items-center rounded-sm bg-brand text-white">
                  <Smartphone size={17} aria-hidden />
                </span>
                <div>
                  <h2 className="text-[13.5px] font-semibold text-ink">
                    Comment activer mon offre ?
                  </h2>
                  <p className="mt-1 text-[12.5px] leading-relaxed text-ink-2">
                    {messagePaiement()}
                  </p>
                  <p className="mt-2 flex flex-wrap items-center gap-x-2 gap-y-1 text-[12px] text-muted">
                    <span>
                      Numéro Flooz / TMoney :{" "}
                      <strong className="chiffre font-semibold text-ink">
                        {ACTIVATION.numeroAffichage}
                      </strong>
                    </span>
                    <span aria-hidden>·</span>
                    <span>
                      Email :{" "}
                      <a
                        href={`mailto:${ACTIVATION.email}`}
                        className="font-semibold text-brand underline underline-offset-2"
                      >
                        {ACTIVATION.email}
                      </a>
                    </span>
                  </p>
                  <p className="mt-2 text-[11.5px] text-muted">
                    L&apos;essai donne accès à toutes les fonctions de l&apos;offre{" "}
                    {OFFRE_ESSAI}. Après activation, le super admin applique
                    votre offre immédiatement, sans réinstallation.
                  </p>
                </div>
              </div>
            </div>

            <div className="grid gap-3 sm:grid-cols-2">
              <a
                href={`https://wa.me/${ACTIVATION.numero}?text=${messageWhatsApp("PRO")}`}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex h-11 items-center justify-center gap-2 rounded-sm border border-paye/25 bg-paye-soft px-4 text-[13.5px] font-semibold text-paye transition-colors hover:bg-paye/10"
              >
                <MessageCircle size={16} aria-hidden />
                Envoyer la capture sur WhatsApp
              </a>
              <a
                href={`mailto:${ACTIVATION.email}?subject=${encodeURIComponent(
                  `Activation ECOLE PAY — ${session.ecole.nom}`,
                )}&body=${messageWhatsApp("PRO")}`}
                className="inline-flex h-11 items-center justify-center gap-2 rounded-sm border border-line-strong bg-surface px-4 text-[13.5px] font-semibold text-ink-2 transition-colors hover:bg-surface-2"
              >
                <Mail size={16} aria-hidden />
                Envoyer par email
              </a>
            </div>
          </div>
        </section>
      </main>
    </div>
  );
}
