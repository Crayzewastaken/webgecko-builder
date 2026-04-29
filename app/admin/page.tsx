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

type ActionKey = "release" | "fix" | "unlockPayment" | "unlockBooking" | "sendReport";

interface ActionState {
  confirming: ActionKey | null;
  loading: ActionKey | null;
  result: { key: ActionKey; success: boolean; message: string } | null;
}

function ConfirmButton({
  actionKey,
  label,
  confirmLabel,
  confirmMessage,
  color,
  onConfirm,
  state,
  setState,
}: {
  actionKey: ActionKey;
  label: string;
  confirmLabel: string;
  confirmMessage: string;
  color: string;
  onConfirm: () => Promise<void>;
  state: ActionState;
  setState: (s: ActionState) => void;
}) {
  const isConfirming = state.confirming === actionKey;
  const isLoading = state.loading === actionKey;
  const result = state.result?.key === actionKey ? state.result : null;

  if (result) {
    return (
      <div style={{
        display: "flex", alignItems: "center", gap: "6px",
        background: result.success ? "rgba(0,200,150,0.1)" : "rgba(239,68,68,0.1)",
        border: `1px solid ${result.success ? "#00c89633" : "#ef444433"}`,
        borderRadius: "8px", padding: "7px 12px", fontSize: "12px",
        color: result.success ? "#00c896" : "#ef4444",
      }}>
        {result.success ? "✓" : "✗"} {result.message}
        <button
          onClick={() => setState({ ...state, result: null })}
          style={{ marginLeft: "4px", background: "none", border: "none", color: "#555", cursor: "pointer", fontSize: "14px", lineHeight: 1 }}
        >×</button>
      </div>
    );
  }

  if (isConfirming) {
    return (
      <div style={{
        background: "#111", border: `1px solid ${color}44`, borderRadius: "10px",
        padding: "10px 12px", fontSize: "12px",
      }}>
        <div style={{ color: "#ccc", marginBottom: "8px" }}>{confirmMessage}</div>
        <div style={{ display: "flex", gap: "6px" }}>
          <button
            disabled={isLoading}
            onClick={async () => {
              setState({ ...state, loading: actionKey, confirming: null });
              try {
                await onConfirm();
                setState({ confirming: null, loading: null, result: { key: actionKey, success: true, message: `${confirmLabel} done` } });
              } catch (e) {
                setState({ confirming: null, loading: null, result: { key: actionKey, success: false, message: e instanceof Error ? e.message : "Failed" } });
              }
            }}
            style={{
              background: color, color: "#000", border: "none", borderRadius: "6px",
              padding: "5px 10px", fontSize: "11px", fontWeight: 700, cursor: "pointer",
            }}
          >
            {isLoading ? "Running…" : `✓ ${confirmLabel}`}
          </button>
          <button
            onClick={() => setState({ ...state, confirming: null })}
            style={{ background: "#1a1a1a", color: "#666", border: "1px solid #222", borderRadius: "6px", padding: "5px 10px", fontSize: "11px", cursor: "pointer" }}
          >
            Cancel
          </button>
        </div>
      </div>
    );
  }

  return (
    <button
      onClick={() => setState({ ...state, confirming: actionKey, result: null })}
      style={{
        background: "#111", border: `1px solid #222`, color,
        borderRadius: "8px", padding: "7px 12px", fontSize: "12px",
        fontWeight: 600, cursor: "pointer", transition: "border-color .15s",
      }}
      onMouseEnter={e => (e.currentTarget.style.borderColor = color + "66")}
      onMouseLeave={e => (e.currentTarget.style.borderColor = "#222")}
    >
      {label}
    </button>
  );
}

