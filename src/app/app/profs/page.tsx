import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { Banknote, GraduationCap, Users, Wallet } from "lucide-react";
import { exigerSession, estDirecteur } from "@/lib/auth";
import { peut } from "@/lib/offres";
import { formatDate, formatF, formatNombre, formatTelephone, pourcentage } from "@/lib/format";
import {
  listerProfs,
  situationSalaires,
  versementsRecents,
} from "@/lib/data/profs";
import { libelleMoisPaie, MOIS_PAIE } from "@/lib/paie";
import { EntetePage } from "@/components/app/entete-page";
import {
  BoutonBasculerProf,
  BoutonSupprimerProf,
  HistoriqueVersements,
  ModifierProf,
  NouveauProf,
  PreparerSalaires,
  VerserSalaire,
} from "@/components/profs/gestion-profs";
import {
  NouveauCompteProf,
  ReinitialiserAccesProf,
} from "@/components/profs/comptes-profs";
import { EmptyState } from "@/components/ui/empty-state";
import { cx } from "@/lib/cx";

export const metadata: Metadata = { title: "Profs & salaires" };

function lireMois(valeur: string | undefined): number {
  const nombre = Number.parseInt(valeur ?? "", 10);
  return Number.isFinite(nombre) && nombre >= 1 && nombre <= 12
    ? nombre
    : new Date().getMonth() + 1;
}

function lireAnnee(valeur: string | undefined): number {
  const nombre = Number.parseInt(valeur ?? "", 10);
  return Number.isFinite(nombre) && nombre >= 2000 && nombre <= 2100
    ? nombre
    : new Date().getFullYear();
}

