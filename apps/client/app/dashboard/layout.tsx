"use client";
import { useEffect, useState, useRef, useCallback } from "react";
import { useRouter, usePathname } from "next/navigation";
import Image from "next/image";
import Link from "next/link";
import { useAuth } from "../../lib/auth";
import { useLanguage } from "../../context/LanguageContext";
import Avatar from "../../components/Avatar";

/* ── Theme helper ────────────────────────────────────────────────────── */

type ThemePref = "light" | "dark" | "system";

function applyTheme(pref: ThemePref) {
  const root = document.documentElement;
  root.classList.remove("dark", "light");
  if (pref === "dark") {
    root.classList.add("dark");
  } else if (pref === "light") {
    root.classList.add("light");
  } else {
    if (window.matchMedia("(prefers-color-scheme: dark)").matches) {
      root.classList.add("dark");
    }
  }
  localStorage.setItem("pref_theme", pref);
}

/* ── SVG Icon Components ─────────────────────────────────────────────── */

function IconHome({ className = "h-5 w-5" }: { className?: string }) {
  return (
    <svg
      className={className}
      fill="none"
      viewBox="0 0 24 24"
      stroke="currentColor"
      strokeWidth={1.8}
    >
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M2.25 12l8.954-8.955a1.126 1.126 0 011.591 0L21.75 12M4.5 9.75v10.125c0 .621.504 1.125 1.125 1.125H9.75v-4.875c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125V21h4.125c.621 0 1.125-.504 1.125-1.125V9.75M8.25 21h8.25"
      />
    </svg>
  );
}

function IconSearch({ className = "h-5 w-5" }: { className?: string }) {
  return (
    <svg
      className={className}
      fill="none"
      viewBox="0 0 24 24"
      stroke="currentColor"
      strokeWidth={1.8}
    >
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M21 21l-5.197-5.197m0 0A7.5 7.5 0 105.196 5.196a7.5 7.5 0 0010.607 10.607z"
      />
    </svg>
  );
}

function IconClipboard({ className = "h-5 w-5" }: { className?: string }) {
  return (
    <svg
      className={className}
      fill="none"
      viewBox="0 0 24 24"
      stroke="currentColor"
      strokeWidth={1.8}
    >
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M9 12h3.75M9 15h3.75M9 18h3.75m3 .75H18a2.25 2.25 0 002.25-2.25V6.108c0-1.135-.845-2.098-1.976-2.192a48.424 48.424 0 00-1.123-.08m-5.801 0c-.065.21-.1.433-.1.664 0 .414.336.75.75.75h4.5a.75.75 0 00.75-.75 2.25 2.25 0 00-.1-.664m-5.8 0A2.251 2.251 0 0113.5 2.25H15a2.25 2.25 0 012.15 1.586m-5.8 0c-.376.023-.75.05-1.124.08C9.095 4.01 8.25 4.973 8.25 6.108V8.25m0 0H4.875c-.621 0-1.125.504-1.125 1.125v11.25c0 .621.504 1.125 1.125 1.125h9.75c.621 0 1.125-.504 1.125-1.125V9.375c0-.621-.504-1.125-1.125-1.125H8.25z"
      />
    </svg>
  );
}

function IconCalendar({ className = "h-5 w-5" }: { className?: string }) {
  return (
    <svg
      className={className}
      fill="none"
      viewBox="0 0 24 24"
      stroke="currentColor"
      strokeWidth={1.8}
    >
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M6.75 3v2.25M17.25 3v2.25M3 18.75V7.5a2.25 2.25 0 012.25-2.25h13.5A2.25 2.25 0 0121 7.5v11.25m-18 0A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75m-18 0v-7.5A2.25 2.25 0 015.25 9h13.5A2.25 2.25 0 0121 11.25v7.5"
      />
    </svg>
  );
}

function IconWallet({ className = "h-5 w-5" }: { className?: string }) {
  return (
    <svg
      className={className}
      fill="none"
      viewBox="0 0 24 24"
      stroke="currentColor"
      strokeWidth={1.8}
    >
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M21 12a2.25 2.25 0 00-2.25-2.25H15a3 3 0 11-6 0H5.25A2.25 2.25 0 003 12m18 0v6a2.25 2.25 0 01-2.25 2.25H5.25A2.25 2.25 0 013 18v-6m18 0V9M3 12V9m18 0a2.25 2.25 0 00-2.25-2.25H5.25A2.25 2.25 0 003 9m18 0V6a2.25 2.25 0 00-2.25-2.25H5.25A2.25 2.25 0 003 6v3"
      />
    </svg>
  );
}