function ClientCard({ c, secret }: { c: ClientAnalytics; secret: string }) {
  const [actionState, setActionState] = useState<ActionState>({ confirming: null, loading: null, result: null });

  const a = c.analytics;
  const statusColor = c.buildStatus === "complete" ? "#00c896" : c.buildStatus === "building" ? "#f59e0b" : "#ef4444";
  const payBadge: [string, string] = c.paymentState?.monthlyActive
    ? ["#00c896", "Monthly Active"]
    : c.paymentState?.finalPaid
    ? ["#3b82f6", "Final Paid"]
    : c.paymentState?.depositPaid
    ? ["#f59e0b", "Deposit Paid"]
    : ["#6b7280", "Unpaid"];

  const badge = (color: string, text: string) => (
    <span style={{
      display: "inline-block", background: `${color}18`, color,
      border: `1px solid ${color}33`, borderRadius: "20px", padding: "2px 8px",
      fontSize: "11px", fontWeight: 600,
    }}>{text}</span>
  );

  async function callApi(path: string) {
    const res = await fetch(path);
    const contentType = res.headers.get("content-type") || "";
    let data: any = {};
    if (contentType.includes("application/json")) {
      data = await res.json().catch(() => ({}));
    } else {
      // HTML response endpoints (release, payment/unlock) — treat 2xx as success
      await res.text();
    }
    if (!res.ok) throw new Error(data?.error || `HTTP ${res.status}`);
    return data;
  }

  const sec = encodeURIComponent(secret);
  const jid = c.jobId;

  return (
    <div style={{
      background: "#0f0f0f", border: "1px solid #1a1a1a", borderRadius: "14px",
      padding: "20px", marginBottom: "12px",
    }}>
      {/* Header row */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: "14px", gap: "8px", flexWrap: "wrap" }}>
        <div>
          <div style={{ fontWeight: 700, fontSize: "16px", color: "#fff" }}>{c.businessName}</div>
          <div style={{ color: "#444", fontSize: "12px", marginTop: "2px" }}>
            {c.industry} · /c/{c.slug} · job: {jid}
          </div>
        </div>
        <div style={{ display: "flex", gap: "6px", flexWrap: "wrap" }}>
          {badge(statusColor, c.buildStatus || "pending")}
          {badge(payBadge[0], payBadge[1])}
          {c.hasBooking && badge("#8b5cf6", "Bookings On")}
        </div>
      </div>

      {/* Analytics grid */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(100px,1fr))", gap: "8px", marginBottom: "16px" }}>
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

      {/* Quick links */}
      <div style={{ display: "flex", gap: "8px", marginBottom: "14px", flexWrap: "wrap" }}>
        {c.previewUrl && (
          <a href={c.previewUrl} target="_blank" rel="noreferrer"
            style={{ background: "#111", border: "1px solid #222", color: "#00c896", borderRadius: "8px", padding: "7px 12px", fontSize: "12px", textDecoration: "none", fontWeight: 600 }}>
            🌐 View Site
          </a>
        )}
        <a href={`/c/${c.slug}`} target="_blank" rel="noreferrer"
          style={{ background: "#111", border: "1px solid #222", color: "#888", borderRadius: "8px", padding: "7px 12px", fontSize: "12px", textDecoration: "none" }}>
          👤 Client Portal
        </a>
        <a href={`/bookings?jobId=${jid}&secret=${secret}`} target="_blank" rel="noreferrer"
          style={{ background: "#111", border: "1px solid #222", color: "#888", borderRadius: "8px", padding: "7px 12px", fontSize: "12px", textDecoration: "none" }}>
          📅 View Bookings
        </a>
      </div>

      {/* Divider */}
      <div style={{ borderTop: "1px solid #1a1a1a", marginBottom: "14px" }} />

      {/* Action buttons with confirm */}
      <div style={{ fontSize: "11px", color: "#333", marginBottom: "8px", textTransform: "uppercase", letterSpacing: ".06em", fontWeight: 600 }}>Actions</div>
      <div style={{ display: "flex", gap: "8px", flexWrap: "wrap", alignItems: "flex-start" }}>

        <ConfirmButton
          actionKey="release"
          label="🚀 Release Preview"
          confirmLabel="Release"
          confirmMessage={`Release preview to ${c.businessName}? This emails the client their portal link.`}
          color="#00c896"
          state={actionState}
          setState={setActionState}
          onConfirm={() => callApi(`/api/unlock/release?jobId=${jid}&secret=${sec}`)}
        />

        <ConfirmButton
          actionKey="unlockBooking"
          label="📅 Unlock Booking"
          confirmLabel="Unlock"
          confirmMessage={`Enable booking system for ${c.businessName}?`}
          color="#8b5cf6"
          state={actionState}
          setState={setActionState}
          onConfirm={() => callApi(`/api/unlock/booking?jobId=${jid}&secret=${sec}`)}
        />

        <ConfirmButton
          actionKey="unlockPayment"
          label="💳 Unlock Final Payment"
          confirmLabel="Unlock"
          confirmMessage="Unlock final payment for this client? They will be emailed to pay the remaining balance."
          color="#f59e0b"
          state={actionState}
          setState={setActionState}
          onConfirm={() => callApi(`/api/payment/unlock?jobId=${jid}&secret=${sec}`)}
        />

        <ConfirmButton
          actionKey="fix"
          label="🔧 Fix This Site"
          confirmLabel="Run Fix"
          confirmMessage="Run Claude fix pass on this site? Takes 2-4 minutes and redeploys."
          color="#3b82f6"
          state={actionState}
          setState={setActionState}
          onConfirm={() => callApi(`/api/admin/fix-proxy?jobId=${jid}&secret=${sec}`)}
        />

        <ConfirmButton
          actionKey="sendReport"
          label="📧 Send Monthly Report"
          confirmLabel="Send"
          confirmMessage="Send this month's analytics report to this client?"
          color="#06b6d4"
          state={actionState}
          setState={setActionState}
          onConfirm={() => callApi(`/api/analytics/monthly?jobId=${jid}&secret=${sec}&send=true`)}
        />
      </div>
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
  const [filter, setFilter] = useState<"all" | "active" | "building" | "unpaid">("all");

  useEffect(() => {
    if (!secret) { setError("Missing secret. Add ?secret=YOUR_PROCESS_SECRET to the URL."); setLoading(false); return; }
    loadDashboard();
  }, [secret]);

  async function loadDashboard() {
    setLoading(true);
    setError("");
    try {
      const res = await fetch(`/api/admin/clients?secret=${encodeURIComponent(secret)}`);
      if (!res.ok) throw new Error("Forbidden — check your secret");
      const data = await res.json();
      setClients(data.clients || []);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load");
    } finally { setLoading(false); }
  }

  const filtered = clients.filter(c => {
    const matchSearch = !search || c.businessName.toLowerCase().includes(search.toLowerCase()) || c.industry?.toLowerCase().includes(search.toLowerCase());
    const matchFilter =
      filter === "all" ? true :
      filter === "active" ? c.paymentState?.monthlyActive :
      filter === "building" ? c.buildStatus === "building" :
      filter === "unpaid" ? !c.paymentState?.depositPaid : true;
    return matchSearch && matchFilter;
  });

  const totals = {
    clients: clients.length,
    active: clients.filter(c => c.paymentState?.monthlyActive).length,
    views: clients.reduce((a, c) => a + (c.analytics?.thisMonth.views || 0), 0),
    bookings: clients.reduce((a, c) => a + c.bookingCount, 0),
    revenue: clients.filter(c => c.paymentState?.monthlyActive).length * 149,
  };

  const s = {
    page: { minHeight: "100vh", background: "#080808", color: "#fff", fontFamily: "'Inter',-apple-system,sans-serif", padding: "24px 16px" } as React.CSSProperties,
    statBox: { background: "#0f0f0f", border: "1px solid #1a1a1a", borderRadius: "12px", padding: "16px", flex: 1, minWidth: "120px" } as React.CSSProperties,
    input: { background: "#111", border: "1px solid #1a1a1a", borderRadius: "8px", padding: "10px 14px", color: "#fff", fontSize: "14px", outline: "none", boxSizing: "border-box" as const } as React.CSSProperties,
    filterBtn: (active: boolean): React.CSSProperties => ({
      background: active ? "#1a1a1a" : "transparent", color: active ? "#fff" : "#444",
      border: "1px solid " + (active ? "#333" : "transparent"), borderRadius: "6px",
      padding: "6px 12px", fontSize: "12px", cursor: "pointer", fontWeight: active ? 600 : 400,
    }),
  };

  return (
    <div style={s.page}>
      <div style={{ maxWidth: "960px", margin: "0 auto" }}>

        <div style={{ display: "flex", alignItems: "center", gap: "12px", marginBottom: "28px", flexWrap: "wrap" }}>
          <span style={{ fontSize: "28px" }}>🦎</span>
          <div>
            <div style={{ fontSize: "22px", fontWeight: 800 }}>WebGecko Admin</div>
            <div style={{ color: "#333", fontSize: "13px" }}>Client Management & Analytics</div>
          </div>
          <button onClick={loadDashboard} style={{ marginLeft: "auto", background: "#111", border: "1px solid #1a1a1a", color: "#555", borderRadius: "8px", padding: "8px 14px", fontSize: "13px", cursor: "pointer" }}>
            Refresh
          </button>
        </div>

        {error && (
          <div style={{ background: "#1a0808", border: "1px solid #ef444433", borderRadius: "10px", padding: "14px", color: "#ef4444", marginBottom: "20px" }}>
            {error}
          </div>
        )}

        {!loading && !error && (
          <div style={{ display: "flex", gap: "10px", marginBottom: "24px", flexWrap: "wrap" }}>
            {[
              { label: "Total Clients", value: totals.clients, color: "#fff" },
              { label: "Monthly Active", value: totals.active, color: "#00c896" },
              { label: "Est. MRR", value: "$" + totals.revenue.toLocaleString(), color: "#00c896" },
              { label: "Views This Month", value: totals.views.toLocaleString(), color: "#3b82f6" },
              { label: "Total Bookings", value: totals.bookings, color: "#f59e0b" },
            ].map(st => (
              <div key={st.label} style={s.statBox}>
                <div style={{ fontSize: "22px", fontWeight: 800, color: st.color }}>{st.value}</div>
                <div style={{ fontSize: "11px", color: "#333", marginTop: "2px" }}>{st.label}</div>
              </div>
            ))}
          </div>
        )}

        <div style={{ display: "flex", gap: "10px", marginBottom: "16px", flexWrap: "wrap", alignItems: "center" }}>
          <input
            type="text" placeholder="Search clients..." value={search}
            onChange={e => setSearch(e.target.value)}
            style={{ ...s.input, flex: 1, minWidth: "200px" }}
          />
          <div style={{ display: "flex", gap: "4px", background: "#0f0f0f", border: "1px solid #1a1a1a", borderRadius: "8px", padding: "4px" }}>
            {(["all", "active", "building", "unpaid"] as const).map(f => (
              <button key={f} onClick={() => setFilter(f)} style={s.filterBtn(filter === f)}>
                {f === "all" ? "All" : f.charAt(0).toUpperCase() + f.slice(1)}
              </button>
            ))}
          </div>
        </div>

        {loading && (
          <div style={{ color: "#333", textAlign: "center", padding: "60px" }}>Loading clients...</div>
        )}

        {filtered.map(c => (
          <ClientCard key={c.slug} c={c} secret={secret} />
        ))}

        {!loading && filtered.length === 0 && !error && (
          <div style={{ textAlign: "center", color: "#333", padding: "60px" }}>No clients found.</div>
        )}
      </div>
    </div>
  );
}

export default function AdminPage() {
  return (
    <Suspense fallback={
      <div style={{ background: "#080808", minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", color: "#333" }}>
        Loading...
      </div>
    }>
      <AdminDashboard />
    </Suspense>
  );
}
