"use client";
import { useState, useEffect, useRef } from "react";
import { supabasePublic } from "@/lib/supabase";

// ─────────────────────────────────────────────────────────────
//  GLOBAL CSS
// ─────────────────────────────────────────────────────────────
const CSS = `
  @import url('https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700;800&family=Outfit:wght@400;600;700;800;900&display=swap');

  *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }

  html, body { height: 100%; }

  body {
    background: #06080f;
    color: #e2e4ec;
    font-family: 'Inter', -apple-system, sans-serif;
    min-height: 100vh;
    overflow-x: hidden;
  }

  /* ── Scrollbar ── */
  ::-webkit-scrollbar { width: 6px; }
  ::-webkit-scrollbar-track { background: transparent; }
  ::-webkit-scrollbar-thumb { background: rgba(255,255,255,0.08); border-radius: 3px; }

  /* ── Glass card ── */
  .gc {
    background: rgba(14, 18, 36, 0.7);
    backdrop-filter: blur(20px);
    -webkit-backdrop-filter: blur(20px);
    border: 1px solid rgba(255,255,255,0.06);
    border-radius: 16px;
    box-shadow: 0 4px 32px rgba(0,0,0,0.4), inset 0 1px 0 rgba(255,255,255,0.04);
  }

  /* ── Sidebar ── */
  .sidebar {
    position: fixed;
    top: 0; left: 0;
    width: 260px;
    height: 100vh;
    background: #080b14;
    border-right: 1px solid rgba(255,255,255,0.05);
    display: flex;
    flex-direction: column;
    z-index: 50;
    transition: transform 0.3s cubic-bezier(0.16,1,0.3,1);
  }

  /* Mobile: hidden by default */
  @media (max-width: 1023px) {
    .sidebar { transform: translateX(-100%); }
    .sidebar.mobile-open { transform: translateX(0); box-shadow: 20px 0 60px rgba(0,0,0,0.8); }
  }

  /* ── Main layout ── */
  .app-layout {
    min-height: 100vh;
    display: flex;
    flex-direction: column;
  }

  @media (min-width: 1024px) {
    .app-layout { margin-left: 260px; }
    .mobile-only { display: none !important; }
    .bottom-nav { display: none !important; }
  }

  @media (max-width: 1023px) {
    .desktop-only { display: none !important; }
  }

  /* ── Sidebar overlay (mobile) ── */
  .sidebar-overlay {
    display: none;
    position: fixed; inset: 0;
    background: rgba(0,0,0,0.6);
    backdrop-filter: blur(3px);
    z-index: 49;
  }
  .sidebar-overlay.show { display: block; }

  /* ── Top header ── */
  .topbar {
    position: sticky; top: 0; z-index: 40;
    background: rgba(6,8,15,0.9);
    backdrop-filter: blur(16px);
    border-bottom: 1px solid rgba(255,255,255,0.05);
    padding: 0 20px;
    height: 60px;
    display: flex; align-items: center; justify-content: space-between;
  }

  /* ── Bottom nav (mobile) ── */
  .bottom-nav {
    position: fixed; bottom: 0; left: 0; width: 100%;
    background: rgba(6,8,15,0.95);
    backdrop-filter: blur(16px);
    border-top: 1px solid rgba(255,255,255,0.06);
    z-index: 40;
    padding: 6px 0 max(8px, env(safe-area-inset-bottom));
  }

  /* ── Sidebar nav item ── */
  .nav-item {
    display: flex; align-items: center; gap: 12px;
    padding: 10px 16px; margin: 2px 10px;
    border-radius: 10px;
    cursor: pointer; border: none;
    background: transparent; color: #6b7280;
    font-size: 13.5px; font-weight: 500;
    font-family: inherit;
    text-align: left; width: calc(100% - 20px);
    transition: all 0.18s ease;
    position: relative;
  }
  .nav-item:hover { background: rgba(255,255,255,0.04); color: #d1d5db; }
  .nav-item.active {
    background: rgba(99,102,241,0.12);
    color: #a5b4fc;
    border: 1px solid rgba(99,102,241,0.18);
  }
  .nav-item.active .nav-dot {
    width: 4px; height: 4px; border-radius: 50%;
    background: #6366f1; margin-left: auto;
  }
  .nav-item .nav-icon { font-size: 16px; flex-shrink: 0; width: 20px; text-align: center; }
  .nav-item.locked { opacity: 0.5; }
  .nav-section-label {
    padding: 16px 26px 6px;
    font-size: 10px; font-weight: 700; color: #374151;
    text-transform: uppercase; letter-spacing: 0.1em;
  }

  /* ── Content area ── */
  .content-area {
    flex: 1;
    padding: 28px 32px 100px;
    max-width: 1180px;
    width: 100%;
    margin: 0 auto;
  }
  @media (max-width: 768px) {
    .content-area { padding: 20px 16px 88px; }
  }

  /* ── Cards / Stats ── */
  .stat-grid { display: grid; gap: 14px; }
  @media (min-width: 640px) { .stat-grid-2 { grid-template-columns: repeat(2, 1fr); } }
  @media (min-width: 1024px) { .stat-grid-3 { grid-template-columns: repeat(3, 1fr); } .stat-grid-4 { grid-template-columns: repeat(4, 1fr); } }

  /* ── Inputs ── */
  .inp {
    width: 100%; background: rgba(10,13,26,0.8);
    border: 1px solid rgba(255,255,255,0.07);
    border-radius: 10px; padding: 11px 14px;
    color: #e2e4ec; font-size: 14px; font-family: inherit;
    transition: border-color 0.2s, box-shadow 0.2s;
  }
  .inp:focus { outline: none; border-color: #6366f1; box-shadow: 0 0 0 3px rgba(99,102,241,0.12); }

  /* ── Buttons ── */
  .btn-primary {
    background: linear-gradient(135deg, #6366f1, #4f46e5);
    color: #fff; border: none; border-radius: 10px;
    padding: 12px 20px; font-size: 14px; font-weight: 700;
    cursor: pointer; font-family: inherit;
    box-shadow: 0 4px 20px rgba(99,102,241,0.3);
    transition: all 0.2s ease;
    display: inline-flex; align-items: center; gap: 8px;
  }
  .btn-primary:hover { transform: translateY(-1px); box-shadow: 0 6px 28px rgba(99,102,241,0.4); }
  .btn-primary:disabled { opacity: 0.5; cursor: not-allowed; transform: none; }
  .btn-ghost {
    background: rgba(255,255,255,0.04); color: #9ca3af;
    border: 1px solid rgba(255,255,255,0.08); border-radius: 10px;
    padding: 11px 18px; font-size: 13px; font-weight: 600;
    cursor: pointer; font-family: inherit; transition: all 0.2s;
  }
  .btn-ghost:hover { background: rgba(255,255,255,0.07); color: #e2e4ec; }
  .btn-success {
    background: linear-gradient(135deg, #10b981, #059669);
    color: #fff; border: none; border-radius: 10px;
    padding: 12px 20px; font-size: 14px; font-weight: 700;
    cursor: pointer; font-family: inherit;
    box-shadow: 0 4px 20px rgba(16,185,129,0.25);
    transition: all 0.2s; width: 100%;
  }
  .btn-success:hover { transform: translateY(-1px); }
  .btn-success:disabled { opacity: 0.5; cursor: not-allowed; transform: none; }

  /* ── Fade in ── */
  .fade-in { animation: fadeUp 0.3s cubic-bezier(0.16,1,0.3,1) forwards; }
  @keyframes fadeUp {
    from { opacity: 0; transform: translateY(10px); }
    to { opacity: 1; transform: translateY(0); }
  }

  /* ── Pulse animation ── */
  .pulse-rec { animation: pulseRec 1.5s infinite; }
  @keyframes pulseRec {
    0% { box-shadow: 0 0 0 0 rgba(239,68,68,0.5); }
    70% { box-shadow: 0 0 0 10px rgba(239,68,68,0); }
    100% { box-shadow: 0 0 0 0 rgba(239,68,68,0); }
  }

  /* ── Visualizer ── */
  .vbar {
    width: 3px; height: 6px;
    background: linear-gradient(to top, #6366f1, #a5b4fc);
    border-radius: 2px; transition: height 0.08s ease;
  }

  /* ── Badge ── */
  .badge {
    display: inline-flex; align-items: center;
    padding: 3px 10px; border-radius: 20px;
    font-size: 11px; font-weight: 700;
  }
  .badge-green { background: rgba(16,185,129,0.12); color: #10b981; border: 1px solid rgba(16,185,129,0.2); }
  .badge-purple { background: rgba(99,102,241,0.12); color: #a5b4fc; border: 1px solid rgba(99,102,241,0.2); }
  .badge-amber { background: rgba(245,158,11,0.12); color: #f59e0b; border: 1px solid rgba(245,158,11,0.2); }
  .badge-red { background: rgba(239,68,68,0.12); color: #f87171; border: 1px solid rgba(239,68,68,0.2); }

  /* ── Platform pill ── */
  .platform-pill {
    display: inline-flex; align-items: center; gap: 6px;
    padding: 6px 14px; border-radius: 30px;
    font-size: 12px; font-weight: 600; cursor: pointer;
    transition: all 0.18s ease; border: 1px solid rgba(255,255,255,0.08);
    background: rgba(255,255,255,0.03); color: #6b7280;
  }
  .platform-pill.active-plat { color: #fff; }

  /* ── Section header ── */
  .section-head { margin-bottom: 24px; }
  .section-head h1 { font-family: 'Outfit', sans-serif; font-size: 26px; font-weight: 900; letter-spacing: -0.03em; color: #f3f4f6; }
  .section-head h2 { font-family: 'Outfit', sans-serif; font-size: 20px; font-weight: 800; letter-spacing: -0.02em; color: #f3f4f6; }
  .section-head p { font-size: 13px; color: #6b7280; margin-top: 4px; }

  /* ── Upsell card ── */
  .upsell-card {
    padding: 22px;
    background: linear-gradient(135deg, rgba(99,102,241,0.08), rgba(99,102,241,0.02));
    border: 1px solid rgba(99,102,241,0.2);
    border-radius: 16px;
  }

  /* ── Tour spotlight ── */
  .tour-highlight {
    position: relative;
    z-index: 200;
    border-radius: 12px;
    box-shadow: 0 0 0 4px rgba(99,102,241,0.6), 0 0 0 9999px rgba(0,0,0,0.7);
    pointer-events: none;
  }

  /* ── Tour card ── */
  .tour-card {
    position: fixed;
    z-index: 300;
    width: 340px;
    padding: 28px;
    background: #0e1220;
    border: 1px solid rgba(99,102,241,0.35);
    border-radius: 18px;
    box-shadow: 0 24px 80px rgba(0,0,0,0.8), 0 0 0 1px rgba(99,102,241,0.1);
    animation: fadeUp 0.3s ease forwards;
  }
  .tour-progress-bar {
    height: 3px; border-radius: 2px;
    background: rgba(255,255,255,0.06);
    margin-bottom: 20px; overflow: hidden;
  }
  .tour-progress-fill {
    height: 100%; border-radius: 2px;
    background: linear-gradient(90deg, #6366f1, #a5b4fc);
    transition: width 0.4s ease;
  }

  /* ── Login screen ── */
  .login-bg {
    min-height: 100vh;
    background: #06080f;
    display: flex; align-items: center; justify-content: center;
    padding: 24px;
    position: relative; overflow: hidden;
  }
  .login-orb {
    position: absolute;
    border-radius: 50%; filter: blur(80px); pointer-events: none;
  }

  /* ── Divider ── */
  .divider { height: 1px; background: rgba(255,255,255,0.05); margin: 20px 0; }

  /* ── Label ── */
  .label { font-size: 11px; font-weight: 700; color: #6b7280; text-transform: uppercase; letter-spacing: 0.08em; margin-bottom: 6px; display: block; }
`;

