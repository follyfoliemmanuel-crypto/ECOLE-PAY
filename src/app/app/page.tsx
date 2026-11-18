import type { Metadata } from "next";
import Link from "next/link";
import {
  AlertTriangle,
  ArrowRight,
  Check,
  ClipboardList,
  LockKeyhole,
  MessageCircle,
  Plus,
  ReceiptText,
  Users,
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
  suffixePeriode,
} from "@/lib/periodes";
import { getDashboard, type Impaye } from "@/lib/data/dashboard";
import { getEcole } from "@/lib/data/ecole";
import { nombreTranchesMax } from "@/lib/data/classes";
import { listerImpayes } from "@/lib/data/impayes";
import {
  formatDate,
  formatF,
  formatFCFA,
  formatNombre,
  formatTelephone,
  pourcentage,
} from "@/lib/format";
import { lienWhatsApp, rendreMessage } from "@/lib/whatsapp";
import { LIBELLES_MODE } from "@/lib/types";
import { BadgeStatut } from "@/components/ui/badge";
import { LienBouton } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { PeriodeSelect } from "@/components/ui/periode-select";
import { EntetePage } from "@/components/app/entete-page";
import { ExportBilan, ExportImpayes } from "@/components/app/exports-pdf";
import { CartePortailParent } from "@/components/portail/carte-portail";
import {
  BoutonPremium,
  CartePortailPremium,
} from "@/components/offres/verrou-premium";
import { compteursSaisies, echeanceNotes, suiviProfs } from "@/lib/data/saisies";
import { trimestreCourant } from "@/lib/saisies";
import { lienPublicEcole, messagePartageParent } from "@/lib/portail";
import { qrCodeDataUrl } from "@/lib/qr";
import { cx } from "@/lib/cx";

export const metadata: Metadata = { title: "Tableau de bord" };

