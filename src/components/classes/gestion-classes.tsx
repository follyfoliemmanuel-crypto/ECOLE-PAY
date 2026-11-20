"use client";

import { useActionState, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2, Pencil, Plus, Save, Trash2 } from "lucide-react";
import { creerClasse, modifierClasse } from "@/lib/actions/classes";
import {
  FREQUENCES,
  LIBELLES_FREQUENCE,
  suffixePeriode,
} from "@/lib/periodes";
import { formatFCFA } from "@/lib/format";
import type {
  Classe,
  ExamenNational,
  Frequence,
  ResultatAction,
  TypeFinClasse,
} from "@/lib/types";
import { Bouton } from "@/components/ui/button";
import { Alerte } from "@/components/ui/empty-state";
import { Dialogue } from "@/components/ui/dialogue";
import { cx } from "@/lib/cx";

const suffixe = (
  <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-[11px] font-medium text-muted">
    FCFA
  </span>
);

/** Une ligne du formulaire de tranches (montants en texte pour la saisie). */
type LigneTranche = {
  nom: string;
  montant: string;
  date_limite: string;
};

const TRANCHES_DEFAUT: LigneTranche[] = [
  { nom: "Tranche 1", montant: "", date_limite: "" },
  { nom: "Tranche 2", montant: "", date_limite: "" },
  { nom: "Tranche 3", montant: "", date_limite: "" },
];

const MAX_TRANCHES = 20;

function libelleMontant(frequence: Frequence): string {
  return frequence === "ANNUEL" ? "Montant annuel" : "Montant mensuel";
}

function lignesDepuisClasse(classe: Classe): LigneTranche[] {
  const tranches = classe.tranches ?? [];
  if (tranches.length === 0) return TRANCHES_DEFAUT;
  return tranches.map((tranche) => ({
    nom: tranche.nom,
    montant: String(tranche.montant),
    date_limite: tranche.date_limite ?? "",
  }));
}

function nombreSaisi(valeur: string): number {
  const chiffres = valeur.replace(/[^\d]/g, "");
  const nombre = Number.parseInt(chiffres, 10);
  return Number.isFinite(nombre) ? nombre : 0;
}

/** Champ caché : la Server Action reçoit la liste en JSON. */
function tranchesJson(lignes: LigneTranche[]): string {
  return JSON.stringify(
    lignes.map((ligne) => ({
      nom: ligne.nom.trim(),
      montant: nombreSaisi(ligne.montant),
      date_limite: ligne.date_limite || null,
    })),
  );
}

function ChoixFrequence({
  valeur,
  onChange,
  idPrefix,
}: {
  valeur: Frequence;
  onChange: (frequence: Frequence) => void;
  idPrefix: string;
}) {
  return (
    <div className="grid grid-cols-3 gap-1.5">
      {FREQUENCES.map((option) => (
        <label
          key={option.valeur}
          htmlFor={`${idPrefix}-${option.valeur}`}
          className={cx(
            "flex cursor-pointer flex-col rounded-sm border px-2.5 py-2 transition-colors",
            valeur === option.valeur
              ? "border-brand bg-brand-soft text-brand"
              : "border-line-strong bg-surface text-ink-2 hover:bg-surface-2",
          )}
        >
          <input
            id={`${idPrefix}-${option.valeur}`}
            type="radio"
            name="frequence_paiement"
            value={option.valeur}
            checked={valeur === option.valeur}
            onChange={() => onChange(option.valeur)}
            className="sr-only"
          />
          <span className="text-[12px] font-semibold">{option.libelle}</span>
          <span className="text-[9.5px] opacity-70">
            {option.valeur === "TRANCHES"
              ? "2, 3, 4… tranches"
              : `${option.nbPeriodes} période${option.nbPeriodes > 1 ? "s" : ""} / an`}
          </span>
        </label>
      ))}
    </div>
  );
}

