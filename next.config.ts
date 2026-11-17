import type { NextConfig } from "next";

/**
 * En-têtes appliqués à toutes les réponses.
 * Volontairement ciblés : pas de CSP `default-src` stricte, qui casserait les
 * scripts inline de Next.js sans nonce. Les directives sensibles sont couvertes.
 */
const entetesSecurite = [
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "X-Frame-Options", value: "DENY" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  // Empêche un autre site d'ouvrir une fenêtre vers l'application et d'en
  // manipuler l'onglet (tabnabbing / fuite d'URL via window.opener).
  { key: "Cross-Origin-Opener-Policy", value: "same-origin" },
  // Aucun contenu Flash/PDF externe ne doit pouvoir charger des ressources
  // inter-domaines à la place de l'application.
  { key: "X-Permitted-Cross-Domain-Policies", value: "none" },
  // Supprime la résolution DNS anticipée des liens affichés (vie privée).
  { key: "X-DNS-Prefetch-Control", value: "off" },
  {
    key: "Permissions-Policy",
    value: "camera=(), microphone=(), geolocation=(), payment=(), usb=()",
  },
  {
    key: "Content-Security-Policy",
    value:
      "frame-ancestors 'none'; base-uri 'self'; object-src 'none'; form-action 'self'",
  },
];

if (process.env.NODE_ENV === "production") {
  entetesSecurite.push({
    key: "Strict-Transport-Security",
    value: "max-age=63072000; includeSubDomains; preload",
  });
}

const nextConfig: NextConfig = {
  // `pg` est un module natif Node : on l'exclut du bundle serveur de Next.
  serverExternalPackages: ["pg"],
  poweredByHeader: false,
  reactStrictMode: true,
  async headers() {
    return [
      {
        source: "/:chemin*",
        headers: entetesSecurite,
      },
    ];
  },
};

export default nextConfig;
