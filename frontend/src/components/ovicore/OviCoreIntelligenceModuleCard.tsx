"use client";

import Link from "next/link";

/**
 * Homepage entry for the ONE shared OviCore Intelligence engine.
 * The same engine may later receive entry points from every production module.
 * Render only when the logged-in user is entitled to Intelligence.
 * The backend independently validates every access and data query.
 */
export default function OviCoreIntelligenceModuleCard({
  companyId,
  className = "",
}: {
  companyId?: number | null;
  className?: string;
}) {
  const href = companyId && companyId > 0
    ? `/intelligence?company_id=${encodeURIComponent(String(companyId))}`
    : "/intelligence";

  return (
    <Link
      href={href}
      className={className}
      aria-label="Open OviCore Intelligence"
      style={{
        display: "flex", flexDirection: "column", justifyContent: "space-between",
        minHeight: 170, padding: 17, borderRadius: 14,
        background: "linear-gradient(145deg, #f0fbf5 0%, #ffffff 65%)",
        border: "1px solid #bddbca", boxShadow: "0 2px 10px rgba(15,78,52,0.055)",
        textDecoration: "none", color: "#154a36", minWidth: 0,
      }}
    >
      <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 10 }}>
        <div aria-hidden="true" style={{
          width: 42, height: 42, display: "grid", placeItems: "center", borderRadius: 11,
          background: "#def3e6", color: "#16643f", fontSize: 25,
        }}>✦</div>
        <span style={{fontSize: 10, fontWeight: 800, letterSpacing: ".06em", color: "#1e7650"}}>AI INTELLIGENCE</span>
      </div>
      <div>
        <h3 style={{ margin: "12px 0 5px", fontSize: 18, fontWeight: 800, lineHeight: 1.2 }}>OviCore Intelligence</h3>
        <p style={{ margin: 0, fontSize: 12, color: "#526f60", lineHeight: 1.45 }}>
          Ask questions across your authorised modules. Turn farm data into practical insights.
        </p>
      </div>
      <div style={{ marginTop: 12, fontSize: 12, fontWeight: 700 }}>Open Intelligence <span aria-hidden="true">→</span></div>
    </Link>
  );
}
