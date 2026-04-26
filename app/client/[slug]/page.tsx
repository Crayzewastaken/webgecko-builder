"use client";
import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { Suspense } from "react";

interface ClientData {
  businessName: string;
  name: string;
  email: string;
  phone: string;
  industry: string;
  goal: string;
  siteType: string;
  pages: string[];
  features: string[];
  style: string;
  abn: string;
  domain: string;
  quote: {
    package: string;
    price: number;
    monthlyPrice: number;
    savings: number;
    competitorPrice: number;
    breakdown: string[];
  };
  previewUrl: string;
  hasBooking: boolean;
  jobId: string;
  bookingsUrl: string;
  created: string;
}

interface Booking {
  bookingId: string;
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

function ClientDashboard() {
  const params = useParams();
  const slug = params.slug as string;

  const [data, setData] = useState<ClientData | null>(null);
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [activeTab, setActiveTab] = useState("overview");

  useEffect(() => {
    if (!slug) return;
    fetch(`/api/client-login?slug=${encodeURIComponent(slug)}`)
      .then(r => r.json())
      .then(d => {
        if (d.error) throw new Error(d.error);
        setData(d);
        if (d.hasBooking && d.jobId && d.clientSecret) {
          return fetch(`/api/bookings?jobId=${d.jobId}&secret=${d.clientSecret}`)
            .then(r => r.json())
            .then(bd => setBookings(bd.bookings || []));
        }
      })
      .catch(e => setError(e.message))
      .finally(() => setLoading(false));
  }, [slug]);

  if (loading) return (
    <main className="min-h-screen bg-[#0a0f1a] flex items-center justify-center">
      <div className="text-center">
        <div className="text-4xl mb-4 animate-pulse">🦎</div>
        <p className="text-slate-400">Loading your portal...</p>
      </div>
    </main>
  );

  if (error || !data) return (
    <main className="min-h-screen bg-[#0a0f1a] flex items-center justify-center p-4">
      <div className="text-center">
        <div className="text-4xl mb-4">🔒</div>
        <h1 className="text-white font-bold text-xl mb-2">Access Denied</h1>
        <p className="text-slate-400 text-sm mb-4">{error || "Portal not found"}</p>
        <a href="/client" className="text-emerald-400 hover:underline text-sm">← Back to login</a>
      </div>
    </main>
  );

  const today = new Date().toISOString().split("T")[0];
  const upcomingBookings = bookings.filter(b => b.date >= today);
  const formatDate = (d: string) => {
    const [y, m, day] = d.split("-").map(Number);
    return new Date(y, m - 1, day).toLocaleDateString("en-AU", { weekday: "short", day: "numeric", month: "short" });
  };

  const tabs = [
    { id: "overview", label: "Overview", icon: "🏠" },
    { id: "preview", label: "Site Preview", icon: "🌐" },
    ...(data.hasBooking ? [{ id: "bookings", label: "Bookings", icon: "📅" }] : []),
    { id: "quote", label: "Quote", icon: "💰" },
  ];

  return (
    <main className="min-h-screen bg-[#0a0f1a] text-white">
      {/* Header */}
      <div className="bg-[#0f1623] border-b border-white/8 px-4 py-4">
        <div className="max-w-5xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-3">
            <span className="text-2xl">🦎</span>
            <div>
              <span className="text-emerald-400 font-bold text-sm">WebGecko</span>
              <p className="text-white font-semibold">{data.businessName}</p>
            </div>
          </div>
          <div className="text-right">
            <p className="text-slate-500 text-xs">Client Portal</p>
            <p className="text-slate-400 text-xs">{data.name}</p>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="bg-[#0f1623] border-b border-white/8 px-4">
        <div className="max-w-5xl mx-auto flex gap-1 overflow-x-auto">
          {tabs.map(tab => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`px-4 py-3 text-sm font-medium whitespace-nowrap border-b-2 transition-all ${
                activeTab === tab.id
                  ? "border-emerald-500 text-emerald-400"
                  : "border-transparent text-slate-500 hover:text-slate-300"
              }`}
            >
              {tab.icon} {tab.label}
            </button>
          ))}
        </div>
      </div>

      <div className="max-w-5xl mx-auto p-4 md:p-6">

