"use client";

import { useActionState, useEffect, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  Banknote,
  Loader2,
  Pencil,
  Plus,
  Save,
  Trash2,
  UserRoundCheck,
  UserRoundX,
  Wallet,
} from "lucide-react";
import {
  basculerProf,
  creerProf,
  modifierProf,
  preparerSalaires,
  supprimerProf,
  supprimerVersement,
  verserSalaire,
} from "@/lib/actions/profs";
import { dateInput, formatDate, formatF } from "@/lib/format";
import { libelleMoisPaie } from "@/lib/paie";
import type {
  Prof,
  ResultatAction,
  SalaireMois,
  VersementSalaire,
} from "@/lib/types";
import { Bouton } from "@/components/ui/button";
import { BoutonConfirmation } from "@/components/ui/bouton-confirmation";
import { Dialogue } from "@/components/ui/dialogue";
import { Alerte } from "@/components/ui/empty-state";

function ChampsProf({
  prof,
  prefixe,
}: {
  prof?: Prof;
  prefixe: string;
}) {
  return (
    <div className="space-y-3">
      <div className="grid gap-3 sm:grid-cols-2">
        <div>
          <label className="label" htmlFor={`${prefixe}-prenom`}>
            Prénom
          </label>
          <input
            id={`${prefixe}-prenom`}
            name="prenom"
            required
            maxLength={80}
            defaultValue={prof?.prenom}
            placeholder="Koffi"
            className="input h-9"
            autoComplete="off"
          />
        </div>
        <div>
          <label className="label" htmlFor={`${prefixe}-nom`}>
            Nom
          </label>
          <input
            id={`${prefixe}-nom`}
            name="nom"
            required
            maxLength={80}
            defaultValue={prof?.nom}
            placeholder="AMEGAN"
            className="input h-9"
            autoComplete="off"
          />
        </div>
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        <div>
          <label className="label" htmlFor={`${prefixe}-telephone`}>
            Téléphone / WhatsApp
          </label>
          <input
            id={`${prefixe}-telephone`}
            name="telephone"
            inputMode="tel"
            defaultValue={prof?.telephone ?? ""}
            placeholder="90 12 34 56"
            className="input h-9"
            autoComplete="off"
          />
        </div>
        <div>
          <label className="label" htmlFor={`${prefixe}-email`}>
            Email (facultatif)
          </label>
          <input
            id={`${prefixe}-email`}
            name="email"
            type="email"
            defaultValue={prof?.email ?? ""}
            placeholder="prof@ecole.tg"
            className="input h-9"
            autoComplete="off"
          />
        </div>
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        <div>
          <label className="label" htmlFor={`${prefixe}-matiere`}>
            Matière principale
          </label>
          <input
            id={`${prefixe}-matiere`}
            name="matiere"
            maxLength={120}
            defaultValue={prof?.matiere ?? ""}
            placeholder="Mathématiques"
            className="input h-9"
            autoComplete="off"
          />
        </div>
        <div>
          <label className="label" htmlFor={`${prefixe}-classes`}>
            Classes assurées
          </label>
          <input
            id={`${prefixe}-classes`}
            name="classes_assurees"
            maxLength={160}
            defaultValue={prof?.classes_assurees ?? ""}
            placeholder="6ème A, 5ème B"
            className="input h-9"
            autoComplete="off"
          />
        </div>
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        <div>
          <label className="label" htmlFor={`${prefixe}-salaire`}>
            Salaire mensuel
          </label>
          <div className="relative">
            <input
              id={`${prefixe}-salaire`}
              name="salaire_mensuel"
              inputMode="numeric"
              defaultValue={prof?.salaire_mensuel ?? ""}
              placeholder="45 000"
              className="input h-9 pr-14"
              autoComplete="off"
            />
            <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-[11px] font-medium text-muted">
              FCFA
            </span>
          </div>
        </div>
        <div>
          <label className="label" htmlFor={`${prefixe}-embauche`}>
            Date d&apos;embauche
          </label>
          <input
            id={`${prefixe}-embauche`}
            name="date_embauche"
            type="date"
            defaultValue={prof?.date_embauche ?? ""}
            className="input h-9"
          />
        </div>
      </div>

      <div>
        <label className="label" htmlFor={`${prefixe}-notes`}>
          Notes internes (facultatif)
        </label>
        <textarea
          id={`${prefixe}-notes`}
          name="notes"
          rows={2}
          maxLength={500}
          defaultValue={prof?.notes ?? ""}
          placeholder="Diplôme, disponibilité, observations…"
          className="input resize-none"
        />
      </div>
    </div>
  );
}

