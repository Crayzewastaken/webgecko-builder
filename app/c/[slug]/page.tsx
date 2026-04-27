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
  quote: {
    total: number;
    monthly: number;
    deposit: number;
    final: number;
  };
}

type Tab = "overview" | "preview" | "bookings" | "quote";

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

  // Payment state
  const [paymentStatus, setPaymentStatus] = useState<PaymentStatus | null>(null);
  const [payLoading, setPayLoading] = useState<string | null>(null);

  // Booking state
  const [cancellingId, setCancellingId] = useState<string | null>(null);

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
    if (tab === "bookings" && client?.hasBooking) loadBookings();
  }, [tab, client]);

  // Check ?payment=done redirect from Square
  useEffect(() => {
    if (typeof window === "undefined") return;
    const params = new URLSearchParams(window.location.search);
    if (params.get("payment") === "done") {
      setTab("quote");
      window.history.replaceState({}, "", window.location.pathname);
      // Poll briefly for webhook to land
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
      const data = await res.json();
      setClient(data);
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
    let days = "10–12";
    const extras: string[] = [];
    if (features.includes("Booking System")) extras.push("+2 days for booking system");
    if (features.includes("Payments / Shop") || features.includes("Online Shop")) extras.push("+3 days for shop/payments");
    if (pageCount >= 10) extras.push("+2 days for 10+ pages");
    return extras.length ? `${days} business days (${extras.join(", ")})` : `${days} business days`;
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

  const tabs: { id: Tab; label: string }[] = [
    { id: "overview", label: "Overview" },
    { id: "preview", label: "Site Preview" },
    ...(client?.hasBooking ? [{ id: "bookings" as Tab, label: "Bookings" }] : []),
    { id: "quote", label: "Quote & Pay" },
  ];

  // ── Styles ──────────────────────────────────────────────────────────────────

  const c = {
    page: {
      minHeight: "100vh",
      background: "#0a0a0a",
      color: "#fff",
      fontFamily: "'Inter', -apple-system, BlinkMacSystemFont, sans-serif",
    } as React.CSSProperties,

    header: {
      background: "#111",
      borderBottom: "1px solid #1f1f1f",
      padding: "14px 20px",
      display: "flex",
      alignItems: "center",
      justifyContent: "space-between",
      position: "sticky" as const,
      top: 0,
      zIndex: 50,
    } as React.CSSProperties,

    logo: {
      display: "flex",
      alignItems: "center",
      gap: "10px",
    } as React.CSSProperties,

    logoMark: {
      width: "28px",
      height: "28px",
      background: "linear-gradient(135deg, #00c896, #0099ff)",
      borderRadius: "7px",
      flexShrink: 0,
    } as React.CSSProperties,

    logoText: {
      fontSize: "15px",
      fontWeight: 700,
      color: "#fff",
    } as React.CSSProperties,

    signOutBtn: {
      background: "none",
      border: "1px solid #252525",
      color: "#666",
      borderRadius: "6px",
      padding: "6px 14px",
      fontSize: "13px",
      cursor: "pointer",
      transition: "border-color .15s, color .15s",
    } as React.CSSProperties,

    tabBar: {
      background: "#111",
      borderBottom: "1px solid #1f1f1f",
      display: "flex",
      overflowX: "auto" as const,
      WebkitOverflowScrolling: "touch" as const,
      msOverflowStyle: "none" as const,
      scrollbarWidth: "none" as const,
    } as React.CSSProperties,

    tabBtn: (active: boolean): React.CSSProperties => ({
      padding: "13px 18px",
      fontSize: "14px",
      fontWeight: active ? 600 : 400,
      color: active ? "#00c896" : "#555",
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
      padding: "20px 16px",
      maxWidth: "680px",
      margin: "0 auto",
    } as React.CSSProperties,

    card: {
      background: "#111",
      border: "1px solid #1f1f1f",
      borderRadius: "12px",
      padding: "18px",
      marginBottom: "14px",
    } as React.CSSProperties,

    cardLabel: {
      fontSize: "11px",
      fontWeight: 600,
      color: "#444",
      textTransform: "uppercase" as const,
      letterSpacing: ".07em",
      marginBottom: "6px",
    } as React.CSSProperties,

    cardValue: {
      fontSize: "15px",
      color: "#e0e0e0",
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

    statusBanner: {
      display: "flex",
      alignItems: "center",
      gap: "10px",
      background: "#00c89612",
      border: "1px solid #00c89630",
      borderRadius: "10px",
      padding: "14px 16px",
      marginBottom: "16px",
      fontSize: "14px",
      color: "#00c896",
      fontWeight: 600,
    } as React.CSSProperties,

    payBtn: (active: boolean, variant: "primary" | "secondary" = "primary"): React.CSSProperties => ({
      width: "100%",
      background: active
        ? variant === "primary"
          ? "linear-gradient(135deg, #00c896, #0099ff)"
          : "#1a1a1a"
        : "#151515",
      color: active ? (variant === "primary" ? "#000" : "#fff") : "#333",
      border: active && variant === "secondary" ? "1px solid #2a2a2a" : "none",
      borderRadius: "10px",
      padding: "14px",
      fontSize: "15px",
      fontWeight: 700,
      cursor: active ? "pointer" : "not-allowed",
      marginTop: "12px",
      transition: "opacity .15s",
    }),

    lockBox: {
      background: "#0d0d0d",
      borderRadius: "8px",
      padding: "12px",
      textAlign: "center" as const,
      color: "#333",
      fontSize: "13px",
      marginTop: "12px",
    } as React.CSSProperties,
  };

  // ── Loading / error states ───────────────────────────────────────────────────

  if (loading) {
    return (
      <div style={{ ...c.page, display: "flex", alignItems: "center", justifyContent: "center" }}>
        <div style={{ color: "#444", fontSize: "14px" }}>Loading your project…</div>
      </div>
    );
  }

  if (error || !client) {
    return (
      <div style={{ ...c.page, display: "flex", alignItems: "center", justifyContent: "center" }}>
        <div style={{ color: "#ff5555", fontSize: "14px" }}>{error || "Project not found."}</div>
      </div>
    );
  }

  // ── Render ───────────────────────────────────────────────────────────────────

  return (
    <div style={c.page}>

      {/* ── Header ── */}
      <header style={c.header}>
        <div style={c.logo}>
          <div style={c.logoMark} />
          <span style={c.logoText}>WebGecko</span>
        </div>
        <button style={c.signOutBtn} onClick={signOut}>Sign out</button>
      </header>

      {/* ── Tab bar ── */}
      <div style={c.tabBar}>
        {tabs.map(t => (
          <button key={t.id} style={c.tabBtn(tab === t.id)} onClick={() => setTab(t.id)}>
            {t.label}
          </button>
        ))}
      </div>

      {/* ── Tab content ── */}
      <div style={c.body}>

        {/* ════════════════════════════════════════
            OVERVIEW
        ════════════════════════════════════════ */}
        {tab === "overview" && (
          <>
            <div style={c.statusBanner}>
              <span>⚡</span>
              {client.launchReady ? "Your site is ready to launch!" : "Your website is being built"}
            </div>

            <div style={c.card}>
              <div style={c.cardLabel}>Business</div>
              <div style={c.cardValue}>{client.businessName}</div>
            </div>

            <div style={c.card}>
              <div style={c.cardLabel}>Industry</div>
              <div style={c.cardValue}>{client.industry}</div>
            </div>

            <div style={c.card}>
              <div style={c.cardLabel}>Site Type</div>
              <div style={c.cardValue}>
                {client.siteType === "multi" ? "Multi-page" : "Single page"}
              </div>
            </div>

            {Array.isArray(client.pages) && client.pages.length > 0 && (
              <div style={c.card}>
                <div style={c.cardLabel}>Pages</div>
                <div style={{ display: "flex", flexWrap: "wrap", gap: "6px", marginTop: "4px" }}>
                  {client.pages.map(p => (
                    <span key={p} style={c.pill("#0099ff")}>{p}</span>
                  ))}
                </div>
              </div>
            )}

            {client.features?.length > 0 && (
              <div style={c.card}>
                <div style={c.cardLabel}>Features</div>
                <div style={{ display: "flex", flexWrap: "wrap", gap: "6px", marginTop: "4px" }}>
                  {client.features.map(f => (
                    <span key={f} style={c.pill("#00c896")}>{f}</span>
                  ))}
                </div>
              </div>
            )}

            <div style={c.card}>
              <div style={c.cardLabel}>Estimated Timeline</div>
              <div style={c.cardValue}>{getTimeline()}</div>
            </div>

            {client.domain && (
              <div style={c.card}>
                <div style={c.cardLabel}>Preferred Domain</div>
                <div style={c.cardValue}>{client.domain}</div>
              </div>
            )}

            {client.hasBooking && (
              <div style={c.card}>
                <div style={c.cardLabel}>Booking Admin</div>
                <div style={{ color: "#555", fontSize: "13px", marginBottom: "12px" }}>
                  View and manage customer booking requests.
                </div>
                <a
                  href={`/c/${slug}/bookings`}
                  style={{
                    display: "inline-block",
                    background: "linear-gradient(135deg, #00c896, #0099ff)",
                    color: "#000",
                    borderRadius: "8px",
                    padding: "10px 20px",
                    fontSize: "14px",
                    fontWeight: 700,
                    textDecoration: "none",
                  }}
                >
                  Open Booking Dashboard →
                </a>
              </div>
            )}

            <div style={{ ...c.card, background: "transparent", border: "1px solid #1a1a1a" }}>
              <div style={{ color: "#444", fontSize: "13px" }}>
                Questions? Email{" "}
                <a href="mailto:hello@webgecko.au" style={{ color: "#555" }}>
                  hello@webgecko.au
                </a>
              </div>
            </div>
          </>
        )}

        {/* ════════════════════════════════════════
            SITE PREVIEW
        ════════════════════════════════════════ */}
        {tab === "preview" && (
          <div style={c.card}>
            {client.previewUrl ? (
              <>
                <div style={c.cardLabel}>Live Preview</div>
                <div style={{
                  position: "relative",
                  width: "100%",
                  paddingBottom: "60%",
                  background: "#0d0d0d",
                  borderRadius: "8px",
                  overflow: "hidden",
                  marginTop: "10px",
                }}>
                  <iframe
                    src={client.previewUrl}
                    style={{
                      position: "absolute",
                      top: 0, left: 0,
                      width: "100%", height: "100%",
                      border: "none",
                    }}
                    title="Site Preview"
                  />
                </div>
                <a
                  href={client.previewUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  style={{
                    display: "inline-block",
                    marginTop: "12px",
                    color: "#0099ff",
                    fontSize: "13px",
                    textDecoration: "none",
                  }}
                >
                  Open in new tab ↗
                </a>
              </>
            ) : (
              <div style={{ textAlign: "center", padding: "48px 0" }}>
                <div style={{ fontSize: "36px", marginBottom: "12px" }}>🏗️</div>
                <div style={{ color: "#888", fontSize: "15px", marginBottom: "6px" }}>
                  Your prototype is being built.
                </div>
                <div style={{ color: "#444", fontSize: "13px" }}>
                  You'll receive an email once it's ready to review.
                </div>
              </div>
            )}
          </div>
        )}

        {/* ════════════════════════════════════════
            BOOKINGS
        ════════════════════════════════════════ */}
        {tab === "bookings" && client.hasBooking && (
          <>
            <div style={c.card}>
              <div style={c.cardLabel}>Booking Requests</div>
              <div style={{ color: "#555", fontSize: "13px", marginBottom: "12px" }}>
                Recent submissions from your website.
              </div>
              <a
                href={`/c/${slug}/bookings`}
                style={{
                  display: "inline-block",
                  background: "linear-gradient(135deg, #00c896, #0099ff)",
                  color: "#000",
                  borderRadius: "8px",
                  padding: "10px 20px",
                  fontSize: "14px",
                  fontWeight: 700,
                  textDecoration: "none",
                }}
              >
                Full Booking Dashboard →
              </a>
            </div>

            {bookings.length === 0 ? (
              <div style={{ ...c.card, textAlign: "center", padding: "48px" }}>
                <div style={{ fontSize: "28px", marginBottom: "10px" }}>📅</div>
                <div style={{ color: "#555" }}>No bookings yet.</div>
              </div>
            ) : (
              bookings.slice(0, 5).map(b => {
                const isToday = b.date === today;
                const isTomorrow = b.date === tomorrow;
                const cancelled = b.status === "cancelled";
                return (
                  <div key={b.bookingId} style={{
                    ...c.card,
                    opacity: cancelled ? 0.45 : 1,
                    borderColor: isToday ? "#00c89630" : "#1f1f1f",
                  }}>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: "8px", gap: "8px", flexWrap: "wrap" }}>
                      <div>
                        <span style={{ fontWeight: 600, fontSize: "15px" }}>{b.visitorName}</span>
                        {isToday && <span style={{ ...c.pill("#00c896"), marginLeft: "8px", fontSize: "10px" }}>TODAY</span>}
                        {isTomorrow && <span style={{ ...c.pill("#ffaa00"), marginLeft: "8px", fontSize: "10px" }}>TOMORROW</span>}
                      </div>
                      <span style={c.pill(cancelled ? "#ff4444" : b.status === "confirmed" ? "#00c896" : "#ffaa00")}>
                        {b.status}
                      </span>
                    </div>
                    <div style={{ color: "#666", fontSize: "13px", marginBottom: "3px" }}>
                      {b.service} · {formatDate(b.date)} at {b.time}
                    </div>
                    <div style={{ color: "#555", fontSize: "12px" }}>{b.visitorEmail}</div>
                    {!cancelled && (
                      <div style={{ display: "flex", gap: "8px", marginTop: "12px" }}>
                        <a href={`mailto:${b.visitorEmail}`} style={{ ...c.pill("#0099ff"), textDecoration: "none", padding: "6px 14px" }}>Email</a>
                        <a href={`tel:${b.visitorPhone}`} style={{ ...c.pill("#00c896"), textDecoration: "none", padding: "6px 14px" }}>Call</a>
                        <button
                          onClick={() => cancelBooking(b.bookingId)}
                          disabled={cancellingId === b.bookingId}
                          style={{ ...c.pill("#ff4444"), border: "1px solid #ff444433", background: "#ff444415", cursor: "pointer", padding: "6px 14px" }}
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
            {/* Quote breakdown */}
            {client.quote && (
              <div style={c.card}>
                <div style={c.cardLabel}>{client.quote.package} Package</div>
                <div style={{ fontSize: "32px", fontWeight: 800, marginBottom: "4px" }}>
                  ${client.quote.price.toLocaleString()}
                </div>
                <div style={{ color: "#555", fontSize: "13px", marginBottom: "16px" }}>
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
                    borderTop: "1px solid #1a1a1a",
                    fontSize: "13px",
                    color: "#555",
                  }}>
                    <span>{line.split(":")[0]}</span>
                    <span style={{ color: "#888" }}>{line.split(":")[1]}</span>
                  </div>
                ))}
              </div>
            )}

            {/* Payment flow */}
            {!paymentStatus ? (
              <div style={{ ...c.card, textAlign: "center", padding: "32px" }}>
                <div style={{ color: "#444", fontSize: "14px" }}>Loading payment details…</div>
              </div>
            ) : (
              <>
                {/* Progress */}
                <div style={c.card}>
                  <div style={c.cardLabel}>Payment Progress</div>
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
                        background: step.done ? "#00c89612" : "#0d0d0d",
                        border: `1px solid ${step.done ? "#00c89630" : "#1a1a1a"}`,
                      }}>
                        <div style={{ fontSize: "20px", marginBottom: "4px" }}>
                          {step.done ? "✅" : step.icon}
                        </div>
                        <div style={{ fontSize: "11px", color: step.done ? "#00c896" : "#444", fontWeight: 600 }}>
                          {step.label}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                {/* ── Stage 1: Deposit ── */}
                <div style={{
                  ...c.card,
                  borderColor: paymentStatus.depositPaid ? "#00c89630" : "#1f1f1f",
                }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
                    <div>
                      <div style={{ fontWeight: 700, fontSize: "16px", marginBottom: "4px" }}>
                        50% Deposit
                      </div>
                      <div style={{ color: "#555", fontSize: "13px" }}>
                        Pay now to begin your website build
                      </div>
                    </div>
                    <div style={{ fontSize: "22px", fontWeight: 800, flexShrink: 0 }}>
                      ${paymentStatus.quote.deposit.toLocaleString()}
                    </div>
                  </div>

                  {paymentStatus.depositPaid ? (
                    <div style={{ color: "#00c896", fontSize: "13px", fontWeight: 600, marginTop: "12px" }}>
                      ✓ Paid — build in progress
                    </div>
                  ) : (
                    <button
                      onClick={() => handlePay("deposit")}
                      disabled={payLoading === "deposit"}
                      style={{
                        ...c.payBtn(true),
                        opacity: payLoading === "deposit" ? 0.6 : 1,
                      }}
                    >
                      {payLoading === "deposit" ? "Loading…" : "Pay Deposit →"}
                    </button>
                  )}
                </div>

                {/* ── Stage 2: Final Payment ── */}
                <div style={{
                  ...c.card,
                  opacity: !paymentStatus.depositPaid ? 0.45 : 1,
                  borderColor: paymentStatus.finalPaid ? "#00c89630" : "#1f1f1f",
                }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
                    <div>
                      <div style={{ fontWeight: 700, fontSize: "16px", marginBottom: "4px" }}>
                        50% Final Payment
                      </div>
                      <div style={{ color: "#555", fontSize: "13px" }}>
                        {!paymentStatus.depositPaid
                          ? "Pay deposit first"
                          : !paymentStatus.finalUnlocked
                          ? "Unlocked after your final revision is approved"
                          : "Pay to launch your website"}
                      </div>
                    </div>
                    <div style={{ fontSize: "22px", fontWeight: 800, flexShrink: 0 }}>
                      ${paymentStatus.quote.final.toLocaleString()}
                    </div>
                  </div>

                  {paymentStatus.finalPaid ? (
                    <div style={{ color: "#00c896", fontSize: "13px", fontWeight: 600, marginTop: "12px" }}>
                      ✓ Paid — site is live
                    </div>
                  ) : paymentStatus.finalUnlocked && paymentStatus.depositPaid ? (
                    <button
                      onClick={() => handlePay("final")}
                      disabled={payLoading === "final"}
                      style={{
                        ...c.payBtn(true),
                        opacity: payLoading === "final" ? 0.6 : 1,
                      }}
                    >
                      {payLoading === "final" ? "Loading…" : "Pay Final & Launch →"}
                    </button>
                  ) : (
                    <div style={c.lockBox}>🔒 Locked</div>
                  )}
                </div>

                {/* ── Stage 3: Monthly ── */}
                <div style={{
                  ...c.card,
                  opacity: !paymentStatus.finalPaid ? 0.45 : 1,
                  borderColor: paymentStatus.monthlyActive ? "#00c89630" : "#1f1f1f",
                }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
                    <div>
                      <div style={{ fontWeight: 700, fontSize: "16px", marginBottom: "4px" }}>
                        Monthly Hosting & Maintenance
                      </div>
                      <div style={{ color: "#555", fontSize: "13px" }}>
                        {!paymentStatus.finalPaid
                          ? "Unlocked after final payment"
                          : "Performance, hosting & ongoing updates"}
                      </div>
                    </div>
                    <div style={{ flexShrink: 0 }}>
                      <span style={{ fontSize: "22px", fontWeight: 800 }}>
                        ${paymentStatus.quote.monthly}
                      </span>
                      <span style={{ fontSize: "13px", color: "#555" }}>/mo</span>
                    </div>
                  </div>

                  {paymentStatus.monthlyActive ? (
                    <div style={{ color: "#00c896", fontSize: "13px", fontWeight: 600, marginTop: "12px" }}>
                      ✓ Active
                    </div>
                  ) : paymentStatus.finalPaid ? (
                    <button
                      onClick={() => handlePay("monthly")}
                      disabled={payLoading === "monthly"}
                      style={{
                        ...c.payBtn(true, "secondary"),
                        opacity: payLoading === "monthly" ? 0.6 : 1,
                      }}
                    >
                      {payLoading === "monthly" ? "Loading…" : "Start Monthly Plan →"}
                    </button>
                  ) : (
                    <div style={c.lockBox}>🔒 Locked</div>
                  )}
                </div>

                <div style={{ color: "#2a2a2a", fontSize: "12px", textAlign: "center", marginTop: "4px" }}>
                  Payments processed securely by Square · WebGecko never stores card details
                </div>
              </>
            )}
          </>
        )}

      </div>
    </div>
  );
}