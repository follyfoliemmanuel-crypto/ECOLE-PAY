import type { Metadata } from "next";
import Link from "next/link";
import { ArrowLeft, KeyRound, Lock } from "lucide-react";
import { exigerSuperAdmin } from "@/lib/auth";
import { etatDeuxFacteurs } from "@/lib/two-facteurs";
import { EntetePage } from "@/components/app/entete-page";
import { SecuriteDeuxFacteurs } from "@/components/super-admin/securite-2fa";

export const metadata: Metadata = {
  title: "Sécurité — Super admin",
  robots: { index: false, follow: false },
};

export const dynamic = "force-dynamic";

export default async function PageSecuriteSuperAdmin() {
  const email = await exigerSuperAdmin();
  const etat = await etatDeuxFacteurs(email);

  return (
    <div>
      <Link
        href="/super-admin"
        className="mb-4 inline-flex items-center gap-1.5 text-[12px] font-medium text-muted underline-offset-4 hover:text-ink hover:underline"
      >
        <ArrowLeft size={13} aria-hidden />
        Retour aux écoles
      </Link>

      <EntetePage
        surtitre="Administration · Sécurité"
        titre="Protéger le compte super admin"
        description="Ce compte peut activer, bloquer ou changer l'offre de toutes les écoles. Il mérite une protection plus forte qu'un simple mot de passe."
      />

      <div className="mb-5 grid gap-3 sm:grid-cols-2">
        <div className="card flex items-start gap-3 p-4">
          <span className="grid size-8 shrink-0 place-items-center rounded-sm border border-brand/15 bg-brand-soft text-brand">
            <KeyRound size={15} aria-hidden />
          </span>
          <div>
            <p className="text-[12.5px] font-semibold text-ink">
              Code à 6 chiffres
            </p>
            <p className="mt-0.5 text-[11.5px] leading-relaxed text-muted">
              Généré par une application d&apos;authentification, hors ligne.
              Aucun SMS, donc rien à intercepter.
            </p>
          </div>
        </div>
        <div className="card flex items-start gap-3 p-4">
          <span className="grid size-8 shrink-0 place-items-center rounded-sm border border-line bg-surface-2 text-muted">
            <Lock size={15} aria-hidden />
          </span>
          <div>
            <p className="text-[12.5px] font-semibold text-ink">
              Codes de secours
            </p>
            <p className="mt-0.5 text-[11.5px] leading-relaxed text-muted">
              Huit codes à usage unique, hachés en base. Ils remplacent le code
              si vous perdez votre téléphone.
            </p>
          </div>
        </div>
      </div>

      <SecuriteDeuxFacteurs etat={etat} />

      <section className="card mt-6 p-5">
        <h2 className="text-[14px] font-semibold text-ink">
          Procédure de secours (si vous perdez le téléphone)
        </h2>
        <ol className="mt-2 list-decimal space-y-1.5 pl-5 text-[12.5px] leading-relaxed text-muted">
          <li>
            Connectez-vous avec votre mot de passe, puis saisissez l&apos;un des
            codes de secours à la place du code à 6 chiffres.
          </li>
          <li>
            Chaque code ne fonctionne qu&apos;une fois : régénérez-en de
            nouveaux depuis cette page dès que l&apos;accès est rétabli.
          </li>
          <li>
            Si plus aucun code ne fonctionne, exécutez sur le serveur{" "}
            <code className="rounded-sm border border-line bg-surface-2 px-1.5 py-0.5 text-[11.5px] text-ink-2">
              node scripts/desactiver-2fa.mjs
            </code>{" "}
            : la 2FA est désactivée en base, sans toucher au mot de passe.
          </li>
          <li>
            Réactivez immédiatement la 2FA après vous être reconnecté.
          </li>
        </ol>
        <p className="mt-3 text-[11.5px] leading-relaxed text-muted">
          Le script de secours ne peut être lancé que par quelqu&apos;un qui a
          déjà accès au serveur et à la base : il ne crée pas de porte d&apos;entrée
          supplémentaire depuis Internet.
        </p>
      </section>
    </div>
  );
}
