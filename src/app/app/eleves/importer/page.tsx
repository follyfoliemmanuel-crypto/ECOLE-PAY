import type { Metadata } from "next";
import Link from "next/link";
import { ChevronRight, FileSpreadsheet } from "lucide-react";
import { exigerSession } from "@/lib/auth";
import { anneeActive } from "@/lib/data/annees";
import { listerClasses } from "@/lib/data/classes";
import { EntetePage } from "@/components/app/entete-page";
import { ImportEleves } from "@/components/eleves/import-eleves";
import { EmptyState } from "@/components/ui/empty-state";
import { LienBouton } from "@/components/ui/button";

export const metadata: Metadata = { title: "Importer des élèves" };

export default async function PageImporterEleves() {
  const session = await exigerSession();
  const annee = await anneeActive(session.ecoleId);
  const classes = await listerClasses(session.ecoleId, annee);

  return (
    <div>
      <nav
        aria-label="Fil d'Ariane"
        className="mb-4 flex items-center gap-1.5 text-[11.5px] text-muted"
      >
        <Link href="/app/eleves" className="hover:text-ink">
          Élèves
        </Link>
        <ChevronRight size={12} aria-hidden />
        <span className="text-ink-2">Importer</span>
      </nav>

      <EntetePage
        surtitre={`Année ${annee}`}
        titre="Importer des élèves"
        description="Chargez une liste depuis Excel ou un fichier CSV pour créer les élèves et leurs 10 mois de frais en un clic."
      />

      {classes.length === 0 ? (
        <div className="card p-5 sm:p-6">
          <EmptyState
            icone={<FileSpreadsheet size={18} />}
            titre="Créez d'abord une classe"
            description="Avant d'importer des élèves, vous devez définir au moins une classe avec son tarif mensuel."
            action={
              <LienBouton href="/app/classes">Créer une classe</LienBouton>
            }
          />
        </div>
      ) : (
        <ImportEleves classes={classes} />
      )}
    </div>
  );
}
