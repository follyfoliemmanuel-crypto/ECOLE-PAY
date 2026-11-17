"use client";

import { useActionState, useEffect, useRef, useState } from "react";
import {
  KeyRound,
  Loader2,
  ShieldCheck,
  UserPlus,
} from "lucide-react";
import { creerCompteProf, reinitialiserAccesProf } from "@/lib/actions/profs";
import type { Prof, ResultatAction } from "@/lib/types";
import { Bouton } from "@/components/ui/button";
import { Dialogue } from "@/components/ui/dialogue";
import { Alerte } from "@/components/ui/empty-state";

// ---------------------------------------------------------------------------
//  Création d'un compte professeur par le directeur
// ---------------------------------------------------------------------------

export function NouveauCompteProf() {
  const [etat, action, enCours] = useActionState<ResultatAction | null, FormData>(
    creerCompteProf,
    null,
  );
  const formulaire = useRef<HTMLFormElement>(null);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    if (etat?.success) {
      formulaire.current?.reset();
      setVisible(false);
    }
  }, [etat]);

  return (
    <form ref={formulaire} action={action} className="space-y-3.5">
      <div className="grid gap-3 sm:grid-cols-2">
        <div>
          <label className="label" htmlFor="compte-nom">
            Nom complet
          </label>
          <input
            id="compte-nom"
            name="nom_complet"
            required
            maxLength={120}
            placeholder="Koffi AMEGAN"
            className="input h-9"
            autoComplete="off"
          />
        </div>
        <div>
          <label className="label" htmlFor="compte-telephone">
            Téléphone / WhatsApp
          </label>
          <input
            id="compte-telephone"
            name="telephone"
            inputMode="tel"
            placeholder="90 12 34 56"
            className="input h-9"
            autoComplete="off"
          />
        </div>
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        <div>
          <label className="label" htmlFor="compte-identifiant">
            Identifiant de connexion
          </label>
          <input
            id="compte-identifiant"
            name="identifiant"
            required
            minLength={3}
            maxLength={30}
            pattern="[a-z0-9][a-z0-9._\-]{2,29}"
            placeholder="koffi123"
            className="input h-9"
            autoComplete="off"
            autoCapitalize="none"
            spellCheck={false}
          />
          <p className="aide">
            3 à 30 caractères : lettres minuscules, chiffres, point, tiret.
          </p>
        </div>
        <div>
          <label className="label" htmlFor="compte-mot-de-passe">
            Mot de passe
          </label>
          <div className="relative">
            <input
              id="compte-mot-de-passe"
              name="mot_de_passe"
              type={visible ? "text" : "password"}
              required
              minLength={10}
              maxLength={72}
              placeholder="au moins 10 caractères"
              className="input h-9 pr-16"
              autoComplete="new-password"
            />
            <button
              type="button"
              onClick={() => setVisible((actuel) => !actuel)}
              className="absolute right-1.5 top-1/2 -translate-y-1/2 rounded-sm px-2 py-1 text-[11px] font-semibold text-brand hover:bg-brand-soft"
            >
              {visible ? "Cacher" : "Voir"}
            </button>
          </div>
          <p className="aide">
            Donnez-le au professeur : il pourra le garder ou vous demander de le
            changer.
          </p>
        </div>
      </div>

      <div className="rounded-sm border border-brand/15 bg-brand-soft px-3 py-2.5 text-[12px] leading-relaxed text-brand">
        <strong>Pas d&apos;affectation à l&apos;avance.</strong> Le professeur
        choisira lui-même ses classes et ses matières depuis son espace. Il ne
        verra ni les paiements, ni les paramètres, ni les autres écoles.
      </div>

      {etat?.error && <Alerte>{etat.error}</Alerte>}
      {etat?.success && <Alerte ton="succes">{etat.success}</Alerte>}

      <Bouton type="submit" disabled={enCours}>
        {enCours ? (
          <Loader2 size={15} className="animate-spin" aria-hidden />
        ) : (
          <UserPlus size={15} aria-hidden />
        )}
        {enCours ? "Création…" : "Créer le compte professeur"}
      </Bouton>
    </form>
  );
}

// ---------------------------------------------------------------------------
//  Réinitialisation d'un accès existant
// ---------------------------------------------------------------------------

export function ReinitialiserAccesProf({ prof }: { prof: Prof }) {
  const [ouvert, setOuvert] = useState(false);
  const [etat, action, enCours] = useActionState<ResultatAction | null, FormData>(
    reinitialiserAccesProf,
    null,
  );

  useEffect(() => {
    if (etat?.success) {
      const minuteur = setTimeout(() => setOuvert(false), 900);
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
        <KeyRound size={12} aria-hidden />
        {prof.user_id ? "Accès" : "Créer l'accès"}
      </button>

      <Dialogue
        ouvert={ouvert}
        onFermer={() => setOuvert(false)}
        titre={
          prof.user_id
            ? `Accès de ${prof.prenom} ${prof.nom}`
            : `Créer un compte pour ${prof.prenom} ${prof.nom}`
        }
        description={
          prof.user_id
            ? "Modifiez l'identifiant, le mot de passe, ou les deux. La session ouverte est déconnectée."
            : "Cette fiche n'a pas encore de compte de connexion. Créez-en un maintenant."
        }
      >
        <form action={action} className="space-y-3">
          <input type="hidden" name="prof_id" value={prof.id} />

          <div>
            <label className="label" htmlFor={`acces-identifiant-${prof.id}`}>
              Identifiant
            </label>
            <input
              id={`acces-identifiant-${prof.id}`}
              name="identifiant"
              required
              minLength={3}
              maxLength={30}
              pattern="[a-z0-9][a-z0-9._\-]{2,29}"
              defaultValue={prof.identifiant ?? ""}
              placeholder="koffi123"
              className="input h-9"
              autoComplete="off"
              autoCapitalize="none"
              spellCheck={false}
            />
          </div>

          <div>
            <label className="label" htmlFor={`acces-mdp-${prof.id}`}>
              {prof.user_id ? "Nouveau mot de passe (facultatif)" : "Mot de passe"}
            </label>
            <input
              id={`acces-mdp-${prof.id}`}
              name="mot_de_passe"
              type="password"
              minLength={10}
              maxLength={72}
              required={!prof.user_id}
              placeholder={
                prof.user_id ? "Laisser vide pour conserver l'actuel" : "au moins 10 caractères"
              }
              className="input h-9"
              autoComplete="new-password"
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
                <Loader2 size={15} className="animate-spin" aria-hidden />
              ) : (
                <ShieldCheck size={15} aria-hidden />
              )}
              Enregistrer l&apos;accès
            </Bouton>
          </div>
        </form>
      </Dialogue>
    </>
  );
}
