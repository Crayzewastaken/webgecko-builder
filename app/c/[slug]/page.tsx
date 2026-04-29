"use client";

import { useState, useEffect } from "react";
import { useRouter, useParams } from "next/navigation";

// ─── Types ────────────────────────────────────────────────────────────────────

interface ClientData {
  businessName: string;
  name: string;
  email: string;
  phone?: string;
  industry: string;
  goal?: string;
  siteType: string;
  pages: string | string[];
  features: string[];
  style?: string;
  abn?: string;
  domain?: string;
  previewUrl?: string;
  hasBooking?: boolean;
  jobId: string;
  launchReady?: boolean;
  quote?: {
    package: string;
    price: number;
    monthlyPrice: number;
    savings: number;
    competitorPrice: number;
    breakdown: string[];
  };
  created?: string;
}

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

interface PaymentStatus {
  depositPaid: boolean;
  finalUnlocked: boolean;
  finalPaid: boolean;
  monthlyActive: boolean;
  previewUnlocked: boolean;
  quote: { total: number; monthly: number; deposit: number; final: number };
}

type Tab = "overview" | "preview" | "bookings" | "quote" | "plan";

// ─── Subscription management cancel options ───────────────────────────────────
// Research basis:
// - "Offboard with transfer" (full help migrating, domain transfer, HTML export, final review): ~50% of original build price — mirrors what agencies charge for exit packages
// - "HTML file only" (raw exported file, no support): ~20% of build price — covers our time to package/clean/export
// - "Cancel everything" (just stops billing, no assets): free, but 30-day notice

const CANCEL_OPTIONS = [
  {
    id: "transfer",
    label: "Full offboarding package",
    desc: "We transfer your domain, export a clean HTML file, do a final fix pass, and help you migrate to a new host. You leave with everything ready to go.",
    priceLabel: (buildPrice: number) => `$${Math.round(buildPrice * 0.5).toLocaleString()} one-off exit fee`,
    priceCalc: (buildPrice: number) => Math.round(buildPrice * 0.5),
    icon: "📦",
  },
  {
    id: "html",
    label: "HTML file export only",
    desc: "We send you the clean HTML file for your site. No domain transfer, no support. You handle everything else.",
    priceLabel: (buildPrice: number) => `$${Math.round(buildPrice * 0.2).toLocaleString()} export fee`,
    priceCalc: (buildPrice: number) => Math.round(buildPrice * 0.2),
    icon: "📄",
  },
  {
    id: "stop",
    label: "Just cancel — no assets",
    desc: "We stop billing at end of your current period. Your site goes offline within 30 days. No files, no transfer.",
    priceLabel: () => "Free — 30 days notice required",
    priceCalc: () => 0,
    icon: "🚫",
  },
];

// ─── Component ────────────────────────────────────────────────────────────────

