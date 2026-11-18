import type { Metadata } from "next";
import Link from "next/link";
import {
  ChevronRight,
  MessageCircle,
  Plus,
  SearchX,
  UploadCloud,
  Users,
  Wallet,
} from "lucide-react";
import { exigerSession } from "@/lib/auth";
import { peut } from "@/lib/offres";
import { libelleAnnee } from "@/lib/mois";
import { anneeActive } from "@/lib/data/annees";
import {
  frequenceDepuisParametre,
  libellePeriode,
  periodeDepuisParametre,
  suffixePeriode,
} from "@/lib/periodes";
import { listerClasses, nombreTranchesMax } from "@/lib/data/classes";
import { listerEleves } from "@/lib/data/eleves";
import { formatF, formatTelephone, initiales } from "@/lib/format";
import { BadgeStatut } from "@/components/ui/badge";
import { LienBouton } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { FiltreEleves } from "@/components/ui/filtre-eleves";
import { PeriodeSelect } from "@/components/ui/periode-select";
import { Pagination } from "@/components/ui/pagination";
import { EntetePage } from "@/components/app/entete-page";
import { ExportElevesCSV } from "@/components/eleves/export-eleves-csv";
import { estUuid } from "@/lib/actions/helpers";

export const metadata: Metadata = { title: "Élèves" };

const PAR_PAGE = 20;

