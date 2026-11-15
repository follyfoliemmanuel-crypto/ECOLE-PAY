import type { Metadata } from "next";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import {
  Award,
  ChevronLeft,
  Download,
  FileText,
  Printer,
  ReceiptText,
  ShieldCheck,
  Wallet,
} from "lucide-react";
import { anneeScolaire, libelleAnnee } from "@/lib/mois";
import { peut } from "@/lib/offres";
import { formatDate, formatFCFA, initiales } from "@/lib/format";
import {
  ecolePublique,
  ficheBulletin,
  getElevePublique,
  situationPaiements,
  trimestresNotes,
} from "@/lib/data/portail";
import {
  TRIMESTRES_PORTAIL,
  libelleRang,
  libelleTrimestre,
  lienBulletinPdf,
} from "@/lib/portail";
import { estUuid } from "@/lib/actions/helpers";
import { cx } from "@/lib/cx";
import type { Trimestre } from "@/lib/types";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string; id: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const ecole = await ecolePublique(slug);
  return {
    title: ecole ? `Notes de l'élève · ${ecole.nom}` : "Notes de l'élève",
    robots: { index: false, follow: false },
  };
}

function lireTrimestre(
  valeur: string | undefined,
  disponibles: Trimestre[],
): Trimestre {
  const nombre = Number.parseInt(valeur ?? "", 10);
  if (nombre === 1 || nombre === 2 || nombre === 3) {
    if (disponibles.length === 0 || disponibles.includes(nombre)) return nombre;
  }
  return disponibles[disponibles.length - 1] ?? 1;
}

function note(valeur: number | null): string {
  if (valeur === null) return "—";
  return valeur.toFixed(2).replace(".", ",");
}

