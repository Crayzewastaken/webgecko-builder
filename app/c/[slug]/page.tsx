"use client";

import { useState, useEffect } from "react";
import { useRouter, useParams } from "next/navigation";

// ─── Theme tokens — light (default) + dark ────────────────────────────────────
const LIGHT = {
  bg:         "#f4f7fb",
  surface:    "#ffffff",
  raised:     "#eef2f8",
  border:     "rgba(0,0,0,0.07)",
  borderHov:  "rgba(0,0,0,0.16)",
  text:       "#0f172a",
  textSec:    "#475569",
  textMuted:  "#94a3b8",
  accent:     "#059669",
  accentBg:   "#f0fdf4",
  accentBlue: "#2563eb",
  amber:      "#d97706",
  amberBg:    "#fffbeb",
  red:        "#dc2626",
  redBg:      "#fef2f2",
  purple:     "#7c3aed",
  navBg:      "#ffffff",
  navBorder:  "rgba(0,0,0,0.07)",
  shadow:     "0 1px 4px rgba(0,0,0,0.07)",
  shadowMd:   "0 6px 20px rgba(0,0,0,0.1)",
};

const DARK = {
  bg:         "#070d1a",
  surface:    "#0c1526",
  raised:     "#111f36",
  border:     "rgba(255,255,255,0.07)",
  borderHov:  "rgba(255,255,255,0.17)",
  text:       "#eef2f8",
  textSec:    "#8695aa",
  textMuted:  "#4a5a70",
  accent:     "#00d4a0",
  accentBg:   "rgba(0,212,160,0.08)",
  accentBlue: "#4a9eff",
  amber:      "#ff9f24",
  amberBg:    "rgba(255,159,36,0.08)",
  red:        "#f43f5e",
  redBg:      "rgba(244,63,94,0.08)",
  purple:     "#8347ff",
  navBg:      "#090e1c",
  navBorder:  "rgba(255,255,255,0.07)",
  shadow:     "0 4px 24px rgba(0,0,0,0.7), inset 0 1px 0 rgba(255,255,255,0.03)",
  shadowMd:   "0 12px 40px rgba(0,0,0,0.85)",
};

// C is set dynamically inside the component via useTheme(); module-level fallback for sub-components
let C = LIGHT;

// ─── Types ────────────────────────────────────────────────────────────────────

interface ClientMetadata {
  name?: string;
  abn?: string;
  ga4Id?: string;
  goal?: string;
  targetAudience?: string;
  siteType?: string;
  pages?: string[];
  features?: string[];
  supersaasId?: string | number;
  supersaasUrl?: string;
  style?: string;
  colorPrefs?: string;
  references?: string;
  additionalNotes?: string;
  pricingMethod?: string;
  pricingDetails?: string;
  businessAddress?: string;
  facebookPage?: string;
  hasBooking?: boolean;
  quote?: {
    package: string;
    price: number;
    monthlyPrice: number;
    monthlyOngoing?: number;
    savings: number;
    competitorPrice: number;
    breakdown: string[];
  };
}

