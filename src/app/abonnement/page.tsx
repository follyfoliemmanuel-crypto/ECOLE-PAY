import type { Metadata } from "next";
import Link from "next/link";
import {
  ArrowLeft,
  CalendarDays,
  Check,
  LockKeyhole,
  Mail,
  MessageCircle,
  ShieldCheck,
  Smartphone,
} from "lucide-react";
import { exigerSession } from "@/lib/auth";
import {
  ACTIVATION,
  dateDuJour,
  joursCouverts,
  libelleMotif,
} from "@/lib/activation";
import { OFFRES, MOIS_ACCES_ANNEE, MOIS_PAYES_ANNEE } from "@/lib/offres";
import { abonnementEcole } from "@/lib/data/abonnement";
import { formatDate, formatFCFA } from "@/lib/format";
import { LIBELLES_OFFRE, type Offre } from "@/lib/types";
import { Badge } from "@/components/ui/badge";
import { cx } from "@/lib/cx";

export const metadata: Metadata = { title: "Abonnement" };

const ORDRES: Offre[] = ["STARTER", "STANDARD", "PREMIUM"];

export default async function PageAbonnement() {
  const session = await exigerSession();
  const abonnement = await abonnementEcole(session.ecoleId);
  const offre = session.ecole.offre;
  const lectureSeule = session.ecole.lectureSeule;
  const jours = joursCouverts({
    statut: session.ecole.statut,
    dateFinEssai: session.ecole.dateFinEssai,
    abonnement: abonnement
      ? { statut: abonnement.statut, dateFin: abonnement.dateFin }
      : null,
  });
  const aujourdhui = dateDuJour();

  const message = (cible: Offre) =>
    encodeURIComponent(
      `Bonjour SCHOOL PAY, je souhaite régler l'abonnement ${cible} de mon école "${session.ecole.nom}" (${session.email ?? ""}). Je vous envoie la capture du paiement Flooz / TMoney.`,
    );

  return (
    <div className="mx-auto w-full max-w-5xl">
      <Link
        href="/app"
        className="inline-flex items-center gap-1.5 text-[12px] font-medium text-muted transition-colors hover:text-ink"
      >
        <ArrowLeft size={14} aria-hidden />
        Retour au tableau de bord
      </Link>

      <header className="mt-4">
        <p className="text-[10.5px] font-semibold uppercase tracking-[0.16em] text-brand">
          Abonnement mensuel
        </p>
        <h1 className="mt-1 text-[26px] font-semibold leading-tight tracking-[-0.035em] text-ink sm:text-[30px]">
          {lectureSeule ? "Réactivez votre accès" : "Votre abonnement SCHOOL PAY"}
        </h1>
        <p className="mt-1.5 max-w-2xl text-[13px] leading-relaxed text-muted">
          Le paiement est dû au début de chaque mois. Sans règlement le 5 du
          mois, le compte passe en lecture seule : vous continuez à consulter
          vos données, mais plus rien ne peut être modifié. Dès réception du
          paiement, l&apos;accès complet est rétabli immédiatement.
        </p>
      </header>

      {lectureSeule && (
        <div className="mt-5 flex items-start gap-2.5 rounded-sm border border-impaye/30 bg-impaye-soft px-4 py-3 text-[12.5px] text-impaye">
          <LockKeyhole size={16} className="mt-0.5 shrink-0" aria-hidden />
          <div>
            <p className="font-semibold">
              {session.ecole.motifLectureSeule
                ? libelleMotif(session.ecole.motifLectureSeule)
                : "Compte en lecture seule"}
            </p>
            <p className="mt-0.5 leading-relaxed text-impaye/85">
              Vos élèves, paiements, reçus et notes restent conservés. Le
              déblocage est automatique dès que le super admin encaisse votre
              paiement.
            </p>
          </div>
        </div>
      )}

      {/* État de l'abonnement */}
      <section className="mt-5 overflow-hidden rounded-lg border border-line bg-surface">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-line px-4 py-3.5 sm:px-5">
          <div>
            <p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-muted">
              Offre en cours
            </p>
            <p className="mt-0.5 text-[17px] font-semibold text-ink">
              {session.ecole.statut === "ESSAI"
                ? "PREMIUM (essai gratuit)"
                : LIBELLES_OFFRE[offre]}
            </p>
          </div>
          {lectureSeule ? (
            <Badge ton="alerte">Lecture seule</Badge>
          ) : session.ecole.statut === "ESSAI" ? (
            <Badge ton="ochre">Essai en cours</Badge>
          ) : (
            <Badge ton="succes">Actif</Badge>
          )}
        </div>

        <div className="grid grid-cols-2 divide-x divide-line sm:grid-cols-4">
          <div className="px-4 py-3.5">
            <p className="text-[9.5px] font-semibold uppercase tracking-[0.11em] text-muted">
              Échéance
            </p>
            <p className="chiffre mt-1 text-[13px] font-medium text-ink">
              {abonnement
                ? formatDate(abonnement.dateFin)
                : session.ecole.dateFinEssai
                  ? formatDate(session.ecole.dateFinEssai)
                  : "—"}
            </p>
          </div>
          <div className="px-4 py-3.5">
            <p className="text-[9.5px] font-semibold uppercase tracking-[0.11em] text-muted">
              Jours restants
            </p>
            <p
              className={cx(
                "chiffre mt-1 text-[13px] font-medium",
                jours !== null && jours < 0 ? "text-impaye" : "text-ink",
              )}
            >
              {jours === null ? "—" : jours < 0 ? "Dépassé" : `${jours} j`}
            </p>
          </div>
          <div className="px-4 py-3.5">
            <p className="text-[9.5px] font-semibold uppercase tracking-[0.11em] text-muted">
              Dernier paiement
            </p>
            <p className="chiffre mt-1 text-[13px] font-medium text-ink">
              {abonnement?.dernierPaiement
                ? formatDate(abonnement.dernierPaiement)
                : "Aucun"}
            </p>
          </div>
          <div className="px-4 py-3.5">
            <p className="text-[9.5px] font-semibold uppercase tracking-[0.11em] text-muted">
              Montant réglé
            </p>
            <p className="chiffre mt-1 text-[13px] font-medium text-ink">
              {abonnement ? formatFCFA(abonnement.montant) : "—"}
            </p>
          </div>
        </div>

        <p className="border-t border-line bg-surface-2 px-4 py-2.5 text-[11px] leading-relaxed text-muted sm:px-5">
          Option annuelle : {MOIS_PAYES_ANNEE} mois payés ={" "}
          {MOIS_ACCES_ANNEE} mois d&apos;accès (toute l&apos;année scolaire).
          Exemple STANDARD : {formatFCFA(OFFRES.STANDARD.prix)} ×{" "}
          {MOIS_PAYES_ANNEE} = {formatFCFA(OFFRES.STANDARD.prixAnnuel)}.
        </p>
      </section>

      {/* Les offres */}
      <div className="mt-6 grid gap-3 lg:grid-cols-3">
        {ORDRES.map((code) => {
          const info = OFFRES[code];
          const actuelle = offre === code && !lectureSeule;
          return (
            <article
              key={code}
              className={cx(
                "relative flex flex-col overflow-hidden rounded-lg border bg-surface",
                actuelle ? "border-brand" : "border-line",
              )}
            >
              {actuelle && (
                <span className="absolute right-3 top-3">
                  <Badge ton="succes">Offre actuelle</Badge>
                </span>
              )}
              <div className="border-b border-line px-4 py-4">
                <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-muted">
                  {info.nom}
                </p>
                <p className="mt-2 flex items-baseline gap-1">
                  <span className="chiffre text-[24px] font-semibold tracking-tight text-ink">
                    {formatFCFA(info.prix)}
                  </span>
                  <span className="text-[11px] text-muted">/ mois</span>
                </p>
                <p className="mt-1 text-[11.5px] text-muted">
                  ou {formatFCFA(info.prixAnnuel)} / an ·{" "}
                  {MOIS_ACCES_ANNEE} mois d&apos;accès
                </p>
              </div>

              <ul className="flex-1 space-y-1.5 px-4 py-4">
                {info.fonctionnalites.map((element) => (
                  <li
                    key={element}
                    className="flex items-start gap-1.5 text-[11.5px] leading-relaxed text-ink-2"
                  >
                    <Check
                      size={12}
                      className="mt-0.5 shrink-0 text-paye"
                      aria-hidden
                    />
                    {element}
                  </li>
                ))}
              </ul>

              <div className="border-t border-line px-4 py-3">
                <a
                  href={`https://wa.me/${ACTIVATION.numero}?text=${message(code)}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className={cx(
                    "inline-flex h-9 w-full items-center justify-center gap-1.5 rounded-sm text-[12px] font-semibold transition-colors",
                    code === "STANDARD"
                      ? "bg-brand text-white hover:bg-brand-deep"
                      : "border border-line-strong bg-surface text-ink hover:bg-surface-2",
                  )}
                >
                  <MessageCircle size={13} aria-hidden />
                  Payer {info.nom}
                </a>
              </div>
            </article>
          );
        })}
      </div>

      {/* Paiement */}
      <section className="mt-6 rounded-lg border border-brand/15 bg-brand-soft/50 p-4 sm:p-5">
        <div className="flex items-start gap-3">
          <span className="grid size-10 shrink-0 place-items-center rounded-sm bg-brand text-white">
            <Smartphone size={17} aria-hidden />
          </span>
          <div className="min-w-0">
            <h2 className="text-[13.5px] font-semibold text-ink">
              Comment payer ?
            </h2>
            <ol className="mt-2 space-y-1 text-[12.5px] leading-relaxed text-ink-2">
              <li>
                1. Envoyez le montant par <strong>Flooz</strong> ou{" "}
                <strong>TMoney</strong> au{" "}
                <span className="chiffre font-semibold text-ink">
                  {ACTIVATION.numeroAffichage}
                </span>
                .
              </li>
              <li>
                2. Envoyez la capture sur WhatsApp au même numéro ou par email à{" "}
                <a
                  href={`mailto:${ACTIVATION.email}`}
                  className="font-semibold text-brand underline underline-offset-2"
                >
                  {ACTIVATION.email}
                </a>
                .
              </li>
              <li>
                3. Le super admin encaisse et débloque votre compte
                immédiatement, sans suppression de données.
              </li>
            </ol>
            <div className="mt-3 flex flex-wrap gap-2">
              <a
                href={`https://wa.me/${ACTIVATION.numero}?text=${message(offre)}`}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex h-9 items-center gap-1.5 rounded-sm bg-paye px-3 text-[12px] font-semibold text-white transition-opacity hover:opacity-90"
              >
                <MessageCircle size={13} aria-hidden />
                Envoyer la capture
              </a>
              <a
                href={`mailto:${ACTIVATION.email}?subject=${encodeURIComponent(
                  `Abonnement SCHOOL PAY — ${session.ecole.nom}`,
                )}&body=${message(offre)}`}
                className="inline-flex h-9 items-center gap-1.5 rounded-sm border border-line-strong bg-surface px-3 text-[12px] font-semibold text-ink transition-colors hover:bg-surface-2"
              >
                <Mail size={13} aria-hidden />
                Envoyer par email
              </a>
            </div>
          </div>
        </div>
      </section>

      <p className="mt-4 flex items-center gap-1.5 text-[11px] text-muted">
        <ShieldCheck size={12} aria-hidden />
        Aucune donnée n&apos;est jamais supprimée pour un impayé. Dernière
        vérification : {formatDate(aujourdhui)}.
      </p>
    </div>
  );
}
