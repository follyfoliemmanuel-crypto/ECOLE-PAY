"use client";

import Image from "next/image";
import { useActionState } from "react";
import { KeyRound, Loader2, ShieldCheck, ShieldOff } from "lucide-react";
import { Bouton } from "@/components/ui/button";
import { Alerte } from "@/components/ui/empty-state";
import {
  confirmerActivation,
  demarrerActivation,
  desactiver,
  regenererCodes,
  type EtatDeuxFacteursAction,
  type EtatDemarrage,
} from "@/lib/actions/securite-super-admin";
import type { EtatDeuxFacteurs } from "@/lib/two-facteurs";
import { formatDateHeure } from "@/lib/format";

function formaterSecret(secret: string): string {
  return secret.match(/.{1,4}/g)?.join(" ") ?? secret;
}

function CodesSecours({ codes }: { codes: string[] }) {
  return (
    <div className="rounded-sm border border-paye/25 bg-paye-soft px-4 py-3.5">
      <p className="text-[12.5px] font-semibold text-paye">
        Codes de secours — à conserver maintenant
      </p>
      <p className="mt-1 text-[11.5px] leading-relaxed text-ink-2">
        Chaque code sert une seule fois, si vous perdez votre téléphone. Ils ne
        seront plus affichés après avoir quitté cette page.
      </p>
      <ul className="mt-3 grid grid-cols-2 gap-1.5 sm:grid-cols-4">
        {codes.map((code) => (
          <li
            key={code}
            className="chiffre rounded-sm border border-paye/20 bg-surface px-2 py-1.5 text-center text-[12.5px] font-semibold tracking-wider text-ink"
          >
            {code}
          </li>
        ))}
      </ul>
    </div>
  );
}

function ChampCode({
  id,
  label,
  autoFocus,
}: {
  id: string;
  label: string;
  autoFocus?: boolean;
}) {
  return (
    <div>
      <label className="label" htmlFor={id}>
        {label}
      </label>
      <input
        id={id}
        name="code"
        type="text"
        inputMode="numeric"
        autoComplete="one-time-code"
        autoFocus={autoFocus}
        required
        placeholder="123456 ou code de secours"
        className="input chiffre max-w-[240px] tracking-[0.2em]"
      />
    </div>
  );
}