export default async function PageEleves({
  searchParams,
}: {
  searchParams: Promise<{
    q?: string;
    classe?: string;
    frequence?: string;
    periode?: string;
    page?: string;
  }>;
}) {
  const session = await exigerSession();
  const parametres = await searchParams;
  const peutExporter = peut(session.ecole, "exports");

  const annee = await anneeActive(session.ecoleId);
  const frequence = frequenceDepuisParametre(parametres.frequence);
  const periode = periodeDepuisParametre(parametres.periode, frequence);
  const recherche = (parametres.q ?? "").trim();
  const classeId =
    parametres.classe && estUuid(parametres.classe) ? parametres.classe : "toutes";
  const page = Math.max(1, Number.parseInt(parametres.page ?? "1", 10) || 1);

  const [classes, resultat, nbTranches] = await Promise.all([
    listerClasses(session.ecoleId, annee),
    listerEleves({
      ecoleId: session.ecoleId,
      annee,
      frequence,
      periode,
      recherche,
      classeId,
      page,
      parPage: PAR_PAGE,
    }),
    nombreTranchesMax(session.ecoleId),
  ]);

  const filtresActifs = recherche !== "" || classeId !== "toutes";
  const nomPeriode = libellePeriode(frequence, periode, annee, false, nbTranches);
  const queryBase = `frequence=${frequence}&periode=${periode}`;

  return (
    <div>
      <EntetePage
        surtitre={`${libelleAnnee(annee)} · ${nomPeriode}`}
        titre="Élèves"
        description={
          resultat.total === 0 && !filtresActifs
            ? "Ajoutez les élèves de votre école pour suivre la scolarité et les frais d'inscription."
            : `${resultat.total} élève${resultat.total > 1 ? "s" : ""} ${filtresActifs ? "correspondent au filtre" : "inscrits"}.`
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
              <ExportElevesCSV
                eleves={resultat.eleves.map((e) => ({
                  nom: e.nom,
                  prenom: e.prenom,
                  sexe: e.sexe,
                  classe: e.classe_nom,
                  type_inscription: e.type_inscription,
                  parent: e.nom_parent,
                  telephone: formatTelephone(e.telephone_parent),
                  montant_du: e.montant_du,
                  montant_paye: e.montant_paye,
                  reste: e.reste,
                  statut: e.statut_periode ?? "—",
                  inscription_du: e.inscription_du,
                  inscription_paye: e.inscription_paye,
                  inscription_reste: e.inscription_reste,
                  inscription_statut: e.inscription_statut ?? "—",
                }))}
                periode={nomPeriode}
              />
            )}
            <LienBouton href="/app/eleves/importer" variante="secondaire" taille="md">
              <UploadCloud size={15} aria-hidden />
              Importer
            </LienBouton>
            <LienBouton href="/app/eleves/nouveau" taille="md">
              <Plus size={15} strokeWidth={2.4} aria-hidden />
              Ajouter
            </LienBouton>
          </>
        }
      />

      <div className="card mb-4 p-3 sm:p-4">
        <FiltreEleves
          recherche={recherche}
          classeId={classeId}
          classes={classes}
          frequence={frequence}
          periode={periode}
        />
        {filtresActifs && (
          <p className="mt-2.5 flex items-center gap-2 text-[11.5px] text-muted">
            Filtre actif
            <Link
              href={`/app/eleves?${queryBase}`}
              className="font-semibold text-brand underline underline-offset-2"
            >
              Tout afficher
            </Link>
          </p>
        )}
      </div>

      <div className="card overflow-hidden">
        {resultat.eleves.length === 0 ? (
          filtresActifs ? (
            <EmptyState
              icone={<SearchX size={18} />}
              titre="Aucun élève ne correspond"
              description="Essayez un autre nom, une autre classe, ou effacez les filtres pour retrouver toute la liste."
              action={
                <LienBouton href={`/app/eleves?${queryBase}`} variante="secondaire">
                  Effacer les filtres
                </LienBouton>
              }
            />
          ) : (
            <EmptyState
              icone={<Users size={18} />}
              titre="Votre liste d'élèves est vide"
              description="Créez une classe avec son tarif et sa fréquence, puis ajoutez vos élèves. Les échéances et les frais d'inscription seront créés automatiquement."
              action={
                <div className="flex flex-wrap justify-center gap-2">
                  <LienBouton href="/app/classes" variante="secondaire">
                    Créer une classe
                  </LienBouton>
                  <LienBouton href="/app/eleves/nouveau">Ajouter un élève</LienBouton>
                </div>
              }
            />
          )
        ) : (
          <>
            {/* Desktop */}
            <div className="hidden lg:block">
              <table className="tableau">
                <thead>
                  <tr>
                    <th>Élève</th>
                    <th>Classe</th>
                    <th>Parent / tuteur</th>
                    <th>WhatsApp</th>
                    <th>{nomPeriode}</th>
                    <th>Inscription</th>
                    <th className="text-right">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {resultat.eleves.map((eleve) => (
                    <tr key={eleve.id}>
                      <td>
                        <Link
                          href={`/app/eleves/${eleve.id}`}
                          className="flex items-center gap-3 group"
                        >
                          <span className="grid size-8 shrink-0 place-items-center rounded-full border border-line bg-surface-2 text-[10px] font-semibold text-ink-2">
                            {initiales(eleve.nom, eleve.prenom)}
                          </span>
                          <span>
                            <span className="block font-medium text-ink group-hover:text-brand group-hover:underline">
                              {eleve.prenom} {eleve.nom}
                            </span>
                            <span className="block text-[11px] text-muted">
                              {eleve.sexe === "F" ? "Fille" : "Garçon"} ·{" "}
                              {eleve.type_inscription === "ANCIEN"
                                ? "Ancien"
                                : "Nouveau"}
                            </span>
                          </span>
                        </Link>
                      </td>
                      <td>
                        <span className="text-[13px] text-ink-2">{eleve.classe_nom}</span>
                        <p className="text-[11px] text-muted">
                          {eleve.frequence_paiement === "TRANCHES"
                            ? "Par tranches"
                            : `${formatF(eleve.montant_periode)}${suffixePeriode(
                                eleve.frequence_paiement,
                              )}`}
                        </p>
                      </td>
                      <td>
                        <span className="text-[13px] text-ink-2">{eleve.nom_parent}</span>
                      </td>
                      <td>
                        <a
                          href={`https://wa.me/228${eleve.telephone_parent}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center gap-1.5 text-[12.5px] text-ink-2 hover:text-paye"
                        >
                          <MessageCircle size={13} aria-hidden />
                          {formatTelephone(eleve.telephone_parent)}
                        </a>
                      </td>
                      <td>
                        {eleve.statut_periode ? (
                          <div className="flex flex-col items-start gap-1">
                            <BadgeStatut statut={eleve.statut_periode} />
                            {eleve.reste !== null && eleve.reste > 0 && (
                              <span className="chiffre text-[11px] text-muted">
                                reste {formatF(eleve.reste)}
                              </span>
                            )}
                          </div>
                        ) : (
                          <span
                            className="text-[12px] text-muted"
                            title="La fréquence de paiement de cette classe diffère de la période affichée."
                          >
                            —
                          </span>
                        )}
                      </td>
                      <td>
                        {eleve.inscription_statut ? (
                          <div className="flex flex-col items-start gap-1">
                            <BadgeStatut statut={eleve.inscription_statut} />
                            {eleve.inscription_reste !== null &&
                              eleve.inscription_reste > 0 && (
                                <span className="chiffre text-[11px] text-muted">
                                  reste {formatF(eleve.inscription_reste)}
                                </span>
                              )}
                          </div>
                        ) : (
                          <span className="text-[12px] text-muted">—</span>
                        )}
                      </td>
                      <td className="text-right">
                        <div className="inline-flex items-center gap-1.5">
                          <Link
                            href={`/app/paiements/nouveau?eleve=${eleve.id}`}
                            className="inline-flex h-8 items-center gap-1.5 rounded-sm border border-line-strong px-2.5 text-[11.5px] font-semibold text-ink hover:bg-surface-2"
                            title="Encaisser un paiement"
                          >
                            <Wallet size={13} aria-hidden />
                            Encaisser
                          </Link>
                          <Link
                            href={`/app/eleves/${eleve.id}`}
                            className="grid size-8 place-items-center rounded-sm text-muted hover:bg-surface-2 hover:text-ink"
                            aria-label={`Fiche de ${eleve.prenom} ${eleve.nom}`}
                          >
                            <ChevronRight size={16} aria-hidden />
                          </Link>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Mobile */}
            <ul className="divide-y divide-line lg:hidden">
              {resultat.eleves.map((eleve) => (
                <li key={eleve.id} className="p-4">
                  <div className="flex items-start justify-between gap-3">
                    <Link
                      href={`/app/eleves/${eleve.id}`}
                      className="flex min-w-0 items-center gap-3"
                    >
                      <span className="grid size-9 shrink-0 place-items-center rounded-full border border-line bg-surface-2 text-[10px] font-semibold text-ink-2">
                        {initiales(eleve.nom, eleve.prenom)}
                      </span>
                      <span className="min-w-0">
                        <span className="block truncate text-[13.5px] font-semibold text-ink">
                          {eleve.prenom} {eleve.nom}
                        </span>
                        <span className="block truncate text-[11.5px] text-muted">
                          {eleve.classe_nom} · {formatTelephone(eleve.telephone_parent)}
                        </span>
                      </span>
                    </Link>
                    <div className="flex flex-col items-end gap-1">
                      {eleve.statut_periode && (
                        <BadgeStatut statut={eleve.statut_periode} />
                      )}
                      {eleve.inscription_statut && (
                        <span className="text-[9.5px] uppercase tracking-[0.08em] text-muted">
                          {eleve.inscription_type === "REINSCRIPTION"
                            ? "Réinscription"
                            : "Inscription"}
                        </span>
                      )}
                    </div>
                  </div>

                  <div className="mt-3 flex items-center justify-between gap-3">
                    <div className="min-w-0">
                      <p className="truncate text-[11.5px] text-muted">
                        {eleve.nom_parent}
                      </p>
                      {eleve.reste !== null && eleve.reste > 0 && (
                        <p className="chiffre mt-0.5 text-[12px] font-medium text-impaye">
                          Reste {formatF(eleve.reste)}
                        </p>
                      )}
                      {eleve.inscription_reste !== null &&
                        eleve.inscription_reste > 0 && (
                          <p className="chiffre mt-0.5 text-[11.5px] text-partiel">
                            Inscription : {formatF(eleve.inscription_reste)}
                          </p>
                        )}
                    </div>
                    <div className="flex shrink-0 items-center gap-1.5">
                      <Link
                        href={`/app/paiements/nouveau?eleve=${eleve.id}`}
                        className="inline-flex h-8 items-center gap-1.5 rounded-sm bg-brand px-2.5 text-[11.5px] font-semibold text-white"
                      >
                        <Wallet size={13} aria-hidden />
                        Encaisser
                      </Link>
                      <Link
                        href={`/app/eleves/${eleve.id}`}
                        className="grid size-8 place-items-center rounded-sm border border-line text-muted"
                        aria-label={`Fiche de ${eleve.prenom} ${eleve.nom}`}
                      >
                        <ChevronRight size={16} aria-hidden />
                      </Link>
                    </div>
                  </div>
                </li>
              ))}
            </ul>

            <Pagination
              page={page}
              total={resultat.total}
              parPage={PAR_PAGE}
              basePath="/app/eleves"
              parametres={{
                q: recherche || undefined,
                classe: classeId !== "toutes" ? classeId : undefined,
                frequence,
                periode: String(periode),
              }}
            />
          </>
        )}
      </div>
    </div>
  );
}
