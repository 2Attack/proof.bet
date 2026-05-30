"use client";

import { useState } from "react";

interface HashishProps {
  value: string | bigint;
  chars?: number;
}

export function Hashish({ value, chars = 6 }: HashishProps) {
  const [copied, setCopied] = useState(false);
  const str = typeof value === "bigint" ? `0x${value.toString(16).padStart(64, "0")}` : String(value);
  const short = str.length > chars * 2 + 2
    ? str.slice(0, chars + 2) + "…" + str.slice(-chars)
    : str;

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(str);
      setCopied(true);
      setTimeout(() => setCopied(false), 1200);
    } catch {}
  };

  return (
    <button className="hashish mono" onClick={copy} title={str}>
      {copied ? "copied ✓" : short}
      <span className="hashish-copy">copy</span>
    </button>
  );
}
