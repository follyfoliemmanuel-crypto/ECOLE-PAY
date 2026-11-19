"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useRef, useState, useTransition } from "react";
import {
  AlertTriangle,
  Banknote,
  CalendarDays,
  Check,
  CheckCircle2,
  Loader2,
  MessageCircle,
  Printer,
  Search,
  Smartphone,
  Wallet,
  X,
} from "lucide-react";
import { enregistrerPaiement } from "@/lib/actions/paiements";
import { libelleAnnee } from "@/lib/mois";
import {
  libelleEcheance,
  libelleNature,
} from "@/lib/periodes";
import {
  dateInput,
  formatDateHeure,
  formatF,
  formatNombre,
  formatTelephone,
  initiales,
} from "@/lib/format";
import {
  LIBELLES_MODE,
  type EleveOption,
  type ElevePaiement,
  type FraisPeriode,
  type Frequence,
  type ModePaiement,
  type ResultatPaiement,
} from "@/lib/types";
import { Bouton } from "@/components/ui/button";
import { Alerte } from "@/components/ui/empty-state";
import { cx } from "@/lib/cx";

const MODES: {
  valeur: ModePaiement;
  libelle: string;
  detail: string;
  icone: typeof Banknote;
}[] = [
  { valeur: "ESPECES", libelle: "Espèces", detail: "Caisse", icone: Banknote },
  { valeur: "FLOOZ", libelle: "Flooz", detail: "Transfert", icone: Smartphone },
  { valeur: "TMONEY", libelle: "TMoney", detail: "Transfert", icone: Smartphone },
];

/**
 * Échéances encore dues, les frais d'inscription / réinscription en tête.
 * L'élève peut régler une période de scolarité ou ses frais d'entrée.
 */
function fraisDus(eleve: ElevePaiement): FraisPeriode[] {
  return eleve.frais
    .filter((frais) => frais.reste > 0)
    .slice()
    .sort((a, b) => {
      const specialA = a.type_frais === "SCOLARITE" ? 1 : 0;
      const specialB = b.type_frais === "SCOLARITE" ? 1 : 0;
      if (specialA !== specialB) return specialA - specialB;
      return a.periode - b.periode;
    });
}

function choisirFrais(
  eleve: ElevePaiement,
  prefere?: string,
): FraisPeriode | null {
  const dus = fraisDus(eleve);
  return dus.find((frais) => frais.id === prefere) ?? dus[0] ?? null;
}