export function NouveauProf() {
  const [etat, action, enCours] = useActionState<ResultatAction | null, FormData>(
    creerProf,
    null,
  );
  const formulaire = useRef<HTMLFormElement>(null);

  useEffect(() => {
    if (etat?.success) formulaire.current?.reset();
  }, [etat]);

  return (
    <form ref={formulaire} action={action} className="space-y-3.5">
      <ChampsProf prefixe="nouveau-prof" />
      {etat?.error && <Alerte>{etat.error}</Alerte>}
      {etat?.success && <Alerte ton="succes">{etat.success}</Alerte>}
      <Bouton type="submit" disabled={enCours}>
        {enCours ? (
          <Loader2 size={15} className="animate-spin" aria-hidden />
        ) : (
          <Plus size={15} strokeWidth={2.4} aria-hidden />
        )}
        {enCours ? "Enregistrement…" : "Ajouter le professeur"}
      </Bouton>
    </form>
  );
}

export function ModifierProf({ prof }: { prof: Prof }) {
  const [ouvert, setOuvert] = useState(false);
  const [etat, action, enCours] = useActionState<ResultatAction | null, FormData>(
    modifierProf,
    null,
  );

  useEffect(() => {
    if (etat?.success) {
      const minuteur = setTimeout(() => setOuvert(false), 700);
      return () => clearTimeout(minuteur);
    }
  }, [etat]);

  return (
    <>
      <button
        type="button"
        onClick={() => setOuvert(true)}
        className="inline-flex h-8 items-center gap-1.5 rounded-sm border border-line-strong px-2.5 text-[11.5px] font-semibold text-ink transition-colors hover:bg-surface-2"
      >
        <Pencil size={12} aria-hidden />
        Modifier
      </button>

      <Dialogue
        ouvert={ouvert}
        onFermer={() => setOuvert(false)}
        titre={`Modifier ${prof.prenom} ${prof.nom}`}
        description="Le salaire mensuel sert aux prochains mois préparés. Les salaires déjà créés ne changent pas."
      >
        <form action={action} className="space-y-3">
          <input type="hidden" name="id" value={prof.id} />
          <ChampsProf prof={prof} prefixe={`prof-${prof.id}`} />
          {etat?.error && <Alerte>{etat.error}</Alerte>}
          {etat?.success && <Alerte ton="succes">{etat.success}</Alerte>}
          <div className="flex flex-col-reverse gap-2 pt-1 sm:flex-row sm:justify-end">
            <Bouton
              type="button"
              variante="secondaire"
              onClick={() => setOuvert(false)}
            >
              Annuler
            </Bouton>
            <Bouton type="submit" disabled={enCours}>
              {enCours ? (
                <Loader2 size={14} className="animate-spin" aria-hidden />
              ) : (
                <Save size={14} aria-hidden />
              )}
              Enregistrer
            </Bouton>
          </div>
        </form>
      </Dialogue>
    </>
  );
}

export function BoutonBasculerProf({ prof }: { prof: Prof }) {
  const router = useRouter();
  const [enCours, demarrer] = useTransition();
  const [erreur, setErreur] = useState<string>();

  function basculer() {
    setErreur(undefined);
    demarrer(async () => {
      const donnees = new FormData();
      donnees.set("id", prof.id);
      const resultat = await basculerProf(donnees);
      if (resultat?.error) setErreur(resultat.error);
      else router.refresh();
    });
  }

  return (
    <div className="flex flex-col items-end gap-1">
      <button
        type="button"
        onClick={basculer}
        disabled={enCours}
        className="inline-flex h-8 items-center gap-1.5 rounded-sm border border-line-strong px-2.5 text-[11.5px] font-semibold text-ink transition-colors hover:bg-surface-2 disabled:opacity-50"
      >
        {prof.actif ? (
          <UserRoundX size={12} aria-hidden />
        ) : (
          <UserRoundCheck size={12} aria-hidden />
        )}
        {enCours ? "…" : prof.actif ? "Désactiver" : "Réactiver"}
      </button>
      {erreur && <p className="text-[10.5px] text-impaye">{erreur}</p>}
    </div>
  );
}

