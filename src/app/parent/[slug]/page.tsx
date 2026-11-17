import type { Metadata } from "next";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import {
  ArrowRight,
  ChevronLeft,
  FileText,
  LockKeyhole,
  ShieldCheck,
  School,
  Users,
} from "lucide-react";
import { anneeScolaire, libelleAnnee } from "@/lib/mois";
import { peut } from "@/lib/offres";
import {
  ecolePublique,
  listerClassesPubliques,
} from "@/lib/data/portail";
import { RechercheElevePortail } from "@/components/portail/recherche-eleve";
import { estUuid } from "@/lib/actions/helpers";
import { slugValide } from "@/lib/validation";

type Parametres = { slug: string };

export async function generateMetadata({
  params,
}: {
  params: Promise<Parametres>;
}): Promise<Metadata> {
  const { slug } = await params;
  const ecole = await ecolePublique(slug);
  if (!ecole) return { title: "École introuvable" };
  return {
    title: `Notes · ${ecole.nom}`,
    description: `Consultez les notes, le rang et le bulletin de votre enfant à ${ecole.nom}.`,
    robots: { index: false, follow: false },
  };
}

export default async function PagePortailEcole({
  params,
  searchParams,
}: {
  params: Promise<Parametres>;
  searchParams: Promise<{ classe?: string }>;
}) {
  const { slug } = await params;
  if (!slugValide(slug)) notFound();
  const ecole = await ecolePublique(slug);
  if (!ecole) notFound();

  const annee = anneeScolaire();
  const accesPortail = peut(
    { offre: ecole.offre, statut: ecole.statut },
    "portail_parent",
  );

  if (!accesPortail) {
    // STARTER / PRO : le portail parent est verrouillé. On renvoie vers la
    // page de paiement avec le message PREMIUM exact.
    redirect(
      `/premium?ecole=${encodeURIComponent(slug)}&depuis=${encodeURIComponent("le portail parent")}`,
    );
  }

  const classes = await listerClassesPubliques(ecole.id, annee);
  const classeDemandee = (await searchParams).classe;
  const classeChoisie =
    classeDemandee && estUuid(classeDemandee)
      ? classes.find((classe) => classe.id === classeDemandee)
      : undefined;

  return (
    <div className="min-h-screen bg-canvas">
      <EnTeteEcole
        nom={ecole.nom}
        logoUrl={ecole.logo_url}
        adresse={ecole.adresse}
        telephone={ecole.telephone}
      />

      <main className="mx-auto max-w-3xl px-4 py-6 sm:px-6 sm:py-9">
        <div className="mb-5 flex flex-wrap items-center justify-between gap-2">
          <p className="inline-flex items-center gap-1.5 rounded-full border border-line-strong bg-surface px-2.5 py-1 text-[10.5px] font-medium text-muted">
            <ShieldCheck size={12} aria-hidden />
            Accès parent sans compte
          </p>
          <p className="text-[11px] text-muted">Année {libelleAnnee(annee)}</p>
        </div>

        {!classeChoisie ? (
          <section className="card overflow-hidden">
            <div className="border-b border-line px-5 py-5 sm:px-7">
              <p className="text-[10.5px] font-semibold uppercase tracking-[0.14em] text-ochre">
                Étape 1 sur 2
              </p>
              <h1 className="mt-1.5 text-[23px] font-semibold leading-tight tracking-[-0.035em] text-ink sm:text-[27px]">
                Choisissez la classe de votre enfant
              </h1>
              <p className="mt-2 max-w-xl text-[13px] leading-relaxed text-muted">
                Les notes sont classées par classe. Sélectionnez celle de votre
                enfant, puis tapez son nom ou son prénom.
              </p>
            </div>

            <div className="px-5 py-5 sm:px-7 sm:py-6">
              {classes.length === 0 ? (
                <div className="rounded-md border border-dashed border-line-strong bg-surface-2 px-5 py-8 text-center">
                  <Users
                    size={22}
                    className="mx-auto text-muted"
                    aria-hidden
                  />
                  <p className="mt-3 text-[14px] font-semibold text-ink">
                    Aucune classe disponible pour le moment
                  </p>
                  <p className="mx-auto mt-1 max-w-sm text-[12px] leading-relaxed text-muted">
                    Les classes apparaîtront dès que l&apos;école aura inscrit
                    ses élèves. Contactez le secrétariat pour toute question.
                  </p>
                  {ecole.telephone && (
                    <p className="mt-3 text-[12px] font-medium text-ink-2">
                      {ecole.telephone}
                    </p>
                  )}
                </div>
              ) : (
                <ul className="grid gap-2.5 sm:grid-cols-2">
                  {classes.map((classe) => (
                    <li key={classe.id}>
                      <Link
                        href={`/parent/${slug}?classe=${classe.id}`}
                        className="group flex items-center gap-3 rounded-md border border-line-strong bg-surface px-4 py-3.5 transition-colors hover:border-brand hover:bg-brand-soft/40"
                      >
                        <span className="grid size-10 shrink-0 place-items-center rounded-sm border border-line bg-surface-2 text-brand">
                          <School size={17} aria-hidden />
                        </span>
                        <span className="min-w-0 flex-1">
                          <span className="block truncate text-[14px] font-semibold text-ink">
                            {classe.nom}
                          </span>
                          <span className="mt-0.5 block text-[11px] text-muted">
                            {classe.nb_eleves} élève
                            {classe.nb_eleves > 1 ? "s" : ""} inscrit
                            {classe.nb_eleves > 1 ? "s" : ""}
                          </span>
                        </span>
                        <ArrowRight
                          size={16}
                          className="shrink-0 text-muted transition-transform group-hover:translate-x-0.5 group-hover:text-brand"
                          aria-hidden
                        />
                      </Link>
                    </li>
                  ))}
                </ul>
              )}
            </div>

            <EtapeSuivante />
          </section>
        ) : (
          <section className="card overflow-hidden">
            <div className="border-b border-line px-5 py-4 sm:px-7">
              <Link
                href={`/parent/${slug}`}
                className="inline-flex items-center gap-1 text-[11.5px] font-semibold text-brand hover:underline"
              >
                <ChevronLeft size={13} aria-hidden />
                Changer de classe
              </Link>
              <div className="mt-3 flex flex-wrap items-center justify-between gap-2">
                <div>
                  <p className="text-[10.5px] font-semibold uppercase tracking-[0.14em] text-ochre">
                    Étape 2 sur 2
                  </p>
                  <h1 className="mt-1 text-[22px] font-semibold leading-tight tracking-[-0.035em] text-ink sm:text-[26px]">
                    Trouvez votre enfant
                  </h1>
                </div>
                <span className="inline-flex items-center gap-1.5 rounded-full border border-brand/25 bg-brand-soft px-3 py-1 text-[11.5px] font-semibold text-brand">
                  <School size={12} aria-hidden />
                  {classeChoisie.nom}
                </span>
              </div>
            </div>

            <div className="px-5 py-5 sm:px-7 sm:py-6">
              <RechercheElevePortail
                slug={slug}
                classeId={classeChoisie.id}
                classeNom={classeChoisie.nom}
                annee={annee}
              />
            </div>

            <div className="border-t border-line bg-surface-2 px-5 py-4 sm:px-7">
              <p className="flex items-start gap-2 text-[11px] leading-relaxed text-muted">
                <FileText size={14} className="mt-0.5 shrink-0" aria-hidden />
                Après le nom, vous verrez uniquement les notes, la moyenne, le
                rang et le bulletin de votre enfant. Aucun autre élève
                n&apos;est affiché.
              </p>
            </div>
          </section>
        )}

        <div className="mt-4 flex flex-wrap items-center justify-between gap-2 text-[11px] text-muted">
          <p className="inline-flex items-center gap-1.5">
            <LockKeyhole size={12} aria-hidden />
            Consultation en lecture seule
          </p>
          {ecole.telephone && (
            <p>
              Besoin d&apos;aide ? {ecole.telephone}
            </p>
          )}
        </div>
      </main>

      <PiedDePage />
    </div>
  );
}

