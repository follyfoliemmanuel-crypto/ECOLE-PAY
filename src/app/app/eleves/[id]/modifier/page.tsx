import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ChevronRight } from "lucide-react";
import { exigerSession } from "@/lib/auth";
import { anneeScolaire } from "@/lib/mois";
import { getEleve } from "@/lib/data/eleves";
import { listerClasses } from "@/lib/data/classes";
import { estUuid } from "@/lib/actions/helpers";
import { EntetePage } from "@/components/app/entete-page";
import { FormulaireEleve } from "@/components/eleves/formulaire-eleve";
import { LienBouton } from "@/components/ui/button";

export const metadata: Metadata = { title: "Modifier un élève" };

export default async function PageModifierEleve({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const session = await exigerSession();
  const { id } = await params;
  if (!estUuid(id)) notFound();

  const annee = anneeScolaire();
  const [eleve, classes] = await Promise.all([
    getEleve(session.ecoleId, id),
    listerClasses(session.ecoleId, annee),
  ]);

  if (!eleve) notFound();

  return (
    <div className="mx-auto max-w-3xl">
      <nav
        aria-label="Fil d'Ariane"
        className="mb-4 flex flex-wrap items-center gap-1.5 text-[11.5px] text-muted"
      >
        <Link href="/app/eleves" className="hover:text-ink">
          Élèves
        </Link>
        <ChevronRight size={12} aria-hidden />
        <Link href={`/app/eleves/${eleve.id}`} className="hover:text-ink">
          {eleve.prenom} {eleve.nom}
        </Link>
        <ChevronRight size={12} aria-hidden />
        <span className="text-ink-2">Modifier</span>
      </nav>

      <EntetePage
        surtitre={`Inscrit en ${eleve.classe_nom}`}
        titre="Modifier l'élève"
        description="Le changement de classe s'applique aux échéances qui n'ont pas encore été payées."
        actions={
          <LienBouton href={`/app/eleves/${eleve.id}`} variante="secondaire" taille="sm">
            Annuler
          </LienBouton>
        }
      />

      <div className="card p-5 sm:p-6">
        <FormulaireEleve
          classes={classes}
          annee={annee}
          eleve={{
            id: eleve.id,
            nom: eleve.nom,
            prenom: eleve.prenom,
            sexe: eleve.sexe,
            classe_id: eleve.classe_id,
            nom_parent: eleve.nom_parent,
            telephone_parent: eleve.telephone_parent,
            type_inscription: eleve.type_inscription,
            photo_url: eleve.photo_url,
          }}
        />
      </div>

      <div className="mt-4 rounded-sm border border-line bg-surface-2 px-4 py-3">
        <p className="text-[11.5px] leading-relaxed text-muted">
          Le numéro WhatsApp doit rester actif : c&apos;est lui qui reçoit les
          reçus et les rappels de paiement.
        </p>
      </div>
    </div>
  );
}