export function PreparerSalaires({
  annee,
  mois,
}: {
  annee: number;
  mois: number;
}) {
  const [etat, action, enCours] = useActionState<ResultatAction | null, FormData>(
    preparerSalaires,
    null,
  );

  return (
    <form action={action} className="space-y-2">
      <input type="hidden" name="annee" value={annee} />
      <input type="hidden" name="mois" value={mois} />
      <Bouton type="submit" variante="secondaire" taille="sm" disabled={enCours}>
        {enCours ? (
          <Loader2 size={14} className="animate-spin" aria-hidden />
        ) : (
          <Banknote size={14} aria-hidden />
        )}
        {enCours ? "Préparation…" : `Préparer ${libelleMoisPaie(mois).toLowerCase()}`}
      </Bouton>
      {etat?.error && <Alerte>{etat.error}</Alerte>}
      {etat?.success && <Alerte ton="succes">{etat.success}</Alerte>}
    </form>
  );
}

export function VerserSalaire({
  salaire,
  annee,
  mois,
}: {
  salaire: SalaireMois;
  annee: number;
  mois: number;
}) {
  const [ouvert, setOuvert] = useState(false);
  const [etat, action, enCours] = useActionState<ResultatAction | null, FormData>(
    verserSalaire,
    null,
  );

  useEffect(() => {
    if (etat?.success) {
      const minuteur = setTimeout(() => setOuvert(false), 700);
      return () => clearTimeout(minuteur);
    }
  }, [etat]);

  const dejaPaye = salaire.statut === "PAYE";

  if (!salaire.salaire_id) {
    return (
      <span className="text-[10.5px] text-muted" title="Préparez le mois avant de verser">
        À préparer
      </span>
    );
  }

  return (
    <>
      <button
        type="button"
        disabled={dejaPaye}
        onClick={() => setOuvert(true)}
        className="inline-flex h-8 items-center gap-1.5 rounded-sm border border-line-strong px-2.5 text-[11.5px] font-semibold text-ink transition-colors hover:bg-surface-2 disabled:cursor-not-allowed disabled:opacity-40"
      >
        <Wallet size={12} aria-hidden />
        {dejaPaye ? "Soldé" : "Verser"}
      </button>

      <Dialogue
        ouvert={ouvert}
        onFermer={() => setOuvert(false)}
        titre={`Verser à ${salaire.prenom} ${salaire.nom}`}
        description={`${libelleMoisPaie(mois)} ${annee} · reste à verser ${formatF(salaire.reste)}.`}
      >
        <form action={action} className="space-y-3">
          <input type="hidden" name="salaire_id" value={salaire.salaire_id} />
          <div>
            <label className="label" htmlFor={`versement-montant-${salaire.salaire_id}`}>
              Montant versé
            </label>
            <div className="relative">
              <input
                id={`versement-montant-${salaire.salaire_id}`}
                name="montant"
                inputMode="numeric"
                required
                defaultValue={salaire.reste}
                className="input pr-14"
                autoComplete="off"
              />
              <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-[11px] font-medium text-muted">
                FCFA
              </span>
            </div>
            <p className="aide">
              Vous pouvez payer un acompte. Le reste sera suivi automatiquement.
            </p>
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            <div>
              <label className="label" htmlFor={`versement-mode-${salaire.salaire_id}`}>
                Mode
              </label>
              <select
                id={`versement-mode-${salaire.salaire_id}`}
                name="mode_paiement"
                defaultValue="ESPECES"
                className="input h-10"
              >
                <option value="ESPECES">Espèces</option>
                <option value="FLOOZ">Flooz</option>
                <option value="TMONEY">TMoney</option>
              </select>
            </div>
            <div>
              <label className="label" htmlFor={`versement-date-${salaire.salaire_id}`}>
                Date
              </label>
              <input
                id={`versement-date-${salaire.salaire_id}`}
                name="date_versement"
                type="date"
                defaultValue={dateInput()}
                className="input h-10"
              />
            </div>
          </div>

          <div>
            <label className="label" htmlFor={`versement-note-${salaire.salaire_id}`}>
              Observation (facultatif)
            </label>
            <input
              id={`versement-note-${salaire.salaire_id}`}
              name="observation"
              maxLength={300}
              placeholder="Acompte, prime, retenue…"
              className="input h-9"
              autoComplete="off"
            />
          </div>

          {etat?.error && <Alerte>{etat.error}</Alerte>}
          {etat?.success && <Alerte ton="succes">{etat.success}</Alerte>}

          <div className="flex flex-col-reverse gap-2 pt-1 sm:flex-row sm:justify-end">
            <Bouton
              type="button"
              variante="secondaire"
              onClick={() => setOuvert(false)}
            >
              Annuler
            </Bouton>
            <Bouton type="submit" disabled={enCours}>
              {enCours ? (
                <Loader2 size={14} className="animate-spin" aria-hidden />
              ) : (
                <Save size={14} aria-hidden />
              )}
              Enregistrer le versement
            </Bouton>
          </div>
        </form>
      </Dialogue>
    </>
  );
}

