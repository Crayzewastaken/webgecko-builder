"use client";
import { useState, useEffect, useRef } from "react";
import { supabasePublic } from "@/lib/supabase";

// ─────────────────────────────────────────────────────────────
//  DESIGN TOKENS  (exact match to reference)
// ─────────────────────────────────────────────────────────────
const G    = "#00C896";   // green accent
const BG   = "#F7F8FA";   // app background
const CARD = "#FFFFFF";   // card surface
const LINE = "#EAECF2";   // borders / dividers
const INK  = "#111827";   // primary text
const DIM  = "#6B7280";   // secondary text
const DARK = "#0F1117";   // dark contrast sections

// ─────────────────────────────────────────────────────────────
//  GLOBAL CSS
// ─────────────────────────────────────────────────────────────
const CSS = `
  @import url('https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700;800;900&display=swap');
  *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
  html, body { height: 100%; }
  body { background: ${BG}; font-family: 'Inter', -apple-system, sans-serif; color: ${INK}; min-height: 100vh; overflow-x: hidden; -webkit-font-smoothing: antialiased; }

  /* Shell */
  .shell {
    max-width: 430px; margin: 0 auto; min-height: 100vh;
    display: flex; flex-direction: column;
    background: ${BG};
  }
  @media (min-width: 600px) {
    .shell { border-left: 1px solid ${LINE}; border-right: 1px solid ${LINE}; }
    body { background: #EDEEF2; }
  }

  /* Header */
  .hdr {
    position: sticky; top: 0; z-index: 50;
    background: rgba(247,248,250,0.92);
    backdrop-filter: blur(14px); -webkit-backdrop-filter: blur(14px);
    border-bottom: 1px solid ${LINE};
    padding: 12px 20px;
    display: flex; align-items: center; justify-content: space-between;
  }

  /* Scroll */
  .scroll { flex: 1; overflow-y: auto; padding: 20px 18px 92px; }
  .scroll::-webkit-scrollbar { display: none; }

  /* Bottom nav */
  .bnav {
    position: fixed; bottom: 0; left: 50%; transform: translateX(-50%);
    width: 100%; max-width: 430px; z-index: 50;
    background: rgba(255,255,255,0.96);
    backdrop-filter: blur(14px); -webkit-backdrop-filter: blur(14px);
    border-top: 1px solid ${LINE};
    display: flex; padding: 8px 0 max(10px, env(safe-area-inset-bottom));
  }
  .nbtn {
    flex: 1; display: flex; flex-direction: column; align-items: center; gap: 3px;
    background: none; border: none; cursor: pointer; padding: 4px 2px;
    font-family: inherit; color: ${DIM}; transition: color .15s;
    -webkit-tap-highlight-color: transparent;
    position: relative;
  }
  .nbtn.on { color: ${G}; }
  .nbtn-icon { font-size: 20px; line-height: 1; }
  .nbtn-lbl { font-size: 9px; font-weight: 700; letter-spacing: .02em; }
  .nbtn-lock { position: absolute; top: 2px; right: calc(50% - 18px); font-size: 8px; }

  /* Card */
  .card { background: ${CARD}; border-radius: 16px; border: 1px solid ${LINE}; }

  /* Inputs */
  .inp {
    width: 100%; background: ${BG}; border: 1.5px solid ${LINE};
    border-radius: 12px; padding: 11px 14px; color: ${INK};
    font-size: 14px; font-family: inherit; transition: border-color .2s;
    outline: none;
  }
  .inp:focus { border-color: ${G}; }

  /* Buttons */
  .btn-primary {
    width: 100%; padding: 15px 0; border-radius: 14px; border: none;
    background: ${G}; color: #fff; font-weight: 700; font-size: 15px;
    cursor: pointer; font-family: inherit;
    box-shadow: 0 4px 14px ${G}30; transition: opacity .15s, transform .1s;
    -webkit-tap-highlight-color: transparent;
  }
  .btn-primary:active:not(:disabled) { transform: scale(.98); }
  .btn-primary:disabled { background: ${LINE}; color: ${DIM}; box-shadow: none; cursor: not-allowed; }
  .btn-ghost {
    width: 100%; padding: 14px 0; border-radius: 14px;
    border: 1.5px solid ${LINE}; background: transparent;
    color: ${INK}; font-weight: 600; font-size: 15px;
    cursor: pointer; font-family: inherit; transition: background .15s;
  }
  .btn-ghost:hover { background: ${BG}; }
  .btn-danger {
    width: 100%; padding: 13px 0; border-radius: 14px;
    border: 1px solid rgba(239,68,68,.25); background: rgba(239,68,68,.05);
    color: #EF4444; font-weight: 600; font-size: 14px;
    cursor: pointer; font-family: inherit;
  }
  .btn-sm {
    padding: 8px 16px; border-radius: 10px; font-size: 13px;
    font-weight: 700; cursor: pointer; font-family: inherit; border: none;
    background: ${G}; color: #fff; transition: opacity .15s;
    -webkit-tap-highlight-color: transparent;
  }
  .btn-sm-outline {
    padding: 8px 16px; border-radius: 10px; font-size: 13px;
    font-weight: 600; cursor: pointer; font-family: inherit;
    border: 1px solid ${LINE}; background: transparent; color: ${DIM};
  }

  /* Status chips */
  .chip { display: inline-flex; align-items: center; padding: 3px 9px; border-radius: 20px; font-size: 11px; font-weight: 700; }
  .chip-green  { color: ${G};      background: ${G}15; }
  .chip-amber  { color: #F59E0B;   background: #FEF9EC; }
  .chip-grey   { color: ${DIM};    background: ${LINE}; }
  .chip-purple { color: #8B5CF6;   background: #F5F3FF; }

  /* Platform badge */
  .plat-badge { font-size: 11px; font-weight: 700; padding: 3px 8px; border-radius: 6px; }

  /* Pill filters */
  .pill { padding: 6px 14px; border-radius: 20px; font-size: 13px; font-weight: 500; cursor: pointer; border: 1.5px solid ${LINE}; background: transparent; color: ${DIM}; white-space: nowrap; font-family: inherit; transition: all .15s; }
  .pill.on { border-color: ${G}; background: ${G}12; color: ${G}; font-weight: 700; }

  /* Fade */
  .fade { animation: fd .25s ease both; }
  @keyframes fd { from { opacity: 0; transform: translateY(8px); } to { opacity: 1; transform: translateY(0); } }
  @keyframes spin { to { transform: rotate(360deg); } }
  .spin { animation: spin 1s linear infinite; }

  /* Rec pulse */
  .rec-pulse { animation: rp 1.4s infinite; }
  @keyframes rp { 0% { box-shadow: 0 0 0 0 rgba(239,68,68,.4); } 70% { box-shadow: 0 0 0 12px rgba(239,68,68,0); } 100% { box-shadow: 0 0 0 0 rgba(239,68,68,0); } }

  /* Vbars */
  .vbar { width: 3px; height: 5px; background: ${G}; border-radius: 2px; transition: height .08s ease; }

  /* Toggle */
  .tog-track { width: 44px; height: 26px; border-radius: 13px; cursor: pointer; position: relative; transition: background .2s; flex-shrink: 0; }
  .tog-thumb { position: absolute; top: 3px; width: 20px; height: 20px; border-radius: 50%; background: #fff; transition: left .2s; }

  /* Tour */
  .tour-overlay { position: fixed; inset: 0; background: rgba(0,0,0,0.45); z-index: 200; pointer-events: none; }
  .tour-card {
    position: fixed; z-index: 300; left: 50%; transform: translateX(-50%);
    width: calc(100% - 32px); max-width: 398px;
    padding: 22px 22px 18px; background: ${CARD};
    border: 1px solid ${LINE}; border-radius: 20px;
    box-shadow: 0 16px 48px rgba(0,0,0,0.18);
  }
  .tour-prog { height: 3px; border-radius: 2px; background: ${LINE}; overflow: hidden; margin-bottom: 16px; }
  .tour-prog-fill { height: 100%; border-radius: 2px; background: ${G}; transition: width .4s ease; }

  /* Login */
  .login-wrap {
    min-height: 100vh; max-width: 430px; margin: 0 auto;
    display: flex; flex-direction: column; align-items: center; justify-content: center;
    padding: 28px 20px; background: ${BG};
  }

  /* Heading */
  h1.page-h { font-size: 24px; font-weight: 800; color: ${INK}; letter-spacing: -.4px; margin: 0 0 3px; }
  p.page-sub { margin: 0; color: ${DIM}; font-size: 14px; }
  .sec-lbl { font-size: 11px; font-weight: 700; color: ${DIM}; text-transform: uppercase; letter-spacing: .06em; margin-bottom: 6px; display: block; }
`;

