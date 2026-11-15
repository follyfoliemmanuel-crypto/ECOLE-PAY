import Link from "next/link";
import type { ButtonHTMLAttributes, ReactNode } from "react";
import { cx } from "@/lib/cx";

export type VarianteBouton =
  | "principal"
  | "secondaire"
  | "fantome"
  | "danger"
  | "succes"
  | "clair";

const variantes: Record<VarianteBouton, string> = {
  principal:
    "bg-brand text-white border border-brand hover:bg-brand-deep hover:border-brand-deep",
  secondaire:
    "bg-surface text-ink border border-line-strong hover:bg-surface-2 hover:border-muted/50",
  fantome:
    "bg-transparent text-ink-2 border border-transparent hover:bg-brand-soft hover:text-brand",
  danger:
    "bg-impaye-soft text-impaye border border-impaye/25 hover:bg-impaye/15",
  succes:
    "bg-paye text-white border border-paye hover:bg-paye/90",
  clair:
    "bg-white/10 text-white border border-white/20 hover:bg-white/15",
};

const tailles = {
  sm: "h-8 px-3 text-[13px] gap-1.5",
  md: "h-10 px-4 text-sm gap-2",
  lg: "h-11 px-5 text-[15px] gap-2",
};

type Commun = {
  variante?: VarianteBouton;
  taille?: keyof typeof tailles;
  className?: string;
  children: ReactNode;
};

export function Bouton({
  variante = "principal",
  taille = "md",
  className,
  children,
  ...props
}: Commun & ButtonHTMLAttributes<HTMLButtonElement>) {
  return (
    <button
      className={cx(
        "inline-flex items-center justify-center rounded-sm font-semibold transition-colors duration-150 disabled:cursor-not-allowed disabled:opacity-50",
        variantes[variante],
        tailles[taille],
        className,
      )}
      {...props}
    >
      {children}
    </button>
  );
}

export function LienBouton({
  href,
  variante = "principal",
  taille = "md",
  className,
  children,
  ...props
}: Commun & {
  href: string;
  target?: string;
  rel?: string;
  title?: string;
  onClick?: () => void;
}) {
  return (
    <Link
      href={href}
      className={cx(
        "inline-flex items-center justify-center rounded-sm font-semibold transition-colors duration-150",
        variantes[variante],
        tailles[taille],
        className,
      )}
      {...props}
    >
      {children}
    </Link>
  );
}
