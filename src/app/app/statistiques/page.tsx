import type { Metadata } from "next";
import Link from "next/link";
import {
  BarChart3,
  Banknote,
  CircleDollarSign,
  TrendingDown,
  TrendingUp,
  Users,
  Wallet,
} from "lucide-react";
import { exigerSession } from "@/lib/auth";
import { offreEffective, peut } from "@/lib/offres";
import { libelleAnnee } from "@/lib/mois";
import { anneeActive } from "@/lib/data/annees";
import {
  frequenceDepuisParametre,
  LIBELLES_TYPE_FRAIS,
  libellePeriode,
  periodeDepuisParametre,
} from "@/lib/periodes";
import { frequenceParDefautEcole, nombreTranchesMax } from "@/lib/data/classes";
import { getStatistiques } from "@/lib/data/statistiques";
import { formatF, formatNombre, formatTelephone, pourcentage } from "@/lib/format";
import { VerrouOffre } from "@/components/offres/verrou-offre";
import { EntetePage } from "@/components/app/entete-page";
import { PeriodeSelect } from "@/components/ui/periode-select";
import { EmptyState } from "@/components/ui/empty-state";
import { LienBouton } from "@/components/ui/button";
import { cx } from "@/lib/cx";

export const metadata: Metadata = { title: "Statistiques avancées" };

function libelleMois(valeur: string): string {
  const [annee, mois] = valeur.split("-");
  if (!annee || !mois) return valeur;
  return new Date(Number(annee), Number(mois) - 1, 1).toLocaleDateString("fr-FR", {
    month: "short",
    year: "2-digit",
  });
}

