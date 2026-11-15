import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { ArrowLeft, QrCode, School, Smartphone } from "lucide-react";
import { exigerSession } from "@/lib/auth";
import { peut } from "@/lib/offres";
import { getEcole } from "@/lib/data/ecole";
import {
  adressePubliqueEcole,
  lienPublicEcole,
} from "@/lib/portail";
import { qrCodeDataUrl } from "@/lib/qr";
import { BoutonImprimer } from "@/components/notes/bouton-imprimer";
import { EntetePage } from "@/components/app/entete-page";
import { LienBouton } from "@/components/ui/button";

export const metadata: Metadata = { title: "Affiche portail parent" };

export default async function PageAffichePortail() {
  const session = await exigerSession();
  if (!peut(session.ecole, "qr_portail")) {
    redirect(`/premium?depuis=${encodeURIComponent("le QR code du portail parent")}`);
  }

  const ecole = await getEcole(session.ecoleId);
  if (!ecole) redirect("/app");

  const lien = lienPublicEcole(ecole.slug);
  let qr = "";
  try {
    qr = await qrCodeDataUrl(lien);
  } catch (erreur) {
    console.error("QR code affiche portail :", erreur);
  }

  return (
    <div>
      <EntetePage
        surtitre="Portail parent"
        titre="Affiche d'entrée et QR code"
        description="Imprimez cette affiche au format A4 et collez-la à l'entrée de l'école. Le parent scanne le QR code et arrive directement sur la page de l'établissement."
        actions={
          <>
            <LienBouton href="/app" variante="secondaire" taille="md">
              <ArrowLeft size={15} aria-hidden />
              Tableau de bord
            </LienBouton>
            <BoutonImprimer
              libelle="Imprimer l'affiche"
              className="inline-flex h-10 items-center justify-center gap-2 rounded-sm bg-brand px-4 text-[13px] font-semibold text-white transition-colors hover:bg-brand-deep"
            />
          </>
        }
      />

      <div className="mx-auto max-w-[820px]">
        <article className="zone-impression overflow-hidden rounded-lg border border-line bg-white">
          <div className="bg-brand-deep px-8 py-7 text-white sm:px-12 sm:py-9">
            <div className="flex items-center gap-4">
              {ecole.logo_url ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={ecole.logo_url}
                  alt={`Logo ${ecole.nom}`}
                  className="size-16 shrink-0 rounded-sm border border-white/20 bg-white object-contain p-1"
                />
              ) : (
                <span className="grid size-16 shrink-0 place-items-center rounded-sm border border-white/20 bg-white/10 text-[18px] font-semibold text-[#ffce00]">
                  <School size={28} aria-hidden />
                </span>
              )}
              <div className="min-w-0">
                <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-[#ffce00]">
                  Portail des notes
                </p>
                <h1 className="mt-1 text-[26px] font-semibold leading-tight tracking-[-0.035em] sm:text-[32px]">
                  {ecole.nom}
                </h1>
                {(ecole.adresse || ecole.telephone) && (
                  <p className="mt-1 text-[11px] text-white/55">
                    {[ecole.adresse, ecole.telephone].filter(Boolean).join(" · ")}
                  </p>
                )}
              </div>
            </div>
          </div>

          <div className="grid gap-8 px-8 py-8 sm:grid-cols-[1fr_280px] sm:px-12 sm:py-10">
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-ochre">
                Chers parents
              </p>
              <h2 className="mt-2 text-[24px] font-semibold leading-tight tracking-[-0.035em] text-ink sm:text-[28px]">
                Consultez les notes de votre enfant depuis votre téléphone.
              </h2>
              <p className="mt-3 text-[13px] leading-relaxed text-muted">
                Pas de compte, pas de mot de passe, pas de code à retenir.
                Scannez le QR code avec l&apos;appareil photo, choisissez la
                classe puis tapez le nom de votre enfant.
              </p>

              <ol className="mt-6 space-y-3">
                <li className="flex gap-3">
                  <span className="grid size-7 shrink-0 place-items-center rounded-sm bg-brand text-[11px] font-semibold text-white">
                    1
                  </span>
                  <div>
                    <p className="text-[13px] font-semibold text-ink">
                      Scannez le QR code
                    </p>
                    <p className="text-[11.5px] leading-relaxed text-muted">
                      Ouvrez l&apos;appareil photo de votre téléphone.
                    </p>
                  </div>
                </li>
                <li className="flex gap-3">
                  <span className="grid size-7 shrink-0 place-items-center rounded-sm bg-brand text-[11px] font-semibold text-white">
                    2
                  </span>
                  <div>
                    <p className="text-[13px] font-semibold text-ink">
                      Choisissez la classe
                    </p>
                    <p className="text-[11.5px] leading-relaxed text-muted">
                      Ex. 6ème A, 5ème B, CP1 A.
                    </p>
                  </div>
                </li>
                <li className="flex gap-3">
                  <span className="grid size-7 shrink-0 place-items-center rounded-sm bg-brand text-[11px] font-semibold text-white">
                    3
                  </span>
                  <div>
                    <p className="text-[13px] font-semibold text-ink">
                      Tapez le nom de votre enfant
                    </p>
                    <p className="text-[11.5px] leading-relaxed text-muted">
                      Notes, moyenne, rang, bulletin PDF et paiements.
                    </p>
                  </div>
                </li>
              </ol>
            </div>

            <div className="flex flex-col items-center justify-start">
              <div className="rounded-md border border-line bg-white p-3">
                {qr ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={qr}
                    alt={`QR code du portail parent de ${ecole.nom}`}
                    className="size-[230px]"
                  />
                ) : (
                  <div className="grid size-[230px] place-items-center text-muted">
                    <QrCode size={56} aria-hidden />
                  </div>
                )}
              </div>
              <p className="mt-3 flex items-center gap-1.5 text-[10.5px] font-semibold uppercase tracking-[0.1em] text-muted">
                <Smartphone size={12} aria-hidden />
                Scannez ici
              </p>
              <p className="mt-2 break-all text-center font-mono text-[10px] text-ink-2">
                {adressePubliqueEcole(ecole.slug)}
              </p>
            </div>
          </div>

          <div className="border-t border-line bg-surface-2 px-8 py-4 text-center sm:px-12">
            <p className="text-[10.5px] leading-relaxed text-muted">
              Besoin d&apos;aide ? Contactez le secrétariat de {ecole.nom}
              {ecole.telephone ? ` au ${ecole.telephone}` : ""}.
            </p>
            <p className="mt-1 text-[9px] font-semibold uppercase tracking-[0.16em] text-muted/70">
              Portail officiel ECOLE PAY
            </p>
          </div>
        </article>

        <p className="sans-impression mt-4 text-center text-[11px] leading-relaxed text-muted">
          Conseil : imprimez en couleur, format A4. Le QR code reste lisible
          même en noir et blanc.{" "}
          <Link
            href={`/parent/${ecole.slug}`}
            target="_blank"
            rel="noopener noreferrer"
            className="font-semibold text-brand hover:underline"
          >
            Prévisualiser le portail
          </Link>
          .
        </p>
      </div>
    </div>
  );
}
