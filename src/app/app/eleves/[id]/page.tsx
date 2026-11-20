import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import {
  ChevronRight,
  Download,
  FileText,
  LockKeyhole,
  MessageCircle,
  Pencil,
  Phone,
  ReceiptText,
  Wallet,
} from "lucide-react";
import { exigerSession, estDirecteur } from "@/lib/auth";
import { peut } from "@/lib/offres";
import { libelleAnnee } from "@/lib/mois";
import {
  libelleEcheance,
  libelleNature,
  periodeCourante,
  suffixePeriode,
} from "@/lib/periodes";
import { getEleve, listerFraisEleve, listerPaiementsEleve } from "@/lib/data/eleves";
import { anneeActive, compterAbsencesEleve, listerAbsences } from "@/lib/data/annees";
import { trimestresNotesEleve } from "@/lib/data/notes";
import { getEcole } from "@/lib/data/ecole";
import {
  formatDate,
  formatDateHeure,
  formatF,
  formatFCFA,
  formatNombre,
  formatTelephone,
  initiales,
  pourcentage,
} from "@/lib/format";
import { lienWhatsApp, rendreMessage } from "@/lib/whatsapp";
import {
  LIBELLES_MODE,
  LIBELLES_STATUT_ELEVE,
  type Paiement,
} from "@/lib/types";
import { Badge, BadgeStatut } from "@/components/ui/badge";
import { LienBouton } from "@/components/ui/button";
import { BoutonAnnulationPaiement } from "@/components/paiements/bouton-annulation";
import { BoutonMasquagePortail } from "@/components/portail/bouton-masquage";
import { BoutonPremium } from "@/components/offres/verrou-premium";
import {
  FormulaireAbsence,
  BoutonSupprimerAbsence,
} from "@/components/annees/formulaire-absence";
import { FormulaireTransfert } from "@/components/annees/formulaire-transfert";
import { estUuid } from "@/lib/actions/helpers";

export const metadata: Metadata = { title: "Fiche élève" };

