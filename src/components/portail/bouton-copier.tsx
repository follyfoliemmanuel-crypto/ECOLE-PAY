"use client";

import { useEffect, useRef, useState } from "react";
import { Check, Copy } from "lucide-react";

export function BoutonCopierLien({
  lien,
  libelle = "COPIER LE LIEN PARENT",
  className,
}: {
  lien: string;
  libelle?: string;
  className?: string;
}) {
  const [copie, setCopie] = useState(false);
  const [erreur, setErreur] = useState(false);
  const minuteries = useRef<number[]>([]);

  // Les retours visuels sont temporisés : on annule les minuteurs en cours de
  // vie pour ne pas écrire dans un composant démonté.
  useEffect(
    () => () => {
      minuteries.current.forEach((id) => window.clearTimeout(id));
      minuteries.current = [];
    },
    [],
  );

  function programmer(action: () => void, delai: number) {
    minuteries.current.push(window.setTimeout(action, delai));
  }

  async function copier() {
    setErreur(false);
    try {
      if (navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(lien);
      } else {
        const champ = document.createElement("textarea");
        champ.value = lien;
        champ.style.position = "fixed";
        champ.style.opacity = "0";
        document.body.appendChild(champ);
        champ.select();
        document.execCommand("copy");
        document.body.removeChild(champ);
      }
      setCopie(true);
      programmer(() => setCopie(false), 2200);
    } catch {
      setErreur(true);
      programmer(() => setErreur(false), 3000);
    }
  }

  return (
    <button
      type="button"
      onClick={copier}
      className={
        className ??
        "inline-flex h-9 items-center justify-center gap-1.5 rounded-sm bg-brand px-3 text-[11.5px] font-semibold text-white transition-colors hover:bg-brand-deep"
      }
    >
      {copie ? (
        <Check size={14} aria-hidden />
      ) : (
        <Copy size={14} aria-hidden />
      )}
      {copie ? "LIEN COPIÉ" : erreur ? "COPIE IMPOSSIBLE" : libelle}
    </button>
  );
}
