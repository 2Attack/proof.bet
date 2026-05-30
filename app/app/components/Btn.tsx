"use client";

import type { ButtonHTMLAttributes, ReactNode } from "react";

type BtnKind = "ghost" | "primary" | "accent" | "danger";

interface BtnProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  kind?: BtnKind;
  full?: boolean;
  children: ReactNode;
}

/**
 * Primary / ghost / accent / danger pill button. Mirrors the design `Btn`:
 * the label is wrapped in a `<span>` (so motion/sound layers can target it),
 * and `type` defaults to `"button"` to avoid accidental form submits.
 */
export function Btn({
  kind = "ghost",
  full = false,
  type = "button",
  className = "",
  children,
  ...rest
}: BtnProps) {
  const cls = ["btn", `btn-${kind}`, full ? "btn-full" : "", className]
    .filter(Boolean)
    .join(" ");
  return (
    <button type={type} className={cls} {...rest}>
      <span>{children}</span>
    </button>
  );
}