export default async function PageFicheEleve({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const session = await exigerSession();
  const { id } = await params;
  if (!estUuid(id)) notFound();

  const active = await anneeActive(session.ecoleId);
  const [eleve, ecole] = await Promise.all([
    getEleve(session.ecoleId, id),
    getEcole(session.ecoleId),
    // note : getEleve renvoie null si l'élève appartient à une autre école
  ]);
  if (!eleve || !ecole) notFound();

  // Un élève sorti garde l'année de son dernier parcours : sa fiche montre
  // ses échéances et ses bulletins d'archive, pas la nouvelle année vide.
  const annee = eleve.annee_scolaire || active;

  const [frais, paiements, absences, compteurAbsences, trimestresNotes] =
    await Promise.all([
      listerFraisEleve(session.ecoleId, eleve.id, annee),
      listerPaiementsEleve(session.ecoleId, eleve.id),
      listerAbsences(session.ecoleId, eleve.annee_scolaire, {
        eleveId: eleve.id,
        limite: 40,
      }),
      compterAbsencesEleve(session.ecoleId, eleve.annee_scolaire, eleve.id),
      trimestresNotesEleve(session.ecoleId, eleve.annee_scolaire, eleve.id),
    ]);

  const actif = eleve.statut === "actif";
  const peutGerer = session.role === "directeur" || session.role === "secretaire";

  const directeur = estDirecteur(session);
  const peutPortail = peut(session.ecole, "portail_parent");
  const peutHistorique = peut(session.ecole, "historique");
  const paiementsAffiches = peutHistorique ? paiements : paiements.slice(0, 5);
  const scolarite = frais.filter((ligne) => ligne.type_frais === "SCOLARITE");
  const fraisEntree = frais.filter((ligne) => ligne.type_frais !== "SCOLARITE");
  const periodeActuelle =
    eleve.frequence_paiement === "TRANCHES"
      ? (scolarite.find((ligne) => ligne.statut !== "PAYE")?.periode ??
        scolarite[0]?.periode ??
        1)
      : periodeCourante(eleve.frequence_paiement);

  const totalDu = scolarite.reduce((somme, ligne) => somme + ligne.montant_du, 0);
  const totalPaye = scolarite.reduce((somme, ligne) => somme + ligne.montant_paye, 0);
  const totalReste = scolarite.reduce((somme, ligne) => somme + ligne.reste, 0);
  const periodesReglees = scolarite.filter((ligne) => ligne.statut === "PAYE").length;

  // Dernier paiement valide par échéance (pour renvoyer le bon reçu).
  const dernierParFrais = new Map<string, Paiement>();
  for (const paiement of paiements) {
    if (!paiement.annule && !dernierParFrais.has(paiement.frais_id)) {
      dernierParFrais.set(paiement.frais_id, paiement);
    }
  }

  function messageRecu(paiement: Paiement): string {
    const echeance = libelleEcheance(paiement, annee);
    return rendreMessage(ecole!.modele_recu, {
      ecole: ecole!.nom,
      eleve: `${eleve!.prenom} ${eleve!.nom}`,
      classe: eleve!.classe_nom,
      parent: eleve!.nom_parent,
      nature: libelleNature(paiement.type_frais),
      periode:
        paiement.type_frais === "SCOLARITE" ? echeance : libelleAnnee(annee),
      mois:
        paiement.type_frais === "SCOLARITE" ? echeance : libelleAnnee(annee),
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
      <nav
        aria-label="Fil d'Ariane"
        className="mb-4 flex items-center gap-1.5 text-[11.5px] text-muted"
      >
        <Link href="/app/eleves" className="hover:text-ink">
          Élèves
        </Link>
        <ChevronRight size={12} aria-hidden />
        <span className="text-ink-2">
          {eleve.prenom} {eleve.nom}
        </span>
      </nav>

      {/* ---------------- Identité ---------------- */}
      <section className="card mb-5 overflow-hidden">
        <div className="flex flex-col gap-5 p-5 sm:flex-row sm:items-start sm:justify-between sm:p-6">
          <div className="flex min-w-0 items-start gap-4">
            {eleve.photo_url ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={eleve.photo_url}
                alt={`Photo de ${eleve.prenom} ${eleve.nom}`}
                className="size-12 shrink-0 rounded-md border border-line object-cover"
              />
            ) : (
              <span className="grid size-12 shrink-0 place-items-center rounded-md bg-brand text-[15px] font-semibold text-white">
                {initiales(eleve.nom, eleve.prenom)}
              </span>
            )}
            <div className="min-w-0">
              <h1 className="text-[22px] font-semibold leading-tight tracking-[-0.03em] text-ink">
                {eleve.prenom} {eleve.nom}
              </h1>
              <div className="mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-1.5 text-[12px] text-muted">
                <span className="font-medium text-ink-2">{eleve.classe_nom}</span>
                <span aria-hidden>·</span>
                <span>{eleve.sexe === "F" ? "Fille" : "Garçon"}</span>
                <span aria-hidden>·</span>
                <span>Inscrit le {formatDate(eleve.date_inscription)}</span>
              </div>
              <div className="mt-2.5 flex flex-wrap items-center gap-2">
                <Badge ton="neutre">
                  {eleve.type_inscription === "ANCIEN" ? "Ancien élève" : "Nouvel élève"}
                </Badge>
                <a
                  href={`https://wa.me/228${eleve.telephone_parent}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1.5 text-[12px] text-ink-2 hover:text-paye"
                >
                  <Phone size={13} aria-hidden />
                  {formatTelephone(eleve.telephone_parent)}
                </a>
                <span className="text-muted" aria-hidden>
                  ·
                </span>
                <span className="text-[12px] text-muted">{eleve.nom_parent}</span>
              </div>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {actif ? (
              <>
                <LienBouton href={`/app/paiements/nouveau?eleve=${eleve.id}`} taille="sm">
                  <Wallet size={14} aria-hidden />
                  Encaisser
                </LienBouton>
                <LienBouton
                  href={`/app/eleves/${eleve.id}/modifier`}
                  variante="secondaire"
                  taille="sm"
                >
                  <Pencil size={13} aria-hidden />
                  Modifier
                </LienBouton>
                {peutGerer && (
                  <FormulaireTransfert
                    eleveId={eleve.id}
                    nomComplet={`${eleve.prenom} ${eleve.nom}`}
                  />
                )}
              </>
            ) : (
              <span className="inline-flex items-center gap-1.5 rounded-full border border-line-strong bg-surface-2 px-2.5 py-1 text-[11px] font-semibold text-muted">
                {LIBELLES_STATUT_ELEVE[eleve.statut]}
                {eleve.date_sortie ? ` le ${formatDate(eleve.date_sortie)}` : ""}
              </span>
            )}

            <a
              href={`/api/eleves/${eleve.id}/certificat?type=scolarite&annee=${encodeURIComponent(
                eleve.annee_scolaire,
              )}`}
              className="inline-flex h-8 items-center gap-1.5 rounded-sm border border-line-strong bg-surface px-2.5 text-[11.5px] font-semibold text-ink transition-colors hover:bg-surface-2"
            >
              <FileText size={13} aria-hidden />
              Certificat
            </a>
            {eleve.statut === "transfere" && (
              <a
                href={`/api/eleves/${eleve.id}/certificat?type=transfert&annee=${encodeURIComponent(
                  eleve.annee_scolaire,
                )}`}
                className="inline-flex h-8 items-center gap-1.5 rounded-sm border border-line-strong bg-surface px-2.5 text-[11.5px] font-semibold text-ink transition-colors hover:bg-surface-2"
              >
                <FileText size={13} aria-hidden />
                Certificat de transfert
              </a>
            )}

            {trimestresNotes.length > 0 && (
              <div className="flex items-center gap-1">
                {trimestresNotes.map((trimestre) => (
                  <a
                    key={trimestre}
                    href={`/api/eleves/${eleve.id}/bulletin?annee=${encodeURIComponent(
                      eleve.annee_scolaire,
                    )}&trimestre=${trimestre}`}
                    className="inline-flex h-8 items-center gap-1 rounded-sm border border-line-strong bg-surface px-2 text-[11px] font-semibold text-ink-2 transition-colors hover:bg-surface-2 hover:text-brand"
                    title={`Bulletin du ${trimestre}e trimestre`}
                  >
                    <Download size={11} aria-hidden />
                    T{trimestre}
                  </a>
                ))}
              </div>
            )}
          </div>
        </div>

        {peutPortail ? (
          <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2 border-t border-line bg-surface-2 px-5 py-3 sm:px-6">
            <div className="flex items-center gap-2">
              <span
                className={
                  eleve.masque_portail
                    ? "inline-flex items-center gap-1.5 rounded-full border border-line-strong bg-surface px-2.5 py-0.5 text-[10.5px] font-semibold text-muted"
                    : "inline-flex items-center gap-1.5 rounded-full border border-paye/25 bg-paye-soft px-2.5 py-0.5 text-[10.5px] font-semibold text-paye"
                }
              >
                <span
                  className={
                    eleve.masque_portail
                      ? "size-1.5 rounded-full bg-muted"
                      : "size-1.5 rounded-full bg-paye"
                  }
                  aria-hidden
                />
                {eleve.masque_portail
                  ? "Masqué du portail parent"
                  : "Visible sur le portail parent"}
              </span>
              <p className="hidden text-[11px] text-muted sm:block">
                Les parents voient ses notes via le lien public de l&apos;école.
              </p>
            </div>
            {directeur ? (
              <BoutonMasquagePortail
                eleveId={eleve.id}
                visible={!eleve.masque_portail}
                nom={`${eleve.prenom} ${eleve.nom}`}
              />
            ) : (
              <p className="text-[10.5px] text-muted">
                Seul le directeur peut modifier cette visibilité.
              </p>
            )}
          </div>
        ) : (
          <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2 border-t border-line bg-surface-2 px-5 py-3 sm:px-6">
            <div className="flex items-center gap-2">
              <span className="inline-flex items-center gap-1.5 rounded-full border border-line-strong bg-surface px-2.5 py-0.5 text-[10.5px] font-semibold text-muted">
                <LockKeyhole size={11} aria-hidden />
                Portail parent · PREMIUM
              </span>
              <p className="text-[11px] text-muted">
                Le masquage d&apos;un élève se règle depuis le portail parent
                PREMIUM.
              </p>
            </div>
            <BoutonPremium taille="sm" contexte="le masquage d'un élève du portail">
              MASQUER DU PORTAIL
            </BoutonPremium>
          </div>
        )}

        {/* Résumé scolarité */}
        <div className="grid grid-cols-2 divide-x divide-line border-t border-line bg-surface-2 sm:grid-cols-4">
          {[
            { libelle: "Scolarité due", valeur: formatFCFA(totalDu) },
            { libelle: "Scolarité payée", valeur: formatFCFA(totalPaye) },
            {
              libelle: "Reste scolarité",
              valeur: formatFCFA(totalReste),
              accent: totalReste > 0 ? "text-impaye" : "text-paye",
            },
            {
              libelle: "Échéances réglées",
              valeur: `${periodesReglees} / ${scolarite.length}`,
              accent: "text-brand",
            },
          ].map((bloc) => (
            <div key={bloc.libelle} className="px-4 py-3.5">
              <p className="text-[9.5px] font-semibold uppercase tracking-[0.1em] text-muted">
                {bloc.libelle}
              </p>
              <p
                className={`chiffre mt-1 text-[14px] font-medium ${
                  bloc.accent ?? "text-ink"
                }`}
              >
                {bloc.valeur}
              </p>
            </div>
          ))}
        </div>
      </section>

      <div className="grid gap-5 lg:grid-cols-3">
        {/* ---------------- Scolarité ---------------- */}
        <section className="card overflow-hidden lg:col-span-2">
          <div className="flex flex-wrap items-center justify-between gap-2 border-b border-line px-4 py-3.5 sm:px-5">
            <div>
              <h2 className="text-[14px] font-semibold text-ink">
                Scolarité de l&apos;année {annee}
              </h2>
              <p className="mt-0.5 text-[11.5px] text-muted">
                {libelleAnnee(annee)} · {scolarite.length} échéance
                {scolarite.length > 1 ? "s" : ""} ·{" "}
                {eleve.frequence_paiement === "TRANCHES"
                  ? `${formatFCFA(totalDu)} en tranches`
                  : `${formatFCFA(eleve.montant_periode)}${suffixePeriode(
                      eleve.frequence_paiement,
                    )}`}
              </p>
            </div>
            <span className="text-[11.5px] text-muted">
              {pourcentage(totalPaye, totalDu)} % de la scolarité encaissée
            </span>
          </div>

          <div className="overflow-x-auto">
            <table className="tableau min-w-[540px]">
              <thead>
                <tr>
                  <th>Période</th>
                  <th className="text-right">Dû</th>
                  <th className="text-right">Payé</th>
                  <th className="text-right">Reste</th>
                  <th>Statut</th>
                  <th className="text-right">Action</th>
                </tr>
              </thead>
              <tbody>
                {scolarite.map((ligne) => {
                  const paiement = dernierParFrais.get(ligne.id);
                  const courant = ligne.periode === periodeActuelle;
                  return (
                    <tr key={ligne.id} className={courant ? "bg-brand-soft/40" : undefined}>
                      <td>
                        <span className="text-[12.5px] font-medium text-ink">
                          {libelleEcheance(ligne, annee)}
                        </span>
                        {courant && (
                          <span className="ml-2 rounded-full bg-brand px-1.5 py-0.5 text-[9px] font-semibold uppercase tracking-wide text-white">
                            En cours
                          </span>
                        )}
                      </td>
                      <td className="chiffre text-right text-[12.5px] text-ink-2">
                        {formatNombre(ligne.montant_du)} F
                      </td>
                      <td className="chiffre text-right text-[12.5px] text-ink-2">
                        {formatNombre(ligne.montant_paye)} F
                      </td>
                      <td
                        className={`chiffre text-right text-[12.5px] ${
                          ligne.reste > 0
                            ? ligne.echue === false
                              ? "text-muted"
                              : "font-medium text-impaye"
                            : "text-muted"
                        }`}
                      >
                        {formatNombre(ligne.reste)} F
                      </td>
                      <td>
                        {ligne.statut !== "PAYE" && ligne.echue === false ? (
                          <Badge>À venir</Badge>
                        ) : (
                          <BadgeStatut statut={ligne.statut} />
                        )}
                      </td>
                      <td className="text-right">
                        <div className="inline-flex items-center gap-2">
                          {paiement && (
                            <a
                              href={lienWhatsApp(
                                eleve.telephone_parent,
                                messageRecu(paiement),
                              )}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="inline-flex items-center gap-1 text-[11px] font-medium text-paye hover:underline"
                              title="Renvoyer le reçu WhatsApp"
                            >
                              <MessageCircle size={12} aria-hidden />
                              Reçu
                            </a>
                          )}
                          {actif && ligne.statut !== "PAYE" && (
                            <Link
                              href={`/app/paiements/nouveau?eleve=${eleve.id}&frais=${ligne.id}`}
                              className="inline-flex items-center gap-1 rounded-sm bg-brand px-2 py-1 text-[11px] font-semibold text-white hover:bg-brand-deep"
                            >
                              <Wallet size={11} aria-hidden />
                              Encaisser
                            </Link>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </section>

        {/* ---------------- Parent + repères ---------------- */}
        <aside className="space-y-5">
          <section className="card overflow-hidden">
            <div className="flex items-center justify-between gap-2 border-b border-line bg-[#fbf6ea] px-4 py-3">
              <h2 className="flex items-center gap-2 text-[13.5px] font-semibold text-ink">
                <ReceiptText size={14} className="text-[#7a5010]" aria-hidden />
                {eleve.type_inscription === "ANCIEN"
                  ? "Frais d'entrée"
                  : "Frais d'inscription"}
              </h2>
              <span className="text-[10px] font-medium uppercase tracking-[0.08em] text-muted">
                Année {libelleAnnee(annee)}
              </span>
            </div>
            {fraisEntree.length === 0 ? (
              <p className="px-4 py-4 text-[12px] text-muted">
                {eleve.type_inscription === "ANCIEN"
                  ? "Aucun frais d'entrée : un ancien élève ne paie que sa scolarité."
                  : "Aucun frais d'inscription sur cette année."}
              </p>
            ) : (
              <ul className="divide-y divide-line">
                {fraisEntree.map((ligne) => {
                  const paiement = dernierParFrais.get(ligne.id);
                  return (
                    <li key={ligne.id} className="px-4 py-3">
                      <div className="flex items-center justify-between gap-2">
                        <span className="text-[12.5px] font-medium text-ink">
                          {libelleNature(ligne.type_frais)}
                        </span>
                        <BadgeStatut statut={ligne.statut} />
                      </div>
                      <div className="mt-1.5 flex items-baseline justify-between gap-2">
                        <p className="chiffre text-[16px] font-medium text-ink">
                          {formatFCFA(ligne.montant_du)}
                        </p>
                        <p className="text-[11px] text-muted">
                          payé {formatF(ligne.montant_paye)} · reste{" "}
                          <span
                            className={
                              ligne.reste > 0 ? "font-semibold text-impaye" : "text-paye"
                            }
                          >
                            {formatF(ligne.reste)}
                          </span>
                        </p>
                      </div>
                      <div className="mt-2 flex items-center gap-2">
                        {actif && ligne.statut !== "PAYE" ? (
                          <LienBouton
                            href={`/app/paiements/nouveau?eleve=${eleve.id}&frais=${ligne.id}`}
                            taille="sm"
                          >
                            <Wallet size={12} aria-hidden />
                            Encaisser
                          </LienBouton>
                        ) : ligne.statut === "PAYE" ? (
                          <span className="inline-flex items-center gap-1 text-[11px] font-medium text-paye">
                            <ReceiptText size={12} aria-hidden />
                            Inscription soldée
                          </span>
                        ) : (
                          <span className="text-[11px] font-medium text-muted">
                            Solde conservé dans l&apos;archive
                          </span>
                        )}
                        {paiement && (
                          <a
                            href={lienWhatsApp(
                              eleve.telephone_parent,
                              messageRecu(paiement),
                            )}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex items-center gap-1 text-[11px] font-medium text-paye hover:underline"
                          >
                            <MessageCircle size={12} aria-hidden />
                            Reçu
                          </a>
                        )}
                      </div>
                    </li>
                  );
                })}
              </ul>
            )}
            <p className="border-t border-line px-4 py-2.5 text-[10.5px] leading-relaxed text-muted">
              Un élève n&apos;est considéré comme inscrit que lorsque ces frais
              sont entièrement payés.
            </p>
          </section>

          <section className="card p-4 sm:p-5">
            <h2 className="text-[14px] font-semibold text-ink">Parent / tuteur</h2>
            <p className="mt-2 text-[13px] font-medium text-ink-2">
              {eleve.nom_parent}
            </p>
            <p className="mt-1 flex items-center gap-1.5 text-[12px] text-muted">
              <Phone size={12} aria-hidden />
              +228 {formatTelephone(eleve.telephone_parent)}
            </p>

            <a
              href={`https://wa.me/228${eleve.telephone_parent}`}
              target="_blank"
              rel="noopener noreferrer"
              className="mt-4 inline-flex h-9 w-full items-center justify-center gap-2 rounded-sm border border-paye/25 bg-paye-soft text-[12.5px] font-semibold text-paye transition-colors hover:bg-paye/10"
            >
              <MessageCircle size={14} aria-hidden />
              Contacter sur WhatsApp
            </a>

            <p className="mt-3 text-[11px] leading-relaxed text-muted">
              Ce numéro reçoit les reçus de paiement et les rappels d&apos;impayés.
              Vous pouvez le modifier dans la fiche de l&apos;élève.
            </p>
          </section>

          <section className="card p-4 sm:p-5">
            <h2 className="flex items-center gap-2 text-[14px] font-semibold text-ink">
              <ReceiptText size={15} className="text-muted" aria-hidden />
              Règles appliquées
            </h2>
            <ul className="mt-3 space-y-2.5 text-[12px] leading-relaxed text-muted">
              <li>
                Un paiement partiel est accepté : l&apos;échéance reste « Partiel »
                jusqu&apos;au solde.
              </li>
              <li>
                Le montant saisi ne peut pas dépasser le reste dû{" "}
                {eleve.frequence_paiement === "TRANCHES"
                  ? "de l'échéance choisie"
                  : `de ${formatF(eleve.montant_periode)}${suffixePeriode(
                      eleve.frequence_paiement,
                    )}`}
                .
              </li>
              <li>
                Seul le directeur peut annuler un paiement. L&apos;historique
                conserve la trace.
              </li>
            </ul>
          </section>

          <section className="rounded-md border border-line bg-surface-2 p-4">
            <p className="text-[10.5px] font-semibold uppercase tracking-[0.1em] text-muted">
              Année scolaire
            </p>
            <p className="chiffre mt-1 text-[13px] font-medium text-ink">{annee}</p>
            <p className="mt-2 text-[11px] leading-relaxed text-muted">
              Les échéances sont créées selon la fréquence de la classe. Si
              l&apos;élève change de classe, les échéances non entamées prennent le
              nouveau tarif.
            </p>
          </section>
        </aside>
      </div>

      {/* ---------------- Absences ---------------- */}
      <section className="card mt-5 overflow-hidden">
        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-line px-4 py-3.5 sm:px-5">
          <div>
            <h2 className="text-[14px] font-semibold text-ink">Absences</h2>
            <p className="mt-0.5 text-[11.5px] text-muted">
              {compteurAbsences.total} absence
              {compteurAbsences.total > 1 ? "s" : ""} ·{" "}
              {compteurAbsences.justifiees} justifiée
              {compteurAbsences.justifiees > 1 ? "s" : ""} · année{" "}
              {eleve.annee_scolaire}
            </p>
          </div>
        </div>

        {actif && peutGerer && (
          <div className="border-b border-line bg-surface-2 px-4 py-3 sm:px-5">
            <FormulaireAbsence eleveId={eleve.id} />
          </div>
        )}

        {absences.length === 0 ? (
          <p className="px-4 py-6 text-center text-[12px] text-muted">
            Aucune absence enregistrée pour cette année scolaire.
          </p>
        ) : (
          <ul className="divide-y divide-line">
            {absences.map((absence) => (
              <li
                key={absence.id}
                className="flex flex-wrap items-center justify-between gap-2 px-4 py-2.5 sm:px-5"
              >
                <div className="flex min-w-0 items-center gap-2.5">
                  <span className="chiffre shrink-0 text-[12px] font-medium text-ink-2">
                    {formatDate(absence.date_absence)}
                  </span>
                  <span className="truncate text-[12px] text-muted">
                    {absence.motif?.trim() || "Sans motif"}
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  <Badge ton={absence.justifiee ? "succes" : "ochre"}>
                    {absence.justifiee ? "Justifiée" : "Non justifiée"}
                  </Badge>
                  {actif && peutGerer && (
                    <BoutonSupprimerAbsence id={absence.id} eleveId={eleve.id} />
                  )}
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>

      {/* ---------------- Historique ---------------- */}
      <section className="card mt-5 overflow-hidden">
        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-line px-4 py-3.5 sm:px-5">
          <div>
            <h2 className="text-[14px] font-semibold text-ink">
              Historique des paiements
            </h2>
            <p className="mt-0.5 text-[11.5px] text-muted">
              {peutHistorique
                ? `${paiements.length} opération${paiements.length > 1 ? "s" : ""} · reçus, modes et auteurs`
                : `${paiementsAffiches.length} dernier${paiementsAffiches.length > 1 ? "s" : ""} paiement${paiementsAffiches.length > 1 ? "s" : ""} · historique complet avec l'offre PRO`}
            </p>
          </div>
        </div>

        {paiements.length === 0 ? (
          <div className="px-5 py-10 text-center">
            <p className="text-[13px] font-medium text-ink">
              Aucun paiement enregistré
            </p>
            <p className="mx-auto mt-1 max-w-sm text-[12px] leading-relaxed text-muted">
              Les encaissements apparaîtront ici avec leur numéro de reçu et la
              personne qui les a enregistrés.
            </p>
            {actif && (
              <div className="mt-4">
                <LienBouton href={`/app/paiements/nouveau?eleve=${eleve.id}`} taille="sm">
                  <Wallet size={13} aria-hidden />
                  Encaisser un paiement
                </LienBouton>
              </div>
            )}
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="tableau min-w-[640px]">
              <thead>
                <tr>
                  <th>Date</th>
                  <th>Reçu</th>
                  <th>Échéance</th>
                  <th>Mode</th>
                  <th className="text-right">Montant</th>
                  <th>Enregistré par</th>
                  <th className="text-right">Actions</th>
                </tr>
              </thead>
              <tbody>
                {paiementsAffiches.map((paiement) => (
                  <tr key={paiement.id} className={paiement.annule ? "opacity-55" : undefined}>
                    <td className="whitespace-nowrap text-[12px] text-ink-2">
                      {formatDateHeure(paiement.date_paiement)}
                    </td>
                    <td>
                      <span className="chiffre text-[11.5px] text-ink-2">
                        {paiement.numero_recu}
                      </span>
                    </td>
                    <td className="text-[12px] text-ink-2">
                      {libelleEcheance(paiement, annee)}
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
                    <td className="text-[12px] text-muted">
                      {paiement.enregistre_par_nom ?? "—"}
                    </td>
                    <td className="text-right">
                      <div className="inline-flex items-center gap-1.5">
                        {paiement.annule ? (
                          <Badge ton="neutre">Annulé</Badge>
                        ) : (
                          <>
                            <a
                              href={lienWhatsApp(
                                eleve.telephone_parent,
                                messageRecu(paiement),
                              )}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="inline-flex items-center gap-1 rounded-sm px-1.5 py-1 text-[11px] font-medium text-paye hover:bg-paye-soft"
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
                      {paiement.annule && (
                        <p className="mt-1 max-w-[220px] text-[10px] leading-snug text-muted">
                          Annulé
                          {paiement.annule_par_nom
                            ? ` par ${paiement.annule_par_nom}`
                            : ""}
                          {paiement.annule_le
                            ? ` le ${formatDateHeure(paiement.annule_le)}`
                            : ""}
                          {paiement.motif_annulation
                            ? ` · ${paiement.motif_annulation}`
                            : ""}
                        </p>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {!peutHistorique && paiements.length > paiementsAffiches.length && (
          <div className="flex flex-wrap items-center justify-between gap-2 border-t border-line bg-[#fbf1de] px-4 py-3 sm:px-5">
            <p className="text-[11.5px] leading-relaxed text-[#7a5010]">
              Seuls les 5 derniers paiements sont affichés. L&apos;historique
              complet par élève est inclus dans l&apos;offre PRO.
            </p>
            <Link
              href="/app/parametres#abonnement"
              className="text-[11.5px] font-semibold text-[#7a5010] underline underline-offset-2 hover:no-underline"
            >
              Passer à PRO
            </Link>
          </div>
        )}
      </section>
    </div>
  );
}
