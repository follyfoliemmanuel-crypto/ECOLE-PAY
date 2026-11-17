"use client";

import { useActionState, useEffect, useRef } from "react";
import { ImagePlus, KeyRound, Loader2, Save, UserPlus } from "lucide-react";
import {
  ajouterUtilisateur,
  changerMotDePasse,
  mettreAJourEcole,
} from "@/lib/actions/ecole";
import type { Ecole, ResultatAction } from "@/lib/types";
import { Bouton } from "@/components/ui/button";
import { Alerte } from "@/components/ui/empty-state";

const VARIABLES = [
  "{ecole}",
  "{eleve}",
  "{classe}",
  "{parent}",
  "{nature}",
  "{periode}",
  "{mois}",
  "{montant}",
  "{reste}",
  "{montant_du}",
  "{annee}",
];

/** Insère une variable à la position du curseur dans un modèle WhatsApp. */
function ChampModele({
  id,
  nom,
  label,
  description,
  defaultValue,
}: {
  id: string;
  nom: string;
  label: string;
  description: string;
  defaultValue: string;
}) {
  const zone = useRef<HTMLTextAreaElement>(null);

  function inserer(variable: string) {
    const champ = zone.current;
    if (!champ) return;
    const debut = champ.selectionStart ?? champ.value.length;
    const fin = champ.selectionEnd ?? champ.value.length;
    champ.value =
      champ.value.slice(0, debut) + variable + champ.value.slice(fin);
    champ.focus();
    const position = debut + variable.length;
    champ.setSelectionRange(position, position);
  }

  return (
    <div>
      <label className="label" htmlFor={id}>
        {label}
      </label>
      <textarea
        id={id}
        name={nom}
        ref={zone}
        rows={4}
        defaultValue={defaultValue}
        className="input resize-y text-[13px] leading-relaxed"
      />
      <p className="aide">{description}</p>
      <div className="mt-1.5 flex flex-wrap gap-1">
        {VARIABLES.map((variable) => (
          <button
            key={variable}
            type="button"
            onClick={() => inserer(variable)}
            className="chiffre rounded-sm border border-line bg-surface-2 px-1.5 py-0.5 text-[10px] text-ink-2 transition-colors hover:border-brand/30 hover:bg-brand-soft hover:text-brand"
          >
            {variable}
          </button>
        ))}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
//  Informations de l'école + modèles WhatsApp
// ---------------------------------------------------------------------------
export function FormulaireEcole({ ecole }: { ecole: Ecole }) {
  const [etat, action, enCours] = useActionState<ResultatAction | null, FormData>(
    mettreAJourEcole,
    null,
  );

  return (
    <form action={action} className="space-y-5">
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="sm:col-span-2">
          <label className="label" htmlFor="nom">
            Nom de l&apos;école
          </label>
          <input
            id="nom"
            name="nom"
            required
            defaultValue={ecole.nom}
            className="input"
          />
        </div>

        <div>
          <label className="label" htmlFor="adresse">
            Adresse / quartier
          </label>
          <input
            id="adresse"
            name="adresse"
            defaultValue={ecole.adresse ?? ""}
            placeholder="Agoè, Lomé"
            className="input"
          />
        </div>

        <div>
          <label className="label" htmlFor="telephone">
            Téléphone de l&apos;école
          </label>
          <input
            id="telephone"
            name="telephone"
            inputMode="tel"
            defaultValue={ecole.telephone ?? ""}
            placeholder="+228 90 00 00 00"
            className="input"
          />
        </div>

        <div className="sm:col-span-2">
          <label className="label" htmlFor="email">
            Email de l&apos;école
          </label>
          <input
            id="email"
            name="email"
            type="email"
            required
            defaultValue={ecole.email}
            className="input"
          />
          <p className="aide">
            Cet email apparaît sur les documents et sert de contact commercial.
          </p>
        </div>
      </div>

      {/* Logo */}
      <div className="rounded-sm border border-line bg-surface-2 p-3.5">
        <div className="flex flex-wrap items-center gap-3">
          {ecole.logo_url ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={ecole.logo_url}
              alt={`Logo de ${ecole.nom}`}
              className="size-14 rounded-sm border border-line bg-white object-contain p-1"
            />
          ) : (
            <span className="grid size-14 place-items-center rounded-sm border border-dashed border-line-strong bg-surface text-muted">
              <ImagePlus size={18} aria-hidden />
            </span>
          )}
          <div className="min-w-0 flex-1">
            <label className="label mb-1" htmlFor="logo">
              Logo (facultatif)
            </label>
            <input
              id="logo"
              name="logo"
              type="file"
              accept="image/png,image/jpeg,image/webp"
              className="block w-full text-[12px] text-muted file:mr-2 file:rounded-sm file:border-0 file:bg-brand-soft file:px-2.5 file:py-1.5 file:text-[11.5px] file:font-semibold file:text-brand"
            />
            <p className="aide">PNG, JPG ou WebP · 250 Ko maximum.</p>
          </div>
        </div>
        {ecole.logo_url && (
          <label className="mt-2.5 flex items-center gap-2 text-[11.5px] text-muted">
            <input type="checkbox" name="supprimer_logo" value="1" />
            Supprimer le logo actuel
          </label>
        )}
      </div>

      {/* Modèles WhatsApp */}
      <div className="border-t border-line pt-5">
        <div className="mb-3">
          <h3 className="text-[13.5px] font-semibold text-ink">
            Modèles de messages WhatsApp
          </h3>
          <p className="mt-0.5 text-[11.5px] leading-relaxed text-muted">
            Cliquez sur une variable pour l&apos;insérer. Les montants sont
            formatés automatiquement en FCFA.
          </p>
        </div>

        <div className="space-y-4">
          <ChampModele
            id="modele_recu"
            nom="modele_recu"
            label="Message de reçu"
            description="Envoyé après chaque encaissement. {ecole} = nom de l'établissement, {recu} = numéro du reçu, {date} = date du paiement, {mode} = espèces, Flooz ou TMoney. {nature} = scolarité ou frais d'inscription, {periode} = mois, tranche ou année. {montant} = montant reçu, {reste} = reste de l'échéance après ce paiement."
            defaultValue={ecole.modele_recu}
          />
          <ChampModele
            id="modele_relance"
            nom="modele_relance"
            label="Message de relance"
            description="Utilisé depuis la page Impayés. {nature} et {periode} décrivent l'échéance, {montant_du} = montant de l'échéance, {reste} = reste à payer."
            defaultValue={ecole.modele_relance}
          />
        </div>
      </div>

      {etat?.error && <Alerte>{etat.error}</Alerte>}
      {etat?.success && <Alerte ton="succes">{etat.success}</Alerte>}

      <div className="flex justify-end">
        <Bouton type="submit" disabled={enCours}>
          {enCours ? (
            <Loader2 size={15} className="animate-spin" aria-hidden />
          ) : (
            <Save size={15} aria-hidden />
          )}
          {enCours ? "Enregistrement…" : "Enregistrer les informations"}
        </Bouton>
      </div>
    </form>
  );
}

// ---------------------------------------------------------------------------
//  Ajouter une secrétaire
// ---------------------------------------------------------------------------
export function FormulaireUtilisateur() {
  const [etat, action, enCours] = useActionState<ResultatAction | null, FormData>(
    ajouterUtilisateur,
    null,
  );
  const formulaire = useRef<HTMLFormElement>(null);

  useEffect(() => {
    if (etat?.success) formulaire.current?.reset();
  }, [etat]);

  return (
    <form ref={formulaire} action={action} className="space-y-3">
      <div className="grid gap-3 sm:grid-cols-2">
        <div>
          <label className="label" htmlFor="nom-utilisateur">
            Nom complet
          </label>
          <input
            id="nom-utilisateur"
            name="nom"
            required
            placeholder="Akouvi Mensah"
            className="input"
          />
        </div>
        <div>
          <label className="label" htmlFor="email-utilisateur">
            Email de connexion
          </label>
          <input
            id="email-utilisateur"
            name="email"
            type="email"
            required
            placeholder="secretaire@ecole.tg"
            className="input"
          />
        </div>
      </div>

      <div>
        <label className="label" htmlFor="role-utilisateur">
          Rôle
        </label>
        <select
          id="role-utilisateur"
          name="role"
          defaultValue="secretaire"
          className="input"
        >
          <option value="secretaire">Secrétaire — encaisse et consulte</option>
          <option value="comptable">Comptable — encaisse et suit les comptes</option>
        </select>
        <p className="aide">
          Le directeur conserve seul le droit d&apos;annuler un paiement ou de
          supprimer une fiche.
        </p>
      </div>

      <div>
        <label className="label" htmlFor="mdp-utilisateur">
          Mot de passe provisoire
        </label>
        <input
          id="mdp-utilisateur"
          name="mot_de_passe"
          type="text"
          required
          minLength={10}
          maxLength={72}
          placeholder="10 caractères minimum, une lettre et un chiffre"
          className="input"
        />
        <p className="aide">
          Communiquez-le à l&apos;utilisateur. Il pourra le changer dans ses
          paramètres.
        </p>
      </div>

      {etat?.error && <Alerte>{etat.error}</Alerte>}
      {etat?.success && <Alerte ton="succes">{etat.success}</Alerte>}

      <div className="flex justify-end">
        <Bouton type="submit" variante="secondaire" disabled={enCours}>
          {enCours ? (
            <Loader2 size={14} className="animate-spin" aria-hidden />
          ) : (
            <UserPlus size={14} aria-hidden />
          )}
          {enCours ? "Création…" : "Ajouter l'utilisateur"}
        </Bouton>
      </div>
    </form>
  );
}

// ---------------------------------------------------------------------------
//  Changer mon mot de passe
// ---------------------------------------------------------------------------
export function FormulaireMotDePasse() {
  const [etat, action, enCours] = useActionState<ResultatAction | null, FormData>(
    changerMotDePasse,
    null,
  );
  const formulaire = useRef<HTMLFormElement>(null);

  useEffect(() => {
    if (etat?.success) formulaire.current?.reset();
  }, [etat]);

  return (
    <form ref={formulaire} action={action} className="space-y-3">
      <div>
        <label className="label" htmlFor="actuel">
          Mot de passe actuel
        </label>
        <input
          id="actuel"
          name="actuel"
          type="password"
          autoComplete="current-password"
          required
          className="input"
        />
      </div>
      <div className="grid gap-3 sm:grid-cols-2">
        <div>
          <label className="label" htmlFor="nouveau">
            Nouveau mot de passe
          </label>
          <input
            id="nouveau"
            name="nouveau"
            type="password"
            autoComplete="new-password"
            required
            minLength={10}
            maxLength={72}
            className="input"
          />
        </div>
        <div>
          <label className="label" htmlFor="confirmation">
            Confirmer
          </label>
          <input
            id="confirmation"
            name="confirmation"
            type="password"
            autoComplete="new-password"
            required
            minLength={10}
            maxLength={72}
            className="input"
          />
        </div>
      </div>

      {etat?.error && <Alerte>{etat.error}</Alerte>}
      {etat?.success && <Alerte ton="succes">{etat.success}</Alerte>}

      <div className="flex justify-end">
        <Bouton type="submit" variante="secondaire" disabled={enCours}>
          {enCours ? (
            <Loader2 size={14} className="animate-spin" aria-hidden />
          ) : (
            <KeyRound size={14} aria-hidden />
          )}
          {enCours ? "Mise à jour…" : "Changer le mot de passe"}
        </Bouton>
      </div>
    </form>
  );
}
