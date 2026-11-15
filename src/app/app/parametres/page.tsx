import type { Metadata } from "next";
import Link from "next/link";
import {
  ArrowRight,
  Check,
  CreditCard,
  LockKeyhole,
  Mail,
  MessageCircle,
  ShieldCheck,
  Smartphone,
  Users,
} from "lucide-react";
import { exigerSession, estDirecteur } from "@/lib/auth";
import {
  compterClasses,
  compterElevesActifs,
  compterUtilisateurs,
  getEcole,
  joursEssaiRestants,
  limitesOffre,
  listerUtilisateurs,
} from "@/lib/data/ecole";
import { anneeScolaire, libelleAnnee } from "@/lib/mois";
import { formatFCFA, formatDate } from "@/lib/format";
import {
  LIBELLES_OFFRE,
  LIBELLES_ROLE,
  type Offre,
} from "@/lib/types";
import {
  OFFRES,
  aFonctionnalite,
  limiteTexte,
  offreEffective,
} from "@/lib/offres";
import { COMMERCIAL } from "@/lib/config";
import { basculerUtilisateur } from "@/lib/actions/ecole";
import { Badge } from "@/components/ui/badge";
import { Bouton } from "@/components/ui/button";
import { EntetePage } from "@/components/app/entete-page";
import { EtatBureau } from "@/components/desktop/etat-bureau";
import {
  FormulaireEcole,
  FormulaireMotDePasse,
  FormulaireUtilisateur,
} from "@/components/parametres/formulaires-parametres";

export const metadata: Metadata = { title: "Paramètres" };

/** Initiales d'un nom de compte, sans tenir compte d'une mention entre parenthèses. */
function initialesCompte(nom: string): string {
  const mots = nom
    .replace(/\([^)]*\)/g, " ")
    .trim()
    .split(/\s+/)
    .filter(Boolean);
  return `${mots[0]?.charAt(0) ?? ""}${mots[1]?.charAt(0) ?? ""}`.toUpperCase();
}

const FORMULES: {
  code: Offre;
  nom: string;
  prix: number;
  cible: string;
  eleves: string;
  utilisateurs: string;
  classes: string;
}[] = (["STARTER", "PRO", "PREMIUM"] as Offre[]).map((code) => {
  const info = OFFRES[code];
  return {
    code,
    nom: info.nom,
    prix: info.prix,
    cible: info.resume,
    eleves: limiteTexte(info.limiteEleves, "élève", "élèves"),
    utilisateurs: limiteTexte(
      info.limiteUtilisateurs,
      "utilisateur",
      "utilisateurs",
    ),
    classes: limiteTexte(info.limiteClasses, "classe", "classes"),
  };
});

