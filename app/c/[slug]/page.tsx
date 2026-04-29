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

type Tab = "overview" | "preview" | "bookings" | "quote" | "plan";

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
      background: "#111827", border: "1px solid #1e2d42", borderRadius: 8,
      padding: "9px 12px", display: "flex", gap: 8, alignItems: "flex-start",
    }}>
      <span style={{ color: "#334155", fontSize: 11, minWidth: 18, marginTop: editing ? 10 : 2, fontWeight: 600 }}>{index + 1}.</span>
      {editing ? (
        <div style={{ flex: 1, display: "flex", gap: 6, alignItems: "flex-start", flexWrap: "wrap" }}>
          <input
            autoFocus value={val} onChange={e => setVal(e.target.value)}
            onKeyDown={e => { if (e.key === "Enter") save(); if (e.key === "Escape") { setVal(item.text); setEditing(false); } }}
            style={{ flex: 1, minWidth: 160, background: "#080c14", border: "1px solid #2563eb60", borderRadius: 6, padding: "6px 10px", color: "#e2e8f0", fontSize: 13, outline: "none" }}
          />
          <button onClick={save} style={{ background: "#2563eb", color: "#fff", border: "none", borderRadius: 6, padding: "6px 12px", fontSize: 12, fontWeight: 600, cursor: "pointer" }}>Save</button>
          <button onClick={() => { setVal(item.text); setEditing(false); }} style={{ background: "#1e2531", color: "#64748b", border: "none", borderRadius: 6, padding: "6px 10px", fontSize: 12, cursor: "pointer" }}>Cancel</button>
        </div>
      ) : (
        <span style={{ flex: 1, color: "#cbd5e1", fontSize: 13, lineHeight: 1.5, marginTop: 1 }}>{item.text}</span>
      )}
      <div style={{ display: "flex", gap: 4, flexShrink: 0 }}>
        {!editing && (
          <button onClick={() => setEditing(true)} style={{ background: "none", border: "none", color: "#334155", cursor: "pointer", fontSize: 13, padding: "2px 4px" }} title="Edit">✎</button>
        )}
        <button onClick={onDelete} style={{ background: "none", border: "none", color: "#334155", cursor: "pointer", fontSize: 14, padding: "2px 4px" }} title="Remove">✕</button>
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

  async function loadBookings() {
    if (!client.jobId) return;
    setLoading(true);
    try {
      const res = await fetch(`/api/bookings/client?jobId=${client.jobId}&slug=${slug}`);
      if (res.ok) setBookings((await res.json()).bookings || []);
    } catch {}
    finally { setLoading(false); }
  }

  async function doAction(bookingId: string, action: string, extra?: { reason?: string; newDate?: string; newTime?: string }) {
    setActing(bookingId);
    try {
      const res = await fetch(`/api/bookings/client?slug=${slug}`, {
        method: "PATCH", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ jobId: client.jobId, bookingId, action, ...extra }),
      });
      if (res.ok) { const d = await res.json(); setBookings(prev => prev.map(b => b.bookingId === bookingId ? d.booking : b)); }
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
  const STATUS_COLOR: Record<string, string> = { confirmed: "#00c896", pending: "#f59e0b", declined: "#ef4444", cancelled: "#6b7280", rescheduled: "#3b82f6" };
  const pll = (color: string): React.CSSProperties => ({ display: "inline-block", background: `${color}18`, color, border: `1px solid ${color}33`, borderRadius: 20, padding: "2px 10px", fontSize: 11, fontWeight: 600, textTransform: "capitalize" as const });
  const inp: React.CSSProperties = { width: "100%", background: "#0d1117", border: "1px solid #1e2531", borderRadius: 8, padding: "10px 12px", color: "#e2e8f0", fontSize: 14, boxSizing: "border-box" as const, outline: "none", marginBottom: 10 };
  const abt = (color: string, bg = "transparent"): React.CSSProperties => ({ flex: 1, minWidth: 60, padding: "8px 10px", borderRadius: 8, fontSize: 12, fontWeight: 600, cursor: "pointer", border: `1px solid ${color}44`, color, background: bg });
  const ovl: React.CSSProperties = { position: "fixed", inset: 0, background: "rgba(0,0,0,0.85)", zIndex: 100, display: "flex", alignItems: "center", justifyContent: "center", padding: 20 };
  const mdb: React.CSSProperties = { background: "#0d1117", border: "1px solid #1e2531", borderRadius: 16, padding: 24, width: "100%", maxWidth: 440, maxHeight: "90vh", overflowY: "auto" as const };

  if (!paymentStatus?.previewUnlocked) {
    return (
      <div style={{ background: "#0d1117", border: "1px solid #1e2531", borderRadius: 12, textAlign: "center", padding: "48px 24px" }}>
        <div style={{ fontSize: 36, marginBottom: 12 }}>🔒</div>
        <div style={{ color: "#4a5568", fontSize: 15 }}>Bookings will appear here once your site is released.</div>
      </div>
    );
  }

  return (
    <>
      {/* Stats */}
      <div style={{ display: "flex", gap: 10, marginBottom: 16, flexWrap: "wrap" as const }}>
        {[{ label: "Total", value: bookings.length, color: "#e2e8f0" }, { label: "Upcoming", value: upcoming, color: "#00c896" }, { label: "Past/Cancelled", value: bookings.length - upcoming, color: "#4a5568" }].map(st => (
          <div key={st.label} style={{ background: "#0d1117", border: "1px solid #1e2531", borderRadius: 10, padding: "14px 16px", flex: 1, textAlign: "center" as const, minWidth: 80 }}>
            <div style={{ fontSize: 22, fontWeight: 800, color: st.color }}>{st.value}</div>
            <div style={{ fontSize: 11, color: "#4a5568", marginTop: 2 }}>{st.label}</div>
          </div>
        ))}
        <button onClick={() => setModal("add")} style={{ background: "linear-gradient(135deg,#00c896,#0099ff)", border: "none", color: "#000", borderRadius: 10, padding: "14px 18px", fontSize: 13, fontWeight: 700, cursor: "pointer", whiteSpace: "nowrap" as const }}>+ Add</button>
      </div>

      {/* Search + filters */}
      <input type="text" placeholder="Search name, email, service…" value={bSearch} onChange={e => setBSearch(e.target.value)}
        style={{ ...inp, marginBottom: 12 }} />
      <div style={{ display: "flex", gap: 8, marginBottom: 16, flexWrap: "wrap" as const }}>
        {(["upcoming", "past", "all"] as const).map(f => (
          <button key={f} onClick={() => setBFilter(f)} style={{ padding: "7px 16px", borderRadius: 20, fontSize: 13, fontWeight: bFilter === f ? 600 : 400, background: bFilter === f ? "linear-gradient(135deg,#00c896,#0099ff)" : "none", border: bFilter === f ? "none" : "1px solid #1e2531", color: bFilter === f ? "#000" : "#4a5568", cursor: "pointer" }}>
            {f.charAt(0).toUpperCase() + f.slice(1)}
          </button>
        ))}
        <button onClick={loadBookings} style={{ marginLeft: "auto", background: "none", border: "1px solid #1e2531", color: "#4a5568", borderRadius: 8, padding: "7px 12px", fontSize: 12, cursor: "pointer" }}>↻ Refresh</button>
      </div>

      {/* Booking list */}
      {loading ? (
        <div style={{ textAlign: "center", padding: 40, color: "#4a5568" }}>Loading bookings…</div>
      ) : filtered.length === 0 ? (
        <div style={{ background: "#0d1117", border: "1px solid #1e2531", borderRadius: 12, textAlign: "center", padding: 40 }}>
          <div style={{ fontSize: 28, marginBottom: 10 }}>📅</div>
          <div style={{ color: "#2a3347", fontSize: 14 }}>{bFilter === "upcoming" ? "No upcoming bookings." : "No bookings found."}</div>
        </div>
      ) : filtered.map(b => {
        const isToday = b.date === today;
        const isTomorrow = b.date === tomorrow;
        const isDone = ["cancelled", "declined"].includes(b.status);
        const sc = STATUS_COLOR[b.status] || "#666";
        return (
          <div key={b.bookingId} style={{ background: "#0d1117", border: `1px solid ${isToday ? "#00c89630" : "#1e2531"}`, borderRadius: 12, padding: 16, marginBottom: 10, opacity: isDone ? 0.5 : 1 }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 8, gap: 8, flexWrap: "wrap" as const }}>
              <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" as const }}>
                <span style={{ fontWeight: 700, fontSize: 15, color: "#e2e8f0" }}>{b.visitorName}</span>
                {isToday && <span style={{ ...pll("#00c896"), fontSize: 10 }}>TODAY</span>}
                {isTomorrow && <span style={{ ...pll("#f59e0b"), fontSize: 10 }}>TOMORROW</span>}
              </div>
              <span style={pll(sc)}>{b.status}</span>
            </div>
            <div style={{ color: "#4a5568", fontSize: 13, marginBottom: 4 }}>{b.service} · {formatDate(b.date)} at {b.time}</div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 4, fontSize: 12, color: "#334155", marginBottom: 8 }}>
              <div>✉ <a href={`mailto:${b.visitorEmail}`} style={{ color: "#38bdf8" }}>{b.visitorEmail}</a></div>
              <div>📞 <a href={`tel:${b.visitorPhone}`} style={{ color: "#94a3b8" }}>{b.visitorPhone}</a></div>
            </div>
            {b.message && <div style={{ background: "#080c14", borderRadius: 6, padding: "8px 12px", fontSize: 13, color: "#475569", marginBottom: 10 }}>"{b.message}"</div>}
            {!isDone && (
              <div style={{ display: "flex", gap: 8, flexWrap: "wrap" as const, marginTop: 8 }}>
                {b.status !== "confirmed" && (
                  <button style={abt("#00c896")} disabled={acting === b.bookingId} onClick={() => doAction(b.bookingId, "confirm")}>
                    {acting === b.bookingId ? "…" : "✓ Confirm"}
                  </button>
                )}
                <button style={abt("#3b82f6")} onClick={() => { setActiveBooking(b); setModal("reschedule"); setNewDate(b.date); setNewTime(b.time); }}>↻ Reschedule</button>
                <a href={`mailto:${b.visitorEmail}`} style={{ ...abt("#64748b"), textDecoration: "none", textAlign: "center" as const }}>✉ Email</a>
                <a href={`tel:${b.visitorPhone}`} style={{ ...abt("#64748b"), textDecoration: "none", textAlign: "center" as const }}>📞 Call</a>
                <button style={abt("#ef4444")} onClick={() => { setActiveBooking(b); setModal("cancel"); }}>✕ Cancel</button>
              </div>
            )}
          </div>
        );
      })}

      {/* Reschedule modal */}
      {modal === "reschedule" && activeBooking && (
        <div style={ovl} onClick={() => setModal(null)}>
          <div style={mdb} onClick={e => e.stopPropagation()}>
            <div style={{ fontSize: 16, fontWeight: 700, color: "#e2e8f0", marginBottom: 16 }}>Reschedule Booking</div>
            <div style={{ color: "#4a5568", fontSize: 13, marginBottom: 16 }}>{activeBooking.visitorName} — {activeBooking.service}</div>
            <label style={{ color: "#64748b", fontSize: 12, display: "block", marginBottom: 6 }}>New Date</label>
            <input type="date" value={newDate} onChange={e => setNewDate(e.target.value)} style={inp} />
            <label style={{ color: "#64748b", fontSize: 12, display: "block", marginBottom: 6 }}>New Time</label>
            <input type="time" value={newTime} onChange={e => setNewTime(e.target.value)} style={inp} />
            <div style={{ display: "flex", gap: 10, marginTop: 8 }}>
              <button style={{ ...abt("#4a5568"), flex: "none" as const, padding: "10px 20px" }} onClick={() => setModal(null)}>Cancel</button>
              <button style={{ ...abt("#3b82f6", "#3b82f618"), flex: 1, padding: 10 }} disabled={!newDate || !newTime || acting === activeBooking.bookingId} onClick={() => doAction(activeBooking.bookingId, "reschedule", { newDate, newTime })}>
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
            <div style={{ fontSize: 16, fontWeight: 700, color: "#e2e8f0", marginBottom: 16 }}>Cancel Booking</div>
            <div style={{ color: "#4a5568", fontSize: 13, marginBottom: 16 }}>{activeBooking.visitorName} — {activeBooking.date} at {activeBooking.time}</div>
            <label style={{ color: "#64748b", fontSize: 12, display: "block", marginBottom: 6 }}>Reason (sent to customer)</label>
            <textarea value={modalReason} onChange={e => setModalReason(e.target.value)} rows={3}
              placeholder="e.g. We are unavailable that day — please rebook." style={{ ...inp, resize: "vertical" as const, height: 80 }} />
            <div style={{ display: "flex", gap: 10, marginTop: 8 }}>
              <button style={{ ...abt("#4a5568"), flex: "none" as const, padding: "10px 20px" }} onClick={() => setModal(null)}>Back</button>
              <button style={{ ...abt("#ef4444", "#ef444418"), flex: 1, padding: 10 }} disabled={acting === activeBooking.bookingId} onClick={() => doAction(activeBooking.bookingId, "cancel", { reason: modalReason })}>
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
            <div style={{ fontSize: 16, fontWeight: 700, color: "#e2e8f0", marginBottom: 16 }}>Add Booking Manually</div>
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
              <button style={{ ...abt("#4a5568"), flex: "none" as const, padding: "10px 20px" }} onClick={() => setModal(null)}>Cancel</button>
              <button style={{ ...abt("#00c896", "#00c89618"), flex: 1, padding: 10 }}
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

      {/* ══════════════════════ SITE PREVIEW (full-width, outside padded body) ══════════════════════ */}
      {tab === "preview" && (
          <>
            {!paymentStatus?.previewUnlocked ? (
              <div style={{ margin: "16px", background: "#0d1117", border: "1px solid #1e2531", borderRadius: 12, textAlign: "center", padding: "48px 24px" }}>
                <div style={{ fontSize: 36, marginBottom: 12 }}>🔒</div>
                <div style={{ color: "#64748b", fontSize: 15 }}>Preview coming soon</div>
                <div style={{ color: "#334155", fontSize: 13, marginTop: 6 }}>You'll receive an email when your site is ready to review.</div>
              </div>
            ) : client.jobId ? (
              <div style={{ display: "flex", flexDirection: "column", height: "calc(100vh - 112px)" }}>
                {/* iframe — takes all remaining space */}
                <div style={{ flex: 1, position: "relative", background: "#080c14", borderBottom: "1px solid #1e2531", minHeight: 0 }}>
                  <div style={{ position: "absolute", top: 0, left: 0, right: 0, display: "flex", alignItems: "center", justifyContent: "space-between", padding: "10px 16px", background: "#0d1117", borderBottom: "1px solid #1e2531", zIndex: 10 }}>
                    <span style={{ color: "#cbd5e1", fontWeight: 600, fontSize: 13 }}>🖥 Live Preview — Round {feedbackRound}</span>
                    {client.previewUrl && <a href={client.previewUrl} target="_blank" rel="noopener noreferrer" style={{ color: "#38bdf8", fontSize: 12, textDecoration: "none" }}>Open in new tab ↗</a>}
                  </div>
                  <iframe
                    src={`/api/preview/proxy?slug=${slug}`}
                    style={{ position: "absolute", top: 42, left: 0, width: "100%", height: "calc(100% - 42px)", border: "none" }}
                    title="Site Preview"
                  />
                </div>

                {/* Changes panel */}
                <div style={{ background: "#0d1117", borderTop: "1px solid #1e2531", padding: "14px 16px", flexShrink: 0 }}>
                  {revisionSent ? (
                    <div style={{ background: "#00c89612", border: "1px solid #00c89625", borderRadius: 10, padding: "14px 18px", display: "flex", alignItems: "center", gap: 14 }}>
                      <div style={{ fontSize: 24 }}>✅</div>
                      <div>
                        <div style={{ color: "#00c896", fontWeight: 700, fontSize: 14 }}>Changes submitted!</div>
                        <div style={{ color: "#475569", fontSize: 13, marginTop: 2 }}>We're applying your changes. You'll get an email when the revised site is ready.</div>
                      </div>
                    </div>
                  ) : (
                    <>
                      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}>
                        <div style={{ color: "#e2e8f0", fontWeight: 700, fontSize: 14 }}>✏️ Request Changes</div>
                        <div style={{
                          fontSize: 12, fontWeight: 700,
                          color: feedback.length >= 10 ? "#f87171" : feedback.length >= 8 ? "#fbbf24" : "#64748b",
                          background: feedback.length >= 10 ? "#f8717115" : feedback.length >= 8 ? "#fbbf2415" : "#131c2e",
                          border: `1px solid ${feedback.length >= 10 ? "#f8717130" : feedback.length >= 8 ? "#fbbf2430" : "#1e2d42"}`,
                          borderRadius: 20, padding: "3px 10px",
                        }}>
                          {feedback.length}/10 changes
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
                            style={{ flex: 1, background: "#131c2e", border: "1px solid #1e2d42", borderRadius: 8, padding: "10px 14px", color: "#e2e8f0", fontSize: 13, outline: "none" }}
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
                        <div style={{ color: "#334155", fontSize: 12, marginTop: 2 }}>First 10 changes are free. Additional changes are $15 each.</div>
                      )}
                      {feedback.length >= 10 && (
                        <div style={{ color: "#fbbf24", fontSize: 11, marginTop: 8, textAlign: "center" }}>10 changes reached — submit now or remove some to add different ones.</div>
                      )}
                    </>
                  )}
                </div>
              </div>
            ) : (
              <div style={{ margin: "16px", background: "#0d1117", border: "1px solid #1e2531", borderRadius: 12, textAlign: "center", padding: "48px 24px" }}>
                <div style={{ fontSize: 36, marginBottom: 12 }}>🏗️</div>
                <div style={{ color: "#64748b", fontSize: 15 }}>Your site is being built.</div>
              </div>
            )}
          </>
      )}

      <div style={tab === "preview" ? { display: "none" } : S.body}>

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

            {/* Report an Issue */}
            {paymentStatus?.previewUnlocked && (
              <div style={S.card}>
                <div style={S.label}>Report an Issue</div>
                <div style={{ color: "#4a5568", fontSize: 13, marginBottom: 12 }}>Noticed something broken or not working right? Let us know and we'll fix it.</div>
                {reportSent ? (
                  <div style={{ color: "#00c896", fontSize: 13, fontWeight: 600 }}>✓ Report sent — we'll be in touch shortly.</div>
                ) : (
                  <>
                    <textarea
                      value={reportText}
                      onChange={e => setReportText(e.target.value)}
                      placeholder="Describe the issue you're experiencing…"
                      rows={3}
                      style={{ width: "100%", background: "#131c2e", border: "1px solid #1e2d42", borderRadius: 8, padding: "10px 14px", color: "#e2e8f0", fontSize: 13, outline: "none", resize: "vertical", fontFamily: "inherit", boxSizing: "border-box" as const, marginBottom: 8 }}
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
              <div style={{ color: "#2a3347", fontSize: 13 }}>Questions? <a href="mailto:hello@webgecko.au" style={{ color: "#334155" }}>hello@webgecko.au</a></div>
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
                <div style={{ fontSize: 32, fontWeight: 800, color: "#e2e8f0", marginBottom: 4 }}>${client.quote.price.toLocaleString()}</div>
                <div style={{ color: "#4a5568", fontSize: 13, marginBottom: 14 }}>+ $109/month for 3 months, then $119/month hosting & maintenance</div>
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

                {/* Monthly — included in final payment, just needs activation */}
                <div style={{ ...S.card, opacity: !paymentStatus.finalPaid ? 0.45 : 1, borderColor: paymentStatus.monthlyActive ? "#00c89630" : "#1e2531" }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
                    <div><div style={{ fontWeight: 700, fontSize: 16, color: "#e2e8f0", marginBottom: 4 }}>Monthly Hosting & Maintenance</div>
                      <div style={{ color: "#4a5568", fontSize: 13 }}>
                        {!paymentStatus.finalPaid
                          ? "First month included in your final payment"
                          : "Intro: $109/mo for 3 months, then $119/mo ongoing"}
                      </div>
                    </div>
                    <div style={{ textAlign: "right" }}>
                      <span style={{ fontSize: 22, fontWeight: 800, color: "#e2e8f0" }}>$109</span>
                      <span style={{ fontSize: 13, color: "#4a5568" }}>/mo</span>
                      <div style={{ fontSize: 10, color: "#4a5568", marginTop: 2 }}>then $119/mo</div>
                    </div>
                  </div>
                  {paymentStatus.monthlyActive
                    ? <div style={{ color: "#00c896", fontSize: 13, fontWeight: 600, marginTop: 12 }}>✓ Active</div>
                    : paymentStatus.finalPaid
                    ? <div style={{ color: "#00c896", fontSize: 13, fontWeight: 600, marginTop: 12 }}>✓ First month included in final payment — active on launch</div>
                    : <div style={S.lockBox}>🔒 Included in your final payment</div>
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
                  <div style={{ fontSize: 22, fontWeight: 800, color: "#00c896" }}>$109</div>
                  <div style={{ fontSize: 12, color: "#4a5568" }}>/month</div>
                  <div style={{ fontSize: 10, color: "#4a5568", marginTop: 1 }}>then $119/mo</div>
                </div>
              </div>
              <div style={S.divider} />
              {["Fast Australian hosting", "Monthly AI improvements", "10 free site changes/month", "SEO & performance updates", "Priority email support"].map((item, i) => (
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
                  { icon: "🔧", title: "Monthly AI Fix Pass", desc: "Our system reviews and improves your site every month automatically." },
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

            {/* Plan tiers */}
            {!showSubModal && (
              <div style={S.card}>
                <div style={S.label}>Update Plan</div>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginTop: 10 }}>
                  {/* Essential */}
                  <div style={{
                    background: "#080c14", border: `2px solid ${(client.quote?.monthlyPrice || 0) < 149 ? "#00c896" : "#1e2531"}`,
                    borderRadius: 12, padding: "16px 14px",
                  }}>
                    <div style={{ fontSize: 13, fontWeight: 700, color: "#e2e8f0", marginBottom: 4 }}>Essential</div>
                    <div style={{ fontSize: 22, fontWeight: 800, color: "#e2e8f0", lineHeight: 1 }}>$99<span style={{ fontSize: 12, color: "#4a5568", fontWeight: 400 }}>/mo</span></div>
                    <div style={{ height: 1, background: "#1e2531", margin: "12px 0" }} />
                    {["Hosting & SSL", "5 site changes/month", "SEO updates", "Email support"].map(f => (
                      <div key={f} style={{ fontSize: 12, color: "#64748b", display: "flex", alignItems: "center", gap: 6, marginBottom: 6 }}>
                        <span style={{ color: "#00c896", fontSize: 10 }}>✓</span>{f}
                      </div>
                    ))}
                    <a href={`mailto:hello@webgecko.au?subject=${encodeURIComponent("Switch to Essential plan — " + client.businessName)}`}
                      style={{ display: "block", textAlign: "center", marginTop: 12, background: "#1a2233", color: "#94a3b8", borderRadius: 8, padding: "9px 0", fontSize: 12, fontWeight: 600, textDecoration: "none" }}>
                      Switch to Essential
                    </a>
                  </div>

                  {/* Premium */}
                  <div style={{
                    background: "#0a1628", border: `2px solid ${(client.quote?.monthlyPrice || 0) >= 149 ? "#00c896" : "#0099ff40"}`,
                    borderRadius: 12, padding: "16px 14px", position: "relative" as const,
                  }}>
                    {(client.quote?.monthlyPrice || 0) >= 149 && (
                      <div style={{ position: "absolute", top: -10, right: 10, background: "#00c896", color: "#000", fontSize: 10, fontWeight: 800, padding: "2px 10px", borderRadius: 20 }}>CURRENT</div>
                    )}
                    <div style={{ fontSize: 13, fontWeight: 700, color: "#e2e8f0", marginBottom: 4 }}>Premium</div>
                    <div style={{ fontSize: 22, fontWeight: 800, color: "#e2e8f0", lineHeight: 1 }}>$149<span style={{ fontSize: 12, color: "#4a5568", fontWeight: 400 }}>/mo</span></div>
                    <div style={{ height: 1, background: "#1e2531", margin: "12px 0" }} />
                    {["Hosting & SSL", "10 site changes/month", "Monthly AI fix pass", "SEO & speed updates", "Priority support"].map(f => (
                      <div key={f} style={{ fontSize: 12, color: "#64748b", display: "flex", alignItems: "center", gap: 6, marginBottom: 6 }}>
                        <span style={{ color: "#00c896", fontSize: 10 }}>✓</span>{f}
                      </div>
                    ))}
                    <a href={`mailto:hello@webgecko.au?subject=${encodeURIComponent("Upgrade to Premium plan — " + client.businessName)}`}
                      style={{ display: "block", textAlign: "center", marginTop: 12, background: "linear-gradient(135deg,#00c896,#0099ff)", color: "#000", borderRadius: 8, padding: "9px 0", fontSize: 12, fontWeight: 700, textDecoration: "none" }}>
                      Upgrade to Premium
                    </a>
                  </div>
                </div>
                <div style={{ fontSize: 11, color: "#334155", textAlign: "center", marginTop: 12 }}>Plan changes take effect after your current paid month ends.</div>
              </div>
            )}

            {/* Manage subscription */}
            {!showSubModal ? (
              <div style={{ ...S.card, background: "transparent", border: "1px solid #131b27" }}>
                <div style={{ fontSize: 13, color: "#475569", marginBottom: 10 }}>Want to cancel or change something else?</div>
                <button onClick={() => { setShowSubModal(true); setSubStep("reason"); setCancelOption(null); setCancelReason(""); }} style={{ ...S.btn("ghost"), fontSize: 13 }}>Manage subscription</button>
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
                        style={{ display: "block", width: "100%", textAlign: "left", background: cancelReason === r ? "#0d1a2e" : "#080c14", border: "1px solid #1e2531", borderRadius: 8, padding: "12px 14px", fontSize: 13, color: "#94a3b8", cursor: "pointer", marginBottom: 8 }}>
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
                      {cancelReason === "too-expensive" ? "Let's find something that works" :
                       cancelReason === "not-using" ? "Want to pause instead?" :
                       cancelReason === "unhappy" ? "Let us fix it first" :
                       "Here are your options"}
                    </div>
                    <div style={{ color: "#4a5568", fontSize: 13, marginBottom: 16 }}>
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
                    <button onClick={() => setSubStep("reason")} style={{ ...S.btn("ghost"), fontSize: 13 }}>Back</button>
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
                      Clicking below sends a cancellation request to our team. We'll confirm within 1 business day.
                    </div>
                    <a
                      href={`mailto:hello@webgecko.au?subject=${encodeURIComponent("Cancellation — " + client.businessName + " — " + cancelOption.label)}&body=${encodeURIComponent("Hi WebGecko,\n\nI'd like to cancel.\n\nBusiness: " + client.businessName + "\nOption: " + cancelOption.label + "\nReason: " + cancelReason)}`}
                      style={{ ...S.btn("danger"), textDecoration: "none", width: "100%", display: "flex", fontSize: 13, marginBottom: 10 }}>
                      Send Cancellation Request
                    </a>
                    <button onClick={() => setShowSubModal(false)} style={{ ...S.btn("secondary"), width: "100%", fontSize: 13 }}>Keep my plan</button>
                    <button onClick={() => setSubStep("option")} style={{ ...S.btn("ghost"), marginTop: 8, fontSize: 12 }}>Back</button>
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
