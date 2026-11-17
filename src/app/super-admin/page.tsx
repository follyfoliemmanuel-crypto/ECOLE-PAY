import type { Metadata } from "next";
import {
  AlertTriangle,
  Building2,
  CalendarClock,
  ShieldAlert,
  ShieldCheck,
  UserX,
  Users,
} from "lucide-react";
import { exigerSuperAdmin } from "@/lib/auth";
import { dateDuJour } from "@/lib/activation";
import { anneeScolaire, libelleAnnee } from "@/lib/mois";
import {
  listerEcolesSuperAdmin,
  listerJournal,
  listerTentativesRefusees,
} from "@/lib/data/super-admin";
import { formatDate, formatDateHeure, formatNombre } from "@/lib/format";
import {
  LIBELLES_OFFRE,
  LIBELLES_STATUT_ECOLE,
  type StatutEcole,
} from "@/lib/types";
import { OFFRES } from "@/lib/offres";
import { Badge } from "@/components/ui/badge";
import { EntetePage } from "@/components/app/entete-page";
import { BoutonsEcole } from "@/components/super-admin/boutons-ecole";
import { BoutonForcerEssai } from "@/components/super-admin/bouton-forcer-essai";

export const metadata: Metadata = { title: "Super admin" };

function BadgeStatutEcole({
  statut,
  expiree,
}: {
  statut: StatutEcole;
  expiree: boolean;
}) {
  if (statut === "ACTIF") {
    return <Badge ton="succes">Active</Badge>;
  }
  if (statut === "ESSAI") {
    return (
      <Badge ton="ochre">
        Essai{expiree ? " expiré" : ""}
      </Badge>
    );
  }
  return (
    <span className="inline-flex items-center gap-1.5 rounded-full border border-impaye/20 bg-impaye-soft px-2 py-0.5 text-[11px] font-semibold leading-5 text-impaye">
      <span className="size-1.5 rounded-full bg-impaye" aria-hidden />
      Bloquée
    </span>
  );
}

function CarteIndicateur({
  titre,
  valeur,
  detail,
  icone,
  accent,
}: {
  titre: string;
  valeur: string;
  detail: string;
  icone: React.ReactNode;
  accent?: string;
}) {
  return (
    <div className="card p-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-[10.5px] font-semibold uppercase tracking-[0.12em] text-muted">
            {titre}
          </p>
          <p className="chiffre mt-1.5 text-[24px] font-semibold leading-none text-ink">
            {valeur}
          </p>
          <p className="mt-1.5 text-[11.5px] text-muted">{detail}</p>
        </div>
        <span
          className={`grid size-8 shrink-0 place-items-center rounded-sm border ${accent ?? "border-line bg-surface-2 text-muted"}`}
        >
          {icone}
        </span>
      </div>
    </div>
  );
}

