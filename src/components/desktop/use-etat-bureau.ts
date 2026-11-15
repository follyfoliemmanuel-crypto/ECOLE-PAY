"use client";

import { useEffect, useState } from "react";
import type { EtatBureau } from "@/types/desktop";

/**
 * État de l'application de bureau.
 * `null` tant que le pont n'est pas lu, puis :
 *   • un objet si la page tourne dans Electron ;
 *   • `false` dans un navigateur classique.
 */
export function useEtatBureau(): EtatBureau | false | null {
  const [etat, setEtat] = useState<EtatBureau | false | null>(null);

  useEffect(() => {
    const pont = window.ecolepayDesktop;
    if (!pont) {
      setEtat(false);
      return;
    }

    let actif = true;
    pont
      .etat()
      .then((valeur) => {
        if (actif) setEtat(valeur);
      })
      .catch(() => {
        if (actif) setEtat(false);
      });

    const desabonner = pont.surEtat((valeur) => {
      if (actif) setEtat(valeur);
    });

    return () => {
      actif = false;
      desabonner();
    };
  }, []);

  return etat;
}