export function FormulairePaiement({
  eleveInitial,
  fraisInitial,
  annee,
  utilisateurNom,
  ecole,
}: {
  eleveInitial: ElevePaiement | null;
  fraisInitial?: string;
  annee: string;
  utilisateurNom: string;
  ecole: { nom: string; adresse: string | null; telephone: string | null };
}) {
  const router = useRouter();
  const cache = useRef(new Map<string, ElevePaiement>());

  const premierFrais = useMemo(
    () => (eleveInitial ? choisirFrais(eleveInitial, fraisInitial) : null),
    [eleveInitial, fraisInitial],
  );

  const [eleve, setEleve] = useState<ElevePaiement | null>(eleveInitial);
  const [fraisChoisi, setFraisChoisi] = useState<string | null>(
    premierFrais?.id ?? null,
  );
  const [montant, setMontant] = useState(premierFrais ? String(premierFrais.reste) : "");
  const [mode, setMode] = useState<ModePaiement>("ESPECES");
  const [date, setDate] = useState(dateInput());
  const [erreur, setErreur] = useState<string>();
  const [resultat, setResultat] = useState<ResultatPaiement | null>(null);

  // Recherche
  const [recherche, setRecherche] = useState("");
  const [resultats, setResultats] = useState<EleveOption[]>([]);
  const [rechercheOuverte, setRechercheOuverte] = useState(false);
  const [chargementRecherche, setChargementRecherche] = useState(false);
  const [chargementEleve, setChargementEleve] = useState(false);

  const [envoiEnCours, demarrer] = useTransition();

  useEffect(() => {
    if (eleveInitial) cache.current.set(eleveInitial.id, eleveInitial);
  }, [eleveInitial]);

  // Recherche différée : 300 ms, requête annulée si l'on continue de taper.
  useEffect(() => {
    const terme = recherche.trim();
    if (terme.length < 2) {
      setResultats([]);
      setChargementRecherche(false);
      return;
    }

    const controleur = new AbortController();
    const minuteur = setTimeout(async () => {
      setChargementRecherche(true);
      try {
        const reponse = await fetch(`/api/eleves?q=${encodeURIComponent(terme)}`, {
          signal: controleur.signal,
          cache: "no-store",
        });
        if (!reponse.ok) throw new Error("recherche");
        const donnees = (await reponse.json()) as { eleves: EleveOption[] };
        setResultats(donnees.eleves);
        setRechercheOuverte(true);
      } catch (e) {
        if ((e as Error).name !== "AbortError") setResultats([]);
      } finally {
        if (!controleur.signal.aborted) setChargementRecherche(false);
      }
    }, 300);

    return () => {
      clearTimeout(minuteur);
      controleur.abort();
    };
  }, [recherche]);

  function installerEleve(nouvelEleve: ElevePaiement) {
    const frais = choisirFrais(nouvelEleve);
    setEleve(nouvelEleve);
    setFraisChoisi(frais?.id ?? null);
    setMontant(frais ? String(frais.reste) : "");
    setErreur(undefined);
  }

  async function choisirEleve(option: EleveOption) {
    setRecherche("");
    setResultats([]);
    setRechercheOuverte(false);
    setErreur(undefined);

    const enCache = cache.current.get(option.id);
    if (enCache) {
      installerEleve(enCache);
      return;
    }

    setChargementEleve(true);
    try {
      const reponse = await fetch(`/api/eleves/${option.id}/frais`, {
        cache: "no-store",
      });
      if (!reponse.ok) throw new Error("chargement");
      const donnees = (await reponse.json()) as { eleve: ElevePaiement };
      cache.current.set(option.id, donnees.eleve);
      installerEleve(donnees.eleve);
    } catch {
      setErreur(
        "Impossible de charger cet élève. Vérifiez la connexion puis réessayez.",
      );
    } finally {
      setChargementEleve(false);
    }
  }

  function changerEtudiant() {
    setEleve(null);
    setFraisChoisi(null);
    setMontant("");
    setErreur(undefined);
    setRecherche("");
  }

  const scolaritesDues = useMemo(
    () => eleve?.frais.filter((f) => f.type_frais === "SCOLARITE" && f.reste > 0) ?? [],
    [eleve],
  );
  const totalScolariteRestant = useMemo(
    () => scolaritesDues.reduce((somme, f) => somme + f.reste, 0),
    [scolaritesDues],
  );

  const echeance = useMemo(() => {
    if (!eleve) return null;
    if (fraisChoisi === "TOUTES_TRANCHES") {
      const premier = scolaritesDues[0];
      return {
        id: "TOUTES_TRANCHES",
        eleve_id: eleve.id,
        annee_scolaire: annee,
        type_frais: "SCOLARITE" as const,
        frequence_paiement: premier?.frequence_paiement ?? ("TRANCHES" as Frequence),
        periode: 0,
        libelle:
          premier?.frequence_paiement === "TRANCHES"
            ? "Toutes les tranches"
            : "Toute la scolarité",
        montant_du: scolaritesDues.reduce((s, f) => s + f.montant_du, 0),
        montant_paye: scolaritesDues.reduce((s, f) => s + f.montant_paye, 0),
        reste: totalScolariteRestant,
        statut: "NON_PAYE" as const,
        tranche_id: null,
      };
    }
    return eleve.frais.find((frais) => frais.id === fraisChoisi) ?? null;
  }, [eleve, fraisChoisi, scolaritesDues, totalScolariteRestant, annee]);

  const montantNombre = Number.parseInt(montant || "0", 10) || 0;
  const depasse = Boolean(echeance && montantNombre > echeance.reste);
  const valide = Boolean(
    eleve && echeance && montantNombre > 0 && montantNombre <= echeance.reste,
  );
  const resteApres = echeance ? Math.max(0, echeance.reste - montantNombre) : 0;

  function soumettre(evenement: React.FormEvent<HTMLFormElement>) {
    evenement.preventDefault();
    setErreur(undefined);

    if (!eleve) return setErreur("Choisissez d'abord un élève.");
    if (!echeance) return setErreur("Choisissez la période ou les frais concernés.");
    if (montantNombre <= 0) return setErreur("Saisissez un montant supérieur à zéro.");
    if (montantNombre > echeance.reste) {
      return setErreur(
        `Le montant dépasse le reste dû (${formatF(echeance.reste)}).`,
      );
    }

    const donnees = new FormData();
    donnees.set("eleve_id", eleve.id);
    donnees.set("frais_id", echeance.id);
    donnees.set("montant", String(montantNombre));
    donnees.set("mode_paiement", mode);
    donnees.set("date_paiement", date);

    demarrer(async () => {
      try {
        const reponse = await enregistrerPaiement(null, donnees);
        if (reponse.error) {
          setErreur(reponse.error);
          return;
        }
        setResultat(reponse);
        router.refresh();
        window.scrollTo({ top: 0, behavior: "smooth" });
      } catch {
        setErreur(
          "Le paiement n'a pas pu être enregistré. Vérifiez la connexion puis réessayez.",
        );
      }
    });
  }

  function recommencer() {
    setResultat(null);
    setEleve(null);
    setFraisChoisi(null);
    setMontant("");
    setMode("ESPECES");
    setDate(dateInput());
    setRecherche("");
    setErreur(undefined);
  }

  // -------------------------------------------------------------------------
  //  Écran de succès + reçu imprimable
  // -------------------------------------------------------------------------
  if (resultat?.ok && resultat.paiement) {
    const paiement = resultat.paiement;
    const solde = paiement.reste === 0;
    const nature = libelleNature(paiement.type_frais);
    const periode = paiement.libelle;

    return (
      <div className="mx-auto max-w-2xl">
        <div className="sans-impression mb-5 flex items-start gap-3">
          <span className="grid size-10 shrink-0 place-items-center rounded-full bg-paye-soft text-paye">
            <CheckCircle2 size={22} aria-hidden />
          </span>
          <div>
            <h1 className="text-[22px] font-semibold leading-tight tracking-[-0.03em] text-ink">
              Paiement enregistré
            </h1>
            <p className="mt-0.5 text-[13px] text-muted">
              L&apos;échéance a été recalculée. Le reçu est prêt à partir sur
              WhatsApp.
            </p>
          </div>
        </div>

        <section className="zone-impression impression-carte overflow-hidden rounded-lg border border-line bg-surface">
          <div className="flex items-start justify-between gap-4 bg-brand-deep px-5 py-4 text-white">
            <div className="min-w-0">
              <p className="text-[9px] font-semibold uppercase tracking-[0.18em] text-[#ffce00]">
                Établissement
              </p>
              <p className="mt-1 text-[17px] font-semibold leading-tight">
                {ecole.nom}
              </p>
              {(ecole.adresse || ecole.telephone) && (
                <p className="mt-0.5 text-[10px] text-white/55">
                  {[ecole.adresse, ecole.telephone]
                    .filter(Boolean)
                    .join(" · ")}
                </p>
              )}
            </div>
            <div className="shrink-0 text-right">
              <p className="text-[9px] font-semibold uppercase tracking-[0.14em] text-white/45">
                Reçu de paiement
              </p>
              <p className="mt-1 font-mono text-[11.5px] font-semibold text-white">
                {paiement.numero_recu}
              </p>
              <p className="mt-1 text-[9.5px] text-white/45">
                {formatDateHeure(paiement.date)}
              </p>
            </div>
          </div>

          <div className="px-5 py-5">
            <div className="flex items-end justify-between gap-4">
              <div>
                <p className="text-[9.5px] font-semibold uppercase tracking-[0.12em] text-muted">
                  Montant reçu
                </p>
                <p className="chiffre mt-1 text-[30px] font-medium leading-none text-ink">
                  {formatNombre(paiement.montant)}
                  <span className="ml-1.5 text-[12px] font-normal text-muted">
                    FCFA
                  </span>
                </p>
              </div>
              <span className="rounded-full border border-line bg-surface-2 px-2.5 py-1 text-[10.5px] font-medium text-ink-2">
                {LIBELLES_MODE[paiement.mode]}
              </span>
            </div>

            <div className="mt-5 grid grid-cols-2 gap-x-4 gap-y-3 border-t border-line pt-4 text-[12px]">
              <div>
                <p className="text-[9.5px] uppercase tracking-[0.1em] text-muted">Élève</p>
                <p className="mt-0.5 font-medium text-ink">{paiement.eleve}</p>
              </div>
              <div>
                <p className="text-[9.5px] uppercase tracking-[0.1em] text-muted">Classe</p>
                <p className="mt-0.5 font-medium text-ink">{paiement.classe}</p>
              </div>
              <div>
                <p className="text-[9.5px] uppercase tracking-[0.1em] text-muted">
                  Nature
                </p>
                <p className="mt-0.5 font-medium text-ink">{nature}</p>
              </div>
              <div>
                <p className="text-[9.5px] uppercase tracking-[0.1em] text-muted">
                  {paiement.type_frais === "SCOLARITE" ? "Période" : "Frais"}
                </p>
                <p className="mt-0.5 font-medium text-ink">{periode}</p>
              </div>
              <div>
                <p className="text-[9.5px] uppercase tracking-[0.1em] text-muted">Parent</p>
                <p className="mt-0.5 font-medium text-ink">{paiement.parent}</p>
              </div>
              <div>
                <p className="text-[9.5px] uppercase tracking-[0.1em] text-muted">
                  Téléphone
                </p>
                <p className="mt-0.5 font-medium text-ink">
                  {formatTelephone(paiement.telephone) || "—"}
                </p>
              </div>
              <div className="col-span-2">
                <p className="text-[9.5px] uppercase tracking-[0.1em] text-muted">
                  Année scolaire
                </p>
                <p className="mt-0.5 font-medium text-ink">{libelleAnnee(annee)}</p>
              </div>
            </div>

            <div className="mt-4 flex items-center justify-between border-t border-dashed border-line-strong pt-3.5">
              <span className="text-[11.5px] text-muted">
                Reste à payer sur cette échéance
              </span>
              <span
                className={cx(
                  "chiffre text-[14px] font-semibold",
                  solde ? "text-paye" : "text-impaye",
                )}
              >
                {solde ? "0 F — soldé" : formatF(paiement.reste)}
              </span>
            </div>

            <div className="mt-4 flex items-end justify-between gap-4 border-t border-line pt-3 text-[10px] text-muted">
              <p>
                Enregistré par <span className="text-ink-2">{utilisateurNom}</span>
              </p>
              <p className="italic">Merci de conserver ce reçu.</p>
            </div>
          </div>
        </section>

        <div className="sans-impression mt-4 space-y-2.5">
          <a
            href={resultat.urlWhatsApp}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex h-12 w-full items-center justify-center gap-2 rounded-sm bg-paye text-[14px] font-semibold text-white transition-colors hover:bg-paye/90"
          >
            <MessageCircle size={17} aria-hidden />
            Envoyer le reçu sur WhatsApp
          </a>

          <div className="grid grid-cols-2 gap-2.5">
            <button
              type="button"
              onClick={() => window.print()}
              className="inline-flex h-10 items-center justify-center gap-2 rounded-sm border border-line-strong bg-surface text-[13px] font-semibold text-ink hover:bg-surface-2"
            >
              <Printer size={15} aria-hidden />
              Imprimer
            </button>
            <button
              type="button"
              onClick={recommencer}
              className="inline-flex h-10 items-center justify-center gap-2 rounded-sm border border-line-strong bg-surface text-[13px] font-semibold text-ink hover:bg-surface-2"
            >
              <Wallet size={15} aria-hidden />
              Nouveau paiement
            </button>
          </div>

          <div className="flex flex-wrap items-center justify-between gap-2 pt-1 text-[11.5px]">
            <p className="text-muted">
              WhatsApp s&apos;ouvre avec le message prêt. Il reste à appuyer sur
              « Envoyer ».
            </p>
            <div className="flex flex-wrap items-center gap-3">
              <Link
                href={
                  paiement.type_frais === "SCOLARITE"
                    ? `/app?frequence=${paiement.frequence_paiement}&periode=${paiement.periode}`
                    : "/app"
                }
                className="font-semibold text-brand hover:underline"
              >
                Voir la période du paiement
              </Link>
              <Link
                href="/app/paiements"
                className="font-semibold text-muted hover:underline"
              >
                Tous les paiements
              </Link>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // -------------------------------------------------------------------------
  //  Formulaire
  // -------------------------------------------------------------------------
  const lignes = eleve ? fraisDus(eleve) : [];

  return (
    <form onSubmit={soumettre} className="grid items-start gap-5 lg:grid-cols-[1.55fr_1fr]">
      <div className="space-y-5">
        {erreur && <Alerte>{erreur}</Alerte>}

        {/* Étape 1 — élève */}
        <section className="card p-4 sm:p-5">
          <div className="mb-3 flex items-baseline gap-2">
            <span className="chiffre text-[10px] text-ochre">01</span>
            <h2 className="text-[14px] font-semibold text-ink">L&apos;élève</h2>
          </div>

          {eleve ? (
            <div className="flex items-center justify-between gap-3 rounded-sm border border-brand/20 bg-brand-soft/60 px-3.5 py-3">
              <div className="flex min-w-0 items-center gap-3">
                <span className="grid size-9 shrink-0 place-items-center rounded-full bg-brand text-[11px] font-semibold text-white">
                  {initiales(eleve.nom, eleve.prenom)}
                </span>
                <div className="min-w-0">
                  <p className="truncate text-[13.5px] font-semibold text-ink">
                    {eleve.prenom} {eleve.nom}
                  </p>
                  <p className="truncate text-[11.5px] text-muted">
                    {eleve.classe_nom} · {formatTelephone(eleve.telephone_parent)} ·{" "}
                    {eleve.nom_parent}
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={changerEtudiant}
                className="inline-flex shrink-0 items-center gap-1 rounded-sm border border-line-strong bg-surface px-2.5 py-1.5 text-[11.5px] font-semibold text-ink hover:bg-surface-2"
              >
                <X size={12} aria-hidden />
                Changer
              </button>
            </div>
          ) : (
            <div
              className="relative"
              onBlur={(evenement) => {
                if (!evenement.currentTarget.contains(evenement.relatedTarget)) {
                  setRechercheOuverte(false);
                }
              }}
            >
              <label htmlFor="recherche-eleve" className="sr-only">
                Rechercher un élève
              </label>
              <Search
                size={17}
                className="pointer-events-none absolute left-3.5 top-[22px] -translate-y-1/2 text-muted"
                aria-hidden
              />
              <input
                id="recherche-eleve"
                type="search"
                value={recherche}
                onChange={(evenement) => {
                  setRecherche(evenement.target.value);
                  setRechercheOuverte(true);
                }}
                onFocus={() => recherche.trim().length >= 2 && setRechercheOuverte(true)}
                onKeyDown={(evenement) => {
                  if (evenement.key === "Enter") evenement.preventDefault();
                  if (evenement.key === "Escape") setRechercheOuverte(false);
                }}
                placeholder="Nom de l'élève, prénom ou parent…"
                className="input h-12 pl-10 pr-10 text-[15px]"
                autoComplete="off"
                aria-expanded={rechercheOuverte}
                aria-controls="resultats-eleves"
                role="combobox"
                aria-autocomplete="list"
              />
              {(chargementRecherche || chargementEleve) && (
                <Loader2
                  size={16}
                  className="absolute right-3.5 top-[22px] -translate-y-1/2 animate-spin text-brand"
                  aria-hidden
                />
              )}

              {rechercheOuverte && recherche.trim().length >= 2 && (
                <div className="absolute inset-x-0 top-full z-20 mt-1.5 overflow-hidden rounded-md border border-line bg-surface shadow-[0_18px_40px_-22px_rgba(8,43,75,0.5)]">
                  {resultats.length === 0 && !chargementRecherche ? (
                    <p className="px-4 py-3 text-[12.5px] text-muted">
                      Aucun élève trouvé. Vérifiez l&apos;orthographe ou cherchez
                      par nom du parent.
                    </p>
                  ) : (
                    <ul id="resultats-eleves" role="listbox" className="max-h-72 overflow-y-auto">
                      {resultats.map((option) => (
                        <li key={option.id} role="option" aria-selected={false}>
                          <button
                            type="button"
                            onClick={() => choisirEleve(option)}
                            className="flex w-full items-center gap-3 border-b border-line px-3.5 py-2.5 text-left last:border-0 hover:bg-surface-2 focus:bg-surface-2"
                          >
                            <span className="grid size-8 shrink-0 place-items-center rounded-full bg-surface-2 text-[10px] font-semibold text-ink-2">
                              {initiales(option.nom, option.prenom)}
                            </span>
                            <span className="min-w-0 flex-1">
                              <span className="block truncate text-[12.5px] font-medium text-ink">
                                {option.prenom} {option.nom}
                              </span>
                              <span className="block truncate text-[10.5px] text-muted">
                                {option.classe_nom} · {option.nom_parent} ·{" "}
                                {formatTelephone(option.telephone_parent)}
                              </span>
                            </span>
                          </button>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              )}

              <p className="aide">
                Tapez au moins 2 lettres. La recherche se fait sur l&apos;élève
                ou le parent.
              </p>
            </div>
          )}
        </section>

        {/* Étape 2 — échéance / montant / mode */}
        <section className="card p-4 sm:p-5">
          <div className="mb-3 flex items-baseline gap-2">
            <span className="chiffre text-[10px] text-ochre">02</span>
            <h2 className="text-[14px] font-semibold text-ink">
              L&apos;échéance et le montant
            </h2>
          </div>

          {!eleve ? (
            <p className="rounded-sm border border-dashed border-line-strong bg-surface-2 px-4 py-6 text-center text-[12.5px] text-muted">
              Choisissez un élève pour afficher ses frais d&apos;inscription et
              ses périodes de scolarité.
            </p>
          ) : lignes.length === 0 ? (
            <p className="rounded-sm border border-dashed border-paye/30 bg-paye-soft/40 px-4 py-6 text-center text-[12.5px] text-paye">
              Tout est soldé : aucune échéance à encaisser pour cet élève.
            </p>
          ) : (
            <div className="space-y-5">
              <div>
                <p className="label">Échéance concernée</p>
                <div className="grid grid-cols-2 gap-1.5 sm:grid-cols-3 sm:gap-2">
                  {scolaritesDues.length > 1 && (
                    <button
                      type="button"
                      onClick={() => {
                        setFraisChoisi("TOUTES_TRANCHES");
                        setMontant(String(totalScolariteRestant));
                        setErreur(undefined);
                      }}
                      className={cx(
                        "col-span-2 flex flex-col items-start gap-0.5 rounded-sm border px-2.5 py-2 text-left transition-colors sm:col-span-3",
                        fraisChoisi === "TOUTES_TRANCHES"
                          ? "border-brand bg-brand text-white"
                          : "border-brand/40 bg-brand-soft/40 text-brand hover:border-brand hover:bg-brand-soft",
                      )}
                      aria-pressed={fraisChoisi === "TOUTES_TRANCHES"}
                    >
                      <span className="w-full truncate text-[11.5px] font-semibold">
                        {scolaritesDues[0].frequence_paiement === "TRANCHES"
                          ? "Toutes les tranches (solder)"
                          : "Toute la scolarité (solder)"}
                      </span>
                      <span
                        className={cx(
                          "chiffre text-[9.5px]",
                          fraisChoisi === "TOUTES_TRANCHES"
                            ? "text-white/80"
                            : "text-brand",
                        )}
                      >
                        Total : {formatNombre(totalScolariteRestant)} F ({scolaritesDues.length} échéances)
                      </span>
                    </button>
                  )}
                  {lignes.map((frais) => {
                    const actif = fraisChoisi === frais.id;
                    const special = frais.type_frais !== "SCOLARITE";
                    return (
                      <button
                        key={frais.id}
                        type="button"
                        onClick={() => {
                          setFraisChoisi(frais.id);
                          setMontant(String(frais.reste));
                          setErreur(undefined);
                        }}
                        className={cx(
                          "flex flex-col items-start gap-0.5 rounded-sm border px-2.5 py-2 text-left transition-colors",
                          actif
                            ? "border-brand bg-brand text-white"
                            : special
                              ? "border-ochre/30 bg-ochre-soft/40 text-ink hover:border-ochre/60 hover:bg-ochre-soft/60"
                              : "border-line-strong bg-surface text-ink hover:border-brand/40 hover:bg-surface-2",
                        )}
                        aria-pressed={actif}
                      >
                        <span className="w-full truncate text-[11.5px] font-semibold">
                          {libelleEcheance(frais, annee, true)}
                        </span>
                        <span
                          className={cx(
                            "chiffre text-[9.5px]",
                            actif
                              ? "text-white/70"
                              : frais.statut === "PARTIEL"
                                ? "text-partiel"
                                : "text-impaye",
                          )}
                        >
                          {frais.statut === "PARTIEL"
                            ? `Reste ${formatNombre(frais.reste)} F`
                            : `${formatNombre(frais.reste)} F à payer`}
                        </span>
                      </button>
                    );
                  })}
                </div>
                <p className="aide">
                  Les frais d&apos;inscription / réinscription apparaissent en
                  premier. Chaque période affiche le reste dû.
                </p>
              </div>

              <div>
                <div className="flex items-end justify-between gap-2">
                  <label className="label mb-0" htmlFor="montant">
                    Montant reçu
                  </label>
                  {echeance && (
                    <button
                      type="button"
                      onClick={() => setMontant(String(echeance.reste))}
                      className="text-[11px] font-semibold text-brand hover:underline"
                    >
                      Tout régler ({formatF(echeance.reste)})
                    </button>
                  )}
                </div>
                <div className="relative mt-1.5">
                  <input
                    id="montant"
                    name="montant"
                    inputMode="numeric"
                    value={montant}
                    onChange={(evenement) =>
                      setMontant(evenement.target.value.replace(/\D/g, "").slice(0, 9))
                    }
                    className={cx(
                      "input chiffre h-14 pr-20 text-[22px] font-medium",
                      depasse && "input-erreur",
                    )}
                    placeholder="0"
                    disabled={!echeance}
                    aria-describedby="aide-montant"
                  />
                  <span className="pointer-events-none absolute right-4 top-1/2 -translate-y-1/2 text-[12px] font-medium text-muted">
                    FCFA
                  </span>
                </div>
                <div id="aide-montant" className="mt-1.5">
                  {depasse ? (
                    <p className="text-[11.5px] text-impaye">
                      Le montant dépasse le reste dû ({formatF(echeance?.reste ?? 0)}).
                    </p>
                  ) : echeance ? (
                    <p className="text-[11.5px] text-muted">
                      Reste dû : <strong className="text-ink">{formatF(echeance.reste)}</strong>
                      {" · "}
                      {resteApres === 0
                        ? "ce paiement soldera l'échéance."
                        : `après ce paiement : ${formatF(resteApres)}.`}
                    </p>
                  ) : null}
                </div>
              </div>

              <div>
                <p className="label">Mode de paiement</p>
                <div className="grid grid-cols-3 gap-1.5 sm:gap-2">
                  {MODES.map(({ valeur, libelle, detail, icone: Icone }) => (
                    <label
                      key={valeur}
                      className={cx(
                        "flex cursor-pointer flex-col items-center gap-1 rounded-sm border px-2 py-2.5 text-center transition-colors",
                        mode === valeur
                          ? "border-brand bg-brand-soft text-brand"
                          : "border-line-strong bg-surface text-ink-2 hover:bg-surface-2",
                      )}
                    >
                      <input
                        type="radio"
                        name="mode_paiement"
                        value={valeur}
                        checked={mode === valeur}
                        onChange={() => setMode(valeur)}
                        className="sr-only"
                      />
                      <Icone size={16} aria-hidden />
                      <span className="text-[11.5px] font-semibold">{libelle}</span>
                      <span className="text-[9.5px] opacity-70">{detail}</span>
                    </label>
                  ))}
                </div>
              </div>

              <div className="max-w-[220px]">
                <label className="label" htmlFor="date_paiement">
                  Date du paiement
                </label>
                <div className="relative">
                  <CalendarDays
                    size={15}
                    className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-muted"
                    aria-hidden
                  />
                  <input
                    id="date_paiement"
                    type="date"
                    value={date}
                    max={dateInput()}
                    onChange={(evenement) => setDate(evenement.target.value)}
                    className="input h-10 pl-9 text-[13px]"
                  />
                </div>
              </div>
            </div>
          )}
        </section>
      </div>

      {/* Récapitulatif */}
      <aside className="lg:sticky lg:top-6">
        <div className="card overflow-hidden">
          <div className="border-b border-line bg-surface-2 px-4 py-3">
            <p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-muted">
              Récapitulatif
            </p>
          </div>

          <div className="p-4">
            <p className="text-[10.5px] text-muted">Montant à encaisser</p>
            <p className="chiffre mt-1 text-[26px] font-medium leading-none text-ink">
              {formatNombre(montantNombre)}
              <span className="ml-1.5 text-[11px] font-normal text-muted">FCFA</span>
            </p>

            <dl className="mt-4 space-y-2 border-t border-line pt-3 text-[11.5px]">
              <div className="flex justify-between gap-3">
                <dt className="text-muted">Élève</dt>
                <dd className="truncate text-right font-medium text-ink">
                  {eleve ? `${eleve.prenom} ${eleve.nom}` : "—"}
                </dd>
              </div>
              <div className="flex justify-between gap-3">
                <dt className="text-muted">Nature</dt>
                <dd className="text-right font-medium text-ink">
                  {echeance ? libelleNature(echeance.type_frais) : "—"}
                </dd>
              </div>
              <div className="flex justify-between gap-3">
                <dt className="text-muted">Échéance</dt>
                <dd className="text-right font-medium text-ink">
                  {echeance ? libelleEcheance(echeance, annee) : "—"}
                </dd>
              </div>
              <div className="flex justify-between gap-3">
                <dt className="text-muted">Mode</dt>
                <dd className="text-right font-medium text-ink">{LIBELLES_MODE[mode]}</dd>
              </div>
              <div className="flex justify-between gap-3">
                <dt className="text-muted">Année</dt>
                <dd className="chiffre text-right text-ink-2">{libelleAnnee(annee)}</dd>
              </div>
            </dl>

            <div className="mt-3 border-t border-line pt-3">
              <div className="flex items-center justify-between gap-3">
                <span className="text-[11.5px] text-muted">Reste après paiement</span>
                <span
                  className={cx(
                    "chiffre text-[13px] font-semibold",
                    resteApres === 0 && echeance ? "text-paye" : "text-partiel",
                  )}
                >
                  {echeance ? formatF(resteApres) : "—"}
                </span>
              </div>
            </div>

            {erreur && (
              <div className="mt-3">
                <Alerte>{erreur}</Alerte>
              </div>
            )}

            <Bouton
              type="submit"
              taille="lg"
              className="mt-4 w-full"
              disabled={!valide || envoiEnCours}
            >
              {envoiEnCours ? (
                <Loader2 size={16} className="animate-spin" aria-hidden />
              ) : (
                <Check size={16} strokeWidth={2.5} aria-hidden />
              )}
              {envoiEnCours ? "Enregistrement…" : "Valider le paiement"}
            </Bouton>

            <p className="mt-2.5 flex items-start gap-1.5 text-[10.5px] leading-relaxed text-muted">
              <MessageCircle size={12} className="mt-0.5 shrink-0 text-paye" aria-hidden />
              Le reçu WhatsApp sera préparé automatiquement après validation.
            </p>
          </div>
        </div>

        {!valide && !erreur && (
          <p className="mt-2 flex items-start gap-1.5 text-[10.5px] leading-relaxed text-muted">
            <AlertTriangle size={12} className="mt-0.5 shrink-0" aria-hidden />
            Choisissez un élève, une échéance et un montant valide pour activer la
            validation.
          </p>
        )}
      </aside>
    </form>
  );
}