export default async function PageStatistiques({
  searchParams,
}: {
  searchParams: Promise<{ frequence?: string; periode?: string }>;
}) {
  const session = await exigerSession();
  const offre = offreEffective(session.ecole);

  if (!peut(session.ecole, "stats_avancees")) {
    return (
      <VerrouOffre
        titre="Statistiques avancées"
        description="Analysez les encaissements par classe, par tranche et par période pour piloter votre école."
        cle="stats_avancees"
        offreActuelle={offre}
        fonctionnalites={[
          "Taux de recouvrement par classe",
          "Encaissements par tranche et par période",
          "Comparaison des classes et des modes de paiement",
          "Historique conservé même en cas de changement d'offre",
        ]}
      />
    );
  }

  const parametres = await searchParams;
  const annee = await anneeActive(session.ecoleId);
  const defautFrequence = await frequenceParDefautEcole(session.ecoleId);
  const frequence = frequenceDepuisParametre(parametres.frequence, defautFrequence);
  const nbTranches = await nombreTranchesMax(session.ecoleId);
  const periode = periodeDepuisParametre(
    parametres.periode,
    frequence,
    0,
    nbTranches,
  );
  const nomPeriode = libellePeriode(frequence, periode, annee, false, nbTranches);

  const stats = await getStatistiques(
    session.ecoleId,
    annee,
    frequence,
    periode,
  );

  const { resume, inscriptions } = stats;
  const taux = pourcentage(resume.encaisse, resume.attendu);
  const classesFiltrees = stats.classes.filter(
    (classe) => classe.frequence_paiement === frequence,
  );
  const totalModes = stats.modes.reduce((somme, mode) => somme + mode.montant, 0);
  const maxSerie = Math.max(
    1,
    ...stats.serie.map((point) => point.attendu),
  );
  const maxTendance = Math.max(1, ...stats.tendance.map((point) => point.montant));

  return (
    <div>
      <EntetePage
        surtitre={`${libelleAnnee(annee)} · ${nomPeriode}`}
        titre="Statistiques avancées"
        description="Recouvrement par classe, encaissements par période, modes de paiement et impayés prioritaires. Toutes les données viennent des paiements réellement enregistrés."
        actions={
          <PeriodeSelect
            frequence={frequence}
            periode={periode}
            annee={annee}
            nbTranches={nbTranches}
          />
        }
      />

      <div className="mb-5 grid grid-cols-2 divide-x divide-y divide-line overflow-hidden rounded-lg border border-line bg-surface sm:grid-cols-4 sm:divide-y-0">
        {[
          {
            libelle: "Élèves",
            valeur: `${resume.eleves}`,
            detail: "actifs sur la période",
            icone: Users,
          },
          {
            libelle: "Attendu",
            valeur: `${formatNombre(resume.attendu)} F`,
            detail: `scolarité · ${nomPeriode}`,
            icone: CircleDollarSign,
          },
          {
            libelle: "Encaissé",
            valeur: `${formatNombre(resume.encaisse)} F`,
            detail: `${taux} % de recouvrement`,
            icone: Wallet,
            accent: "text-paye",
          },
          {
            libelle: "Reste",
            valeur: `${formatNombre(resume.restant)} F`,
            detail: resume.restant > 0 ? "à recouvrer" : "tout est réglé",
            icone: resume.restant > 0 ? TrendingDown : TrendingUp,
            accent: resume.restant > 0 ? "text-impaye" : "text-paye",
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

      <div className="mb-5 grid gap-4 lg:grid-cols-[1.4fr_1fr]">
        <section className="card overflow-hidden">
          <div className="flex flex-wrap items-center justify-between gap-2 border-b border-line bg-surface-2 px-4 py-3">
            <div>
              <h2 className="text-[13.5px] font-semibold text-ink">
                Recouvrement par classe
              </h2>
              <p className="mt-0.5 text-[11px] text-muted">
                {classesFiltrees.length} classe
                {classesFiltrees.length > 1 ? "s" : ""} en{" "}
                {frequence.toLowerCase()} · {nomPeriode}
              </p>
            </div>
            <span className="chiffre text-[11.5px] font-semibold text-ink">
              {taux} % global
            </span>
          </div>

          {classesFiltrees.length === 0 ? (
            <EmptyState
              icone={<BarChart3 size={18} />}
              titre="Aucune classe pour cette fréquence"
              description="Choisissez une autre fréquence ou créez des classes pour voir les taux de recouvrement."
              action={<LienBouton href="/app/classes" variante="secondaire">Voir les classes</LienBouton>}
            />
          ) : (
            <div className="overflow-x-auto">
              <table className="tableau min-w-[620px]">
                <thead>
                  <tr>
                    <th>Classe</th>
                    <th>Élèves</th>
                    <th>Attendu</th>
                    <th>Encaissé</th>
                    <th>Reste</th>
                    <th className="text-right">Taux</th>
                  </tr>
                </thead>
                <tbody>
                  {classesFiltrees.map((classe) => {
                    const tauxClasse = pourcentage(classe.encaisse, classe.attendu);
                    return (
                      <tr key={classe.id}>
                        <td>
                          <span className="text-[13px] font-medium text-ink">
                            {classe.nom}
                          </span>
                          <p className="text-[10.5px] text-muted">
                            {classe.payes} payés · {classe.partiels} partiels ·{" "}
                            {classe.impayes} impayés
                          </p>
                        </td>
                        <td className="chiffre text-[12.5px] text-ink-2">
                          {classe.nb_eleves}
                        </td>
                        <td className="chiffre text-[12px] text-ink-2">
                          {formatF(classe.attendu)}
                        </td>
                        <td className="chiffre text-[12px] font-medium text-paye">
                          {formatF(classe.encaisse)}
                        </td>
                        <td
                          className={cx(
                            "chiffre text-[12px]",
                            classe.restant > 0 ? "text-impaye" : "text-paye",
                          )}
                        >
                          {formatF(classe.restant)}
                        </td>
                        <td className="text-right">
                          <div className="flex items-center justify-end gap-2">
                            <div className="h-1.5 w-14 overflow-hidden rounded-full bg-line">
                              <span
                                className="block h-full bg-paye"
                                style={{ width: `${Math.min(100, tauxClasse)}%` }}
                              />
                            </div>
                            <span className="chiffre w-9 text-right text-[11.5px] font-semibold text-ink">
                              {tauxClasse} %
                            </span>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </section>

        <div className="space-y-4">
          <section className="card overflow-hidden">
            <div className="border-b border-line bg-surface-2 px-4 py-3">
              <h2 className="flex items-center gap-2 text-[13.5px] font-semibold text-ink">
                <Banknote size={14} aria-hidden />
                Modes de paiement
              </h2>
              <p className="mt-0.5 text-[11px] text-muted">
                Période sélectionnée + inscriptions · {formatF(totalModes)}
              </p>
            </div>
            <ul className="divide-y divide-line">
              {stats.modes.length === 0 ? (
                <li className="px-4 py-6 text-center text-[12px] text-muted">
                  Aucun encaissement sur cette période.
                </li>
              ) : (
                stats.modes.map((mode) => {
                  const part = pourcentage(mode.montant, totalModes);
                  return (
                    <li key={mode.mode} className="px-4 py-2.5">
                      <div className="flex items-baseline justify-between gap-2">
                        <span className="text-[12px] font-medium text-ink">
                          {mode.mode === "ESPECES"
                            ? "Espèces"
                            : mode.mode === "FLOOZ"
                              ? "Flooz"
                              : "TMoney"}
                        </span>
                        <span className="chiffre text-[12px] font-semibold text-ink">
                          {formatF(mode.montant)}
                        </span>
                      </div>
                      <div className="mt-1.5 flex items-center gap-2">
                        <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-line">
                          <span
                            className="block h-full bg-brand"
                            style={{ width: `${part}%` }}
                          />
                        </div>
                        <span className="chiffre w-8 text-right text-[10px] text-muted">
                          {part} %
                        </span>
                      </div>
                      <p className="mt-0.5 text-[10px] text-muted">
                        {mode.total} paiement{mode.total > 1 ? "s" : ""}
                      </p>
                    </li>
                  );
                })
              )}
            </ul>
          </section>

          <section className="card overflow-hidden">
            <div className="border-b border-line bg-surface-2 px-4 py-3">
              <h2 className="text-[13.5px] font-semibold text-ink">
                Scolarité et inscriptions
              </h2>
              <p className="mt-0.5 text-[11px] text-muted">
                Sur toute l&apos;année {libelleAnnee(annee)}
              </p>
            </div>
            <ul className="divide-y divide-line">
              {stats.natures.map((nature) => (
                <li
                  key={nature.type_frais}
                  className="flex items-baseline justify-between gap-2 px-4 py-2.5"
                >
                  <div>
                    <p className="text-[12px] font-medium text-ink">
                      {LIBELLES_TYPE_FRAIS[nature.type_frais]}
                    </p>
                    <p className="text-[10px] text-muted">
                      {formatF(nature.encaisse)} sur {formatF(nature.attendu)}
                    </p>
                  </div>
                  <span
                    className={cx(
                      "chiffre text-[12px] font-semibold",
                      nature.restant > 0 ? "text-impaye" : "text-paye",
                    )}
                  >
                    {nature.restant > 0 ? `${formatF(nature.restant)} restant` : "soldé"}
                  </span>
                </li>
              ))}
            </ul>
            <div className="border-t border-line bg-surface-2/60 px-4 py-2.5 text-[11px] text-muted">
              Inscriptions : {inscriptions.payes}/{inscriptions.total} réglées ·{" "}
              <span className="font-semibold text-ink-2">
                {formatF(inscriptions.encaisse)}
              </span>{" "}
              encaissés
            </div>
          </section>
        </div>
      </div>

      <div className="mb-5 grid gap-4 lg:grid-cols-2">
        <section className="card overflow-hidden">
          <div className="border-b border-line bg-surface-2 px-4 py-3">
            <h2 className="text-[13.5px] font-semibold text-ink">
              Encaissements par période
            </h2>
            <p className="mt-0.5 text-[11px] text-muted">
              Toutes les périodes de la fréquence {frequence.toLowerCase()}
            </p>
          </div>
          {stats.serie.length === 0 ? (
            <p className="px-4 py-8 text-center text-[12px] text-muted">
              Aucune échéance enregistrée pour cette fréquence.
            </p>
          ) : (
            <ul className="divide-y divide-line">
              {stats.serie.map((point) => {
                const tauxPoint = pourcentage(point.encaisse, point.attendu);
                return (
                  <li key={point.periode} className="px-4 py-2.5">
                    <div className="flex items-baseline justify-between gap-2">
                      <span className="text-[12px] font-medium text-ink">
                        {point.libelle ??
                          libellePeriode(
                            frequence,
                            point.periode,
                            annee,
                            false,
                            nbTranches,
                          )}
                      </span>
                      <span className="chiffre text-[11.5px] text-ink-2">
                        {formatF(point.encaisse)}
                        <span className="text-muted"> / {formatF(point.attendu)}</span>
                      </span>
                    </div>
                    <div className="mt-1.5 flex items-center gap-2">
                      <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-line">
                        <span
                          className={cx(
                            "block h-full",
                            tauxPoint >= 80
                              ? "bg-paye"
                              : tauxPoint >= 40
                                ? "bg-partiel"
                                : "bg-impaye",
                          )}
                          style={{
                            width: `${Math.min(100, (point.encaisse / maxSerie) * 100)}%`,
                          }}
                        />
                      </div>
                      <span className="chiffre w-9 text-right text-[10px] text-muted">
                        {tauxPoint} %
                      </span>
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </section>

        <section className="card overflow-hidden">
          <div className="border-b border-line bg-surface-2 px-4 py-3">
            <h2 className="text-[13.5px] font-semibold text-ink">
              Tendance des encaissements
            </h2>
            <p className="mt-0.5 text-[11px] text-muted">
              Par mois de paiement, sur l&apos;année scolaire
            </p>
          </div>
          {stats.tendance.length === 0 ? (
            <p className="px-4 py-8 text-center text-[12px] text-muted">
              Aucun paiement enregistré pour le moment.
            </p>
          ) : (
            <div className="flex h-52 items-end gap-1.5 px-4 pb-3 pt-4">
              {stats.tendance.map((point) => (
                <div
                  key={point.mois}
                  className="flex min-w-0 flex-1 flex-col items-center justify-end gap-1"
                  title={`${libelleMois(point.mois)} : ${formatF(point.montant)}`}
                >
                  <span className="chiffre text-[8.5px] text-muted">
                    {point.montant > 0
                      ? `${Math.round(point.montant / 1000)}k`
                      : "0"}
                  </span>
                  <div
                    className="w-full max-w-[42px] rounded-t-sm bg-brand/85 transition-colors hover:bg-brand"
                    style={{
                      height: `${Math.max(2, (point.montant / maxTendance) * 150)}px`,
                    }}
                  />
                  <span className="max-w-full truncate text-[9px] text-muted">
                    {libelleMois(point.mois)}
                  </span>
                </div>
              ))}
            </div>
          )}
        </section>
      </div>

      <section className="card overflow-hidden">
        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-line bg-surface-2 px-4 py-3">
          <div>
            <h2 className="text-[13.5px] font-semibold text-ink">
              Impayés prioritaires
            </h2>
            <p className="mt-0.5 text-[11px] text-muted">
              Les 8 restes les plus élevés sur {nomPeriode}, inscriptions incluses
            </p>
          </div>
          <Link
            href="/app/impayes"
            className="text-[11.5px] font-semibold text-brand hover:underline"
          >
            Voir tous les impayés
          </Link>
        </div>

        {stats.impayes.length === 0 ? (
          <EmptyState
            icone={<Wallet size={18} />}
            titre="Aucun impayé sur cette période"
            description="Toutes les échéances de la période sélectionnée sont réglées. Vous pouvez changer de période pour analyser une autre tranche."
          />
        ) : (
          <div className="overflow-x-auto">
            <table className="tableau min-w-[640px]">
              <thead>
                <tr>
                  <th>Élève</th>
                  <th>Classe</th>
                  <th>Échéance</th>
                  <th>Parent</th>
                  <th className="text-right">Reste</th>
                </tr>
              </thead>
              <tbody>
                {stats.impayes.map((impaye, index) => (
                  <tr key={`${impaye.nom}-${impaye.prenom}-${index}`}>
                    <td>
                      <span className="text-[13px] font-medium text-ink">
                        {impaye.prenom} {impaye.nom}
                      </span>
                    </td>
                    <td className="text-[12px] text-ink-2">{impaye.classe_nom}</td>
                    <td className="text-[12px] text-ink-2">
                      {impaye.libelle ??
                        (impaye.type_frais === "SCOLARITE"
                          ? libellePeriode(
                              impaye.frequence_paiement,
                              impaye.periode,
                              annee,
                              false,
                              nbTranches,
                            )
                          : LIBELLES_TYPE_FRAIS[impaye.type_frais])}
                    </td>
                    <td className="text-[12px] text-ink-2">
                      {formatTelephone(impaye.telephone_parent)}
                    </td>
                    <td className="chiffre text-right text-[12.5px] font-semibold text-impaye">
                      {formatF(impaye.reste)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}
