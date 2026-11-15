import type { Metadata } from "next";
import Link from "next/link";
import { ArrowRight, BookOpen, ClipboardList, FileText, School } from "lucide-react";
import { exigerSession, estDirecteur } from "@/lib/auth";
import { peut } from "@/lib/offres";
import { anneeScolaire, libelleAnnee } from "@/lib/mois";
import { formatDate } from "@/lib/format";
import { listerClasses } from "@/lib/data/classes";
import { listerMatieres, resumeNotes } from "@/lib/data/notes";
import { compteursSaisies, echeanceNotes } from "@/lib/data/saisies";
import { BoutonPremium } from "@/components/offres/verrou-premium";
import { EntetePage } from "@/components/app/entete-page";
import { GestionMatieres } from "@/components/notes/gestion-matieres";
import { EmptyState } from "@/components/ui/empty-state";
import { LienBouton } from "@/components/ui/button";
import type { Trimestre } from "@/lib/types";
import { cx } from "@/lib/cx";

export const metadata: Metadata = { title: "Notes & bulletins" };

const TRIMESTRES: { valeur: Trimestre; libelle: string }[] = [
  { valeur: 1, libelle: "1er trimestre" },
  { valeur: 2, libelle: "2e trimestre" },
  { valeur: 3, libelle: "3e trimestre" },
];

function lireTrimestre(valeur: string | undefined): Trimestre {
  const nombre = Number.parseInt(valeur ?? "", 10);
  return nombre === 2 || nombre === 3 ? nombre : 1;
}

