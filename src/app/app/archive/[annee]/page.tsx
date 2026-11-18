import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import {
  Archive,
  ArrowLeft,
  ClipboardList,
  Download,
  FileText,
  Wallet,
  Users,
  CalendarDays,
} from "lucide-react";
import { exigerSession } from "@/lib/auth";
import { resumeArchive } from "@/lib/data/annees";
import {
  formatDate,
  formatDateHeure,
  formatFCFA,
  formatNombre,
} from "@/lib/format";
import {
  LIBELLES_DECISION,
  LIBELLES_STATUT_ELEVE,
  LIBELLES_STATUT_INSCRIPTION,
} from "@/lib/types";
import { EntetePage } from "@/components/app/entete-page";
import { LienBouton } from "@/components/ui/button";

export const metadata: Metadata = { title: "Archive d'une année" };

function moyenne(valeur: number | null): string {
  if (valeur === null) return "—";
  return valeur.toFixed(2).replace(".", ",");
}

export default async function PageArchiveAnnee({
  params,
}: {
  params: Promise<{ annee: string }>;
}) {
  const session = await exigerSession();
  const { annee } = await params;
  const resume = await resumeArchive(session.ecoleId, decodeURIComponent(annee));
  if (!resume) notFound();

  const { indicateurs } = resume;

  return (
    <>
      <Link
        href="/app/archive"
        className="mb-4 inline-flex items-center gap-1.5 text-[12px] font-semibold text-muted transition-colors hover:text-brand"
      >
        <ArrowLeft size={13} aria-hidden />
        Toutes les années
      </Link>

      <EntetePage
        surtitre="Lecture seule"
        titre={`Année ${resume.annee.libelle}`}
        description={`${formatDate(resume.annee.date_debut)} → ${formatDate(resume.annee.date_fin)}. Toutes les activités de l'année sont conservées : aucun élève ni paiement n'a été supprimé.`}
        actions={
          <LienBouton href="/app/rapports" variante="secondaire">
            <FileText size={14} aria-hidden />
            Rapports
          </LienBouton>
        }
      />

      <div className="mb-5 grid grid-cols-2 divide-x divide-y divide-line overflow-hidden rounded-lg border border-line bg-surface sm:grid-cols-3 lg:grid-cols-6 lg:divide-y-0">
        {[
          { libelle: "Élèves", valeur: String(indicateurs.eleves) },
          { libelle: "Moyenne", valeur: moyenne(indicateurs.moyenne_generale) },
          {
            libelle: "Réussite",
            valeur:
              indicateurs.taux_reussite === null
                ? "—"
                : `${indicateurs.taux_reussite} %`,
          },
          { libelle: "Encaissé", valeur: `${formatNombre(indicateurs.encaisse)} F` },
          { libelle: "Impayé", valeur: `${formatNombre(indicateurs.impaye)} F` },
          { libelle: "Absences", valeur: String(indicateurs.absences) },
        ].map((bloc) => (
          <div key={bloc.libelle} className="px-4 py-3.5">
            <p className="text-[9.5px] font-semibold uppercase tracking-[0.11em] text-muted">
              {bloc.libelle}
            </p>
            <p className="chiffre mt-1 text-[14px] font-medium text-ink">
              {bloc.valeur}
            </p>
          </div>
        ))}
      </div>

      <div className="grid gap-5 lg:grid-cols-2">
        {/* Classes */}
        <section className="card overflow-hidden">
          <div className="flex items-center gap-2 border-b border-line px-4 py-3">
            <CalendarDays size={15} className="text-muted" aria-hidden />
            <h2 className="text-[14px] font-semibold text-ink">Classes</h2>
          </div>
          <div className="overflow-x-auto">
            <table className="tableau min-w-[520px]">
              <thead>
                <tr>
                  <th>Classe</th>
                  <th className="text-right">Élèves</th>
                  <th className="text-right">Moyenne</th>
                  <th className="text-right">Réussite</th>
                  <th className="text-right">Impayé</th>
                </tr>
              </thead>
              <tbody>
                {resume.classes.map((classe) => (
                  <tr key={classe.classe_id}>
                    <td className="text-[12.5px] font-medium text-ink">
                      {classe.classe_nom}
                    </td>
                    <td className="chiffre text-right text-[12px]">
                      {classe.effectif}
                    </td>
                    <td className="chiffre text-right text-[12px]">
                      {moyenne(classe.moyenne)}
                    </td>
                    <td className="chiffre text-right text-[12px]">
                      {classe.taux_reussite === null
                        ? "—"
                        : `${classe.taux_reussite} %`}
                    </td>
                    <td className="chiffre text-right text-[12px]">
                      {formatFCFA(classe.impaye)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>

        {/* Trimestres */}
        <section className="card overflow-hidden">
          <div className="flex items-center gap-2 border-b border-line px-4 py-3">
            <ClipboardList size={15} className="text-muted" aria-hidden />
            <h2 className="text-[14px] font-semibold text-ink">
              Les trois trimestres
            </h2>
          </div>
          <div className="overflow-x-auto">
            <table className="tableau min-w-[420px]">
              <thead>
                <tr>
                  <th>Trimestre</th>
                  <th className="text-right">Moyenne</th>
                  <th className="text-right">Réussite</th>
                  <th className="text-right">Encaissé</th>
                  <th className="text-right">Absences</th>
                </tr>
              </thead>
              <tbody>
                {resume.trimestres.map((trimestre) => (
                  <tr key={trimestre.trimestre}>
                    <td className="text-[12.5px] font-medium text-ink">
                      {["1er trimestre", "2e trimestre", "3e trimestre"][
                        trimestre.trimestre - 1
                      ]}
                    </td>
                    <td className="chiffre text-right text-[12px]">
                      {moyenne(trimestre.moyenne)}
                    </td>
                    <td className="chiffre text-right text-[12px]">
                      {trimestre.taux_reussite === null
                        ? "—"
                        : `${trimestre.taux_reussite} %`}
                    </td>
                    <td className="chiffre text-right text-[12px]">
                      {formatFCFA(trimestre.encaisse)}
                    </td>
                    <td className="chiffre text-right text-[12px]">
                      {trimestre.absences}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      </div>

      {/* Élèves */}
      <section className="card mt-5 overflow-hidden">
        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-line px-4 py-3">
          <div className="flex items-center gap-2">
            <Users size={15} className="text-muted" aria-hidden />
            <h2 className="text-[14px] font-semibold text-ink">Élèves inscrits</h2>
          </div>
          <p className="text-[11px] text-muted">
            {indicateurs.promus} promu(s) · {indicateurs.redoublants} redoublant(s)
            {" · "}
            {indicateurs.diplomes} diplômé(s) · {indicateurs.transferes} transféré(s)
          </p>
        </div>
        <div className="overflow-x-auto">
          <table className="tableau min-w-[760px]">
            <thead>
              <tr>
                <th>Élève</th>
                <th>Classe</th>
                <th>Inscription</th>
                <th>Décision</th>
                <th className="text-right">Moyenne</th>
                <th className="text-right">Bulletin</th>
              </tr>
            </thead>
            <tbody>
              {resume.eleves.map((eleve) => (
                <tr key={eleve.id}>
                  <td>
                    <Link
                      href={`/app/eleves/${eleve.eleve_id}`}
                      className="text-[12.5px] font-medium text-ink hover:text-brand"
                    >
                      {eleve.prenom} {eleve.nom}
                    </Link>
                    <p className="text-[10.5px] text-muted">
                      {LIBELLES_STATUT_ELEVE[eleve.statut_eleve]}
                    </p>
                  </td>
                  <td className="text-[12px] text-ink-2">{eleve.classe_nom}</td>
                  <td className="text-[11.5px] text-muted">
                    {LIBELLES_STATUT_INSCRIPTION[eleve.statut]}
                    {eleve.type_inscription === "ANCIEN" ? " · ancien" : " · nouveau"}
                  </td>
                  <td className="text-[11.5px]">
                    {eleve.decision ? (
                      <span className="text-ink-2">
                        {LIBELLES_DECISION[eleve.decision]}
                      </span>
                    ) : (
                      <span className="text-muted">—</span>
                    )}
                    {eleve.ecole_destination && (
                      <p className="text-[10.5px] text-muted">
                        {eleve.ecole_destination}
                      </p>
                    )}
                  </td>
                  <td className="chiffre text-right text-[12px]">
                    {moyenne(eleve.moyenne_annuelle)}
                  </td>
                  <td className="text-right">
                    <div className="inline-flex items-center gap-1">
                      {eleve.trimestres.length === 0 ? (
                        <span className="text-[11px] text-muted">—</span>
                      ) : (
                        eleve.trimestres.map((trimestre) => (
                          <a
                            key={trimestre}
                            href={`/api/eleves/${eleve.eleve_id}/bulletin?annee=${encodeURIComponent(
                              resume.annee.libelle,
                            )}&trimestre=${trimestre}`}
                            className="inline-flex items-center gap-1 text-[11px] font-semibold text-brand hover:underline"
                          >
                            <Download size={11} aria-hidden />
                            T{trimestre}
                          </a>
                        ))
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <div className="mt-5 grid gap-5 lg:grid-cols-2">
        {/* Paiements */}
        <section className="card overflow-hidden">
          <div className="flex items-center gap-2 border-b border-line px-4 py-3">
            <Wallet size={15} className="text-muted" aria-hidden />
            <h2 className="text-[14px] font-semibold text-ink">
              Paiements récents
            </h2>
            <span className="ml-auto text-[11px] text-muted">
              {formatFCFA(indicateurs.encaisse)} encaissés
            </span>
          </div>
          <div className="max-h-[420px] overflow-auto">
            <table className="tableau min-w-[420px]">
              <thead>
                <tr>
                  <th>Reçu</th>
                  <th>Élève</th>
                  <th className="text-right">Montant</th>
                  <th>Date</th>
                </tr>
              </thead>
              <tbody>
                {resume.paiements.slice(0, 50).map((paiement) => (
                  <tr key={paiement.id}>
                    <td className="chiffre text-[11.5px] text-ink-2">
                      {paiement.numero_recu}
                      {paiement.annule && (
                        <span className="ml-1 text-[10px] font-semibold text-impaye">
                          annulé
                        </span>
                      )}
                    </td>
                    <td className="text-[11.5px]">
                      {paiement.eleve_prenom} {paiement.eleve_nom}
                    </td>
                    <td className="chiffre text-right text-[11.5px]">
                      {formatFCFA(paiement.montant)}
                    </td>
                    <td className="text-[10.5px] text-muted">
                      {formatDateHeure(paiement.date_paiement)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>

        {/* Absences */}
        <section className="card overflow-hidden">
          <div className="flex items-center gap-2 border-b border-line px-4 py-3">
            <CalendarDays size={15} className="text-muted" aria-hidden />
            <h2 className="text-[14px] font-semibold text-ink">Absences</h2>
            <span className="ml-auto text-[11px] text-muted">
              {indicateurs.absences} au total
            </span>
          </div>
          <div className="max-h-[420px] overflow-auto">
            {resume.absences.length === 0 ? (
              <p className="px-4 py-6 text-center text-[12px] text-muted">
                Aucune absence enregistrée pour cette année.
              </p>
            ) : (
              <table className="tableau min-w-[420px]">
                <thead>
                  <tr>
                    <th>Élève</th>
                    <th>Date</th>
                    <th>Motif</th>
                    <th>Statut</th>
                  </tr>
                </thead>
                <tbody>
                  {resume.absences.slice(0, 50).map((absence) => (
                    <tr key={absence.id}>
                      <td className="text-[11.5px]">
                        {absence.prenom} {absence.nom}
                      </td>
                      <td className="text-[10.5px] text-muted">
                        {formatDate(absence.date_absence)}
                      </td>
                      <td className="text-[11px] text-ink-2">
                        {absence.motif ?? "—"}
                      </td>
                      <td className="text-[10.5px]">
                        {absence.justifiee ? (
                          <span className="font-semibold text-paye">Justifiée</span>
                        ) : (
                          <span className="text-muted">Non justifiée</span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </section>
      </div>

      {/* Notes et rapports */}
      <div className="mt-5 grid gap-5 lg:grid-cols-2">
        <section className="card overflow-hidden">
          <div className="flex items-center gap-2 border-b border-line px-4 py-3">
            <ClipboardList size={15} className="text-muted" aria-hidden />
            <h2 className="text-[14px] font-semibold text-ink">Notes saisies</h2>
          </div>
          <div className="overflow-x-auto">
            <table className="tableau min-w-[380px]">
              <thead>
                <tr>
                  <th>Classe</th>
                  <th>Trimestre</th>
                  <th className="text-right">Notes</th>
                  <th className="text-right">Élèves notés</th>
                </tr>
              </thead>
              <tbody>
                {resume.notes.map((ligne) => (
                  <tr
                    key={`${ligne.classe_id}-${ligne.trimestre}`}
                  >
                    <td className="text-[12px] font-medium text-ink">
                      {ligne.classe_nom}
                    </td>
                    <td className="text-[11.5px] text-muted">
                      T{ligne.trimestre}
                    </td>
                    <td className="chiffre text-right text-[12px]">
                      {ligne.nb_notes}
                    </td>
                    <td className="chiffre text-right text-[12px]">
                      {ligne.nb_eleves}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>

        <section className="card overflow-hidden">
          <div className="flex items-center gap-2 border-b border-line px-4 py-3">
            <FileText size={15} className="text-muted" aria-hidden />
            <h2 className="text-[14px] font-semibold text-ink">Rapports</h2>
          </div>
          {resume.rapports.length === 0 ? (
            <p className="px-4 py-6 text-center text-[12px] text-muted">
              Aucun rapport généré pour cette année.{" "}
              <Link href="/app/rapports" className="font-semibold text-brand hover:underline">
                Générer le rapport annuel
              </Link>
            </p>
          ) : (
            <table className="tableau min-w-[340px]">
              <thead>
                <tr>
                  <th>Rapport</th>
                  <th>Statut</th>
                  <th className="text-right">PDF</th>
                </tr>
              </thead>
              <tbody>
                {resume.rapports.map((rapport) => (
                  <tr key={rapport.id}>
                    <td className="text-[12px] font-medium text-ink">
                      {rapport.type === "ANNUEL"
                        ? "Annuel"
                        : `Trimestre ${rapport.trimestre}`}
                    </td>
                    <td className="text-[11px] text-muted">{rapport.statut}</td>
                    <td className="text-right">
                      {rapport.statut === "PRET" ? (
                        <a
                          href={`/api/rapports/${rapport.id}`}
                          className="inline-flex items-center gap-1 text-[11px] font-semibold text-brand hover:underline"
                        >
                          <Download size={11} aria-hidden />
                          Télécharger
                        </a>
                      ) : (
                        <span className="text-[11px] text-muted">—</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </section>
      </div>
    </>
  );
}
