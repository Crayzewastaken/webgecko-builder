"use client";

import { useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { Suspense } from "react";

interface Booking {
  bookingId: string;
  jobId: string;
  businessName: string;
  visitorName: string;
  visitorEmail: string;
  visitorPhone: string;
  service: string;
  date: string;
  time: string;
  timezone: string;
  message: string;
  status: string;
  createdAt: string;
}

function BookingsDashboard() {
  const searchParams = useSearchParams();
  const jobId = searchParams.get("jobId") || "";
  const secret = searchParams.get("secret") || "";

  const [bookings, setBookings] = useState<Booking[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [deleting, setDeleting] = useState<string | null>(null);
  const [filter, setFilter] = useState("upcoming");
  const [search, setSearch] = useState("");

  const fetchBookings = async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/bookings?jobId=${encodeURIComponent(jobId)}&secret=${encodeURIComponent(secret)}`);
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to load bookings");
      setBookings(data.bookings || []);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load bookings");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (jobId && secret) fetchBookings();
    else { setLoading(false); setError("Missing jobId or secret in URL"); }
  }, [jobId, secret]);

  const handleDelete = async (bookingId: string) => {
    if (!confirm("Cancel this booking? This cannot be undone.")) return;
    setDeleting(bookingId);
    try {
      const res = await fetch(`/api/bookings?jobId=${encodeURIComponent(jobId)}&secret=${encodeURIComponent(secret)}&bookingId=${encodeURIComponent(bookingId)}`, { method: "DELETE" });
      if (res.ok) setBookings(b => b.filter(x => x.bookingId !== bookingId));
    } catch (e) {
      alert("Failed to cancel booking");
    } finally {
      setDeleting(null);
    }
  };

  const today = new Date().toISOString().split("T")[0];

  const filtered = bookings.filter(b => {
    const matchesFilter =
      filter === "all" ? true :
      filter === "upcoming" ? b.date >= today :
      filter === "past" ? b.date < today : true;
    const matchesSearch = search === "" ||
      b.visitorName.toLowerCase().includes(search.toLowerCase()) ||
      b.visitorEmail.toLowerCase().includes(search.toLowerCase()) ||
      b.service.toLowerCase().includes(search.toLowerCase());
    return matchesFilter && matchesSearch;
  });

  const upcoming = bookings.filter(b => b.date >= today).length;
  const past = bookings.filter(b => b.date < today).length;
  const businessName = bookings[0]?.businessName || "Your Business";

  const formatDate = (d: string) => {
    const [y, m, day] = d.split("-").map(Number);
    return new Date(y, m - 1, day).toLocaleDateString("en-AU", { weekday: "short", day: "numeric", month: "short", year: "numeric" });
  };

  const isToday = (d: string) => d === today;
  const isTomorrow = (d: string) => {
    const tom = new Date(); tom.setDate(tom.getDate() + 1);
    return d === tom.toISOString().split("T")[0];
  };

  return (
    <main className="min-h-screen bg-[#0a0f1a] text-white p-4 md:p-8">
      <div className="max-w-5xl mx-auto">

        {/* Header */}
        <div className="flex items-center justify-between mb-8 flex-wrap gap-4">
          <div>
            <div className="flex items-center gap-3 mb-1">
              <span className="text-2xl">🦎</span>
              <span className="text-emerald-400 font-bold text-lg">WebGecko</span>
            </div>
            <h1 className="text-2xl md:text-3xl font-bold text-white">{businessName}</h1>
            <p className="text-slate-500 text-sm mt-1">Bookings Dashboard</p>
          </div>
          <button
            onClick={fetchBookings}
            className="flex items-center gap-2 px-4 py-2 rounded-xl bg-slate-800 border border-white/10 text-slate-300 text-sm hover:border-emerald-500/50 transition-all"
          >
            🔄 Refresh
          </button>
        </div>

        {/* Error */}
        {error && (
          <div className="bg-red-500/10 border border-red-500/20 rounded-2xl p-5 mb-6 text-red-400">{error}</div>
        )}

        {/* Stats */}
        {!loading && !error && (
          <div className="grid grid-cols-3 gap-4 mb-6">
            {[
              { label: "Total Bookings", value: bookings.length, icon: "📅", color: "text-white" },
              { label: "Upcoming", value: upcoming, icon: "⏰", color: "text-emerald-400" },
              { label: "Completed", value: past, icon: "✅", color: "text-slate-400" },
            ].map((s) => (
              <div key={s.label} className="bg-[#0f1623] border border-white/8 rounded-2xl p-4 md:p-5">
                <div className="text-2xl mb-2">{s.icon}</div>
                <div className={`text-2xl md:text-3xl font-bold ${s.color}`}>{s.value}</div>
                <div className="text-slate-500 text-xs mt-1">{s.label}</div>
              </div>
            ))}
          </div>
        )}

        {/* Filters + Search */}
        {!loading && !error && (
          <div className="flex flex-wrap gap-3 mb-5">
            <div className="flex gap-2 bg-[#0f1623] border border-white/8 rounded-xl p-1">
              {[
                { id: "upcoming", label: "Upcoming" },
                { id: "past", label: "Past" },
                { id: "all", label: "All" },
              ].map(f => (
                <button
                  key={f.id}
                  onClick={() => setFilter(f.id)}
                  className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${filter === f.id ? "bg-emerald-500 text-black" : "text-slate-400 hover:text-white"}`}
                >
                  {f.label}
                </button>
              ))}
            </div>
            <input
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Search name, email, service..."
              className="flex-1 min-w-[200px] bg-[#0f1623] border border-white/8 rounded-xl px-4 py-2 text-sm text-white placeholder:text-slate-600 focus:outline-none focus:border-emerald-500/50"
            />
          </div>
        )}

        {/* Loading */}
        {loading && (
          <div className="text-center py-20 text-slate-500">
            <div className="text-4xl mb-4 animate-pulse">📅</div>
            <p>Loading bookings...</p>
          </div>
        )}

        {/* Empty */}
        {!loading && !error && filtered.length === 0 && (
          <div className="text-center py-20 bg-[#0f1623] border border-white/8 rounded-2xl">
            <div className="text-5xl mb-4">📭</div>
            <p className="text-slate-400 font-semibold">No bookings found</p>
            <p className="text-slate-600 text-sm mt-1">
              {filter === "upcoming" ? "No upcoming bookings yet" : filter === "past" ? "No past bookings" : "No bookings match your search"}
            </p>
          </div>
        )}

        {/* Bookings list */}
        {!loading && !error && filtered.length > 0 && (
          <div className="space-y-3">
            {filtered.map((b) => (
              <div
                key={b.bookingId}
                className={`bg-[#0f1623] border rounded-2xl p-5 transition-all ${
                  isToday(b.date) ? "border-emerald-500/40 bg-emerald-500/5" :
                  isTomorrow(b.date) ? "border-blue-500/30" :
                  b.date < today ? "border-white/5 opacity-60" : "border-white/8"
                }`}
              >
                <div className="flex flex-wrap gap-4 justify-between items-start">
                  {/* Left: visitor info */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-2 flex-wrap">
                      <span className="font-bold text-white text-base">{b.visitorName}</span>
                      {isToday(b.date) && <span className="text-xs bg-emerald-500 text-black px-2 py-0.5 rounded-full font-bold">TODAY</span>}
                      {isTomorrow(b.date) && <span className="text-xs bg-blue-500 text-white px-2 py-0.5 rounded-full font-bold">TOMORROW</span>}
                      {b.date < today && <span className="text-xs bg-slate-700 text-slate-400 px-2 py-0.5 rounded-full">Past</span>}
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-x-6 gap-y-1 text-sm">
                      <div className="flex items-center gap-2 text-slate-400">
                        <span>📧</span>
                        <a href={`mailto:${b.visitorEmail}`} className="text-emerald-400 hover:underline truncate">{b.visitorEmail}</a>
                      </div>
                      <div className="flex items-center gap-2 text-slate-400">
                        <span>📱</span>
                        <a href={`tel:${b.visitorPhone}`} className="hover:text-white">{b.visitorPhone}</a>
                      </div>
                      <div className="flex items-center gap-2 text-slate-400">
                        <span>🛠️</span>
                        <span className="text-white">{b.service}</span>
                      </div>
                      <div className="flex items-center gap-2 text-slate-400">
                        <span>📅</span>
                        <span className="text-white">{formatDate(b.date)} at {b.time}</span>
                      </div>
                      {b.message && (
                        <div className="flex items-start gap-2 text-slate-400 md:col-span-2 mt-1">
                          <span>💬</span>
                          <span className="text-slate-300 italic">"{b.message}"</span>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Right: actions */}
                  <div className="flex flex-col gap-2 items-end flex-shrink-0">
                    <div className="text-xs text-slate-600">
                      Booked {new Date(b.createdAt).toLocaleDateString("en-AU")}
                    </div>
                    <div className="flex gap-2">
                      <a
                        href={`mailto:${b.visitorEmail}?subject=Your booking on ${b.date}&body=Hi ${b.visitorName},%0A%0ARegarding your booking on ${b.date} at ${b.time} for ${b.service}.%0A%0A`}
                        className="px-3 py-1.5 rounded-lg bg-slate-800 border border-white/10 text-slate-300 text-xs hover:border-emerald-500/50 hover:text-white transition-all"
                      >
                        ✉️ Email
                      </a>
                      <a
                        href={`tel:${b.visitorPhone}`}
                        className="px-3 py-1.5 rounded-lg bg-slate-800 border border-white/10 text-slate-300 text-xs hover:border-emerald-500/50 hover:text-white transition-all"
                      >
                        📞 Call
                      </a>
                      <button
                        onClick={() => handleDelete(b.bookingId)}
                        disabled={deleting === b.bookingId}
                        className="px-3 py-1.5 rounded-lg bg-red-500/10 border border-red-500/20 text-red-400 text-xs hover:bg-red-500/20 transition-all disabled:opacity-50"
                      >
                        {deleting === b.bookingId ? "..." : "🗑️ Cancel"}
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}

        <div className="mt-8 text-center text-slate-700 text-xs">
          WebGecko Booking System · Job ID: {jobId}
        </div>
      </div>
    </main>
  );
}

export default function BookingsPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen bg-[#0a0f1a] flex items-center justify-center text-slate-500">
        Loading...
      </div>
    }>
      <BookingsDashboard />
    </Suspense>
  );
}s