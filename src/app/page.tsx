import type { Metadata } from "next";
import Link from "next/link";
import {
  ArrowRight,
  Check,
  ChevronDown,
  Clock3,
  FileDown,
  FileSpreadsheet,
  Lock,
  MessageCircle,
  ReceiptText,
  Search,
  ShieldCheck,
  Smartphone,
  Users,
  Wallet,
} from "lucide-react";
import { Logo } from "@/components/ui/logo";
import { BadgeStatut } from "@/components/ui/badge";
import { COMMERCIAL, lienWhatsAppCommercial } from "@/lib/config";

export const metadata: Metadata = {
  title: "Logiciel de frais scolaires pour les écoles privées du Togo",
  description:
    "ECOLE PAY remplace le cahier de frais : encaissements, reçus WhatsApp automatiques, relance des impayés et bilan mensuel. Essai gratuit 30 jours.",
};

const plans = [
  {
    nom: "STARTER",
    prix: "15 000",
    limite: "1 utilisateur · 150 élèves",
    inclus: [
      "Gestion des élèves et inscriptions",
      "Tranches libres : montants et dates",
      "Paiements partiels",
      "Reçu WhatsApp structuré",
      "Liste des impayés par tranche",
    ],
    accent: false,
  },
  {
    nom: "PRO",
    prix: "25 000",
    limite: "3 utilisateurs · 500 élèves",
    inclus: [
      "Tout STARTER",
      "Directeur, comptable et secrétaire",
      "Relance WhatsApp des impayés",
      "Export Excel et PDF",
      "Historique complet par élève",
      "Total encaissé et total restant",
    ],
    accent: true,
  },
  {
    nom: "PREMIUM",
    prix: "40 000",
    limite: "Utilisateurs et élèves illimités",
    inclus: [
      "Tout PRO",
      "Notes et bulletins automatiques",
      "Profs et suivi des salaires",
      "Multi-écoles dans un compte",
      "Statistiques par classe et tranche",
      "Sauvegarde automatique",
      "Support prioritaire WhatsApp",
    ],
    accent: false,
  },
];

function LigneApercu({
  nom,
  classe,
  statut,
  montant,
}: {
  nom: string;
  classe: string;
  statut: "PAYE" | "PARTIEL" | "NON_PAYE";
  montant: string;
}) {
  return (
    <div className="flex items-center justify-between gap-3 border-t border-line px-4 py-3">
      <div className="min-w-0">
        <p className="truncate text-[13px] font-medium text-ink">{nom}</p>
        <p className="text-[11px] text-muted">{classe}</p>
      </div>
      <div className="flex shrink-0 items-center gap-3">
        <BadgeStatut statut={statut} />
        <span className="chiffre hidden text-[12.5px] text-ink sm:inline">{montant}</span>
      </div>
    </div>
  );
}

