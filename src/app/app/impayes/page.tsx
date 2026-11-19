import type { Metadata } from "next";
import Link from "next/link";
import {
  AlertTriangle,
  Check,
  MessageCircle,
  Wallet,
} from "lucide-react";
import { exigerSession } from "@/lib/auth";
import { peut } from "@/lib/offres";
import { libelleAnnee } from "@/lib/mois";
import { anneeActive } from "@/lib/data/annees";
import {
  frequenceDepuisParametre,
  libelleEcheance,
  libelleNature,
  libellePeriode,
  periodeDepuisParametre,
} from "@/lib/periodes";
import { getEcole } from "@/lib/data/ecole";
import { getDashboard, type Impaye } from "@/lib/data/dashboard";
import { listerImpayes } from "@/lib/data/impayes";
import { frequenceParDefautEcole, nombreTranchesMax } from "@/lib/data/classes";
import {
  formatF,
  formatNombre,
  formatTelephone,
  initiales,
  pourcentage,
} from "@/lib/format";
import { lienWhatsApp, rendreMessage } from "@/lib/whatsapp";
import { BadgeStatut } from "@/components/ui/badge";
import { LienBouton } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { PeriodeSelect } from "@/components/ui/periode-select";
import { EntetePage } from "@/components/app/entete-page";
import { ExportImpayes } from "@/components/app/exports-pdf";
import { Pagination } from "@/components/ui/pagination";
import { chargerImpayesExport } from "@/lib/actions/impayes";

export const metadata: Metadata = { title: "Impayés" };

const PAR_PAGE = 20;