function IconSupport({ className = "h-5 w-5" }: { className?: string }) {
  return (
    <svg
      className={className}
      fill="none"
      viewBox="0 0 24 24"
      stroke="currentColor"
      strokeWidth={1.8}
    >
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M8.625 9.75a.375.375 0 11-.75 0 .375.375 0 01.75 0zm0 0H8.25m4.125 0a.375.375 0 11-.75 0 .375.375 0 01.75 0zm0 0H12m4.125 0a.375.375 0 11-.75 0 .375.375 0 01.75 0zm0 0h-.375m-13.5 3.01c0 1.6 1.123 2.994 2.707 3.227 1.087.16 2.185.283 3.293.369V21l4.184-4.183a1.14 1.14 0 01.778-.332 48.294 48.294 0 005.83-.498c1.585-.233 2.708-1.626 2.708-3.228V6.741c0-1.602-1.123-2.995-2.707-3.228A48.394 48.394 0 0012 3c-2.392 0-4.744.175-7.043.513C3.373 3.746 2.25 5.14 2.25 6.741v6.018z"
      />
    </svg>
  );
}

function IconBell({ className = "h-5 w-5" }: { className?: string }) {
  return (
    <svg
      className={className}
      fill="none"
      viewBox="0 0 24 24"
      stroke="currentColor"
      strokeWidth={1.8}
    >
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M14.857 17.082a23.848 23.848 0 005.454-1.31A8.967 8.967 0 0118 9.75v-.7V9A6 6 0 006 9v.75a8.967 8.967 0 01-2.312 6.022c1.733.64 3.56 1.085 5.455 1.31m5.714 0a24.255 24.255 0 01-5.714 0m5.714 0a3 3 0 11-5.714 0"
      />
    </svg>
  );
}

function IconCog({ className = "h-5 w-5" }: { className?: string }) {
  return (
    <svg
      className={className}
      fill="none"
      viewBox="0 0 24 24"
      stroke="currentColor"
      strokeWidth={1.8}
    >
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M9.594 3.94c.09-.542.56-.94 1.11-.94h2.593c.55 0 1.02.398 1.11.94l.213 1.281c.063.374.313.686.645.87.074.04.147.083.22.127.324.196.72.257 1.075.124l1.217-.456a1.125 1.125 0 011.37.49l1.296 2.247a1.125 1.125 0 01-.26 1.431l-1.003.827c-.293.24-.438.613-.431.992a6.759 6.759 0 010 .255c-.007.378.138.75.43.99l1.005.828c.424.35.534.954.26 1.43l-1.298 2.247a1.125 1.125 0 01-1.369.491l-1.217-.456c-.355-.133-.75-.072-1.076.124a6.57 6.57 0 01-.22.128c-.331.183-.581.495-.644.869l-.213 1.28c-.09.543-.56.941-1.11.941h-2.594c-.55 0-1.02-.398-1.11-.94l-.213-1.281c-.062-.374-.312-.686-.644-.87a6.52 6.52 0 01-.22-.127c-.325-.196-.72-.257-1.076-.124l-1.217.456a1.125 1.125 0 01-1.369-.49l-1.297-2.247a1.125 1.125 0 01.26-1.431l1.004-.827c.292-.24.437-.613.43-.992a6.932 6.932 0 010-.255c.007-.378-.138-.75-.43-.99l-1.004-.828a1.125 1.125 0 01-.26-1.43l1.297-2.247a1.125 1.125 0 011.37-.491l1.216.456c.356.133.751.072 1.076-.124.072-.044.146-.087.22-.128.332-.183.582-.495.644-.869l.214-1.281z"
      />
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"
      />
    </svg>
  );
}

function IconPlus({ className = "h-5 w-5" }: { className?: string }) {
  return (
    <svg
      className={className}
      fill="none"
      viewBox="0 0 24 24"
      stroke="currentColor"
      strokeWidth={1.8}
    >
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M12 4.5v15m7.5-7.5h-15"
      />
    </svg>
  );
}

function IconFolder({ className = "h-5 w-5" }: { className?: string }) {
  return (
    <svg
      className={className}
      fill="none"
      viewBox="0 0 24 24"
      stroke="currentColor"
      strokeWidth={1.8}
    >
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M2.25 12.75V12A2.25 2.25 0 014.5 9.75h15A2.25 2.25 0 0121.75 12v.75m-8.69-6.44l-2.12-2.12a1.5 1.5 0 00-1.061-.44H4.5A2.25 2.25 0 002.25 6v12a2.25 2.25 0 002.25 2.25h15A2.25 2.25 0 0021.75 18V9a2.25 2.25 0 00-2.25-2.25h-5.379a1.5 1.5 0 01-1.06-.44z"
      />
    </svg>
  );
}

function IconUsers({ className = "h-5 w-5" }: { className?: string }) {
  return (
    <svg
      className={className}
      fill="none"
      viewBox="0 0 24 24"
      stroke="currentColor"
      strokeWidth={1.8}
    >
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M15 19.128a9.38 9.38 0 002.625.372 9.337 9.337 0 004.121-.952 4.125 4.125 0 00-7.533-2.493M15 19.128v-.003c0-1.113-.285-2.16-.786-3.07M15 19.128v.106A12.318 12.318 0 018.624 21c-2.331 0-4.512-.645-6.374-1.766l-.001-.109a6.375 6.375 0 0111.964-3.07M12 6.375a3.375 3.375 0 11-6.75 0 3.375 3.375 0 016.75 0zm8.25 2.25a2.625 2.625 0 11-5.25 0 2.625 2.625 0 015.25 0z"
      />
    </svg>
  );
}

