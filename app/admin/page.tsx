"use client";

import { useState, useEffect } from "react";
import { useSearchParams } from "next/navigation";
import { Suspense } from "react";

interface ClientAnalytics {
  slug: string;
  jobId: string;
  businessName: string;
  industry: string;
  previewUrl: string;
  buildStatus: string;
  paymentState: {
    depositPaid: boolean;
    finalPaid: boolean;
    monthlyActive: boolean;
  };
  analytics: {
    thisMonth: { views: number; bookingClicks: number; contactClicks: number };
    today: { views: number; bookingClicks: number };
    totals: { views: number; bookingClicks: number; formSubmits: number };
  } | null;
  bookingCount: number;
  hasBooking: boolean;
  builtAt?: string;
}

function Spark({ data }: { data: Record<string, number> }) {
  const vals = Object.values(data).slice(-14);
  const max = Math.max(...vals, 1);
  return (
    <div style={{ display: "flex", alignItems: "flex-end", gap: "2px", height: "28px" }}>
      {vals.map((v, i) => (
        <div key={i} style={{ flex: 1, background: v > 0 ? "#00c896" : "#1a1a1a", borderRadius: "2px", height: `${Math.max(3, (v / max) * 100)}%`, opacity: v > 0 ? 1 : 0.4 }} />
      ))}
    </div>
  );
}

