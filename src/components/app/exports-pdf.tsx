"use client";

import { useState } from "react";
import { Download, Loader2 } from "lucide-react";
import {
  exporterBilanPdf,
  exporterImpayesPdf,
  type PdfClasse,
  type PdfEcole,
  type PdfImpaye,
  type PdfResume,
} from "@/lib/pdf";
import { Bouton } from "@/components/ui/button";

type Commun = {
  ecole: PdfEcole;
  periode: string;
  annee: string;
  resume: PdfResume;
  libelle?: string;
};

/** Bouton d'export PDF — le fichier est créé dans le navigateur. */
export function ExportImpayes({
  ecole,
  periode,
  annee,
  resume,
  impayes,
  libelle = "Impayés (PDF)",
}: Commun & { impayes: PdfImpaye[] }) {
  const [enCours, setEnCours] = useState(false);
  const [erreur, setErreur] = useState(false);

  async function lancer() {
    setEnCours(true);
    setErreur(false);
    try {
      exporterImpayesPdf({ ecole, periode, annee, impayes, resume });
    } catch {
      setErreur(true);
    } finally {
      setEnCours(false);
    }
  }

  return (
    <span className="inline-flex flex-col items-end gap-1">
      <Bouton
        type="button"
        variante="secondaire"
        taille="sm"
        onClick={lancer}
        disabled={enCours || impayes.length === 0}
        title={
          impayes.length === 0
            ? "Aucun impayé à exporter pour cette période"
            : "Télécharger la liste des impayés"
        }
      >
        {enCours ? (
          <Loader2 size={14} className="animate-spin" aria-hidden />
        ) : (
          <Download size={14} aria-hidden />
        )}
        {enCours ? "Création…" : libelle}
      </Bouton>
      {erreur && (
        <span className="text-[11px] text-impaye" role="alert">
          Export impossible. Réessayez.
        </span>
      )}
    </span>
  );
}

export function ExportBilan({
  ecole,
  periode,
  annee,
  resume,
  classes,
  libelle = "Bilan (PDF)",
}: Commun & { classes: PdfClasse[] }) {
  const [enCours, setEnCours] = useState(false);
  const [erreur, setErreur] = useState(false);

  async function lancer() {
    setEnCours(true);
    setErreur(false);
    try {
      exporterBilanPdf({ ecole, periode, annee, classes, resume });
    } catch {
      setErreur(true);
    } finally {
      setEnCours(false);
    }
  }

  return (
    <span className="inline-flex flex-col items-end gap-1">
      <Bouton
        type="button"
        variante="secondaire"
        taille="sm"
        onClick={lancer}
        disabled={enCours || classes.length === 0}
      >
        {enCours ? (
          <Loader2 size={14} className="animate-spin" aria-hidden />
        ) : (
          <Download size={14} aria-hidden />
        )}
        {enCours ? "Création…" : libelle}
      </Bouton>
      {erreur && (
        <span className="text-[11px] text-impaye" role="alert">
          Export impossible. Réessayez.
        </span>
      )}
    </span>
  );
}