export function SecuriteDeuxFacteurs({ etat }: { etat: EtatDeuxFacteurs }) {
  const [demarrage, lancerDemarrage, demarrageEnCours] = useActionState<
    EtatDemarrage,
    FormData
  >(demarrerActivation, null);

  const [activation, confirmer, activationEnCours] = useActionState<
    EtatDeuxFacteursAction,
    FormData
  >(confirmerActivation, null);

  const [regeneration, regenerer, regenerationEnCours] = useActionState<
    EtatDeuxFacteursAction,
    FormData
  >(regenererCodes, null);

  const [desactivation, desactiverCompte, desactivationEnCours] =
    useActionState<EtatDeuxFacteursAction, FormData>(desactiver, null);

  return (
    <div className="space-y-5">
      {activation?.codes && <CodesSecours codes={activation.codes} />}
      {activation?.success && <Alerte ton="succes">{activation.success}</Alerte>}
      {activation?.error && <Alerte>{activation.error}</Alerte>}

      {!etat.actif ? (
        <section className="card p-5">
          <div className="flex items-start gap-3">
            <span className="grid size-9 shrink-0 place-items-center rounded-sm border border-ochre/25 bg-[#fbf1de] text-[#8a5a10]">
              <ShieldOff size={17} aria-hidden />
            </span>
            <div>
              <h2 className="text-[14px] font-semibold text-ink">
                Double authentification désactivée
              </h2>
              <p className="mt-1 max-w-2xl text-[12.5px] leading-relaxed text-muted">
                Un seul mot de passe protège actuellement toutes les écoles.
                Activez la double authentification : en plus du mot de passe,
                un code à 6 chiffres sera demandé à chaque connexion.
              </p>
            </div>
          </div>

          {!demarrage?.secret ? (
            <form action={lancerDemarrage} className="mt-4">
              <Bouton type="submit" disabled={demarrageEnCours}>
                {demarrageEnCours ? (
                  <Loader2 size={15} className="animate-spin" aria-hidden />
                ) : (
                  <KeyRound size={15} aria-hidden />
                )}
                Activer la double authentification
              </Bouton>
              {demarrage?.error && (
                <div className="mt-3">
                  <Alerte>{demarrage.error}</Alerte>
                </div>
              )}
            </form>
          ) : (
            <div className="mt-5 border-t border-line pt-5">
              <div className="flex flex-col gap-5 sm:flex-row sm:items-start">
                {demarrage.qr && (
                  <Image
                    src={demarrage.qr}
                    alt="QR code d'activation de la double authentification"
                    width={200}
                    height={200}
                    unoptimized
                    className="shrink-0 rounded-sm border border-line bg-white p-2"
                  />
                )}
                <div className="min-w-0 flex-1">
                  <p className="text-[12.5px] font-semibold text-ink">
                    1. Scannez ce QR code
                  </p>
                  <p className="mt-1 text-[12px] leading-relaxed text-muted">
                    Avec Google Authenticator, Authy, Microsoft Authenticator
                    ou toute application TOTP.
                  </p>

                  <p className="mt-4 text-[12.5px] font-semibold text-ink">
                    Ou saisissez la clé manuellement
                  </p>
                  <code className="chiffre mt-1 block break-all rounded-sm border border-line bg-surface-2 px-3 py-2 text-[12px] text-ink-2">
                    {formaterSecret(demarrage.secret)}
                  </code>

                  <form action={confirmer} className="mt-4 space-y-3">
                    <input type="hidden" name="secret" value={demarrage.secret} />
                    <ChampCode
                      id="code_activation"
                      label="2. Code affiché par l'application"
                      autoFocus
                    />
                    <Bouton
                      type="submit"
                      variante="succes"
                      disabled={activationEnCours}
                    >
                      {activationEnCours ? (
                        <Loader2 size={15} className="animate-spin" aria-hidden />
                      ) : (
                        <ShieldCheck size={15} aria-hidden />
                      )}
                      Vérifier et activer
                    </Bouton>
                  </form>
                </div>
              </div>
            </div>
          )}
        </section>
      ) : (
        <>
          <section className="card p-5">
            <div className="flex items-start gap-3">
              <span className="grid size-9 shrink-0 place-items-center rounded-sm border border-paye/25 bg-paye-soft text-paye">
                <ShieldCheck size={17} aria-hidden />
              </span>
              <div>
                <h2 className="text-[14px] font-semibold text-ink">
                  Double authentification active
                </h2>
                <p className="mt-1 text-[12.5px] leading-relaxed text-muted">
                  Activée le {etat.activeLe ? formatDateHeure(etat.activeLe) : "—"} ·{" "}
                  {etat.codesRestants} code
                  {etat.codesRestants > 1 ? "s" : ""} de secours restant
                  {etat.codesRestants > 1 ? "s" : ""}.
                </p>
              </div>
            </div>
          </section>

          <section className="card p-5">
            <h2 className="text-[14px] font-semibold text-ink">
              Régénérer les codes de secours
            </h2>
            <p className="mt-1 text-[12px] leading-relaxed text-muted">
              Les codes actuels seront invalidés. Utilisez cette option si vous
              en avez perdu ou consommé plusieurs.
            </p>

            {regeneration?.codes && <div className="mt-3"><CodesSecours codes={regeneration.codes} /></div>}
            {regeneration?.success && (
              <div className="mt-3">
                <Alerte ton="succes">{regeneration.success}</Alerte>
              </div>
            )}
            {regeneration?.error && (
              <div className="mt-3">
                <Alerte>{regeneration.error}</Alerte>
              </div>
            )}

            <form action={regenerer} className="mt-4 flex flex-wrap items-end gap-3">
              <ChampCode id="code_regeneration" label="Code actuel" />
              <Bouton type="submit" variante="secondaire" disabled={regenerationEnCours}>
                {regenerationEnCours && (
                  <Loader2 size={15} className="animate-spin" aria-hidden />
                )}
                Nouveaux codes
              </Bouton>
            </form>
          </section>

          <section className="card border-impaye/20 p-5">
            <h2 className="text-[14px] font-semibold text-impaye">
              Désactiver la double authentification
            </h2>
            <p className="mt-1 max-w-2xl text-[12px] leading-relaxed text-muted">
              À éviter. Le compte repasserait à un seul mot de passe. Un code
              valide est exigé, donc un simple cookie de session volé ne suffit
              pas.
            </p>

            {desactivation?.success && (
              <div className="mt-3">
                <Alerte ton="succes">{desactivation.success}</Alerte>
              </div>
            )}
            {desactivation?.error && (
              <div className="mt-3">
                <Alerte>{desactivation.error}</Alerte>
              </div>
            )}

            <form action={desactiverCompte} className="mt-4 flex flex-wrap items-end gap-3">
              <ChampCode id="code_desactivation" label="Code actuel" />
              <Bouton type="submit" variante="danger" disabled={desactivationEnCours}>
                {desactivationEnCours && (
                  <Loader2 size={15} className="animate-spin" aria-hidden />
                )}
                Désactiver
              </Bouton>
            </form>
          </section>
        </>
      )}
    </div>
  );
}