export default function PageAccueil() {
  return (
    <div className="min-h-dvh bg-canvas">
      {/* Bandeau tricolore — un repère local discret */}
      <div className="flex h-1">
        <span className="flex-1 bg-[#006a4e]" />
        <span className="flex-1 bg-[#ffce00]" />
        <span className="flex-1 bg-[#d21034]" />
      </div>

      {/* ---------------------------------------------------------------- */}
      <header className="border-b border-line bg-canvas/95">
        <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-5 sm:px-8">
          <Link href="/" aria-label="ECOLE PAY — accueil">
            <Logo />
          </Link>

          <nav className="hidden items-center gap-7 text-[13px] font-medium text-ink-2 md:flex">
            <a href="#fonctionnement" className="hover:text-brand">
              Fonctionnement
            </a>
            <a href="#produit" className="hover:text-brand">
              Tableau de bord
            </a>
            <a href="#tarifs" className="hover:text-brand">
              Tarifs
            </a>
            <a href="#securite" className="hover:text-brand">
              Sécurité
            </a>
          </nav>

          <div className="flex items-center gap-2">
            <Link
              href="/connexion"
              className="hidden rounded-sm px-3 py-2 text-[13px] font-semibold text-ink-2 hover:bg-brand-soft hover:text-brand sm:inline-flex"
            >
              Connexion
            </Link>
            <Link
              href="/inscription"
              className="inline-flex h-9 items-center gap-1.5 rounded-sm bg-brand px-3.5 text-[13px] font-semibold text-white transition-colors hover:bg-brand-deep"
            >
              Ouvrir mon école
              <ArrowRight size={14} aria-hidden />
            </Link>
          </div>
        </div>
      </header>

      <main>
        {/* ============================================================ */}
        {/* HERO                                                          */}
        {/* ============================================================ */}
        <section className="mx-auto grid max-w-6xl gap-12 px-5 pb-16 pt-12 sm:px-8 sm:pt-16 lg:grid-cols-[1.02fr_0.98fr] lg:items-center lg:gap-14 lg:pb-24 lg:pt-20">
          <div>
            <p className="inline-flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.16em] text-brand">
              <span className="size-1.5 rounded-full bg-ochre" aria-hidden />
              Caisse scolaire · Lomé, Togo
            </p>

            <h1 className="mt-5 text-[clamp(2.5rem,5.2vw,3.9rem)] font-semibold leading-[1.04] tracking-[-0.045em] text-ink">
              Le cahier de frais,
              <br />
              <span className="relative whitespace-nowrap">
                sans les litiges
                <span className="absolute inset-x-0 -bottom-1 h-[3px] bg-ochre/70" />
              </span>
              .
            </h1>

            <p className="mt-6 max-w-[34rem] text-[15.5px] leading-[1.65] text-ink-2 sm:text-[16.5px]">
              ECOLE PAY remplace le cahier de scolarité. Votre secrétaire encaisse
              en trois clics, le parent reçoit son reçu sur WhatsApp, et vous
              voyez en cinq secondes combien il reste à encaisser.
            </p>

            <div className="mt-8 flex flex-col gap-3 sm:flex-row sm:items-center">
              <Link
                href="/inscription"
                className="inline-flex h-12 items-center justify-center gap-2 rounded-sm bg-brand px-6 text-[14.5px] font-semibold text-white transition-colors hover:bg-brand-deep"
              >
                Tester gratuitement 30 jours
                <ArrowRight size={16} aria-hidden />
              </Link>
              <a
                href="#produit"
                className="inline-flex h-12 items-center justify-center gap-2 rounded-sm border border-line-strong bg-surface px-5 text-[14px] font-semibold text-ink transition-colors hover:bg-surface-2"
              >
                Voir le tableau de bord
              </a>
            </div>

            <div className="mt-6 flex flex-wrap items-center gap-x-5 gap-y-2 text-[12px] text-muted">
              <span className="inline-flex items-center gap-1.5">
                <Check size={14} className="text-paye" aria-hidden /> Sans carte bancaire
              </span>
              <span className="inline-flex items-center gap-1.5">
                <Check size={14} className="text-paye" aria-hidden /> Toutes les fonctions PREMIUM offertes
              </span>
              <span className="inline-flex items-center gap-1.5">
                <Check size={14} className="text-paye" aria-hidden /> Sur téléphone
              </span>
            </div>
          </div>

          {/* Aperçu produit */}
          <div className="relative mx-auto w-full max-w-[460px] pb-12 pl-0 sm:pb-16 sm:pl-6">
            <div
              className="absolute inset-x-4 top-4 hidden h-full rounded-lg border border-line bg-surface-2 sm:block"
              aria-hidden
            />
            <div className="relative overflow-hidden rounded-lg border border-line bg-surface shadow-[0_24px_60px_-30px_rgba(8,43,75,0.35)]">
              <div className="flex items-center justify-between border-b border-line bg-surface-2 px-4 py-3">
                <div className="flex items-center gap-2">
                  <span className="grid size-7 place-items-center rounded-sm bg-brand text-[10px] font-bold text-white">
                    EP
                  </span>
                  <div>
                    <p className="text-[11.5px] font-semibold leading-tight text-ink">
                      École Les Palmiers
                    </p>
                    <p className="text-[10px] text-muted">Agoè · Lomé</p>
                  </div>
                </div>
                <span className="rounded-full border border-line bg-surface px-2 py-0.5 text-[10px] font-medium text-muted">
                  Novembre 2026
                </span>
              </div>

              <div className="px-4 py-4">
                <p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-muted">
                  Encaissé ce mois
                </p>
                <div className="mt-1 flex items-end justify-between gap-3">
                  <p className="chiffre text-[30px] font-medium leading-none text-ink">
                    1 250 000
                    <span className="ml-1 text-[13px] font-normal text-muted">FCFA</span>
                  </p>
                  <span className="mb-1 text-[11px] font-semibold text-paye">74 %</span>
                </div>
                <div className="mt-3 flex gap-[3px]" aria-hidden>
                  {Array.from({ length: 20 }).map((_, i) => (
                    <span
                      key={i}
                      className={`h-1.5 flex-1 rounded-[1px] ${
                        i < 15 ? "bg-paye/80" : "bg-line"
                      }`}
                    />
                  ))}
                </div>
                <div className="mt-2 flex justify-between text-[10.5px] text-muted">
                  <span>Restant : 450 000 F</span>
                  <span>Attendu : 1 700 000 F</span>
                </div>
              </div>

              <div className="border-t border-line bg-surface-2/60 px-4 py-2">
                <p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-muted">
                  Élèves · 6ème A
                </p>
              </div>

              <div>
                <LigneApercu
                  nom="Kossi Adjovi"
                  classe="6ème A · parent : Mme Adjovi"
                  statut="PAYE"
                  montant="25 000 F"
                />
                <LigneApercu
                  nom="Afi Mensah"
                  classe="6ème A · parent : M. Mensah"
                  statut="PARTIEL"
                  montant="10 000 F"
                />
                <LigneApercu
                  nom="Yao Kouassi"
                  classe="6ème A · parent : Mme Kouassi"
                  statut="NON_PAYE"
                  montant="25 000 F"
                />
              </div>
            </div>

            {/* Bulle WhatsApp */}
            <div className="absolute -bottom-1 right-0 w-[280px] rounded-lg border border-line bg-surface p-3 shadow-[0_18px_40px_-24px_rgba(8,43,75,0.45)] sm:right-[-10px]">
              <div className="flex items-start gap-2.5">
                <span className="mt-0.5 grid size-7 shrink-0 place-items-center rounded-full bg-[#e6f7ee] text-[#067a43]">
                  <MessageCircle size={14} aria-hidden />
                </span>
                <div className="min-w-0">
                  <p className="text-[10px] font-semibold uppercase tracking-[0.1em] text-muted">
                    Reçu WhatsApp · envoyé
                  </p>
                  <p className="mt-1 line-clamp-3 text-[11.5px] leading-snug text-ink-2">
                    ECOLE Les Palmiers - Reçu : Merci M/Mme Adjovi, paiement de
                    25 000 F reçu pour Kossi, Classe 6ème A…
                  </p>
                  <p className="mt-1.5 text-[10px] text-muted">il y a 2 minutes</p>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* ============================================================ */}
        {/* CE QUI CHANGE                                                 */}
        {/* ============================================================ */}
        <section className="border-y border-line bg-surface">
          <div className="mx-auto max-w-6xl px-5 py-14 sm:px-8 sm:py-16">
            <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-end">
              <div>
                <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-brand">
                  Lundi matin
                </p>
                <h2 className="mt-3 max-w-xl text-[26px] font-semibold leading-tight tracking-[-0.03em] text-ink sm:text-[30px]">
                  Ce que le cahier ne vous dit pas, ECOLE PAY vous le montre.
                </h2>
              </div>
              <p className="max-w-xs text-[13px] leading-relaxed text-muted">
                Pas de rapport à préparer. Les chiffres se mettent à jour à mesure
                que les paiements sont enregistrés.
              </p>
            </div>

            <div className="mt-10 grid gap-px overflow-hidden rounded-md border border-line bg-line sm:grid-cols-3">
              {[
                {
                  numero: "01",
                  titre: "Le total encaissé",
                  texte:
                    "Plus besoin de recompter les carnets : le montant du mois et le reste à encaisser sont affichés en haut du tableau de bord.",
                  rendu: (
                    <p className="chiffre mt-4 text-[24px] font-medium text-ink">
                      1 250 000 <span className="text-[12px] text-muted">FCFA</span>
                    </p>
                  ),
                },
                {
                  numero: "02",
                  titre: "Le reçu du parent",
                  texte:
                    "Chaque paiement génère un message prêt à envoyer sur WhatsApp, avec le montant, le mois et le reste à payer.",
                  rendu: (
                    <p className="mt-4 inline-flex items-center gap-1.5 rounded-full bg-paye-soft px-2.5 py-1 text-[11px] font-semibold text-paye">
                      <MessageCircle size={12} aria-hidden />
                      Reçu prêt
                    </p>
                  ),
                },
                {
                  numero: "03",
                  titre: "Les impayés du mois",
                  texte:
                    "La liste des élèves non à jour est prête, classée par classe, avec le téléphone du parent pour relancer.",
                  rendu: (
                    <p className="chiffre mt-4 text-[24px] font-medium text-impaye">
                      12 <span className="text-[12px] font-normal text-muted">élèves à relancer</span>
                    </p>
                  ),
                },
              ].map((element) => (
                <div key={element.numero} className="bg-surface p-6">
                  <p className="chiffre text-[11px] font-medium text-ochre">{element.numero}</p>
                  <h3 className="mt-3 text-[15px] font-semibold text-ink">{element.titre}</h3>
                  <p className="mt-2 text-[13px] leading-relaxed text-muted">{element.texte}</p>
                  {element.rendu}
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* ============================================================ */}
        {/* FONCTIONNEMENT — 3 CLICS                                      */}
        {/* ============================================================ */}
        <section id="fonctionnement" className="mx-auto max-w-6xl px-5 py-16 sm:px-8 sm:py-20">
          <div className="grid gap-10 lg:grid-cols-[0.85fr_1.15fr] lg:gap-16">
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-brand">
                Encaisser un paiement
              </p>
              <h2 className="mt-3 text-[28px] font-semibold leading-tight tracking-[-0.035em] text-ink sm:text-[32px]">
                Trois clics. Moins de dix secondes.
              </h2>
              <p className="mt-3 max-w-sm text-[13.5px] leading-relaxed text-muted">
                Pensé pour une secrétaire qui a dix parents devant elle et une
                connexion qui va et vient. Les écrans sont légers et les
                informations essentielles restent visibles.
              </p>

              <div className="mt-7 rounded-md border border-line bg-surface-2 p-4">
                <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-muted">
                  Règle de sécurité
                </p>
                <p className="mt-2 text-[12.5px] leading-relaxed text-ink-2">
                  Un paiement ne peut jamais dépasser le reste dû. Les paiements
                  partiels sont autorisés, et seul le directeur peut annuler une
                  opération.
                </p>
              </div>
            </div>

            <ol className="relative space-y-0">
              {[
                {
                  icone: Search,
                  titre: "Chercher l'élève",
                  texte:
                    "Tapez les premières lettres du nom, du prénom ou du parent. La classe et le reste du mois s'affichent.",
                },
                {
                  icone: Wallet,
                  titre: "Saisir le montant",
                  texte:
                    "Le reste dû est pré-rempli. Choisissez Espèces, Flooz ou TMoney. Le total et le nouveau statut sont vérifiés avant validation.",
                },
                {
                  icone: MessageCircle,
                  titre: "Envoyer le reçu",
                  texte:
                    "Le reçu est enregistré et le message WhatsApp est préparé pour le parent. Un bouton, et c'est parti.",
                },
              ].map(({ icone: Icone, titre, texte }, index) => (
                <li key={titre} className="relative flex gap-5 pb-9 last:pb-0">
                  <div className="flex flex-col items-center">
                    <span className="grid size-10 shrink-0 place-items-center rounded-full border border-line-strong bg-surface text-brand">
                      <Icone size={18} aria-hidden />
                    </span>
                    {index < 2 && <span className="mt-1 w-px flex-1 bg-line" aria-hidden />}
                  </div>
                  <div className="pt-1">
                    <p className="flex items-baseline gap-2">
                      <span className="chiffre text-[11px] text-ochre">0{index + 1}</span>
                      <span className="text-[15px] font-semibold text-ink">{titre}</span>
                    </p>
                    <p className="mt-1.5 max-w-md text-[13px] leading-relaxed text-muted">
                      {texte}
                    </p>
                  </div>
                </li>
              ))}
            </ol>
          </div>
        </section>

        {/* ============================================================ */}
        {/* PRODUIT — TABLEAU DE BORD                                     */}
        {/* ============================================================ */}
        <section id="produit" className="bg-brand-deep text-white">
          <div className="mx-auto max-w-6xl px-5 py-16 sm:px-8 sm:py-20">
            <div className="grid gap-12 lg:grid-cols-[0.9fr_1.1fr] lg:items-center">
              <div>
                <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-[#ffce00]">
                  Le tableau de bord du directeur
                </p>
                <h2 className="mt-3 text-[28px] font-semibold leading-tight tracking-[-0.035em] sm:text-[34px]">
                  Combien est rentré. Combien manque. Qui relancer.
                </h2>
                <p className="mt-4 max-w-md text-[14px] leading-relaxed text-white/65">
                  Une page d&apos;accueil qui répond aux trois questions du
                  directeur, sans filtre ni formation. Choisissez un mois,
                  le reste suit.
                </p>

                <div className="mt-7 space-y-3">
                  {[
                    "Total encaissé et reste à encaisser du mois",
                    "Taux de paiement par classe et liste des plus gros impayés",
                    "Graphique des dix mois de l'année scolaire",
                    "Export PDF des impayés et du bilan mensuel",
                  ].map((texte) => (
                    <p key={texte} className="flex items-start gap-2.5 text-[13px] text-white/75">
                      <Check size={15} className="mt-0.5 shrink-0 text-[#7ddba4]" aria-hidden />
                      {texte}
                    </p>
                  ))}
                </div>
              </div>

              {/* Aperçu tableau de bord */}
              <div className="overflow-hidden rounded-lg border border-white/12 bg-[#f8f5ed] text-ink shadow-2xl">
                <div className="flex items-center justify-between border-b border-line px-4 py-3">
                  <div>
                    <p className="text-[12px] font-semibold">Novembre 2026</p>
                    <p className="text-[10px] text-muted">École Les Palmiers</p>
                  </div>
                  <span className="rounded-sm border border-line bg-surface px-2 py-1 text-[10px] font-medium text-muted">
                    Mois en cours
                  </span>
                </div>

                <div className="grid grid-cols-2 gap-px bg-line sm:grid-cols-[1.4fr_1fr_1fr]">
                  <div className="bg-[#082b4b] px-4 py-4 text-white sm:col-span-1">
                    <p className="text-[9.5px] font-semibold uppercase tracking-[0.12em] text-white/50">
                      Encaissé
                    </p>
                    <p className="chiffre mt-1 text-[22px] font-medium leading-none">
                      1 250 000
                    </p>
                    <p className="mt-1 text-[9.5px] text-white/50">FCFA</p>
                  </div>
                  <div className="bg-surface px-4 py-4">
                    <p className="text-[9.5px] font-semibold uppercase tracking-[0.12em] text-muted">
                      Restant
                    </p>
                    <p className="chiffre mt-1 text-[17px] font-medium leading-none text-ink">
                      450 000
                    </p>
                    <p className="mt-1 text-[9.5px] text-muted">FCFA</p>
                  </div>
                  <div className="bg-surface px-4 py-4">
                    <p className="text-[9.5px] font-semibold uppercase tracking-[0.12em] text-muted">
                      À jour
                    </p>
                    <p className="chiffre mt-1 text-[17px] font-medium leading-none text-paye">
                      74 %
                    </p>
                    <p className="mt-1 text-[9.5px] text-muted">des élèves</p>
                  </div>
                </div>

                <div className="bg-surface">
                  <div className="flex items-center justify-between border-b border-line px-4 py-2.5">
                    <p className="text-[10px] font-semibold uppercase tracking-[0.1em] text-muted">
                      Par classe
                    </p>
                    <p className="text-[10px] text-muted">Encaissé / attendu</p>
                  </div>
                  {[
                    { nom: "6ème A", eleves: "32 élèves", taux: 88, montant: "704 000" },
                    { nom: "3ème B", eleves: "28 élèves", taux: 61, montant: "455 000" },
                    { nom: "Terminale D", eleves: "24 élèves", taux: 42, montant: "352 000" },
                  ].map((classe) => (
                    <div
                      key={classe.nom}
                      className="grid grid-cols-[1fr_auto] items-center gap-3 border-b border-line px-4 py-2.5 last:border-0"
                    >
                      <div>
                        <div className="flex items-center justify-between gap-2">
                          <p className="text-[11.5px] font-medium text-ink">{classe.nom}</p>
                          <p className="text-[9.5px] text-muted">{classe.eleves}</p>
                        </div>
                        <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-line">
                          <div
                            className="h-full rounded-full bg-brand"
                            style={{ width: `${classe.taux}%` }}
                          />
                        </div>
                      </div>
                      <div className="text-right">
                        <p className="chiffre text-[11px] text-ink">{classe.montant} F</p>
                        <p className="text-[9.5px] text-muted">{classe.taux} %</p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* ============================================================ */}
        {/* FONCTIONNALITÉS                                               */}
        {/* ============================================================ */}
        <section className="mx-auto max-w-6xl px-5 py-16 sm:px-8 sm:py-20">
          <div className="max-w-2xl">
            <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-brand">
              Tout le nécessaire, rien de plus
            </p>
            <h2 className="mt-3 text-[28px] font-semibold leading-tight tracking-[-0.035em] text-ink sm:text-[32px]">
              Une caisse scolaire complète, utilisable dès le premier jour.
            </h2>
          </div>

          <div className="mt-10 grid gap-x-12 gap-y-0 sm:grid-cols-2">
            {[
              {
                icone: ReceiptText,
                titre: "Paiements partiels",
                texte:
                  "Un parent apporte 10 000 F sur 25 000 F : le statut passe en « Partiel » et le reste dû est suivi. Le solde peut être réglé plus tard.",
              },
              {
                icone: MessageCircle,
                titre: "Reçus WhatsApp",
                texte:
                  "Un reçu structuré, prêt à envoyer : nom de l'établissement, numéro de reçu, élève, classe, tranche payée, montant et reste à payer. WhatsApp s'ouvre avec le numéro du parent, la secrétaire vérifie puis appuie sur Envoyer.",
              },
              {
                icone: Clock3,
                titre: "Relance des impayés",
                texte:
                  "Une liste par classe, un lien WhatsApp par parent, et un message de rappel prêt à envoyer. Fini les appels oubliés.",
              },
              {
                icone: FileSpreadsheet,
                titre: "Import & Export Excel / CSV",
                texte:
                  "Importez toute votre école en copiant-collant vos listes Excel. Exportez vos encaissements et la liste des élèves pour votre comptabilité.",
              },
              {
                icone: FileDown,
                titre: "Exports PDF officiels",
                texte:
                  "Impayés du mois avec téléphones des parents, ou bilan mensuel par classe. Utile pour le conseil et les archives.",
              },
              {
                icone: Users,
                titre: "Directeur et secrétaires",
                texte:
                  "La secrétaire encaisse, le directeur garde la main sur les annulations, les tarifs et les exports.",
              },
              {
                icone: Smartphone,
                titre: "Pensé pour le téléphone",
                texte:
                  "Écrans responsives, gros boutons, chargement léger. L'application fonctionne sur un Android d'entrée de gamme.",
              },
            ].map(({ icone: Icone, titre, texte }) => (
              <div
                key={titre}
                className="flex gap-4 border-t border-line py-6 first:border-t-0 sm:[&:nth-child(2)]:border-t-0"
              >
                <span className="mt-0.5 grid size-9 shrink-0 place-items-center rounded-sm border border-line bg-surface-2 text-brand">
                  <Icone size={17} aria-hidden />
                </span>
                <div>
                  <h3 className="text-[14.5px] font-semibold text-ink">{titre}</h3>
                  <p className="mt-1.5 text-[13px] leading-relaxed text-muted">{texte}</p>
                </div>
              </div>
            ))}
          </div>
        </section>

        {/* ============================================================ */}
        {/* SÉCURITÉ                                                      */}
        {/* ============================================================ */}
        <section id="securite" className="border-y border-line bg-surface">
          <div className="mx-auto grid max-w-6xl gap-10 px-5 py-14 sm:px-8 sm:py-16 lg:grid-cols-[0.8fr_1.2fr]">
            <div>
              <span className="grid size-10 place-items-center rounded-sm border border-brand/20 bg-brand-soft text-brand">
                <ShieldCheck size={19} aria-hidden />
              </span>
              <h2 className="mt-4 text-[24px] font-semibold leading-tight tracking-[-0.03em] text-ink">
                Les données d&apos;une école restent chez elle.
              </h2>
              <p className="mt-3 max-w-sm text-[13px] leading-relaxed text-muted">
                ECOLE PAY héberge plusieurs écoles, mais chaque compte est isolé.
                Un directeur ne peut jamais voir les élèves d&apos;une autre école,
                même en modifiant l&apos;adresse d&apos;une page.
              </p>
            </div>

            <div className="grid gap-x-8 gap-y-5 sm:grid-cols-2">
              {[
                {
                  icone: Lock,
                  titre: "Cloisonnement strict",
                  texte:
                    "Chaque requête est filtrée par l'école de la session. Les contraintes de la base empêchent tout rattachement croisé.",
                },
                {
                  icone: ShieldCheck,
                  titre: "Mots de passe hachés",
                  texte:
                    "Les mots de passe sont hachés avec bcrypt. Aucun mot de passe en clair n'est stocké.",
                },
                {
                  icone: ReceiptText,
                  titre: "Paiements jamais effacés",
                  texte:
                    "Une annulation conserve la trace, le motif, l'auteur et la date. L'historique reste auditable.",
                },
                {
                  icone: Wallet,
                  titre: "Vos données restent les vôtres",
                  texte:
                    "Aucune revente de données. Les exports PDF vous appartiennent et sont téléchargeables à tout moment.",
                },
              ].map(({ icone: Icone, titre, texte }) => (
                <div key={titre} className="flex gap-3">
                  <Icone size={16} className="mt-0.5 shrink-0 text-brand" aria-hidden />
                  <div>
                    <p className="text-[13px] font-semibold text-ink">{titre}</p>
                    <p className="mt-1 text-[12.5px] leading-relaxed text-muted">{texte}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* ============================================================ */}
        {/* TARIFS                                                        */}
        {/* ============================================================ */}
        <section id="tarifs" className="mx-auto max-w-6xl px-5 py-16 sm:px-8 sm:py-20">
          <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-end">
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-brand">
                Tarifs
              </p>
              <h2 className="mt-3 text-[28px] font-semibold leading-tight tracking-[-0.035em] text-ink sm:text-[32px]">
                Trois offres, un déblocage immédiat.
              </h2>
            </div>
            <p className="max-w-xs text-[13px] leading-relaxed text-muted">
              30 jours d&apos;essai avec toutes les fonctions PREMIUM, sans carte
              bancaire. Paiement par Flooz ou TMoney ensuite.
            </p>
          </div>

          <div className="mt-10 grid gap-4 lg:grid-cols-3">
            {plans.map((plan) => (
              <div
                key={plan.nom}
                className={`relative flex flex-col rounded-lg border bg-surface p-6 ${
                  plan.accent
                    ? "border-brand shadow-[0_20px_50px_-30px_rgba(13,59,102,0.5)]"
                    : "border-line"
                }`}
              >
                {plan.accent && (
                  <span className="absolute -top-2.5 left-6 rounded-full bg-brand px-2.5 py-0.5 text-[9.5px] font-semibold uppercase tracking-[0.1em] text-white">
                    Le plus choisi
                  </span>
                )}
                <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-muted">
                  {plan.nom}
                </p>
                <p className="mt-3 flex items-baseline gap-1">
                  <span className="chiffre text-[30px] font-medium tracking-tight text-ink">
                    {plan.prix}
                  </span>
                  <span className="text-[12px] text-muted">FCFA / mois</span>
                </p>
                <p className="mt-1 text-[12px] text-muted">{plan.limite}</p>

                <ul className="mt-5 flex-1 space-y-2.5 border-t border-line pt-5">
                  {plan.inclus.map((element) => (
                    <li key={element} className="flex items-start gap-2 text-[12.5px] text-ink-2">
                      <Check size={13} className="mt-0.5 shrink-0 text-paye" aria-hidden />
                      {element}
                    </li>
                  ))}
                </ul>

                <Link
                  href="/inscription"
                  className={`mt-6 inline-flex h-10 items-center justify-center rounded-sm text-[13px] font-semibold transition-colors ${
                    plan.accent
                      ? "bg-brand text-white hover:bg-brand-deep"
                      : "border border-line-strong bg-surface text-ink hover:bg-surface-2"
                  }`}
                >
                  Commencer l&apos;essai
                </Link>
              </div>
            ))}
          </div>

          <p className="mt-5 text-[12px] text-muted">
            Chaque offre inclut l&apos;essai de 30 jours avec les fonctions
            PREMIUM. Le changement d&apos;offre est immédiat et ne supprime jamais
            vos données.
          </p>
        </section>

        {/* ============================================================ */}
        {/* FAQ                                                           */}
        {/* ============================================================ */}
        <section className="border-t border-line bg-surface">
          <div className="mx-auto max-w-3xl px-5 py-14 sm:px-8 sm:py-16">
            <h2 className="text-[24px] font-semibold tracking-[-0.03em] text-ink">
              Questions fréquentes
            </h2>
            <div className="mt-6 divide-y divide-line border-y border-line">
              {[
                {
                  question: "Le parent doit-il télécharger une application ?",
                  reponse:
                    "Non. Le parent ne se connecte à rien. Il reçoit un message WhatsApp avec le reçu ou le rappel, envoyé depuis la caisse de l'école.",
                },
                {
                  question: "Comment le reçu WhatsApp est-il envoyé ?",
                  reponse:
                    "ECOLE PAY prépare un reçu structuré au nom de l'établissement et ouvre WhatsApp avec le numéro du parent. La secrétaire relit le message puis appuie sur Envoyer depuis son téléphone. Le reçu peut aussi être imprimé directement depuis la caisse.",
                },
                {
                  question: "Puis-je enregistrer un paiement partiel ?",
                  reponse:
                    "Oui. Si un parent règle 10 000 F sur 25 000 F, le mois passe en « Partiel » et le reste de 15 000 F est conservé. Le solde peut être complété plus tard.",
                },
                {
                  question: "Que se passe-t-il si une école a plusieurs secrétaires ?",
                  reponse:
                    "Le directeur crée les comptes secrétaires depuis les paramètres. Chaque action est horodatée et associée à la personne qui l'a enregistrée.",
                },
              ].map((element) => (
                <details key={element.question} className="group py-4">
                  <summary className="flex cursor-pointer list-none items-center justify-between gap-4 text-[13.5px] font-semibold text-ink marker:hidden">
                    {element.question}
                    <ChevronDown
                      size={16}
                      className="shrink-0 text-muted transition-transform group-open:rotate-180"
                      aria-hidden
                    />
                  </summary>
                  <p className="mt-2.5 max-w-2xl pr-6 text-[13px] leading-relaxed text-muted">
                    {element.reponse}
                  </p>
                </details>
              ))}
            </div>
          </div>
        </section>

        {/* ============================================================ */}
        {/* APPEL FINAL                                                   */}
        {/* ============================================================ */}
        <section className="mx-auto max-w-6xl px-5 py-16 sm:px-8 sm:py-20">
          <div className="grid items-center gap-8 rounded-lg border border-line bg-surface p-8 sm:p-10 lg:grid-cols-[1.3fr_0.7fr]">
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-ochre">
                Prêt pour la prochaine rentrée
              </p>
              <h2 className="mt-3 max-w-xl text-[26px] font-semibold leading-tight tracking-[-0.035em] text-ink sm:text-[30px]">
                Ouvrez votre école, ajoutez une classe, encaissez votre premier
                paiement.
              </h2>
              <p className="mt-3 max-w-lg text-[13.5px] leading-relaxed text-muted">
                30 jours gratuits. Sans installation, sans engagement, sans
                carte bancaire. Vous gardez vos données si vous partez.
              </p>
            </div>
            <div className="flex flex-col gap-2.5">
              <Link
                href="/inscription"
                className="inline-flex h-11 items-center justify-center gap-2 rounded-sm bg-brand px-5 text-[14px] font-semibold text-white transition-colors hover:bg-brand-deep"
              >
                Ouvrir mon école
                <ArrowRight size={15} aria-hidden />
              </Link>
              <Link
                href="/connexion"
                className="inline-flex h-11 items-center justify-center rounded-sm border border-line-strong bg-surface text-[13.5px] font-semibold text-ink transition-colors hover:bg-surface-2"
              >
                J&apos;ai déjà un compte
              </Link>
            </div>
          </div>
        </section>
      </main>

      {/* ============================================================ */}
      <footer className="border-t border-line bg-surface">
        <div className="mx-auto flex max-w-6xl flex-col gap-6 px-5 py-9 sm:px-8 md:flex-row md:items-center md:justify-between">
          <div>
            <Logo />
            <p className="mt-3 max-w-xs text-[12px] leading-relaxed text-muted">
              La caisse scolaire des écoles privées du Togo. Lomé, Agoè,
              Adidogomé, Bè, Deckon.
            </p>
          </div>
          <div className="flex flex-wrap gap-x-8 gap-y-3 text-[12.5px] text-ink-2">
            <Link href="/connexion" className="hover:text-brand">
              Connexion
            </Link>
            <Link href="/inscription" className="hover:text-brand">
              Ouvrir un compte
            </Link>
            <a
              href={lienWhatsAppCommercial(
                "Bonjour ECOLE PAY, je souhaite des informations pour mon école",
              )}
              target="_blank"
              rel="noopener noreferrer"
              className="text-paye hover:underline"
            >
              WhatsApp : {COMMERCIAL.whatsappAffichage}
            </a>
            <a href={`mailto:${COMMERCIAL.email}`} className="hover:text-brand">
              {COMMERCIAL.email}
            </a>
          </div>
        </div>
        <div className="border-t border-line">
          <div className="mx-auto flex max-w-6xl flex-col gap-2 px-5 py-4 text-[11px] text-muted sm:flex-row sm:items-center sm:justify-between sm:px-8">
            <p>© {new Date().getFullYear()} ECOLE PAY. Tous droits réservés.</p>
            <p>Conçu et hébergé pour les écoles du Togo.</p>
          </div>
        </div>
      </footer>
    </div>
  );
}
