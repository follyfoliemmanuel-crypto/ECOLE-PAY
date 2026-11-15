import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { ArrowLeft, CalendarClock, Layers, Users } from "lucide-react";
import { exigerProf } from "@/lib/auth";
import { estUuid } from "@/lib/actions/helpers";
import { enregistrerSaisieNotes } from "@/lib/actions/saisies";
import { grilleSaisie, saisieParId } from "@/lib/data/saisies";
import {
  libelleTrimestreSaisie,
  messageVerrou,
  nomAvecTitre,
} from "@/lib/saisies";
import { BadgeSaisie } from "@/components/notes/badge-saisie";
import { TableauNotes } from "@/components/notes/tableau-notes";
import { Alerte } from "@/components/ui/empty-state";
import { LienBouton } from "@/components/ui/button";

export const metadata: Metadata = { title: "Saisie des notes" };

export default async function PageSaisieProf({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const session = await exigerProf();
  const { id } = await params;
  if (!estUuid(id)) notFound();

  const saisie = await saisieParId(session.ecoleId, id);
  if (!saisie) notFound();

  const estMienne = saisie.prof_id === session.profId;

  if (!estMienne) {
    return (
      <div className="space-y-4">
        <LienBouton href="/prof" variante="fantome" taille="sm">
          <ArrowLeft size={15} aria-hidden />
          Mes saisies
        </LienBouton>
        <Alerte ton="erreur">
          {saisie.statut === "VALIDE"
            ? `Ces notes ont déjà été validées et publiées (saisie de ${nomAvecTitre(saisie.prof_prenom, saisie.prof_nom)}).`
            : messageVerrou(
                saisie.prof_prenom,
                saisie.prof_nom,
                saisie.statut,
              )}
        </Alerte>
        <p className="text-[13px] leading-relaxed text-muted">
          {saisie.classe_nom} · {saisie.matiere_nom} est réservé à un autre
          professeur. Choisissez une autre combinaison dans votre espace, ou
          demandez au directeur de libérer celle-ci.
        </p>
      </div>
    );
  }

  const lignes = await grilleSaisie(session.ecoleId, saisie.annee_scolaire, {
    classe_id: saisie.classe_id,
    matiere_id: saisie.matiere_id,
    trimestre: saisie.trimestre,
  });

  const lectureSeule = saisie.statut !== "EN_COURS";
  const notesSaisies = lignes.filter(
    (ligne) =>
      ligne.devoir1 !== null ||
      ligne.devoir2 !== null ||
      ligne.composition !== null,
  ).length;

  return (
    <div className="space-y-5">
      <LienBouton href="/prof" variante="fantome" taille="sm">
        <ArrowLeft size={15} aria-hidden />
        Mes saisies
      </LienBouton>

      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-[10.5px] font-semibold uppercase tracking-[0.14em] text-ochre">
            {libelleTrimestreSaisie(saisie.trimestre)} ·{" "}
            {saisie.annee_scolaire.replace("-", " - ")}
          </p>
          <h1 className="mt-1 text-[24px] font-semibold leading-tight tracking-[-0.035em] text-ink">
            {saisie.matiere_nom} · {saisie.classe_nom}
          </h1>
          <p className="mt-1.5 flex flex-wrap items-center gap-x-4 gap-y-1 text-[12.5px] text-muted">
            <span className="inline-flex items-center gap-1.5">
              <Users size={14} aria-hidden />
              {lignes.length} élève{lignes.length > 1 ? "s" : ""}
            </span>
            <span className="inline-flex items-center gap-1.5">
              <Layers size={14} aria-hidden />
              {notesSaisies} élève{notesSaisies > 1 ? "s" : ""} noté
              {notesSaisies > 1 ? "s" : ""}
            </span>
            {saisie.envoye_le && (
              <span className="inline-flex items-center gap-1.5">
                <CalendarClock size={14} aria-hidden />
                Envoyé le {new Date(saisie.envoye_le).toLocaleDateString("fr-FR")}
              </span>
            )}
          </p>
        </div>
        <BadgeSaisie statut={saisie.statut} />
      </div>

      {saisie.statut === "EN_COURS" && (
        <p className="rounded-sm border border-brand/15 bg-brand-soft px-3.5 py-2.5 text-[12.5px] leading-relaxed text-brand">
          Cette combinaison vous est réservée. Les autres professeurs voient
          « Déjà en cours par vous ». Enregistrez un brouillon quand vous le
          souhaitez, puis envoyez au directeur une fois le tableau complet.
        </p>
      )}

      <TableauNotes
        saisieId={saisie.id}
        lignes={lignes}
        action={enregistrerSaisieNotes}
        lectureSeule={lectureSeule}
        statut={saisie.statut}
        mode="prof"
        retourHref="/prof"
        envoyeLe={saisie.envoye_le}
      />
    </div>
  );
}
