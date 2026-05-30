"use client";

export function Backdrop() {
  return (
    <div className="hp-backdrop" aria-hidden="true">
      <div className="hp-blob hp-blob-a" />
      <div className="hp-blob hp-blob-b" />
      <div className="hp-vignette" />
    </div>
  );
}
