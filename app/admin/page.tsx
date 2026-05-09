"use client";

import { useState, useEffect } from "react";
import { Suspense } from "react";

interface SeoData {
  lsiKeywords?: string[];
  metaDescription?: string;
  serpInsights?: { avgWordCount: number; avgH2Count: number; topHeadings: string[]; winningStructure: string } | null;
  projectTitle?: string;
}

interface ClientAnalytics {
  slug: string;
  jobId: string;
  businessName: string;
  industry: string;
  previewUrl: string;
  buildStatus: string;
  domain?: string;
  liveDomain?: string;
  liveUrl?: string;
  vercelProjectName?: string;
  paymentState: { depositPaid: boolean; finalPaid: boolean; monthlyActive: boolean };
  analytics: { thisMonth: { views: number; bookingClicks: number; contactClicks: number }; today: { views: number; bookingClicks: number }; totals: { views: number; bookingClicks: number; formSubmits: number } } | null;
  bookingCount: number;
  hasBooking: boolean;
  builtAt?: string;
  supersaasId?: string;
  supersaasUrl?: string;
  bookingServices?: string;
  clientEmail?: string;
  clientPhone?: string;
  tawktoPropertyId?: string;
  shopCatalogue?: any[] | null;
  userInput?: {
    features?: string[]; pages?: string[]; siteType?: string; style?: string;
    colorPrefs?: string; usp?: string; goal?: string; additionalNotes?: string;
    abn?: string; businessAddress?: string; facebookPage?: string;
    instagramUrl?: string; linkedinUrl?: string;
  };
  metadata?: {
    scheduledReleaseAt?: string; scheduledReleaseDays?: number;
    checklistCompletedAt?: string; alreadyReleased?: boolean;
    seo?: SeoData; domainStatus?: string; domainUrl?: string;
    lastGoodAt?: string; lastGoodUrl?: string; lastGoodHtml?: string;
    rolledBackAt?: string;
  };
}

// ─── Design tokens — light (default) + dark ──────────────────────────────────
const T_LIGHT = {
  bg:            "#f5f6fa",
  surface:       "#ffffff",
  raised:        "#f0f2f8",
  border:        "#e2e5ef",
  borderMd:      "#c8cedd",
  textPrimary:   "#0d0f1a",
  textSecondary: "#3a4260",
  textMuted:     "#8892aa",
  green:         "#15803d",
  greenDim:      "#166534",
  blue:          "#1d4ed8",
  amber:         "#b45309",
  red:           "#b91c1c",
  purple:        "#7c3aed",
  cyan:          "#0e7490",
  navBg:         "#ffffff",
  navBorder:     "#e2e5ef",
  shadow:        "0 1px 3px rgba(0,0,0,0.07), 0 1px 2px rgba(0,0,0,0.04)",
  shadowMd:      "0 4px 14px rgba(0,0,0,0.09)",
};

const T_DARK = {
  bg:            "#0a0a0d",
  surface:       "#111116",
  raised:        "#18181e",
  border:        "#27272f",
  borderMd:      "#3e3e4a",
  textPrimary:   "#f4f4f8",
  textSecondary: "#a0a0b8",
  textMuted:     "#525268",
  green:         "#4ade80",
  greenDim:      "#22c55e",
  blue:          "#60a5fa",
  amber:         "#fbbf24",
  red:           "#f87171",
  purple:        "#c084fc",
  cyan:          "#22d3ee",
  navBg:         "#111116",
  navBorder:     "#27272f",
  shadow:        "0 1px 3px rgba(0,0,0,0.35)",
  shadowMd:      "0 4px 14px rgba(0,0,0,0.45)",
};

let T = T_LIGHT;

function makeG(T: typeof T_LIGHT) { return {
  page: {
    minHeight: "100vh",
    background: T.bg,
    color: T.textPrimary,
    fontFamily: "'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif",
    transition: "background 0.25s ease, color 0.25s ease",
  } as React.CSSProperties,

  card: {
    background: T.surface,
    border: `1px solid ${T.border}`,
    borderRadius: 14,
    boxShadow: T.shadow,
    transition: "background 0.25s ease, border-color 0.25s ease",
  } as React.CSSProperties,

  raisedCard: {
    background: T.raised,
    border: `1px solid ${T.border}`,
    borderRadius: 10,
    padding: "16px 18px",
    transition: "background 0.25s ease",
  } as React.CSSProperties,

  pill: (color: string): React.CSSProperties => ({
    display: "inline-flex",
    alignItems: "center",
    background: color + "18",
    color,
    border: `1px solid ${color}30`,
    borderRadius: 6,
    padding: "2px 9px",
    fontSize: 11,
    fontWeight: 600,
    letterSpacing: "0.02em",
  }),

  statBox: (color: string): React.CSSProperties => ({
    background: T.surface,
    border: `1px solid ${T.border}`,
    borderRadius: 12,
    padding: "18px 20px",
    minWidth: 110,
    boxShadow: T.shadow,
    transition: "background 0.25s ease",
  }),

  btn: (color: string, fill = false): React.CSSProperties => ({
    background: fill ? color : "transparent",
    color: fill ? "#fff" : color,
    border: `1px solid ${fill ? color : color + "55"}`,
    borderRadius: 7,
    padding: "6px 14px",
    fontSize: 12,
    fontWeight: 500,
    cursor: "pointer",
    letterSpacing: "0.01em",
    transition: "opacity 0.15s ease, background 0.15s ease",
  }),

  tab: (active: boolean): React.CSSProperties => ({
    background: active ? T.raised : "transparent",
    color: active ? T.textPrimary : T.textMuted,
    border: active ? `1px solid ${T.border}` : "1px solid transparent",
    borderRadius: 6,
    padding: "5px 12px",
    fontSize: 12,
    fontWeight: active ? 600 : 400,
    cursor: "pointer",
    letterSpacing: "0.01em",
    transition: "background 0.15s ease, color 0.15s ease",
  }),

  label: {
    fontSize: 10,
    color: T.textMuted,
    textTransform: "uppercase" as const,
    letterSpacing: "0.09em",
    fontWeight: 700,
    marginBottom: 4,
  },

  val: {
    fontSize: 13,
    color: T.textSecondary,
    fontFamily: "'SF Mono', 'Fira Code', monospace" as const,
  },

  section: { marginBottom: 22 } as React.CSSProperties,

  sectionTitle: {
    fontSize: 10,
    color: T.textMuted,
    textTransform: "uppercase" as const,
    letterSpacing: "0.09em",
    fontWeight: 700,
    marginBottom: 12,
    paddingBottom: 8,
    borderBottom: `1px solid ${T.border}`,
  },

  divider: {
    height: 1,
    background: T.border,
    margin: "18px 0",
  } as React.CSSProperties,
}; }

// Module-level G — gets reassigned inside components when theme changes
let G = makeG(T_LIGHT);

function Stat({ label, value, color }: { label: string; value: string | number; color: string }) {
  return (
    <div style={G.statBox(color)}>
      <div style={{ fontSize: 22, fontWeight: 600, color, letterSpacing: "-0.02em", lineHeight: 1 }}>{value}</div>
      <div style={{ fontSize: 11, color: T.textMuted, marginTop: 5, fontWeight: 500, letterSpacing: "0.02em" }}>{label}</div>
    </div>
  );
}

function InfoRow({ label, value, mono = false }: { label: string; value?: string | null; mono?: boolean }) {
  if (!value) return null;
  return (
    <div style={{ marginBottom: 10 }}>
      <div style={G.label}>{label}</div>
      <div style={{
        fontSize: 13,
        color: T.textSecondary,
        fontFamily: mono ? "'SF Mono','Fira Code',monospace" : "inherit",
        wordBreak: "break-all",
      }}>{value}</div>
    </div>
  );
}

function ActionBtn({ label, color, confirm, onConfirm, fill = false }: {
  label: string; color: string; confirm: string; onConfirm: () => Promise<any>; fill?: boolean;
}) {
  const [state, setState] = useState<"idle" | "confirming" | "loading" | "ok" | "err">("idle");
  const [msg, setMsg] = useState("");

  if (state === "ok") return (
    <div style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 12, color: T.green }}>
      <span style={{ fontSize: 14 }}>✓</span> {msg || "Done"}
    </div>
  );
  if (state === "err") return (
    <div style={{ fontSize: 12, color: T.red }}>✗ {msg}</div>
  );
  if (state === "confirming") return (
    <div style={{ background: T.bg, border: `1px solid ${T.border}`, borderRadius: 8, padding: "10px 14px" }}>
      <div style={{ color: T.textSecondary, fontSize: 12, marginBottom: 10, lineHeight: 1.5 }}>{confirm}</div>
      <div style={{ display: "flex", gap: 8 }}>
        <button style={G.btn(color, true)} onClick={async () => {
          setState("loading");
          try { const r = await onConfirm(); setMsg(r?.message || "Done"); setState("ok"); }
          catch (e) { setMsg(e instanceof Error ? e.message : "Failed"); setState("err"); }
        }}>Confirm</button>
        <button style={G.btn(T.textMuted)} onClick={() => setState("idle")}>Cancel</button>
      </div>
    </div>
  );
  return (
    <button
      style={{ ...G.btn(color, fill), opacity: state === "loading" ? 0.5 : 1 }}
      onClick={() => setState("confirming")}
    >
      {state === "loading" ? "Working…" : label}
    </button>
  );
}

