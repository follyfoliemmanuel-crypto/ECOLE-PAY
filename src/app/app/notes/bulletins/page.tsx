import type { Metadata } from "next";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { ArrowLeft, FileText, LockKeyhole, MessageCircle } from "lucide-react";
import { exigerSession } from "@/lib/auth";
import { peut } from "@/lib/offres";
import { libelleAnnee } from "@/lib/mois";
import { anneeActive } from "@/lib/data/annees";
import { listerClasses } from "@/lib/data/classes";
import { donneesBulletin } from "@/lib/data/notes";
import { estUuid } from "@/lib/actions/helpers";
import { EntetePage } from "@/components/app/entete-page";
import { BoutonImprimer } from "@/components/notes/bouton-imprimer";
import {
  PublicationBulletins,
  type EnvoiAffiche,
} from "@/components/portail/publication-bulletins";
import { EmptyState } from "@/components/ui/empty-state";
import { LienBouton } from "@/components/ui/button";
import { BoutonPremium } from "@/components/offres/verrou-premium";
import { envoisBulletins } from "@/lib/data/portail";
import type { Trimestre } from "@/lib/types";
import { cx } from "@/lib/cx";

export const metadata: Metadata = { title: "Bulletins" };

const TRIMESTRES: { valeur: Trimestre; libelle: string }[] = [
  { valeur: 1, libelle: "1er trimestre" },
  { valeur: 2, libelle: "2e trimestre" },
  { valeur: 3, libelle: "3e trimestre" },
];

function lireTrimestre(valeur: string | undefined): Trimestre {
  const nombre = Number.parseInt(valeur ?? "", 10);
  return nombre === 2 || nombre === 3 ? nombre : 1;
}

function note(valeur: number | null): string {
  if (valeur === null) return "—";
  return valeur.toFixed(2).replace(".", ",");
}

