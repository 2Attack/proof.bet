import type { ReactNode } from "react";

interface DataRowProps {
  label: ReactNode;
  value: ReactNode;
  accent?: boolean;
  mono?: boolean;
  title?: string;
}

/**
 * A labelled data field: a mono uppercase kicker on the left, the value
 * (mono by default) on the right. The value sits on a SOLID layer — never
 * directly on glass. Mirrors the design `DataRow`.
 */
export function DataRow({
  label,
  value,
  accent = false,
  mono = true,
  title,
}: DataRowProps) {
  return (
    <div className="data-row">
      <span className="kicker">{label}</span>
      <span
        className={mono ? "mono data-val" : "data-val"}
        style={accent ? { color: "var(--acc)" } : undefined}
        title={title}
      >
        {value}
      </span>
    </div>
  );
}
