import type { Metadata, Viewport } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import { AuthProviderWrapper } from "./providers";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

const SITE_URL =
  process.env.NEXT_PUBLIC_SITE_URL?.replace(/\/$/, "") ?? "https://nasta.app";

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: {
    default: "Nasta — Verified workforce, on demand",
    template: "%s — Nasta",
  },
  description:
    "Nasta is the on-demand workforce marketplace. Hire ID-verified service providers or find work near you, with secure payments and real-time tracking.",
  keywords: [
    "Nasta",
    "on-demand workforce",
    "hire workers",
    "find jobs",
    "service providers",
    "Portugal jobs",
    "verified workers",
    "instant jobs",
    "freelance marketplace",
  ],
  authors: [{ name: "Nasta" }],
  creator: "Nasta",
  publisher: "Nasta",
  applicationName: "Nasta",
  category: "business",
  alternates: {
    canonical: "/",
    languages: {
      en: "/",
      pt: "/",
    },
  },
  openGraph: {
    type: "website",
    siteName: "Nasta",
    title: "Nasta — Verified workforce, on demand",
    description:
      "Hire ID-verified service providers or find work near you. Secure payments, real-time tracking, fair terms.",
    url: SITE_URL,
    locale: "en_IE",
    alternateLocale: ["pt_PT"],
    images: [
      {
        url: "/NastaLogoLight.png",
        width: 1200,
        height: 630,
        alt: "Nasta — Verified workforce marketplace",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "Nasta — Verified workforce, on demand",
    description:
      "Hire ID-verified service providers or find work near you. Secure payments, real-time tracking.",
    images: ["/NastaLogoLight.png"],
  },
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      "max-image-preview": "large",
      "max-snippet": -1,
      "max-video-preview": -1,
    },
  },
  icons: {
    icon: "/favicon.ico",
    apple: "/nasta-app-icon.png",
  },
  manifest: "/manifest.webmanifest",
};

export const viewport: Viewport = {
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#ffffff" },
    { media: "(prefers-color-scheme: dark)", color: "#0d0d14" },
  ],
  width: "device-width",
  initialScale: 1,
};

const organizationJsonLd = {
  "@context": "https://schema.org",
  "@type": "Organization",
  name: "Nasta",
  url: SITE_URL,
  logo: `${SITE_URL}/NastaLogoLight.png`,
  sameAs: [
    "https://x.com/nasta",
    "https://www.linkedin.com/company/nasta",
    "https://www.instagram.com/nasta",
  ],
  contactPoint: [
    {
      "@type": "ContactPoint",
      email: "support@nasta.app",
      contactType: "customer support",
      availableLanguage: ["English", "Portuguese"],
    },
  ],
};

const websiteJsonLd = {
  "@context": "https://schema.org",
  "@type": "WebSite",
  name: "Nasta",
  url: SITE_URL,
  inLanguage: ["en", "pt"],
  potentialAction: {
    "@type": "SearchAction",
    target: `${SITE_URL}/jobs?q={search_term_string}`,
    "query-input": "required name=search_term_string",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        {/* Initialize theme early to avoid flash of incorrect theme */}
        <script
          dangerouslySetInnerHTML={{
            __html: `(() => {
  try {
    var pref = localStorage.getItem('pref_theme');
    var systemDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
    var root = document.documentElement;
    root.classList.remove('dark', 'light');
    if (pref === 'dark') {
      root.classList.add('dark');
    } else if (pref === 'light') {
      root.classList.add('light');
    } else if (systemDark) {
      root.classList.add('dark');
    }
    root.classList.add('theme-transition');
  } catch (_) {}
})();`,
          }}
        />
        {/* SEO — structured data */}
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{
            __html: JSON.stringify(organizationJsonLd),
          }}
        />
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(websiteJsonLd) }}
        />
      </head>
      <body
        className={`${geistSans.variable} ${geistMono.variable} min-h-screen antialiased bg-background text-foreground`}
      >
        <AuthProviderWrapper>{children}</AuthProviderWrapper>
      </body>
    </html>
  );
}
