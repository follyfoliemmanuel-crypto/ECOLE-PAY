/**
 * Envoi facultatif d'un document via WhatsApp Cloud API.
 *
 * Sans `WHATSAPP_TOKEN` et `WHATSAPP_PHONE_ID`, le portail ne prétend jamais
 * envoyer : il prépare un lien wa.me et le directeur garde la main.
 */

export function whatsappCloudConfigure(): boolean {
  return Boolean(
    process.env.WHATSAPP_TOKEN?.trim() &&
      process.env.WHATSAPP_PHONE_ID?.trim(),
  );
}

function numeroInternational(telephone: string): string {
  const chiffres = telephone.replace(/\D/g, "");
  return chiffres.startsWith("228") ? chiffres : `228${chiffres}`;
}

export type ResultatEnvoiWhatsApp = {
  ok: boolean;
  erreur?: string;
};

export async function envoyerBulletinWhatsApp({
  telephone,
  pdf,
  nomFichier,
  legende,
}: {
  telephone: string;
  pdf: Uint8Array;
  nomFichier: string;
  legende: string;
}): Promise<ResultatEnvoiWhatsApp> {
  const token = process.env.WHATSAPP_TOKEN?.trim();
  const phoneId = process.env.WHATSAPP_PHONE_ID?.trim();
  if (!token || !phoneId) {
    return { ok: false, erreur: "WhatsApp Cloud API non configurée." };
  }

  const version = process.env.WHATSAPP_API_VERSION?.trim() || "v21.0";
  const base = `https://graph.facebook.com/${version}/${phoneId}`;

  try {
    const media = new FormData();
    media.append("messaging_product", "whatsapp");
    media.append("type", "application/pdf");
    media.append(
      "file",
      new Blob([pdf as unknown as BlobPart], { type: "application/pdf" }),
      nomFichier,
    );

    const envoiMedia = await fetch(`${base}/media`, {
      method: "POST",
      headers: { Authorization: `Bearer ${token}` },
      body: media,
    });
    const mediaJson = (await envoiMedia.json()) as {
      id?: string;
      error?: { message?: string };
    };
    if (!envoiMedia.ok || !mediaJson.id) {
      return {
        ok: false,
        erreur:
          mediaJson.error?.message ??
          `Échec de l'envoi du fichier (${envoiMedia.status}).`,
      };
    }

    const envoi = await fetch(`${base}/messages`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        messaging_product: "whatsapp",
        recipient_type: "individual",
        to: numeroInternational(telephone),
        type: "document",
        document: {
          id: mediaJson.id,
          filename: nomFichier,
          caption: legende,
        },
      }),
    });
    const envoiJson = (await envoi.json()) as {
      error?: { message?: string };
    };
    if (!envoi.ok) {
      return {
        ok: false,
        erreur:
          envoiJson.error?.message ??
          `Échec de l'envoi du message (${envoi.status}).`,
      };
    }

    return { ok: true };
  } catch (erreur) {
    return {
      ok: false,
      erreur:
        erreur instanceof Error
          ? erreur.message
          : "Erreur réseau pendant l'envoi WhatsApp.",
    };
  }
}