export default async function PageProfs({
  searchParams,
}: {
  searchParams: Promise<{ mois?: string; annee?: string }>;
}) {
  const session = await exigerSession();

  // Accès direct par URL en STARTER/STANDARD : redirection vers la page de paiement.
  if (!peut(session.ecole, "comptes_profs")) {
    redirect(
      `/premium?depuis=${encodeURIComponent("les comptes professeurs")}`,
    );
  }

  const parametres = await searchParams;
  const mois = lireMois(parametres.mois);
  const annee = lireAnnee(parametres.annee);
  const directeur = estDirecteur(session);

  const [profs, situation, versements] = await Promise.all([
    listerProfs(session.ecoleId),
    situationSalaires(session.ecoleId, annee, mois),
    versementsRecents(session.ecoleId, 12),
  ]);

  const actifs = profs.filter((prof) => prof.actif);
  const comptesActifs = profs.filter(
    (prof) => prof.actif && prof.compte_actif,
  ).length;
  const masseSalariale = actifs.reduce(
    (somme, prof) => somme + prof.salaire_mensuel,
    0,
  );
  const totalDu = situation.reduce((somme, ligne) => somme + ligne.montant_du, 0);
  const totalPaye = situation.reduce(
    (somme, ligne) => somme + ligne.montant_paye,
    0,
  );
  const totalReste = situation.reduce((somme, ligne) => somme + ligne.reste, 0);
  const taux = pourcentage(totalPaye, totalDu);

  return (
    <div>
      <EntetePage
        surtitre={`Paie · ${libelleMoisPaie(mois)} ${annee}`}
        titre="Profs & salaires"
        description="Fiche de chaque professeur, salaire mensuel, acomptes et suivi des versements. Le module conserve tout l'historique, même si un professeur quitte l'école."
        actions={
          <>
            <form method="get" action="/app/profs" className="flex items-center gap-1.5">
              <label className="sr-only" htmlFor="mois-paie">
                Mois
              </label>
              <select
                id="mois-paie"
                name="mois"
                defaultValue={mois}
                className="h-8 rounded-sm border border-line-strong bg-surface px-2 text-[12px] text-ink"
              >
                {MOIS_PAIE.map((element) => (
                  <option key={element.valeur} value={element.valeur}>
                    {element.libelle}
                  </option>
                ))}
              </select>
              <label className="sr-only" htmlFor="annee-paie">
                Année
              </label>
              <input
                id="annee-paie"
                name="annee"
                type="number"
                min={2000}
                max={2100}
                defaultValue={annee}
                className="h-8 w-[82px] rounded-sm border border-line-strong bg-surface px-2 text-[12px] text-ink"
              />
              <button
                type="submit"
                className="inline-flex h-8 items-center rounded-sm border border-line-strong bg-surface px-2.5 text-[11.5px] font-semibold text-ink hover:bg-surface-2"
              >
                Afficher
              </button>
            </form>
            {directeur && <PreparerSalaires annee={annee} mois={mois} />}
          </>
        }
      />

      <div className="mb-5 grid grid-cols-2 divide-x divide-line overflow-hidden rounded-lg border border-line bg-surface sm:grid-cols-4">
        {[
          {
            libelle: "Professeurs",
            valeur: `${actifs.length}`,
            detail: `${comptesActifs} compte${comptesActifs > 1 ? "s" : ""} de connexion actif${comptesActifs > 1 ? "s" : ""}`,
            icone: Users,
          },
          {
            libelle: "Masse salariale",
            valeur: `${formatNombre(masseSalariale)} F`,
            detail: "professeurs actifs / mois",
            icone: Banknote,
          },
          {
            libelle: `Payé · ${libelleMoisPaie(mois)}`,
            valeur: `${formatNombre(totalPaye)} F`,
            detail: `${taux} % du dû`,
            icone: Wallet,
            accent: "text-paye",
          },
          {
            libelle: "Reste à verser",
            valeur: `${formatNombre(totalReste)} F`,
            detail: totalReste > 0 ? "à régler ce mois" : "tout est soldé",
            icone: GraduationCap,
            accent: totalReste > 0 ? "text-impaye" : "text-paye",
          },
        ].map((bloc) => {
          const Icone = bloc.icone;
          return (
            <div key={bloc.libelle} className="px-4 py-3.5">
              <p className="flex items-center gap-1.5 text-[9.5px] font-semibold uppercase tracking-[0.11em] text-muted">
                <Icone size={11} aria-hidden />
                {bloc.libelle}
              </p>
              <p
                className={cx(
                  "chiffre mt-1 text-[15px] font-medium",
                  bloc.accent ?? "text-ink",
                )}
              >
                {bloc.valeur}
              </p>
              <p className="mt-0.5 text-[10.5px] text-muted">{bloc.detail}</p>
            </div>
          );
        })}
      </div>

      {directeur && (
        <section className="card mb-5 p-4 sm:p-5">
          <div className="mb-3 flex flex-wrap items-start justify-between gap-2">
            <div>
              <h2 className="text-[14px] font-semibold text-ink">
                Créer un compte professeur
              </h2>
              <p className="mt-0.5 max-w-2xl text-[11.5px] leading-relaxed text-muted">
                Quatre informations suffisent : nom complet, téléphone,
                identifiant et mot de passe. Aucune classe ni matière à
                attribuer : le professeur choisit lui-même dans son espace. Il
                ne voit jamais les paiements ni les paramètres de l&apos;école.
              </p>
            </div>
            <span className="rounded-full border border-brand/20 bg-brand-soft px-2.5 py-1 text-[10.5px] font-semibold text-brand">
              Saisie des notes
            </span>
          </div>
          <NouveauCompteProf />
        </section>
      )}

      {directeur ? (
        <section className="card mb-5 p-4 sm:p-5">
          <div className="mb-3">
            <h2 className="text-[14px] font-semibold text-ink">
              Ajouter une fiche détaillée (sans compte)
            </h2>
            <p className="mt-0.5 text-[11.5px] text-muted">
              Pour la paie et les informations administratives. Le salaire
              mensuel sera repris automatiquement quand vous préparerez la paie
              du mois. Vous pourrez créer l&apos;accès ensuite depuis la fiche.
            </p>
          </div>
          <NouveauProf />
        </section>
      ) : (
        <div className="mb-5 rounded-sm border border-line bg-surface-2 px-4 py-3 text-[12px] text-muted">
          Seul le directeur peut modifier les fiches et préparer les salaires.
          Vous pouvez consulter la paie et enregistrer un versement si vous êtes
          comptable.
        </div>
      )}

      <section className="mb-5">
        <div className="mb-2.5 flex flex-wrap items-end justify-between gap-2">
          <div>
            <h2 className="text-[15px] font-semibold text-ink">Corps enseignant</h2>
            <p className="mt-0.5 text-[11.5px] text-muted">
              {profs.length} fiche{profs.length > 1 ? "s" : ""} ·{" "}
              {actifs.length} active{actifs.length > 1 ? "s" : ""}
            </p>
          </div>
        </div>

        {profs.length === 0 ? (
          <div className="card">
            <EmptyState
              icone={<GraduationCap size={18} />}
              titre="Aucun professeur enregistré"
              description={
                directeur
                  ? "Ajoutez votre premier professeur avec son salaire mensuel. Vous pourrez ensuite préparer et suivre la paie chaque mois."
                  : "Le directeur n'a pas encore ajouté de professeur."
              }
            />
          </div>
        ) : (
          <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
            {profs.map((prof) => (
              <article key={prof.id} className="card flex flex-col overflow-hidden">
                <div className="flex flex-wrap items-start justify-between gap-2 border-b border-line px-4 py-3">
                  <div className="min-w-0">
                    <h3 className="truncate text-[14px] font-semibold text-ink">
                      {prof.prenom} {prof.nom}
                    </h3>
                    <p className="mt-0.5 truncate text-[11px] text-muted">
                      {prof.matiere || "Matière non renseignée"}
                    </p>
                  </div>
                  <span
                    className={cx(
                      "shrink-0 rounded-full border px-2 py-0.5 text-[9px] font-semibold uppercase tracking-[0.06em]",
                      prof.actif
                        ? "border-paye/25 bg-paye-soft text-paye"
                        : "border-line bg-surface-2 text-muted",
                    )}
                  >
                    {prof.actif ? "Actif" : "Inactif"}
                  </span>
                </div>

                <div className="flex-1 space-y-1.5 px-4 py-3 text-[11.5px]">
                  <div className="flex items-baseline justify-between gap-2">
                    <span className="text-muted">Salaire mensuel</span>
                    <span className="chiffre font-semibold text-ink">
                      {formatF(prof.salaire_mensuel)}
                    </span>
                  </div>
                  {prof.classes_assurees && (
                    <div className="flex items-baseline justify-between gap-2">
                      <span className="text-muted">Classes</span>
                      <span className="truncate text-ink-2">
                        {prof.classes_assurees}
                      </span>
                    </div>
                  )}
                  <div className="flex items-baseline justify-between gap-2">
                    <span className="text-muted">Compte</span>
                    {prof.identifiant ? (
                      <span className="inline-flex items-center gap-1.5">
                        <code className="rounded-sm border border-line bg-surface-2 px-1.5 py-0.5 text-[10.5px] text-ink-2">
                          {prof.identifiant}
                        </code>
                        {prof.compte_actif ? (
                          <span className="size-1.5 rounded-full bg-paye" title="Compte actif" />
                        ) : (
                          <span className="size-1.5 rounded-full bg-impaye" title="Compte désactivé" />
                        )}
                      </span>
                    ) : (
                      <span className="text-[10.5px] font-semibold text-impaye">
                        Aucun accès
                      </span>
                    )}
                  </div>
                  <div className="flex items-baseline justify-between gap-2">
                    <span className="text-muted">Téléphone</span>
                    <span className="text-ink-2">
                      {prof.telephone ? formatTelephone(prof.telephone) : "—"}
                    </span>
                  </div>
                  <div className="flex items-baseline justify-between gap-2">
                    <span className="text-muted">Embauché le</span>
                    <span className="text-ink-2">
                      {prof.date_embauche ? formatDate(prof.date_embauche) : "—"}
                    </span>
                  </div>
                  {prof.notes && (
                    <p className="border-t border-line pt-1.5 text-[10.5px] leading-relaxed text-muted">
                      {prof.notes}
                    </p>
                  )}
                </div>

                {directeur && (
                  <div className="flex flex-wrap items-center justify-between gap-1.5 border-t border-line bg-surface-2 px-3 py-2">
                    <div className="flex items-center gap-1.5">
                      <ModifierProf prof={prof} />
                      <ReinitialiserAccesProf prof={prof} />
                    </div>
                    <div className="flex items-center gap-1.5">
                      <BoutonBasculerProf prof={prof} />
                      <BoutonSupprimerProf prof={prof} />
                    </div>
                  </div>
                )}
              </article>
            ))}
          </div>
        )}
      </section>

      <section className="mb-5">
        <div className="mb-2.5 flex flex-wrap items-end justify-between gap-2">
          <div>
            <h2 className="text-[15px] font-semibold text-ink">
              Paie de {libelleMoisPaie(mois)} {annee}
            </h2>
            <p className="mt-0.5 text-[11.5px] text-muted">
              Préparez le mois pour créer les salaires dus, puis enregistrez les
              versements (acompte ou solde).
            </p>
          </div>
          <span className="chiffre text-[11.5px] text-muted">
            {formatNombre(totalDu)} F dus · {formatNombre(totalReste)} F restants
          </span>
        </div>

        {situation.length === 0 ? (
          <div className="card">
            <EmptyState
              icone={<Banknote size={18} />}
              titre="Aucun professeur actif à payer"
              description="Ajoutez un professeur actif avec un salaire mensuel pour préparer la paie de ce mois."
            />
          </div>
        ) : (
          <div className="card overflow-hidden">
            <div className="overflow-x-auto">
              <table className="tableau min-w-[720px]">
                <thead>
                  <tr>
                    <th>Professeur</th>
                    <th>Salaire dû</th>
                    <th>Versé</th>
                    <th>Reste</th>
                    <th>Statut</th>
                    <th className="text-right">Action</th>
                  </tr>
                </thead>
                <tbody>
                  {situation.map((ligne) => (
                    <tr key={ligne.prof_id}>
                      <td>
                        <span className="text-[13px] font-medium text-ink">
                          {ligne.prenom} {ligne.nom}
                        </span>
                        <p className="text-[10.5px] text-muted">
                          {ligne.telephone
                            ? formatTelephone(ligne.telephone)
                            : "Téléphone non renseigné"}
                        </p>
                      </td>
                      <td className="chiffre text-[12.5px] text-ink">
                        {formatF(ligne.montant_du)}
                      </td>
                      <td className="chiffre text-[12.5px] text-paye">
                        {formatF(ligne.montant_paye)}
                      </td>
                      <td
                        className={cx(
                          "chiffre text-[12.5px] font-semibold",
                          ligne.reste > 0 ? "text-impaye" : "text-paye",
                        )}
                      >
                        {formatF(ligne.reste)}
                      </td>
                      <td>
                        <span
                          className={cx(
                            "inline-flex rounded-full border px-2 py-0.5 text-[9px] font-semibold uppercase tracking-[0.06em]",
                            ligne.statut === "PAYE"
                              ? "border-paye/25 bg-paye-soft text-paye"
                              : ligne.statut === "PARTIEL"
                                ? "border-partiel/25 bg-partiel-soft text-partiel"
                                : ligne.statut === "NON_PREPARE"
                                  ? "border-line bg-surface-2 text-muted"
                                  : "border-impaye/25 bg-impaye-soft text-impaye",
                          )}
                        >
                          {ligne.statut === "PAYE"
                            ? "Payé"
                            : ligne.statut === "PARTIEL"
                              ? "Partiel"
                              : ligne.statut === "NON_PREPARE"
                                ? "À préparer"
                                : "Non payé"}
                        </span>
                      </td>
                      <td className="text-right">
                        <VerserSalaire salaire={ligne} annee={annee} mois={mois} />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </section>

      <HistoriqueVersements versements={versements} directeur={directeur} />
    </div>
  );
}
