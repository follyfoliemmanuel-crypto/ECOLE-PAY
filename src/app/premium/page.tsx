import type { Metadata } from "next";
import Link from "next/link";
import {
  ArrowLeft,
  Check,
  LockKeyhole,
  Mail,
  MessageCircle,
  Smartphone,
} from "lucide-react";
import { getSession } from "@/lib/auth";
import {
  MESSAGE_PREMIUM,
  MESSAGE_UPGRADE_PREMIUM,
  OFFRES,
  PRIX_PREMIUM_TEXTE,
} from "@/lib/offres";
import { COMMERCIAL, lienWhatsAppCommercial } from "@/lib/config";
import { formatFCFA } from "@/lib/format";
import { Logo } from "@/components/ui/logo";
import { LienBouton } from "@/components/ui/button";

export const metadata: Metadata = {
  title: "Passer à PREMIUM",
  robots: { index: false, follow: false },
};

/**
 * Page de paiement / montée en offre.
 *
 * Toutes les gardes serveur (espace prof, portail parent, validation, QR code,
 * envoi WhatsApp) redirigent ici quand l'école n'est pas en PREMIUM. La page est
 * volontairement accessible sans session : un parent qui ouvre une ancienne
 * adresse de portail doit lire la raison et les coordonnées de l'école.
 */
