import type { Metadata } from "next";
import Link from "next/link";
import {
  Ban,
  MessageCircle,
  Plus,
  ReceiptText,
  Wallet,
} from "lucide-react";
import { exigerSession, estDirecteur } from "@/lib/auth";
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
import { listerPaiements } from "@/lib/data/paiements";
import { frequenceParDefautEcole, nombreTranchesMax } from "@/lib/data/classes";
import { formatDateHeure, formatF, formatNombre } from "@/lib/format";
import { lienWhatsApp, rendreMessage } from "@/lib/whatsapp";
import { LIBELLES_MODE, type ModePaiement } from "@/lib/types";
import { Badge } from "@/components/ui/badge";
import { LienBouton } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { PeriodeSelect } from "@/components/ui/periode-select";
import { BoutonAnnulationPaiement } from "@/components/paiements/bouton-annulation";
import { FiltresPaiements } from "@/components/paiements/filtres-paiements";
import { Pagination } from "@/components/ui/pagination";
import { ExportPaiementsCSV } from "@/components/paiements/export-paiements-csv";
import { EntetePage } from "@/components/app/entete-page";

export const metadata: Metadata = { title: "Paiements" };

const MODES: ModePaiement[] = ["ESPECES", "FLOOZ", "TMONEY"];
const PAR_PAGE = 20;

function modeDepuisParametre(valeur?: string): ModePaiement | "tous" {
  return MODES.includes(valeur as ModePaiement)
    ? (valeur as ModePaiement)
    : "tous";
}