export default async function PageTableauDeBord({
  searchParams,
}: {
  searchParams: Promise<{ frequence?: string; periode?: string }>;
}) {
  const session = await exigerSession();
  const parametres = await searchParams;
  const annee = await anneeActive(session.ecoleId);
  const frequence = frequenceDepuisParametre(parametres.frequence);
  const periode = periodeDepuisParametre(parametres.periode, frequence);

  const [dashboard, ecole, impayesPeriode, nbTranches] = await Promise.all([
    getDashboard(session.ecoleId, annee, frequence, periode),
    getEcole(session.ecoleId),
    listerImpayes(session.ecoleId, annee, frequence, periode),
    nombreTranchesMax(session.ecoleId),
  ]);

  const peutNotes = peut(session.ecole, "notes_bulletins");
  const trimestreNotes = trimestreCourant();
  let compteursNotes: Awaited<ReturnType<typeof compteursSaisies>> | null = null;
  let suiviNotes: Awaited<ReturnType<typeof suiviProfs>> = [];
  let echeanceNote: Awaited<ReturnType<typeof echeanceNotes>> = null;
  if (peutNotes) {
    [compteursNotes, suiviNotes, echeanceNote] = await Promise.all([
      compteursSaisies(session.ecoleId, annee, trimestreNotes),
      suiviProfs(session.ecoleId, annee, trimestreNotes),
      echeanceNotes(session.ecoleId, annee, trimestreNotes),
    ]);
  }
  const notesEnRetard = suiviNotes.filter(
    (prof) =>
      echeanceNote !== null &&
      echeanceNote.jours_restants < 0 &&
      prof.envoyes + prof.valides === 0,
  ).length;

  if (!ecole) return null;

  const {
    resume,
    inscriptions,
    classes,
    impayes,
    serie,
    derniersPaiements,
    recettes,
  } = dashboard;
  const nomPeriode = libellePeriode(frequence, periode, annee, false, nbTranches);
  const tauxEleves = pourcentage(resume.payes, resume.eleves);
  const tauxMontant = pourcentage(resume.encaisse, resume.attendu);
  /** Chiffre affiché en grand : les recettes du mois quand il y en a. */
  const afficheRecettes = recettes !== null && recettes.total > 0;
  const montantAffiche =
    recettes && afficheRecettes ? recettes.total : resume.encaisse;
  const recettesAutres = recettes
    ? recettes.autres
        .map((ligne) => ({
          ...ligne,
          libelle: libellePeriode(
            "MENSUEL",
            ligne.periode,
            annee,
            false,
            nbTranches,
          ).toLowerCase(),
        }))
    : [];
  const libelleAutres = recettesAutres.map((ligne) => ligne.libelle).join(", ");
  const montantAutres = recettes
    ? recettes.total - recettes.pourPeriode
    : 0;
  const aucunEleve = resume.eleves === 0;
  const peutTotaux = peut(session.ecole, "dashboard_totaux");
  const peutExporter = peut(session.ecole, "exports");
  const peutRelancer = peut(session.ecole, "relances");
  const peutPortail = peut(session.ecole, "portail_parent");
  const peutValidation = peut(session.ecole, "validation_notes");
  const peutComptesProfs = peut(session.ecole, "comptes_profs");
  const envoiAutomatique = peut(
    session.ecole,
    "envoi_bulletins_whatsapp",
  );
  const lienParent = peutPortail && ecole.slug ? lienPublicEcole(ecole.slug) : "";

  let qrParent = "";
  if (lienParent) {
    try {
      qrParent = await qrCodeDataUrl(lienParent);
    } catch (erreur) {
      console.error("QR code portail parent :", erreur);
    }
  }

  const pdfEcole = {
    nom: ecole.nom,
    adresse: ecole.adresse,
    telephone: ecole.telephone,
  };
  const pdfResume = {
    eleves: resume.eleves,
    payes: resume.payes,
    partiels: resume.partiels,
    impayes: resume.impayes,
    attendu: resume.attendu,
    encaisse: resume.encaisse,
    restant: resume.restant,
  };
  const pdfClasses = classes.map((classe) => ({
    nom: classe.nom,
    nb_eleves: classe.nb_eleves,
    payes: classe.payes,
    partiels: classe.partiels,
    impayes: classe.impayes,
    attendu: classe.attendu,
    encaisse: classe.encaisse,
    restant: classe.restant,
  }));
  const pdfImpayes = impayesPeriode.groupes.flatMap((groupe) =>
    groupe.eleves.map((eleve) => ({
      nom: eleve.nom,
      prenom: eleve.prenom,
      classe: eleve.classe_nom,
      parent: eleve.nom_parent,
      telephone: formatTelephone(eleve.telephone_parent),
      montant_du: eleve.montant_du,
      montant_paye: eleve.montant_paye,
      reste: eleve.reste,
      statut: eleve.statut,
    })),
  );

  function messageRelance(eleve: Impaye) {
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
        titre="Tableau de bord"
        description="Ce qui est encaissé, ce qui reste, et les familles à relancer sur cette période."
        actions={
          <>
            <PeriodeSelect
              frequence={frequence}
              periode={periode}
              annee={annee}
              nbTranches={nbTranches}
            />
            <LienBouton
              href={`/app/impayes?frequence=${frequence}&periode=${periode}`}
              variante="secondaire"
              taille="md"
            >
              <AlertTriangle size={15} aria-hidden />
              Impayés
            </LienBouton>
            <LienBouton href="/app/paiements/nouveau" taille="md">
              <Plus size={15} strokeWidth={2.4} aria-hidden />
              Encaisser
            </LienBouton>
          </>
        }
      />

      {peutNotes && compteursNotes && (
        <section className="mb-5 overflow-hidden rounded-lg border border-brand/15 bg-surface">
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-line px-4 py-3">
            <div className="min-w-0">
              <p className="flex items-center gap-2 text-[13px] font-semibold text-ink">
                <ClipboardList size={15} className="text-brand" aria-hidden />
                Saisie des notes par les professeurs
                <span className="rounded-full border border-line bg-surface-2 px-2 py-0.5 text-[10px] font-semibold text-muted">
                  Trimestre {trimestreNotes}
                </span>
              </p>
              <p className="mt-0.5 text-[11.5px] text-muted">
                {echeanceNote
                  ? `Notes à envoyer avant le ${formatDate(echeanceNote.date_limite)}${echeanceNote.jours_restants < 0 ? " — échéance dépassée" : ""}`
                  : "Aucune date limite fixée pour ce trimestre."}
              </p>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              {peutValidation ? (
                <LienBouton
                  href="/app/notes/validation"
                  taille="sm"
                  variante={compteursNotes.envoyes > 0 ? "principal" : "secondaire"}
                >
                  <ClipboardList size={13} aria-hidden />
                  {compteursNotes.envoyes > 0
                    ? `${compteursNotes.envoyes} à valider`
                    : "Valider les notes"}
                </LienBouton>
              ) : (
                <BoutonPremium taille="sm" contexte="la validation des notes">
                  <ClipboardList size={13} aria-hidden />
                  VALIDER LES NOTES
                </BoutonPremium>
              )}
              {peutComptesProfs ? (
                <LienBouton href="/app/profs" taille="sm" variante="secondaire">
                  <Plus size={13} aria-hidden />
                  Compte prof
                </LienBouton>
              ) : (
                <BoutonPremium taille="sm" contexte="les comptes professeurs">
                  <Plus size={13} aria-hidden />
                  CRÉER UN PROF
                </BoutonPremium>
              )}
            </div>
          </div>

          {!peutComptesProfs && (
            <div className="flex items-center gap-2 border-b border-line bg-[#fbf6ea] px-4 py-2 text-[11px] font-medium text-[#7a5010]">
              <LockKeyhole size={12} aria-hidden />
              Comptes profs, saisie en ligne et validation : réservé à PREMIUM
              40.000F. Les compteurs ci-dessous restent à zéro tant que
              l&apos;offre n&apos;est pas activée.
            </div>
          )}

          <div className="grid grid-cols-2 divide-x divide-line sm:grid-cols-4">
            {[
              {
                libelle: "En cours",
                valeur: compteursNotes.en_cours,
                detail: "Brouillons des profs",
                accent: "text-[#8a5a10]",
              },
              {
                libelle: "Envoyées",
                valeur: compteursNotes.envoyes,
                detail: "À valider par vous",
                accent: "text-brand",
              },
              {
                libelle: "Validées",
                valeur: compteursNotes.valides,
                detail: "Visibles aux parents",
                accent: "text-paye",
              },
              {
                libelle: "Profs en retard",
                valeur: notesEnRetard,
                detail: `${compteursNotes.profs_compte}/${compteursNotes.profs} comptes actifs`,
                accent: notesEnRetard > 0 ? "text-impaye" : "text-ink",
              },
            ].map((bloc) => (
              <div key={bloc.libelle} className="px-4 py-3">
                <p className="text-[9.5px] font-semibold uppercase tracking-[0.11em] text-muted">
                  {bloc.libelle}
                </p>
                <p
                  className={cx(
                    "chiffre mt-1 text-[17px] font-medium",
                    bloc.accent,
                  )}
                >
                  {bloc.valeur}
                </p>
                <p className="mt-0.5 text-[10.5px] text-muted">{bloc.detail}</p>
              </div>
            ))}
          </div>

          {notesEnRetard > 0 && (
            <div className="flex flex-wrap items-center gap-2 border-t border-impaye/20 bg-impaye-soft px-4 py-2.5 text-[12px] text-impaye">
              <AlertTriangle size={14} aria-hidden />
              {notesEnRetard} professeur{notesEnRetard > 1 ? "s" : ""}{" "}
              {notesEnRetard > 1 ? "n'ont" : "n'a"} pas encore envoyé{" "}
              {notesEnRetard > 1 ? "leurs notes" : "ses notes"}. Relancez-
              {notesEnRetard > 1 ? "les" : "le"} depuis le suivi.
              <Link
                href="/app/notes/validation"
                className="font-semibold underline underline-offset-2 hover:no-underline"
              >
                Voir le suivi
              </Link>
            </div>
          )}
        </section>
      )}

      {aucunEleve && (
        <section className="mb-6 overflow-hidden rounded-lg border border-brand/15 bg-surface">
          <div className="grid gap-6 p-6 sm:p-7 lg:grid-cols-[1.1fr_0.9fr] lg:items-center">
            <div>
              <p className="text-[10.5px] font-semibold uppercase tracking-[0.14em] text-ochre">
                Première mise en route
              </p>
              <h2 className="mt-2 text-[21px] font-semibold leading-tight tracking-[-0.03em] text-ink">
                Trois étapes avant votre premier reçu.
              </h2>
              <p className="mt-2 max-w-md text-[13px] leading-relaxed text-muted">
                Créez une classe avec son tarif et sa fréquence de paiement,
                ajoutez vos élèves, puis encaissez. Les échéances et les frais
                d&apos;inscription sont créés automatiquement.
              </p>
              <div className="mt-5 flex flex-wrap gap-2">
                <LienBouton href="/app/classes" taille="md">
                  Créer une classe
                  <ArrowRight size={15} aria-hidden />
                </LienBouton>
                <LienBouton href="/app/eleves/nouveau" variante="secondaire" taille="md">
                  Ajouter un élève
                </LienBouton>
              </div>
            </div>

            <ol className="space-y-3">
              {[
                { n: "01", titre: "Une classe, un tarif", texte: "Ex. 6ème A · 25 000 F / mois" },
                { n: "02", titre: "Les élèves et le parent", texte: "Nom, classe, numéro WhatsApp" },
                { n: "03", titre: "Un paiement, un reçu", texte: "Trois clics, message prêt à envoyer" },
              ].map((etape) => (
                <li
                  key={etape.n}
                  className="flex items-start gap-3 rounded-sm border border-line bg-surface-2 px-3.5 py-3"
                >
                  <span className="chiffre pt-0.5 text-[10.5px] text-ochre">{etape.n}</span>
                  <div>
                    <p className="text-[12.5px] font-semibold text-ink">{etape.titre}</p>
                    <p className="text-[11.5px] text-muted">{etape.texte}</p>
                  </div>
                </li>
              ))}
            </ol>
          </div>
        </section>
      )}

      {/* ---------------- Reçu de la période ---------------- */}
      <section className="overflow-hidden rounded-lg border border-brand-deep bg-brand-deep text-white">
        <div className="grid lg:grid-cols-[1.5fr_1fr]">
          <div className="p-5 sm:p-7">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <p className="text-[10.5px] font-semibold uppercase tracking-[0.14em] text-white/50">
                {afficheRecettes
                  ? `Recettes de ${nomPeriode}`
                  : `Encaissé · ${nomPeriode}`}
              </p>
              <span className="rounded-full border border-white/15 px-2.5 py-0.5 text-[10.5px] text-white/55">
                {libelleAnnee(annee)}
              </span>
            </div>

            {peutTotaux ? (
              <>
                <p className="chiffre mt-3 text-[clamp(2rem,5.5vw,3.1rem)] font-medium leading-none tracking-[-0.04em]">
                  {formatNombre(montantAffiche)}
                  <span className="ml-2 text-[13px] font-normal text-white/45">FCFA</span>
                </p>
                <p className="mt-2 text-[12px] text-white/50">
                  {afficheRecettes ? (
                    <>
                      sur {formatFCFA(resume.attendu)} attendus pour{" "}
                      {nomPeriode.toLowerCase()} ·{" "}
                      <span className="text-white/80">
                        {tauxMontant} % de la période encaissée
                      </span>
                    </>
                  ) : (
                    <>
                      sur {formatFCFA(resume.attendu)} attendus ·{" "}
                      <span className="text-white/80">{tauxMontant} % encaissés</span>
                    </>
                  )}
                </p>
                {afficheRecettes && montantAutres > 0 && (
                  <p className="mt-2 inline-flex flex-wrap items-center gap-1.5 rounded-sm border border-[#ffce00]/25 bg-[#ffce00]/10 px-2 py-1 text-[11px] text-[#ffce00]">
                    dont {formatFCFA(montantAutres)} reçus pour {libelleAutres}
                  </p>
                )}

                <div
                  className="mt-5 h-2 w-full overflow-hidden rounded-full bg-white/12"
                  role="img"
                  aria-label={`${tauxMontant} % du montant attendu est encaissé`}
                >
                  <div
                    className="h-full rounded-full bg-[#ffce00] transition-[width] duration-500"
                    style={{ width: `${Math.min(100, tauxMontant)}%` }}
                  />
                </div>
              </>
            ) : (
              <div className="mt-3 flex items-start gap-3">
                <span className="grid size-9 shrink-0 place-items-center rounded-sm border border-white/15 bg-white/10">
                  <LockKeyhole size={17} aria-hidden />
                </span>
                <div>
                  <p className="text-[16px] font-medium leading-tight text-white/90">
                    Totaux financiers — offre PRO
                  </p>
                  <p className="mt-1 text-[12px] leading-relaxed text-white/50">
                    Activez PRO pour afficher le total encaissé et le reste à
                    encaisser de l&apos;année.
                  </p>
                  <Link
                    href="/app/parametres#abonnement"
                    className="mt-2 inline-flex items-center gap-1 text-[11.5px] font-semibold text-[#ffce00] hover:underline"
                  >
                    Voir les offres
                    <ArrowRight size={12} aria-hidden />
                  </Link>
                </div>
              </div>
            )}

            <div className="mt-5 flex flex-wrap gap-x-5 gap-y-2 text-[11.5px] text-white/65">
              <span className="inline-flex items-center gap-1.5">
                <span className="size-1.5 rounded-full bg-[#7ddba4]" aria-hidden />
                {resume.payes} payés
              </span>
              <span className="inline-flex items-center gap-1.5">
                <span className="size-1.5 rounded-full bg-[#e8b25a]" aria-hidden />
                {resume.partiels} partiels
              </span>
              <span className="inline-flex items-center gap-1.5">
                <span className="size-1.5 rounded-full bg-[#ff8b93]" aria-hidden />
                {resume.impayes} non payés
              </span>
              <span className="text-white/35">·</span>
              <span>{resume.eleves} élève{resume.eleves > 1 ? "s" : ""} concerné{resume.eleves > 1 ? "s" : ""}</span>
            </div>
          </div>

          <div className="grid grid-cols-3 divide-x divide-white/10 border-t border-white/10 lg:grid-cols-1 lg:divide-x-0 lg:divide-y lg:border-l lg:border-t-0">
            <div className="px-4 py-4 sm:px-5">
              <p className="text-[9.5px] font-semibold uppercase tracking-[0.12em] text-white/45">
                Reste à encaisser
              </p>
              <p className="chiffre mt-1.5 text-[17px] font-medium leading-none sm:text-[19px]">
                {peutTotaux ? (
                  <>
                    {formatNombre(resume.restant)}
                    <span className="ml-1 text-[10px] font-normal text-white/40">F</span>
                  </>
                ) : (
                  <span className="text-[13px] text-white/45">Offre PRO</span>
                )}
              </p>
              <p className="mt-1 text-[10px] text-white/40">
                {peutTotaux
                  ? `${resume.partiels + resume.impayes} élèves concernés`
                  : "Total restant réservé au PRO"}
              </p>
            </div>

            <div className="px-4 py-4 sm:px-5">
              <p className="text-[9.5px] font-semibold uppercase tracking-[0.12em] text-white/45">
                Élèves à jour
              </p>
              <p className="chiffre mt-1.5 text-[17px] font-medium leading-none text-[#7ddba4] sm:text-[19px]">
                {tauxEleves} %
              </p>
              <p className="mt-1 text-[10px] text-white/40">
                {resume.payes} sur {resume.eleves}
              </p>
            </div>

            <div className="px-4 py-4 sm:px-5">
              <p className="text-[9.5px] font-semibold uppercase tracking-[0.12em] text-white/45">
                Impayés de la période
              </p>
              <p className="chiffre mt-1.5 text-[17px] font-medium leading-none sm:text-[19px]">
                {resume.impayes}
                <span className="ml-1 text-[10px] font-normal text-white/40">
                  / {resume.eleves}
                </span>
              </p>
              <p className="mt-1 text-[10px] text-white/40">
                {peutTotaux
                  ? `${formatF(resume.restant)} à recouvrer`
                  : "Détail financier réservé au PRO"}
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* ---------------- Inscriptions ---------------- */}
      <section className="mt-5 overflow-hidden rounded-lg border border-ochre/25 bg-surface">
        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-ochre/20 bg-[#fbf6ea] px-4 py-3 sm:px-5">
          <div>
            <h2 className="text-[14px] font-semibold text-ink">
              Inscriptions et réinscriptions
            </h2>
            <p className="mt-0.5 text-[11.5px] text-muted">
              Argent des frais d&apos;entrée, séparé de la scolarité
            </p>
          </div>
          <span className="rounded-full border border-ochre/30 bg-surface px-2.5 py-0.5 text-[10.5px] font-medium text-[#7a5010]">
            Année {libelleAnnee(annee)}
          </span>
        </div>
        <div className="grid grid-cols-2 divide-x divide-line lg:grid-cols-4">
          <div className="px-4 py-3.5">
            <p className="text-[9.5px] font-semibold uppercase tracking-[0.11em] text-muted">
              Encaissé
            </p>
            <p className="chiffre mt-1 text-[16px] font-medium text-paye">
              {formatNombre(inscriptions.encaisse)} F
            </p>
            <p className="mt-0.5 text-[10.5px] text-muted">
              sur {formatNombre(inscriptions.attendu)} F attendus
            </p>
          </div>
          <div className="px-4 py-3.5">
            <p className="text-[9.5px] font-semibold uppercase tracking-[0.11em] text-muted">
              En attente
            </p>
            <p className="chiffre mt-1 text-[16px] font-medium text-impaye">
              {formatNombre(inscriptions.restant)} F
            </p>
            <p className="mt-0.5 text-[10.5px] text-muted">
              {inscriptions.enAttente} élève
              {inscriptions.enAttente > 1 ? "s" : ""} non soldé
              {inscriptions.enAttente > 1 ? "s" : ""}
            </p>
          </div>
          <div className="px-4 py-3.5">
            <p className="text-[9.5px] font-semibold uppercase tracking-[0.11em] text-muted">
              Élèves inscrits
            </p>
            <p className="chiffre mt-1 text-[16px] font-medium text-ink">
              {inscriptions.elevesInscrits} / {inscriptions.totalEleves}
            </p>
            <p className="mt-0.5 text-[10.5px] text-muted">
              inscription ou réinscription payée
            </p>
          </div>
          <div className="px-4 py-3.5">
            <p className="text-[9.5px] font-semibold uppercase tracking-[0.11em] text-muted">
              Frais réglés
            </p>
            <p className="chiffre mt-1 text-[16px] font-medium text-ink">
              {inscriptions.payes}
            </p>
            <p className="mt-0.5 text-[10.5px] text-muted">
              sur {inscriptions.payes + inscriptions.enAttente} frais d&apos;entrée
            </p>
          </div>
        </div>
      </section>

      {peutPortail ? (
        <CartePortailParent
          slug={ecole.slug}
          lien={lienParent}
          message={messagePartageParent(ecole.slug)}
          qrDataUrl={qrParent}
          envoiAutomatique={envoiAutomatique}
        />
      ) : (
        <CartePortailPremium ecole={ecole.slug} />
      )}

      {/* ---------------- Classes + impayés ---------------- */}
      <div className="mt-5 grid gap-5 lg:grid-cols-3">
        <section className="card overflow-hidden lg:col-span-2">
          <div className="flex flex-wrap items-start justify-between gap-3 border-b border-line px-4 py-3.5 sm:px-5">
            <div>
              <h2 className="text-[14px] font-semibold text-ink">Situation par classe</h2>
              <p className="mt-0.5 text-[11.5px] text-muted">
                {nomPeriode} · paiements complets, partiels et impayés
              </p>
            </div>
            <div className="flex flex-wrap items-center gap-1.5">
              {peutExporter && (
                <>
                  <ExportImpayes
                    ecole={pdfEcole}
                    periode={nomPeriode}
                    annee={annee}
                    resume={pdfResume}
                    impayes={pdfImpayes}
                    libelle="Impayés"
                  />
                  <ExportBilan
                    ecole={pdfEcole}
                    periode={nomPeriode}
                    annee={annee}
                    resume={pdfResume}
                    classes={pdfClasses}
                    libelle="Bilan"
                  />
                </>
              )}
            </div>
          </div>

          {classes.length === 0 ? (
            <EmptyState
              titre="Aucune classe pour l'instant"
              description="Créez votre première classe, son tarif et sa fréquence pour commencer à suivre les paiements."
              action={<LienBouton href="/app/classes">Créer une classe</LienBouton>}
            />
          ) : (
            <div className="overflow-x-auto">
              <table className="tableau min-w-[560px]">
                <thead>
                  <tr>
                    <th>Classe</th>
                    <th className="hidden text-center sm:table-cell">Élèves</th>
                    <th className="hidden text-center md:table-cell">À jour</th>
                    <th className="hidden text-center md:table-cell">Partiels</th>
                    <th className="hidden text-center md:table-cell">Impayés</th>
                    <th>Répartition</th>
                    {peutTotaux && <th className="text-right">Encaissé</th>}
                  </tr>
                </thead>
                <tbody>
                  {classes.map((classe) => {
                    const total = Math.max(1, classe.nb_eleves);
                    const memeFrequence = classe.frequence_paiement === frequence;
                    return (
                      <tr key={classe.id}>
                        <td>
                          <Link
                            href={`/app/eleves?classe=${classe.id}&frequence=${frequence}&periode=${periode}`}
                            className="font-medium text-ink hover:text-brand hover:underline"
                          >
                            {classe.nom}
                          </Link>
                          <p className="mt-0.5 text-[11px] text-muted">
                            {classe.frequence_paiement === "TRANCHES"
                              ? `${classe.nb_tranches} tranche${classe.nb_tranches > 1 ? "s" : ""} · ${formatFCFA(classe.total_tranches)}`
                              : `${formatFCFA(classe.montant_periode)}${suffixePeriode(
                                  classe.frequence_paiement,
                                )}`}
                          </p>
                        </td>
                        <td className="hidden text-center sm:table-cell">
                          <span className="chiffre text-[13px]">{classe.nb_eleves}</span>
                        </td>
                        {memeFrequence ? (
                          <>
                            <td className="hidden text-center md:table-cell">
                              <span className="chiffre text-[13px] text-paye">{classe.payes}</span>
                            </td>
                            <td className="hidden text-center md:table-cell">
                              <span className="chiffre text-[13px] text-partiel">
                                {classe.partiels}
                              </span>
                            </td>
                            <td className="hidden text-center md:table-cell">
                              <span className="chiffre text-[13px] text-impaye">
                                {classe.impayes}
                              </span>
                            </td>
                            <td>
                              <div className="flex items-center gap-2.5">
                                <div
                                  className="flex h-1.5 w-24 overflow-hidden rounded-full bg-line"
                                  role="img"
                                  aria-label={`${classe.payes} payés, ${classe.partiels} partiels, ${classe.impayes} impayés`}
                                >
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
                                <span className="chiffre text-[12px] text-ink-2">
                                  {pourcentage(classe.payes, classe.nb_eleves)} %
                                </span>
                              </div>
                            </td>
                            {peutTotaux && (
                              <td className="text-right">
                                <span className="chiffre text-[12.5px] text-ink">
                                  {formatNombre(classe.encaisse)} F
                                </span>
                                <p className="mt-0.5 text-[10.5px] text-muted">
                                  / {formatNombre(classe.attendu)} F
                                </p>
                              </td>
                            )}
                          </>
                        ) : (
                          <>
                            <td className="hidden text-center md:table-cell text-muted">—</td>
                            <td className="hidden text-center md:table-cell text-muted">—</td>
                            <td className="hidden text-center md:table-cell text-muted">—</td>
                            <td className="text-[11px] text-muted">
                              Paiement{" "}
                              {classe.frequence_paiement === "TRANCHES"
                                ? "par tranches"
                                : classe.frequence_paiement === "ANNUEL"
                                  ? "annuel"
                                  : "mensuel"}
                            </td>
                            <td className="text-right text-muted">—</td>
                          </>
                        )}
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </section>

        <section className="card flex flex-col overflow-hidden">
          <div className="flex items-start justify-between gap-2 border-b border-line px-4 py-3.5">
            <div>
              <h2 className="text-[14px] font-semibold text-ink">À relancer en priorité</h2>
              <p className="mt-0.5 text-[11.5px] text-muted">Les plus gros restes de la période</p>
            </div>
            <AlertTriangle size={16} className="mt-0.5 text-impaye" aria-hidden />
          </div>

          {impayes.length === 0 ? (
            <EmptyState
              className="py-10"
              icone={<Check size={18} />}
              titre="Tout le monde est à jour"
              description={
                resume.eleves === 0
                  ? "Ajoutez vos élèves pour voir apparaître les relances."
                  : `Aucun impayé pour ${nomPeriode.toLowerCase()}. Les reçus sont dans les paiements.`
              }
            />
          ) : (
            <ul className="divide-y divide-line">
              {impayes.slice(0, 6).map((eleve) => (
                <li key={eleve.frais_id} className="flex items-center gap-3 px-4 py-3">
                  <span className="grid size-8 shrink-0 place-items-center rounded-full bg-surface-2 text-[10px] font-semibold text-ink-2">
                    {eleve.prenom.charAt(0)}
                    {eleve.nom.charAt(0)}
                  </span>
                  <div className="min-w-0 flex-1">
                    <Link
                      href={`/app/eleves/${eleve.eleve_id}`}
                      className="block truncate text-[12.5px] font-medium text-ink hover:text-brand hover:underline"
                    >
                      {eleve.prenom} {eleve.nom}
                    </Link>
                    <p className="truncate text-[10.5px] text-muted">
                      {eleve.classe_nom} ·{" "}
                      {libelleEcheance(eleve, annee, true)}{" "}
                      · {formatTelephone(eleve.telephone_parent)}
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="text-right">
                      <p className="chiffre text-[12px] font-medium text-impaye">
                        {formatNombre(eleve.reste)} F
                      </p>
                      <BadgeStatut statut={eleve.statut} className="mt-0.5 scale-90" />
                    </div>
                    {peutRelancer ? (
                      <a
                        href={lienWhatsApp(
                          eleve.telephone_parent,
                          messageRelance(eleve),
                        )}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="grid size-8 shrink-0 place-items-center rounded-sm border border-line text-paye transition-colors hover:bg-paye-soft"
                        aria-label={`Relancer ${eleve.prenom} ${eleve.nom} sur WhatsApp`}
                        title="Relancer sur WhatsApp"
                      >
                        <MessageCircle size={14} aria-hidden />
                      </a>
                    ) : (
                      <Link
                        href="/app/parametres#abonnement"
                        className="grid size-8 shrink-0 place-items-center rounded-sm border border-line text-muted transition-colors hover:bg-surface-2"
                        aria-label="Relance WhatsApp incluse dans l'offre PRO"
                        title="Relance WhatsApp — offre PRO"
                      >
                        <LockKeyhole size={13} aria-hidden />
                      </Link>
                    )}
                  </div>
                </li>
              ))}
            </ul>
          )}

          <div className="mt-auto border-t border-line px-4 py-3">
            <Link
              href={`/app/impayes?frequence=${frequence}&periode=${periode}`}
              className="inline-flex items-center gap-1.5 text-[12px] font-semibold text-brand hover:underline"
            >
              Voir les {impayesPeriode.nbEleves} impayés de la période
              <ArrowRight size={13} aria-hidden />
            </Link>
          </div>
        </section>
      </div>

      {/* ---------------- Évolution + derniers paiements ---------------- */}
      <div className="mt-5 grid gap-5 lg:grid-cols-3">
        <section className="card lg:col-span-2">
          <div className="flex flex-wrap items-start justify-between gap-3 border-b border-line px-4 py-3.5 sm:px-5">
            <div>
              <h2 className="text-[14px] font-semibold text-ink">Évolution de l&apos;année</h2>
              <p className="mt-0.5 text-[11.5px] text-muted">
                Encaissé comparé au montant attendu, période par période
              </p>
            </div>
            <div className="flex items-center gap-3 text-[10.5px] text-muted">
              {peutTotaux && (
                <>
                  <span className="inline-flex items-center gap-1.5">
                    <span className="size-2 rounded-sm bg-brand" aria-hidden /> Encaissé
                  </span>
                  <span className="inline-flex items-center gap-1.5">
                    <span className="size-2 rounded-sm bg-line" aria-hidden /> Attendu
                  </span>
                </>
              )}
            </div>
          </div>

          <div className="px-4 pb-4 pt-5 sm:px-5">
            {!peutTotaux ? (
              <div className="flex flex-col items-center gap-3 rounded-sm border border-dashed border-line-strong bg-surface-2 px-5 py-10 text-center">
                <span className="grid size-10 place-items-center rounded-full border border-ochre/30 bg-[#fbf1de] text-[#7a5010]">
                  <LockKeyhole size={18} aria-hidden />
                </span>
                <div>
                  <p className="text-[13px] font-semibold text-ink">
                    Évolution chiffrée — offre PRO
                  </p>
                  <p className="mx-auto mt-1 max-w-sm text-[11.5px] leading-relaxed text-muted">
                    Le comparatif encaissé / attendu période par période est
                    inclus dans l&apos;offre PRO. Vos paiements restent
                    enregistrés et réapparaîtront dès l&apos;activation.
                  </p>
                </div>
                <LienBouton
                  href="/app/parametres#abonnement"
                  variante="secondaire"
                  taille="sm"
                >
                  Voir les offres
                  <ArrowRight size={13} aria-hidden />
                </LienBouton>
              </div>
            ) : serie.length === 0 ? (
              <EmptyState
                className="py-8"
                titre="Pas encore d'historique"
                description="Le graphique se remplit dès que les premiers frais sont créés."
              />
            ) : (
              <div className="flex h-40 items-end gap-1.5 sm:gap-2">
                {serie.map((point) => {
                  const maximum = Math.max(1, ...serie.map((p) => p.attendu));
                  const hauteurAttendu = Math.max(6, (point.attendu / maximum) * 100);
                  const hauteurEncaisse = Math.max(0, (point.encaisse / maximum) * 100);
                  const courant = point.periode === periode;
                  return (
                    <div key={point.periode} className="flex flex-1 flex-col items-center gap-1.5">
                      <div
                        className="relative flex h-32 w-full items-end justify-center gap-[2px]"
                        title={`${point.libelle ?? libellePeriode(frequence, point.periode, annee, false, nbTranches)} · encaissé ${formatF(
                          point.encaisse,
                        )} sur ${formatF(point.attendu)}`}
                      >
                        <span
                          className="w-1/2 rounded-t-[2px] bg-line"
                          style={{ height: `${hauteurAttendu}%` }}
                        />
                        <span
                          className="w-1/2 rounded-t-[2px] bg-brand"
                          style={{ height: `${hauteurEncaisse}%` }}
                        />
                      </div>
                      <span
                        className={
                          courant
                            ? "rounded-sm bg-brand px-1 py-0.5 text-[9px] font-semibold text-white"
                            : "text-[9px] text-muted"
                        }
                      >
                        {libellePeriode(frequence, point.periode, annee, true, nbTranches)}
                      </span>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </section>

        <section className="card overflow-hidden">
          <div className="flex items-start justify-between border-b border-line px-4 py-3.5">
            <div>
              <h2 className="text-[14px] font-semibold text-ink">Derniers paiements</h2>
              <p className="mt-0.5 text-[11.5px] text-muted">Toutes classes confondues</p>
            </div>
            <Wallet size={16} className="mt-0.5 text-muted" aria-hidden />
          </div>

          {derniersPaiements.length === 0 ? (
            <EmptyState
              className="py-10"
              icone={<ReceiptText size={18} />}
              titre="Aucun paiement enregistré"
              description="Encaissez votre premier paiement : le reçu WhatsApp sera préparé automatiquement."
              action={
                <LienBouton href="/app/paiements/nouveau" taille="sm">
                  <Plus size={14} aria-hidden /> Encaisser
                </LienBouton>
              }
            />
          ) : (
            <ul className="divide-y divide-line">
              {derniersPaiements.map((paiement) => (
                <li key={paiement.id} className="px-4 py-2.5">
                  <div className="flex items-baseline justify-between gap-2">
                    <p className="truncate text-[12.5px] font-medium text-ink">
                      {paiement.eleve_prenom} {paiement.eleve_nom}
                    </p>
                    <span className="chiffre shrink-0 text-[12px] font-medium text-paye">
                      +{formatNombre(paiement.montant)} F
                    </span>
                  </div>
                  <div className="mt-0.5 flex items-center justify-between gap-2 text-[10.5px] text-muted">
                    <span className="truncate">
                      {paiement.classe_nom} ·{" "}
                      {libelleEcheance(paiement, annee, true)}{" "}
                      · {LIBELLES_MODE[paiement.mode_paiement]}
                    </span>
                    <span className="shrink-0">{formatDate(paiement.date_paiement)}</span>
                  </div>
                </li>
              ))}
            </ul>
          )}

          <div className="mt-auto border-t border-line px-4 py-3">
            <Link
              href="/app/paiements"
              className="inline-flex items-center gap-1.5 text-[12px] font-semibold text-brand hover:underline"
            >
              Tous les paiements
              <ArrowRight size={13} aria-hidden />
            </Link>
          </div>
        </section>
      </div>

      {!aucunEleve && (
        <p className="mt-5 flex items-center gap-1.5 text-[11.5px] text-muted">
          <Users size={13} aria-hidden />
          Les encaissements sont mis à jour en temps réel. Le total de la période
          correspond aux frais de {nomPeriode.toLowerCase()} déjà réglés.
        </p>
      )}
    </div>
  );
}
