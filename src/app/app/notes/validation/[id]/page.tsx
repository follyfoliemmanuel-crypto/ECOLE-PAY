import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import { ArrowLeft, CalendarClock, Layers, UserRound, Users } from "lucide-react";
import { exigerSession, estDirecteur } from "@/lib/auth";
import { peut } from "@/lib/offres";
import { estUuid } from "@/lib/actions/helpers";
import { corrigerNotesDirecteur } from "@/lib/actions/saisies";
import { grilleSaisie, saisieParId } from "@/lib/data/saisies";
import {
  libelleTrimestreSaisie,
  nomAvecTitre,
} from "@/lib/saisies";
import { formatDate } from "@/lib/format";
import { BadgeSaisie } from "@/components/notes/badge-saisie";
import { TableauNotes } from "@/components/notes/tableau-notes";
import { ActionsValidation } from "@/components/notes/validation-notes";
import { Alerte } from "@/components/ui/empty-state";
import { LienBouton } from "@/components/ui/button";

export const metadata: Metadata = { title: "Saisie à valider" };

export default async function PageValidationSaisie({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const session = await exigerSession();
  const { id } = await params;
  if (!estUuid(id)) notFound();

  if (!peut(session.ecole, "validation_notes")) {
    redirect(
      `/premium?depuis=${encodeURIComponent("la validation des notes")}`,
    );
  }

  if (!estDirecteur(session)) {
    return (
      <div className="space-y-4">
        <Alerte ton="erreur">
          Seul le directeur peut valider et publier les notes.
        </Alerte>
        <LienBouton href="/app/notes/validation" taille="sm" variante="secondaire">
          <ArrowLeft size={15} aria-hidden />
          Retour
        </LienBouton>
      </div>
    );
  }

  const saisie = await saisieParId(session.ecoleId, id);
  if (!saisie) notFound();

  const lignes = await grilleSaisie(session.ecoleId, saisie.annee_scolaire, {
    classe_id: saisie.classe_id,
    matiere_id: saisie.matiere_id,
    trimestre: saisie.trimestre,
  });

  const notesSaisies = lignes.filter(
    (ligne) =>
      ligne.devoir1 !== null ||
      ligne.devoir2 !== null ||
      ligne.composition !== null,
  ).length;

  const lectureSeule = saisie.statut !== "ENVOYE" && saisie.statut !== "VALIDE";

  return (
    <div className="space-y-5">
      <div>
        <LienBouton
          href="/app/notes/validation"
          variante="fantome"
          taille="sm"
        >
          <ArrowLeft size={15} aria-hidden />
          Validation des notes
        </LienBouton>
      </div>

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
              <UserRound size={14} aria-hidden />
              {saisie.prof_id
                ? nomAvecTitre(saisie.prof_prenom, saisie.prof_nom)
                : "Saisie directe du directeur"}
            </span>
            <span className="inline-flex items-center gap-1.5">
              <Users size={14} aria-hidden />
              {lignes.length} élève{lignes.length > 1 ? "s" : ""}
            </span>
            <span className="inline-flex items-center gap-1.5">
              <Layers size={14} aria-hidden />
              {notesSaisies} noté{notesSaisies > 1 ? "s" : ""}
            </span>
            {saisie.envoye_le && (
              <span className="inline-flex items-center gap-1.5">
                <CalendarClock size={14} aria-hidden />
                Envoyé le {formatDate(saisie.envoye_le)}
              </span>
            )}
          </p>
        </div>
        <BadgeSaisie statut={saisie.statut} />
      </div>

      {saisie.statut === "EN_COURS" && (
        <Alerte ton="info">
          Le professeur travaille encore sur cette combinaison. Vous pouvez
          consulter son brouillon ou libérer la combinaison s&apos;il ne
          s&apos;agit pas du bon professeur.
        </Alerte>
      )}

      {saisie.statut === "VALIDE" && (
        <Alerte ton="succes">
          Ces notes sont validées et publiées. Une correction enregistrée
          ci-dessous est visible immédiatement par les parents.
        </Alerte>
      )}

      {saisie.statut === "LIBERE" && (
        <Alerte ton="info">
          Cette combinaison a été libérée
          {saisie.libere_le ? ` le ${formatDate(saisie.libere_le)}` : ""}. Elle
          peut être reprise par un professeur ; les notes restent enregistrées.
        </Alerte>
      )}

      <ActionsValidation
        saisieId={saisie.id}
        statut={saisie.statut}
        classeNom={saisie.classe_nom}
        matiereNom={saisie.matiere_nom}
        profNom={
          saisie.prof_id
            ? nomAvecTitre(saisie.prof_prenom, saisie.prof_nom)
            : null
        }
      />

      <TableauNotes
        saisieId={saisie.id}
        lignes={lignes}
        action={corrigerNotesDirecteur}
        lectureSeule={lectureSeule}
        statut={saisie.statut}
        mode="directeur"
        retourHref="/app/notes/validation"
        envoyeLe={saisie.envoye_le}
      />
    </div>
  );
}
