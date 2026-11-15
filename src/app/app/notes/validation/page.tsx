import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import {
  AlertTriangle,
  ArrowLeft,
  ArrowRight,
  CalendarClock,
  CheckCircle2,
  ClipboardCheck,
  Clock3,
  Eye,
  LockKeyhole,
  Users,
} from "lucide-react";
import { exigerSession, estDirecteur } from "@/lib/auth";
import { peut } from "@/lib/offres";
import { anneeScolaire, libelleAnnee } from "@/lib/mois";
import {
  compteursSaisies,
  echeanceNotes,
  saisiesTrimestre,
  suiviProfs,
} from "@/lib/data/saisies";
import {
  libelleTrimestreSaisie,
  nomAvecTitre,
  trimestreDepuisParametre,
  TRIMESTRES_SAISIE,
} from "@/lib/saisies";
import { formatDate } from "@/lib/format";
import { BadgeSaisie } from "@/components/notes/badge-saisie";
import { FormEcheance } from "@/components/notes/validation-notes";
import { EntetePage } from "@/components/app/entete-page";
import { Alerte, EmptyState } from "@/components/ui/empty-state";
import { LienBouton } from "@/components/ui/button";
import type { SaisieNotes } from "@/lib/types";
import { cx } from "@/lib/cx";

export const metadata: Metadata = { title: "Validation des notes" };

function LigneValidation({ saisie }: { saisie: SaisieNotes }) {
  return (
    <Link
      href={`/app/notes/validation/${saisie.id}`}
      className="flex flex-wrap items-center justify-between gap-3 border-b border-line px-4 py-3 transition-colors last:border-b-0 hover:bg-surface-2/70"
    >
      <div className="min-w-0">
        <p className="text-[13.5px] font-semibold text-ink">
          {saisie.matiere_nom} · {saisie.classe_nom}
        </p>
        <p className="mt-0.5 text-[12px] text-muted">
          {saisie.prof_id
            ? nomAvecTitre(saisie.prof_prenom, saisie.prof_nom)
            : "Saisie directe du directeur"}
          {" · "}
          {saisie.nb_notes} note{saisie.nb_notes > 1 ? "s" : ""}
          {saisie.statut === "VALIDE" && saisie.valide_le
            ? ` · validé le ${formatDate(saisie.valide_le)}`
            : saisie.envoye_le
              ? ` · envoyé le ${formatDate(saisie.envoye_le)}`
              : ""}
        </p>
      </div>
      <div className="flex items-center gap-3">
        <BadgeSaisie statut={saisie.statut} />
        <span className="inline-flex items-center gap-1 text-[12px] font-semibold text-brand">
          {saisie.statut === "ENVOYE" ? "Corriger et valider" : "Consulter"}
          <ArrowRight size={13} aria-hidden />
        </span>
      </div>
    </Link>
  );
}