function EditeurTranches({
  lignes,
  onChange,
  idPrefix,
}: {
  lignes: LigneTranche[];
  onChange: (lignes: LigneTranche[]) => void;
  idPrefix: string;
}) {
  const total = useMemo(
    () => lignes.reduce((somme, ligne) => somme + nombreSaisi(ligne.montant), 0),
    [lignes],
  );

  function modifier(index: number, champ: keyof LigneTranche, valeur: string) {
    onChange(
      lignes.map((ligne, position) =>
        position === index ? { ...ligne, [champ]: valeur } : ligne,
      ),
    );
  }

  function ajouter() {
    if (lignes.length >= MAX_TRANCHES) return;
    onChange([
      ...lignes,
      { nom: `Tranche ${lignes.length + 1}`, montant: "", date_limite: "" },
    ]);
  }

  function retirer(index: number) {
    if (lignes.length <= 1) return;
    onChange(lignes.filter((_, position) => position !== index));
  }

  return (
    <div className="space-y-2">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <p className="label mb-0">Tranches de scolarité</p>
        <p className="text-[11.5px] text-muted">
          Total scolarité :{" "}
          <span className="font-semibold text-ink">{formatFCFA(total)}</span>
        </p>
      </div>

      <div className="hidden gap-2 px-1 text-[10.5px] font-semibold uppercase tracking-wide text-muted sm:grid sm:grid-cols-[1.2fr_1fr_1fr_32px]">
        <span>Nom de la tranche</span>
        <span>Montant</span>
        <span>Date limite</span>
        <span />
      </div>

      <div className="space-y-2">
        {lignes.map((ligne, index) => (
          <div
            key={index}
            className="grid gap-2 rounded-sm border border-line bg-surface-2/40 p-2 sm:grid-cols-[1.2fr_1fr_1fr_32px] sm:items-center sm:border-0 sm:bg-transparent sm:p-0"
          >
            <div>
              <label
                className="label mb-0.5 sm:sr-only"
                htmlFor={`${idPrefix}-tranche-nom-${index}`}
              >
                Nom
              </label>
              <input
                id={`${idPrefix}-tranche-nom-${index}`}
                value={ligne.nom}
                onChange={(evenement) =>
                  modifier(index, "nom", evenement.target.value)
                }
                placeholder={`Tranche ${index + 1}`}
                className="input h-9"
                autoComplete="off"
                maxLength={80}
              />
            </div>
            <div>
              <label
                className="label mb-0.5 sm:sr-only"
                htmlFor={`${idPrefix}-tranche-montant-${index}`}
              >
                Montant
              </label>
              <div className="relative">
                <input
                  id={`${idPrefix}-tranche-montant-${index}`}
                  value={ligne.montant}
                  onChange={(evenement) =>
                    modifier(index, "montant", evenement.target.value)
                  }
                  inputMode="numeric"
                  placeholder="60 000"
                  className="input h-9 pr-14"
                  autoComplete="off"
                />
                {suffixe}
              </div>
            </div>
            <div>
              <label
                className="label mb-0.5 sm:sr-only"
                htmlFor={`${idPrefix}-tranche-date-${index}`}
              >
                Date limite
              </label>
              <input
                id={`${idPrefix}-tranche-date-${index}`}
                type="date"
                value={ligne.date_limite}
                onChange={(evenement) =>
                  modifier(index, "date_limite", evenement.target.value)
                }
                className="input h-9"
              />
            </div>
            <button
              type="button"
              onClick={() => retirer(index)}
              disabled={lignes.length <= 1}
              className="inline-flex h-9 items-center justify-center gap-1 rounded-sm border border-line-strong px-2 text-[11px] font-semibold text-muted transition-colors hover:border-danger/40 hover:bg-danger-soft hover:text-danger disabled:cursor-not-allowed disabled:opacity-40"
              title="Retirer cette tranche"
            >
              <Trash2 size={13} aria-hidden />
              <span className="sm:hidden">Retirer</span>
            </button>
          </div>
        ))}
      </div>

      <div className="flex flex-wrap items-center justify-between gap-2 pt-1">
        <button
          type="button"
          onClick={ajouter}
          disabled={lignes.length >= MAX_TRANCHES}
          className="inline-flex h-8 items-center gap-1.5 rounded-sm border border-dashed border-line-strong px-2.5 text-[11.5px] font-semibold text-ink transition-colors hover:border-brand hover:bg-brand-soft hover:text-brand disabled:opacity-40"
        >
          <Plus size={13} aria-hidden />
          Ajouter une tranche
        </button>
        <p className="text-[10.5px] text-muted">
          {lignes.length} tranche{lignes.length > 1 ? "s" : ""} · maximum{" "}
          {MAX_TRANCHES}
        </p>
      </div>

      <p className="aide">
        Exemple : 1<sup>re</sup> tranche 60 000 F en octobre, 2<sup>e</sup> tranche
        40 000 F en janvier, 3<sup>e</sup> tranche 30 000 F en mars. Chaque école
        choisit ses noms, montants et dates.
      </p>
    </div>
  );
}

