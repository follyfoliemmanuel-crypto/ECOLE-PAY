/** Envoi d'email via Resend (optionnel en développement). */

type Email = { to: string; subject: string; html: string; text?: string };

/** Pourquoi un envoi n'a pas abouti. */
export type RaisonEchecEmail =
  | "email_non_configure"
  | "cle_invalide"
  | "domaine_non_verifie"
  | "destinataire_sandbox"
  | "echec_envoi";

export type ResultatEmail = { ok: boolean; raison?: RaisonEchecEmail };

/**
 * Envoi brut à Resend. Ne lève jamais : l'appelant décide quoi afficher.
 * Le détail de l'erreur reste dans les journaux du serveur.
 */
export async function envoyerEmail({
  to,
  subject,
  html,
  text,
}: Email): Promise<ResultatEmail> {
  const cle = process.env.RESEND_API_KEY?.trim();
  if (!cle) return { ok: false, raison: "email_non_configure" };

  try {
    const reponse = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${cle}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from: process.env.EMAIL_FROM ?? "SCHOOL PAY <noreply@ecolepay.tg>",
        to: [to],
        subject,
        html,
        text,
      }),
    });
    if (reponse.ok) return { ok: true };

    const corps = await reponse.text();
    const raison = classerEchec(reponse.status, corps);
    console.error(
      `[email] Resend ${reponse.status} — ${raison} : ${messageResend(corps)}`,
    );
    return { ok: false, raison };
  } catch (erreur) {
    console.error("[email] réseau :", (erreur as Error).message);
    return { ok: false, raison: "echec_envoi" };
  }
}

function messageResend(corps: string): string {
  try {
    const donnees = JSON.parse(corps) as { message?: string };
    return String(donnees.message ?? "").slice(0, 200);
  } catch {
    return corps.slice(0, 200);
  }
}

function classerEchec(statut: number, corps: string): RaisonEchecEmail {
  const texte = corps.toLowerCase();
  if (texte.includes("api key is invalid") || statut === 401) {
    return "cle_invalide";
  }
  if (texte.includes("domain is not verified")) return "domaine_non_verifie";
  if (texte.includes("only send testing emails")) return "destinataire_sandbox";
  return "echec_envoi";
}

// ---------------------------------------------------------------------------
//  Vérification de la configuration (avant d'envoyer)
// ---------------------------------------------------------------------------
export type EtatConfigurationEmail =
  | { etat: "ok" }
  | { etat: "absent" }
  | { etat: "cle_invalide" }
  | { etat: "domaine_non_verifie"; domaine: string };

let cache: { quand: number; etat: EtatConfigurationEmail } | null = null;
const DUREE_CACHE = 5 * 60 * 1000;

/** Domaine d'envoi déduit de `EMAIL_FROM` (ex. « noreply@ecolepay.tg »). */
function domaineEnvoi(): string {
  const from = process.env.EMAIL_FROM ?? "SCHOOL PAY <noreply@ecolepay.tg>";
  const adresse = from.match(/<([^>]+)>/)?.[1] ?? from;
  return adresse.split("@")[1]?.trim().toLowerCase() ?? "";
}

/**
 * Vérifie une fois (puis toutes les 5 minutes) que la clé est acceptée et que
 * le domaine d'envoi est vérifié chez Resend.
 *
 * Appelée AVANT de chercher le compte : le résultat ne dépend pas de l'adresse
 * demandée, donc l'afficher ne révèle pas si un email existe en base.
 */
export async function etatConfigurationEmail(): Promise<EtatConfigurationEmail> {
  if (cache && Date.now() - cache.quand < DUREE_CACHE) return cache.etat;

  const cle = process.env.RESEND_API_KEY?.trim();
  if (!cle) {
    cache = { quand: Date.now(), etat: { etat: "absent" } };
    return cache.etat;
  }

  let etat: EtatConfigurationEmail;
  try {
    const reponse = await fetch("https://api.resend.com/domains", {
      headers: { Authorization: `Bearer ${cle}` },
      cache: "no-store",
    });

    if (reponse.status === 401 || reponse.status === 403) {
      etat = { etat: "cle_invalide" };
    } else if (!reponse.ok) {
      // Resend injoignable : on ne bloque pas l'utilisateur pour autant.
      etat = { etat: "ok" };
    } else {
      const donnees = (await reponse.json()) as {
        data?: { name?: string; status?: string }[];
      };
      const domaine = domaineEnvoi();
      // Le domaine sandbox de Resend (`resend.dev`) n'apparaît pas dans la
      // liste : il est accepté d'office, mais seulement vers l'adresse du
      // titulaire du compte.
      const verifie =
        domaine.endsWith("resend.dev") ||
        (donnees.data ?? []).some(
          (d) =>
            d.name?.toLowerCase() === domaine &&
            (d.status ?? "").toLowerCase() === "verified",
        );
      etat = verifie ? { etat: "ok" } : { etat: "domaine_non_verifie", domaine };
    }
  } catch {
    etat = { etat: "ok" };
  }

  cache = { quand: Date.now(), etat };
  return etat;
}

/** Message affichable au directeur quand l'email est mal configuré. */
export function messageConfigurationEmail(config: EtatConfigurationEmail): string {
  switch (config.etat) {
    case "absent":
      return "L'envoi d'emails n'est pas encore activé sur cette installation. Contactez le secrétariat ou l'administrateur pour réinitialiser votre mot de passe.";
    case "cle_invalide":
      return "Le service d'email est mal configuré : la clé Resend est refusée. Contactez l'administrateur.";
    case "domaine_non_verifie":
      return `Le service d'email n'est pas encore actif : le domaine ${config.domaine} n'est pas vérifié chez Resend. Contactez l'administrateur.`;
    default:
      return "";
  }
}

function echapperHtml(valeur: string): string {
  return valeur
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

export function modeleEmailReinitialisation(lien: string, nom: string): string {
  const nomSur = echapperHtml(nom);
  const lienSur = echapperHtml(lien);
  return `
  <div style="font-family:Arial,sans-serif;max-width:520px;margin:0 auto;color:#14212b">
    <div style="background:#0d3b66;padding:24px;color:#fff">
      <strong style="font-size:18px;letter-spacing:-.3px">SCHOOL PAY</strong>
    </div>
    <div style="padding:24px;border:1px solid #e3ddcf;border-top:0">
      <p>Bonjour ${nomSur},</p>
      <p>Vous avez demandé la réinitialisation de votre mot de passe.</p>
      <p style="margin:24px 0">
        <a href="${lienSur}" style="background:#0d3b66;color:#fff;padding:12px 20px;text-decoration:none;border-radius:6px">
          Choisir un nouveau mot de passe
        </a>
      </p>
      <p style="color:#66737e;font-size:13px">Ce lien expire dans 1 heure. Si vous n'êtes pas à l'origine de cette demande, ignorez cet email.</p>
    </div>
  </div>`;
}