export default async function PageValidationNotes({
  searchParams,
}: {
  searchParams: Promise<{ trimestre?: string }>;
}) {
  const session = await exigerSession();

  // Validation et publication : PREMIUM uniquement, vérifié côté serveur.
  if (!peut(session.ecole, "validation_notes")) {
    redirect(
      `/premium?depuis=${encodeURIComponent("la validation des notes")}`,
    );
  }

  const parametres = await searchParams;
  const trimestre = trimestreDepuisParametre(parametres.trimestre);
  const annee = anneeScolaire();

  if (!estDirecteur(session)) {
    return (
      <div className="space-y-4">
        <Alerte ton="erreur">
          Seul le directeur peut valider et publier les notes.
        </Alerte>
        <LienBouton href="/app" variante="secondaire" taille="sm">
          <ArrowLeft size={15} aria-hidden />
          Tableau de bord
        </LienBouton>
      </div>
    );
  }

  const [saisies, echeance, suivi, compteurs] = await Promise.all([
    saisiesTrimestre(session.ecoleId, annee, trimestre),
    echeanceNotes(session.ecoleId, annee, trimestre),
    suiviProfs(session.ecoleId, annee, trimestre),
    compteursSaisies(session.ecoleId, annee, trimestre),
  ]);

  const aValider = saisies.filter((saisie) => saisie.statut === "ENVOYE");
  const enCours = saisies.filter((saisie) => saisie.statut === "EN_COURS");
  const validees = saisies.filter((saisie) => saisie.statut === "VALIDE");

  const dateDepassee =
    echeance !== null && echeance.jours_restants < 0;

  const enRetard = suivi.filter(
    (prof) => dateDepassee && prof.envoyes + prof.valides === 0,
  );
  const sansCompte = suivi.filter((prof) => !prof.compte_actif);

  return (
    <div className="space-y-6">
      <div>
        <LienBouton href="/app/notes" variante="fantome" taille="sm">
          <ArrowLeft size={15} aria-hidden />
          Notes &amp; bulletins
        </LienBouton>
      </div>

      <EntetePage
        surtitre={`${libelleTrimestreSaisie(trimestre)} · ${libelleAnnee(annee)}`}
        titre="Validation des notes"
        description="Les professeurs envoient leur tableau. Vous corrigez si besoin, vous libérez une combinaison mal attribuée, puis vous validez : les parents ne voient les notes qu'après cette publication."
        actions={
          <div className="flex items-center gap-1 rounded-sm border border-line bg-surface p-1">
            {TRIMESTRES_SAISIE.map((element) => (
              <Link
                key={element.valeur}
                href={`/app/notes/validation?trimestre=${element.valeur}`}
                className={cx(
                  "rounded-sm px-2.5 py-1.5 text-[12px] font-semibold transition-colors",
                  element.valeur === trimestre
                    ? "bg-brand text-white"
                    : "text-muted hover:bg-surface-2 hover:text-ink",
                )}
              >
                {element.valeur === 1 ? "T1" : element.valeur === 2 ? "T2" : "T3"}
              </Link>
            ))}
          </div>
        }
      />

      {enRetard.length > 0 && (
        <Alerte ton="erreur">
          <span className="inline-flex items-start gap-2">
            <AlertTriangle size={16} className="mt-0.5 shrink-0" aria-hidden />
            <span>
              <strong>
                {enRetard.length} professeur{enRetard.length > 1 ? "s" : ""} en
                retard :
              </strong>{" "}
              {enRetard
                .map((prof) => `${prof.prenom} ${prof.nom}`)
                .join(", ")}
              . La date limite du {formatDate(echeance?.date_limite ?? "")} est
              dépassée.
            </span>
          </span>
        </Alerte>
      )}

      <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_320px]">
        <div className="card px-4 py-3.5">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <span className="grid size-10 place-items-center rounded-full border border-ochre/25 bg-[#fbf1de] text-[#8a5a10]">
                <CalendarClock size={18} aria-hidden />
              </span>
              <div>
                <p className="text-[13.5px] font-semibold text-ink">
                  Date limite de dépôt
                </p>
                <p className="text-[12px] text-muted">
                  {echeance
                    ? `Notes à envoyer avant le ${formatDate(echeance.date_limite)} · ${
                        echeance.jours_restants < 0
                          ? `${Math.abs(echeance.jours_restants)} jour(s) de retard`
                          : echeance.jours_restants === 0
                            ? "aujourd'hui"
                            : `${echeance.jours_restants} jour(s) restant(s)`
                      }`
                    : "Aucune échéance fixée pour ce trimestre."}
                </p>
              </div>
            </div>
            {dateDepassee && (
              <span className="rounded-full border border-impaye/20 bg-impaye-soft px-2.5 py-1 text-[11px] font-semibold text-impaye">
                Échéance dépassée
              </span>
            )}
          </div>
        </div>

        <div className="card px-4 py-3.5">
          <FormEcheance
            trimestre={trimestre}
            dateLimite={echeance?.date_limite ?? null}
          />
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <div className="card px-4 py-3">
          <p className="text-[10.5px] font-semibold uppercase tracking-[0.1em] text-muted">
            À valider
          </p>
          <p className="mt-1 text-[22px] font-semibold tabular-nums text-brand">
            {compteurs.envoyes}
          </p>
          <p className="text-[12px] text-muted">Envoyées par les profs</p>
        </div>
        <div className="card px-4 py-3">
          <p className="text-[10.5px] font-semibold uppercase tracking-[0.1em] text-muted">
            En cours
          </p>
          <p className="mt-1 text-[22px] font-semibold tabular-nums text-ochre">
            {compteurs.en_cours}
          </p>
          <p className="text-[12px] text-muted">Brouillons non envoyés</p>
        </div>
        <div className="card px-4 py-3">
          <p className="text-[10.5px] font-semibold uppercase tracking-[0.1em] text-muted">
            Validées
          </p>
          <p className="mt-1 text-[22px] font-semibold tabular-nums text-paye">
            {compteurs.valides}
          </p>
          <p className="text-[12px] text-muted">Publiées aux parents</p>
        </div>
        <div className="card px-4 py-3">
          <p className="text-[10.5px] font-semibold uppercase tracking-[0.1em] text-muted">
            Professeurs
          </p>
          <p className="mt-1 text-[22px] font-semibold tabular-nums text-ink">
            {compteurs.profs_compte}/{compteurs.profs}
          </p>
          <p className="text-[12px] text-muted">Comptes de connexion actifs</p>
        </div>
      </div>

      <section className="card overflow-hidden">
        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-line px-4 py-3">
          <div>
            <h2 className="flex items-center gap-2 text-[14px] font-semibold text-ink">
              <ClipboardCheck size={16} className="text-brand" aria-hidden />
              Notes envoyées, à valider
            </h2>
            <p className="text-[12px] text-muted">
              Ouvrez une saisie pour corriger une note, puis validez et publiez.
            </p>
          </div>
          {aValider.length > 0 && (
            <span className="rounded-full border border-brand/20 bg-brand-soft px-2.5 py-1 text-[11px] font-semibold text-brand">
              {aValider.length} en attente
            </span>
          )}
        </div>
        {aValider.length === 0 ? (
          <EmptyState
            icone={<CheckCircle2 size={18} aria-hidden />}
            titre="Aucune saisie en attente"
            description="Les professeurs n'ont pas encore envoyé de notes pour ce trimestre, ou tout a déjà été validé."
          />
        ) : (
          aValider.map((saisie) => (
            <LigneValidation key={saisie.id} saisie={saisie} />
          ))
        )}
      </section>

      <section className="card overflow-hidden">
        <div className="border-b border-line px-4 py-3">
          <h2 className="flex items-center gap-2 text-[14px] font-semibold text-ink">
            <Clock3 size={16} className="text-ochre" aria-hidden />
            Combinaisons en cours
          </h2>
          <p className="text-[12px] text-muted">
            Le professeur a réservé la combinaison et travaille encore dessus.
          </p>
        </div>
        {enCours.length === 0 ? (
          <EmptyState
            icone={<LockKeyhole size={18} aria-hidden />}
            titre="Aucune combinaison verrouillée"
            description="Aucun professeur n'a de brouillon ouvert pour ce trimestre."
          />
        ) : (
          enCours.map((saisie) => (
            <LigneValidation key={saisie.id} saisie={saisie} />
          ))
        )}
      </section>

      <section className="card overflow-hidden">
        <div className="border-b border-line px-4 py-3">
          <h2 className="flex items-center gap-2 text-[14px] font-semibold text-ink">
            <Eye size={16} className="text-paye" aria-hidden />
            Notes validées et publiées
          </h2>
        </div>
        {validees.length === 0 ? (
          <EmptyState
            icone={<CheckCircle2 size={18} aria-hidden />}
            titre="Aucune note publiée"
            description="Après validation, les notes apparaissent ici et sur le portail parent."
          />
        ) : (
          validees.map((saisie) => (
            <LigneValidation key={saisie.id} saisie={saisie} />
          ))
        )}
      </section>

      <section className="card overflow-hidden">
        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-line px-4 py-3">
          <div>
            <h2 className="flex items-center gap-2 text-[14px] font-semibold text-ink">
              <Users size={16} className="text-brand" aria-hidden />
              Suivi des professeurs
            </h2>
            <p className="text-[12px] text-muted">
              Qui a fini, qui travaille encore, qui n&apos;a pas envoyé.
            </p>
          </div>
          {sansCompte.length > 0 && (
            <Link
              href="/app/profs"
              className="text-[12px] font-semibold text-impaye underline underline-offset-2 hover:no-underline"
            >
              {sansCompte.length} professeur(s) sans compte actif — créer l&apos;accès
            </Link>
          )}
        </div>

        {suivi.length === 0 ? (
          <EmptyState
            icone={<Users size={18} aria-hidden />}
            titre="Aucun professeur actif"
            description="Créez les comptes professeurs depuis Profs & salaires."
            action={
              <LienBouton href="/app/profs" taille="sm">
                Gérer les professeurs
              </LienBouton>
            }
          />
        ) : (
          <div className="overflow-x-auto">
            <table className="tableau w-full min-w-[640px]">
              <thead>
                <tr>
                  <th className="text-left">Professeur</th>
                  <th className="text-left">Identifiant</th>
                  <th className="text-center">En cours</th>
                  <th className="text-center">Envoyées</th>
                  <th className="text-center">Validées</th>
                  <th className="text-right">Situation</th>
                </tr>
              </thead>
              <tbody>
                {suivi.map((prof) => {
                  const aEnvoye = prof.envoyes + prof.valides > 0;
                  const retard = dateDepassee && !aEnvoye;
                  return (
                    <tr key={prof.prof_id}>
                      <td>
                        <p className="text-[13px] font-semibold text-ink">
                          {prof.prenom} {prof.nom}
                        </p>
                        <p className="text-[11.5px] text-muted">
                          {prof.telephone ?? "Téléphone non renseigné"}
                        </p>
                      </td>
                      <td>
                        {prof.identifiant ? (
                          <code className="rounded-sm border border-line bg-surface-2 px-1.5 py-0.5 text-[11.5px] text-ink-2">
                            {prof.identifiant}
                          </code>
                        ) : (
                          <span className="text-[12px] text-impaye">
                            Aucun compte
                          </span>
                        )}
                      </td>
                      <td className="text-center tabular-nums">{prof.en_cours}</td>
                      <td className="text-center tabular-nums">{prof.envoyes}</td>
                      <td className="text-center tabular-nums">{prof.valides}</td>
                      <td className="text-right">
                        {retard ? (
                          <span className="inline-flex items-center gap-1.5 rounded-full border border-impaye/20 bg-impaye-soft px-2 py-0.5 text-[11px] font-semibold text-impaye">
                            <AlertTriangle size={11} aria-hidden />
                            En retard
                          </span>
                        ) : prof.en_cours > 0 ? (
                          <span className="inline-flex items-center gap-1.5 rounded-full border border-ochre/25 bg-[#fbf1de] px-2 py-0.5 text-[11px] font-semibold text-[#8a5a10]">
                            <Clock3 size={11} aria-hidden />
                            En cours
                          </span>
                        ) : aEnvoye ? (
                          <span className="inline-flex items-center gap-1.5 rounded-full border border-paye/20 bg-paye-soft px-2 py-0.5 text-[11px] font-semibold text-paye">
                            <CheckCircle2 size={11} aria-hidden />
                            À jour
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1.5 rounded-full border border-line bg-surface-2 px-2 py-0.5 text-[11px] font-semibold text-muted">
                            <Clock3 size={11} aria-hidden />
                            Pas commencé
                          </span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <p className="text-center text-[11.5px] text-muted">
        Les parents ne voient que les notes validées, sur le portail public de
        l&apos;école (lien /parent/…).
      </p>
    </div>
  );
}
