import type { Metadata, Viewport } from "next";
import { Archivo, JetBrains_Mono } from "next/font/google";
import "./globals.css";

const archivo = Archivo({
  subsets: ["latin"],
  display: "swap",
  variable: "--font-archivo",
  weight: ["400", "500", "600", "700"],
});

const jetbrains = JetBrains_Mono({
  subsets: ["latin"],
  display: "swap",
  variable: "--font-jetbrains",
  weight: ["400", "500", "600"],
});

export const metadata: Metadata = {
  metadataBase: new URL(process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000"),
  title: {
    default: "ECOLE PAY — Gestion des frais scolaires",
    template: "%s · ECOLE PAY",
  },
  description:
    "L'application des écoles privées au Togo pour suivre les frais de scolarité, envoyer les reçus WhatsApp et relancer les impayés.",
  applicationName: "ECOLE PAY",
  keywords: [
    "frais scolaires",
    "école privée",
    "Togo",
    "Lomé",
    "reçu WhatsApp",
    "gestion scolaire",
  ],
  authors: [{ name: "ECOLE PAY" }],
  appleWebApp: {
    capable: true,
    title: "ECOLE PAY",
    statusBarStyle: "black-translucent",
  },
  openGraph: {
    type: "website",
    locale: "fr_TG",
    siteName: "ECOLE PAY",
    title: "ECOLE PAY — Gestion des frais scolaires",
    description:
      "L'application des écoles privées au Togo pour suivre les frais de scolarité, envoyer les reçus WhatsApp et relancer les impayés.",
    images: ["/logo-ecole-pay.png"],
  },
};

export const viewport: Viewport = {
  themeColor: "#0d3b66",
  width: "device-width",
  initialScale: 1,
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="fr" className={`${archivo.variable} ${jetbrains.variable}`}>
      <body>{children}</body>
    </html>
  );
}
