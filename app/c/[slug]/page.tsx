"use client";

import { useState, useEffect } from "react";
import { useRouter, useParams } from "next/navigation";

// ─── Theme tokens — light (default) + dark ────────────────────────────────────
const LIGHT = {
  bg:         "#f2f3f8",
  surface:    "#ffffff",
  raised:     "#eceef6",
  border:     "#dde0ee",
  borderHov:  "#b8bcd8",
  text:       "#0d0f1c",
  textSec:    "#363c58",
  textMuted:  "#8090aa",
  accent:     "#009960",
  accentBg:   "#f0fdf4",
  accentBlue: "#2563eb",
  amber:      "#b45309",
  amberBg:    "#fffbeb",
  red:        "#dc2626",
  redBg:      "#fef2f2",
  purple:     "#7c3aed",
  navBg:      "#ffffff",
  navBorder:  "#dde0ee",
  shadow:     "0 1px 4px rgba(0,0,0,0.07)",
  shadowMd:   "0 6px 20px rgba(0,0,0,0.1)",
};

const DARK = {
  bg:         "#04080f",
  surface:    "#0a1628",
  raised:     "#102240",
  border:     "#1e3560",
  borderHov:  "#3060a0",
  text:       "#e0eaff",
  textSec:    "#7a9ad4",
  textMuted:  "#3a5080",
  accent:     "#00f080",
  accentBg:   "#001a10",
  accentBlue: "#4f9eff",
  amber:      "#ffa830",
  amberBg:    "#1a0e00",
  red:        "#ff4060",
  redBg:      "#1a0508",
  purple:     "#b085ff",
  navBg:      "rgba(4,8,15,0.9)",
  navBorder:  "rgba(79,158,255,0.15)",
  shadow:     "0 4px 24px rgba(0,0,0,0.7), inset 0 1px 0 rgba(255,255,255,0.04)",
  shadowMd:   "0 12px 40px rgba(0,0,0,0.85)",
};

// C is set dynamically inside the component via useTheme(); module-level fallback for sub-components
let C = LIGHT;

// ─── Types ────────────────────────────────────────────────────────────────────

interface ClientMetadata {
  name?: string;
  abn?: string;
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

type Tab = "overview" | "preview" | "bookings" | "quote" | "plan" | "upgrade" | "contact";

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
  const [cancellingId, setCancellingId] = useState<string | null>(null);

  // Preview / feedback
  const [feedback, setFeedback] = useState<{ id: string; text: string; createdAt: string }[]>([]);
  const [feedbackText, setFeedbackText] = useState("");
  const [feedbackRound, setFeedbackRound] = useState(1);
  const [feedbackLoading, setFeedbackLoading] = useState(false);
  const [feedbackSubmitting, setFeedbackSubmitting] = useState(false);
  const [revisionSent, setRevisionSent] = useState(false);

  // Report an Issue
  const [reportText, setReportText] = useState("");
  const [reportSending, setReportSending] = useState(false);
  const [reportSent, setReportSent] = useState(false);

  // Shop payment link
  const [shopPaymentUrl, setShopPaymentUrl] = useState("");
  const [shopPaymentSaving, setShopPaymentSaving] = useState(false);
  const [shopPaymentSaved, setShopPaymentSaved] = useState(false);

  // Subscription management
  const [showSubModal, setShowSubModal] = useState(false);
  const [subStep, setSubStep] = useState<"reason" | "option" | "confirm">("reason");
  const [cancelReason, setCancelReason] = useState("");
  const [cancelOption, setCancelOption] = useState<typeof CANCEL_OPTIONS[0] | null>(null);

  // Upgrade / Feature Requests
  const [myFeatureRequests, setMyFeatureRequests] = useState<any[]>([]);
  const [upgradeSelected, setUpgradeSelected] = useState<string[]>([]);
  const [upgradeMessage, setUpgradeMessage] = useState("");
  const [upgradeSubmitting, setUpgradeSubmitting] = useState(false);
  const [upgradeSubmitted, setUpgradeSubmitted] = useState(false);

