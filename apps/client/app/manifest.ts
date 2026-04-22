import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Nasta — Verified workforce, on demand",
    short_name: "Nasta",
    description:
      "Hire ID-verified service providers or find work near you. Secure payments, real-time tracking.",
    start_url: "/",
    display: "standalone",
    background_color: "#0d0d14",
    theme_color: "#B8822A",
    orientation: "portrait",
    categories: ["business", "productivity"],
    icons: [
      {
        src: "/nasta-app-icon.png",
        sizes: "192x192",
        type: "image/png",
        purpose: "any",
      },
      {
        src: "/nasta-app-icon.png",
        sizes: "512x512",
        type: "image/png",
        purpose: "maskable",
      },
    ],
  };
}
