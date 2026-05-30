"use client";

import type { ButtonHTMLAttributes, ReactNode } from "react";

type BtnKind = "primary" | "accent" | "ghost" | "danger";

interface BtnProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  kind?: BtnKind;
  full?: boolean;
  children: ReactNode;
}

export function Btn({
  kind = "ghost",
  full,
  className = "",
  children,
  ...rest
}: BtnProps) {
  const cls = [
    "btn",
    `btn-${kind}`,
    full ? "btn-full" : "",
    className,
  ]
    .filter(Boolean)
    .join(" ");
  return (
    <button className={cls} {...rest}>
      {children}
    </button>
  );
}
