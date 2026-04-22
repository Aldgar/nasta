import type { MetadataRoute } from "next";

const SITE_URL =
  process.env.NEXT_PUBLIC_SITE_URL?.replace(/\/$/, "") ?? "https://nasta.app";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: "*",
        allow: "/",
        // Keep authenticated and transactional routes out of search indexes
        disallow: [
          "/dashboard",
          "/dashboard/",
          "/onboarding",
          "/onboarding/",
          "/login",
          "/register",
          "/forgot-password",
          "/verify-email",
          "/settings",
          "/settings/",
          "/auth",
          "/auth/",
          "/api/",
        ],
      },
    ],
    sitemap: `${SITE_URL}/sitemap.xml`,
    host: SITE_URL,
  };
}
