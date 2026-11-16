"use client";

import Link from "next/link";
import { useActionState, useState } from "react";
import { Eye, EyeOff, Loader2 } from "lucide-react";
import {
  connecter,
  demanderReinitialisation,
  inscrire,
  reinitialiserMotDePasse,
  type EtatAuth,
} from "@/lib/actions/auth";
import { Bouton } from "@/components/ui/button";
import { Alerte } from "@/components/ui/empty-state";

function ChampMotDePasse({
  nom,
  label,
  autoComplete,
  placeholder,
  aide,
  minLength = 8,
}: {
  nom: string;
  label: string;
  autoComplete: string;
  placeholder?: string;
  aide?: string;
  /** Les professeurs ont un mot de passe d'au moins 6 caractères. */
  minLength?: number;
}) {
  const [visible, setVisible] = useState(false);
  return (
    <div>
      <label className="label" htmlFor={nom}>
        {label}
      </label>
      <div className="relative">
        <input
          id={nom}
          name={nom}
          type={visible ? "text" : "password"}
          autoComplete={autoComplete}
          required
          minLength={minLength}
          placeholder={placeholder}
          className="input pr-11"
        />
        <button
          type="button"
          onClick={() => setVisible(!visible)}
          className="absolute right-1 top-1/2 grid size-8 -translate-y-1/2 place-items-center rounded-sm text-muted transition-colors hover:bg-surface-2 hover:text-ink"
          aria-label={visible ? "Masquer le mot de passe" : "Afficher le mot de passe"}
        >
          {visible ? <EyeOff size={16} /> : <Eye size={16} />}
        </button>
      </div>
      {aide && <p className="aide">{aide}</p>}
    </div>
  );
}

function BoutonSoumettre({
  enCours,
  children,
}: {
  enCours: boolean;
  children: React.ReactNode;
}) {
  return (
    <Bouton type="submit" disabled={enCours} className="w-full" taille="lg">
      {enCours && <Loader2 size={16} className="animate-spin" aria-hidden />}
      {enCours ? "Un instant…" : children}
    </Bouton>
  );
}

// ---------------------------------------------------------------------------
//  Connexion
// ---------------------------------------------------------------------------
export function FormulaireConnexion({ suivant }: { suivant?: string }) {
  const [etat, action, enCours] = useActionState<EtatAuth, FormData>(
    connecter,
    null,
  );

  return (
    <form action={action} className="space-y-4">
      {suivant && <input type="hidden" name="suivant" value={suivant} />}

      <div>
        <label className="label" htmlFor="email">
          Identifiant ou email
        </label>
        <input
          id="email"
          name="email"
          type="text"
          autoComplete="username"
          required
          placeholder="koffi123 ou directeur@ecole.tg"
          className="input"
        />
        <p className="aide">
          Les professeurs utilisent l&apos;identifiant remis par le directeur.
        </p>
      </div>

      <ChampMotDePasse
        nom="mot_de_passe"
        label="Mot de passe"
        autoComplete="current-password"
        placeholder="Votre mot de passe"
        minLength={1}
      />

      {etat?.captcha && (
        <div className="rounded-sm border border-ochre/30 bg-[#fbf1de] px-3.5 py-3">
          <input
            type="hidden"
            name="captcha_token"
            value={etat.captcha.token}
          />
          <label className="label" htmlFor="captcha_reponse">
            Vérification anti-robot : {etat.captcha.question}
          </label>
          <input
            id="captcha_reponse"
            name="captcha_reponse"
            inputMode="numeric"
            autoComplete="off"
            required
            placeholder="Votre réponse"
            className="input"
          />
          <p className="aide">
            Obligatoire après 3 tentatives incorrectes.
          </p>
        </div>
      )}

      {etat?.error && <Alerte>{etat.error}</Alerte>}

      <div className="flex items-center justify-between gap-3">
        <Link
          href="/mot-de-passe-oublie"
          className="text-[13px] font-medium text-brand underline-offset-4 hover:underline"
        >
          Mot de passe oublié ?
        </Link>
        <span className="text-[12px] text-muted">Session sécurisée</span>
      </div>

      <BoutonSoumettre enCours={enCours}>Se connecter</BoutonSoumettre>
    </form>
  );
}