function ClientDashboard({ c, secret, onClose, dark = false }: { c: ClientAnalytics; secret: string; onClose: () => void; dark?: boolean }) {
  T = dark ? T_DARK : T_LIGHT; G = makeG(T);
  const [tab, setTab] = useState<"overview" | "analytics" | "seo" | "site" | "payments" | "actions" | "requests">("overview");
  const [featureRequests, setFeatureRequests] = useState<any[]>([]);
  const [frLoading, setFrLoading] = useState(false);
  const [frUpdating, setFrUpdating] = useState<string | null>(null);
  const a = c.analytics;
  const seo = c.metadata?.seo;
  const ui = c.userInput || {};
  const jid = c.jobId;
  const sec = encodeURIComponent(secret);

  async function api(path: string, method = "GET", body?: any) {
    const res = await fetch(path, { method, headers: body ? { "Content-Type": "application/json" } : {}, body: body ? JSON.stringify(body) : undefined });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error((data as any).error || `HTTP ${res.status}`);
    return data;
  }

  async function loadFeatureRequests() {
    setFrLoading(true);
    try {
      const res = await fetch(`/api/feature-requests?secret=${sec}`);
      if (res.ok) {
        const d = await res.json();
        setFeatureRequests((d.requests || []).filter((r: any) => r.jobId === jid));
      }
    } catch {}
    finally { setFrLoading(false); }
  }

  const [feeInputs, setFeeInputs] = useState<Record<string, string>>({});

  async function updateRequestStatus(requestId: string, status: string, draftUrl?: string, quotedFee?: number) {
    setFrUpdating(requestId);
    try {
      await api("/api/feature-requests", "PATCH", { jobId: jid, requestId, status, draftUrl, ...(quotedFee !== undefined ? { quotedFee } : {}) });
      await loadFeatureRequests();
    } catch (e) { alert("Failed: " + (e instanceof Error ? e.message : "Error")); }
    finally { setFrUpdating(null); }
  }

  const pendingRequestCount = featureRequests.filter(r => r.status === "pending" || r.status === "draft").length;

  const statusColor =
    c.buildStatus === "completed" || c.buildStatus === "complete" ? T.green :
    c.buildStatus === "building" ? T.amber : T.red;

  const tabs = ["overview", "analytics", "seo", "site", "payments", "actions", "requests"] as const;

  return (
    <div style={{
      position: "fixed", inset: 0, zIndex: 1000,
      background: "rgba(0,0,0,0.7)",
      backdropFilter: "blur(6px)",
      display: "flex", alignItems: "flex-start", justifyContent: "center",
      padding: "32px 16px", overflowY: "auto",
      animation: "wg-fadeIn 0.2s ease",
    }}>
      <style>{`
        @keyframes wg-fadeIn { from { opacity: 0; } to { opacity: 1; } }
        @keyframes wg-slideUp { from { opacity: 0; transform: translateY(16px); } to { opacity: 1; transform: translateY(0); } }
        .wg-modal-card { animation: wg-slideUp 0.25s cubic-bezier(0.34,1.2,0.64,1); }
        .wg-tab-content { animation: wg-fadeIn 0.18s ease; }
        button, a { transition: opacity 0.15s ease, transform 0.15s ease, background 0.18s ease, box-shadow 0.18s ease !important; }
        button:hover:not(:disabled) { opacity: 0.85; }
        button:active:not(:disabled) { transform: scale(0.97) !important; }
      `}</style>
      <div className="wg-modal-card" style={{ ...G.card, width: "100%", maxWidth: 860, position: "relative", boxShadow: "0 24px 64px rgba(0,0,0,0.6)" }}>

        {/* Header */}
        <div style={{
          padding: "24px 28px 20px",
          borderBottom: `1px solid ${T.border}`,
          display: "flex", justifyContent: "space-between", alignItems: "flex-start",
        }}>
          <div>
            <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 6 }}>
              <div style={{
                width: 36, height: 36, borderRadius: 9,
                background: `linear-gradient(135deg, ${statusColor}22, ${statusColor}08)`,
                border: `1px solid ${statusColor}30`,
                display: "flex", alignItems: "center", justifyContent: "center",
                fontSize: 15, fontWeight: 700, color: statusColor,
              }}>
                {c.businessName.charAt(0).toUpperCase()}
              </div>
              <div>
                <div style={{ fontSize: 17, fontWeight: 600, color: T.textPrimary, letterSpacing: "-0.01em" }}>{c.businessName}</div>
                <div style={{ fontSize: 12, color: T.textMuted, marginTop: 1 }}>{c.industry}</div>
              </div>
            </div>
            <div style={{ display: "flex", gap: 5, flexWrap: "wrap", marginTop: 10 }}>
              <span style={G.pill(statusColor)}>{c.buildStatus || "pending"}</span>
              {c.paymentState?.monthlyActive && <span style={G.pill(T.green)}>Monthly Active</span>}
              {c.paymentState?.finalPaid && !c.paymentState?.monthlyActive && <span style={G.pill(T.blue)}>Final Paid</span>}
              {c.paymentState?.depositPaid && !c.paymentState?.finalPaid && <span style={G.pill(T.amber)}>Deposit Paid</span>}
              {!c.paymentState?.depositPaid && <span style={G.pill(T.textMuted)}>Unpaid</span>}
              {c.hasBooking && <span style={G.pill(T.purple)}>Booking</span>}
              {c.metadata?.alreadyReleased && <span style={G.pill(T.green)}>Released</span>}
              {(ui.features || []).map((f: string) => <span key={f} style={G.pill(T.textMuted)}>{f}</span>)}
            </div>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <div style={{ textAlign: "right", marginRight: 4 }}>
              <div style={{ fontSize: 11, color: T.textMuted }}>Client</div>
              <div style={{ fontSize: 12, color: T.textSecondary }}>{c.clientEmail}</div>
            </div>
            <button onClick={onClose} style={{
              background: T.raised, border: `1px solid ${T.border}`, borderRadius: 7,
              color: T.textMuted, fontSize: 16, cursor: "pointer", width: 32, height: 32,
              display: "flex", alignItems: "center", justifyContent: "center", lineHeight: 1,
            }}>×</button>
          </div>
        </div>

        {/* Tabs */}
        <div style={{
          display: "flex", gap: 4, padding: "10px 28px",
          borderBottom: `1px solid ${T.border}`,
          background: T.bg,
          flexWrap: "wrap",
        }}>
          {tabs.map(t => (
            <button key={t} style={G.tab(tab === t)} onClick={() => {
              setTab(t as any);
              if (t === "requests" && featureRequests.length === 0) loadFeatureRequests();
            }}>
              {t === "requests"
                ? "Requests" + (pendingRequestCount > 0 ? ` (${pendingRequestCount})` : "")
                : t.charAt(0).toUpperCase() + t.slice(1)}
            </button>
          ))}
        </div>

        <div key={tab} className="wg-tab-content" style={{ padding: "24px 28px" }}>

          {/* OVERVIEW */}
          {tab === "overview" && (
            <>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill,minmax(140px,1fr))", gap: 10, marginBottom: 24 }}>
                <Stat label="Views this month" value={a?.thisMonth.views ?? 0} color={T.blue} />
                <Stat label="Views today" value={a?.today.views ?? 0} color={T.green} />
                <Stat label="All-time views" value={a?.totals.views ?? 0} color={T.textSecondary} />
                <Stat label="Booking clicks" value={a?.thisMonth.bookingClicks ?? 0} color={T.amber} />
                <Stat label="Total bookings" value={c.bookingCount} color={T.purple} />
                <Stat label="Form submits" value={a?.totals.formSubmits ?? 0} color={T.cyan} />
              </div>

              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 20 }}>
                <div>
                  <div style={G.sectionTitle}>Client info</div>
                  <InfoRow label="Email" value={c.clientEmail} />
                  <InfoRow label="Phone" value={c.clientPhone} />
                  <InfoRow label="ABN" value={ui.abn} mono />
                  <InfoRow label="Address" value={ui.businessAddress} />
                  <InfoRow label="USP" value={ui.usp} />
                  <InfoRow label="Goal" value={ui.goal} />
                </div>
                <div>
                  <div style={G.sectionTitle}>Build info</div>
                  <InfoRow label="Job ID" value={jid} mono />
                  <InfoRow label="Built at" value={c.builtAt ? new Date(c.builtAt).toLocaleString("en-AU") : undefined} />
                  <InfoRow label="Site type" value={ui.siteType} />
                  <InfoRow label="Pages" value={(ui.pages || []).join(", ")} />
                  <InfoRow label="Style" value={ui.style} />
                  <InfoRow label="Colour prefs" value={ui.colorPrefs} />
                  {c.metadata?.scheduledReleaseAt && <InfoRow label="Auto-release" value={new Date(c.metadata.scheduledReleaseAt).toLocaleDateString("en-AU", { day: "numeric", month: "short", year: "numeric" })} />}
                </div>
              </div>

              {ui.additionalNotes && (
                <div style={{ marginTop: 20 }}>
                  <div style={G.sectionTitle}>Additional notes</div>
                  <div style={{
                    fontSize: 13, color: T.textSecondary, lineHeight: 1.7,
                    background: T.bg, borderRadius: 8, padding: "12px 14px",
                    border: `1px solid ${T.border}`, whiteSpace: "pre-wrap",
                  }}>{ui.additionalNotes}</div>
                </div>
              )}

              {(ui.facebookPage || ui.instagramUrl || ui.linkedinUrl) && (
                <div style={{ marginTop: 20 }}>
                  <div style={G.sectionTitle}>Social links</div>
                  <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
                    {ui.facebookPage && <a href={ui.facebookPage} target="_blank" rel="noreferrer" style={{ ...G.btn(T.blue), textDecoration: "none" }}>Facebook →</a>}
                    {ui.instagramUrl && <a href={ui.instagramUrl} target="_blank" rel="noreferrer" style={{ ...G.btn(T.purple), textDecoration: "none" }}>Instagram →</a>}
                    {ui.linkedinUrl && <a href={ui.linkedinUrl} target="_blank" rel="noreferrer" style={{ ...G.btn(T.cyan), textDecoration: "none" }}>LinkedIn →</a>}
                  </div>
                </div>
              )}
            </>
          )}

          {/* ANALYTICS */}
          {tab === "analytics" && (
            <>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill,minmax(160px,1fr))", gap: 10, marginBottom: 24 }}>
                <Stat label="Views today" value={a?.today.views ?? 0} color={T.green} />
                <Stat label="Booking clicks today" value={a?.today.bookingClicks ?? 0} color={T.amber} />
                <Stat label="Views this month" value={a?.thisMonth.views ?? 0} color={T.blue} />
                <Stat label="Booking clicks / month" value={a?.thisMonth.bookingClicks ?? 0} color={T.amber} />
                <Stat label="Contact clicks / month" value={a?.thisMonth.contactClicks ?? 0} color={T.cyan} />
                <Stat label="All-time views" value={a?.totals.views ?? 0} color={T.textSecondary} />
                <Stat label="All-time booking clicks" value={a?.totals.bookingClicks ?? 0} color={T.purple} />
                <Stat label="All-time form submits" value={a?.totals.formSubmits ?? 0} color={T.green} />
                <Stat label="Total bookings" value={c.bookingCount} color={T.purple} />
              </div>
              <div style={{ display: "flex", gap: 8 }}>
                <a href={`/bookings?jobId=${jid}&secret=${secret}`} target="_blank" rel="noreferrer" style={{ ...G.btn(T.purple), textDecoration: "none" }}>View bookings →</a>
                <button style={G.btn(T.cyan)} onClick={() => api(`/api/analytics/monthly?jobId=${jid}&secret=${sec}&send=true`)}>Send monthly report</button>
              </div>
            </>
          )}

          {/* SEO */}
          {tab === "seo" && (
            <>
              {!seo && <div style={{ color: T.textMuted, fontSize: 13, padding: "20px 0" }}>No SEO data yet — populated on next build.</div>}
              {seo && (
                <>
                  <div style={G.section}>
                    <div style={G.sectionTitle}>Meta description</div>
                    <div style={{
                      fontSize: 13, color: T.textSecondary, background: T.bg,
                      borderRadius: 8, padding: "12px 14px", border: `1px solid ${T.border}`, lineHeight: 1.7,
                    }}>{seo.metaDescription || "Not set"}</div>
                  </div>
                  <div style={G.section}>
                    <div style={G.sectionTitle}>LSI Keywords ({(seo.lsiKeywords || []).length})</div>
                    <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
                      {(seo.lsiKeywords || []).length === 0 && <span style={{ color: T.textMuted, fontSize: 12 }}>None generated</span>}
                      {(seo.lsiKeywords || []).map((k: string, i: number) => (
                        <span key={i} style={{
                          background: T.blue + "12", border: `1px solid ${T.blue}25`,
                          color: T.blue, borderRadius: 6, padding: "3px 10px", fontSize: 11, fontWeight: 500,
                        }}>{k}</span>
                      ))}
                    </div>
                  </div>
                  {seo.serpInsights && (() => {
                    const si = seo.serpInsights!;
                    // Word count: good = within 20% of competitors, warn = 50-80%, bad = <50%
                    const wc = si.avgWordCount || 800;
                    const h2 = si.avgH2Count || 6;
                    type IndicatorStatus = "good" | "warn" | "bad";
                    function indicator(status: IndicatorStatus) {
                      const map = { good: { icon: "✓", color: T.green, label: "Good" }, warn: { icon: "!", color: T.amber, label: "Needs work" }, bad: { icon: "✗", color: T.red, label: "Action needed" } };
                      const m = map[status];
                      return <span style={{ display: "inline-flex", alignItems: "center", gap: 4, background: m.color + "15", color: m.color, border: `1px solid ${m.color}30`, borderRadius: 20, padding: "2px 10px", fontSize: 11, fontWeight: 700 }}>{m.icon} {m.label}</span>;
                    }
                    return (
                      <div style={G.section}>
                        <div style={G.sectionTitle}>SERP intelligence — how this site compares to competitors</div>

                        {/* Word count */}
                        <div style={{ background: T.bg, borderRadius: 10, padding: "14px 16px", border: `1px solid ${T.border}`, marginBottom: 10 }}>
                          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 6 }}>
                            <div>
                              <span style={{ fontSize: 13, fontWeight: 600, color: T.textPrimary }}>Content length</span>
                              <span style={{ fontSize: 11, color: T.textMuted, marginLeft: 8 }}>Competitors average <strong style={{ color: T.textSecondary }}>{wc} words</strong></span>
                            </div>
                            {indicator(wc > 1200 ? "bad" : wc > 600 ? "good" : "warn")}
                          </div>
                          <div style={{ fontSize: 12, color: T.textMuted, lineHeight: 1.6 }}>
                            {wc > 1200
                              ? `⚠️ Competitors use ${wc} words — this site should match that depth. Consider adding more detail to services, FAQs, and about sections.`
                              : wc > 600
                              ? `✓ Competitors average ${wc} words — this site's content depth is competitive.`
                              : `ℹ️ Competitors only use ~${wc} words — a concise, well-structured site can outrank them.`}
                          </div>
                        </div>

                        {/* H2 count */}
                        <div style={{ background: T.bg, borderRadius: 10, padding: "14px 16px", border: `1px solid ${T.border}`, marginBottom: 10 }}>
                          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 6 }}>
                            <div>
                              <span style={{ fontSize: 13, fontWeight: 600, color: T.textPrimary }}>Section headings (H2s)</span>
                              <span style={{ fontSize: 11, color: T.textMuted, marginLeft: 8 }}>Competitors use <strong style={{ color: T.textSecondary }}>{h2} headings</strong> on average</span>
                            </div>
                            {indicator(h2 >= 5 && h2 <= 10 ? "good" : h2 < 3 ? "bad" : "warn")}
                          </div>
                          <div style={{ fontSize: 12, color: T.textMuted, lineHeight: 1.6 }}>
                            {h2 >= 5 && h2 <= 10
                              ? `✓ ${h2} H2 headings is solid. Headings help Google understand page structure and improve rankings.`
                              : h2 < 3
                              ? `⚠️ Competitors only use ${h2} H2s — this site should use more clear section headings to outstructure them.`
                              : `ℹ️ ${h2} H2s is on the higher side — ensure each heading targets a specific keyword or user question.`}
                          </div>
                        </div>

                        {/* Winning structure */}
                        <div style={{ background: T.bg, borderRadius: 10, padding: "14px 16px", border: `1px solid ${T.border}`, marginBottom: 10 }}>
                          <div style={{ fontSize: 13, fontWeight: 600, color: T.textPrimary, marginBottom: 6 }}>What's winning in search results</div>
                          <div style={{ fontSize: 12, color: T.textSecondary, lineHeight: 1.7 }}>{si.winningStructure}</div>
                        </div>

                        {/* Top headings */}
                        <div style={{ background: T.bg, borderRadius: 10, padding: "14px 16px", border: `1px solid ${T.border}` }}>
                          <div style={{ fontSize: 13, fontWeight: 600, color: T.textPrimary, marginBottom: 8 }}>Top competitor headings to beat</div>
                          <div style={{ fontSize: 11, color: T.textMuted, marginBottom: 10 }}>These are the H1/H2s ranking competitors are using — this site's content should cover these topics.</div>
                          <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                            {(si.topHeadings || []).map((h: string, i: number) => (
                              <div key={i} style={{ display: "flex", alignItems: "center", gap: 10, background: T.surface, borderRadius: 7, padding: "8px 12px", border: `1px solid ${T.border}` }}>
                                <span style={{ background: T.blue + "20", color: T.blue, borderRadius: 4, padding: "1px 7px", fontSize: 10, fontWeight: 700, flexShrink: 0 }}>#{i + 1}</span>
                                <span style={{ fontSize: 12, color: T.textSecondary }}>{h}</span>
                              </div>
                            ))}
                          </div>
                        </div>
                      </div>
                    );
                  })()}
                  <div style={{ padding: "10px 14px", background: T.bg, borderRadius: 8, fontSize: 12, color: T.textMuted, border: `1px solid ${T.border}` }}>
                    sitemap.xml and robots.txt deploy automatically with every build.
                  </div>
                </>
              )}
            </>
          )}

          {/* SITE */}
          {tab === "site" && (
            <>
              <div style={G.section}>
                <div style={G.sectionTitle}>URLs</div>
                <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 16 }}>
                  {c.previewUrl && <a href={c.previewUrl} target="_blank" rel="noreferrer" style={{ ...G.btn(T.green), textDecoration: "none" }}>Preview site →</a>}
                  {c.liveUrl && c.liveDomain && <a href={c.liveUrl} target="_blank" rel="noreferrer" style={{ ...G.btn(T.green, true), textDecoration: "none" }}>Live site →</a>}
                  <a href={`/c/${c.slug}`} target="_blank" rel="noreferrer" style={{ ...G.btn(T.textMuted), textDecoration: "none" }}>Client portal →</a>
                </div>
                <InfoRow label="Preview URL" value={c.previewUrl} mono />
                <InfoRow label="Desired domain" value={c.domain} mono />
                {c.metadata?.domainStatus && <InfoRow label="Domain status" value={c.metadata.domainStatus} />}
                {c.metadata?.domainUrl && <InfoRow label="Domain URL" value={c.metadata.domainUrl} mono />}
                <InfoRow label="Vercel project" value={c.vercelProjectName} mono />
              </div>

              {/* Live preview — proxied iframe to bypass Vercel X-Frame-Options */}
              {c.previewUrl && (
                <div style={{ ...G.section }}>
                  <div style={{ ...G.sectionTitle, display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                    <span>Live preview</span>
                    <PreviewRefreshBtn previewUrl={c.previewUrl} T={T} G={G} />
                  </div>
                  {c.buildStatus === "building" ? (
                    <div style={{ borderRadius: 10, border: `1px solid ${T.border}`, background: T.raised, height: 180, display: "flex", alignItems: "center", justifyContent: "center" }}>
                      <div style={{ color: T.textMuted, fontSize: 13 }}>⏳ Building… preview will appear when complete</div>
                    </div>
                  ) : (
                    <PreviewFrame previewUrl={c.previewUrl} builtAt={c.builtAt} T={T} />
                  )}
                </div>
              )}

              {c.hasBooking && (
                <div style={G.section}>
                  <div style={G.sectionTitle}>Booking system</div>
                  <InfoRow label="SuperSaas ID" value={c.supersaasId} mono />
                  <InfoRow label="SuperSaas URL" value={c.supersaasUrl} mono />
                  <InfoRow label="Services" value={c.bookingServices} />
                  {c.supersaasUrl && <a href={c.supersaasUrl} target="_blank" rel="noreferrer" style={{ ...G.btn(T.purple), textDecoration: "none", display: "inline-block", marginTop: 8 }}>Open SuperSaas →</a>}
                </div>
              )}

              {c.tawktoPropertyId && (
                <div style={G.section}>
                  <div style={G.sectionTitle}>Live chat (Tawk.to)</div>
                  <InfoRow label="Property ID" value={c.tawktoPropertyId} mono />
                  <a href="https://dashboard.tawk.to" target="_blank" rel="noreferrer" style={{ ...G.btn(T.green), textDecoration: "none", display: "inline-block", marginTop: 8 }}>Open Tawk.to →</a>
                </div>
              )}

              {c.shopCatalogue && c.shopCatalogue.length > 0 && (
                <div style={G.section}>
                  <div style={G.sectionTitle}>Shop products ({c.shopCatalogue.length})</div>
                  <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                    {c.shopCatalogue.map((item: any, i: number) => (
                      <div key={i} style={{
                        display: "flex", justifyContent: "space-between", alignItems: "center",
                        background: T.bg, borderRadius: 8, padding: "10px 14px", border: `1px solid ${T.border}`,
                      }}>
                        <div>
                          <div style={{ fontSize: 13, color: T.textPrimary, fontWeight: 500 }}>{item.name}</div>
                          <div style={{ fontSize: 11, color: T.textMuted, fontFamily: "monospace", marginTop: 2 }}>{item.variationId || "no Square ID"}</div>
                        </div>
                        <div style={{ textAlign: "right" }}>
                          <div style={{ fontSize: 14, color: T.green, fontWeight: 600 }}>${(item.priceCents / 100).toFixed(2)}</div>
                          {item.paymentLinkUrl && <a href={item.paymentLinkUrl} target="_blank" rel="noreferrer" style={{ fontSize: 10, color: T.blue }}>Payment link →</a>}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </>
          )}

          {/* PAYMENTS */}
          {tab === "payments" && (
            <>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: 10, marginBottom: 24 }}>
                <Stat label="Deposit" value={c.paymentState?.depositPaid ? "Paid" : "Unpaid"} color={c.paymentState?.depositPaid ? T.green : T.red} />
                <Stat label="Final payment" value={c.paymentState?.finalPaid ? "Paid" : "Pending"} color={c.paymentState?.finalPaid ? T.green : T.amber} />
                <Stat label="Monthly" value={c.paymentState?.monthlyActive ? "Active" : "Inactive"} color={c.paymentState?.monthlyActive ? T.green : T.textMuted} />
              </div>
              <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                <ActionBtn label="Unlock final payment" color={T.amber} confirm="Unlock final payment? Client will be emailed to pay remaining balance." onConfirm={() => api(`/api/payment/unlock?jobId=${jid}&secret=${sec}`)} />
              </div>
            </>
          )}

          {/* ACTIONS */}
          {tab === "actions" && (
            <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
                <div style={G.raisedCard}>
                  <div style={{ fontSize: 12, fontWeight: 600, color: T.green, marginBottom: 5 }}>Release preview</div>
                  <div style={{ fontSize: 11, color: T.textMuted, marginBottom: 12, lineHeight: 1.5 }}>Email the client their portal link to review the site.</div>
                  <ActionBtn label="Release preview →" color={T.green} confirm={`Release preview to ${c.businessName}? This emails the client.`} onConfirm={() => api(`/api/unlock/release?jobId=${jid}&secret=${sec}`)} />
                </div>
                <div style={G.raisedCard}>
                  <div style={{ fontSize: 12, fontWeight: 600, color: T.blue, marginBottom: 5 }}>Fix site</div>
                  <div style={{ fontSize: 11, color: T.textMuted, marginBottom: 12, lineHeight: 1.5 }}>Run a code fix pass and redeploy. Takes 1–2 min.</div>
                  <ActionBtn label="Fix this site" color={T.blue} confirm="Run a fix pass on this site?" onConfirm={() => api(`/api/admin/fix-proxy?jobId=${jid}&secret=${sec}`)} />
                </div>
                <div style={G.raisedCard}>
                  <div style={{ fontSize: 12, fontWeight: 600, color: T.amber, marginBottom: 5 }}>Rebuild site</div>
                  <div style={{ fontSize: 11, color: T.textMuted, marginBottom: 12, lineHeight: 1.5 }}>Full rebuild — clears any stuck state, reruns Stitch and regenerates design from scratch. 5–10 min.</div>
                  <ActionBtn label="Rebuild site" color={T.amber} confirm={`Fully rebuild ${c.businessName} from scratch? This will clear any stuck state and regenerate the Stitch design.`} onConfirm={async () => { await api(`/api/admin/reset-job`, "POST", { jobId: jid, action: "reset-and-rebuild", secret: sec }); }} />
                </div>
                {c.metadata?.lastGoodAt && (
                  <div style={{ ...G.raisedCard, border: `1px solid ${T.purple}22` }}>
                    <div style={{ fontSize: 12, fontWeight: 600, color: T.purple, marginBottom: 5 }}>Rollback to last good build</div>
                    <div style={{ fontSize: 11, color: T.textMuted, marginBottom: 12, lineHeight: 1.5 }}>
                      Restores the previous working site snapshot.{` Saved ${new Date(c.metadata.lastGoodAt).toLocaleDateString("en-AU")}.`}
                    </div>
                    <ActionBtn label="Rollback" color={T.purple} confirm={`Roll back ${c.businessName} to the last good build?`} onConfirm={() => api(`/api/admin/reset-job`, "POST", { jobId: jid, action: "rollback", secret: sec })} />
                  </div>
                )}
                {c.hasBooking && (
                  <div style={G.raisedCard}>
                    <div style={{ fontSize: 12, fontWeight: 600, color: T.purple, marginBottom: 5 }}>Unlock booking</div>
                    <div style={{ fontSize: 11, color: T.textMuted, marginBottom: 12, lineHeight: 1.5 }}>Enable the booking system for this client.</div>
                    <ActionBtn label="Unlock booking" color={T.purple} confirm={`Enable booking system for ${c.businessName}?`} onConfirm={() => api(`/api/unlock/booking?jobId=${jid}&secret=${sec}`)} />
                  </div>
                )}
                <div style={G.raisedCard}>
                  <div style={{ fontSize: 12, fontWeight: 600, color: T.cyan, marginBottom: 5 }}>Monthly report</div>
                  <div style={{ fontSize: 11, color: T.textMuted, marginBottom: 12, lineHeight: 1.5 }}>Email this month's analytics to the client.</div>
                  <ActionBtn label="Send report" color={T.cyan} confirm="Send monthly analytics report?" onConfirm={() => api(`/api/analytics/monthly?jobId=${jid}&secret=${sec}&send=true`)} />
                </div>
                <div style={G.raisedCard}>
                  <div style={{ fontSize: 12, fontWeight: 600, color: T.textSecondary, marginBottom: 5 }}>Reset password</div>
                  <div style={{ fontSize: 11, color: T.textMuted, marginBottom: 12, lineHeight: 1.5 }}>Generate a new portal login password.</div>
                  <ActionBtn label="Reset password" color={T.textSecondary} confirm="Generate a new password?" onConfirm={async () => {
                    const d = await api(`/api/admin/reset-password?secret=${sec}`, "POST", { slug: c.slug });
                    alert(`New password for ${c.businessName}:\n\n${d.password}\n\nShare with client.`);
                    return d;
                  }} />
                </div>
              </div>
              {/* Reference HTML upload for this client */}
              <ClientHtmlUpload jobId={jid} T={T} G={G} />

              <div style={{
                background: T.red + "08",
                border: `1px solid ${T.red}20`,
                borderRadius: 10, padding: "16px 18px",
              }}>
                <div style={{ fontSize: 12, fontWeight: 600, color: T.red, marginBottom: 5 }}>Danger zone</div>
                <div style={{ fontSize: 11, color: T.textMuted, marginBottom: 12 }}>Permanently delete this client and all their data.</div>
                <ActionBtn label="Delete client" color={T.red} confirm={`PERMANENTLY delete ${c.businessName}? Cannot be undone.`} onConfirm={async () => {
                  await api(`/api/admin/delete-client?jobId=${jid}&slug=${c.slug}&secret=${sec}`, "DELETE");
                  window.location.reload();
                }} />
              </div>
            </div>
          )}

          {/* FEATURE REQUESTS */}
          {tab === "requests" && (
            <div>
              {frLoading && <div style={{ color: T.textMuted, fontSize: 13, padding: "20px 0" }}>Loading feature requests…</div>}
              {!frLoading && featureRequests.length === 0 && (
                <div style={{ color: T.textMuted, fontSize: 13, padding: "32px 0", textAlign: "center" }}>
                  No feature requests yet.
                  <br />
                  <span style={{ fontSize: 12, color: T.border }}>Clients can request new features from their portal.</span>
                </div>
              )}
              {!frLoading && featureRequests.length > 0 && (
                <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                  {featureRequests.map((req: any) => {
                    const statusColors: Record<string, string> = {
                      pending: T.amber, processing: T.blue, draft: T.purple,
                      approved: T.blue, live: T.green, rejected: T.red,
                    };
                    const sc = statusColors[req.status] || T.textMuted;
                    const isUpdating = frUpdating === req.id;
                    return (
                      <div key={req.id} style={{
                        background: T.surface, border: `1px solid ${T.border}`,
                        borderRadius: 12, padding: "16px 18px",
                        borderLeft: `3px solid ${sc}`,
                        boxShadow: T.shadow,
                        transition: "background 0.2s ease",
                      }}>
                        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 8 }}>
                          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                            <span style={{ fontSize: 13, fontWeight: 600, color: T.textPrimary }}>{req.featureId}</span>
                            <span style={G.pill(sc)}>{req.status}</span>
                            {req.quotedFee && (
                              <span style={{ ...G.pill(T.amber), fontSize: 11 }}>💰 ${req.quotedFee} quoted</span>
                            )}
                          </div>
                          <div style={{ fontSize: 11, color: T.textMuted }}>{new Date(req.createdAt).toLocaleDateString("en-AU")}</div>
                        </div>
                        {req.message && (
                          <div style={{ fontSize: 12, color: T.textSecondary, marginBottom: 10, lineHeight: 1.6, fontStyle: "italic" }}>
                            "{req.message}"
                          </div>
                        )}
                        {req.adminNote && (
                          <div style={{ fontSize: 12, color: T.textMuted, marginBottom: 10, background: T.raised, borderRadius: 6, padding: "6px 10px" }}>
                            📝 {req.adminNote}
                          </div>
                        )}
                        {req.draftUrl && (
                          <div style={{ marginBottom: 10 }}>
                            <a href={req.draftUrl} target="_blank" rel="noreferrer" style={{ ...G.btn(T.blue), textDecoration: "none", fontSize: 11 }}>
                              View draft →
                            </a>
                          </div>
                        )}
                        {/* Fee input — shown for pending/processing */}
                        {(req.status === "pending" || req.status === "processing") && (
                          <div style={{ display: "flex", gap: 8, alignItems: "center", marginBottom: 10 }}>
                            <span style={{ fontSize: 11, color: T.textMuted, flexShrink: 0 }}>Quote fee (AUD):</span>
                            <input
                              type="number"
                              min="0"
                              placeholder="e.g. 250"
                              value={feeInputs[req.id] ?? (req.quotedFee ?? "")}
                              onChange={e => setFeeInputs(prev => ({ ...prev, [req.id]: e.target.value }))}
                              style={{
                                width: 100, background: T.raised, border: `1px solid ${T.border}`,
                                borderRadius: 6, padding: "5px 10px", color: T.textPrimary,
                                fontSize: 12, outline: "none", fontFamily: "inherit",
                              }}
                            />
                            <button
                              disabled={isUpdating || !feeInputs[req.id]}
                              onClick={() => updateRequestStatus(req.id, req.status, undefined, parseFloat(feeInputs[req.id] || "0"))}
                              style={{ ...G.btn(T.amber, true), fontSize: 11, opacity: (!feeInputs[req.id] || isUpdating) ? 0.5 : 1 }}
                            >
                              Send fee to client
                            </button>
                          </div>
                        )}
                        <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                          {req.status === "pending" && (
                            <button disabled={isUpdating} onClick={() => updateRequestStatus(req.id, "approved", undefined, req.quotedFee)}
                              style={{ ...G.btn(T.green, true), opacity: isUpdating ? 0.5 : 1, fontSize: 11 }}>
                              {isUpdating ? "…" : "Approve & build draft"}
                            </button>
                          )}
                          {req.status === "draft" && (
                            <button disabled={isUpdating} onClick={() => updateRequestStatus(req.id, "live")}
                              style={{ ...G.btn(T.green, true), opacity: isUpdating ? 0.5 : 1, fontSize: 11 }}>
                              {isUpdating ? "…" : "Confirm → push live"}
                            </button>
                          )}
                          {(req.status === "pending" || req.status === "draft" || req.status === "processing") && (
                            <button disabled={isUpdating} onClick={() => updateRequestStatus(req.id, "rejected")}
                              style={{ ...G.btn(T.red), opacity: isUpdating ? 0.5 : 1, fontSize: 11 }}>
                              Reject
                            </button>
                          )}
                          {req.status === "approved" && <div style={{ fontSize: 11, color: T.blue }}>⏳ Building draft…</div>}
                          {req.status === "live" && <div style={{ fontSize: 11, color: T.green }}>✓ Live on site</div>}
                          {req.status === "rejected" && <div style={{ fontSize: 11, color: T.red }}>✗ Rejected</div>}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
              <button onClick={loadFeatureRequests} style={{ ...G.btn(T.textMuted), marginTop: 16, fontSize: 11 }}>Refresh</button>
            </div>
          )}

        </div>
      </div>
    </div>
  );
}

// ─── Live preview components ──────────────────────────────────────────────────
// Vercel blocks iframes via X-Frame-Options, so we show a rich preview card instead.
function PreviewFrame({ previewUrl, builtAt, T }: { previewUrl: string; builtAt?: string; T: typeof T_LIGHT }) {
  const [thumbErr, setThumbErr] = useState(false);
  // Use builtAt timestamp as initial key so a new build always forces a fresh screenshot
  const [refreshKey, setRefreshKey] = useState(() => builtAt ? new Date(builtAt).getTime() : Math.floor(Date.now() / 60000));
  const [refreshing, setRefreshing] = useState(false);

  // Reset key when builtAt changes (new build completed)
  const prevBuiltAt = useState(builtAt)[0];
  if (builtAt !== prevBuiltAt && builtAt) {
    setRefreshKey(new Date(builtAt).getTime());
    setThumbErr(false);
  }

  // screenshotone.com free tier — bust cache by appending build timestamp to the target URL
  const targetWithBust = `${previewUrl}${previewUrl.includes("?") ? "&" : "?"}_wg=${refreshKey}`;
  const thumbUrl = `https://api.screenshotone.com/take?url=${encodeURIComponent(targetWithBust)}&viewport_width=1280&viewport_height=800&format=jpg&image_quality=85&block_ads=true&block_cookie_banners=true&cache=false&delay=3`;

  function handleRefresh() {
    setThumbErr(false);
    setRefreshing(true);
    setRefreshKey(Math.floor(Date.now() / 1000)); // fresh key forces new screenshot
    setTimeout(() => setRefreshing(false), 5000);
  }

  return (
    <div style={{ borderRadius: 10, overflow: "hidden", border: `1px solid ${T.border}`, background: T.raised }}>
      {/* Browser chrome bar */}
      <div style={{ display: "flex", alignItems: "center", gap: 8, padding: "8px 14px", background: T.surface, borderBottom: `1px solid ${T.border}` }}>
        <div style={{ display: "flex", gap: 5 }}>
          <div style={{ width: 10, height: 10, borderRadius: "50%", background: "#ff5f57" }} />
          <div style={{ width: 10, height: 10, borderRadius: "50%", background: "#febc2e" }} />
          <div style={{ width: 10, height: 10, borderRadius: "50%", background: "#28c840" }} />
        </div>
        <div style={{ flex: 1, background: T.raised, borderRadius: 6, padding: "4px 10px", fontSize: 11, color: T.textMuted, fontFamily: "monospace", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
          {previewUrl}
        </div>
        <button onClick={handleRefresh} disabled={refreshing} title="Refresh screenshot" style={{ background: "none", border: `1px solid ${T.border}`, borderRadius: 6, padding: "4px 8px", fontSize: 13, cursor: refreshing ? "wait" : "pointer", color: T.textMuted, lineHeight: 1 }}>
          {refreshing ? "⏳" : "↺"}
        </button>
        <a href={previewUrl} target="_blank" rel="noreferrer" style={{ background: T.green + "20", color: T.green, border: `1px solid ${T.green}30`, borderRadius: 6, padding: "4px 12px", fontSize: 11, fontWeight: 700, textDecoration: "none", whiteSpace: "nowrap" }}>
          Open →
        </a>
      </div>
      {/* Screenshot thumbnail */}
      <a href={previewUrl} target="_blank" rel="noreferrer" style={{ display: "block", textDecoration: "none", position: "relative" }}>
        {refreshing && (
          <div style={{ position: "absolute", inset: 0, background: T.raised + "cc", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 1, fontSize: 13, color: T.textMuted }}>
            Taking screenshot…
          </div>
        )}
        {!thumbErr ? (
          <img
            key={refreshKey}
            src={thumbUrl}
            alt="Site preview"
            onError={() => setThumbErr(true)}
            style={{ width: "100%", display: "block", maxHeight: 420, objectFit: "cover", objectPosition: "top" }}
          />
        ) : (
          <div style={{ height: 280, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 12, color: T.textMuted }}>
            <div style={{ fontSize: 32 }}>🌐</div>
            <div style={{ fontSize: 13, fontWeight: 600, color: T.textSecondary }}>Click to open site</div>
            <div style={{ fontSize: 11 }}>{previewUrl}</div>
            <button onClick={(e) => { e.preventDefault(); handleRefresh(); }} style={{ fontSize: 11, color: T.blue, background: "none", border: "none", cursor: "pointer", textDecoration: "underline" }}>Retry screenshot</button>
          </div>
        )}
      </a>
    </div>
  );
}

function PreviewRefreshBtn({ previewUrl, T, G }: { previewUrl: string; T: typeof T_LIGHT; G: ReturnType<typeof makeG> }) {
  return null;
}

// ─── Per-client reference HTML uploader ──────────────────────────────────────
function ClientHtmlUpload({ jobId, T, G }: { jobId: string; T: typeof T_LIGHT; G: ReturnType<typeof makeG> }) {
  const [files, setFiles] = useState<{ name: string; label: string; size: number; createdAt: string }[]>([]);
  const [uploading, setUploading] = useState(false);
  const [label, setLabel] = useState("");
  const [err, setErr] = useState("");
  const [loaded, setLoaded] = useState(false);

  async function load() {
    try {
      const res = await fetch(`/api/admin/example-htmls?jobId=${jobId}`);
      if (res.ok) { const d = await res.json(); setFiles(d.files || []); setLoaded(true); }
    } catch {}
  }

  useEffect(() => { load(); }, [jobId]);

  async function handleUpload(e: React.FormEvent) {
    e.preventDefault();
    setErr("");
    const form = e.target as HTMLFormElement;
    const fileInput = form.querySelector("input[type=file]") as HTMLInputElement;
    const file = fileInput?.files?.[0];
    if (!file) { setErr("Select a .html file first"); return; }
    setUploading(true);
    try {
      const fd = new FormData();
      fd.append("file", file);
      fd.append("jobId", jobId);
      fd.append("label", label || file.name.replace(/\.html?$/i, ""));
      const res = await fetch("/api/admin/example-htmls", { method: "POST", body: fd });
      const d = await res.json();
      if (!res.ok) { setErr(d.error || "Upload failed"); return; }
      form.reset(); setLabel(""); await load();
    } catch (e) { setErr(String(e)); }
    finally { setUploading(false); }
  }

  async function handleDelete(name: string) {
    if (!confirm(`Delete ${name}?`)) return;
    await fetch("/api/admin/example-htmls", { method: "DELETE", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ name }) });
    await load();
  }

  const inputStyle: React.CSSProperties = {
    background: T.surface, border: `1px solid ${T.border}`, borderRadius: 7,
    padding: "7px 12px", color: T.textPrimary, fontSize: 13,
    outline: "none", fontFamily: "inherit", width: "100%", boxSizing: "border-box",
  };

  return (
    <div style={{ background: T.raised, border: `1px solid ${T.border}`, borderRadius: 10, padding: "16px 18px", marginBottom: 12 }}>
      <div style={{ fontSize: 12, fontWeight: 600, color: T.blue, marginBottom: 5 }}>Reference HTML files</div>
      <div style={{ fontSize: 11, color: T.textMuted, marginBottom: 14, lineHeight: 1.5 }}>
        Upload example HTML files for Claude to reference when building or rebuilding this site. Great for portfolios, layout references, or brand guides.
      </div>

      <form onSubmit={handleUpload} style={{ display: "flex", flexDirection: "column", gap: 8, marginBottom: 14 }}>
        <div style={{ display: "grid", gridTemplateColumns: "1fr auto", gap: 8, alignItems: "end" }}>
          <div>
            <div style={{ fontSize: 11, color: T.textMuted, marginBottom: 4 }}>Label (optional)</div>
            <input style={inputStyle} placeholder="e.g. portfolio-layout, hero-reference" value={label} onChange={e => setLabel(e.target.value)} />
          </div>
        </div>
        <div>
          <div style={{ fontSize: 11, color: T.textMuted, marginBottom: 4 }}>HTML file (max 2MB)</div>
          <input type="file" accept=".html,.htm" style={{ fontSize: 12, color: T.textPrimary }} />
        </div>
        {err && <div style={{ fontSize: 12, color: T.red }}>{err}</div>}
        <button type="submit" disabled={uploading} style={{ ...G.btn(T.blue, true), alignSelf: "flex-start", opacity: uploading ? 0.6 : 1 }}>
          {uploading ? "Uploading…" : "Upload HTML"}
        </button>
      </form>

      {loaded && files.length === 0 && (
        <div style={{ fontSize: 12, color: T.textMuted }}>No reference files uploaded yet.</div>
      )}
      {files.map(f => (
        <div key={f.name} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", background: T.surface, borderRadius: 7, padding: "8px 12px", border: `1px solid ${T.border}`, marginBottom: 6 }}>
          <div>
            <span style={{ fontSize: 13, color: T.textPrimary, fontWeight: 500 }}>{f.label}</span>
            <span style={{ fontSize: 11, color: T.textMuted, marginLeft: 8 }}>{Math.round(f.size / 1024)}KB</span>
          </div>
          <button onClick={() => handleDelete(f.name)} style={{ ...G.btn(T.red), fontSize: 11, padding: "3px 10px" }}>Delete</button>
        </div>
      ))}
    </div>
  );
}

function ClientRow({ c, secret, dark = false }: { c: ClientAnalytics; secret: string; dark?: boolean }) {
  T = dark ? T_DARK : T_LIGHT; G = makeG(T);
  const [open, setOpen] = useState(false);
  const statusColor =
    c.buildStatus === "completed" || c.buildStatus === "complete" ? T.green :
    c.buildStatus === "building" ? T.amber : T.textMuted;
  const a = c.analytics;
  const initials = c.businessName.split(" ").map((w: string) => w[0]).slice(0, 2).join("").toUpperCase();

  return (
    <>
      {open && <ClientDashboard c={c} secret={secret} onClose={() => setOpen(false)} dark={dark} />}
      <div
        onClick={() => setOpen(true)}
        style={{
          background: T.surface,
          border: `1px solid ${T.border}`,
          borderRadius: 10,
          padding: "14px 18px",
          marginBottom: 6,
          cursor: "pointer",
          display: "flex",
          alignItems: "center",
          gap: 14,
          flexWrap: "wrap",
          transition: "border-color 0.1s, background 0.1s",
        }}
        onMouseEnter={e => { (e.currentTarget as HTMLDivElement).style.borderColor = T.borderMd; (e.currentTarget as HTMLDivElement).style.background = T.raised; }}
        onMouseLeave={e => { (e.currentTarget as HTMLDivElement).style.borderColor = T.border; (e.currentTarget as HTMLDivElement).style.background = T.surface; }}
      >
        <div style={{
          width: 34, height: 34, borderRadius: 8,
          background: statusColor + "18", border: `1px solid ${statusColor}25`,
          display: "flex", alignItems: "center", justifyContent: "center",
          fontSize: 12, fontWeight: 700, color: statusColor, flexShrink: 0,
          letterSpacing: "0.02em",
        }}>{initials}</div>

        <div style={{ flex: 1, minWidth: 160 }}>
          <div style={{ fontWeight: 500, fontSize: 14, color: T.textPrimary, letterSpacing: "-0.01em" }}>{c.businessName}</div>
          <div style={{ fontSize: 11, color: T.textMuted, marginTop: 2 }}>{c.industry}</div>
        </div>

        <div style={{ display: "flex", gap: 5, flexWrap: "wrap" }}>
          <span style={G.pill(statusColor)}>{c.buildStatus || "pending"}</span>
          {c.paymentState?.monthlyActive && <span style={G.pill(T.green)}>Monthly</span>}
          {c.paymentState?.depositPaid && !c.paymentState?.monthlyActive && <span style={G.pill(T.amber)}>Deposit</span>}
          {!c.paymentState?.depositPaid && <span style={G.pill(T.textMuted)}>Unpaid</span>}
          {c.hasBooking && <span style={G.pill(T.purple)}>Booking</span>}
          {c.metadata?.alreadyReleased && <span style={G.pill(T.green)}>Released</span>}
        </div>

        <div style={{ display: "flex", gap: 20, fontSize: 12, color: T.textMuted }}>
          <span style={{ display: "flex", alignItems: "center", gap: 4 }}>
            <span style={{ fontSize: 10, color: T.textMuted }}>VIEWS</span>
            <span style={{ color: T.textSecondary, fontWeight: 500 }}>{a?.thisMonth.views ?? 0}</span>
          </span>
          <span style={{ display: "flex", alignItems: "center", gap: 4 }}>
            <span style={{ fontSize: 10, color: T.textMuted }}>BOOK</span>
            <span style={{ color: T.textSecondary, fontWeight: 500 }}>{c.bookingCount}</span>
          </span>
        </div>

        <div style={{ color: T.border, fontSize: 14, flexShrink: 0 }}>›</div>
      </div>
    </>
  );
}

// ─── Example HTMLs Panel ──────────────────────────────────────────────────────
function ExampleHtmlsPanel({ T, G }: { T: typeof T_LIGHT; G: ReturnType<typeof makeG> }) {
  const [files, setFiles] = useState<{ name: string; label: string; industry: string; size: number; createdAt: string }[]>([]);
  const [open, setOpen] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [industry, setIndustry] = useState("general");
  const [label, setLabel] = useState("");
  const [uploadErr, setUploadErr] = useState("");

  async function loadFiles() {
    try {
      const res = await fetch("/api/admin/example-htmls");
      if (res.ok) { const d = await res.json(); setFiles(d.files || []); }
    } catch {}
  }

  useEffect(() => { if (open) loadFiles(); }, [open]);

  async function handleUpload(e: React.FormEvent) {
    e.preventDefault();
    setUploadErr("");
    const form = e.target as HTMLFormElement;
    const fileInput = form.querySelector("input[type=file]") as HTMLInputElement;
    const file = fileInput?.files?.[0];
    if (!file) { setUploadErr("Select a .html file first"); return; }
    setUploading(true);
    try {
      const fd = new FormData();
      fd.append("file", file);
      fd.append("industry", industry);
      fd.append("label", label || file.name.replace(/\.html?$/i, ""));
      const res = await fetch("/api/admin/example-htmls", { method: "POST", body: fd });
      const d = await res.json();
      if (!res.ok) { setUploadErr(d.error || "Upload failed"); return; }
      form.reset();
      setLabel("");
      await loadFiles();
    } catch (e) { setUploadErr(String(e)); }
    finally { setUploading(false); }
  }

  async function handleDelete(name: string) {
    if (!confirm(`Delete ${name}?`)) return;
    await fetch("/api/admin/example-htmls", { method: "DELETE", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ name }) });
    await loadFiles();
  }

  const inputStyle: React.CSSProperties = {
    background: T.surface, border: `1px solid ${T.border}`, borderRadius: 7,
    padding: "7px 12px", color: T.textPrimary, fontSize: 13,
    outline: "none", fontFamily: "inherit", width: "100%", boxSizing: "border-box",
  };

  return (
    <div style={{ ...G.card, marginTop: 32 }}>
      <button
        onClick={() => setOpen(o => !o)}
        style={{ width: "100%", background: "none", border: "none", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "space-between", padding: "18px 22px" }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <span style={{ fontSize: 15, fontWeight: 700, color: T.textPrimary }}>📄 Example HTML Library</span>
          <span style={{ ...G.pill(T.blue), fontSize: 10 }}>{files.length} files</span>
        </div>
        <span style={{ color: T.textMuted, fontSize: 12 }}>{open ? "▲ collapse" : "▼ expand"}</span>
      </button>

      {open && (
        <div style={{ padding: "0 22px 22px" }}>
          <p style={{ fontSize: 12, color: T.textMuted, margin: "0 0 20px", lineHeight: 1.6 }}>
            Upload reference HTML files here. When a site is built for a matching industry, Claude uses these as layout and content inspiration. Tag files by industry so they get matched automatically.
          </p>

          {/* Upload form */}
          <form onSubmit={handleUpload} style={{ display: "flex", flexDirection: "column", gap: 10, marginBottom: 24, padding: 16, background: T.raised, borderRadius: 10, border: `1px solid ${T.border}` }}>
            <div style={{ fontWeight: 600, fontSize: 12, color: T.textMuted, textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: 4 }}>Upload new example</div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
              <div>
                <div style={{ fontSize: 11, color: T.textMuted, marginBottom: 4 }}>Industry tag</div>
                <input style={inputStyle} placeholder="e.g. beauty, dental, general" value={industry} onChange={e => setIndustry(e.target.value)} />
              </div>
              <div>
                <div style={{ fontSize: 11, color: T.textMuted, marginBottom: 4 }}>Label</div>
                <input style={inputStyle} placeholder="e.g. portfolio-layout, hero-style" value={label} onChange={e => setLabel(e.target.value)} />
              </div>
            </div>
            <div>
              <div style={{ fontSize: 11, color: T.textMuted, marginBottom: 4 }}>HTML file (max 2MB)</div>
              <input type="file" accept=".html,.htm" style={{ fontSize: 13, color: T.textPrimary }} />
            </div>
            {uploadErr && <div style={{ fontSize: 12, color: T.red }}>{uploadErr}</div>}
            <button type="submit" disabled={uploading} style={{ ...G.btn(T.green, true), alignSelf: "flex-start", opacity: uploading ? 0.6 : 1 }}>
              {uploading ? "Uploading…" : "Upload file"}
            </button>
          </form>

          {/* File list */}
          {files.length === 0 ? (
            <div style={{ color: T.textMuted, fontSize: 13, textAlign: "center", padding: "20px 0" }}>No example files uploaded yet.</div>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              {files.map(f => (
                <div key={f.name} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", background: T.raised, borderRadius: 8, padding: "10px 14px", border: `1px solid ${T.border}` }}>
                  <div>
                    <span style={{ ...G.pill(T.blue), marginRight: 8 }}>{f.industry}</span>
                    <span style={{ fontSize: 13, color: T.textPrimary, fontWeight: 500 }}>{f.label}</span>
                    <span style={{ fontSize: 11, color: T.textMuted, marginLeft: 8 }}>{Math.round(f.size / 1024)}KB · {new Date(f.createdAt).toLocaleDateString("en-AU")}</span>
                  </div>
                  <button onClick={() => handleDelete(f.name)} style={{ ...G.btn(T.red), fontSize: 11, padding: "4px 10px" }}>Delete</button>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function AdminDashboard() {
  // ── Theme ──────────────────────────────────────────────────────────────────
  const [dark, setDark] = useState(false);
  useEffect(() => { setDark(localStorage.getItem("wg_admin_theme") === "dark"); }, []);
  function toggleTheme() {
    const next = !dark;
    setDark(next);
    localStorage.setItem("wg_admin_theme", next ? "dark" : "light");
  }
  T = dark ? T_DARK : T_LIGHT;
  G = makeG(T);
  const [clients, setClients] = useState<ClientAnalytics[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState<"all" | "active" | "building" | "unpaid">("all");

  async function handleLogout() {
    await fetch("/api/admin/login", { method: "DELETE" });
    window.location.href = "/admin/login";
  }

  useEffect(() => {
    loadDashboard();
    // Auto-refresh every 8s while any build is in progress
    const interval = setInterval(async () => {
      const res = await fetch("/api/admin/clients").catch(() => null);
      if (!res || !res.ok) return;
      const data = await res.json().catch(() => ({}));
      const fresh: ClientAnalytics[] = data.clients || [];
      setClients(prev => {
        // Only update if something changed (status or previewUrl)
        const changed = fresh.some((f, i) => {
          const p = prev.find(p => p.jobId === f.jobId);
          return !p || p.buildStatus !== f.buildStatus || p.previewUrl !== f.previewUrl;
        });
        return changed ? fresh : prev;
      });
    }, 8000);
    return () => clearInterval(interval);
  }, []);

  async function loadDashboard() {
    setLoading(true); setError("");
    try {
      const res = await fetch("/api/admin/clients");
      if (res.status === 403) { window.location.href = "/admin/login"; return; }
      if (!res.ok) throw new Error("Failed to load clients");
      const data = await res.json();
      setClients(data.clients || []);
    } catch (e) { setError(e instanceof Error ? e.message : "Failed to load"); }
    finally { setLoading(false); }
  }

  const filtered = clients.filter(c => {
    const matchSearch = !search || c.businessName.toLowerCase().includes(search.toLowerCase()) || c.industry?.toLowerCase().includes(search.toLowerCase());
    const matchFilter = filter === "all" ? true : filter === "active" ? c.paymentState?.monthlyActive : filter === "building" ? c.buildStatus === "building" : !c.paymentState?.depositPaid;
    return matchSearch && matchFilter;
  });

  const totals = {
    clients: clients.length,
    active: clients.filter(c => c.paymentState?.monthlyActive).length,
    views: clients.reduce((a, c) => a + (c.analytics?.thisMonth.views || 0), 0),
    bookings: clients.reduce((a, c) => a + c.bookingCount, 0),
    mrr: clients.filter(c => c.paymentState?.monthlyActive).length * 109,
  };

  return (
    <div style={{ ...G.page, padding: "0" }}>
      {/* Top nav */}
      <div style={{
        background: T.navBg,
        borderBottom: `1px solid ${T.navBorder}`,
        padding: "0 24px",
        display: "flex", alignItems: "center", justifyContent: "space-between",
        height: 56, position: "sticky", top: 0, zIndex: 100,
        boxShadow: T.shadow,
        transition: "background 0.25s ease, border-color 0.25s ease",
      }}>
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <div style={{
            width: 28, height: 28, borderRadius: 8,
            background: `linear-gradient(135deg, ${T.green}, #0ea5e9)`,
            flexShrink: 0,
          }} />
          <span style={{ fontSize: 14, fontWeight: 700, color: T.textPrimary, letterSpacing: "-0.02em" }}>WebGecko</span>
          <span style={{
            fontSize: 10, color: T.textMuted, background: T.raised, border: `1px solid ${T.border}`,
            borderRadius: 5, padding: "2px 7px", fontWeight: 700, letterSpacing: "0.07em",
          }}>ADMIN</span>
        </div>
        <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
          <button onClick={loadDashboard} style={G.btn(T.textMuted)}>Refresh</button>
          <button
            onClick={toggleTheme}
            title={dark ? "Light mode" : "Dark mode"}
            style={{ ...G.btn(T.textMuted), width: 32, height: 32, padding: 0, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 14 }}
          >{dark ? "☀️" : "🌙"}</button>
          <button onClick={handleLogout} style={G.btn(T.textMuted)}>Sign out</button>
        </div>
      </div>

      <div style={{ maxWidth: 960, margin: "0 auto", padding: "28px 24px" }}>

        {!loading && !error && (
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill,minmax(160px,1fr))", gap: 10, marginBottom: 28 }}>
            {[
              { label: "Total clients", value: totals.clients, color: T.textPrimary },
              { label: "Monthly active", value: totals.active, color: T.green },
              { label: "Est. MRR", value: "$" + totals.mrr.toLocaleString(), color: T.green },
              { label: "Views this month", value: totals.views.toLocaleString(), color: T.blue },
              { label: "Total bookings", value: totals.bookings, color: T.amber },
            ].map(st => (
              <div key={st.label} style={{ ...G.card, padding: "16px 18px" }}>
                <div style={{ fontSize: 24, fontWeight: 600, color: st.color, letterSpacing: "-0.02em", lineHeight: 1 }}>{st.value}</div>
                <div style={{ fontSize: 11, color: T.textMuted, marginTop: 5, fontWeight: 500 }}>{st.label}</div>
              </div>
            ))}
          </div>
        )}

        {error && (
          <div style={{
            background: T.red + "0a", border: `1px solid ${T.red}25`,
            borderRadius: 10, padding: "14px 18px", color: T.red, marginBottom: 20, fontSize: 13,
          }}>{error}</div>
        )}

        <div style={{ display: "flex", gap: 10, marginBottom: 14, flexWrap: "wrap", alignItems: "center" }}>
          <input
            type="text"
            placeholder="Search clients…"
            value={search}
            onChange={e => setSearch(e.target.value)}
            style={{
              flex: 1, minWidth: 200, background: T.surface, border: `1px solid ${T.border}`,
              borderRadius: 8, padding: "8px 14px", color: T.textPrimary, fontSize: 13,
              outline: "none", boxSizing: "border-box" as const, fontFamily: "inherit",
            }}
          />
          <div style={{ display: "flex", gap: 4, background: T.surface, border: `1px solid ${T.border}`, borderRadius: 8, padding: 4 }}>
            {(["all", "active", "building", "unpaid"] as const).map(f => (
              <button key={f} onClick={() => setFilter(f)} style={G.tab(filter === f)}>
                {f === "all" ? "All" : f.charAt(0).toUpperCase() + f.slice(1)}
              </button>
            ))}
          </div>
        </div>

        {loading && (
          <div style={{ color: T.textMuted, textAlign: "center", padding: 80, fontSize: 13 }}>Loading clients…</div>
        )}
        {!loading && filtered.map(c => <ClientRow key={c.slug} c={c} secret="" dark={dark} />)}
        {!loading && filtered.length === 0 && (
          <div style={{ color: T.textMuted, textAlign: "center", padding: 80, fontSize: 13 }}>No clients found.</div>
        )}

        {/* Example HTMLs panel */}
        {!loading && <ExampleHtmlsPanel T={T} G={G} />}

      </div>
    </div>
  );
}

export default function AdminPage() {
  return (
    <Suspense fallback={<div style={{ color: "#fafafa", padding: 40, fontFamily: "Inter,sans-serif" }}>Loading…</div>}>
      <AdminDashboard />
    </Suspense>
  );
}