export default async function PageBulletins({
  searchParams,
}: {
  searchParams: Promise<{ classe?: string; trimestre?: string }>;
}) {
  const session = await exigerSession();
  if (!peut(session.ecole, "notes_bulletins")) redirect("/app/notes");

  const parametres = await searchParams;
  const trimestre = lireTrimestre(parametres.trimestre);

  if (!parametres.classe || !estUuid(parametres.classe)) {
    redirect(`/app/notes?trimestre=${trimestre}`);
  }

  const annee = await anneeActive(session.ecoleId);
  const [classes, bulletin] = await Promise.all([
    listerClasses(session.ecoleId, annee),
    donneesBulletin(session.ecoleId, annee, parametres.classe, trimestre),
  ]);
  if (!bulletin) notFound();

  const aDesNotes = bulletin.eleves.some((eleve) =>
    eleve.lignes.some((ligne) => ligne.note !== null),
  );

  const peutPortail = peut(session.ecole, "portail_parent");
  const envoiAutomatique = peut(session.ecole, "envoi_bulletins_whatsapp");

  const envois: EnvoiAffiche[] = [];
  if (peutPortail) {
    const journal = await envoisBulletins(session.ecoleId, annee, trimestre);
    for (const ligne of journal) {
      const eleve = bulletin.eleves.find((element) => element.id === ligne.eleve_id);
      if (!eleve) continue;
      envois.push({
        eleve_id: ligne.eleve_id,
        eleve_nom: eleve.nom,
        eleve_prenom: eleve.prenom,
        statut: ligne.statut,
        url_whatsapp: ligne.url_whatsapp,
        erreur: ligne.erreur,
        envoye_le: ligne.envoye_le,
      });
    }
  }

  return (
    <div>
      <EntetePage
        surtitre={`${libelleAnnee(annee)} · ${TRIMESTRES.find((t) => t.valeur === trimestre)?.libelle}`}
        titre={`Bulletins · ${bulletin.classe.nom}`}
        description={`${bulletin.eleves.length} bulletin${bulletin.eleves.length > 1 ? "s" : ""} prêt${bulletin.eleves.length > 1 ? "s" : ""} à imprimer. Moyenne de classe : ${note(bulletin.moyenne_classe)}/20.`}
        actions={
          <>
            <form
              method="get"
              action="/app/notes/bulletins"
              className="sans-impression flex items-center gap-1.5"
            >
              <input type="hidden" name="trimestre" value={trimestre} />
              <label className="sr-only" htmlFor="choix-classe-bulletin">
                Choisir une classe
              </label>
              <select
                id="choix-classe-bulletin"
                name="classe"
                defaultValue={bulletin.classe.id}
                className="h-8 rounded-sm border border-line-strong bg-surface px-2 text-[12px] text-ink"
              >
                {classes.map((element) => (
                  <option key={element.id} value={element.id}>
                    {element.nom}
                  </option>
                ))}
              </select>
              <button
                type="submit"
                className="inline-flex h-8 items-center rounded-sm border border-line-strong bg-surface px-2.5 text-[11.5px] font-semibold text-ink hover:bg-surface-2"
              >
                Ouvrir
              </button>
            </form>
            <LienBouton
              href={`/app/notes/saisie?classe=${bulletin.classe.id}&trimestre=${trimestre}`}
              variante="secondaire"
              taille="sm"
              className="sans-impression"
            >
              <ArrowLeft size={14} aria-hidden />
              Saisir les notes
            </LienBouton>
            <BoutonImprimer
              libelle="Imprimer les bulletins"
              className="sans-impression inline-flex h-8 items-center justify-center gap-1.5 rounded-sm bg-brand px-3 text-[11.5px] font-semibold text-white transition-colors hover:bg-brand-deep"
            />
          </>
        }
      />

      <div className="sans-impression mb-4 flex flex-wrap items-center gap-1.5">
        {TRIMESTRES.map((option) => (
          <Link
            key={option.valeur}
            href={`/app/notes/bulletins?classe=${bulletin.classe.id}&trimestre=${option.valeur}`}
            className={cx(
              "inline-flex h-7 items-center rounded-sm border px-2 text-[11px] font-semibold transition-colors",
              trimestre === option.valeur
                ? "border-brand bg-brand text-white"
                : "border-line-strong bg-surface text-ink-2 hover:bg-surface-2",
            )}
          >
            {option.libelle}
          </Link>
        ))}
      </div>

      {aDesNotes &&
        (peutPortail ? (
          <PublicationBulletins
            classeId={bulletin.classe.id}
            classeNom={bulletin.classe.nom}
            trimestre={trimestre}
            annee={annee}
            nombreEleves={bulletin.eleves.length}
            envoiAutomatique={envoiAutomatique}
            envois={envois}
          />
        ) : (
          <section className="sans-impression card mb-4 flex flex-wrap items-center justify-between gap-3 px-4 py-3.5 sm:px-5">
            <div className="min-w-0">
              <p className="flex items-center gap-2 text-[13px] font-semibold text-ink">
                <LockKeyhole size={14} className="text-ochre" aria-hidden />
                Portail parent et envoi WhatsApp
              </p>
              <p className="mt-1 max-w-2xl text-[11.5px] leading-relaxed text-muted">
                La publication sur le portail parent et l&apos;envoi
                automatique du bulletin PDF sur WhatsApp sont réservés à
                l&apos;offre PREMIUM 40.000F. Les bulletins restent imprimables
                ci-dessous.
              </p>
            </div>
            <BoutonPremium
              taille="sm"
              contexte="le portail parent et l'envoi WhatsApp"
            >
              <MessageCircle size={13} aria-hidden />
              ENVOYER SUR WHATSAPP
            </BoutonPremium>
          </section>
        ))}

      {!aDesNotes ? (
        <div className="card">
          <EmptyState
            icone={<FileText size={18} />}
            titre="Aucune note pour ce trimestre"
            description="Saisissez au moins une note pour générer les bulletins. Les matières sans note restent affichées avec un tiret."
            action={
              <LienBouton
                href={`/app/notes/saisie?classe=${bulletin.classe.id}&trimestre=${trimestre}`}
              >
                Saisir les notes
              </LienBouton>
            }
          />
        </div>
      ) : (
        <div className="zone-impression zone-bulletins space-y-5">
          {bulletin.eleves.map((eleve) => (
            <article
              key={eleve.id}
              className="bulletin-feuille overflow-hidden rounded-lg border border-line bg-surface"
            >
              <header className="flex items-start justify-between gap-4 bg-brand-deep px-5 py-4 text-white">
                <div className="min-w-0">
                  <p className="text-[9px] font-semibold uppercase tracking-[0.18em] text-[#ffce00]">
                    Établissement
                  </p>
                  <p className="mt-1 text-[16px] font-semibold leading-tight">
                    {bulletin.ecole.nom}
                  </p>
                  {(bulletin.ecole.adresse || bulletin.ecole.telephone) && (
                    <p className="mt-0.5 text-[10px] text-white/55">
                      {[bulletin.ecole.adresse, bulletin.ecole.telephone]
                        .filter(Boolean)
                        .join(" · ")}
                    </p>
                  )}
                </div>
                <div className="shrink-0 text-right">
                  <p className="text-[9px] font-semibold uppercase tracking-[0.14em] text-white/45">
                    Bulletin de notes
                  </p>
                  <p className="mt-1 text-[12px] font-semibold">
                    {TRIMESTRES.find((t) => t.valeur === trimestre)?.libelle}
                  </p>
                  <p className="mt-0.5 text-[9.5px] text-white/50">
                    Année {libelleAnnee(bulletin.annee)}
                  </p>
                </div>
              </header>

              <div className="px-5 py-4">
                <div className="grid gap-3 border-b border-line pb-3 text-[12px] sm:grid-cols-4">
                  <div className="sm:col-span-2">
                    <p className="text-[9px] uppercase tracking-[0.1em] text-muted">
                      Élève
                    </p>
                    <p className="mt-0.5 text-[14px] font-semibold text-ink">
                      {eleve.prenom} {eleve.nom}
                    </p>
                  </div>
                  <div>
                    <p className="text-[9px] uppercase tracking-[0.1em] text-muted">
                      Classe
                    </p>
                    <p className="mt-0.5 font-medium text-ink">
                      {bulletin.classe.nom}
                    </p>
                  </div>
                  <div>
                    <p className="text-[9px] uppercase tracking-[0.1em] text-muted">
                      Effectif
                    </p>
                    <p className="mt-0.5 font-medium text-ink">
                      {bulletin.eleves.length} élève
                      {bulletin.eleves.length > 1 ? "s" : ""}
                    </p>
                  </div>
                </div>

                <table className="mt-3 w-full border-collapse text-[11.5px]">
                  <thead>
                    <tr className="border-b border-line text-left text-[9px] uppercase tracking-[0.08em] text-muted">
                      <th className="py-1.5 pr-2 font-semibold">Matière</th>
                      <th className="px-2 py-1.5 text-center font-semibold">
                        Coef.
                      </th>
                      <th className="px-2 py-1.5 text-center font-semibold">
                        Note / 20
                      </th>
                      <th className="px-2 py-1.5 text-center font-semibold">
                        Points
                      </th>
                      <th className="py-1.5 pl-2 text-left font-semibold">
                        Appréciation
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {eleve.lignes.map((ligne) => (
                      <tr key={ligne.matiere_id} className="border-b border-line/70">
                        <td className="py-1.5 pr-2 font-medium text-ink">
                          {ligne.nom}
                        </td>
                        <td className="chiffre px-2 py-1.5 text-center text-ink-2">
                          {ligne.coefficient}
                        </td>
                        <td
                          className={cx(
                            "chiffre px-2 py-1.5 text-center font-semibold",
                            ligne.note === null
                              ? "text-muted"
                              : ligne.note >= 10
                                ? "text-paye"
                                : "text-impaye",
                          )}
                        >
                          {note(ligne.note)}
                        </td>
                        <td className="chiffre px-2 py-1.5 text-center text-ink-2">
                          {note(ligne.points)}
                        </td>
                        <td className="py-1.5 pl-2 text-muted">
                          {ligne.appreciation?.trim() || "—"}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                  <tfoot>
                    <tr className="text-[11px] font-semibold text-ink">
                      <td className="py-2 pr-2">Total</td>
                      <td className="chiffre px-2 py-2 text-center">
                        {eleve.total_coefficients}
                      </td>
                      <td className="px-2 py-2 text-center text-muted">—</td>
                      <td className="chiffre px-2 py-2 text-center">
                        {note(eleve.total_points)}
                      </td>
                      <td />
                    </tr>
                  </tfoot>
                </table>

                <div className="mt-4 grid gap-2 sm:grid-cols-4">
                  <div className="rounded-sm border border-brand/25 bg-brand-soft px-3 py-2.5">
                    <p className="text-[9px] font-semibold uppercase tracking-[0.1em] text-brand/70">
                      Moyenne
                    </p>
                    <p className="chiffre mt-0.5 text-[18px] font-semibold text-brand">
                      {note(eleve.moyenne)}
                      <span className="ml-1 text-[10px] font-normal">/ 20</span>
                    </p>
                  </div>
                  <div className="rounded-sm border border-line bg-surface-2 px-3 py-2.5">
                    <p className="text-[9px] font-semibold uppercase tracking-[0.1em] text-muted">
                      Rang
                    </p>
                    <p className="chiffre mt-0.5 text-[18px] font-semibold text-ink">
                      {eleve.rang === null ? "—" : `${eleve.rang}`}
                      {eleve.rang !== null && (
                        <span className="ml-1 text-[10px] font-normal text-muted">
                          / {bulletin.eleves.filter((e) => e.rang !== null).length}
                        </span>
                      )}
                    </p>
                  </div>
                  <div className="rounded-sm border border-line bg-surface-2 px-3 py-2.5">
                    <p className="text-[9px] font-semibold uppercase tracking-[0.1em] text-muted">
                      Mention
                    </p>
                    <p className="mt-0.5 text-[13px] font-semibold text-ink">
                      {eleve.mention}
                    </p>
                  </div>
                  <div className="rounded-sm border border-line bg-surface-2 px-3 py-2.5">
                    <p className="text-[9px] font-semibold uppercase tracking-[0.1em] text-muted">
                      Moyenne de classe
                    </p>
                    <p className="chiffre mt-0.5 text-[13px] font-semibold text-ink-2">
                      {note(bulletin.moyenne_classe)}
                    </p>
                  </div>
                </div>

                <div className="mt-4 flex flex-wrap items-end justify-between gap-4 border-t border-dashed border-line-strong pt-3 text-[10px] text-muted">
                  <p>
                    Meilleure moyenne :{" "}
                    <span className="font-semibold text-ink-2">
                      {note(bulletin.meilleure_moyenne)}
                    </span>
                  </p>
                  <div className="flex gap-10">
                    <div className="text-center">
                      <p className="mb-6">Le Directeur</p>
                      <p className="border-t border-line-strong pt-1">
                        Signature
                      </p>
                    </div>
                    <div className="text-center">
                      <p className="mb-6">Le Parent</p>
                      <p className="border-t border-line-strong pt-1">
                        Signature
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            </article>
          ))}
        </div>
      )}
    </div>
  );
}