export function HistoriqueVersements({
  versements,
  directeur,
}: {
  versements: VersementSalaire[];
  directeur: boolean;
}) {
  return (
    <div className="card overflow-hidden">
      <div className="border-b border-line bg-surface-2 px-4 py-3">
        <h2 className="text-[13.5px] font-semibold text-ink">
          Derniers versements
        </h2>
        <p className="mt-0.5 text-[11px] text-muted">
          Chaque versement est conservé. Un versement erroné peut être annulé
          par le directeur, puis ressaisi.
        </p>
      </div>

      {versements.length === 0 ? (
        <p className="px-4 py-8 text-center text-[13px] text-muted">
          Aucun versement de salaire enregistré pour le moment.
        </p>
      ) : (
        <ul className="divide-y divide-line">
          {versements.map((versement) => (
            <li
              key={versement.id}
              className="flex flex-wrap items-center justify-between gap-2 px-4 py-2.5"
            >
              <div className="min-w-0">
                <p className="text-[12.5px] font-medium text-ink">
                  {versement.prof_prenom} {versement.prof_nom}
                </p>
                <p className="text-[10.5px] text-muted">
                  {libelleMoisPaie(versement.mois)} {versement.annee} ·{" "}
                  {formatDate(versement.date_versement)} ·{" "}
                  {versement.mode_paiement === "ESPECES"
                    ? "Espèces"
                    : versement.mode_paiement === "FLOOZ"
                      ? "Flooz"
                      : "TMoney"}
                  {versement.enregistre_par_nom
                    ? ` · ${versement.enregistre_par_nom}`
                    : ""}
                </p>
                {versement.observation && (
                  <p className="text-[10.5px] text-muted">
                    {versement.observation}
                  </p>
                )}
              </div>
              <div className="flex items-center gap-2">
                <span className="chiffre text-[12.5px] font-semibold text-ink">
                  {formatF(versement.montant)}
                </span>
                {directeur && (
                  <BoutonConfirmation
                    action={supprimerVersement}
                    champs={{ id: versement.id }}
                    titre="Annuler ce versement ?"
                    description="Le versement sera supprimé et le salaire du mois recalculé. Cette action est définitive."
                    libelle=""
                    libelleConfirmer="Annuler le versement"
                    variante="fantome"
                    icone={<Trash2 size={12} aria-hidden />}
                  />
                )}
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

export function BoutonSupprimerProf({ prof }: { prof: Prof }) {
  return (
    <BoutonConfirmation
      action={supprimerProf}
      champs={{ id: prof.id }}
      titre={`Supprimer ${prof.prenom} ${prof.nom} ?`}
      description="La fiche sera retirée. La suppression est refusée si des salaires ont déjà été préparés : désactivez plutôt le professeur."
      libelle=""
      libelleConfirmer="Supprimer la fiche"
      variante="fantome"
      icone={<Trash2 size={12} aria-hidden />}
    />
  );
}