// ─────────────────────────────────────────────────────────────
//  LEGAL DOCS
// ─────────────────────────────────────────────────────────────
const LEGAL_DOCS: Record<string, { title: string; updated: string; body: string }> = {
  tos: {
    title: "Terms of Service",
    updated: "1 June 2026",
    body: "These Terms of Service govern your use of the WebGecko Client Hub and social media companion services. Final post approvals authorize us to publish on your behalf, logging flat-fee charges of $100.00 AUD per confirmed post.",
  },
  privacy: {
    title: "Privacy Policy",
    updated: "1 June 2026",
    body: "WebGecko takes privacy seriously. Media files, briefs, and voiceover transcripts uploaded are securely processed for AI caption drafting and platform publishing. We do not sell or monetize client details.",
  },
  agreement: {
    title: "Social Media Service Agreement",
    updated: "1 June 2026",
    body: "This agreement formalizes details of the Social Media Posting bundle. The fee is a flat $100.00 AUD billed instantly to the card on file upon client manual draft approval in the portal. Published posts are queued automatically.",
  },
};

// ─────────────────────────────────────────────────────────────
//  ONBOARDING TOUR STEPS
// ─────────────────────────────────────────────────────────────
const TOUR_STEPS = [
  {
    tab: "home",
    targetId: "tour-hub-welcome",
    title: "Welcome to your Client Hub 👋",
    desc: "This is your all-in-one dashboard for managing your website project, social media content, billing, and more. Let us show you around.",
    emoji: "🏠",
  },
  {
    tab: "home",
    targetId: "tour-quick-metrics",
    title: "Your snapshot at a glance",
    desc: "These cards show your current plan, number of invoices, and website build status. Everything important, front and center.",
    emoji: "📊",
  },
  {
    tab: "create",
    targetId: "tour-create-media",
    title: "Create a new social post",
    desc: "Upload photos or videos directly from your device. Our AI will analyse your media and craft platform-perfect captions.",
    emoji: "📸",
  },
  {
    tab: "create",
    targetId: "tour-create-voice",
    title: "Add a voiceover instruction",
    desc: "Don't want to type? Hit record and talk through what you want the post to say. We'll transcribe it and feed it to the AI.",
    emoji: "🎤",
  },
  {
    tab: "create",
    targetId: "tour-create-brief",
    title: "Write a quick brief",
    desc: "Add any extra context — tone, promotions, specific messages. The more you tell the AI, the better the captions.",
    emoji: "✍️",
  },
  {
    tab: "review",
    targetId: "tour-review-section",
    title: "Review your AI-generated drafts",
    desc: "After generation, each platform gets its own mockup with an editable caption. Tweak anything before you approve.",
    emoji: "👁️",
  },
  {
    tab: "calendar",
    targetId: "tour-queue-section",
    title: "Posting Queue",
    desc: "Once you approve a post, it lands here. You'll see the scheduled date, platform, and charge reference for every post we've queued.",
    emoji: "📅",
  },
  {
    tab: "billing",
    targetId: "tour-billing-section",
    title: "Billing & Invoices",
    desc: "Every approved post logs a $100 flat-fee charge here. Full transparency on what's been billed and when.",
    emoji: "💳",
  },
  {
    tab: "profile",
    targetId: "tour-profile-section",
    title: "Profile & Legal",
    desc: "Your account details and all legal agreements live here. You're all set — let's start creating!",
    emoji: "⚙️",
  },
];

