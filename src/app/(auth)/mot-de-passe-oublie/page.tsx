import type { Metadata } from "next";
import Link from "next/link";
import { FormulaireMotDePasseOublie } from "@/components/auth/formulaires";

export const metadata: Metadata = { title: "Mot de passe oublié" };

export default function PageMotDePasseOublie() {
  return (
    <div>
      <Link
        href="/connexion"
        className="mb-8 inline-flex text-[12.5px] font-medium text-muted hover:text-ink"
      >
        ← Retour à la connexion
      </Link>

      <h2 className="text-[26px] font-semibold leading-tight tracking-[-0.03em] text-ink">
        Réinitialiser le mot de passe
      </h2>
      <p className="mt-2 text-[13.5px] leading-relaxed text-muted">
        Indiquez l&apos;email du compte. Vous recevrez un lien valable une heure.
      </p>

      <div className="mt-7">
        <FormulaireMotDePasseOublie />
      </div>

      <div className="mt-8 rounded-sm border border-line bg-surface-2 px-4 py-3">
        <p className="text-[12.5px] leading-relaxed text-muted">
          Pas d&apos;email reçu ? Vérifiez le dossier spam, ou demandez au
          directeur de créer un nouveau compte secrétaire depuis les paramètres.
        </p>
      </div>
    </div>
  );
}
