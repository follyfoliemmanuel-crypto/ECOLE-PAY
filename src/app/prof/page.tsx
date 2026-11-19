import type { Metadata } from "next";
import Link from "next/link";
import {
  ArrowRight,
  CalendarClock,
  CheckCircle2,
  ClipboardList,
  Clock3,
  Info,
  LockKeyhole,
  School,
} from "lucide-react";
import { exigerProf } from "@/lib/auth";
import { peut } from "@/lib/offres";
import { anneeScolaire, libelleAnnee } from "@/lib/mois";
import { listerClasses } from "@/lib/data/classes";
import { listerMatieres } from "@/lib/data/notes";
import {
  echeanceNotes,
  profConnecte,
  saisiesTrimestre,
  type EcheanceNotes,
} from "@/lib/data/saisies";
import {
  libelleTrimestreSaisie,
  nomCompletProf,
  nomAvecTitre,
  trimestreDepuisParametre,
  TRIMESTRES_SAISIE,
} from "@/lib/saisies";
import { formatDate } from "@/lib/format";
import { BadgeSaisie } from "@/components/notes/badge-saisie";
import { ChoisirSaisie } from "@/components/prof/choisir-saisie";
import { EntetePage } from "@/components/app/entete-page";
import { Alerte, EmptyState } from "@/components/ui/empty-state";
import { LienBouton } from "@/components/ui/button";
import type { SaisieNotes } from "@/lib/types";
import { cx } from "@/lib/cx";

export const metadata: Metadata = { title: "Ma saisie de notes" };

function CarteEcheance({ echeance }: { echeance: EcheanceNotes | null }) {
  if (!echeance) {
    return (
      <div className="flex items-start gap-2.5 rounded-sm border border-line bg-surface px-3.5 py-3 text-[12.5px] text-muted">
        <CalendarClock size={15} className="mt-0.5 shrink-0" aria-hidden />
        <p>
          Aucune date limite n&apos;est fixée pour ce trimestre. Envoyez vos
          notes dès que votre tableau est complet.
        </p>
      </div>
    );
  }

  const retard = echeance.jours_restants < 0;
  const aujourdhui = echeance.jours_restants === 0;

  return (
    <div
      className={cx(
        "flex items-start gap-2.5 rounded-sm border px-3.5 py-3 text-[12.5px]",
        retard
          ? "border-impaye/25 bg-impaye-soft text-impaye"
          : "border-ochre/30 bg-[#fbf1de] text-[#7a5010]",
      )}
    >
      <Clock3 size={15} className="mt-0.5 shrink-0" aria-hidden />
      <p>
        <span className="font-semibold">
          Notes à envoyer avant le {formatDate(echeance.date_limite)}.
        </span>{" "}
        {retard
          ? `La date limite est dépassée de ${Math.abs(echeance.jours_restants)} jour${Math.abs(echeance.jours_restants) > 1 ? "s" : ""}. Envoyez vos notes au plus vite.`
          : aujourdhui
            ? "C'est aujourd'hui la date limite : envoyez vos notes maintenant."
            : `Il vous reste ${echeance.jours_restants} jour${echeance.jours_restants > 1 ? "s" : ""}.`}
      </p>
    </div>
  );
}