function IconShield({ className = "h-5 w-5" }: { className?: string }) {
  return (
    <svg
      className={className}
      fill="none"
      viewBox="0 0 24 24"
      stroke="currentColor"
      strokeWidth={1.8}
    >
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M9 12.75L11.25 15 15 9.75m-3-7.036A11.959 11.959 0 013.598 6 11.99 11.99 0 003 9.749c0 5.592 3.824 10.29 9 11.623 5.176-1.332 9-6.03 9-11.622 0-1.31-.21-2.571-.598-3.751h-.152c-3.196 0-6.1-1.248-8.25-3.285z"
      />
    </svg>
  );
}

function IconFlag({ className = "h-5 w-5" }: { className?: string }) {
  return (
    <svg
      className={className}
      fill="none"
      viewBox="0 0 24 24"
      stroke="currentColor"
      strokeWidth={1.8}
    >
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M3 3v1.5M3 21v-6m0 0l2.77-.693a9 9 0 016.208.682l.108.054a9 9 0 006.086.71l3.114-.732a48.524 48.524 0 01-.005-10.499l-3.11.732a9 9 0 01-6.085-.711l-.108-.054a9 9 0 00-6.208-.682L3 4.5M3 15V4.5"
      />
    </svg>
  );
}

function IconChart({ className = "h-5 w-5" }: { className?: string }) {
  return (
    <svg
      className={className}
      fill="none"
      viewBox="0 0 24 24"
      stroke="currentColor"
      strokeWidth={1.8}
    >
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M3 13.125C3 12.504 3.504 12 4.125 12h2.25c.621 0 1.125.504 1.125 1.125v6.75C7.5 20.496 6.996 21 6.375 21h-2.25A1.125 1.125 0 013 19.875v-6.75zM9.75 8.625c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125v11.25c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 01-1.125-1.125V8.625zM16.5 4.125c0-.621.504-1.125 1.125-1.125h2.25C20.496 3 21 3.504 21 4.125v15.75c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 01-1.125-1.125V4.125z"
      />
    </svg>
  );
}

function IconTicket({ className = "h-5 w-5" }: { className?: string }) {
  return (
    <svg
      className={className}
      fill="none"
      viewBox="0 0 24 24"
      stroke="currentColor"
      strokeWidth={1.8}
    >
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M16.5 6v.75m0 3v.75m0 3v.75m0 3V18m-9-5.25h5.25M7.5 15h3M3.375 5.25c-.621 0-1.125.504-1.125 1.125v3.026a2.999 2.999 0 010 5.198v3.026c0 .621.504 1.125 1.125 1.125h17.25c.621 0 1.125-.504 1.125-1.125v-3.026a2.999 2.999 0 010-5.198V6.375c0-.621-.504-1.125-1.125-1.125H3.375z"
      />
    </svg>
  );
}

function IconDocument({ className = "h-5 w-5" }: { className?: string }) {
  return (
    <svg
      className={className}
      fill="none"
      viewBox="0 0 24 24"
      stroke="currentColor"
      strokeWidth={1.8}
    >
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M19.5 14.25v-2.625a3.375 3.375 0 00-3.375-3.375h-1.5A1.125 1.125 0 0113.5 7.125v-1.5a3.375 3.375 0 00-3.375-3.375H8.25m0 12.75h7.5m-7.5 3H12M10.5 2.25H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 00-9-9z"
      />
    </svg>
  );
}

function IconSun({ className = "h-5 w-5" }: { className?: string }) {
  return (
    <svg
      className={className}
      fill="none"
      viewBox="0 0 24 24"
      stroke="currentColor"
      strokeWidth={1.8}
    >
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M12 3v2.25m6.364.386l-1.591 1.591M21 12h-2.25m-.386 6.364l-1.591-1.591M12 18.75V21m-4.773-4.227l-1.591 1.591M5.25 12H3m4.227-4.773L5.636 5.636M15.75 12a3.75 3.75 0 11-7.5 0 3.75 3.75 0 017.5 0z"
      />
    </svg>
  );
}

function IconMoon({ className = "h-5 w-5" }: { className?: string }) {
  return (
    <svg
      className={className}
      fill="none"
      viewBox="0 0 24 24"
      stroke="currentColor"
      strokeWidth={1.8}
    >
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M21.752 15.002A9.718 9.718 0 0118 15.75c-5.385 0-9.75-4.365-9.75-9.75 0-1.33.266-2.597.748-3.752A9.753 9.753 0 003 11.25C3 16.635 7.365 21 12.75 21a9.753 9.753 0 006.002-2.082z"
      />
    </svg>
  );
}

