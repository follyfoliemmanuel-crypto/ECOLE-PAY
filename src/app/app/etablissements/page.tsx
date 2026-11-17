import type { Metadata } from "next";
import Link from "next/link";
import {
  ArrowRight,
  Building2,
  CheckCircle2,
  Clock3,
  MessageCircle,
  ShieldCheck,
  Sparkles,
} from "lucide-react";
import { exigerSession } from "@/lib/auth";
import { offreEffective, peut } from "@/lib/offres";
import { LIBELLES_STATUT_ECOLE } from "@/lib/types";
import { VerrouOffre } from "@/components/offres/verrou-offre";
import { EntetePage } from "@/components/app/entete-page";
import { Alerte } from "@/components/ui/empty-state";

export const metadata: Metadata = { title: "Multi-écoles" };

export default async function PageEtablissements() {
  const session = await exigerSession();
  const offre = offreEffective(session.ecole);

  if (!peut(session.ecole, "multi_ecoles")) {
    return (
      <VerrouOffre
        titre="Multi-écoles"
        description="Gérez plusieurs établissements depuis un seul compte, avec des données bien séparées."
        cle="multi_ecoles"
        offreActuelle={offre}
        fonctionnalites={[
          "Plusieurs écoles dans un même compte",
          "Bascule rapide entre les établissements",
          "Élèves et paiements strictement séparés par école",
          "Aucune donnée supprimée en cas de changement d'offre",
        ]}
      />
    );
  }

  return (
    <div>
      <EntetePage
        surtitre="Module en préparation"
        titre="Multi-écoles"
        description="Vous pourrez bientôt piloter plusieurs établissements depuis un seul compte. Ce module est en cours de construction : aucune bascule d'école n'est encore possible ici."
      />

      <div className="mb-5">
        <Alerte ton="info">
          <span className="flex items-start gap-2">
            <Clock3 size={16} className="mt-0.5 shrink-0" aria-hidden />
            <span>
              <strong>Ce module n&apos;est pas encore actif.</strong> Aucun
              formulaire de cette page ne modifie vos données. Votre compte
              actuel continue de gérer normalement l&apos;établissement{" "}
              <strong>{session.ecole.nom}</strong>.
            </span>
          </span>
        </Alerte>
      </div>

      <div className="mb-5 grid gap-4 lg:grid-cols-[1.15fr_1fr]">
        <section className="card overflow-hidden">
          <div className="border-b border-line bg-surface-2 px-5 py-4">
            <h2 className="flex items-center gap-2 text-[14px] font-semibold text-ink">
              <Building2 size={16} aria-hidden />
              Ce qui fonctionne aujourd&apos;hui
            </h2>
            <p className="mt-0.5 text-[11.5px] text-muted">
              Une école = un compte, avec une isolation stricte des données.
            </p>
          </div>
          <div className="px-5 py-4">
            <div className="rounded-sm border border-line bg-surface-2/60 px-3.5 py-3">
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div>
                  <p className="text-[13.5px] font-semibold text-ink">
                    {session.ecole.nom}
                  </p>
                  <p className="mt-0.5 text-[11px] text-muted">
                    Établissement actuellement connecté
                  </p>
                </div>
                <div className="flex items-center gap-1.5">
                  <span className="rounded-full border border-brand/20 bg-brand-soft px-2 py-0.5 text-[9px] font-semibold uppercase tracking-[0.06em] text-brand">
                    {session.ecole.statut === "ESSAI" ? "Essai PREMIUM" : offre}
                  </span>
                  <span className="rounded-full border border-line bg-surface px-2 py-0.5 text-[9px] font-semibold uppercase tracking-[0.06em] text-muted">
                    {LIBELLES_STATUT_ECOLE[session.ecole.statut]}
                  </span>
                </div>
              </div>
              <p className="mt-2 text-[11.5px] leading-relaxed text-muted">
                Élèves, classes, paiements et salaires sont rattachés à cette
                école. Un autre compte ne voit jamais ces données.
              </p>
            </div>

            <ul className="mt-3 space-y-2 text-[12px] text-ink-2">
              {[
                "Classes, élèves et paiements filtrés par école à chaque requête.",
                "Les clés étrangères composites empêchent de rattacher un élève à une autre école.",
                "Les reçus, bulletins et salaires restent propres à l'établissement connecté.",
              ].map((point) => (
                <li key={point} className="flex items-start gap-2">
                  <CheckCircle2
                    size={14}
                    className="mt-0.5 shrink-0 text-paye"
                    aria-hidden
                  />
                  {point}
                </li>
              ))}
            </ul>

            <div className="mt-4 flex flex-wrap gap-2">
              <Link
                href="/app/parametres"
                className="inline-flex h-9 items-center gap-1.5 rounded-sm border border-line-strong bg-surface px-3 text-[12px] font-semibold text-ink transition-colors hover:bg-surface-2"
              >
                Gérer mon établissement
                <ArrowRight size={13} aria-hidden />
              </Link>
              <Link
                href="/app"
                className="inline-flex h-9 items-center gap-1.5 rounded-sm border border-line-strong bg-surface px-3 text-[12px] font-semibold text-ink transition-colors hover:bg-surface-2"
              >
                Retour au tableau de bord
              </Link>
            </div>
          </div>
        </section>

        <section className="card overflow-hidden">
          <div className="border-b border-line bg-surface-2 px-5 py-4">
            <h2 className="flex items-center gap-2 text-[14px] font-semibold text-ink">
              <Sparkles size={16} aria-hidden />
              Ce qui arrive
            </h2>
            <p className="mt-0.5 text-[11.5px] text-muted">
              Le multi-écoles touche à l&apos;authentification et à la
              séparation des données : il est développé avec prudence.
            </p>
          </div>
          <ul className="divide-y divide-line">
            {[
              {
                titre: "Plusieurs établissements",
                texte:
                  "Créer et rattacher plusieurs écoles au même compte payant.",
              },
              {
                titre: "Bascule rapide",
                texte:
                  "Passer d'une école à l'autre sans ressaisir ses identifiants.",
              },
              {
                titre: "Données strictement séparées",
                texte:
                  "Chaque école garde ses élèves, paiements, notes et salaires isolés.",
              },
              {
                titre: "Consolidation",
                texte:
                  "Un tableau de bord global pour comparer les encaissements des établissements.",
              },
            ].map((etape, index) => (
              <li key={etape.titre} className="flex gap-3 px-5 py-3">
                <span className="chiffre grid size-6 shrink-0 place-items-center rounded-full border border-line bg-surface-2 text-[10px] font-semibold text-muted">
                  {index + 1}
                </span>
                <div>
                  <p className="text-[12.5px] font-medium text-ink">{etape.titre}</p>
                  <p className="mt-0.5 text-[11px] leading-relaxed text-muted">
                    {etape.texte}
                  </p>
                </div>
              </li>
            ))}
          </ul>
          <div className="border-t border-line px-5 py-3">
            <p className="flex items-start gap-2 text-[11px] leading-relaxed text-muted">
              <ShieldCheck size={14} className="mt-0.5 shrink-0" aria-hidden />
              Aucune donnée ne sera supprimée lors de l&apos;activation du
              module. Les structures existantes seront reprises.
            </p>
          </div>
        </section>
      </div>

      <section className="card flex flex-wrap items-center justify-between gap-3 px-5 py-4">
        <div>
          <h2 className="text-[13.5px] font-semibold text-ink">
            Besoin de gérer plusieurs écoles maintenant ?
          </h2>
          <p className="mt-0.5 text-[11.5px] text-muted">
            Contactez SCHOOL PAY pour étudier une solution adaptée à votre groupe
            scolaire pendant que le module se prépare.
          </p>
        </div>
        <a
          href="https://wa.me/22870309744"
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex h-10 items-center gap-2 rounded-sm bg-paye px-4 text-[12.5px] font-semibold text-white transition-colors hover:bg-paye/90"
        >
          <MessageCircle size={15} aria-hidden />
          Écrire sur WhatsApp
        </a>
      </section>
    </div>
  );
}
