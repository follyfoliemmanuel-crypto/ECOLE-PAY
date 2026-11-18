import type { Metadata } from "next";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { ArrowLeft, BookOpen } from "lucide-react";
import { exigerSession } from "@/lib/auth";
import { peut } from "@/lib/offres";
import { libelleAnnee } from "@/lib/mois";
import { anneeActive } from "@/lib/data/annees";
import { listerClasses } from "@/lib/data/classes";
import { grilleNotes } from "@/lib/data/notes";
import { estUuid } from "@/lib/actions/helpers";
import { EntetePage } from "@/components/app/entete-page";
import { SaisieNotes } from "@/components/notes/saisie-notes";
import { EmptyState } from "@/components/ui/empty-state";
import { LienBouton } from "@/components/ui/button";
import type { Trimestre } from "@/lib/types";
import { cx } from "@/lib/cx";

export const metadata: Metadata = { title: "Saisie des notes" };

const TRIMESTRES: { valeur: Trimestre; libelle: string }[] = [
  { valeur: 1, libelle: "1er trimestre" },
  { valeur: 2, libelle: "2e trimestre" },
  { valeur: 3, libelle: "3e trimestre" },
];

function lireTrimestre(valeur: string | undefined): Trimestre {
  const nombre = Number.parseInt(valeur ?? "", 10);
  return nombre === 2 || nombre === 3 ? nombre : 1;
}

export default async function PageSaisieNotes({
  searchParams,
}: {
  searchParams: Promise<{ classe?: string; trimestre?: string }>;
}) {
  const session = await exigerSession();
  if (!peut(session.ecole, "notes_bulletins")) {
    redirect("/app/notes");
  }

  const parametres = await searchParams;
  const trimestre = lireTrimestre(parametres.trimestre);

  if (!parametres.classe || !estUuid(parametres.classe)) {
    redirect(`/app/notes?trimestre=${trimestre}`);
  }

  const annee = await anneeActive(session.ecoleId);
  const [classes, grille] = await Promise.all([
    listerClasses(session.ecoleId, annee),
    grilleNotes(session.ecoleId, annee, parametres.classe, trimestre),
  ]);
  const classe = classes.find((element) => element.id === parametres.classe);
  if (!classe) notFound();

  return (
    <div>
      <EntetePage
        surtitre={`${libelleAnnee(annee)} · ${TRIMESTRES.find((t) => t.valeur === trimestre)?.libelle}`}
        titre={`Notes · ${classe.nom}`}
        description={`${grille.eleves.length} élève${grille.eleves.length > 1 ? "s" : ""} et ${grille.matieres.length} matière${grille.matieres.length > 1 ? "s" : ""}. Saisissez les notes sur 20, les moyennes se calculent automatiquement.`}
        actions={
          <>
            <form
              method="get"
              action="/app/notes/saisie"
              className="flex items-center gap-1.5"
            >
              <input type="hidden" name="trimestre" value={trimestre} />
              <label className="sr-only" htmlFor="choix-classe">
                Choisir une classe
              </label>
              <select
                id="choix-classe"
                name="classe"
                defaultValue={classe.id}
                className="h-8 rounded-sm border border-line-strong bg-surface px-2 text-[12px] text-ink"
              >
                {classes.map((element) => (
                  <option key={element.id} value={element.id}>
                    {element.nom}
                  </option>
                ))}
              </select>
              <button
                type="submit"
                className="inline-flex h-8 items-center rounded-sm border border-line-strong bg-surface px-2.5 text-[11.5px] font-semibold text-ink hover:bg-surface-2"
              >
                Ouvrir
              </button>
            </form>
            <LienBouton href={`/app/notes?trimestre=${trimestre}`} variante="secondaire" taille="sm">
              <ArrowLeft size={14} aria-hidden />
              Retour
            </LienBouton>
          </>
        }
      />

      <div className="mb-4 flex flex-wrap items-center gap-1.5">
        {TRIMESTRES.map((option) => (
          <Link
            key={option.valeur}
            href={`/app/notes/saisie?classe=${classe.id}&trimestre=${option.valeur}`}
            className={cx(
              "inline-flex h-7 items-center rounded-sm border px-2 text-[11px] font-semibold transition-colors",
              trimestre === option.valeur
                ? "border-brand bg-brand text-white"
                : "border-line-strong bg-surface text-ink-2 hover:bg-surface-2",
            )}
          >
            {option.libelle}
          </Link>
        ))}
      </div>

      {grille.matieres.length === 0 ? (
        <div className="card">
          <EmptyState
            icone={<BookOpen size={18} />}
            titre="Ajoutez d'abord vos matières"
            description="Les notes se saisissent matière par matière. Ajoutez le programme et les coefficients de l'école pour commencer."
            action={
              <LienBouton href={`/app/notes?trimestre=${trimestre}`}>
                Gérer les matières
              </LienBouton>
            }
          />
        </div>
      ) : (
        <SaisieNotes
          key={`${classe.id}-${trimestre}`}
          classeId={classe.id}
          classeNom={classe.nom}
          annee={annee}
          trimestre={trimestre}
          eleves={grille.eleves}
          matieres={grille.matieres}
          notes={grille.notes}
        />
      )}
    </div>
  );
}