// ─────────────────────────────────────────────────────────────
//  SVG ICON
// ─────────────────────────────────────────────────────────────
const Ico = ({ d, size = 20, color = "currentColor", sw = 1.8 }: any) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={sw} strokeLinecap="round" strokeLinejoin="round">
    <path d={d} />
  </svg>
);
const ic = {
  home:   "M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2zM9 22V12h6v10",
  post:   "M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4M17 8l-5-5-5 5M12 3v12",
  review: "M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z",
  queue:  "M3 9h18M3 4h18v16a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1V4zM8 2v4M16 2v4",
  bill:   "M12 1v22M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6",
  profile:"M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2M12 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8z",
  camera: "M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2zM12 17a4 4 0 1 0 0-8 4 4 0 0 0 0 8z",
  upload: "M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4M17 8l-5-5-5 5M12 3v12",
  mic:    "M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3zM19 10v2a7 7 0 0 1-14 0v-2M12 19v4M8 23h8",
  check:  "M20 6L9 17l-5-5",
  x:      "M18 6L6 18M6 6l12 12",
  back:   "M19 12H5M12 19l-7-7 7-7",
  chevron:"M9 18l6-6-6-6",
  send:   "M22 2L11 13M22 2L15 22l-4-9-9-4 20-7z",
  chart:  "M18 20V10M12 20V4M6 20v-6",
  shield: "M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z",
  doc:    "M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8zM14 2v6h6",
  lock:   "M19 11H5a2 2 0 0 0-2 2v7a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7a2 2 0 0 0-2-2zM7 11V7a5 5 0 0 1 10 0v4",
};

// Platform badge
const PL: Record<string, any> = {
  instagram: { color: "#E1306C", bg: "#fdf0f4", label: "IG" },
  facebook:  { color: "#1877F2", bg: "#eff5fe", label: "FB" },
  linkedin:  { color: "#0A66C2", bg: "#eef4fb", label: "LI" },
  tiktok:    { color: "#333",    bg: "#f3f3f3", label: "TT" },
  x:         { color: "#000",    bg: "#f3f3f3", label: "X"  },
};
const PlatBadge = ({ platform }: { platform: string }) => {
  const p = PL[platform?.toLowerCase()] || { color: DIM, bg: BG, label: platform?.slice(0,2)?.toUpperCase() };
  return <span className="plat-badge" style={{ color: p.color, background: p.bg }}>{p.label} {platform}</span>;
};

// GeckoMark SVG
const GeckoMark = ({ size = 30 }: { size?: number }) => (
  <svg width={size} height={size} viewBox="0 0 64 64" fill="none">
    <g transform="translate(32,32)">
      <path fill={G} d="M 18 28 Q 44 36 46 56 Q 38 44 20 34 Z" />
      <path fill={G} d="M -9 22 Q -28 30 -36 42 L -32 44 Q -25 33 -8 26 Z" />
      <path stroke={G} strokeWidth="2.5" strokeLinecap="round" fill="none" d="M -36 42 Q -42 46 -44 52 M -36 42 Q -39 50 -37 56 M -36 42 Q -32 50 -30 54" />
      <path fill={G} d="M 9 22 Q 26 30 32 42 L 28 44 Q 22 33 8 26 Z" />
      <path stroke={G} strokeWidth="2.5" strokeLinecap="round" fill="none" d="M 32 42 Q 38 46 40 52 M 32 42 Q 35 50 33 56 M 32 42 Q 28 50 26 54" />
      <ellipse cx="0" cy="16" rx="11" ry="16" fill={G} />
      <path fill={G} d="M -10 4 Q -28 2 -38 -8 L -34 -12 Q -26 -4 -9 0 Z" />
      <path stroke={G} strokeWidth="2.5" strokeLinecap="round" fill="none" d="M -38 -8 Q -44 -12 -46 -18 M -38 -8 Q -42 -16 -40 -22 M -38 -8 Q -34 -16 -32 -20" />
      <path fill={G} d="M 10 4 Q 28 2 36 -10 L 32 -14 Q 26 -6 9 0 Z" />
      <path stroke={G} strokeWidth="2.5" strokeLinecap="round" fill="none" d="M 36 -10 Q 42 -14 44 -20 M 36 -10 Q 40 -18 38 -24 M 36 -10 Q 32 -18 30 -22" />
      <ellipse cx="0" cy="-4" rx="8" ry="8" fill={G} />
      <ellipse cx="0" cy="-18" rx="11" ry="13" fill={G} />
      <ellipse cx="0" cy="-28" rx="6" ry="6" fill={G} />
      <path stroke="#007a5c" strokeWidth="1.5" fill="none" strokeLinecap="round" d="M -5 -24 Q 0 -21 5 -24" />
      <circle cx="-3" cy="-32" r="1.2" fill="#007a5c" /><circle cx="3" cy="-32" r="1.2" fill="#007a5c" />
      <circle cx="-8" cy="-22" r="5.5" fill="#fff" /><circle cx="8" cy="-22" r="5.5" fill="#fff" />
      <ellipse cx="-8" cy="-22" rx="2" ry="3.5" fill="#003d2e" /><ellipse cx="8" cy="-22" rx="2" ry="3.5" fill="#003d2e" />
      <circle cx="-6.5" cy="-24" r="1.2" fill="#fff" /><circle cx="9.5" cy="-24" r="1.2" fill="#fff" />
    </g>
  </svg>
);

// Toggle
const Toggle = ({ on, onToggle }: { on: boolean; onToggle: () => void }) => (
  <div className="tog-track" onClick={onToggle} style={{ background: on ? G : LINE }}>
    <div className="tog-thumb" style={{ left: on ? 21 : 3 }} />
  </div>
);

// ─────────────────────────────────────────────────────────────
//  LEGAL DOCS
// ─────────────────────────────────────────────────────────────
const LEGAL: Record<string, { title: string; updated: string; body: React.ReactNode }> = {
  tos: {
    title: "Terms of Service",
    updated: "1 June 2026",
    body: (
      <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
        <p><strong>1. Acceptance of Terms</strong><br/>By accessing and using the WebGecko Client Hub ("Service"), you agree to be bound by these Terms of Service. If you do not agree to these terms, please do not use the Service.</p>
        <p><strong>2. Description of Service</strong><br/>WebGecko provides a social media management and publishing platform. We utilise artificial intelligence to generate captions based on the media and briefs you provide.</p>
        <p><strong>3. User Responsibilities</strong><br/>You are solely responsible for the content you upload, including photos, videos, and voice notes. You represent that you own or have the necessary rights to use all content submitted to the Service.</p>
        <p><strong>4. Post Approval & Billing</strong><br/>A flat fee of $100 AUD is charged per post immediately upon your explicit approval of a draft. By clicking "Approve", you authorise WebGecko to publish the content on your linked social media accounts and log the associated charge.</p>
        <p><strong>5. Limitation of Liability</strong><br/>WebGecko shall not be liable for any indirect, incidental, special, or consequential damages resulting from the use or inability to use the Service or from any content published on your behalf.</p>
        <p><strong>6. Termination</strong><br/>We reserve the right to suspend or terminate your access to the Service at any time for violations of these Terms.</p>
      </div>
    ),
  },
  privacy: {
    title: "Privacy Policy",
    updated: "1 June 2026",
    body: (
      <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
        <p><strong>1. Information We Collect</strong><br/>We collect personal information that you provide to us, such as your name, business name, email address, and phone number. We also collect the content you upload (images, videos, voice notes) for the purpose of generating social media posts.</p>
        <p><strong>2. How We Use Your Information</strong><br/>We use your information to provide, maintain, and improve our services; to process your social media posts; to handle billing; and to communicate with you about your account.</p>
        <p><strong>3. AI Processing</strong><br/>Your briefs and media are processed using artificial intelligence to generate drafts. We do not claim ownership over your raw media, and we ensure third-party AI providers do not use your private data to train public models.</p>
        <p><strong>4. Data Sharing & Security</strong><br/>We do not sell your personal data. We only share data with integrated platforms (e.g., Facebook, Instagram, LinkedIn) to publish your approved posts. We implement industry-standard security measures to protect your information.</p>
        <p><strong>5. Your Rights</strong><br/>Under the Australian Privacy Act 1988, you have the right to access, correct, or request deletion of your personal information. Contact us at privacy@webgecko.au for inquiries.</p>
      </div>
    ),
  },
  agreement: {
    title: "Social Media Service Agreement",
    updated: "1 June 2026",
    body: (
      <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
        <p><strong>1. Services Provided</strong><br/>WebGecko agrees to provide social media drafting, scheduling, and publishing services ("Services") as requested through the Client Hub.</p>
        <p><strong>2. Fees and Invoicing</strong><br/>The Client agrees to pay a flat fee of $100 AUD for each social media post approved through the portal. This fee covers AI drafting, review, scheduling, and publishing across selected platforms.</p>
        <p><strong>3. Approval Process</strong><br/>WebGecko will not publish any content without the explicit approval of the Client. Once approved, the post is queued, the fee is incurred, and the action cannot be reversed without contacting support immediately.</p>
        <p><strong>4. Intellectual Property</strong><br/>The Client retains all intellectual property rights to the original assets provided. Upon publication, WebGecko grants the Client full rights to the generated captions and composite post formats.</p>
        <p><strong>5. Dispute Resolution</strong><br/>Any disputes arising out of this agreement will be resolved through good faith negotiations. If unresolved, disputes will be subject to the exclusive jurisdiction of the courts of Victoria, Australia.</p>
      </div>
    ),
  },
};