export default async function PageElevePortail({
  params,
  searchParams,
}: {
  params: Promise<{ slug: string; id: string }>;
  searchParams: Promise<{ trimestre?: string }>;
}) {
  const { slug, id } = await params;
  if (!estUuid(id)) notFound();

  const ecole = await ecolePublique(slug);
  if (!ecole) notFound();
  if (!peut({ offre: ecole.offre, statut: ecole.statut }, "portail_parent")) {
    redirect(
      `/premium?ecole=${encodeURIComponent(slug)}&depuis=${encodeURIComponent("le portail parent")}`,
    );
  }

  const annee = anneeScolaire();
  const eleve = await getElevePublique(ecole.id, id, annee);
  if (!eleve) notFound();

  const [disponibles, paiements] = await Promise.all([
    trimestresNotes(ecole.id, eleve.id, annee),
    situationPaiements(ecole.id, eleve.id, annee),
  ]);

  const trimestre = lireTrimestre((await searchParams).trimestre, disponibles);
  const fiche = await ficheBulletin(
    ecole.id,
    annee,
    eleve.classe_id,
    eleve.id,
    trimestre,
  );

  const aDesNotes = (fiche?.matieres_notees ?? 0) > 0;
  const lienPdf = lienBulletinPdf(slug, eleve.id, trimestre);
  const nomComplet = `${eleve.prenom} ${eleve.nom}`;

  return (
    <div className="min-h-screen bg-canvas">
      <header className="border-b border-white/10 bg-brand-deep text-white">
        <div className="mx-auto max-w-4xl px-4 py-4 sm:px-6 sm:py-5">
          <Link
            href={`/parent/${slug}?classe=${eleve.classe_id}`}
            className="inline-flex items-center gap-1 text-[11.5px] font-semibold text-white/65 transition-colors hover:text-white"
          >
            <ChevronLeft size={14} aria-hidden />
            Retour à la recherche
          </Link>
          <div className="mt-3 flex items-center gap-3">
            {ecole.logo_url ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={ecole.logo_url}
                alt={`Logo ${ecole.nom}`}
                className="size-10 shrink-0 rounded-sm border border-white/20 bg-white object-contain p-0.5"
              />
            ) : (
              <span className="grid size-10 shrink-0 place-items-center rounded-sm border border-white/20 bg-white/10 text-[12px] font-semibold text-[#ffce00]">
                {ecole.nom
                  .split(/\s+/)
                  .filter(Boolean)
                  .slice(0, 2)
                  .map((mot) => mot.charAt(0))
                  .join("")
                  .toUpperCase()}
              </span>
            )}
            <div className="min-w-0">
              <p className="truncate text-[15px] font-semibold leading-tight">
                {ecole.nom}
              </p>
              <p className="mt-0.5 text-[10px] text-white/50">
                Relevé de notes · Année {libelleAnnee(annee)}
              </p>
            </div>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-4xl px-4 py-5 sm:px-6 sm:py-7">
        {/* ---------------- Identité ---------------- */}
        <section className="card overflow-hidden">
          <div className="flex flex-col gap-4 px-5 py-5 sm:flex-row sm:items-center sm:justify-between sm:px-6">
            <div className="flex min-w-0 items-center gap-4">
              {eleve.photo_url ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={eleve.photo_url}
                  alt={`Photo de ${nomComplet}`}
                  className="size-14 shrink-0 rounded-md border border-line object-cover sm:size-16"
                />
              ) : (
                <span className="grid size-14 shrink-0 place-items-center rounded-md bg-brand text-[17px] font-semibold text-white sm:size-16">
                  {initiales(eleve.nom, eleve.prenom)}
                </span>
              )}
              <div className="min-w-0">
                <h1 className="text-[22px] font-semibold leading-tight tracking-[-0.035em] text-ink sm:text-[26px]">
                  {nomComplet}
                </h1>
                <p className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-0.5 text-[12px] text-muted">
                  <span className="font-medium text-ink-2">
                    {eleve.classe_nom}
                  </span>
                  <span aria-hidden>·</span>
                  <span>{libelleAnnee(annee)}</span>
                </p>
              </div>
            </div>

            {aDesNotes ? (
              <a
                href={lienPdf}
                download
                className="inline-flex h-10 shrink-0 items-center justify-center gap-2 rounded-sm bg-brand px-4 text-[13px] font-semibold text-white transition-colors hover:bg-brand-deep"
              >
                <Download size={15} aria-hidden />
                Télécharger le bulletin
              </a>
            ) : (
              <span className="inline-flex h-10 shrink-0 cursor-not-allowed items-center justify-center gap-2 rounded-sm border border-line-strong bg-surface-2 px-4 text-[13px] font-semibold text-muted">
                <Download size={15} aria-hidden />
                Bulletin indisponible
              </span>
            )}
          </div>

          <div className="grid grid-cols-3 divide-x divide-line border-t border-line bg-surface-2">
            <div className="px-4 py-3.5">
              <p className="text-[9px] font-semibold uppercase tracking-[0.1em] text-muted">
                Moyenne
              </p>
              <p className="chiffre mt-1 text-[18px] font-semibold text-brand">
                {note(fiche?.eleve.moyenne ?? null)}
                <span className="ml-1 text-[10px] font-normal text-muted">
                  / 20
                </span>
              </p>
            </div>
            <div className="px-4 py-3.5">
              <p className="text-[9px] font-semibold uppercase tracking-[0.1em] text-muted">
                Rang
              </p>
              <p className="mt-1 text-[13px] font-semibold text-ink sm:text-[14px]">
                {fiche?.eleve.rang != null
                  ? libelleRang(fiche.eleve.rang, fiche.effectif)
                  : "Non classé"}
              </p>
            </div>
            <div className="px-4 py-3.5">
              <p className="text-[9px] font-semibold uppercase tracking-[0.1em] text-muted">
                Mention
              </p>
              <p className="mt-1 text-[13px] font-semibold text-ink sm:text-[14px]">
                {fiche?.eleve.mention ?? "Non évalué"}
              </p>
            </div>
          </div>
        </section>

        {/* ---------------- Trimestres ---------------- */}
        {disponibles.length > 0 && (
          <div className="mt-5 flex flex-wrap items-center gap-1.5">
            <span className="mr-1 text-[10.5px] font-semibold uppercase tracking-[0.1em] text-muted">
              Trimestre
            </span>
            {TRIMESTRES_PORTAIL.map((option) => {
              const active = option.valeur === trimestre;
              const disponible = disponibles.includes(option.valeur);
              return disponible ? (
                <Link
                  key={option.valeur}
                  href={`/parent/${slug}/eleve/${eleve.id}?trimestre=${option.valeur}`}
                  className={cx(
                    "inline-flex h-8 items-center rounded-sm border px-3 text-[11.5px] font-semibold transition-colors",
                    active
                      ? "border-brand bg-brand text-white"
                      : "border-line-strong bg-surface text-ink-2 hover:bg-surface-2",
                  )}
                >
                  {option.libelle}
                </Link>
              ) : (
                <span
                  key={option.valeur}
                  className="inline-flex h-8 items-center rounded-sm border border-line bg-surface-2 px-3 text-[11.5px] text-muted"
                >
                  {option.libelle}
                </span>
              );
            })}
          </div>
        )}

        {/* ---------------- Notes ---------------- */}
        <section className="card mt-3 overflow-hidden">
          <div className="flex flex-wrap items-center justify-between gap-2 border-b border-line px-5 py-4 sm:px-6">
            <div>
              <h2 className="flex items-center gap-2 text-[15px] font-semibold text-ink">
                <FileText size={16} className="text-brand" aria-hidden />
                Notes de devoirs et compositions
              </h2>
              <p className="mt-0.5 text-[11.5px] text-muted">
                {libelleTrimestre(trimestre)} · {libelleAnnee(annee)} ·{" "}
                {fiche?.matieres_notees ?? 0} matière
                {(fiche?.matieres_notees ?? 0) > 1 ? "s" : ""} notée
                {(fiche?.matieres_notees ?? 0) > 1 ? "s" : ""}
              </p>
            </div>
            <span className="inline-flex items-center gap-1.5 rounded-full border border-line bg-surface-2 px-2.5 py-0.5 text-[10px] font-medium text-muted">
              <ShieldCheck size={11} aria-hidden />
              Lecture seule
            </span>
          </div>

          {!aDesNotes ? (
            <div className="px-5 py-10 text-center sm:px-8">
              <ReceiptText size={22} className="mx-auto text-muted" aria-hidden />
              <p className="mt-3 text-[14px] font-semibold text-ink">
                Aucune note publiée pour ce trimestre
              </p>
              <p className="mx-auto mt-1 max-w-md text-[12px] leading-relaxed text-muted">
                Les notes apparaîtront ici dès que l&apos;école aura publié le
                bulletin. Contactez l&apos;établissement si vous pensez
                qu&apos;il s&apos;agit d&apos;une erreur.
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[660px] border-collapse text-[12px]">
                <thead>
                  <tr className="border-b border-line bg-surface-2 text-left text-[9px] uppercase tracking-[0.08em] text-muted">
                    <th className="px-5 py-2.5 font-semibold sm:px-6">Matière</th>
                    <th className="px-2 py-2.5 text-center font-semibold">
                      Coef.
                    </th>
                    <th className="px-2 py-2.5 text-center font-semibold" title="Devoir 1">
                      D1
                    </th>
                    <th className="px-2 py-2.5 text-center font-semibold" title="Devoir 2">
                      D2
                    </th>
                    <th className="px-2 py-2.5 text-center font-semibold" title="Composition">
                      Compo.
                    </th>
                    <th className="px-2 py-2.5 text-center font-semibold">
                      Note / 20
                    </th>
                    <th className="hidden px-2 py-2.5 text-center font-semibold sm:table-cell">
                      Points
                    </th>
                    <th className="px-5 py-2.5 text-left font-semibold sm:px-6">
                      Appréciation
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {fiche!.eleve.lignes.map((ligne) => (
                    <tr
                      key={ligne.matiere_id}
                      className="border-b border-line/70 last:border-0"
                    >
                      <td className="px-5 py-2.5 font-medium text-ink sm:px-6">
                        {ligne.nom}
                      </td>
                      <td className="chiffre px-2 py-2.5 text-center text-ink-2">
                        {ligne.coefficient}
                      </td>
                      <td className="chiffre px-2 py-2.5 text-center text-ink-2">
                        {note(ligne.devoir1)}
                      </td>
                      <td className="chiffre px-2 py-2.5 text-center text-ink-2">
                        {note(ligne.devoir2)}
                      </td>
                      <td className="chiffre px-2 py-2.5 text-center text-ink-2">
                        {note(ligne.composition)}
                      </td>
                      <td
                        className={cx(
                          "chiffre px-2 py-2.5 text-center text-[13px] font-semibold",
                          ligne.note === null
                            ? "text-muted"
                            : ligne.note >= 10
                              ? "text-paye"
                              : "text-impaye",
                        )}
                      >
                        {note(ligne.note)}
                      </td>
                      <td className="chiffre hidden px-2 py-2.5 text-center text-ink-2 sm:table-cell">
                        {note(ligne.points)}
                      </td>
                      <td className="px-5 py-2.5 text-muted sm:px-6">
                        {ligne.appreciation?.trim() || "—"}
                      </td>
                    </tr>
                  ))}
                </tbody>
                <tfoot>
                  <tr className="bg-surface-2 text-[11.5px] font-semibold text-ink">
                    <td className="px-5 py-3 sm:px-6">Total</td>
                    <td className="chiffre px-2 py-3 text-center">
                      {fiche!.eleve.total_coefficients}
                    </td>
                    <td className="px-2 py-3 text-center text-muted">—</td>
                    <td className="px-2 py-3 text-center text-muted">—</td>
                    <td className="px-2 py-3 text-center text-muted">—</td>
                    <td className="px-2 py-3 text-center text-muted">—</td>
                    <td className="chiffre hidden px-2 py-3 text-center sm:table-cell">
                      {note(fiche!.eleve.total_points)}
                    </td>
                    <td className="px-5 py-3 text-muted sm:px-6">
                      Moyenne pondérée
                    </td>
                  </tr>
                </tfoot>
              </table>
            </div>
          )}
        </section>

        {/* ---------------- Paiements ---------------- */}
        <section className="card mt-5 overflow-hidden">
          <div className="flex flex-wrap items-center justify-between gap-2 border-b border-line px-5 py-4 sm:px-6">
            <div>
              <h2 className="flex items-center gap-2 text-[15px] font-semibold text-ink">
                <Wallet size={16} className="text-brand" aria-hidden />
                État des paiements
              </h2>
              <p className="mt-0.5 text-[11.5px] text-muted">
                Scolarité {libelleAnnee(annee)} · montants communiqués par
                l&apos;école
              </p>
            </div>
            <span className="text-[10.5px] text-muted">Lecture seule</span>
          </div>

          <div className="grid grid-cols-3 divide-x divide-line border-b border-line">
            <div className="px-4 py-4 sm:px-5">
              <p className="text-[9px] font-semibold uppercase tracking-[0.1em] text-muted">
                Déjà payé
              </p>
              <p className="chiffre mt-1 text-[16px] font-semibold text-paye sm:text-[18px]">
                {formatFCFA(paiements.total_paye)}
              </p>
            </div>
            <div className="px-4 py-4 sm:px-5">
              <p className="text-[9px] font-semibold uppercase tracking-[0.1em] text-muted">
                Reste à payer
              </p>
              <p
                className={cx(
                  "chiffre mt-1 text-[16px] font-semibold sm:text-[18px]",
                  paiements.total_reste > 0 ? "text-impaye" : "text-paye",
                )}
              >
                {formatFCFA(paiements.total_reste)}
              </p>
            </div>
            <div className="px-4 py-4 sm:px-5">
              <p className="text-[9px] font-semibold uppercase tracking-[0.1em] text-muted">
                Total scolarité
              </p>
              <p className="chiffre mt-1 text-[16px] font-semibold text-ink sm:text-[18px]">
                {formatFCFA(paiements.total_du)}
              </p>
            </div>
          </div>

          <div className="px-5 py-4 sm:px-6">
            {paiements.prochaine ? (
              <div className="flex flex-wrap items-center justify-between gap-3 rounded-md border border-ochre/30 bg-[#fbf6ea] px-4 py-3">
                <div>
                  <p className="flex items-center gap-1.5 text-[9.5px] font-semibold uppercase tracking-[0.1em] text-[#7a5010]">
                    <Award size={12} aria-hidden />
                    Prochaine tranche à payer
                  </p>
                  <p className="mt-1 text-[13.5px] font-semibold text-ink">
                    {paiements.prochaine.libelle?.trim() || "Scolarité"}
                    {paiements.prochaine.date_limite
                      ? ` · avant le ${formatDate(paiements.prochaine.date_limite)}`
                      : ""}
                  </p>
                </div>
                <p className="chiffre text-[17px] font-semibold text-[#7a5010]">
                  {formatFCFA(paiements.prochaine.reste)}
                </p>
              </div>
            ) : (
              <div className="rounded-md border border-paye/25 bg-paye-soft px-4 py-3 text-[12.5px] font-medium text-paye">
                Scolarité entièrement réglée. Merci.
              </div>
            )}

            {paiements.echeances.length > 0 && (
              <details className="mt-3">
                <summary className="cursor-pointer text-[11.5px] font-semibold text-brand hover:underline">
                  Voir le détail des échéances
                </summary>
                <ul className="mt-2 divide-y divide-line overflow-hidden rounded-sm border border-line">
                  {paiements.echeances.map((echeance) => (
                    <li
                      key={echeance.id}
                      className="flex items-center justify-between gap-3 bg-surface px-3.5 py-2.5"
                    >
                      <span className="min-w-0">
                        <span className="block truncate text-[12px] font-medium text-ink">
                          {echeance.libelle?.trim() || `Période ${echeance.periode}`}
                        </span>
                        <span className="mt-0.5 block text-[10.5px] text-muted">
                          Payé {formatFCFA(echeance.montant_paye)} sur{" "}
                          {formatFCFA(echeance.montant_du)}
                        </span>
                      </span>
                      <span
                        className={cx(
                          "chiffre shrink-0 text-[12px] font-semibold",
                          echeance.reste > 0 ? "text-impaye" : "text-paye",
                        )}
                      >
                        {echeance.reste > 0
                          ? `${formatFCFA(echeance.reste)} restant`
                          : "Soldé"}
                      </span>
                    </li>
                  ))}
                </ul>
              </details>
            )}
          </div>
        </section>

        <div className="mt-5 flex flex-wrap items-center justify-between gap-2 text-[10.5px] text-muted">
          <p className="inline-flex items-center gap-1.5">
            <ShieldCheck size={12} aria-hidden />
            {nomComplet} · {eleve.classe_nom}
          </p>
          {aDesNotes && (
            <a
              href={lienPdf}
              download
              className="inline-flex items-center gap-1 font-semibold text-brand hover:underline"
            >
              <Printer size={12} aria-hidden />
              Imprimer / télécharger le bulletin PDF
            </a>
          )}
        </div>
      </main>

      <footer className="mx-auto max-w-4xl px-4 pb-8 pt-2 text-center text-[10.5px] leading-relaxed text-muted sm:px-6">
        <p>
          Bulletin officiel de {ecole.nom} · ECOLE PAY
        </p>
        <p className="mt-1 text-muted/70">
          Seules les notes de cet élève sont affichées. Aucun classement complet
          n&apos;est communiqué.
        </p>
      </footer>
    </div>
  );
}
