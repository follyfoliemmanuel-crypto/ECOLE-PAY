import type { StatutSaisie } from "@/lib/types";
import { LIBELLES_STATUT_SAISIE } from "@/lib/types";
import { Badge } from "@/components/ui/badge";

/** Pastille de statut d'une saisie : EN COURS, ENVOYÉ, VALIDÉ. */
export function BadgeSaisie({ statut }: { statut: StatutSaisie }) {
  const ton =
    statut === "VALIDE"
      ? "succes"
      : statut === "ENVOYE"
        ? "brand"
        : statut === "EN_COURS"
          ? "ochre"
          : "neutre";

  return <Badge ton={ton}>{LIBELLES_STATUT_SAISIE[statut]}</Badge>;
}