export default async function PageSuperAdmin() {
  await exigerSuperAdmin();

  const annee = anneeScolaire();
  const ecoles = await listerEcolesSuperAdmin(annee);
  const refus = await listerTentativesRefusees();
  const journal = await listerJournal();
  const aujourdhui = dateDuJour();

  const actives = ecoles.filter((ecole) => ecole.statut === "ACTIF").length;
  const essais = ecoles.filter((ecole) => ecole.statut === "ESSAI").length;
  const bloquees = ecoles.filter((ecole) => ecole.statut === "BLOQUE").length;
  const eleves = ecoles.reduce((total, ecole) => total + ecole.nb_eleves, 0);
  const refusEnAttente = refus.filter((tentative) => !tentative.traite).length;

  return (
    <div>
      <EntetePage
        surtitre={`${libelleAnnee(annee)} · Administration`}
        titre="Écoles SCHOOL PAY"
        description="Activez une offre, prolongez ou bloquez l'accès d'une école. Seul ce compte super admin peut modifier l'offre : les directeurs ne peuvent pas s'activer eux-mêmes."
      />

      <div className="mb-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <CarteIndicateur
          titre="Écoles"
          valeur={formatNombre(ecoles.length)}
          detail={`${formatNombre(eleves)} élèves actifs`}
          icone={<Building2 size={15} aria-hidden />}
          accent="border-brand/15 bg-brand-soft text-brand"
        />
        <CarteIndicateur
          titre="Actives"
          valeur={formatNombre(actives)}
          detail="Abonnement en cours"
          icone={<ShieldCheck size={15} aria-hidden />}
          accent="border-paye/20 bg-paye-soft text-paye"
        />
        <CarteIndicateur
          titre="En essai"
          valeur={formatNombre(essais)}
          detail="30 jours offerts"
          icone={<CalendarClock size={15} aria-hidden />}
          accent="border-ochre/25 bg-[#fbf1de] text-[#8a5a10]"
        />
        <CarteIndicateur
          titre="Bloquées"
          valeur={formatNombre(bloquees)}
          detail="Accès coupé"
          icone={<AlertTriangle size={15} aria-hidden />}
          accent="border-impaye/20 bg-impaye-soft text-impaye"
        />
      </div>

      <section className="card overflow-hidden">
        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-line px-4 py-3.5 sm:px-5">
          <div>
            <h2 className="text-[14px] font-semibold text-ink">
              Toutes les écoles
            </h2>
            <p className="mt-0.5 text-[11.5px] text-muted">
              {formatNombre(ecoles.length)} école
              {ecoles.length > 1 ? "s" : ""} · statut, échéance et activation
            </p>
          </div>
          <span className="inline-flex items-center gap-1.5 text-[11px] text-muted">
            <Users size={13} aria-hidden />
            {formatNombre(eleves)} élèves inscrits
          </span>
        </div>

        {ecoles.length === 0 ? (
          <p className="px-5 py-10 text-center text-[13px] text-muted">
            Aucune école inscrite pour l&apos;instant.
          </p>
        ) : (
          <div className="overflow-x-auto">
            <table className="tableau min-w-[880px]">
              <thead>
                <tr>
                  <th>École</th>
                  <th className="text-center">Effectif</th>
                  <th>Offre</th>
                  <th>Statut</th>
                  <th>Fin</th>
                  <th>Activation</th>
                </tr>
              </thead>
              <tbody>
                {ecoles.map((ecole) => {
                  const fin =
                    ecole.statut === "ACTIF"
                      ? ecole.date_fin_abonnement
                      : ecole.date_fin_essai;
                  const expiree = fin !== null && fin < aujourdhui;

                  return (
                    <tr key={ecole.id}>
                      <td>
                        <span className="block text-[12.5px] font-semibold text-ink">
                          {ecole.nom}
                        </span>
                        <span className="mt-0.5 block text-[11px] text-muted">
                          {ecole.telephone ?? "Téléphone non renseigné"}
                        </span>
                        <span className="block text-[11px] text-muted">
                          {ecole.email}
                        </span>
                      </td>
                      <td className="text-center">
                        <span className="chiffre block text-[12.5px] font-semibold text-ink">
                          {formatNombre(ecole.nb_eleves)}
                        </span>
                        <span className="text-[10.5px] text-muted">
                          {formatNombre(ecole.nb_classes)} classe
                          {ecole.nb_classes > 1 ? "s" : ""}
                        </span>
                      </td>
                      <td className="text-[11.5px] text-ink-2">
                        <span className="block font-semibold text-ink">
                          {ecole.statut === "ESSAI"
                            ? "PREMIUM (essai)"
                            : LIBELLES_OFFRE[ecole.offre]}
                        </span>
                        <span className="chiffre block text-[10.5px] text-muted">
                          {ecole.statut === "ESSAI"
                            ? "Toutes fonctions offertes"
                            : `${OFFRES[ecole.offre].prix.toLocaleString("fr-FR").replace(/\u202f/g, " ")} F / mois`}
                        </span>
                      </td>
                      <td>
                        <BadgeStatutEcole
                          statut={ecole.statut}
                          expiree={expiree}
                        />
                        <span className="mt-1 block text-[10px] text-muted">
                          {LIBELLES_STATUT_ECOLE[ecole.statut]}
                        </span>
                      </td>
                      <td>
                        {fin ? (
                          <span
                            className={`chiffre text-[11.5px] ${
                              expiree
                                ? "font-semibold text-impaye"
                                : "text-ink-2"
                            }`}
                          >
                            {formatDate(fin)}
                          </span>
                        ) : (
                          <span className="text-[11.5px] text-muted">—</span>
                        )}
                        <span className="mt-0.5 block text-[10px] text-muted">
                          {ecole.statut === "ACTIF"
                            ? "Abonnement"
                            : "Essai"}
                        </span>
                      </td>
                      <td>
                        <BoutonsEcole
                          ecoleId={ecole.id}
                          nom={ecole.nom}
                          statut={ecole.statut}
                          offre={ecole.offre}
                        />
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <section className="card mt-6 overflow-hidden">
        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-line px-4 py-3.5 sm:px-5">
          <div>
            <h2 className="flex items-center gap-2 text-[14px] font-semibold text-ink">
              <ShieldAlert size={15} className="text-impaye" aria-hidden />
              Tentatives d&apos;inscription refusées
            </h2>
            <p className="mt-0.5 text-[11.5px] text-muted">
              Anti-triche des essais · un seul essai gratuit par nom d&apos;école,
              téléphone ou WhatsApp
            </p>
          </div>
          <span
            className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-[11px] font-semibold ${
              refusEnAttente > 0
                ? "border-impaye/20 bg-impaye-soft text-impaye"
                : "border-line bg-surface-2 text-muted"
            }`}
          >
            <UserX size={12} aria-hidden />
            {refusEnAttente > 0
              ? `${formatNombre(refusEnAttente)} à traiter`
              : "Aucune en attente"}
          </span>
        </div>

        {refus.length === 0 ? (
          <p className="px-5 py-10 text-center text-[13px] text-muted">
            Aucune tentative refusée pour l&apos;instant. Les inscriptions
            bloquées par l&apos;anti-triche apparaîtront ici.
          </p>
        ) : (
          <div className="overflow-x-auto">
            <table className="tableau min-w-[900px]">
              <thead>
                <tr>
                  <th>École demandée</th>
                  <th>Contact utilisé</th>
                  <th>Email utilisé</th>
                  <th>Date</th>
                  <th>Action</th>
                </tr>
              </thead>
              <tbody>
                {refus.map((tentative) => (
                  <tr key={tentative.id}>
                    <td>
                      <span className="block text-[12.5px] font-semibold text-ink">
                        {tentative.nom_ecole}
                      </span>
                      <span className="mt-0.5 block max-w-[260px] text-[10.5px] leading-relaxed text-muted">
                        {tentative.motif ?? "Essai déjà consommé."}
                      </span>
                    </td>
                    <td>
                      <span className="chiffre block text-[11.5px] text-ink-2">
                        {tentative.telephone ?? "Téléphone non renseigné"}
                      </span>
                      <span className="chiffre block text-[10.5px] text-muted">
                        WhatsApp : {tentative.whatsapp ?? "—"}
                      </span>
                    </td>
                    <td>
                      <span className="block text-[11.5px] text-ink-2">
                        {tentative.email}
                      </span>
                      <span className="block text-[10px] text-muted">
                        IP {tentative.ip ?? "inconnue"}
                      </span>
                    </td>
                    <td>
                      <span className="chiffre block text-[11.5px] text-ink-2">
                        {formatDateHeure(tentative.date_creation)}
                      </span>
                      <span className="block text-[10px] text-muted">
                        {tentative.traite ? "Traité" : "En attente"}
                      </span>
                    </td>
                    <td>
                      <BoutonForcerEssai
                        auditId={tentative.id}
                        nom={tentative.nom_ecole}
                        traite={tentative.traite}
                      />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <section className="card mt-6 overflow-hidden">
        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-line px-4 py-3.5 sm:px-5">
          <div>
            <h2 className="flex items-center gap-2 text-[14px] font-semibold text-ink">
              <ShieldCheck size={15} className="text-brand" aria-hidden />
              Journal d&apos;audit
            </h2>
            <p className="mt-0.5 text-[11.5px] text-muted">
              Actions sensibles : offres, blocages, comptes, paiements annulés,
              élèves supprimés, sécurité du compte super admin
            </p>
          </div>
          <span className="text-[11px] text-muted">
            {formatNombre(journal.length)} dernière
            {journal.length > 1 ? "s" : ""} action{journal.length > 1 ? "s" : ""}
          </span>
        </div>

        {journal.length === 0 ? (
          <p className="px-5 py-10 text-center text-[13px] text-muted">
            Aucune action sensible enregistrée pour l&apos;instant.
          </p>
        ) : (
          <div className="overflow-x-auto">
            <table className="tableau min-w-[860px]">
              <thead>
                <tr>
                  <th>Action</th>
                  <th>Détail</th>
                  <th>Auteur</th>
                  <th>Date</th>
                </tr>
              </thead>
              <tbody>
                {journal.map((entree) => (
                  <tr key={entree.id}>
                    <td>
                      <span className="block font-mono text-[10.5px] font-semibold uppercase tracking-wide text-brand">
                        {entree.action}
                      </span>
                      {entree.cible && (
                        <span className="mt-0.5 block max-w-[220px] truncate text-[11px] text-muted">
                          {entree.cible}
                        </span>
                      )}
                    </td>
                    <td>
                      <span className="block max-w-[380px] text-[11.5px] leading-relaxed text-ink-2">
                        {entree.libelle}
                      </span>
                    </td>
                    <td>
                      <span className="block max-w-[200px] truncate text-[11px] text-ink-2">
                        {entree.auteur}
                      </span>
                      <span className="block text-[10px] text-muted">
                        IP {entree.ip ?? "inconnue"}
                      </span>
                    </td>
                    <td>
                      <span className="chiffre text-[11.5px] text-ink-2">
                        {formatDateHeure(entree.date_creation)}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <p className="mt-4 text-[11.5px] leading-relaxed text-muted">
        Règles appliquées : une école en essai est bloquée dès que sa date de fin
        est dépassée. Les boutons ACTIVER 1 MOIS ajoutent 30 jours, ACTIVER 3 MOIS
        ajoutent 90 jours, et l&apos;offre choisie remplace immédiatement
        l&apos;ancienne. BLOQUER coupe l&apos;accès au tableau de bord, aux élèves
        et aux paiements sans supprimer aucune donnée. Une activation débloque
        aussi une école bloquée. La bascule 1 CLIC change seulement le niveau de
        fonctions, sans toucher à la date de fin : le retour à STARTER ou PRO
        verrouille immédiatement les comptes profs, le portail parent et
        l&apos;envoi WhatsApp, côté serveur et sans reconnexion. Élèves,
        paiements, notes et reçus sont toujours conservés.
      </p>
      <p className="mt-2 text-[11.5px] leading-relaxed text-muted">
        Anti-triche : chaque essai consommé est enregistré avec le nom
        d&apos;école normalisé, le téléphone, le WhatsApp, l&apos;IP et
        l&apos;appareil. Une nouvelle inscription avec l&apos;un de ces éléments
        est refusée et journalisée ci-dessus. « FORCER UN NOUVEL ESSAI »
        neutralise l&apos;ancien essai sans supprimer l&apos;historique : le
        directeur concerné peut alors se réinscrire normalement. Cette page et
        ces actions sont réservées à l&apos;email super admin.
      </p>
    </div>
  );
}