// ─────────────────────────────────────────────────────────────
//  TOUR STEPS
// ─────────────────────────────────────────────────────────────
const TOUR = [
  { tab:"home",     anchor:"t-welcome",  emoji:"👋", title:"Welcome to your Hub",         desc:"Your command centre for website, posts, billing, and reports. Let's take a quick look around." },
  { tab:"home",     anchor:"t-metrics",  emoji:"📊", title:"Your key stats",               desc:"Plan status, invoices, build status, and queued posts — all at a glance." },
  { tab:"create",   anchor:"t-media",    emoji:"📸", title:"Upload photos & videos",       desc:"Take a photo or pick files from your device. Up to 5 per post." },
  { tab:"create",   anchor:"t-voice",    emoji:"🎤", title:"Voice instruction",            desc:"Hit Record and describe the post out loud. We transcribe it in real time and pass it to the AI." },
  { tab:"create",   anchor:"t-brief",    emoji:"✍️", title:"Write a brief",                desc:"Add context, tone, promotions. The more detail, the better your captions." },
  { tab:"review",   anchor:"t-review",   emoji:"👁", title:"Review AI drafts",             desc:"Edit captions inline, then approve. A $100 flat fee is charged on approval." },
  { tab:"calendar", anchor:"t-queue",    emoji:"📅", title:"Posting Queue",                desc:"All approved posts with their schedule and charge reference." },
  { tab:"billing",  anchor:"t-billing",  emoji:"💳", title:"Billing & Invoices",           desc:"Full transaction history. $100 per post, always transparent." },
  { tab:"profile",  anchor:"t-profile",  emoji:"⚙️", title:"Profile & Legal",              desc:"Account details and service agreements. You're all set — let's go! 🎉" },
];

type Tab = "home"|"create"|"review"|"calendar"|"billing"|"reports"|"stats"|"profile";