export default async function PagePremium({
  searchParams,
}: {
  searchParams: Promise<{ ecole?: string; depuis?: string }>;
}) {
  const parametres = await searchParams;
  const session = await getSession();

  const retour =
    session?.role === "prof"
      ? { href: "/prof", libelle: "Mon espace professeur" }
      : session
        ? { href: "/app", libelle: "Retour au tableau de bord" }
        : { href: "/connexion", libelle: "Retour à la connexion" };

  const contexte = parametres.depuis
    ? decodeURIComponent(parametres.depuis)
    : parametres.ecole
      ? `l'école ${parametres.ecole}`
      : session
        ? `l'école ${session.ecole.nom}`
        : "votre école";

  const messageWhatsApp = `Bonjour SCHOOL PAY, je veux passer à PREMIUM ${PRIX_PREMIUM_TEXTE} pour ${contexte} afin de débloquer les comptes profs, le portail parent et l'envoi WhatsApp.`;

  return (
    <div className="min-h-dvh bg-canvas">
      <div className="flex h-1 w-full">
        <span className="flex-1 bg-[#006a4e]" />
        <span className="flex-1 bg-[#ffce00]" />
        <span className="flex-1 bg-[#d21034]" />
      </div>

      <header className="border-b border-line bg-surface">
        <div className="mx-auto flex max-w-4xl items-center justify-between gap-4 px-5 py-4">
          <Logo />
          <Link
            href={retour.href}
            className="inline-flex items-center gap-1.5 rounded-sm px-2.5 py-1.5 text-[12px] font-medium text-muted transition-colors hover:bg-surface-2 hover:text-ink"
          >
            <ArrowLeft size={14} aria-hidden />
            {retour.libelle}
          </Link>
        </div>
      </header>

      <main className="mx-auto w-full max-w-4xl px-5 py-8 sm:py-12">
        <section className="card overflow-hidden">
          <div className="border-b border-line bg-brand-deep px-5 py-7 text-white sm:px-8 sm:py-9">
            <div className="flex items-start gap-4">
              <span className="grid size-12 shrink-0 place-items-center rounded-sm border border-white/15 bg-white/10">
                <LockKeyhole size={22} aria-hidden />
              </span>
              <div>
                <p className="text-[10.5px] font-semibold uppercase tracking-[0.16em] text-[#ffce00]">
                  Fonctionnalité verrouillée
                </p>
                <h1 className="mt-1 text-[24px] font-semibold leading-tight tracking-[-0.03em] sm:text-[28px]">
                  {MESSAGE_PREMIUM}
                </h1>
                <p className="mt-3 max-w-2xl text-[13px] leading-relaxed text-white/70">
                  {MESSAGE_UPGRADE_PREMIUM}
                </p>
              </div>
            </div>
          </div>

          <div className="space-y-6 px-5 py-7 sm:px-8 sm:py-8">
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="rounded-sm border border-line bg-surface-2 p-4">
                <p className="flex items-center gap-2 text-[10.5px] font-semibold uppercase tracking-[0.11em] text-muted">
                  <Smartphone size={13} aria-hidden />
                  Paiement Mobile Money
                </p>
                <p className="chiffre mt-2 text-[20px] font-semibold text-ink">
                  {COMMERCIAL.whatsappAffichage}
                </p>
                <p className="mt-1 text-[11.5px] leading-relaxed text-muted">
                  Flooz (Moov Togo) ou TMoney (Togocom).
                  <br />
                  Bénéficiaire : {COMMERCIAL.beneficiaire}.
                </p>
              </div>

              <div className="rounded-sm border border-line bg-surface-2 p-4">
                <p className="flex items-center gap-2 text-[10.5px] font-semibold uppercase tracking-[0.11em] text-muted">
                  <Mail size={13} aria-hidden />
                  Contact direct
                </p>
                <a
                  href={`mailto:${COMMERCIAL.email}?subject=${encodeURIComponent(
                    `Passage à PREMIUM ${PRIX_PREMIUM_TEXTE}`,
                  )}&body=${encodeURIComponent(messageWhatsApp)}`}
                  className="mt-2 block break-all text-[13px] font-semibold text-brand underline underline-offset-2"
                >
                  {COMMERCIAL.email}
                </a>
                <p className="mt-1 text-[11.5px] leading-relaxed text-muted">
                  Précisez le nom de l&apos;école et joignez la capture du
                  transfert. L&apos;offre est activée par le super admin.
                </p>
              </div>
            </div>

            <div>
              <p className="text-[10.5px] font-semibold uppercase tracking-[0.12em] text-muted">
                Ce que débloque PREMIUM {PRIX_PREMIUM_TEXTE}
              </p>
              <ul className="mt-3 grid gap-2 sm:grid-cols-2">
                {[
                  "Création de comptes professeurs",
                  "Saisie des notes par les profs",
                  "Verrouillage classe + matière",
                  "Validation et publication",
                  "Portail parent /parent/nom-de-lecole",
                  "Notes, moyenne, rang, bulletin PDF",
                  "Masquage d'un élève du portail",
                  "Bulletin PDF envoyé sur WhatsApp",
                  "Copie du lien parent + QR code",
                ].map((element) => (
                  <li
                    key={element}
                    className="flex items-start gap-2 text-[12.5px] leading-relaxed text-ink-2"
                  >
                    <Check
                      size={13}
                      className="mt-0.5 shrink-0 text-paye"
                      aria-hidden
                    />
                    {element}
                  </li>
                ))}
              </ul>
            </div>

            <div className="rounded-sm border border-ochre/25 bg-[#fbf6ea] px-4 py-3.5 text-[12px] leading-relaxed text-[#7a5010]">
              <p className="font-semibold">
                Offre PREMIUM : {formatFCFA(OFFRES.PREMIUM.prix)} par mois.
              </p>
              <p className="mt-1">
                STARTER et PRO conservent les élèves, les paiements et les notes
                saisies manuellement. Aucune donnée n&apos;est supprimée lors
                d&apos;un changement d&apos;offre.
              </p>
            </div>

            <div className="flex flex-col gap-2.5 sm:flex-row">
              <a
                href={lienWhatsAppCommercial(messageWhatsApp)}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex h-12 flex-1 items-center justify-center gap-2 rounded-sm bg-paye px-4 text-[14px] font-semibold text-white transition-colors hover:bg-paye/90"
              >
                <MessageCircle size={17} aria-hidden />
                JE VEUX PASSER PREMIUM
              </a>
              <LienBouton
                href={retour.href}
                variante="secondaire"
                taille="lg"
                className="flex-1"
              >
                {retour.libelle}
              </LienBouton>
            </div>
          </div>
        </section>

        <p className="mt-4 text-center text-[11px] leading-relaxed text-muted">
          SCHOOL PAY · Les fonctions PREMIUM sont vérifiées côté serveur à chaque
          accès. Un retour à STARTER ou PRO les verrouille immédiatement, sans
          supprimer les données.
        </p>
      </main>
    </div>
  );
}