export default async function PageParametres() {
  const session = await exigerSession();
  const annee = anneeScolaire();
  const directeur = estDirecteur(session);

  const [ecole, utilisateurs, nbEleves, nbClasses] = await Promise.all([
    getEcole(session.ecoleId),
    listerUtilisateurs(session.ecoleId),
    compterElevesActifs(session.ecoleId, annee),
    compterClasses(session.ecoleId),
  ]);

  if (!ecole) return null;

  const offre = offreEffective(ecole);
  const limite = limitesOffre(offre);
  const nbUtilisateurs = utilisateurs.filter((u) => u.actif).length;
  const joursEssai = joursEssaiRestants(ecole.date_fin_essai);
  const joursAbonnement = joursEssaiRestants(ecole.date_fin_abonnement);
  const essaiTermine = ecole.statut === "ESSAI" && joursEssai === 0;
  const equipeDisponible = aFonctionnalite(offre, "equipe");
  const equipePleine =
    limite.utilisateurs !== null && nbUtilisateurs >= limite.utilisateurs;

  const sujetAbonnement = encodeURIComponent(
    `Activation offre ${offre} — ${ecole.nom}`,
  );
  const corpsAbonnement = encodeURIComponent(
    `Bonjour ECOLE PAY,\n\nJe souhaite activer l'offre ${offre} pour ${ecole.nom} (${annee}).\nCompte : ${session.email}\n\nMerci.`,
  );
  const messageWhatsAppAbonnement = encodeURIComponent(
    `Bonjour ECOLE PAY, je souhaite activer l'offre ${offre} pour mon école "${ecole.nom}" (${annee}). Compte responsable : ${session.email}`,
  );

  return (
    <div>
      <EntetePage
        surtitre={libelleAnnee(annee)}
        titre="Paramètres"
        description="L'identité de l'école, les messages WhatsApp, votre équipe et votre abonnement."
      />

      <div className="grid items-start gap-5 lg:grid-cols-[1.45fr_1fr]">
        <div className="space-y-5">
          {/* ---------------- École ---------------- */}
          <section className="card overflow-hidden">
            <div className="border-b border-line px-4 py-3.5 sm:px-5">
              <h2 className="text-[14px] font-semibold text-ink">
                Informations de l&apos;école
              </h2>
              <p className="mt-0.5 text-[11.5px] text-muted">
                Ces informations apparaissent sur les reçus et les messages
                envoyés aux parents.
              </p>
            </div>

            {directeur ? (
              <div className="p-4 sm:p-5">
                <FormulaireEcole ecole={ecole} />
              </div>
            ) : (
              <div className="space-y-3 p-4 text-[12.5px] text-muted sm:p-5">
                <p className="rounded-sm border border-line bg-surface-2 px-3.5 py-2.5">
                  Seul le directeur peut modifier l&apos;identité de l&apos;école
                  et les modèles WhatsApp.
                </p>
                <dl className="space-y-2">
                  <div className="flex justify-between gap-3">
                    <dt>École</dt>
                    <dd className="font-medium text-ink">{ecole.nom}</dd>
                  </div>
                  <div className="flex justify-between gap-3">
                    <dt>Téléphone</dt>
                    <dd className="text-ink-2">{ecole.telephone ?? "—"}</dd>
                  </div>
                  <div className="flex justify-between gap-3">
                    <dt>Email</dt>
                    <dd className="break-all text-ink-2">{ecole.email}</dd>
                  </div>
                </dl>
              </div>
            )}
          </section>

          {/* ---------------- Équipe ---------------- */}
          <section className="card overflow-hidden">
            <div className="flex flex-wrap items-start justify-between gap-2 border-b border-line px-4 py-3.5 sm:px-5">
              <div>
                <h2 className="text-[14px] font-semibold text-ink">Équipe</h2>
                <p className="mt-0.5 text-[11.5px] text-muted">
                  Le directeur gère tout. La secrétaire encaisse et consulte,
                  sans pouvoir annuler ni supprimer.
                </p>
              </div>
              <Badge ton="brand">
                <Users size={11} className="mr-1" aria-hidden />
                {utilisateurs.length} compte{utilisateurs.length > 1 ? "s" : ""}
              </Badge>
            </div>

            <ul className="divide-y divide-line">
              {utilisateurs.map((utilisateur) => (
                <li
                  key={utilisateur.id}
                  className="flex flex-wrap items-center gap-3 px-4 py-3 sm:px-5"
                >
                  <span className="grid size-9 shrink-0 place-items-center rounded-full bg-brand-soft text-[10.5px] font-semibold text-brand">
                    {initialesCompte(utilisateur.nom)}
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-[13px] font-semibold text-ink">
                      {utilisateur.nom}
                      {utilisateur.id === session.userId && (
                        <span className="ml-1.5 text-[10.5px] font-normal text-muted">
                          (vous)
                        </span>
                      )}
                    </p>
                    <p className="truncate text-[11.5px] text-muted">
                      {utilisateur.email}
                    </p>
                    <p className="mt-0.5 text-[10.5px] text-muted">
                      {utilisateur.derniere_connexion
                        ? `Dernière connexion le ${formatDate(utilisateur.derniere_connexion)}`
                        : "Jamais connecté"}
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <Badge ton={utilisateur.role === "directeur" ? "brand" : "neutre"}>
                      {LIBELLES_ROLE[utilisateur.role]}
                    </Badge>
                    {!utilisateur.actif && <Badge ton="ochre">Désactivé</Badge>}

                    {directeur && utilisateur.id !== session.userId && (
                      <form action={basculerUtilisateur}>
                        <input type="hidden" name="id" value={utilisateur.id} />
                        <Bouton
                          type="submit"
                          variante={utilisateur.actif ? "danger" : "secondaire"}
                          taille="sm"
                          title={
                            utilisateur.actif
                              ? "Désactiver ce compte"
                              : "Réactiver ce compte"
                          }
                        >
                          {utilisateur.actif ? "Désactiver" : "Réactiver"}
                        </Bouton>
                      </form>
                    )}
                  </div>
                </li>
              ))}
            </ul>

            {directeur && (
              <div className="border-t border-line bg-surface-2 p-4 sm:p-5">
                <h3 className="text-[13px] font-semibold text-ink">
                  Ajouter un utilisateur
                </h3>
                <p className="mb-3 mt-0.5 text-[11.5px] text-muted">
                  {equipeDisponible
                    ? `Offre ${offre} · ${nbUtilisateurs} / ${limite.utilisateurs ?? "∞"} compte${nbUtilisateurs > 1 ? "s" : ""} actif${nbUtilisateurs > 1 ? "s" : ""}. ${equipePleine ? "Limite atteinte : passez à une offre supérieure pour ajouter un compte." : "Choisissez le rôle : comptable ou secrétaire."}`
                    : "L'offre STARTER comprend un seul utilisateur (le directeur). Passez à PRO pour ajouter un comptable et une secrétaire."}
                </p>
                {equipeDisponible && !equipePleine ? (
                  <FormulaireUtilisateur />
                ) : (
                  <a
                    href={`https://wa.me/${COMMERCIAL.whatsapp}?text=${messageWhatsAppAbonnement}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex h-9 items-center gap-2 rounded-sm border border-line-strong bg-surface px-3.5 text-[12px] font-semibold text-ink transition-colors hover:bg-surface-2"
                  >
                    <MessageCircle size={14} aria-hidden />
                    Passer à une offre supérieure
                  </a>
                )}
              </div>
            )}
          </section>

          {/* ---------------- Abonnement ---------------- */}
          <section id="abonnement" className="card scroll-mt-6 overflow-hidden">
            <div className="border-b border-line px-4 py-3.5 sm:px-5">
              <h2 className="flex items-center gap-2 text-[14px] font-semibold text-ink">
                <CreditCard size={15} className="text-muted" aria-hidden />
                Abonnement
              </h2>
              <p className="mt-0.5 text-[11.5px] text-muted">
                Un forfait mensuel par école, payé par Flooz ou TMoney.
              </p>
            </div>

            <div className="p-4 sm:p-5">
              <div className="flex flex-wrap items-center justify-between gap-3 rounded-sm border border-line bg-surface-2 px-4 py-3.5">
                <div>
                  <p className="text-[9.5px] font-semibold uppercase tracking-[0.11em] text-muted">
                    Offre actuelle
                  </p>
                  <p className="mt-0.5 text-[15px] font-semibold text-ink">
                    {LIBELLES_OFFRE[offre]}
                    {ecole.statut === "ESSAI" && (
                      <span className="ml-1.5 text-[11px] font-medium text-ochre">
                        (essai — toutes fonctions PREMIUM)
                      </span>
                    )}
                  </p>
                  <p className="mt-0.5 text-[11.5px] text-muted">
                    {ecole.statut === "ESSAI" ? (
                      essaiTermine ? (
                        "Essai terminé — choisissez une offre pour continuer."
                      ) : (
                        `Essai gratuit · ${joursEssai ?? 30} jour${(joursEssai ?? 30) > 1 ? "s" : ""} restant${(joursEssai ?? 30) > 1 ? "s" : ""}`
                      )
                    ) : ecole.statut === "ACTIF" ? (
                      ecole.date_fin_abonnement ? (
                        <>
                          Abonnement actif jusqu&apos;au{" "}
                          {formatDate(ecole.date_fin_abonnement)}
                          {joursAbonnement !== null && joursAbonnement <= 7
                            ? ` · ${joursAbonnement} jour${joursAbonnement > 1 ? "s" : ""} restant${joursAbonnement > 1 ? "s" : ""}`
                            : ""}
                        </>
                      ) : (
                        "Abonnement actif"
                      )
                    ) : (
                      "Compte bloqué — contactez ECOLE PAY pour réactiver."
                    )}
                  </p>
                </div>
                <div className="text-right">
                  <p className="text-[9.5px] font-semibold uppercase tracking-[0.11em] text-muted">
                    Utilisation
                  </p>
                  <p className="chiffre mt-0.5 text-[12.5px] text-ink">
                    {nbEleves} / {limite.eleves ?? "∞"} élèves
                  </p>
                  <p className="chiffre text-[11.5px] text-muted">
                    {nbClasses} / {limite.classes ?? "∞"} classes
                  </p>
                  <p className="chiffre text-[11.5px] text-muted">
                    {nbUtilisateurs} / {limite.utilisateurs ?? "∞"} utilisateurs
                  </p>
                </div>
              </div>

              <div className="mt-4 overflow-x-auto">
                <table className="tableau min-w-[620px]">                  <thead>
                    <tr>
                      <th>Offre</th>
                      <th>Élèves</th>
                      <th>Utilisateurs</th>
                      <th>Classes</th>
                      <th className="text-right">Prix / mois</th>
                    </tr>
                  </thead>
                  <tbody>
                    {FORMULES.map((formule) => {
                      const actuelle = offre === formule.code;
                      return (
                        <tr key={formule.code}>
                          <td>
                            <div className="flex items-center gap-2">
                              <span className="font-medium text-ink">
                                {formule.nom}
                              </span>
                              {actuelle && (
                                <Badge ton="succes">
                                  <Check size={10} className="mr-1" aria-hidden />
                                  Actuelle
                                </Badge>
                              )}
                            </div>
                            <p className="mt-0.5 text-[11px] text-muted">
                              {formule.cible}
                            </p>
                          </td>
                          <td className="chiffre text-[12px] text-ink-2">
                            {formule.eleves}
                          </td>
                          <td className="chiffre text-[12px] text-ink-2">
                            {formule.utilisateurs}
                          </td>
                          <td className="chiffre text-[12px] text-ink-2">
                            {formule.classes}
                          </td>
                          <td className="chiffre text-right text-[12.5px] font-medium text-ink">
                            {formatFCFA(formule.prix)}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>

              {offre !== "PREMIUM" && (
                <div className="mt-4 flex flex-wrap items-center justify-between gap-3 rounded-sm border border-ochre/25 bg-[#fbf6ea] px-4 py-3.5">
                  <div className="min-w-0">
                    <p className="flex items-center gap-2 text-[12.5px] font-semibold text-[#7a5010]">
                      <LockKeyhole size={14} aria-hidden />
                      Comptes profs, portail parent et WhatsApp : PREMIUM{" "}
                      {formatFCFA(OFFRES.PREMIUM.prix)}
                    </p>
                    <p className="mt-0.5 max-w-xl text-[11.5px] leading-relaxed text-[#7a5010]/85">
                      STARTER et PRO gardent les élèves, les classes, les
                      paiements et les notes saisies à la main. Les comptes
                      professeurs, le portail parent, le QR code et l&apos;envoi
                      des bulletins sur WhatsApp restent verrouillés côté
                      serveur.
                    </p>
                  </div>
                  <Link
                    href="/premium"
                    className="inline-flex h-9 shrink-0 items-center gap-1.5 rounded-sm bg-[#7a5010] px-3.5 text-[12px] font-semibold text-white transition-colors hover:bg-[#654211]"
                  >
                    Voir PREMIUM
                    <ArrowRight size={13} aria-hidden />
                  </Link>
                </div>
              )}

              <div className="mt-4 rounded-sm border border-brand/15 bg-brand-soft/60 p-4">
                <div className="flex items-start gap-3">
                  <span className="grid size-9 shrink-0 place-items-center rounded-sm bg-brand text-white">
                    <Smartphone size={16} aria-hidden />
                  </span>
                  <div>
                    <h3 className="text-[13px] font-semibold text-ink">
                      Paiement & Activation immédiate par Flooz / TMoney
                    </h3>
                    <p className="mt-1 text-[12px] leading-relaxed text-ink-2">
                      Effectuez le paiement de votre formule par transfert Mobile Money vers nos comptes officiels :
                    </p>
                    <div className="mt-2 grid gap-2 sm:grid-cols-2 text-[11.5px]">
                      <div className="rounded border border-line bg-surface p-2.5">
                        <span className="font-semibold text-ink">Flooz (Moov Togo) :</span>
                        <p className="chiffre font-mono text-[13px] font-semibold text-brand">{COMMERCIAL.flooz}</p>
                        <p className="text-[10.5px] text-muted">Bénéficiaire : {COMMERCIAL.beneficiaire}</p>
                      </div>
                      <div className="rounded border border-line bg-surface p-2.5">
                        <span className="font-semibold text-ink">TMoney (Togocom) :</span>
                        <p className="chiffre font-mono text-[13px] font-semibold text-brand">{COMMERCIAL.tmoney}</p>
                        <p className="text-[10.5px] text-muted">Bénéficiaire : {COMMERCIAL.beneficiaire}</p>
                      </div>
                    </div>
                    <p className="mt-2.5 text-[11.5px] text-muted">
                      Précisez le <strong>nom de votre école</strong> en motif de transfert. L&apos;activation est validée sous 15 minutes.
                    </p>
                  </div>
                </div>

                <div className="mt-3.5 flex flex-wrap gap-2.5 border-t border-line/60 pt-3">
                  <a
                    href={`https://wa.me/${COMMERCIAL.whatsapp}?text=${messageWhatsAppAbonnement}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex h-9 items-center gap-2 rounded-sm bg-paye px-3.5 text-[12px] font-semibold text-white transition-colors hover:bg-paye/90"
                  >
                    <MessageCircle size={15} aria-hidden />
                    Confirmer l&apos;activation sur WhatsApp
                  </a>
                  <a
                    href={`mailto:${COMMERCIAL.email}?subject=${sujetAbonnement}&body=${corpsAbonnement}`}
                    className="inline-flex h-9 items-center gap-2 rounded-sm border border-line-strong bg-surface px-3.5 text-[12px] font-semibold text-ink transition-colors hover:bg-surface-2"
                  >
                    <Mail size={14} aria-hidden />
                    Contacter par email
                  </a>
                </div>
              </div>

              <p className="mt-3 text-[11px] leading-relaxed text-muted">
                Pendant les 30 jours d&apos;essai, toutes les fonctions PREMIUM
                sont actives. Après l&apos;essai, l&apos;offre choisie est
                appliquée immédiatement par le super admin. STARTER et PRO ne
                donnent jamais accès aux comptes profs, au portail parent ni à
                l&apos;envoi WhatsApp des bulletins. Un changement d&apos;offre
                ne supprime jamais les élèves, paiements, reçus ou notes : les
                fonctions en trop sont simplement verrouillées.
              </p>
            </div>
          </section>
        </div>

        {/* ---------------- Colonne droite ---------------- */}
        <aside className="space-y-5">
          <section className="card overflow-hidden">
            <div className="border-b border-line px-4 py-3.5">
              <h2 className="flex items-center gap-2 text-[14px] font-semibold text-ink">
                <ShieldCheck size={15} className="text-muted" aria-hidden />
                Mon mot de passe
              </h2>
              <p className="mt-0.5 text-[11.5px] text-muted">
                Les autres appareils connectés seront déconnectés.
              </p>
            </div>
            <div className="p-4">
              <FormulaireMotDePasse />
            </div>
          </section>

          <section className="rounded-md border border-line bg-surface-2 p-4">
            <p className="text-[10.5px] font-semibold uppercase tracking-[0.1em] text-muted">
              Votre compte
            </p>
            <p className="mt-1.5 text-[13px] font-semibold text-ink">
              {session.nom}
            </p>
            <p className="break-all text-[11.5px] text-muted">{session.email}</p>
            <p className="mt-2 text-[11.5px] text-muted">
              Rôle :{" "}
              <span className="font-medium text-ink-2">
                {directeur ? "Directeur" : "Secrétaire"}
              </span>
            </p>
            <p className="mt-1 text-[11.5px] text-muted">
              Année scolaire : <span className="chiffre text-ink-2">{annee}</span>
            </p>
          </section>

          <section className="rounded-md border border-line bg-surface-2 p-4">
            <p className="text-[10.5px] font-semibold uppercase tracking-[0.1em] text-muted">
              Sécurité et données
            </p>
            <ul className="mt-2 space-y-2 text-[11.5px] leading-relaxed text-muted">
              <li>
                Chaque école ne voit que ses propres élèves, paiements et
                classes. L&apos;isolation est appliquée à chaque requête.
              </li>
              <li>
                Un paiement n&apos;est jamais effacé : il est annulé avec un
                motif, par le directeur uniquement.
              </li>
              <li>
                Les reçus WhatsApp partent manuellement depuis votre téléphone.
                Aucune donnée n&apos;est envoyée à un tiers.
              </li>
            </ul>
          </section>

          <EtatBureau />

          <section className="rounded-md border border-ochre/25 bg-[#fbf1de] p-4 text-[11.5px] leading-relaxed text-[#7a5010]">
            <p className="font-semibold">Besoin d&apos;aide ?</p>
            <p className="mt-1">
              Écrivez à{" "}
              <a
                href={`mailto:${COMMERCIAL.email}`}
                className="font-semibold underline underline-offset-2"
              >
                {COMMERCIAL.email}
              </a>{" "}
              en précisant le nom de votre école.
            </p>
          </section>
        </aside>
      </div>
    </div>
  );
}