interface ClientData {
  // Raw DB fields
  business_name?: string;
  job_id?: string;
  preview_url?: string;
  has_booking?: boolean;
  launch_ready?: boolean;
  metadata?: ClientMetadata;
  // Normalised fields (set by normalizeClient)
  businessName: string;
  jobId: string;
  email: string;
  phone?: string;
  industry: string;
  domain?: string;
  previewUrl?: string;
  hasBooking?: boolean;
  launchReady?: boolean;
  // SuperSaas — enriched from jobs table by client-login GET
  supersaasId?: string | number | null;
  supersaasUrl?: string | null;
  // Square OAuth
  squareConnected?: boolean;
  squareMerchantId?: string | null;
  // Manual payment link fallback
  shopPaymentUrl?: string | null;
  name?: string;
  abn?: string;
  ga4Id?: string;
  goal?: string;
  targetAudience?: string;
  siteType?: string;
  pages?: string | string[];
  features?: string[];
  style?: string;
  colorPrefs?: string;
  references?: string;
  additionalNotes?: string;
  pricingMethod?: string;
  pricingDetails?: string;
  businessAddress?: string;
  facebookPage?: string;
  quote?: {
    package: string;
    price: number;
    monthlyPrice: number;
    monthlyOngoing?: number;
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

type Tab = "overview" | "preview" | "bookings" | "content" | "quote" | "plan" | "upgrade" | "contact" | "social" | "settings";

// ─── Shared helpers ───────────────────────────────────────────────────────────
function formatDate(dateStr: string) {
  const [y, m, d] = dateStr.split("-").map(Number);
  return new Date(y, m - 1, d).toLocaleDateString("en-AU", { weekday: "short", day: "numeric", month: "short" });
}

// ─── Subscription management cancel options ───────────────────────────────────
// Research basis:
// - "Offboard with transfer" (full help migrating, domain transfer, HTML export, final review): ~50% of original build price — mirrors what agencies charge for exit packages
// - "HTML file only" (raw exported file, no support): ~20% of build price — covers our time to package/clean/export
// - "Cancel everything" (just stops billing, no assets): free, but 30-day notice

const CANCEL_OPTIONS = [
  {
    id: "transfer",
    label: "Full handover package",
    desc: "We transfer your domain, export a clean standalone HTML file, do a final fix pass, and guide you through setting up with your new provider. You leave with everything ready to hand over.",
    priceLabel: (buildPrice: number) => `$${Math.round(buildPrice * 0.5).toLocaleString()} one-off handover fee`,
    priceCalc: (buildPrice: number) => Math.round(buildPrice * 0.5),
    icon: "📦",
  },
  {
    id: "html",
    label: "HTML export only",
    desc: "We send you a clean, standalone HTML file of your site. No domain transfer or support — you handle the rest with your new provider.",
    priceLabel: (buildPrice: number) => `$${Math.round(buildPrice * 0.2).toLocaleString()} export fee`,
    priceCalc: (buildPrice: number) => Math.round(buildPrice * 0.2),
    icon: "📄",
  },
  {
    id: "remove",
    label: "Remove from our system — no assets",
    desc: "We remove you from our dashboards at no charge. Your site goes offline within 30 days and you take nothing with you. Free, no questions asked.",
    priceLabel: () => "Free — 30 days notice",
    priceCalc: () => 0,
    icon: "🗑️",
  },
];

// ─── Social media offboarding options ─────────────────────────────────────────
const SOCIAL_CANCEL_OPTIONS = [
  {
    id: "social_handover",
    label: "Full social account handover",
    desc: "We transfer the Gmail address, reset all platform passwords, and email you a signed confirmation with screenshots of sign-out from each platform. You own everything.",
    priceLabel: () => "$299 one-off handover fee",
    priceCalc: () => 299,
    icon: "📱",
  },
  {
    id: "social_remove",
    label: "Remove management — no handover",
    desc: "We stop posting and managing your accounts. The Gmail and social profiles remain under our management and go dormant. No charge.",
    priceLabel: () => "Free",
    priceCalc: () => 0,
    icon: "🗑️",
  },
];

// ─── Editable Change Item ────────────────────────────────────────────────────

function EditableChange({ index, item, onUpdate, onDelete }: {
  index: number;
  item: { id: string; text: string; createdAt: string };
  onUpdate: (text: string) => void;
  onDelete: () => void;
}) {
  const [editing, setEditing] = useState(false);
  const [val, setVal] = useState(item.text);

  function save() {
    if (val.trim()) onUpdate(val.trim());
    setEditing(false);
  }

  return (
    <div style={{
      background: C.raised, border: `1px solid ${C.border}`, borderRadius: 8,
      padding: "9px 12px", display: "flex", gap: 8, alignItems: "flex-start",
    }}>
      <span style={{ color: C.textMuted, fontSize: 11, minWidth: 18, marginTop: editing ? 10 : 2, fontWeight: 600 }}>{index + 1}.</span>
      {editing ? (
        <div style={{ flex: 1, display: "flex", gap: 6, alignItems: "flex-start", flexWrap: "wrap" }}>
          <input
            autoFocus value={val} onChange={e => setVal(e.target.value)}
            onKeyDown={e => { if (e.key === "Enter") save(); if (e.key === "Escape") { setVal(item.text); setEditing(false); } }}
            style={{ flex: 1, minWidth: 160, background: C.bg, border: "1px solid #2563eb60", borderRadius: 6, padding: "6px 10px", color: C.text, fontSize: 13, outline: "none" }}
          />
          <button onClick={save} style={{ background: C.accentBlue, color: "#fff", border: "none", borderRadius: 6, padding: "6px 12px", fontSize: 12, fontWeight: 600, cursor: "pointer" }}>Save</button>
          <button onClick={() => { setVal(item.text); setEditing(false); }} style={{ background: C.border, color: C.textMuted, border: "none", borderRadius: 6, padding: "6px 10px", fontSize: 12, cursor: "pointer" }}>Cancel</button>
        </div>
      ) : (
        <span style={{ flex: 1, color: C.textSec, fontSize: 13, lineHeight: 1.5, marginTop: 1 }}>{item.text}</span>
      )}
      <div style={{ display: "flex", gap: 4, flexShrink: 0 }}>
        {!editing && (
          <button onClick={() => setEditing(true)} style={{ background: "none", border: "none", color: C.textMuted, cursor: "pointer", fontSize: 13, padding: "2px 4px" }} title="Edit">✎</button>
        )}
        <button onClick={onDelete} style={{ background: "none", border: "none", color: C.textMuted, cursor: "pointer", fontSize: 14, padding: "2px 4px" }} title="Remove">✕</button>
      </div>
    </div>
  );
}

// ─── Inline Booking Manager ───────────────────────────────────────────────────

function BookingManager({ slug, client, paymentStatus }: { slug: string; client: ClientData; paymentStatus: PaymentStatus | null }) {
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [loading, setLoading] = useState(true);
  const [acting, setActing] = useState<string | null>(null);
  const [bFilter, setBFilter] = useState<"upcoming" | "past" | "all">("upcoming");
  const [bSearch, setBSearch] = useState("");
  const [modal, setModal] = useState<null | "reschedule" | "cancel" | "add">(null);
  const [activeBooking, setActiveBooking] = useState<Booking | null>(null);
  const [modalReason, setModalReason] = useState("");
  const [newDate, setNewDate] = useState("");
  const [newTime, setNewTime] = useState("");
  const [addForm, setAddForm] = useState({ name: "", email: "", phone: "", service: "", date: "", time: "", message: "" });

  const today = new Date().toISOString().split("T")[0];
  const tomorrow = new Date(Date.now() + 86400000).toISOString().split("T")[0];

  useEffect(() => { loadBookings(); }, []);

  const useSuperSaas = !!(client.supersaasId);

  async function loadBookings() {
    if (!client.jobId) return;
    setLoading(true);
    try {
      if (useSuperSaas) {
        const res = await fetch(`/api/bookings/supersaas?slug=${slug}`);
        if (res.ok) {
          const d = await res.json();
          // Map SuperSaas appointment shape to Booking shape
          const mapped = (d.appointments || []).map((a: any) => ({
            bookingId: String(a.id),
            jobId: client.jobId,
            visitorName: a.fullName || a.full_name || "",
            visitorEmail: a.email || "",
            visitorPhone: a.phone || "",
            service: a.description || "Appointment",
            date: (a.start || "").slice(0, 10),
            time: (a.start || "").slice(11, 16),
            message: "",
            status: a.status || "confirmed",
            createdAt: a.createdOn || "",
          }));
          setBookings(mapped);
        }
      } else {
        const res = await fetch(`/api/bookings/client?jobId=${client.jobId}&slug=${slug}`);
        if (res.ok) setBookings((await res.json()).bookings || []);
      }
    } catch {}
    finally { setLoading(false); }
  }

  async function doAction(bookingId: string, action: string, extra?: { reason?: string; newDate?: string; newTime?: string }) {
    setActing(bookingId);
    try {
      if (useSuperSaas) {
        // Build start/finish for reschedule
        let start: string | undefined, finish: string | undefined;
        if (action === "reschedule" && extra?.newDate && extra?.newTime) {
          start = extra.newDate + "T" + extra.newTime + ":00";
          // Default 1-hour slot
          const d = new Date(start);
          d.setHours(d.getHours() + 1);
          finish = d.toISOString().slice(0, 19);
        }
        const active = bookings.find(b => b.bookingId === bookingId);
        const res = await fetch(`/api/bookings/supersaas?slug=${slug}`, {
          method: "POST", headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            appointmentId: bookingId, action,
            start, finish,
            reason: extra?.reason,
            customerEmail: active?.visitorEmail,
            customerName: active?.visitorName,
          }),
        });
        if (res.ok) {
          if (action === "cancel") {
            setBookings(prev => prev.map(b => b.bookingId === bookingId ? { ...b, status: "cancelled" } : b));
          } else if (action === "reschedule" && start) {
            setBookings(prev => prev.map(b => b.bookingId === bookingId ? { ...b, date: start!.slice(0, 10), time: start!.slice(11, 16), status: "confirmed" } : b));
          }
        }
      } else {
        const res = await fetch(`/api/bookings/client?slug=${slug}`, {
          method: "PATCH", headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ jobId: client.jobId, bookingId, action, ...extra }),
        });
        if (res.ok) { const d = await res.json(); setBookings(prev => prev.map(b => b.bookingId === bookingId ? d.booking : b)); }
      }
    } finally { setActing(null); setModal(null); setActiveBooking(null); setModalReason(""); setNewDate(""); setNewTime(""); }
  }

  async function addBooking() {
    setActing("add");
    try {
      const res = await fetch(`/api/bookings/client?slug=${slug}`, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ jobId: client.jobId, visitorName: addForm.name, visitorEmail: addForm.email, visitorPhone: addForm.phone, service: addForm.service, date: addForm.date, time: addForm.time, message: addForm.message }),
      });
      if (res.ok) { const d = await res.json(); setBookings(prev => [d.booking, ...prev]); setAddForm({ name: "", email: "", phone: "", service: "", date: "", time: "", message: "" }); setModal(null); }
    } finally { setActing(null); }
  }

  const filtered = bookings
    .filter(b => {
      if (bFilter === "upcoming") return b.date >= today && !["cancelled", "declined"].includes(b.status);
      if (bFilter === "past") return b.date < today || ["cancelled", "declined"].includes(b.status);
      return true;
    })
    .filter(b => !bSearch || [b.visitorName, b.visitorEmail, b.service].join(" ").toLowerCase().includes(bSearch.toLowerCase()))
    .sort((a, b) => a.date > b.date ? 1 : -1);

  const upcoming = bookings.filter(b => b.date >= today && !["cancelled", "declined"].includes(b.status)).length;
  const STATUS_COLOR: Record<string, string> = { confirmed: C.accent, pending: C.amber, declined: C.red, cancelled: "#6b7280", rescheduled: C.accentBlue };
  const pll = (color: string): React.CSSProperties => ({ display: "inline-block", background: `${color}18`, color, border: `1px solid ${color}33`, borderRadius: 20, padding: "2px 10px", fontSize: 11, fontWeight: 600, textTransform: "capitalize" as const });
  const inp: React.CSSProperties = { width: "100%", background: C.surface, border: `1px solid ${C.border}`, borderRadius: 8, padding: "10px 12px", color: C.text, fontSize: 14, boxSizing: "border-box" as const, outline: "none", marginBottom: 10 };
  const abt = (color: string, bg = "transparent"): React.CSSProperties => ({ flex: 1, minWidth: 60, padding: "8px 10px", borderRadius: 8, fontSize: 12, fontWeight: 600, cursor: "pointer", border: `1px solid ${color}44`, color, background: bg });
  const ovl: React.CSSProperties = { position: "fixed", inset: 0, background: "rgba(0,0,0,0.85)", zIndex: 100, display: "flex", alignItems: "center", justifyContent: "center", padding: 20 };
  const mdb: React.CSSProperties = { background: C.surface, border: `1px solid ${C.border}`, borderRadius: 16, padding: 24, width: "100%", maxWidth: 440, maxHeight: "90vh", overflowY: "auto" as const };

  if (!paymentStatus?.previewUnlocked) {
    return (
      <div style={{ background: C.surface, border: `1px solid ${C.border}`, borderRadius: 12, textAlign: "center", padding: "48px 24px" }}>
        <div style={{ fontSize: 36, marginBottom: 12 }}>🔒</div>
        <div style={{ color: C.textMuted, fontSize: 15 }}>Bookings will appear here once your site is released.</div>
      </div>
    );
  }

  return (
    <>
      {/* SuperSaas management banner */}
      {useSuperSaas && client.supersaasUrl && (
        <div style={{ background: C.raised, border: "1px solid rgba(0,200,150,0.2)", borderRadius: 10, padding: "12px 16px", marginBottom: 14, display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, flexWrap: "wrap" as const }}>
          <div>
            <div style={{ color: C.accent, fontSize: 12, fontWeight: 700, textTransform: "uppercase" as const, letterSpacing: "0.06em", marginBottom: 2 }}>📅 Your Booking System</div>
            <div style={{ color: C.textMuted, fontSize: 12 }}>Customers book directly on your website. You can also manage your schedule at SuperSaas.</div>
          </div>
          <a href="https://www.supersaas.com/account/login" target="_blank" rel="noopener noreferrer"
            style={{ background: "#0f2a4a", color: C.accentBlue, border: "1px solid #1e3a5f", borderRadius: 8, padding: "8px 14px", fontSize: 12, fontWeight: 600, textDecoration: "none", whiteSpace: "nowrap" as const, flexShrink: 0 }}>
            Open SuperSaas →
          </a>
        </div>
      )}

      {/* Stats */}
      <div style={{ display: "flex", gap: 10, marginBottom: 16, flexWrap: "wrap" as const }}>
        {[{ label: "Total", value: bookings.length, color: C.text }, { label: "Upcoming", value: upcoming, color: C.accent }, { label: "Past/Cancelled", value: bookings.length - upcoming, color: C.textMuted }].map(st => (
          <div key={st.label} style={{ background: C.surface, border: `1px solid ${C.border}`, borderRadius: 10, padding: "14px 16px", flex: 1, textAlign: "center" as const, minWidth: 80 }}>
            <div style={{ fontSize: 22, fontWeight: 800, color: st.color }}>{st.value}</div>
            <div style={{ fontSize: 11, color: C.textMuted, marginTop: 2 }}>{st.label}</div>
          </div>
        ))}
        {!useSuperSaas && (
          <button onClick={() => setModal("add")} style={{ background: "linear-gradient(135deg,#00c896,#0099ff)", border: "none", color: "#000", borderRadius: 10, padding: "14px 18px", fontSize: 13, fontWeight: 700, cursor: "pointer", whiteSpace: "nowrap" as const }}>+ Add</button>
        )}
      </div>

      {/* Search + filters */}
      <input type="text" placeholder="Search name, email, service…" value={bSearch} onChange={e => setBSearch(e.target.value)}
        style={{ ...inp, marginBottom: 12 }} />
      <div style={{ display: "flex", gap: 8, marginBottom: 16, flexWrap: "wrap" as const }}>
        {(["upcoming", "past", "all"] as const).map(f => (
          <button key={f} onClick={() => setBFilter(f)} style={{ padding: "7px 16px", borderRadius: 20, fontSize: 13, fontWeight: bFilter === f ? 600 : 400, background: bFilter === f ? "linear-gradient(135deg,#00c896,#0099ff)" : "none", border: bFilter === f ? "none" : `1px solid ${C.border}`, color: bFilter === f ? "#000" : C.textMuted, cursor: "pointer" }}>
            {f.charAt(0).toUpperCase() + f.slice(1)}
          </button>
        ))}
        <button onClick={loadBookings} style={{ marginLeft: "auto", background: "none", border: `1px solid ${C.border}`, color: C.textMuted, borderRadius: 8, padding: "7px 12px", fontSize: 12, cursor: "pointer" }}>↻ Refresh</button>
      </div>

      {/* Booking list */}
      {loading ? (
        <div style={{ textAlign: "center", padding: 40, color: C.textMuted }}>Loading bookings…</div>
      ) : filtered.length === 0 ? (
        <div style={{ background: C.surface, border: `1px solid ${C.border}`, borderRadius: 12, textAlign: "center", padding: 40 }}>
          <div style={{ fontSize: 28, marginBottom: 10 }}>📅</div>
          <div style={{ color: C.textMuted, fontSize: 14 }}>{bFilter === "upcoming" ? "No upcoming bookings." : "No bookings found."}</div>
        </div>
      ) : filtered.map(b => {
        const isToday = b.date === today;
        const isTomorrow = b.date === tomorrow;
        const isDone = ["cancelled", "declined"].includes(b.status);
        const sc = STATUS_COLOR[b.status] || "#666";
        return (
          <div key={b.bookingId} style={{ background: C.surface, border: `1px solid ${isToday ? "#00c89630" : C.border}`, borderRadius: 12, padding: 16, marginBottom: 10, opacity: isDone ? 0.5 : 1 }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 8, gap: 8, flexWrap: "wrap" as const }}>
              <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" as const }}>
                <span style={{ fontWeight: 700, fontSize: 15, color: C.text }}>{b.visitorName}</span>
                {isToday && <span style={{ ...pll(C.accent), fontSize: 10 }}>TODAY</span>}
                {isTomorrow && <span style={{ ...pll(C.amber), fontSize: 10 }}>TOMORROW</span>}
              </div>
              <span style={pll(sc)}>{b.status}</span>
            </div>
            <div style={{ color: C.textMuted, fontSize: 13, marginBottom: 4 }}>{b.service} · {formatDate(b.date)} at {b.time}</div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 4, fontSize: 12, color: C.textMuted, marginBottom: 8 }}>
              <div>✉ <a href={`mailto:${b.visitorEmail}`} style={{ color: C.accentBlue }}>{b.visitorEmail}</a></div>
              <div>📞 <a href={`tel:${b.visitorPhone}`} style={{ color: C.textSec }}>{b.visitorPhone}</a></div>
            </div>
            {b.message && <div style={{ background: C.bg, borderRadius: 6, padding: "8px 12px", fontSize: 13, color: C.textMuted, marginBottom: 10 }}>"{b.message}"</div>}
            {!isDone && (
              <div style={{ display: "flex", gap: 8, flexWrap: "wrap" as const, marginTop: 8 }}>
                {b.status !== "confirmed" && (
                  <button style={abt(C.accent)} disabled={acting === b.bookingId} onClick={() => doAction(b.bookingId, "confirm")}>
                    {acting === b.bookingId ? "…" : "✓ Confirm"}
                  </button>
                )}
                <button style={abt(C.accentBlue)} onClick={() => { setActiveBooking(b); setModal("reschedule"); setNewDate(b.date); setNewTime(b.time); }}>↻ Reschedule</button>
                <a href={`mailto:${b.visitorEmail}`} style={{ ...abt(C.textMuted), textDecoration: "none", textAlign: "center" as const }}>✉ Email</a>
                <a href={`tel:${b.visitorPhone}`} style={{ ...abt(C.textMuted), textDecoration: "none", textAlign: "center" as const }}>📞 Call</a>
                <button style={abt(C.red)} onClick={() => { setActiveBooking(b); setModal("cancel"); }}>✕ Cancel</button>
              </div>
            )}
          </div>
        );
      })}

      {/* Reschedule modal */}
      {modal === "reschedule" && activeBooking && (
        <div style={ovl} onClick={() => setModal(null)}>
          <div style={mdb} onClick={e => e.stopPropagation()}>
            <div style={{ fontSize: 16, fontWeight: 700, color: C.text, marginBottom: 16 }}>Reschedule Booking</div>
            <div style={{ color: C.textMuted, fontSize: 13, marginBottom: 16 }}>{activeBooking.visitorName} — {activeBooking.service}</div>
            <label style={{ color: C.textMuted, fontSize: 12, display: "block", marginBottom: 6 }}>New Date</label>
            <input type="date" value={newDate} onChange={e => setNewDate(e.target.value)} style={inp} />
            <label style={{ color: C.textMuted, fontSize: 12, display: "block", marginBottom: 6 }}>New Time</label>
            <input type="time" value={newTime} onChange={e => setNewTime(e.target.value)} style={inp} />
            <div style={{ display: "flex", gap: 10, marginTop: 8 }}>
              <button style={{ ...abt(C.textMuted), flex: "none" as const, padding: "10px 20px" }} onClick={() => setModal(null)}>Cancel</button>
              <button style={{ ...abt(C.accentBlue, "#3b82f618"), flex: 1, padding: 10 }} disabled={!newDate || !newTime || acting === activeBooking.bookingId} onClick={() => doAction(activeBooking.bookingId, "reschedule", { newDate, newTime })}>
                {acting === activeBooking.bookingId ? "Saving…" : "Save"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Cancel modal */}
      {modal === "cancel" && activeBooking && (
        <div style={ovl} onClick={() => setModal(null)}>
          <div style={mdb} onClick={e => e.stopPropagation()}>
            <div style={{ fontSize: 16, fontWeight: 700, color: C.text, marginBottom: 16 }}>Cancel Booking</div>
            <div style={{ color: C.textMuted, fontSize: 13, marginBottom: 16 }}>{activeBooking.visitorName} — {activeBooking.date} at {activeBooking.time}</div>
            <label style={{ color: C.textMuted, fontSize: 12, display: "block", marginBottom: 6 }}>Reason (sent to customer)</label>
            <textarea value={modalReason} onChange={e => setModalReason(e.target.value)} rows={3}
              placeholder="e.g. We are unavailable that day — please rebook." style={{ ...inp, resize: "vertical" as const, height: 80 }} />
            <div style={{ display: "flex", gap: 10, marginTop: 8 }}>
              <button style={{ ...abt(C.textMuted), flex: "none" as const, padding: "10px 20px" }} onClick={() => setModal(null)}>Back</button>
              <button style={{ ...abt(C.red, "#ef444418"), flex: 1, padding: 10 }} disabled={acting === activeBooking.bookingId} onClick={() => doAction(activeBooking.bookingId, "cancel", { reason: modalReason })}>
                {acting === activeBooking.bookingId ? "Cancelling…" : "Confirm Cancel"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Add booking modal */}
      {modal === "add" && (
        <div style={ovl} onClick={() => setModal(null)}>
          <div style={mdb} onClick={e => e.stopPropagation()}>
            <div style={{ fontSize: 16, fontWeight: 700, color: C.text, marginBottom: 16 }}>Add Booking Manually</div>
            {(["name", "email", "phone", "service"] as const).map(field => (
              <input key={field} type="text" placeholder={field.charAt(0).toUpperCase() + field.slice(1)}
                value={addForm[field]} onChange={e => setAddForm(p => ({ ...p, [field]: e.target.value }))} style={inp} />
            ))}
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
              <input type="date" value={addForm.date} onChange={e => setAddForm(p => ({ ...p, date: e.target.value }))} style={{ ...inp, marginBottom: 0 }} />
              <input type="time" value={addForm.time} onChange={e => setAddForm(p => ({ ...p, time: e.target.value }))} style={{ ...inp, marginBottom: 0 }} />
            </div>
            <textarea placeholder="Notes (optional)" value={addForm.message} onChange={e => setAddForm(p => ({ ...p, message: e.target.value }))}
              rows={2} style={{ ...inp, marginTop: 10, resize: "vertical" as const }} />
            <div style={{ display: "flex", gap: 10, marginTop: 8 }}>
              <button style={{ ...abt(C.textMuted), flex: "none" as const, padding: "10px 20px" }} onClick={() => setModal(null)}>Cancel</button>
              <button style={{ ...abt(C.accent, "#00c89618"), flex: 1, padding: 10 }}
                disabled={!addForm.name || !addForm.email || !addForm.service || !addForm.date || !addForm.time || acting === "add"}
                onClick={addBooking}>
                {acting === "add" ? "Adding…" : "Add Booking"}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

// ─── Component ────────────────────────────────────────────────────────────────

export default function ClientPortal() {
  const router = useRouter();
  const params = useParams();
  const slug = params?.slug as string;

  // ── Theme ──────────────────────────────────────────────────────────────────
  const [dark, setDark] = useState<boolean>(false);
  useEffect(() => {
    const stored = localStorage.getItem("wg_theme");
    setDark(stored === "dark");
  }, []);
  function toggleTheme() {
    const next = !dark;
    setDark(next);
    localStorage.setItem("wg_theme", next ? "dark" : "light");
  }
  C = dark ? DARK : LIGHT;

  const [client, setClient] = useState<ClientData | null>(null);
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [tab, setTab] = useState<Tab>("overview");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const [paymentStatus, setPaymentStatus] = useState<PaymentStatus | null>(null);
  const [payLoading, setPayLoading] = useState<string | null>(null);
  const [termsAccepted, setTermsAccepted] = useState(false);
  const [termsModalOpen, setTermsModalOpen] = useState(false);
  const [termsChecked, setTermsChecked] = useState({ tnc: false, privacy: false, cancellation: false, social: false });
  const [cancellingId, setCancellingId] = useState<string | null>(null);

  // Preview / feedback
  const [feedback, setFeedback] = useState<{ id: string; text: string; createdAt: string }[]>([]);
  const [feedbackText, setFeedbackText] = useState("");
  const [feedbackRound, setFeedbackRound] = useState(1);
  const [feedbackLoading, setFeedbackLoading] = useState(false);
  const [feedbackSubmitting, setFeedbackSubmitting] = useState(false);
  const [revisionSent, setRevisionSent] = useState(false);
  const [previewTs, setPreviewTs] = useState(() => Date.now());

  // Report an Issue
  const [reportText, setReportText] = useState("");
  const [reportSending, setReportSending] = useState(false);
  const [reportSent, setReportSent] = useState(false);

  // Pre-payment business details
  const [prePayAbn, setPrePayAbn] = useState("");
  const [prePayDomain, setPrePayDomain] = useState("");
  const [prePayAddress, setPrePayAddress] = useState("");
  const [prePayGa4, setPrePayGa4] = useState("");
  const [prePaySaving, setPrePaySaving] = useState(false);
  const [prePaySaved, setPrePaySaved] = useState(false);

  // Shop payment link
  const [shopPaymentUrl, setShopPaymentUrl] = useState("");
  const [shopPaymentSaving, setShopPaymentSaving] = useState(false);
  const [shopPaymentSaved, setShopPaymentSaved] = useState(false);

  // Subscription management
  const [showSubModal, setShowSubModal] = useState(false);
  const [subStep, setSubStep] = useState<"reason" | "option" | "confirm">("reason");
  const [cancelReason, setCancelReason] = useState("");
  const [cancelOption, setCancelOption] = useState<{id:string;label:string;desc:string;priceLabel:(n:number)=>string;priceCalc:(n:number)=>number;icon:string} | null>(null);

  // Upgrade / Feature Requests
  const [myFeatureRequests, setMyFeatureRequests] = useState<any[]>([]);
  const [upgradeSelected, setUpgradeSelected] = useState<string[]>([]);
  const [upgradeMessage, setUpgradeMessage] = useState("");
  const [upgradeSubmitting, setUpgradeSubmitting] = useState(false);
  const [upgradeSubmitted, setUpgradeSubmitted] = useState(false);

  // Photo / Asset uploads
  const [assetUploading, setAssetUploading] = useState(false);
  const [assetMsg, setAssetMsg] = useState("");
  const [assetType, setAssetType] = useState<"gallery"|"logo"|"hero">("gallery");
  const [uploadedThisSession, setUploadedThisSession] = useState(0);

  // Content requests
  const [contentRequestType, setContentRequestType] = useState<"blog"|"newsletter"|"deal"|"product"|"review">("blog");
  const [contentRequestTitle, setContentRequestTitle] = useState("");
  const [contentRequestNote, setContentRequestNote] = useState("");
  const [contentRequestExtras, setContentRequestExtras] = useState<Record<string,string>>({});
  const [contentSubmitting, setContentSubmitting] = useState(false);
  const [contentSubmitted, setContentSubmitted] = useState(false);
  const [myContentItems, setMyContentItems] = useState<any[]>([]);
  const [contentItemsLoading, setContentItemsLoading] = useState(false);

  // ── Social Media state ───────────────────────────────────────────────────
  const [postingMode, setPostingMode] = useState<"auto"|"manual">("auto");
  const [socialBrief, setSocialBrief] = useState("");
  const [socialTone, setSocialTone] = useState<"professional"|"friendly"|"casual"|"promotional">("friendly");
  const [socialPlatforms, setSocialPlatforms] = useState<string[]>(["Instagram","Facebook"]);
  const [socialSubmitting, setSocialSubmitting] = useState(false);
  const [socialSubmitted, setSocialSubmitted] = useState(false);
  const [socialFile, setSocialFile] = useState<File|null>(null);
  // Social upsell / plan selection
  const [socialSelectedPlan, setSocialSelectedPlan] = useState<string|null>(null);
  const [socialUpgradeState, setSocialUpgradeState] = useState<"idle"|"loading"|"done"|"err">("idle");
  const [socialCustomNote, setSocialCustomNote] = useState("");
  const [socialSetupStep, setSocialSetupStep] = useState<"choose"|"link"|"create"|null>(null);
  const [socialActiveTab, setSocialActiveTab] = useState<"overview"|"calendar"|"brief"|"setup">("overview");

  // Contact / Support
  const [contactTopics, setContactTopics] = useState<string[]>([]);
  const [contactDetails, setContactDetails] = useState("");
  const [contactSubmitting, setContactSubmitting] = useState(false);
  const [contactSubmitted, setContactSubmitted] = useState(false);

  // Onboarding tour
  const [tourVisible, setTourVisible] = useState(false);
  const [tourStep, setTourStep] = useState(0);

  // ── Auth + data load ────────────────────────────────────────────────────────
  useEffect(() => {
    const wgAuthVal = localStorage.getItem(`wg_auth_${slug}`);
    const wgExpiry = wgAuthVal ? parseInt(wgAuthVal, 10) : 0;
    if (!wgAuthVal || Date.now() > wgExpiry) {
      localStorage.removeItem(`wg_auth_${slug}`);
      router.replace("/c");
      return;
    }
    loadClient();
  }, [slug]);

  useEffect(() => {
    if (!client) return;
    loadPaymentStatus();
    if ((tab === "bookings" || tab === "overview") && client.hasBooking) loadBookings();
    if (tab === "preview") loadFeedback();
    if (tab === "upgrade") loadMyFeatureRequests();
    if (tab === "content") loadMyContent();
  }, [tab, client]);

  // Init social posting mode from server metadata
  useEffect(() => {
    if (!client) return;
    const pm = (client.metadata as any)?.socialPostingMode;
    if (pm === "auto" || pm === "manual") setPostingMode(pm);
  }, [client?.jobId]);

  async function loadMyContent() {
    setContentItemsLoading(true);
    try {
      const res = await fetch(`/api/client/content?slug=${slug}`);
      if (res.ok) { const d = await res.json(); setMyContentItems(d.items || []); }
    } catch (e) { /* silent */ } finally { setContentItemsLoading(false); }
  }

  async function submitContentRequest() {
    setContentSubmitting(true);
    try {
      const res = await fetch("/api/client/content", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          slug,
          type: contentRequestType,
          title: contentRequestTitle,
          clientNote: contentRequestNote,
          ...contentRequestExtras,
        }),
      });
      if (!res.ok) throw new Error("Failed");
      setContentSubmitted(true);
      setContentRequestTitle("");
      setContentRequestNote("");
      setContentRequestExtras({});
    } catch (e) {
      alert("Failed to submit — please try again.");
    } finally { setContentSubmitting(false); }
  }

  async function loadMyFeatureRequests() {
    try {
      const res = await fetch(`/api/feature-requests?slug=${slug}`);
      if (res.ok) {
        const d = await res.json();
        setMyFeatureRequests(d.requests || []);
      }
    } catch {}
  }

  async function submitUpgradeRequest() {
    if (upgradeSelected.length === 0) return;
    setUpgradeSubmitting(true);
    try {
      const res = await fetch("/api/feature-requests", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ slug, featureIds: upgradeSelected, message: upgradeMessage }),
      });
      if (res.ok) {
        setUpgradeSubmitted(true);
        setUpgradeSelected([]);
        setUpgradeMessage("");
        await loadMyFeatureRequests();
      }
    } catch {}
    finally { setUpgradeSubmitting(false); }
  }

  async function submitContactRequest() {
    if (contactTopics.length === 0 && contactDetails.trim() === "") return;
    setContactSubmitting(true);
    try {
      await fetch("/api/contact", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          slug,
          businessName: client?.businessName || slug,
          email: client?.email || "",
          topics: contactTopics,
          details: contactDetails,
        }),
      });
      setContactSubmitted(true);
    } catch {}
    finally { setContactSubmitting(false); }
  }

  useEffect(() => {
    if (typeof window === "undefined") return;
    const p = new URLSearchParams(window.location.search);
    if (p.get("payment") === "done") {
      setTab("quote");
      window.history.replaceState({}, "", window.location.pathname);
      setTimeout(() => loadPaymentStatus(), 2000);
      setTimeout(() => loadPaymentStatus(), 5000);
    }
    if (p.get("square") === "connected") {
      window.history.replaceState({}, "", window.location.pathname);
      setTimeout(() => loadClient(), 500);
    }
  }, []);

  function normalizeClient(raw: any): ClientData {
    // Support both new metadata jsonb format and legacy flat columns
    const m = raw.metadata || {};
    return {
      ...raw,
      // Normalise to consistent camelCase fields used throughout the component
      businessName: raw.business_name || raw.businessName || "",
      jobId: raw.job_id || raw.jobId || "",
      email: raw.email || raw.client_email || "",
      previewUrl: raw.preview_url || raw.previewUrl || null,
      launchReady: raw.launch_ready || raw.launchReady || false,
      hasBooking: m.hasBooking ?? raw.has_booking ?? raw.hasBooking ?? false,
      // SuperSaas — enriched from jobs table by client-login GET
      supersaasId: raw.supersaasId ?? raw.supersaas_id ?? m.supersaasId ?? null,
      supersaasUrl: raw.supersaasUrl ?? raw.supersaas_url ?? m.supersaasUrl ?? null,
      squareConnected: !!(raw.square_access_token || raw.squareAccessToken || raw.squareConnected),
      squareMerchantId: raw.square_merchant_id || raw.squareMerchantId || null,
      shopPaymentUrl: raw.shop_payment_url || raw.shopPaymentUrl || null,
      name: m.name || raw.name || "",
      abn: m.abn || raw.abn || "",
      goal: m.goal || raw.goal || "",
      targetAudience: m.targetAudience || raw.target_audience || raw.targetAudience || "",
      siteType: m.siteType || raw.site_type || raw.siteType || "",
      pages: m.pages || raw.pages || [],
      features: m.features || raw.features || [],
      style: m.style || raw.style || "",
      colorPrefs: m.colorPrefs || raw.color_prefs || raw.colorPrefs || "",
      references: m.references || raw.references || "",
      additionalNotes: m.additionalNotes || raw.additional_notes || raw.additionalNotes || "",
      pricingMethod: m.pricingMethod || raw.pricing_method || raw.pricingMethod || "",
      pricingDetails: m.pricingDetails || raw.pricing_details || raw.pricingDetails || "",
      businessAddress: m.businessAddress || raw.business_address || raw.businessAddress || "",
      facebookPage: m.facebookPage || raw.facebook_page || raw.facebookPage || "",
      quote: m.quote || raw.quote || null,
    };
  }

  async function loadClient() {
    try {
      const res = await fetch(`/api/client-login?slug=${slug}`);
      if (!res.ok) { localStorage.removeItem(`wg_auth_${slug}`); router.replace("/c"); return; }
      const raw = await res.json();
      const normalised = normalizeClient(raw);
      setClient(normalised);
      if (normalised.shopPaymentUrl) setShopPaymentUrl(normalised.shopPaymentUrl);
      if (normalised.abn) setPrePayAbn(normalised.abn);
      if (normalised.businessAddress) setPrePayAddress(normalised.businessAddress);
      // preferredDomain from user_input
      const ui = (raw.user_input || raw.userInput || {}) as Record<string, string>;
      if (ui.preferredDomain) setPrePayDomain(ui.preferredDomain);
      if (normalised.ga4Id || ui.ga4Id) setPrePayGa4(normalised.ga4Id || ui.ga4Id || "");
      // Show onboarding tour on first login
      const tourKey = `wg_tour_done_${slug}`;
      if (!localStorage.getItem(tourKey)) {
        setTourVisible(true);
        setTourStep(0);
      }
    } catch { setError("Failed to load your project. Please refresh."); }
    // Load saved terms acceptance
    try {
      const saved = localStorage.getItem("wg_terms_" + slug);
      if (saved === "accepted") setTermsAccepted(true);
    } catch {}
    finally { setLoading(false); }
  }

  async function savePrePayDetails() {
    if (!client?.jobId) return;
    setPrePaySaving(true);
    setPrePaySaved(false);
    try {
      await fetch(`/api/client-login`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json", "x-job-id": client.jobId, "x-client-slug": slug },
        body: JSON.stringify({ abn: prePayAbn, businessAddress: prePayAddress, preferredDomain: prePayDomain, ga4Id: prePayGa4 }),
      });
      setPrePaySaved(true);
    } catch { /* non-fatal */ }
    finally { setPrePaySaving(false); }
  }

  async function saveShopPaymentUrl() {
    if (!shopPaymentUrl.trim() || !client?.jobId) return;
    setShopPaymentSaving(true);
    setShopPaymentSaved(false);
    try {
      const res = await fetch(`/api/client-login`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ slug, shopPaymentUrl: shopPaymentUrl.trim() }),
      });
      if (!res.ok) throw new Error("Save failed");
      setShopPaymentSaved(true);
      setClient(prev => prev ? { ...prev, shopPaymentUrl: shopPaymentUrl.trim() } : prev);
      await fetch(`/api/pipeline/run`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ jobId: client.jobId }),
      });
      setTimeout(() => setShopPaymentSaved(false), 3000);
    } catch {
      alert("Could not save payment link. Please try again.");
    } finally {
      setShopPaymentSaving(false);
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
    if (!confirm("Submit all changes for revision? Our team will review and apply them before releasing the updated site.")) return;
    setFeedbackSubmitting(true);
    try {
      const res = await fetch(`/api/preview/feedback?slug=${slug}`, { method: "DELETE" });
      if (res.ok) { setRevisionSent(true); setFeedback([]); }
    } finally { setFeedbackSubmitting(false); }
  }

  async function submitReport() {
    if (!reportText.trim() || !client) return;
    setReportSending(true);
    try {
      await fetch("https://formspree.io/f/placeholder", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          business: client.businessName,
          slug,
          issue: reportText.trim(),
        }),
      }).catch(() => null);
      // Always send to support email via mailto fallback — actually fire a mailto
      const subject = encodeURIComponent(`Site Issue — ${client.businessName}`);
      const body = encodeURIComponent(`Business: ${client.businessName}\nSlug: ${slug}\n\nIssue:\n${reportText.trim()}`);
      window.open(`mailto:hello@webgecko.au?subject=${subject}&body=${body}`);
      setReportSent(true);
      setReportText("");
    } finally { setReportSending(false); }
  }

  async function handlePay(stage: "deposit" | "final" | "monthly") {
    if (!termsAccepted) { setTermsModalOpen(true); return; }
    setPayLoading(stage);
    try {
      const res = await fetch(`/api/payment/create?slug=${slug}&stage=${stage}`);
      let data: any = {};
      try { data = await res.json(); } catch { data = {}; }
      if (!res.ok) {
        alert(`Error ${res.status}: ${data.error || res.statusText}`);
        return;
      }
      if (data.url) window.location.href = data.url;
      else if (data.alreadyPaid) await loadPaymentStatus();
      else alert(data.error || "Could not create payment link.");
    } catch (err: any) { alert("Network error: " + (err?.message || String(err))); }
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

  function signOut() { localStorage.removeItem(`wg_auth_${slug}`); router.replace("/c"); }

  const today = new Date().toISOString().split("T")[0];
  const tomorrow = new Date(Date.now() + 86400000).toISOString().split("T")[0];
  const thirtyDaysAgo = new Date(Date.now() - 30 * 86400000).toISOString().split("T")[0];

  const features = client?.features || [];
  const hasBooking = client?.hasBooking || features.includes("Booking System");
  const hasBlog = features.includes("Blog");
  const hasShop = features.includes("Payments / Shop") || features.includes("Online Shop");
  const hasGallery = features.includes("Photo Gallery");
  const squareConnected = !!(client?.squareConnected);
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

  const hasContentFeature = hasBlog || hasGrowth || hasShop || features.includes("Deals & Promotions") || features.includes("Testimonials");

  const serviceMode: "website"|"social"|"both" = (client?.metadata as any)?.serviceType || "website";
  const isSocialOnly = serviceMode === "social";
  const hasSocial = serviceMode === "social" || serviceMode === "both";

  // Init postingMode from metadata on load
  const savedPostingMode = (client?.metadata as any)?.socialPostingMode;
  // (only run once after client loads — handled via separate effect below)

  const tabs: { id: Tab; label: string; icon: string }[] = [
    { id: "overview", label: "Overview", icon: "🏠" },
    ...(!isSocialOnly ? [{ id: "preview" as Tab, label: "Site Preview", icon: "👁" }] : []),
    ...(!isSocialOnly && hasBooking ? [{ id: "bookings" as Tab, label: "Bookings", icon: "📅" }] : []),
    ...(!isSocialOnly && hasContentFeature ? [{ id: "content" as Tab, label: "Content", icon: "📰" }] : []),
    ...(hasSocial ? [{ id: "social" as Tab, label: "Social Media", icon: "📱" }] : []),
    { id: "quote", label: "Quote & Pay", icon: "💳" },
    { id: "plan", label: "My Plan", icon: "📋" },
    ...(!isSocialOnly ? [{ id: "upgrade" as Tab, label: "Add Features", icon: "⚡" }] : []),
    { id: "contact", label: "Contact Us", icon: "💬" },
    { id: "settings" as Tab, label: "Settings", icon: "⚙" },
  ];

  const S = {
    page: {
      minHeight: "100vh",
      background: C.bg,
      color: C.text,
      fontFamily: "'Space Grotesk','Inter',-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif",
      transition: "background 0.25s ease, color 0.25s ease",
      backgroundImage: dark
        ? "radial-gradient(ellipse 80% 40% at 50% -10%, rgba(79,158,255,0.06) 0%, transparent 60%), linear-gradient(rgba(79,158,255,0.022) 1px, transparent 1px), linear-gradient(90deg, rgba(79,158,255,0.022) 1px, transparent 1px)"
        : "none",
      backgroundSize: dark ? "100% 100%, 48px 48px, 48px 48px" : "auto",
    } as React.CSSProperties,

    header: {
      background: C.navBg,
      borderBottom: `1px solid ${C.navBorder}`,
      padding: "0 20px",
      height: 60,
      display: "flex",
      alignItems: "center",
      justifyContent: "space-between",
      position: "sticky" as const,
      top: 0,
      zIndex: 50,
      backdropFilter: "blur(20px) saturate(180%)",
      WebkitBackdropFilter: "blur(20px) saturate(180%)",
      transition: "background 0.25s ease, border-color 0.25s ease",
    } as React.CSSProperties,

    logoMark: {
      width: 30,
      height: 30,
      background: "linear-gradient(135deg, #4f9eff, #a78bfa)",
      borderRadius: 9,
      flexShrink: 0,
      boxShadow: "0 0 16px rgba(79,158,255,0.4)",
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      fontSize: 13,
      fontWeight: 900,
      color: "#fff",
    } as React.CSSProperties,

    tabBar: {
      background: C.navBg,
      borderBottom: `1px solid ${C.navBorder}`,
      display: "flex",
      overflowX: "auto" as const,
      scrollbarWidth: "none" as const,
      padding: "0 8px",
      backdropFilter: dark ? "blur(20px) saturate(180%)" : "none",
      transition: "background 0.25s ease",
    } as React.CSSProperties,

    tabBtn: (active: boolean): React.CSSProperties => ({
      padding: "14px 18px",
      fontSize: "12px",
      fontWeight: active ? 700 : 400,
      color: active ? C.text : C.textMuted,
      borderTop: "none",
      borderLeft: "none",
      borderRight: "none",
      borderBottom: active ? `2px solid ${C.accentBlue}` : "2px solid transparent",
      background: "none",
      cursor: "pointer",
      whiteSpace: "nowrap" as const,
      letterSpacing: "0.03em",
      transition: "color 0.18s ease, border-color 0.18s ease",
      textTransform: "uppercase" as const,
    }),

    body: {
      padding: "24px 20px 48px",
      maxWidth: 720,
      margin: "0 auto",
    } as React.CSSProperties,

    card: {
      background: C.surface,
      border: `1px solid ${C.border}`,
      borderRadius: 14,
      padding: "20px 22px",
      marginBottom: 14,
      boxShadow: C.shadow,
      transition: "background 0.25s ease, border-color 0.25s ease, box-shadow 0.25s ease",
      position: "relative" as const,
      overflow: "hidden" as const,
    } as React.CSSProperties,

    label: {
      fontSize: 10,
      fontWeight: 700,
      color: C.textMuted,
      textTransform: "uppercase" as const,
      letterSpacing: "0.1em",
      marginBottom: 8,
    } as React.CSSProperties,

    val: {
      fontSize: 14,
      color: C.text,
      fontWeight: 400,
      lineHeight: 1.5,
    } as React.CSSProperties,

    pill: (color: string, bg?: string): React.CSSProperties => ({
      display: "inline-block",
      background: bg || `${color}14`,
      color,
      border: `1px solid ${color}28`,
      borderRadius: 6,
      padding: "2px 9px",
      fontSize: 11,
      fontWeight: 600,
      letterSpacing: "0.02em",
    }),

    btn: (v: "primary"|"secondary"|"danger"|"ghost" = "primary", disabled = false): React.CSSProperties => ({
      display: "inline-flex",
      alignItems: "center",
      justifyContent: "center",
      gap: 6,
      padding: "10px 22px",
      borderRadius: 10,
      fontSize: 13,
      fontWeight: 600,
      cursor: disabled ? "not-allowed" : "pointer",
      opacity: disabled ? 0.45 : 1,
      letterSpacing: "0.01em",
      transition: "opacity 0.18s ease, background 0.18s ease, box-shadow 0.18s ease",
      ...(v === "primary"
        ? { background: `linear-gradient(135deg, ${C.accent}, #00b365)`, color: "#000", border: "none", boxShadow: disabled ? "none" : `0 4px 16px ${C.accent}35` }
        : v === "secondary"
        ? { background: C.raised, color: C.textSec, border: `1px solid ${C.border}` }
        : v === "danger"
        ? { background: C.redBg, color: C.red, border: `1px solid ${C.red}30` }
        : { background: "none", color: C.textMuted, border: `1px solid ${C.border}` }),
    }),

    divider: {
      height: 1,
      background: C.border,
      margin: "20px 0",
    } as React.CSSProperties,

    lockBox: {
      background: C.raised,
      borderRadius: 10,
      padding: "14px 18px",
      textAlign: "center" as const,
      color: C.textMuted,
      fontSize: 13,
      marginTop: 12,
      border: `1px solid ${C.border}`,
    } as React.CSSProperties,

    payBtn: (active: boolean, v: "primary"|"secondary" = "primary"): React.CSSProperties => ({
      width: "100%",
      background: active
        ? (v === "primary" ? `linear-gradient(135deg, ${C.accent}, #00b365)` : C.raised)
        : C.raised,
      color: active
        ? (v === "primary" ? "#000" : C.text)
        : C.textMuted,
      border: active && v === "secondary" ? `1px solid ${C.border}` : "none",
      borderRadius: 12,
      padding: "14px 20px",
      fontSize: 14,
      fontWeight: 700,
      cursor: active ? "pointer" : "not-allowed",
      marginTop: 12,
      letterSpacing: "0.01em",
      boxShadow: active && v === "primary" ? `0 4px 18px ${C.accent}35` : "none",
      transition: "background 0.2s ease, box-shadow 0.2s ease",
    }),
  };

  // ── Loading / error ──────────────────────────────────────────────────────────
  if (loading) return (
    <div style={{ minHeight:"100vh", background:DARK.bg, display:"flex", alignItems:"center", justifyContent:"center", flexDirection:"column", gap:16, fontFamily:"Inter,sans-serif" }}>
      <div style={{ fontSize:36, animation:"wg-float 2s ease-in-out infinite" }}>🦎</div>
      <div style={{ color:DARK.textMuted, fontSize:13 }}>Loading your portal…</div>
      <style>{`@keyframes wg-float{0%,100%{transform:translateY(0)}50%{transform:translateY(-8px)}}`}</style>
    </div>
  );
  if (error || !client) return (
    <div style={{ minHeight:"100vh", background:DARK.bg, display:"flex", alignItems:"center", justifyContent:"center", flexDirection:"column", gap:12, fontFamily:"Inter,sans-serif" }}>
      <div style={{ fontSize:36 }}>🔒</div>
      <div style={{ color:DARK.red, fontSize:14, fontWeight:600 }}>{error || "Project not found."}</div>
      <a href="/c" style={{ color:DARK.accent, fontSize:13, textDecoration:"none" }}>← Back to login</a>
    </div>
  );

  // ─────────────────────────────────────────────────────────────────────────────
  const portalCss = `
    @import url('https://fonts.googleapis.com/css2?family=Space+Grotesk:wght@400;500;600;700&family=Inter:wght@400;500;600&family=JetBrains+Mono:wght@400;500&display=swap');
    *, *::before, *::after { box-sizing: border-box; }
    @keyframes wg-ping    { 0%{transform:scale(1);opacity:.9} 100%{transform:scale(2.4);opacity:0} }
    @keyframes wg-float   { 0%,100%{transform:translateY(0)} 50%{transform:translateY(-8px)} }
    @keyframes wg-fade    { from{opacity:0} to{opacity:1} }
    @keyframes wg-up      { from{opacity:0;transform:translateY(12px)} to{opacity:1;transform:translateY(0)} }
    @keyframes wg-tab-in  { from{opacity:0;transform:translateY(8px)} to{opacity:1;transform:translateY(0)} }
    @keyframes wg-shimmer { 0%{background-position:-600px 0} 100%{background-position:600px 0} }

    ::-webkit-scrollbar { width:4px; height:4px }
    ::-webkit-scrollbar-track { background:transparent }
    ::-webkit-scrollbar-thumb { background:rgba(79,158,255,0.25); border-radius:99px }

    button { font-family:inherit; transition:opacity 0.15s, transform 0.12s, box-shadow 0.15s !important }
    button:active:not(:disabled) { transform:scale(0.96) !important }
    input, textarea, select { font-family:inherit }
    input:focus, textarea:focus, select:focus { outline:none !important }

    .wg-tab { animation: wg-tab-in 0.22s cubic-bezier(0.22,1,0.36,1) both }

    /* Tab bar — hide scrollbar */
    [data-tab-bar] { -ms-overflow-style:none; scrollbar-width:none; }
    [data-tab-bar]::-webkit-scrollbar { display:none; }

    /* Tab icon — show on mobile, hide label; show label on desktop */
    .wg-tab-icon  { display:inline; margin-right:5px; }
    .wg-tab-label { display:inline; }

    /* ── Sidebar layout ─────────────────────────────────────────── */
    .wg-layout        { display:flex; min-height:100vh; }
    .wg-sidebar-nav   { width:220px; flex-shrink:0; position:sticky; top:0; height:100vh; overflow-y:auto;
                        display:flex; flex-direction:column; border-right-width:1px; border-right-style:solid; }
    .wg-main-wrap     { flex:1; min-width:0; display:flex; flex-direction:column; }
    .wg-mobile-topbar { display:none; }
    .wg-bottom-nav    { display:none; }

    /* Sidebar nav item */
    .wg-nav-item { display:flex; align-items:center; gap:10px; padding:9px 16px; border-radius:9px;
                   cursor:pointer; font-size:13px; font-weight:500; transition:all 0.15s ease;
                   border:none; width:100%; text-align:left; background:none; }
    .wg-nav-item:hover { opacity:0.85; }

    /* ── Mobile ── */
    @media (max-width: 768px) {
      .wg-sidebar-nav  { display:none !important; }
      .wg-mobile-topbar{ display:flex !important; align-items:center; justify-content:space-between;
                         padding:0 16px; height:56px; position:sticky; top:0; z-index:50;
                         border-bottom-width:1px; border-bottom-style:solid; }
      .wg-bottom-nav   { display:flex !important; position:fixed; bottom:0; left:0; right:0; z-index:100;
                         border-top-width:1px; border-top-style:solid; padding:6px 4px 8px;
                         padding-bottom: calc(8px + env(safe-area-inset-bottom)); }
      .wg-main-wrap    { padding-bottom:80px; }
      .wg-tab-icon     { display:block; font-size:20px; margin:0 auto 2px; }
      .wg-tab-label    { display:block; font-size:9px; font-weight:600; letter-spacing:0.04em; text-transform:uppercase; }
      [data-tab-bar]   { display:none !important; }
      .wg-desktop-tabs { display:none !important; }
    }
    @media (min-width: 769px) {
      [data-tab-bar] { display:flex; }
      .wg-desktop-tabs { display:flex; }
    }
  `;

  const tourSteps = [
        { tab: "Overview", icon: "🏠", title: "Welcome to Your Client Portal", body: "This is your home base. Here you'll see your build status, payment progress, and quick actions. Everything you need in one place." },
        { tab: "Quote & Pay", icon: "💳", title: "Pay Your Deposit to Get Started", body: "Nothing starts until the deposit is paid. Head to Quote & Pay, review your quote, and pay the deposit to kick off your website build." },
        { tab: "Site Preview", icon: "👁", title: "Review Your Website", body: "Once your site is built, you'll get a preview here. Review it, leave feedback, and request revisions before it goes live." },
        { tab: "Add Features", icon: "⚡", title: "Upgrade Your Site", body: "Want to add booking, a shop, newsletter, or more? Use Add Features to request upgrades at any time." },
        { tab: "Contact Us", icon: "💬", title: "We're Here to Help", body: "Have a question or issue? Use the Contact Us tab to reach our team. We respond within one business day." },
      ];

  function closeTour() {
    localStorage.setItem(`wg_tour_done_${slug}`, "1");
    setTourVisible(false);
  }

  // Bottom nav tabs — only show 5 most important on mobile
  const bottomNavTabs = tabs.slice(0, 5);

  const sidebarBg = dark ? "rgba(6,12,24,0.98)" : "#ffffff";
  const sidebarBorder = dark ? "#1a2e50" : "#e2e5f0";

  return (
    <div style={S.page}>
      <style>{portalCss}</style>

      {/* ── Onboarding Tour Overlay ─────────────────────────────────────────── */}
      {tourVisible && (
        <div style={{ position:"fixed", inset:0, zIndex:9999, background:"rgba(0,0,0,0.72)", backdropFilter:"blur(4px)", display:"flex", alignItems:"center", justifyContent:"center", padding:20 }}>
          <div style={{ background: dark?"#0f1623":"#fff", border:`1px solid ${C.border}`, borderRadius:20, maxWidth:480, width:"100%", padding:"32px 28px", position:"relative", boxShadow:"0 24px 64px rgba(0,0,0,0.5)" }}>
            {/* Step dots */}
            <div style={{ display:"flex", gap:6, marginBottom:24, justifyContent:"center" }}>
              {tourSteps.map((_,i) => (
                <div key={i} style={{ width: i===tourStep?20:7, height:7, borderRadius:4, background: i===tourStep?C.accent:C.border, transition:"all 0.25s" }}/>
              ))}
            </div>
            {/* Icon */}
            <div style={{ fontSize:40, textAlign:"center" as const, marginBottom:12 }}>{tourSteps[tourStep].icon}</div>
            {/* Tab badge */}
            <div style={{ textAlign:"center" as const, marginBottom:8 }}>
              <span style={{ fontSize:11, fontWeight:700, letterSpacing:"0.08em", textTransform:"uppercase" as const, color:C.accent, background:C.accent+"18", borderRadius:20, padding:"3px 10px" }}>{tourSteps[tourStep].tab}</span>
            </div>
            {/* Title */}
            <div style={{ fontSize:18, fontWeight:800, color:C.text, textAlign:"center" as const, marginBottom:10, lineHeight:1.3 }}>{tourSteps[tourStep].title}</div>
            {/* Body */}
            <div style={{ fontSize:14, color:C.textSec, textAlign:"center" as const, lineHeight:1.65, marginBottom:28 }}>{tourSteps[tourStep].body}</div>
            {/* Buttons */}
            <div style={{ display:"flex", gap:10, alignItems:"center" }}>
              {tourStep > 0 && (
                <button onClick={() => setTourStep(s=>s-1)} style={{ flex:1, background:C.raised, border:`1px solid ${C.border}`, color:C.textSec, borderRadius:10, padding:"11px 0", fontSize:14, fontWeight:600, cursor:"pointer", fontFamily:"inherit" }}>← Back</button>
              )}
              {tourStep < tourSteps.length - 1 ? (
                <button onClick={() => setTourStep(s=>s+1)} style={{ flex:2, background:C.accent, border:"none", color:"#000", borderRadius:10, padding:"11px 0", fontSize:14, fontWeight:700, cursor:"pointer", fontFamily:"inherit" }}>Next →</button>
              ) : (
                <button onClick={closeTour} style={{ flex:2, background:C.accent, border:"none", color:"#000", borderRadius:10, padding:"11px 0", fontSize:14, fontWeight:700, cursor:"pointer", fontFamily:"inherit" }}>Let's go →</button>
              )}
            </div>
            {/* Exit */}
            <button onClick={closeTour} style={{ position:"absolute", top:14, right:14, background:"transparent", border:"none", color:C.textMuted, fontSize:18, cursor:"pointer", lineHeight:1, padding:4 }}>✕</button>
          </div>
        </div>
      )}

      {/* ── Layout: Sidebar (desktop) + Main ─────────────────────────────── */}
      <div className="wg-layout">

        {/* ── Sidebar (desktop only) ─────────────────────────────────────── */}
        <nav className="wg-sidebar-nav" style={{ background: sidebarBg, borderRightColor: sidebarBorder }}>
          {/* Business header — just name, no WebGecko branding */}
          <div style={{ padding: "20px 16px 16px", borderBottom: `1px solid ${sidebarBorder}` }}>
            <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
              <div style={{ width: 40, height: 40, borderRadius: 11, background: `linear-gradient(135deg,${C.accentBlue}40,${C.purple}30)`, border: `1.5px solid ${C.accentBlue}40`, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 15, fontWeight: 800, color: dark ? "#a0c8ff" : C.accentBlue, flexShrink: 0, letterSpacing: "-0.02em" }}>
                {client.businessName.split(" ").map((w: string) => w[0]).slice(0, 2).join("").toUpperCase()}
              </div>
              <div style={{ minWidth: 0 }}>
                <div style={{ fontSize: 14, fontWeight: 700, color: dark ? "#d8eaff" : "#0d1020", lineHeight: 1.2, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{client.businessName}</div>
                <div style={{ fontSize: 11, color: dark ? "#4a6898" : "#8090aa", fontWeight: 500, marginTop: 2 }}>Client Portal</div>
                {client.launchReady && <div style={{ fontSize: 10, color: C.accent, fontWeight: 600, marginTop: 2 }}>● Live</div>}
              </div>
            </div>
          </div>

          {/* ── Website nav items ─────────────────────────────────────── */}
          <div style={{ flex: 1, overflowY: "auto" }}>
            {/* Website section */}
            {!isSocialOnly && (
              <div style={{ padding: "10px 8px 4px" }}>
                <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: "0.1em", color: dark ? "#2a4060" : "#b0b8cc", textTransform: "uppercase", padding: "4px 10px 8px" }}>Website</div>
                {tabs.filter(t => t.id !== "social").map(t => (
                  <button key={t.id} className="wg-nav-item" onClick={() => setTab(t.id)}
                    style={{
                      background: tab === t.id ? (dark ? "rgba(79,158,255,0.15)" : "rgba(37,99,235,0.09)") : "transparent",
                      color: tab === t.id ? (dark ? "#80bbff" : C.accentBlue) : (dark ? "#6a8aaa" : "#505870"),
                      fontWeight: tab === t.id ? 700 : 500,
                      borderLeft: `3px solid ${tab === t.id ? C.accentBlue : "transparent"}`,
                      borderRadius: "0 8px 8px 0",
                      marginBottom: 2,
                    }}>
                    <span style={{ fontSize: 15, lineHeight: 1 }}>{t.icon}</span>
                    <span style={{ fontSize: 13 }}>{t.label}</span>
                  </button>
                ))}
              </div>
            )}
            {isSocialOnly && (
              <div style={{ padding: "10px 8px 4px" }}>
                <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: "0.1em", color: dark ? "#2a4060" : "#b0b8cc", textTransform: "uppercase", padding: "4px 10px 8px" }}>General</div>
                {tabs.filter(t => t.id !== "social").map(t => (
                  <button key={t.id} className="wg-nav-item" onClick={() => setTab(t.id)}
                    style={{
                      background: tab === t.id ? (dark ? "rgba(79,158,255,0.15)" : "rgba(37,99,235,0.09)") : "transparent",
                      color: tab === t.id ? (dark ? "#80bbff" : C.accentBlue) : (dark ? "#6a8aaa" : "#505870"),
                      fontWeight: tab === t.id ? 700 : 500,
                      borderLeft: `3px solid ${tab === t.id ? C.accentBlue : "transparent"}`,
                      borderRadius: "0 8px 8px 0",
                      marginBottom: 2,
                    }}>
                    <span style={{ fontSize: 15, lineHeight: 1 }}>{t.icon}</span>
                    <span style={{ fontSize: 13 }}>{t.label}</span>
                  </button>
                ))}
              </div>
            )}

            {/* ── Social Media section ──────────────────────────────── */}
            <div style={{ padding: "4px 8px 8px", borderTop: !isSocialOnly ? `1px solid ${sidebarBorder}` : "none", marginTop: !isSocialOnly ? 6 : 0 }}>
              {/* Section heading */}
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "8px 10px 6px" }}>
                <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: "0.1em", color: hasSocial ? (dark ? "#c060ff" : "#7c3aed") : (dark ? "#2a4060" : "#b0b8cc"), textTransform: "uppercase" }}>Social Media</div>
                {!hasSocial && <span style={{ fontSize: 9, fontWeight: 700, color: dark ? "#3a3060" : "#c4b5fd", background: dark ? "rgba(120,60,200,0.15)" : "rgba(124,58,237,0.08)", border: `1px solid ${dark ? "rgba(120,60,200,0.3)" : "rgba(124,58,237,0.2)"}`, borderRadius: 4, padding: "2px 6px", letterSpacing: "0.05em" }}>UPGRADE</span>}
              </div>

              {hasSocial ? (
                <>
                  {/* Main social tab button */}
                  <button className="wg-nav-item" onClick={() => setTab("social")}
                    style={{
                      background: tab === "social" ? (dark ? "rgba(180,80,255,0.15)" : "rgba(124,58,237,0.09)") : "transparent",
                      color: tab === "social" ? (dark ? "#c080ff" : "#7c3aed") : (dark ? "#6a8aaa" : "#505870"),
                      fontWeight: tab === "social" ? 700 : 500,
                      borderLeft: `3px solid ${tab === "social" ? (dark ? "#c080ff" : "#7c3aed") : "transparent"}`,
                      borderRadius: "0 8px 8px 0",
                      marginBottom: 4,
                    }}>
                    <span style={{ fontSize: 15, lineHeight: 1 }}>📊</span>
                    <span style={{ fontSize: 13 }}>Dashboard</span>
                  </button>

                  {/* Per-platform sub-items */}
                  {(() => {
                    const connectedPlatforms: string[] = (client.metadata as any)?.socialPlatforms || [];
                    const platformDefs = [
                      { id: "Instagram", icon: "📸", color: "#E1306C" },
                      { id: "Facebook",  icon: "👍", color: "#1877F2" },
                      { id: "TikTok",    icon: "🎵", color: "#010101" },
                      { id: "LinkedIn",  icon: "💼", color: "#0A66C2" },
                      { id: "YouTube",   icon: "▶️", color: "#FF0000" },
                      { id: "Google Business", icon: "📍", color: "#4285F4" },
                    ];
                    const active = platformDefs.filter(p => connectedPlatforms.includes(p.id));
                    if (active.length === 0) return (
                      <div style={{ padding: "6px 12px", fontSize: 11, color: dark ? "#3a5070" : "#a0a8c0", lineHeight: 1.5 }}>
                        Your accounts are being set up — check back soon.
                      </div>
                    );
                    return (
                      <>
                        {active.map(p => (
                          <button key={p.id} className="wg-nav-item" onClick={() => setTab("social")}
                            style={{
                              background: "transparent",
                              color: dark ? "#5a7898" : "#606878",
                              fontWeight: 500,
                              borderLeft: `3px solid transparent`,
                              borderRadius: "0 8px 8px 0",
                              marginBottom: 1,
                              paddingLeft: 22,
                            }}>
                            <span style={{ fontSize: 13, lineHeight: 1 }}>{p.icon}</span>
                            <span style={{ fontSize: 12 }}>{p.id}</span>
                          </button>
                        ))}
                        {/* Add more platforms upsell */}
                        <button onClick={() => setTab("social")}
                          style={{ display: "flex", alignItems: "center", gap: 7, padding: "6px 12px 6px 22px", width: "100%", background: "none", border: "none", cursor: "pointer", fontFamily: "inherit" }}>
                          <span style={{ fontSize: 12, color: dark ? "#3a5070" : "#a0a8c0" }}>＋</span>
                          <span style={{ fontSize: 11, color: dark ? "#3a5070" : "#a0a8c0", fontWeight: 500 }}>Add platform</span>
                        </button>
                      </>
                    );
                  })()}
                </>
              ) : (
                /* Locked state — upsell */
                <button onClick={() => setTab("social")}
                  style={{ display: "flex", alignItems: "flex-start", gap: 10, width: "100%", background: dark ? "rgba(80,40,120,0.12)" : "rgba(124,58,237,0.05)", border: `1px dashed ${dark ? "rgba(120,60,200,0.25)" : "rgba(124,58,237,0.2)"}`, borderRadius: 9, padding: "12px", cursor: "pointer", fontFamily: "inherit", margin: "0 2px", textAlign: "left" }}>
                  <span style={{ fontSize: 18, flexShrink: 0 }}>🔒</span>
                  <div>
                    <div style={{ fontSize: 12, fontWeight: 700, color: dark ? "#8060c0" : "#7c3aed", marginBottom: 3 }}>Social Media Bundle</div>
                    <div style={{ fontSize: 11, color: dark ? "#4a4870" : "#9080b0", lineHeight: 1.5 }}>Instagram, Facebook, TikTok & more — fully managed posting.</div>
                    <div style={{ fontSize: 11, fontWeight: 700, color: dark ? "#a080e0" : "#7c3aed", marginTop: 6 }}>Learn more →</div>
                  </div>
                </button>
              )}
            </div>
          </div>

          {/* Sidebar footer */}
          <div style={{ padding: "12px 16px", borderTop: `1px solid ${sidebarBorder}` }}>
            <button onClick={toggleTheme} style={{ display: "flex", alignItems: "center", gap: 8, background: "none", border: "none", color: dark ? "#4a6080" : "#8090aa", fontSize: 12, cursor: "pointer", padding: "6px 0", width: "100%", fontFamily: "inherit" }}>
              <span>{dark ? "☀" : "🌙"}</span> {dark ? "Light mode" : "Dark mode"}
            </button>
            <button onClick={signOut} style={{ display: "flex", alignItems: "center", gap: 8, background: "none", border: "none", color: dark ? "#4a6080" : "#8090aa", fontSize: 12, cursor: "pointer", padding: "6px 0", width: "100%", fontFamily: "inherit" }}>
              <span>↩</span> Sign out
            </button>
          </div>
        </nav>

        {/* ── Main content area ──────────────────────────────────────────── */}
        <div className="wg-main-wrap">

          {/* Mobile top bar */}
          <div className="wg-mobile-topbar" style={{ background: C.navBg, borderBottomColor: C.navBorder }}>
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <div style={{ width: 28, height: 28, borderRadius: 8, background: "linear-gradient(135deg,#4f9eff,#a78bfa)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 12, fontWeight: 900, color: "#fff" }}>W</div>
              <span style={{ fontSize: 13, fontWeight: 700, color: dark ? "#c8d8f0" : "#0d1020" }}>{client.businessName}</span>
            </div>
            <div style={{ display: "flex", gap: 6 }}>
              <button onClick={toggleTheme} style={{ background: C.raised, border: `1px solid ${C.border}`, borderRadius: 7, width: 30, height: 30, display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer", fontSize: 13 }}>{dark ? "☀" : "🌙"}</button>
              <button onClick={signOut} style={{ background: "transparent", border: `1px solid ${C.border}`, color: C.textMuted, borderRadius: 7, padding: "5px 10px", fontSize: 11, cursor: "pointer", fontFamily: "inherit" }}>Out</button>
            </div>
          </div>

          {/* Desktop tab bar (still shown inside main area on desktop) */}
          <div data-tab-bar style={{ ...S.tabBar, display: "none" }} className="wg-desktop-tabs">
            {tabs.map(t => (
              <button key={t.id} style={S.tabBtn(tab === t.id)} onClick={() => setTab(t.id)}>
                <span className="wg-tab-icon">{t.icon}</span>
                <span className="wg-tab-label">{t.label}</span>
              </button>
            ))}
          </div>

          {/* ── Pay Now Banner ─────────────────────────────────────────── */}
          {paymentStatus && !paymentStatus.depositPaid && (
            <div style={{ background: "linear-gradient(135deg,#00c896,#0099ff)", padding: "13px 20px", display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, flexWrap: "wrap" as const }}>
              <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                <span style={{ fontSize: 18 }}>💳</span>
                <div>
                  <div style={{ color: "#000", fontWeight: 800, fontSize: 13, lineHeight: 1.2 }}>Pay your deposit to start your build</div>
                  <div style={{ color: "rgba(0,0,0,0.6)", fontSize: 11, marginTop: 1 }}>Nothing begins until the deposit is paid.</div>
                </div>
              </div>
              <button onClick={() => handlePay("deposit")} disabled={payLoading === "deposit"}
                style={{ background: "#000", color: "#fff", border: "none", borderRadius: 9, padding: "9px 20px", fontSize: 13, fontWeight: 800, cursor: "pointer", whiteSpace: "nowrap" as const, fontFamily: "inherit", opacity: payLoading === "deposit" ? 0.6 : 1 }}>
                {payLoading === "deposit" ? "Loading…" : "Pay Now →"}
              </button>
            </div>
          )}

      {/* ══════════════════════ SITE PREVIEW (full-width, outside padded body) ══════════════════════ */}
      {tab === "preview" && (
          <>
            {!paymentStatus?.previewUnlocked ? (
              <div style={{ margin: "20px 16px", background: C.surface, border: `1px solid ${C.border}`, borderRadius: 12, textAlign: "center", padding: "56px 24px" }}>
                <div style={{ width: 48, height: 48, borderRadius: 12, background: C.raised, border: `1px solid ${C.border}`, display: "flex", alignItems: "center", justifyContent: "center", margin: "0 auto 16px", fontSize: 22 }}>🔒</div>
                <div style={{ color: C.textSec, fontSize: 15, fontWeight: 500 }}>Preview coming soon</div>
                <div style={{ color: C.textMuted, fontSize: 13, marginTop: 6 }}>You'll receive an email when your site is ready to review.</div>
              </div>
            ) : client.jobId ? (
              <div style={{ display: "flex", flexDirection: "column", height: "calc(100vh - 112px)" }}>
                {/* iframe toolbar */}
                <div style={{ flex: 1, position: "relative", background: C.bg, borderBottom: `1px solid ${C.border}`, minHeight: 0 }}>
                  <div style={{ position: "absolute", top: 0, left: 0, right: 0, display: "flex", alignItems: "center", justifyContent: "space-between", padding: "0 12px", height: 42, background: C.surface, borderBottom: `1px solid ${C.border}`, zIndex: 10, gap: 8 }}>
                    <span style={{ color: C.textSec, fontWeight: 500, fontSize: 13 }}>Live preview — Round {feedbackRound}</span>
                    <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                      <button
                        onClick={() => setPreviewTs(Date.now())}
                        title="Reload preview"
                        style={{ background: C.raised, border: `1px solid ${C.border}`, color: C.textSec, borderRadius: 7, padding: "4px 10px", fontSize: 12, fontWeight: 600, cursor: "pointer", fontFamily: "inherit", display: "flex", alignItems: "center", gap: 5 }}>
                        ↻ Reload
                      </button>
                      {client.previewUrl && (
                        <a href={client.previewUrl} target="_blank" rel="noopener noreferrer"
                          style={{ color: C.accentBlue, fontSize: 12, textDecoration: "none", fontWeight: 600 }}>
                          Open in new tab ↗
                        </a>
                      )}
                    </div>
                  </div>
                  <iframe
                    key={`preview-${client.jobId}-${previewTs}`}
                    src={`/api/preview/proxy?slug=${slug}&v=${previewTs}`}
                    style={{ position: "absolute", top: 42, left: 0, width: "100%", height: "calc(100% - 42px)", border: "none" }}
                    title="Site Preview"
                  />
                </div>

                {/* Changes panel */}
                <div style={{ background: C.surface, borderTop: `1px solid ${C.border}`, padding: "14px 16px", flexShrink: 0 }}>
                  {revisionSent ? (
                    <div style={{ background: C.accent + "10", border: `1px solid ${C.accent}25`, borderRadius: 10, padding: "14px 18px", display: "flex", alignItems: "center", gap: 14 }}>
                      <div style={{ fontSize: 20 }}>✓</div>
                      <div>
                        <div style={{ color: C.accent, fontWeight: 600, fontSize: 14 }}>Changes submitted</div>
                        <div style={{ color: C.textMuted, fontSize: 13, marginTop: 2 }}>We're applying your changes. You'll get an email when the revised site is ready.</div>
                      </div>
                    </div>
                  ) : (
                    <>
                      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}>
                        <div style={{ color: C.text, fontWeight: 500, fontSize: 14 }}>Request changes</div>
                        <div style={{
                          fontSize: 11, fontWeight: 600,
                          color: feedback.length >= 10 ? C.red : feedback.length >= 8 ? C.amber : C.textMuted,
                          background: feedback.length >= 10 ? C.red + "12" : feedback.length >= 8 ? C.amber + "12" : C.raised,
                          border: `1px solid ${feedback.length >= 10 ? C.red + "25" : feedback.length >= 8 ? C.amber + "25" : C.border}`,
                          borderRadius: 6, padding: "3px 9px", letterSpacing: "0.02em",
                        }}>
                          {feedback.length}/10
                        </div>
                      </div>

                      {feedback.length > 0 && (
                        <div style={{ display: "flex", flexDirection: "column", gap: 6, marginBottom: 10, maxHeight: 180, overflowY: "auto" }}>
                          {feedback.map((f, i) => (
                            <EditableChange
                              key={f.id}
                              index={i}
                              item={f}
                              onUpdate={(newText) => setFeedback(prev => prev.map(x => x.id === f.id ? { ...x, text: newText } : x))}
                              onDelete={() => setFeedback(prev => prev.filter(x => x.id !== f.id))}
                            />
                          ))}
                        </div>
                      )}

                      {feedback.length < 10 && (
                        <div style={{ display: "flex", gap: 8, marginBottom: feedback.length > 0 ? 10 : 0 }}>
                          <input
                            type="text" value={feedbackText}
                            onChange={e => setFeedbackText(e.target.value)}
                            onKeyDown={e => e.key === "Enter" && submitFeedback()}
                            placeholder="e.g. Change the hero button to blue"
                            style={{ flex: 1, background: C.raised, border: `1px solid ${C.border}`, borderRadius: 8, padding: "10px 14px", color: C.text, fontSize: 13, outline: "none" }}
                          />
                          <button
                            onClick={submitFeedback}
                            disabled={feedbackSubmitting || !feedbackText.trim()}
                            style={{ background: "linear-gradient(135deg,#00c896,#0099ff)", color: "#000", border: "none", borderRadius: 8, padding: "10px 18px", fontSize: 13, fontWeight: 700, cursor: feedbackSubmitting || !feedbackText.trim() ? "not-allowed" : "pointer", opacity: feedbackSubmitting || !feedbackText.trim() ? 0.5 : 1 }}>
                            Add
                          </button>
                        </div>
                      )}

                      {feedback.length > 0 && (
                        <button
                          onClick={triggerRevision}
                          disabled={feedbackSubmitting}
                          style={{ width: "100%", background: feedback.length >= 10 ? "linear-gradient(135deg,#f59e0b,#ef4444)" : "linear-gradient(135deg,#00c896,#0099ff)", color: "#000", border: "none", borderRadius: 10, padding: "13px", fontSize: 14, fontWeight: 800, cursor: "pointer", opacity: feedbackSubmitting ? 0.6 : 1, marginTop: 2 }}>
                          {feedbackSubmitting ? "Submitting…" : `Submit ${feedback.length} Change${feedback.length !== 1 ? "s" : ""} for Revision →`}
                        </button>
                      )}

                      {feedback.length === 0 && (
                        <div style={{ color: C.textMuted, fontSize: 12, marginTop: 2 }}>First 10 changes are free. Additional changes are $15 each.</div>
                      )}
                      {feedback.length >= 10 && (
                        <div style={{ color: C.amber, fontSize: 11, marginTop: 8, textAlign: "center" }}>10 changes reached — submit now or remove some to add different ones.</div>
                      )}
                    </>
                  )}
                </div>
              </div>
            ) : (
              <div style={{ margin: "16px", background: C.surface, border: `1px solid ${C.border}`, borderRadius: 12, textAlign: "center", padding: "48px 24px" }}>
                <div style={{ fontSize: 36, marginBottom: 12 }}>🏗️</div>
                <div style={{ color: C.textMuted, fontSize: 15 }}>Your site is being built.</div>
              </div>
            )}
          </>
      )}

      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Space+Grotesk:wght@400;500;600;700&family=Inter:wght@400;500;600&family=JetBrains+Mono:wght@400;500&display=swap');
        *, *::before, *::after { box-sizing: border-box; }
        body { margin: 0; }
        @keyframes wg-fadeSlide { from { opacity: 0; transform: translateY(8px); } to { opacity: 1; transform: translateY(0); } }
        @keyframes wg-fade { from { opacity: 0 } to { opacity: 1 } }
        @keyframes wg-ping { 0%{transform:scale(1);opacity:.9} 100%{transform:scale(2.2);opacity:0} }
        @keyframes wg-float { 0%,100%{transform:translateY(0)} 50%{transform:translateY(-6px)} }
        @keyframes wg-spin { from{transform:rotate(0)} to{transform:rotate(360deg)} }
        .wg-tab { animation: wg-fadeSlide 0.22s cubic-bezier(0.34,1.1,0.64,1); }
        button, a { transition: opacity 0.15s ease, transform 0.14s ease, background 0.18s ease, box-shadow 0.18s ease !important; }
        button:hover:not(:disabled) { opacity: 0.88; }
        button:active:not(:disabled) { transform: scale(0.96) !important; }
        ::-webkit-scrollbar { width: 4px; height: 4px; }
        ::-webkit-scrollbar-track { background: transparent; }
        ::-webkit-scrollbar-thumb { background: #2a2a3a; border-radius: 99px; }
        input, textarea, select { font-family: inherit; }
        input:focus, textarea:focus, select:focus { outline: none; border-color: ${C.accent} !important; box-shadow: 0 0 0 3px ${C.accent}18 !important; }
        [data-tab-bar] button { outline: none; }
      `}</style>
      <div key={tab} className="wg-tab" style={tab === "preview" ? { display: "none" } : tab === "social" ? { padding: "20px 24px", maxWidth: "none", flex: 1, minHeight: 0, display: "flex", flexDirection: "column" } : S.body}>

        {/* ══════════════════════ OVERVIEW ══════════════════════ */}
        {tab === "overview" && (
          <>
            {/* Status */}
            <div style={{ background: client.launchReady ? C.accent+"10" : C.accentBlue+"0e", border: `1px solid ${client.launchReady ? C.accent+"30" : C.accentBlue+"25"}`, borderRadius: 12, padding: "16px 20px", marginBottom: 14, display: "flex", alignItems: "center", gap: 12, fontSize: 14, fontWeight: 700, color: client.launchReady ? C.accent : C.accentBlue, position:"relative", overflow:"hidden" }}>
              <div style={{ position:"absolute",top:0,right:0,width:120,height:60,background:`radial-gradient(circle at top right,${client.launchReady?C.accent:C.accentBlue}14,transparent 65%)`,pointerEvents:"none" }}/>
              {client.launchReady ? (
                <div style={{ position:"relative", width:8, height:8 }}>
                  <div style={{ position:"absolute", inset:0, borderRadius:"50%", background:C.accent, animation:"wg-ping 1.6s ease-in-out infinite", opacity:0.7 }}/>
                  <div style={{ position:"absolute", inset:0, borderRadius:"50%", background:C.accent }}/>
                </div>
              ) : <span style={{ fontSize:16 }}>⚡</span>}
              {client.launchReady ? "Your site is live!" : "Your website is being built"}
            </div>

            {/* Notifications */}
            {notifications.map((n, i) => (
              <div key={i} style={{ background: "#ffaa0010", border: "1px solid #ffaa0025", borderRadius: 8, padding: "10px 14px", marginBottom: 8, fontSize: 13, color: "#ffcc55" }}>{n}</div>
            ))}

            {/* SuperSaas setup checklist — shown when booking is enabled but sub-user not yet created */}
            {hasBooking && client.supersaasUrl && !client.supersaasUrl.includes("?user=") && (
              <div style={{ background: "#1a0e00", border: "1px solid rgba(251,191,36,0.3)", borderRadius: 10, padding: "14px 16px", marginBottom: 12 }}>
                <div style={{ fontSize: 13, fontWeight: 700, color: C.amber, marginBottom: 10 }}>📅 Booking Setup Checklist</div>
                <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                  {[
                    { done: true, text: "Booking section embedded on your site" },
                    { done: !!client.supersaasUrl && !client.supersaasUrl.includes("/template"), text: "Booking schedule created (supersaas.com/dashboard → New Schedule)" },
                    { done: false, text: "Configure your available hours in SuperSaas" },
                    { done: false, text: "Add your services/appointment types in SuperSaas" },
                    { done: false, text: "Add service dropdown to booking form (Configure → Form)" },
                    { done: false, text: "Set booking visibility to availability only (Configure → Access Control)" },
                    { done: false, text: "Test a booking end-to-end" },
                  ].map((item, i) => (
                    <div key={i} style={{ display: "flex", alignItems: "flex-start", gap: 10, fontSize: 13 }}>
                      <span style={{ color: item.done ? C.accent : C.amber, flexShrink: 0, marginTop: 1 }}>{item.done ? "✓" : "○"}</span>
                      <span style={{ color: item.done ? C.textMuted : C.textSec, textDecoration: item.done ? "line-through" : "none" }}>{item.text}</span>
                    </div>
                  ))}
                </div>
                <a href="https://www.supersaas.com/dashboard" target="_blank" rel="noopener noreferrer"
                  style={{ display: "inline-block", marginTop: 12, fontSize: 12, color: C.amber, textDecoration: "none", background: "rgba(251,191,36,0.1)", border: "1px solid rgba(251,191,36,0.2)", borderRadius: 6, padding: "6px 12px" }}>
                  Open SuperSaas Dashboard →
                </a>
              </div>
            )}

            {/* Stats */}
            {hasBooking && (
              <div style={{ display: "grid", gridTemplateColumns: "repeat(2,1fr)", gap: 10, marginBottom: 14 }}>
                {[
                  { n: upcomingBookings.length, l: "Upcoming", c: C.accent },
                  { n: bookingsThisMonth.length, l: "This month", c: C.accentBlue },
                  { n: `$${monthlyRevenue}`, l: "Monthly plan", c: C.purple },
                  { n: bookings.filter(b => b.status === "confirmed").length, l: "Total confirmed", c: C.amber },
                ].map(({ n, l, c }) => (
                  <div key={l} style={{ background: C.surface, border: `1px solid ${c}28`, borderRadius: 12, padding: "16px 18px 14px 22px", position: "relative", overflow: "hidden" }}>
                    <div style={{ position:"absolute", left:0, top:10, bottom:10, width:3, borderRadius:"0 3px 3px 0", background:`linear-gradient(180deg,${c},${c}55)` }}/>
                    <div style={{ position:"absolute", top:0, right:0, width:60, height:60, background:`radial-gradient(circle at top right,${c}14,transparent 65%)`, pointerEvents:"none" }}/>
                    <div style={{ fontSize: 26, fontWeight: 800, color: c, lineHeight: 1, marginBottom: 5, letterSpacing:"-0.03em" }}>{n}</div>
                    <div style={{ fontSize: 11, color: C.textMuted, fontWeight:600, letterSpacing:"0.04em", textTransform:"uppercase" as const }}>{l}</div>
                  </div>
                ))}
              </div>
            )}

            {/* Project details */}
            <div style={S.card}>
              <div style={S.label}>Your Project</div>
              <div style={{ display: "flex", flexWrap: "wrap", gap: 8, margin: "10px 0 14px" }}>
                <span style={S.pill("#0099ff")}>{client.industry}</span>
                <span style={S.pill(C.accent)}>{client.siteType === "multi" ? "Multi-page" : "Single page"}</span>
                {features.map(f => <span key={f} style={S.pill(C.purple)}>{f}</span>)}
              </div>

              {(() => {
                const rows: { label: string; value: string }[] = [];
                if (client.targetAudience) rows.push({ label: "Audience", value: client.targetAudience });
                if (client.goal) rows.push({ label: "Goal", value: client.goal });
                if (client.style) rows.push({ label: "Style", value: client.style });
                if (client.colorPrefs) rows.push({ label: "Colours", value: client.colorPrefs });
                if (client.pricingMethod) rows.push({ label: "Pricing", value: client.pricingMethod });
                if (client.references) rows.push({ label: "References", value: client.references });
                if (client.additionalNotes) rows.push({ label: "Notes", value: client.additionalNotes });
                if (client.businessAddress) rows.push({ label: "Address", value: client.businessAddress });
                if (client.facebookPage) rows.push({ label: "Facebook", value: client.facebookPage });
                if (client.abn) rows.push({ label: "ABN", value: client.abn });

                return rows.length > 0 ? (
                  <div style={{ display: "flex", flexDirection: "column", gap: 8, marginBottom: 14 }}>
                    {rows.map(r => (
                      <div key={r.label} style={{ display: "flex", gap: 10, fontSize: 13 }}>
                        <span style={{ color: C.textMuted, minWidth: 80, flexShrink: 0 }}>{r.label}</span>
                        <span style={{ color: C.textSec }}>{r.value}</span>
                      </div>
                    ))}
                  </div>
                ) : null;
              })()}

              {Array.isArray(client.pages) && (client.pages as string[]).length > 0 && (
                <div style={{ marginBottom: 14 }}>
                  <div style={{ ...S.label, marginBottom: 6 }}>Pages</div>
                  <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
                    {(client.pages as string[]).map(p => <span key={p} style={{ fontSize: 12, color: C.textSec, background: C.raised, border: `1px solid ${C.border}`, borderRadius: 6, padding: "3px 9px" }}>{p}</span>)}
                  </div>
                </div>
              )}

              <div style={S.divider} />

              <div style={{ display: "flex", justifyContent: "space-between", fontSize: 13, marginBottom: 8 }}>
                <span style={{ color: C.textMuted }}>Timeline</span>
                <span style={{ color: C.textSec }}>{getTimeline()}</span>
              </div>
              {client.domain && (
                <div style={{ display: "flex", justifyContent: "space-between", fontSize: 13 }}>
                  <span style={{ color: C.textMuted }}>Domain</span>
                  <span style={{ color: C.textSec }}>{client.domain}</span>
                </div>
              )}
            </div>

            {/* Feature modules quick-access */}
            {(hasBooking || hasBlog || hasShop || hasGallery || hasGrowth) && paymentStatus?.previewUnlocked && (
              <div style={S.card}>
                <div style={S.label}>Your Features</div>
                <div style={{ display: "flex", flexDirection: "column", gap: 8, marginTop: 8 }}>
                  {hasBooking && (
                    <a href={`/c/${slug}/bookings`} style={{ display: "flex", alignItems: "center", gap: 12, padding: "12px 14px", background: C.bg, border: `1px solid ${C.border}`, borderRadius: 10, textDecoration: "none" }}>
                      <span style={{ fontSize: 20 }}>📅</span>
                      <div>
                        <div style={{ fontSize: 13, fontWeight: 600, color: C.text }}>Bookings Dashboard</div>
                        <div style={{ fontSize: 12, color: C.textMuted }}>{upcomingBookings.length} upcoming · manage all appointments</div>
                      </div>
                      <span style={{ marginLeft: "auto", color: C.textMuted, fontSize: 14 }}>→</span>
                    </a>
                  )}
                  {hasShop && (
                    <div style={{ padding: "14px", background: C.bg, border: `1px solid ${C.border}`, borderRadius: 10 }}>
                      <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: squareConnected ? 0 : 12 }}>
                        <span style={{ fontSize: 20 }}>🛒</span>
                        <div style={{ flex: 1 }}>
                          <div style={{ fontSize: 13, fontWeight: 600, color: C.text }}>Online Shop & Payments</div>
                          <div style={{ fontSize: 12, color: C.textMuted }}>
                            {squareConnected
                              ? "Square connected — payments go straight to your account"
                              : client?.shopPaymentUrl
                              ? "Payment link active on your shop"
                              : "Add a payment link so customers can buy from your site"}
                          </div>
                        </div>
                        {squareConnected && <span style={{ ...S.pill(C.accent), fontSize: 11 }}>Square Connected</span>}
                        {!squareConnected && client?.shopPaymentUrl && <span style={{ ...S.pill(C.accent), fontSize: 11 }}>Active</span>}
                      </div>
                      {!squareConnected && (
                        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                          <div style={{ fontSize: 11, color: C.textMuted }}>
                            Paste any payment link — Square, Stripe, PayPal, bank transfer page, anything. Customers clicking "Buy Now" will be sent here.
                          </div>
                          <div style={{ display: "flex", gap: 8 }}>
                            <input
                              type="url"
                              placeholder="https://square.link/... or paypal.me/... or stripe.com/..."
                              value={shopPaymentUrl}
                              onChange={e => setShopPaymentUrl(e.target.value)}
                              style={{ flex: 1, background: C.raised, border: `1px solid ${C.border}`, borderRadius: 8, padding: "8px 12px", color: C.text, fontSize: 12, outline: "none" }}
                            />
                            <button
                              onClick={saveShopPaymentUrl}
                              disabled={shopPaymentSaving || !shopPaymentUrl.trim()}
                              style={{ background: shopPaymentSaving ? C.border : C.accentBlue, color: "#fff", fontWeight: 700, fontSize: 12, padding: "8px 16px", borderRadius: 8, border: "none", cursor: "pointer", whiteSpace: "nowrap" }}
                            >
                              {shopPaymentSaving ? "Saving..." : shopPaymentSaved ? "Saved" : "Save & Apply"}
                            </button>
                          </div>
                          <div style={{ fontSize: 11, color: C.textMuted }}>
                            Have a Square account?{" "}
                            <a href={`/api/square/connect?slug=${slug}&jobId=${client?.jobId}`} style={{ color: C.accentBlue, textDecoration: "none" }}>
                              Connect it instead
                            </a>
                          </div>
                        </div>
                      )}
                    </div>
                  )}
                  {hasBlog && (
                    <button onClick={() => setTab("content")} style={{ display: "flex", alignItems: "center", gap: 12, padding: "12px 14px", background: C.bg, border: `1px solid ${C.border}`, borderRadius: 10, cursor: "pointer", textAlign: "left" as const, width: "100%" }}>
                      <span style={{ fontSize: 20 }}>📰</span>
                      <div>
                        <div style={{ fontSize: 13, fontWeight: 600, color: C.text }}>Blog & Content</div>
                        <div style={{ fontSize: 12, color: C.textMuted }}>Request posts, newsletters & more</div>
                      </div>
                    </button>
                  )}
                  {hasGallery && (
                    <button onClick={() => setTab("upgrade")} style={{ display: "flex", alignItems: "center", gap: 12, padding: "12px 14px", background: C.bg, border: `1px solid ${C.border}`, borderRadius: 10, cursor: "pointer", textAlign: "left" as const, width: "100%" }}>
                      <span style={{ fontSize: 20 }}>🖼️</span>
                      <div>
                        <div style={{ fontSize: 13, fontWeight: 600, color: C.text }}>Photo Gallery</div>
                        <div style={{ fontSize: 12, color: C.textMuted }}>Upload new photos</div>
                      </div>
                    </button>
                  )}
                  {hasGrowth && (
                    <button onClick={() => setTab("content")} style={{ display: "flex", alignItems: "center", gap: 12, padding: "12px 14px", background: C.bg, border: `1px solid ${C.border}`, borderRadius: 10, cursor: "pointer", textAlign: "left" as const, width: "100%" }}>
                      <span style={{ fontSize: 20 }}>📈</span>
                      <div>
                        <div style={{ fontSize: 13, fontWeight: 600, color: C.text }}>Newsletter & Marketing</div>
                        <div style={{ fontSize: 12, color: C.textMuted }}>Request a newsletter campaign</div>
                      </div>
                    </button>
                  )}
                </div>
              </div>
            )}

            {/* Recent improvements */}
            <div style={S.card}>
              <div style={S.label}>Recent Improvements</div>
              <div style={{ display: "flex", flexDirection: "column", gap: 8, marginTop: 4 }}>
                {["Mobile layout optimised", "Page load speed improved", "SEO meta tags updated", "Accessibility improvements applied"].map((item, i) => (
                  <div key={i} style={{ display: "flex", alignItems: "center", gap: 10, fontSize: 13, color: C.textSec }}>
                    <span style={{ color: C.accent, fontSize: 11 }}>✓</span>{item}
                  </div>
                ))}
              </div>
            </div>

            {/* Report an Issue */}
            {paymentStatus?.previewUnlocked && (
              <div style={S.card}>
                <div style={S.label}>Report an Issue</div>
                <div style={{ color: C.textMuted, fontSize: 13, marginBottom: 12 }}>Noticed something broken or not working right? Let us know and we'll fix it.</div>
                {reportSent ? (
                  <div style={{ color: C.accent, fontSize: 13, fontWeight: 600 }}>✓ Report sent — we'll be in touch shortly.</div>
                ) : (
                  <>
                    <textarea
                      value={reportText}
                      onChange={e => setReportText(e.target.value)}
                      placeholder="Describe the issue you're experiencing…"
                      rows={3}
                      style={{ width: "100%", background: C.raised, border: `1px solid ${C.border}`, borderRadius: 8, padding: "10px 14px", color: C.text, fontSize: 13, outline: "none", resize: "vertical", fontFamily: "inherit", boxSizing: "border-box" as const, marginBottom: 8 }}
                    />
                    <button
                      onClick={submitReport}
                      disabled={reportSending || !reportText.trim()}
                      style={{ ...S.btn("secondary", reportSending || !reportText.trim()), width: "100%" }}
                    >
                      {reportSending ? "Sending…" : "Send Report"}
                    </button>
                  </>
                )}
              </div>
            )}

            <div style={{ ...S.card, background: "transparent", border: "1px solid #131b27" }}>
              <div style={{ color: C.textMuted, fontSize: 13 }}>Questions? <a href="mailto:hello@webgecko.au" style={{ color: C.textMuted }}>hello@webgecko.au</a></div>
            </div>
          </>
        )}

        {/* ══════════════════════ BOOKINGS ══════════════════════ */}
        {tab === "bookings" && hasBooking && (
          <BookingManager slug={slug} client={client} paymentStatus={paymentStatus} />
        )}

        {/* ══════════════════════ QUOTE & PAY ══════════════════════ */}
        {tab === "quote" && (
          <>
            {/* ── Social-only billing ── */}
            {isSocialOnly ? (
              <div style={{ display:"flex", flexDirection:"column", gap:16 }}>
                <div style={S.card}>
                  <div style={S.label}>Your Social Media Plan</div>
                  <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginTop:10 }}>
                    <div>
                      <div style={{ fontSize:20, fontWeight:800, color:C.text }}>
                        {((client?.metadata as any)?.socialPlan) || "Growth"} Plan
                      </div>
                      <div style={{ fontSize:13, color:C.textMuted, marginTop:4 }}>
                        Managed social media content & scheduling
                      </div>
                    </div>
                    <div style={{ textAlign:"right" }}>
                      <div style={{ fontSize:26, fontWeight:800, color:C.accent }}>
                        ${((client?.metadata as any)?.socialPrice) || "499"}
                      </div>
                      <div style={{ fontSize:12, color:C.textMuted }}>/month</div>
                    </div>
                  </div>
                </div>
                <div style={{ ...S.card, background:C.accentBg, borderColor:`${C.accent}30` }}>
                  <div style={{ display:"flex", gap:12, alignItems:"flex-start" }}>
                    <span style={{ fontSize:24 }}>📱</span>
                    <div>
                      <div style={{ fontSize:14, fontWeight:700, color:C.text, marginBottom:4 }}>Set up billing — we&apos;ll be in touch</div>
                      <div style={{ fontSize:13, color:C.textMuted, lineHeight:1.6 }}>
                        Social media billing is handled directly with your account manager. We&apos;ll contact you via email to set up your monthly subscription and confirm your plan details.
                      </div>
                      <div style={{ fontSize:12, color:C.textMuted, marginTop:10 }}>
                        Questions? Email us at <a href="mailto:hello@webgecko.au" style={{ color:C.accent }}>hello@webgecko.au</a>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            ) : (
              /* ── Website billing — clean single-column layout ── */
              <>
                {/* Pre-pay details form */}
                {(()=>{
                  const missingAbn = !prePayAbn.trim();
                  const missingDomain = !prePayDomain.trim();
                  const missingAddress = !prePayAddress.trim();
                  const anyMissing = missingAbn || missingDomain || missingAddress;
                  if (!anyMissing && paymentStatus?.depositPaid) return null;
                  const fields = [
                    { key:"abn", label:"ABN", placeholder:"e.g. 12 345 678 901", value:prePayAbn, onChange:setPrePayAbn, hint:"Required to register your .com.au domain.", missing:missingAbn },
                    { key:"domain", label:"Preferred Domain Name", placeholder:"e.g. mysalonbrisbane.com.au", value:prePayDomain, onChange:setPrePayDomain, hint:"Already have one? Enter it here. Don't have one? We'll register it for you.", missing:missingDomain },
                    { key:"address", label:"Business Address", placeholder:"e.g. 9 Kondalilla Parade, Forest Lake QLD 4078", value:prePayAddress, onChange:setPrePayAddress, hint:"Used to embed a Google Map so customers can find you.", missing:missingAddress },
                    { key:"ga4", label:"Google Analytics ID (optional)", placeholder:"G-XXXXXXXXXX", value:prePayGa4, onChange:setPrePayGa4, hint:"Don't have one yet? No problem — leave blank and add it anytime.", missing:false },
                  ];
                  return (
                    <div style={{ ...S.card, borderColor: anyMissing ? C.amber+"50" : C.accent+"30", marginBottom:0 }}>
                      <div style={{ display:"flex", alignItems:"center", gap:10, marginBottom:14 }}>
                        <div style={{ width:32,height:32,borderRadius:8,background:anyMissing?C.amber+"18":C.accentBg,border:`1px solid ${anyMissing?C.amber+"40":C.accent+"30"}`,display:"flex",alignItems:"center",justifyContent:"center",fontSize:15,flexShrink:0 }}>
                          {anyMissing ? "📋" : "✓"}
                        </div>
                        <div>
                          <div style={{ fontSize:14, fontWeight:700, color:C.text }}>
                            {paymentStatus?.depositPaid ? "Business Details" : "Before You Pay"}
                          </div>
                          <div style={{ fontSize:12, color:C.textMuted, marginTop:1 }}>
                            {anyMissing ? "Fill in these details so we can register your domain." : "All details saved."}
                          </div>
                        </div>
                      </div>
                      {fields.map(f => (
                        <div key={f.key} style={{ marginBottom:12 }}>
                          <div style={{ fontSize:11, fontWeight:600, color:f.missing?C.amber:C.textSec, marginBottom:4, display:"flex", alignItems:"center", gap:4 }}>
                            {f.label}
                            {f.missing && <span style={{ fontSize:10, color:C.amber, background:C.amber+"18", borderRadius:4, padding:"1px 6px" }}>needed</span>}
                          </div>
                          <input type="text" placeholder={f.placeholder} value={f.value} onChange={e => f.onChange(e.target.value)}
                            style={{ width:"100%", background:C.raised, border:`1px solid ${f.missing?C.amber+"50":C.border}`, borderRadius:8, padding:"9px 12px", color:C.text, fontSize:13, outline:"none", boxSizing:"border-box" as const, fontFamily:"inherit" }}/>
                          <div style={{ fontSize:11, color:C.textMuted, marginTop:3 }}>{f.hint}</div>
                        </div>
                      ))}
                      <button onClick={savePrePayDetails} disabled={prePaySaving}
                        style={{ background:prePaySaved?C.accent:C.accentBlue, color:prePaySaved?"#000":"#fff", fontWeight:700, fontSize:13, padding:"10px 18px", borderRadius:9, border:"none", cursor:"pointer", width:"100%", marginTop:4, fontFamily:"inherit" }}>
                        {prePaySaving ? "Saving…" : prePaySaved ? "✓ Details Saved" : "Save Details"}
                      </button>
                    </div>
                  );
                })()}

                {/* Payment section */}
                {!paymentStatus ? (
                  <div style={{ ...S.card, textAlign:"center", padding:32 }}><div style={{ color:C.textMuted, fontSize:14 }}>Loading…</div></div>
                ) : paymentStatus.monthlyActive ? (
                  <div style={{ ...S.card, background:C.accentBg, borderColor:`${C.accent}30`, textAlign:"center", padding:"36px 24px" }}>
                    <div style={{ width:56,height:56,borderRadius:"50%",background:C.accent+"22",border:`2px solid ${C.accent}40`,display:"flex",alignItems:"center",justifyContent:"center",margin:"0 auto 16px",fontSize:26 }}>{"✓"}</div>
                    <div style={{ fontSize:18, fontWeight:800, color:C.accent, marginBottom:8 }}>All payments complete</div>
                    <div style={{ fontSize:13, color:C.textMuted, lineHeight:1.6 }}>Your site is live and monthly hosting is active.</div>
                  </div>
                ) : (
                  <div style={{ display:"flex", flexDirection:"column", gap:12 }}>
                    {/* Quote summary row */}
                    {client.quote && (
                      <div style={{ ...S.card, padding:"18px 20px" }}>
                        <div style={{ display:"flex", justifyContent:"space-between", alignItems:"flex-start", marginBottom:12 }}>
                          <div>
                            <div style={{ fontSize:12, fontWeight:700, color:C.textMuted, textTransform:"uppercase" as const, letterSpacing:"0.08em", marginBottom:4 }}>{client.quote.package} Package</div>
                            <div style={{ fontSize:30, fontWeight:800, color:C.text, letterSpacing:"-0.03em" }}>${client.quote.price.toLocaleString()}</div>
                            <div style={{ fontSize:12, color:C.textMuted, marginTop:2 }}>+ $109/mo for 3 months, then $119/mo</div>
                          </div>
                          <div style={{ background:C.accent+"15", border:`1px solid ${C.accent}30`, borderRadius:8, padding:"6px 12px", fontSize:12, color:C.accent, fontWeight:600, textAlign:"right", flexShrink:0 }}>
                            Saving ${client.quote.savings.toLocaleString()}
                          </div>
                        </div>
                        <div style={{ borderTop:`1px solid ${C.border}`, paddingTop:10 }}>
                          {client.quote.breakdown.map((line:string) => (
                            <div key={line} style={{ display:"flex", justifyContent:"space-between", padding:"4px 0", fontSize:12, color:C.textMuted }}>
                              <span>{line.split(":")[0]}</span><span style={{ fontWeight:600, color:C.textSec }}>{line.split(":")[1]}</span>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Payment steps */}
                    {[
                      { key:"deposit" as const, step:1, label:"50% Deposit", sub:"Kicks off your website build", amount:paymentStatus.quote.deposit, done:paymentStatus.depositPaid, active:!paymentStatus.depositPaid, btnLabel:"Pay Deposit", locked:false },
                      { key:"final" as const,   step:2, label:"50% Final Payment", sub:paymentStatus.finalUnlocked?"Your revision is approved — pay to go live":"Unlocked after revision approval", amount:paymentStatus.quote.final, done:paymentStatus.finalPaid, active:paymentStatus.depositPaid&&!paymentStatus.finalPaid, btnLabel:"Pay Final & Go Live", locked:paymentStatus.depositPaid&&!paymentStatus.finalPaid&&!paymentStatus.finalUnlocked },
                      { key:"monthly" as const, step:3, label:"Monthly Hosting", sub:"First month included · $109/mo for 3 months, then $119/mo", amount:null, done:paymentStatus.monthlyActive, active:paymentStatus.finalPaid&&!paymentStatus.monthlyActive, btnLabel:"", locked:false },
                    ].map((step) => (
                      <div key={step.key} style={{ ...S.card, padding:"18px 20px",
                        borderColor: step.done ? `${C.accent}40` : step.active && !step.locked ? `${C.accentBlue}40` : C.border,
                        opacity: !step.done && !step.active ? 0.55 : 1,
                        transition:"opacity 0.2s, border-color 0.2s" }}>
                        <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between", marginBottom: (step.active && !step.locked && step.key !== "monthly") ? 16 : 0 }}>
                          <div style={{ display:"flex", alignItems:"center", gap:12 }}>
                            <div style={{ width:36,height:36,borderRadius:"50%",flexShrink:0,display:"flex",alignItems:"center",justifyContent:"center",
                              background: step.done ? C.accent+"22" : step.active && !step.locked ? C.accentBlue+"20" : C.raised,
                              border:`2px solid ${step.done ? C.accent : step.active && !step.locked ? C.accentBlue : C.border}` }}>
                              {step.done
                                ? <span style={{ color:C.accent, fontWeight:800, fontSize:14 }}>{"✓"}</span>
                                : <span style={{ fontSize:13, fontWeight:700, color: step.active && !step.locked ? C.accentBlue : C.textMuted }}>{step.step}</span>}
                            </div>
                            <div>
                              <div style={{ fontSize:14, fontWeight:700, color: step.done ? C.accent : step.active ? C.text : C.textMuted }}>{step.label}</div>
                              <div style={{ fontSize:12, color:C.textMuted, marginTop:1 }}>{step.sub}</div>
                            </div>
                          </div>
                          {step.amount !== null && (
                            <div style={{ fontSize:20, fontWeight:800, color: step.done ? C.accent : step.active ? C.text : C.textMuted, letterSpacing:"-0.02em", flexShrink:0 }}>
                              ${step.amount.toLocaleString()}
                            </div>
                          )}
                        </div>
                        {step.active && !step.locked && step.key !== "monthly" && (
                          <button onClick={() => handlePay(step.key)} disabled={payLoading === step.key}
                            style={{ ...S.payBtn(true), width:"100%", fontSize:14, fontWeight:700, padding:"13px" }}>
                            {payLoading === step.key ? "Loading…" : step.btnLabel + " →"}
                          </button>
                        )}
                        {step.locked && (
                          <div style={{ ...S.lockBox, marginTop:12 }}>{"🔒"} Locked — awaiting revision approval</div>
                        )}
                      </div>
                    ))}
                    <div style={{ color:C.textMuted, fontSize:11, textAlign:"center" as const }}>Payments processed securely by Square · WebGecko never stores card details</div>
                  </div>
                )}
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
                  <div style={{ fontSize: 18, fontWeight: 700, color: C.text }}>{client.quote?.package || "Standard"} Plan</div>
                  <div style={{ fontSize: 13, color: C.textMuted, marginTop: 2 }}>Hosting, maintenance & ongoing updates</div>
                </div>
                <div style={{ textAlign: "right" }}>
                  <div style={{ fontSize: 22, fontWeight: 800, color: C.accent }}>$109</div>
                  <div style={{ fontSize: 12, color: C.textMuted }}>/month</div>
                  <div style={{ fontSize: 10, color: C.textMuted, marginTop: 1 }}>then $119/mo</div>
                </div>
              </div>
              <div style={S.divider} />
              {["Fast Australian hosting", "Monthly site improvements", "10 free site changes/month", "SEO & performance updates", "Priority email support"].map((item, i) => (
                <div key={i} style={{ display: "flex", alignItems: "center", gap: 10, fontSize: 13, color: C.textSec, marginBottom: 8 }}>
                  <span style={{ color: C.accent, fontSize: 11 }}>✓</span>{item}
                </div>
              ))}
            </div>

            {/* What's included */}
            <div style={S.card}>
              <div style={S.label}>What You Get</div>
              <div style={{ display: "flex", flexDirection: "column", gap: 14, marginTop: 10 }}>
                {[
                  { icon: "🔧", title: "Monthly Fix Pass", desc: "Our team reviews and improves your site every month automatically." },
                  { icon: "📈", title: "SEO & Speed Updates", desc: "We keep your site fast, indexed, and discoverable." },
                  { icon: "✏️", title: "Site Change Requests", desc: "Request changes anytime from the Site Preview tab. First 10 are free each month." },
                ].map(({ icon, title, desc }) => (
                  <div key={title} style={{ display: "flex", gap: 12 }}>
                    <div style={{ fontSize: 20 }}>{icon}</div>
                    <div>
                      <div style={{ fontSize: 13, fontWeight: 600, color: C.text }}>{title}</div>
                      <div style={{ fontSize: 12, color: C.textMuted, marginTop: 2 }}>{desc}</div>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Plan tiers */}
            {!showSubModal && (
              <div style={S.card}>
                <div style={S.label}>Your Hosting Plan</div>
                <div style={{ background: C.bg, border: "2px solid #00c89640", borderRadius: 12, padding: "20px 18px", marginTop: 10 }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 12 }}>
                    <div>
                      <div style={{ fontSize: 13, fontWeight: 700, color: C.accent, marginBottom: 4 }}>Standard Hosting</div>
                      <div style={{ fontSize: 28, fontWeight: 800, color: C.text, lineHeight: 1 }}>$109<span style={{ fontSize: 13, color: C.textMuted, fontWeight: 400 }}>/mo</span></div>
                      <div style={{ fontSize: 11, color: C.textMuted, marginTop: 3 }}>Intro rate — first 3 months</div>
                    </div>
                    <div style={{ background: "#00c89615", border: "1px solid #00c89630", borderRadius: 20, padding: "4px 12px", fontSize: 11, fontWeight: 700, color: C.accent }}>ACTIVE</div>
                  </div>
                  <div style={{ height: 1, background: C.border, margin: "12px 0" }} />
                  {["Hosting & SSL", "Site changes on request", "Monthly fix pass", "SEO updates", "Email support"].map(f => (
                    <div key={f} style={{ fontSize: 12, color: C.textMuted, display: "flex", alignItems: "center", gap: 6, marginBottom: 6 }}>
                      <span style={{ color: C.accent, fontSize: 10 }}>✓</span>{f}
                    </div>
                  ))}
                  <div style={{ marginTop: 14, background: C.raised, border: `1px solid ${C.border}`, borderRadius: 8, padding: "10px 14px", fontSize: 12, color: C.textMuted }}>
                    After 3 months, plan renews at <span style={{ color: C.text, fontWeight: 600 }}>$119/mo</span>. Email us anytime to discuss your plan.
                  </div>
                  <a href={`mailto:hello@webgecko.au?subject=${encodeURIComponent("Plan query — " + client.businessName)}&body=${encodeURIComponent("Hi, I wanted to ask about my hosting plan.\n\nBusiness: " + client.businessName)}`}
                    style={{ display: "block", textAlign: "center", marginTop: 12, background: C.raised, border: `1px solid ${C.border}`, color: C.textSec, borderRadius: 8, padding: "9px 0", fontSize: 12, fontWeight: 600, textDecoration: "none" }}>
                    Contact us about your plan
                  </a>
                </div>
                <div style={{ fontSize: 11, color: C.textMuted, textAlign: "center", marginTop: 12 }}>Plan changes take effect after your current paid month ends.</div>
              </div>
            )}

            {/* Manage subscription */}
            {!showSubModal ? (
              <div style={{ ...S.card, background: "transparent", border: "1px solid #131b27" }}>
                <div style={{ fontSize: 13, color: C.textMuted, marginBottom: 10 }}>Want to cancel or change something else?</div>
                <button onClick={() => { setShowSubModal(true); setSubStep("reason"); setCancelOption(null); setCancelReason(""); }} style={{ ...S.btn("ghost"), fontSize: 13 }}>Manage subscription</button>
              </div>
            ) : (
              <div style={S.card}>

                {/* Step 1 — Reason */}
                {subStep === "reason" && (
                  <>
                    <div style={{ fontWeight: 700, fontSize: 15, color: C.text, marginBottom: 4 }}>What's on your mind?</div>
                    <div style={{ color: C.textMuted, fontSize: 13, marginBottom: 16 }}>Tell us what's changed and we'll find the right option.</div>
                    {[
                      { r: "too-expensive", label: "💰 It's too expensive right now" },
                      { r: "not-using", label: "😴 I'm not using it enough" },
                      { r: "unhappy", label: "😕 I'm not happy with the site" },
                      { r: "switching", label: "🔄 I'm moving to another provider" },
                      { r: "closing", label: "🚪 My business is closing" },
                      { r: "other", label: "💬 Something else" },
                    ].map(({ r, label }) => (
                      <button key={r} onClick={() => { setCancelReason(r); setSubStep("option"); }}
                        style={{ display: "block", width: "100%", textAlign: "left", background: cancelReason === r ? C.raised : C.bg, border: `1px solid ${C.border}`, borderRadius: 8, padding: "12px 14px", fontSize: 13, color: C.textSec, cursor: "pointer", marginBottom: 8 }}>
                        {label}
                      </button>
                    ))}
                    <button onClick={() => setShowSubModal(false)} style={{ ...S.btn("ghost"), marginTop: 4, fontSize: 13 }}>Never mind</button>
                  </>
                )}

                {/* Step 2 — Options based on reason */}
                {subStep === "option" && (
                  <>
                    <div style={{ fontWeight: 700, fontSize: 15, color: C.text, marginBottom: 4 }}>
                      {cancelReason === "too-expensive" ? "Let's find something that works" :
                       cancelReason === "not-using" ? "Want to pause instead?" :
                       cancelReason === "unhappy" ? "Let us fix it first" :
                       "Here are your options"}
                    </div>
                    <div style={{ color: C.textMuted, fontSize: 13, marginBottom: 16 }}>
                      {cancelReason === "too-expensive" ? "We can pause your plan or reduce your tier. Email us — we'd rather work something out than lose you." :
                       cancelReason === "not-using" ? "You can pause for up to 2 months at no cost. Your site stays live, billing resumes after." :
                       cancelReason === "unhappy" ? "We'll fix it at no extra cost — use the Site Preview tab to submit changes. If you're still not happy after, we'll sort it out." :
                       cancelReason === "switching" ? "No problem — we'll make it easy. Choose a handover option below." :
                       cancelReason === "closing" ? "Sorry to hear that. We'll remove everything at no charge." :
                       "Choose how you'd like to leave."}
                    </div>

                    {/* Switching provider — show full info panel */}
                    {cancelReason === "switching" && (
                      <div style={{ background: dark ? "rgba(79,158,255,0.06)" : "rgba(37,99,235,0.04)", border: `1px solid ${C.accentBlue}30`, borderRadius: 12, padding: "14px 16px", marginBottom: 16 }}>
                        <div style={{ fontSize: 13, fontWeight: 700, color: C.accentBlue, marginBottom: 8 }}>What happens when you leave</div>
                        <div style={{ display: "flex", flexDirection: "column" as const, gap: 8, fontSize: 12, color: C.textSec }}>
                          <div style={{ display: "flex", gap: 8 }}><span>✅</span><span><strong>Stopping our management is completely free</strong> — no charge to close out your account.</span></div>
                          {isSocialOnly
                            ? <div style={{ display: "flex", gap: 8 }}><span>📱</span><span>For a one-off fee of <strong>$299</strong>, we transfer your Gmail, reset all platform passwords, and send you signed proof of sign-out — all accounts and followers are yours.</span></div>
                            : <div style={{ display: "flex", gap: 8 }}><span>📦</span><span>If you want your files or domain transferred, we offer handover packages (see below).</span></div>
                          }
                          <div style={{ display: "flex", gap: 8 }}><span>🔄</span><span><strong>Want to come back later?</strong> You're welcome to — but rejoining means starting fresh: the same setup process, the same rate, and a new build fee. There are no shortcuts back in.</span></div>
                        </div>
                      </div>
                    )}

                    {/* Closing business — just remove for free */}
                    {cancelReason === "closing" && (
                      <div style={{ background: dark ? "rgba(239,68,68,0.06)" : "rgba(239,68,68,0.04)", border: `1px solid #ef444430`, borderRadius: 12, padding: "14px 16px", marginBottom: 16 }}>
                        <div style={{ fontSize: 13, fontWeight: 700, color: "#ef4444", marginBottom: 6 }}>We're sorry to hear that</div>
                        <div style={{ fontSize: 12, color: C.textSec }}>We'll remove your site and close your account at no charge. If you ever start a new venture, we'd love to help you again.</div>
                      </div>
                    )}

                    {(cancelReason === "too-expensive" || cancelReason === "not-using" || cancelReason === "unhappy") && (
                      <div style={{ marginBottom: 16 }}>
                        {cancelReason === "unhappy" && (
                          <button onClick={() => { setShowSubModal(false); setTab("preview"); }} style={{ ...S.btn("primary"), width: "100%", marginBottom: 10, fontSize: 13 }}>
                            Request Changes Now
                          </button>
                        )}
                        <a href={`mailto:hello@webgecko.au?subject=${encodeURIComponent("Plan query — " + client.businessName)}&body=${encodeURIComponent("Hi, I wanted to discuss my plan.\n\nBusiness: " + client.businessName)}`}
                          style={{ ...S.btn("secondary"), textDecoration: "none", width: "100%", display: "flex", fontSize: 13, marginBottom: 10 }}>
                          Talk to Us First
                        </a>
                      </div>
                    )}

                    <div style={{ ...S.label, marginTop: 8 }}>Choose an option</div>
                    {(isSocialOnly ? SOCIAL_CANCEL_OPTIONS : CANCEL_OPTIONS).map(opt => (
                      <button key={opt.id} onClick={() => { setCancelOption(opt); setSubStep("confirm"); }}
                        style={{ display: "block", width: "100%", textAlign: "left", background: C.bg, border: `1px solid ${C.border}`, borderRadius: 10, padding: "14px 16px", fontSize: 13, color: C.textSec, cursor: "pointer", marginBottom: 10 }}>
                        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 8 }}>
                          <div style={{ display: "flex", gap: 10 }}>
                            <span style={{ fontSize: 20 }}>{opt.icon}</span>
                            <div>
                              <div style={{ fontWeight: 600, color: C.text, marginBottom: 4 }}>{opt.label}</div>
                              <div style={{ fontSize: 12, color: C.textMuted }}>{opt.desc}</div>
                            </div>
                          </div>
                          <div style={{ flexShrink: 0, textAlign: "right" }}>
                            <div style={{ fontSize: 12, fontWeight: 600, color: opt.id === "remove" ? C.accent : "#ffcc55", whiteSpace: "nowrap" }}>
                              {opt.priceLabel(buildPrice)}
                            </div>
                          </div>
                        </div>
                      </button>
                    ))}
                    <button onClick={() => setSubStep("reason")} style={{ ...S.btn("ghost"), fontSize: 13 }}>Back</button>
                  </>
                )}

                {/* Step 3 — Confirm */}
                {subStep === "confirm" && cancelOption && (
                  <>
                    <div style={{ fontWeight: 700, fontSize: 15, color: C.text, marginBottom: 4 }}>Confirm your choice</div>
                    <div style={{ background: C.bg, border: `1px solid ${C.border}`, borderRadius: 10, padding: "16px", marginBottom: 16 }}>
                      <div style={{ display: "flex", gap: 10, alignItems: "center", marginBottom: 8 }}>
                        <span style={{ fontSize: 24 }}>{cancelOption.icon}</span>
                        <div style={{ fontSize: 14, fontWeight: 600, color: C.text }}>{cancelOption.label}</div>
                      </div>
                      <div style={{ fontSize: 13, color: C.textMuted, marginBottom: 8 }}>{cancelOption.desc}</div>
                      <div style={{ display: "flex", justifyContent: "space-between", paddingTop: 10, borderTop: `1px solid ${C.border}` }}>
                        <span style={{ fontSize: 13, color: C.textMuted }}>Exit fee</span>
                        <span style={{ fontSize: 14, fontWeight: 700, color: cancelOption.id === "remove" ? C.accent : "#ffcc55" }}>
                          {cancelOption.priceCalc(buildPrice) === 0 ? "Free" : `$${cancelOption.priceCalc(buildPrice).toLocaleString()}`}
                        </span>
                      </div>
                    </div>
                    {cancelOption.id === "remove" && (
                      <div style={{ background: dark ? "rgba(0,200,150,0.06)" : "rgba(0,200,150,0.04)", border: `1px solid #00c89630`, borderRadius: 10, padding: "12px 14px", marginBottom: 14, fontSize: 12, color: C.textSec }}>
                        <strong style={{ color: C.accent }}>No charge for removal.</strong> We'll close your account and take the site offline within 30 days. If you ever come back, you'll go through the full setup process at the standard rate.
                      </div>
                    )}
                    {cancelOption.id === "social_handover" && (
                      <div style={{ background: dark ? "rgba(168,85,247,0.06)" : "rgba(124,58,237,0.04)", border: `1px solid #a855f730`, borderRadius: 10, padding: "12px 14px", marginBottom: 14, fontSize: 12, color: C.textSec }}>
                        <strong style={{ color: "#a855f7" }}>What happens next:</strong>
                        <div style={{ marginTop: 8, display: "flex", flexDirection: "column" as const, gap: 6 }}>
                          <div style={{ display: "flex", gap: 8 }}><span>1.</span><span>We sign out of all connected social platforms and the Gmail account.</span></div>
                          <div style={{ display: "flex", gap: 8 }}><span>2.</span><span>We reset the Gmail password and send it to your registered email address.</span></div>
                          <div style={{ display: "flex", gap: 8 }}><span>3.</span><span>We email you a signed confirmation with screenshots as proof of sign-out.</span></div>
                          <div style={{ display: "flex", gap: 8 }}><span>4.</span><span>All accounts, content, and followers are yours — we retain no access.</span></div>
                        </div>
                      </div>
                    )}
                    {cancelOption.id === "social_remove" && (
                      <div style={{ background: dark ? "rgba(0,200,150,0.06)" : "rgba(0,200,150,0.04)", border: `1px solid #00c89630`, borderRadius: 10, padding: "12px 14px", marginBottom: 14, fontSize: 12, color: C.textSec }}>
                        <strong style={{ color: C.accent }}>No charge.</strong> We stop all posting and management immediately. The accounts remain under our Gmail and go dormant — we will not post or access them. You can request a full handover at any time for $299.
                      </div>
                    )}
                    {/* Legal notice */}
                    <div style={{ background: dark ? "rgba(255,255,255,0.02)" : "rgba(0,0,0,0.02)", border: `1px solid ${C.border}`, borderRadius: 8, padding: "10px 14px", marginBottom: 14, fontSize: 11, color: C.textMuted, lineHeight: 1.6 }}>
                      <strong style={{ color: C.textSec }}>Terms & conditions:</strong> By submitting this request you acknowledge that: (a) cancellation takes effect at the end of your current billing period; (b) no refunds are issued for partial months; (c) WebGecko retains no liability for any loss of followers, engagement, or account standing after handover; (d) re-engagement with WebGecko services requires a new agreement at prevailing rates; (e) this request is not legally binding until confirmed in writing by WebGecko.
                    </div>
                    {cancelOption.id !== "remove" && cancelOption.id !== "social_remove" && (
                      <div style={{ fontSize: 12, color: C.textMuted, marginBottom: 16 }}>
                        Clicking below sends a request to our team. We'll confirm and invoice within 1 business day.
                      </div>
                    )}
                    {(cancelOption.id === "remove" || cancelOption.id === "social_remove") && (
                      <div style={{ fontSize: 12, color: C.textMuted, marginBottom: 16 }}>
                        Clicking below sends your removal request. We'll confirm within 1 business day and begin offboarding.
                      </div>
                    )}
                    <a
                      href={`mailto:hello@webgecko.au?subject=${encodeURIComponent((cancelOption.id === "remove" || cancelOption.id === "social_remove" ? "Removal request" : cancelOption.id === "social_handover" ? "Social handover request" : "Cancellation") + " — " + client.businessName + " — " + cancelOption.label)}&body=${encodeURIComponent("Hi WebGecko,\n\n" + (cancelOption.id === "social_handover" ? "I would like to proceed with the full social account handover." : cancelOption.id === "social_remove" ? "I would like to stop social media management. No handover required." : cancelOption.id === "remove" ? "I'd like to be removed from the system." : "I'd like to cancel.") + "\n\nBusiness: " + client.businessName + "\nOption: " + cancelOption.label + "\nReason: " + cancelReason + (cancelOption.priceCalc(buildPrice) > 0 ? "\nFee: $" + cancelOption.priceCalc(buildPrice).toLocaleString() : "") + "\n\nI acknowledge the terms and conditions outlined in the cancellation flow.")}`}
                      style={{ ...S.btn(cancelOption.id === "remove" || cancelOption.id === "social_remove" ? "secondary" : cancelOption.id === "social_handover" ? "primary" : "danger"), textDecoration: "none", width: "100%", display: "flex", fontSize: 13, marginBottom: 10 }}>
                      {cancelOption.id === "remove" ? "Send Removal Request" : cancelOption.id === "social_remove" ? "Stop Social Management" : cancelOption.id === "social_handover" ? "Request Account Handover →" : "Send Cancellation Request"}
                    </a>
                    <button onClick={() => setShowSubModal(false)} style={{ ...S.btn("secondary"), width: "100%", fontSize: 13 }}>Keep my plan</button>
                    <button onClick={() => setSubStep("option")} style={{ ...S.btn("ghost"), width: "100%", fontSize: 13 }}>← Back</button>
                  </>
                )}
              </div>
            )}

          </>
        )}

        {/* ══════════════════════ ADD FEATURES ══════════════════════ */}
        {tab === "content" && (
          <>
            <div style={S.card}>
              <div style={S.label}>Your Content</div>
              <div style={{ color: C.textMuted, fontSize: 13, lineHeight: 1.6 }}>Request new content for your site. We create and publish it within 1-2 business days.</div>
            </div>

            {myContentItems.length > 0 && (
              <div style={S.card}>
                <div style={S.label}>Published Content</div>
                <div style={{ display: "flex", flexDirection: "column", gap: 8, marginTop: 4 }}>
                  {contentItemsLoading && <div style={{ color: C.textMuted, fontSize: 13 }}>Loading...</div>}
                  {myContentItems.map((item: any) => (
                    <div key={item.id} style={{ display: "flex", alignItems: "center", gap: 12, padding: "10px 14px", background: C.raised, border: `1px solid ${C.border}`, borderRadius: 10 }}>
                      <span style={{ fontSize: 18 }}>{item.type === "blog" ? "📰" : item.type === "newsletter" ? "✉️" : item.type === "deal" ? "🏷️" : item.type === "product" ? "🛍️" : "⭐"}</span>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ fontSize: 13, fontWeight: 600, color: C.text, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" as const }}>{item.title}</div>
                        <div style={{ fontSize: 11, color: C.textMuted, textTransform: "capitalize" as const }}>{item.type} · {new Date(item.createdAt).toLocaleDateString("en-AU", { day: "numeric", month: "short", year: "numeric" })}</div>
                      </div>
                      <span style={{ fontSize: 10, fontWeight: 600, color: C.accent, background: C.accent + "18", border: `1px solid ${C.accent}30`, borderRadius: 5, padding: "2px 8px" }}>Live</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            <div style={S.card}>
              <div style={S.label}>Request New Content</div>
              {contentSubmitted ? (
                <div style={{ textAlign: "center" as const, padding: "24px 0" }}>
                  <div style={{ fontSize: 28, marginBottom: 10 }}>✅</div>
                  <div style={{ fontSize: 15, fontWeight: 700, color: C.text, marginBottom: 6 }}>Request received!</div>
                  <div style={{ fontSize: 13, color: C.textMuted, marginBottom: 16, lineHeight: 1.6 }}>We will have your content live within 1-2 business days.</div>
                  <button onClick={() => setContentSubmitted(false)} style={S.btn("secondary")}>Request another</button>
                </div>
              ) : (
                <>
                  <div style={{ display: "flex", gap: 8, marginBottom: 18, flexWrap: "wrap" as const }}>
                    {([
                      ...(hasBlog ? [{ id: "blog" as const, icon: "📰", label: "Blog Post" }] : []),
                      ...(hasGrowth ? [{ id: "newsletter" as const, icon: "✉️", label: "Newsletter" }] : []),
                      ...(features.includes("Deals & Promotions") || hasShop ? [{ id: "deal" as const, icon: "🏷️", label: "Deal / Promo" }] : []),
                      ...(hasShop ? [{ id: "product" as const, icon: "🛍️", label: "Product" }] : []),
                      ...(features.includes("Testimonials") ? [{ id: "review" as const, icon: "⭐", label: "Review" }] : []),
                    ]).map(ct => (
                      <button key={ct.id} onClick={() => { setContentRequestType(ct.id); setContentRequestTitle(""); setContentRequestNote(""); setContentRequestExtras({}); }}
                        style={{ padding: "8px 14px", fontSize: 12, fontWeight: contentRequestType === ct.id ? 600 : 400, color: contentRequestType === ct.id ? C.text : C.textMuted, background: contentRequestType === ct.id ? C.raised : "transparent", border: contentRequestType === ct.id ? `1px solid ${C.border}` : "1px solid transparent", borderRadius: 8, cursor: "pointer" }}>
                        {ct.icon} {ct.label}
                      </button>
                    ))}
                  </div>
                  <div style={{ display: "flex", flexDirection: "column" as const, gap: 14 }}>
                    {contentRequestType === "blog" && (<>
                      <div>
                        <label style={{ fontSize: 12, fontWeight: 600, color: C.textSec, display: "block", marginBottom: 6 }}>Blog Post Topic / Title</label>
                        <input value={contentRequestTitle} onChange={e => setContentRequestTitle(e.target.value)} placeholder="e.g. 5 Tips for Choosing the Right Plumber"
                          style={{ width: "100%", background: C.raised, border: `1px solid ${C.border}`, borderRadius: 8, padding: "10px 14px", color: C.text, fontSize: 13, outline: "none", boxSizing: "border-box" as const }} />
                      </div>
                      <div>
                        <label style={{ fontSize: 12, fontWeight: 600, color: C.textSec, display: "block", marginBottom: 6 }}>Extra guidance (optional)</label>
                        <textarea value={contentRequestNote} onChange={e => setContentRequestNote(e.target.value)} rows={3} placeholder="Key points, audience, tone..."
                          style={{ width: "100%", background: C.raised, border: `1px solid ${C.border}`, borderRadius: 8, padding: "10px 14px", color: C.text, fontSize: 13, outline: "none", resize: "vertical" as const, fontFamily: "inherit", boxSizing: "border-box" as const }} />
                      </div>
                    </>)}
                    {contentRequestType === "newsletter" && (<>
                      <div>
                        <label style={{ fontSize: 12, fontWeight: 600, color: C.textSec, display: "block", marginBottom: 6 }}>Newsletter Topic</label>
                        <input value={contentRequestTitle} onChange={e => setContentRequestTitle(e.target.value)} placeholder="e.g. Monthly update — new services + winter tips"
                          style={{ width: "100%", background: C.raised, border: `1px solid ${C.border}`, borderRadius: 8, padding: "10px 14px", color: C.text, fontSize: 13, outline: "none", boxSizing: "border-box" as const }} />
                      </div>
                      <div>
                        <label style={{ fontSize: 12, fontWeight: 600, color: C.textSec, display: "block", marginBottom: 6 }}>What to include (optional)</label>
                        <textarea value={contentRequestNote} onChange={e => setContentRequestNote(e.target.value)} rows={3} placeholder="Promotions, announcements, tips..."
                          style={{ width: "100%", background: C.raised, border: `1px solid ${C.border}`, borderRadius: 8, padding: "10px 14px", color: C.text, fontSize: 13, outline: "none", resize: "vertical" as const, fontFamily: "inherit", boxSizing: "border-box" as const }} />
                      </div>
                    </>)}
                    {contentRequestType === "deal" && (<>
                      <div>
                        <label style={{ fontSize: 12, fontWeight: 600, color: C.textSec, display: "block", marginBottom: 6 }}>Promotion Title</label>
                        <input value={contentRequestTitle} onChange={e => setContentRequestTitle(e.target.value)} placeholder="e.g. End of Financial Year Sale"
                          style={{ width: "100%", background: C.raised, border: `1px solid ${C.border}`, borderRadius: 8, padding: "10px 14px", color: C.text, fontSize: 13, outline: "none", boxSizing: "border-box" as const }} />
                      </div>
                      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
                        <div>
                          <label style={{ fontSize: 12, fontWeight: 600, color: C.textSec, display: "block", marginBottom: 6 }}>Discount</label>
                          <input value={contentRequestExtras.discount || ""} onChange={e => setContentRequestExtras(p => ({ ...p, discount: e.target.value }))} placeholder="20% off all services"
                            style={{ width: "100%", background: C.raised, border: `1px solid ${C.border}`, borderRadius: 8, padding: "10px 14px", color: C.text, fontSize: 13, outline: "none", boxSizing: "border-box" as const }} />
                        </div>
                        <div>
                          <label style={{ fontSize: 12, fontWeight: 600, color: C.textSec, display: "block", marginBottom: 6 }}>Valid Until</label>
                          <input type="date" value={contentRequestExtras.validUntil || ""} onChange={e => setContentRequestExtras(p => ({ ...p, validUntil: e.target.value }))}
                            style={{ width: "100%", background: C.raised, border: `1px solid ${C.border}`, borderRadius: 8, padding: "10px 14px", color: C.text, fontSize: 13, outline: "none", boxSizing: "border-box" as const }} />
                        </div>
                      </div>
                      <div>
                        <label style={{ fontSize: 12, fontWeight: 600, color: C.textSec, display: "block", marginBottom: 6 }}>Additional details (optional)</label>
                        <textarea value={contentRequestNote} onChange={e => setContentRequestNote(e.target.value)} rows={2} placeholder="Terms, promo code ideas..."
                          style={{ width: "100%", background: C.raised, border: `1px solid ${C.border}`, borderRadius: 8, padding: "10px 14px", color: C.text, fontSize: 13, outline: "none", resize: "vertical" as const, fontFamily: "inherit", boxSizing: "border-box" as const }} />
                      </div>
                    </>)}
                    {contentRequestType === "product" && (<>
                      <div>
                        <label style={{ fontSize: 12, fontWeight: 600, color: C.textSec, display: "block", marginBottom: 6 }}>Product / Service Name</label>
                        <input value={contentRequestTitle} onChange={e => setContentRequestTitle(e.target.value)} placeholder="e.g. Premium Lawn Mowing Package"
                          style={{ width: "100%", background: C.raised, border: `1px solid ${C.border}`, borderRadius: 8, padding: "10px 14px", color: C.text, fontSize: 13, outline: "none", boxSizing: "border-box" as const }} />
                      </div>
                      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
                        <div>
                          <label style={{ fontSize: 12, fontWeight: 600, color: C.textSec, display: "block", marginBottom: 6 }}>Price (AUD)</label>
                          <input type="number" value={contentRequestExtras.price || ""} onChange={e => setContentRequestExtras(p => ({ ...p, price: e.target.value }))} placeholder="99.00"
                            style={{ width: "100%", background: C.raised, border: `1px solid ${C.border}`, borderRadius: 8, padding: "10px 14px", color: C.text, fontSize: 13, outline: "none", boxSizing: "border-box" as const }} />
                        </div>
                        <div>
                          <label style={{ fontSize: 12, fontWeight: 600, color: C.textSec, display: "block", marginBottom: 6 }}>SKU (optional)</label>
                          <input value={contentRequestExtras.sku || ""} onChange={e => setContentRequestExtras(p => ({ ...p, sku: e.target.value }))}
                            style={{ width: "100%", background: C.raised, border: `1px solid ${C.border}`, borderRadius: 8, padding: "10px 14px", color: C.text, fontSize: 13, outline: "none", boxSizing: "border-box" as const, fontFamily: "monospace" }} />
                        </div>
                      </div>
                      <div>
                        <label style={{ fontSize: 12, fontWeight: 600, color: C.textSec, display: "block", marginBottom: 6 }}>Description</label>
                        <textarea value={contentRequestNote} onChange={e => setContentRequestNote(e.target.value)} rows={3} placeholder="What is included, benefits, who it is for..."
                          style={{ width: "100%", background: C.raised, border: `1px solid ${C.border}`, borderRadius: 8, padding: "10px 14px", color: C.text, fontSize: 13, outline: "none", resize: "vertical" as const, fontFamily: "inherit", boxSizing: "border-box" as const }} />
                      </div>
                    </>)}
                    {contentRequestType === "review" && (<>
                      <div>
                        <label style={{ fontSize: 12, fontWeight: 600, color: C.textSec, display: "block", marginBottom: 6 }}>What the customer said</label>
                        <input value={contentRequestTitle} onChange={e => setContentRequestTitle(e.target.value)} placeholder="e.g. Great service, very professional"
                          style={{ width: "100%", background: C.raised, border: `1px solid ${C.border}`, borderRadius: 8, padding: "10px 14px", color: C.text, fontSize: 13, outline: "none", boxSizing: "border-box" as const }} />
                      </div>
                      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
                        <div>
                          <label style={{ fontSize: 12, fontWeight: 600, color: C.textSec, display: "block", marginBottom: 6 }}>Customer Name</label>
                          <input value={contentRequestExtras.authorName || ""} onChange={e => setContentRequestExtras(p => ({ ...p, authorName: e.target.value }))}
                            style={{ width: "100%", background: C.raised, border: `1px solid ${C.border}`, borderRadius: 8, padding: "10px 14px", color: C.text, fontSize: 13, outline: "none", boxSizing: "border-box" as const }} />
                        </div>
                        <div>
                          <label style={{ fontSize: 12, fontWeight: 600, color: C.textSec, display: "block", marginBottom: 6 }}>Rating (1-5)</label>
                          <select value={contentRequestExtras.rating || "5"} onChange={e => setContentRequestExtras(p => ({ ...p, rating: e.target.value }))}
                            style={{ width: "100%", background: C.raised, border: `1px solid ${C.border}`, borderRadius: 8, padding: "10px 14px", color: C.text, fontSize: 13, outline: "none" }}>
                            {[5,4,3,2,1].map(n => <option key={n} value={n}>{n} star{n !== 1 ? "s" : ""}</option>)}
                          </select>
                        </div>
                      </div>
                      <div>
                        <label style={{ fontSize: 12, fontWeight: 600, color: C.textSec, display: "block", marginBottom: 6 }}>Full review text (optional)</label>
                        <textarea value={contentRequestNote} onChange={e => setContentRequestNote(e.target.value)} rows={3} placeholder="Paste the full review text..."
                          style={{ width: "100%", background: C.raised, border: `1px solid ${C.border}`, borderRadius: 8, padding: "10px 14px", color: C.text, fontSize: 13, outline: "none", resize: "vertical" as const, fontFamily: "inherit", boxSizing: "border-box" as const }} />
                      </div>
                    </>)}
                    <button onClick={submitContentRequest} disabled={contentSubmitting || !contentRequestTitle.trim()}
                      style={{ ...S.btn("primary", contentSubmitting || !contentRequestTitle.trim()), width: "100%" }}>
                      {contentSubmitting ? "Submitting..." : "Submit Request"}
                    </button>
                    <div style={{ fontSize: 12, color: C.textMuted, lineHeight: 1.6 }}>Content is usually live within 1-2 business days.</div>
                  </div>
                </>
              )}
            </div>
          </>
        )}

        {tab === "upgrade" && (
          <>
            <div style={S.card}>
              <div style={S.label}>Add Features to Your Site</div>
              <div style={{ color: C.textMuted, fontSize: 13, marginBottom: 16, lineHeight: 1.6 }}>
                Select the features you'd like added. We'll build a draft for you to review before anything goes live.
              </div>

              {/* Already-on-site chips */}
              {features.length > 0 && !upgradeSubmitted && (
                <div style={{ display:"flex", alignItems:"center", gap:8, marginBottom:14, flexWrap:"wrap" as const }}>
                  <span style={{ fontSize:11, fontWeight:700, color:C.textMuted, textTransform:"uppercase" as const, letterSpacing:"0.08em", flexShrink:0 }}>Already on your site:</span>
                  {features.map((feat:string) => (
                    <span key={feat} style={{ fontSize:11, fontWeight:600, color:C.accent, background:C.accent+"12", border:`1px solid ${C.accent}30`, borderRadius:99, padding:"3px 10px", whiteSpace:"nowrap" as const }}>{"✓"} {feat}</span>
                  ))}
                </div>
              )}

              {upgradeSubmitted ? (
                <div style={{ background: "#00c89610", border: "1px solid #00c89625", borderRadius: 10, padding: "20px 18px", textAlign: "center" }}>
                  <div style={{ fontSize: 20, marginBottom: 8 }}>🎉</div>
                  <div style={{ fontSize: 14, fontWeight: 700, color: C.accent, marginBottom: 6 }}>Request Submitted!</div>
                  <div style={{ fontSize: 13, color: C.textMuted }}>We'll build a draft with your requested features and let you review it before it goes live. Check back here for updates.</div>
                  <button onClick={() => setUpgradeSubmitted(false)} style={{ ...S.btn("secondary"), marginTop: 14, fontSize: 13 }}>Request More Features</button>
                </div>
              ) : (
                <>
                  <div style={{ display: "flex", flexDirection: "column", gap: 8, marginBottom: 16 }}>
                    {[
                      { id: "Booking System", icon: "📅", label: "Booking System", desc: "Online booking calendar so customers can schedule appointments directly." },
                      { id: "Shop", icon: "🛒", label: "Online Shop", desc: "Sell products or services with Square-powered payments." },
                      { id: "Live Chat", icon: "💬", label: "Live Chat", desc: "Real-time chat widget so visitors can message you instantly." },
                      { id: "Gallery", icon: "🖼️", label: "Photo Gallery", desc: "A dedicated gallery section to showcase your work." },
                      { id: "Blog", icon: "📰", label: "Blog", desc: "News/blog section to publish updates and articles." },
                      { id: "Newsletter", icon: "📧", label: "Email Newsletter", desc: "Newsletter sign-up form to grow your subscriber list." },
                      { id: "Pricing", icon: "💰", label: "Pricing Section", desc: "Clear pricing table or packages on your site." },
                      { id: "Testimonials", icon: "⭐", label: "Customer Reviews", desc: "Showcase social proof with a testimonials section." },
                      { id: "FAQ", icon: "❓", label: "FAQ Section", desc: "Answer common questions to reduce inbound enquiries." },
                      { id: "Portfolio", icon: "🎨", label: "Portfolio", desc: "Visual portfolio of your past work or case studies." },
                      { id: "Video Background", icon: "🎬", label: "Video Background", desc: "Full-screen video background hero section." },
                    ].map(f => {
                      const owned = features.includes(f.id);
                      const sel = upgradeSelected.includes(f.id);
                      return (
                        <div key={f.id}
                          onClick={() => { if (!owned) setUpgradeSelected(prev => sel ? prev.filter(x => x !== f.id) : [...prev, f.id]); }}
                          style={{ display:"flex", alignItems:"center", gap:12,
                            background: owned ? C.surface : sel ? C.accent+"0e" : C.bg,
                            border:`1px solid ${owned ? C.accent+"35" : sel ? C.accent+"40" : C.border}`,
                            borderRadius:10, padding:"12px 14px",
                            cursor: owned ? "default" : "pointer",
                            opacity: owned ? 1 : 1,
                            transition:"border-color 0.15s, background 0.15s" }}>
                          <div style={{ width:40, height:40, borderRadius:10, flexShrink:0,
                            background: owned ? C.accent+"15" : sel ? C.accent+"15" : C.raised,
                            border:`1px solid ${owned ? C.accent+"30" : sel ? C.accent+"30" : C.border}`,
                            display:"flex", alignItems:"center", justifyContent:"center", fontSize:20 }}>
                            {f.icon}
                          </div>
                          <div style={{ flex:1, minWidth:0 }}>
                            <div style={{ fontSize:13, fontWeight:600, color: owned ? C.textSec : sel ? C.accent : C.text, marginBottom:2 }}>{f.label}</div>
                            <div style={{ fontSize:12, color:C.textMuted, lineHeight:1.4 }}>{f.desc}</div>
                          </div>
                          {owned ? (
                            <div style={{ display:"flex", flexDirection:"column" as const, alignItems:"flex-end", gap:4, flexShrink:0 }}>
                              <span style={{ fontSize:10, fontWeight:700, color:C.accent, background:C.accent+"15", border:`1px solid ${C.accent}35`, borderRadius:99, padding:"3px 10px", whiteSpace:"nowrap" as const }}>{"✓"} Active</span>
                              <span style={{ fontSize:10, color:C.textMuted }}>Already on your site</span>
                            </div>
                          ) : (
                            <div style={{ width:22, height:22, borderRadius:"50%", flexShrink:0,
                              border:`2px solid ${sel ? C.accent : C.border}`,
                              background: sel ? C.accent : "transparent",
                              display:"flex", alignItems:"center", justifyContent:"center" }}>
                              {sel && <span style={{ color:"#000", fontSize:11, fontWeight:800, lineHeight:1 }}>{"✓"}</span>}
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>

                  {upgradeSelected.length > 0 && (
                    <>
                      <div style={S.divider} />
                      <div style={{ fontSize: 12, color: C.textMuted, marginBottom: 8 }}>Any specific notes? (optional)</div>
                      <textarea
                        value={upgradeMessage}
                        onChange={e => setUpgradeMessage(e.target.value)}
                        placeholder="e.g. I'd like the booking system to offer 30-minute slots for haircuts…"
                        rows={3}
                        style={{ width: "100%", background: C.raised, border: `1px solid ${C.border}`, borderRadius: 8, padding: "10px 14px", color: C.text, fontSize: 13, outline: "none", resize: "vertical", fontFamily: "inherit", boxSizing: "border-box" as const, marginBottom: 12 }}
                      />
                      <button onClick={submitUpgradeRequest} disabled={upgradeSubmitting}
                        style={{ ...S.btn("primary", upgradeSubmitting), width: "100%", fontSize: 14, fontWeight: 700 }}>
                        {upgradeSubmitting ? "Submitting…" : `Request ${upgradeSelected.length} Feature${upgradeSelected.length > 1 ? "s" : ""} →`}
                      </button>
                      <div style={{ fontSize: 11, color: C.textMuted, textAlign: "center", marginTop: 8 }}>
                        We'll build a draft for you to review. No charges until you confirm.
                      </div>
                    </>
                  )}
                </>
              )}
            </div>

            {myFeatureRequests.length > 0 && (
              <div style={S.card}>
                <div style={S.label}>Your Requests</div>
                <div style={{ display: "flex", flexDirection: "column", gap: 8, marginTop: 8 }}>
                  {myFeatureRequests.map((req: any) => {
                    const statusMap: Record<string, { color: string; bg: string; label: string }> = {
                      pending:    { color: C.amber,      bg: C.amberBg,  label: "⏳ Under review" },
                      processing: { color: C.accentBlue, bg: C.accentBg, label: "⚙️ Being processed" },
                      approved:   { color: C.accentBlue, bg: C.accentBg, label: "⚙️ Building draft" },
                      draft:      { color: C.purple,     bg: C.accentBg, label: "👀 Draft ready" },
                      live:       { color: C.accent,     bg: C.accentBg, label: "✓ Live on your site" },
                      rejected:   { color: C.red,        bg: C.redBg,    label: "✗ Not added" },
                    };
                    const sm = statusMap[req.status] || { color: C.textMuted, bg: C.raised, label: req.status };
                    const hasFee = req.quotedFee && req.quotedFee > 0;
                    return (
                      <div key={req.id} style={{ background: C.surface, border: `1px solid ${hasFee && req.status === "pending" ? C.amber + "60" : C.border}`, borderRadius: 12, padding: "14px 16px", transition: "border-color 0.2s ease", boxShadow: C.shadow }}>
                        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
                          <div>
                            <div style={{ fontSize: 13, fontWeight: 600, color: C.text }}>{req.featureId}</div>
                            <div style={{ fontSize: 11, color: C.textMuted, marginTop: 2 }}>{new Date(req.createdAt).toLocaleDateString("en-AU")}</div>
                          </div>
                          <div style={{ background: sm.bg, color: sm.color, border: `1px solid ${sm.color}28`, borderRadius: 6, padding: "3px 9px", fontSize: 11, fontWeight: 600, flexShrink: 0 }}>{sm.label}</div>
                        </div>
                        {hasFee && (
                          <div style={{ marginTop: 12, background: C.amberBg, border: `1px solid ${C.amber}30`, borderRadius: 10, padding: "12px 14px" }}>
                            <div style={{ fontSize: 12, fontWeight: 700, color: C.amber, marginBottom: 4 }}>💰 Add-on fee quoted: ${req.quotedFee}</div>
                            <div style={{ fontSize: 12, color: C.textMuted, lineHeight: 1.5, marginBottom: req.status === "pending" ? 10 : 0 }}>
                              A one-time fee of <strong style={{ color: C.text }}>${req.quotedFee} AUD</strong> has been quoted to add <strong style={{ color: C.text }}>{req.featureId}</strong> to your site.
                              {req.status === "live" ? " Already paid and live." : " No charges until you confirm."}
                            </div>
                            {req.status === "pending" && (
                              <a
                                href={`mailto:hello@webgecko.au?subject=Approve add-on: ${encodeURIComponent(req.featureId)}&body=Hi WebGecko, I approve the $${req.quotedFee} fee for adding ${encodeURIComponent(req.featureId)} to my site.`}
                                style={{ ...S.btn("primary"), textDecoration: "none", fontSize: 12, display: "inline-flex", marginTop: 4 }}
                              >
                                Approve &amp; reply →
                              </a>
                            )}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {features.length > 0 && (
              <div style={{ ...S.card, background: "transparent", border: `1px solid ${C.border}` }}>
                <div style={S.label}>Already on your site</div>
                <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginTop: 8 }}>
                  {features.map((f: string) => (
                    <div key={f} style={{ background: C.raised, border: `1px solid ${C.border}`, borderRadius: 6, padding: "4px 10px", fontSize: 12, color: C.textMuted }}>{f}</div>
                  ))}
                </div>
              </div>
            )}

            <div style={{ ...S.card, background: `${C.amber}08`, border: `1px solid ${C.amber}22` }}>
              <div style={{ display: "flex", gap: 10, alignItems: "flex-start" }}>
                <span style={{ fontSize: 18, flexShrink: 0 }}>💡</span>
                <div>
                  <div style={{ fontSize: 13, fontWeight: 600, color: C.text, marginBottom: 4 }}>Pricing for add-ons</div>
                  <div style={{ fontSize: 12, color: C.textMuted, lineHeight: 1.6 }}>Each new feature is quoted individually based on complexity. We'll send you a quote for approval before any work begins — no surprises.</div>
                </div>
              </div>
            </div>
          </>
        )}

        {/* ══════════════════════ SOCIAL MEDIA TAB ══════════════════════ */}
        {tab === "social" && (() => {
          const connectedPlatforms: string[] = (client.metadata as any)?.socialPlatforms || [];
          const allPlatforms = [
            { id: "Instagram",       icon: "📸", color: "#E1306C" },
            { id: "Facebook",        icon: "👍", color: "#1877F2" },
            { id: "TikTok",          icon: "🎵", color: "#010101" },
            { id: "LinkedIn",        icon: "💼", color: "#0A66C2" },
            { id: "YouTube",         icon: "▶️", color: "#FF0000" },
            { id: "Google Business", icon: "📍", color: "#4285F4" },
          ];

          /* ─────────────────────────────────────────────────────────────────
             UPSELL PAGE — client does NOT have social media
          ───────────────────────────────────────────────────────────────── */
          if (!hasSocial) {
            const plans = [
              {
                id: "starter",
                name: "Starter",
                price: 499,
                period: "/mo",
                badge: null,
                platforms: 2,
                posts: 12,
                perPost: "~$42",
                features: [
                  "2 platforms (Instagram + Facebook)",
                  "12 posts per month",
                  "We create & manage your accounts",
                  "Comment & DM responses included",
                  "Expert captions & hashtags",
                  "Monthly performance report",
                ],
                color: "#4f9eff",
              },
              {
                id: "growth",
                name: "Growth",
                price: 799,
                period: "/mo",
                badge: "Most Popular",
                platforms: 4,
                posts: 20,
                perPost: "~$40",
                features: [
                  "4 platforms of your choice",
                  "20 posts per month",
                  "We create & manage your accounts",
                  "Comment, DM & review responses",
                  "Reel / short-video scripts included",
                  "Competitor & trend monitoring",
                  "Priority support",
                ],
                color: "#a855f7",
              },
              {
                id: "suite",
                name: "Full Suite",
                price: 1299,
                period: "/mo",
                badge: "Best Value",
                platforms: 99,
                posts: 36,
                perPost: "~$36",
                features: [
                  "All platforms (6+)",
                  "36 posts per month",
                  "We create & manage your accounts",
                  "Full community management (comments, DMs, reviews)",
                  "Full creative direction & brand kit",
                  "Paid ad management (Meta + TikTok)",
                  "Dedicated account manager",
                ],
                color: "#10b981",
              },
              {
                id: "custom",
                name: "Custom",
                price: null,
                period: "",
                badge: "Tailored",
                platforms: 0,
                posts: 0,
                perPost: "",
                features: [
                  "Any platform mix you need",
                  "Flexible posting frequency",
                  "Add-ons: UGC, influencer outreach",
                  "White-glove onboarding",
                  "Custom reporting cadence",
                  "Direct line to your strategist",
                ],
                color: "#f59e0b",
              },
            ];

            const selectedPlanObj = plans.find(p => p.id === socialSelectedPlan);

            return (
              <div style={{ flex: 1, display: "flex", flexDirection: "column", overflow: "hidden", minHeight: 0 }}>
                {/* ── Header strip ── */}
                <div style={{ flexShrink: 0, paddingBottom: 16, borderBottom: `1px solid ${C.border}`, marginBottom: 16 }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
                    <div style={{ width: 44, height: 44, borderRadius: 12, background: "linear-gradient(135deg,#7c3aed,#a855f7)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 22, flexShrink: 0 }}>📱</div>
                    <div>
                      <div style={{ fontSize: 20, fontWeight: 800, color: C.text, letterSpacing: "-0.03em", lineHeight: 1.2 }}>Social Media Management</div>
                      <div style={{ fontSize: 13, color: C.textMuted, marginTop: 2 }}>We create your accounts, craft your content, post on schedule, and respond to every comment and DM. You just focus on your business.</div>
                    </div>
                  </div>
                </div>

                {/* ── Main content: plan cards + right panel ── */}
                <div style={{ flex: 1, display: "flex", gap: 16, overflow: "hidden", minHeight: 0 }}>

                  {/* Left: feature strip + plan cards */}
                  <div style={{ flex: 1, display: "flex", flexDirection: "column", gap: 12, overflowY: "auto", minWidth: 0 }}>
                    {/* 6-feature strip */}
                    <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 8, flexShrink: 0 }}>
                      {[
                        { icon: "📅", title: "Content Calendar", desc: "Posts planned weeks ahead, tailored to your brand voice" },
                        { icon: "✍️", title: "Creative Captions", desc: "Every caption crafted in your brand voice with trending hashtags" },
                        { icon: "📊", title: "Live Analytics", desc: "Follower growth & engagement tracked daily" },
                        { icon: "💬", title: "Community Management", desc: "We respond to comments, DMs and reviews on your behalf" },
                        { icon: "🌐", title: "Multi-Platform", desc: "Instagram, Facebook, TikTok, LinkedIn, YouTube & more" },
                        { icon: "🚀", title: "5-Day Setup", desc: "Accounts created and first posts live within 5 business days — zero effort from you" },
                      ].map(f => (
                        <div key={f.title} style={{ background: dark ? "rgba(80,40,120,0.1)" : "rgba(124,58,237,0.04)", border: `1px solid ${dark ? "rgba(120,60,200,0.2)" : "rgba(124,58,237,0.14)"}`, borderRadius: 10, padding: "10px 12px", display: "flex", gap: 8 }}>
                          <span style={{ fontSize: 16, flexShrink: 0 }}>{f.icon}</span>
                          <div>
                            <div style={{ fontSize: 11, fontWeight: 700, color: dark ? "#b080ff" : "#6d28d9", marginBottom: 2 }}>{f.title}</div>
                            <div style={{ fontSize: 11, color: C.textMuted, lineHeight: 1.4 }}>{f.desc}</div>
                          </div>
                        </div>
                      ))}
                    </div>

                    {/* Plan cards */}
                    <div style={{ display: "grid", gridTemplateColumns: "repeat(2, 1fr)", gap: 10, flexShrink: 0 }}>
                      {plans.map(plan => {
                        const sel = socialSelectedPlan === plan.id;
                        return (
                          <button key={plan.id} onClick={() => setSocialSelectedPlan(plan.id)}
                            style={{ background: sel ? `${plan.color}12` : C.surface, border: `2px solid ${sel ? plan.color : C.border}`, borderRadius: 14, padding: "16px", cursor: "pointer", textAlign: "left", transition: "all 0.18s ease", position: "relative", boxShadow: sel ? `0 0 0 3px ${plan.color}22` : C.shadow, fontFamily: "inherit" }}>
                            {plan.badge && (
                              <div style={{ position: "absolute", top: 10, right: 10, fontSize: 9, fontWeight: 800, color: "#fff", background: plan.color, borderRadius: 5, padding: "3px 7px", letterSpacing: "0.05em", textTransform: "uppercase" }}>{plan.badge}</div>
                            )}
                            <div style={{ fontSize: 14, fontWeight: 800, color: sel ? plan.color : C.text, marginBottom: 4 }}>{plan.name}</div>
                            <div style={{ fontSize: plan.price ? 22 : 16, fontWeight: 800, color: plan.color, letterSpacing: "-0.03em", marginBottom: 8 }}>
                              {plan.price ? `$${plan.price}` : "Let's chat"}<span style={{ fontSize: 12, fontWeight: 500, color: C.textMuted }}>{plan.period}</span>
                            </div>
                            {plan.price && (
                              <div style={{ fontSize: 10, color: C.textMuted, marginBottom: 10 }}>
                                {plan.platforms === 99 ? "All platforms" : `${plan.platforms} platforms`} · {plan.posts} posts/mo · {plan.perPost}/post
                              </div>
                            )}
                            <div style={{ display: "flex", flexDirection: "column", gap: 5 }}>
                              {plan.features.slice(0, 3).map(f => (
                                <div key={f} style={{ display: "flex", alignItems: "flex-start", gap: 6, fontSize: 11, color: C.textSec, lineHeight: 1.4 }}>
                                  <span style={{ color: plan.color, flexShrink: 0, fontWeight: 700 }}>✓</span>{f}
                                </div>
                              ))}
                              {plan.features.length > 3 && <div style={{ fontSize: 10, color: C.textMuted, marginTop: 2 }}>+{plan.features.length - 3} more included</div>}
                            </div>
                            {sel && <div style={{ marginTop: 10, fontSize: 11, fontWeight: 700, color: plan.color }}>✓ Selected</div>}
                          </button>
                        );
                      })}
                    </div>

                    {/* Competitor context */}
                    <div style={{ background: C.raised, border: `1px solid ${C.border}`, borderRadius: 10, padding: "10px 14px", fontSize: 11, color: C.textMuted, lineHeight: 1.6, flexShrink: 0 }}>
                      💡 <strong style={{ color: C.textSec }}>Market context:</strong> Hiring a social media manager in Australia costs $6,700–$8,300/mo in salary alone. Most agencies charge $1,500–$5,000/mo. Our plans include full account creation, posting, and community management — no lock-in, no hidden fees.
                    </div>
                  </div>

                  {/* Right: action panel */}
                  <div style={{ width: 260, flexShrink: 0, display: "flex", flexDirection: "column", gap: 12 }}>
                    {/* Selected plan summary */}
                    <div style={{ background: C.surface, border: `1px solid ${selectedPlanObj ? selectedPlanObj.color + "50" : C.border}`, borderRadius: 14, padding: "16px", flexShrink: 0, transition: "border-color 0.2s ease" }}>
                      {selectedPlanObj ? (
                        <>
                          <div style={{ fontSize: 11, fontWeight: 700, color: selectedPlanObj.color, textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: 8 }}>Selected Plan</div>
                          <div style={{ fontSize: 17, fontWeight: 800, color: C.text, marginBottom: 4 }}>{selectedPlanObj.name}</div>
                          <div style={{ fontSize: 22, fontWeight: 800, color: selectedPlanObj.color, letterSpacing: "-0.03em", marginBottom: 12 }}>
                            {selectedPlanObj.price ? `$${selectedPlanObj.price}/mo` : "Custom quote"}
                          </div>
                          <div style={{ display: "flex", flexDirection: "column", gap: 5, marginBottom: 16 }}>
                            {selectedPlanObj.features.map(f => (
                              <div key={f} style={{ display: "flex", alignItems: "flex-start", gap: 6, fontSize: 11, color: C.textSec, lineHeight: 1.4 }}>
                                <span style={{ color: selectedPlanObj.color, flexShrink: 0 }}>✓</span>{f}
                              </div>
                            ))}
                          </div>
                          {selectedPlanObj.id === "custom" && (
                            <textarea
                              value={socialCustomNote} onChange={e => setSocialCustomNote(e.target.value)}
                              rows={3} placeholder="Tell us what you need — platforms, post frequency, goals…"
                              style={{ width: "100%", background: C.raised, border: `1px solid ${C.border}`, borderRadius: 8, padding: "9px 12px", color: C.text, fontSize: 12, outline: "none", resize: "vertical", fontFamily: "inherit", boxSizing: "border-box", lineHeight: 1.5, marginBottom: 10 }}
                            />
                          )}
                          {socialUpgradeState === "done" ? (
                            <div style={{ textAlign: "center", background: `${selectedPlanObj.color}12`, border: `1px solid ${selectedPlanObj.color}30`, borderRadius: 10, padding: "14px" }}>
                              <div style={{ fontSize: 20, marginBottom: 6 }}>✅</div>
                              <div style={{ fontSize: 13, fontWeight: 700, color: selectedPlanObj.color }}>Request sent!</div>
                              <div style={{ fontSize: 11, color: C.textMuted, marginTop: 4 }}>We'll review and reply within 1 business day.</div>
                            </div>
                          ) : (
                            <button
                              disabled={socialUpgradeState === "loading"}
                              onClick={async () => {
                                setSocialUpgradeState("loading");
                                try {
                                  await fetch("/api/client/upgrade-request", {
                                    method: "POST",
                                    headers: { "Content-Type": "application/json" },
                                    body: JSON.stringify({
                                      slug, businessName: client.businessName, email: client.email,
                                      type: "social_bundle",
                                      plan: selectedPlanObj.id,
                                      planName: selectedPlanObj.name,
                                      planPrice: selectedPlanObj.price,
                                      note: socialCustomNote || undefined,
                                    }),
                                  });
                                  setSocialUpgradeState("done");
                                } catch { setSocialUpgradeState("err"); }
                              }}
                              style={{ display: "block", width: "100%", textAlign: "center", background: socialUpgradeState === "loading" ? `${selectedPlanObj.color}80` : selectedPlanObj.color, color: "#fff", borderRadius: 10, padding: "12px", fontSize: 13, fontWeight: 700, border: "none", cursor: socialUpgradeState === "loading" ? "not-allowed" : "pointer", boxShadow: `0 4px 16px ${selectedPlanObj.color}40`, fontFamily: "inherit", transition: "all 0.18s ease" }}>
                              {socialUpgradeState === "loading" ? "Sending…" : selectedPlanObj.id === "custom" ? "Request Custom Quote →" : `Get ${selectedPlanObj.name} Plan →`}
                            </button>
                          )}
                          {socialUpgradeState === "err" && <div style={{ textAlign: "center", fontSize: 11, color: "#ff6060", marginTop: 8 }}>Error — email hello@webgecko.au</div>}
                        </>
                      ) : (
                        <div style={{ textAlign: "center", padding: "20px 0" }}>
                          <div style={{ fontSize: 28, marginBottom: 10 }}>👆</div>
                          <div style={{ fontSize: 13, fontWeight: 600, color: C.text, marginBottom: 6 }}>Select a plan to get started</div>
                          <div style={{ fontSize: 11, color: C.textMuted, lineHeight: 1.5 }}>Choose any plan on the left, or pick Custom for a tailored quote.</div>
                        </div>
                      )}
                    </div>

                    {/* FAQ mini */}
                    <div style={{ background: C.surface, border: `1px solid ${C.border}`, borderRadius: 14, padding: "14px 16px", overflow: "auto", flex: 1 }}>
                      <div style={{ fontSize: 10, fontWeight: 700, color: C.textMuted, textTransform: "uppercase", letterSpacing: "0.1em", marginBottom: 12 }}>Quick answers</div>
                      {[
                        { q: "Do I need to create accounts?", a: "No — we create a dedicated email address and register all your social accounts. You never need to touch it." },
                        { q: "Can I approve posts first?", a: "Yes. Enable Approval Mode and every post comes to you for sign-off before it goes live." },
                        { q: "What platforms do you support?", a: "Instagram, Facebook, TikTok, LinkedIn, YouTube, and Google Business. All accounts are created and owned by us on your behalf." },
                        { q: "Can I change plans later?", a: "Absolutely. Upgrade, downgrade, or pause any time with 7 days notice." },
                        { q: "What happens if I cancel?", a: "We reset the account password and email you proof — the accounts and all content stay yours. Month-to-month, no lock-in." },
                      ].map((item, i, arr) => (
                        <div key={item.q} style={{ paddingBottom: i < arr.length - 1 ? 10 : 0, marginBottom: i < arr.length - 1 ? 10 : 0, borderBottom: i < arr.length - 1 ? `1px solid ${C.border}` : "none" }}>
                          <div style={{ fontSize: 11, fontWeight: 700, color: C.textSec, marginBottom: 3 }}>{item.q}</div>
                          <div style={{ fontSize: 11, color: C.textMuted, lineHeight: 1.5 }}>{item.a}</div>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>

                {/* ── Mobile fallback (hidden on desktop via media query workaround) ── */}
                <style>{`
                  @media (max-width: 700px) {
                    .wg-social-desktop { display: none !important; }
                    .wg-social-mobile  { display: flex !important; }
                  }
                  @media (min-width: 701px) {
                    .wg-social-mobile { display: none !important; }
                  }
                `}</style>
              </div>
            );
          }

          /* ─────────────────────────────────────────────────────────────────
             ACTIVE SOCIAL CLIENT — full management dashboard
          ───────────────────────────────────────────────────────────────── */
          const mockPosts = [
            { id: "p1", platform: "Instagram",  caption: "Winter sale is ON — 20% off all services this week only. Book today and lock in your spot before we fill up!", scheduledAt: "2026-05-14T09:00:00", status: "scheduled"         as const },
            { id: "p2", platform: "Facebook",   caption: "We just wrapped up a big job in the CBD — check out these before and afters. Proud of the team today! 💪", scheduledAt: "2026-05-15T11:00:00", status: "pending_approval" as const },
            { id: "p3", platform: "TikTok",     caption: "Quick tip: always check your gutters before the storm season hits. Here's what we found at a recent job...", scheduledAt: "2026-05-17T16:00:00", status: "scheduled"         as const },
            { id: "p4", platform: "Instagram",  caption: "5 ⭐ review from Sarah T. — 'Absolute legends. On time, clean, professional. Would recommend to anyone!'",      scheduledAt: "2026-05-12T09:00:00", status: "published"         as const },
          ];
          const fmtDate = (iso: string) => {
            const d = new Date(iso);
            return d.toLocaleDateString("en-AU", { weekday: "short", day: "numeric", month: "short" }) + " · " + d.toLocaleTimeString("en-AU", { hour: "numeric", minute: "2-digit" });
          };
          const pIcon = (p: string) => allPlatforms.find(x => x.id === p)?.icon || "📱";
          const pColor = (p: string) => allPlatforms.find(x => x.id === p)?.color || C.accentBlue;

          const innerTabs = [
            { id: "overview" as const, label: "Overview",  icon: "📊" },
            { id: "calendar" as const, label: "Calendar",  icon: "📅" },
            { id: "brief"    as const, label: "Post Brief", icon: "✍️" },
            { id: "setup"    as const, label: "Setup",      icon: "⚙️" },
          ];

          return (
            <div style={{ flex: 1, display: "flex", flexDirection: "column", overflow: "hidden", minHeight: 0 }}>

              {/* ── Inner tab bar ── */}
              <div style={{ display: "flex", gap: 4, marginBottom: 14, flexShrink: 0, borderBottom: `1px solid ${C.border}`, paddingBottom: 10 }}>
                {innerTabs.map(t => (
                  <button key={t.id} onClick={() => setSocialActiveTab(t.id)}
                    style={{ display: "flex", alignItems: "center", gap: 6, padding: "6px 14px", borderRadius: 8, fontSize: 12, fontWeight: socialActiveTab === t.id ? 700 : 500, cursor: "pointer",
                      background: socialActiveTab === t.id ? (dark ? "rgba(168,85,247,0.15)" : "rgba(124,58,237,0.09)") : "transparent",
                      color: socialActiveTab === t.id ? (dark ? "#c080ff" : "#7c3aed") : C.textMuted,
                      border: `1px solid ${socialActiveTab === t.id ? (dark ? "rgba(168,85,247,0.35)" : "rgba(124,58,237,0.25)") : "transparent"}`,
                      fontFamily: "inherit", transition: "all 0.15s ease",
                    }}>
                    <span>{t.icon}</span>{t.label}
                  </button>
                ))}
              </div>

              {/* ── Tab content area ── */}
              <div style={{ flex: 1, overflow: "hidden", minHeight: 0 }}>

                {/* ── OVERVIEW tab ── */}
                {socialActiveTab === "overview" && (
                  <div style={{ height: "100%", display: "flex", gap: 14, overflow: "hidden" }}>

                    {/* Left column */}
                    <div style={{ flex: 1, display: "flex", flexDirection: "column", gap: 12, overflowY: "auto", minWidth: 0 }}>

                      {/* Stats row */}
                      <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 10, flexShrink: 0 }}>
                        {[
                          { label: "Total Followers", value: "1,240", icon: "👥", color: C.accentBlue },
                          { label: "Posts This Month", value: "8",    icon: "📤", color: C.accent },
                          { label: "Avg Engagement",  value: "4.2%",  icon: "📈", color: C.purple },
                        ].map(stat => (
                          <div key={stat.label} style={{ background: C.surface, border: `1px solid ${stat.color}25`, borderRadius: 12, padding: "14px 16px", borderTop: `3px solid ${stat.color}`, boxShadow: C.shadow }}>
                            <div style={{ fontSize: 18, marginBottom: 6 }}>{stat.icon}</div>
                            <div style={{ fontSize: 20, fontWeight: 800, color: stat.color, letterSpacing: "-0.04em", marginBottom: 2 }}>{stat.value}</div>
                            <div style={{ fontSize: 10, color: C.textMuted, fontWeight: 600 }}>{stat.label}</div>
                          </div>
                        ))}
                      </div>

                      {/* Connected platforms */}
                      <div style={{ background: C.surface, border: `1px solid ${C.border}`, borderRadius: 14, padding: "16px 18px", flexShrink: 0, boxShadow: C.shadow }}>
                        <div style={{ fontSize: 10, fontWeight: 700, color: C.textMuted, textTransform: "uppercase", letterSpacing: "0.1em", marginBottom: 12 }}>Connected Platforms</div>
                        <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
                          {allPlatforms.map(p => {
                            const connected = connectedPlatforms.includes(p.id);
                            return (
                              <div key={p.id} style={{ display: "flex", alignItems: "center", gap: 7, background: connected ? `${p.color}14` : C.raised, border: `1px solid ${connected ? p.color + "40" : C.border}`, borderRadius: 20, padding: "6px 14px", fontSize: 12, fontWeight: 600, color: connected ? p.color : C.textMuted, transition: "all 0.2s ease" }}>
                                <span style={{ fontSize: 14 }}>{p.icon}</span>{p.id}
                                {connected && <span style={{ fontSize: 10, fontWeight: 800 }}>✓</span>}
                              </div>
                            );
                          })}
                        </div>
                        {connectedPlatforms.length === 0 && (
                          <div style={{ marginTop: 10, padding: "9px 12px", background: C.amberBg, border: `1px solid ${C.amber}30`, borderRadius: 8, fontSize: 12, color: C.amber, lineHeight: 1.5 }}>
                            Accounts are being set up — we'll connect them and notify you when ready.
                          </div>
                        )}
                        <div style={{ marginTop: 12, paddingTop: 12, borderTop: `1px solid ${C.border}`, display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                          <div style={{ fontSize: 11, color: C.textMuted }}>Need another platform?</div>
                          <button onClick={async () => {
                            try { await fetch("/api/client/upgrade-request", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ slug, businessName: client.businessName, email: client.email, type: "add_platform" }) }); alert("Request sent! We'll be in touch within 1 business day."); }
                            catch { alert("Please email hello@webgecko.au"); }
                          }} style={{ fontSize: 11, fontWeight: 700, color: dark ? "#a060ff" : "#7c3aed", background: dark ? "rgba(120,60,200,0.12)" : "rgba(124,58,237,0.07)", border: `1px solid ${dark ? "rgba(120,60,200,0.25)" : "rgba(124,58,237,0.2)"}`, borderRadius: 6, padding: "4px 10px", cursor: "pointer", fontFamily: "inherit" }}>＋ Add platform</button>
                        </div>
                      </div>

                      {/* Posting preference */}
                      <div style={{ background: C.surface, border: `1px solid ${C.border}`, borderRadius: 14, padding: "16px 18px", flexShrink: 0, boxShadow: C.shadow }}>
                        <div style={{ fontSize: 10, fontWeight: 700, color: C.textMuted, textTransform: "uppercase", letterSpacing: "0.1em", marginBottom: 12 }}>Posting Preference</div>
                        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
                          {([
                            { id: "auto"   as const, icon: "⚡", title: "Auto-post",       desc: "We review and publish on your behalf — no action needed from you." },
                            { id: "manual" as const, icon: "✅", title: "Approve first",   desc: "Every post comes to you for approval before going live." },
                          ] as const).map(opt => {
                            const sel = postingMode === opt.id;
                            return (
                              <button key={opt.id} onClick={async () => { setPostingMode(opt.id); await fetch("/api/client/social-settings", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ slug, postingMode: opt.id }) }).catch(() => {}); }}
                                style={{ background: sel ? `${C.accentBlue}10` : C.raised, border: `2px solid ${sel ? C.accentBlue : C.border}`, borderRadius: 12, padding: "14px", cursor: "pointer", textAlign: "left", transition: "all 0.18s ease", fontFamily: "inherit" }}>
                                <div style={{ fontSize: 20, marginBottom: 6 }}>{opt.icon}</div>
                                <div style={{ fontSize: 12, fontWeight: 700, color: C.text, marginBottom: 3 }}>{opt.title}</div>
                                <div style={{ fontSize: 11, color: C.textMuted, lineHeight: 1.5 }}>{opt.desc}</div>
                                {sel && <div style={{ marginTop: 8, fontSize: 10, fontWeight: 700, color: C.accentBlue }}>✓ Active</div>}
                              </button>
                            );
                          })}
                        </div>
                      </div>
                    </div>

                    {/* Right column: recent posts preview */}
                    <div style={{ width: 280, flexShrink: 0, overflowY: "auto" }}>
                      <div style={{ background: C.surface, border: `1px solid ${C.border}`, borderRadius: 14, padding: "16px 18px", boxShadow: C.shadow }}>
                        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 14 }}>
                          <div style={{ fontSize: 10, fontWeight: 700, color: C.textMuted, textTransform: "uppercase", letterSpacing: "0.1em" }}>Recent Posts</div>
                          <button onClick={() => setSocialActiveTab("calendar")} style={{ fontSize: 11, color: dark ? "#a060ff" : "#7c3aed", background: "none", border: "none", cursor: "pointer", fontWeight: 600, fontFamily: "inherit" }}>View all →</button>
                        </div>
                        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                          {mockPosts.slice(0, 3).map(post => (
                            <div key={post.id} style={{ background: C.raised, border: `1px solid ${C.border}`, borderRadius: 10, padding: "12px", borderLeft: `3px solid ${post.status === "published" ? C.accent : post.status === "pending_approval" ? C.amber : C.accentBlue}` }}>
                              <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 6 }}>
                                <span style={{ fontSize: 14 }}>{pIcon(post.platform)}</span>
                                <span style={{ fontSize: 11, fontWeight: 600, color: C.textSec }}>{post.platform}</span>
                                <span style={{ fontSize: 10, padding: "2px 7px", borderRadius: 4, fontWeight: 700,
                                  background: post.status === "published" ? `${C.accent}18` : post.status === "pending_approval" ? `${C.amber}18` : `${C.accentBlue}18`,
                                  color: post.status === "published" ? C.accent : post.status === "pending_approval" ? C.amber : C.accentBlue,
                                }}>
                                  {post.status === "published" ? "✓ Live" : post.status === "pending_approval" ? "⏳ Awaiting" : "🕐 Scheduled"}
                                </span>
                              </div>
                              <div style={{ fontSize: 12, color: C.textSec, lineHeight: 1.4, overflow: "hidden", display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical" as any }}>{post.caption}</div>
                              <div style={{ fontSize: 10, color: C.textMuted, marginTop: 6 }}>{fmtDate(post.scheduledAt)}</div>
                              {post.status === "pending_approval" && postingMode === "manual" && (
                                <div style={{ display: "flex", gap: 6, marginTop: 8 }}>
                                  <button style={{ flex: 1, background: `${C.accent}18`, color: C.accent, border: `1px solid ${C.accent}30`, borderRadius: 6, padding: "5px", fontSize: 11, fontWeight: 700, cursor: "pointer" }}>✓ Approve</button>
                                  <button style={{ flex: 1, background: C.raised, color: C.textMuted, border: `1px solid ${C.border}`, borderRadius: 6, padding: "5px", fontSize: 11, cursor: "pointer" }}>✎ Edit</button>
                                </div>
                              )}
                            </div>
                          ))}
                        </div>
                        
                      </div>
                    </div>
                  </div>
                )}

                {/* ── CALENDAR tab ── */}
                {socialActiveTab === "calendar" && (
                  <div style={{ height: "100%", overflowY: "auto" }}>
                    <div style={{ background: C.surface, border: `1px solid ${C.border}`, borderRadius: 14, padding: "18px 20px", boxShadow: C.shadow }}>
                      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 16 }}>
                        <div>
                          <div style={{ fontSize: 10, fontWeight: 700, color: C.textMuted, textTransform: "uppercase", letterSpacing: "0.1em" }}>Content Calendar</div>
                          <div style={{ fontSize: 12, color: C.textMuted, marginTop: 2 }}>All upcoming & recent posts</div>
                        </div>
                        
                      </div>
                      <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                        {mockPosts.map(post => (
                          <div key={post.id} style={{ background: C.raised, border: `1px solid ${C.border}`, borderRadius: 12, padding: "14px 16px", borderLeft: `3px solid ${post.status === "published" ? C.accent : post.status === "pending_approval" ? C.amber : C.accentBlue}` }}>
                            <div style={{ display: "flex", alignItems: "flex-start", gap: 12 }}>
                              <div style={{ width: 36, height: 36, borderRadius: 9, flexShrink: 0, background: `${pColor(post.platform)}18`, border: `1px solid ${pColor(post.platform)}35`, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 17 }}>{pIcon(post.platform)}</div>
                              <div style={{ flex: 1, minWidth: 0 }}>
                                <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 6, flexWrap: "wrap" }}>
                                  <span style={{ fontSize: 12, fontWeight: 600, color: C.textSec }}>{post.platform}</span>
                                  <span style={{ fontSize: 11, color: C.textMuted }}>· {fmtDate(post.scheduledAt)}</span>
                                  <span style={{ fontSize: 10, fontWeight: 700, padding: "2px 8px", borderRadius: 5,
                                    background: post.status === "published" ? `${C.accent}18` : post.status === "pending_approval" ? `${C.amber}18` : `${C.accentBlue}18`,
                                    color: post.status === "published" ? C.accent : post.status === "pending_approval" ? C.amber : C.accentBlue,
                                    border: `1px solid ${post.status === "published" ? C.accent : post.status === "pending_approval" ? C.amber : C.accentBlue}30`,
                                  }}>
                                    {post.status === "published" ? "✓ Published" : post.status === "pending_approval" ? "⏳ Awaiting approval" : "🕐 Scheduled"}
                                  </span>
                                </div>
                                <div style={{ fontSize: 13, color: C.textSec, lineHeight: 1.5, overflow: "hidden", display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical" as any }}>{post.caption}</div>
                                {post.status === "pending_approval" && postingMode === "manual" && (
                                  <div style={{ display: "flex", gap: 8, marginTop: 10 }}>
                                    <button style={{ background: `${C.accent}18`, color: C.accent, border: `1px solid ${C.accent}30`, borderRadius: 7, padding: "6px 14px", fontSize: 12, fontWeight: 600, cursor: "pointer" }}>✓ Approve</button>
                                    <button style={{ background: C.raised, color: C.textMuted, border: `1px solid ${C.border}`, borderRadius: 7, padding: "6px 14px", fontSize: 12, cursor: "pointer" }}>✎ Request changes</button>
                                  </div>
                                )}
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                )}

                {/* ── BRIEF tab ── */}
                {socialActiveTab === "brief" && (
                  <div style={{ height: "100%", overflowY: "auto" }}>
                    <div style={{ background: C.surface, border: `1px solid ${C.border}`, borderRadius: 14, padding: "18px 20px", boxShadow: C.shadow }}>
                      <div style={{ fontSize: 10, fontWeight: 700, color: C.textMuted, textTransform: "uppercase", letterSpacing: "0.1em", marginBottom: 4 }}>Submit a Post Idea</div>
                      <div style={{ fontSize: 13, color: C.textMuted, marginBottom: 18, lineHeight: 1.5 }}>Upload a photo or describe what you want — we'll write the caption, add hashtags, and schedule it.</div>
                      {socialSubmitted ? (
                        <div style={{ textAlign: "center", padding: "28px 0" }}>
                          <div style={{ fontSize: 36, marginBottom: 12 }}>🚀</div>
                          <div style={{ fontSize: 15, fontWeight: 700, color: C.text, marginBottom: 6 }}>Brief received!</div>
                          <div style={{ fontSize: 13, color: C.textMuted, marginBottom: 18, lineHeight: 1.6 }}>We'll have a draft ready within 24 hours for your review.</div>
                          <button onClick={() => { setSocialSubmitted(false); setSocialBrief(""); setSocialFile(null); }} style={{ background: C.raised, color: C.textSec, border: `1px solid ${C.border}`, borderRadius: 10, padding: "9px 20px", fontSize: 13, fontWeight: 600, cursor: "pointer", fontFamily: "inherit" }}>Submit another</button>
                        </div>
                      ) : (
                        <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
                          <label style={{ display: "flex", alignItems: "center", gap: 12, padding: "14px 18px", background: C.raised, border: `2px dashed ${socialFile ? C.accentBlue : C.border}`, borderRadius: 10, cursor: "pointer" }}>
                            <span style={{ fontSize: 22 }}>🖼️</span>
                            <div><div style={{ fontSize: 13, fontWeight: 600, color: C.text }}>{socialFile ? socialFile.name : "Click to upload photo (optional)"}</div><div style={{ fontSize: 11, color: C.textMuted }}>PNG, JPG, HEIC up to 20MB</div></div>
                            <input type="file" accept="image/*" style={{ display: "none" }} onChange={e => setSocialFile(e.target.files?.[0] || null)} />
                          </label>
                          <div>
                            <label style={{ fontSize: 12, fontWeight: 600, color: C.textSec, display: "block", marginBottom: 8 }}>What is this post about? *</label>
                            <textarea value={socialBrief} onChange={e => setSocialBrief(e.target.value)} rows={4} placeholder="e.g. We just finished a big job in Surry Hills. Want to show off the before/after and promote our winter discount." style={{ width: "100%", background: C.raised, border: `1px solid ${C.border}`, borderRadius: 10, padding: "11px 14px", color: C.text, fontSize: 13, outline: "none", resize: "vertical", fontFamily: "inherit", boxSizing: "border-box", lineHeight: 1.6 }} />
                          </div>
                          <div>
                            <label style={{ fontSize: 12, fontWeight: 600, color: C.textSec, display: "block", marginBottom: 8 }}>Tone</label>
                            <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                              {(["professional","friendly","casual","promotional"] as const).map(t => (
                                <button key={t} onClick={() => setSocialTone(t)} style={{ padding: "7px 16px", borderRadius: 20, fontSize: 12, fontWeight: socialTone === t ? 700 : 400, cursor: "pointer", background: socialTone === t ? C.accentBlue : C.raised, color: socialTone === t ? "#fff" : C.textSec, border: `1px solid ${socialTone === t ? C.accentBlue : C.border}`, fontFamily: "inherit", textTransform: "capitalize" }}>{t}</button>
                              ))}
                            </div>
                          </div>
                          <div>
                            <label style={{ fontSize: 12, fontWeight: 600, color: C.textSec, display: "block", marginBottom: 8 }}>Post to</label>
                            <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                              {(["Instagram","Facebook","TikTok","LinkedIn"] as const).map(p => {
                                const sel = socialPlatforms.includes(p);
                                const pc = allPlatforms.find(x => x.id === p)?.color || C.accentBlue;
                                return <button key={p} onClick={() => setSocialPlatforms(prev => sel ? prev.filter(x => x !== p) : [...prev, p])} style={{ display: "flex", alignItems: "center", gap: 6, padding: "7px 14px", borderRadius: 20, fontSize: 12, fontWeight: sel ? 700 : 400, cursor: "pointer", background: sel ? `${pc}18` : C.raised, color: sel ? pc : C.textMuted, border: `1px solid ${sel ? pc + "50" : C.border}`, fontFamily: "inherit" }}>{pIcon(p)} {p}{sel && <span style={{ fontWeight: 800 }}>✓</span>}</button>;
                              })}
                            </div>
                          </div>
                          <button onClick={async () => { if (!socialBrief.trim()) return; setSocialSubmitting(true); try { const fd = new FormData(); if (socialFile) fd.append("photo", socialFile); fd.append("slug", slug); fd.append("brief", socialBrief); fd.append("tone", socialTone); fd.append("platforms", JSON.stringify(socialPlatforms)); await fetch("/api/client/social-upload", { method: "POST", body: fd }); setSocialSubmitted(true); } catch (e) { /* silent */ } finally { setSocialSubmitting(false); } }}
                            disabled={socialSubmitting || !socialBrief.trim()} style={{ background: (!socialBrief.trim() || socialSubmitting) ? C.raised : `linear-gradient(135deg, ${C.accentBlue}, #7c3aed)`, color: (!socialBrief.trim() || socialSubmitting) ? C.textMuted : "#fff", border: "none", borderRadius: 10, padding: "12px 24px", fontSize: 14, fontWeight: 700, cursor: (!socialBrief.trim() || socialSubmitting) ? "not-allowed" : "pointer", width: "100%", fontFamily: "inherit" }}>
                            {socialSubmitting ? "Submitting…" : "Request Post →"}
                          </button>
                        </div>
                      )}
                    </div>
                  </div>
                )}

                {/* ── SETUP tab ── */}
                {socialActiveTab === "setup" && (
                  <div style={{ height: "100%", overflowY: "auto" }}>
                    {!socialSetupStep ? (
                      /* Choose path */
                      <div style={{ maxWidth: 600, margin: "0 auto" }}>
                        <div style={{ marginBottom: 20 }}>
                          <div style={{ fontSize: 16, fontWeight: 800, color: C.text, marginBottom: 6 }}>Account Setup</div>
                          <div style={{ fontSize: 13, color: C.textMuted, lineHeight: 1.6 }}>
                            How would you like to get your social accounts connected? Choose the option that suits you best — we'll handle the rest.
                          </div>
                        </div>
                        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 }}>
                          {/* Option A — They have accounts */}
                          <button onClick={() => setSocialSetupStep("link")}
                            style={{ background: C.surface, border: `2px solid ${C.border}`, borderRadius: 16, padding: "22px 20px", cursor: "pointer", textAlign: "left", transition: "all 0.18s ease", fontFamily: "inherit" }}
                            onMouseEnter={e => (e.currentTarget.style.borderColor = C.accentBlue)} onMouseLeave={e => (e.currentTarget.style.borderColor = C.border)}>
                            <div style={{ fontSize: 32, marginBottom: 12 }}>🔗</div>
                            <div style={{ fontSize: 14, fontWeight: 800, color: C.text, marginBottom: 8 }}>I already have accounts</div>
                            <div style={{ fontSize: 12, color: C.textMuted, lineHeight: 1.6, marginBottom: 14 }}>
                              You already have Instagram, Facebook, etc. We just need to link your existing accounts to our publishing platform.
                            </div>
                            <div style={{ display: "flex", flexDirection: "column", gap: 5 }}>
                              {["We send you a secure access request", "You approve in-app (takes 2 minutes)", "We're connected — posting starts immediately"].map(s => (
                                <div key={s} style={{ display: "flex", alignItems: "flex-start", gap: 6, fontSize: 11, color: C.textSec }}>
                                  <span style={{ color: C.accentBlue, fontWeight: 700, flexShrink: 0 }}>→</span>{s}
                                </div>
                              ))}
                            </div>
                            <div style={{ marginTop: 14, fontSize: 12, fontWeight: 700, color: C.accentBlue }}>Choose this →</div>
                          </button>

                          {/* Option B — We create everything */}
                          <button onClick={() => setSocialSetupStep("create")}
                            style={{ background: C.surface, border: `2px solid ${C.border}`, borderRadius: 16, padding: "22px 20px", cursor: "pointer", textAlign: "left", transition: "all 0.18s ease", fontFamily: "inherit" }}
                            onMouseEnter={e => (e.currentTarget.style.borderColor = "#a855f7")} onMouseLeave={e => (e.currentTarget.style.borderColor = C.border)}>
                            <div style={{ fontSize: 32, marginBottom: 12 }}>🛠️</div>
                            <div style={{ fontSize: 14, fontWeight: 800, color: C.text, marginBottom: 8 }}>Start from scratch</div>
                            <div style={{ fontSize: 12, color: C.textMuted, lineHeight: 1.6, marginBottom: 14 }}>
                              No accounts yet, or you want a fresh start. We create a Gmail in your business name, set up all platforms, and hand you full control.
                            </div>
                            <div style={{ display: "flex", flexDirection: "column", gap: 5 }}>
                              {["We create a Gmail (you're CC'd on every email)", "We set up all your social platforms", "Legal agreements & brand info added", "You reset the password — it's 100% yours"].map(s => (
                                <div key={s} style={{ display: "flex", alignItems: "flex-start", gap: 6, fontSize: 11, color: C.textSec }}>
                                  <span style={{ color: "#a855f7", fontWeight: 700, flexShrink: 0 }}>→</span>{s}
                                </div>
                              ))}
                            </div>
                            <div style={{ marginTop: 14, fontSize: 12, fontWeight: 700, color: "#a855f7" }}>Choose this →</div>
                          </button>
                        </div>
                      </div>
                    ) : socialSetupStep === "link" ? (
                      /* Link existing accounts flow */
                      <div style={{ maxWidth: 560, margin: "0 auto" }}>
                        <button onClick={() => setSocialSetupStep(null)} style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 12, color: C.textMuted, background: "none", border: "none", cursor: "pointer", marginBottom: 16, fontFamily: "inherit", padding: 0 }}>← Back</button>
                        <div style={{ fontSize: 16, fontWeight: 800, color: C.text, marginBottom: 6 }}>🔗 Link Your Existing Accounts</div>
                        <div style={{ fontSize: 13, color: C.textMuted, marginBottom: 20, lineHeight: 1.6 }}>
                          Tell us which platforms you have and we'll send you a secure connection request. You approve access directly inside each app — we never see your passwords.
                        </div>
                        <div style={{ background: C.surface, border: `1px solid ${C.border}`, borderRadius: 14, padding: "18px 20px", marginBottom: 16, boxShadow: C.shadow }}>
                          <div style={{ fontSize: 11, fontWeight: 700, color: C.textMuted, textTransform: "uppercase", letterSpacing: "0.1em", marginBottom: 14 }}>Which platforms do you have?</div>
                          <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginBottom: 18 }}>
                            {allPlatforms.map(p => {
                              const sel = socialPlatforms.includes(p.id);
                              return (
                                <button key={p.id} onClick={() => setSocialPlatforms(prev => sel ? prev.filter(x => x !== p.id) : [...prev, p.id])}
                                  style={{ display: "flex", alignItems: "center", gap: 7, padding: "8px 16px", borderRadius: 20, fontSize: 12, fontWeight: sel ? 700 : 500, cursor: "pointer", background: sel ? `${p.color}14` : C.raised, color: sel ? p.color : C.textMuted, border: `2px solid ${sel ? p.color + "60" : C.border}`, transition: "all 0.15s ease", fontFamily: "inherit" }}>
                                  <span style={{ fontSize: 15 }}>{p.icon}</span>{p.id}{sel && <span style={{ fontWeight: 800 }}>✓</span>}
                                </button>
                              );
                            })}
                          </div>
                          <div style={{ background: C.raised, border: `1px solid ${C.border}`, borderRadius: 10, padding: "12px 14px", marginBottom: 16 }}>
                            <div style={{ fontSize: 11, fontWeight: 700, color: C.textSec, marginBottom: 6 }}>What happens next:</div>
                            {["We send an access request via Meta Business Suite / TikTok Creator Portal / LinkedIn", "You click 'Approve' — takes about 2 minutes", "We confirm connection and start your content calendar"].map((s, i) => (
                              <div key={i} style={{ display: "flex", alignItems: "flex-start", gap: 8, fontSize: 11, color: C.textMuted, lineHeight: 1.5, marginBottom: 4 }}>
                                <span style={{ background: C.accentBlue, color: "#fff", borderRadius: "50%", width: 16, height: 16, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 9, fontWeight: 800, flexShrink: 0 }}>{i + 1}</span>{s}
                              </div>
                            ))}
                          </div>
                          <button onClick={async () => {
                            try { await fetch("/api/client/upgrade-request", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ slug, businessName: client.businessName, email: client.email, type: "social_link_existing", platforms: socialPlatforms }) }); alert("Done! We'll send you the connection request within 1 business day."); } catch { alert("Please email hello@webgecko.au"); }
                          }} style={{ display: "block", width: "100%", background: `linear-gradient(135deg, ${C.accentBlue}, #3b82f6)`, color: "#fff", borderRadius: 10, padding: "12px", fontSize: 13, fontWeight: 700, border: "none", cursor: "pointer", fontFamily: "inherit" }}>
                            Send Me the Connection Request →
                          </button>
                        </div>
                      </div>
                    ) : (
                      /* We create everything flow */
                      <div style={{ maxWidth: 560, margin: "0 auto" }}>
                        <button onClick={() => setSocialSetupStep(null)} style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 12, color: C.textMuted, background: "none", border: "none", cursor: "pointer", marginBottom: 16, fontFamily: "inherit", padding: 0 }}>← Back</button>
                        <div style={{ fontSize: 16, fontWeight: 800, color: C.text, marginBottom: 6 }}>🛠️ Full Account Creation</div>
                        <div style={{ fontSize: 13, color: C.textMuted, marginBottom: 20, lineHeight: 1.6 }}>
                          We handle everything from scratch — accounts, setup, legal agreements, all linked and ready. You stay in full control the entire time.
                        </div>
                        {/* Steps */}
                        <div style={{ display: "flex", flexDirection: "column", gap: 10, marginBottom: 16 }}>
                          {[
                            { icon: "📧", step: "1", title: "We create a Gmail for your business", desc: "Format: yourbusiness@gmail.com — you're CC'd on every single email sent. Total transparency, always.", highlight: true },
                            { icon: "⚖️", step: "2", title: "Legal agreements added", desc: "Terms of service, platform policies, and our management agreement are stored in the account." },
                            { icon: "📱", step: "3", title: "All platforms created & branded", desc: "We create and brand your Instagram, Facebook, TikTok, LinkedIn (and others as per your plan) using your logo, colours, and bio." },
                            { icon: "🔌", step: "4", title: "Linked to our publishing platform", desc: "All accounts are connected to our scheduling system for posting, analytics, and team management." },
                            { icon: "🔑", step: "5", title: "You reset the password — it's 100% yours", desc: "We send you a password reset link. From that moment, only you control the accounts. We retain publishing access only." },
                          ].map(s => (
                            <div key={s.step} style={{ display: "flex", gap: 14, background: s.highlight ? (dark ? "rgba(168,85,247,0.08)" : "rgba(124,58,237,0.05)") : C.surface, border: `1px solid ${s.highlight ? "rgba(168,85,247,0.25)" : C.border}`, borderRadius: 12, padding: "14px 16px", boxShadow: C.shadow }}>
                              <div style={{ width: 30, height: 30, borderRadius: 8, background: s.highlight ? "rgba(168,85,247,0.15)" : C.raised, border: `1px solid ${s.highlight ? "rgba(168,85,247,0.3)" : C.border}`, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 15, flexShrink: 0 }}>{s.icon}</div>
                              <div>
                                <div style={{ fontSize: 12, fontWeight: 700, color: C.text, marginBottom: 3 }}>Step {s.step}: {s.title}</div>
                                <div style={{ fontSize: 11, color: C.textMuted, lineHeight: 1.5 }}>{s.desc}</div>
                                {s.highlight && <div style={{ marginTop: 6, fontSize: 10, fontWeight: 700, color: "#a855f7", background: "rgba(168,85,247,0.1)", border: "1px solid rgba(168,85,247,0.2)", borderRadius: 5, padding: "3px 8px", display: "inline-block" }}>📧 You're CC'd on everything</div>}
                              </div>
                            </div>
                          ))}
                        </div>
                        <div style={{ background: C.amberBg, border: `1px solid ${C.amber}30`, borderRadius: 10, padding: "10px 14px", fontSize: 11, color: C.amber, lineHeight: 1.5, marginBottom: 16 }}>
                          ⚡ Setup typically takes 2–3 business days. You'll receive a confirmation email once everything is live.
                        </div>
                        <button onClick={async () => {
                          try { await fetch("/api/client/upgrade-request", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ slug, businessName: client.businessName, email: client.email, type: "social_create_accounts", platforms: socialPlatforms }) }); alert("Request submitted! We'll be in touch within 1 business day to kick things off."); } catch { alert("Please email hello@webgecko.au"); }
                        }} style={{ display: "block", width: "100%", background: "linear-gradient(135deg,#7c3aed,#a855f7)", color: "#fff", borderRadius: 10, padding: "13px", fontSize: 13, fontWeight: 700, border: "none", cursor: "pointer", fontFamily: "inherit", boxShadow: "0 4px 16px rgba(124,58,237,0.35)" }}>
                          Start Full Setup →
                        </button>
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>
          );
        })()}

        {tab === "contact" && (
          <>
            <div style={S.card}>
              <div style={S.label}>Contact & Support</div>
              <div style={{ fontSize: 13, color: C.textMuted, marginBottom: 20, lineHeight: 1.6 }}>
                Need help or have a question? Select what it's about and we'll get back to you promptly.
              </div>

              {contactSubmitted ? (
                <div style={{ background: `${C.accent}10`, border: `1px solid ${C.accent}25`, borderRadius: 10, padding: "24px 20px", textAlign: "center" }}>
                  <div style={{ fontSize: 22, marginBottom: 10 }}>✅</div>
                  <div style={{ fontSize: 14, fontWeight: 600, color: C.accent, marginBottom: 6 }}>Message Sent</div>
                  <div style={{ fontSize: 13, color: C.textMuted }}>We've received your message and will follow up at <strong style={{ color: C.textSec }}>{client.email || "your email"}</strong> shortly.</div>
                  <button onClick={() => { setContactSubmitted(false); setContactTopics([]); setContactDetails(""); }} style={{ ...S.btn("secondary"), marginTop: 16, fontSize: 13 }}>Send Another Message</button>
                </div>
              ) : (
                <>
                  <div style={{ fontSize: 11, fontWeight: 600, color: C.textMuted, textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: 10 }}>What's this about?</div>
                  <div style={{ display: "flex", flexDirection: "column", gap: 6, marginBottom: 20 }}>
                    {[
                      { id: "change_request",   label: "I need a change to my site",        icon: "✏️" },
                      { id: "billing",          label: "Billing or payment question",        icon: "💳" },
                      { id: "technical_issue",  label: "Something on my site isn't working", icon: "🔧" },
                      { id: "booking_setup",    label: "Booking system help",                icon: "📅" },
                      { id: "domain_dns",       label: "Domain or DNS issue",                icon: "🌐" },
                      { id: "new_feature",      label: "I want to add something new",        icon: "✨" },
                      { id: "launch",           label: "I'm ready to launch",                icon: "🚀" },
                      { id: "other",            label: "Other",                              icon: "💬" },
                    ].map(topic => {
                      const sel = contactTopics.includes(topic.id);
                      return (
                        <button
                          key={topic.id}
                          onClick={() => setContactTopics(prev => sel ? prev.filter(x => x !== topic.id) : [...prev, topic.id])}
                          style={{
                            display: "flex", alignItems: "center", gap: 12,
                            background: sel ? `${C.accentBlue}12` : C.raised,
                            border: `1px solid ${sel ? C.accentBlue + "50" : C.border}`,
                            borderRadius: 9, padding: "11px 14px", cursor: "pointer",
                            textAlign: "left", width: "100%",
                            transition: "background 0.15s ease, border-color 0.15s ease",
                          }}
                        >
                          <span style={{ fontSize: 18, flexShrink: 0 }}>{topic.icon}</span>
                          <span style={{ fontSize: 13, fontWeight: sel ? 600 : 400, color: sel ? C.text : C.textSec, flex: 1, transition: "color 0.15s" }}>{topic.label}</span>
                          <div style={{ width: 18, height: 18, borderRadius: "50%", border: `2px solid ${sel ? C.accentBlue : C.border}`, background: sel ? C.accentBlue : "transparent", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0, transition: "all 0.15s ease" }}>
                            {sel && <span style={{ color: "#fff", fontSize: 10, fontWeight: 800 }}>✓</span>}
                          </div>
                        </button>
                      );
                    })}
                  </div>

                  <div style={{ fontSize: 11, fontWeight: 600, color: C.textMuted, textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: 8 }}>Describe what you need</div>
                  <textarea
                    value={contactDetails}
                    onChange={e => setContactDetails(e.target.value)}
                    placeholder="Give us as much detail as you like — the more context, the faster we can help."
                    rows={4}
                    style={{ width: "100%", background: C.raised, border: `1px solid ${C.border}`, borderRadius: 8, padding: "10px 14px", color: C.text, fontSize: 13, outline: "none", resize: "vertical", fontFamily: "inherit", boxSizing: "border-box" as const, marginBottom: 14, transition: "border-color 0.2s ease", lineHeight: 1.6 }}
                  />

                  <button
                    onClick={submitContactRequest}
                    disabled={contactSubmitting || (contactTopics.length === 0 && contactDetails.trim() === "")}
                    style={{ ...S.btn("primary", contactSubmitting || (contactTopics.length === 0 && contactDetails.trim() === "")), width: "100%", fontSize: 14 }}
                  >
                    {contactSubmitting ? "Sending…" : "Send Message →"}
                  </button>
                  <div style={{ fontSize: 11, color: C.textMuted, textAlign: "center", marginTop: 8 }}>Sent to hello@webgecko.au · We respond within 1 business day</div>
                </>
              )}
            </div>
          </>
        )}

        {/* ══════════════════════ SETTINGS ══════════════════════ */}
        {tab === "settings" && (
          <>
            {/* Legal Documents */}
            <div style={S.card}>
              <div style={S.label}>Legal Documents</div>
              <div style={{ fontSize: 13, color: C.textMuted, marginBottom: 16, lineHeight: 1.6 }}>
                These are the agreements that govern your relationship with Web Gecko. You accepted these before your first payment.
              </div>
              {[
                { title: "Terms & Conditions", ref: "WG-TNC-001", desc: "Full service agreement covering payments, IP, liability, and dispute resolution.", url: "/legal/WebGecko_Terms_and_Conditions.pdf", icon: "📄" },
                { title: "Privacy Policy", ref: "WG-PRV-001", desc: "How we collect, use, and protect your personal information under Australian Privacy Law.", url: "/legal/WebGecko_Privacy_Policy.pdf", icon: "🔒" },
                { title: "Cancellation & Refund Policy", ref: "WG-CAN-001", desc: "Your rights and our obligations around cancellations, refunds, and handover packages.", url: "/legal/WebGecko_Cancellation_and_Refund_Policy.pdf", icon: "↩️" },
                { title: "Social Media Management Agreement", ref: "WG-SOC-001", desc: "Account ownership, content approval, community management, and offboarding terms.", url: "/legal/WebGecko_Social_Media_Agreement.pdf", icon: "📱" },
              ].map(doc => (
                <a key={doc.ref} href={doc.url} target="_blank" rel="noreferrer" style={{ textDecoration: "none", display: "flex", alignItems: "center", gap: 14, padding: "12px 14px", background: C.raised, border: `1px solid ${C.border}`, borderRadius: 10, marginBottom: 8, transition: "border-color 0.18s" }}
                  onMouseEnter={e => (e.currentTarget as HTMLElement).style.borderColor = C.accentBlue + "60"}
                  onMouseLeave={e => (e.currentTarget as HTMLElement).style.borderColor = C.border}>
                  <span style={{ fontSize: 22, flexShrink: 0 }}>{doc.icon}</span>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 13, fontWeight: 700, color: C.text, marginBottom: 2 }}>{doc.title}</div>
                    <div style={{ fontSize: 11, color: C.textMuted, lineHeight: 1.4 }}>{doc.desc}</div>
                  </div>
                  <div style={{ flexShrink: 0, display: "flex", flexDirection: "column" as const, alignItems: "flex-end", gap: 4 }}>
                    <span style={{ fontSize: 10, fontWeight: 700, color: C.textMuted, background: C.surface, border: `1px solid ${C.border}`, borderRadius: 5, padding: "2px 7px" }}>{doc.ref}</span>
                    <span style={{ fontSize: 11, color: C.accentBlue }}>View PDF ↗</span>
                  </div>
                </a>
              ))}
            </div>

            {/* Acceptance record */}
            <div style={{ ...S.card, background: termsAccepted ? (dark ? "rgba(0,200,150,0.05)" : "rgba(0,200,150,0.04)") : C.surface, borderColor: termsAccepted ? `${C.accent}30` : C.border }}>
              <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 8 }}>
                <span style={{ fontSize: 18 }}>{termsAccepted ? "✅" : "⚠️"}</span>
                <div style={{ fontSize: 13, fontWeight: 700, color: termsAccepted ? C.accent : C.amber }}>
                  {termsAccepted ? "You have accepted all legal agreements" : "You have not yet accepted the legal agreements"}
                </div>
              </div>
              <div style={{ fontSize: 12, color: C.textMuted, lineHeight: 1.6 }}>
                {termsAccepted
                  ? "Your acceptance was recorded when you first paid your deposit. If you have questions about any of these documents, contact us at hello@webgecko.au."
                  : "Acceptance of all legal documents is required before your first payment. These will be shown automatically when you proceed to pay."}
              </div>
            </div>

            {/* Account info */}
            <div style={S.card}>
              <div style={S.label}>Your Account</div>
              <div style={{ display: "flex", flexDirection: "column" as const, gap: 10 }}>
                {[
                  { label: "Business", value: client.businessName },
                  { label: "Slug / Portal ID", value: slug },
                  { label: "Service", value: serviceMode === "both" ? "Website + Social Media" : serviceMode === "social" ? "Social Media Management" : "Website" },
                ].map(row => (
                  <div key={row.label} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "8px 0", borderBottom: `1px solid ${C.border}` }}>
                    <span style={{ fontSize: 12, color: C.textMuted }}>{row.label}</span>
                    <span style={{ fontSize: 13, fontWeight: 600, color: C.text }}>{row.value}</span>
                  </div>
                ))}
              </div>
              <button onClick={signOut} style={{ ...S.btn("ghost"), marginTop: 14, fontSize: 12, width: "100%" }}>Sign Out</button>
            </div>
          </>
        )}

        {/* ══════════════════════ TERMS MODAL ══════════════════════ */}
        {termsModalOpen && (
          <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.88)", zIndex: 200, display: "flex", alignItems: "center", justifyContent: "center", padding: 20 }} onClick={() => setTermsModalOpen(false)}>
            <div style={{ background: C.surface, border: `1px solid ${C.border}`, borderRadius: 18, padding: 28, width: "100%", maxWidth: 500, maxHeight: "90vh", overflowY: "auto" as const }} onClick={e => e.stopPropagation()}>
              <div style={{ fontSize: 20, fontWeight: 800, color: C.text, marginBottom: 4 }}>Before you pay</div>
              <div style={{ fontSize: 13, color: C.textMuted, marginBottom: 20, lineHeight: 1.6 }}>
                Please read and accept all of the following agreements. You can view the full PDF for each at any time from the Settings tab.
              </div>

              {[
                { key: "tnc", title: "Terms & Conditions", ref: "WG-TNC-001", url: "/legal/WebGecko_Terms_and_Conditions.pdf", desc: "Service agreement, payment terms, liability, and dispute resolution." },
                { key: "privacy", title: "Privacy Policy", ref: "WG-PRV-001", url: "/legal/WebGecko_Privacy_Policy.pdf", desc: "How we collect and protect your personal information." },
                { key: "cancellation", title: "Cancellation & Refund Policy", ref: "WG-CAN-001", url: "/legal/WebGecko_Cancellation_and_Refund_Policy.pdf", desc: "Your rights around cancellations, refunds, and handover." },
                { key: "social", title: "Social Media Agreement", ref: "WG-SOC-001", url: "/legal/WebGecko_Social_Media_Agreement.pdf", desc: "Account creation, management, and offboarding terms." },
              ].map(doc => {
                const checked = termsChecked[doc.key as keyof typeof termsChecked];
                return (
                  <div key={doc.key} style={{ background: checked ? (dark ? "rgba(0,200,150,0.06)" : "rgba(0,200,150,0.04)") : C.raised, border: `1px solid ${checked ? C.accent + "40" : C.border}`, borderRadius: 10, padding: "12px 14px", marginBottom: 10, transition: "all 0.18s" }}>
                    <div style={{ display: "flex", alignItems: "flex-start", gap: 10 }}>
                      <input type="checkbox" checked={checked}
                        onChange={e => setTermsChecked(prev => ({ ...prev, [doc.key]: e.target.checked }))}
                        style={{ marginTop: 2, accentColor: C.accent, width: 15, height: 15, flexShrink: 0, cursor: "pointer" }}/>
                      <div style={{ flex: 1 }}>
                        <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 3 }}>
                          <span style={{ fontSize: 13, fontWeight: 700, color: C.text }}>{doc.title}</span>
                          <span style={{ fontSize: 10, color: C.textMuted, background: C.surface, border: `1px solid ${C.border}`, borderRadius: 4, padding: "1px 6px" }}>{doc.ref}</span>
                        </div>
                        <div style={{ fontSize: 11, color: C.textMuted, lineHeight: 1.4, marginBottom: 6 }}>{doc.desc}</div>
                        <a href={doc.url} target="_blank" rel="noreferrer" style={{ fontSize: 11, color: C.accentBlue, textDecoration: "none", fontWeight: 600 }}>Read full document ↗</a>
                      </div>
                    </div>
                  </div>
                );
              })}

              <div style={{ background: dark ? "rgba(255,255,255,0.03)" : "rgba(0,0,0,0.03)", border: `1px solid ${C.border}`, borderRadius: 8, padding: "10px 14px", marginBottom: 18, fontSize: 11, color: C.textMuted, lineHeight: 1.6 }}>
                By ticking all boxes and clicking Accept below, you confirm that you have read and agree to all Web Gecko legal agreements. These documents are always available in your Settings tab. Governing law: Queensland, Australia.
              </div>

              {Object.values(termsChecked).every(Boolean) ? (
                <button onClick={() => {
                  setTermsAccepted(true);
                  setTermsModalOpen(false);
                  try { localStorage.setItem("wg_terms_" + slug, "accepted"); } catch {}
                }} style={{ ...S.btn("primary"), width: "100%", fontSize: 14, padding: "13px" }}>
                  ✓ I Accept All Agreements — Continue to Payment →
                </button>
              ) : (
                <button disabled style={{ ...S.btn("primary", true), width: "100%", fontSize: 14, padding: "13px", opacity: 0.45 }}>
                  Tick all boxes above to continue
                </button>
              )}
              <button onClick={() => setTermsModalOpen(false)} style={{ ...S.btn("ghost"), width: "100%", fontSize: 13, marginTop: 8 }}>Cancel</button>
            </div>
          </div>
        )}
      </div>
          {/* Mobile bottom navigation */}
          <nav className="wg-bottom-nav" style={{ background: C.navBg, borderTopColor: C.navBorder, gap: 0 }}>
            {bottomNavTabs.map(t => (
              <button key={t.id} onClick={() => setTab(t.id)}
                style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", padding: "6px 4px", background: "none", border: "none", cursor: "pointer", fontFamily: "inherit",
                  color: tab === t.id ? C.accentBlue : (dark ? "#3a5080" : "#8090aa"),
                  borderTop: `2px solid ${tab === t.id ? C.accentBlue : "transparent"}`,
                }}>
                <span className="wg-tab-icon">{t.icon}</span>
                <span className="wg-tab-label">{t.label}</span>
              </button>
            ))}
          </nav>

        </div>{/* end wg-main-wrap */}
      </div>{/* end wg-layout */}
    </div>
  );
}