function ChampFinCycle({
  idPrefix,
  classes,
  classeId,
  typeFin,
  setTypeFin,
  examen,
  setExamen,
  suivante,
  setSuivante,
}: {
  idPrefix: string;
  classes: Classe[];
  classeId?: string;
  typeFin: TypeFinClasse;
  setTypeFin: (valeur: TypeFinClasse) => void;
  examen: ExamenNational | "";
  setExamen: (valeur: ExamenNational | "") => void;
  suivante: string;
  setSuivante: (valeur: string) => void;
}) {
  return (
    <div className="space-y-3 rounded-sm border border-line bg-surface-2/50 p-3">
      <p className="label mb-0">Fin de cycle</p>

      <div className="grid grid-cols-2 gap-1.5">
        {[
          {
            valeur: "NORMALE" as const,
            libelle: "Classe normale",
            detail: "Promotion selon la moyenne",
          },
          {
            valeur: "EXAMEN" as const,
            libelle: "Classe d'examen",
            detail: "Décision du directeur",
          },
        ].map((option) => (
          <label
            key={option.valeur}
            htmlFor={`${idPrefix}-fin-${option.valeur}`}
            className={cx(
              "flex cursor-pointer flex-col rounded-sm border px-2.5 py-2 transition-colors",
              typeFin === option.valeur
                ? "border-brand bg-brand-soft text-brand"
                : "border-line-strong bg-surface text-ink-2 hover:bg-surface-2",
            )}
          >
            <input
              id={`${idPrefix}-fin-${option.valeur}`}
              type="radio"
              name="type_fin"
              value={option.valeur}
              checked={typeFin === option.valeur}
              onChange={() => setTypeFin(option.valeur)}
              className="sr-only"
            />
            <span className="text-[12px] font-semibold">{option.libelle}</span>
            <span className="text-[9.5px] opacity-70">{option.detail}</span>
          </label>
        ))}
      </div>

      {typeFin === "EXAMEN" && (
        <div>
          <label className="label" htmlFor={`${idPrefix}-examen`}>
            Examen national préparé
          </label>
          <select
            id={`${idPrefix}-examen`}
            name="examen"
            className="input"
            value={examen}
            onChange={(evenement) =>
              setExamen(evenement.target.value as ExamenNational | "")
            }
          >
            <option value="">Choisir…</option>
            <option value="CEPD">CEPD (CM2)</option>
            <option value="BEPC">BEPC (3ème)</option>
            <option value="BAC">BAC (Terminale)</option>
          </select>
        </div>
      )}

      <div>
        <label className="label" htmlFor={`${idPrefix}-suivante`}>
          Classe suivante après réussite
        </label>
        <select
          id={`${idPrefix}-suivante`}
          name="classe_suivante_id"
          className="input"
          value={suivante}
          onChange={(evenement) => setSuivante(evenement.target.value)}
        >
          <option value="">Fin de cycle (diplôme)</option>
          {classes
            .filter((classe) => classe.id !== classeId)
            .map((classe) => (
              <option key={classe.id} value={classe.id}>
                {classe.nom}
              </option>
            ))}
        </select>
        <p className="aide">
          En fin de cycle, un élève admis est diplômé. Sinon, il rejoint la
          classe choisie à la clôture.
        </p>
      </div>
    </div>
  );
}