function IconMonitor({ className = "h-5 w-5" }: { className?: string }) {
  return (
    <svg
      className={className}
      fill="none"
      viewBox="0 0 24 24"
      stroke="currentColor"
      strokeWidth={1.8}
    >
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M9 17.25v1.007a3 3 0 01-.879 2.122L7.5 21h9l-.621-.621A3 3 0 0115 18.257V17.25m6-12V15a2.25 2.25 0 01-2.25 2.25H5.25A2.25 2.25 0 013 15V5.25A2.25 2.25 0 015.25 3h13.5A2.25 2.25 0 0121 5.25z"
      />
    </svg>
  );
}

/* ── Icon map ────────────────────────────────────────────────────────── */

function IconChat({ className = "h-5 w-5" }: { className?: string }) {
  return (
    <svg
      className={className}
      fill="none"
      viewBox="0 0 24 24"
      stroke="currentColor"
      strokeWidth={1.8}
    >
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M20.25 8.511c.884.284 1.5 1.128 1.5 2.097v4.286c0 1.136-.847 2.1-1.98 2.193-.34.027-.68.052-1.02.072v3.091l-3-3c-1.354 0-2.694-.055-4.02-.163a2.115 2.115 0 01-.825-.242m9.345-8.334a2.126 2.126 0 00-.476-.095 48.64 48.64 0 00-8.048 0c-1.131.094-1.976 1.057-1.976 2.192v4.286c0 .837.46 1.58 1.155 1.951m9.345-8.334V6.637c0-1.621-1.152-3.026-2.76-3.235A48.455 48.455 0 0011.25 3c-2.115 0-4.198.137-6.24.402-1.608.209-2.76 1.614-2.76 3.235v6.226c0 1.621 1.152 3.026 2.76 3.235.577.075 1.157.14 1.74.194V21l4.155-4.155"
      />
    </svg>
  );
}

function IconTrash({ className = "h-5 w-5" }: { className?: string }) {
  return (
    <svg
      className={className}
      fill="none"
      viewBox="0 0 24 24"
      stroke="currentColor"
      strokeWidth={1.8}
    >
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M14.74 9l-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 01-2.244 2.077H8.084a2.25 2.25 0 01-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 00-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 013.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 00-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0 00-7.5 0"
      />
    </svg>
  );
}

const ICON_MAP: Record<string, React.FC<{ className?: string }>> = {
  home: IconHome,
  search: IconSearch,
  clipboard: IconClipboard,
  calendar: IconCalendar,
  wallet: IconWallet,
  support: IconSupport,
  bell: IconBell,
  cog: IconCog,
  plus: IconPlus,
  folder: IconFolder,
  users: IconUsers,
  shield: IconShield,
  flag: IconFlag,
  chart: IconChart,
  ticket: IconTicket,
  chat: IconChat,
  trash: IconTrash,
};

/* ── Navigation definitions ──────────────────────────────────────────── */

interface NavItem {
  href: string;
  icon: string;
  label: string;
  tKey?: string;
}

const NAV_ITEMS: Record<string, NavItem[]> = {
  JOB_SEEKER: [
    { href: "/dashboard", icon: "home", label: "Home", tKey: "web.nav.home" },
    {
      href: "/dashboard/jobs",
      icon: "search",
      label: "Find Work",
      tKey: "web.nav.findWork",
    },
    {
      href: "/dashboard/applications",
      icon: "clipboard",
      label: "Applications",
      tKey: "web.nav.applications",
    },
    {
      href: "/dashboard/schedule",
      icon: "calendar",
      label: "Schedule",
      tKey: "web.nav.schedule",
    },
    {
      href: "/dashboard/payments",
      icon: "wallet",
      label: "Payments",
      tKey: "web.nav.payments",
    },
    {
      href: "/dashboard/support",
      icon: "support",
      label: "Support",
      tKey: "web.nav.support",
    },
    {
      href: "/dashboard/notifications",
      icon: "bell",
      label: "Notifications",
      tKey: "web.nav.notifications",
    },
    {
      href: "/dashboard/settings",
      icon: "cog",
      label: "Settings",
      tKey: "web.nav.settings",
    },
  ],
  EMPLOYER: [
    {
      href: "/dashboard/employer",
      icon: "home",
      label: "Home",
      tKey: "web.nav.home",
    },
    {
      href: "/dashboard/employer/post-job",
      icon: "plus",
      label: "Post Job",
      tKey: "web.nav.postJob",
    },
    {
      href: "/dashboard/employer/my-jobs",
      icon: "folder",
      label: "My Jobs",
      tKey: "web.nav.myJobs",
    },
    {
      href: "/dashboard/employer/applications",
      icon: "clipboard",
      label: "Applications",
      tKey: "web.nav.applications",
    },
    {
      href: "/dashboard/employer/service-providers",
      icon: "users",
      label: "Service Providers",
      tKey: "web.nav.serviceProviders",
    },
    {
      href: "/dashboard/employer/payments",
      icon: "wallet",
      label: "Payments",
      tKey: "web.nav.payments",
    },
    {
      href: "/dashboard/support",
      icon: "support",
      label: "Support",
      tKey: "web.nav.support",
    },
    {
      href: "/dashboard/notifications",
      icon: "bell",
      label: "Notifications",
      tKey: "web.nav.notifications",
    },
    {
      href: "/dashboard/settings",
      icon: "cog",
      label: "Settings",
      tKey: "web.nav.settings",
    },
  ],
  ADMIN: [
    { href: "/dashboard/admin", icon: "home", label: "Home" },
    { href: "/dashboard/admin/users", icon: "users", label: "Users" },
    { href: "/dashboard/admin/kyc", icon: "shield", label: "KYC Reviews" },
    { href: "/dashboard/admin/support", icon: "ticket", label: "Support" },
    { href: "/dashboard/admin/chat", icon: "chat", label: "Chat" },
    { href: "/dashboard/admin/reports", icon: "flag", label: "Reports" },
    { href: "/dashboard/admin/deletions", icon: "trash", label: "Deletions" },
    { href: "/dashboard/admin/surveys", icon: "chart", label: "Surveys" },
    { href: "/dashboard/notifications", icon: "bell", label: "Notifications" },
    { href: "/dashboard/settings", icon: "cog", label: "Settings" },
  ],
};