// ─────────────────────────────────────────────────────────────
//  MAIN COMPONENT
// ─────────────────────────────────────────────────────────────
export default function ClientHub() {
  // ── Auth ──
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [authLoading, setAuthLoading] = useState(true);
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [loginError, setLoginError] = useState("");
  const [loginLoading, setLoginLoading] = useState(false);
  const [client, setClient] = useState<any>(null);

  // ── Nav ──
  type Tab = "home" | "create" | "review" | "calendar" | "billing" | "reports" | "stats" | "profile";
  const [activeTab, setActiveTab] = useState<Tab>("home");
  const [mobileSidebarOpen, setMobileSidebarOpen] = useState(false);
  const [showUpsell, setShowUpsell] = useState(false);
  const [activeLegalDoc, setActiveLegalDoc] = useState<string | null>(null);

  // ── Create Post ──
  const [brief, setBrief] = useState("");
  const [tone, setTone] = useState("friendly");
  const [selectedPlatforms, setSelectedPlatforms] = useState<string[]>(["instagram", "facebook"]);
  const [files, setFiles] = useState<File[]>([]);
  const [previewUrls, setPreviewUrls] = useState<string[]>([]);

  // ── Voice ──
  const [isRecording, setIsRecording] = useState(false);
  const [voiceBlob, setVoiceBlob] = useState<Blob | null>(null);
  const [voiceUrl, setVoiceUrl] = useState("");
  const [voiceTranscript, setVoiceTranscript] = useState("");
  const [speechSupported, setSpeechSupported] = useState(false);

  // ── Drafts ──
  const [isGenerating, setIsGenerating] = useState(false);
  const [drafts, setDrafts] = useState<any[]>([]);
  const [generatedMediaUrls, setGeneratedMediaUrls] = useState<string[]>([]);
  const [approving, setApproving] = useState(false);
  const [approvalSuccess, setApprovalSuccess] = useState(false);

  // ── DB data ──
  const [payments, setPayments] = useState<any[]>([]);
  const [approvedPosts, setApprovedPosts] = useState<any[]>([]);

  // ── Tour ──
  const [tourActive, setTourActive] = useState(false);
  const [tourStep, setTourStep] = useState(0);
  const [tourPos, setTourPos] = useState({ top: 0, left: 0 });
  const [tourHighlightEl, setTourHighlightEl] = useState<Element | null>(null);

  // ── Refs ──
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const audioCtxRef = useRef<AudioContext | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const recognitionRef = useRef<any>(null);
  const recordingAnimFrame = useRef<number>(0);
  const micStreamRef = useRef<MediaStream | null>(null);

  // ── Computed ──
  const hasSocial =
    client?.metadata?.features?.some((f: string) => f.toLowerCase().includes("social")) ||
    client?.metadata?.features?.some((f: string) => f.toLowerCase().includes("post")) ||
    client?.plan?.toLowerCase().includes("social") ||
    client?.metadata?.socialActive === true;

  // ─────────────────────────────────────────────────
  //  Auth effects
  // ─────────────────────────────────────────────────
  useEffect(() => {
    async function checkAuth() {
      const savedSlug = localStorage.getItem("wg_app_slug");
      if (savedSlug) {
        try {
          const res = await fetch(`/api/client-login?slug=${savedSlug}`);
          if (res.ok) {
            const data = await res.json();
            setClient(data);
            setIsAuthenticated(true);
            await fetchClientDbData(savedSlug, data.job_id);
            setActiveTab(data?.metadata?.socialActive || data?.plan?.toLowerCase().includes("social") ? "create" : "home");
          } else {
            localStorage.removeItem("wg_app_slug");
          }
        } catch {
          localStorage.removeItem("wg_app_slug");
        }
      }
      setAuthLoading(false);
    }
    checkAuth();
  }, []);

  // Speech recognition
  useEffect(() => {
    if (typeof window === "undefined") return;
    const SR = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SR) return;
    setSpeechSupported(true);
    const r = new SR();
    r.continuous = true;
    r.interimResults = true;
    r.lang = "en-AU";
    r.onresult = (event: any) => {
      let final = "", interim = "";
      for (let i = event.resultIndex; i < event.results.length; i++) {
        if (event.results[i].isFinal) final += event.results[i][0].transcript;
        else interim += event.results[i][0].transcript;
      }
      if (final || interim) setVoiceTranscript(p => p + " " + (final || interim));
    };
    recognitionRef.current = r;
  }, []);

  // ─────────────────────────────────────────────────
  //  Tour logic
  // ─────────────────────────────────────────────────
  function startTour() {
    setTourStep(0);
    setTourActive(true);
  }

  function endTour() {
    setTourActive(false);
    if (tourHighlightEl) {
      tourHighlightEl.classList.remove("tour-highlight");
      setTourHighlightEl(null);
    }
    if (client?.slug) {
      localStorage.setItem(`wg_tour_done_${client.slug}`, "1");
    }
  }

  function applyTourStep(step: number) {
    const s = TOUR_STEPS[step];
    if (!s) { endTour(); return; }

    // Remove previous highlight
    if (tourHighlightEl) tourHighlightEl.classList.remove("tour-highlight");

    // Navigate to the right tab
    setActiveTab(s.tab as Tab);
    setMobileSidebarOpen(false);

    // After tab render, find element and compute tooltip position
    setTimeout(() => {
      const el = document.getElementById(s.targetId);
      if (el) {
        el.classList.add("tour-highlight");
        el.scrollIntoView({ behavior: "smooth", block: "center" });
        setTourHighlightEl(el);
        const rect = el.getBoundingClientRect();
        const vw = window.innerWidth;
        const vh = window.innerHeight;
        const cardW = 340;
        const cardH = 260;
        let left = rect.right + 16;
        let top = rect.top;
        if (left + cardW > vw - 16) left = rect.left - cardW - 16;
        if (left < 16) left = vw / 2 - cardW / 2;
        if (top + cardH > vh - 16) top = vh - cardH - 16;
        if (top < 16) top = 16;
        setTourPos({ top, left });
      } else {
        // Fallback: center
        setTourPos({ top: window.innerHeight / 2 - 130, left: window.innerWidth / 2 - 170 });
      }
    }, 320);
  }

  function nextTourStep() {
    const next = tourStep + 1;
    if (next >= TOUR_STEPS.length) { endTour(); return; }
    setTourStep(next);
    applyTourStep(next);
  }

  function prevTourStep() {
    const prev = tourStep - 1;
    if (prev < 0) return;
    setTourStep(prev);
    applyTourStep(prev);
  }

  useEffect(() => {
    if (tourActive) applyTourStep(tourStep);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tourActive]);

  // Auto-trigger tour for new clients
  useEffect(() => {
    if (isAuthenticated && client?.slug) {
      const done = localStorage.getItem(`wg_tour_done_${client.slug}`);
      if (!done) {
        setTimeout(() => startTour(), 800);
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isAuthenticated, client?.slug]);

  // ─────────────────────────────────────────────────
  //  Data fetching
  // ─────────────────────────────────────────────────
  async function fetchClientDbData(slug: string, jobId: string) {
    try {
      const { data: payData } = await supabasePublic
        .from("payments")
        .select("*")
        .eq("client_slug", slug)
        .order("created_at", { ascending: false });
      if (payData) setPayments(payData);

      if (jobId) {
        const { data: jobRow } = await supabasePublic
          .from("jobs")
          .select("metadata")
          .eq("id", jobId)
          .single();
        if (jobRow?.metadata?.approvedPosts) {
          setApprovedPosts([...jobRow.metadata.approvedPosts].reverse());
        }
      }
    } catch (e) {
      console.warn("DB fetch error:", e);
    }
  }

  // ─────────────────────────────────────────────────
  //  Auth handlers
  // ─────────────────────────────────────────────────
  async function handleLogin(e: React.FormEvent) {
    e.preventDefault();
    setLoginError("");
    setLoginLoading(true);
    try {
      const res = await fetch("/api/client-login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username: username.trim(), password: password.trim() }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Invalid credentials");
      localStorage.setItem("wg_app_slug", data.slug);

      const portalRes = await fetch(`/api/client-login?slug=${data.slug}`);
      const portalData = await portalRes.json();
      setClient(portalData);
      setIsAuthenticated(true);
      await fetchClientDbData(data.slug, portalData.job_id);
      const hasSocialNow = portalData?.metadata?.socialActive || portalData?.plan?.toLowerCase().includes("social");
      setActiveTab(hasSocialNow ? "create" : "home");
    } catch (err: any) {
      setLoginError(err.message || "Login failed");
    } finally {
      setLoginLoading(false);
    }
  }

  function handleLogout() {
    localStorage.removeItem("wg_app_slug");
    setIsAuthenticated(false);
    setClient(null);
    setActiveTab("home");
    setMobileSidebarOpen(false);
  }

  // ─────────────────────────────────────────────────
  //  Tab navigation
  // ─────────────────────────────────────────────────
  function goTab(t: Tab) {
    const socialTabs: Tab[] = ["create", "review", "calendar"];
    if (socialTabs.includes(t) && !hasSocial) {
      setShowUpsell(true);
      return;
    }
    setActiveTab(t);
    setMobileSidebarOpen(false);
  }

  // ─────────────────────────────────────────────────
  //  File handlers
  // ─────────────────────────────────────────────────
  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const picked = Array.from(e.target.files || []);
    setFiles(p => [...p, ...picked].slice(0, 5));
    setPreviewUrls(p => [...p, ...picked.map(f => URL.createObjectURL(f))].slice(0, 5));
  }
  function removeFile(i: number) {
    setFiles(p => p.filter((_, j) => j !== i));
    setPreviewUrls(p => p.filter((_, j) => j !== i));
  }

  // ─────────────────────────────────────────────────
  //  Voice recorder
  // ─────────────────────────────────────────────────
  async function startRecording() {
    setVoiceTranscript(""); setVoiceBlob(null); setVoiceUrl("");
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      micStreamRef.current = stream;
      setIsRecording(true);
      const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
      if (AudioCtx) {
        const ctx = new AudioCtx();
        const src = ctx.createMediaStreamSource(stream);
        const analyser = ctx.createAnalyser();
        analyser.fftSize = 64;
        src.connect(analyser);
        audioCtxRef.current = ctx;
        analyserRef.current = analyser;
        drawViz();
      }
      if (recognitionRef.current) recognitionRef.current.start();
      const recorder = new MediaRecorder(stream);
      const chunks: Blob[] = [];
      recorder.ondataavailable = e => { if (e.data?.size > 0) chunks.push(e.data); };
      recorder.onstop = () => {
        const blob = new Blob(chunks, { type: "audio/wav" });
        setVoiceBlob(blob);
        setVoiceUrl(URL.createObjectURL(blob));
      };
      mediaRecorderRef.current = recorder;
      recorder.start();
    } catch {
      alert("Microphone permission denied.");
      setIsRecording(false);
    }
  }

  function stopRecording() {
    setIsRecording(false);
    mediaRecorderRef.current?.stop();
    recognitionRef.current?.stop();
    micStreamRef.current?.getTracks().forEach(t => t.stop());
    cancelAnimationFrame(recordingAnimFrame.current);
    audioCtxRef.current?.close();
  }

  function drawViz() {
    const analyser = analyserRef.current;
    if (!analyser) return;
    const data = new Uint8Array(analyser.frequencyBinCount);
    const draw = () => {
      recordingAnimFrame.current = requestAnimationFrame(draw);
      analyser.getByteFrequencyData(data);
      document.querySelectorAll(".vbar").forEach((b: any, i) => {
        if (data[i] !== undefined) b.style.height = `${Math.max(5, (data[i] / 255) * 40)}px`;
      });
    };
    draw();
  }

  // ─────────────────────────────────────────────────
  //  AI draft generation
  // ─────────────────────────────────────────────────
  async function handleGenerateDrafts() {
    if (!brief.trim() && !voiceTranscript.trim() && files.length === 0) {
      alert("Add media, a brief, or record a voice note first.");
      return;
    }
    setIsGenerating(true);
    setDrafts([]);
    try {
      const fd = new FormData();
      fd.append("slug", client.slug);
      fd.append("brief", brief);
      fd.append("tone", tone);
      fd.append("platforms", JSON.stringify(selectedPlatforms));
      fd.append("voiceTranscript", voiceTranscript);
      files.forEach(f => fd.append("files", f));
      if (voiceBlob) fd.append("voiceover", voiceBlob, "voiceover.wav");

      const res = await fetch("/api/client/social-upload-app", { method: "POST", body: fd });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Generation failed");
      setDrafts(data.drafts);
      setGeneratedMediaUrls(data.mediaUrls);
      setActiveTab("review");
    } catch (e: any) {
      alert("Error: " + e.message);
    } finally {
      setIsGenerating(false);
    }
  }

  // ─────────────────────────────────────────────────
  //  Post approval
  // ─────────────────────────────────────────────────
  async function handleApprove() {
    setApproving(true);
    try {
      const payload = {
        slug: client.slug,
        posts: drafts.map(d => ({
          platform: d.platform, caption: d.caption,
          hashtags: d.hashtags, scheduledAt: d.scheduledAt,
          mediaUrls: generatedMediaUrls,
        })),
      };
      const res = await fetch("/api/client/social-approve", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Approval failed");
      setApprovalSuccess(true);
      triggerConfetti();
      await fetchClientDbData(client.slug, client.job_id);
      setTimeout(() => {
        setApprovalSuccess(false);
        setBrief(""); setFiles([]); setPreviewUrls([]);
        setVoiceBlob(null); setVoiceUrl(""); setVoiceTranscript("");
        setDrafts([]);
        setActiveTab("calendar");
      }, 4000);
    } catch (e: any) {
      alert("Failed: " + e.message);
    } finally {
      setApproving(false);
    }
  }

  function handleCaptionChange(i: number, val: string) {
    const u = [...drafts];
    u[i].caption = val;
    setDrafts(u);
  }

  // ─────────────────────────────────────────────────
  //  Confetti
  // ─────────────────────────────────────────────────
  function triggerConfetti() {
    const canvas = canvasRef.current;
    if (!canvas) return;
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    const colors = ["#6366f1", "#a5b4fc", "#10b981", "#3b82f6", "#f59e0b"];
    const pieces = Array.from({ length: 130 }, () => ({
      x: Math.random() * canvas.width,
      y: canvas.height + 20,
      vx: (Math.random() - 0.5) * 8,
      vy: -Math.random() * 16 - 10,
      size: Math.random() * 8 + 3,
      color: colors[Math.floor(Math.random() * colors.length)],
      rotation: Math.random() * 360,
      rSpeed: Math.random() * 4 - 2,
    }));
    const animate = () => {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      let active = false;
      pieces.forEach(p => {
        p.x += p.vx; p.y += p.vy; p.vy += 0.35; p.rotation += p.rSpeed;
        ctx.save(); ctx.translate(p.x, p.y); ctx.rotate((p.rotation * Math.PI) / 180);
        ctx.fillStyle = p.color; ctx.fillRect(-p.size / 2, -p.size / 2, p.size, p.size);
        ctx.restore();
        if (p.y < canvas.height + 20) active = true;
      });
      if (active) requestAnimationFrame(animate);
      else ctx.clearRect(0, 0, canvas.width, canvas.height);
    };
    animate();
  }

  // ─────────────────────────────────────────────────
  //  Helpers
  // ─────────────────────────────────────────────────
  const fmtDate = (iso: string) =>
    new Date(iso).toLocaleDateString("en-AU", { weekday: "short", day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" });

  // ─────────────────────────────────────────────────
  //  RENDER: Loading
  // ─────────────────────────────────────────────────
  if (authLoading) {
    return (
      <div style={{ minHeight: "100vh", background: "#06080f", display: "flex", alignItems: "center", justifyContent: "center" }}>
        <style>{CSS}</style>
        <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 16 }}>
          <div style={{ width: 44, height: 44, border: "3px solid rgba(99,102,241,0.15)", borderTopColor: "#6366f1", borderRadius: "50%", animation: "spin 1s linear infinite" }} />
          <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
          <span style={{ color: "#6b7280", fontSize: 13 }}>Loading your portal…</span>
        </div>
      </div>
    );
  }

  // ─────────────────────────────────────────────────
  //  RENDER: Login
  // ─────────────────────────────────────────────────
  if (!isAuthenticated) {
    return (
      <div className="login-bg">
        <style>{CSS}</style>
        {/* Orbs */}
        <div className="login-orb" style={{ width: 600, height: 600, top: "-200px", left: "50%", transform: "translateX(-50%)", background: "radial-gradient(circle, rgba(99,102,241,0.08) 0%, transparent 70%)" }} />
        <div className="login-orb" style={{ width: 400, height: 400, bottom: "-100px", right: "-100px", background: "radial-gradient(circle, rgba(16,185,129,0.06) 0%, transparent 70%)" }} />

        <div style={{ width: "100%", maxWidth: 420, position: "relative", zIndex: 1 }}>
          {/* Logo */}
          <div style={{ textAlign: "center", marginBottom: 36 }}>
            <div style={{ display: "inline-flex", alignItems: "center", justifyContent: "center", width: 60, height: 60, borderRadius: 18, background: "linear-gradient(135deg, rgba(99,102,241,0.2), rgba(99,102,241,0.08))", border: "1px solid rgba(99,102,241,0.25)", marginBottom: 16, fontSize: 28 }}>🦎</div>
            <h1 style={{ fontFamily: "'Outfit', sans-serif", fontSize: 26, fontWeight: 900, letterSpacing: "-0.03em", color: "#f3f4f6", marginBottom: 4 }}>WebGecko Client Hub</h1>
            <p style={{ fontSize: 13, color: "#6b7280" }}>Your website & social media command centre</p>
          </div>

          {/* Card */}
          <div className="gc" style={{ padding: "36px 32px" }}>
            <form onSubmit={handleLogin} style={{ display: "flex", flexDirection: "column", gap: 18 }}>
              {loginError && (
                <div style={{ background: "rgba(239,68,68,0.08)", border: "1px solid rgba(239,68,68,0.2)", borderRadius: 10, padding: "10px 14px", color: "#f87171", fontSize: 13, display: "flex", alignItems: "center", gap: 8 }}>
                  <span>✕</span> {loginError}
                </div>
              )}
              <div>
                <label className="label">Username / Business name</label>
                <input className="inp" type="text" required value={username} onChange={e => setUsername(e.target.value)} placeholder="your-business-name" autoComplete="username" />
              </div>
              <div>
                <label className="label">Password</label>
                <input className="inp" type="password" required value={password} onChange={e => setPassword(e.target.value)} placeholder="••••••••" autoComplete="current-password" />
              </div>
              <button type="submit" className="btn-primary" disabled={loginLoading} style={{ width: "100%", justifyContent: "center", marginTop: 4 }}>
                {loginLoading ? "Signing in…" : "Sign in to Client Hub →"}
              </button>
            </form>

            <div className="divider" />
            <p style={{ textAlign: "center", fontSize: 12, color: "#4b5563" }}>
              Credentials were emailed to you on signup.&nbsp;
              <a href="mailto:hello@webgecko.au" style={{ color: "#6366f1", textDecoration: "none", fontWeight: 600 }}>Need help?</a>
            </p>
          </div>

          <p style={{ textAlign: "center", fontSize: 11, color: "#1f2937", marginTop: 24 }}>
            Powered by <span style={{ color: "#6366f1", fontWeight: 700 }}>WebGecko</span>
          </p>
        </div>
      </div>
    );
  }

  // ─────────────────────────────────────────────────
  //  RENDER: Portal
  // ─────────────────────────────────────────────────

  // Sidebar nav items
  const NAV = [
    { id: "home", icon: "🏠", label: "Dashboard" },
    { id: "create", icon: "📸", label: "New Post", locked: !hasSocial },
    { id: "review", icon: "✍️", label: "Review Drafts", locked: !hasSocial },
    { id: "calendar", icon: "📅", label: "Posting Queue", locked: !hasSocial },
    null, // divider
    { id: "billing", icon: "💳", label: "Billing & Invoices" },
    { id: "reports", icon: "📊", label: "Monthly Reports" },
    { id: "stats", icon: "📡", label: "Brand Accounts" },
    null, // divider
    { id: "profile", icon: "⚙️", label: "Profile & Legal" },
  ];

  // Current tour step info
  const currentTourStep = TOUR_STEPS[tourStep];

  return (
    <div className="app-layout" style={{ background: "#06080f" }}>
      <style>{CSS}</style>
      <canvas ref={canvasRef} style={{ position: "fixed", inset: 0, pointerEvents: "none", zIndex: 9999 }} />

      {/* ── Mobile sidebar overlay ── */}
      <div className={`sidebar-overlay ${mobileSidebarOpen ? "show" : ""}`} onClick={() => setMobileSidebarOpen(false)} />

      {/* ── Sidebar ── */}
      <aside className={`sidebar ${mobileSidebarOpen ? "mobile-open" : ""}`}>
        {/* Logo */}
        <div style={{ padding: "22px 20px 16px", borderBottom: "1px solid rgba(255,255,255,0.05)" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <div style={{ width: 36, height: 36, borderRadius: 10, background: "linear-gradient(135deg, rgba(99,102,241,0.25), rgba(99,102,241,0.1))", border: "1px solid rgba(99,102,241,0.25)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 18 }}>🦎</div>
            <div>
              <div style={{ fontFamily: "'Outfit', sans-serif", fontSize: 15, fontWeight: 800, color: "#f3f4f6", letterSpacing: "-0.02em" }}>WebGecko</div>
              <div style={{ fontSize: 10, color: "#6366f1", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.04em" }}>Client Hub</div>
            </div>
          </div>
        </div>

        {/* Client card */}
        <div style={{ margin: "12px 10px", padding: "12px 14px", background: "rgba(255,255,255,0.03)", borderRadius: 12, border: "1px solid rgba(255,255,255,0.05)" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <div style={{ width: 32, height: 32, borderRadius: "50%", background: "linear-gradient(135deg, #6366f1, #4f46e5)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 13, fontWeight: 800, color: "#fff", flexShrink: 0 }}>
              {client?.business_name?.[0]?.toUpperCase() || "C"}
            </div>
            <div style={{ minWidth: 0 }}>
              <div style={{ fontSize: 12, fontWeight: 700, color: "#e2e4ec", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{client?.business_name || client?.slug}</div>
              <div style={{ fontSize: 10, color: hasSocial ? "#10b981" : "#6b7280", fontWeight: 600, marginTop: 1 }}>{hasSocial ? "✦ Social Active" : "Starter Plan"}</div>
            </div>
          </div>
        </div>

        {/* Nav */}
        <nav style={{ flex: 1, overflowY: "auto", paddingBottom: 12 }}>
          <div className="nav-section-label">Main</div>
          {NAV.map((item, idx) => {
            if (!item) return <div key={idx} className="divider" style={{ margin: "8px 10px" }} />;
            const isActive = activeTab === item.id;
            return (
              <button
                key={item.id}
                className={`nav-item ${isActive ? "active" : ""} ${item.locked ? "locked" : ""}`}
                onClick={() => goTab(item.id as Tab)}
              >
                <span className="nav-icon">{item.icon}</span>
                <span style={{ flex: 1 }}>{item.label}</span>
                {item.locked && <span style={{ fontSize: 12 }}>🔒</span>}
                {isActive && <span className="nav-dot" />}
              </button>
            );
          })}
        </nav>

        {/* Tour & Logout */}
        <div style={{ borderTop: "1px solid rgba(255,255,255,0.05)", padding: "12px 10px" }}>
          <button className="nav-item" onClick={startTour} style={{ color: "#6366f1" }}>
            <span className="nav-icon">🧭</span> Take the tour
          </button>
          <button className="nav-item" onClick={handleLogout} style={{ color: "#f87171" }}>
            <span className="nav-icon">🚪</span> Sign out
          </button>
        </div>
      </aside>

      {/* ── Top Bar ── */}
      <header className="topbar">
        <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
          {/* Hamburger — mobile only */}
          <button className="mobile-only" onClick={() => setMobileSidebarOpen(true)} style={{ background: "none", border: "none", color: "#9ca3af", cursor: "pointer", fontSize: 22, lineHeight: 1, padding: 4 }}>
            ☰
          </button>
          {/* Breadcrumb — desktop */}
          <div className="desktop-only" style={{ display: "flex", alignItems: "center", gap: 6 }}>
            <span style={{ fontSize: 12, color: "#4b5563" }}>Client Hub</span>
            <span style={{ fontSize: 12, color: "#374151" }}>/</span>
            <span style={{ fontSize: 12, color: "#9ca3af", fontWeight: 600, textTransform: "capitalize" }}>{activeTab}</span>
          </div>
          {/* Mobile logo */}
          <div className="mobile-only" style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <span style={{ fontSize: 20 }}>🦎</span>
            <span style={{ fontFamily: "'Outfit', sans-serif", fontWeight: 800, fontSize: 15, color: "#f3f4f6" }}>WebGecko</span>
          </div>
        </div>

        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <button onClick={startTour} className="desktop-only btn-ghost" style={{ padding: "7px 14px", fontSize: 12 }}>
            🧭 Take the Tour
          </button>
          <div style={{ textAlign: "right" }}>
            <div style={{ fontSize: 12, fontWeight: 700, color: "#e2e4ec" }}>{client?.business_name || client?.slug}</div>
            <div style={{ fontSize: 10, color: hasSocial ? "#10b981" : "#6b7280", fontWeight: 600 }}>{hasSocial ? "Social Active" : "Starter Plan"}</div>
          </div>
          <div style={{ width: 34, height: 34, borderRadius: "50%", background: "linear-gradient(135deg, #6366f1, #4f46e5)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 14, fontWeight: 800, color: "#fff" }}>
            {client?.business_name?.[0]?.toUpperCase() || "C"}
          </div>
        </div>
      </header>

      {/* ── Content ── */}
      <main className="content-area fade-in">

        {/* ══════════════════ HOME / DASHBOARD ══════════════════ */}
        {activeTab === "home" && (
          <div style={{ display: "flex", flexDirection: "column", gap: 24 }}>
            <div id="tour-hub-welcome" className="section-head">
              <h1>Welcome back, {client?.metadata?.name || client?.business_name || "there"} 👋</h1>
              <p>Here's an overview of your digital presence and social media activity.</p>
            </div>

            {/* Metrics */}
            <div id="tour-quick-metrics" style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))", gap: 14 }}>
              {[
                { label: "Current Plan", value: client?.plan || "Starter", color: "#a5b4fc", icon: "✦" },
                { label: "Invoices", value: `${payments.length} logged`, color: "#10b981", icon: "💳" },
                { label: "Build Status", value: client?.build_status || client?.buildStatus || "Active", color: "#3b82f6", icon: "🌐" },
                { label: "Approved Posts", value: approvedPosts.length, color: "#f59e0b", icon: "📬" },
              ].map(s => (
                <div key={s.label} className="gc" style={{ padding: 18 }}>
                  <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between" }}>
                    <div>
                      <div className="label">{s.label}</div>
                      <div style={{ fontSize: 20, fontWeight: 800, color: s.color, marginTop: 4, textTransform: "capitalize" }}>{s.value}</div>
                    </div>
                    <span style={{ fontSize: 22 }}>{s.icon}</span>
                  </div>
                </div>
              ))}
            </div>

            {/* Upsell if no social */}
            {!hasSocial && (
              <div className="upsell-card">
                <div style={{ display: "flex", alignItems: "flex-start", gap: 16, flexWrap: "wrap" }}>
                  <div style={{ fontSize: 42 }}>🚀</div>
                  <div style={{ flex: 1, minWidth: 240 }}>
                    <div style={{ fontSize: 16, fontWeight: 800, color: "#a5b4fc", marginBottom: 6 }}>Unlock Social Media Posting</div>
                    <p style={{ fontSize: 13, color: "#6b7280", lineHeight: 1.6 }}>
                      Take a photo or record a voice note and let AI draft platform-perfect captions for Instagram, Facebook, LinkedIn and more — published for a flat $100/post.
                    </p>
                    <button onClick={() => setShowUpsell(true)} className="btn-primary" style={{ marginTop: 14, fontSize: 13, padding: "9px 18px" }}>
                      Unlock Bundle 🔓
                    </button>
                  </div>
                </div>
              </div>
            )}

            {/* Next post (if social active) */}
            {hasSocial && approvedPosts.length > 0 && (
              <div className="gc" style={{ padding: 20, display: "flex", alignItems: "center", gap: 16 }}>
                <div style={{ width: 48, height: 48, borderRadius: 14, background: "rgba(99,102,241,0.12)", border: "1px solid rgba(99,102,241,0.2)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 22 }}>📅</div>
                <div>
                  <div className="label">Next Scheduled Post</div>
                  <div style={{ fontSize: 14, fontWeight: 700, color: "#e2e4ec", marginTop: 2 }}>
                    {approvedPosts[0].platform.toUpperCase()}: "{approvedPosts[0].caption?.slice(0, 50)}…"
                  </div>
                  <div style={{ fontSize: 11, color: "#6366f1", marginTop: 3 }}>{fmtDate(approvedPosts[0].scheduledAt)}</div>
                </div>
              </div>
            )}

            {/* Quick actions */}
            <div style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
              <button onClick={() => goTab("create")} className="btn-primary" style={{ flex: 1, minWidth: 160, justifyContent: "center" }}>
                📸 Create Post
              </button>
              <button onClick={() => goTab("billing")} className="btn-ghost" style={{ flex: 1, minWidth: 160 }}>
                💳 View Invoices
              </button>
            </div>

            {/* Recent activity */}
            <div className="gc" style={{ padding: 22 }}>
              <div className="label" style={{ marginBottom: 14 }}>Recent Activity</div>
              <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                <div style={{ display: "flex", gap: 12, alignItems: "flex-start" }}>
                  <div style={{ width: 32, height: 32, borderRadius: 8, background: "rgba(99,102,241,0.1)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 14, flexShrink: 0 }}>🎉</div>
                  <div>
                    <div style={{ fontSize: 13, fontWeight: 600, color: "#e2e4ec" }}>Client Portal Activated</div>
                    <div style={{ fontSize: 11, color: "#4b5563", marginTop: 1 }}>Hub services successfully registered.</div>
                  </div>
                </div>
                {payments.slice(0, 3).map(pay => (
                  <div key={pay.id} style={{ display: "flex", gap: 12, alignItems: "flex-start" }}>
                    <div style={{ width: 32, height: 32, borderRadius: 8, background: "rgba(16,185,129,0.1)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 14, flexShrink: 0 }}>💳</div>
                    <div>
                      <div style={{ fontSize: 13, fontWeight: 600, color: "#e2e4ec" }}>Invoice — $100.00 AUD</div>
                      <div style={{ fontSize: 11, color: "#4b5563", marginTop: 1 }}>{new Date(pay.created_at).toLocaleDateString("en-AU")} · Ref #{pay.id?.slice(0, 8)}</div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* ══════════════════ CREATE POST ══════════════════ */}
        {activeTab === "create" && (
          <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
            <div className="section-head">
              <h2>New Social Post</h2>
              <p>Upload your content and let the AI craft platform-perfect captions.</p>
            </div>

            {/* Media upload */}
            <div id="tour-create-media" className="gc" style={{ padding: 22 }}>
              <div className="label" style={{ marginBottom: 12 }}>Upload Media</div>
              <label style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 12, padding: "32px 20px", background: "rgba(99,102,241,0.04)", border: "2px dashed rgba(99,102,241,0.2)", borderRadius: 12, cursor: "pointer", textAlign: "center", transition: "border-color 0.2s" }}>
                <input type="file" accept="image/*,video/*" multiple onChange={handleFileChange} style={{ display: "none" }} />
                <div style={{ width: 52, height: 52, borderRadius: 16, background: "rgba(99,102,241,0.12)", border: "1px solid rgba(99,102,241,0.2)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 24 }}>📸</div>
                <div>
                  <div style={{ fontSize: 14, fontWeight: 700, color: "#a5b4fc" }}>Take Photo / Video or Browse Files</div>
                  <div style={{ fontSize: 12, color: "#4b5563", marginTop: 4 }}>Photos & videos up to 50MB · Max 5 files</div>
                </div>
              </label>
              {previewUrls.length > 0 && (
                <div style={{ display: "grid", gridTemplateColumns: "repeat(5, 1fr)", gap: 8, marginTop: 12 }}>
                  {previewUrls.map((url, i) => (
                    <div key={url} style={{ position: "relative", aspectRatio: "1", borderRadius: 10, overflow: "hidden", border: "1px solid rgba(255,255,255,0.08)" }}>
                      <img src={url} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                      <button onClick={() => removeFile(i)} style={{ position: "absolute", top: 4, right: 4, width: 20, height: 20, borderRadius: "50%", background: "rgba(0,0,0,0.7)", border: "none", color: "#fff", fontSize: 11, cursor: "pointer" }}>×</button>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Voice recorder */}
            <div id="tour-create-voice" className="gc" style={{ padding: 22 }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 14 }}>
                <div className="label" style={{ margin: 0 }}>Voice Instruction</div>
                {speechSupported && <span className="badge badge-green">Live Transcription</span>}
              </div>
              <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
                {isRecording ? (
                  <button className="pulse-rec" onClick={stopRecording} style={{ background: "#ef4444", border: "none", color: "#fff", padding: "10px 20px", borderRadius: 30, fontSize: 12, fontWeight: 700, display: "flex", alignItems: "center", gap: 8, cursor: "pointer" }}>
                    <span style={{ width: 8, height: 8, background: "#fff", borderRadius: "50%" }} /> Stop Recording
                  </button>
                ) : (
                  <button onClick={startRecording} className="btn-primary" style={{ padding: "10px 20px", fontSize: 12, borderRadius: 30 }}>
                    🎤 Record Voiceover
                  </button>
                )}
                {isRecording && (
                  <div style={{ display: "flex", alignItems: "center", gap: 3, height: 40, flex: 1 }}>
                    {Array.from({ length: 16 }).map((_, i) => <div key={i} className="vbar" />)}
                  </div>
                )}
              </div>
              {voiceUrl && (
                <div style={{ marginTop: 14, background: "rgba(10,13,26,0.5)", borderRadius: 10, padding: 12 }}>
                  <div className="label" style={{ marginBottom: 8 }}>Recording Preview</div>
                  <audio src={voiceUrl} controls style={{ width: "100%", height: 36 }} />
                </div>
              )}
              {voiceTranscript && (
                <div style={{ marginTop: 12 }}>
                  <label className="label">Transcription (editable)</label>
                  <textarea className="inp" value={voiceTranscript} onChange={e => setVoiceTranscript(e.target.value)} style={{ minHeight: 70, resize: "vertical" }} />
                </div>
              )}
            </div>

            {/* Brief & settings */}
            <div id="tour-create-brief" className="gc" style={{ padding: 22 }}>
              <div className="label" style={{ marginBottom: 12 }}>Post Brief</div>
              <textarea
                className="inp"
                value={brief}
                onChange={e => setBrief(e.target.value)}
                rows={4}
                placeholder="Describe the post… e.g. 'Completed a roof restoration in Noosa today. 10% off new clients through June.'"
                style={{ resize: "vertical" }}
              />

              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14, marginTop: 14 }}>
                <div>
                  <label className="label">Tone</label>
                  <select className="inp" value={tone} onChange={e => setTone(e.target.value)}>
                    <option value="friendly">Friendly & Warm</option>
                    <option value="professional">Professional & Brand</option>
                    <option value="casual">Casual & Conversational</option>
                    <option value="promotional">Excited & Promotional</option>
                  </select>
                </div>
                <div>
                  <label className="label">Fee per post</label>
                  <div className="inp" style={{ display: "flex", alignItems: "center", gap: 8, cursor: "default" }}>
                    <span style={{ fontSize: 16 }}>💰</span>
                    <span style={{ fontWeight: 700, color: "#a5b4fc" }}>$100 Flat Fee</span>
                  </div>
                </div>
              </div>

              <div style={{ marginTop: 16 }}>
                <label className="label">Platforms</label>
                <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginTop: 6 }}>
                  {["instagram", "facebook", "linkedin", "tiktok", "x"].map(p => {
                    const active = selectedPlatforms.includes(p);
                    const colors: Record<string, string> = { instagram: "#e1306c", facebook: "#1877f2", linkedin: "#0a66c2", tiktok: "#ff0050", x: "#1da1f2" };
                    return (
                      <button
                        key={p}
                        onClick={() => setSelectedPlatforms(prev => active ? prev.filter(x => x !== p) : [...prev, p])}
                        className={`platform-pill ${active ? "active-plat" : ""}`}
                        style={active ? { background: `${colors[p]}18`, borderColor: colors[p], color: colors[p] } : {}}
                      >
                        <span style={{ textTransform: "capitalize" }}>{p}</span>
                        {active && <span>✓</span>}
                      </button>
                    );
                  })}
                </div>
              </div>
            </div>

            {/* Generate button */}
            <button
              onClick={handleGenerateDrafts}
              disabled={isGenerating || (!brief.trim() && !voiceTranscript.trim() && files.length === 0)}
              className="btn-primary"
              style={{ width: "100%", justifyContent: "center", padding: "16px" }}
            >
              {isGenerating ? (
                <>
                  <div style={{ width: 16, height: 16, border: "2px solid rgba(255,255,255,0.3)", borderTopColor: "#fff", borderRadius: "50%", animation: "spin 1s linear infinite" }} />
                  AI Writing Captions…
                </>
              ) : "🚀 Generate Post Drafts"}
            </button>
          </div>
        )}

        {/* ══════════════════ REVIEW DRAFTS ══════════════════ */}
        {activeTab === "review" && (
          <div id="tour-review-section" style={{ display: "flex", flexDirection: "column", gap: 20 }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
              <div className="section-head" style={{ marginBottom: 0 }}>
                <h2>Review Drafts</h2>
                <p>Edit captions inline before approving for publication.</p>
              </div>
              <button onClick={() => setActiveTab("create")} className="btn-ghost" style={{ fontSize: 12, padding: "8px 14px" }}>← Back</button>
            </div>

            {drafts.length === 0 ? (
              <div className="gc" style={{ padding: 56, textAlign: "center" }}>
                <div style={{ fontSize: 48, marginBottom: 16 }}>✍️</div>
                <div style={{ fontSize: 16, fontWeight: 700, color: "#e2e4ec", marginBottom: 8 }}>No drafts to review yet</div>
                <p style={{ fontSize: 13, color: "#6b7280" }}>Go to Create Post, add your content, and generate AI drafts first.</p>
                <button onClick={() => setActiveTab("create")} className="btn-primary" style={{ marginTop: 20, justifyContent: "center" }}>→ Create a Post</button>
              </div>
            ) : (
              <>
                <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(300px, 1fr))", gap: 16 }}>
                  {drafts.map((post, idx) => (
                    <div key={post.platform} className="gc" style={{ overflow: "hidden" }}>
                      {/* Platform header */}
                      <div style={{ padding: "12px 16px", borderBottom: "1px solid rgba(255,255,255,0.06)", display: "flex", alignItems: "center", gap: 10 }}>
                        <div style={{ width: 30, height: 30, borderRadius: "50%", background: "linear-gradient(135deg, #6366f1, #4f46e5)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 12, fontWeight: 800, color: "#fff" }}>
                          {client?.business_name?.[0]?.toUpperCase() || "C"}
                        </div>
                        <div>
                          <div style={{ fontSize: 13, fontWeight: 700, color: "#e2e4ec" }}>{client?.business_name || client?.slug}</div>
                          <div style={{ fontSize: 10, color: "#6366f1", textTransform: "capitalize", fontWeight: 700 }}>{post.platform} Draft</div>
                        </div>
                      </div>
                      {/* Image preview */}
                      {previewUrls.length > 0 && (
                        <div style={{ aspectRatio: "16/9", overflow: "hidden", background: "#0a0d1a" }}>
                          <img src={previewUrls[0]} alt="post" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                        </div>
                      )}
                      {/* Caption */}
                      <div style={{ padding: 16 }}>
                        <textarea
                          value={post.caption}
                          onChange={e => handleCaptionChange(idx, e.target.value)}
                          className="inp"
                          style={{ minHeight: 90, resize: "vertical", background: "transparent", border: "none", padding: 0, color: "#d1d5db", fontSize: 13, lineHeight: 1.6 }}
                        />
                        <div style={{ display: "flex", flexWrap: "wrap", gap: 4, marginTop: 8, borderTop: "1px solid rgba(255,255,255,0.04)", paddingTop: 10 }}>
                          {post.hashtags?.map((tag: string) => <span key={tag} style={{ fontSize: 11, color: "#6366f1", fontWeight: 500 }}>{tag}</span>)}
                        </div>
                        <div style={{ fontSize: 10, color: "#4b5563", marginTop: 8 }}>Best slot: {fmtDate(post.scheduledAt)}</div>
                      </div>
                    </div>
                  ))}
                </div>

                {/* Approval card */}
                <div className="gc" style={{ padding: 22, border: "1px solid rgba(99,102,241,0.25)" }}>
                  {approvalSuccess ? (
                    <div style={{ textAlign: "center", padding: "12px 0" }}>
                      <div style={{ fontSize: 52, marginBottom: 12 }}>🎉</div>
                      <div style={{ fontSize: 18, fontWeight: 800, color: "#10b981", marginBottom: 6 }}>Post Approved & Queued!</div>
                      <p style={{ fontSize: 13, color: "#6b7280" }}>$100.00 flat-fee logged to your billing account.</p>
                    </div>
                  ) : (
                    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 16, flexWrap: "wrap" }}>
                      <div>
                        <div className="label">Charge Summary</div>
                        <div style={{ fontSize: 15, fontWeight: 700, color: "#e2e4ec" }}>Social Media Posting — {drafts.length} platform{drafts.length !== 1 ? "s" : ""}</div>
                      </div>
                      <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
                        <div style={{ fontSize: 22, fontWeight: 800, color: "#10b981" }}>$100.00 AUD</div>
                        <button onClick={handleApprove} disabled={approving} className="btn-success" style={{ width: "auto", padding: "12px 24px" }}>
                          {approving ? "Processing…" : "Approve & Publish →"}
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              </>
            )}
          </div>
        )}

        {/* ══════════════════ POSTING QUEUE ══════════════════ */}
        {activeTab === "calendar" && (
          <div id="tour-queue-section" style={{ display: "flex", flexDirection: "column", gap: 20 }}>
            <div className="section-head">
              <h2>Posting Queue</h2>
              <p>All approved posts scheduled for publication.</p>
            </div>

            {approvedPosts.length === 0 ? (
              <div className="gc" style={{ padding: 56, textAlign: "center" }}>
                <div style={{ fontSize: 48, marginBottom: 16 }}>📅</div>
                <div style={{ fontSize: 16, fontWeight: 700, color: "#e2e4ec", marginBottom: 8 }}>No posts scheduled yet</div>
                <p style={{ fontSize: 13, color: "#6b7280" }}>Approved posts will appear here once you've reviewed and confirmed drafts.</p>
              </div>
            ) : (
              <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                {approvedPosts.map((post: any, i: number) => (
                  <div key={post.id || i} className="gc" style={{ padding: 18, display: "flex", gap: 16, alignItems: "flex-start" }}>
                    <div style={{ width: 40, height: 40, borderRadius: 10, background: "rgba(16,185,129,0.1)", border: "1px solid rgba(16,185,129,0.15)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 18, flexShrink: 0 }}>📱</div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 6, flexWrap: "wrap" }}>
                        <span style={{ fontSize: 13, fontWeight: 700, textTransform: "capitalize", color: "#e2e4ec" }}>{post.platform}</span>
                        <span className="badge badge-green">Queued</span>
                        {post.chargeId && <span style={{ fontSize: 10, color: "#374151" }}>Ref: {post.chargeId}</span>}
                      </div>
                      <p style={{ fontSize: 13, color: "#9ca3af", lineHeight: 1.5 }}>{post.caption}</p>
                      <div style={{ fontSize: 10, color: "#374151", marginTop: 8 }}>📅 Scheduled: {fmtDate(post.scheduledAt)}</div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* ══════════════════ BILLING ══════════════════ */}
        {activeTab === "billing" && (
          <div id="tour-billing-section" style={{ display: "flex", flexDirection: "column", gap: 20 }}>
            <div className="section-head">
              <h2>Billing & Invoices</h2>
              <p>Flat-fee billing records for all approved social posts.</p>
            </div>

            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: 14 }}>
              <div className="gc" style={{ padding: 20 }}>
                <div className="label">Total Charged</div>
                <div style={{ fontSize: 28, fontWeight: 800, color: "#10b981", marginTop: 6 }}>${(payments.length * 100).toFixed(2)} AUD</div>
                <div style={{ fontSize: 11, color: "#4b5563", marginTop: 4 }}>At $100 flat-fee per post</div>
              </div>
              <div className="gc" style={{ padding: 20 }}>
                <div className="label">Invoices Issued</div>
                <div style={{ fontSize: 28, fontWeight: 800, color: "#a5b4fc", marginTop: 6 }}>{payments.length}</div>
                <div style={{ fontSize: 11, color: "#4b5563", marginTop: 4 }}>Paid via card on file</div>
              </div>
            </div>

            <div className="gc" style={{ padding: 22 }}>
              <div className="label" style={{ marginBottom: 14 }}>Billing Activity</div>
              {payments.length === 0 ? (
                <div style={{ textAlign: "center", padding: "32px 0", color: "#4b5563", fontSize: 13 }}>No transactions yet.</div>
              ) : (
                <div style={{ display: "flex", flexDirection: "column" }}>
                  {payments.map(pay => (
                    <div key={pay.id} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "13px 0", borderBottom: "1px solid rgba(255,255,255,0.04)" }}>
                      <div style={{ display: "flex", gap: 12, alignItems: "center" }}>
                        <div style={{ width: 36, height: 36, borderRadius: 8, background: "rgba(16,185,129,0.08)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 16 }}>💳</div>
                        <div>
                          <div style={{ fontSize: 13, fontWeight: 600, color: "#e2e4ec" }}>Social Post Flat Fee</div>
                          <div style={{ fontSize: 11, color: "#4b5563", marginTop: 1 }}>{new Date(pay.created_at).toLocaleDateString("en-AU")} · #{pay.id?.slice(0, 8)}</div>
                        </div>
                      </div>
                      <div style={{ textAlign: "right" }}>
                        <div style={{ fontSize: 14, fontWeight: 700, color: "#10b981" }}>$100.00</div>
                        <span className="badge badge-green" style={{ marginTop: 4 }}>Paid</span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}

        {/* ══════════════════ REPORTS ══════════════════ */}
        {activeTab === "reports" && (
          <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
            <div className="section-head">
              <h2>Monthly Reports</h2>
              <p>Performance summaries emailed monthly. Full history below.</p>
            </div>
            {[
              { month: "May 2026", count: 4, reach: "12.4K", engagement: "8.2%", trend: "+14%", summary: "Strong month — engagement up 14% from April. Team spotlight was your best performer. Focus for June: video content." },
              { month: "April 2026", count: 3, reach: "9.8K", engagement: "7.1%", trend: "+11%", summary: "Solid start. Logo reveal drove strong brand awareness. Facebook driving most traffic." },
              { month: "March 2026", count: 2, reach: "5.2K", engagement: "6.4%", trend: "—", summary: "First full month live. Business intro post performed well. Audience growing steadily." },
            ].map(rep => (
              <div key={rep.month} className="gc" style={{ padding: 22 }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 16 }}>
                  <div>
                    <div style={{ fontSize: 16, fontWeight: 800, color: "#e2e4ec" }}>{rep.month} Report</div>
                    <div style={{ fontSize: 12, color: "#4b5563", marginTop: 2 }}>{rep.count} posts published</div>
                  </div>
                  <div style={{ display: "flex", gap: 8 }}>
                    <span className="badge badge-purple">Published</span>
                    {rep.trend !== "—" && <span className="badge badge-green">{rep.trend}</span>}
                  </div>
                </div>
                <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 12, background: "rgba(255,255,255,0.02)", padding: 14, borderRadius: 10, marginBottom: 14 }}>
                  {[{ l: "Posts", v: rep.count, c: "#a5b4fc" }, { l: "Reach", v: rep.reach, c: "#10b981" }, { l: "Engagement", v: rep.engagement, c: "#3b82f6" }].map(s => (
                    <div key={s.l} style={{ textAlign: "center" }}>
                      <div style={{ fontSize: 10, color: "#6b7280", marginBottom: 4 }}>{s.l}</div>
                      <div style={{ fontSize: 20, fontWeight: 800, color: s.c }}>{s.v}</div>
                    </div>
                  ))}
                </div>
                <p style={{ fontSize: 13, color: "#6b7280", lineHeight: 1.6 }}>{rep.summary}</p>
              </div>
            ))}
          </div>
        )}

        {/* ══════════════════ BRAND ACCOUNTS ══════════════════ */}
        {activeTab === "stats" && (
          <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
            <div className="section-head">
              <h2>Brand Accounts</h2>
              <p>Connected social channels and their current status.</p>
            </div>
            <div className="gc" style={{ padding: 22 }}>
              {[
                { platform: "Instagram", handle: "@webgecko", status: "Linked", color: "#e1306c" },
                { platform: "Facebook", handle: "WebGecko Business", status: "Linked", color: "#1877f2" },
                { platform: "LinkedIn", handle: "WebGecko Corporation", status: "Linked", color: "#0a66c2" },
                { platform: "TikTok", handle: "@webgecko", status: "Awaiting auth", color: "#ff0050" },
                { platform: "X (Twitter)", handle: "@webgecko_au", status: "Awaiting auth", color: "#1da1f2" },
              ].map((acc, i) => (
                <div key={acc.platform} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "14px 0", borderBottom: i < 4 ? "1px solid rgba(255,255,255,0.04)" : "none" }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                    <div style={{ width: 38, height: 38, borderRadius: 10, background: `${acc.color}18`, border: `1px solid ${acc.color}30`, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 18 }}>
                      {acc.platform === "Instagram" ? "📸" : acc.platform === "Facebook" ? "👥" : acc.platform === "LinkedIn" ? "💼" : acc.platform === "TikTok" ? "🎵" : "🐦"}
                    </div>
                    <div>
                      <div style={{ fontSize: 13, fontWeight: 700, color: "#e2e4ec" }}>{acc.platform}</div>
                      <div style={{ fontSize: 11, color: "#6b7280", marginTop: 1 }}>{acc.handle}</div>
                    </div>
                  </div>
                  <span className={`badge ${acc.status === "Linked" ? "badge-green" : "badge-amber"}`}>{acc.status}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* ══════════════════ PROFILE & LEGAL ══════════════════ */}
        {activeTab === "profile" && (
          <div id="tour-profile-section" style={{ display: "flex", flexDirection: "column", gap: 20 }}>
            <div className="section-head">
              <h2>Profile & Legal</h2>
              <p>Your account information and service agreements.</p>
            </div>

            <div className="gc" style={{ padding: 22 }}>
              <div className="label" style={{ marginBottom: 14 }}>Account Details</div>
              {[
                { label: "Business", value: client?.business_name || client?.slug },
                { label: "Email", value: client?.email || "No email on file" },
                { label: "Phone", value: client?.phone || "No phone on file" },
                { label: "Job Reference", value: client?.job_id, mono: true },
              ].map(row => (
                <div key={row.label} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "10px 0", borderBottom: "1px solid rgba(255,255,255,0.04)" }}>
                  <span style={{ fontSize: 12, color: "#6b7280", fontWeight: 600 }}>{row.label}</span>
                  <span style={{ fontSize: 13, fontWeight: 600, color: "#e2e4ec", fontFamily: row.mono ? "monospace" : "inherit" }}>{row.value}</span>
                </div>
              ))}
            </div>

            <div className="gc" style={{ padding: 22 }}>
              <div className="label" style={{ marginBottom: 14 }}>Legal Agreements</div>
              {Object.keys(LEGAL_DOCS).map(k => (
                <button key={k} onClick={() => setActiveLegalDoc(k)} style={{ width: "100%", display: "flex", justifyContent: "space-between", alignItems: "center", padding: "13px 14px", background: "rgba(255,255,255,0.02)", border: "1px solid rgba(255,255,255,0.05)", borderRadius: 10, color: "#d1d5db", fontSize: 13, cursor: "pointer", marginBottom: 8, fontFamily: "inherit" }}>
                  <span>📄 {LEGAL_DOCS[k].title}</span>
                  <span style={{ color: "#6366f1" }}>View →</span>
                </button>
              ))}
            </div>

            <button onClick={handleLogout} style={{ width: "100%", background: "rgba(239,68,68,0.08)", color: "#f87171", border: "1px solid rgba(239,68,68,0.15)", borderRadius: 10, padding: 14, fontSize: 13, fontWeight: 700, cursor: "pointer", fontFamily: "inherit" }}>
              Sign Out from Portal
            </button>
          </div>
        )}

      </main>

      {/* ── Bottom Nav (mobile only) ── */}
      <nav className="bottom-nav">
        <div style={{ display: "flex", justifyContent: "space-around", maxWidth: 500, margin: "0 auto" }}>
          {[
            { id: "home", icon: "🏠", label: "Hub" },
            { id: "create", icon: "📸", label: "Post", locked: !hasSocial },
            { id: "review", icon: "✍️", label: "Review", locked: !hasSocial },
            { id: "calendar", icon: "📅", label: "Queue", locked: !hasSocial },
            { id: "billing", icon: "💳", label: "Billing" },
            { id: "profile", icon: "⚙️", label: "Profile" },
          ].map(item => {
            const active = activeTab === item.id;
            return (
              <button key={item.id} onClick={() => goTab(item.id as Tab)} style={{ background: "none", border: "none", display: "flex", flexDirection: "column", alignItems: "center", gap: 3, cursor: "pointer", color: active ? "#6366f1" : "#4b5563", padding: "4px 6px", fontFamily: "inherit", transition: "color 0.2s" }}>
                <span style={{ fontSize: 19, position: "relative" }}>
                  {item.icon}
                  {item.locked && <span style={{ position: "absolute", top: -2, right: -5, fontSize: 10 }}>🔒</span>}
                </span>
                <span style={{ fontSize: 9, fontWeight: active ? 700 : 500 }}>{item.label}</span>
              </button>
            );
          })}
        </div>
      </nav>

      {/* ── Upsell Modal ── */}
      {showUpsell && (
        <div style={{ position: "fixed", inset: 0, zIndex: 400, display: "flex", alignItems: "center", justifyContent: "center", padding: 20 }}>
          <div style={{ position: "absolute", inset: 0, background: "rgba(0,0,0,0.8)", backdropFilter: "blur(8px)" }} onClick={() => setShowUpsell(false)} />
          <div className="gc fade-in" style={{ width: "100%", maxWidth: 440, padding: 32, zIndex: 1, textAlign: "center", border: "1px solid rgba(99,102,241,0.3)", position: "relative" }}>
            <button onClick={() => setShowUpsell(false)} style={{ position: "absolute", top: 14, right: 14, background: "none", border: "none", color: "#6b7280", cursor: "pointer", fontSize: 20, lineHeight: 1 }}>×</button>
            <div style={{ fontSize: 56, marginBottom: 16 }}>🔒</div>
            <h3 style={{ fontFamily: "'Outfit', sans-serif", fontSize: 22, fontWeight: 900, marginBottom: 10, color: "#f3f4f6" }}>Social Media Bundle Required</h3>
            <p style={{ fontSize: 13, color: "#6b7280", lineHeight: 1.7, marginBottom: 24 }}>
              Unlock AI-powered social media publishing. We'll draft platform-specific posts for Instagram, Facebook, LinkedIn, and more based on your photos, videos, or voice notes — for a flat <strong style={{ color: "#e2e4ec" }}>$100 AUD</strong> per approved post.
            </p>
            <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
              <a
                href={`mailto:hello@webgecko.au?subject=Activate Social Media Bundle - ${client?.business_name || client?.slug}&body=Hi team, I'd like to activate the Social Media Bundle. Please get back to me with details.`}
                style={{ display: "block", textDecoration: "none", background: "linear-gradient(135deg, #6366f1, #4f46e5)", color: "#fff", borderRadius: 10, padding: 14, fontSize: 14, fontWeight: 700, boxShadow: "0 4px 20px rgba(99,102,241,0.3)" }}
              >
                Contact Team to Activate ✉️
              </a>
              <button onClick={() => setShowUpsell(false)} className="btn-ghost" style={{ width: "100%" }}>Maybe Later</button>
            </div>
          </div>
        </div>
      )}

      {/* ── Legal Doc Sheet ── */}
      {activeLegalDoc && (
        <div style={{ position: "fixed", inset: 0, zIndex: 500, background: "#06080f", display: "flex", flexDirection: "column" }} className="fade-in">
          <div style={{ padding: "16px 24px", borderBottom: "1px solid rgba(255,255,255,0.05)", display: "flex", alignItems: "center", gap: 14 }}>
            <button onClick={() => setActiveLegalDoc(null)} style={{ background: "none", border: "none", color: "#6366f1", cursor: "pointer", fontSize: 16, fontWeight: 700, fontFamily: "inherit" }}>← Close</button>
            <div style={{ fontSize: 16, fontWeight: 800, color: "#e2e4ec" }}>{LEGAL_DOCS[activeLegalDoc].title}</div>
          </div>
          <div style={{ flex: 1, padding: 28, overflowY: "auto", lineHeight: 1.8, fontSize: 14, color: "#9ca3af", maxWidth: 700, margin: "0 auto", width: "100%" }}>
            <div style={{ fontSize: 11, color: "#374151", marginBottom: 20 }}>Last updated: {LEGAL_DOCS[activeLegalDoc].updated}</div>
            <p>{LEGAL_DOCS[activeLegalDoc].body}</p>
          </div>
        </div>
      )}

      {/* ── Onboarding Tour ── */}
      {tourActive && currentTourStep && (
        <>
          {/* Tour card */}
          <div className="tour-card" style={{ top: tourPos.top, left: tourPos.left }}>
            {/* Progress bar */}
            <div className="tour-progress-bar">
              <div className="tour-progress-fill" style={{ width: `${((tourStep + 1) / TOUR_STEPS.length) * 100}%` }} />
            </div>

            {/* Step counter */}
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
              <span style={{ fontSize: 11, color: "#4b5563", fontWeight: 600 }}>Step {tourStep + 1} of {TOUR_STEPS.length}</span>
              <button onClick={endTour} style={{ background: "none", border: "none", color: "#374151", cursor: "pointer", fontSize: 18, lineHeight: 1, padding: 2 }}>×</button>
            </div>

            {/* Icon + Title */}
            <div style={{ display: "flex", alignItems: "flex-start", gap: 12, marginBottom: 12 }}>
              <div style={{ width: 44, height: 44, borderRadius: 12, background: "rgba(99,102,241,0.12)", border: "1px solid rgba(99,102,241,0.2)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 22, flexShrink: 0 }}>
                {currentTourStep.emoji}
              </div>
              <div>
                <div style={{ fontSize: 15, fontWeight: 800, color: "#f3f4f6", lineHeight: 1.3 }}>{currentTourStep.title}</div>
              </div>
            </div>

            {/* Description */}
            <p style={{ fontSize: 13, color: "#6b7280", lineHeight: 1.7, marginBottom: 20 }}>{currentTourStep.desc}</p>

            {/* Actions */}
            <div style={{ display: "flex", gap: 8 }}>
              {tourStep > 0 && (
                <button onClick={prevTourStep} className="btn-ghost" style={{ flex: 1, padding: "9px 14px", fontSize: 12 }}>← Back</button>
              )}
              <button onClick={nextTourStep} className="btn-primary" style={{ flex: 2, justifyContent: "center", padding: "9px 14px", fontSize: 12 }}>
                {tourStep === TOUR_STEPS.length - 1 ? "Finish Tour 🎉" : "Next →"}
              </button>
            </div>

            {tourStep === 0 && (
              <button onClick={endTour} style={{ width: "100%", marginTop: 10, background: "none", border: "none", color: "#374151", fontSize: 11, cursor: "pointer", fontFamily: "inherit" }}>
                Skip tour
              </button>
            )}
          </div>

          {/* Dim overlay behind everything except highlighted element */}
          <div style={{ position: "fixed", inset: 0, zIndex: 199, pointerEvents: "none" }} />
        </>
      )}
    </div>
  );
}
