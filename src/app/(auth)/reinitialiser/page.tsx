import type { Metadata } from "next";
import Link from "next/link";
import { FormulaireReinitialisation } from "@/components/auth/formulaires";
import { Alerte } from "@/components/ui/empty-state";

export const metadata: Metadata = { title: "Nouveau mot de passe" };

export default async function PageReinitialisation({
  searchParams,
}: {
  searchParams: Promise<{ jeton?: string }>;
}) {
  const { jeton } = await searchParams;

  if (!jeton) {
    return (
      <div>
        <h2 className="text-[26px] font-semibold leading-tight tracking-[-0.03em] text-ink">
          Lien incomplet
        </h2>
        <p className="mt-2 text-[13.5px] leading-relaxed text-muted">
          Ce lien ne contient pas de jeton de réinitialisation.
        </p>
        <div className="mt-6">
          <Alerte>
            Demandez un nouveau lien depuis la page{" "}
            <Link href="/mot-de-passe-oublie" className="font-semibold underline">
              mot de passe oublié
            </Link>
            .
          </Alerte>
        </div>
      </div>
    );
  }

  return (
    <div>
      <h2 className="text-[26px] font-semibold leading-tight tracking-[-0.03em] text-ink">
        Choisissez un nouveau mot de passe
      </h2>
      <p className="mt-2 text-[13.5px] leading-relaxed text-muted">
        Toutes vos autres sessions seront déconnectées pour protéger le compte.
      </p>

      <div className="mt-7">
        <FormulaireReinitialisation jeton={jeton} />
      </div>
    </div>
  );
}
