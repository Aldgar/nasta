"use client";
import React, { useEffect, useState } from "react";
import Image from "next/image";

type BrandLogoProps = {
  size?: number; // px
  className?: string;
  title?: string;
  animated?: boolean;
  tile?: boolean; // show gradient tile background behind the mark
};

/**
 * BrandLogo
 * Renders the Nasta logo mark filled with the app's brand gradient
 * using CSS masking. This ensures the logo always matches the current
 * theme colors without needing multiple asset variants.
 */
export default function BrandLogo({
  size = 28,
  className = "",
  title = "Nasta",
  animated = false,
  tile = false,
}: BrandLogoProps) {
  // Use the officially selected raster logo from /public for pixel-perfect match.
  const [dark, setDark] = useState(false);
  useEffect(() => {
    const root = document.documentElement;
    const mq = window.matchMedia("(prefers-color-scheme: dark)");
    const apply = () =>
      setDark(
        root.classList.contains("dark") ||
          (!root.classList.contains("light") && mq.matches),
      );
    apply();
    const obs = new MutationObserver(apply);
    obs.observe(root, { attributes: true, attributeFilter: ["class"] });
    mq.addEventListener("change", apply);
    return () => {
      obs.disconnect();
      mq.removeEventListener("change", apply);
    };
  }, []);

  const src = dark ? "/nasta-app-icon.png" : "/NastaLogoLight.png";

  if (!tile) {
    // Render the asset plainly for maximum fidelity
    return (
      <span
        className={className}
        style={{ display: "inline-block", lineHeight: 0 }}
      >
        <Image
          src={src}
          alt={title}
          title={title}
          width={size}
          height={size}
          priority
          style={{ objectFit: "contain" }}
        />
      </span>
    );
  }

  // Tile variant: subtle brand gradient backdrop behind the logo
  const gradientStyle: React.CSSProperties = {
    background:
      "linear-gradient(135deg, var(--primary) 0%, var(--soft-blue) 45%, var(--warm-coral) 85%)",
    padding: Math.max(3, Math.round(size * 0.12)),
    borderRadius: 12,
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    lineHeight: 0,
    boxShadow: "0 6px 18px -12px rgba(0,0,0,0.45)",
  };

  return (
    <span
      className={`${animated ? "animate-brand-gradient" : ""} ${className}`.trim()}
      style={gradientStyle}
    >
      <Image
        src={src}
        alt={title}
        title={title}
        width={size}
        height={size}
        priority
        style={{ objectFit: "contain", borderRadius: 10 }}
      />
    </span>
  );
}
