"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { Loader2 } from "lucide-react";

/**
 * Rafraîchit la liste tant qu'un rapport est en file d'attente.
 * Quelques secondes suffisent : le worker démarre juste après la demande.
 */
export function RafraichirRapports({ intervalle = 4000 }: { intervalle?: number }) {
  const router = useRouter();

  useEffect(() => {
    const minuteur = window.setInterval(() => router.refresh(), intervalle);
    return () => window.clearInterval(minuteur);
  }, [router, intervalle]);

  return (
    <span className="ml-auto inline-flex items-center gap-1.5 text-[11px] text-partiel">
      <Loader2 className="animate-spin" size={12} aria-hidden />
      Mise à jour automatique
    </span>
  );
}