function EnTeteEcole({
  nom,
  logoUrl,
  adresse,
  telephone,
}: {
  nom: string;
  logoUrl: string | null;
  adresse: string | null;
  telephone: string | null;
}) {
  return (
    <header className="border-b border-white/10 bg-brand-deep text-white">
      <div className="mx-auto flex max-w-3xl items-center gap-3 px-4 py-4 sm:px-6 sm:py-5">
        {logoUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={logoUrl}
            alt={`Logo ${nom}`}
            className="size-11 shrink-0 rounded-sm border border-white/20 bg-white object-contain p-0.5 sm:size-12"
          />
        ) : (
          <span className="grid size-11 shrink-0 place-items-center rounded-sm border border-white/20 bg-white/10 text-[14px] font-semibold text-[#ffce00] sm:size-12">
            {nom
              .split(/\s+/)
              .filter(Boolean)
              .slice(0, 2)
              .map((mot) => mot.charAt(0))
              .join("")
              .toUpperCase()}
          </span>
        )}
        <div className="min-w-0 flex-1">
          <p className="text-[9px] font-semibold uppercase tracking-[0.18em] text-[#ffce00]">
            Portail des notes
          </p>
          <p className="mt-0.5 truncate text-[16px] font-semibold leading-tight sm:text-[18px]">
            {nom}
          </p>
          {(adresse || telephone) && (
            <p className="mt-0.5 truncate text-[10px] text-white/50">
              {[adresse, telephone].filter(Boolean).join(" · ")}
            </p>
          )}
        </div>
      </div>
    </header>
  );
}

function EtapeSuivante() {
  return (
    <div className="grid gap-3 border-t border-line bg-surface-2 px-5 py-4 text-[11.5px] leading-relaxed text-muted sm:grid-cols-2 sm:px-7">
      <p>
        <span className="font-semibold text-ink-2">1.</span> Choisissez la
        classe.
      </p>
      <p>
        <span className="font-semibold text-ink-2">2.</span> Tapez le nom ou le
        prénom de votre enfant.
      </p>
    </div>
  );
}

function PiedDePage() {
  return (
    <footer className="mx-auto max-w-3xl px-4 pb-8 pt-2 text-center text-[10.5px] leading-relaxed text-muted sm:px-6">
      <p>
        Portail officiel des notes · {libelleAnnee(anneeScolaire())} · SCHOOL PAY
      </p>
      <p className="mt-1 text-muted/70">
        Ne partagez pas le lien de la fiche de votre enfant avec une autre
        famille.
      </p>
    </footer>
  );
}
