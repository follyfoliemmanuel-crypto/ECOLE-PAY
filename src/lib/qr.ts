import QRCode from "qrcode";

/** QR code prêt à insérer dans une balise <img>, en data URL PNG. */
export async function qrCodeDataUrl(contenu: string): Promise<string> {
  return QRCode.toDataURL(contenu, {
    width: 720,
    margin: 1,
    errorCorrectionLevel: "M",
    color: {
      dark: "#082b4b",
      light: "#ffffff",
    },
  });
}
