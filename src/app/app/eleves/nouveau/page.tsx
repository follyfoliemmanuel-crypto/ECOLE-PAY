import type { Metadata } from "next";
import Link from "next/link";
import { ChevronRight, UserPlus } from "lucide-react";
import { exigerSession } from "@/lib/auth";
import { anneeScolaire } from "@/lib/mois";
import { listerClasses } from "@/lib/data/classes";
import { EntetePage } from "@/components/app/entete-page";
import { FormulaireEleve } from "@/components/eleves/formulaire-eleve";
import { EmptyState } from "@/components/ui/empty-state";
import { LienBouton } from "@/components/ui/button";

export const metadata: Metadata = { title: "Nouvel élève" };

export default async function PageNouvelEleve() {
  const session = await exigerSession();
  const annee = anneeScolaire();
  const classes = await listerClasses(session.ecoleId, annee);

  return (
    <div className="mx-auto max-w-3xl">
      <nav
        aria-label="Fil d'Ariane"
        className="mb-4 flex items-center gap-1.5 text-[11.5px] text-muted"
      >
        <Link href="/app/eleves" className="hover:text-ink">
          Élèves
        </Link>
        <ChevronRight size={12} aria-hidden />
        <span className="text-ink-2">Nouvel élève</span>
      </nav>

      <EntetePage
        surtitre={`Année ${annee}`}
        titre="Ajouter un élève"
        description="Le numéro WhatsApp du parent est indispensable pour envoyer les reçus et les rappels."
        actions={
          <LienBouton href="/app/eleves" variante="secondaire" taille="sm">
            Annuler
          </LienBouton>
        }
      />

      <div className="card p-5 sm:p-6">
        {classes.length === 0 ? (
          <EmptyState
            icone={<UserPlus size={18} />}
            titre="Créez d'abord une classe"
            description="Chaque élève doit être rattaché à une classe, qui porte le tarif mensuel. Créez une classe puis revenez ici."
            action={
              <LienBouton href="/app/classes">
                Créer une classe
              </LienBouton>
            }
          />
        ) : (
          <FormulaireEleve classes={classes} annee={annee} />
        )}
      </div>
    </div>
  );
}
