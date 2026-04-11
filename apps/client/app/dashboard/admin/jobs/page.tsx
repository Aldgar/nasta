"use client";
import { useEffect, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import { api } from "../../../../lib/api";

interface JobItem {
  id: string;
  title: string;
  status: string;
  city: string;
  country: string;
  createdAt: string;
  isInstantBook: boolean;
  paymentType: string;
  salaryMin?: number;
  salaryMax?: number;
  currency?: string;
  employer: { id: string; email: string; firstName: string; lastName: string };
  category?: { id: string; name: string };
  _count: { applications: number; bookings: number };
}

const STATUS_TABS = [
  "ALL",
  "ACTIVE",
  "ASSIGNED",
  "COMPLETED",
  "PAUSED",
  "CLOSED",
  "EXPIRED",
  "CANCELLED_NO_SHOW",
  "DRAFT",
] as const;

const STATUS_COLORS: Record<string, string> = {
  DRAFT: "bg-gray-200 text-gray-700",
  ACTIVE: "bg-emerald-100 text-emerald-800",
  ASSIGNED: "bg-blue-100 text-blue-800",
  COMPLETED: "bg-green-100 text-green-800",
  PAUSED: "bg-yellow-100 text-yellow-800",
  CLOSED: "bg-gray-300 text-gray-800",
  EXPIRED: "bg-red-100 text-red-700",
  CANCELLED_NO_SHOW: "bg-red-200 text-red-800",
};

export default function AdminJobsPage() {
  const router = useRouter();
  const [items, setItems] = useState<JobItem[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [status, setStatus] = useState<string>("ALL");
  const [search, setSearch] = useState("");
  const [searchInput, setSearchInput] = useState("");
  const [loading, setLoading] = useState(true);
  const limit = 20;

  const fetchJobs = useCallback(async () => {
    setLoading(true);
    const params = new URLSearchParams();
    params.set("page", String(page));
    params.set("limit", String(limit));
    if (status !== "ALL") params.set("status", status);
    if (search) params.set("search", search);
    const res = await api<{ items: JobItem[]; total: number }>(
      `/admin/jobs?${params.toString()}`,
    );
    if (res.data) {
      setItems(res.data.items);
      setTotal(res.data.total);
    }
    setLoading(false);
  }, [page, status, search]);

  useEffect(() => {
    fetchJobs();
  }, [fetchJobs]);

  const totalPages = Math.max(1, Math.ceil(total / limit));

  return (
    <div className="mx-auto max-w-7xl space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-[var(--foreground)]">
          Job Movements 💼
        </h1>
        <p className="mt-1 text-sm text-[var(--muted-text)]">
          Track all jobs, applications, bookings &amp; payments across the
          platform.
        </p>
      </div>

      {/* Search */}
      <form
        onSubmit={(e) => {
          e.preventDefault();
          setPage(1);
          setSearch(searchInput);
        }}
        className="flex gap-2"
      >
        <input
          type="text"
          value={searchInput}
          onChange={(e) => setSearchInput(e.target.value)}
          placeholder="Search by job title or employer email…"
          className="flex-1 rounded-lg border border-[var(--border-color)] bg-[var(--surface)] px-3 py-2 text-sm text-[var(--foreground)] placeholder:text-[var(--muted-text)] focus:outline-none focus:ring-2 focus:ring-[var(--primary)]"
        />
        <button
          type="submit"
          className="rounded-lg bg-[var(--primary)] px-4 py-2 text-sm font-medium text-white hover:opacity-90 transition-opacity"
        >
          Search
        </button>
        {search && (
          <button
            type="button"
            onClick={() => {
              setSearchInput("");
              setSearch("");
              setPage(1);
            }}
            className="rounded-lg border border-[var(--border-color)] px-3 py-2 text-sm text-[var(--muted-text)] hover:text-[var(--foreground)] transition-colors"
          >
            Clear
          </button>
        )}
      </form>

      {/* Status tabs */}
      <div className="flex flex-wrap gap-2">
        {STATUS_TABS.map((tab) => (
          <button
            key={tab}
            onClick={() => {
              setStatus(tab);
              setPage(1);
            }}
            className={`rounded-full px-3 py-1 text-xs font-medium transition-colors ${
              status === tab
                ? "bg-[var(--primary)] text-white"
                : "bg-[var(--surface)] text-[var(--muted-text)] border border-[var(--border-color)] hover:text-[var(--foreground)]"
            }`}
          >
            {tab.replace(/_/g, " ")}
          </button>
        ))}
      </div>

      {/* Table */}
      <div className="overflow-x-auto rounded-xl border border-[var(--border-color)] bg-[var(--surface)]">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-[var(--border-color)] text-left text-xs uppercase tracking-wider text-[var(--muted-text)]">
              <th className="px-4 py-3">Title</th>
              <th className="px-4 py-3">Employer</th>
              <th className="px-4 py-3">Status</th>
              <th className="px-4 py-3">Category</th>
              <th className="px-4 py-3">City</th>
              <th className="px-4 py-3 text-center">Apps</th>
              <th className="px-4 py-3 text-center">Bookings</th>
              <th className="px-4 py-3">Pay</th>
              <th className="px-4 py-3">Created</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr>
                <td
                  colSpan={9}
                  className="px-4 py-12 text-center text-[var(--muted-text)]"
                >
                  Loading…
                </td>
              </tr>
            ) : items.length === 0 ? (
              <tr>
                <td
                  colSpan={9}
                  className="px-4 py-12 text-center text-[var(--muted-text)]"
                >
                  No jobs found.
                </td>
              </tr>
            ) : (
              items.map((job) => (
                <tr
                  key={job.id}
                  onClick={() => router.push(`/dashboard/admin/jobs/${job.id}`)}
                  className="cursor-pointer border-b border-[var(--border-color)] transition-colors hover:bg-[var(--primary)]/5"
                >
                  <td className="px-4 py-3 font-medium text-[var(--foreground)]">
                    {job.title}
                    {job.isInstantBook && (
                      <span className="ml-1.5 text-xs text-[var(--fulfillment-gold)]">
                        ⚡
                      </span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-[var(--muted-text)]">
                    {job.employer.firstName} {job.employer.lastName}
                  </td>
                  <td className="px-4 py-3">
                    <span
                      className={`inline-block rounded-full px-2 py-0.5 text-xs font-medium ${
                        STATUS_COLORS[job.status] ?? "bg-gray-100 text-gray-700"
                      }`}
                    >
                      {job.status.replace(/_/g, " ")}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-[var(--muted-text)]">
                    {job.category?.name ?? "—"}
                  </td>
                  <td className="px-4 py-3 text-[var(--muted-text)]">
                    {job.city ?? "—"}
                  </td>
                  <td className="px-4 py-3 text-center text-[var(--foreground)]">
                    {job._count?.applications ?? 0}
                  </td>
                  <td className="px-4 py-3 text-center text-[var(--foreground)]">
                    {job._count?.bookings ?? 0}
                  </td>
                  <td className="px-4 py-3 text-[var(--muted-text)] whitespace-nowrap">
                    {job.salaryMin != null
                      ? `${job.currency ?? "ZAR"} ${job.salaryMin}${
                          job.salaryMax ? `–${job.salaryMax}` : ""
                        }`
                      : "—"}
                  </td>
                  <td className="px-4 py-3 text-[var(--muted-text)] whitespace-nowrap">
                    {new Date(job.createdAt).toLocaleDateString()}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between">
          <p className="text-xs text-[var(--muted-text)]">
            {total} job{total !== 1 ? "s" : ""} · Page {page} of {totalPages}
          </p>
          <div className="flex gap-2">
            <button
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              disabled={page <= 1}
              className="rounded-lg border border-[var(--border-color)] px-3 py-1.5 text-sm disabled:opacity-40"
            >
              ← Prev
            </button>
            <button
              onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
              disabled={page >= totalPages}
              className="rounded-lg border border-[var(--border-color)] px-3 py-1.5 text-sm disabled:opacity-40"
            >
              Next →
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
