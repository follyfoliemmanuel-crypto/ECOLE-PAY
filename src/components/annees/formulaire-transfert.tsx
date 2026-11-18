"use client";

import { useActionState, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { LogOut, Loader2 } from "lucide-react";
import { transfererEleve } from "@/lib/actions/annees";
import type { ResultatAction } from "@/lib/types";
import { Alerte } from "@/components/ui/empty-state";
import { Bouton } from "@/components/ui/button";
import { Dialogue } from "@/components/ui/dialogue";

function aujourdhui(): string {
  const date = new Date();
  const mois = String(date.getMonth() + 1).padStart(2, "0");
  const jour = String(date.getDate()).padStart(2, "0");
  return `${date.getFullYear()}-${mois}-${jour}`;
}

export function FormulaireTransfert({
  eleveId,
  nomComplet,
}: {
  eleveId: string;
  nomComplet: string;
}) {
  const router = useRouter();
  const [ouvert, setOuvert] = useState(false);
  const [etat, action, enCours] = useActionState<ResultatAction | null, FormData>(
    transfererEleve,
    null,
  );

  useEffect(() => {
    if (!etat?.success) return;
    setOuvert(false);
    router.refresh();
  }, [etat, router]);

  return (
    <>
      <Bouton
        type="button"
        variante="secondaire"
        taille="sm"
        onClick={() => setOuvert(true)}
      >
        <LogOut size={13} aria-hidden />
        Transférer
      </Bouton>

      <Dialogue
        ouvert={ouvert}
        onFermer={() => setOuvert(false)}
        titre="Transférer l'élève"
        description={`${nomComplet} quitte l'école. Ses paiements, notes et bulletins restent conservés dans l'archive.`}
      >
        <form action={action} className="space-y-4">
          <input type="hidden" name="id" value={eleveId} />

          {etat?.error && <Alerte>{etat.error}</Alerte>}

          <div>
            <label className="label" htmlFor="ecole_destination">
              Nouvelle école
            </label>
            <input
              id="ecole_destination"
              name="ecole_destination"
              required
              maxLength={160}
              placeholder="Complexe scolaire Les Palmiers, Lomé"
              className="input"
              autoComplete="off"
            />
          </div>

          <div>
            <label className="label" htmlFor="date_sortie">
              Date de départ
            </label>
            <input
              id="date_sortie"
              name="date_sortie"
              type="date"
              required
              defaultValue={aujourdhui()}
              className="input"
            />
          </div>

          <div className="rounded-sm border border-line bg-surface-2 px-3.5 py-3 text-[12px] leading-relaxed text-muted">
            Aucun transfert n&apos;est envoyé automatiquement à une autre école.
            Vous pourrez imprimer le certificat de transfert depuis la fiche.
          </div>

          <div className="flex justify-end gap-2">
            <Bouton
              type="button"
              variante="secondaire"
              onClick={() => setOuvert(false)}
            >
              Annuler
            </Bouton>
            <Bouton type="submit" variante="danger" disabled={enCours}>
              {enCours && (
                <Loader2 className="animate-spin" size={14} aria-hidden />
              )}
              Confirmer le transfert
            </Bouton>
          </div>
        </form>
      </Dialogue>
    </>
  );
}