export function NouvelleClasse({ classes = [] }: { classes?: Classe[] }) {
  const [etat, action, enCours] = useActionState<ResultatAction | null, FormData>(
    creerClasse,
    null,
  );
  const formulaire = useRef<HTMLFormElement>(null);
  const [frequence, setFrequence] = useState<Frequence>("MENSUEL");
  const [tranches, setTranches] = useState<LigneTranche[]>(TRANCHES_DEFAUT);
  const [typeFin, setTypeFin] = useState<TypeFinClasse>("NORMALE");
  const [examen, setExamen] = useState<ExamenNational | "">("");
  const [suivante, setSuivante] = useState("");

  useEffect(() => {
    if (etat?.success) {
      formulaire.current?.reset();
      setFrequence("MENSUEL");
      setTranches(TRANCHES_DEFAUT);
      setTypeFin("NORMALE");
      setExamen("");
      setSuivante("");
    }
  }, [etat]);

  return (
    <form ref={formulaire} action={action} className="space-y-4">
      <input type="hidden" name="tranches" value={tranchesJson(tranches)} />

      <div className="grid gap-3 sm:grid-cols-[1fr_200px]">
        <div>
          <label className="label" htmlFor="nom-classe">
            Nom de la classe
          </label>
          <input
            id="nom-classe"
            name="nom"
            required
            placeholder="6ème A, Terminale D…"
            className="input"
            autoComplete="off"
          />
        </div>
        {frequence !== "TRANCHES" && (
          <div>
            <label className="label" htmlFor="montant-classe">
              {libelleMontant(frequence)}
            </label>
            <div className="relative">
              <input
                id="montant-classe"
                name="montant_periode"
                required
                inputMode="numeric"
                placeholder="25 000"
                className="input pr-14"
                autoComplete="off"
              />
              {suffixe}
            </div>
            <p className="aide">
              Tarif d&apos;une seule période{suffixePeriode(frequence)}.
            </p>
          </div>
        )}
      </div>

      <div>
        <p className="label">Fréquence de paiement</p>
        <ChoixFrequence
          valeur={frequence}
          onChange={setFrequence}
          idPrefix="nouvelle-classe"
        />
        <p className="aide">
          {frequence === "MENSUEL"
            ? "10 échéances seront créées : Septembre → Juin."
            : frequence === "TRANCHES"
              ? "Une échéance sera créée pour chaque tranche définie ci-dessous."
              : "1 seule échéance couvrira toute l'année scolaire."}
        </p>
      </div>

      {frequence === "TRANCHES" && (
        <EditeurTranches
          lignes={tranches}
          onChange={setTranches}
          idPrefix="nouvelle-classe"
        />
      )}

      <div className="grid gap-3 sm:grid-cols-2">
        <div>
          <label className="label" htmlFor="frais-inscription">
            Frais d&apos;inscription
          </label>
          <div className="relative">
            <input
              id="frais-inscription"
              name="frais_inscription"
              inputMode="numeric"
              placeholder="0"
              className="input pr-14"
              autoComplete="off"
            />
            {suffixe}
          </div>
          <p className="aide">
            Payés une fois, par les nouveaux élèves uniquement. Laissez 0 si
            gratuit.
          </p>
        </div>
      </div>

      <ChampFinCycle
        idPrefix="nouvelle-classe"
        classes={classes}
        typeFin={typeFin}
        setTypeFin={setTypeFin}
        examen={examen}
        setExamen={setExamen}
        suivante={suivante}
        setSuivante={setSuivante}
      />

      {etat?.error && <Alerte>{etat.error}</Alerte>}
      {etat?.success && <Alerte ton="succes">{etat.success}</Alerte>}

      <Bouton type="submit" disabled={enCours}>
        {enCours ? (
          <Loader2 size={15} className="animate-spin" aria-hidden />
        ) : (
          <Plus size={15} strokeWidth={2.4} aria-hidden />
        )}
        {enCours ? "Création…" : "Créer la classe"}
      </Bouton>
    </form>
  );
}

