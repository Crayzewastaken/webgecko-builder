"use client";
import { useState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { supabasePublic } from "@/lib/supabase";

// ─── CSS Injection ────────────────────────────────────────────────────────────
const CSS = `
  @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&family=Outfit:wght@600;700;800;900&display=swap');
  *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
  body { font-family: 'Inter', -apple-system, sans-serif; transition: background 0.25s, color 0.25s; }
  @keyframes fadeIn { from { opacity:0; transform:translateY(10px) } to { opacity:1; transform:none } }
  .wg-fade { animation: fadeIn 0.24s cubic-bezier(0.25,0.46,0.45,0.94) both; }
  button { transition: all 0.15s ease; outline: none; }
  button:active:not(:disabled) { transform: scale(0.96); }
  @keyframes pulseGlow {
    0% { box-shadow: 0 0 0 0 rgba(0, 200, 150, 0.4); }
    70% { box-shadow: 0 0 0 10px rgba(0, 200, 150, 0); }
    100% { box-shadow: 0 0 0 0 rgba(0, 200, 150, 0); }
  }
  .pulse-green { animation: pulseGlow 2s infinite; }
  @keyframes audioWave {
    0%, 100% { height: 4px; }
    50% { height: 28px; }
  }
  .wave-bar {
    width: 3px;
    height: 6px;
    border-radius: 2px;
    animation: audioWave 1.2s ease-in-out infinite;
  }
  input, textarea, select {
    transition: border-color 0.15s ease, box-shadow 0.15s ease;
  }
  ::-webkit-scrollbar {
    height: 6px;
    width: 6px;
  }
  ::-webkit-scrollbar-thumb {
    background: rgba(0,0,0,0.15);
    border-radius: 10px;
  }
`;

// ─── Theme Configurations ─────────────────────────────────────────────────────
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

// ─── Interfaces ───────────────────────────────────────────────────────────────
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
  businessName: string;
  jobId: string;
  email: string;
  phone?: string;
  industry: string;
  domain?: string;
  previewUrl?: string;
  hasBooking?: boolean;
  launchReady?: boolean;
  supersaasId?: string | number | null;
  supersaasUrl?: string | null;
  squareConnected?: boolean;
  squareMerchantId?: string | null;
  shopPaymentUrl?: string | null;
  abn?: string;
  ga4Id?: string;
  goal?: string;
  targetAudience?: string;
  siteType?: string;
  pages?: string[];
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
  buildStatus?: string;
  slug?: string;
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

// ─── Platform Settings ────────────────────────────────────────────────────────
const PL = {
  Instagram: { color: "#E1306C", bg: "rgba(225,48,108,0.08)", label: "IG" },
  Facebook:  { color: "#1877F2", bg: "rgba(24,119,242,0.08)", label: "FB" },
  LinkedIn:  { color: "#0A66C2", bg: "rgba(10,102,194,0.08)", label: "LI" },
  TikTok:    { color: "#ff0050", bg: "rgba(255,0,80,0.08)", label: "TT" },
  X:         { color: "#1da1f2", bg: "rgba(29,161,242,0.08)", label: "X" },
};

const Badge = ({ platform }: { platform: string }) => {
  const p = PL[platform as keyof typeof PL] || { color: "#6B7280", bg: "rgba(107,114,128,0.08)", label: platform?.slice(0,2) };
  return (
    <span style={{ fontSize: 10, fontWeight: 700, padding: "2px 7px", borderRadius: 6, color: p.color, background: p.bg, letterSpacing: ".2px" }}>
      {p.label} · {platform}
    </span>
  );
};

// ─── Icons Dictionary ─────────────────────────────────────────────────────────
const ic = {
  upload:   "M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4M17 8l-5-5-5 5M12 3v12",
  camera:   "M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2zM12 17a4 4 0 1 0 0-8 4 4 0 0 0 0 8z",
  mic:      "M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3zM19 10v2a7 7 0 0 1-14 0v-2M12 19v4M8 23h8",
  link:     "M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71",
  inbox:    "M22 12h-6l-2 3h-4l-2-3H2M5.45 5.11L2 12v6a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2v-6l-3.45-6.89A2 2 0 0 0 16.76 4H7.24a2 2 0 0 0-1.79 1.11z",
  check:    "M20 6L9 17l-5-5",
  dollar:   "M12 1v22M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6",
  user:     "M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2M12 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8z",
  plus:     "M12 5v14M5 12h14",
  x:        "M18 6L6 18M6 6l12 12",
  bell:     "M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9M13.73 21a2 2 0 0 1-3.46 0",
  send:     "M22 2L11 13M22 2L15 22l-4-9-9-4 20-7z",
  clock:    "M12 22a10 10 0 1 0 0-20 10 10 0 0 0 0 20zM12 6v6l4 2",
  chart:    "M18 20V10M12 20V4M6 20v-6",
  cal:      "M3 9h18M3 4h18v16a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1V4zM8 2v4M16 2v4",
  chevron:  "M9 18l6-6-6-6",
  back:     "M19 12H5M12 19l-7-7 7-7",
  dl:       "M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4M7 10l5 5 5-5M12 15V3",
  shield:   "M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z",
  home:     "M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2zM9 22V12h6v10",
  zap:      "M13 2L3 14h9l-1 8 10-12h-9l1-8z",
  trash:    "M3 6h18M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6M10 11v6M14 11v6M9 6V4h6v2",
  sun:      "M12 12m-4 0a4 4 0 1 0 8 0a4 4 0 1 0 -8 0M12 2v2M12 20v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M2 12h2M20 12h2M6.34 17.66l-1.41 1.41M19.07 4.93l-1.41 1.41",
  moon:     "M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z",
  globe:    "M12 22c5.523 0 10-4.477 10-10S17.523 2 12 2 2 6.477 2 12s4.477 10 10 10z M2 12h20 M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z",
  message:  "M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z",
  edit:     "M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7 M18.5 2.5a2.121 2.121 0 1 1 3 3L12 15l-4 1 1-4 9.5-9.5z",
  info:     "M12 16v-4M12 8h.01M22 12c0 5.523-4.477 10-10 10S2 17.523 2 12 6.477 2 12 2s10 4.477 10 10z"
};

const Ico = ({ d, size = 20, color = "currentColor", sw = 1.8 }: { d: string; size?: number; color?: string; sw?: number }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none"
    stroke={color} strokeWidth={sw} strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0 }}>
    <path d={d} />
  </svg>
);

const GeckoMark = ({ size = 26, color = "#00C896" }) => (
  <svg width={size} height={size} viewBox="0 0 64 64" fill="none">
    <g transform="translate(32,32)">
      <path fill={color} d="M 18 28 Q 44 36 46 56 Q 38 44 20 34 Z" />
      <path fill={color} d="M -9 22 Q -28 30 -36 42 L -32 44 Q -25 33 -8 26 Z" />
      <path stroke={color} strokeWidth="2.5" strokeLinecap="round" fill="none" d="M -36 42 Q -42 46 -44 52 M -36 42 Q -39 50 -37 56 M -36 42 Q -32 50 -30 54" />
      <path fill={color} d="M 9 22 Q 26 30 32 42 L 28 44 Q 22 33 8 26 Z" />
      <path stroke={color} strokeWidth="2.5" strokeLinecap="round" fill="none" d="M 32 42 Q 38 46 40 52 M 32 42 Q 35 50 33 56 M 32 42 Q 28 50 26 54" />
      <ellipse cx="0" cy="16" rx="11" ry="16" fill={color} />
      <path fill={color} d="M -10 4 Q -28 2 -38 -8 L -34 -12 Q -26 -4 -9 0 Z" />
      <path stroke={color} strokeWidth="2.5" strokeLinecap="round" fill="none" d="M -38 -8 Q -44 -12 -46 -18 M -38 -8 Q -42 -16 -40 -22 M -38 -8 Q -34 -16 -32 -20" />
      <path fill={color} d="M 10 4 Q 28 2 36 -10 L 32 -14 Q 26 -6 9 0 Z" />
      <path stroke={color} strokeWidth="2.5" strokeLinecap="round" fill="none" d="M 36 -10 Q 42 -14 44 -20 M 36 -10 Q 40 -18 38 -24 M 36 -10 Q 32 -18 30 -22" />
      <ellipse cx="0" cy="-4" rx="8" ry="8" fill={color} />
      <ellipse cx="0" cy="-18" rx="11" ry="13" fill={color} />
      <ellipse cx="0" cy="-28" rx="6" ry="6" fill={color} />
      <path stroke="#007a5c" strokeWidth="1.5" fill="none" strokeLinecap="round" d="M -5 -24 Q 0 -21 5 -24" />
      <circle cx="-3" cy="-32" r="1.2" fill="#007a5c" /><circle cx="3" cy="-32" r="1.2" fill="#007a5c" />
      <circle cx="-8" cy="-22" r="5.5" fill="#fff" /><circle cx="8" cy="-22" r="5.5" fill="#fff" />
      <ellipse cx="-8" cy="-22" rx="2" ry="3.5" fill="#003d2e" /><ellipse cx="8" cy="-22" rx="2" ry="3.5" fill="#003d2e" />
      <circle cx="-6.5" cy="-24" r="1.2" fill="#fff" /><circle cx="9.5" cy="-24" r="1.2" fill="#fff" />
    </g>
  </svg>
);

// ─── Data Normalisation ───────────────────────────────────────────────────────
function normalizeClient(raw: any): ClientData {
  const m = (raw.metadata || {}) as ClientMetadata;
  return {
    businessName: raw.business_name || m.name || raw.businessName || "Your Business",
    jobId: raw.job_id || raw.jobId || "",
    email: raw.email || "",
    phone: raw.phone || "",
    industry: raw.industry || "",
    domain: raw.domain || raw.preferred_domain || raw.preferredDomain || "",
    previewUrl: raw.preview_url || raw.previewUrl || "",
    hasBooking: raw.has_booking || raw.hasBooking || m.hasBooking || false,
    launchReady: raw.launch_ready || raw.launchReady || false,
    supersaasId: raw.supersaasId || m.supersaasId || null,
    supersaasUrl: raw.supersaasUrl || m.supersaasUrl || null,
    squareConnected: !!(raw.squareConnected || raw.square_connected),
    squareMerchantId: raw.squareMerchantId || raw.square_merchant_id || null,
    shopPaymentUrl: raw.shop_payment_url || raw.shopPaymentUrl || null,
    abn: raw.abn || m.abn || "",
    ga4Id: raw.ga4_id || raw.ga4Id || m.ga4Id || "",
    goal: raw.goal || m.goal || "",
    targetAudience: raw.target_audience || raw.targetAudience || m.targetAudience || "",
    siteType: raw.site_type || raw.siteType || m.siteType || "",
    pages: raw.pages || m.pages || [],
    features: raw.features || m.features || [],
    style: raw.style || m.style || "",
    colorPrefs: raw.color_prefs || raw.colorPrefs || m.colorPrefs || "",
    references: raw.references || m.references || "",
    additionalNotes: raw.additional_notes || raw.additionalNotes || m.additionalNotes || "",
    pricingMethod: raw.pricing_method || raw.pricingMethod || m.pricingMethod || "",
    pricingDetails: raw.pricing_details || raw.pricingDetails || m.pricingDetails || "",
    businessAddress: raw.business_address || raw.businessAddress || m.businessAddress || "",
    facebookPage: raw.facebook_page || raw.facebookPage || m.facebookPage || "",
    quote: raw.quote || m.quote || null,
    created: raw.created || raw.created_at || "",
    buildStatus: raw.status || raw.buildStatus || "idle",
  };
}