function LigneSaisie({
  saisie,
  profId,
}: {
  saisie: SaisieNotes;
  profId: string;
}) {
  const estMienne = saisie.prof_id === profId;
  const modifiable = estMienne && saisie.statut === "EN_COURS";

  const contenu = (
    <>
      <div className="flex min-w-0 items-start gap-3">
        <span
          className={cx(
            "mt-0.5 grid size-8 shrink-0 place-items-center rounded-full border",
            estMienne
              ? "border-brand/15 bg-brand-soft text-brand"
              : "border-line bg-surface-2 text-muted",
          )}
        >
          {estMienne ? (
            <ClipboardList size={15} aria-hidden />
          ) : (
            <LockKeyhole size={14} aria-hidden />
          )}
        </span>
        <div className="min-w-0">
          <p className="text-[13.5px] font-semibold text-ink">
            {saisie.matiere_nom} · {saisie.classe_nom}
          </p>
          <p className="mt-0.5 text-[12px] text-muted">
            {saisie.statut === "VALIDE"
              ? saisie.prof_id
                ? `Validé · saisie de ${nomAvecTitre(saisie.prof_prenom, saisie.prof_nom)}`
                : "Validé et publié par le directeur"
              : estMienne
                ? `${saisie.nb_notes} élève${saisie.nb_notes > 1 ? "s" : ""} noté${saisie.nb_notes > 1 ? "s" : ""}`
                : saisie.prof_id
                  ? `Déjà en cours par ${nomAvecTitre(saisie.prof_prenom, saisie.prof_nom)}`
                  : "Saisie réservée au directeur"}
          </p>
        </div>
      </div>

      <div className="flex shrink-0 items-center gap-2">
        <BadgeSaisie statut={saisie.statut} />
        {modifiable || (estMienne && saisie.statut !== "EN_COURS") ? (
          <span className="inline-flex items-center gap-1 text-[12px] font-semibold text-brand">
            {modifiable ? "Continuer" : "Consulter"}
            <ArrowRight size={13} aria-hidden />
          </span>
        ) : null}
      </div>
    </>
  );

  if (modifiable || estMienne) {
    return (
      <Link
        href={`/prof/saisie/${saisie.id}`}
        className="flex flex-wrap items-center justify-between gap-3 border-b border-line px-4 py-3 transition-colors last:border-b-0 hover:bg-surface-2/70"
      >
        {contenu}
      </Link>
    );
  }

  return (
    <div className="flex flex-wrap items-center justify-between gap-3 border-b border-line px-4 py-3 last:border-b-0">
      {contenu}
    </div>
  );
}