  // Contact / Support
  const [contactTopics, setContactTopics] = useState<string[]>([]);
  const [contactDetails, setContactDetails] = useState("");
  const [contactSubmitting, setContactSubmitting] = useState(false);
  const [contactSubmitted, setContactSubmitted] = useState(false);

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
  }, [tab, client]);

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
    } catch { setError("Failed to load your project. Please refresh."); }
    finally { setLoading(false); }
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

  const tabs: { id: Tab; label: string }[] = [
    { id: "overview", label: "Overview" },
    { id: "preview", label: "Site Preview" },
    ...(hasBooking ? [{ id: "bookings" as Tab, label: "Bookings" }] : []),
    { id: "quote", label: "Quote & Pay" },
    { id: "plan", label: "My Plan" },
    { id: "upgrade", label: "Add Features" },
    { id: "contact", label: "Contact Us" },
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
    @import url('https://fonts.googleapis.com/css2?family=Space+Grotesk:wght@400;500;600;700;800&family=Inter:wght@400;500;600&display=swap');
    *, *::before, *::after { box-sizing: border-box; }
    @keyframes wg-ping  { 0%{transform:scale(1);opacity:.9} 100%{transform:scale(2.4);opacity:0} }
    @keyframes wg-float { 0%,100%{transform:translateY(0)} 50%{transform:translateY(-8px)} }
    @keyframes wg-fade  { from{opacity:0} to{opacity:1} }
    @keyframes wg-up    { from{opacity:0;transform:translateY(10px)} to{opacity:1;transform:translateY(0)} }
    ::-webkit-scrollbar { width:4px; height:4px }
    ::-webkit-scrollbar-track { background:transparent }
    ::-webkit-scrollbar-thumb { background:rgba(79,158,255,0.25); border-radius:99px }
    button { font-family:inherit; transition:opacity 0.15s, transform 0.12s, box-shadow 0.15s !important }
    button:active:not(:disabled) { transform:scale(0.96) !important }
    input, textarea, select { font-family:inherit }
  `;

  return (
    <div style={S.page}>
      <style>{portalCss}</style>

      {/* Header */}
      <header style={S.header}>
        {/* Rainbow gradient top line */}
        <div style={{ position:"absolute", top:0, left:0, right:0, height:2, background:"linear-gradient(90deg,#4f9eff,#a78bfa,#00e87a,transparent)", opacity:0.85, pointerEvents:"none" }}/>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <div style={S.logoMark}>W</div>
          <div>
            <div style={{ fontSize: 14, fontWeight: 800, letterSpacing: "-0.04em", lineHeight: 1, background:"linear-gradient(135deg,#e0ecff 30%,#a78bfa 100%)", WebkitBackgroundClip:"text", WebkitTextFillColor:"transparent", backgroundClip:"text" }}>WebGecko</div>
            <div style={{ fontSize: 11, color: C.textMuted, marginTop: 2, maxWidth: 160, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" as const }}>{client.businessName}</div>
          </div>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          {client.launchReady && (
            <div style={{ display: "flex", alignItems: "center", gap: 6, background: C.accent + "15", border: `1px solid ${C.accent}30`, borderRadius: 20, padding: "4px 12px" }}>
              <div style={{ position:"relative", width:7, height:7 }}>
                <div style={{ position:"absolute", inset:0, borderRadius:"50%", background:C.accent, animation:"wg-ping 1.6s ease-in-out infinite", opacity:0.7 }}/>
                <div style={{ position:"absolute", inset:0, borderRadius:"50%", background:C.accent }}/>
              </div>
              <span style={{ fontSize: 11, color: C.accent, fontWeight: 700 }}>Live</span>
            </div>
          )}
          <button
            onClick={toggleTheme}
            title={dark ? "Light mode" : "Dark mode"}
            style={{ background: C.raised, border: `1px solid ${C.border}`, color: C.textMuted, borderRadius: 8, width: 34, height: 34, display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer", fontSize: 14 }}
          >{dark ? "☀" : "🌙"}</button>
          <button style={{ background: "transparent", border: `1px solid ${C.border}`, color: C.textMuted, borderRadius: 8, padding: "6px 14px", fontSize: 12, fontWeight: 500, cursor: "pointer", fontFamily: "inherit" }} onClick={signOut}>Sign out</button>
        </div>
      </header>

      {/* Tab bar */}
      <div data-tab-bar style={S.tabBar}>
        {tabs.map(t => <button key={t.id} style={S.tabBtn(tab === t.id)} onClick={() => setTab(t.id)}>{t.label}</button>)}
      </div>

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
                  <div style={{ position: "absolute", top: 0, left: 0, right: 0, display: "flex", alignItems: "center", justifyContent: "space-between", padding: "0 16px", height: 42, background: C.surface, borderBottom: `1px solid ${C.border}`, zIndex: 10 }}>
                    <span style={{ color: C.textSec, fontWeight: 500, fontSize: 13 }}>Live preview — Round {feedbackRound}</span>
                    {client.previewUrl && <a href={client.previewUrl} target="_blank" rel="noopener noreferrer" style={{ color: C.accentBlue, fontSize: 12, textDecoration: "none" }}>Open in new tab ↗</a>}
                  </div>
                  <iframe
                    key={`preview-${client.jobId}`}
                    src={`/api/preview/proxy?slug=${slug}&v=${client.jobId?.slice(-6) || Date.now()}`}
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
        @import url('https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700&display=swap');
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
      <div key={tab} className="wg-tab" style={tab === "preview" ? { display: "none" } : S.body}>

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
                    <div style={{ display: "flex", alignItems: "center", gap: 12, padding: "12px 14px", background: C.bg, border: `1px solid ${C.border}`, borderRadius: 10 }}>
                      <span style={{ fontSize: 20 }}>📰</span>
                      <div>
                        <div style={{ fontSize: 13, fontWeight: 600, color: C.text }}>Blog & Content</div>
                        <div style={{ fontSize: 12, color: C.textMuted }}>Contact us to publish new posts</div>
                      </div>
                    </div>
                  )}
                  {hasGallery && (
                    <div style={{ display: "flex", alignItems: "center", gap: 12, padding: "12px 14px", background: C.bg, border: `1px solid ${C.border}`, borderRadius: 10 }}>
                      <span style={{ fontSize: 20 }}>🖼️</span>
                      <div>
                        <div style={{ fontSize: 13, fontWeight: 600, color: C.text }}>Photo Gallery</div>
                        <div style={{ fontSize: 12, color: C.textMuted }}>Email new photos to hello@webgecko.au</div>
                      </div>
                    </div>
                  )}
                  {hasGrowth && (
                    <div style={{ display: "flex", alignItems: "center", gap: 12, padding: "12px 14px", background: C.bg, border: `1px solid ${C.border}`, borderRadius: 10 }}>
                      <span style={{ fontSize: 20 }}>📈</span>
                      <div>
                        <div style={{ fontSize: 13, fontWeight: 600, color: C.text }}>Growth & Marketing</div>
                        <div style={{ fontSize: 12, color: C.textMuted }}>Newsletter & live chat on your site</div>
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
            {client.quote && (
              <div style={S.card}>
                <div style={S.label}>{client.quote.package} Package</div>
                <div style={{ fontSize: 32, fontWeight: 800, color: C.text, marginBottom: 4 }}>${client.quote.price.toLocaleString()}</div>
                <div style={{ color: C.textMuted, fontSize: 13, marginBottom: 14 }}>+ $109/month for 3 months, then $119/month hosting & maintenance</div>
                <div style={{ background: "#00c89610", border: "1px solid #00c89625", borderRadius: 8, padding: "10px 14px", fontSize: 13, color: C.accent, marginBottom: 12 }}>
                  🎉 Saving ${client.quote.savings.toLocaleString()} vs the industry average of ${client.quote.competitorPrice.toLocaleString()}
                </div>
                {client.quote.breakdown.map(line => (
                  <div key={line} style={{ display: "flex", justifyContent: "space-between", padding: "8px 0", borderTop: "1px solid #1a2233", fontSize: 13, color: C.textMuted }}>
                    <span>{line.split(":")[0]}</span><span style={{ color: C.textMuted }}>{line.split(":")[1]}</span>
                  </div>
                ))}
              </div>
            )}

            {!paymentStatus ? (
              <div style={{ ...S.card, textAlign: "center", padding: 32 }}><div style={{ color: C.textMuted, fontSize: 14 }}>Loading payment details…</div></div>
            ) : (
              <>
                <div style={S.card}>
                  <div style={S.label}>Payment Progress</div>
                  <div style={{ display: "flex", gap: 8, marginTop: 10 }}>
                    {[{ label: "Deposit", done: paymentStatus.depositPaid, icon: "💳" }, { label: "Final", done: paymentStatus.finalPaid, icon: "🚀" }, { label: "Monthly", done: paymentStatus.monthlyActive, icon: "🔄" }].map(s => (
                      <div key={s.label} style={{ flex: 1, textAlign: "center", padding: "14px 8px", borderRadius: 10, background: s.done ? "#00c89612" : C.surface, border: `1px solid ${s.done ? "#00c89630" : C.border}` }}>
                        <div style={{ fontSize: 18, marginBottom: 4 }}>{s.done ? "✅" : s.icon}</div>
                        <div style={{ fontSize: 11, color: s.done ? C.accent : C.textMuted, fontWeight: 600 }}>{s.label}</div>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Deposit */}
                <div style={{ ...S.card, borderColor: paymentStatus.depositPaid ? "#00c89630" : C.border }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
                    <div><div style={{ fontWeight: 700, fontSize: 16, color: C.text, marginBottom: 4 }}>50% Deposit</div><div style={{ color: C.textMuted, fontSize: 13 }}>Pay now to begin your website build</div></div>
                    <div style={{ fontSize: 22, fontWeight: 800, color: C.text }}>${paymentStatus.quote.deposit.toLocaleString()}</div>
                  </div>
                  {paymentStatus.depositPaid
                    ? <div style={{ color: C.accent, fontSize: 13, fontWeight: 600, marginTop: 12 }}>✓ Paid — build in progress</div>
                    : <button onClick={() => handlePay("deposit")} disabled={payLoading === "deposit"} style={{ ...S.payBtn(true), opacity: payLoading === "deposit" ? 0.6 : 1 }}>{payLoading === "deposit" ? "Loading…" : "Pay Deposit →"}</button>
                  }
                </div>

                {/* Final */}
                <div style={{ ...S.card, opacity: !paymentStatus.depositPaid ? 0.45 : 1, borderColor: paymentStatus.finalPaid ? "#00c89630" : C.border }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
                    <div><div style={{ fontWeight: 700, fontSize: 16, color: C.text, marginBottom: 4 }}>50% Final Payment</div>
                      <div style={{ color: C.textMuted, fontSize: 13 }}>{!paymentStatus.depositPaid ? "Pay deposit first" : !paymentStatus.finalUnlocked ? "Unlocked after your revision is approved" : "Pay to launch your website"}</div></div>
                    <div style={{ fontSize: 22, fontWeight: 800, color: C.text }}>${paymentStatus.quote.final.toLocaleString()}</div>
                  </div>
                  {paymentStatus.finalPaid
                    ? <div style={{ color: C.accent, fontSize: 13, fontWeight: 600, marginTop: 12 }}>✓ Paid — site is live</div>
                    : paymentStatus.finalUnlocked && paymentStatus.depositPaid
                    ? <button onClick={() => handlePay("final")} disabled={payLoading === "final"} style={{ ...S.payBtn(true), opacity: payLoading === "final" ? 0.6 : 1 }}>{payLoading === "final" ? "Loading…" : "Pay Final & Launch →"}</button>
                    : <div style={S.lockBox}>🔒 Locked</div>
                  }
                </div>

                {/* Monthly — included in final payment, just needs activation */}
                <div style={{ ...S.card, opacity: !paymentStatus.finalPaid ? 0.45 : 1, borderColor: paymentStatus.monthlyActive ? "#00c89630" : C.border }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
                    <div><div style={{ fontWeight: 700, fontSize: 16, color: C.text, marginBottom: 4 }}>Monthly Hosting & Maintenance</div>
                      <div style={{ color: C.textMuted, fontSize: 13 }}>
                        {!paymentStatus.finalPaid
                          ? "First month included in your final payment"
                          : "Intro: $109/mo for 3 months, then $119/mo ongoing"}
                      </div>
                    </div>
                    <div style={{ textAlign: "right" }}>
                      <span style={{ fontSize: 22, fontWeight: 800, color: C.text }}>$109</span>
                      <span style={{ fontSize: 13, color: C.textMuted }}>/mo</span>
                      <div style={{ fontSize: 10, color: C.textMuted, marginTop: 2 }}>then $119/mo</div>
                    </div>
                  </div>
                  {paymentStatus.monthlyActive
                    ? <div style={{ color: C.accent, fontSize: 13, fontWeight: 600, marginTop: 12 }}>✓ Active</div>
                    : paymentStatus.finalPaid
                    ? <div style={{ color: C.accent, fontSize: 13, fontWeight: 600, marginTop: 12 }}>✓ First month included in final payment — active on launch</div>
                    : <div style={S.lockBox}>🔒 Included in your final payment</div>
                  }
                </div>

                <div style={{ color: C.border, fontSize: 12, textAlign: "center", marginTop: 4 }}>Payments processed securely by Square · WebGecko never stores card details</div>
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
                       "Choose how you'd like to leave. Each option has a different exit fee."}
                    </div>

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

                    <div style={{ ...S.label, marginTop: 8 }}>Or choose a cancellation option</div>
                    {CANCEL_OPTIONS.map(opt => (
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
                            <div style={{ fontSize: 12, fontWeight: 600, color: opt.id === "stop" ? C.textSec : "#ffcc55", whiteSpace: "nowrap" }}>
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
                        <span style={{ fontSize: 14, fontWeight: 700, color: cancelOption.id === "stop" ? C.textSec : "#ffcc55" }}>
                          {cancelOption.priceCalc(buildPrice) === 0 ? "Free" : `$${cancelOption.priceCalc(buildPrice).toLocaleString()}`}
                        </span>
                      </div>
                    </div>
                    <div style={{ fontSize: 12, color: C.textMuted, marginBottom: 16 }}>
                      Clicking below sends a cancellation request to our team. We'll confirm within 1 business day.
                    </div>
                    <a
                      href={`mailto:hello@webgecko.au?subject=${encodeURIComponent("Cancellation — " + client.businessName + " — " + cancelOption.label)}&body=${encodeURIComponent("Hi WebGecko,\n\nI'd like to cancel.\n\nBusiness: " + client.businessName + "\nOption: " + cancelOption.label + "\nReason: " + cancelReason)}`}
                      style={{ ...S.btn("danger"), textDecoration: "none", width: "100%", display: "flex", fontSize: 13, marginBottom: 10 }}>
                      Send Cancellation Request
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
        {tab === "upgrade" && (
          <>
            <div style={S.card}>
              <div style={S.label}>Add Features to Your Site</div>
              <div style={{ color: C.textMuted, fontSize: 13, marginBottom: 16, lineHeight: 1.6 }}>
                Select the features you'd like added. We'll build a draft for you to review before anything goes live.
              </div>

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
                    ].filter(f => !features.includes(f.id)).map(f => {
                      const sel = upgradeSelected.includes(f.id);
                      return (
                        <button key={f.id} onClick={() => setUpgradeSelected(prev => sel ? prev.filter(x => x !== f.id) : [...prev, f.id])}
                          style={{ display: "flex", alignItems: "center", gap: 12, background: sel ? "#00c89612" : C.bg, border: `1px solid ${sel ? "#00c89640" : C.border}`, borderRadius: 10, padding: "12px 14px", cursor: "pointer", textAlign: "left", width: "100%" }}>
                          <span style={{ fontSize: 22, flexShrink: 0 }}>{f.icon}</span>
                          <div style={{ flex: 1 }}>
                            <div style={{ fontSize: 13, fontWeight: 600, color: sel ? C.accent : C.text, marginBottom: 2 }}>{f.label}</div>
                            <div style={{ fontSize: 12, color: C.textMuted }}>{f.desc}</div>
                          </div>
                          <div style={{ width: 20, height: 20, borderRadius: "50%", border: `2px solid ${sel ? C.accent : C.border}`, background: sel ? C.accent : "transparent", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                            {sel && <span style={{ color: "#000", fontSize: 11, fontWeight: 800 }}>✓</span>}
                          </div>
                        </button>
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
      </div>
    </div>
  );
}