// ---------------------------------------------------------------------------
//  Inscription
// ---------------------------------------------------------------------------
export function FormulaireInscription() {
  const [etat, action, enCours] = useActionState<EtatAuth, FormData>(
    inscrire,
    null,
  );

  return (
    <form action={action} className="space-y-6">
      <fieldset className="space-y-4">
        <legend className="mb-3 flex items-center gap-2 text-[13px] font-semibold text-ink">
          <span className="grid size-5 place-items-center rounded-full bg-brand text-[10px] font-bold text-white">
            1
          </span>
          Votre école
        </legend>

        <div>
          <label className="label" htmlFor="nom_ecole">
            Nom de l&apos;école
          </label>
          <input
            id="nom_ecole"
            name="nom_ecole"
            required
            placeholder="École Les Palmiers"
            className="input"
          />
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <label className="label" htmlFor="adresse">
              Quartier / adresse
            </label>
            <input
              id="adresse"
              name="adresse"
              placeholder="Agoè, Lomé"
              className="input"
            />
          </div>
          <div>
            <label className="label" htmlFor="telephone">
              Téléphone de l&apos;école
            </label>
            <div className="flex">
              <span className="inline-flex items-center rounded-l-sm border border-r-0 border-line-strong bg-surface-2 px-3 text-[13px] text-muted">
                +228
              </span>
              <input
                id="telephone"
                name="telephone"
                inputMode="tel"
                autoComplete="tel"
                required
                placeholder="90 00 00 00"
                className="input rounded-l-none"
              />
            </div>
            <p className="aide">
              Obligatoire : un seul essai par numéro. Il ne peut pas être
              contourné en changeant d&apos;email.
            </p>
          </div>
        </div>

        <div>
          <label className="label" htmlFor="whatsapp">
            Numéro WhatsApp
          </label>
          <div className="flex">
            <span className="inline-flex items-center rounded-l-sm border border-r-0 border-line-strong bg-surface-2 px-3 text-[13px] text-muted">
              +228
            </span>
            <input
              id="whatsapp"
              name="whatsapp"
              inputMode="tel"
              autoComplete="tel"
              placeholder="Identique au téléphone si vide"
              className="input rounded-l-none"
            />
          </div>
          <p className="aide">
            Laissez vide si c&apos;est le même numéro que le téléphone.
          </p>
        </div>

        <div>
          <label className="label" htmlFor="logo">
            Logo (facultatif)
          </label>
          <input
            id="logo"
            name="logo"
            type="file"
            accept="image/png,image/jpeg,image/webp"
            className="block w-full rounded-sm border border-line-strong bg-surface px-3 py-2 text-[13px] text-muted file:mr-3 file:rounded-sm file:border-0 file:bg-brand-soft file:px-3 file:py-1.5 file:text-[12px] file:font-semibold file:text-brand"
          />
          <p className="aide">PNG, JPG ou WebP · 250 Ko maximum.</p>
        </div>
      </fieldset>

      <div className="border-t border-line" />

      <fieldset className="space-y-4">
        <legend className="mb-3 flex items-center gap-2 text-[13px] font-semibold text-ink">
          <span className="grid size-5 place-items-center rounded-full bg-brand text-[10px] font-bold text-white">
            2
          </span>
          Votre compte directeur
        </legend>

        <div>
          <label className="label" htmlFor="email">
            Email
          </label>
          <input
            id="email"
            name="email"
            type="email"
            autoComplete="email"
            required
            placeholder="vous@ecole.tg"
            className="input"
          />
          <p className="aide">C&apos;est avec cet email que vous vous connecterez.</p>
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <ChampMotDePasse
            nom="mot_de_passe"
            label="Mot de passe"
            autoComplete="new-password"
            placeholder="8 caractères minimum"
          />
          <ChampMotDePasse
            nom="confirmation"
            label="Confirmer"
            autoComplete="new-password"
            placeholder="Répétez le mot de passe"
          />
        </div>
      </fieldset>

      {etat?.error && <Alerte>{etat.error}</Alerte>}

      <div className="rounded-sm border border-line bg-surface-2 px-4 py-3">
        <p className="text-[12.5px] leading-relaxed text-muted">
          <strong className="font-semibold text-ink">30 jours gratuits.</strong>{" "}
          Toutes les fonctions de l&apos;offre PREMIUM sont offertes pendant
          l&apos;essai, sans carte bancaire. Vous choisissez ensuite STARTER, PRO
          ou PREMIUM si l&apos;essai vous convainc.
        </p>
      </div>

      <BoutonSoumettre enCours={enCours}>Ouvrir mon école</BoutonSoumettre>
    </form>
  );
}

// ---------------------------------------------------------------------------
//  Mot de passe oublié
// ---------------------------------------------------------------------------
export function FormulaireMotDePasseOublie() {
  const [etat, action, enCours] = useActionState<EtatAuth, FormData>(
    demanderReinitialisation,
    null,
  );

  return (
    <form action={action} className="space-y-4">
      <div>
        <label className="label" htmlFor="email">
          Email du compte
        </label>
        <input
          id="email"
          name="email"
          type="email"
          autoComplete="email"
          required
          placeholder="vous@ecole.tg"
          className="input"
        />
      </div>

      {etat?.error && <Alerte>{etat.error}</Alerte>}
      {etat?.success && <Alerte ton="succes">{etat.success}</Alerte>}
      {etat?.avertissement && <Alerte ton="info">{etat.avertissement}</Alerte>}
      {etat?.lien && (
        <div className="rounded-sm border border-brand/20 bg-brand-soft p-3">
          <p className="text-[12px] font-semibold text-brand">
            Mode développement — lien direct :
          </p>
          <a
            href={etat.lien}
            className="mt-1 block break-all text-[12px] text-brand underline"
          >
            {etat.lien}
          </a>
        </div>
      )}

      <BoutonSoumettre enCours={enCours}>Recevoir le lien</BoutonSoumettre>
    </form>
  );
}

// ---------------------------------------------------------------------------
//  Nouveau mot de passe
// ---------------------------------------------------------------------------
export function FormulaireReinitialisation({ jeton }: { jeton: string }) {
  const [etat, action, enCours] = useActionState<EtatAuth, FormData>(
    reinitialiserMotDePasse,
    null,
  );

  return (
    <form action={action} className="space-y-4">
      <input type="hidden" name="jeton" value={jeton} />
      <ChampMotDePasse
        nom="mot_de_passe"
        label="Nouveau mot de passe"
        autoComplete="new-password"
        placeholder="8 caractères minimum"
      />
      <ChampMotDePasse
        nom="confirmation"
        label="Confirmer le mot de passe"
        autoComplete="new-password"
        placeholder="Répétez le mot de passe"
      />

      {etat?.error && <Alerte>{etat.error}</Alerte>}

      <BoutonSoumettre enCours={enCours}>Enregistrer le mot de passe</BoutonSoumettre>
    </form>
  );
}