function AdminDashboard() {
  const searchParams = useSearchParams();
  const secret = searchParams.get("secret") || "";

  const [clients, setClients] = useState<ClientAnalytics[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [search, setSearch] = useState("");

  useEffect(() => {
    if (!secret) { setError("Missing secret. Add ?secret=YOUR_PROCESS_SECRET to the URL."); setLoading(false); return; }
    loadDashboard();
  }, [secret]);

  async function loadDashboard() {
    setLoading(true);
    try {
      const res = await fetch(`/api/admin/clients?secret=${encodeURIComponent(secret)}`);
      if (!res.ok) throw new Error("Forbidden — check your secret");
      const data = await res.json();
      setClients(data.clients || []);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load");
    } finally { setLoading(false); }
  }

  const filtered = clients.filter(c =>
    !search || c.businessName.toLowerCase().includes(search.toLowerCase()) || c.industry?.toLowerCase().includes(search.toLowerCase())
  );

  const totals = {
    clients: clients.length,
    active: clients.filter(c => c.paymentState?.monthlyActive).length,
    views: clients.reduce((a, c) => a + (c.analytics?.thisMonth.views || 0), 0),
    bookings: clients.reduce((a, c) => a + c.bookingCount, 0),
  };

  const s = {
    page: { minHeight: "100vh", background: "#080808", color: "#fff", fontFamily: "'Inter',-apple-system,sans-serif", padding: "24px 16px" } as React.CSSProperties,
    card: { background: "#0f0f0f", border: "1px solid #1a1a1a", borderRadius: "14px", padding: "18px", marginBottom: "12px" } as React.CSSProperties,
    statBox: { background: "#0f0f0f", border: "1px solid #1a1a1a", borderRadius: "12px", padding: "16px", flex: 1 } as React.CSSProperties,
    badge: (color: string): React.CSSProperties => ({ display: "inline-block", background: `${color}18`, color, border: `1px solid ${color}33`, borderRadius: "20px", padding: "2px 8px", fontSize: "11px", fontWeight: 600 }),
    input: { background: "#111", border: "1px solid #1a1a1a", borderRadius: "8px", padding: "10px 14px", color: "#fff", fontSize: "14px", outline: "none", width: "100%", boxSizing: "border-box" as const } as React.CSSProperties,
  };

  return (
    <div style={s.page}>
      <div style={{ maxWidth: "900px", margin: "0 auto" }}>

        {/* Header */}
        <div style={{ display: "flex", alignItems: "center", gap: "12px", marginBottom: "28px", flexWrap: "wrap" }}>
          <span style={{ fontSize: "28px" }}>🦎</span>
          <div>
            <div style={{ fontSize: "22px", fontWeight: 800 }}>WebGecko Admin</div>
            <div style={{ color: "#444", fontSize: "13px" }}>Client Analytics Overview</div>
          </div>
          <button onClick={loadDashboard} style={{ marginLeft: "auto", background: "#111", border: "1px solid #1a1a1a", color: "#555", borderRadius: "8px", padding: "8px 14px", fontSize: "13px", cursor: "pointer" }}>↻ Refresh</button>
        </div>

        {error && <div style={{ background: "#1a0808", border: "1px solid #ef444433", borderRadius: "10px", padding: "14px", color: "#ef4444", marginBottom: "20px" }}>{error}</div>}

        {/* Summary stats */}
        {!loading && !error && (
          <div style={{ display: "flex", gap: "10px", marginBottom: "24px", flexWrap: "wrap" }}>
            {[
              { label: "Total Clients", value: totals.clients, color: "#fff" },
              { label: "Monthly Active", value: totals.active, color: "#00c896" },
              { label: "Views This Month", value: totals.views.toLocaleString(), color: "#3b82f6" },
              { label: "Total Bookings", value: totals.bookings, color: "#f59e0b" },
            ].map(st => (
              <div key={st.label} style={s.statBox}>
                <div style={{ fontSize: "22px", fontWeight: 800, color: st.color }}>{st.value}</div>
                <div style={{ fontSize: "11px", color: "#444", marginTop: "2px" }}>{st.label}</div>
              </div>
            ))}
          </div>
        )}

        {/* Search */}
        <input type="text" placeholder="Search clients…" value={search} onChange={e => setSearch(e.target.value)} style={{ ...s.input, marginBottom: "16px" }} />

        {loading && <div style={{ color: "#444", textAlign: "center", padding: "60px" }}>Loading clients…</div>}

        {/* Client cards */}
        {filtered.map(c => {
          const a = c.analytics;
          const statusColor = c.buildStatus === "complete" ? "#00c896" : c.buildStatus === "building" ? "#f59e0b" : "#ef4444";
          const payBadge = c.paymentState?.monthlyActive ? ["#00c896", "Active"] : c.paymentState?.finalPaid ? ["#3b82f6", "Final Paid"] : c.paymentState?.depositPaid ? ["#f59e0b", "Deposit"] : ["#6b7280", "Unpaid"];

          return (
            <div key={c.slug} style={s.card}>
              {/* Top row */}
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: "12px", gap: "8px", flexWrap: "wrap" }}>
                <div>
                  <div style={{ fontWeight: 700, fontSize: "16px" }}>{c.businessName}</div>
                  <div style={{ color: "#555", fontSize: "12px" }}>{c.industry} · /c/{c.slug}</div>
                </div>
                <div style={{ display: "flex", gap: "6px", flexWrap: "wrap" }}>
                  <span style={s.badge(statusColor)}>{c.buildStatus || "pending"}</span>
                  <span style={s.badge(payBadge[0] as string)}>{payBadge[1]}</span>
                  {c.hasBooking && <span style={s.badge("#8b5cf6")}>Bookings</span>}
                </div>
              </div>

              {/* Analytics grid */}
              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(100px,1fr))", gap: "10px", marginBottom: "14px" }}>
                {[
                  { label: "This Month Views", value: a?.thisMonth.views ?? 0, color: "#3b82f6" },
                  { label: "Today Views", value: a?.today.views ?? 0, color: "#00c896" },
                  { label: "Booking Clicks", value: a?.thisMonth.bookingClicks ?? 0, color: "#f59e0b" },
                  { label: "Total Bookings", value: c.bookingCount, color: "#8b5cf6" },
                  { label: "Form Submits", value: a?.totals.formSubmits ?? 0, color: "#06b6d4" },
                  { label: "All-Time Views", value: a?.totals.views ?? 0, color: "#6b7280" },
                ].map(st => (
                  <div key={st.label} style={{ background: "#111", borderRadius: "8px", padding: "10px 12px" }}>
                    <div style={{ fontSize: "18px", fontWeight: 800, color: st.color }}>{st.value.toLocaleString()}</div>
                    <div style={{ fontSize: "10px", color: "#444", marginTop: "2px" }}>{st.label}</div>
                  </div>
                ))}
              </div>

              {/* Links */}
              <div style={{ display: "flex", gap: "8px", flexWrap: "wrap" }}>
                {c.previewUrl && (
                  <a href={c.previewUrl} target="_blank" rel="noreferrer"
                    style={{ background: "#111", border: "1px solid #222", color: "#00c896", borderRadius: "8px", padding: "7px 12px", fontSize: "12px", textDecoration: "none", fontWeight: 600 }}>
                    🌐 Preview
                  </a>
                )}
                <a href={`/bookings?jobId=${c.jobId}&secret=${secret}`} target="_blank" rel="noreferrer"
                  style={{ background: "#111", border: "1px solid #222", color: "#888", borderRadius: "8px", padding: "7px 12px", fontSize: "12px", textDecoration: "none" }}>
                  📅 Bookings
                </a>
                <button
                  onClick={() => {
                    const url = `${window.location.origin}/api/analytics/monthly?jobId=${c.jobId}&secret=${encodeURIComponent(secret)}&send=true`;
                    fetch(url).then(() => alert(`Monthly report sent to ${c.businessName}`));
                  }}
                  style={{ background: "#111", border: "1px solid #222", color: "#888", borderRadius: "8px", padding: "7px 12px", fontSize: "12px", cursor: "pointer" }}>
                  📧 Send Report
                </button>
              </div>
            </div>
          );
        })}

        {!loading && filtered.length === 0 && !error && (
          <div style={{ textAlign: "center", color: "#444", padding: "60px" }}>No clients found.</div>
        )}
      </div>
    </div>
  );
}

export default function AdminPage() {
  return <Suspense fallback={<div style={{ background: "#080808", minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", color: "#444" }}>Loading…</div>}><AdminDashboard /></Suspense>;
}