export default async function PageImpayes({
  searchParams,
}: {
  searchParams: Promise<{ frequence?: string; periode?: string; page?: string }>;
}) {
  const session = await exigerSession();
  const parametres = await searchParams;
  const peutRelancer = peut(session.ecole, "relances");
  const peutExporter = peut(session.ecole, "exports");
  const annee = await anneeActive(session.ecoleId);
  const defautFrequence = await frequenceParDefautEcole(session.ecoleId);
  const frequence = frequenceDepuisParametre(parametres.frequence, defautFrequence);
  const periode = periodeDepuisParametre(parametres.periode, frequence, 0);
  const page = Math.max(1, Number.parseInt(parametres.page ?? "1", 10) || 1);

  const [ecole, impayesPeriode, dashboard, nbTranches] = await Promise.all([
    getEcole(session.ecoleId),
    listerImpayes(session.ecoleId, annee, frequence, periode, {
      page,
      parPage: PAR_PAGE,
    }),
    getDashboard(session.ecoleId, annee, frequence, periode),
    nombreTranchesMax(session.ecoleId),
  ]);
  const nomPeriode = libellePeriode(frequence, periode, annee, false, nbTranches);

  if (!ecole) return null;

  const { resume } = dashboard;
  const tauxRecouvrement = pourcentage(resume.encaisse, resume.attendu);

  async function chargerImpayes() {
    "use server";
    return chargerImpayesExport(frequence, String(periode));
  }

  function messageRelance(eleve: Impaye): string {
    const periodeFrais = libelleEcheance(eleve, annee);
    return rendreMessage(ecole!.modele_relance, {
      ecole: ecole!.nom,
      eleve: `${eleve.prenom} ${eleve.nom}`,
      classe: eleve.classe_nom,
      parent: eleve.nom_parent,
      nature: libelleNature(eleve.type_frais),
      periode: periodeFrais,
      mois: periodeFrais,
      montant_du: eleve.montant_du,
      reste: eleve.reste,
      annee,
    });
  }

  return (
    <div>
      <EntetePage
        surtitre={`${nomPeriode} · ${libelleAnnee(annee)}`}
        titre={frequence === "TRANCHES" ? "Impayés par tranche" : "Impayés de la période"}
        description={
          frequence === "TRANCHES"
            ? "Les familles à relancer sur la tranche choisie, regroupées par classe. Chaque relance part sur WhatsApp avec le message prêt."
            : "Les familles à relancer, regroupées par classe. Chaque relance part sur WhatsApp avec le message prêt."
        }
        actions={
          <>
            <PeriodeSelect
              frequence={frequence}
              periode={periode}
              annee={annee}
              nbTranches={nbTranches}
            />
            {peutExporter && (
              <ExportImpayes
                ecole={{
                  nom: ecole.nom,
                  adresse: ecole.adresse,
                  telephone: ecole.telephone,
                }}
                periode={nomPeriode}
                annee={annee}
                resume={resume}
                chargerTous={chargerImpayes}
                libelle="Exporter (PDF)"
              />
            )}
          </>
        }
      />

      {!peutRelancer && (
        <div className="mb-5 flex flex-wrap items-center justify-between gap-2 rounded-sm border border-ochre/25 bg-[#fbf1de] px-4 py-3 text-[12px] text-[#7a5010]">
          <p className="flex items-center gap-2">
            <MessageCircle size={14} aria-hidden />
            La relance WhatsApp des parents impayés est incluse dans l&apos;offre
            STANDARD.
          </p>
          <Link
            href="/abonnement"
            className="font-semibold underline underline-offset-2 hover:no-underline"
          >
            Passer à STANDARD
          </Link>
        </div>
      )}

      {/* Résumé de la période */}
      <div className="mb-5 grid grid-cols-2 divide-x divide-line overflow-hidden rounded-lg border border-line bg-surface lg:grid-cols-4">
        <div className="px-4 py-3.5">
          <p className="text-[9.5px] font-semibold uppercase tracking-[0.11em] text-muted">
            À recouvrer
          </p>
          <p className="chiffre mt-1 text-[16px] font-medium text-impaye">
            {formatNombre(impayesPeriode.total)} F
          </p>
          <p className="mt-0.5 text-[10.5px] text-muted">
            {impayesPeriode.nbEleves} élève{impayesPeriode.nbEleves > 1 ? "s" : ""}
            {impayesPeriode.nbInscriptions > 0 &&
              ` · ${impayesPeriode.nbInscriptions} frais d'entrée`}
          </p>
        </div>
        <div className="px-4 py-3.5">
          <p className="text-[9.5px] font-semibold uppercase tracking-[0.11em] text-muted">
            Déjà encaissé
          </p>
          <p className="chiffre mt-1 text-[16px] font-medium text-paye">
            {formatNombre(resume.encaisse)} F
          </p>
          <p className="mt-0.5 text-[10.5px] text-muted">
            sur {formatNombre(resume.attendu)} F attendus (scolarité)
          </p>
        </div>
        <div className="px-4 py-3.5">
          <p className="text-[9.5px] font-semibold uppercase tracking-[0.11em] text-muted">
            Taux de recouvrement
          </p>
          <p className="chiffre mt-1 text-[16px] font-medium text-ink">
            {tauxRecouvrement} %
          </p>
          <div className="mt-1.5 h-1 w-full overflow-hidden rounded-full bg-line">
            <span
              className="block h-full rounded-full bg-brand"
              style={{ width: `${Math.min(100, tauxRecouvrement)}%` }}
            />
          </div>
        </div>
        <div className="px-4 py-3.5">
          <p className="text-[9.5px] font-semibold uppercase tracking-[0.11em] text-muted">
            À jour
          </p>
          <p className="chiffre mt-1 text-[16px] font-medium text-ink">
            {resume.payes} / {resume.eleves}
          </p>
          <p className="mt-0.5 text-[10.5px] text-muted">
            {resume.partiels} partiel{resume.partiels > 1 ? "s" : ""} ·{" "}
            {resume.impayes} non payé{resume.impayes > 1 ? "s" : ""}
          </p>
        </div>
      </div>

      {impayesPeriode.nbLignes === 0 ? (
        <div className="card">
          <EmptyState
            icone={<Check size={18} />}
            titre={
              resume.eleves === 0
                ? "Aucun élève inscrit"
                : `Tout le monde est à jour en ${nomPeriode.toLowerCase()}`
            }
            description={
              resume.eleves === 0
                ? "Ajoutez vos élèves et leurs frais pour voir apparaître ici les familles à relancer."
                : "Aucun impayé pour cette période. Les reçus et l'historique restent disponibles dans la page Paiements."
            }
            action={
              resume.eleves === 0 ? (
                <LienBouton href="/app/eleves/nouveau">Ajouter un élève</LienBouton>
              ) : (
                <LienBouton
                  href={`/app/paiements?frequence=${frequence}&periode=${periode}`}
                  variante="secondaire"
                >
                  Voir les paiements
                </LienBouton>
              )
            }
          />
        </div>
      ) : (
        <div className="space-y-5">
          {impayesPeriode.groupes.map((groupe) => {
            const totalClasse = impayesPeriode.totauxClasses[groupe.classe] ?? {
              total: groupe.total,
              nb: groupe.eleves.length,
            };
            return (
            <section key={groupe.classe} className="card overflow-hidden">
              <div className="flex flex-wrap items-center justify-between gap-2 border-b border-line bg-surface-2 px-4 py-3 sm:px-5">
                <div className="flex items-center gap-2.5">
                  <span className="grid size-7 place-items-center rounded-sm bg-brand text-[10px] font-semibold text-white">
                    {groupe.classe.slice(0, 2).toUpperCase()}
                  </span>
                  <div>
                    <h2 className="text-[14px] font-semibold text-ink">
                      {groupe.classe}
                    </h2>
                    <p className="text-[11px] text-muted">
                      {totalClasse.nb} échéance{totalClasse.nb > 1 ? "s" : ""} à
                      recouvrer
                    </p>
                  </div>
                </div>
                <div className="text-right">
                  <p className="text-[9.5px] font-semibold uppercase tracking-[0.1em] text-muted">
                    Reste de la classe
                  </p>
                  <p className="chiffre text-[14px] font-semibold text-impaye">
                    {formatF(totalClasse.total)}
                  </p>
                </div>
              </div>

              {/* Desktop */}
              <div className="hidden lg:block">
                <table className="tableau">
                  <thead>
                    <tr>
                      <th>Élève</th>
                      <th>Parent / tuteur</th>
                      <th>WhatsApp</th>
                      <th>Échéance</th>
                      <th className="text-right">Dû</th>
                      <th className="text-right">Payé</th>
                      <th className="text-right">Reste</th>
                      <th>Statut</th>
                      <th className="text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {groupe.eleves.map((eleve) => (
                      <tr key={eleve.frais_id}>
                        <td>
                          <Link
                            href={`/app/eleves/${eleve.eleve_id}`}
                            className="flex items-center gap-2.5 group"
                          >
                            <span className="grid size-8 shrink-0 place-items-center rounded-full border border-line bg-surface-2 text-[10px] font-semibold text-ink-2">
                              {initiales(eleve.nom, eleve.prenom)}
                            </span>
                            <span className="font-medium text-ink group-hover:text-brand group-hover:underline">
                              {eleve.prenom} {eleve.nom}
                            </span>
                          </Link>
                        </td>
                        <td className="text-[12.5px] text-ink-2">
                          {eleve.nom_parent}
                        </td>
                        <td className="text-[12px] text-muted">
                          {formatTelephone(eleve.telephone_parent)}
                        </td>
                        <td className="text-[12px] text-ink-2">
                          <span className="block font-medium">
                            {libelleEcheance(eleve, annee)}
                          </span>
                          <span className="block text-[10.5px] text-muted">
                            {libelleNature(eleve.type_frais)}
                          </span>
                        </td>
                        <td className="chiffre text-right text-[12px] text-ink-2">
                          {formatNombre(eleve.montant_du)} F
                        </td>
                        <td className="chiffre text-right text-[12px] text-ink-2">
                          {formatNombre(eleve.montant_paye)} F
                        </td>
                        <td className="chiffre text-right text-[12.5px] font-medium text-impaye">
                          {formatNombre(eleve.reste)} F
                        </td>
                        <td>
                          <BadgeStatut statut={eleve.statut} />
                        </td>
                        <td className="text-right">
                          <div className="inline-flex items-center gap-1.5">
                            {peutRelancer && (
                              <a
                                href={lienWhatsApp(
                                  eleve.telephone_parent,
                                  messageRelance(eleve),
                                )}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="inline-flex h-8 items-center gap-1.5 rounded-sm border border-paye/25 bg-paye-soft px-2.5 text-[11.5px] font-semibold text-paye hover:bg-paye/10"
                              >
                                <MessageCircle size={13} aria-hidden />
                                Relancer
                              </a>
                            )}
                            <Link
                              href={`/app/paiements/nouveau?eleve=${eleve.eleve_id}&frais=${eleve.frais_id}`}
                              className="inline-flex h-8 items-center gap-1.5 rounded-sm bg-brand px-2.5 text-[11.5px] font-semibold text-white hover:bg-brand-deep"
                            >
                              <Wallet size={13} aria-hidden />
                              Encaisser
                            </Link>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* Mobile */}
              <ul className="divide-y divide-line lg:hidden">
                {groupe.eleves.map((eleve) => (
                  <li key={eleve.frais_id} className="p-4">
                    <div className="flex items-start justify-between gap-3">
                      <Link
                        href={`/app/eleves/${eleve.eleve_id}`}
                        className="flex min-w-0 items-center gap-3"
                      >
                        <span className="grid size-9 shrink-0 place-items-center rounded-full border border-line bg-surface-2 text-[10px] font-semibold text-ink-2">
                          {initiales(eleve.nom, eleve.prenom)}
                        </span>
                        <span className="min-w-0">
                          <span className="block truncate text-[13.5px] font-semibold text-ink">
                            {eleve.prenom} {eleve.nom}
                          </span>
                          <span className="block truncate text-[11.5px] text-muted">
                            {eleve.nom_parent} ·{" "}
                            {formatTelephone(eleve.telephone_parent)}
                          </span>
                        </span>
                      </Link>
                      <BadgeStatut statut={eleve.statut} />
                    </div>

                    <p className="mt-2 text-[11.5px] font-medium text-ink-2">
                      {libelleEcheance(eleve, annee)}{" "}
                      <span className="font-normal text-muted">
                        · {libelleNature(eleve.type_frais)}
                      </span>
                    </p>

                    <div className="mt-2 flex items-end justify-between gap-3">
                      <div>
                        <p className="text-[10.5px] text-muted">
                          Dû {formatF(eleve.montant_du)} · payé{" "}
                          {formatF(eleve.montant_paye)}
                        </p>
                        <p className="chiffre mt-0.5 text-[13px] font-semibold text-impaye">
                          Reste {formatF(eleve.reste)}
                        </p>
                      </div>
                      <div className="flex shrink-0 items-center gap-1.5">
                        {peutRelancer && (
                          <a
                            href={lienWhatsApp(
                              eleve.telephone_parent,
                              messageRelance(eleve),
                            )}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex h-8 items-center gap-1.5 rounded-sm border border-paye/25 bg-paye-soft px-2.5 text-[11.5px] font-semibold text-paye"
                          >
                            <MessageCircle size={13} aria-hidden />
                            Relancer
                          </a>
                        )}
                        <Link
                          href={`/app/paiements/nouveau?eleve=${eleve.eleve_id}&frais=${eleve.frais_id}`}
                          className="grid size-8 place-items-center rounded-sm bg-brand text-white"
                          aria-label={`Encaisser pour ${eleve.prenom} ${eleve.nom}`}
                        >
                          <Wallet size={14} aria-hidden />
                        </Link>
                      </div>
                    </div>
                  </li>
                ))}
              </ul>
            </section>
            );
          })}
        </div>
      )}

      {impayesPeriode.nbLignes > PAR_PAGE && (
        <div className="mt-5 card overflow-hidden">
          <Pagination
            page={page}
            total={impayesPeriode.nbLignes}
            parPage={PAR_PAGE}
            basePath="/app/impayes"
            parametres={{ frequence, periode: String(periode) }}
            libelle="impayés"
          />
        </div>
      )}

      {impayesPeriode.groupes.length > 0 && (
        <div className="mt-5 flex items-start gap-2 rounded-sm border border-ochre/25 bg-[#fbf1de] px-4 py-3 text-[12px] leading-relaxed text-[#7a5010]">
          <AlertTriangle size={15} className="mt-0.5 shrink-0" aria-hidden />
          <p>
            Le message de relance reprend le modèle défini dans les paramètres
            de l&apos;école. WhatsApp s&apos;ouvre avec le texte prêt : il reste
            à vérifier le message puis à appuyer sur « Envoyer ».
          </p>
        </div>
      )}
    </div>
  );
}
