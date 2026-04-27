"use client";

import { useState, useEffect } from "react";
import { useRouter, useParams } from "next/navigation";

interface Booking {
  bookingId: string;
  visitorName: string;
  visitorEmail: string;
  visitorPhone: string;
  service: string;
  date: string;
  time: string;
  message?: string;
  status: string;
  createdAt: string;
}

type Filter = "upcoming" | "past" | "all";

export default function ClientBookingAdmin() {
  const router = useRouter();
  const params = useParams();
  const slug = params?.slug as string;

  const [bookings, setBookings] = useState<Booking[]>([]);
  const [jobId, setJobId] = useState("");
  const [filter, setFilter] = useState<Filter>("upcoming");
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [cancelling, setCancelling] = useState<string | null>(null);
  const [stats, setStats] = useState({ total: 0, upcoming: 0, past: 0 });

  useEffect(() => {
    const auth = sessionStorage.getItem(`wg_auth_${slug}`);
    if (!auth) { router.replace("/c"); return; }
    loadData();
  }, [slug]);

  async function loadData() {
    setLoading(true);
    try {
      const clientRes = await fetch(`/api/client-login?slug=${slug}`);
      if (!clientRes.ok) { router.replace("/c"); return; }
      const clientData = await clientRes.json();
      if (!clientData.jobId || !clientData.hasBooking) { router.replace(`/c/${slug}`); return; }
      setJobId(clientData.jobId);

      const res = await fetch(`/api/bookings/client?jobId=${clientData.jobId}&slug=${slug}`);
      if (res.ok) {
        const data = await res.json();
        const all: Booking[] = data.bookings || [];
        setBookings(all);
        const today = new Date().toISOString().split("T")[0];
        setStats({
          total: all.length,
          upcoming: all.filter(b => b.date >= today && b.status !== "cancelled").length,
          past: all.filter(b => b.date < today || b.status === "cancelled").length,
        });
      }
    } catch { /* silent */ }
    finally { setLoading(false); }
  }

  async function cancelBooking(bookingId: string) {
    if (!confirm("Cancel this booking? The customer will not be automatically notified.")) return;
    setCancelling(bookingId);
    try {
      const res = await fetch(
        `/api/bookings/client?jobId=${jobId}&bookingId=${bookingId}&slug=${slug}`,
        { method: "DELETE" }
      );
      if (res.ok) setBookings(prev => prev.map(b => b.bookingId === bookingId ? { ...b, status: "cancelled" } : b));
    } finally { setCancelling(null); }
  }

  const today = new Date().toISOString().split("T")[0];
  const tomorrow = new Date(Date.now() + 86400000).toISOString().split("T")[0];

  const filtered = bookings
    .filter(b => {
      if (filter === "upcoming") return b.date >= today && b.status !== "cancelled";
      if (filter === "past") return b.date < today || b.status === "cancelled";
      return true;
    })
    .filter(b => {
      if (!search) return true;
      const q = search.toLowerCase();
      return b.visitorName.toLowerCase().includes(q) || b.visitorEmail.toLowerCase().includes(q) || b.service.toLowerCase().includes(q);
    })
    .sort((a, b) => a.date < b.date ? 1 : -1);

  const s = {
    page: { minHeight: "100vh", background: "#0a0a0a", color: "#fff", fontFamily: "'Inter',-apple-system,sans-serif" } as React.CSSProperties,
    header: { background: "#111", borderBottom: "1px solid #1f1f1f", padding: "14px 20px", display: "flex", alignItems: "center", gap: "12px", position: "sticky" as const, top: 0, zIndex: 50 } as React.CSSProperties,
    body: { padding: "20px 16px", maxWidth: "680px", margin: "0 auto" } as React.CSSProperties,
    card: { background: "#111", border: "1px solid #1f1f1f", borderRadius: "12px", padding: "16px", marginBottom: "12px" } as React.CSSProperties,
    stat: { background: "#111", border: "1px solid #1f1f1f", borderRadius: "10px", padding: "14px", flex: 1, textAlign: "center" as const } as React.CSSProperties,
    filterBtn: (active: boolean): React.CSSProperties => ({
      padding: "8px 16px", borderRadius: "20px", fontSize: "13px", fontWeight: active ? 600 : 400,
      background: active ? "linear-gradient(135deg,#00c896,#0099ff)" : "none",
      border: active ? "none" : "1px solid #2a2a2a",
      color: active ? "#000" : "#555", cursor: "pointer",
    }),
    pill: (color: string): React.CSSProperties => ({
      display: "inline-block", background: `${color}18`, color, border: `1px solid ${color}33`,
      borderRadius: "20px", padding: "2px 10px", fontSize: "11px", fontWeight: 600,
    }),
  };

  if (loading) return (
    <div style={{ ...s.page, display: "flex", alignItems: "center", justifyContent: "center" }}>
      <div style={{ color: "#444", fontSize: "14px" }}>Loading bookings…</div>
    </div>
  );

  return (
    <div style={s.page}>
      <header style={s.header}>
        <button
          onClick={() => router.push(`/c/${slug}`)}
          style={{ background: "none", border: "none", color: "#666", fontSize: "20px", cursor: "pointer", lineHeight: 1, padding: 0, minWidth: "32px" }}
        >←</button>
        <div style={{ flex: 1 }}>
          <div style={{ fontSize: "15px", fontWeight: 700 }}>Booking Requests</div>
          <div style={{ fontSize: "12px", color: "#444" }}>Manage customer bookings</div>
        </div>
        <button
          onClick={loadData}
          style={{ background: "none", border: "1px solid #1f1f1f", color: "#555", borderRadius: "6px", padding: "6px 12px", fontSize: "12px", cursor: "pointer" }}
        >Refresh</button>
      </header>

      <div style={s.body}>

        {/* Stats */}
        <div style={{ display: "flex", gap: "10px", marginBottom: "20px" }}>
          {[
            { label: "Total", value: stats.total, color: "#fff" },
            { label: "Upcoming", value: stats.upcoming, color: "#00c896" },
            { label: "Past / Cancelled", value: stats.past, color: "#444" },
          ].map(st => (
            <div key={st.label} style={s.stat}>
              <div style={{ fontSize: "22px", fontWeight: 800, color: st.color }}>{st.value}</div>
              <div style={{ fontSize: "11px", color: "#444", marginTop: "2px" }}>{st.label}</div>
            </div>
          ))}
        </div>

        {/* Search */}
        <input
          type="text"
          placeholder="Search by name, email or service…"
          value={search}
          onChange={e => setSearch(e.target.value)}
          style={{
            width: "100%", background: "#111", border: "1px solid #1f1f1f",
            borderRadius: "8px", padding: "12px 14px", color: "#fff", fontSize: "14px",
            marginBottom: "14px", boxSizing: "border-box", outline: "none",
          }}
        />

        {/* Filters */}
        <div style={{ display: "flex", gap: "8px", marginBottom: "20px", flexWrap: "wrap" }}>
          {(["upcoming", "past", "all"] as Filter[]).map(f => (
            <button key={f} style={s.filterBtn(filter === f)} onClick={() => setFilter(f)}>
              {f.charAt(0).toUpperCase() + f.slice(1)}
            </button>
          ))}
        </div>

        {/* Booking list */}
        {filtered.length === 0 ? (
          <div style={{ ...s.card, textAlign: "center", padding: "48px" }}>
            <div style={{ fontSize: "28px", marginBottom: "10px" }}>📅</div>
            <div style={{ color: "#444" }}>No bookings found.</div>
          </div>
        ) : filtered.map(b => {
          const isToday = b.date === today;
          const isTomorrow = b.date === tomorrow;
          const cancelled = b.status === "cancelled";
          return (
            <div key={b.bookingId} style={{
              ...s.card,
              opacity: cancelled ? 0.45 : 1,
              borderColor: isToday ? "#00c89630" : "#1f1f1f",
            }}>
              {/* Top row */}
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: "8px", gap: "8px", flexWrap: "wrap" }}>
                <div>
                  <span style={{ fontWeight: 600, fontSize: "15px" }}>{b.visitorName}</span>
                  {isToday && <span style={{ ...s.pill("#00c896"), marginLeft: "8px", fontSize: "10px" }}>TODAY</span>}
                  {isTomorrow && <span style={{ ...s.pill("#ffaa00"), marginLeft: "8px", fontSize: "10px" }}>TOMORROW</span>}
                </div>
                <span style={s.pill(cancelled ? "#ff4444" : "#00c896")}>{b.status}</span>
              </div>

              {/* Details */}
              <div style={{ color: "#555", fontSize: "13px", marginBottom: "3px" }}>
                {b.service} · {b.date} at {b.time}
              </div>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "4px", fontSize: "12px", color: "#444", marginBottom: "12px" }}>
                <div>📧 {b.visitorEmail}</div>
                <div>📞 {b.visitorPhone}</div>
              </div>

              {b.message && (
                <div style={{ background: "#0d0d0d", borderRadius: "6px", padding: "10px 12px", fontSize: "13px", color: "#555", marginBottom: "12px" }}>
                  {b.message}
                </div>
              )}

              {/* Actions */}
              {!cancelled && (
                <div style={{ display: "flex", gap: "8px", flexWrap: "wrap" }}>
                  <a href={`mailto:${b.visitorEmail}?subject=Your booking with us`}
                    style={{ flex: 1, minWidth: "80px", ...s.pill("#0099ff"), textDecoration: "none", padding: "8px", textAlign: "center", fontSize: "13px" }}>
                    Email
                  </a>
                  <a href={`tel:${b.visitorPhone}`}
                    style={{ flex: 1, minWidth: "80px", ...s.pill("#00c896"), textDecoration: "none", padding: "8px", textAlign: "center", fontSize: "13px" }}>
                    Call
                  </a>
                  <button
                    onClick={() => cancelBooking(b.bookingId)}
                    disabled={cancelling === b.bookingId}
                    style={{ flex: 1, minWidth: "80px", ...s.pill("#ff4444"), cursor: "pointer", padding: "8px", fontSize: "13px" }}
                  >
                    {cancelling === b.bookingId ? "…" : "Cancel"}
                  </button>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}