        {/* OVERVIEW TAB */}
        {activeTab === "overview" && (
          <div className="space-y-4">
            {/* Status card */}
            <div className="bg-[#0f1623] border border-emerald-500/30 rounded-2xl p-5">
              <div className="flex items-center gap-3 mb-3">
                <div className="w-3 h-3 rounded-full bg-emerald-500 animate-pulse" />
                <span className="text-emerald-400 font-semibold text-sm">Project In Progress</span>
              </div>
              <p className="text-slate-400 text-sm">Your website is being built by our team. You'll receive updates via email at <span className="text-white">{data.email}</span>.</p>
            </div>

            {/* Stats */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              {[
                { label: "Package", value: data.quote.package, icon: "📦" },
                { label: "Pages", value: data.pages.length, icon: "📄" },
                { label: "Features", value: data.features.length, icon: "⚙️" },
                ...(data.hasBooking ? [{ label: "Bookings", value: upcomingBookings.length + " upcoming", icon: "📅" }] : [{ label: "Site Type", value: data.siteType === "multi" ? "Multi Page" : "Single Page", icon: "🌐" }]),
              ].map((s, i) => (
                <div key={i} className="bg-[#0f1623] border border-white/8 rounded-xl p-4">
                  <div className="text-xl mb-1">{s.icon}</div>
                  <div className="text-white font-bold">{s.value}</div>
                  <div className="text-slate-500 text-xs">{s.label}</div>
                </div>
              ))}
            </div>

            {/* Project details */}
            <div className="bg-[#0f1623] border border-white/8 rounded-2xl p-5">
              <h3 className="text-white font-semibold mb-4">Project Details</h3>
              <div className="space-y-2 text-sm">
                {[
                  { label: "Business", value: data.businessName },
                  { label: "Industry", value: data.industry },
                  { label: "Goal", value: data.goal },
                  { label: "Pages", value: data.pages.join(", ") },
                  { label: "Features", value: data.features.join(", ") || "-" },
                  { label: "Style", value: data.style || "-" },
                  ...(data.abn ? [{ label: "ABN", value: data.abn }] : []),
                  ...(data.domain ? [{ label: "Domain", value: data.domain }] : []),
                ].map((row, i) => (
                  <div key={i} className="flex gap-4">
                    <span className="text-slate-500 w-24 flex-shrink-0">{row.label}</span>
                    <span className="text-slate-200">{row.value}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* Timeline */}
            <div className="bg-[#0f1623] border border-white/8 rounded-2xl p-5">
              <h3 className="text-white font-semibold mb-4">What Happens Next</h3>
              <div className="space-y-3">
                {[
                  { icon: "🤖", title: "AI Build", desc: "Your site generated by our pipeline", done: true },
                  { icon: "🎨", title: "Design Review", desc: "Our team refines and polishes", done: false },
                  { icon: "✉️", title: "Your Review", desc: "We send you the preview for feedback", done: false },
                  { icon: "🔧", title: "Revisions", desc: "We make any changes you request", done: false },
                  { icon: "🚀", title: "Launch", desc: "Your website goes live on your domain", done: false },
                ].map((step, i) => (
                  <div key={i} className="flex items-center gap-3">
                    <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm flex-shrink-0 ${step.done ? "bg-emerald-500/20 border border-emerald-500" : "bg-slate-800 border border-white/10"}`}>
                      {step.done ? "✓" : step.icon}
                    </div>
                    <div>
                      <p className={`text-sm font-medium ${step.done ? "text-emerald-400" : "text-slate-300"}`}>{step.title}</p>
                      <p className="text-slate-500 text-xs">{step.desc}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div className="text-center pt-2">
              <p className="text-slate-600 text-xs">Questions? Contact us at <span className="text-slate-400">hello@webgecko.au</span></p>
            </div>
          </div>
        )}

        {/* PREVIEW TAB */}
        {activeTab === "preview" && (
          <div className="space-y-4">
            <div className="bg-[#0f1623] border border-white/8 rounded-2xl p-5">
              <h3 className="text-white font-semibold mb-2">Your Website Preview</h3>
              <p className="text-slate-400 text-sm mb-4">This is your AI-generated website. Our team will refine it based on your feedback.</p>
              {data.previewUrl ? (
                <>
                  <a
                    href={data.previewUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-block bg-emerald-500 hover:bg-emerald-400 text-black font-bold px-6 py-3 rounded-xl transition-all text-sm mb-4"
                  >
                    🌐 Open Preview →
                  </a>
                  <div className="border border-white/8 rounded-xl overflow-hidden" style={{ height: 500 }}>
                    <iframe
                      src={data.previewUrl}
                      className="w-full h-full"
                      title="Website Preview"
                    />
                  </div>
                </>
              ) : (
                <div className="bg-slate-800/50 rounded-xl p-8 text-center">
                  <div className="text-3xl mb-3">⏳</div>
                  <p className="text-slate-400">Your preview is being generated. Check back soon.</p>
                </div>
              )}
            </div>
          </div>
        )}

        {/* BOOKINGS TAB */}
        {activeTab === "bookings" && data.hasBooking && (
          <div className="space-y-4">
            <div className="grid grid-cols-3 gap-3 mb-4">
              {[
                { label: "Total", value: bookings.length, icon: "📅" },
                { label: "Upcoming", value: upcomingBookings.length, icon: "⏰", color: "text-emerald-400" },
                { label: "Past", value: bookings.filter(b => b.date < today).length, icon: "✅" },
              ].map((s, i) => (
                <div key={i} className="bg-[#0f1623] border border-white/8 rounded-xl p-4 text-center">
                  <div className="text-xl mb-1">{s.icon}</div>
                  <div className={`text-2xl font-bold ${s.color || "text-white"}`}>{s.value}</div>
                  <div className="text-slate-500 text-xs">{s.label}</div>
                </div>
              ))}
            </div>

            {bookings.length === 0 ? (
              <div className="bg-[#0f1623] border border-white/8 rounded-2xl p-10 text-center">
                <div className="text-4xl mb-3">📭</div>
                <p className="text-slate-400">No bookings yet. Share your website to start receiving bookings.</p>
              </div>
            ) : (
              <div className="space-y-3">
                {bookings.map(b => (
                  <div key={b.bookingId} className={`bg-[#0f1623] border rounded-2xl p-4 ${b.date === today ? "border-emerald-500/40" : "border-white/8"}`}>
                    <div className="flex justify-between items-start flex-wrap gap-2">
                      <div>
                        <div className="flex items-center gap-2 mb-1">
                          <span className="font-semibold text-white">{b.visitorName}</span>
                          {b.date === today && <span className="text-xs bg-emerald-500 text-black px-2 py-0.5 rounded-full font-bold">TODAY</span>}
                          {b.date < today && <span className="text-xs bg-slate-700 text-slate-400 px-2 py-0.5 rounded-full">Past</span>}
                        </div>
                        <p className="text-slate-400 text-sm">{b.service} · {formatDate(b.date)} at {b.time}</p>
                        <p className="text-slate-500 text-xs mt-1">{b.visitorEmail} · {b.visitorPhone}</p>
                        {b.message && <p className="text-slate-400 text-xs mt-1 italic">"{b.message}"</p>}
                      </div>
                      <div className="flex gap-2">
                        <a href={`mailto:${b.visitorEmail}`} className="px-3 py-1.5 rounded-lg bg-slate-800 border border-white/10 text-slate-300 text-xs hover:border-emerald-500/50 transition-all">✉️ Email</a>
                        <a href={`tel:${b.visitorPhone}`} className="px-3 py-1.5 rounded-lg bg-slate-800 border border-white/10 text-slate-300 text-xs hover:border-emerald-500/50 transition-all">📞 Call</a>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* QUOTE TAB */}
        {activeTab === "quote" && (
          <div className="space-y-4">
            <div className="bg-[#0f1623] border border-white/8 rounded-2xl p-6">
              <h3 className="text-white font-semibold mb-4">Your Quote</h3>
              <div className="mb-4">
                <div className="text-emerald-400 font-bold text-lg">{data.quote.package} Package</div>
                <div className="text-4xl font-black text-white mt-1">${data.quote.price.toLocaleString()}</div>
                <div className="text-slate-400 text-sm">+ ${data.quote.monthlyPrice}/month hosting & maintenance</div>
              </div>
              <div className="bg-emerald-500/10 border border-emerald-500/20 rounded-xl p-4 mb-4">
                <p className="text-emerald-400 font-semibold text-sm">🎉 You're saving ${data.quote.savings.toLocaleString()} vs the industry average of ${data.quote.competitorPrice.toLocaleString()}</p>
              </div>
              <div className="space-y-2">
                <p className="text-slate-500 text-xs uppercase tracking-widest font-semibold mb-2">Breakdown</p>
                {data.quote.breakdown.map((item, i) => (
                  <div key={i} className="flex justify-between text-sm border-b border-white/5 pb-2">
                    <span className="text-slate-400">{item.split(":")[0]}</span>
                    <span className="text-white font-medium">{item.split(":")[1]}</span>
                  </div>
                ))}
              </div>
              <div className="mt-6 p-4 bg-slate-800/50 rounded-xl">
                <p className="text-slate-400 text-sm">To proceed, reply to your confirmation email or contact us:</p>
                <p className="text-white text-sm font-semibold mt-1">hello@webgecko.au</p>
              </div>
            </div>
          </div>
        )}
      </div>
    </main>
  );
}

export default function ClientPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen bg-[#0a0f1a] flex items-center justify-center text-slate-500">Loading...</div>
    }>
      <ClientDashboard />
    </Suspense>
  );
}