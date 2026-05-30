/**
 * SVG <defs> mounted once: the refraction displacement filter that the
 * glass material (`.glass::after`) references via `filter: url(#hp-refract)`,
 * plus the desaturated grain noise (`.hp-grain` uses `filter: url(#hp-grain)`).
 * Pure markup — no client hooks required.
 */
export function FilterDefs() {
  return (
    <svg width="0" height="0" style={{ position: "absolute" }} aria-hidden="true">
      <defs>
        <filter id="hp-refract" x="-20%" y="-20%" width="140%" height="140%">
          <feTurbulence
            type="fractalNoise"
            baseFrequency="0.012 0.016"
            numOctaves="2"
            seed="7"
            result="n"
          />
          <feDisplacementMap
            in="SourceGraphic"
            in2="n"
            scale="22"
            xChannelSelector="R"
            yChannelSelector="G"
          />
        </filter>
        <filter id="hp-grain">
          <feTurbulence
            type="fractalNoise"
            baseFrequency="0.9"
            numOctaves="2"
            stitchTiles="stitch"
          />
          <feColorMatrix type="saturate" values="0" />
        </filter>
      </defs>
    </svg>
  );
}
