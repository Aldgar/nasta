"use client";

import { useEffect } from "react";
import { useParams } from "next/navigation";

export default function JobRedirectPage() {
  const params = useParams();
  const id = params?.id as string;

  useEffect(() => {
    if (!id) return;

    const deepLink = `nasta://jobs/${id}`;
    const dashboardUrl = `/dashboard/jobs/${id}`;

    // Try to open the app via custom scheme
    window.location.href = deepLink;

    // Fallback: redirect to the dashboard page after a short delay
    const timeout = setTimeout(() => {
      window.location.href = dashboardUrl;
    }, 1500);

    return () => clearTimeout(timeout);
  }, [id]);

  return (
    <div
      style={{
        minHeight: "100vh",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        background: "#080F1E",
        color: "#F5E6C8",
        fontFamily:
          "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Arial, sans-serif",
      }}
    >
      <div style={{ textAlign: "center" }}>
        <h1 style={{ fontSize: "24px", marginBottom: "16px" }}>
          Opening Nasta...
        </h1>
        <p style={{ color: "#8B7A5E", fontSize: "14px" }}>
          If the app doesn&apos;t open automatically,{" "}
          <a
            href={`/dashboard/jobs/${id}`}
            style={{ color: "#C9963F", textDecoration: "underline" }}
          >
            click here to view in browser
          </a>
          .
        </p>
      </div>
    </div>
  );
}