export default async function PageNotes({
  searchParams,
}: {
  searchParams: Promise<{ trimestre?: string }>;
}) {
  const session = await exigerSession();
  const peutValidation = peut(session.ecole, "validation_notes");
  const peutComptesProfs = peut(session.ecole, "comptes_profs");

  const parametres = await searchParams;
  const trimestre = lireTrimestre(parametres.trimestre);
  const annee = anneeScolaire();
  const directeur = estDirecteur(session);

  const [matieres, classes, resume, saisies, echeance] = await Promise.all([
    listerMatieres(session.ecoleId),
    listerClasses(session.ecoleId, annee),
    resumeNotes(session.ecoleId, annee, trimestre),
    compteursSaisies(session.ecoleId, annee, trimestre),
    echeanceNotes(session.ecoleId, annee, trimestre),
  ]);

  const parClasse = new Map(resume.map((ligne) => [ligne.classe_id, ligne]));
  const totalNotes = resume.reduce((somme, ligne) => somme + ligne.notes_saisies, 0);
  const totalElevesNotes = resume.reduce(
    (somme, ligne) => somme + ligne.eleves_notes,
    0,
  );
  const totalEleves = classes.reduce((somme, classe) => somme + classe.nb_eleves, 0);

  return (
    <div>
      <EntetePage
        surtitre={`${libelleAnnee(annee)} · ${TRIMESTRES.find((t) => t.valeur === trimestre)?.libelle}`}
        titre="Notes & bulletins"
        description="Ajoutez les matières et leurs coefficients, saisissez les notes par classe, puis imprimez les bulletins avec moyennes, rangs et mentions."
        actions={
          <div className="flex flex-wrap items-center gap-1.5">
            {TRIMESTRES.map((option) => (
              <Link
                key={option.valeur}
                href={`/app/notes?trimestre=${option.valeur}`}
                aria-current={trimestre === option.valeur ? "page" : undefined}
                className={cx(
                  "inline-flex h-8 items-center rounded-sm border px-2.5 text-[11.5px] font-semibold transition-colors",
                  trimestre === option.valeur
                    ? "border-brand bg-brand text-white"
                    : "border-line-strong bg-surface text-ink-2 hover:bg-surface-2",
                )}
              >
                {option.libelle}
              </Link>
            ))}
          </div>
        }
      />

      <div className="mb-5 grid grid-cols-2 divide-x divide-line overflow-hidden rounded-lg border border-line bg-surface sm:grid-cols-4">
        {[
          {
            libelle: "Matières",
            valeur: `${matieres.length}`,
            detail: "avec coefficients",
            icone: BookOpen,
          },
          {
            libelle: "Classes",
            valeur: `${classes.length}`,
            detail: `${totalEleves} élève${totalEleves > 1 ? "s" : ""} actif${totalEleves > 1 ? "s" : ""}`,
            icone: School,
          },
          {
            libelle: "Notes saisies",
            valeur: `${totalNotes}`,
            detail: "sur le trimestre",
            icone: ClipboardList,
          },
          {
            libelle: "Élèves évalués",
            valeur: `${totalElevesNotes}`,
            detail: totalEleves > 0 ? `sur ${totalEleves}` : "aucun élève",
            icone: FileText,
          },
        ].map((bloc) => {
          const Icone = bloc.icone;
          return (
            <div key={bloc.libelle} className="px-4 py-3.5">
              <p className="flex items-center gap-1.5 text-[9.5px] font-semibold uppercase tracking-[0.11em] text-muted">
                <Icone size={11} aria-hidden />
                {bloc.libelle}
              </p>
              <p className="chiffre mt-1 text-[15px] font-medium text-ink">
                {bloc.valeur}
              </p>
              <p className="mt-0.5 text-[10.5px] text-muted">{bloc.detail}</p>
            </div>
          );
        })}
      </div>

      <div className="mb-5 card flex flex-wrap items-center justify-between gap-4 px-4 py-4">
        <div className="min-w-0">
          <p className="flex items-center gap-2 text-[13.5px] font-semibold text-ink">
            <ClipboardList size={16} className="text-brand" aria-hidden />
            Saisie des notes par les professeurs
          </p>
          <p className="mt-1 text-[12px] text-muted">
            {peutComptesProfs
              ? `${saisies.en_cours} brouillon${saisies.en_cours > 1 ? "s" : ""} en cours · ${saisies.envoyes} envoi${saisies.envoyes > 1 ? "s" : ""} à valider · ${saisies.valides} validé${saisies.valides > 1 ? "s" : ""}${
                  echeance
                    ? ` · date limite : ${formatDate(echeance.date_limite)}`
                    : " · aucune date limite fixée"
                }`
              : "Comptes professeurs, saisie en ligne et validation : réservé à PREMIUM 40.000F. Vous pouvez toujours saisir les notes manuellement ci-dessous."}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          {peutValidation ? (
            <LienBouton
              href={`/app/notes/validation?trimestre=${trimestre}`}
              taille="sm"
            >
              Valider les notes
              {saisies.envoyes > 0 && (
                <span className="ml-1 inline-flex size-5 items-center justify-center rounded-full bg-white/20 text-[10px] font-bold">
                  {saisies.envoyes}
                </span>
              )}
              <ArrowRight size={14} aria-hidden />
            </LienBouton>
          ) : (
            <BoutonPremium taille="sm" contexte="la validation des notes">
              VALIDER LES NOTES
            </BoutonPremium>
          )}
          {peutComptesProfs ? (
            <LienBouton
              href="/app/profs"
              variante="secondaire"
              taille="sm"
            >
              Comptes professeurs
            </LienBouton>
          ) : (
            <BoutonPremium taille="sm" contexte="les comptes professeurs">
              COMPTES PROFESSEURS
            </BoutonPremium>
          )}
        </div>
      </div>

      <GestionMatieres matieres={matieres} directeur={directeur} />

      <div className="mb-3 flex flex-wrap items-end justify-between gap-2">
        <div>
          <h2 className="text-[15px] font-semibold text-ink">Saisie par classe</h2>
          <p className="mt-0.5 text-[11.5px] text-muted">
            Choisissez une classe pour saisir les notes ou imprimer les bulletins
            du trimestre sélectionné.
          </p>
        </div>
      </div>

      {classes.length === 0 ? (
        <div className="card">
          <EmptyState
            icone={<School size={18} />}
            titre="Aucune classe à noter"
            description="Créez d'abord vos classes et inscrivez les élèves. Ils apparaîtront ici pour la saisie des notes."
            action={<LienBouton href="/app/classes">Créer une classe</LienBouton>}
          />
        </div>
      ) : (
        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
          {classes.map((classe) => {
            const stats = parClasse.get(classe.id);
            const notesClasse = stats?.notes_saisies ?? 0;
            const elevesNotes = stats?.eleves_notes ?? 0;
            const attendu = classe.nb_eleves * Math.max(1, matieres.length);
            const taux =
              attendu > 0 ? Math.round((notesClasse / attendu) * 100) : 0;

            return (
              <section key={classe.id} className="card flex flex-col overflow-hidden">
                <div className="border-b border-line px-4 py-3">
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <h3 className="truncate text-[14.5px] font-semibold text-ink">
                        {classe.nom}
                      </h3>
                      <p className="mt-0.5 text-[11px] text-muted">
                        {classe.nb_eleves} élève{classe.nb_eleves > 1 ? "s" : ""} ·{" "}
                        {elevesNotes} évalué{elevesNotes > 1 ? "s" : ""}
                      </p>
                    </div>
                    <span className="chiffre shrink-0 rounded-sm border border-line bg-surface-2 px-2 py-1 text-[10.5px] text-ink-2">
                      {taux} %
                    </span>
                  </div>
                  <div className="mt-2.5 flex h-1.5 w-full overflow-hidden rounded-full bg-line">
                    <span
                      className="h-full bg-paye"
                      style={{ width: `${Math.min(100, taux)}%` }}
                    />
                  </div>
                  <p className="mt-1.5 text-[10.5px] text-muted">
                    {notesClasse} note{notesClasse > 1 ? "s" : ""} sur{" "}
                    {attendu} attendue{attendu > 1 ? "s" : ""}
                  </p>
                </div>

                <div className="flex flex-1 flex-col justify-between gap-2 px-4 py-3">
                  <div className="flex flex-wrap gap-1.5">
                    <Link
                      href={`/app/notes/saisie?classe=${classe.id}&trimestre=${trimestre}`}
                      className="inline-flex h-8 items-center gap-1.5 rounded-sm bg-brand px-2.5 text-[11.5px] font-semibold text-white transition-colors hover:bg-brand-deep"
                    >
                      <ClipboardList size={13} aria-hidden />
                      Saisir les notes
                    </Link>
                    <Link
                      href={`/app/notes/bulletins?classe=${classe.id}&trimestre=${trimestre}`}
                      className="inline-flex h-8 items-center gap-1.5 rounded-sm border border-line-strong px-2.5 text-[11.5px] font-semibold text-ink transition-colors hover:bg-surface-2"
                    >
                      <FileText size={13} aria-hidden />
                      Bulletins
                    </Link>
                  </div>
                  <Link
                    href={`/app/eleves?classe=${classe.id}`}
                    className="inline-flex items-center gap-1 text-[11px] font-semibold text-brand hover:underline"
                  >
                    Voir les élèves
                    <ArrowRight size={11} aria-hidden />
                  </Link>
                </div>
              </section>
            );
          })}
        </div>
      )}
    </div>
  );
}
