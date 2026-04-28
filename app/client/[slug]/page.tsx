"use client";
import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
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
  clientSecret: string;
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

function getTimelineDays(data: ClientData): { base: number; extra: string[] } {
  const features = data.features || [];
  const pages = data.pages || [];
  let extra: string[] = [];
  let addedDays = 0;

  if (features.includes("Booking System")) { extra.push("Booking system (+2 days)"); addedDays += 2; }
  if (features.includes("Payments / Shop")) { extra.push("Online shop (+3 days)"); addedDays += 3; }
  if (pages.length >= 10) { extra.push("10+ pages (+2 days)"); addedDays += 2; }

  return { base: 10 + addedDays, extra };
}

function ClientDashboard() {
  const params = useParams();
  const router = useRouter();
  const slug = params.slug as string;

  const [data, setData] = useState<ClientData | null>(null);
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [activeTab, setActiveTab] = useState("overview");

  useEffect(() => {
    if (!slug) return;
    // Require session — check sessionStorage for auth
    const authed = sessionStorage.getItem(`wg_auth_${slug}`);
    if (!authed) {
      router.push("/client");
      return;
    }

    fetch(`/api/client-login?slug=${encodeURIComponent(slug)}`)
      .then(r => r.json())
      .then(async d => {
        if (d.error) throw new Error(d.error);
        setData(d);
        if (d.hasBooking && d.jobId && d.clientSecret) {
          try {
            const bd = await fetch(`/api/bookings?jobId=${d.jobId}&secret=${encodeURIComponent(d.clientSecret)}`).then(r => r.json());
            setBookings(bd.bookings || []);
          } catch {}
        }
      })
      .catch(e => {
        setError(e.message);
        router.push("/client");
      })
      .finally(() => setLoading(false));
  }, [slug, router]);

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
        <p className="text-slate-400 text-sm mb-4">{error || "Please log in"}</p>
        <a href="/client" className="text-emerald-400 hover:underline text-sm">← Back to login</a>
      </div>
    </main>
  );

  const today = new Date().toISOString().split("T")[0];
  const upcomingBookings = bookings.filter(b => b.date >= today);
  const timeline = getTimelineDays(data);

  const formatDate = (d: string) => {
    const [y, m, day] = d.split("-").map(Number);
    return new Date(y, m - 1, day).toLocaleDateString("en-AU", { weekday: "short", day: "numeric", month: "short" });
  };

  const tabs = [
    { id: "overview", label: "Overview", icon: "🏠" },
    { id: "preview", label: "Site Preview", icon: "🌐" },
    ...(data.hasBooking ? [{ id: "bookings", label: `Bookings (${upcomingBookings.length})`, icon: "📅" }] : []),
    { id: "quote", label: "Quote", icon: "💰" },
  ];

  const timelineSteps = [
    { icon: "🔨", title: "Your site is being built", desc: "Our team is actively working on your website", done: true },
    { icon: "🎨", title: "Design & Review", desc: "We refine and polish every detail", done: false },
    { icon: "✉️", title: "Your Review", desc: "We send you the prototype for your feedback", done: false },
    { icon: "🔧", title: "Revisions", desc: "We make any changes you request", done: false },
    { icon: "🚀", title: "Launch", desc: "Your website goes live on your domain", done: false },
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
          <div className="flex items-center gap-4">
            <div className="text-right hidden md:block">
              <p className="text-slate-500 text-xs">Client Portal</p>
              <p className="text-slate-400 text-xs">{data.name}</p>
            </div>
            <button
              onClick={() => { sessionStorage.removeItem(`wg_auth_${slug}`); router.push("/client"); }}
              className="text-slate-500 hover:text-slate-300 text-xs border border-white/10 px-3 py-1.5 rounded-lg transition-all"
            >
              Sign out
            </button>
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

        {/* OVERVIEW */}
        {activeTab === "overview" && (
          <div className="space-y-4">
            {/* Status */}
            <div className="bg-[#0f1623] border border-emerald-500/30 rounded-2xl p-5">
              <div className="flex items-center gap-3 mb-2">
                <div className="w-3 h-3 rounded-full bg-emerald-500 animate-pulse" />
                <span className="text-emerald-400 font-semibold text-sm">Project In Progress</span>
              </div>
              <p className="text-slate-400 text-sm">
                Your website is being built by our team. You&apos;ll receive updates at <span className="text-white">{data.email}</span>.
              </p>
            </div>

            {/* Timeline estimate */}
            <div className="bg-[#0f1623] border border-white/8 rounded-2xl p-5">
              <h3 className="text-white font-semibold mb-1">Estimated Timeline</h3>
              <p className="text-emerald-400 font-bold text-lg mb-1">
                {timeline.base}–{timeline.base + 2} business days to first prototype
              </p>
              {timeline.extra.length > 0 && (
                <div className="mt-2 space-y-1">
                  <p className="text-slate-500 text-xs">Additional time included for:</p>
                  {timeline.extra.map((e, i) => (
                    <p key={i} className="text-slate-400 text-xs flex items-center gap-1">
                      <span className="text-emerald-500">+</span> {e}
                    </p>
                  ))}
                </div>
              )}
              <p className="text-slate-600 text-xs mt-3">Timeline starts from the date of submission. We&apos;ll contact you when your prototype is ready for review.</p>
            </div>

            {/* Stats */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              {[
                { label: "Package", value: data.quote.package, icon: "📦" },
                { label: "Pages", value: String(data.pages.length), icon: "📄" },
                { label: "Features", value: String(data.features.length), icon: "⚙️" },
                data.hasBooking
                  ? { label: "Upcoming Bookings", value: String(upcomingBookings.length), icon: "📅" }
                  : { label: "Site Type", value: data.siteType === "multi" ? "Multi Page" : "Single Page", icon: "🌐" },
              ].map((s, i) => (
                <div key={i} className="bg-[#0f1623] border border-white/8 rounded-xl p-4">
                  <div className="text-xl mb-1">{s.icon}</div>
                  <div className="text-white font-bold">{s.value}</div>
                  <div className="text-slate-500 text-xs">{s.label}</div>
                </div>
              ))}
            </div>

            {/* What happens next */}
            <div className="bg-[#0f1623] border border-white/8 rounded-2xl p-5">
              <h3 className="text-white font-semibold mb-4">What Happens Next</h3>
              <div className="space-y-3">
                {timelineSteps.map((step, i) => (
                  <div key={i} className="flex items-center gap-3">
                    <div className={`w-9 h-9 rounded-full flex items-center justify-center text-sm flex-shrink-0 ${step.done ? "bg-emerald-500/20 border border-emerald-500 text-emerald-400" : "bg-slate-800 border border-white/10 text-slate-400"}`}>
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
                  <div key={i} className="flex gap-4 py-1 border-b border-white/5 last:border-0">
                    <span className="text-slate-500 w-24 flex-shrink-0">{row.label}</span>
                    <span className="text-slate-200">{row.value}</span>
                  </div>
                ))}
              </div>
            </div>

            <div className="text-center pt-2">
              <p className="text-slate-600 text-xs">Questions? <a href="mailto:hello@webgecko.au" className="text-slate-400 hover:text-white">hello@webgecko.au</a></p>
            </div>
          </div>
        )}

        {/* PREVIEW */}
        {activeTab === "preview" && (
          <div className="space-y-4">
            <div className="bg-[#0f1623] border border-white/8 rounded-2xl p-5">
              <h3 className="text-white font-semibold mb-2">Your Website Preview</h3>
              <p className="text-slate-400 text-sm mb-4">
                This is your first prototype. Our team will refine it based on your feedback — nothing is final yet.
              </p>
              {data.previewUrl ? (
                <>
                  <a
                    href={data.previewUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-block bg-emerald-500 hover:bg-emerald-400 text-black font-bold px-6 py-3 rounded-xl transition-all text-sm mb-4"
                  >
                    🌐 Open Full Preview →
                  </a>
                  <div className="border border-white/8 rounded-xl overflow-hidden" style={{ height: 500 }}>
                    <iframe
                      src={data.previewUrl}
                      className="w-full h-full"
                      title="Website Preview"
                    />
                  </div>
                  <p className="text-slate-600 text-xs mt-3 text-center">
                    To request changes, email us at <a href="mailto:hello@webgecko.au" className="text-slate-400">hello@webgecko.au</a>
                  </p>
                </>
              ) : (
                <div className="bg-slate-800/50 rounded-xl p-10 text-center">
                  <div className="text-3xl mb-3">🔨</div>
                  <p className="text-slate-300 font-semibold mb-1">Your site is being built</p>
                  <p className="text-slate-500 text-sm">Your preview will appear here once our team has completed the first prototype. Expected within {timeline.base}–{timeline.base + 2} business days.</p>
                </div>
              )}
            </div>
          </div>
        )}

        {/* BOOKINGS */}
        {activeTab === "bookings" && data.hasBooking && (
          <div className="space-y-4">
            <div className="grid grid-cols-3 gap-3 mb-2">
              {[
                { label: "Total", value: bookings.length, icon: "📅" },
                { label: "Upcoming", value: upcomingBookings.length, icon: "⏰", color: "text-emerald-400" },
                { label: "Past", value: bookings.filter(b => b.date < today).length, icon: "✅" },
              ].map((s, i) => (
                <div key={i} className="bg-[#0f1623] border border-white/8 rounded-xl p-4 text-center">
                  <div className="text-xl mb-1">{s.icon}</div>
                  <div className={`text-2xl font-bold ${(s as any).color || "text-white"}`}>{s.value}</div>
                  <div className="text-slate-500 text-xs">{s.label}</div>
                </div>
              ))}
            </div>

            {bookings.length === 0 ? (
              <div className="bg-[#0f1623] border border-white/8 rounded-2xl p-10 text-center">
                <div className="text-4xl mb-3">📭</div>
                <p className="text-slate-400 font-semibold">No bookings yet</p>
                <p className="text-slate-600 text-sm mt-1">Bookings will appear here once your website is live.</p>
              </div>
            ) : (
              <div className="space-y-3">
                {bookings.map(b => (
                  <div key={b.bookingId} className={`bg-[#0f1623] border rounded-2xl p-4 ${b.date === today ? "border-emerald-500/40" : "border-white/8"}`}>
                    <div className="flex justify-between items-start flex-wrap gap-2">
                      <div>
                        <div className="flex items-center gap-2 mb-1 flex-wrap">
                          <span className="font-semibold text-white">{b.visitorName}</span>
                          {b.date === today && <span className="text-xs bg-emerald-500 text-black px-2 py-0.5 rounded-full font-bold">TODAY</span>}
                          {b.date < today && <span className="text-xs bg-slate-700 text-slate-400 px-2 py-0.5 rounded-full">Past</span>}
                        </div>
                        <p className="text-slate-400 text-sm">{b.service} · {formatDate(b.date)} at {b.time}</p>
                        <p className="text-slate-500 text-xs mt-1">{b.visitorEmail} · {b.visitorPhone}</p>
                        {b.message && <p className="text-slate-400 text-xs mt-1 italic">&ldquo;{b.message}&rdquo;</p>}
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

        {/* QUOTE */}
        {activeTab === "quote" && (
          <div className="space-y-4">
            <div className="bg-[#0f1623] border border-white/8 rounded-2xl p-6">
              <h3 className="text-white font-semibold mb-4">Your Quote</h3>
              <div className="mb-4">
                <div className="text-emerald-400 font-bold text-lg">{data.quote.package} Package</div>
                <div className="text-4xl font-black text-white mt-1">${data.quote.price.toLocaleString()}</div>
                <div className="text-slate-400 text-sm mt-1">+ ${data.quote.monthlyPrice}/month hosting & maintenance</div>
              </div>
              <div className="bg-emerald-500/10 border border-emerald-500/20 rounded-xl p-4 mb-5">
                <p className="text-emerald-400 font-semibold text-sm">🎉 You&apos;re saving ${data.quote.savings.toLocaleString()} vs the industry average of ${data.quote.competitorPrice.toLocaleString()}</p>
              </div>
              <div className="space-y-2 mb-5">
                <p className="text-slate-500 text-xs uppercase tracking-widest font-semibold mb-2">Breakdown</p>
                {data.quote.breakdown.map((item, i) => (
                  <div key={i} className="flex justify-between text-sm border-b border-white/5 pb-2">
                    <span className="text-slate-400">{item.split(":")[0]}</span>
                    <span className="text-white font-medium">{item.split(":")[1]}</span>
                  </div>
                ))}
              </div>
              <div className="bg-slate-800/50 rounded-xl p-4">
                <p className="text-slate-400 text-sm mb-1">Ready to proceed? Contact us:</p>
                <a href="mailto:hello@webgecko.au" className="text-emerald-400 font-semibold hover:underline">hello@webgecko.au</a>
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