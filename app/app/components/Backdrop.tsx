"use client";

type BackdropIntensity = "subtle" | "calm" | "static";

interface BackdropProps {
  intensity?: BackdropIntensity;
}

/**
 * The drifting near-monochrome refraction backdrop. Sits far behind a
 * solid content layer and never competes with text. Honors reduced-motion.
 *
 * - `subtle` (default): slow 60s drift
 * - `calm`: faster 34s drift
 * - `static`: no motion
 */
export function Backdrop({ intensity = "subtle" }: BackdropProps) {
  const moving = intensity !== "static";
  const dur = intensity === "calm" ? 34 : 60;
  return (
    <div className="hp-backdrop" aria-hidden="true">
      <div
        className="hp-blob hp-blob-a"
        style={{ animationDuration: moving ? `${dur}s` : "0s" }}
      />
      <div
        className="hp-blob hp-blob-b"
        style={{ animationDuration: moving ? `${dur * 1.4}s` : "0s" }}
      />
      <div className="hp-grain" />
      <div className="hp-vignette" />
    </div>
  );
}