/* ── Layout ──────────────────────────────────────────────────────────── */

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const { user, loading, logout } = useAuth();
  const { language: lang, setLanguage: langSetLanguage, t } = useLanguage();
  const [mobileOpen, setMobileOpen] = useState(false);
  const [expanded, setExpanded] = useState(false);
  const [hovered, setHovered] = useState(false);
  const hoverTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [avatarMenuOpen, setAvatarMenuOpen] = useState(false);
  const [themePref, setThemePref] = useState<ThemePref>("system");
  const [unreadNotifs, setUnreadNotifs] = useState(0);
  const avatarRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const stored = localStorage.getItem("pref_theme") as ThemePref | null;
    if (stored === "light" || stored === "dark") setThemePref(stored);
    else setThemePref("system");
  }, []);

  const cycleTheme = useCallback(() => {
    const next: ThemePref =
      themePref === "system"
        ? "light"
        : themePref === "light"
          ? "dark"
          : "system";
    setThemePref(next);
    applyTheme(next);
  }, [themePref]);

  useEffect(() => {
    if (!loading && !user) {
      router.replace("/login");
    }
  }, [loading, user, router]);

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (avatarRef.current && !avatarRef.current.contains(e.target as Node)) {
        setAvatarMenuOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  useEffect(() => {
    if (!user) return;
    const token =
      typeof window !== "undefined" ? localStorage.getItem("auth_token") : null;
    if (!token) return;
    const base =
      process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://localhost:3001";
    const fetchCount = () =>
      fetch(`${base}/notifications/unread-count`, {
        headers: { Authorization: `Bearer ${token}` },
      })
        .then((r) => (r.ok ? r.json() : null))
        .then((d) => {
          if (d?.count !== undefined) setUnreadNotifs(d.count);
        })
        .catch(() => {});
    fetchCount();
    const iv = setInterval(fetchCount, 30000);
    return () => clearInterval(iv);
  }, [user]);

  if (loading || !user) {
    return (
      <div className="flex h-screen items-center justify-center bg-brand-gradient">
        <div className="flex flex-col items-center gap-4">
          <Image
            src="/NastaLogoLight.png"
            alt="Nasta"
            width={80}
            height={80}
            priority
            className="animate-float-slow"
          />
          <div className="h-1 w-32 overflow-hidden rounded-full bg-[var(--border-color)]">
            <div className="h-full w-1/3 animate-[shimmer_1.5s_ease-in-out_infinite] rounded-full bg-[var(--primary)]" />
          </div>
        </div>
      </div>
    );
  }

  const navItems = NAV_ITEMS[user.role] ?? NAV_ITEMS.JOB_SEEKER;
  const initials = (user.firstName?.[0] ?? user.email[0] ?? "?").toUpperCase();
  const roleName =
    user.role === "JOB_SEEKER"
      ? t("web.nav.serviceProvider", "Service Provider")
      : user.role === "EMPLOYER"
        ? t("web.nav.employer", "Employer")
        : "Admin";

  return (
    <div className="flex h-screen bg-[var(--background)] overflow-hidden">
      {/* ── Mobile overlay ─────────────────────────────────────── */}
      {mobileOpen && (
        <div
          className="fixed inset-0 z-40 bg-black/60 backdrop-blur-sm lg:hidden"
          onClick={() => setMobileOpen(false)}
        />
      )}

      {/* ── Sidebar ────────────────────────────────────────────── */}
      <aside
        onMouseEnter={() => {
          if (hoverTimer.current) clearTimeout(hoverTimer.current);
          hoverTimer.current = setTimeout(() => setHovered(true), 300);
        }}
        onMouseLeave={() => {
          if (hoverTimer.current) clearTimeout(hoverTimer.current);
          hoverTimer.current = null;
          setHovered(false);
        }}
        className={`
          fixed inset-y-0 left-0 z-50 flex flex-col border-r border-[var(--border-color)] bg-[var(--surface)] transition-all duration-300 ease-in-out
          lg:static
          ${mobileOpen ? "translate-x-0 w-60" : "-translate-x-full w-60"}
          ${expanded || hovered ? "lg:w-60" : "lg:w-[68px]"}
          lg:translate-x-0
        `}
      >
        {/* Sidebar header */}
        <div className="flex h-14 shrink-0 items-center border-b border-[var(--border-color)] px-3">
          <Link
            href="/dashboard"
            className="flex items-center gap-2.5 overflow-hidden"
          >
            <Image
              src="/nasta-app-icon.png"
              alt="Nasta"
              width={32}
              height={32}
              className="shrink-0 rounded-lg"
            />
            <span
              className={`text-lg font-bold text-[var(--foreground)] whitespace-nowrap transition-opacity duration-200 ${expanded || hovered ? "opacity-100" : "lg:opacity-0 lg:w-0"}`}
            >
              Nasta
            </span>
          </Link>
          {/* Close button on mobile */}
          <button
            className="ml-auto rounded-md p-1 text-[var(--muted-text)] hover:bg-[var(--surface-alt)] lg:hidden"
            onClick={() => setMobileOpen(false)}
          >
            <svg
              className="h-5 w-5"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              strokeWidth={2}
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M6 18L18 6M6 6l12 12"
              />
            </svg>
          </button>
        </div>

        {/* Role badge -- visible when expanded */}
        <div
          className={`shrink-0 px-3 pt-3 pb-1 transition-opacity duration-200 ${expanded || hovered ? "opacity-100" : "lg:opacity-0 lg:h-0 lg:overflow-hidden lg:pt-0 lg:pb-0"}`}
        >
          <span className="inline-flex items-center gap-1.5 rounded-full bg-[var(--primary)]/15 px-2.5 py-0.5 text-[10px] font-semibold tracking-wide text-[var(--primary)]">
            <span className="h-1.5 w-1.5 rounded-full bg-[var(--primary)]" />
            {roleName}
          </span>
        </div>

        {/* Nav items */}
        <nav className="flex-1 overflow-y-auto overflow-x-hidden px-2 py-3">
          <ul className="space-y-1">
            {navItems.map((item) => {
              const active =
                pathname === item.href ||
                (item.href !== "/dashboard" &&
                  item.href !== "/dashboard/employer" &&
                  item.href !== "/dashboard/admin" &&
                  pathname.startsWith(item.href));
              const Icon = ICON_MAP[item.icon] ?? IconHome;
              const label = item.tKey ? t(item.tKey, item.label) : item.label;
              return (
                <li key={item.href}>
                  <Link
                    href={item.href}
                    onClick={() => setMobileOpen(false)}
                    title={expanded || hovered ? undefined : label}
                    className={`group relative flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-all ${
                      active
                        ? "bg-[var(--primary)]/15 text-[var(--primary)]"
                        : "text-[var(--muted-text)] hover:bg-[var(--surface-alt)] hover:text-[var(--foreground)]"
                    }`}
                  >
                    <span className="relative shrink-0">
                      <Icon className="h-5 w-5" />
                      {item.icon === "bell" && unreadNotifs > 0 && (
                        <span className="absolute -right-1 -top-1 flex h-4 min-w-[16px] items-center justify-center rounded-full bg-red-500 px-1 text-[10px] font-bold leading-none text-white">
                          {unreadNotifs > 99 ? "99+" : unreadNotifs}
                        </span>
                      )}
                    </span>
                    <span
                      className={`whitespace-nowrap transition-opacity duration-200 ${expanded || hovered ? "opacity-100" : "lg:opacity-0 lg:w-0 lg:overflow-hidden"}`}
                    >
                      {label}
                    </span>
                    {/* Tooltip when collapsed */}
                    {!expanded && !hovered && (
                      <span className="pointer-events-none absolute left-full ml-2 hidden rounded-md bg-[var(--surface)] px-2 py-1 text-xs font-medium text-[var(--foreground)] shadow-lg border border-[var(--border-color)] opacity-0 transition-opacity group-hover:opacity-100 lg:block whitespace-nowrap z-50">
                        {label}
                      </span>
                    )}
                  </Link>
                </li>
              );
            })}
          </ul>
        </nav>

        {/* Legal links */}
        <div className="shrink-0 border-t border-[var(--border-color)] px-2 pt-2 pb-1">
          <p
            className={`mb-1 px-3 text-[10px] font-semibold uppercase tracking-wider text-[var(--muted-text)] transition-opacity duration-200 ${expanded || hovered ? "opacity-100" : "lg:opacity-0 lg:h-0 lg:overflow-hidden lg:mb-0"}`}
          >
            {t("web.nav.legal", "Legal")}
          </p>
          {[
            {
              href: "/dashboard/legal/terms",
              label: t("web.nav.termsOfService", "Terms of Service"),
            },
            {
              href: "/dashboard/legal/privacy",
              label: t("web.nav.privacyPolicy", "Privacy Policy"),
            },
            {
              href: "/dashboard/legal/platform-rules",
              label: t("web.nav.platformRules", "Platform Rules"),
            },
          ].map((link) => (
            <Link
              key={link.href}
              href={link.href}
              title={expanded || hovered ? undefined : link.label}
              className="group relative flex items-center gap-3 rounded-lg px-3 py-1.5 text-xs text-[var(--muted-text)] transition-colors hover:bg-[var(--surface-alt)] hover:text-[var(--foreground)]"
            >
              <IconDocument className="h-4 w-4 shrink-0" />
              <span
                className={`whitespace-nowrap transition-opacity duration-200 ${expanded || hovered ? "opacity-100" : "lg:opacity-0 lg:w-0 lg:overflow-hidden"}`}
              >
                {link.label}
              </span>
              {!expanded && !hovered && (
                <span className="pointer-events-none absolute left-full ml-2 hidden rounded-md bg-[var(--surface)] px-2 py-1 text-xs font-medium text-[var(--foreground)] shadow-lg border border-[var(--border-color)] opacity-0 transition-opacity group-hover:opacity-100 lg:block whitespace-nowrap z-50">
                  {link.label}
                </span>
              )}
            </Link>
          ))}
        </div>

        {/* Expand / collapse toggle -- desktop only */}
        <div className="hidden lg:block shrink-0 border-t border-[var(--border-color)] p-2">
          <button
            onClick={() => setExpanded(!expanded)}
            className="flex w-full items-center justify-center rounded-lg p-2 text-[var(--muted-text)] transition-colors hover:bg-[var(--surface-alt)] hover:text-[var(--foreground)]"
            title={expanded ? "Collapse sidebar" : "Expand sidebar"}
          >
            <svg
              className={`h-4 w-4 transition-transform duration-200 ${expanded ? "rotate-180" : ""}`}
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              strokeWidth={2}
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M13.5 4.5L21 12m0 0l-7.5 7.5M21 12H3"
              />
            </svg>
          </button>
        </div>

        {/* User info at bottom */}
        <div
          className={`shrink-0 border-t border-[var(--border-color)] p-3 ${expanded || hovered ? "" : "lg:flex lg:justify-center"}`}
        >
          <div
            className={`flex items-center gap-3 ${expanded || hovered ? "" : "lg:justify-center"}`}
          >
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-[var(--primary)]/20 text-sm font-bold text-[var(--primary)]">
              {initials}
            </div>
            <div
              className={`flex-1 overflow-hidden transition-opacity duration-200 ${expanded || hovered ? "opacity-100" : "lg:hidden"}`}
            >
              <p className="truncate text-sm font-medium text-[var(--foreground)]">
                {user.displayName || user.firstName || user.email}
              </p>
              <p className="truncate text-xs text-[var(--muted-text)]">
                {user.email}
              </p>
            </div>
          </div>
        </div>
      </aside>

      {/* ── Main area ──────────────────────────────────────────── */}
      <div className="flex flex-1 flex-col overflow-hidden">
        {/* Top bar */}
        <header className="flex h-14 shrink-0 items-center gap-4 border-b border-[var(--border-color)] bg-[var(--surface)]/80 px-4 backdrop-blur-md">
          {/* Mobile hamburger */}
          <button
            className="rounded-md p-1.5 text-[var(--muted-text)] hover:bg-[var(--surface-alt)] lg:hidden"
            onClick={() => setMobileOpen(true)}
          >
            <svg
              className="h-5 w-5"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              strokeWidth={2}
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M3.75 6.75h16.5M3.75 12h16.5m-16.5 5.25h16.5"
              />
            </svg>
          </button>

          {/* Search bar */}
          <div className="hidden flex-1 lg:block">
            <form
              onSubmit={(e) => {
                e.preventDefault();
                const fd = new FormData(e.currentTarget);
                const q = (fd.get("q") as string)?.trim();
                if (q) {
                  const base =
                    user.role === "EMPLOYER"
                      ? "/dashboard/employer/my-jobs"
                      : "/dashboard/jobs";
                  router.push(`${base}?search=${encodeURIComponent(q)}`);
                }
              }}
              className="relative max-w-md"
            >
              <svg
                className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[var(--muted-text)]"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
                strokeWidth={2}
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M21 21l-5.197-5.197m0 0A7.5 7.5 0 105.196 5.196a7.5 7.5 0 0010.607 10.607z"
                />
              </svg>
              <input
                name="q"
                type="search"
                placeholder={t(
                  "web.nav.searchPlaceholder",
                  "Search jobs, applications...",
                )}
                className="w-full rounded-lg border border-[var(--border-color)] bg-[var(--surface-alt)] py-2 pl-9 pr-3 text-sm text-[var(--foreground)] placeholder:text-[var(--muted-text)] focus:outline-none focus:ring-2 focus:ring-[var(--primary)]/40"
              />
            </form>
          </div>

          {/* Right side actions */}
          <div className="ml-auto flex items-center gap-2">
            {/* Language toggle */}
            <button
              onClick={() => langSetLanguage(lang === "en" ? "pt" : "en")}
              title={
                lang === "en" ? "Mudar para Português" : "Switch to English"
              }
              className="rounded-lg px-2 py-1.5 text-xs font-semibold text-[var(--muted-text)] transition-colors hover:bg-[var(--surface-alt)] hover:text-[var(--foreground)]"
            >
              {lang === "en" ? "🇵🇹 PT" : "🇬🇧 EN"}
            </button>
            {/* Theme toggle */}
            <button
              onClick={cycleTheme}
              title={`Theme: ${themePref} (click to cycle)`}
              className="relative rounded-lg p-2 text-[var(--muted-text)] transition-colors hover:bg-[var(--surface-alt)] hover:text-[var(--foreground)]"
            >
              {themePref === "dark" ? (
                <IconMoon className="h-5 w-5" />
              ) : themePref === "light" ? (
                <IconSun className="h-5 w-5" />
              ) : (
                <IconMonitor className="h-5 w-5" />
              )}
            </button>

            <Link
              href="/dashboard/notifications"
              className="relative rounded-lg p-2 text-[var(--muted-text)] transition-colors hover:bg-[var(--surface-alt)] hover:text-[var(--foreground)]"
            >
              <IconBell className="h-5 w-5" />
              {unreadNotifs > 0 && (
                <span className="absolute right-1 top-1 flex h-4 min-w-[16px] items-center justify-center rounded-full bg-red-500 px-1 text-[10px] font-bold leading-none text-white">
                  {unreadNotifs > 99 ? "99+" : unreadNotifs}
                </span>
              )}
            </Link>

            {/* Avatar dropdown */}
            <div ref={avatarRef} className="relative">
              <button
                onClick={() => setAvatarMenuOpen(!avatarMenuOpen)}
                className="flex h-8 w-8 items-center justify-center rounded-full bg-[var(--primary)] text-xs font-bold text-white transition-shadow hover:ring-2 hover:ring-[var(--primary)]/40 overflow-hidden"
              >
                <Avatar
                  src={user.avatarUrl}
                  imgClassName="h-full w-full object-cover"
                  fallback={initials}
                />
              </button>
              {avatarMenuOpen && (
                <div className="absolute right-0 top-full mt-2 w-56 rounded-xl border border-[var(--border-color)] bg-[var(--surface)] p-1 shadow-xl z-50">
                  <div className="px-3 py-2.5 border-b border-[var(--border-color)]">
                    <p className="text-sm font-medium text-[var(--foreground)]">
                      {user.displayName || user.firstName || user.email}
                    </p>
                    <p className="text-xs text-[var(--muted-text)]">
                      {roleName}
                    </p>
                  </div>
                  <Link
                    href="/dashboard/profile"
                    onClick={() => setAvatarMenuOpen(false)}
                    className="flex items-center gap-2.5 rounded-lg px-3 py-2 text-sm text-[var(--muted-text)] transition-colors hover:bg-[var(--surface-alt)] hover:text-[var(--foreground)] mt-1"
                  >
                    <svg
                      className="h-4 w-4"
                      fill="none"
                      viewBox="0 0 24 24"
                      stroke="currentColor"
                      strokeWidth={1.8}
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        d="M15.75 6a3.75 3.75 0 11-7.5 0 3.75 3.75 0 017.5 0zM4.501 20.118a7.5 7.5 0 0114.998 0A17.933 17.933 0 0112 21.75c-2.676 0-5.216-.584-7.499-1.632z"
                      />
                    </svg>
                    {t("web.nav.myProfile", "My Profile")}
                  </Link>
                  <Link
                    href="/dashboard/settings"
                    onClick={() => setAvatarMenuOpen(false)}
                    className="flex items-center gap-2.5 rounded-lg px-3 py-2 text-sm text-[var(--muted-text)] transition-colors hover:bg-[var(--surface-alt)] hover:text-[var(--foreground)]"
                  >
                    <IconCog className="h-4 w-4" />
                    {t("web.nav.settings", "Settings")}
                  </Link>
                  <div className="my-1 border-t border-[var(--border-color)]" />
                  <button
                    onClick={() => {
                      setAvatarMenuOpen(false);
                      logout();
                    }}
                    className="flex w-full items-center gap-2.5 rounded-lg px-3 py-2 text-sm text-[var(--alert-red)] transition-colors hover:bg-[var(--alert-red)]/10"
                  >
                    <svg
                      className="h-4 w-4"
                      fill="none"
                      viewBox="0 0 24 24"
                      stroke="currentColor"
                      strokeWidth={1.8}
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        d="M15.75 9V5.25A2.25 2.25 0 0013.5 3h-6a2.25 2.25 0 00-2.25 2.25v13.5A2.25 2.25 0 007.5 21h6a2.25 2.25 0 002.25-2.25V15m3 0l3-3m0 0l-3-3m3 3H9"
                      />
                    </svg>
                    {t("web.nav.signOut", "Sign Out")}
                  </button>
                </div>
              )}
            </div>
          </div>
        </header>

        {/* Page content */}
        <main className="flex-1 overflow-y-auto bg-[var(--background)] p-4 lg:p-6">
          {children}
        </main>
      </div>
    </div>
  );
}