// ─────────────────────────────────────────────────────────────
//  MAIN
// ─────────────────────────────────────────────────────────────
export default function ClientHub() {
  // Auth
  const [authed,      setAuthed]      = useState(false);
  const [authLoading, setAuthLoading] = useState(true);
  const [uname,       setUname]       = useState("");
  const [pw,          setPw]          = useState("");
  const [loginErr,    setLoginErr]    = useState("");
  const [loginBusy,   setLoginBusy]   = useState(false);
  const [client,      setClient]      = useState<any>(null);

  // Nav
  const [tab,       setTab]       = useState<Tab>("home");
  const [upsell,    setUpsell]    = useState(false);
  const [legalDoc,  setLegalDoc]  = useState<string|null>(null);

  // Create
  const [brief,       setBrief]       = useState("");
  const [tone,        setTone]        = useState("friendly");
  const [platforms,   setPlatforms]   = useState<string[]>(["instagram","facebook"]);
  const [files,       setFiles]       = useState<File[]>([]);
  const [previews,    setPreviews]    = useState<string[]>([]);
  const [showSched,   setShowSched]   = useState(false);
  const [schedDate,   setSchedDate]   = useState("");
  const [schedTime,   setSchedTime]   = useState("");

  // Voice
  const [recording,   setRecording]   = useState(false);
  const [voiceBlob,   setVoiceBlob]   = useState<Blob|null>(null);
  const [voiceUrl,    setVoiceUrl]    = useState("");
  const [transcript,  setTranscript]  = useState("");
  const [speechOk,    setSpeechOk]    = useState(false);

  // Drafts
  const [generating,  setGenerating]  = useState(false);
  const [drafts,      setDrafts]      = useState<any[]>([]);
  const [mediaUrls,   setMediaUrls]   = useState<string[]>([]);
  const [approving,   setApproving]   = useState(false);
  const [approveDone, setApproveDone] = useState(false);

  // DB
  const [payments, setPayments] = useState<any[]>([]);
  const [queue,    setQueue]    = useState<any[]>([]);

  // Tour
  const [tourOn,   setTourOn]   = useState(false);
  const [tourStep, setTourStep] = useState(0);
  const [tourY,    setTourY]    = useState(100);

  // Refs
  const canvasRef  = useRef<HTMLCanvasElement|null>(null);
  const audioCtx   = useRef<AudioContext|null>(null);
  const analyserR  = useRef<AnalyserNode|null>(null);
  const mrRef      = useRef<MediaRecorder|null>(null);
  const recRef     = useRef<any>(null);
  const rafRef     = useRef<number>(0);
  const streamRef  = useRef<MediaStream|null>(null);
  const uploadRef  = useRef<HTMLInputElement|null>(null);
  const cameraRef  = useRef<HTMLInputElement|null>(null);

  const hasSocial =
    client?.metadata?.features?.some((f:string) => /social|post/i.test(f)) ||
    /social/i.test(client?.plan||"") ||
    client?.metadata?.socialActive === true;

  // ── boot ──
  useEffect(() => {
    (async () => {
      const slug = localStorage.getItem("wg_app_slug");
      if (slug) {
        try {
          const r = await fetch(`/api/client-login?slug=${slug}`);
          if (r.ok) {
            const d = await r.json(); setClient(d); setAuthed(true);
            await loadDb(slug, d.job_id);
            setTab(/social/i.test(d?.plan||"")||d?.metadata?.socialActive ? "create" : "home");
          } else localStorage.removeItem("wg_app_slug");
        } catch { localStorage.removeItem("wg_app_slug"); }
      }
      setAuthLoading(false);
    })();
  }, []);

  // ── speech ──
  useEffect(() => {
    if (typeof window === "undefined") return;
    const SR = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SR) return; setSpeechOk(true);
    const r = new SR(); r.continuous = true; r.interimResults = true; r.lang = "en-AU";
    r.onresult = (e:any) => { let f="",i=""; for (let j=e.resultIndex;j<e.results.length;j++) e.results[j].isFinal?(f+=e.results[j][0].transcript):(i+=e.results[j][0].transcript); if(f||i) setTranscript(p=>p+" "+(f||i)); };
    recRef.current = r;
  }, []);

  // ── auto tour ──
  useEffect(() => {
    if (authed && client?.slug && !localStorage.getItem(`wg_tour_${client.slug}`))
      setTimeout(() => startTour(), 900);
  }, [authed, client?.slug]);

  async function loadDb(slug:string, jobId:string) {
    try {
      const { data:p } = await supabasePublic.from("payments").select("*").eq("client_slug",slug).order("created_at",{ascending:false});
      if (p) setPayments(p);
      if (jobId) {
        const { data:j } = await supabasePublic.from("jobs").select("metadata").eq("id",jobId).single();
        if (j?.metadata?.approvedPosts) setQueue([...j.metadata.approvedPosts].reverse());
      }
    } catch {}
  }

  async function login(e:React.FormEvent) {
    e.preventDefault(); setLoginErr(""); setLoginBusy(true);
    try {
      const r = await fetch("/api/client-login",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({username:uname.trim(),password:pw.trim()})});
      const d = await r.json(); if (!r.ok) throw new Error(d.error||"Invalid credentials");
      localStorage.setItem("wg_app_slug",d.slug);
      const pr = await fetch(`/api/client-login?slug=${d.slug}`);
      const pd = await pr.json(); setClient(pd); setAuthed(true);
      await loadDb(d.slug,pd.job_id);
      setTab(/social/i.test(pd?.plan||"")||pd?.metadata?.socialActive?"create":"home");
    } catch(err:any) { setLoginErr(err.message); }
    finally { setLoginBusy(false); }
  }

  function logout() { localStorage.removeItem("wg_app_slug"); setAuthed(false); setClient(null); setTab("home"); }

  function go(t:Tab) {
    if (["create","review","calendar"].includes(t) && !hasSocial) { setUpsell(true); return; }
    setTab(t);
  }

  function addFiles(fl:FileList|null) {
    if (!fl) return;
    const picked = Array.from(fl);
    setFiles(p=>[...p,...picked].slice(0,5));
    setPreviews(p=>[...p,...picked.map(f=>URL.createObjectURL(f))].slice(0,5));
  }
  const rmFile = (i:number) => { setFiles(p=>p.filter((_,j)=>j!==i)); setPreviews(p=>p.filter((_,j)=>j!==i)); };

  async function startRec() {
    setTranscript(""); setVoiceBlob(null); setVoiceUrl("");
    try {
      const s = await navigator.mediaDevices.getUserMedia({audio:true});
      streamRef.current = s; setRecording(true);
      const Ctx = window.AudioContext||(window as any).webkitAudioContext;
      if (Ctx) { const ctx=new Ctx(),src=ctx.createMediaStreamSource(s),an=ctx.createAnalyser(); an.fftSize=64; src.connect(an); audioCtx.current=ctx; analyserR.current=an; drawViz(); }
      if (recRef.current) recRef.current.start();
      const mr = new MediaRecorder(s); const chunks:Blob[]=[];
      mr.ondataavailable = e=>{if(e.data?.size)chunks.push(e.data);};
      mr.onstop = ()=>{const b=new Blob(chunks,{type:"audio/wav"}); setVoiceBlob(b); setVoiceUrl(URL.createObjectURL(b));};
      mrRef.current=mr; mr.start();
    } catch { alert("Microphone permission denied."); setRecording(false); }
  }
  function stopRec() { setRecording(false); mrRef.current?.stop(); recRef.current?.stop(); streamRef.current?.getTracks().forEach(t=>t.stop()); cancelAnimationFrame(rafRef.current); audioCtx.current?.close(); }
  function drawViz() { const an=analyserR.current; if(!an) return; const data=new Uint8Array(an.frequencyBinCount); const d=()=>{rafRef.current=requestAnimationFrame(d); an.getByteFrequencyData(data); document.querySelectorAll(".vbar").forEach((b:any,i)=>{if(data[i]!==undefined)b.style.height=`${Math.max(5,(data[i]/255)*36)}px`;});}; d(); }

  async function generate() {
    if (!brief.trim()&&!transcript.trim()&&files.length===0){alert("Add media, brief, or voice note first.");return;}
    setGenerating(true); setDrafts([]);
    try {
      const fd=new FormData(); fd.append("slug",client.slug); fd.append("brief",brief); fd.append("tone",tone);
      fd.append("platforms",JSON.stringify(platforms)); fd.append("voiceTranscript",transcript);
      files.forEach(f=>fd.append("files",f)); if(voiceBlob) fd.append("voiceover",voiceBlob,"vo.wav");
      const r=await fetch("/api/client/social-upload-app",{method:"POST",body:fd});
      const d=await r.json(); if(!r.ok) throw new Error(d.error);
      setDrafts(d.drafts); setMediaUrls(d.mediaUrls); setTab("review");
    } catch(e:any){alert("Error: "+e.message);}
    finally{setGenerating(false);}
  }

  async function approve() {
    setApproving(true);
    try {
      const r=await fetch("/api/client/social-approve",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({slug:client.slug,posts:drafts.map(d=>({...d,mediaUrls}))})});
      if(!r.ok) throw new Error((await r.json()).error);
      setApproveDone(true); confetti();
      await loadDb(client.slug,client.job_id);
      setTimeout(()=>{setApproveDone(false);setBrief("");setFiles([]);setPreviews([]);setVoiceBlob(null);setVoiceUrl("");setTranscript("");setDrafts([]);setTab("calendar");},3800);
    } catch(e:any){alert("Failed: "+e.message);}
    finally{setApproving(false);}
  }

  function confetti() {
    const c=canvasRef.current; if(!c) return;
    c.width=window.innerWidth; c.height=window.innerHeight;
    const ctx=c.getContext("2d"); if(!ctx) return;
    const cols=[G,"#34D399","#6EE7B7","#A7F3D0","#10B981","#059669"];
    const pp=Array.from({length:120},()=>({x:Math.random()*c.width,y:c.height+10,vx:(Math.random()-.5)*7,vy:-Math.random()*15-8,s:Math.random()*8+3,c:cols[Math.floor(Math.random()*cols.length)],r:Math.random()*360,rs:Math.random()*4-2}));
    const a=()=>{ctx.clearRect(0,0,c.width,c.height);let alive=false;pp.forEach(p=>{p.x+=p.vx;p.y+=p.vy;p.vy+=0.35;p.r+=p.rs;ctx.save();ctx.translate(p.x,p.y);ctx.rotate(p.r*Math.PI/180);ctx.fillStyle=p.c;ctx.fillRect(-p.s/2,-p.s/2,p.s,p.s);ctx.restore();if(p.y<c.height+10)alive=true;});if(alive)requestAnimationFrame(a);else ctx.clearRect(0,0,c.width,c.height);};
    a();
  }

  const fmt = (s:string) => new Date(s).toLocaleDateString("en-AU",{weekday:"short",day:"numeric",month:"short",hour:"2-digit",minute:"2-digit"});
  const tomorrow = new Date(); tomorrow.setDate(tomorrow.getDate()+1);
  const minDate = tomorrow.toISOString().split("T")[0];

  // Tour
  function startTour(){setTourStep(0);setTourOn(true);applyStep(0);}
  function endTour(){setTourOn(false);if(client?.slug)localStorage.setItem(`wg_tour_${client.slug}`,"1");}
  function applyStep(step:number){
    const s=TOUR[step]; if(!s){endTour();return;}
    setTab(s.tab as Tab);
    setTimeout(()=>{
      const el=document.getElementById(s.anchor);
      if(el){el.scrollIntoView({behavior:"smooth",block:"center"});const rect=el.getBoundingClientRect();setTourY(Math.min(rect.bottom+12,window.innerHeight-290));}
      else setTourY(Math.max(window.innerHeight/2-140,60));
    },300);
  }
  function tourNext(){const n=tourStep+1;if(n>=TOUR.length){endTour();return;}setTourStep(n);applyStep(n);}
  function tourPrev(){const p=tourStep-1;if(p<0)return;setTourStep(p);applyStep(p);}

  // ── Loading ──
  if (authLoading) return (
    <div style={{minHeight:"100vh",background:BG,display:"flex",alignItems:"center",justifyContent:"center",flexDirection:"column",gap:12}}>
      <style>{CSS}</style>
      <GeckoMark size={42}/>
      <div style={{width:20,height:20,border:`2.5px solid ${LINE}`,borderTopColor:G,borderRadius:"50%"}} className="spin"/>
    </div>
  );

  // ── Login ──
  if (!authed) return (
    <div className="login-wrap">
      <style>{CSS}</style>
      <div style={{width:"100%",maxWidth:380}}>
        <div style={{textAlign:"center",marginBottom:32}}>
          <GeckoMark size={54}/>
          <h1 style={{fontSize:26,fontWeight:900,color:INK,letterSpacing:"-.5px",marginTop:12,marginBottom:4}}>WebGecko</h1>
          <p style={{color:DIM,fontSize:14}}>Sign in to your client portal</p>
        </div>
        <div className="card" style={{padding:"28px 24px"}}>
          <form onSubmit={login} style={{display:"flex",flexDirection:"column",gap:16}}>
            {loginErr&&<div style={{background:"rgba(239,68,68,.07)",border:"1px solid rgba(239,68,68,.2)",borderRadius:10,padding:"10px 14px",color:"#EF4444",fontSize:13,display:"flex",gap:8,alignItems:"center"}}><Ico d={ic.x} size={14} color="#EF4444"/> {loginErr}</div>}
            <div>
              <label className="sec-lbl">Username</label>
              <input className="inp" type="text" required value={uname} onChange={e=>setUname(e.target.value)} placeholder="your-business-name" autoComplete="username"/>
            </div>
            <div>
              <label className="sec-lbl">Password</label>
              <input className="inp" type="password" required value={pw} onChange={e=>setPw(e.target.value)} placeholder="••••••••" autoComplete="current-password"/>
            </div>
            <button type="submit" className="btn-primary" disabled={loginBusy}>
              {loginBusy?<span style={{display:"flex",alignItems:"center",justifyContent:"center",gap:8}}><div style={{width:15,height:15,border:`2px solid rgba(255,255,255,.3)`,borderTopColor:"#fff",borderRadius:"50%"}} className="spin"/>Signing in…</span>:"Sign in →"}
            </button>
          </form>
          <div style={{height:1,background:LINE,margin:"20px 0"}}/>
          <p style={{textAlign:"center",fontSize:12,color:DIM}}>Credentials were sent in your welcome email. <a href="mailto:hello@webgecko.au" style={{color:G,fontWeight:700,textDecoration:"none"}}>Need help?</a></p>
        </div>
      </div>
    </div>
  );

  // ── NAV items ──
  const NAV = [
    {id:"home",    icon:ic.home,    label:"Hub"},
    {id:"create",  icon:ic.camera,  label:"Post",   locked:!hasSocial},
    {id:"review",  icon:ic.review,  label:"Review", locked:!hasSocial},
    {id:"calendar",icon:ic.queue,   label:"Queue",  locked:!hasSocial},
    {id:"billing", icon:ic.bill,    label:"Billing"},
    {id:"profile", icon:ic.profile, label:"Profile"},
  ];

  return (
    <div className="shell">
      <style>{CSS}</style>
      <canvas ref={canvasRef} style={{position:"fixed",inset:0,pointerEvents:"none",zIndex:9999}}/>

      {/* ── Header ── */}
      <header className="hdr">
        <div style={{display:"flex",alignItems:"center",gap:10}}>
          <GeckoMark size={28}/>
          <div>
            <div style={{fontSize:15,fontWeight:800,color:INK,letterSpacing:"-.3px",lineHeight:1}}>WebGecko</div>
            <div style={{fontSize:9,color:G,fontWeight:700,textTransform:"uppercase",letterSpacing:".06em"}}>Client Hub</div>
          </div>
        </div>
        <div style={{display:"flex",alignItems:"center",gap:10}}>
          <button onClick={startTour} style={{background:"none",border:`1px solid ${LINE}`,borderRadius:20,padding:"5px 12px",fontSize:11,color:DIM,fontWeight:700,cursor:"pointer",fontFamily:"inherit",display:"flex",alignItems:"center",gap:5}}>
            <Ico d={ic.chart} size={13} color={DIM}/> Tour
          </button>
          <div style={{width:32,height:32,borderRadius:"50%",background:G,display:"flex",alignItems:"center",justifyContent:"center",fontSize:13,fontWeight:800,color:"#fff"}}>
            {client?.business_name?.[0]?.toUpperCase()||"C"}
          </div>
        </div>
      </header>

      {/* ── Scroll ── */}
      <div className="scroll fade">

        {/* ══ HOME ══ */}
        {tab==="home"&&(
          <div style={{display:"flex",flexDirection:"column",gap:16}}>
            <div id="t-welcome">
              <p style={{margin:"0 0 2px",color:DIM,fontSize:13}}>Good to see you 👋</p>
              <h1 className="page-h">{client?.metadata?.name||client?.business_name||"Hey there"}</h1>
            </div>

            {/* Metrics */}
            <div id="t-metrics" className="card" style={{overflow:"hidden"}}>
              <div style={{display:"grid",gridTemplateColumns:"1fr 1fr"}}>
                {[
                  {label:"Plan",         value:client?.plan||"Starter",                            accent:G},
                  {label:"Invoices",     value:`${payments.length} logged`,                        accent:INK},
                  {label:"Build Status", value:client?.buildStatus||client?.build_status||"Active",accent:INK},
                  {label:"Posts Queued", value:`${queue.length}`,                                  accent:G},
                ].map((m,i)=>(
                  <div key={m.label} style={{padding:"16px 18px",borderRight:i%2===0?`1px solid ${LINE}`:"none",borderBottom:i<2?`1px solid ${LINE}`:"none"}}>
                    <div className="sec-lbl" style={{marginBottom:4}}>{m.label}</div>
                    <div style={{fontSize:20,fontWeight:800,color:m.accent,textTransform:"capitalize"}}>{m.value}</div>
                  </div>
                ))}
              </div>
            </div>

            {/* CTA / upsell */}
            {!hasSocial&&(
              <div style={{background:DARK,borderRadius:16,padding:"18px 20px"}}>
                <div style={{display:"flex",gap:14,alignItems:"flex-start"}}>
                  <div style={{width:44,height:44,borderRadius:12,background:`${G}22`,display:"flex",alignItems:"center",justifyContent:"center",flexShrink:0}}><Ico d={ic.send} size={22} color={G}/></div>
                  <div>
                    <div style={{fontSize:15,fontWeight:800,color:"#fff",marginBottom:5}}>Unlock Social Posting</div>
                    <p style={{fontSize:12,color:"#ffffff66",lineHeight:1.6,margin:"0 0 12px"}}>AI-written captions from photos, videos, or a voice note. Flat $100/post.</p>
                    <button onClick={()=>setUpsell(true)} style={{padding:"8px 18px",borderRadius:10,border:"none",background:G,color:"#fff",fontWeight:700,fontSize:13,cursor:"pointer",fontFamily:"inherit",boxShadow:`0 4px 14px ${G}40`}}>Unlock Bundle →</button>
                  </div>
                </div>
              </div>
            )}

            {hasSocial&&queue.length>0&&(
              <div className="card" style={{padding:16,display:"flex",gap:12,alignItems:"center"}}>
                <div style={{width:40,height:40,borderRadius:12,background:`${G}12`,display:"flex",alignItems:"center",justifyContent:"center",flexShrink:0}}><Ico d={ic.queue} size={18} color={G}/></div>
                <div style={{minWidth:0}}>
                  <div className="sec-lbl">Next Scheduled Post</div>
                  <div style={{fontSize:13,fontWeight:700,color:INK,whiteSpace:"nowrap",overflow:"hidden",textOverflow:"ellipsis"}}>{queue[0].platform?.toUpperCase()}: {queue[0].caption?.slice(0,40)}…</div>
                  <div style={{fontSize:11,color:G,marginTop:1,fontWeight:600}}>{fmt(queue[0].scheduledAt)}</div>
                </div>
              </div>
            )}

            {/* Quick actions */}
            <div style={{display:"flex",gap:10}}>
              <button onClick={()=>go("create")} className="btn-primary" style={{flex:1}}>📸 Create Post</button>
              <button onClick={()=>go("billing")} className="btn-ghost" style={{flex:1,fontSize:14}}>💳 Invoices</button>
            </div>

            {/* Activity */}
            <div className="card" style={{padding:18}}>
              <div className="sec-lbl" style={{marginBottom:12}}>Recent Activity</div>
              <div style={{display:"flex",flexDirection:"column"}}>
                <div style={{display:"flex",gap:12,alignItems:"flex-start",paddingBottom:12}}>
                  <div style={{width:32,height:32,borderRadius:9,background:`${G}12`,display:"flex",alignItems:"center",justifyContent:"center",flexShrink:0}}><Ico d={ic.check} size={14} color={G}/></div>
                  <div><div style={{fontSize:13,fontWeight:600,color:INK}}>Portal Activated</div><div style={{fontSize:11,color:DIM,marginTop:1}}>Hub services registered.</div></div>
                </div>
                {payments.slice(0,3).map((p,i)=>(
                  <div key={p.id} style={{display:"flex",gap:12,alignItems:"flex-start",paddingTop:12,borderTop:`1px solid ${LINE}`}}>
                    <div style={{width:32,height:32,borderRadius:9,background:`${G}10`,display:"flex",alignItems:"center",justifyContent:"center",flexShrink:0}}><Ico d={ic.bill} size={14} color={G}/></div>
                    <div><div style={{fontSize:13,fontWeight:600,color:INK}}>$100.00 AUD Invoice</div><div style={{fontSize:11,color:DIM,marginTop:1}}>{new Date(p.created_at).toLocaleDateString("en-AU")} · #{p.id?.slice(0,8)}</div></div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* ══ CREATE ══ */}
        {tab==="create"&&(
          <div style={{display:"flex",flexDirection:"column",gap:16}}>
            <div><h1 className="page-h">New post</h1><p className="page-sub">Upload content and we'll handle the rest.</p></div>

            {/* Upload buttons */}
            <input ref={uploadRef} type="file" multiple accept="image/*,video/*" hidden onChange={e=>addFiles(e.target.files)}/>
            <input ref={cameraRef} type="file" accept="image/*,video/*" capture="environment" hidden onChange={e=>addFiles(e.target.files)}/>

            <div id="t-media" style={{display:"flex",gap:10}}>
              <button onClick={()=>cameraRef.current?.click()} style={{flex:1,display:"flex",flexDirection:"column",alignItems:"center",gap:9,padding:"20px 12px",borderRadius:18,border:"none",background:DARK,cursor:"pointer"}}>
                <div style={{width:46,height:46,borderRadius:"50%",background:`${G}22`,display:"flex",alignItems:"center",justifyContent:"center"}}><Ico d={ic.camera} size={22} color={G}/></div>
                <span style={{color:"#fff",fontWeight:700,fontSize:13}}>Take photo</span>
              </button>
              <button onClick={()=>uploadRef.current?.click()} style={{flex:1,display:"flex",flexDirection:"column",alignItems:"center",gap:9,padding:"20px 12px",borderRadius:18,border:`1.5px solid ${LINE}`,background:CARD,cursor:"pointer"}}>
                <div style={{width:46,height:46,borderRadius:"50%",background:`${G}12`,display:"flex",alignItems:"center",justifyContent:"center"}}><Ico d={ic.upload} size={22} color={G}/></div>
                <span style={{color:INK,fontWeight:700,fontSize:13}}>Upload file</span>
              </button>
            </div>

            {previews.length>0&&(
              <div style={{display:"flex",gap:8,overflowX:"auto",paddingBottom:2}}>
                {previews.map((url,i)=>(
                  <div key={url} style={{position:"relative",width:76,height:76,borderRadius:12,overflow:"hidden",border:`1px solid ${LINE}`,flexShrink:0}}>
                    <img src={url} alt="" style={{width:"100%",height:"100%",objectFit:"cover"}}/>
                    <button onClick={()=>rmFile(i)} style={{position:"absolute",top:4,right:4,width:20,height:20,borderRadius:"50%",background:"rgba(0,0,0,.55)",border:"none",cursor:"pointer",display:"flex",alignItems:"center",justifyContent:"center"}}>
                      <Ico d={ic.x} size={11} color="#fff"/>
                    </button>
                  </div>
                ))}
              </div>
            )}

            {/* Voice */}
            <div id="t-voice" className="card" style={{padding:16}}>
              <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:12}}>
                <div className="sec-lbl" style={{margin:0}}>Voice Instruction</div>
                {speechOk&&<span style={{fontSize:10,color:G,background:`${G}12`,padding:"2px 8px",borderRadius:20,fontWeight:600}}>Live Transcription</span>}
              </div>
              <div style={{display:"flex",alignItems:"center",gap:12}}>
                {recording?(
                  <button onClick={stopRec} className="rec-pulse" style={{background:"#EF4444",border:"none",color:"#fff",padding:"8px 18px",borderRadius:30,fontSize:12,fontWeight:700,display:"flex",alignItems:"center",gap:7,cursor:"pointer",fontFamily:"inherit"}}>
                    <span style={{width:8,height:8,background:"#fff",borderRadius:"50%",display:"inline-block"}}/>Stop
                  </button>
                ):(
                  <button onClick={startRec} style={{display:"flex",alignItems:"center",gap:7,padding:"8px 18px",borderRadius:30,border:"none",background:G,color:"#fff",fontWeight:700,fontSize:12,cursor:"pointer",fontFamily:"inherit"}}>
                    <Ico d={ic.mic} size={14} color="#fff"/>Record
                  </button>
                )}
                {recording&&<div style={{display:"flex",gap:3,alignItems:"center",height:36,flex:1,justifyContent:"center"}}>{Array.from({length:14}).map((_,i)=><div key={i} className="vbar"/>)}</div>}
              </div>
              {voiceUrl&&<div style={{marginTop:12}}><audio src={voiceUrl} controls style={{width:"100%",height:34}}/></div>}
              {transcript&&<div style={{marginTop:12}}><label className="sec-lbl">Transcription (editable)</label><textarea className="inp" value={transcript} onChange={e=>setTranscript(e.target.value)} style={{minHeight:60,resize:"vertical",fontSize:12,lineHeight:1.6,marginTop:4}}/></div>}
            </div>

            {/* Brief */}
            <div id="t-brief" className="card" style={{padding:16}}>
              <div className="sec-lbl" style={{marginBottom:8}}>Post Brief</div>
              <textarea className="inp" value={brief} onChange={e=>setBrief(e.target.value.slice(0,500))} rows={4} placeholder="What's this post about? Promo, context, tone…" style={{resize:"vertical",lineHeight:1.6,paddingBottom:26,position:"relative"}}/>
              <div style={{textAlign:"right",fontSize:11,color:brief.length>450?"#F59E0B":DIM,marginTop:2}}>{brief.length}/500</div>

              <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:12,marginTop:12}}>
                <div>
                  <label className="sec-lbl">Tone</label>
                  <select className="inp" value={tone} onChange={e=>setTone(e.target.value)} style={{padding:"10px 12px",marginTop:4}}>
                    <option value="friendly">Friendly</option>
                    <option value="professional">Professional</option>
                    <option value="casual">Casual</option>
                    <option value="promotional">Promotional</option>
                  </select>
                </div>
                <div>
                  <label className="sec-lbl">Fee per post</label>
                  <div style={{display:"flex",alignItems:"center",background:`${G}10`,border:`1.5px solid ${G}28`,borderRadius:12,padding:"10px 12px",marginTop:4,height:42}}>
                    <span style={{fontSize:14,marginRight:6}}>💰</span>
                    <span style={{fontSize:13,fontWeight:700,color:G}}>$100 flat</span>
                  </div>
                </div>
              </div>

              <div style={{marginTop:14}}>
                <label className="sec-lbl">Platforms</label>
                <div style={{display:"flex",flexWrap:"wrap",gap:8,marginTop:6}}>
                  {["Instagram","Facebook","LinkedIn","TikTok","X"].map(p=>{
                    const key=p.toLowerCase(); const act=platforms.includes(key);
                    const col=PL[key]?.color||DIM;
                    return <button key={p} onClick={()=>setPlatforms(prev=>act?prev.filter(x=>x!==key):[...prev,key])} style={{padding:"6px 14px",borderRadius:20,fontSize:12,fontWeight:act?700:500,cursor:"pointer",border:`1.5px solid ${act?col:LINE}`,background:act?`${col}12`:"transparent",color:act?col:DIM,fontFamily:"inherit",transition:"all .15s"}}>{p}</button>;
                  })}
                </div>
              </div>
            </div>

            {/* Schedule toggle */}
            <div className="card" style={{overflow:"hidden"}}>
              <div onClick={()=>setShowSched(v=>!v)} style={{padding:"13px 16px",display:"flex",justifyContent:"space-between",alignItems:"center",cursor:"pointer"}}>
                <div>
                  <span style={{fontWeight:600,fontSize:14,color:INK}}>Schedule for later</span>
                  {schedDate&&<span style={{marginLeft:8,fontSize:13,color:G}}>{new Date(schedDate).toLocaleDateString("en-AU",{day:"numeric",month:"short"})}{schedTime?` at ${schedTime}`:""}</span>}
                </div>
                <Toggle on={showSched} onToggle={()=>setShowSched(v=>!v)}/>
              </div>
              {showSched&&(
                <div style={{padding:"0 16px 14px",display:"flex",gap:10,borderTop:`1px solid ${LINE}`,paddingTop:12}}>
                  <input type="date" min={minDate} value={schedDate} onChange={e=>setSchedDate(e.target.value)} className="inp" style={{flex:1}}/>
                  <input type="time" value={schedTime} onChange={e=>setSchedTime(e.target.value)} className="inp" style={{flex:1}}/>
                </div>
              )}
            </div>

            <button onClick={generate} disabled={generating||(!brief.trim()&&!transcript.trim()&&files.length===0)} className="btn-primary">
              {generating?<span style={{display:"flex",alignItems:"center",justifyContent:"center",gap:8}}><div style={{width:15,height:15,border:"2px solid rgba(255,255,255,.3)",borderTopColor:"#fff",borderRadius:"50%"}} className="spin"/>Writing captions…</span>:"Submit to WebGecko →"}
            </button>
          </div>
        )}

        {/* ══ REVIEW ══ */}
        {tab==="review"&&(
          <div id="t-review" style={{display:"flex",flexDirection:"column",gap:14}}>
            <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start"}}>
              <div><h1 className="page-h">Review</h1><p className="page-sub">Edit & approve your drafts.</p></div>
              <button onClick={()=>setTab("create")} className="btn-sm-outline">← Back</button>
            </div>

            {drafts.length===0?(
              <div className="card" style={{padding:"52px 24px",textAlign:"center",display:"flex",flexDirection:"column",alignItems:"center",gap:12}}>
                <div style={{width:64,height:64,borderRadius:"50%",background:`${G}12`,display:"flex",alignItems:"center",justifyContent:"center"}}><Ico d={ic.review} size={28} color={G}/></div>
                <div style={{fontSize:16,fontWeight:800,color:INK}}>No drafts yet</div>
                <p style={{fontSize:13,color:DIM,maxWidth:220,lineHeight:1.6}}>Go to New Post, add your content, then generate AI drafts.</p>
                <button onClick={()=>setTab("create")} className="btn-sm">→ Create Post</button>
              </div>
            ):(
              <>
                {drafts.map((d,i)=>(
                  <div key={d.platform} className="card" style={{overflow:"hidden",borderColor:d.platform==="instagram"?PL.instagram.color+"44":LINE}}>
                    <div style={{padding:"12px 14px",borderBottom:`1px solid ${LINE}`,display:"flex",alignItems:"center",gap:10}}>
                      <div style={{width:28,height:28,borderRadius:"50%",background:G,display:"flex",alignItems:"center",justifyContent:"center",fontSize:11,fontWeight:800,color:"#fff",flexShrink:0}}>{client?.business_name?.[0]?.toUpperCase()||"C"}</div>
                      <div><div style={{fontSize:12,fontWeight:700,color:INK}}>{client?.business_name||client?.slug}</div></div>
                      <PlatBadge platform={d.platform}/>
                    </div>
                    {previews.length>0&&<div style={{aspectRatio:"16/9",overflow:"hidden",background:"#F3F4F6",display:"flex",alignItems:"center",justifyContent:"center"}}><img src={previews[0]} alt="" style={{width:"100%",height:"100%",objectFit:"cover"}}/></div>}
                    <div style={{padding:14}}>
                      <textarea value={d.caption} onChange={e=>{const u=[...drafts];u[i].caption=e.target.value;setDrafts(u);}} className="inp" style={{minHeight:80,resize:"vertical",background:"transparent",border:"none",padding:0,fontSize:13,lineHeight:1.6,color:INK}}/>
                      <div style={{display:"flex",flexWrap:"wrap",gap:4,marginTop:8,borderTop:`1px solid ${LINE}`,paddingTop:8}}>
                        {d.hashtags?.map((h:string)=><span key={h} style={{fontSize:11,color:G,fontWeight:500}}>{h}</span>)}
                      </div>
                      <div style={{fontSize:11,color:DIM,marginTop:6}}>Best slot: {fmt(d.scheduledAt)}</div>
                    </div>
                  </div>
                ))}

                <div className="card" style={{padding:18,borderColor:`${G}33`}}>
                  {approveDone?(
                    <div style={{textAlign:"center",padding:"8px 0",display:"flex",flexDirection:"column",alignItems:"center",gap:10}}>
                      <div style={{width:56,height:56,borderRadius:"50%",background:`${G}15`,display:"flex",alignItems:"center",justifyContent:"center"}}><Ico d={ic.send} size={26} color={G}/></div>
                      <div style={{fontSize:17,fontWeight:800,color:G}}>Post Queued!</div>
                      <div style={{fontSize:12,color:DIM}}>$100 AUD logged to your account.</div>
                    </div>
                  ):(
                    <>
                      <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:14}}>
                        <div><div className="sec-lbl">Charge</div><div style={{fontSize:14,fontWeight:700,color:INK,marginTop:2}}>{drafts.length} platform{drafts.length!==1?"s":""}</div></div>
                        <div style={{fontSize:24,fontWeight:900,color:INK}}>$100<span style={{fontSize:13,color:DIM,fontWeight:500}}> AUD</span></div>
                      </div>
                      <button onClick={approve} disabled={approving} className="btn-primary">
                        {approving?<span style={{display:"flex",alignItems:"center",justifyContent:"center",gap:8}}><div style={{width:15,height:15,border:"2px solid rgba(255,255,255,.3)",borderTopColor:"#fff",borderRadius:"50%"}} className="spin"/>Processing…</span>:"Approve & Publish →"}
                      </button>
                    </>
                  )}
                </div>
              </>
            )}
          </div>
        )}

        {/* ══ QUEUE ══ */}
        {tab==="calendar"&&(
          <div id="t-queue" style={{display:"flex",flexDirection:"column",gap:14}}>
            <div><h1 className="page-h">Posting Queue</h1><p className="page-sub">Approved posts scheduled for publishing.</p></div>
            {queue.length===0?(
              <div className="card" style={{padding:"52px 24px",textAlign:"center",display:"flex",flexDirection:"column",alignItems:"center",gap:10}}>
                <div style={{width:56,height:56,borderRadius:"50%",background:`${G}12`,display:"flex",alignItems:"center",justifyContent:"center"}}><Ico d={ic.queue} size={24} color={G}/></div>
                <div style={{fontSize:16,fontWeight:800,color:INK}}>Queue is empty</div>
                <p style={{fontSize:13,color:DIM,maxWidth:220,lineHeight:1.6}}>Approved posts will appear here.</p>
              </div>
            ):queue.map((p:any,i:number)=>(
              <div key={p.id||i} className="card" style={{padding:16,display:"flex",gap:12,alignItems:"flex-start"}}>
                <div style={{width:40,height:40,borderRadius:10,background:`${G}12`,display:"flex",alignItems:"center",justifyContent:"center",flexShrink:0}}><Ico d={ic.send} size={16} color={G}/></div>
                <div style={{flex:1,minWidth:0}}>
                  <div style={{display:"flex",alignItems:"center",gap:8,marginBottom:5}}>
                    <PlatBadge platform={p.platform}/>
                    <span className="chip chip-green">Queued</span>
                  </div>
                  <p style={{fontSize:12,color:DIM,lineHeight:1.5,margin:0}}>{p.caption}</p>
                  <div style={{fontSize:11,color:G,marginTop:6,fontWeight:600}}>📅 {fmt(p.scheduledAt)}</div>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* ══ BILLING ══ */}
        {tab==="billing"&&(
          <div id="t-billing" style={{display:"flex",flexDirection:"column",gap:14}}>
            <div><h1 className="page-h">Billing</h1><p className="page-sub">$100 flat fee per approved post.</p></div>

            <div style={{display:"flex",gap:10}}>
              <div style={{flex:1,background:DARK,borderRadius:16,padding:"16px 18px"}}>
                <div className="sec-lbl" style={{color:"#ffffff44",marginBottom:4}}>Total spent</div>
                <div style={{fontSize:28,fontWeight:900,color:"#fff"}}>${(payments.length*100).toFixed(2)}</div>
                <div style={{fontSize:11,color:"#ffffff33",marginTop:2}}>AUD</div>
              </div>
              <div className="card" style={{flex:1,padding:"16px 18px"}}>
                <div className="sec-lbl" style={{marginBottom:4}}>Invoices</div>
                <div style={{fontSize:28,fontWeight:900,color:INK}}>{payments.length}</div>
                <div style={{fontSize:11,color:DIM,marginTop:2}}>all paid</div>
              </div>
            </div>

            {payments.length===0&&<div style={{background:`${G}10`,border:`1px solid ${G}28`,borderRadius:12,padding:"11px 14px",display:"flex",alignItems:"center",gap:8}}><Ico d={ic.check} size={16} color={G}/><span style={{color:INK,fontWeight:600,fontSize:14}}>No invoices yet.</span></div>}

            {payments.length>0&&(
              <div className="card" style={{padding:18}}>
                <div className="sec-lbl" style={{marginBottom:12}}>History</div>
                {payments.map(p=>(
                  <div key={p.id} style={{display:"flex",alignItems:"center",gap:14,padding:"12px 0",borderBottom:`1px solid ${LINE}`}}>
                    <div style={{width:36,height:36,borderRadius:10,flexShrink:0,background:`${G}10`,display:"flex",alignItems:"center",justifyContent:"center"}}><Ico d={ic.check} size={16} color={G}/></div>
                    <div style={{flex:1}}>
                      <div style={{fontSize:13,fontWeight:600,color:INK}}>Social Post Fee</div>
                      <div style={{fontSize:11,color:DIM,marginTop:1}}>{new Date(p.created_at).toLocaleDateString("en-AU")} · #{p.id?.slice(0,8)}</div>
                    </div>
                    <div style={{textAlign:"right"}}>
                      <div style={{fontSize:14,fontWeight:700,color:INK}}>$100.00</div>
                      <span className="chip chip-green" style={{marginTop:3}}>Paid</span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* ══ REPORTS ══ */}
        {tab==="reports"&&(
          <div style={{display:"flex",flexDirection:"column",gap:14}}>
            <div><h1 className="page-h">Reports</h1><p className="page-sub">Monthly performance summaries.</p></div>
            <div style={{background:DARK,borderRadius:16,padding:"14px 18px",display:"flex",justifyContent:"space-between",alignItems:"center"}}>
              <div><div style={{fontSize:12,color:"#ffffff55",marginBottom:2}}>Next report</div><div style={{fontWeight:700,fontSize:15,color:"#fff"}}>June 2026</div><div style={{fontSize:12,color:"#ffffff44",marginTop:2}}>Auto-emailed Jul 1</div></div>
              <div style={{background:`${G}22`,borderRadius:10,padding:"10px 14px",textAlign:"center"}}><div style={{fontWeight:900,fontSize:20,color:G}}>2</div><div style={{fontSize:11,color:G,fontWeight:600}}>days</div></div>
            </div>
            {[
              {month:"May 2026",count:4,reach:"12.4K",eng:"8.2%",trend:"+14%",note:"Strong month. Engagement up 14%. LinkedIn outperforming Facebook."},
              {month:"April 2026",count:3,reach:"9.8K",eng:"7.1%",trend:"+11%",note:"Solid start. Logo reveal drove brand awareness. Facebook leading traffic."},
              {month:"March 2026",count:2,reach:"5.2K",eng:"6.4%",trend:"—",note:"First live month. Audience building steadily."},
            ].map(r=>(
              <div key={r.month} className="card" style={{padding:16}}>
                <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:12}}>
                  <div style={{fontWeight:800,fontSize:15,color:INK}}>{r.month}</div>
                  {r.trend!=="—"&&<span style={{fontSize:11,fontWeight:700,color:G,background:`${G}12`,padding:"3px 9px",borderRadius:20}}>{r.trend}</span>}
                </div>
                <div style={{display:"grid",gridTemplateColumns:"repeat(3,1fr)",gap:10,background:BG,padding:12,borderRadius:12,marginBottom:12}}>
                  {[{l:"Posts",v:r.count,c:INK},{l:"Reach",v:r.reach,c:INK},{l:"Engagement",v:r.eng,c:G}].map(s=>(
                    <div key={s.l} style={{textAlign:"center"}}><div style={{fontSize:10,color:DIM,marginBottom:3,textTransform:"uppercase",letterSpacing:".04em",fontWeight:700}}>{s.l}</div><div style={{fontSize:18,fontWeight:800,color:s.c}}>{s.v}</div></div>
                  ))}
                </div>
                <p style={{fontSize:12,color:DIM,lineHeight:1.6,margin:0}}>{r.note}</p>
              </div>
            ))}
          </div>
        )}

        {/* ══ BRAND ACCOUNTS ══ */}
        {tab==="stats"&&(
          <div style={{display:"flex",flexDirection:"column",gap:14}}>
            <div><h1 className="page-h">Brand Accounts</h1><p className="page-sub">Connected social channels.</p></div>
            <div style={{background:CARD,borderRadius:16,border:`1px solid ${LINE}`,padding:"0 18px"}}>
              {[{p:"Instagram",h:"@webgecko",s:"Linked",c:"#E1306C"},{p:"Facebook",h:"WebGecko Business",s:"Linked",c:"#1877F2"},{p:"LinkedIn",h:"WebGecko Corp",s:"Linked",c:"#0A66C2"},{p:"TikTok",h:"@webgecko",s:"Awaiting auth",c:"#333"},{p:"X",h:"@webgecko_au",s:"Awaiting auth",c:"#000"}].map((a,i,arr)=>(
                <div key={a.p} style={{display:"flex",justifyContent:"space-between",alignItems:"center",padding:"13px 0",borderBottom:i<arr.length-1?`1px solid ${LINE}`:"none"}}>
                  <div style={{display:"flex",gap:12,alignItems:"center"}}>
                    <div style={{width:38,height:38,borderRadius:10,background:`${a.c}12`,display:"flex",alignItems:"center",justifyContent:"center",fontSize:16}}>{a.p==="Instagram"?"📸":a.p==="Facebook"?"👥":a.p==="LinkedIn"?"💼":a.p==="TikTok"?"🎵":"🐦"}</div>
                    <div><div style={{fontSize:13,fontWeight:700,color:INK}}>{a.p}</div><div style={{fontSize:11,color:DIM,marginTop:1}}>{a.h}</div></div>
                  </div>
                  <span className={`chip ${a.s==="Linked"?"chip-green":"chip-amber"}`}>{a.s}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* ══ PROFILE ══ */}
        {tab==="profile"&&(
          <div id="t-profile" style={{display:"flex",flexDirection:"column",gap:14}}>
            <div><h1 className="page-h">Profile</h1><p className="page-sub">Account details & agreements.</p></div>

            <div className="card" style={{padding:20,display:"flex",gap:14,alignItems:"center"}}>
              <div style={{width:52,height:52,borderRadius:"50%",background:G,display:"flex",alignItems:"center",justifyContent:"center",fontSize:22,fontWeight:800,color:"#fff",flexShrink:0}}>{client?.business_name?.[0]?.toUpperCase()||"C"}</div>
              <div>
                <div style={{fontSize:16,fontWeight:800,color:INK}}>{client?.business_name||client?.slug}</div>
                <div style={{fontSize:12,color:hasSocial?G:DIM,fontWeight:600,marginTop:2}}>{hasSocial?"✦ Social Bundle Active":"Starter Plan"}</div>
              </div>
            </div>

            <div style={{background:CARD,borderRadius:16,border:`1px solid ${LINE}`,padding:"12px 18px"}}>
              <div className="sec-lbl" style={{marginBottom:8}}>Account Details</div>
              {[{label:"Email",value:client?.email||"—"},{label:"Phone",value:client?.phone||"—"},{label:"Plan",value:client?.plan||"Starter"},{label:"Job Ref",value:client?.job_id,mono:true}].map(row=>(
                <div key={row.label} style={{display:"flex",justifyContent:"space-between",alignItems:"center",padding:"10px 0",borderBottom:`1px solid ${LINE}`}}>
                  <span style={{fontSize:12,color:DIM,fontWeight:600}}>{row.label}</span>
                  <span style={{fontSize:13,fontWeight:600,color:INK,fontFamily:row.mono?"monospace":"inherit",maxWidth:"60%",textAlign:"right",wordBreak:"break-all"}}>{row.value}</span>
                </div>
              ))}
            </div>

            <div style={{background:CARD,borderRadius:16,border:`1px solid ${LINE}`,padding:"6px 18px"}}>
              <div className="sec-lbl" style={{marginTop:12,marginBottom:4}}>More</div>
              {[{label:"Monthly Reports",icon:ic.chart,action:()=>setTab("reports")},{label:"Brand Accounts",icon:ic.shield,action:()=>setTab("stats")}].map(r=>(
                <button key={r.label} onClick={r.action} style={{width:"100%",display:"flex",justifyContent:"space-between",alignItems:"center",padding:"13px 0",background:"transparent",border:"none",borderBottom:`1px solid ${LINE}`,color:INK,fontSize:14,cursor:"pointer",fontFamily:"inherit"}}>
                  <span style={{display:"flex",alignItems:"center",gap:10}}><Ico d={r.icon} size={16} color={DIM}/>{r.label}</span><Ico d={ic.chevron} size={16} color={DIM}/>
                </button>
              ))}
            </div>

            <div style={{background:CARD,borderRadius:16,border:`1px solid ${LINE}`,padding:"6px 18px"}}>
              <div className="sec-lbl" style={{marginTop:12,marginBottom:4}}>Legal</div>
              {Object.keys(LEGAL).map(k=>(
                <button key={k} onClick={()=>setLegalDoc(k)} style={{width:"100%",display:"flex",justifyContent:"space-between",alignItems:"center",padding:"13px 0",background:"transparent",border:"none",borderBottom:`1px solid ${LINE}`,color:INK,fontSize:14,cursor:"pointer",fontFamily:"inherit"}}>
                  <span style={{display:"flex",alignItems:"center",gap:10}}><Ico d={ic.doc} size={16} color={DIM}/>{LEGAL[k].title}</span><Ico d={ic.chevron} size={16} color={DIM}/>
                </button>
              ))}
            </div>

            <button onClick={logout} className="btn-danger">Sign Out</button>
          </div>
        )}
      </div>

      {/* ── Bottom Nav ── */}
      <nav className="bnav">
        {NAV.map(n=>{
          const active=tab===n.id;
          return (
            <button key={n.id} onClick={()=>go(n.id as Tab)} className={`nbtn${active?" on":""}`}>
              <span className="nbtn-icon" style={{position:"relative"}}>
                <Ico d={n.icon} size={20} color={active?G:DIM} sw={active?2.2:1.6}/>
                {n.locked&&<span className="nbtn-lock">🔒</span>}
                {active&&<span style={{position:"absolute",bottom:-5,left:"50%",transform:"translateX(-50%)",width:4,height:4,borderRadius:"50%",background:G}}/>}
              </span>
              <span className="nbtn-lbl">{n.label}</span>
            </button>
          );
        })}
      </nav>

      {/* ── Upsell sheet ── */}
      {upsell&&(
        <div style={{position:"fixed",inset:0,zIndex:400,display:"flex",alignItems:"flex-end",justifyContent:"center",padding:"0 0 80px"}}>
          <div style={{position:"absolute",inset:0,background:"rgba(0,0,0,.4)"}} onClick={()=>setUpsell(false)}/>
          <div className="card fade" style={{width:"calc(100% - 32px)",maxWidth:398,padding:28,zIndex:1,textAlign:"center",position:"relative",borderRadius:24}}>
            <button onClick={()=>setUpsell(false)} style={{position:"absolute",top:14,right:14,background:"none",border:"none",color:DIM,cursor:"pointer",padding:4}}><Ico d={ic.x} size={18} color={DIM}/></button>
            <div style={{width:60,height:60,borderRadius:"50%",background:`${G}12`,display:"flex",alignItems:"center",justifyContent:"center",margin:"0 auto 16px"}}><Ico d={ic.lock} size={26} color={G}/></div>
            <div style={{fontWeight:900,fontSize:20,color:INK,marginBottom:8}}>Social Bundle Required</div>
            <p style={{fontSize:13,color:DIM,lineHeight:1.7,marginBottom:22}}>Unlock AI-powered posting from photos, videos, or voice notes. <strong style={{color:INK}}>$100 AUD flat fee</strong> per approved post.</p>
            <div style={{display:"flex",flexDirection:"column",gap:10}}>
              <a href={`mailto:hello@webgecko.au?subject=Activate Social Bundle - ${client?.business_name||client?.slug}`} style={{display:"block",textDecoration:"none"}} className="btn-primary" onClick={()=>setUpsell(false)}>Contact Team to Activate ✉️</a>
              <button onClick={()=>setUpsell(false)} className="btn-ghost">Maybe Later</button>
            </div>
          </div>
        </div>
      )}

      {/* ── Legal sheet ── */}
      {legalDoc&&(
        <div style={{position:"fixed",top:0,bottom:0,left:"50%",transform:"translateX(-50%)",width:"100%",maxWidth:430,zIndex:500,background:BG,display:"flex",flexDirection:"column",borderLeft:`1px solid ${LINE}`,borderRight:`1px solid ${LINE}`}} className="fade">
          <div className="hdr">
            <button onClick={()=>setLegalDoc(null)} style={{background:"none",border:"none",cursor:"pointer",padding:4,display:"flex",alignItems:"center",gap:6,color:G,fontWeight:700,fontSize:14,fontFamily:"inherit"}}><Ico d={ic.back} size={18} color={G}/> Close</button>
            <div style={{fontSize:14,fontWeight:700,color:INK}}>{LEGAL[legalDoc].title}</div>
            <div style={{width:60}}/>
          </div>
          <div style={{flex:1,padding:24,overflowY:"auto",lineHeight:1.8,fontSize:14,color:DIM}}>
            <div style={{fontSize:11,color:DIM,marginBottom:16,fontWeight:600}}>Updated: {LEGAL[legalDoc].updated}</div>
            <p>{LEGAL[legalDoc].body}</p>
          </div>
        </div>
      )}

      {/* ── Tour ── */}
      {tourOn&&(
        <>
          <div className="tour-overlay"/>
          <div className="tour-card" style={{top:tourY,bottom:"auto"}}>
            <div className="tour-prog"><div className="tour-prog-fill" style={{width:`${((tourStep+1)/TOUR.length)*100}%`}}/></div>
            <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:12}}>
              <span style={{fontSize:11,color:DIM,fontWeight:600}}>Step {tourStep+1} of {TOUR.length}</span>
              <button onClick={endTour} style={{background:"none",border:"none",cursor:"pointer",padding:4}}><Ico d={ic.x} size={16} color={DIM}/></button>
            </div>
            <div style={{display:"flex",gap:12,marginBottom:10}}>
              <div style={{width:42,height:42,borderRadius:12,background:`${G}12`,display:"flex",alignItems:"center",justifyContent:"center",fontSize:20,flexShrink:0}}>{TOUR[tourStep].emoji}</div>
              <div style={{fontSize:14,fontWeight:800,color:INK,lineHeight:1.35,alignSelf:"center"}}>{TOUR[tourStep].title}</div>
            </div>
            <p style={{fontSize:13,color:DIM,lineHeight:1.7,marginBottom:18}}>{TOUR[tourStep].desc}</p>
            <div style={{display:"flex",gap:8}}>
              {tourStep>0&&<button onClick={tourPrev} className="btn-sm-outline" style={{flex:1}}>← Back</button>}
              <button onClick={tourNext} className="btn-sm" style={{flex:2,borderRadius:10}}>{tourStep===TOUR.length-1?"Finish 🎉":"Next →"}</button>
            </div>
            {tourStep===0&&<button onClick={endTour} style={{width:"100%",marginTop:10,background:"none",border:"none",color:DIM,fontSize:11,cursor:"pointer",fontFamily:"inherit"}}>Skip tour</button>}
          </div>
        </>
      )}
    </div>
  );
}