// ─── Formatting Helpers ──────────────────────────────────────────────────────
const formatDate = (dateStr: string) => {
  if (!dateStr) return "";
  try {
    const [y, m, d] = dateStr.split("-").map(Number);
    return new Date(y, m - 1, d).toLocaleDateString("en-AU", { weekday: "short", day: "numeric", month: "short" });
  } catch {
    return dateStr;
  }
};

// ─── Shared Atomic Components ────────────────────────────────────────────────
function Toggle({ on, onToggle }: { on: boolean; onToggle: () => void }) {
  return (
    <div onClick={onToggle} style={{ width: 44, height: 26, borderRadius: 13, background: on ? "#00C896" : "rgba(107,114,128,0.25)", cursor: "pointer", position: "relative", transition: "background .2s", flexShrink: 0 }}>
      <div style={{ position: "absolute", top: 3, left: on ? 21 : 3, width: 20, height: 20, borderRadius: "50%", background: "#fff", transition: "left .2s", boxShadow: "0 1px 3px rgba(0,0,0,0.15)" }} />
    </div>
  );
}

function FileChip({ file, onRemove }: { file: File; onRemove: () => void }) {
  const url = URL.createObjectURL(file);
  const isVid = file.type.startsWith("video/");
  return (
    <div style={{ position: "relative", width: 76, height: 76, borderRadius: 12, overflow: "hidden", border: "1px solid rgba(107,114,128,0.2)", flexShrink: 0 }}>
      {isVid ? <video src={url} style={{ width: "100%", height: "100%", objectFit: "cover" }} /> : <img src={url} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }} />}
      <button onClick={onRemove} style={{ position: "absolute", top: 4, right: 4, width: 20, height: 20, borderRadius: "50%", background: "rgba(0,0,0,.6)", border: "none", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center" }}>
        <Ico d={ic.x} size={11} color="#fff" />
      </button>
    </div>
  );
}

