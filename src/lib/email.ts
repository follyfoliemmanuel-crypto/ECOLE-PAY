/** Envoi d'email via Resend (optionnel en développement). */

type Email = { to: string; subject: string; html: string; text?: string };

export async function envoyerEmail({
  to,
  subject,
  html,
  text,
}: Email): Promise<{ ok: boolean; raison?: string }> {
  const cle = process.env.RESEND_API_KEY;
  if (!cle) return { ok: false, raison: "email_non_configure" };

  try {
    const reponse = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${cle}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from: process.env.EMAIL_FROM ?? "ECOLE PAY <noreply@ecolepay.tg>",
        to: [to],
        subject,
        html,
        text,
      }),
    });
    if (!reponse.ok) return { ok: false, raison: "echec_envoi" };
    return { ok: true };
  } catch {
    return { ok: false, raison: "echec_envoi" };
  }
}

/** Échappe les valeurs insérées dans le HTML d'un email. */
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
      <strong style="font-size:18px;letter-spacing:-.3px">ÉCOLE PAY</strong>
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
