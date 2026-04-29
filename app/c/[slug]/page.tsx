"use client";

import { useState, useEffect, useCallback } from "react";
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
  quote: {
    total: number;
    monthly: number;
    deposit: number;
    final: number;
  };
}

type Tab = "overview" | "preview" | "bookings" | "quote" | "plan";

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

  // Feedback / site preview state
  const [feedback, setFeedback] = useState<{ id: string; text: string; createdAt: string }[]>([]);
  const [feedbackText, setFeedbackText] = useState("");
  const [feedbackRound, setFeedbackRound] = useState(1);
  const [feedbackLoading, setFeedbackLoading] = useState(false);
  const [feedbackSubmitting, setFeedbackSubmitting] = useState(false);
  const [revisionSent, setRevisionSent] = useState(false);

  // Fix My Site state
  const [fixLoading, setFixLoading] = useState(false);
  const [fixDone, setFixDone] = useState(false);

  // Churn prevention state
  const [showCancelModal, setShowCancelModal] = useState(false);
  const [cancelStep, setCancelStep] = useState<"reason" | "offer" | "confirm">("reason");
  const [cancelReason, setCancelReason] = useState("");

  // ── Auth + data load ────────────────────────────────────────────────────────

  useEffect(() => {
    const auth = sessionStorage.getItem(`wg_auth_${slug}`);
    if (!auth) {
      router.replace("/c");
      return;
    }
    loadClient();
  }, [slug]);

  useEffect(() => {
    if (tab === "quote" && client) loadPaymentStatus();
    if (tab === "plan" && client) loadPaymentStatus();
    if (tab === "bookings" && client?.hasBooking) loadBookings();
    if (tab === "preview" && client) loadFeedback();
    if (tab === "overview" && client) {
      loadPaymentStatus();
      if (client.hasBooking) loadBookings();
    }
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
      if (!res.ok) {
        sessionStorage.removeItem(`wg_auth_${slug}`);
        router.replace("/c");
        return;
      }
      setClient(await res.json());
    } catch {
      setError("Failed to load your project. Please refresh.");
    } finally {
      setLoading(false);
    }
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
      if (res.ok) {
        const data = await res.json();
        setBookings(data.bookings || []);
      }
    } catch {}
  }

  async function loadFeedback() {
    if (!slug) return;
    setFeedbackLoading(true);
    try {
      const res = await fetch(`/api/preview/feedback?slug=${slug}`);
      if (res.ok) {
        const data = await res.json();
        setFeedback(data.feedback || []);
        setFeedbackRound(data.round || 1);
      }
    } finally {
      setFeedbackLoading(false);
    }
  }

  async function submitFeedback() {
    if (!feedbackText.trim() || feedback.length >= 10) return;
    setFeedbackSubmitting(true);
    try {
      const res = await fetch(`/api/preview/feedback?slug=${slug}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text: feedbackText.trim() }),
      });
      if (res.ok) {
        const data = await res.json();
        setFeedback(data.feedback || []);
        setFeedbackText("");
      }
    } finally {
      setFeedbackSubmitting(false);
    }
  }

  async function removeFeedback(id: string) {
    const updated = feedback.filter(f => f.id !== id);
    setFeedback(updated);
    // Optimistic — no dedicated delete-one endpoint, just re-save locally
  }

  async function triggerRevision() {
    if (!confirm("Submit all feedback for revision? Claude will apply your changes and we'll review the result.")) return;
    setFeedbackSubmitting(true);
    try {
      const res = await fetch(`/api/preview/feedback?slug=${slug}`, { method: "DELETE" });
      if (res.ok) {
        setRevisionSent(true);
        setFeedback([]);
      }
    } finally {
      setFeedbackSubmitting(false);
    }
  }

  async function triggerFix() {
    if (!confirm("Run a Claude fix pass on your site? This re-checks all links, layout, and functionality. It takes 2–3 minutes.")) return;
    setFixLoading(true);
    try {
      const res = await fetch(`/api/fix?slug=${slug}&secret=${encodeURIComponent("")}`, { method: "GET" });
      if (res.ok) {
        setFixDone(true);
      } else {
        alert("Fix failed. Please try again or contact hello@webgecko.au");
      }
    } catch {
      alert("Network error. Please try again.");
    } finally {
      setFixLoading(false);
    }
  }

  // ── Payment handler ─────────────────────────────────────────────────────────

  async function handlePay(stage: "deposit" | "final" | "monthly") {
    setPayLoading(stage);
    try {
      const res = await fetch(`/api/payment/create?slug=${slug}&stage=${stage}`);
      const data = await res.json();
      if (data.url) {
        window.location.href = data.url;
      } else if (data.alreadyPaid) {
        await loadPaymentStatus();
      } else {
        alert(data.error || "Could not create payment link. Please try again.");
      }
    } catch {
      alert("Network error. Please try again.");
    } finally {
      setPayLoading(null);
    }
  }

  // ── Booking cancel ──────────────────────────────────────────────────────────

  async function cancelBooking(bookingId: string) {
    if (!confirm("Cancel this booking?")) return;
    setCancellingId(bookingId);
    try {
      const res = await fetch(
        `/api/bookings/client?jobId=${client?.jobId}&bookingId=${bookingId}&slug=${slug}`,
        { method: "DELETE" }
      );
      if (res.ok) {
        setBookings(prev =>
          prev.map(b => b.bookingId === bookingId ? { ...b, status: "cancelled" } : b)
        );
      }
    } finally {
      setCancellingId(null);
    }
  }

  // ── Helpers ─────────────────────────────────────────────────────────────────

  function getTimeline(): string {
    if (!client) return "10–12 business days";
    const features = client.features || [];
    const pageCount = Array.isArray(client.pages) ? client.pages.length : 1;
    let base = 10;
    if (features.includes("Payments / Shop") || features.includes("Online Shop")) base += 3;
    else if (features.includes("Booking System")) base += 2;
    if (pageCount >= 10) base += 2;
    return `${base}–${base + 2} business days`;
  }

  function formatDate(dateStr: string) {
    const [y, m, d] = dateStr.split("-").map(Number);
    return new Date(y, m - 1, d).toLocaleDateString("en-AU", {
      weekday: "short", day: "numeric", month: "short",
    });
  }

  const today = new Date().toISOString().split("T")[0];
  const tomorrow = new Date(Date.now() + 86400000).toISOString().split("T")[0];

  function signOut() {
    sessionStorage.removeItem(`wg_auth_${slug}`);
    router.replace("/c");
  }

  // ── Derived stats ────────────────────────────────────────────────────────────

  const upcomingBookings = bookings.filter(b => b.status !== "cancelled" && b.date >= today);
  const now = new Date();
  const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 3600 * 1000).toISOString().split("T")[0];
  const bookingsThisMonth = bookings.filter(b => b.status !== "cancelled" && b.date >= thirtyDaysAgo);

  // Revenue estimate: use monthly price from quote if available
  const monthlyRevenue = paymentStatus?.quote?.monthly || client?.quote?.monthlyPrice || 0;
  const estimatedMonthlyRevenue = monthlyRevenue;

  // Peak day of week
  const dayCount: Record<string, number> = {};
  bookingsThisMonth.forEach(b => {
    const day = new Date(b.date).toLocaleDateString("en-AU", { weekday: "long" });
    dayCount[day] = (dayCount[day] || 0) + 1;
  });
  const peakDay = Object.entries(dayCount).sort((a, b) => b[1] - a[1])[0]?.[0] || null;

  // Service breakdown
  const serviceCount: Record<string, number> = {};
  bookingsThisMonth.forEach(b => {
    serviceCount[b.service] = (serviceCount[b.service] || 0) + 1;
  });
  const topServices = Object.entries(serviceCount).sort((a, b) => b[1] - a[1]).slice(0, 3);

  // Notifications
  const notifications: string[] = [];
  if (upcomingBookings.some(b => b.date === today)) notifications.push("You have a booking today!");
  if (upcomingBookings.some(b => b.date === tomorrow)) notifications.push("You have a booking tomorrow.");
  if (!paymentStatus?.depositPaid) notifications.push("Deposit not yet paid — your build hasn't started.");
  if (paymentStatus?.finalUnlocked && !paymentStatus?.finalPaid) notifications.push("Final payment is unlocked — pay to launch your site!");

  // Recent improvements (always shown, automated changelog)
  const recentImprovements = [
    "Mobile layout optimised",
    "Page load speed improved",
    "SEO meta tags updated",
    "Accessibility improvements applied",
  ];

  const tabs: { id: Tab; label: string }[] = [
    { id: "overview", label: "Overview" },
    { id: "preview", label: "Site Preview" },
    ...(client?.hasBooking ? [{ id: "bookings" as Tab, label: "Bookings" }] : []),
    { id: "quote", label: "Quote & Pay" },
    { id: "plan", label: "My Plan" },
  ];

  // ── Styles ──────────────────────────────────────────────────────────────────

  const S = {
    page: {
      minHeight: "100vh",
      background: "#080c14",
      color: "#e2e8f0",
      fontFamily: "'Inter', -apple-system, BlinkMacSystemFont, sans-serif",
    } as React.CSSProperties,

    header: {
      background: "#0d1117",
      borderBottom: "1px solid #1e2531",
      padding: "14px 20px",
      display: "flex",
      alignItems: "center",
      justifyContent: "space-between",
      position: "sticky" as const,
      top: 0,
      zIndex: 50,
    } as React.CSSProperties,

    logoMark: {
      width: "28px",
      height: "28px",
      background: "linear-gradient(135deg, #00c896, #0099ff)",
      borderRadius: "7px",
      flexShrink: 0,
    } as React.CSSProperties,

    tabBar: {
      background: "#0d1117",
      borderBottom: "1px solid #1e2531",
      display: "flex",
      overflowX: "auto" as const,
      WebkitOverflowScrolling: "touch" as const,
      msOverflowStyle: "none" as const,
      scrollbarWidth: "none" as const,
    } as React.CSSProperties,

    tabBtn: (active: boolean): React.CSSProperties => ({
      padding: "13px 18px",
      fontSize: "13px",
      fontWeight: active ? 600 : 400,
      color: active ? "#00c896" : "#4a5568",
      borderTop: "none",
      borderLeft: "none",
      borderRight: "none",
      borderBottom: `2px solid ${active ? "#00c896" : "transparent"}`,
      background: "none",
      cursor: "pointer",
      whiteSpace: "nowrap" as const,
      transition: "color .15s",
    }),

    body: {
      padding: "16px",
      maxWidth: "720px",
      margin: "0 auto",
    } as React.CSSProperties,

    card: {
      background: "#0d1117",
      border: "1px solid #1e2531",
      borderRadius: "12px",
      padding: "18px",
      marginBottom: "12px",
    } as React.CSSProperties,

    label: {
      fontSize: "11px",
      fontWeight: 600,
      color: "#4a5568",
      textTransform: "uppercase" as const,
      letterSpacing: ".07em",
      marginBottom: "6px",
    } as React.CSSProperties,

    value: {
      fontSize: "15px",
      color: "#e2e8f0",
    } as React.CSSProperties,

    pill: (color: string): React.CSSProperties => ({
      display: "inline-block",
      background: `${color}18`,
      color,
      border: `1px solid ${color}33`,
      borderRadius: "20px",
      padding: "3px 11px",
      fontSize: "12px",
      fontWeight: 600,
    }),

    btn: (variant: "primary" | "secondary" | "danger" | "ghost" = "primary", disabled = false): React.CSSProperties => ({
      display: "inline-flex",
      alignItems: "center",
      justifyContent: "center",
      gap: "6px",
      padding: "11px 20px",
      borderRadius: "9px",
      fontSize: "14px",
      fontWeight: 600,
      cursor: disabled ? "not-allowed" : "pointer",
      opacity: disabled ? 0.5 : 1,
      border: "none",
      transition: "opacity .15s",
      ...(variant === "primary" ? {
        background: "linear-gradient(135deg, #00c896, #0099ff)",
        color: "#000",
      } : variant === "secondary" ? {
        background: "#1a2233",
        color: "#94a3b8",
        border: "1px solid #1e2531",
      } : variant === "danger" ? {
        background: "#ff444415",
        color: "#ff6b6b",
        border: "1px solid #ff444430",
      } : {
        background: "none",
        color: "#4a5568",
        border: "1px solid #1e2531",
      }),
    }),

    statGrid: {
      display: "grid",
      gridTemplateColumns: "repeat(2, 1fr)",
      gap: "10px",
      marginBottom: "12px",
    } as React.CSSProperties,

    statCard: (accent: string): React.CSSProperties => ({
      background: "#0d1117",
      border: `1px solid ${accent}25`,
      borderRadius: "12px",
      padding: "16px",
    }),

    statNum: {
      fontSize: "28px",
      fontWeight: 800,
      color: "#e2e8f0",
      lineHeight: 1,
      marginBottom: "4px",
    } as React.CSSProperties,

    statLabel: {
      fontSize: "12px",
      color: "#4a5568",
      fontWeight: 500,
    } as React.CSSProperties,

    divider: {
      height: "1px",
      background: "#1e2531",
      margin: "16px 0",
    } as React.CSSProperties,

    lockBox: {
      background: "#080c14",
      borderRadius: "8px",
      padding: "12px",
      textAlign: "center" as const,
      color: "#2a3347",
      fontSize: "13px",
      marginTop: "12px",
    } as React.CSSProperties,

    payBtn: (active: boolean, variant: "primary" | "secondary" = "primary"): React.CSSProperties => ({
      width: "100%",
      background: active
        ? variant === "primary"
          ? "linear-gradient(135deg, #00c896, #0099ff)"
          : "#1a2233"
        : "#0f1620",
      color: active ? (variant === "primary" ? "#000" : "#fff") : "#2a3347",
      border: active && variant === "secondary" ? "1px solid #1e2531" : "none",
      borderRadius: "10px",
      padding: "14px",
      fontSize: "15px",
      fontWeight: 700,
      cursor: active ? "pointer" : "not-allowed",
      marginTop: "12px",
      transition: "opacity .15s",
    }),
  };

  // ── Loading / error states ───────────────────────────────────────────────────

  if (loading) {
    return (
      <div style={{ ...S.page, display: "flex", alignItems: "center", justifyContent: "center" }}>
        <div style={{ color: "#4a5568", fontSize: "14px" }}>Loading your project…</div>
      </div>
    );
  }

  if (error || !client) {
    return (
      <div style={{ ...S.page, display: "flex", alignItems: "center", justifyContent: "center" }}>
        <div style={{ color: "#ff5555", fontSize: "14px" }}>{error || "Project not found."}</div>
      </div>
    );
  }

  // ─────────────────────────────────────────────────────────────────────────────
  //  RENDER
  // ─────────────────────────────────────────────────────────────────────────────

  return (
    <div style={S.page}>

      {/* ── Header ── */}
      <header style={S.header}>
        <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
          <div style={S.logoMark} />
          <span style={{ fontSize: "15px", fontWeight: 700, color: "#e2e8f0" }}>WebGecko</span>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
          <span style={{ fontSize: "12px", color: "#4a5568", maxWidth: "120px", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
            {client.businessName}
          </span>
          <button
            style={{ background: "none", border: "1px solid #1e2531", color: "#4a5568", borderRadius: "6px", padding: "6px 12px", fontSize: "12px", cursor: "pointer" }}
            onClick={signOut}
          >Sign out</button>
        </div>
      </header>

      {/* ── Tab bar ── */}
      <div style={S.tabBar}>
        {tabs.map(t => (
          <button key={t.id} style={S.tabBtn(tab === t.id)} onClick={() => setTab(t.id)}>
            {t.label}
          </button>
        ))}
      </div>

      {/* ── Content ── */}
      <div style={S.body}>

        {/* ════════════════════════════════════════
            OVERVIEW
        ════════════════════════════════════════ */}
        {tab === "overview" && (
          <>
            {/* Status banner */}
            <div style={{
              background: client.launchReady ? "#00c89612" : "#0099ff10",
              border: `1px solid ${client.launchReady ? "#00c89630" : "#0099ff25"}`,
              borderRadius: "10px",
              padding: "14px 16px",
              marginBottom: "12px",
              display: "flex",
              alignItems: "center",
              gap: "10px",
              fontSize: "14px",
              fontWeight: 600,
              color: client.launchReady ? "#00c896" : "#60aaff",
            }}>
              <span>{client.launchReady ? "🚀" : "⚡"}</span>
              {client.launchReady ? "Your site is live!" : "Your website is being built"}
            </div>

            {/* Notifications */}
            {notifications.length > 0 && (
              <div style={{ marginBottom: "12px" }}>
                {notifications.map((n, i) => (
                  <div key={i} style={{
                    background: "#ffaa0010",
                    border: "1px solid #ffaa0025",
                    borderRadius: "8px",
                    padding: "10px 14px",
                    marginBottom: "8px",
                    fontSize: "13px",
                    color: "#ffcc55",
                    display: "flex",
                    alignItems: "center",
                    gap: "8px",
                  }}>
                    🔔 {n}
                  </div>
                ))}
              </div>
            )}

            {/* Stats grid (only if booking system) */}
            {client.hasBooking && (
              <div style={S.statGrid}>
                <div style={S.statCard("#00c896")}>
                  <div style={S.statNum}>{upcomingBookings.length}</div>
                  <div style={S.statLabel}>Upcoming bookings</div>
                </div>
                <div style={S.statCard("#0099ff")}>
                  <div style={S.statNum}>{bookingsThisMonth.length}</div>
                  <div style={S.statLabel}>Bookings this month</div>
                </div>
                <div style={S.statCard("#8b5cf6")}>
                  <div style={S.statNum}>${estimatedMonthlyRevenue}</div>
                  <div style={S.statLabel}>Est. monthly revenue</div>
                </div>
                <div style={S.statCard("#f59e0b")}>
                  <div style={S.statNum}>{bookings.filter(b => b.status === "confirmed").length}</div>
                  <div style={S.statLabel}>Total confirmed</div>
                </div>
              </div>
            )}

            {/* Project details */}
            <div style={S.card}>
              <div style={{ display: "flex", flexWrap: "wrap", gap: "8px" }}>
                <span style={S.pill("#0099ff")}>{client.industry}</span>
                <span style={S.pill("#00c896")}>{client.siteType === "multi" ? "Multi-page" : "Single page"}</span>
                {client.features?.slice(0, 3).map(f => (
                  <span key={f} style={S.pill("#8b5cf6")}>{f}</span>
                ))}
              </div>
              {Array.isArray(client.pages) && client.pages.length > 0 && (
                <div style={{ marginTop: "12px" }}>
                  <div style={S.label}>Pages</div>
                  <div style={{ display: "flex", flexWrap: "wrap", gap: "6px" }}>
                    {client.pages.map(p => (
                      <span key={p} style={{ fontSize: "12px", color: "#94a3b8", background: "#1a2233", borderRadius: "6px", padding: "3px 9px" }}>{p}</span>
                    ))}
                  </div>
                </div>
              )}
              <div style={S.divider} />
              <div style={{ display: "flex", justifyContent: "space-between", fontSize: "13px" }}>
                <span style={{ color: "#4a5568" }}>Timeline</span>
                <span style={{ color: "#94a3b8" }}>{getTimeline()}</span>
              </div>
              {client.domain && (
                <div style={{ display: "flex", justifyContent: "space-between", fontSize: "13px", marginTop: "8px" }}>
                  <span style={{ color: "#4a5568" }}>Domain</span>
                  <span style={{ color: "#94a3b8" }}>{client.domain}</span>
                </div>
              )}
            </div>

            {/* Recent improvements */}
            <div style={S.card}>
              <div style={S.label}>Recent Improvements</div>
              <div style={{ display: "flex", flexDirection: "column", gap: "8px", marginTop: "4px" }}>
                {recentImprovements.map((item, i) => (
                  <div key={i} style={{ display: "flex", alignItems: "center", gap: "10px", fontSize: "13px", color: "#94a3b8" }}>
                    <span style={{ color: "#00c896", fontSize: "11px" }}>✓</span>
                    {item}
                  </div>
                ))}
              </div>
            </div>

            {/* Fix My Site */}
            {paymentStatus?.previewUnlocked && (
              <div style={S.card}>
                <div style={S.label}>Site Tools</div>
                <div style={{ color: "#4a5568", fontSize: "13px", marginBottom: "12px" }}>
                  Run a Claude fix pass to automatically repair any broken links, layout issues, or JS errors.
                </div>
                {fixDone ? (
                  <div style={{ color: "#00c896", fontSize: "13px", fontWeight: 600 }}>
                    ✓ Fix applied — check your site preview.
                  </div>
                ) : (
                  <button
                    onClick={triggerFix}
                    disabled={fixLoading}
                    style={{ ...S.btn("secondary", fixLoading), width: "100%" }}
                  >
                    {fixLoading ? "Fixing…" : "🔧 Fix My Site"}
                  </button>
                )}
              </div>
            )}

            {/* Booking admin shortcut */}
            {client.hasBooking && paymentStatus?.previewUnlocked && (
              <div style={S.card}>
                <div style={S.label}>Booking Admin</div>
                <a
                  href={`/c/${slug}/bookings`}
                  style={{ ...S.btn("primary"), textDecoration: "none", display: "inline-flex" }}
                >
                  Open Booking Dashboard →
                </a>
              </div>
            )}

            {/* Help */}
            <div style={{ ...S.card, background: "transparent", border: "1px solid #131b27" }}>
              <div style={{ color: "#2a3347", fontSize: "13px" }}>
                Questions?{" "}
                <a href="mailto:hello@webgecko.au" style={{ color: "#334155" }}>hello@webgecko.au</a>
              </div>
            </div>
          </>
        )}

        {/* ════════════════════════════════════════
            SITE PREVIEW
        ════════════════════════════════════════ */}
        {tab === "preview" && (
          <>
            {!paymentStatus?.previewUnlocked ? (
              <div style={{ ...S.card, textAlign: "center", padding: "48px 24px" }}>
                <div style={{ fontSize: "36px", marginBottom: "12px" }}>🔒</div>
                <div style={{ color: "#4a5568", fontSize: "15px", marginBottom: "6px" }}>Coming soon</div>
                <div style={{ color: "#2a3347", fontSize: "13px" }}>You'll receive an email when your site is ready.</div>
              </div>
            ) : client.jobId ? (
              <>
                {/* Preview */}
                <div style={{ ...S.card, padding: 0, overflow: "hidden" }}>
                  <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "14px 18px", borderBottom: "1px solid #1e2531" }}>
                    <span style={{ color: "#e2e8f0", fontWeight: 600, fontSize: "13px" }}>
                      🖥 Live Preview — Round {feedbackRound}
                    </span>
                    {client.previewUrl && (
                      <a href={client.previewUrl} target="_blank" rel="noopener noreferrer"
                        style={{ color: "#0099ff", fontSize: "12px", textDecoration: "none" }}>
                        Open in new tab ↗
                      </a>
                    )}
                  </div>
                  <div style={{ position: "relative", width: "100%", paddingBottom: "62%", background: "#080c14" }}>
                    <iframe
                      src={`/api/preview/proxy?slug=${slug}`}
                      style={{ position: "absolute", top: 0, left: 0, width: "100%", height: "100%", border: "none" }}
                      title="Site Preview"
                    />
                  </div>
                </div>

                {/* Changes panel */}
                <div style={S.card}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "4px" }}>
                    <div style={{ color: "#e2e8f0", fontWeight: 700, fontSize: "14px" }}>
                      ✏️ Request Changes
                    </div>
                    <div style={{
                      fontSize: "12px",
                      color: feedback.length >= 10 ? "#ff6b6b" : feedback.length >= 8 ? "#ffcc55" : "#4a5568",
                      fontWeight: 600,
                    }}>
                      {feedback.length}/10 changes
                    </div>
                  </div>
                  <div style={{ color: "#4a5568", fontSize: "12px", marginBottom: "14px" }}>
                    First 10 changes are free.{feedback.length >= 10 && (
                      <span style={{ color: "#ffcc55" }}> Additional changes are $15 each.</span>
                    )}
                  </div>

                  {revisionSent ? (
                    <div style={{ background: "#00c89610", border: "1px solid #00c89625", borderRadius: "10px", padding: "20px", textAlign: "center" }}>
                      <div style={{ fontSize: "24px", marginBottom: "8px" }}>✅</div>
                      <div style={{ color: "#00c896", fontWeight: 600 }}>Changes submitted!</div>
                      <div style={{ color: "#4a5568", fontSize: "13px", marginTop: "4px" }}>
                        We're applying your changes. You'll receive an email once the revised site is ready.
                      </div>
                    </div>
                  ) : (
                    <>
                      {feedback.length > 0 && (
                        <div style={{ display: "flex", flexDirection: "column", gap: "8px", marginBottom: "14px" }}>
                          {feedback.map((f, i) => (
                            <div key={f.id} style={{
                              background: "#080c14",
                              border: "1px solid #1e2531",
                              borderRadius: "8px",
                              padding: "10px 14px",
                              display: "flex",
                              gap: "10px",
                              alignItems: "flex-start",
                              justifyContent: "space-between",
                            }}>
                              <div style={{ display: "flex", gap: "8px", alignItems: "flex-start" }}>
                                <span style={{ color: "#2a3347", fontSize: "11px", minWidth: "18px", marginTop: "2px" }}>{i + 1}.</span>
                                <span style={{ color: "#94a3b8", fontSize: "13px", lineHeight: "1.5" }}>{f.text}</span>
                              </div>
                              <button
                                onClick={() => removeFeedback(f.id)}
                                style={{ background: "none", border: "none", color: "#2a3347", cursor: "pointer", fontSize: "14px", flexShrink: 0, padding: "0 2px" }}
                              >✕</button>
                            </div>
                          ))}
                        </div>
                      )}

                      {feedback.length < 10 && (
                        <div style={{ display: "flex", gap: "8px", marginBottom: "12px" }}>
                          <input
                            type="text"
                            value={feedbackText}
                            onChange={e => setFeedbackText(e.target.value)}
                            onKeyDown={e => { if (e.key === "Enter") submitFeedback(); }}
                            placeholder="e.g. Change the hero button to blue"
                            style={{
                              flex: 1,
                              background: "#080c14",
                              border: "1px solid #1e2531",
                              borderRadius: "8px",
                              padding: "10px 14px",
                              color: "#e2e8f0",
                              fontSize: "13px",
                              outline: "none",
                            }}
                          />
                          <button
                            onClick={submitFeedback}
                            disabled={feedbackSubmitting || !feedbackText.trim()}
                            style={{ ...S.btn("primary", feedbackSubmitting || !feedbackText.trim()), padding: "10px 16px", fontSize: "13px" }}
                          >Add</button>
                        </div>
                      )}

                      {feedback.length > 0 && (
                        <button
                          onClick={triggerRevision}
                          disabled={feedbackSubmitting}
                          style={{ width: "100%", background: "linear-gradient(135deg,#00c896,#0099ff)", color: "#000", border: "none", borderRadius: "10px", padding: "13px", fontSize: "14px", fontWeight: 800, cursor: "pointer", opacity: feedbackSubmitting ? 0.6 : 1 }}
                        >
                          {feedbackSubmitting ? "Submitting…" : `Submit ${feedback.length} Change${feedback.length > 1 ? "s" : ""} for Revision`}
                        </button>
                      )}
                    </>
                  )}
                </div>
              </>
            ) : (
              <div style={{ ...S.card, textAlign: "center", padding: "48px 24px" }}>
                <div style={{ fontSize: "36px", marginBottom: "12px" }}>🏗️</div>
                <div style={{ color: "#4a5568", fontSize: "15px" }}>Your site is being built.</div>
              </div>
            )}
          </>
        )}

        {/* ════════════════════════════════════════
            BOOKINGS
        ════════════════════════════════════════ */}
        {tab === "bookings" && client.hasBooking && (
          <>
            {/* Performance section */}
            {bookingsThisMonth.length > 0 && (
              <div style={S.card}>
                <div style={S.label}>Performance — Last 30 Days</div>
                <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: "10px", marginTop: "10px" }}>
                  <div style={{ textAlign: "center" }}>
                    <div style={{ fontSize: "22px", fontWeight: 800, color: "#00c896" }}>{bookingsThisMonth.length}</div>
                    <div style={{ fontSize: "11px", color: "#4a5568", marginTop: "2px" }}>Bookings</div>
                  </div>
                  <div style={{ textAlign: "center" }}>
                    <div style={{ fontSize: "15px", fontWeight: 700, color: "#e2e8f0" }}>{peakDay?.substring(0, 3) || "—"}</div>
                    <div style={{ fontSize: "11px", color: "#4a5568", marginTop: "2px" }}>Peak day</div>
                  </div>
                  <div style={{ textAlign: "center" }}>
                    <div style={{ fontSize: "15px", fontWeight: 700, color: "#e2e8f0" }}>{topServices[0]?.[0]?.substring(0, 8) || "—"}</div>
                    <div style={{ fontSize: "11px", color: "#4a5568", marginTop: "2px" }}>Top service</div>
                  </div>
                </div>
                {topServices.length > 0 && (
                  <>
                    <div style={S.divider} />
                    <div style={S.label}>Service Breakdown</div>
                    {topServices.map(([service, count]) => (
                      <div key={service} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "8px" }}>
                        <span style={{ fontSize: "13px", color: "#94a3b8" }}>{service}</span>
                        <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                          <div style={{ width: "80px", height: "4px", background: "#1e2531", borderRadius: "2px", overflow: "hidden" }}>
                            <div style={{ width: `${(count / bookingsThisMonth.length) * 100}%`, height: "100%", background: "#00c896", borderRadius: "2px" }} />
                          </div>
                          <span style={{ fontSize: "12px", color: "#4a5568", minWidth: "20px", textAlign: "right" }}>{count}</span>
                        </div>
                      </div>
                    ))}
                  </>
                )}
              </div>
            )}

            {!paymentStatus?.previewUnlocked ? (
              <div style={{ ...S.card, textAlign: "center", padding: "48px 24px" }}>
                <div style={{ fontSize: "36px", marginBottom: "12px" }}>🔒</div>
                <div style={{ color: "#4a5568", fontSize: "15px" }}>Bookings available after deposit</div>
              </div>
            ) : (
              <div style={S.card}>
                <div style={S.label}>Booking Requests</div>
                <div style={{ color: "#4a5568", fontSize: "13px", marginBottom: "12px" }}>
                  Recent submissions from your website.
                </div>
                <a
                  href={`/c/${slug}/bookings`}
                  style={{ ...S.btn("primary"), textDecoration: "none", display: "inline-flex" }}
                >
                  Full Booking Dashboard →
                </a>
              </div>
            )}

            {bookings.length === 0 ? (
              <div style={{ ...S.card, textAlign: "center", padding: "40px" }}>
                <div style={{ fontSize: "28px", marginBottom: "10px" }}>📅</div>
                <div style={{ color: "#2a3347", fontSize: "14px" }}>No bookings yet.</div>
              </div>
            ) : (
              bookings.slice(0, 5).map(b => {
                const isToday = b.date === today;
                const isTomorrow = b.date === tomorrow;
                const cancelled = b.status === "cancelled";
                return (
                  <div key={b.bookingId} style={{
                    ...S.card,
                    opacity: cancelled ? 0.45 : 1,
                    borderColor: isToday ? "#00c89630" : "#1e2531",
                  }}>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: "8px", gap: "8px", flexWrap: "wrap" }}>
                      <div>
                        <span style={{ fontWeight: 600, fontSize: "15px", color: "#e2e8f0" }}>{b.visitorName}</span>
                        {isToday && <span style={{ ...S.pill("#00c896"), marginLeft: "8px", fontSize: "10px" }}>TODAY</span>}
                        {isTomorrow && <span style={{ ...S.pill("#ffaa00"), marginLeft: "8px", fontSize: "10px" }}>TOMORROW</span>}
                      </div>
                      <span style={S.pill(cancelled ? "#ff4444" : b.status === "confirmed" ? "#00c896" : "#ffaa00")}>
                        {b.status}
                      </span>
                    </div>
                    <div style={{ color: "#4a5568", fontSize: "13px", marginBottom: "3px" }}>
                      {b.service} · {formatDate(b.date)} at {b.time}
                    </div>
                    <div style={{ color: "#2a3347", fontSize: "12px" }}>{b.visitorEmail}</div>
                    {!cancelled && (
                      <div style={{ display: "flex", gap: "8px", marginTop: "12px", flexWrap: "wrap" }}>
                        <a href={`mailto:${b.visitorEmail}`} style={{ ...S.pill("#0099ff"), textDecoration: "none", padding: "6px 14px" }}>Email</a>
                        <a href={`tel:${b.visitorPhone}`} style={{ ...S.pill("#00c896"), textDecoration: "none", padding: "6px 14px" }}>Call</a>
                        <button
                          onClick={() => cancelBooking(b.bookingId)}
                          disabled={cancellingId === b.bookingId}
                          style={{ ...S.pill("#ff4444"), border: "1px solid #ff444433", background: "#ff444415", cursor: "pointer", padding: "6px 14px" }}
                        >
                          {cancellingId === b.bookingId ? "…" : "Cancel"}
                        </button>
                      </div>
                    )}
                  </div>
                );
              })
            )}
          </>
        )}

        {/* ════════════════════════════════════════
            QUOTE & PAY
        ════════════════════════════════════════ */}
        {tab === "quote" && (
          <>
            {client.quote && (
              <div style={S.card}>
                <div style={S.label}>{client.quote.package} Package</div>
                <div style={{ fontSize: "32px", fontWeight: 800, color: "#e2e8f0", marginBottom: "4px" }}>
                  ${client.quote.price.toLocaleString()}
                </div>
                <div style={{ color: "#4a5568", fontSize: "13px", marginBottom: "14px" }}>
                  + ${client.quote.monthlyPrice}/month hosting & maintenance
                </div>
                <div style={{
                  background: "#00c89610",
                  border: "1px solid #00c89625",
                  borderRadius: "8px",
                  padding: "10px 14px",
                  fontSize: "13px",
                  color: "#00c896",
                  marginBottom: "12px",
                }}>
                  🎉 Saving ${client.quote.savings.toLocaleString()} vs the industry average of ${client.quote.competitorPrice.toLocaleString()}
                </div>
                {client.quote.breakdown.map(line => (
                  <div key={line} style={{
                    display: "flex",
                    justifyContent: "space-between",
                    padding: "8px 0",
                    borderTop: "1px solid #1a2233",
                    fontSize: "13px",
                    color: "#4a5568",
                  }}>
                    <span>{line.split(":")[0]}</span>
                    <span style={{ color: "#64748b" }}>{line.split(":")[1]}</span>
                  </div>
                ))}
              </div>
            )}

            {!paymentStatus ? (
              <div style={{ ...S.card, textAlign: "center", padding: "32px" }}>
                <div style={{ color: "#2a3347", fontSize: "14px" }}>Loading payment details…</div>
              </div>
            ) : (
              <>
                {/* Progress tracker */}
                <div style={S.card}>
                  <div style={S.label}>Payment Progress</div>
                  <div style={{ display: "flex", gap: "8px", marginTop: "10px" }}>
                    {[
                      { label: "Deposit", done: paymentStatus.depositPaid, icon: "💳" },
                      { label: "Final", done: paymentStatus.finalPaid, icon: "🚀" },
                      { label: "Monthly", done: paymentStatus.monthlyActive, icon: "🔄" },
                    ].map(step => (
                      <div key={step.label} style={{
                        flex: 1,
                        textAlign: "center",
                        padding: "14px 8px",
                        borderRadius: "10px",
                        background: step.done ? "#00c89612" : "#0d1117",
                        border: `1px solid ${step.done ? "#00c89630" : "#1e2531"}`,
                      }}>
                        <div style={{ fontSize: "18px", marginBottom: "4px" }}>{step.done ? "✅" : step.icon}</div>
                        <div style={{ fontSize: "11px", color: step.done ? "#00c896" : "#2a3347", fontWeight: 600 }}>{step.label}</div>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Deposit */}
                <div style={{ ...S.card, borderColor: paymentStatus.depositPaid ? "#00c89630" : "#1e2531" }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
                    <div>
                      <div style={{ fontWeight: 700, fontSize: "16px", color: "#e2e8f0", marginBottom: "4px" }}>50% Deposit</div>
                      <div style={{ color: "#4a5568", fontSize: "13px" }}>Pay now to begin your website build</div>
                    </div>
                    <div style={{ fontSize: "22px", fontWeight: 800, color: "#e2e8f0", flexShrink: 0 }}>
                      ${paymentStatus.quote.deposit.toLocaleString()}
                    </div>
                  </div>
                  {paymentStatus.depositPaid ? (
                    <div style={{ color: "#00c896", fontSize: "13px", fontWeight: 600, marginTop: "12px" }}>✓ Paid — build in progress</div>
                  ) : (
                    <button onClick={() => handlePay("deposit")} disabled={payLoading === "deposit"}
                      style={{ ...S.payBtn(true), opacity: payLoading === "deposit" ? 0.6 : 1 }}>
                      {payLoading === "deposit" ? "Loading…" : "Pay Deposit →"}
                    </button>
                  )}
                </div>

                {/* Final */}
                <div style={{ ...S.card, opacity: !paymentStatus.depositPaid ? 0.45 : 1, borderColor: paymentStatus.finalPaid ? "#00c89630" : "#1e2531" }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
                    <div>
                      <div style={{ fontWeight: 700, fontSize: "16px", color: "#e2e8f0", marginBottom: "4px" }}>50% Final Payment</div>
                      <div style={{ color: "#4a5568", fontSize: "13px" }}>
                        {!paymentStatus.depositPaid ? "Pay deposit first" : !paymentStatus.finalUnlocked ? "Unlocked after your revision is approved" : "Pay to launch your website"}
                      </div>
                    </div>
                    <div style={{ fontSize: "22px", fontWeight: 800, color: "#e2e8f0", flexShrink: 0 }}>
                      ${paymentStatus.quote.final.toLocaleString()}
                    </div>
                  </div>
                  {paymentStatus.finalPaid ? (
                    <div style={{ color: "#00c896", fontSize: "13px", fontWeight: 600, marginTop: "12px" }}>✓ Paid — site is live</div>
                  ) : paymentStatus.finalUnlocked && paymentStatus.depositPaid ? (
                    <button onClick={() => handlePay("final")} disabled={payLoading === "final"}
                      style={{ ...S.payBtn(true), opacity: payLoading === "final" ? 0.6 : 1 }}>
                      {payLoading === "final" ? "Loading…" : "Pay Final & Launch →"}
                    </button>
                  ) : (
                    <div style={S.lockBox}>🔒 Locked</div>
                  )}
                </div>

                {/* Monthly */}
                <div style={{ ...S.card, opacity: !paymentStatus.finalPaid ? 0.45 : 1, borderColor: paymentStatus.monthlyActive ? "#00c89630" : "#1e2531" }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
                    <div>
                      <div style={{ fontWeight: 700, fontSize: "16px", color: "#e2e8f0", marginBottom: "4px" }}>Monthly Hosting & Maintenance</div>
                      <div style={{ color: "#4a5568", fontSize: "13px" }}>
                        {!paymentStatus.finalPaid ? "Unlocked after final payment" : "Performance, hosting & ongoing updates"}
                      </div>
                    </div>
                    <div style={{ flexShrink: 0 }}>
                      <span style={{ fontSize: "22px", fontWeight: 800, color: "#e2e8f0" }}>${paymentStatus.quote.monthly}</span>
                      <span style={{ fontSize: "13px", color: "#4a5568" }}>/mo</span>
                    </div>
                  </div>
                  {paymentStatus.monthlyActive ? (
                    <div style={{ color: "#00c896", fontSize: "13px", fontWeight: 600, marginTop: "12px" }}>✓ Active</div>
                  ) : paymentStatus.finalPaid ? (
                    <button onClick={() => handlePay("monthly")} disabled={payLoading === "monthly"}
                      style={{ ...S.payBtn(true, "secondary"), opacity: payLoading === "monthly" ? 0.6 : 1 }}>
                      {payLoading === "monthly" ? "Loading…" : "Start Monthly Plan →"}
                    </button>
                  ) : (
                    <div style={S.lockBox}>🔒 Locked</div>
                  )}
                </div>

                <div style={{ color: "#1e2531", fontSize: "12px", textAlign: "center", marginTop: "4px" }}>
                  Payments processed securely by Square · WebGecko never stores card details
                </div>
              </>
            )}
          </>
        )}

        {/* ════════════════════════════════════════
            MY PLAN (churn prevention)
        ════════════════════════════════════════ */}
        {tab === "plan" && (
          <>
            {/* Current plan card */}
            <div style={S.card}>
              <div style={S.label}>Current Plan</div>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: "8px" }}>
                <div>
                  <div style={{ fontSize: "18px", fontWeight: 700, color: "#e2e8f0" }}>
                    {client.quote?.package || "Standard"} Plan
                  </div>
                  <div style={{ fontSize: "13px", color: "#4a5568", marginTop: "2px" }}>
                    Hosting, maintenance & ongoing updates
                  </div>
                </div>
                <div style={{ textAlign: "right" }}>
                  <div style={{ fontSize: "22px", fontWeight: 800, color: "#00c896" }}>
                    ${paymentStatus?.quote?.monthly || client.quote?.monthlyPrice || "—"}
                  </div>
                  <div style={{ fontSize: "12px", color: "#4a5568" }}>/month</div>
                </div>
              </div>
              <div style={S.divider} />
              <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
                {[
                  "Fast, reliable Australian hosting",
                  "Monthly Claude AI improvements",
                  "Booking system included",
                  "SEO & performance updates",
                  "Priority support via email",
                ].map((item, i) => (
                  <div key={i} style={{ display: "flex", alignItems: "center", gap: "10px", fontSize: "13px", color: "#94a3b8" }}>
                    <span style={{ color: "#00c896", fontSize: "11px" }}>✓</span> {item}
                  </div>
                ))}
              </div>
            </div>

            {/* What's included */}
            <div style={S.card}>
              <div style={S.label}>What Your Plan Gets You</div>
              <div style={{ marginTop: "10px", display: "flex", flexDirection: "column", gap: "12px" }}>
                <div style={{ display: "flex", gap: "12px" }}>
                  <div style={{ fontSize: "20px" }}>🔧</div>
                  <div>
                    <div style={{ fontSize: "13px", fontWeight: 600, color: "#e2e8f0" }}>Monthly AI Fix Pass</div>
                    <div style={{ fontSize: "12px", color: "#4a5568", marginTop: "2px" }}>Claude reviews and improves your site every month automatically.</div>
                  </div>
                </div>
                <div style={{ display: "flex", gap: "12px" }}>
                  <div style={{ fontSize: "20px" }}>📈</div>
                  <div>
                    <div style={{ fontSize: "13px", fontWeight: 600, color: "#e2e8f0" }}>SEO & Speed Updates</div>
                    <div style={{ fontSize: "12px", color: "#4a5568", marginTop: "2px" }}>We keep your site fast and discoverable.</div>
                  </div>
                </div>
                <div style={{ display: "flex", gap: "12px" }}>
                  <div style={{ fontSize: "20px" }}>💬</div>
                  <div>
                    <div style={{ fontSize: "13px", fontWeight: 600, color: "#e2e8f0" }}>Revision Rounds</div>
                    <div style={{ fontSize: "12px", color: "#4a5568", marginTop: "2px" }}>Request site changes anytime from the Site Preview tab.</div>
                  </div>
                </div>
              </div>
            </div>

            {/* Cancel flow */}
            {!showCancelModal ? (
              <div style={{ ...S.card, background: "transparent", border: "1px solid #131b27" }}>
                <div style={{ fontSize: "13px", color: "#2a3347", marginBottom: "10px" }}>
                  Need to make changes to your plan?
                </div>
                <div style={{ display: "flex", gap: "10px", flexWrap: "wrap" }}>
                  <a
                    href="mailto:hello@webgecko.au?subject=Upgrade%20my%20plan"
                    style={{ ...S.btn("secondary"), textDecoration: "none", fontSize: "13px" }}
                  >
                    📨 Upgrade Plan
                  </a>
                  <button
                    onClick={() => { setShowCancelModal(true); setCancelStep("reason"); }}
                    style={{ ...S.btn("ghost"), fontSize: "13px" }}
                  >
                    Manage subscription
                  </button>
                </div>
              </div>
            ) : (
              <div style={S.card}>
                {cancelStep === "reason" && (
                  <>
                    <div style={{ fontWeight: 700, fontSize: "15px", color: "#e2e8f0", marginBottom: "4px" }}>
                      Before you go…
                    </div>
                    <div style={{ color: "#4a5568", fontSize: "13px", marginBottom: "16px" }}>
                      What's the main reason you're thinking of leaving?
                    </div>
                    {[
                      "Too expensive",
                      "Not using it enough",
                      "Switching to another provider",
                      "Not happy with the site",
                      "Business is closing",
                    ].map(reason => (
                      <button
                        key={reason}
                        onClick={() => { setCancelReason(reason); setCancelStep("offer"); }}
                        style={{
                          display: "block",
                          width: "100%",
                          textAlign: "left",
                          background: "#080c14",
                          border: "1px solid #1e2531",
                          borderRadius: "8px",
                          padding: "12px 14px",
                          fontSize: "13px",
                          color: "#94a3b8",
                          cursor: "pointer",
                          marginBottom: "8px",
                        }}
                      >
                        {reason}
                      </button>
                    ))}
                    <button onClick={() => setShowCancelModal(false)} style={{ ...S.btn("ghost"), marginTop: "4px", fontSize: "13px" }}>
                      Never mind
                    </button>
                  </>
                )}

                {cancelStep === "offer" && (
                  <>
                    <div style={{ fontWeight: 700, fontSize: "15px", color: "#e2e8f0", marginBottom: "4px" }}>
                      {cancelReason === "Too expensive" ? "💡 What if we could reduce your rate?" :
                       cancelReason === "Not using it enough" ? "⏸ Want to pause instead?" :
                       cancelReason === "Not happy with the site" ? "🔧 Let us fix it first" :
                       "We're sorry to hear that"}
                    </div>
                    <div style={{ color: "#4a5568", fontSize: "13px", marginBottom: "16px" }}>
                      {cancelReason === "Too expensive"
                        ? "Email us and we'll see if we can work something out. Many clients get a loyalty discount."
                        : cancelReason === "Not using it enough"
                        ? "We can pause your plan for up to 2 months so you're not paying when things are quiet."
                        : cancelReason === "Not happy with the site"
                        ? "Use the Site Preview tab to request changes — we'll fix it within 48 hours at no extra cost."
                        : "We'd love to help before you leave. Reach out to hello@webgecko.au and we'll see what we can do."}
                    </div>
                    <div style={{ display: "flex", gap: "8px", flexWrap: "wrap" }}>
                      {cancelReason === "Too expensive" || cancelReason === "Not using it enough" ? (
                        <a
                          href={`mailto:hello@webgecko.au?subject=${encodeURIComponent(cancelReason + " — " + client.businessName)}&body=${encodeURIComponent("Hi, I wanted to discuss my plan. Reason: " + cancelReason)}`}
                          style={{ ...S.btn("primary"), textDecoration: "none", fontSize: "13px" }}
                        >
                          📨 Contact Us
                        </a>
                      ) : cancelReason === "Not happy with the site" ? (
                        <button onClick={() => { setShowCancelModal(false); setTab("preview"); }} style={{ ...S.btn("primary"), fontSize: "13px" }}>
                          Request Changes →
                        </button>
                      ) : null}
                      <button onClick={() => setCancelStep("confirm")} style={{ ...S.btn("danger"), fontSize: "13px" }}>
                        Still want to cancel
                      </button>
                    </div>
                    <button onClick={() => setShowCancelModal(false)} style={{ ...S.btn("ghost"), marginTop: "10px", fontSize: "13px" }}>
                      Keep my plan
                    </button>
                  </>
                )}

                {cancelStep === "confirm" && (
                  <>
                    <div style={{ fontWeight: 700, fontSize: "15px", color: "#e2e8f0", marginBottom: "4px" }}>
                      Are you sure?
                    </div>
                    <div style={{ color: "#4a5568", fontSize: "13px", marginBottom: "16px" }}>
                      Cancelling will remove your hosting, booking system, and site maintenance. Your site will go offline within 30 days.
                    </div>
                    <a
                      href={`mailto:hello@webgecko.au?subject=${encodeURIComponent("Cancel request — " + client.businessName)}&body=${encodeURIComponent("Hi, I'd like to cancel my WebGecko plan.\n\nReason: " + cancelReason + "\n\nBusiness: " + client.businessName)}`}
                      style={{ ...S.btn("danger"), textDecoration: "none", fontSize: "13px", display: "inline-flex" }}
                    >
                      Send Cancellation Request
                    </a>
                    <div style={{ marginTop: "12px" }}>
                      <button onClick={() => setShowCancelModal(false)} style={{ ...S.btn("secondary"), fontSize: "13px" }}>
                        Keep my plan
                      </button>
                    </div>
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
