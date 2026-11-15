import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth";
import { FormulaireInscription } from "@/components/auth/formulaires";

export const metadata: Metadata = { title: "Ouvrir un compte" };

export default async function PageInscription() {
  const session = await getSession();
  if (session) redirect("/app");

  return (
    <div>
      <Link
        href="/"
        className="mb-8 hidden text-[12.5px] font-medium text-muted hover:text-ink lg:inline-flex"
      >
        ← Retour au site
      </Link>

      <h2 className="text-[26px] font-semibold leading-tight tracking-[-0.03em] text-ink">
        Ouvrez votre école
      </h2>
      <p className="mt-2 text-[13.5px] leading-relaxed text-muted">
        Deux minutes suffisent. Vous pourrez ajouter vos classes et vos élèves
        juste après.
      </p>

      <div className="mt-7">
        <FormulaireInscription />
      </div>

      <div className="mt-8 border-t border-line pt-5">
        <p className="text-[13px] text-muted">
          Vous avez déjà un compte ?{" "}
          <Link
            href="/connexion"
            className="font-semibold text-brand underline-offset-4 hover:underline"
          >
            Se connecter
          </Link>
        </p>
      </div>
    </div>
  );
}
