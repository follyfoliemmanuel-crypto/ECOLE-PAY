import type { Metadata } from "next";
import Link from "next/link";
import {
  ArrowRight,
  School,
  Trash2,
  Users,
} from "lucide-react";
import { exigerSession, estDirecteur } from "@/lib/auth";
import { anneeActive } from "@/lib/data/annees";
import { libelleAnnee } from "@/lib/mois";
import {
  frequenceDepuisParametre,
  LIBELLES_FREQUENCE,
  libellePeriode,
  periodeDepuisParametre,
  suffixePeriode,
} from "@/lib/periodes";
import { listerClassesAvecStats, nombreTranchesMax } from "@/lib/data/classes";
import { limitesOffre, offreEffective } from "@/lib/offres";
import { formatF, formatNombre, pourcentage } from "@/lib/format";
import { supprimerClasse } from "@/lib/actions/classes";
import { BoutonConfirmation } from "@/components/ui/bouton-confirmation";
import { LienBouton } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { PeriodeSelect } from "@/components/ui/periode-select";
import { EntetePage } from "@/components/app/entete-page";
import { ModifierClasse, NouvelleClasse } from "@/components/classes/gestion-classes";

export const metadata: Metadata = { title: "Classes" };

export default async function PageClasses({
  searchParams,
}: {
  searchParams: Promise<{ frequence?: string; periode?: string }>;
}) {
  const session = await exigerSession();
  const parametres = await searchParams;
  const annee = await anneeActive(session.ecoleId);
  const frequence = frequenceDepuisParametre(parametres.frequence);
  const periode = periodeDepuisParametre(parametres.periode, frequence);
  const classes = await listerClassesAvecStats(
    session.ecoleId,
    annee,
    frequence,
    periode,
  );
  const nbTranches = await nombreTranchesMax(session.ecoleId);

  const directeur = estDirecteur(session);
  const limite = limitesOffre(offreEffective(session.ecole));
  const limiteClassesTexte =
    limite.classes === null ? "illimitées" : `${limite.classes} autorisées`;
  const totalEleves = classes.reduce((somme, c) => somme + c.nb_eleves, 0);
  const totalEncaisse = classes
    .filter((c) => c.frequence_paiement === frequence)
    .reduce((somme, c) => somme + c.encaisse, 0);
  const totalRestant = classes
    .filter((c) => c.frequence_paiement === frequence)
    .reduce((somme, c) => somme + c.restant, 0);
  const nomPeriode = libellePeriode(frequence, periode, annee, false, nbTranches);

  return (
    <div>
      <EntetePage
        surtitre={`${libelleAnnee(annee)} · ${nomPeriode}`}
        titre="Classes"
        description="Chaque classe définit son tarif mensuel, annuel ou sa liste de tranches libres, plus ses frais d'inscription. Les échéances des élèves en découlent automatiquement."
        actions={
          <>
            <PeriodeSelect
              frequence={frequence}
              periode={periode}
              annee={annee}
              nbTranches={nbTranches}
            />
            <LienBouton href="/app/eleves" variante="secondaire" taille="md">
              <Users size={15} aria-hidden />
              Voir les élèves
            </LienBouton>
          </>
        }
      />

      {/* Résumé */}
      <div className="mb-5 grid grid-cols-2 divide-x divide-line overflow-hidden rounded-lg border border-line bg-surface sm:grid-cols-4">
        {[
          { libelle: "Classes", valeur: `${classes.length}`, detail: limiteClassesTexte },
          { libelle: "Élèves actifs", valeur: `${totalEleves}`, detail: "toutes classes" },
          { libelle: `Encaissé · ${nomPeriode}`, valeur: `${formatNombre(totalEncaisse)} F`, detail: "classes de même fréquence" },
          {
            libelle: "Reste à encaisser",
            valeur: `${formatNombre(totalRestant)} F`,
            detail: totalRestant > 0 ? "à recouvrer" : "tout est réglé",
            accent: totalRestant > 0 ? "text-impaye" : "text-paye",
          },
        ].map((bloc) => (
          <div key={bloc.libelle} className="px-4 py-3.5">
            <p className="text-[9.5px] font-semibold uppercase tracking-[0.11em] text-muted">
              {bloc.libelle}
            </p>
            <p className={`chiffre mt-1 text-[15px] font-medium ${bloc.accent ?? "text-ink"}`}>
              {bloc.valeur}
            </p>
            <p className="mt-0.5 text-[10.5px] text-muted">{bloc.detail}</p>
          </div>
        ))}
      </div>

      {/* Création */}
      {directeur ? (
        <section className="card mb-5 p-4 sm:p-5">
          <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
            <div>
              <h2 className="text-[14px] font-semibold text-ink">Créer une classe</h2>
              <p className="mt-0.5 text-[11.5px] text-muted">
                Ex. « 6ème A » avec 25 000 F par mois ou 225 000 F par an
              </p>
            </div>
            <span className="text-[11px] text-muted">
              {classes.length} /{" "}
              {limite.classes === null ? "∞" : limite.classes} classes utilisées
            </span>
          </div>
          <NouvelleClasse classes={classes} />
        </section>
      ) : (
        <div className="mb-5 rounded-sm border border-line bg-surface-2 px-4 py-3 text-[12px] text-muted">
          Seul le directeur peut créer ou modifier une classe. Vous pouvez
          consulter les tarifs et encaisser les paiements.
        </div>
      )}

      {classes.length === 0 ? (
        <div className="card">
          <EmptyState
            icone={<School size={18} />}
            titre="Votre école n'a pas encore de classe"
            description="Commencez par une classe, son tarif et sa fréquence de paiement. Vous pourrez ensuite y ajouter les élèves et encaisser les frais."
          />
        </div>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {classes.map((classe) => {
            const total = Math.max(1, classe.nb_eleves);
            const taux = pourcentage(classe.payes, classe.nb_eleves);
            const memeFrequence = classe.frequence_paiement === frequence;
            const tranches = classe.tranches ?? [];
            const totalTranches = tranches.reduce(
              (somme, tranche) => somme + tranche.montant,
              0,
            );
            const nomPeriodeClasse =
              classe.frequence_paiement === "TRANCHES"
                ? (tranches.find((tranche) => tranche.ordre === periode)?.nom ??
                  nomPeriode)
                : nomPeriode;
            return (
              <section key={classe.id} className="card flex flex-col overflow-hidden">
                <div className="border-b border-line px-4 py-3.5">
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <h2 className="truncate text-[15px] font-semibold text-ink">
                        {classe.nom}
                      </h2>
                      <p className="mt-0.5 text-[11.5px] text-muted">
                        {classe.frequence_paiement === "TRANCHES"
                          ? `${tranches.length} tranche${tranches.length > 1 ? "s" : ""} · ${formatF(totalTranches)} / élève`
                          : `${formatF(classe.montant_periode)}${suffixePeriode(classe.frequence_paiement)} / élève`}
                      </p>
                    </div>
                    <span className="chiffre shrink-0 rounded-sm border border-line bg-surface-2 px-2 py-1 text-[10.5px] text-ink-2">
                      {classe.nb_eleves} élève{classe.nb_eleves > 1 ? "s" : ""}
                    </span>
                  </div>
                  <div className="mt-2 flex flex-wrap items-center gap-1.5">
                    <span className="rounded-full border border-brand/20 bg-brand-soft px-2 py-0.5 text-[9.5px] font-semibold uppercase tracking-[0.08em] text-brand">
                      {LIBELLES_FREQUENCE[classe.frequence_paiement]}
                    </span>
                    <span className="text-[10.5px] text-muted">
                      Inscription {classe.frais_inscription > 0 ? formatF(classe.frais_inscription) : "gratuite"}
                    </span>
                    <span className="text-[10.5px] text-muted" aria-hidden>
                      ·
                    </span>
                    <span className="text-[10.5px] text-muted">
                      Réinscription {classe.frais_reinscription > 0 ? formatF(classe.frais_reinscription) : "gratuite"}
                    </span>
                  </div>
                </div>

                <div className="flex-1 px-4 py-3.5">
                  {classe.frequence_paiement === "TRANCHES" &&
                    tranches.length > 0 && (
                      <ul className="mb-3 space-y-1 rounded-sm border border-line bg-surface-2/60 px-2.5 py-2 text-[10.5px]">
                        {tranches.map((tranche) => (
                          <li
                            key={tranche.id}
                            className="flex items-baseline justify-between gap-2"
                          >
                            <span className="truncate text-muted">
                              {tranche.nom}
                              {tranche.date_limite ? ` · ${tranche.date_limite}` : ""}
                            </span>
                            <span className="chiffre shrink-0 font-medium text-ink-2">
                              {formatF(tranche.montant)}
                            </span>
                          </li>
                        ))}
                      </ul>
                    )}

                  {memeFrequence ? (
                    <>
                      <div className="flex items-center justify-between text-[11px] text-muted">
                        <span>{nomPeriodeClasse}</span>
                        <span className="font-semibold text-ink">{taux} % à jour</span>
                      </div>
                      <div className="mt-1.5 flex h-1.5 w-full overflow-hidden rounded-full bg-line">
                        <span
                          className="h-full bg-paye"
                          style={{ width: `${(classe.payes / total) * 100}%` }}
                        />
                        <span
                          className="h-full bg-partiel"
                          style={{ width: `${(classe.partiels / total) * 100}%` }}
                        />
                        <span
                          className="h-full bg-impaye"
                          style={{ width: `${(classe.impayes / total) * 100}%` }}
                        />
                      </div>

                      <div className="mt-3 grid grid-cols-3 gap-2 text-center">
                        <div className="rounded-sm bg-paye-soft py-1.5">
                          <p className="chiffre text-[12px] font-semibold text-paye">
                            {classe.payes}
                          </p>
                          <p className="text-[9px] uppercase tracking-wide text-paye/80">payés</p>
                        </div>
                        <div className="rounded-sm bg-partiel-soft py-1.5">
                          <p className="chiffre text-[12px] font-semibold text-partiel">
                            {classe.partiels}
                          </p>
                          <p className="text-[9px] uppercase tracking-wide text-partiel/80">partiels</p>
                        </div>
                        <div className="rounded-sm bg-impaye-soft py-1.5">
                          <p className="chiffre text-[12px] font-semibold text-impaye">
                            {classe.impayes}
                          </p>
                          <p className="text-[9px] uppercase tracking-wide text-impaye/80">impayés</p>
                        </div>
                      </div>

                      <div className="mt-3 border-t border-line pt-3">
                        <div className="flex items-baseline justify-between">
                          <span className="text-[11px] text-muted">Encaissé</span>
                          <span className="chiffre text-[12.5px] font-medium text-ink">
                            {formatNombre(classe.encaisse)} F
                          </span>
                        </div>
                        <div className="mt-1 flex items-baseline justify-between">
                          <span className="text-[11px] text-muted">Attendu</span>
                          <span className="chiffre text-[11.5px] text-muted">
                            {formatNombre(classe.attendu)} F
                          </span>
                        </div>
                      </div>
                    </>
                  ) : (
                    <div className="rounded-sm border border-dashed border-line-strong bg-surface-2 px-3 py-3 text-[11.5px] leading-relaxed text-muted">
                      Cette classe est en{" "}
                      <strong className="text-ink-2">
                        {LIBELLES_FREQUENCE[classe.frequence_paiement].toLowerCase()}
                      </strong>
                      . Ses statistiques s&apos;affichent en sélectionnant cette
                      fréquence, pas « {nomPeriode} ».
                    </div>
                  )}

                  <Link
                    href={`/app/eleves?classe=${classe.id}&frequence=${frequence}&periode=${periode}`}
                    className="mt-3 inline-flex items-center gap-1.5 text-[11.5px] font-semibold text-brand hover:underline"
                  >
                    Voir les élèves
                    <ArrowRight size={12} aria-hidden />
                  </Link>
                </div>

                {directeur && (
                  <div className="flex items-center justify-between gap-2 border-t border-line bg-surface-2 px-3 py-2">
                    <ModifierClasse classe={classe} classes={classes} />
                    <BoutonConfirmation
                      action={supprimerClasse}
                      champs={{ id: classe.id }}
                      titre={`Supprimer ${classe.nom} ?`}
                      description="La classe sera retirée. La suppression est refusée si des élèves y sont encore inscrits."
                      libelle="Supprimer"
                      libelleConfirmer="Supprimer la classe"
                      variante="fantome"
                      icone={<Trash2 size={12} aria-hidden />}
                    />
                  </div>
                )}
              </section>
            );
          })}
        </div>
      )}
    </div>
  );
}
