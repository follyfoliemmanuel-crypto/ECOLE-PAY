import type { Metadata } from "next";
import {
  ArrowRight,
  School,
  UserPlus,
  Users,
} from "lucide-react";
import { exigerSession } from "@/lib/auth";
import { anneeScolaire, libelleAnnee } from "@/lib/mois";
import { estUuid } from "@/lib/actions/helpers";
import { compterClasses, compterElevesActifs, getEcole } from "@/lib/data/ecole";
import { getElevePaiement } from "@/lib/data/eleves";
import { FormulairePaiement } from "@/components/paiements/formulaire-paiement";
import { LienBouton } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { EntetePage } from "@/components/app/entete-page";

export const metadata: Metadata = { title: "Encaisser un paiement" };

export default async function PageNouveauPaiement({
  searchParams,
}: {
  searchParams: Promise<{ eleve?: string; frais?: string }>;
}) {
  const session = await exigerSession();
  const parametres = await searchParams;
  const annee = anneeScolaire();

  const eleveId =
    parametres.eleve && estUuid(parametres.eleve) ? parametres.eleve : null;
  const fraisInitial =
    parametres.frais && estUuid(parametres.frais) ? parametres.frais : undefined;

  const [ecole, nbEleves, nbClasses, eleveInitial] = await Promise.all([
    getEcole(session.ecoleId),
    compterElevesActifs(session.ecoleId, annee),
    compterClasses(session.ecoleId),
    eleveId
      ? getElevePaiement(session.ecoleId, eleveId, annee)
      : Promise.resolve(null),
  ]);

  if (!ecole) return null;

  const pret = nbEleves > 0 && nbClasses > 0;

  return (
    <div>
      <EntetePage
        surtitre={`${libelleAnnee(annee)} · Encaissement`}
        titre="Encaisser un paiement"
        description={
          pret
            ? "Cherchez l'élève, choisissez l'échéance, encaissez. Le reçu WhatsApp est préparé automatiquement."
            : "Encore une étape avant votre premier reçu."
        }
      />

      {pret ? (
        <FormulairePaiement
          eleveInitial={eleveInitial}
          fraisInitial={fraisInitial}
          annee={annee}
          utilisateurNom={session.nom}
          ecole={{
            nom: ecole.nom,
            adresse: ecole.adresse,
            telephone: ecole.telephone,
          }}
        />
      ) : (
        <div className="card">
          <EmptyState
            icone={nbClasses === 0 ? <School size={18} /> : <Users size={18} />}
            titre={
              nbClasses === 0
                ? "Créez d'abord une classe"
                : "Ajoutez votre premier élève"
            }
            description={
              nbClasses === 0
                ? "Chaque classe porte un tarif par période (mois, trimestre ou année). Les échéances de chaque élève en découlent automatiquement."
                : "Un élève, une classe, le numéro WhatsApp du parent : c'est tout ce qu'il faut pour encaisser et envoyer un reçu."
            }
            action={
              nbClasses === 0 ? (
                <LienBouton href="/app/classes">
                  Créer une classe
                  <ArrowRight size={15} aria-hidden />
                </LienBouton>
              ) : (
                <LienBouton href="/app/eleves/nouveau">
                  <UserPlus size={15} aria-hidden />
                  Ajouter un élève
                </LienBouton>
              )
            }
          />
        </div>
      )}
    </div>
  );
}
