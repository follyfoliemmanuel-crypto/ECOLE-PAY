import type { MetadataRoute } from "next";

/**
 * Manifeste PWA : ECOLE PAY peut être installée sur le téléphone des
 * directeurs et secrétaires (Android / iOS via « Ajouter à l'écran d'accueil »).
 */
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "ECOLE PAY — Gestion des frais scolaires",
    short_name: "ECOLE PAY",
    description:
      "Suivez les frais de scolarité, envoyez les reçus WhatsApp et relancez les impayés.",
    start_url: "/app",
    scope: "/",
    display: "standalone",
    orientation: "portrait",
    lang: "fr",
    dir: "ltr",
    background_color: "#f4f1e8",
    theme_color: "#0d3b66",
    categories: ["education", "finance", "productivity"],
    icons: [
      {
        src: "/icons/icone-192.png",
        sizes: "192x192",
        type: "image/png",
        purpose: "any",
      },
      {
        src: "/icons/icone-512.png",
        sizes: "512x512",
        type: "image/png",
        purpose: "any",
      },
      {
        src: "/icons/icone-maskable-512.png",
        sizes: "512x512",
        type: "image/png",
        purpose: "maskable",
      },
    ],
  };
}
