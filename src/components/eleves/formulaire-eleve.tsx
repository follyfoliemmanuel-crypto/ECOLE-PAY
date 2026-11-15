"use client";

import Link from "next/link";
import { useActionState, useEffect, useRef, useState } from "react";
import { Loader2, Save, UserPlus } from "lucide-react";
import { creerEleve, modifierEleve } from "@/lib/actions/eleves";
import { formatFCFA } from "@/lib/format";
import {
  LIBELLES_FREQUENCE_COURT,
  nombrePeriodes,
  suffixePeriode,
} from "@/lib/periodes";
import type { Classe, ResultatAction } from "@/lib/types";
import { Alerte } from "@/components/ui/empty-state";
import { Bouton } from "@/components/ui/button";
import { cx } from "@/lib/cx";

export function FormulaireEleve({
  classes,
  eleve,
  annee,
}: {
  classes: Classe[];
  eleve?: {
    id: string;
    nom: string;
    prenom: string;
    sexe: "M" | "F" | null;
    classe_id: string;
    nom_parent: string;
    telephone_parent: string;
    type_inscription: "NOUVEAU" | "ANCIEN";
    photo_url: string | null;
  };
  annee: string;
}) {
  const creation = !eleve;
  const [etat, action, enCours] = useActionState<ResultatAction | null, FormData>(
    creation ? creerEleve : modifierEleve,
    null,
  );
  const formulaire = useRef<HTMLFormElement>(null);
  const [classeId, setClasseId] = useState(eleve?.classe_id ?? classes[0]?.id ?? "");
  const [typeInscription, setTypeInscription] = useState<"NOUVEAU" | "ANCIEN">(
    eleve?.type_inscription ?? "NOUVEAU",
  );
  const [message, setMessage] = useState<string>();
  const [photo, setPhoto] = useState<string | null>(eleve?.photo_url ?? null);
  const [retirerPhoto, setRetirerPhoto] = useState(false);

  useEffect(() => {
    if (!etat?.success) return;
    setMessage(etat.success);
    if (creation) {
      formulaire.current?.reset();
      setClasseId(classes[0]?.id ?? "");
      setTypeInscription("NOUVEAU");
      setPhoto(null);
      setRetirerPhoto(false);
    }
  }, [etat, creation, classes]);

  const classe = classes.find((c) => c.id === classeId);
  const fraisEntree =
    typeInscription === "ANCIEN"
      ? (classe?.frais_reinscription ?? 0)
      : (classe?.frais_inscription ?? 0);
  const tranches = classe?.tranches ?? [];
  const totalTranches = tranches.reduce(
    (somme, tranche) => somme + tranche.montant,
    0,
  );

  return (
    <form
      ref={formulaire}
      action={action}
      className="space-y-5"
      onChange={() => setMessage(undefined)}
    >
      {eleve && <input type="hidden" name="id" value={eleve.id} />}

      {etat?.error && <Alerte>{etat.error}</Alerte>}
      {message && <Alerte ton="succes">{message}</Alerte>}

      <div className="flex flex-col gap-3 rounded-sm border border-line bg-surface-2 p-4 sm:flex-row sm:items-start">
        {photo && !retirerPhoto ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={photo}
            alt=""
            className="size-16 shrink-0 rounded-md border border-line bg-white object-cover"
          />
        ) : (
          <span className="grid size-16 shrink-0 place-items-center rounded-md border border-dashed border-line-strong bg-surface text-[10px] text-muted">
            Photo
          </span>
        )}

        <div className="min-w-0 flex-1">
          <label className="label" htmlFor="photo">
            Photo de l&apos;élève{" "}
            <span className="font-normal normal-case tracking-normal text-muted">
              (facultative)
            </span>
          </label>
          <input
            id="photo"
            name="photo"
            type="file"
            accept="image/png,image/jpeg,image/webp"
            onChange={(evenement) => {
              const fichier = evenement.target.files?.[0];
              setRetirerPhoto(false);
              setPhoto(fichier ? URL.createObjectURL(fichier) : (eleve?.photo_url ?? null));
            }}
            className="block w-full cursor-pointer text-[12px] text-muted file:mr-3 file:cursor-pointer file:rounded-sm file:border file:border-line-strong file:bg-surface file:px-3 file:py-1.5 file:text-[12px] file:font-semibold file:text-ink hover:file:bg-surface-2"
          />
          <p className="aide">
            PNG, JPG ou WebP · 200 Ko maximum. La photo apparaît sur le portail
            parent, uniquement aux côtés des notes de cet élève.
          </p>

          <input
            type="hidden"
            name="supprimer_photo"
            value={retirerPhoto ? "1" : "0"}
          />
          {(eleve?.photo_url || photo) && (
            <button
              type="button"
              onClick={() => {
                setRetirerPhoto((valeur) => !valeur);
                if (!retirerPhoto) setPhoto(null);
                else setPhoto(eleve?.photo_url ?? null);
              }}
              className="mt-1 text-[11px] font-semibold text-impaye hover:underline"
            >
              {retirerPhoto ? "Conserver la photo" : "Retirer la photo"}
            </button>
          )}
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <label className="label" htmlFor="prenom">
            Prénom
          </label>
          <input
            id="prenom"
            name="prenom"
            required
            defaultValue={eleve?.prenom}
            placeholder="Kossi"
            className="input"
            autoComplete="off"
          />
        </div>
        <div>
          <label className="label" htmlFor="nom">
            Nom
          </label>
          <input
            id="nom"
            name="nom"
            required
            defaultValue={eleve?.nom}
            placeholder="Adjovi"
            className="input"
            autoComplete="off"
          />
        </div>
      </div>

      <fieldset>
        <legend className="label">Sexe</legend>
        <div className="flex gap-2">
          {[
            { valeur: "M", libelle: "Masculin" },
            { valeur: "F", libelle: "Féminin" },
          ].map((option) => (
            <label
              key={option.valeur}
              className={cx(
                "flex h-10 flex-1 cursor-pointer items-center justify-center gap-2 rounded-sm border text-[13px] font-medium transition-colors",
                "has-[:checked]:border-brand has-[:checked]:bg-brand-soft has-[:checked]:text-brand",
                "border-line-strong bg-surface text-ink-2 hover:bg-surface-2",
              )}
            >
              <input
                type="radio"
                name="sexe"
                value={option.valeur}
                defaultChecked={
                  eleve?.sexe ? eleve.sexe === option.valeur : option.valeur === "M"
                }
                className="sr-only"
                required
              />
              {option.libelle}
            </label>
          ))}
        </div>
      </fieldset>

      <fieldset>
        <legend className="label">Type d&apos;inscription</legend>
        <div className="grid grid-cols-2 gap-2">
          {[
            {
              valeur: "NOUVEAU" as const,
              libelle: "Nouvel élève",
              detail: "Frais d'inscription",
            },
            {
              valeur: "ANCIEN" as const,
              libelle: "Ancien élève",
              detail: "Frais de réinscription",
            },
          ].map((option) => (
            <label
              key={option.valeur}
              className={cx(
                "flex cursor-pointer flex-col rounded-sm border px-3 py-2.5 transition-colors",
                typeInscription === option.valeur
                  ? "border-brand bg-brand-soft text-brand"
                  : "border-line-strong bg-surface text-ink-2 hover:bg-surface-2",
              )}
            >
              <input
                type="radio"
                name="type_inscription"
                value={option.valeur}
                checked={typeInscription === option.valeur}
                onChange={() => setTypeInscription(option.valeur)}
                className="sr-only"
              />
              <span className="text-[12.5px] font-semibold">{option.libelle}</span>
              <span className="text-[10px] opacity-70">{option.detail}</span>
            </label>
          ))}
        </div>
      </fieldset>

      <div>
        <label className="label" htmlFor="classe_id">
          Classe
        </label>
        <select
          id="classe_id"
          name="classe_id"
          required
          value={classeId}
          onChange={(evenement) => setClasseId(evenement.target.value)}
          className="input"
        >
          {classes.map((option) => (
            <option key={option.id} value={option.id}>
              {option.nom} —{" "}
              {option.frequence_paiement === "TRANCHES"
                ? `${option.tranches?.length ?? 0} tranche${
                    (option.tranches?.length ?? 0) > 1 ? "s" : ""
                  }`
                : `${formatFCFA(option.montant_periode)}${suffixePeriode(
                    option.frequence_paiement,
                  )}`}
            </option>
          ))}
        </select>
        {classe && (
          <div className="aide space-y-1">
            {classe.frequence_paiement === "TRANCHES" ? (
              <p>
                Scolarité par tranches :{" "}
                <strong className="text-ink">{formatFCFA(totalTranches)}</strong>{" "}
                en {tranches.length} tranche{tranches.length > 1 ? "s" : ""} pour{" "}
                {annee}.
              </p>
            ) : (
              <p>
                Scolarité{" "}
                {LIBELLES_FREQUENCE_COURT[
                  classe.frequence_paiement
                ].toLowerCase()}{" "}
                :{" "}
                <strong className="text-ink">
                  {formatFCFA(classe.montant_periode)}
                  {suffixePeriode(classe.frequence_paiement)}
                </strong>{" "}
                · {nombrePeriodes(classe.frequence_paiement)} échéance
                {nombrePeriodes(classe.frequence_paiement) > 1 ? "s" : ""} pour{" "}
                {annee}.
              </p>
            )}
            {classe.frequence_paiement === "TRANCHES" && tranches.length > 0 && (
              <ul className="mt-1 space-y-0.5 text-[11px] text-muted">
                {tranches.map((tranche) => (
                  <li key={tranche.id} className="flex justify-between gap-2">
                    <span>
                      {tranche.nom}
                      {tranche.date_limite ? ` · ${tranche.date_limite}` : ""}
                    </span>
                    <span className="font-medium text-ink-2">
                      {formatFCFA(tranche.montant)}
                    </span>
                  </li>
                ))}
              </ul>
            )}
            <p>
              {typeInscription === "ANCIEN" ? "Réinscription" : "Inscription"} :{" "}
              <strong className="text-ink">
                {fraisEntree > 0 ? formatFCFA(fraisEntree) : "gratuite"}
              </strong>
              . L&apos;élève est inscrit dès que ces frais sont soldés.
            </p>
          </div>
        )}
      </div>

      <div className="border-t border-line pt-5">
        <p className="mb-4 text-[12px] font-semibold uppercase tracking-[0.1em] text-muted">
          Parent / tuteur
        </p>

        <div className="space-y-4">
          <div>
            <label className="label" htmlFor="nom_parent">
              Nom du parent
            </label>
            <input
              id="nom_parent"
              name="nom_parent"
              required
              defaultValue={eleve?.nom_parent}
              placeholder="Mme Akossiwa Adjovi"
              className="input"
              autoComplete="off"
            />
          </div>

          <div>
            <label className="label" htmlFor="telephone_parent">
              Téléphone WhatsApp
            </label>
            <div className="flex">
              <span className="inline-flex items-center rounded-l-sm border border-r-0 border-line-strong bg-surface-2 px-3 text-[13px] text-muted">
                +228
              </span>
              <input
                id="telephone_parent"
                name="telephone_parent"
                required
                inputMode="numeric"
                defaultValue={eleve?.telephone_parent}
                placeholder="90 12 34 56"
                className="input rounded-l-none"
                autoComplete="off"
              />
            </div>
            <p className="aide">
              Numéro togolais à 8 chiffres (90, 91, 92, 93, 70 ou 99). C&apos;est
              sur ce numéro que partent les reçus et les rappels.
            </p>
          </div>
        </div>
      </div>

      <div className="flex flex-col-reverse gap-2 border-t border-line pt-5 sm:flex-row sm:justify-end">
        <Link
          href="/app/eleves"
          className="inline-flex h-10 items-center justify-center rounded-sm border border-line-strong px-4 text-[13px] font-semibold text-ink hover:bg-surface-2"
        >
          Retour à la liste
        </Link>
        <Bouton type="submit" disabled={enCours} taille="md">
          {enCours ? (
            <Loader2 size={15} className="animate-spin" aria-hidden />
          ) : creation ? (
            <UserPlus size={15} aria-hidden />
          ) : (
            <Save size={15} aria-hidden />
          )}
          {enCours ? "Enregistrement…" : creation ? "Ajouter l'élève" : "Enregistrer"}
        </Bouton>
      </div>
    </form>
  );
}
