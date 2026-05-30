"use client";

import { useState } from "react";

interface HashishProps {
  value: string | bigint;
  chars?: number;
}

/**
 * Truncated hash / address with a copy affordance. Mirrors the design
 * `Hashish`: the truncated body always shows; only the trailing
 * `.hashish-copy` label toggles between "copy" and "✓ copied".
 *
 * Accepts a `bigint` (live mode passes raw VRF words / request ids) and
 * renders it as a 0x-padded 32-byte hex string.
 */
export function Hashish({ value, chars = 6 }: HashishProps) {
  const [copied, setCopied] = useState(false);
  const str =
    typeof value === "bigint"
      ? `0x${value.toString(16).padStart(64, "0")}`
      : value;
  const short =
    str.length > chars * 2 + 4
      ? `${str.slice(0, chars + 2)}…${str.slice(-chars)}`
      : str;

  const copy = () => {
    navigator.clipboard?.writeText(str).catch(() => {});
    setCopied(true);
    setTimeout(() => setCopied(false), 1100);
  };

  return (
    <button className="hashish mono" title={str} onClick={copy}>
      {short}
      <span className="hashish-copy">{copied ? "✓ copied" : "copy"}</span>
    </button>
  );
}