// ─── Voice Recorder Component ────────────────────────────────────────────────
function VoiceRecorder({ onDone }: { onDone: (blob: Blob) => void }) {
  const [phase, setPhase] = useState("starting");
  const [secs, setSecs] = useState(0);
  const [url, setUrl] = useState<string | null>(null);
  const [blob, setBlob] = useState<Blob | null>(null);
  const [amplitude, setAmplitude] = useState<number[]>(new Array(10).fill(6));
  const mr = useRef<MediaRecorder | null>(null);
  const chunks = useRef<Blob[]>([]);
  const timer = useRef<any>(null);
  const anim = useRef<any>(null);

  const start = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const rec = new MediaRecorder(stream);
      mr.current = rec; chunks.current = [];
      rec.ondataavailable = e => { if (e.data.size > 0) chunks.current.push(e.data); };
      rec.onstop = () => {
        const b = new Blob(chunks.current, { type: "audio/webm" });
        setBlob(b); setUrl(URL.createObjectURL(b)); setPhase("done");
        stream.getTracks().forEach(t => t.stop());
      };
      rec.start(); setPhase("rec"); setSecs(0);
      timer.current = setInterval(() => setSecs(s => s + 1), 1000);
      
      // Visualizer simulation
      const draw = () => {
        setAmplitude(Array.from({ length: 10 }, () => Math.floor(Math.random() * 26) + 4));
        anim.current = requestAnimationFrame(draw);
      };
      draw();
    } catch { setPhase("error"); }
  };
  const started = useRef(false);
  if (!started.current) { started.current = true; setTimeout(start, 0); }
  const stop = () => {
    clearInterval(timer.current);
    cancelAnimationFrame(anim.current);
    mr.current?.stop();
  };
  const fmt = (s: number) => `${Math.floor(s/60)}:${String(s%60).padStart(2,"0")}`;

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 10, padding: 14, borderRadius: 12, border: "1px solid rgba(107,114,128,0.2)", background: "rgba(107,114,128,0.04)" }}>
      <p style={{ margin: 0, fontWeight: 700, fontSize: 13 }}>Voice Recording Brief</p>
      {phase === "starting" && <p style={{ margin: 0, color: "#6B7280", fontSize: 13 }}>Enabling microphone access…</p>}
      {phase === "error"    && <p style={{ margin: 0, color: "#EF4444", fontSize: 13 }}>Microphone permission denied.</p>}
      {phase === "rec" && (
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <div style={{ width: 8, height: 8, borderRadius: "50%", background: "#EF4444" }} />
          <span style={{ fontWeight: 800, fontSize: 15, width: 42 }}>{fmt(secs)}</span>
          <div style={{ display: "flex", alignItems: "center", gap: 3, flex: 1, justifyContent: "center", height: 32 }}>
            {amplitude.map((h, i) => (
              <div key={i} className="wave-bar" style={{ height: h, background: "#00C896" }} />
            ))}
          </div>
          <button onClick={stop} style={{ padding: "7px 14px", borderRadius: 8, border: "none", background: "#EF4444", color: "#fff", fontWeight: 700, fontSize: 12, cursor: "pointer" }}>Stop</button>
        </div>
      )}
      {phase === "done" && (
        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          <audio src={url || ""} controls style={{ width: "100%", height: 36 }} />
          <div style={{ display: "flex", gap: 8 }}>
            <button onClick={() => { setPhase("starting"); setUrl(null); setBlob(null); setSecs(0); started.current = false; }} style={{ flex: 1, padding: 8, borderRadius: 8, border: "1px solid rgba(107,114,128,0.2)", background: "transparent", color: "#6B7280", fontWeight: 600, fontSize: 12, cursor: "pointer" }}>Re-record</button>
            <button onClick={() => onDone(blob!)} style={{ flex: 1, padding: 8, borderRadius: 8, border: "none", background: "#00C896", color: "#fff", fontWeight: 700, fontSize: 12, cursor: "pointer" }}>Attach Voice note</button>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Screens ──────────────────────────────────────────────────────────────────

// ── 1. Dashboard (Home) Screen ──
function DashboardScreen({ client, paymentStatus, onNav, C }: { client: ClientData | null; paymentStatus: PaymentStatus | null; onNav: (tab: any) => void; C: any }) {
  const isBuilding = client?.buildStatus === "building";
  const isReview = client?.buildStatus === "completed" && !paymentStatus?.finalPaid;
  const isLive = client?.buildStatus === "completed" && paymentStatus?.finalPaid;

  const stats = [
    { label: "Bookings", value: client?.hasBooking ? "Active" : "None", trend: client?.hasBooking ? "SuperSaas" : "Disabled", isDues: false },
    { label: "Reach (IG/FB)", value: "12,400", trend: "+27% this mo", isDues: false },
    { label: "Avg engagement", value: "8.2%", trend: "+1.1% vs Apr", isDues: false },
    { label: "Outstanding Dues", value: paymentStatus?.depositPaid ? (paymentStatus.finalPaid ? "$0" : `$${paymentStatus.quote?.final || 100}`) : `$${paymentStatus?.quote?.deposit || 100}`, trend: paymentStatus?.finalPaid ? "Fully Paid" : "Payment Due", isDues: !paymentStatus?.finalPaid },
  ];

  const activity = ([
    client?.hasBooking ? { icon: "📅", text: "New customer booking registered via SuperSaas", time: "1 hr ago", nav: "bookings" } : null,
    { icon: "✅", text: "On-site progress draft post generated for review", time: "2 hrs ago", nav: "socials" },
    paymentStatus?.depositPaid ? { icon: "💳", text: "Deposit invoice paid successfully", time: "2 days ago", nav: "billing" } : null,
    { icon: "🎨", text: "Stitch blueprint configured with Custom Green Palette", time: "3 days ago", nav: null },
  ].filter(Boolean) as { icon: string; text: string; time: string; nav: string | null }[]);

  return (
    <div className="wg-fade" style={{ display: "flex", flexDirection: "column", gap: 18, paddingBottom: 24 }}>
      <div>
        <h2 style={{ fontSize: 22, fontWeight: 900, color: C.text, letterSpacing: "-0.4px" }}>Good morning 👋</h2>
        <p style={{ margin: "2px 0 0", color: C.textSec, fontSize: 13 }}>Here's the latest update on your digital presence.</p>
      </div>

      {/* Website Build Status Card */}
      <div style={{ background: C.surface, border: `1px solid ${C.border}`, borderRadius: 16, padding: 18, boxShadow: C.shadow }}>
        <p style={{ margin: "0 0 6px", fontSize: 11, fontWeight: 700, color: C.textMuted, textTransform: "uppercase", letterSpacing: ".4px" }}>Website Project Status</p>
        {isBuilding ? (
          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <span style={{ fontWeight: 800, fontSize: 15, color: C.text }}>🔨 Architecting layouts...</span>
              <span style={{ fontSize: 12, color: "#00C896", fontWeight: 700 }}>Step 4 of 10</span>
            </div>
            <div style={{ height: 6, background: C.raised, borderRadius: 3, overflow: "hidden" }}>
              <div style={{ height: "100%", width: "45%", background: "linear-gradient(90deg, #00C896, #00d4a0)", borderRadius: 3 }} />
            </div>
            <p style={{ margin: 0, fontSize: 12, color: C.textMuted }}>Claude Haiku is currently writing and refactoring HTML elements.</p>
          </div>
        ) : isReview ? (
          <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <span style={{ fontWeight: 800, fontSize: 15, color: C.text }}>👀 Layout Ready to Review</span>
              <span style={{ fontSize: 11, background: `${C.amber}18`, border: `1px solid ${C.amber}33`, color: C.amber, padding: "2px 7px", borderRadius: 20, fontWeight: 700 }}>In Review</span>
            </div>
            <p style={{ margin: 0, fontSize: 12, color: C.textSec, lineHeight: 1.5 }}>Our AI pipeline completed the deployment checklist. View the layout preview and submit any text or image edit revisions.</p>
            <button onClick={() => onNav("website")} style={{ width: "100%", padding: 10, background: "#00C896", color: "#fff", border: "none", borderRadius: 10, fontWeight: 700, fontSize: 13, cursor: "pointer", boxShadow: "0 3px 10px rgba(0,200,150,0.2)" }}>Review Layout & Request Changes →</button>
          </div>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <span style={{ fontWeight: 800, fontSize: 15, color: C.text }}>🚀 Website Live & Active</span>
              <span style={{ fontSize: 11, background: `${C.accent}18`, border: `1px solid ${C.accent}33`, color: C.accent, padding: "2px 7px", borderRadius: 20, fontWeight: 700 }}>Live</span>
            </div>
            <p style={{ margin: 0, fontSize: 12, color: C.textMuted }}>Your custom site is deployed on Vercel and fully indexed.</p>
            {client?.previewUrl && (
              <a href={client.previewUrl} target="_blank" rel="noopener noreferrer" style={{ textDecoration: "none", textAlign: "center", display: "block", width: "100%", padding: 10, border: `1px solid ${C.border}`, borderRadius: 10, color: C.text, fontWeight: 700, fontSize: 13, background: C.surface }}>Visit Website ↗</a>
            )}
          </div>
        )}
      </div>

      {/* Grid of Diagnostics */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
        {stats.map(s => (
          <div key={s.label} style={{ background: C.surface, border: `1px solid ${s.isDues ? `${C.red}33` : C.border}`, borderRadius: 14, padding: 14, boxShadow: C.shadow }}>
            <p style={{ margin: "0 0 4px", fontSize: 11, color: C.textMuted, fontWeight: 600 }}>{s.label}</p>
            <p style={{ margin: "0 0 4px", fontSize: 18, fontWeight: 800, color: s.isDues ? C.red : C.text }}>{s.value}</p>
            <span style={{ fontSize: 10, fontWeight: 700, color: s.isDues ? C.red : C.accent }}>{s.trend}</span>
          </div>
        ))}
      </div>

      {/* Next Social queue Banner */}
      <div style={{ background: "#0F1117", borderRadius: 16, padding: "14px 16px", display: "flex", alignItems: "center", gap: 12, border: "1px solid rgba(255,255,255,0.05)" }}>
        <div style={{ width: 38, height: 38, borderRadius: 10, background: "rgba(0, 200, 150, 0.15)", display: "flex", alignItems: "center", justifyContent: "center" }}>
          <Ico d={ic.cal} size={18} color="#00C896" />
        </div>
        <div style={{ flex: 1 }}>
          <p style={{ margin: 0, color: "rgba(255,255,255,0.4)", fontSize: 10, fontWeight: 700, textTransform: "uppercase", letterSpacing: ".3px" }}>Next Scheduled Post</p>
          <p style={{ margin: "2px 0 0", color: "#fff", fontWeight: 700, fontSize: 14 }}>June Promo Campaign</p>
          <div style={{ display: "flex", gap: 8, alignItems: "center", marginTop: 2 }}>
            <span style={{ color: "rgba(255,255,255,0.3)", fontSize: 11 }}>June 1st, 9:00 AM</span>
            <Badge platform="LinkedIn" />
          </div>
        </div>
      </div>

      {/* Quick Nav Tools */}
      <div style={{ display: "flex", gap: 8 }}>
        <button onClick={() => onNav("socials")} style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center", gap: 6, padding: 12, background: C.surface, border: `1px solid ${C.border}`, borderRadius: 12, color: C.text, fontSize: 13, fontWeight: 700, cursor: "pointer" }}>
          <Ico d={ic.send} size={15} color="#00C896" /> Submit Brief
        </button>
        <button onClick={() => onNav("bookings")} style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center", gap: 6, padding: 12, background: C.surface, border: `1px solid ${C.border}`, borderRadius: 12, color: C.text, fontSize: 13, fontWeight: 700, cursor: "pointer" }}>
          <Ico d={ic.cal} size={15} color="#00C896" /> Bookings
        </button>
        <button onClick={() => onNav("billing")} style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center", gap: 6, padding: 12, background: C.surface, border: `1px solid ${C.border}`, borderRadius: 12, color: C.text, fontSize: 13, fontWeight: 700, cursor: "pointer" }}>
          <Ico d={ic.dollar} size={15} color="#00C896" /> Pay Invoice
        </button>
      </div>

      {/* Recent Activities */}
      <div>
        <p style={{ margin: "0 0 10px", fontWeight: 700, fontSize: 13, color: C.textSec }}>Recent Activity</p>
        <div style={{ background: C.surface, border: `1px solid ${C.border}`, borderRadius: 16, overflow: "hidden", boxShadow: C.shadow }}>
          {activity.map((a, i) => (
            <div key={i} style={{ padding: "12px 14px", display: "flex", alignItems: "center", gap: 10, borderBottom: i < activity.length - 1 ? `1px solid ${C.border}` : "none" }}>
              <span style={{ fontSize: 16 }}>{a.icon}</span>
              <div style={{ flex: 1 }}>
                <p style={{ margin: 0, fontSize: 12, color: C.text, lineHeight: 1.4 }}>{a.text}</p>
                <p style={{ margin: 0, fontSize: 10, color: C.textMuted }}>{a.time}</p>
              </div>
              {a.nav && (
                <button onClick={() => onNav(a.nav)} style={{ background: "transparent", border: "none", color: "#00C896", fontWeight: 700, fontSize: 12, cursor: "pointer" }}>View</button>
              )}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

// ── 2. Website Screen (Preview & Revisions) ──
function WebsiteScreen({ client, C }: { client: ClientData | null; C: any }) {
  const [feedback, setFeedback] = useState<{ id: string; text: string; createdAt: string }[]>([]);
  const [feedbackText, setFeedbackText] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [round, setRound] = useState(1);
  const [revisionSent, setRevisionSent] = useState(false);

  useEffect(() => {
    loadFeedback();
  }, []);

  async function loadFeedback() {
    if (!client?.slug) return;
    try {
      const res = await fetch(`/api/preview/feedback?slug=${client.slug}`);
      if (res.ok) {
        const d = await res.json();
        setFeedback(d.feedback || []);
        setRound(d.round || 1);
      }
    } catch {}
  }

  async function submitPoint() {
    if (!feedbackText.trim() || !client?.slug) return;
    setSubmitting(true);
    try {
      const res = await fetch(`/api/preview/feedback?slug=${client.slug}`, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text: feedbackText.trim() }),
      });
      if (res.ok) {
        const d = await res.json();
        setFeedback(d.feedback || []);
        setFeedbackText("");
      }
    } finally { setSubmitting(false); }
  }

  async function removePoint(id: string) {
    if (!client?.slug) return;
    try {
      const remaining = feedback.filter(f => f.id !== id);
      await fetch(`/api/preview/feedback?slug=${client.slug}`, {
        method: "PUT", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ feedback: remaining }),
      });
      setFeedback(remaining);
    } catch {}
  }

  async function submitRevision() {
    if (!client?.slug || !confirm("Submit revisions to the build queue?")) return;
    setSubmitting(true);
    try {
      const res = await fetch(`/api/preview/feedback?slug=${client.slug}`, { method: "DELETE" });
      if (res.ok) {
        setRevisionSent(true);
        setFeedback([]);
      }
    } finally { setSubmitting(false); }
  }

  const isCompleted = client?.buildStatus === "completed";

  return (
    <div className="wg-fade" style={{ display: "flex", flexDirection: "column", gap: 16, paddingBottom: 24 }}>
      <div>
        <h2 style={{ fontSize: 20, fontWeight: 900, color: C.text, letterSpacing: "-0.4px" }}>Website Preview</h2>
        <p style={{ margin: "2px 0 0", color: C.textSec, fontSize: 13 }}>Review layout and request content modifications.</p>
      </div>

      {client?.previewUrl ? (
        <div style={{ background: C.surface, border: `1px solid ${C.border}`, borderRadius: 16, overflow: "hidden", boxShadow: C.shadow }}>
          {/* Mock Browser Frame */}
          <div style={{ padding: "8px 14px", borderBottom: `1px solid ${C.border}`, background: C.raised, display: "flex", alignItems: "center", gap: 8 }}>
            <div style={{ width: 8, height: 8, borderRadius: "50%", background: "#FF5F56" }} />
            <div style={{ width: 8, height: 8, borderRadius: "50%", background: "#FFBD2E" }} />
            <div style={{ width: 8, height: 8, borderRadius: "50%", background: "#27C93F" }} />
            <div style={{ flex: 1, background: C.surface, borderRadius: 6, padding: "2px 8px", fontSize: 10, color: C.textMuted, textAlign: "center", textOverflow: "ellipsis", overflow: "hidden", whiteSpace: "nowrap" }}>
              {client.previewUrl}
            </div>
          </div>
          <div style={{ width: "100%", height: 380, overflow: "hidden", position: "relative" }}>
            <iframe src={client.previewUrl} style={{ width: "100%", height: "100%", border: "none" }} />
          </div>
          <div style={{ padding: 12, borderTop: `1px solid ${C.border}`, textAlign: "center" }}>
            <a href={client.previewUrl} target="_blank" rel="noopener noreferrer" style={{ display: "inline-flex", alignItems: "center", gap: 6, textDecoration: "none", color: "#00C896", fontSize: 12, fontWeight: 700 }}>
              <Ico d={ic.globe} size={14} color="#00C896" /> Open Full Screen Layout ↗
            </a>
          </div>
        </div>
      ) : (
        <div style={{ background: C.surface, border: `1px solid ${C.border}`, borderRadius: 16, padding: "32px 18px", textAlign: "center" }}>
          <div style={{ fontSize: 32, marginBottom: 10 }}>🏗️</div>
          <p style={{ margin: 0, fontWeight: 700, fontSize: 14, color: C.text }}>No preview active yet</p>
          <p style={{ margin: "4px 0 0", fontSize: 12, color: C.textMuted }}>Your site is currently generating in step functions. We will alert you on release.</p>
        </div>
      )}

      {/* Revision request box */}
      {isCompleted && (
        <div style={{ background: C.surface, border: `1px solid ${C.border}`, borderRadius: 16, padding: 16, display: "flex", flexDirection: "column", gap: 12, boxShadow: C.shadow }}>
          <div>
            <span style={{ fontSize: 11, background: "rgba(0,200,150,0.12)", color: "#00C896", padding: "3px 8px", borderRadius: 20, fontWeight: 700, textTransform: "uppercase" }}>Revision Round {round}</span>
            <p style={{ margin: "6px 0 0", fontSize: 13, color: C.textSec, lineHeight: 1.4 }}>Request changes to copy, layout sections, color settings, or photo headers.</p>
          </div>

          {revisionSent ? (
            <div style={{ background: "rgba(0,200,150,0.06)", border: "1px solid rgba(0,200,150,0.2)", borderRadius: 10, padding: 12, textAlign: "center" }}>
              <p style={{ margin: 0, color: "#00C896", fontWeight: 700, fontSize: 13 }}>✓ Revision queue request dispatched</p>
              <p style={{ margin: "2px 0 0", color: C.textMuted, fontSize: 11 }}>Our operators will finalize changes within 24 hours.</p>
            </div>
          ) : (
            <>
              {/* Revision list */}
              {feedback.length > 0 && (
                <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                  {feedback.map((f, index) => (
                    <div key={f.id} style={{ display: "flex", gap: 10, background: C.raised, borderRadius: 8, padding: 10, alignItems: "flex-start", border: `1px solid ${C.border}` }}>
                      <span style={{ fontSize: 12, fontWeight: 700, color: C.textMuted }}>{index + 1}.</span>
                      <p style={{ margin: 0, flex: 1, fontSize: 12, color: C.text, lineHeight: 1.4 }}>{f.text}</p>
                      <button onClick={() => removePoint(f.id)} style={{ background: "none", border: "none", cursor: "pointer", color: C.textMuted }}><Ico d={ic.x} size={14} /></button>
                    </div>
                  ))}
                </div>
              )}

              {/* Points input */}
              <div style={{ display: "flex", gap: 8 }}>
                <input value={feedbackText} onChange={e => setFeedbackText(e.target.value)} placeholder="e.g. Change body text to a darker gray..." style={{ flex: 1, background: C.raised, border: `1.5px solid ${C.border}`, borderRadius: 10, padding: "8px 12px", color: C.text, fontSize: 13, outline: "none" }} />
                <button onClick={submitPoint} disabled={submitting || !feedbackText.trim()} style={{ padding: "0 14px", border: "none", background: "#00C896", color: "#fff", fontWeight: 700, borderRadius: 10, fontSize: 12, cursor: "pointer" }}>Add</button>
              </div>

              {feedback.length > 0 && (
                <button onClick={submitRevision} disabled={submitting} style={{ width: "100%", padding: 12, border: "none", background: "linear-gradient(135deg, #00C896, #00d4a0)", color: "#fff", fontWeight: 700, borderRadius: 10, fontSize: 13, cursor: "pointer", boxShadow: "0 3px 10px rgba(0,200,150,0.25)" }}>
                  Submit Revisions to Operator Queue ({feedback.length}) →
                </button>
              )}
            </>
          )}
        </div>
      )}
    </div>
  );
}

// ── 3. Socials Screen (Social Poster) ──
function SocialsScreen({ client, C }: { client: ClientData | null; C: any }) {
  const [subTab, setSubTab] = useState<"create" | "queue" | "setup">("create");
  const [files, setFiles] = useState<File[]>([]);
  const [brief, setBrief] = useState("");
  const [tone, setTone] = useState("friendly");
  const [platforms, setPlatforms] = useState<string[]>(["Instagram", "Facebook"]);
  const [linkUrl, setLinkUrl] = useState("");
  const [showLink, setShowLink] = useState(false);
  const [showVoice, setShowVoice] = useState(false);
  
  const [isGenerating, setIsGenerating] = useState(false);
  const [drafts, setDrafts] = useState<any[]>([]);
  const [generatedMediaUrls, setGeneratedMediaUrls] = useState<string[]>([]);
  const [approving, setApproving] = useState(false);
  const [approveDone, setApproveDone] = useState(false);
  
  const [history, setHistory] = useState<any[]>([]);
  const uploadRef = useRef<HTMLInputElement>(null);
  const cameraRef = useRef<HTMLInputElement>(null);

  // Setup options
  const [socialBrief, setSocialBrief] = useState("");
  const [socialTone, setSocialTone] = useState("casual");
  const [socialSetupMode, setSocialSetupMode] = useState<"link" | "create">("link");
  const [setupSubmitted, setSetupSubmitted] = useState(false);

  useEffect(() => {
    loadSocialData();
  }, []);

  async function loadSocialData() {
    if (!client?.jobId) return;
    try {
      const { data: jobRow } = await supabasePublic
        .from("jobs")
        .select("metadata")
        .eq("id", client.jobId)
        .single();
      if (jobRow?.metadata?.approvedPosts) {
        setHistory(jobRow.metadata.approvedPosts.reverse());
      }
    } catch {}
  }

  const addFiles = (fList: FileList | null) => {
    if (!fList) return;
    setFiles(prev => [...prev, ...Array.from(fList)]);
  };

  async function generateDrafts() {
    if (!brief.trim() && files.length === 0 || !client) return;
    setIsGenerating(true);
    setDrafts([]);
    try {
      const fd = new FormData();
      fd.append("slug", client.slug || "");
      fd.append("brief", brief);
      fd.append("tone", tone);
      fd.append("platforms", JSON.stringify(platforms));
      if (linkUrl) fd.append("linkUrl", linkUrl);
      files.forEach(f => fd.append("files", f));

      const res = await fetch("/api/client/social-upload-app", {
        method: "POST",
        body: fd
      });
      const data = await res.json();
      if (res.ok) {
        setDrafts(data.drafts || []);
        setGeneratedMediaUrls(data.mediaUrls || []);
      } else {
        alert(data.error || "Failed to generate captions.");
      }
    } catch {
      alert("Error contacting generating endpoint.");
    } finally { setIsGenerating(false); }
  }

  async function approveSocial() {
    if (!client) return;
    setApproving(true);
    try {
      const payload = {
        slug: client.slug,
        posts: drafts.map(d => ({
          platform: d.platform,
          caption: d.caption,
          hashtags: d.hashtags,
          scheduledAt: d.scheduledAt,
          mediaUrls: generatedMediaUrls,
        }))
      };
      const res = await fetch("/api/client/social-approve", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload)
      });
      if (res.ok) {
        setApproveDone(true);
        loadSocialData();
        setTimeout(() => {
          setApproveDone(false);
          setDrafts([]);
          setFiles([]);
          setBrief("");
          setSubTab("queue");
        }, 2200);
      }
    } finally { setApproving(false); }
  }

  async function submitSetupBrief() {
    if (!client) return;
    try {
      await fetch("/api/client/upgrade-request", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          slug: client.slug,
          type: socialSetupMode === "link" ? "social_link_existing" : "social_create_accounts",
          details: { brief: socialBrief, tone: socialTone }
        })
      });
      setSetupSubmitted(true);
    } catch {}
  }

  return (
    <div className="wg-fade" style={{ display: "flex", flexDirection: "column", gap: 16, paddingBottom: 24 }}>
      <div>
        <h2 style={{ fontSize: 20, fontWeight: 900, color: C.text, letterSpacing: "-0.4px" }}>Social Poster</h2>
        <p style={{ margin: "2px 0 0", color: C.textSec, fontSize: 13 }}>Schedule platform updates via AI briefs.</p>
      </div>

      {/* Mini Tabbar */}
      <div style={{ display: "flex", background: C.raised, borderRadius: 12, padding: 3, border: `1px solid ${C.border}`, gap: 4 }}>
        {[
          { id: "create", label: "Create Post" },
          { id: "queue", label: "Queue / History" },
          { id: "setup", label: "Setup brief" },
        ].map(t => (
          <button key={t.id} onClick={() => setSubTab(t.id as any)} style={{ flex: 1, padding: 8, border: "none", borderRadius: 9, cursor: "pointer", fontSize: 11, fontWeight: subTab === t.id ? 700 : 500, background: subTab === t.id ? "#00C896" : "transparent", color: subTab === t.id ? "#fff" : C.textMuted, fontFamily: "inherit" }}>
            {t.label}
          </button>
        ))}
      </div>

      {subTab === "create" && (
        <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
          {drafts.length === 0 ? (
            <>
              {/* Media upload zone */}
              <input ref={uploadRef} type="file" multiple accept="image/*,video/*" hidden onChange={e => addFiles(e.target.files)} />
              <input ref={cameraRef} type="file" accept="image/*,video/*" capture="environment" hidden onChange={e => addFiles(e.target.files)} />
              <div style={{ display: "flex", gap: 10 }}>
                <button onClick={() => cameraRef.current?.click()} style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", gap: 8, padding: 18, borderRadius: 16, border: "none", background: "#0F1117", cursor: "pointer" }}>
                  <div style={{ width: 44, height: 44, borderRadius: "50%", background: "rgba(0,200,150,0.15)", display: "flex", alignItems: "center", justifyContent: "center" }}>
                    <Ico d={ic.camera} size={20} color="#00C896" />
                  </div>
                  <span style={{ color: "#fff", fontWeight: 700, fontSize: 12 }}>Snap Photo</span>
                </button>
                <button onClick={() => uploadRef.current?.click()} style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", gap: 8, padding: 18, borderRadius: 16, border: `1.5px solid ${C.border}`, background: C.surface, cursor: "pointer" }}>
                  <div style={{ width: 44, height: 44, borderRadius: "50%", background: "rgba(0,200,150,0.08)", display: "flex", alignItems: "center", justifyContent: "center" }}>
                    <Ico d={ic.upload} size={20} color="#00C896" />
                  </div>
                  <span style={{ color: C.text, fontWeight: 700, fontSize: 12 }}>Upload File</span>
                </button>
              </div>

              {files.length > 0 && (
                <div style={{ display: "flex", gap: 8, overflowX: "auto", paddingBottom: 4 }}>
                  {files.map((f, i) => (
                    <FileChip key={i} file={f} onRemove={() => setFiles(prev => prev.filter((_, idx) => idx !== i))} />
                  ))}
                </div>
              )}

              {/* Text brief */}
              <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                <label style={{ fontSize: 12, color: C.textSec, fontWeight: 700 }}>Post description / brief</label>
                <textarea value={brief} onChange={e => setBrief(e.target.value.slice(0, 500))} rows={4} placeholder="Describe the post goal, e.g., Restoration of brick siding finished today in Sydney, offering 10% off enquiries in June..." style={{ width: "100%", background: C.surface, border: `1.5px solid ${C.border}`, borderRadius: 12, padding: 12, color: C.text, fontSize: 13, resize: "none", outline: "none", lineHeight: 1.6 }} />
                <span style={{ fontSize: 10, color: C.textMuted, alignSelf: "flex-end" }}>{brief.length}/500</span>
              </div>

              {/* Action Toggles */}
              <div style={{ display: "flex", gap: 10 }}>
                <button onClick={() => setShowLink(!showLink)} style={{ flex: 1, padding: 10, borderRadius: 10, border: `1px solid ${showLink ? "#00C896" : C.border}`, background: showLink ? "rgba(0,200,150,0.06)" : C.surface, color: showLink ? "#00C896" : C.textSec, fontSize: 12, fontWeight: 600, display: "flex", alignItems: "center", justifyContent: "center", gap: 6, cursor: "pointer" }}>
                  <Ico d={ic.link} size={14} color={showLink ? "#00C896" : C.textSec} /> Add link
                </button>
                <button onClick={() => setShowVoice(!showVoice)} style={{ flex: 1, padding: 10, borderRadius: 10, border: `1px solid ${showVoice ? "#00C896" : C.border}`, background: showVoice ? "rgba(0,200,150,0.06)" : C.surface, color: showVoice ? "#00C896" : C.textSec, fontSize: 12, fontWeight: 600, display: "flex", alignItems: "center", justifyContent: "center", gap: 6, cursor: "pointer" }}>
                  <Ico d={ic.mic} size={14} color={showVoice ? "#00C896" : C.textSec} /> Voice Brief
                </button>
              </div>

              {showVoice && <VoiceRecorder onDone={(blob: Blob) => { setFiles(prev => [...prev, new File([blob], `brief-audio-${Date.now()}.webm`, { type: blob.type })]); setShowVoice(false); }} />}
              {showLink && <input type="url" value={linkUrl} onChange={e => setLinkUrl(e.target.value)} placeholder="https://..." style={{ width: "100%", background: C.surface, border: `1.5px solid ${C.border}`, borderRadius: 10, padding: 10, color: C.text, fontSize: 13, outline: "none" }} />}

              {/* Tone & Platforms */}
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
                <div>
                  <label style={{ fontSize: 11, color: C.textMuted, fontWeight: 600, display: "block", marginBottom: 5 }}>Tone profile</label>
                  <select value={tone} onChange={e => setTone(e.target.value)} style={{ width: "100%", background: C.surface, border: `1.5px solid ${C.border}`, borderRadius: 10, padding: 10, color: C.text, fontSize: 13 }}>
                    <option value="friendly">Friendly & casual</option>
                    <option value="professional">Professional</option>
                    <option value="promotional">Promotional</option>
                  </select>
                </div>
                <div>
                  <label style={{ fontSize: 11, color: C.textMuted, fontWeight: 600, display: "block", marginBottom: 5 }}>Estimate Cost</label>
                  <div style={{ display: "flex", alignItems: "center", background: "rgba(0,200,150,0.08)", border: "1px solid rgba(0,200,150,0.2)", borderRadius: 10, padding: 10, height: 38, fontSize: 12, fontWeight: 700, color: "#00C896" }}>
                    $100.00 Flat fee
                  </div>
                </div>
              </div>

              <div>
                <label style={{ fontSize: 11, color: C.textMuted, fontWeight: 600, display: "block", marginBottom: 6 }}>Social channels</label>
                <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                  {["Instagram", "Facebook", "LinkedIn", "TikTok"].map(p => {
                    const active = platforms.includes(p);
                    return (
                      <button key={p} onClick={() => setPlatforms(prev => active ? prev.filter(x => x !== p) : [...prev, p])} style={{ padding: "5px 12px", borderRadius: 20, border: `1.5px solid ${active ? "#00C896" : C.border}`, background: active ? "rgba(0,200,150,0.08)" : "transparent", color: active ? "#00C896" : C.textMuted, fontWeight: 600, fontSize: 11, cursor: "pointer" }}>{p}</button>
                    );
                  })}
                </div>
              </div>

              <button onClick={generateDrafts} disabled={isGenerating || (!brief.trim() && files.length === 0)} style={{ width: "100%", padding: 14, background: (brief.trim() || files.length > 0) ? "#00C896" : C.border, color: (brief.trim() || files.length > 0) ? "#fff" : C.textMuted, border: "none", borderRadius: 12, fontWeight: 700, fontSize: 13, cursor: (brief.trim() || files.length > 0) ? "pointer" : "not-allowed" }}>
                {isGenerating ? "AI Writing Captions..." : "Generate AI Post Drafts →"}
              </button>
            </>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
              {drafts.map((d, index) => (
                <div key={d.platform} style={{ background: C.surface, border: `1px solid ${C.border}`, borderRadius: 14, overflow: "hidden", boxShadow: C.shadow }}>
                  <div style={{ padding: "10px 14px", borderBottom: `1px solid ${C.border}`, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                    <span style={{ fontWeight: 700, fontSize: 13 }}>{d.platform}</span>
                    <Badge platform={d.platform} />
                  </div>
                  <div style={{ padding: 14 }}>
                    <textarea value={d.caption} onChange={e => {
                      const updated = [...drafts];
                      updated[index].caption = e.target.value;
                      setDrafts(updated);
                    }} rows={3} style={{ width: "100%", border: "none", background: "transparent", color: C.text, fontSize: 13, outline: "none", resize: "none", fontFamily: "inherit", lineHeight: 1.5 }} />
                    <div style={{ marginTop: 8, display: "flex", flexWrap: "wrap", gap: 4 }}>
                      {d.hashtags?.map((t: string) => <span key={t} style={{ color: "#00C896", fontSize: 11, fontWeight: 600 }}>{t}</span>)}
                    </div>
                  </div>
                </div>
              ))}

              <div style={{ padding: 14, background: "rgba(0,200,150,0.06)", borderRadius: 12, border: "1px solid rgba(0,200,150,0.2)" }}>
                {approveDone ? (
                  <p style={{ margin: 0, textAlign: "center", color: "#00C896", fontWeight: 700, fontSize: 13 }}>✓ Post Approved & Sent to Queue</p>
                ) : (
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12 }}>
                    <div>
                      <p style={{ margin: 0, fontSize: 11, color: C.textMuted }}>Draft flat-fee charge</p>
                      <p style={{ margin: 0, fontSize: 15, fontWeight: 800, color: C.text }}>$100.00 AUD</p>
                    </div>
                    <button onClick={approveSocial} disabled={approving} style={{ padding: "10px 20px", background: "#00C896", color: "#fff", border: "none", borderRadius: 10, fontWeight: 700, fontSize: 12, cursor: "pointer" }}>
                      {approving ? "Approving..." : "Confirm & Schedule"}
                    </button>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      )}

      {subTab === "queue" && (
        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          {history.length === 0 ? (
            <p style={{ textAlign: "center", color: C.textMuted, fontSize: 13, padding: 32 }}>No posts scheduled or posted yet.</p>
          ) : history.map(post => (
            <div key={post.approvedAt || post.id} style={{ background: C.surface, border: `1px solid ${C.border}`, borderRadius: 14, padding: 14, boxShadow: C.shadow }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 6 }}>
                <span style={{ fontSize: 11, padding: "2px 7px", borderRadius: 4, background: "rgba(0,200,150,0.12)", color: "#00C896", fontWeight: 700 }}>Scheduled</span>
                <span style={{ fontSize: 11, color: C.textMuted }}>{formatDate(post.scheduledAt)}</span>
              </div>
              <p style={{ margin: 0, fontSize: 13, color: C.text, lineHeight: 1.5 }}>{post.caption}</p>
              <div style={{ display: "flex", gap: 4, flexWrap: "wrap", marginTop: 6 }}>
                {post.hashtags?.map((t: string) => <span key={t} style={{ color: "#00C896", fontSize: 11 }}>{t}</span>)}
              </div>
              <div style={{ borderTop: `1px solid ${C.border}`, marginTop: 10, paddingTop: 8, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <Badge platform={post.platform} />
                <span style={{ fontSize: 10, color: C.textMuted }}>Charge ID: {post.chargeId?.slice(0, 8)}</span>
              </div>
            </div>
          ))}
        </div>
      )}

      {subTab === "setup" && (
        <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
          {setupSubmitted ? (
            <div style={{ background: "rgba(0,200,150,0.06)", border: "1px solid rgba(0,200,150,0.2)", borderRadius: 12, padding: 16, textAlign: "center" }}>
              <p style={{ margin: 0, color: "#00C896", fontWeight: 700 }}>✓ Support request sent</p>
              <p style={{ margin: "4px 0 0", color: C.textSec, fontSize: 12 }}>Our operators will contact you shortly to complete the connection.</p>
            </div>
          ) : (
            <div style={{ background: C.surface, border: `1px solid ${C.border}`, borderRadius: 16, padding: 16, display: "flex", flexDirection: "column", gap: 12, boxShadow: C.shadow }}>
              <div>
                <p style={{ margin: 0, fontWeight: 700, fontSize: 14 }}>Connect Social Platforms</p>
                <p style={{ margin: "2px 0 0", fontSize: 12, color: C.textMuted }}>Provide platform usernames or request setup from scratch.</p>
              </div>

              <div style={{ display: "flex", background: C.raised, borderRadius: 10, padding: 3, border: `1px solid ${C.border}`, gap: 4 }}>
                <button onClick={() => setSocialSetupMode("link")} style={{ flex: 1, padding: 8, border: "none", borderRadius: 8, cursor: "pointer", fontSize: 11, fontWeight: 600, background: socialSetupMode === "link" ? "#00C896" : "transparent", color: socialSetupMode === "link" ? "#fff" : C.textMuted }}>Link Existing</button>
                <button onClick={() => setSocialSetupMode("create")} style={{ flex: 1, padding: 8, border: "none", borderRadius: 8, cursor: "pointer", fontSize: 11, fontWeight: 600, background: socialSetupMode === "create" ? "#00C896" : "transparent", color: socialSetupMode === "create" ? "#fff" : C.textMuted }}>Create New</button>
              </div>

              <textarea value={socialBrief} onChange={e => setSocialBrief(e.target.value)} rows={3} placeholder={socialSetupMode === "link" ? "e.g. Instagram handle is @zacks_builds, Facebook page link is..." : "e.g. Create new accounts for Facebook & Instagram, focus on custom builds in Newcastle..."} style={{ width: "100%", background: C.surface, border: `1.5px solid ${C.border}`, borderRadius: 10, padding: 10, color: C.text, fontSize: 13, outline: "none", resize: "none" }} />

              <button onClick={submitSetupBrief} style={{ padding: 12, background: "#00C896", color: "#fff", border: "none", borderRadius: 10, fontWeight: 700, fontSize: 12, cursor: "pointer" }}>Submit Connection Request</button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ── 4. Bookings Screen ──
function BookingsScreen({ slug, client, paymentStatus, C }: { slug: string; client: ClientData | null; paymentStatus: PaymentStatus | null; C: any }) {
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
  const useSuperSaas = !!(client?.supersaasId);

  useEffect(() => {
    loadBookings();
  }, []);

  async function loadBookings() {
    if (!client?.jobId) return;
    setLoading(true);
    try {
      if (useSuperSaas) {
        const res = await fetch(`/api/bookings/supersaas?slug=${slug}`);
        if (res.ok) {
          const d = await res.json();
          const mapped = (d.appointments || []).map((a: any) => ({
            bookingId: String(a.id),
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
    } catch {} finally { setLoading(false); }
  }

  async function doAction(bookingId: string, action: string, extra?: { reason?: string; newDate?: string; newTime?: string }) {
    setActing(bookingId);
    try {
      if (useSuperSaas) {
        let start: string | undefined, finish: string | undefined;
        if (action === "reschedule" && extra?.newDate && extra?.newTime) {
          start = extra.newDate + "T" + extra.newTime + ":00";
          const d = new Date(start);
          d.setHours(d.getHours() + 1);
          finish = d.toISOString().slice(0, 19);
        }
        const active = bookings.find(b => b.bookingId === bookingId);
        const res = await fetch(`/api/bookings/supersaas?slug=${slug}`, {
          method: "POST", headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            appointmentId: bookingId, action, start, finish, reason: extra?.reason, customerEmail: active?.visitorEmail, customerName: active?.visitorName
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
          body: JSON.stringify({ jobId: client?.jobId, bookingId, action, ...extra }),
        });
        if (res.ok) {
          const d = await res.json();
          setBookings(prev => prev.map(b => b.bookingId === bookingId ? d.booking : b));
        }
      }
    } finally { setActing(null); setModal(null); setActiveBooking(null); }
  }

  async function addBooking() {
    setActing("add");
    try {
      const res = await fetch(`/api/bookings/client?slug=${slug}`, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ jobId: client?.jobId, visitorName: addForm.name, visitorEmail: addForm.email, visitorPhone: addForm.phone, service: addForm.service, date: addForm.date, time: addForm.time, message: addForm.message }),
      });
      if (res.ok) {
        const d = await res.json();
        setBookings(prev => [d.booking, ...prev]);
        setAddForm({ name: "", email: "", phone: "", service: "", date: "", time: "", message: "" });
        setModal(null);
      }
    } finally { setActing(null); }
  }

  const filtered = bookings
    .filter(b => {
      if (bFilter === "upcoming") return b.date >= today && b.status !== "cancelled";
      if (bFilter === "past") return b.date < today || b.status === "cancelled";
      return true;
    })
    .filter(b => !bSearch || [b.visitorName, b.visitorEmail, b.service].join(" ").toLowerCase().includes(bSearch.toLowerCase()));

  const upcomingCount = bookings.filter(b => b.date >= today && b.status !== "cancelled").length;

  if (!paymentStatus?.previewUnlocked) {
    return (
      <div className="wg-fade" style={{ background: C.surface, border: `1px solid ${C.border}`, borderRadius: 16, textAlign: "center", padding: "48px 18px", boxShadow: C.shadow }}>
        <div style={{ fontSize: 36, marginBottom: 12 }}>🔒</div>
        <p style={{ margin: 0, fontWeight: 700, fontSize: 15, color: C.text }}>Bookings Panel locked</p>
        <p style={{ margin: "4px 0 0", fontSize: 12, color: C.textMuted }}>Bookings will become active after initial deposit verification.</p>
      </div>
    );
  }

  return (
    <div className="wg-fade" style={{ display: "flex", flexDirection: "column", gap: 14, paddingBottom: 24 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <div>
          <h2 style={{ fontSize: 20, fontWeight: 900, color: C.text, letterSpacing: "-0.4px" }}>Schedule Bookings</h2>
          <p style={{ margin: "2px 0 0", color: C.textSec, fontSize: 13 }}>Enquiries and appointments from your website.</p>
        </div>
        {!useSuperSaas && <button onClick={() => setModal("add")} style={{ padding: "8px 14px", border: "none", background: "#00C896", color: "#fff", fontWeight: 700, borderRadius: 10, fontSize: 12, cursor: "pointer" }}>+ Add</button>}
      </div>

      {/* Summary Row */}
      <div style={{ display: "flex", gap: 10 }}>
        <div style={{ flex: 1, background: C.surface, border: `1px solid ${C.border}`, borderRadius: 12, padding: 12, textAlign: "center" }}>
          <p style={{ margin: 0, fontSize: 18, fontWeight: 800, color: C.text }}>{bookings.length}</p>
          <p style={{ margin: "2px 0 0", fontSize: 10, color: C.textMuted }}>Total Booking Leads</p>
        </div>
        <div style={{ flex: 1, background: C.surface, border: `1px solid ${C.border}`, borderRadius: 12, padding: 12, textAlign: "center" }}>
          <p style={{ margin: 0, fontSize: 18, fontWeight: 800, color: "#00C896" }}>{upcomingCount}</p>
          <p style={{ margin: "2px 0 0", fontSize: 10, color: C.textMuted }}>Upcoming</p>
        </div>
      </div>

      <input type="text" placeholder="Search customer, service..." value={bSearch} onChange={e => setBSearch(e.target.value)} style={{ width: "100%", background: C.surface, border: `1.5px solid ${C.border}`, borderRadius: 12, padding: 10, color: C.text, fontSize: 13, outline: "none" }} />

      {/* Filters */}
      <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
        {(["upcoming", "past", "all"] as const).map(f => (
          <button key={f} onClick={() => setBFilter(f)} style={{ padding: "6px 14px", borderRadius: 20, border: `1.5px solid ${bFilter === f ? "#00C896" : C.border}`, background: bFilter === f ? "rgba(0,200,150,0.08)" : "transparent", color: bFilter === f ? "#00C896" : C.textMuted, fontWeight: 600, fontSize: 11, cursor: "pointer" }}>
            {f.charAt(0).toUpperCase() + f.slice(1)}
          </button>
        ))}
        <button onClick={loadBookings} style={{ marginLeft: "auto", background: "none", border: "none", color: "#00C896", fontSize: 12, fontWeight: 700, cursor: "pointer" }}>↻ Refresh</button>
      </div>

      {loading ? (
        <p style={{ textAlign: "center", padding: 24, fontSize: 12, color: C.textMuted }}>Loading schedules...</p>
      ) : filtered.length === 0 ? (
        <div style={{ background: C.surface, border: `1px solid ${C.border}`, borderRadius: 16, padding: "32px 14px", textAlign: "center", boxShadow: C.shadow }}>
          <p style={{ margin: 0, color: C.textMuted, fontSize: 13 }}>No matching bookings located.</p>
        </div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          {filtered.map(b => {
            const isDone = b.status === "cancelled" || b.status === "declined";
            return (
              <div key={b.bookingId} style={{ background: C.surface, border: `1px solid ${C.border}`, borderRadius: 14, padding: 14, opacity: isDone ? 0.5 : 1, boxShadow: C.shadow }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 6 }}>
                  <span style={{ fontWeight: 700, fontSize: 14 }}>{b.visitorName}</span>
                  <span style={{ fontSize: 10, padding: "2px 7px", borderRadius: 20, background: isDone ? C.border : "rgba(0,200,150,0.12)", color: isDone ? C.textMuted : "#00C896", fontWeight: 700 }}>{b.status}</span>
                </div>
                <p style={{ margin: 0, fontSize: 12, color: C.textSec }}>{b.service} · {formatDate(b.date)} at {b.time}</p>
                <p style={{ margin: "4px 0 0", fontSize: 11, color: C.textMuted }}>Email: {b.visitorEmail} · Tel: {b.visitorPhone}</p>
                {b.message && <p style={{ margin: "8px 0 0", background: C.raised, borderRadius: 8, padding: 8, fontSize: 12, color: C.textMuted }}>"{b.message}"</p>}
                
                {!isDone && (
                  <div style={{ display: "flex", gap: 8, marginTop: 10, borderTop: `1px solid ${C.border}`, paddingTop: 10 }}>
                    <button onClick={() => { setActiveBooking(b); setNewDate(b.date); setNewTime(b.time); setModal("reschedule"); }} style={{ flex: 1, padding: 7, borderRadius: 8, border: `1px solid ${C.border}`, background: C.surface, color: C.textSec, fontWeight: 700, fontSize: 11, cursor: "pointer" }}>Reschedule</button>
                    <button onClick={() => { setActiveBooking(b); setModal("cancel"); }} style={{ flex: 1, padding: 7, borderRadius: 8, border: "none", background: "rgba(239,68,68,0.06)", color: "#EF4444", fontWeight: 700, fontSize: 11, cursor: "pointer" }}>Cancel</button>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* Reschedule Modal */}
      {modal === "reschedule" && activeBooking && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.5)", display: "flex", alignItems: "center", justifyContent: "center", padding: 20, zIndex: 199 }}>
          <div style={{ background: C.surface, border: `1px solid ${C.border}`, borderRadius: 16, padding: 18, width: "100%", maxWidth: 360 }}>
            <p style={{ margin: "0 0 12px", fontWeight: 700, fontSize: 15 }}>Reschedule Booking</p>
            <input type="date" value={newDate} onChange={e => setNewDate(e.target.value)} style={{ width: "100%", background: C.surface, border: `1px solid ${C.border}`, borderRadius: 10, padding: 8, color: C.text, fontSize: 13, marginBottom: 10 }} />
            <input type="time" value={newTime} onChange={e => setNewTime(e.target.value)} style={{ width: "100%", background: C.surface, border: `1px solid ${C.border}`, borderRadius: 10, padding: 8, color: C.text, fontSize: 13, marginBottom: 14 }} />
            <div style={{ display: "flex", gap: 8 }}>
              <button onClick={() => setModal(null)} style={{ flex: 1, padding: 8, border: `1px solid ${C.border}`, background: "transparent", color: C.textMuted, borderRadius: 8, fontSize: 12 }}>Back</button>
              <button onClick={() => doAction(activeBooking.bookingId, "reschedule", { newDate, newTime })} style={{ flex: 1, padding: 8, border: "none", background: "#00C896", color: "#fff", borderRadius: 8, fontSize: 12, fontWeight: 700 }}>Confirm</button>
            </div>
          </div>
        </div>
      )}

      {/* Cancel Modal */}
      {modal === "cancel" && activeBooking && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.5)", display: "flex", alignItems: "center", justifyContent: "center", padding: 20, zIndex: 199 }}>
          <div style={{ background: C.surface, border: `1px solid ${C.border}`, borderRadius: 16, padding: 18, width: "100%", maxWidth: 360 }}>
            <p style={{ margin: "0 0 10px", fontWeight: 700, fontSize: 15 }}>Cancel Booking</p>
            <textarea value={modalReason} onChange={e => setModalReason(e.target.value)} placeholder="Reason for cancellation (will be emailed to user)" rows={3} style={{ width: "100%", background: C.surface, border: `1px solid ${C.border}`, borderRadius: 10, padding: 8, color: C.text, fontSize: 13, resize: "none", outline: "none", marginBottom: 14 }} />
            <div style={{ display: "flex", gap: 8 }}>
              <button onClick={() => setModal(null)} style={{ flex: 1, padding: 8, border: `1px solid ${C.border}`, background: "transparent", color: C.textMuted, borderRadius: 8, fontSize: 12 }}>Back</button>
              <button onClick={() => doAction(activeBooking.bookingId, "cancel", { reason: modalReason })} style={{ flex: 1, padding: 8, border: "none", background: "#EF4444", color: "#fff", borderRadius: 8, fontSize: 12, fontWeight: 700 }}>Cancel Booking</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ── 5. Billing Screen ──
function BillingScreen({ slug, client, paymentStatus, C }: { slug: string; client: ClientData | null; paymentStatus: PaymentStatus | null; C: any }) {
  const [termsAccepted, setTermsAccepted] = useState(false);
  const [payLoading, setPayLoading] = useState<string | null>(null);

  const due = paymentStatus?.depositPaid ? (paymentStatus.finalPaid ? 0 : (paymentStatus.quote?.final || 100)) : (paymentStatus?.quote?.deposit || 100);
  const total = (paymentStatus?.quote?.total || 100) + (paymentStatus?.finalPaid ? (paymentStatus.quote?.final || 100) : 0);

  async function handlePay(stage: "deposit" | "final" | "monthly") {
    if (!termsAccepted) { alert("Please accept the terms of service first."); return; }
    setPayLoading(stage);
    try {
      const res = await fetch(`/api/payment/create?slug=${slug}&stage=${stage}`);
      const data = await res.json();
      if (data.url) window.location.href = data.url;
      else alert("Payment URL generation failed. Contact support.");
    } catch {
      alert("Error reaching billing endpoint.");
    } finally { setPayLoading(null); }
  }

  const invoices = [
    { id: "INV-002", label: "Project Setup & Deposit", amount: paymentStatus?.quote?.deposit || 100, status: paymentStatus?.depositPaid ? "paid" : "due", stage: "deposit" },
    paymentStatus?.depositPaid && { id: "INV-003", label: "Final Build & Hands-on Deliverables", amount: paymentStatus?.quote?.final || 100, status: paymentStatus?.finalPaid ? "paid" : "due", stage: "final" }
  ].filter(Boolean);

  return (
    <div className="wg-fade" style={{ display: "flex", flexDirection: "column", gap: 14, paddingBottom: 24 }}>
      <div>
        <h2 style={{ fontSize: 20, fontWeight: 900, color: C.text, letterSpacing: "-0.4px" }}>Billing & Invoices</h2>
        <p style={{ margin: "2px 0 0", color: C.textSec, fontSize: 13 }}>Verify payment history and accept quote terms.</p>
      </div>

      <div style={{ display: "flex", gap: 10 }}>
        <div style={{ flex: 1, background: due > 0 ? "#0F1117" : C.surface, border: `1px solid ${due > 0 ? "transparent" : C.border}`, borderRadius: 16, padding: 14, boxShadow: C.shadow }}>
          <p style={{ margin: 0, color: due > 0 ? "rgba(255,255,255,0.4)" : C.textMuted, fontSize: 11, fontWeight: 600 }}>Outstanding Balance</p>
          <p style={{ margin: "2px 0 0", fontSize: 24, fontWeight: 900, color: due > 0 ? "#fff" : C.text }}>${due}</p>
        </div>
        <div style={{ flex: 1, background: C.surface, border: `1px solid ${C.border}`, borderRadius: 16, padding: 14, boxShadow: C.shadow }}>
          <p style={{ margin: 0, color: C.textMuted, fontSize: 11, fontWeight: 600 }}>Total spent</p>
          <p style={{ margin: "2px 0 0", fontSize: 24, fontWeight: 900, color: C.text }}>${total}</p>
        </div>
      </div>

      {due > 0 && (
        <div style={{ background: C.surface, border: `1px solid ${C.border}`, borderRadius: 16, padding: 16, display: "flex", flexDirection: "column", gap: 12, boxShadow: C.shadow }}>
          <div style={{ display: "flex", gap: 10, alignItems: "flex-start" }}>
            <input type="checkbox" checked={termsAccepted} onChange={e => setTermsAccepted(e.target.checked)} style={{ width: 18, height: 18, accentColor: "#00C896", cursor: "pointer", marginTop: 2 }} />
            <label style={{ fontSize: 12, color: C.textSec, lineHeight: 1.5 }}>
              I accept the <a href="/legal/terms" target="_blank" style={{ color: "#00C896", textDecoration: "none", fontWeight: 600 }}>Terms of Service</a>, <a href="/legal/privacy" target="_blank" style={{ color: "#00C896", textDecoration: "none", fontWeight: 600 }}>Privacy Policy</a>, and <a href="/legal/refunds" target="_blank" style={{ color: "#00C896", textDecoration: "none", fontWeight: 600 }}>Refund Policy</a>.
            </label>
          </div>
          <button onClick={() => handlePay(paymentStatus?.depositPaid ? "final" : "deposit")} disabled={payLoading !== null} style={{ width: "100%", padding: 14, border: "none", borderRadius: 12, background: "linear-gradient(135deg, #00C896, #00d4a0)", color: "#fff", fontWeight: 700, fontSize: 13, cursor: "pointer", boxShadow: "0 3px 10px rgba(0,200,150,0.25)" }}>
            {payLoading ? "Connecting Secure Gate..." : `Pay Outstanding $${due} AUD`}
          </button>
        </div>
      )}

      <div>
        <p style={{ margin: "0 0 10px", fontWeight: 700, fontSize: 13, color: C.textSec }}>Billing History</p>
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          {invoices.map((inv: any) => (
            <div key={inv.id} style={{ background: C.surface, border: `1px solid ${C.border}`, borderRadius: 14, padding: 14, display: "flex", alignItems: "center", gap: 12, boxShadow: C.shadow }}>
              <div style={{ width: 38, height: 38, borderRadius: 10, background: inv.status === "paid" ? C.raised : "rgba(0,200,150,0.08)", display: "flex", alignItems: "center", justifyContent: "center" }}>
                <Ico d={inv.status === "paid" ? ic.check : ic.dollar} size={16} color={inv.status === "paid" ? C.textMuted : "#00C896"} />
              </div>
              <div style={{ flex: 1 }}>
                <p style={{ margin: 0, fontSize: 13, fontWeight: 700, color: C.text }}>{inv.label}</p>
                <p style={{ margin: 0, fontSize: 11, color: C.textMuted }}>Ref ID: {inv.id}</p>
              </div>
              <div style={{ textAlign: "right" }}>
                <p style={{ margin: 0, fontSize: 14, fontWeight: 800, color: C.text }}>${inv.amount}</p>
                <span style={{ fontSize: 9, fontWeight: 700, color: inv.status === "paid" ? C.textMuted : "#00C896", background: inv.status === "paid" ? C.raised : "rgba(0,200,150,0.1)", padding: "2px 6px", borderRadius: 4 }}>{inv.status}</span>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

// ── 6. Account Screen ──
function AccountScreen({ slug, client, onSignOut, C }: { slug: string; client: ClientData | null; onSignOut: () => void; C: any }) {
  const [subTab, setSubTab] = useState<"profile" | "upgrades" | "support">("profile");

  // Profile Edit
  const [profile, setProfile] = useState({ name: "", email: "", phone: "", address: "", abn: "", domain: "", ga4Id: "" });
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [savedOk, setSavedOk] = useState(false);

  // Feature request
  const [upgrades, setUpgrades] = useState<string[]>([]);
  const [upgradeMsg, setUpgradeMsg] = useState("");
  const [upgradeDone, setUpgradeDone] = useState(false);

  // Support
  const [msgText, setMsgText] = useState("");
  const [msgDone, setMsgDone] = useState(false);

  useEffect(() => {
    if (client) {
      setProfile({
        name: client.businessName || "",
        email: client.email || "",
        phone: client.phone || "",
        address: client.businessAddress || "",
        abn: client.abn || "",
        domain: client.domain || "",
        ga4Id: client.ga4Id || "",
      });
    }
  }, [client]);

  async function saveProfile() {
    setSaving(true);
    try {
      await fetch("/api/client-login", {
        method: "PATCH",
        headers: { "Content-Type": "application/json", "x-client-slug": slug },
        body: JSON.stringify({ abn: profile.abn, businessAddress: profile.address, preferredDomain: profile.domain, ga4Id: profile.ga4Id }),
      });
      setSavedOk(true);
      setTimeout(() => { setSavedOk(false); setEditing(false); }, 900);
    } catch {} finally { setSaving(false); }
  }

  async function submitUpgrade() {
    try {
      await fetch("/api/feature-requests", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ slug, featureIds: upgrades, message: upgradeMsg })
      });
      setUpgradeDone(true);
      setTimeout(() => { setUpgradeDone(false); setUpgrades([]); setUpgradeMsg(""); }, 2000);
    } catch {}
  }

  async function sendSupport() {
    if (!msgText.trim()) return;
    try {
      await fetch("/api/contact", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ slug, topics: ["Support Ticket"], details: msgText })
      });
      setMsgDone(true);
      setMsgText("");
      setTimeout(() => setMsgDone(false), 2500);
    } catch {}
  }

  const inpSt = { width: "100%", background: C.raised, border: `1.5px solid ${C.border}`, borderRadius: 10, padding: 10, color: C.text, fontSize: 13, outline: "none", boxSizing: "border-box" as const };

  return (
    <div className="wg-fade" style={{ display: "flex", flexDirection: "column", gap: 16, paddingBottom: 24 }}>
      <div style={{ textAlign: "center", padding: "12px 0 0" }}>
        <div style={{ width: 62, height: 62, borderRadius: "50%", background: "#00C896", display: "flex", alignItems: "center", justifyContent: "center", margin: "0 auto 8px" }}>
          <Ico d={ic.user} size={28} color="#000" />
        </div>
        <p style={{ margin: 0, fontWeight: 900, fontSize: 16, color: C.text }}>{profile.name}</p>
        <p style={{ margin: "2px 0 0", fontSize: 11, color: C.textMuted }}>Job Ref: {client?.jobId?.slice(0, 10)}</p>
      </div>

      {/* Internal Mini Tabbar */}
      <div style={{ display: "flex", background: C.raised, borderRadius: 12, padding: 3, border: `1px solid ${C.border}`, gap: 4 }}>
        {[
          { id: "profile", label: "Profile Settings" },
          { id: "upgrades", label: "Request Upgrades" },
          { id: "support", label: "Support Desk" },
        ].map(t => (
          <button key={t.id} onClick={() => setSubTab(t.id as any)} style={{ flex: 1, padding: 8, border: "none", borderRadius: 9, cursor: "pointer", fontSize: 11, fontWeight: subTab === t.id ? 700 : 500, background: subTab === t.id ? "#00C896" : "transparent", color: subTab === t.id ? "#fff" : C.textMuted, fontFamily: "inherit" }}>
            {t.label}
          </button>
        ))}
      </div>

      {subTab === "profile" && (
        <div style={{ background: C.surface, border: `1px solid ${C.border}`, borderRadius: 16, padding: 16, display: "flex", flexDirection: "column", gap: 12, boxShadow: C.shadow }}>
          {!editing ? (
            <>
              {[
                { label: "Business Name", val: profile.name },
                { label: "Phone", val: profile.phone || "Not set" },
                { label: "ABN ID", val: profile.abn || "Not set" },
                { label: "Preferred Domain", val: profile.domain || "Not set" },
                { label: "Google Analytics 4 ID", val: profile.ga4Id || "Not set" },
              ].map(f => (
                <div key={f.label} style={{ display: "flex", justifyContent: "space-between", borderBottom: `1px solid ${C.border}`, paddingBottom: 8 }}>
                  <span style={{ fontSize: 12, color: C.textMuted }}>{f.label}</span>
                  <span style={{ fontSize: 12, color: C.text, fontWeight: 600 }}>{f.val}</span>
                </div>
              ))}
              <button onClick={() => setEditing(true)} style={{ width: "100%", padding: 10, background: "transparent", border: `1.5px solid ${C.border}`, borderRadius: 10, color: C.text, fontWeight: 700, fontSize: 12, cursor: "pointer" }}>Edit Business Details</button>
            </>
          ) : (
            <>
              {[
                { label: "Registered ABN ID", key: "abn" },
                { label: "Preferred Custom Domain", key: "domain" },
                { label: "Registered Business Address", key: "address" },
                { label: "Google Analytics GA4 ID", key: "ga4Id" },
              ].map(f => (
                <div key={f.key}>
                  <label style={{ fontSize: 11, color: C.textMuted, fontWeight: 600, display: "block", marginBottom: 4 }}>{f.label}</label>
                  <input value={profile[f.key as keyof typeof profile]} onChange={e => setProfile({ ...profile, [f.key]: e.target.value })} style={inpSt} />
                </div>
              ))}
              <div style={{ display: "flex", gap: 8, marginTop: 8 }}>
                <button onClick={() => setEditing(false)} style={{ flex: 1, padding: 10, borderRadius: 10, border: `1px solid ${C.border}`, background: "transparent", color: C.textMuted, fontWeight: 600, fontSize: 12, cursor: "pointer" }}>Cancel</button>
                <button onClick={saveProfile} style={{ flex: 1, padding: 10, borderRadius: 10, border: "none", background: savedOk ? C.accent : "#00C896", color: "#fff", fontWeight: 700, fontSize: 12, cursor: "pointer" }}>
                  {saving ? "Saving..." : savedOk ? "✓ Saved" : "Save Changes"}
                </button>
              </div>
            </>
          )}
          <button onClick={onSignOut} style={{ width: "100%", padding: 10, border: "1px solid rgba(239,68,68,0.25)", background: "rgba(239,68,68,0.04)", borderRadius: 10, color: "#EF4444", fontWeight: 700, fontSize: 12, cursor: "pointer" }}>Sign Out from Portal</button>
        </div>
      )}

      {subTab === "upgrades" && (
        <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
          {upgradeDone ? (
            <div style={{ background: "rgba(0,200,150,0.06)", border: "1px solid rgba(0,200,150,0.2)", borderRadius: 12, padding: 16, textAlign: "center" }}>
              <p style={{ margin: 0, color: "#00C896", fontWeight: 700 }}>✓ Upgrade enquiry submitted</p>
              <p style={{ margin: "2px 0 0", color: C.textMuted, fontSize: 11 }}>We'll send setup steps directly to your email.</p>
            </div>
          ) : (
            <div style={{ background: C.surface, border: `1px solid ${C.border}`, borderRadius: 16, padding: 16, display: "flex", flexDirection: "column", gap: 12, boxShadow: C.shadow }}>
              <p style={{ margin: 0, fontWeight: 700, fontSize: 14 }}>Select Features to Request</p>
              
              {[
                { id: "booking", name: "SuperSaas Integrated Bookings", price: "$199 setup + $20/mo" },
                { id: "shop", name: "E-Commerce Payment & Catalog Shop", price: "$399 setup + $30/mo" },
                { id: "growth", name: "Growth Marketing Bundle (Newsletter, Chat)", price: "$149 setup" },
              ].map(feat => {
                const sel = upgrades.includes(feat.id);
                return (
                  <div key={feat.id} onClick={() => setUpgrades(prev => sel ? prev.filter(x => x !== feat.id) : [...prev, feat.id])} style={{ padding: 12, border: `1.5px solid ${sel ? "#00C896" : C.border}`, background: sel ? "rgba(0,200,150,0.04)" : "transparent", borderRadius: 10, cursor: "pointer", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                    <div>
                      <p style={{ margin: 0, fontSize: 12, fontWeight: 700, color: C.text }}>{feat.name}</p>
                      <p style={{ margin: 0, fontSize: 10, color: C.textMuted }}>{feat.price}</p>
                    </div>
                    <div style={{ width: 18, height: 18, borderRadius: 4, border: `1.5px solid ${sel ? "#00C896" : C.border}`, display: "flex", alignItems: "center", justifyContent: "center", background: sel ? "#00C896" : "transparent" }}>
                      {sel && <Ico d={ic.check} size={12} color="#fff" sw={3} />}
                    </div>
                  </div>
                );
              })}

              <textarea value={upgradeMsg} onChange={e => setUpgradeMsg(e.target.value)} rows={3} placeholder="Add any special instructions or requirements..." style={{ width: "100%", background: C.raised, border: `1.5px solid ${C.border}`, borderRadius: 10, padding: 10, color: C.text, fontSize: 13, outline: "none", resize: "none" }} />

              <button onClick={submitUpgrade} disabled={upgrades.length === 0} style={{ padding: 12, background: upgrades.length > 0 ? "#00C896" : C.border, color: upgrades.length > 0 ? "#fff" : C.textMuted, border: "none", borderRadius: 10, fontWeight: 700, fontSize: 12, cursor: upgrades.length > 0 ? "pointer" : "not-allowed" }}>
                Submit Upgrade Request
              </button>
            </div>
          )}
        </div>
      )}

      {subTab === "support" && (
        <div style={{ background: C.surface, border: `1px solid ${C.border}`, borderRadius: 16, padding: 16, display: "flex", flexDirection: "column", gap: 12, boxShadow: C.shadow }}>
          <div>
            <p style={{ margin: 0, fontWeight: 700, fontSize: 14 }}>Submit Support Message</p>
            <p style={{ margin: "2px 0 0", fontSize: 12, color: C.textMuted }}>Direct message to operators. Responses typically take &lt; 24h.</p>
          </div>

          {msgDone ? (
            <div style={{ background: "rgba(0,200,150,0.06)", border: "1px solid rgba(0,200,150,0.2)", borderRadius: 10, padding: 12, textAlign: "center" }}>
              <p style={{ margin: 0, color: "#00C896", fontWeight: 700, fontSize: 13 }}>✓ Support ticket submitted</p>
            </div>
          ) : (
            <>
              <textarea value={msgText} onChange={e => setMsgText(e.target.value)} rows={4} placeholder="Describe your question or issue in detail..." style={{ width: "100%", background: C.raised, border: `1.5px solid ${C.border}`, borderRadius: 10, padding: 10, color: C.text, fontSize: 13, outline: "none", resize: "none" }} />
              <button onClick={sendSupport} disabled={!msgText.trim()} style={{ padding: 12, background: msgText.trim() ? "#00C896" : C.border, color: msgText.trim() ? "#fff" : C.textMuted, border: "none", borderRadius: 10, fontWeight: 700, fontSize: 12, cursor: msgText.trim() ? "pointer" : "not-allowed" }}>
                Send Message
              </button>
            </>
          )}

          <div style={{ borderTop: `1px solid ${C.border}`, paddingTop: 12, display: "flex", flexDirection: "column", gap: 8 }}>
            <p style={{ margin: 0, fontSize: 11, color: C.textMuted, fontWeight: 600 }}>Emergency Contact</p>
            <p style={{ margin: 0, fontSize: 12 }}>Email: <a href="mailto:hello@webgecko.com.au" style={{ color: "#00C896", textDecoration: "none", fontWeight: 600 }}>hello@webgecko.com.au</a></p>
            <p style={{ margin: 0, fontSize: 12 }}>Phone: <a href="tel:+61400000000" style={{ color: C.textSec, textDecoration: "none", fontWeight: 600 }}>+61 400 000 000</a></p>
          </div>
        </div>
      )}
    </div>
  );
}

// ── 7. Sign In Screen ──
function SignIn({ onSignIn, C }: { onSignIn: (slug: string) => void; C: any }) {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault();
    setError(""); setLoading(true);
    try {
      const res = await fetch("/api/client-login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username: username.trim(), password: password.trim() }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Incorrect login credentials");
      
      localStorage.setItem("wg_app_slug", data.slug);
      onSignIn(data.slug);
    } catch (err: any) {
      setError(err.message || "Failed to authenticate.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="wg-fade" style={{ display: "flex", flexDirection: "column", flex: 1, justifyContent: "center", padding: "40px 24px", background: C.bg }}>
      <div style={{ textAlign: "center", marginBottom: 32 }}>
        <div style={{ width: 72, height: 72, borderRadius: 20, background: "#0F1117", display: "flex", alignItems: "center", justifyContent: "center", margin: "0 auto 16px", boxShadow: "0 8px 24px rgba(0,200,150,0.15)" }}>
          <GeckoMark size={48} color="#00C896" />
        </div>
        <h1 style={{ fontFamily: "'Outfit', sans-serif", fontSize: 24, fontWeight: 900, color: C.text, letterSpacing: "-0.5px" }}>
          <span style={{ color: "#00C896" }}>WEB</span>GECKO
        </h1>
        <p style={{ margin: "4px 0 0", color: C.textMuted, fontSize: 13 }}>Simplistic Mobile Portal App</p>
      </div>

      <form onSubmit={handleLogin} style={{ display: "flex", flexDirection: "column", gap: 16 }}>
        {error && (
          <div style={{ background: `${C.red}12`, border: `1px solid ${C.red}33`, borderRadius: 10, padding: 10, color: C.red, fontSize: 12 }}>
            ✗ {error}
          </div>
        )}

        <div>
          <label style={{ display: "block", fontSize: 11, fontWeight: 700, color: C.textMuted, textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 6 }}>Username / Business Slug</label>
          <input type="text" required value={username} onChange={e => setUsername(e.target.value)} placeholder="your-business-name" style={{ width: "100%", background: C.surface, border: `1.5px solid ${C.border}`, borderRadius: 10, padding: 12, color: C.text, fontSize: 13, outline: "none" }} />
        </div>

        <div>
          <label style={{ display: "block", fontSize: 11, fontWeight: 700, color: C.textMuted, textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 6 }}>Password</label>
          <input type="password" required value={password} onChange={e => setPassword(e.target.value)} placeholder="••••••••" style={{ width: "100%", background: C.surface, border: `1.5px solid ${C.border}`, borderRadius: 10, padding: 12, color: C.text, fontSize: 13, outline: "none" }} />
        </div>

        <button type="submit" disabled={loading} style={{ width: "100%", padding: 14, background: "linear-gradient(135deg, #00C896, #00d4a0)", color: "#fff", border: "none", borderRadius: 12, fontWeight: 700, fontSize: 13, cursor: "pointer", boxShadow: "0 3px 10px rgba(0,200,150,0.2)", marginTop: 8 }}>
          {loading ? "Authenticating..." : "Sign In →"}
        </button>
      </form>
    </div>
  );
}

// ─── Main Portal Root ─────────────────────────────────────────────────────────
export default function SocialApp() {
  const [authed, setAuthed] = useState(false);
  const [slug, setSlug] = useState("");
  const [client, setClient] = useState<ClientData | null>(null);
  const [paymentStatus, setPaymentStatus] = useState<PaymentStatus | null>(null);
  const [activeTab, setActiveTab] = useState<"home" | "website" | "socials" | "bookings" | "billing" | "account">("home");

  // Dynamic Theme (Light / Dark)
  const [dark, setDark] = useState<boolean>(false);
  useEffect(() => {
    const stored = localStorage.getItem("wg_app_theme");
    setDark(stored === "dark");
  }, []);

  function toggleTheme() {
    const next = !dark;
    setDark(next);
    localStorage.setItem("wg_app_theme", next ? "dark" : "light");
  }

  const C = dark ? DARK : LIGHT;

  // Session loader
  useEffect(() => {
    const saved = localStorage.getItem("wg_app_slug");
    if (saved) {
      setSlug(saved);
      setAuthed(true);
      loadDashboardData(saved);
    }
  }, []);

  async function loadDashboardData(cSlug: string) {
    try {
      const res = await fetch(`/api/client-login?slug=${cSlug}`);
      if (!res.ok) {
        localStorage.removeItem("wg_app_slug");
        setAuthed(false);
        return;
      }
      const raw = await res.json();
      setClient(normalizeClient(raw));

      // Fetch payment
      const pRes = await fetch(`/api/payment/status?slug=${cSlug}`);
      if (pRes.ok) setPaymentStatus(await pRes.json());
    } catch {}
  }

  function handleLoginSuccess(cSlug: string) {
    setSlug(cSlug);
    setAuthed(true);
    loadDashboardData(cSlug);
  }

  function handleSignOut() {
    localStorage.removeItem("wg_app_slug");
    setAuthed(false);
    setClient(null);
    setPaymentStatus(null);
  }

  if (!authed) {
    return (
      <div style={{ width: "100%", maxWidth: 430, margin: "0 auto", minHeight: "100vh", display: "flex", flexDirection: "column", background: C.bg }}>
        <style>{CSS}</style>
        <SignIn onSignIn={handleLoginSuccess} C={C} />
      </div>
    );
  }

  const screenMap = {
    home:     <DashboardScreen client={client} paymentStatus={paymentStatus} onNav={setActiveTab} C={C} />,
    website:  <WebsiteScreen client={client} C={C} />,
    socials:  <SocialsScreen client={client} C={C} />,
    bookings: <BookingsScreen slug={slug} client={client} paymentStatus={paymentStatus} C={C} />,
    billing:  <BillingScreen slug={slug} client={client} paymentStatus={paymentStatus} C={C} />,
    account:  <AccountScreen slug={slug} client={client} onSignOut={handleSignOut} C={C} />,
  };

  return (
    <div style={{ width: "100%", maxWidth: 430, margin: "0 auto", minHeight: "100vh", display: "flex", flexDirection: "column", background: C.bg, position: "relative", boxShadow: "0 0 20px rgba(0,0,0,0.05)" }}>
      <style>{CSS}</style>

      {/* Sticky Header */}
      <div style={{ padding: "12px 20px", display: "flex", justifyContent: "space-between", alignItems: "center", borderBottom: `1px solid ${C.border}`, background: C.surface, position: "sticky", top: 0, zIndex: 90 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <div style={{ width: 30, height: 30, borderRadius: 9, background: "#0F1117", display: "flex", alignItems: "center", justifyContent: "center" }}>
            <GeckoMark size={22} color="#00C896" />
          </div>
          <span style={{ fontWeight: 900, fontSize: 16, letterSpacing: "-0.4px", color: C.text }}>
            <span style={{ color: "#00C896" }}>WEB</span>GECKO
          </span>
        </div>
        <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
          {/* Theme switcher */}
          <button onClick={toggleTheme} style={{ background: "none", border: "none", cursor: "pointer", padding: 4, display: "flex", alignItems: "center" }}>
            <Ico d={dark ? ic.sun : ic.moon} size={20} color={C.text} />
          </button>
        </div>
      </div>

      {/* Main Body */}
      <div style={{ flex: 1, padding: "18px 18px 84px", overflowY: "auto" }}>
        {screenMap[activeTab]}
      </div>

      {/* Sticky Bottom Nav Bar */}
      <nav style={{ position: "fixed", bottom: 0, left: "50%", transform: "translateX(-50%)", width: "100%", maxWidth: 430, background: C.surface, borderTop: `1px solid ${C.border}`, paddingBottom: "env(safe-area-inset-bottom, 8px)", zIndex: 95, display: "flex" }}>
        {[
          { id: "home",     label: "Home",     icon: ic.home },
          { id: "website",  label: "Preview",  icon: ic.globe },
          { id: "socials",  label: "Socials",  icon: ic.send },
          { id: "bookings", label: "Bookings", icon: ic.cal },
          { id: "billing",  label: "Billing",  icon: ic.dollar },
          { id: "account",  label: "Settings",  icon: ic.user },
        ].map(t => {
          const on = activeTab === t.id;
          return (
            <button key={t.id} onClick={() => setActiveTab(t.id as any)} style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", gap: 3, padding: "10px 0", border: "none", background: "transparent", cursor: "pointer", fontFamily: "inherit" }}>
              <Ico d={t.icon} size={20} color={on ? "#00C896" : C.textMuted} sw={on ? 2.2 : 1.8} />
              <span style={{ fontSize: 9, fontWeight: on ? 700 : 400, color: on ? "#00C896" : C.textMuted }}>{t.label}</span>
            </button>
          );
        })}
      </nav>
    </div>
  );
}