export default function ClientPortal() {
  const router = useRouter();
  const params = useParams();
  const slug = params?.slug as string;

  const [client, setClient] = useState<ClientData | null>(null);
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [tab, setTab] = useState<Tab>("overview");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const [paymentStatus, setPaymentStatus] = useState<PaymentStatus | null>(null);
  const [payLoading, setPayLoading] = useState<string | null>(null);
  const [cancellingId, setCancellingId] = useState<string | null>(null);

  // Preview / feedback
  const [feedback, setFeedback] = useState<{ id: string; text: string; createdAt: string }[]>([]);
  const [feedbackText, setFeedbackText] = useState("");
  const [feedbackRound, setFeedbackRound] = useState(1);
  const [feedbackLoading, setFeedbackLoading] = useState(false);
  const [feedbackSubmitting, setFeedbackSubmitting] = useState(false);
  const [revisionSent, setRevisionSent] = useState(false);

  // Fix My Site
  const [fixLoading, setFixLoading] = useState(false);
  const [fixDone, setFixDone] = useState(false);

  // Subscription management
  const [showSubModal, setShowSubModal] = useState(false);
  const [subStep, setSubStep] = useState<"reason" | "option" | "confirm">("reason");
  const [cancelReason, setCancelReason] = useState("");
  const [cancelOption, setCancelOption] = useState<typeof CANCEL_OPTIONS[0] | null>(null);

  // ── Auth + data load ────────────────────────────────────────────────────────
  useEffect(() => {
    const auth = sessionStorage.getItem(`wg_auth_${slug}`);
    if (!auth) { router.replace("/c"); return; }
    loadClient();
  }, [slug]);

  useEffect(() => {
    if (!client) return;
    loadPaymentStatus();
    if ((tab === "bookings" || tab === "overview") && client.hasBooking) loadBookings();
    if (tab === "preview") loadFeedback();
  }, [tab, client]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const p = new URLSearchParams(window.location.search);
    if (p.get("payment") === "done") {
      setTab("quote");
      window.history.replaceState({}, "", window.location.pathname);
      setTimeout(() => loadPaymentStatus(), 2000);
      setTimeout(() => loadPaymentStatus(), 5000);
    }
  }, []);

  async function loadClient() {
    try {
      const res = await fetch(`/api/client-login?slug=${slug}`);
      if (!res.ok) { sessionStorage.removeItem(`wg_auth_${slug}`); router.replace("/c"); return; }
      setClient(await res.json());
    } catch { setError("Failed to load your project. Please refresh."); }
    finally { setLoading(false); }
  }

  async function loadPaymentStatus() {
    try {
      const res = await fetch(`/api/payment/status?slug=${slug}`);
      if (res.ok) setPaymentStatus(await res.json());
    } catch {}
  }

  async function loadBookings() {
    if (!client?.jobId) return;
    try {
      const res = await fetch(`/api/bookings/client?jobId=${client.jobId}&slug=${slug}`);
      if (res.ok) { const d = await res.json(); setBookings(d.bookings || []); }
    } catch {}
  }

  async function loadFeedback() {
    setFeedbackLoading(true);
    try {
      const res = await fetch(`/api/preview/feedback?slug=${slug}`);
      if (res.ok) { const d = await res.json(); setFeedback(d.feedback || []); setFeedbackRound(d.round || 1); }
    } finally { setFeedbackLoading(false); }
  }

  async function submitFeedback() {
    if (!feedbackText.trim() || feedback.length >= 10) return;
    setFeedbackSubmitting(true);
    try {
      const res = await fetch(`/api/preview/feedback?slug=${slug}`, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text: feedbackText.trim() }),
      });
      if (res.ok) { const d = await res.json(); setFeedback(d.feedback || []); setFeedbackText(""); }
    } finally { setFeedbackSubmitting(false); }
  }

  async function triggerRevision() {
    if (!confirm("Submit all changes for revision? Claude will apply them and we'll review before releasing.")) return;
    setFeedbackSubmitting(true);
    try {
      const res = await fetch(`/api/preview/feedback?slug=${slug}`, { method: "DELETE" });
      if (res.ok) { setRevisionSent(true); setFeedback([]); }
    } finally { setFeedbackSubmitting(false); }
  }

  async function triggerFix() {
    if (!client?.jobId) return;
    if (!confirm("Run a Claude fix pass? This re-checks all links, nav, and layout. Takes 2–3 minutes.")) return;
    setFixLoading(true);
    try {
      const res = await fetch(`/api/fix?jobId=${client.jobId}&secret=${encodeURIComponent(process.env.NEXT_PUBLIC_PROCESS_SECRET || "")}`);
      setFixDone(res.ok);
      if (!res.ok) alert("Fix failed — please contact hello@webgecko.au");
    } catch { alert("Network error. Please try again."); }
    finally { setFixLoading(false); }
  }

  async function handlePay(stage: "deposit" | "final" | "monthly") {
    setPayLoading(stage);
    try {
      const res = await fetch(`/api/payment/create?slug=${slug}&stage=${stage}`);
      const data = await res.json();
      if (data.url) window.location.href = data.url;
      else if (data.alreadyPaid) await loadPaymentStatus();
      else alert(data.error || "Could not create payment link.");
    } catch { alert("Network error. Please try again."); }
    finally { setPayLoading(null); }
  }

  async function cancelBooking(bookingId: string) {
    if (!confirm("Cancel this booking?")) return;
    setCancellingId(bookingId);
    try {
      const res = await fetch(`/api/bookings/client?jobId=${client?.jobId}&bookingId=${bookingId}&slug=${slug}`, { method: "DELETE" });
      if (res.ok) setBookings(prev => prev.map(b => b.bookingId === bookingId ? { ...b, status: "cancelled" } : b));
    } finally { setCancellingId(null); }
  }

  // ── Helpers ─────────────────────────────────────────────────────────────────
  function getTimeline() {
    if (!client) return "10–12 business days";
    const f = client.features || [];
    const pc = Array.isArray(client.pages) ? client.pages.length : 1;
    let base = 10;
    if (f.includes("Payments / Shop") || f.includes("Online Shop")) base += 3;
    else if (f.includes("Booking System")) base += 2;
    if (pc >= 10) base += 2;
    return `${base}–${base + 2} business days`;
  }

  function formatDate(dateStr: string) {
    const [y, m, d] = dateStr.split("-").map(Number);
    return new Date(y, m - 1, d).toLocaleDateString("en-AU", { weekday: "short", day: "numeric", month: "short" });
  }

  function signOut() { sessionStorage.removeItem(`wg_auth_${slug}`); router.replace("/c"); }

  const today = new Date().toISOString().split("T")[0];
  const tomorrow = new Date(Date.now() + 86400000).toISOString().split("T")[0];
  const thirtyDaysAgo = new Date(Date.now() - 30 * 86400000).toISOString().split("T")[0];

  const features = client?.features || [];
  const hasBooking = client?.hasBooking || features.includes("Booking System");
  const hasBlog = features.includes("Blog");
  const hasShop = features.includes("Payments / Shop") || features.includes("Online Shop");
  const hasGallery = features.includes("Photo Gallery");
  const hasGrowth = features.includes("Newsletter Signup") || features.includes("Live Chat");

  const upcomingBookings = bookings.filter(b => b.status !== "cancelled" && b.date >= today);
  const bookingsThisMonth = bookings.filter(b => b.status !== "cancelled" && b.date >= thirtyDaysAgo);
  const monthlyRevenue = paymentStatus?.quote?.monthly || client?.quote?.monthlyPrice || 0;

  // Peak day
  const dayCount: Record<string, number> = {};
  bookingsThisMonth.forEach(b => { const d = new Date(b.date).toLocaleDateString("en-AU", { weekday: "short" }); dayCount[d] = (dayCount[d] || 0) + 1; });
  const peakDay = Object.entries(dayCount).sort((a, b) => b[1] - a[1])[0]?.[0] || null;

  // Service breakdown
  const svcCount: Record<string, number> = {};
  bookingsThisMonth.forEach(b => { svcCount[b.service] = (svcCount[b.service] || 0) + 1; });
  const topServices = Object.entries(svcCount).sort((a, b) => b[1] - a[1]).slice(0, 3);

  const notifications: string[] = [];
  if (upcomingBookings.some(b => b.date === today)) notifications.push("📅 You have a booking today!");
  if (upcomingBookings.some(b => b.date === tomorrow)) notifications.push("📅 You have a booking tomorrow.");
  if (paymentStatus && !paymentStatus.depositPaid) notifications.push("💳 Deposit not yet paid — your build hasn't started.");
  if (paymentStatus?.finalUnlocked && !paymentStatus?.finalPaid) notifications.push("🚀 Final payment unlocked — pay to launch your site!");

  const buildPrice = paymentStatus?.quote?.total || client?.quote?.price || 0;

  const tabs: { id: Tab; label: string }[] = [
    { id: "overview", label: "Overview" },
    { id: "preview", label: "Site Preview" },
    ...(hasBooking ? [{ id: "bookings" as Tab, label: "Bookings" }] : []),
    { id: "quote", label: "Quote & Pay" },
    { id: "plan", label: "My Plan" },
  ];

  // ── Style tokens ─────────────────────────────────────────────────────────────
  const S = {
    page: { minHeight: "100vh", background: "#080c14", color: "#e2e8f0", fontFamily: "'Inter',-apple-system,BlinkMacSystemFont,sans-serif" } as React.CSSProperties,
    header: { background: "#0d1117", borderBottom: "1px solid #1e2531", padding: "14px 20px", display: "flex", alignItems: "center", justifyContent: "space-between", position: "sticky" as const, top: 0, zIndex: 50 } as React.CSSProperties,
    logoMark: { width: 28, height: 28, background: "linear-gradient(135deg,#00c896,#0099ff)", borderRadius: 7, flexShrink: 0 } as React.CSSProperties,
    tabBar: { background: "#0d1117", borderBottom: "1px solid #1e2531", display: "flex", overflowX: "auto" as const, scrollbarWidth: "none" as const } as React.CSSProperties,
    tabBtn: (active: boolean): React.CSSProperties => ({ padding: "13px 16px", fontSize: "13px", fontWeight: active ? 600 : 400, color: active ? "#00c896" : "#4a5568", borderTop: "none", borderLeft: "none", borderRight: "none", borderBottom: `2px solid ${active ? "#00c896" : "transparent"}`, background: "none", cursor: "pointer", whiteSpace: "nowrap" as const }),
    body: { padding: "16px", maxWidth: 720, margin: "0 auto" } as React.CSSProperties,
    card: { background: "#0d1117", border: "1px solid #1e2531", borderRadius: 12, padding: 18, marginBottom: 12 } as React.CSSProperties,
    label: { fontSize: 11, fontWeight: 600, color: "#4a5568", textTransform: "uppercase" as const, letterSpacing: ".07em", marginBottom: 6 } as React.CSSProperties,
    val: { fontSize: 15, color: "#e2e8f0" } as React.CSSProperties,
    pill: (color: string): React.CSSProperties => ({ display: "inline-block", background: `${color}18`, color, border: `1px solid ${color}33`, borderRadius: 20, padding: "3px 11px", fontSize: 12, fontWeight: 600 }),
    btn: (v: "primary"|"secondary"|"danger"|"ghost" = "primary", disabled = false): React.CSSProperties => ({
      display: "inline-flex", alignItems: "center", justifyContent: "center", gap: 6, padding: "11px 20px", borderRadius: 9, fontSize: 14, fontWeight: 600, cursor: disabled ? "not-allowed" : "pointer", opacity: disabled ? 0.5 : 1, border: "none", transition: "opacity .15s",
      ...(v === "primary" ? { background: "linear-gradient(135deg,#00c896,#0099ff)", color: "#000" }
        : v === "secondary" ? { background: "#1a2233", color: "#94a3b8", border: "1px solid #1e2531" }
        : v === "danger" ? { background: "#ff444415", color: "#ff6b6b", border: "1px solid #ff444430" }
        : { background: "none", color: "#4a5568", border: "1px solid #1e2531" }),
    }),
    divider: { height: 1, background: "#1e2531", margin: "16px 0" } as React.CSSProperties,
    lockBox: { background: "#080c14", borderRadius: 8, padding: 12, textAlign: "center" as const, color: "#2a3347", fontSize: 13, marginTop: 12 } as React.CSSProperties,
    payBtn: (active: boolean, v: "primary"|"secondary" = "primary"): React.CSSProperties => ({
      width: "100%", background: active ? (v === "primary" ? "linear-gradient(135deg,#00c896,#0099ff)" : "#1a2233") : "#0f1620",
      color: active ? (v === "primary" ? "#000" : "#fff") : "#2a3347", border: active && v === "secondary" ? "1px solid #1e2531" : "none",
      borderRadius: 10, padding: 14, fontSize: 15, fontWeight: 700, cursor: active ? "pointer" : "not-allowed", marginTop: 12,
    }),
  };

  // ── Loading / error ──────────────────────────────────────────────────────────
  if (loading) return <div style={{ ...S.page, display: "flex", alignItems: "center", justifyContent: "center" }}><div style={{ color: "#4a5568" }}>Loading…</div></div>;
  if (error || !client) return <div style={{ ...S.page, display: "flex", alignItems: "center", justifyContent: "center" }}><div style={{ color: "#ff5555" }}>{error || "Project not found."}</div></div>;

  // ─────────────────────────────────────────────────────────────────────────────
  return (
    <div style={S.page}>

      {/* Header */}
      <header style={S.header}>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <div style={S.logoMark} />
          <span style={{ fontSize: 15, fontWeight: 700, color: "#e2e8f0" }}>WebGecko</span>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <span style={{ fontSize: 12, color: "#4a5568", maxWidth: 130, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{client.businessName}</span>
          <button style={{ background: "none", border: "1px solid #1e2531", color: "#4a5568", borderRadius: 6, padding: "6px 12px", fontSize: 12, cursor: "pointer" }} onClick={signOut}>Sign out</button>
        </div>
      </header>

      {/* Tab bar */}
      <div style={S.tabBar}>
        {tabs.map(t => <button key={t.id} style={S.tabBtn(tab === t.id)} onClick={() => setTab(t.id)}>{t.label}</button>)}
      </div>

      <div style={S.body}>

        {/* ══════════════════════ OVERVIEW ══════════════════════ */}
        {tab === "overview" && (
          <>
            {/* Status */}
            <div style={{ background: client.launchReady ? "#00c89612" : "#0099ff10", border: `1px solid ${client.launchReady ? "#00c89630" : "#0099ff25"}`, borderRadius: 10, padding: "14px 16px", marginBottom: 12, display: "flex", alignItems: "center", gap: 10, fontSize: 14, fontWeight: 600, color: client.launchReady ? "#00c896" : "#60aaff" }}>
              <span>{client.launchReady ? "🚀" : "⚡"}</span>
              {client.launchReady ? "Your site is live!" : "Your website is being built"}
            </div>

            {/* Notifications */}
            {notifications.map((n, i) => (
              <div key={i} style={{ background: "#ffaa0010", border: "1px solid #ffaa0025", borderRadius: 8, padding: "10px 14px", marginBottom: 8, fontSize: 13, color: "#ffcc55" }}>{n}</div>
            ))}

            {/* Stats */}
            {hasBooking && (
              <div style={{ display: "grid", gridTemplateColumns: "repeat(2,1fr)", gap: 10, marginBottom: 12 }}>
                {[
                  { n: upcomingBookings.length, l: "Upcoming bookings", c: "#00c896" },
                  { n: bookingsThisMonth.length, l: "Bookings this month", c: "#0099ff" },
                  { n: `$${monthlyRevenue}`, l: "Monthly plan", c: "#8b5cf6" },
                  { n: bookings.filter(b => b.status === "confirmed").length, l: "Total confirmed", c: "#f59e0b" },
                ].map(({ n, l, c }) => (
                  <div key={l} style={{ background: "#0d1117", border: `1px solid ${c}25`, borderRadius: 12, padding: 16 }}>
                    <div style={{ fontSize: 26, fontWeight: 800, color: "#e2e8f0", lineHeight: 1, marginBottom: 4 }}>{n}</div>
                    <div style={{ fontSize: 12, color: "#4a5568" }}>{l}</div>
                  </div>
                ))}
              </div>
            )}

            {/* Project details */}
            <div style={S.card}>
              <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginBottom: 12 }}>
                <span style={S.pill("#0099ff")}>{client.industry}</span>
                <span style={S.pill("#00c896")}>{client.siteType === "multi" ? "Multi-page" : "Single page"}</span>
                {features.slice(0, 4).map(f => <span key={f} style={S.pill("#8b5cf6")}>{f}</span>)}
              </div>
              {Array.isArray(client.pages) && client.pages.length > 0 && (
                <div style={{ marginBottom: 12 }}>
                  <div style={S.label}>Pages</div>
                  <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
                    {client.pages.map(p => <span key={p} style={{ fontSize: 12, color: "#94a3b8", background: "#1a2233", borderRadius: 6, padding: "3px 9px" }}>{p}</span>)}
                  </div>
                </div>
              )}
              <div style={S.divider} />
              <div style={{ display: "flex", justifyContent: "space-between", fontSize: 13, marginBottom: 8 }}>
                <span style={{ color: "#4a5568" }}>Timeline</span>
                <span style={{ color: "#94a3b8" }}>{getTimeline()}</span>
              </div>
              {client.domain && (
                <div style={{ display: "flex", justifyContent: "space-between", fontSize: 13 }}>
                  <span style={{ color: "#4a5568" }}>Domain</span>
                  <span style={{ color: "#94a3b8" }}>{client.domain}</span>
                </div>
              )}
            </div>

            {/* Feature modules quick-access */}
            {(hasBooking || hasBlog || hasShop || hasGallery || hasGrowth) && paymentStatus?.previewUnlocked && (
              <div style={S.card}>
                <div style={S.label}>Your Features</div>
                <div style={{ display: "flex", flexDirection: "column", gap: 8, marginTop: 8 }}>
                  {hasBooking && (
                    <a href={`/c/${slug}/bookings`} style={{ display: "flex", alignItems: "center", gap: 12, padding: "12px 14px", background: "#080c14", border: "1px solid #1e2531", borderRadius: 10, textDecoration: "none" }}>
                      <span style={{ fontSize: 20 }}>📅</span>
                      <div>
                        <div style={{ fontSize: 13, fontWeight: 600, color: "#e2e8f0" }}>Bookings Dashboard</div>
                        <div style={{ fontSize: 12, color: "#4a5568" }}>{upcomingBookings.length} upcoming · manage all appointments</div>
                      </div>
                      <span style={{ marginLeft: "auto", color: "#4a5568", fontSize: 14 }}>→</span>
                    </a>
                  )}
                  {hasShop && (
                    <div style={{ display: "flex", alignItems: "center", gap: 12, padding: "12px 14px", background: "#080c14", border: "1px solid #1e2531", borderRadius: 10 }}>
                      <span style={{ fontSize: 20 }}>🛒</span>
                      <div>
                        <div style={{ fontSize: 13, fontWeight: 600, color: "#e2e8f0" }}>Online Shop & Payments</div>
                        <div style={{ fontSize: 12, color: "#4a5568" }}>Square payments active on your site</div>
                      </div>
                      <span style={{ marginLeft: "auto", ...S.pill("#00c896"), fontSize: 11 }}>Active</span>
                    </div>
                  )}
                  {hasBlog && (
                    <div style={{ display: "flex", alignItems: "center", gap: 12, padding: "12px 14px", background: "#080c14", border: "1px solid #1e2531", borderRadius: 10 }}>
                      <span style={{ fontSize: 20 }}>📰</span>
                      <div>
                        <div style={{ fontSize: 13, fontWeight: 600, color: "#e2e8f0" }}>Blog & Content</div>
                        <div style={{ fontSize: 12, color: "#4a5568" }}>Contact us to publish new posts</div>
                      </div>
                    </div>
                  )}
                  {hasGallery && (
                    <div style={{ display: "flex", alignItems: "center", gap: 12, padding: "12px 14px", background: "#080c14", border: "1px solid #1e2531", borderRadius: 10 }}>
                      <span style={{ fontSize: 20 }}>🖼️</span>
                      <div>
                        <div style={{ fontSize: 13, fontWeight: 600, color: "#e2e8f0" }}>Photo Gallery</div>
                        <div style={{ fontSize: 12, color: "#4a5568" }}>Email new photos to hello@webgecko.au</div>
                      </div>
                    </div>
                  )}
                  {hasGrowth && (
                    <div style={{ display: "flex", alignItems: "center", gap: 12, padding: "12px 14px", background: "#080c14", border: "1px solid #1e2531", borderRadius: 10 }}>
                      <span style={{ fontSize: 20 }}>📈</span>
                      <div>
                        <div style={{ fontSize: 13, fontWeight: 600, color: "#e2e8f0" }}>Growth & Marketing</div>
                        <div style={{ fontSize: 12, color: "#4a5568" }}>Newsletter & live chat on your site</div>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* Recent improvements */}
            <div style={S.card}>
              <div style={S.label}>Recent Improvements</div>
              <div style={{ display: "flex", flexDirection: "column", gap: 8, marginTop: 4 }}>
                {["Mobile layout optimised", "Page load speed improved", "SEO meta tags updated", "Accessibility improvements applied"].map((item, i) => (
                  <div key={i} style={{ display: "flex", alignItems: "center", gap: 10, fontSize: 13, color: "#94a3b8" }}>
                    <span style={{ color: "#00c896", fontSize: 11 }}>✓</span>{item}
                  </div>
                ))}
              </div>
            </div>

            {/* Fix My Site */}
            {paymentStatus?.previewUnlocked && (
              <div style={S.card}>
                <div style={S.label}>Site Tools</div>
                <div style={{ color: "#4a5568", fontSize: 13, marginBottom: 12 }}>Run a Claude fix pass to automatically repair broken links, layout issues, or JS errors.</div>
                {fixDone
                  ? <div style={{ color: "#00c896", fontSize: 13, fontWeight: 600 }}>✓ Fix applied — check your site preview.</div>
                  : <button onClick={triggerFix} disabled={fixLoading} style={{ ...S.btn("secondary", fixLoading), width: "100%" }}>{fixLoading ? "Fixing… (2–3 min)" : "🔧 Fix My Site"}</button>
                }
              </div>
            )}

            <div style={{ ...S.card, background: "transparent", border: "1px solid #131b27" }}>
              <div style={{ color: "#2a3347", fontSize: 13 }}>Questions? <a href="mailto:hello@webgecko.au" style={{ color: "#334155" }}>hello@webgecko.au</a></div>
            </div>
          </>
        )}

        {/* ══════════════════════ SITE PREVIEW ══════════════════════ */}
        {tab === "preview" && (
          <>
            {!paymentStatus?.previewUnlocked ? (
              <div style={{ ...S.card, textAlign: "center", padding: "48px 24px" }}>
                <div style={{ fontSize: 36, marginBottom: 12 }}>🔒</div>
                <div style={{ color: "#4a5568", fontSize: 15 }}>Preview coming soon</div>
                <div style={{ color: "#2a3347", fontSize: 13, marginTop: 6 }}>You'll receive an email when your site is ready to review.</div>
              </div>
            ) : client.jobId ? (
              <>
                <div style={{ ...S.card, padding: 0, overflow: "hidden" }}>
                  <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "14px 18px", borderBottom: "1px solid #1e2531" }}>
                    <span style={{ color: "#e2e8f0", fontWeight: 600, fontSize: 13 }}>🖥 Live Preview — Round {feedbackRound}</span>
                    {client.previewUrl && <a href={client.previewUrl} target="_blank" rel="noopener noreferrer" style={{ color: "#0099ff", fontSize: 12, textDecoration: "none" }}>Open in new tab ↗</a>}
                  </div>
                  <div style={{ position: "relative", width: "100%", paddingBottom: "62%", background: "#080c14" }}>
                    <iframe src={`/api/preview/proxy?slug=${slug}`} style={{ position: "absolute", top: 0, left: 0, width: "100%", height: "100%", border: "none" }} title="Site Preview" />
                  </div>
                </div>

                <div style={S.card}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 4 }}>
                    <div style={{ color: "#e2e8f0", fontWeight: 700, fontSize: 14 }}>✏️ Request Changes</div>
                    <div style={{ fontSize: 12, color: feedback.length >= 10 ? "#ff6b6b" : feedback.length >= 8 ? "#ffcc55" : "#4a5568", fontWeight: 600 }}>{feedback.length}/10 free changes</div>
                  </div>
                  <div style={{ color: "#4a5568", fontSize: 12, marginBottom: 14 }}>
                    First 10 changes included free.{feedback.length >= 10 && <span style={{ color: "#ffcc55" }}> Additional changes are $15 each.</span>}
                  </div>

                  {revisionSent ? (
                    <div style={{ background: "#00c89610", border: "1px solid #00c89625", borderRadius: 10, padding: 20, textAlign: "center" }}>
                      <div style={{ fontSize: 24, marginBottom: 8 }}>✅</div>
                      <div style={{ color: "#00c896", fontWeight: 600 }}>Changes submitted!</div>
                      <div style={{ color: "#4a5568", fontSize: 13, marginTop: 4 }}>We're applying your changes. You'll get an email when the revised site is ready.</div>
                    </div>
                  ) : (
                    <>
                      {feedback.length > 0 && (
                        <div style={{ display: "flex", flexDirection: "column", gap: 8, marginBottom: 14 }}>
                          {feedback.map((f, i) => (
                            <div key={f.id} style={{ background: "#080c14", border: "1px solid #1e2531", borderRadius: 8, padding: "10px 14px", display: "flex", gap: 10, alignItems: "flex-start", justifyContent: "space-between" }}>
                              <div style={{ display: "flex", gap: 8 }}>
                                <span style={{ color: "#2a3347", fontSize: 11, minWidth: 18, marginTop: 2 }}>{i + 1}.</span>
                                <span style={{ color: "#94a3b8", fontSize: 13, lineHeight: 1.5 }}>{f.text}</span>
                              </div>
                              <button onClick={() => setFeedback(prev => prev.filter(x => x.id !== f.id))} style={{ background: "none", border: "none", color: "#2a3347", cursor: "pointer", fontSize: 14, flexShrink: 0 }}>✕</button>
                            </div>
                          ))}
                        </div>
                      )}
                      {feedback.length < 10 && (
                        <div style={{ display: "flex", gap: 8, marginBottom: 12 }}>
                          <input type="text" value={feedbackText} onChange={e => setFeedbackText(e.target.value)} onKeyDown={e => e.key === "Enter" && submitFeedback()}
                            placeholder="e.g. Change the hero button to blue"
                            style={{ flex: 1, background: "#080c14", border: "1px solid #1e2531", borderRadius: 8, padding: "10px 14px", color: "#e2e8f0", fontSize: 13, outline: "none" }} />
                          <button onClick={submitFeedback} disabled={feedbackSubmitting || !feedbackText.trim()} style={{ ...S.btn("primary", feedbackSubmitting || !feedbackText.trim()), padding: "10px 16px", fontSize: 13 }}>Add</button>
                        </div>
                      )}
                      {feedback.length > 0 && (
                        <button onClick={triggerRevision} disabled={feedbackSubmitting}
                          style={{ width: "100%", background: "linear-gradient(135deg,#00c896,#0099ff)", color: "#000", border: "none", borderRadius: 10, padding: 13, fontSize: 14, fontWeight: 800, cursor: "pointer", opacity: feedbackSubmitting ? 0.6 : 1 }}>
                          {feedbackSubmitting ? "Submitting…" : `Submit ${feedback.length} Change${feedback.length !== 1 ? "s" : ""} for Revision`}
                        </button>
                      )}
                    </>
                  )}
                </div>
              </>
            ) : (
              <div style={{ ...S.card, textAlign: "center", padding: "48px 24px" }}>
                <div style={{ fontSize: 36, marginBottom: 12 }}>🏗️</div>
                <div style={{ color: "#4a5568", fontSize: 15 }}>Your site is being built.</div>
              </div>
            )}
          </>
        )}

        {/* ══════════════════════ BOOKINGS ══════════════════════ */}
        {tab === "bookings" && hasBooking && (
          <>
            {/* Performance */}
            {bookingsThisMonth.length > 0 && (
              <div style={S.card}>
                <div style={S.label}>Performance — Last 30 Days</div>
                <div style={{ display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: 10, marginTop: 10 }}>
                  {[{ n: bookingsThisMonth.length, l: "Bookings" }, { n: peakDay || "—", l: "Peak day" }, { n: topServices[0]?.[0]?.substring(0, 10) || "—", l: "Top service" }].map(({ n, l }) => (
                    <div key={l} style={{ textAlign: "center" }}>
                      <div style={{ fontSize: 20, fontWeight: 800, color: "#00c896" }}>{n}</div>
                      <div style={{ fontSize: 11, color: "#4a5568", marginTop: 2 }}>{l}</div>
                    </div>
                  ))}
                </div>
                {topServices.length > 0 && (
                  <>
                    <div style={S.divider} />
                    <div style={S.label}>Service Breakdown</div>
                    {topServices.map(([svc, count]) => (
                      <div key={svc} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
                        <span style={{ fontSize: 13, color: "#94a3b8" }}>{svc}</span>
                        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                          <div style={{ width: 80, height: 4, background: "#1e2531", borderRadius: 2, overflow: "hidden" }}>
                            <div style={{ width: `${(count / bookingsThisMonth.length) * 100}%`, height: "100%", background: "#00c896", borderRadius: 2 }} />
                          </div>
                          <span style={{ fontSize: 12, color: "#4a5568", minWidth: 20, textAlign: "right" }}>{count}</span>
                        </div>
                      </div>
                    ))}
                  </>
                )}
              </div>
            )}

            {!paymentStatus?.previewUnlocked ? (
              <div style={{ ...S.card, textAlign: "center", padding: "48px 24px" }}>
                <div style={{ fontSize: 36, marginBottom: 12 }}>🔒</div>
                <div style={{ color: "#4a5568", fontSize: 15 }}>Bookings available after deposit</div>
              </div>
            ) : (
              <div style={S.card}>
                <div style={S.label}>Booking Requests</div>
                <div style={{ color: "#4a5568", fontSize: 13, marginBottom: 12 }}>Recent submissions from your website.</div>
                <a href={`/c/${slug}/bookings`} style={{ ...S.btn("primary"), textDecoration: "none", display: "inline-flex" }}>Full Booking Dashboard →</a>
              </div>
            )}

            {bookings.length === 0 ? (
              <div style={{ ...S.card, textAlign: "center", padding: 40 }}>
                <div style={{ fontSize: 28, marginBottom: 10 }}>📅</div>
                <div style={{ color: "#2a3347", fontSize: 14 }}>No bookings yet.</div>
              </div>
            ) : bookings.slice(0, 5).map(b => {
              const isToday = b.date === today;
              const isTomorrow = b.date === tomorrow;
              const cancelled = b.status === "cancelled";
              return (
                <div key={b.bookingId} style={{ ...S.card, opacity: cancelled ? 0.45 : 1, borderColor: isToday ? "#00c89630" : "#1e2531" }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 8, gap: 8, flexWrap: "wrap" }}>
                    <div>
                      <span style={{ fontWeight: 600, fontSize: 15, color: "#e2e8f0" }}>{b.visitorName}</span>
                      {isToday && <span style={{ ...S.pill("#00c896"), marginLeft: 8, fontSize: 10 }}>TODAY</span>}
                      {isTomorrow && <span style={{ ...S.pill("#ffaa00"), marginLeft: 8, fontSize: 10 }}>TOMORROW</span>}
                    </div>
                    <span style={S.pill(cancelled ? "#ff4444" : b.status === "confirmed" ? "#00c896" : "#ffaa00")}>{b.status}</span>
                  </div>
                  <div style={{ color: "#4a5568", fontSize: 13, marginBottom: 3 }}>{b.service} · {formatDate(b.date)} at {b.time}</div>
                  <div style={{ color: "#2a3347", fontSize: 12 }}>{b.visitorEmail}</div>
                  {!cancelled && (
                    <div style={{ display: "flex", gap: 8, marginTop: 12, flexWrap: "wrap" }}>
                      <a href={`mailto:${b.visitorEmail}`} style={{ ...S.pill("#0099ff"), textDecoration: "none", padding: "6px 14px" }}>Email</a>
                      <a href={`tel:${b.visitorPhone}`} style={{ ...S.pill("#00c896"), textDecoration: "none", padding: "6px 14px" }}>Call</a>
                      <button onClick={() => cancelBooking(b.bookingId)} disabled={cancellingId === b.bookingId}
                        style={{ ...S.pill("#ff4444"), border: "1px solid #ff444433", background: "#ff444415", cursor: "pointer", padding: "6px 14px" }}>
                        {cancellingId === b.bookingId ? "…" : "Cancel"}
                      </button>
                    </div>
                  )}
                </div>
              );
            })}
          </>
        )}

        {/* ══════════════════════ QUOTE & PAY ══════════════════════ */}
        {tab === "quote" && (
          <>
            {client.quote && (
              <div style={S.card}>
                <div style={S.label}>{client.quote.package} Package</div>
                <div style={{ fontSize: 32, fontWeight: 800, color: "#e2e8f0", marginBottom: 4 }}>${client.quote.price.toLocaleString()}</div>
                <div style={{ color: "#4a5568", fontSize: 13, marginBottom: 14 }}>+ ${client.quote.monthlyPrice}/month hosting & maintenance</div>
                <div style={{ background: "#00c89610", border: "1px solid #00c89625", borderRadius: 8, padding: "10px 14px", fontSize: 13, color: "#00c896", marginBottom: 12 }}>
                  🎉 Saving ${client.quote.savings.toLocaleString()} vs the industry average of ${client.quote.competitorPrice.toLocaleString()}
                </div>
                {client.quote.breakdown.map(line => (
                  <div key={line} style={{ display: "flex", justifyContent: "space-between", padding: "8px 0", borderTop: "1px solid #1a2233", fontSize: 13, color: "#4a5568" }}>
                    <span>{line.split(":")[0]}</span><span style={{ color: "#64748b" }}>{line.split(":")[1]}</span>
                  </div>
                ))}
              </div>
            )}

            {!paymentStatus ? (
              <div style={{ ...S.card, textAlign: "center", padding: 32 }}><div style={{ color: "#2a3347", fontSize: 14 }}>Loading payment details…</div></div>
            ) : (
              <>
                <div style={S.card}>
                  <div style={S.label}>Payment Progress</div>
                  <div style={{ display: "flex", gap: 8, marginTop: 10 }}>
                    {[{ label: "Deposit", done: paymentStatus.depositPaid, icon: "💳" }, { label: "Final", done: paymentStatus.finalPaid, icon: "🚀" }, { label: "Monthly", done: paymentStatus.monthlyActive, icon: "🔄" }].map(s => (
                      <div key={s.label} style={{ flex: 1, textAlign: "center", padding: "14px 8px", borderRadius: 10, background: s.done ? "#00c89612" : "#0d1117", border: `1px solid ${s.done ? "#00c89630" : "#1e2531"}` }}>
                        <div style={{ fontSize: 18, marginBottom: 4 }}>{s.done ? "✅" : s.icon}</div>
                        <div style={{ fontSize: 11, color: s.done ? "#00c896" : "#2a3347", fontWeight: 600 }}>{s.label}</div>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Deposit */}
                <div style={{ ...S.card, borderColor: paymentStatus.depositPaid ? "#00c89630" : "#1e2531" }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
                    <div><div style={{ fontWeight: 700, fontSize: 16, color: "#e2e8f0", marginBottom: 4 }}>50% Deposit</div><div style={{ color: "#4a5568", fontSize: 13 }}>Pay now to begin your website build</div></div>
                    <div style={{ fontSize: 22, fontWeight: 800, color: "#e2e8f0" }}>${paymentStatus.quote.deposit.toLocaleString()}</div>
                  </div>
                  {paymentStatus.depositPaid
                    ? <div style={{ color: "#00c896", fontSize: 13, fontWeight: 600, marginTop: 12 }}>✓ Paid — build in progress</div>
                    : <button onClick={() => handlePay("deposit")} disabled={payLoading === "deposit"} style={{ ...S.payBtn(true), opacity: payLoading === "deposit" ? 0.6 : 1 }}>{payLoading === "deposit" ? "Loading…" : "Pay Deposit →"}</button>
                  }
                </div>

                {/* Final */}
                <div style={{ ...S.card, opacity: !paymentStatus.depositPaid ? 0.45 : 1, borderColor: paymentStatus.finalPaid ? "#00c89630" : "#1e2531" }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
                    <div><div style={{ fontWeight: 700, fontSize: 16, color: "#e2e8f0", marginBottom: 4 }}>50% Final Payment</div>
                      <div style={{ color: "#4a5568", fontSize: 13 }}>{!paymentStatus.depositPaid ? "Pay deposit first" : !paymentStatus.finalUnlocked ? "Unlocked after your revision is approved" : "Pay to launch your website"}</div></div>
                    <div style={{ fontSize: 22, fontWeight: 800, color: "#e2e8f0" }}>${paymentStatus.quote.final.toLocaleString()}</div>
                  </div>
                  {paymentStatus.finalPaid
                    ? <div style={{ color: "#00c896", fontSize: 13, fontWeight: 600, marginTop: 12 }}>✓ Paid — site is live</div>
                    : paymentStatus.finalUnlocked && paymentStatus.depositPaid
                    ? <button onClick={() => handlePay("final")} disabled={payLoading === "final"} style={{ ...S.payBtn(true), opacity: payLoading === "final" ? 0.6 : 1 }}>{payLoading === "final" ? "Loading…" : "Pay Final & Launch →"}</button>
                    : <div style={S.lockBox}>🔒 Locked</div>
                  }
                </div>

                {/* Monthly */}
                <div style={{ ...S.card, opacity: !paymentStatus.finalPaid ? 0.45 : 1, borderColor: paymentStatus.monthlyActive ? "#00c89630" : "#1e2531" }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
                    <div><div style={{ fontWeight: 700, fontSize: 16, color: "#e2e8f0", marginBottom: 4 }}>Monthly Hosting & Maintenance</div>
                      <div style={{ color: "#4a5568", fontSize: 13 }}>{!paymentStatus.finalPaid ? "Unlocked after final payment" : "Performance, hosting & ongoing updates"}</div></div>
                    <div><span style={{ fontSize: 22, fontWeight: 800, color: "#e2e8f0" }}>${paymentStatus.quote.monthly}</span><span style={{ fontSize: 13, color: "#4a5568" }}>/mo</span></div>
                  </div>
                  {paymentStatus.monthlyActive
                    ? <div style={{ color: "#00c896", fontSize: 13, fontWeight: 600, marginTop: 12 }}>✓ Active</div>
                    : paymentStatus.finalPaid
                    ? <button onClick={() => handlePay("monthly")} disabled={payLoading === "monthly"} style={{ ...S.payBtn(true, "secondary"), opacity: payLoading === "monthly" ? 0.6 : 1 }}>{payLoading === "monthly" ? "Loading…" : "Start Monthly Plan →"}</button>
                    : <div style={S.lockBox}>🔒 Locked</div>
                  }
                </div>

                <div style={{ color: "#1e2531", fontSize: 12, textAlign: "center", marginTop: 4 }}>Payments processed securely by Square · WebGecko never stores card details</div>
              </>
            )}
          </>
        )}

        {/* ══════════════════════ MY PLAN ══════════════════════ */}
        {tab === "plan" && (
          <>
            {/* Plan summary */}
            <div style={S.card}>
              <div style={S.label}>Current Plan</div>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: 8 }}>
                <div>
                  <div style={{ fontSize: 18, fontWeight: 700, color: "#e2e8f0" }}>{client.quote?.package || "Standard"} Plan</div>
                  <div style={{ fontSize: 13, color: "#4a5568", marginTop: 2 }}>Hosting, maintenance & ongoing updates</div>
                </div>
                <div style={{ textAlign: "right" }}>
                  <div style={{ fontSize: 22, fontWeight: 800, color: "#00c896" }}>${paymentStatus?.quote?.monthly || client.quote?.monthlyPrice || "—"}</div>
                  <div style={{ fontSize: 12, color: "#4a5568" }}>/month</div>
                </div>
              </div>
              <div style={S.divider} />
              {["Fast Australian hosting", "Monthly Claude AI improvements", "10 free site changes/month", "SEO & performance updates", "Priority email support"].map((item, i) => (
                <div key={i} style={{ display: "flex", alignItems: "center", gap: 10, fontSize: 13, color: "#94a3b8", marginBottom: 8 }}>
                  <span style={{ color: "#00c896", fontSize: 11 }}>✓</span>{item}
                </div>
              ))}
            </div>

            {/* What's included */}
            <div style={S.card}>
              <div style={S.label}>What You Get</div>
              <div style={{ display: "flex", flexDirection: "column", gap: 14, marginTop: 10 }}>
                {[
                  { icon: "🔧", title: "Monthly AI Fix Pass", desc: "Claude reviews and improves your site every month automatically." },
                  { icon: "📈", title: "SEO & Speed Updates", desc: "We keep your site fast, indexed, and discoverable." },
                  { icon: "✏️", title: "Site Change Requests", desc: "Request changes anytime from the Site Preview tab. First 10 are free each month." },
                ].map(({ icon, title, desc }) => (
                  <div key={title} style={{ display: "flex", gap: 12 }}>
                    <div style={{ fontSize: 20 }}>{icon}</div>
                    <div>
                      <div style={{ fontSize: 13, fontWeight: 600, color: "#e2e8f0" }}>{title}</div>
                      <div style={{ fontSize: 12, color: "#4a5568", marginTop: 2 }}>{desc}</div>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Manage subscription */}
            {!showSubModal ? (
              <div style={{ ...S.card, background: "transparent", border: "1px solid #131b27" }}>
                <div style={{ fontSize: 13, color: "#2a3347", marginBottom: 10 }}>Need to make changes to your plan?</div>
                <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
                  <a href="mailto:hello@webgecko.au?subject=Upgrade%20my%20plan" style={{ ...S.btn("secondary"), textDecoration: "none", fontSize: 13 }}>📨 Upgrade Plan</a>
                  <button onClick={() => { setShowSubModal(true); setSubStep("reason"); setCancelOption(null); setCancelReason(""); }} style={{ ...S.btn("ghost"), fontSize: 13 }}>Manage subscription</button>
                </div>
              </div>
            ) : (
              <div style={S.card}>

                {/* Step 1 — Reason */}
                {subStep === "reason" && (
                  <>
                    <div style={{ fontWeight: 700, fontSize: 15, color: "#e2e8f0", marginBottom: 4 }}>What's on your mind?</div>
                    <div style={{ color: "#4a5568", fontSize: 13, marginBottom: 16 }}>Tell us what's changed and we'll find the right option.</div>
                    {[
                      { r: "too-expensive", label: "💰 It's too expensive right now" },
                      { r: "not-using", label: "😴 I'm not using it enough" },
                      { r: "unhappy", label: "😕 I'm not happy with the site" },
                      { r: "switching", label: "🔄 I'm moving to another provider" },
                      { r: "closing", label: "🚪 My business is closing" },
                      { r: "other", label: "💬 Something else" },
                    ].map(({ r, label }) => (
                      <button key={r} onClick={() => { setCancelReason(r); setSubStep("option"); }}
                        style={{ display: "block", width: "100%", textAlign: "left", background: cancelReason === r ? "#0d1a2e" : "#080c14", border: `1px solid ${cancelReason === r ? "#0099ff40" : "#1e2531"}`, borderRadius: 8, padding: "12px 14px", fontSize: 13, color: "#94a3b8", cursor: "pointer", marginBottom: 8 }}>
                        {label}
                      </button>
                    ))}
                    <button onClick={() => setShowSubModal(false)} style={{ ...S.btn("ghost"), marginTop: 4, fontSize: 13 }}>Never mind</button>
                  </>
                )}

                {/* Step 2 — Options based on reason */}
                {subStep === "option" && (
                  <>
                    <div style={{ fontWeight: 700, fontSize: 15, color: "#e2e8f0", marginBottom: 4 }}>
                      {cancelReason === "too-expensive" ? "💡 Let's find something that works" :
                       cancelReason === "not-using" ? "⏸ Want to pause instead?" :
                       cancelReason === "unhappy" ? "🔧 Let us fix it first" :
                       "Here are your options"}
                    </div>
                    <div style={{ color: "#4a5568", fontSize: 13, marginBottom: 16 }}>
                      {cancelReason === "too-expensive" ? "We can pause your plan or reduce your tier. Email us — we'd rather work something out than lose you." :
                       cancelReason === "not-using" ? "You can pause for up to 2 months at no cost. Your site stays live, billing resumes after." :
                       cancelReason === "unhappy" ? "We'll fix it at no extra cost — use the Site Preview tab to submit changes. If you're still not happy after, we'll sort it out." :
                       "Choose how you'd like to leave. Each option has a different exit fee."}
                    </div>

                    {/* Offer for fixable reasons */}
                    {(cancelReason === "too-expensive" || cancelReason === "not-using" || cancelReason === "unhappy") && (
                      <div style={{ marginBottom: 16 }}>
                        {cancelReason === "unhappy" && (
                          <button onClick={() => { setShowSubModal(false); setTab("preview"); }} style={{ ...S.btn("primary"), width: "100%", marginBottom: 10, fontSize: 13 }}>
                            Request Changes Now →
                          </button>
                        )}
                        <a href={`mailto:hello@webgecko.au?subject=${encodeURIComponent("Plan query — " + client.businessName)}&body=${encodeURIComponent("Hi, I wanted to discuss my plan.\n\nReason: " + cancelReason + "\n\nBusiness: " + client.businessName)}`}
                          style={{ ...S.btn("secondary"), textDecoration: "none", width: "100%", display: "flex", fontSize: 13, marginBottom: 10 }}>
                          📨 Talk to Us First
                        </a>
                      </div>
                    )}

                    {/* Cancel options with pricing */}
                    <div style={{ ...S.label, marginTop: 8 }}>Or choose a cancellation option</div>
                    {CANCEL_OPTIONS.map(opt => (
                      <button key={opt.id} onClick={() => { setCancelOption(opt); setSubStep("confirm"); }}
                        style={{ display: "block", width: "100%", textAlign: "left", background: "#080c14", border: "1px solid #1e2531", borderRadius: 10, padding: "14px 16px", fontSize: 13, color: "#94a3b8", cursor: "pointer", marginBottom: 10 }}>
                        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 8 }}>
                          <div style={{ display: "flex", gap: 10 }}>
                            <span style={{ fontSize: 20 }}>{opt.icon}</span>
                            <div>
                              <div style={{ fontWeight: 600, color: "#e2e8f0", marginBottom: 4 }}>{opt.label}</div>
                              <div style={{ fontSize: 12, color: "#4a5568" }}>{opt.desc}</div>
                            </div>
                          </div>
                          <div style={{ flexShrink: 0, textAlign: "right" }}>
                            <div style={{ fontSize: 12, fontWeight: 600, color: opt.id === "stop" ? "#94a3b8" : "#ffcc55", whiteSpace: "nowrap" }}>
                              {opt.priceLabel(buildPrice)}
                            </div>
                          </div>
                        </div>
                      </button>
                    ))}
                    <button onClick={() => setSubStep("reason")} style={{ ...S.btn("ghost"), fontSize: 13 }}>← Back</button>
                  </>
                )}

                {/* Step 3 — Confirm */}
                {subStep === "confirm" && cancelOption && (
                  <>
                    <div style={{ fontWeight: 700, fontSize: 15, color: "#e2e8f0", marginBottom: 4 }}>Confirm your choice</div>
                    <div style={{ background: "#080c14", border: "1px solid #1e2531", borderRadius: 10, padding: "16px", marginBottom: 16 }}>
                      <div style={{ display: "flex", gap: 10, alignItems: "center", marginBottom: 8 }}>
                        <span style={{ fontSize: 24 }}>{cancelOption.icon}</span>
                        <div style={{ fontSize: 14, fontWeight: 600, color: "#e2e8f0" }}>{cancelOption.label}</div>
                      </div>
                      <div style={{ fontSize: 13, color: "#4a5568", marginBottom: 8 }}>{cancelOption.desc}</div>
                      <div style={{ display: "flex", justifyContent: "space-between", paddingTop: 10, borderTop: "1px solid #1e2531" }}>
                        <span style={{ fontSize: 13, color: "#4a5568" }}>Exit fee</span>
                        <span style={{ fontSize: 14, fontWeight: 700, color: cancelOption.id === "stop" ? "#94a3b8" : "#ffcc55" }}>
                          {cancelOption.priceCalc(buildPrice) === 0 ? "Free" : `$${cancelOption.priceCalc(buildPrice).toLocaleString()}`}
                        </span>
                      </div>
                    </div>
                    <div style={{ fontSize: 12, color: "#4a5568", marginBottom: 16 }}>
                      Clicking below sends a cancellation request to our team. We'll confirm within 1 business day and arrange next steps.
                    </div>
                    <a
                      href={`mailto:hello@webgecko.au?subject=${encodeURIComponent("Cancellation request — " + client.businessName + " — " + cancelOption.label)}&body=${encodeURIComponent(
                        "Hi WebGecko team,\n\nI'd like to cancel my subscription.\n\n" +
                        "Business: " + client.businessName + "\n" +
                        "Option chosen: " + cancelOption.label + "\n" +
                        "Exit fee quoted: " + (cancelOption.priceCalc(buildPrice) === 0 ? "Free" : "$" + cancelOption.priceCalc(buildPrice).toLocaleString()) + "\n" +
                        "Reason: " + cancelReason + "\n\n" +
                        "Please confirm receipt and next steps."
                      )}`}
                      style={{ ...S.btn("danger"), textDecoration: "none", width: "100%", display: "flex", fontSize: 13, marginBottom: 10 }}>
                      Send Cancellation Request
                    </a>
                    <button onClick={() => { setShowSubModal(false); }} style={{ ...S.btn("secondary"), width: "100%", fontSize: 13 }}>Keep my plan</button>
                    <button onClick={() => setSubStep("option")} style={{ ...S.btn("ghost"), marginTop: 8, fontSize: 12 }}>← Back</button>
                  </>
                )}
              </div>
            )}
          </>
        )}

      </div>
    </div>
  );
}