export function ModifierClasse({
  classe,
  classes = [],
}: {
  classe: Classe;
  classes?: Classe[];
}) {
  const router = useRouter();
  const [ouvert, setOuvert] = useState(false);
  const [afficherSucces, setAfficherSucces] = useState(false);
  const [frequence, setFrequence] = useState<Frequence>(
    classe.frequence_paiement,
  );
  const [tranches, setTranches] = useState<LigneTranche[]>(
    lignesDepuisClasse(classe),
  );
  const [typeFin, setTypeFin] = useState<TypeFinClasse>(classe.type_fin);
  const [examen, setExamen] = useState<ExamenNational | "">(
    classe.examen ?? "",
  );
  const [suivante, setSuivante] = useState(classe.classe_suivante_id ?? "");
  const [etat, action, enCours] = useActionState<ResultatAction | null, FormData>(
    modifierClasse,
    null,
  );

  useEffect(() => {
    if (etat?.success) {
      setAfficherSucces(true);
      router.refresh();
      const minuteur = setTimeout(() => {
        setOuvert(false);
        setAfficherSucces(false);
      }, 900);
      return () => clearTimeout(minuteur);
    }
  }, [etat, router]);

  function reinitialiser() {
    setFrequence(classe.frequence_paiement);
    setTranches(lignesDepuisClasse(classe));
    setTypeFin(classe.type_fin);
    setExamen(classe.examen ?? "");
    setSuivante(classe.classe_suivante_id ?? "");
  }

  return (
    <>
      <button
        type="button"
        onClick={() => {
          setOuvert(true);
          setAfficherSucces(false);
          reinitialiser();
        }}
        className="inline-flex h-8 items-center gap-1.5 rounded-sm border border-line-strong px-2.5 text-[11.5px] font-semibold text-ink transition-colors hover:bg-surface-2"
      >
        <Pencil size={12} aria-hidden />
        Modifier
      </button>

      <Dialogue
        ouvert={ouvert}
        onFermer={() => setOuvert(false)}
        titre={`Modifier ${classe.nom}`}
        description="Les nouveaux montants s'appliquent aux échéances non encore payées. Les paiements déjà encaissés ne changent pas."
      >
        <form action={action} className="space-y-4">
          <input type="hidden" name="id" value={classe.id} />
          <input type="hidden" name="tranches" value={tranchesJson(tranches)} />

          <div>
            <label className="label" htmlFor={`nom-${classe.id}`}>
              Nom de la classe
            </label>
            <input
              id={`nom-${classe.id}`}
              name="nom"
              required
              defaultValue={classe.nom}
              className="input"
            />
          </div>

          <div>
            <p className="label">Fréquence de paiement</p>
            <ChoixFrequence
              valeur={frequence}
              onChange={setFrequence}
              idPrefix={`classe-${classe.id}`}
            />
          </div>

          {frequence === "TRANCHES" ? (
            <EditeurTranches
              lignes={tranches}
              onChange={setTranches}
              idPrefix={`classe-${classe.id}`}
            />
          ) : (
            <div className="grid gap-3 sm:grid-cols-[1fr_1fr]">
              <div>
                <label className="label" htmlFor={`montant-${classe.id}`}>
                  {libelleMontant(frequence)}
                </label>
                <div className="relative">
                  <input
                    id={`montant-${classe.id}`}
                    name="montant_periode"
                    required
                    inputMode="numeric"
                    defaultValue={classe.montant_periode}
                    className="input pr-14"
                  />
                  {suffixe}
                </div>
                <p className="aide">
                  Tarif d&apos;une seule période{suffixePeriode(frequence)}.
                </p>
              </div>
            </div>
          )}

          <div className="grid gap-3 sm:grid-cols-2">
            <div>
              <label className="label" htmlFor={`inscription-${classe.id}`}>
                Frais d&apos;inscription
              </label>
              <div className="relative">
                <input
                  id={`inscription-${classe.id}`}
                  name="frais_inscription"
                  inputMode="numeric"
                  defaultValue={classe.frais_inscription}
                  className="input pr-14"
                />
                {suffixe}
              </div>
              <p className="aide">
                Payés une fois, par les nouveaux élèves uniquement.
              </p>
            </div>
          </div>

          <ChampFinCycle
            idPrefix={`classe-${classe.id}`}
            classes={classes}
            classeId={classe.id}
            typeFin={typeFin}
            setTypeFin={setTypeFin}
            examen={examen}
            setExamen={setExamen}
            suivante={suivante}
            setSuivante={setSuivante}
          />

          {etat?.error && <Alerte>{etat.error}</Alerte>}
          {afficherSucces && etat?.success && <Alerte ton="succes">{etat.success}</Alerte>}

          <div className="flex flex-col-reverse gap-2 pt-1 sm:flex-row sm:justify-end">
            <Bouton type="button" variante="secondaire" onClick={() => setOuvert(false)}>
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
