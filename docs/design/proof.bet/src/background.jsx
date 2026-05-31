// ============================================================
// HOUSEPROOF — background + SVG filter defs + shared primitives
// A slow, near-monochrome refraction drift, far behind a solid
// content layer. Honors reduced-motion. Never competes with text.
// ============================================================
const { useState: useStateBg } = React;

// SVG <defs> mounted once: the refraction displacement filter the
// glass material references, plus the soft caustic for the backdrop.
function FilterDefs() {
  return (
    <svg width="0" height="0" style={{ position: 'absolute' }} aria-hidden="true">
      <defs>
        <filter id="hp-refract" x="-20%" y="-20%" width="140%" height="140%">
          <feTurbulence type="fractalNoise" baseFrequency="0.012 0.016"
            numOctaves="2" seed="7" result="n" />
          <feDisplacementMap in="SourceGraphic" in2="n" scale="22"
            xChannelSelector="R" yChannelSelector="G" />
        </filter>
        <filter id="hp-grain">
          <feTurbulence type="fractalNoise" baseFrequency="0.9" numOctaves="2" stitchTiles="stitch" />
          <feColorMatrix type="saturate" values="0" />
        </filter>
      </defs>
    </svg>
  );
}

// the drifting backdrop. `intensity`: 'subtle' | 'calm' | 'static'
function Backdrop({ intensity = 'subtle' }) {
  const moving = intensity !== 'static';
  const dur = intensity === 'calm' ? 34 : 60;
  return (
    <div className="hp-backdrop" aria-hidden="true">
      <div className="hp-blob hp-blob-a" style={{ animationDuration: moving ? `${dur}s` : '0s' }} />
      <div className="hp-blob hp-blob-b" style={{ animationDuration: moving ? `${dur * 1.4}s` : '0s' }} />
      <div className="hp-grain" />
      <div className="hp-vignette" />
    </div>
  );
}

// ---- shared primitives ----

// monospace data field with a small label sitting on a SOLID layer
function DataRow({ label, value, accent, mono = true, title }) {
  return (
    <div className="data-row">
      <span className="kicker">{label}</span>
      <span className={mono ? 'mono data-val' : 'data-val'}
        style={accent ? { color: 'var(--acc)' } : null} title={title}>{value}</span>
    </div>
  );
}

// truncated hash / address with copy affordance
function Hashish({ value, chars = 6 }) {
  const [copied, setCopied] = useStateBg(false);
  const short = value.length > chars * 2 + 4
    ? `${value.slice(0, chars + 2)}…${value.slice(-chars)}` : value;
  return (
    <button className="hashish mono" title={value} onClick={() => {
      navigator.clipboard?.writeText(value).catch(() => {});
      setCopied(true); setTimeout(() => setCopied(false), 1100);
    }}>
      {short}
      <span className="hashish-copy">{copied ? '✓ copied' : 'copy'}</span>
    </button>
  );
}

// primary / ghost / accent buttons
function Btn({ children, kind = 'ghost', onClick, disabled, full, type, ...rest }) {
  return (
    <button type={type || 'button'} className={`btn btn-${kind}${full ? ' btn-full' : ''}`}
      onClick={onClick} disabled={disabled} {...rest}>
      <span>{children}</span>
    </button>
  );
}

Object.assign(window, { FilterDefs, Backdrop, DataRow, Hashish, Btn });
