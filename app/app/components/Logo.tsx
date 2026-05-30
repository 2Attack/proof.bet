"use client";

interface LogoProps {
  onClick?: () => void;
  size?: "header" | "hero";
}

export function Logo({ onClick, size = "header" }: LogoProps) {
  return (
    <div
      className="brand-wordmark"
      data-size={size}
      onClick={onClick}
      style={onClick ? { cursor: "pointer" } : undefined}
    >
      <span className="wm-word">
        proof<span className="wm-tld">.bet</span>
      </span>
    </div>
  );
}
