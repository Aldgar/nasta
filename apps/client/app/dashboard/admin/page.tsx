"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { useAuth } from "../../../lib/auth";
import { api } from "../../../lib/api";

interface AdminStats {
  kycPending: number;
  kycInReview: number;
  openTickets: number;
  unassignedTickets: number;
  abuseReports: number;
  securityReports: number;
  pendingDeletions: number;
  totalUsers: number;
  totalJobs: number;
  activeJobs: number;
  totalBookings: number;
  activeBookings: number;
}

export default function AdminDashboard() {
  const { user, refreshUser } = useAuth();
  const [stats, setStats] = useState<AdminStats>({
    kycPending: 0,
    kycInReview: 0,
    openTickets: 0,
    unassignedTickets: 0,
    abuseReports: 0,
    securityReports: 0,
    pendingDeletions: 0,
    totalUsers: 0,
    totalJobs: 0,
    activeJobs: 0,
    totalBookings: 0,
    activeBookings: 0,
  });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    refreshUser();
  }, [refreshUser]);

  useEffect(() => {
    async function fetchData() {
      const res = await api<Record<string, unknown>>("/admin/dashboard-stats");
      if (res.data) {
        const d = res.data;
        setStats({
          kycPending: (d.kycPending as number) ?? 0,
          kycInReview: (d.kycInReview as number) ?? 0,
          openTickets: (d.openTickets as number) ?? 0,
          unassignedTickets: (d.unassignedTickets as number) ?? 0,
          abuseReports: (d.abuseReports as number) ?? 0,
          securityReports: (d.securityReports as number) ?? 0,
          pendingDeletions: (d.pendingDeletions as number) ?? 0,
          totalUsers: (d.totalUsers as number) ?? 0,
          totalJobs: (d.totalJobs as number) ?? 0,
          activeJobs: (d.activeJobs as number) ?? 0,
          totalBookings: (d.totalBookings as number) ?? 0,
          activeBookings: (d.activeBookings as number) ?? 0,
        });
      }
      setLoading(false);
    }
    fetchData();
  }, []);

  const modules: {
    href: string;
    icon: string;
    label: string;
    desc: string;
    stat?: number;
    statLabel?: string;
    color: string;
  }[] = [
    {
      href: "/dashboard/admin/kyc",
      icon: "🪪",
      label: "KYC Reviews",
      desc: "Identity verification queue",
      stat: stats.kycPending + stats.kycInReview,
      statLabel: `${stats.kycPending} pending · ${stats.kycInReview} in review`,
      color: "var(--primary)",
    },
    {
      href: "/dashboard/admin/support",
      icon: "🎫",
      label: "Support Tickets",
      desc: "User support requests",
      stat: stats.openTickets,
      statLabel: `${stats.unassignedTickets} unassigned`,
      color: "var(--soft-blue)",
    },
    {
      href: "/dashboard/admin/reports",
      icon: "🚨",
      label: "Abuse Reports",
      desc: "Community safety reports",
      stat: stats.abuseReports,
      statLabel: "open reports",
      color: "var(--alert-red)",
    },
    {
      href: "/dashboard/admin/security",
      icon: "🔒",
      label: "Security Reports",
      desc: "Security incident reports",
      stat: stats.securityReports,
      statLabel: "open reports",
      color: "var(--warm-coral)",
    },
    {
      href: "/dashboard/admin/users",
      icon: "👥",
      label: "Manage Users",
      desc: "User accounts & roles",
      stat: stats.totalUsers,
      statLabel: "total users",
      color: "var(--achievement-green)",
    },
    {
      href: "/dashboard/admin/deletions",
      icon: "🗑️",
      label: "Deletion Requests",
      desc: "Account deletion queue",
      stat: stats.pendingDeletions,
      statLabel: "pending",
      color: "var(--fulfillment-gold)",
    },
    {
      href: "/dashboard/admin/jobs",
      icon: "💼",
      label: "Job Movements",
      desc: "Track job lifecycle, bookings & payments",
      stat: stats.totalJobs,
      statLabel: `${stats.activeJobs} active · ${stats.activeBookings} bookings in progress`,
      color: "var(--fulfillment-gold)",
    },
    {
      href: "/dashboard/admin/surveys",
      icon: "📊",
      label: "Surveys",
      desc: "User feedback & survey responses",
      color: "var(--soft-gray)",
    },
    {
      href: "/dashboard/admin/admins",
      icon: "🛡️",
      label: "Manage Admins",
      desc: "Admin accounts & permissions",
      color: "var(--primary)",
    },
  ];

  return (
    <div className="mx-auto max-w-6xl space-y-8">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-[var(--foreground)]">
          Admin Mission Control 🛡️
        </h1>
        <p className="mt-1 text-sm text-[var(--muted-text)]">
          Welcome back, {user?.displayName || user?.firstName || "Admin"}.
          Platform overview at a glance.
        </p>
      </div>

      {/* Stat cards */}
      {!loading && (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <div className="rounded-xl border border-[var(--border-color)] bg-[var(--surface)] p-4">
            <p className="text-xs uppercase tracking-wider text-[var(--muted-text)]">
              KYC Queue
            </p>
            <p className="mt-1 text-2xl font-bold text-[var(--primary)]">
              {stats.kycPending + stats.kycInReview}
            </p>
          </div>
          <div className="rounded-xl border border-[var(--border-color)] bg-[var(--surface)] p-4">
            <p className="text-xs uppercase tracking-wider text-[var(--muted-text)]">
              Open Tickets
            </p>
            <p className="mt-1 text-2xl font-bold text-[var(--soft-blue)]">
              {stats.openTickets}
            </p>
          </div>
          <div className="rounded-xl border border-[var(--border-color)] bg-[var(--surface)] p-4">
            <p className="text-xs uppercase tracking-wider text-[var(--muted-text)]">
              Reports
            </p>
            <p className="mt-1 text-2xl font-bold text-[var(--alert-red)]">
              {stats.abuseReports + stats.securityReports}
            </p>
          </div>
          <div className="rounded-xl border border-[var(--border-color)] bg-[var(--surface)] p-4">
            <p className="text-xs uppercase tracking-wider text-[var(--muted-text)]">
              Total Users
            </p>
            <p className="mt-1 text-2xl font-bold text-[var(--achievement-green)]">
              {stats.totalUsers}
            </p>
          </div>
          <div className="rounded-xl border border-[var(--border-color)] bg-[var(--surface)] p-4">
            <p className="text-xs uppercase tracking-wider text-[var(--muted-text)]">
              Active Jobs
            </p>
            <p className="mt-1 text-2xl font-bold text-[var(--fulfillment-gold)]">
              {stats.activeJobs}
            </p>
          </div>
          <div className="rounded-xl border border-[var(--border-color)] bg-[var(--surface)] p-4">
            <p className="text-xs uppercase tracking-wider text-[var(--muted-text)]">
              Active Bookings
            </p>
            <p className="mt-1 text-2xl font-bold text-[var(--warm-coral)]">
              {stats.activeBookings}
            </p>
          </div>
        </div>
      )}

      {/* Module grid */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
        {modules.map((mod) => (
          <Link
            key={mod.href}
            href={mod.href}
            className="group glass-surface rounded-xl p-5 transition-all hover:shadow-lg"
            style={{ "--hover-color": mod.color } as React.CSSProperties}
          >
            <div
              className="mb-3 flex h-10 w-10 items-center justify-center rounded-lg text-xl"
              style={{
                background: `color-mix(in srgb, ${mod.color} 15%, transparent)`,
              }}
            >
              {mod.icon}
            </div>
            <h3 className="font-semibold text-[var(--foreground)] group-hover:text-[var(--primary)] transition-colors">
              {mod.label}
            </h3>
            <p className="mt-1 text-xs text-[var(--muted-text)]">{mod.desc}</p>
            {mod.stat !== undefined && (
              <div className="mt-3 border-t border-[var(--border-color)] pt-2">
                <span
                  className="text-lg font-bold"
                  style={{ color: mod.color }}
                >
                  {mod.stat}
                </span>
                {mod.statLabel && (
                  <span className="ml-1.5 text-xs text-[var(--muted-text)]">
                    {mod.statLabel}
                  </span>
                )}
              </div>
            )}
          </Link>
        ))}
      </div>
    </div>
  );
}
