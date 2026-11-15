import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth";
import { FormulaireConnexion } from "@/components/auth/formulaires";
import { Alerte } from "@/components/ui/empty-state";

export const metadata: Metadata = { title: "Connexion" };

export default async function PageConnexion({
  searchParams,
}: {
  searchParams: Promise<{ reinitialise?: string; suivant?: string }>;
}) {
  const session = await getSession();
  if (session) redirect(session.role === "prof" ? "/prof" : "/app");

  const parametres = await searchParams;

  return (
    <div>
      <Link
        href="/"
        className="mb-8 hidden text-[12.5px] font-medium text-muted hover:text-ink lg:inline-flex"
      >
        ← Retour au site
      </Link>

      <h2 className="text-[26px] font-semibold leading-tight tracking-[-0.03em] text-ink">
        Connexion à votre école
      </h2>
      <p className="mt-2 text-[13.5px] leading-relaxed text-muted">
        Directeur et secrétaire : votre email. Professeur : l&apos;identifiant
        remis par l&apos;école.
      </p>

      <div className="mt-7">
        {parametres.reinitialise === "1" && (
          <div className="mb-5">
            <Alerte ton="succes">
              Votre mot de passe a été modifié. Connectez-vous avec le nouveau.
            </Alerte>
          </div>
        )}

        <FormulaireConnexion suivant={parametres.suivant} />
      </div>

      <div className="mt-8 border-t border-line pt-5">
        <p className="text-[13px] text-muted">
          Votre école n&apos;est pas encore sur ECOLE PAY ?{" "}
          <Link
            href="/inscription"
            className="font-semibold text-brand underline-offset-4 hover:underline"
          >
            Ouvrir un compte
          </Link>
        </p>
      </div>
    </div>
  );
}
