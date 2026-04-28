"use client";
import { useState, useEffect } from "react";
import { useRouter, useParams } from "next/navigation";

interface Booking {
  bookingId: string; visitorName: string; visitorEmail: string; visitorPhone: string;
  service: string; date: string; time: string; message?: string; status: string;
  cancelReason?: string; createdAt: string;
}
type Filter = "pending" | "upcoming" | "past" | "all";
const STATUS_COLOR: Record<string, string> = {
  confirmed: "#00c896", pending: "#f59e0b", declined: "#ef4444", cancelled: "#6b7280", rescheduled: "#3b82f6",
};

export default function ClientBookingAdmin() {
  const router = useRouter();
  const params = useParams();
  const slug = params?.slug as string;
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [jobId, setJobId] = useState("");
  const [filter, setFilter] = useState<Filter>("upcoming");
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [acting, setActing] = useState<string | null>(null);
  const [modal, setModal] = useState<null | "reschedule" | "cancel" | "add">(null);
  const [activeBooking, setActiveBooking] = useState<Booking | null>(null);
  const [modalReason, setModalReason] = useState("");
  const [newDate, setNewDate] = useState("");
  const [newTime, setNewTime] = useState("");
  const [addForm, setAddForm] = useState({ name: "", email: "", phone: "", service: "", date: "", time: "", message: "" });

  useEffect(() => {
    const auth = sessionStorage.getItem("wg_auth_" + slug);
    if (!auth) { router.replace("/c"); return; }
    loadData();
  }, [slug]);

  async function loadData() {
    setLoading(true);
    try {
      const clientRes = await fetch("/api/client-login?slug=" + slug);
      if (!clientRes.ok) { router.replace("/c"); return; }
      const clientData = await clientRes.json();
      if (!clientData.jobId || !clientData.hasBooking) { router.replace("/c/" + slug); return; }
      setJobId(clientData.jobId);
      const res = await fetch("/api/bookings/client?jobId=" + clientData.jobId + "&slug=" + slug);
      if (res.ok) setBookings((await res.json()).bookings || []);
    } catch { /* silent */ }
    finally { setLoading(false); }
  }

  async function doAction(bookingId: string, action: string, extra?: { reason?: string; newDate?: string; newTime?: string }) {
    setActing(bookingId);
    try {
      const res = await fetch("/api/bookings/client?slug=" + slug, {
        method: "PATCH", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ jobId, bookingId, action, ...extra }),
      });
      if (res.ok) { const d = await res.json(); setBookings(prev => prev.map(b => b.bookingId === bookingId ? d.booking : b)); }
    } finally { setActing(null); setModal(null); setActiveBooking(null); setModalReason(""); setNewDate(""); setNewTime(""); }
  }

  async function addBooking() {
    setActing("add");
    try {
      const res = await fetch("/api/bookings/client?slug=" + slug, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ jobId, visitorName: addForm.name, visitorEmail: addForm.email, visitorPhone: addForm.phone, service: addForm.service, date: addForm.date, time: addForm.time, message: addForm.message }),
      });
      if (res.ok) { const d = await res.json(); setBookings(prev => [d.booking, ...prev]); setAddForm({ name: "", email: "", phone: "", service: "", date: "", time: "", message: "" }); setModal(null); }
    } finally { setActing(null); }
  }

  const today = new Date().toISOString().split("T")[0];
  const tomorrow = new Date(Date.now() + 86400000).toISOString().split("T")[0];
  const filtered = bookings
    .filter(b => {
      if (filter === "pending") return b.status === "pending";
      if (filter === "upcoming") return b.date >= today && !["cancelled", "declined"].includes(b.status);
      if (filter === "past") return b.date < today || ["cancelled", "declined"].includes(b.status);
      return true;
    })
    .filter(b => !search || [b.visitorName, b.visitorEmail, b.service].join(" ").toLowerCase().includes(search.toLowerCase()))
    .sort((a, b) => a.date > b.date ? -1 : 1);
  const counts = {
    pending: bookings.filter(b => b.status === "pending").length,
    upcoming: bookings.filter(b => b.date >= today && !["cancelled", "declined"].includes(b.status)).length,
    total: bookings.length,
  };

  const pg: React.CSSProperties = { minHeight: "100vh", background: "#080808", color: "#fff", fontFamily: "'Inter',-apple-system,sans-serif" };
  const hdr: React.CSSProperties = { background: "#0f0f0f", borderBottom: "1px solid #1a1a1a", padding: "14px 20px", display: "flex", alignItems: "center", gap: "12px", position: "sticky", top: 0, zIndex: 50 };
  const bdy: React.CSSProperties = { padding: "20px 16px", maxWidth: "720px", margin: "0 auto" };
  const crd: React.CSSProperties = { background: "#0f0f0f", border: "1px solid #1a1a1a", borderRadius: "12px", padding: "16px", marginBottom: "12px" };
  const sta: React.CSSProperties = { background: "#0f0f0f", border: "1px solid #1a1a1a", borderRadius: "10px", padding: "14px", flex: 1, textAlign: "center" };
  const inp: React.CSSProperties = { width: "100%", background: "#111", border: "1px solid #222", borderRadius: "8px", padding: "10px 12px", color: "#fff", fontSize: "14px", boxSizing: "border-box", outline: "none", marginBottom: "10px" };
  const ovl: React.CSSProperties = { position: "fixed", inset: 0, background: "rgba(0,0,0,0.85)", zIndex: 100, display: "flex", alignItems: "center", justifyContent: "center", padding: "20px" };
  const mdb: React.CSSProperties = { background: "#111", border: "1px solid #222", borderRadius: "16px", padding: "24px", width: "100%", maxWidth: "440px", maxHeight: "90vh", overflowY: "auto" };
  const flt = (active: boolean): React.CSSProperties => ({
    padding: "7px 14px", borderRadius: "20px", fontSize: "13px", fontWeight: active ? 600 : 400,
    background: active ? "linear-gradient(135deg,#00c896,#0099ff)" : "none",
    border: active ? "none" : "1px solid #222", color: active ? "#000" : "#555", cursor: "pointer", position: "relative",
  });
  const pll = (color: string): React.CSSProperties => ({
    display: "inline-block", background: color + "18", color, border: "1px solid " + color + "33",
    borderRadius: "20px", padding: "2px 10px", fontSize: "11px", fontWeight: 600, textTransform: "capitalize",
  });
  const abt = (color: string, bg = "transparent"): React.CSSProperties => ({
    flex: 1, minWidth: "70px", padding: "8px 10px", borderRadius: "8px", fontSize: "12px",
    fontWeight: 600, cursor: "pointer", border: "1px solid " + color + "44", color, background: bg,
  });

  if (loading) return <div style={{ ...pg, display: "flex", alignItems: "center", justifyContent: "center" }}><div style={{ color: "#444" }}>Loading…</div></div>;

  return (
    <div style={pg}>
      <header style={hdr}>
        <button onClick={() => router.push("/c/" + slug)} style={{ background: "none", border: "none", color: "#555", fontSize: "20px", cursor: "pointer", padding: 0 }}>←</button>
        <div style={{ flex: 1 }}>
          <div style={{ fontSize: "15px", fontWeight: 700 }}>Booking Manager</div>
          <div style={{ fontSize: "12px", color: "#444" }}>{counts.total} total · {counts.upcoming} upcoming</div>
        </div>
        <button onClick={() => setModal("add")} style={{ background: "linear-gradient(135deg,#00c896,#0099ff)", border: "none", color: "#000", borderRadius: "8px", padding: "8px 14px", fontSize: "13px", fontWeight: 700, cursor: "pointer" }}>+ Add</button>
        <button onClick={loadData} style={{ background: "none", border: "1px solid #1a1a1a", color: "#555", borderRadius: "6px", padding: "6px 12px", fontSize: "12px", cursor: "pointer" }}>↻</button>
      </header>

      <div style={bdy}>
        <div style={{ display: "flex", gap: "10px", marginBottom: "20px" }}>
          {[{ label: "Total", value: counts.total, color: "#fff" }, { label: "Upcoming", value: counts.upcoming, color: "#00c896" }, { label: "Pending", value: counts.pending, color: "#f59e0b" }].map(st => (
            <div key={st.label} style={sta}>
              <div style={{ fontSize: "24px", fontWeight: 800, color: st.color }}>{st.value}</div>
              <div style={{ fontSize: "11px", color: "#444", marginTop: "2px" }}>{st.label}</div>
            </div>
          ))}
        </div>

        <input type="text" placeholder="Search name, email, service…" value={search} onChange={e => setSearch(e.target.value)} style={{ ...inp, marginBottom: "14px" }} />

        <div style={{ display: "flex", gap: "8px", marginBottom: "20px", flexWrap: "wrap" }}>
          {(["upcoming", "pending", "past", "all"] as Filter[]).map(f => (
            <button key={f} style={flt(filter === f)} onClick={() => setFilter(f)}>
              {f.charAt(0).toUpperCase() + f.slice(1)}
              {f === "pending" && counts.pending > 0 && (
                <span style={{ position: "absolute", top: "-4px", right: "-4px", background: "#f59e0b", color: "#000", borderRadius: "50%", width: "16px", height: "16px", fontSize: "10px", fontWeight: 800, display: "flex", alignItems: "center", justifyContent: "center" }}>{counts.pending}</span>
              )}
            </button>
          ))}
        </div>

        {filtered.length === 0 ? (
          <div style={{ ...crd, textAlign: "center", padding: "48px" }}>
            <div style={{ fontSize: "28px", marginBottom: "10px" }}>📅</div>
            <div style={{ color: "#444" }}>No bookings found.</div>
          </div>
        ) : filtered.map(b => {
          const isToday = b.date === today;
          const isTomorrow = b.date === tomorrow;
          const isDone = ["cancelled", "declined"].includes(b.status);
          const sc = STATUS_COLOR[b.status] || "#666";
          return (
            <div key={b.bookingId} style={{ ...crd, opacity: isDone ? 0.5 : 1, borderColor: isToday ? "#00c89630" : "#1a1a1a" }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: "8px", gap: "8px", flexWrap: "wrap" }}>
                <div style={{ display: "flex", alignItems: "center", gap: "8px", flexWrap: "wrap" }}>
                  <span style={{ fontWeight: 700, fontSize: "15px" }}>{b.visitorName}</span>
                  {isToday && <span style={{ ...pll("#00c896"), fontSize: "10px" }}>TODAY</span>}
                  {isTomorrow && <span style={{ ...pll("#f59e0b"), fontSize: "10px" }}>TOMORROW</span>}
                </div>
                <span style={pll(sc)}>{b.status}</span>
              </div>
              <div style={{ color: "#666", fontSize: "13px", marginBottom: "4px" }}>{b.service} · {b.date} at {b.time}</div>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "4px", fontSize: "12px", color: "#444", marginBottom: "10px" }}>
                <div>✉ {b.visitorEmail}</div><div>📞 {b.visitorPhone}</div>
              </div>
              {b.message && <div style={{ background: "#0a0a0a", borderRadius: "6px", padding: "8px 12px", fontSize: "13px", color: "#555", marginBottom: "10px" }}>"{b.message}"</div>}
              {b.cancelReason && <div style={{ background: "#1a0808", borderRadius: "6px", padding: "8px 12px", fontSize: "12px", color: "#ef4444", marginBottom: "10px", opacity: 0.8 }}>Reason: {b.cancelReason}</div>}
              {!isDone && (
                <div style={{ display: "flex", gap: "8px", flexWrap: "wrap", marginTop: "4px" }}>
                  {b.status !== "confirmed" && (
                    <button style={abt("#00c896")} disabled={acting === b.bookingId} onClick={() => doAction(b.bookingId, "confirm")}>
                      {acting === b.bookingId ? "…" : "✓ Confirm"}
                    </button>
                  )}
                  <button style={abt("#3b82f6")} onClick={() => { setActiveBooking(b); setModal("reschedule"); setNewDate(b.date); setNewTime(b.time); }}>↻ Reschedule</button>
                  <a href={"mailto:" + b.visitorEmail} style={{ ...abt("#888"), textDecoration: "none", textAlign: "center" }}>✉ Email</a>
                  <a href={"tel:" + b.visitorPhone} style={{ ...abt("#888"), textDecoration: "none", textAlign: "center" }}>📞 Call</a>
                  <button style={abt("#ef4444")} onClick={() => { setActiveBooking(b); setModal("cancel"); }}>✕ Cancel</button>
                </div>
              )}
            </div>
          );
        })}
      </div>

      {modal === "reschedule" && activeBooking && (
        <div style={ovl} onClick={() => setModal(null)}>
          <div style={mdb} onClick={e => e.stopPropagation()}>
            <div style={{ fontSize: "16px", fontWeight: 700, marginBottom: "16px" }}>Reschedule Booking</div>
            <div style={{ color: "#555", fontSize: "13px", marginBottom: "16px" }}>{activeBooking.visitorName} — {activeBooking.service}</div>
            <label style={{ color: "#666", fontSize: "12px", display: "block", marginBottom: "6px" }}>New Date</label>
            <input type="date" value={newDate} onChange={e => setNewDate(e.target.value)} style={inp} />
            <label style={{ color: "#666", fontSize: "12px", display: "block", marginBottom: "6px" }}>New Time</label>
            <input type="time" value={newTime} onChange={e => setNewTime(e.target.value)} style={inp} />
            <div style={{ display: "flex", gap: "10px", marginTop: "8px" }}>
              <button style={{ ...abt("#555"), flex: "none", padding: "10px 20px" }} onClick={() => setModal(null)}>Cancel</button>
              <button style={{ ...abt("#3b82f6", "#3b82f618"), flex: 1, padding: "10px" }}
                disabled={!newDate || !newTime || acting === activeBooking.bookingId}
                onClick={() => doAction(activeBooking.bookingId, "reschedule", { newDate, newTime })}>
                {acting === activeBooking.bookingId ? "Saving…" : "Save Reschedule"}
              </button>
            </div>
          </div>
        </div>
      )}

      {modal === "cancel" && activeBooking && (
        <div style={ovl} onClick={() => setModal(null)}>
          <div style={mdb} onClick={e => e.stopPropagation()}>
            <div style={{ fontSize: "16px", fontWeight: 700, marginBottom: "16px" }}>Cancel Booking</div>
            <div style={{ color: "#555", fontSize: "13px", marginBottom: "16px" }}>{activeBooking.visitorName} — {activeBooking.date} at {activeBooking.time}</div>
            <label style={{ color: "#666", fontSize: "12px", display: "block", marginBottom: "6px" }}>Reason (sent to customer)</label>
            <textarea value={modalReason} onChange={e => setModalReason(e.target.value)} rows={3}
              placeholder="e.g. We are unavailable that day — please rebook at your convenience."
              style={{ ...inp, resize: "vertical", height: "80px" }} />
            <div style={{ display: "flex", gap: "10px", marginTop: "8px" }}>
              <button style={{ ...abt("#555"), flex: "none", padding: "10px 20px" }} onClick={() => setModal(null)}>Back</button>
              <button style={{ ...abt("#ef4444", "#ef444418"), flex: 1, padding: "10px" }}
                disabled={acting === activeBooking.bookingId}
                onClick={() => doAction(activeBooking.bookingId, "cancel", { reason: modalReason })}>
                {acting === activeBooking.bookingId ? "Cancelling…" : "Confirm Cancel"}
              </button>
            </div>
          </div>
        </div>
      )}

      {modal === "add" && (
        <div style={ovl} onClick={() => setModal(null)}>
          <div style={mdb} onClick={e => e.stopPropagation()}>
            <div style={{ fontSize: "16px", fontWeight: 700, marginBottom: "16px" }}>Add Booking Manually</div>
            {(["name", "email", "phone", "service"] as const).map(field => (
              <input key={field} type="text" placeholder={field.charAt(0).toUpperCase() + field.slice(1)}
                value={addForm[field]} onChange={e => setAddForm(p => ({ ...p, [field]: e.target.value }))} style={inp} />
            ))}
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "10px" }}>
              <input type="date" value={addForm.date} onChange={e => setAddForm(p => ({ ...p, date: e.target.value }))} style={{ ...inp, marginBottom: 0 }} />
              <input type="time" value={addForm.time} onChange={e => setAddForm(p => ({ ...p, time: e.target.value }))} style={{ ...inp, marginBottom: 0 }} />
            </div>
            <textarea placeholder="Notes (optional)" value={addForm.message} onChange={e => setAddForm(p => ({ ...p, message: e.target.value }))}
              rows={2} style={{ ...inp, marginTop: "10px", resize: "vertical" }} />
            <div style={{ display: "flex", gap: "10px", marginTop: "8px" }}>
              <button style={{ ...abt("#555"), flex: "none", padding: "10px 20px" }} onClick={() => setModal(null)}>Cancel</button>
              <button style={{ ...abt("#00c896", "#00c89618"), flex: 1, padding: "10px" }}
                disabled={!addForm.name || !addForm.email || !addForm.service || !addForm.date || !addForm.time || acting === "add"}
                onClick={addBooking}>
                {acting === "add" ? "Adding…" : "Add Booking"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