export default async function PageProf({
  searchParams,
}: {
  searchParams: Promise<{ trimestre?: string }>;
}) {
  const session = await exigerProf();
  const profId = session.profId as string;
  const parametres = await searchParams;
  const trimestre = trimestreDepuisParametre(parametres.trimestre);
  const annee = anneeScolaire();

  if (!peut(session.ecole, "saisie_notes_prof")) {
    return (
      <div className="space-y-5">
        <EntetePage
          surtitre="Espace professeur"
          titre="Saisie des notes"
          description="La saisie des notes par les professeurs est réservée à l'offre PREMIUM."
        />
        <Alerte ton="erreur">
          Cette fonctionnalité est réservée à l&apos;offre PREMIUM 35.000F.
          Demandez au directeur de vérifier l&apos;abonnement SCHOOL PAY de{" "}
          {session.ecole.nom}.
        </Alerte>
      </div>
    );
  }

  const [prof, classes, matieres, saisies, echeance] = await Promise.all([
    profConnecte(session.ecoleId, profId),
    listerClasses(session.ecoleId, annee),
    listerMatieres(session.ecoleId),
    saisiesTrimestre(session.ecoleId, annee, trimestre),
    echeanceNotes(session.ecoleId, annee, trimestre),
  ]);

  const nom = prof ? nomCompletProf(prof.prenom, prof.nom) : session.nom;
  const mesSaisies = saisies.filter((saisie) => saisie.prof_id === profId);
  const autresSaisies = saisies.filter((saisie) => saisie.prof_id !== profId);
  const enAttente = mesSaisies.filter((s) => s.statut === "EN_COURS").length;
  const envoyees = mesSaisies.filter((s) => s.statut === "ENVOYE").length;
  const validees = mesSaisies.filter((s) => s.statut === "VALIDE").length;

  return (
    <div className="space-y-6">
      <EntetePage
        surtitre={`${libelleTrimestreSaisie(trimestre)} · ${libelleAnnee(annee)}`}
        titre={`Bonjour ${nom}`}
        description="Choisissez librement une classe et une matière pour saisir les Devoirs 1 et 2 ainsi que la Composition. Vous pouvez changer de classe et de matière à tout moment."
        actions={
          <div className="flex items-center gap-1 rounded-sm border border-line bg-surface p-1">
            {TRIMESTRES_SAISIE.map((element) => (
              <Link
                key={element.valeur}
                href={`/prof?trimestre=${element.valeur}`}
                className={cx(
                  "rounded-sm px-2.5 py-1.5 text-[12px] font-semibold transition-colors",
                  element.valeur === trimestre
                    ? "bg-brand text-white"
                    : "text-muted hover:bg-surface-2 hover:text-ink",
                )}
              >
                {element.valeur === 1 ? "T1" : element.valeur === 2 ? "T2" : "T3"}
              </Link>
            ))}
          </div>
        }
      />

      <CarteEcheance echeance={echeance} />

      <ChoisirSaisie
        classes={classes.map((classe) => ({
          id: classe.id,
          nom: classe.nom,
          nb_eleves: classe.nb_eleves,
        }))}
        matieres={matieres}
        trimestre={trimestre}
        nomProf={nomAvecTitre(prof?.prenom, prof?.nom)}
      />

      <div className="grid gap-4 lg:grid-cols-3">
        <div className="card px-4 py-3">
          <p className="text-[10.5px] font-semibold uppercase tracking-[0.1em] text-muted">
            En cours
          </p>
          <p className="mt-1 text-[22px] font-semibold tabular-nums text-ochre">
            {enAttente}
          </p>
          <p className="text-[12px] text-muted">Brouillon à terminer</p>
        </div>
        <div className="card px-4 py-3">
          <p className="text-[10.5px] font-semibold uppercase tracking-[0.1em] text-muted">
            Envoyées
          </p>
          <p className="mt-1 text-[22px] font-semibold tabular-nums text-brand">
            {envoyees}
          </p>
          <p className="text-[12px] text-muted">En attente du directeur</p>
        </div>
        <div className="card px-4 py-3">
          <p className="text-[10.5px] font-semibold uppercase tracking-[0.1em] text-muted">
            Validées
          </p>
          <p className="mt-1 text-[22px] font-semibold tabular-nums text-paye">
            {validees}
          </p>
          <p className="text-[12px] text-muted">Publiées aux parents</p>
        </div>
      </div>

      <section className="card overflow-hidden">
        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-line px-4 py-3">
          <div>
            <h2 className="text-[14px] font-semibold text-ink">Mes saisies</h2>
            <p className="text-[12px] text-muted">
              {libelleTrimestreSaisie(trimestre)}
            </p>
          </div>
          <span className="inline-flex items-center gap-1 text-[11.5px] text-muted">
            <Info size={13} aria-hidden />
            Le professeur ne publie jamais : seul le directeur valide.
          </span>
        </div>
        {mesSaisies.length === 0 ? (
          <EmptyState
            icone={<School size={18} aria-hidden />}
            titre="Aucune saisie pour ce trimestre"
            description="Choisissez une classe et une matière ci-dessus, puis cliquez sur COMMENCER LA SAISIE."
          />
        ) : (
          mesSaisies.map((saisie) => (
            <LigneSaisie key={saisie.id} saisie={saisie} profId={profId} />
          ))
        )}
      </section>

      <section className="card overflow-hidden">
        <div className="border-b border-line px-4 py-3">
          <h2 className="text-[14px] font-semibold text-ink">
            Combinaisons déjà traitées
          </h2>
          <p className="text-[12px] text-muted">
            Une combinaison Classe + Matière est réservée à un seul professeur
            jusqu&apos;à validation ou libération par le directeur.
          </p>
        </div>
        {autresSaisies.length === 0 ? (
          <EmptyState
            icone={<CheckCircle2 size={18} aria-hidden />}
            titre="Toutes les combinaisons sont libres"
            description="Les autres professeurs n'ont pas encore commencé de saisie sur ce trimestre."
          />
        ) : (
          autresSaisies.map((saisie) => (
            <LigneSaisie key={saisie.id} saisie={saisie} profId={profId} />
          ))
        )}
      </section>

      <div className="flex justify-center">
        <LienBouton href="/prof" variante="fantome" taille="sm">
          Recharger mon espace
        </LienBouton>
      </div>
    </div>
  );
}
