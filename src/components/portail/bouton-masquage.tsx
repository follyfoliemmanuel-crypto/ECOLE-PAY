"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { Eye, EyeOff, Loader2 } from "lucide-react";
import { basculerMasquagePortail } from "@/lib/actions/portail";

export function BoutonMasquagePortail({
  eleveId,
  visible,
  nom,
}: {
  eleveId: string;
  visible: boolean;
  nom: string;
}) {
  const router = useRouter();
  const [enCours, demarrer] = useTransition();
  const [erreur, setErreur] = useState<string>();
  const [confirmation, setConfirmation] = useState<string>();

  function basculer() {
    setErreur(undefined);
    setConfirmation(undefined);
    const donnees = new FormData();
    donnees.set("id", eleveId);

    demarrer(async () => {
      const resultat = await basculerMasquagePortail(donnees);
      if (resultat.error) {
        setErreur(resultat.error);
        return;
      }
      setConfirmation(resultat.success);
      router.refresh();
    });
  }

  return (
    <div className="flex flex-col items-start gap-1">
      <button
        type="button"
        onClick={basculer}
        disabled={enCours}
        className={
          visible
            ? "inline-flex h-8 items-center gap-1.5 rounded-sm border border-line-strong bg-surface px-2.5 text-[11px] font-semibold text-ink-2 transition-colors hover:bg-surface-2 disabled:opacity-60"
            : "inline-flex h-8 items-center gap-1.5 rounded-sm border border-brand/25 bg-brand-soft px-2.5 text-[11px] font-semibold text-brand transition-colors hover:bg-brand/10 disabled:opacity-60"
        }
        title={
          visible
            ? `Masquer ${nom} du portail parent`
            : `Afficher ${nom} sur le portail parent`
        }
      >
        {enCours ? (
          <Loader2 size={13} className="animate-spin" aria-hidden />
        ) : visible ? (
          <EyeOff size={13} aria-hidden />
        ) : (
          <Eye size={13} aria-hidden />
        )}
        {visible ? "MASQUER DU PORTAIL PARENT" : "AFFICHER SUR LE PORTAIL PARENT"}
      </button>
      {erreur && (
        <p className="max-w-[260px] text-[10.5px] leading-snug text-impaye">
          {erreur}
        </p>
      )}
      {confirmation && !erreur && (
        <p className="max-w-[260px] text-[10.5px] leading-snug text-paye">
          {confirmation}
        </p>
      )}
    </div>
  );
}
