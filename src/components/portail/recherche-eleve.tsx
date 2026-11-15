"use client";

import Link from "next/link";
import { useEffect, useRef, useState, useTransition } from "react";
import { ChevronRight, Loader2, Search, UserRound } from "lucide-react";
import {
  rechercherElevesPortail,
  type ResultatRecherchePublique,
} from "@/lib/actions/portail";
import { initiales } from "@/lib/format";

export function RechercheElevePortail({
  slug,
  classeId,
  classeNom,
  annee,
}: {
  slug: string;
  classeId: string;
  classeNom: string;
  annee: string;
}) {
  const [valeur, setValeur] = useState("");
  const [etat, setEtat] = useState<ResultatRecherchePublique | null>(null);
  const [enCours, demarrer] = useTransition();
  const requete = useRef(0);

  useEffect(() => {
    const terme = valeur.trim();
    if (terme.length < 3) {
      setEtat(null);
      return;
    }

    const numero = ++requete.current;
    const minuterie = window.setTimeout(() => {
      const donnees = new FormData();
      donnees.set("slug", slug);
      donnees.set("classe_id", classeId);
      donnees.set("annee", annee);
      donnees.set("recherche", terme);

      demarrer(async () => {
        const resultat = await rechercherElevesPortail(null, donnees);
        if (numero === requete.current) setEtat(resultat);
      });
    }, 350);

    return () => window.clearTimeout(minuterie);
  }, [valeur, slug, classeId, annee]);

  const terme = valeur.trim();

  return (
    <div>
      <label
        htmlFor="recherche-eleve"
        className="block text-[11px] font-semibold uppercase tracking-[0.12em] text-muted"
      >
        Nom ou prénom de l&apos;enfant · {classeNom}
      </label>

      <div className="relative mt-2">
        <Search
          size={18}
          className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-muted"
          aria-hidden
        />
        <input
          id="recherche-eleve"
          type="search"
          value={valeur}
          onChange={(evenement) => setValeur(evenement.target.value)}
          placeholder="Ex. Kossi Adjovi"
          autoComplete="off"
          autoCapitalize="words"
          spellCheck={false}
          className="input h-12 pl-11 pr-11 text-[16px]"
          aria-describedby="recherche-aide"
        />
        {enCours && (
          <Loader2
            size={17}
            className="absolute right-3.5 top-1/2 -translate-y-1/2 animate-spin text-brand"
            aria-hidden
          />
        )}
      </div>

      <p id="recherche-aide" className="aide">
        {terme.length === 0
          ? "Tapez au moins 3 lettres. Seuls les élèves de cette classe apparaissent."
          : terme.length < 3
            ? "Encore quelques lettres : la recherche démarre à 3 lettres."
            : enCours
              ? "Recherche dans la classe…"
              : "Cliquez sur le nom de votre enfant pour ouvrir ses notes."}
      </p>

      <div aria-live="polite" className="mt-4">
        {etat && !etat.ok && etat.message && (
          <div className="rounded-md border border-impaye/25 bg-impaye-soft px-4 py-3.5">
            <p className="text-[13px] font-semibold leading-relaxed text-impaye">
              {etat.message}
            </p>
            <p className="mt-1 text-[11.5px] leading-relaxed text-ink-2/70">
              Vérifiez l&apos;orthographe et la classe, puis réessayez. Si le
              problème continue, contactez l&apos;école.
            </p>
          </div>
        )}

        {etat?.ok && etat.eleves.length > 0 && (
          <ul className="divide-y divide-line overflow-hidden rounded-md border border-line bg-surface">
            {etat.eleves.map((eleve) => (
              <li key={eleve.id}>
                <Link
                  href={`/parent/${slug}/eleve/${eleve.id}`}
                  className="flex items-center gap-3 px-3.5 py-3 transition-colors hover:bg-brand-soft/50 focus-visible:bg-brand-soft/50"
                >
                  {eleve.photo_url ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={eleve.photo_url}
                      alt=""
                      className="size-10 shrink-0 rounded-full border border-line object-cover"
                    />
                  ) : (
                    <span className="grid size-10 shrink-0 place-items-center rounded-full bg-brand-soft text-[12px] font-semibold text-brand">
                      {initiales(eleve.nom, eleve.prenom)}
                    </span>
                  )}
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-[14px] font-semibold text-ink">
                      {eleve.prenom} {eleve.nom}
                    </span>
                    <span className="mt-0.5 block text-[11.5px] text-muted">
                      {eleve.classe_nom}
                    </span>
                  </span>
                  <ChevronRight
                    size={17}
                    className="shrink-0 text-muted"
                    aria-hidden
                  />
                </Link>
              </li>
            ))}
          </ul>
        )}

        {!etat && terme.length >= 3 && !enCours && (
          <div className="flex items-center gap-2 rounded-md border border-dashed border-line-strong px-4 py-3 text-[12px] text-muted">
            <UserRound size={15} aria-hidden />
            La recherche démarre dès que vous tapez.
          </div>
        )}
      </div>
    </div>
  );
}