export default async function PagePaiements({
  searchParams,
}: {
  searchParams: Promise<{
    frequence?: string;
    periode?: string;
    mode?: string;
    page?: string;
  }>;
}) {
  const session = await exigerSession();
  const parametres = await searchParams;
  const annee = await anneeActive(session.ecoleId);
  const defautFrequence = await frequenceParDefautEcole(session.ecoleId);
  const frequence = frequenceDepuisParametre(parametres.frequence, defautFrequence);
  const periode = periodeDepuisParametre(parametres.periode, frequence, 0);
  const mode = modeDepuisParametre(parametres.mode);
  const page = Math.max(1, Number.parseInt(parametres.page ?? "1", 10) || 1);

  const [ecole, resultat, nbTranches] = await Promise.all([
    getEcole(session.ecoleId),
    listerPaiements({
      ecoleId: session.ecoleId,
      annee,
      frequence,
      periode,
      mode,
      page,
      parPage: PAR_PAGE,
    }),
    nombreTranchesMax(session.ecoleId),
  ]);

  if (!ecole) return null;

  const directeur = estDirecteur(session);
  const peutExporter = peut(session.ecole, "exports");
  const nomPeriode = libellePeriode(frequence, periode, annee, false, nbTranches);
  const filtreActif = mode !== "tous";

  const parMode = MODES.map((valeur) => ({
    valeur,
    montant: resultat.parMode[valeur],
  }));

  function messageRecu(paiement: (typeof resultat.paiements)[number]): string {
    const periodeFrais = libelleEcheance(paiement, annee);
    return rendreMessage(ecole!.modele_recu, {
      ecole: ecole!.nom,
      eleve: `${paiement.eleve_prenom} ${paiement.eleve_nom}`,
      classe: paiement.classe_nom,
      parent: paiement.nom_parent,
      nature: libelleNature(paiement.type_frais),
      periode:
        paiement.type_frais === "SCOLARITE"
          ? periodeFrais
          : libelleAnnee(annee),
      mois:
        paiement.type_frais === "SCOLARITE"
          ? periodeFrais
          : libelleAnnee(annee),
      montant: paiement.montant,
      reste: paiement.reste_apres,
      montant_du: paiement.montant_du,
      annee,
      recu: paiement.numero_recu,
      mode: LIBELLES_MODE[paiement.mode_paiement],
      date: formatDateHeure(paiement.date_paiement),
    });
  }

  return (
    <div>
      <EntetePage
        surtitre={`${libelleAnnee(annee)} · ${nomPeriode}`}
        titre={frequence === "TRANCHES" ? "Paiements par tranche" : "Paiements"}
        description={
          frequence === "TRANCHES"
            ? "Tous les encaissements de la tranche choisie : reçus, modes, auteurs et annulations. L'historique est conservé."
            : "Tous les encaissements de la période : reçus, modes, auteurs et annulations. L'historique est conservé."
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
              <ExportPaiementsCSV
                paiements={resultat.paiements.map((p) => ({
                  date: formatDateHeure(p.date_paiement),
                  numero_recu: p.numero_recu,
                  eleve: `${p.eleve_prenom} ${p.eleve_nom}`,
                  classe: p.classe_nom,
                  nature: libelleNature(p.type_frais),
                  echeance: libelleEcheance(p, annee),
                  mode: LIBELLES_MODE[p.mode_paiement],
                  montant: p.montant,
                  reste_apres: p.reste_apres,
                  enregistre_par: p.enregistre_par_nom ?? "—",
                  statut: p.annule ? "ANNULÉ" : "VALIDE",
                }))}
                periode={nomPeriode}
              />
            )}
            <LienBouton href="/app/paiements/nouveau" taille="md">
              <Plus size={15} strokeWidth={2.4} aria-hidden />
              Encaisser
            </LienBouton>
          </>
        }
      />

      {/* Résumé */}
      <div className="mb-5 grid grid-cols-2 divide-x divide-line overflow-hidden rounded-lg border border-line bg-surface lg:grid-cols-4">
        <div className="px-4 py-3.5">
          <p className="text-[9.5px] font-semibold uppercase tracking-[0.11em] text-muted">
            Encaissé · {nomPeriode}
          </p>
          <p className="chiffre mt-1 text-[16px] font-medium text-paye">
            {formatNombre(resultat.montant)} F
          </p>
          <p className="mt-0.5 text-[10.5px] text-muted">
            paiements valides
          </p>
        </div>
        <div className="px-4 py-3.5">
          <p className="text-[9.5px] font-semibold uppercase tracking-[0.11em] text-muted">
            Dont inscriptions
          </p>
          <p className="chiffre mt-1 text-[16px] font-medium text-ink">
            {formatNombre(resultat.montantInscriptions)} F
          </p>
          <p className="mt-0.5 text-[10.5px] text-muted">
            frais d&apos;entrée, hors scolarité
          </p>
        </div>
        <div className="px-4 py-3.5">
          <p className="text-[9.5px] font-semibold uppercase tracking-[0.11em] text-muted">
            Opérations
          </p>
          <p className="chiffre mt-1 text-[16px] font-medium text-ink">
            {resultat.total}
          </p>
          <p className="mt-0.5 text-[10.5px] text-muted">
            dont {resultat.annules} annulée{resultat.annules > 1 ? "s" : ""}
          </p>
        </div>
        <div className="px-4 py-3.5">
          <p className="text-[9.5px] font-semibold uppercase tracking-[0.11em] text-muted">
            Espèces
          </p>
          <p className="chiffre mt-1 text-[16px] font-medium text-ink">
            {formatNombre(parMode[0].montant)} F
          </p>
          <p className="mt-0.5 text-[10.5px] text-muted">
            Flooz + TMoney : {formatNombre(parMode[1].montant + parMode[2].montant)} F
          </p>
        </div>
      </div>

      <div className="card mb-4 flex flex-wrap items-center justify-between gap-3 p-3 sm:p-4">
        <FiltresPaiements mode={mode} frequence={frequence} periode={periode} />
        {filtreActif && (
          <Link
            href={`/app/paiements?frequence=${frequence}&periode=${periode}`}
            className="text-[11.5px] font-semibold text-brand underline underline-offset-2"
          >
            Effacer le filtre
          </Link>
        )}
      </div>

      <div className="card overflow-hidden">
        {resultat.paiements.length === 0 ? (
          <EmptyState
            icone={<ReceiptText size={18} />}
            titre={
              filtreActif
                ? "Aucun paiement pour ce mode"
                : `Aucun paiement en ${nomPeriode.toLowerCase()}`
            }
            description={
              filtreActif
                ? "Essayez un autre mode de paiement ou affichez tous les encaissements de la période."
                : "Dès qu'un paiement est validé, il apparaît ici avec son numéro de reçu et le message WhatsApp prêt à envoyer."
            }
            action={
              filtreActif ? (
                <LienBouton
                  href={`/app/paiements?frequence=${frequence}&periode=${periode}`}
                  variante="secondaire"
                >
                  Voir tous les modes
                </LienBouton>
              ) : (
                <LienBouton href="/app/paiements/nouveau">
                  <Wallet size={15} aria-hidden />
                  Encaisser un paiement
                </LienBouton>
              )
            }
          />
        ) : (
          <>
            {/* Desktop */}
            <div className="hidden lg:block">
              <table className="tableau">
                <thead>
                  <tr>
                    <th>Date</th>
                    <th>Reçu</th>
                    <th>Élève</th>
                    <th>Échéance</th>
                    <th>Mode</th>
                    <th className="text-right">Montant</th>
                    <th className="text-right">Reste après</th>
                    <th>Enregistré par</th>
                    <th className="text-right">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {resultat.paiements.map((paiement) => (
                    <tr
                      key={paiement.id}
                      className={paiement.annule ? "opacity-55" : undefined}
                    >
                      <td className="whitespace-nowrap text-[12px] text-ink-2">
                        {formatDateHeure(paiement.date_paiement)}
                      </td>
                      <td>
                        <span className="chiffre text-[11.5px] text-ink-2">
                          {paiement.numero_recu}
                        </span>
                        {paiement.annule && (
                          <div className="mt-0.5 max-w-[190px] text-[10.5px] leading-snug text-muted">
                            <p>
                              Annulé
                              {paiement.annule_par_nom
                                ? ` par ${paiement.annule_par_nom}`
                                : ""}
                              {paiement.annule_le
                                ? ` le ${formatDateHeure(paiement.annule_le)}`
                                : ""}
                            </p>
                            {paiement.motif_annulation && (
                              <p
                                className="truncate italic"
                                title={paiement.motif_annulation}
                              >
                                « {paiement.motif_annulation} »
                              </p>
                            )}
                          </div>
                        )}
                      </td>
                      <td>
                        <Link
                          href={`/app/eleves/${paiement.eleve_id}`}
                          className="font-medium text-ink hover:text-brand hover:underline"
                        >
                          {paiement.eleve_prenom} {paiement.eleve_nom}
                        </Link>
                        <p className="mt-0.5 text-[11px] text-muted">
                          {paiement.classe_nom}
                        </p>
                      </td>
                      <td className="text-[12px] text-ink-2">
                        <span className="block">
                          {libelleEcheance(paiement, annee)}
                        </span>
                        <span className="block text-[10.5px] text-muted">
                          {libelleNature(paiement.type_frais)}
                        </span>
                      </td>
                      <td>
                        <Badge>{LIBELLES_MODE[paiement.mode_paiement]}</Badge>
                      </td>
                      <td className="text-right">
                        <span
                          className={`chiffre text-[12.5px] font-medium ${
                            paiement.annule
                              ? "text-muted line-through"
                              : "text-paye"
                          }`}
                        >
                          {formatNombre(paiement.montant)} F
                        </span>
                      </td>
                      <td className="chiffre text-right text-[12px] text-muted">
                        {paiement.annule
                          ? "—"
                          : `${formatNombre(paiement.reste_apres)} F`}
                      </td>
                      <td className="text-[12px] text-muted">
                        {paiement.enregistre_par_nom ?? "—"}
                      </td>
                      <td className="text-right">
                        <div className="inline-flex items-center gap-1.5">
                          {paiement.annule ? (
                            <Badge ton="neutre">
                              <Ban size={11} className="mr-1" aria-hidden />
                              Annulé
                            </Badge>
                          ) : (
                            <>
                              <a
                                href={lienWhatsApp(
                                  paiement.telephone_parent,
                                  messageRecu(paiement),
                                )}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="inline-flex items-center gap-1 rounded-sm px-1.5 py-1 text-[11px] font-medium text-paye hover:bg-paye-soft"
                                title="Renvoyer le reçu sur WhatsApp"
                              >
                                <MessageCircle size={12} aria-hidden />
                                Reçu
                              </a>
                              {directeur && (
                                <BoutonAnnulationPaiement
                                  paiementId={paiement.id}
                                  numeroRecu={paiement.numero_recu}
                                  montant={formatF(paiement.montant)}
                                />
                              )}
                            </>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Mobile */}
            <ul className="divide-y divide-line lg:hidden">
              {resultat.paiements.map((paiement) => (
                <li
                  key={paiement.id}
                  className={`p-4 ${paiement.annule ? "opacity-55" : ""}`}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <Link
                        href={`/app/eleves/${paiement.eleve_id}`}
                        className="block truncate text-[13.5px] font-semibold text-ink"
                      >
                        {paiement.eleve_prenom} {paiement.eleve_nom}
                      </Link>
                      <p className="mt-0.5 truncate text-[11.5px] text-muted">
                        {paiement.classe_nom} ·{" "}
                        {libelleEcheance(paiement, annee, true)}{" "}
                        · {LIBELLES_MODE[paiement.mode_paiement]}
                      </p>
                      <p className="mt-0.5 truncate text-[10.5px] text-muted">
                        {libelleNature(paiement.type_frais)}
                      </p>
                    </div>
                    <p
                      className={`chiffre shrink-0 text-[14px] font-semibold ${
                        paiement.annule
                          ? "text-muted line-through"
                          : "text-paye"
                      }`}
                    >
                      {formatNombre(paiement.montant)} F
                    </p>
                  </div>

                  <div className="mt-1.5 flex flex-wrap items-center gap-x-2 gap-y-0.5 text-[10.5px] text-muted">
                    <span className="chiffre">{paiement.numero_recu}</span>
                    <span aria-hidden>·</span>
                    <span>{formatDateHeure(paiement.date_paiement)}</span>
                    {paiement.enregistre_par_nom && (
                      <>
                        <span aria-hidden>·</span>
                        <span>par {paiement.enregistre_par_nom}</span>
                      </>
                    )}
                  </div>

                  <div className="mt-2.5 flex items-center justify-between gap-2">
                    <span className="text-[11px] text-muted">
                      {paiement.annule ? (
                        <>
                          Paiement annulé
                          {paiement.annule_par_nom
                            ? ` par ${paiement.annule_par_nom}`
                            : ""}
                          {paiement.annule_le
                            ? ` le ${formatDateHeure(paiement.annule_le)}`
                            : ""}
                          {paiement.motif_annulation
                            ? ` · « ${paiement.motif_annulation} »`
                            : ""}
                        </>
                      ) : (
                        `Reste après : ${formatF(paiement.reste_apres)}`
                      )}
                    </span>
                    <div className="flex items-center gap-1.5">
                      {paiement.annule ? (
                        <Badge ton="neutre">Annulé</Badge>
                      ) : (
                        <>
                          <a
                            href={lienWhatsApp(
                              paiement.telephone_parent,
                              messageRecu(paiement),
                            )}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex h-8 items-center gap-1.5 rounded-sm border border-paye/25 bg-paye-soft px-2.5 text-[11.5px] font-semibold text-paye"
                          >
                            <MessageCircle size={13} aria-hidden />
                            Reçu
                          </a>
                          {directeur && (
                            <BoutonAnnulationPaiement
                              paiementId={paiement.id}
                              numeroRecu={paiement.numero_recu}
                              montant={formatF(paiement.montant)}
                            />
                          )}
                        </>
                      )}
                    </div>
                  </div>
                </li>
              ))}
            </ul>

            <Pagination
              page={page}
              total={resultat.total}
              parPage={PAR_PAGE}
              basePath="/app/paiements"
              parametres={{
                frequence,
                periode: String(periode),
                mode: mode === "tous" ? undefined : mode,
              }}
              libelle="paiements"
            />
          </>
        )}
      </div>

      <p className="mt-4 flex items-center gap-1.5 text-[11.5px] text-muted">
        <ReceiptText size={13} aria-hidden />
        Les reçus sont numérotés dans l&apos;ordre de validation. Un paiement
        annulé reste visible mais n&apos;entre plus dans les totaux.
        {directeur && " Seul le directeur peut annuler un paiement."}
      </p>
    </div>
  );
}
