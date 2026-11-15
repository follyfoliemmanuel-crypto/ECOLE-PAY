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
