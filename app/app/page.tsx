"use client";
import { useState, useEffect, useRef } from "react";
import { supabasePublic } from "@/lib/supabase";

// ─────────────────────────────────────────────────────────────
//  GLOBAL CSS  — mobile-app aesthetic, centered "phone shell"
// ─────────────────────────────────────────────────────────────
const CSS = `
  @import url('https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700;800&family=Outfit:wght@400;600;700;800;900&display=swap');

  *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
  html { height: 100%; }

  body {
    background: #02040a;
    font-family: 'Inter', -apple-system, sans-serif;
    color: #e8eaf0;
    min-height: 100vh;
    overflow-x: hidden;
  }

  /* Subtle grid bg */
  body::before {
    content: '';
    position: fixed; inset: 0; z-index: 0; pointer-events: none;
    background-image:
      linear-gradient(rgba(99,102,241,0.03) 1px, transparent 1px),
      linear-gradient(90deg, rgba(99,102,241,0.03) 1px, transparent 1px);
    background-size: 40px 40px;
  }

  /* ── App shell ── */
  .app-shell {
    position: relative; z-index: 1;
    min-height: 100vh;
    max-width: 430px;
    margin: 0 auto;
    display: flex; flex-direction: column;
    background: #07090f;
    box-shadow: 0 0 80px rgba(99,102,241,0.08);
  }

  /* On wide screens give it a slight border to emphasize the app feel */
  @media (min-width: 600px) {
    .app-shell {
      border-left: 1px solid rgba(255,255,255,0.04);
      border-right: 1px solid rgba(255,255,255,0.04);
      min-height: 100vh;
    }
    body { background: #020307; }
  }

  /* ── Header ── */
  .app-header {
    position: sticky; top: 0; z-index: 50;
    padding: 14px 20px;
    display: flex; align-items: center; justify-content: space-between;
    background: rgba(7,9,15,0.92);
    backdrop-filter: blur(20px);
    -webkit-backdrop-filter: blur(20px);
    border-bottom: 1px solid rgba(255,255,255,0.05);
  }

  /* ── Scroll area ── */
  .app-scroll {
    flex: 1;
    overflow-y: auto;
    padding: 16px 16px 88px;
    -webkit-overflow-scrolling: touch;
  }
  .app-scroll::-webkit-scrollbar { display: none; }

  /* ── Bottom nav ── */
  .app-nav {
    position: fixed; bottom: 0; left: 50%; transform: translateX(-50%);
    width: 100%; max-width: 430px; z-index: 50;
    background: rgba(7,9,15,0.96);
    backdrop-filter: blur(20px);
    -webkit-backdrop-filter: blur(20px);
    border-top: 1px solid rgba(255,255,255,0.06);
    display: flex;
    padding: 8px 0 max(10px, env(safe-area-inset-bottom));
  }

  .nav-btn {
    flex: 1; display: flex; flex-direction: column;
    align-items: center; gap: 4px;
    background: none; border: none; cursor: pointer;
    padding: 4px 2px; font-family: inherit;
    transition: all 0.18s ease;
    color: #3d4155;
    -webkit-tap-highlight-color: transparent;
  }
  .nav-btn.active { color: #6366f1; }
  .nav-btn .nav-icon { font-size: 20px; line-height: 1; position: relative; }
  .nav-btn .nav-label { font-size: 9px; font-weight: 700; letter-spacing: 0.02em; }
  .nav-btn .nav-lock { position: absolute; top: -3px; right: -6px; font-size: 9px; }
  .nav-active-pip {
    position: absolute; bottom: -6px; left: 50%; transform: translateX(-50%);
    width: 4px; height: 4px; border-radius: 50%; background: #6366f1;
  }

  /* ── Cards ── */
  .card {
    background: rgba(13,16,28,0.8);
    border: 1px solid rgba(255,255,255,0.06);
    border-radius: 18px;
    backdrop-filter: blur(12px);
    overflow: hidden;
  }

  /* ── Section heading ── */
  .section-title { font-family: 'Outfit', sans-serif; font-size: 22px; font-weight: 900; letter-spacing: -0.03em; color: #f3f4f6; }
  .section-sub { font-size: 12px; color: #4b5563; margin-top: 2px; }

  /* ── Label ── */
  .lbl { font-size: 10px; font-weight: 700; color: #4b5563; text-transform: uppercase; letter-spacing: 0.08em; }

  /* ── Inputs ── */
  .inp {
    width: 100%;
    background: rgba(10,13,22,0.9);
    border: 1px solid rgba(255,255,255,0.07);
    border-radius: 12px; padding: 12px 14px;
    color: #e8eaf0; font-size: 14px; font-family: inherit;
    transition: border-color 0.2s, box-shadow 0.2s;
  }
  .inp:focus { outline: none; border-color: #6366f1; box-shadow: 0 0 0 3px rgba(99,102,241,0.1); }

  /* ── Buttons ── */
  .btn {
    display: inline-flex; align-items: center; justify-content: center; gap: 8px;
    font-family: inherit; font-weight: 700; border: none; cursor: pointer;
    border-radius: 14px; transition: all 0.18s ease;
    -webkit-tap-highlight-color: transparent;
  }
  .btn:active:not(:disabled) { transform: scale(0.97); }
  .btn:disabled { opacity: 0.5; cursor: not-allowed; }
  .btn-indigo {
    background: linear-gradient(135deg, #6366f1, #4f46e5);
    color: #fff; box-shadow: 0 4px 18px rgba(99,102,241,0.35);
  }
  .btn-indigo:hover:not(:disabled) { box-shadow: 0 6px 26px rgba(99,102,241,0.5); }
  .btn-green {
    background: linear-gradient(135deg, #10b981, #059669);
    color: #fff; box-shadow: 0 4px 18px rgba(16,185,129,0.3);
  }
  .btn-ghost {
    background: rgba(255,255,255,0.05);
    color: #9ca3af;
    border: 1px solid rgba(255,255,255,0.08);
  }
  .btn-ghost:hover { background: rgba(255,255,255,0.08); color: #e2e4ec; }
  .btn-danger-ghost { background: rgba(239,68,68,0.08); color: #f87171; border: 1px solid rgba(239,68,68,0.15); }

  /* ── Badges ── */
  .badge { display: inline-flex; align-items: center; padding: 3px 10px; border-radius: 20px; font-size: 10px; font-weight: 700; }
  .bg-green { background: rgba(16,185,129,0.12); color: #10b981; border: 1px solid rgba(16,185,129,0.18); }
  .bg-indigo { background: rgba(99,102,241,0.12); color: #a5b4fc; border: 1px solid rgba(99,102,241,0.18); }
  .bg-amber { background: rgba(245,158,11,0.12); color: #f59e0b; border: 1px solid rgba(245,158,11,0.18); }
  .bg-red { background: rgba(239,68,68,0.12); color: #f87171; border: 1px solid rgba(239,68,68,0.18); }

  /* ── Platform pills ── */
  .plat-pill {
    display: inline-flex; align-items: center; gap: 6px;
    padding: 7px 14px; border-radius: 30px; font-size: 12px; font-weight: 600;
    cursor: pointer; border: 1px solid rgba(255,255,255,0.08);
    background: rgba(255,255,255,0.03); color: #4b5563;
    transition: all 0.18s; font-family: inherit;
  }

  /* ── Animations ── */
  .fade-up { animation: fadeUp 0.28s cubic-bezier(0.16,1,0.3,1) forwards; }
  @keyframes fadeUp { from { opacity:0; transform:translateY(12px); } to { opacity:1; transform:translateY(0); } }
  @keyframes spin { to { transform:rotate(360deg); } }
  .spin { animation: spin 1s linear infinite; }

  /* ── Recording pulse ── */
  .rec-pulse { animation: recPulse 1.4s infinite; }
  @keyframes recPulse {
    0% { box-shadow: 0 0 0 0 rgba(239,68,68,0.5); }
    70% { box-shadow: 0 0 0 10px rgba(239,68,68,0); }
    100% { box-shadow: 0 0 0 0 rgba(239,68,68,0); }
  }

  /* ── Visualizer bars ── */
  .vbar { width: 3px; height: 5px; background: linear-gradient(to top, #6366f1, #a5b4fc); border-radius: 2px; transition: height 0.08s ease; }

  /* ── Empty state ── */
  .empty { display:flex; flex-direction:column; align-items:center; justify-content:center; padding: 52px 24px; text-align:center; gap:12px; }
  .empty-icon { font-size: 52px; }
  .empty-title { font-size: 16px; font-weight: 800; color: #e2e4ec; }
  .empty-sub { font-size: 13px; color: #4b5563; line-height: 1.6; max-width: 240px; }

  /* ── Divider ── */
  .div { height: 1px; background: rgba(255,255,255,0.05); }

  /* ── Tour ── */
  .tour-overlay { position: fixed; inset: 0; background: rgba(0,0,0,0.55); z-index: 200; pointer-events: none; }
  .tour-card {
    position: fixed; z-index: 300;
    left: 50%; transform: translateX(-50%);
    width: calc(100% - 32px); max-width: 398px;
    padding: 22px 22px 18px;
    background: #0d1020;
    border: 1px solid rgba(99,102,241,0.3);
    border-radius: 20px;
    box-shadow: 0 20px 60px rgba(0,0,0,0.9), 0 0 0 1px rgba(99,102,241,0.1);
  }
  .tour-prog { height: 3px; border-radius: 2px; background: rgba(255,255,255,0.06); overflow: hidden; margin-bottom: 16px; }
  .tour-prog-fill { height: 100%; border-radius: 2px; background: linear-gradient(90deg,#6366f1,#a5b4fc); transition: width 0.4s ease; }

  /* ── Login screen ── */
  .login-wrap {
    min-height: 100vh; max-width: 430px; margin: 0 auto;
    display: flex; flex-direction: column; align-items: center; justify-content: center;
    padding: 28px 24px;
    background: #07090f;
    position: relative; overflow: hidden;
  }

  /* Glow orbs */
  .orb { position: absolute; border-radius: 50%; pointer-events: none; filter: blur(70px); }

  /* ── Metric card ── */
  .metric { flex: 1; min-width: 0; padding: 16px; }

  /* ── Upsell ── */
  .upsell-card {
    padding: 20px; border-radius: 18px;
    background: linear-gradient(135deg, rgba(99,102,241,0.09), rgba(99,102,241,0.03));
    border: 1px solid rgba(99,102,241,0.18);
  }
`;

// ─────────────────────────────────────────────────────────────
//  LEGAL DOCS
// ─────────────────────────────────────────────────────────────
const LEGAL: Record<string, { title: string; updated: string; body: string }> = {
  tos: { title: "Terms of Service", updated: "1 June 2026", body: "These Terms of Service govern your use of the WebGecko Client Hub and social media companion services. Final post approvals authorize us to publish on your behalf, logging flat-fee charges of $100.00 AUD per confirmed post." },
  privacy: { title: "Privacy Policy", updated: "1 June 2026", body: "WebGecko takes privacy seriously. Media files, briefs, and voiceover transcripts are securely processed for AI caption drafting and platform publishing only. We do not sell or monetize client details." },
  agreement: { title: "Social Media Agreement", updated: "1 June 2026", body: "This agreement formalizes the Social Media Posting bundle. The fee is a flat $100.00 AUD billed on client manual draft approval in the portal. Published posts are queued automatically." },
};

// ─────────────────────────────────────────────────────────────
//  ONBOARDING TOUR  — 9 steps
// ─────────────────────────────────────────────────────────────
const TOUR = [
  { tab: "home",     anchor: "t-welcome",  emoji: "🏠", title: "Welcome to your Hub 👋",         desc: "This is your command centre — manage your website, social posts, billing, and more. Let's take a quick look around." },
  { tab: "home",     anchor: "t-metrics",  emoji: "📊", title: "Your key stats",                  desc: "These tiles show your current plan, invoice count, build status, and approved posts at a glance." },
  { tab: "create",   anchor: "t-media",    emoji: "📸", title: "Upload photos & videos",          desc: "Tap the upload area to attach media from your device. On mobile, you can shoot directly with your camera." },
  { tab: "create",   anchor: "t-voice",    emoji: "🎤", title: "Record a voice instruction",      desc: "Don't want to type? Hit record and talk through what the post should say. We transcribe it in real time." },
  { tab: "create",   anchor: "t-brief",    emoji: "✍️", title: "Write a brief",                   desc: "Add context — promotions, tone, key messages. The more you tell the AI, the better your captions." },
  { tab: "review",   anchor: "t-review",   emoji: "👁", title: "Review AI-generated drafts",      desc: "Each platform gets its own caption card. Edit inline, then approve with a single tap — $100 flat fee per post." },
  { tab: "calendar", anchor: "t-queue",    emoji: "📅", title: "Your Posting Queue",              desc: "Approved posts land here with their scheduled date, platform, and charge reference." },
  { tab: "billing",  anchor: "t-billing",  emoji: "💳", title: "Billing & Invoices",              desc: "Every approved post logs a $100 AUD charge here. Full history, always transparent." },
  { tab: "profile",  anchor: "t-profile",  emoji: "⚙️", title: "Profile & Legal",                desc: "Your account details and service agreements. That's the full tour — you're all set to go! 🎉" },
];

type Tab = "home" | "create" | "review" | "calendar" | "billing" | "reports" | "stats" | "profile";

// ─────────────────────────────────────────────────────────────
//  MAIN
// ─────────────────────────────────────────────────────────────
export default function ClientHub() {
  // ── Auth ──
  const [authed, setAuthed] = useState(false);
  const [authLoading, setAuthLoading] = useState(true);
  const [uname, setUname] = useState("");
  const [pw, setPw] = useState("");
  const [loginErr, setLoginErr] = useState("");
  const [loginLoading, setLoginLoading] = useState(false);
  const [client, setClient] = useState<any>(null);

  // ── Nav ──
  const [tab, setTab] = useState<Tab>("home");
  const [showUpsell, setShowUpsell] = useState(false);
  const [legalDoc, setLegalDoc] = useState<string | null>(null);

  // ── Create Post ──
  const [brief, setBrief] = useState("");
  const [tone, setTone] = useState("friendly");
  const [platforms, setPlatforms] = useState<string[]>(["instagram", "facebook"]);
  const [files, setFiles] = useState<File[]>([]);
  const [previews, setPreviews] = useState<string[]>([]);

  // ── Voice ──
  const [recording, setRecording] = useState(false);
  const [voiceBlob, setVoiceBlob] = useState<Blob | null>(null);
  const [voiceUrl, setVoiceUrl] = useState("");
  const [transcript, setTranscript] = useState("");
  const [speechOk, setSpeechOk] = useState(false);

  // ── Drafts ──
  const [generating, setGenerating] = useState(false);
  const [drafts, setDrafts] = useState<any[]>([]);
  const [mediaUrls, setMediaUrls] = useState<string[]>([]);
  const [approving, setApproving] = useState(false);
  const [approved, setApproved] = useState(false);

  // ── DB ──
  const [payments, setPayments] = useState<any[]>([]);
  const [queue, setQueue] = useState<any[]>([]);

  // ── Tour ──
  const [tourOn, setTourOn] = useState(false);
  const [tourStep, setTourStep] = useState(0);
  const [tourY, setTourY] = useState(120);

  // ── Refs ──
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const audioCtxRef = useRef<AudioContext | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const mrRef = useRef<MediaRecorder | null>(null);
  const recRef = useRef<any>(null);
  const rafRef = useRef<number>(0);
  const streamRef = useRef<MediaStream | null>(null);

  const hasSocial =
    client?.metadata?.features?.some((f: string) => /social|post/i.test(f)) ||
    /social/i.test(client?.plan || "") ||
    client?.metadata?.socialActive === true;

  // ─── Auth boot ───────────────────────────────────────────
  useEffect(() => {
    (async () => {
      const slug = localStorage.getItem("wg_app_slug");
      if (slug) {
        try {
          const r = await fetch(`/api/client-login?slug=${slug}`);
          if (r.ok) {
            const d = await r.json();
            setClient(d); setAuthed(true);
            await loadDb(slug, d.job_id);
            setTab(d?.metadata?.socialActive || /social/i.test(d?.plan || "") ? "create" : "home");
          } else localStorage.removeItem("wg_app_slug");
        } catch { localStorage.removeItem("wg_app_slug"); }
      }
      setAuthLoading(false);
    })();
  }, []);

  // ─── Speech recognition ───────────────────────────────────
  useEffect(() => {
    if (typeof window === "undefined") return;
    const SR = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SR) return;
    setSpeechOk(true);
    const r = new SR();
    r.continuous = true; r.interimResults = true; r.lang = "en-AU";
    r.onresult = (e: any) => {
      let f = "", i = "";
      for (let j = e.resultIndex; j < e.results.length; j++)
        e.results[j].isFinal ? (f += e.results[j][0].transcript) : (i += e.results[j][0].transcript);
      if (f || i) setTranscript(p => p + " " + (f || i));
    };
    recRef.current = r;
  }, []);

  // ─── Auto tour ───────────────────────────────────────────
  useEffect(() => {
    if (authed && client?.slug && !localStorage.getItem(`wg_tour_${client.slug}`))
      setTimeout(() => startTour(), 900);
  }, [authed, client?.slug]);

  // ─── DB ──────────────────────────────────────────────────
  async function loadDb(slug: string, jobId: string) {
    try {
      const { data: p } = await supabasePublic.from("payments").select("*").eq("client_slug", slug).order("created_at", { ascending: false });
      if (p) setPayments(p);
      if (jobId) {
        const { data: j } = await supabasePublic.from("jobs").select("metadata").eq("id", jobId).single();
        if (j?.metadata?.approvedPosts) setQueue([...j.metadata.approvedPosts].reverse());
      }
    } catch {}
  }

  // ─── Login ───────────────────────────────────────────────
  async function login(e: React.FormEvent) {
    e.preventDefault(); setLoginErr(""); setLoginLoading(true);
    try {
      const r = await fetch("/api/client-login", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ username: uname.trim(), password: pw.trim() }) });
      const d = await r.json();
      if (!r.ok) throw new Error(d.error || "Invalid credentials");
      localStorage.setItem("wg_app_slug", d.slug);
      const pr = await fetch(`/api/client-login?slug=${d.slug}`);
      const pd = await pr.json();
      setClient(pd); setAuthed(true);
      await loadDb(d.slug, pd.job_id);
      setTab(/social/i.test(pd?.plan || "") || pd?.metadata?.socialActive ? "create" : "home");
    } catch (err: any) { setLoginErr(err.message); }
    finally { setLoginLoading(false); }
  }

  function logout() {
    localStorage.removeItem("wg_app_slug");
    setAuthed(false); setClient(null); setTab("home");
  }

  // ─── Tab nav ─────────────────────────────────────────────
  function go(t: Tab) {
    if (["create","review","calendar"].includes(t) && !hasSocial) { setShowUpsell(true); return; }
    setTab(t);
  }

  // ─── Files ───────────────────────────────────────────────
  function onFiles(e: React.ChangeEvent<HTMLInputElement>) {
    const picked = Array.from(e.target.files || []);
    setFiles(p => [...p,...picked].slice(0,5));
    setPreviews(p => [...p,...picked.map(f => URL.createObjectURL(f))].slice(0,5));
  }
  const rmFile = (i: number) => { setFiles(p=>p.filter((_,j)=>j!==i)); setPreviews(p=>p.filter((_,j)=>j!==i)); };

  // ─── Voice ───────────────────────────────────────────────
  async function startRec() {
    setTranscript(""); setVoiceBlob(null); setVoiceUrl("");
    try {
      const s = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = s; setRecording(true);
      const Ctx = window.AudioContext || (window as any).webkitAudioContext;
      if (Ctx) {
        const ctx = new Ctx(), src = ctx.createMediaStreamSource(s), an = ctx.createAnalyser();
        an.fftSize = 64; src.connect(an); audioCtxRef.current = ctx; analyserRef.current = an;
        drawViz();
      }
      if (recRef.current) recRef.current.start();
      const mr = new MediaRecorder(s); const chunks: Blob[] = [];
      mr.ondataavailable = e => { if (e.data?.size) chunks.push(e.data); };
      mr.onstop = () => { const b = new Blob(chunks,{type:"audio/wav"}); setVoiceBlob(b); setVoiceUrl(URL.createObjectURL(b)); };
      mrRef.current = mr; mr.start();
    } catch { alert("Microphone permission denied."); setRecording(false); }
  }
  function stopRec() {
    setRecording(false);
    mrRef.current?.stop(); recRef.current?.stop();
    streamRef.current?.getTracks().forEach(t=>t.stop());
    cancelAnimationFrame(rafRef.current); audioCtxRef.current?.close();
  }
  function drawViz() {
    const an = analyserRef.current; if (!an) return;
    const data = new Uint8Array(an.frequencyBinCount);
    const d = () => { rafRef.current = requestAnimationFrame(d); an.getByteFrequencyData(data); document.querySelectorAll(".vbar").forEach((b:any,i)=>{ if(data[i]!==undefined) b.style.height=`${Math.max(5,(data[i]/255)*36)}px`; }); };
    d();
  }

  // ─── Generate ────────────────────────────────────────────
  async function generate() {
    if (!brief.trim() && !transcript.trim() && files.length===0) { alert("Add media, brief, or voice note first."); return; }
    setGenerating(true); setDrafts([]);
    try {
      const fd = new FormData();
      fd.append("slug", client.slug); fd.append("brief", brief); fd.append("tone", tone);
      fd.append("platforms", JSON.stringify(platforms)); fd.append("voiceTranscript", transcript);
      files.forEach(f => fd.append("files", f));
      if (voiceBlob) fd.append("voiceover", voiceBlob, "vo.wav");
      const r = await fetch("/api/client/social-upload-app", { method:"POST", body:fd });
      const d = await r.json();
      if (!r.ok) throw new Error(d.error);
      setDrafts(d.drafts); setMediaUrls(d.mediaUrls); setTab("review");
    } catch (e:any) { alert("Error: "+e.message); }
    finally { setGenerating(false); }
  }

  // ─── Approve ─────────────────────────────────────────────
  async function approve() {
    setApproving(true);
    try {
      const r = await fetch("/api/client/social-approve", { method:"POST", headers:{"Content-Type":"application/json"}, body: JSON.stringify({ slug: client.slug, posts: drafts.map(d=>({...d, mediaUrls})) }) });
      if (!r.ok) throw new Error((await r.json()).error);
      setApproved(true); confetti();
      await loadDb(client.slug, client.job_id);
      setTimeout(() => { setApproved(false); setBrief(""); setFiles([]); setPreviews([]); setVoiceBlob(null); setVoiceUrl(""); setTranscript(""); setDrafts([]); setTab("calendar"); }, 3800);
    } catch (e:any) { alert("Failed: "+e.message); }
    finally { setApproving(false); }
  }

  // ─── Confetti ─────────────────────────────────────────────
  function confetti() {
    const c = canvasRef.current; if (!c) return;
    c.width = window.innerWidth; c.height = window.innerHeight;
    const ctx = c.getContext("2d"); if (!ctx) return;
    const cols = ["#6366f1","#a5b4fc","#10b981","#3b82f6","#f59e0b"];
    const pp = Array.from({length:120},()=>({ x:Math.random()*c.width, y:c.height+10, vx:(Math.random()-.5)*7, vy:-Math.random()*15-8, s:Math.random()*8+3, c:cols[Math.floor(Math.random()*cols.length)], r:Math.random()*360, rs:Math.random()*4-2 }));
    const a = () => { ctx.clearRect(0,0,c.width,c.height); let alive=false; pp.forEach(p=>{ p.x+=p.vx; p.y+=p.vy; p.vy+=0.35; p.r+=p.rs; ctx.save(); ctx.translate(p.x,p.y); ctx.rotate(p.r*Math.PI/180); ctx.fillStyle=p.c; ctx.fillRect(-p.s/2,-p.s/2,p.s,p.s); ctx.restore(); if(p.y<c.height+10) alive=true; }); if(alive) requestAnimationFrame(a); else ctx.clearRect(0,0,c.width,c.height); };
    a();
  }

  const fmt = (s:string) => new Date(s).toLocaleDateString("en-AU",{weekday:"short",day:"numeric",month:"short",hour:"2-digit",minute:"2-digit"});

  // ─── Tour ────────────────────────────────────────────────
  function startTour() { setTourStep(0); setTourOn(true); applyTourStep(0); }
  function endTour() { setTourOn(false); if(client?.slug) localStorage.setItem(`wg_tour_${client.slug}`,"1"); }

  function applyTourStep(step: number) {
    const s = TOUR[step]; if (!s) { endTour(); return; }
    setTab(s.tab as Tab);
    setTimeout(() => {
      const el = document.getElementById(s.anchor);
      if (el) { el.scrollIntoView({ behavior:"smooth", block:"center" }); const rect = el.getBoundingClientRect(); setTourY(Math.min(rect.bottom + 12, window.innerHeight - 300)); }
      else setTourY(Math.max(window.innerHeight/2 - 160, 60));
    }, 300);
  }

  function tourNext() { const n = tourStep+1; if(n>=TOUR.length){endTour();return;} setTourStep(n); applyTourStep(n); }
  function tourPrev() { const p = tourStep-1; if(p<0) return; setTourStep(p); applyTourStep(p); }

  // ─────────────────────────────────────────────────────────
  //  LOADING
  // ─────────────────────────────────────────────────────────
  if (authLoading) return (
    <div style={{minHeight:"100vh",background:"#07090f",display:"flex",alignItems:"center",justifyContent:"center",flexDirection:"column",gap:14}}>
      <style>{CSS}</style>
      <div style={{width:38,height:38,border:"3px solid rgba(99,102,241,0.15)",borderTopColor:"#6366f1",borderRadius:"50%"}} className="spin"/>
      <span style={{color:"#3d4155",fontSize:13}}>Loading…</span>
    </div>
  );

  // ─────────────────────────────────────────────────────────
  //  LOGIN
  // ─────────────────────────────────────────────────────────
  if (!authed) return (
    <div className="login-wrap" style={{minHeight:"100vh"}}>
      <style>{CSS}</style>
      <div className="orb" style={{width:500,height:500,top:"-200px",left:"50%",transform:"translateX(-50%)",background:"radial-gradient(circle,rgba(99,102,241,0.1) 0%,transparent 70%)"}}/>
      <div className="orb" style={{width:300,height:300,bottom:"-80px",right:"-60px",background:"radial-gradient(circle,rgba(16,185,129,0.07) 0%,transparent 70%)"}}/>

      <div style={{width:"100%",maxWidth:380,position:"relative",zIndex:1}}>
        {/* App icon */}
        <div style={{textAlign:"center",marginBottom:32}}>
          <div style={{display:"inline-flex",alignItems:"center",justifyContent:"center",width:72,height:72,borderRadius:22,background:"linear-gradient(135deg,rgba(99,102,241,0.2),rgba(99,102,241,0.08))",border:"1px solid rgba(99,102,241,0.3)",marginBottom:18,fontSize:34}}>🦎</div>
          <div style={{fontFamily:"'Outfit',sans-serif",fontSize:26,fontWeight:900,color:"#f3f4f6",letterSpacing:"-0.03em",marginBottom:4}}>WebGecko</div>
          <div style={{fontSize:13,color:"#3d4155"}}>Sign in to your client portal</div>
        </div>

        <div className="card" style={{padding:"28px 24px"}}>
          <form onSubmit={login} style={{display:"flex",flexDirection:"column",gap:16}}>
            {loginErr && (
              <div style={{background:"rgba(239,68,68,0.08)",border:"1px solid rgba(239,68,68,0.18)",borderRadius:12,padding:"10px 14px",color:"#f87171",fontSize:13,display:"flex",gap:8,alignItems:"center"}}>
                <span>✕</span>{loginErr}
              </div>
            )}
            <div>
              <div className="lbl" style={{marginBottom:6}}>Username</div>
              <input className="inp" type="text" required value={uname} onChange={e=>setUname(e.target.value)} placeholder="your-business-name" autoComplete="username"/>
            </div>
            <div>
              <div className="lbl" style={{marginBottom:6}}>Password</div>
              <input className="inp" type="password" required value={pw} onChange={e=>setPw(e.target.value)} placeholder="••••••••" autoComplete="current-password"/>
            </div>
            <button type="submit" className="btn btn-indigo" disabled={loginLoading} style={{width:"100%",padding:"14px",fontSize:15,marginTop:4}}>
              {loginLoading?<><div style={{width:16,height:16,border:"2px solid rgba(255,255,255,0.3)",borderTopColor:"#fff",borderRadius:"50%"}} className="spin"/>Signing in…</>:"Sign in →"}
            </button>
          </form>
          <div style={{height:1,background:"rgba(255,255,255,0.05)",margin:"20px 0"}}/>
          <p style={{textAlign:"center",fontSize:12,color:"#3d4155"}}>Credentials sent in your welcome email.&nbsp;<a href="mailto:hello@webgecko.au" style={{color:"#6366f1",fontWeight:700,textDecoration:"none"}}>Need help?</a></p>
        </div>
        <p style={{textAlign:"center",fontSize:11,color:"#1e2030",marginTop:20}}>Powered by <span style={{color:"#6366f1",fontWeight:700}}>WebGecko</span></p>
      </div>
    </div>
  );

  // ─────────────────────────────────────────────────────────
  //  PORTAL
  // ─────────────────────────────────────────────────────────
  const NAV_ITEMS = [
    { id:"home",     icon:"🏠", label:"Hub" },
    { id:"create",   icon:"📸", label:"Post",    locked:!hasSocial },
    { id:"review",   icon:"✍️", label:"Review",  locked:!hasSocial },
    { id:"calendar", icon:"📅", label:"Queue",   locked:!hasSocial },
    { id:"billing",  icon:"💳", label:"Billing" },
    { id:"profile",  icon:"⚙️", label:"Profile" },
  ];

  return (
    <div className="app-shell">
      <style>{CSS}</style>
      <canvas ref={canvasRef} style={{position:"fixed",inset:0,pointerEvents:"none",zIndex:9999}}/>

      {/* ── Header ── */}
      <header className="app-header">
        <div style={{display:"flex",alignItems:"center",gap:10}}>
          <div style={{width:32,height:32,borderRadius:9,background:"linear-gradient(135deg,rgba(99,102,241,0.25),rgba(99,102,241,0.1))",border:"1px solid rgba(99,102,241,0.3)",display:"flex",alignItems:"center",justifyContent:"center",fontSize:17}}>🦎</div>
          <div>
            <div style={{fontFamily:"'Outfit',sans-serif",fontSize:14,fontWeight:800,color:"#f3f4f6",letterSpacing:"-0.02em",lineHeight:1}}>WebGecko</div>
            <div style={{fontSize:9,color:"#6366f1",fontWeight:700,textTransform:"uppercase",letterSpacing:"0.06em"}}>Client Hub</div>
          </div>
        </div>
        <div style={{display:"flex",alignItems:"center",gap:10}}>
          <button onClick={startTour} style={{background:"none",border:"1px solid rgba(99,102,241,0.2)",borderRadius:20,padding:"5px 12px",fontSize:11,color:"#a5b4fc",fontWeight:700,cursor:"pointer",fontFamily:"inherit"}}>🧭 Tour</button>
          <div style={{width:32,height:32,borderRadius:"50%",background:"linear-gradient(135deg,#6366f1,#4f46e5)",display:"flex",alignItems:"center",justifyContent:"center",fontSize:13,fontWeight:800,color:"#fff"}}>
            {client?.business_name?.[0]?.toUpperCase()||"C"}
          </div>
        </div>
      </header>

      {/* ── Scroll area ── */}
      <div className="app-scroll fade-up">

        {/* ╔══════════════════════════════╗
            ║         HOME / HUB           ║
            ╚══════════════════════════════╝ */}
        {tab === "home" && (
          <div style={{display:"flex",flexDirection:"column",gap:14}}>
            {/* Welcome */}
            <div id="t-welcome" style={{padding:"4px 0 8px"}}>
              <div style={{fontSize:12,color:"#3d4155",marginBottom:4}}>Good to see you 👋</div>
              <div className="section-title">{client?.metadata?.name||client?.business_name||"Hey there"}</div>
              <div className="section-sub">Here's your digital snapshot.</div>
            </div>

            {/* Metrics */}
            <div id="t-metrics" className="card" style={{overflow:"hidden"}}>
              <div style={{display:"grid",gridTemplateColumns:"1fr 1fr"}}>
                {[
                  { label:"Plan",          value: client?.plan||"Starter",                   color:"#a5b4fc", icon:"✦" },
                  { label:"Invoices",      value: `${payments.length}`,                      color:"#10b981", icon:"💳" },
                  { label:"Build Status",  value: client?.buildStatus||client?.build_status||"Active", color:"#3b82f6", icon:"🌐" },
                  { label:"Posts Queued",  value: `${queue.length}`,                         color:"#f59e0b", icon:"📬" },
                ].map((m,i) => (
                  <div key={m.label} className="metric" style={{borderRight:i%2===0?"1px solid rgba(255,255,255,0.05)":"none",borderBottom:i<2?"1px solid rgba(255,255,255,0.05)":"none"}}>
                    <div className="lbl">{m.label}</div>
                    <div style={{fontSize:22,fontWeight:800,color:m.color,marginTop:4,textTransform:"capitalize"}}>{m.value}</div>
                  </div>
                ))}
              </div>
            </div>

            {/* Upsell or next post */}
            {!hasSocial && (
              <div className="upsell-card">
                <div style={{display:"flex",gap:12,alignItems:"flex-start"}}>
                  <span style={{fontSize:32}}>🚀</span>
                  <div>
                    <div style={{fontSize:14,fontWeight:800,color:"#a5b4fc",marginBottom:5}}>Unlock Social Posting</div>
                    <p style={{fontSize:12,color:"#4b5563",lineHeight:1.6}}>Take a photo or record a voice note and let AI write platform-perfect captions. $100 flat fee per post.</p>
                    <button onClick={()=>setShowUpsell(true)} className="btn btn-indigo" style={{marginTop:12,padding:"9px 16px",fontSize:12}}>Unlock Bundle 🔓</button>
                  </div>
                </div>
              </div>
            )}

            {hasSocial && queue.length > 0 && (
              <div className="card" style={{padding:16,display:"flex",gap:12,alignItems:"center"}}>
                <div style={{width:42,height:42,borderRadius:12,background:"rgba(99,102,241,0.1)",border:"1px solid rgba(99,102,241,0.18)",display:"flex",alignItems:"center",justifyContent:"center",fontSize:20,flexShrink:0}}>📅</div>
                <div style={{minWidth:0}}>
                  <div className="lbl">Next Post</div>
                  <div style={{fontSize:13,fontWeight:700,color:"#e2e4ec",marginTop:2,whiteSpace:"nowrap",overflow:"hidden",textOverflow:"ellipsis"}}>{queue[0].platform?.toUpperCase()}: {queue[0].caption?.slice(0,40)}…</div>
                  <div style={{fontSize:11,color:"#6366f1",marginTop:2}}>{fmt(queue[0].scheduledAt)}</div>
                </div>
              </div>
            )}

            {/* Quick actions */}
            <div style={{display:"flex",gap:10}}>
              <button onClick={()=>go("create")} className="btn btn-indigo" style={{flex:1,padding:"14px 10px",fontSize:13}}>📸 Create Post</button>
              <button onClick={()=>go("billing")} className="btn btn-ghost" style={{flex:1,padding:"14px 10px",fontSize:13}}>💳 Invoices</button>
            </div>

            {/* Activity */}
            <div className="card" style={{padding:18}}>
              <div className="lbl" style={{marginBottom:12}}>Recent Activity</div>
              <div style={{display:"flex",flexDirection:"column",gap:12}}>
                <div style={{display:"flex",gap:10,alignItems:"flex-start"}}>
                  <div style={{width:30,height:30,borderRadius:8,background:"rgba(99,102,241,0.1)",display:"flex",alignItems:"center",justifyContent:"center",fontSize:13,flexShrink:0}}>🎉</div>
                  <div><div style={{fontSize:13,fontWeight:600,color:"#e2e4ec"}}>Portal Activated</div><div style={{fontSize:11,color:"#3d4155",marginTop:1}}>Hub services registered.</div></div>
                </div>
                {payments.slice(0,3).map(p => (
                  <div key={p.id} style={{display:"flex",gap:10,alignItems:"flex-start"}}>
                    <div style={{width:30,height:30,borderRadius:8,background:"rgba(16,185,129,0.1)",display:"flex",alignItems:"center",justifyContent:"center",fontSize:13,flexShrink:0}}>💳</div>
                    <div><div style={{fontSize:13,fontWeight:600,color:"#e2e4ec"}}>$100.00 AUD Invoice</div><div style={{fontSize:11,color:"#3d4155",marginTop:1}}>{new Date(p.created_at).toLocaleDateString("en-AU")} · #{p.id?.slice(0,8)}</div></div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* ╔══════════════════════════════╗
            ║        CREATE POST           ║
            ╚══════════════════════════════╝ */}
        {tab === "create" && (
          <div style={{display:"flex",flexDirection:"column",gap:14}}>
            <div style={{padding:"4px 0 8px"}}>
              <div className="section-title">New Post</div>
              <div className="section-sub">Upload content, we'll handle the rest.</div>
            </div>

            {/* Media */}
            <div id="t-media" className="card" style={{padding:18}}>
              <div className="lbl" style={{marginBottom:12}}>Media</div>
              <label style={{display:"flex",flexDirection:"column",alignItems:"center",gap:12,padding:"28px 16px",background:"rgba(99,102,241,0.04)",border:"2px dashed rgba(99,102,241,0.2)",borderRadius:14,cursor:"pointer",textAlign:"center"}}>
                <input type="file" accept="image/*,video/*" multiple onChange={onFiles} style={{display:"none"}} capture="environment"/>
                <div style={{width:48,height:48,borderRadius:14,background:"rgba(99,102,241,0.1)",border:"1px solid rgba(99,102,241,0.2)",display:"flex",alignItems:"center",justifyContent:"center",fontSize:22}}>📸</div>
                <div><div style={{fontSize:13,fontWeight:700,color:"#a5b4fc"}}>Take Photo / Browse Files</div><div style={{fontSize:11,color:"#3d4155",marginTop:3}}>Up to 5 files · 50MB each</div></div>
              </label>
              {previews.length > 0 && (
                <div style={{display:"grid",gridTemplateColumns:"repeat(5,1fr)",gap:6,marginTop:10}}>
                  {previews.map((url,i)=>(
                    <div key={url} style={{position:"relative",aspectRatio:"1",borderRadius:10,overflow:"hidden",border:"1px solid rgba(255,255,255,0.08)"}}>
                      <img src={url} alt="" style={{width:"100%",height:"100%",objectFit:"cover"}}/>
                      <button onClick={()=>rmFile(i)} style={{position:"absolute",top:3,right:3,width:18,height:18,borderRadius:"50%",background:"rgba(0,0,0,0.7)",border:"none",color:"#fff",fontSize:10,cursor:"pointer",display:"flex",alignItems:"center",justifyContent:"center"}}>×</button>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Voice */}
            <div id="t-voice" className="card" style={{padding:18}}>
              <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:12}}>
                <div className="lbl">Voice Instruction</div>
                {speechOk && <span className="badge bg-green">Live Transcription</span>}
              </div>
              <div style={{display:"flex",alignItems:"center",gap:12}}>
                {recording ? (
                  <button onClick={stopRec} className="btn rec-pulse" style={{background:"#ef4444",color:"#fff",border:"none",padding:"10px 18px",borderRadius:30,fontSize:12,fontWeight:700,display:"flex",gap:7,alignItems:"center"}}>
                    <span style={{width:8,height:8,background:"#fff",borderRadius:"50%"}}/>Stop
                  </button>
                ) : (
                  <button onClick={startRec} className="btn btn-indigo" style={{padding:"10px 18px",fontSize:12,borderRadius:30}}>🎤 Record</button>
                )}
                {recording && <div style={{display:"flex",gap:3,alignItems:"center",height:36,flex:1,justifyContent:"center"}}>{Array.from({length:14}).map((_,i)=><div key={i} className="vbar"/>)}</div>}
              </div>
              {voiceUrl && <div style={{marginTop:12}}><audio src={voiceUrl} controls style={{width:"100%",height:34}}/></div>}
              {transcript && <div style={{marginTop:12}}><div className="lbl" style={{marginBottom:6}}>Transcription</div><textarea className="inp" value={transcript} onChange={e=>setTranscript(e.target.value)} style={{minHeight:60,resize:"vertical",fontSize:12}}/></div>}
            </div>

            {/* Brief */}
            <div id="t-brief" className="card" style={{padding:18}}>
              <div className="lbl" style={{marginBottom:10}}>Post Brief</div>
              <textarea className="inp" value={brief} onChange={e=>setBrief(e.target.value)} rows={4} placeholder="What's this post about? Any promo, tone, or context…" style={{resize:"vertical"}}/>

              <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:12,marginTop:14}}>
                <div>
                  <div className="lbl" style={{marginBottom:6}}>Tone</div>
                  <select className="inp" value={tone} onChange={e=>setTone(e.target.value)} style={{padding:"10px 12px"}}>
                    <option value="friendly">Friendly</option>
                    <option value="professional">Professional</option>
                    <option value="casual">Casual</option>
                    <option value="promotional">Promotional</option>
                  </select>
                </div>
                <div>
                  <div className="lbl" style={{marginBottom:6}}>Fee</div>
                  <div className="inp" style={{display:"flex",alignItems:"center",gap:7,padding:"10px 12px",cursor:"default"}}><span>💰</span><span style={{fontWeight:700,color:"#a5b4fc",fontSize:13}}>$100 flat</span></div>
                </div>
              </div>

              <div style={{marginTop:14}}>
                <div className="lbl" style={{marginBottom:8}}>Platforms</div>
                <div style={{display:"flex",flexWrap:"wrap",gap:7}}>
                  {["instagram","facebook","linkedin","tiktok","x"].map(p=>{
                    const act = platforms.includes(p);
                    const cols: Record<string,string> = {instagram:"#e1306c",facebook:"#1877f2",linkedin:"#0a66c2",tiktok:"#ff0050",x:"#1da1f2"};
                    return (
                      <button key={p} onClick={()=>setPlatforms(prev=>act?prev.filter(x=>x!==p):[...prev,p])} className="plat-pill" style={act?{background:`${cols[p]}18`,borderColor:cols[p],color:cols[p]}:{}}>
                        <span style={{textTransform:"capitalize"}}>{p}</span>{act&&<span>✓</span>}
                      </button>
                    );
                  })}
                </div>
              </div>
            </div>

            <button onClick={generate} disabled={generating||(!brief.trim()&&!transcript.trim()&&files.length===0)} className="btn btn-indigo" style={{width:"100%",padding:"16px",fontSize:14}}>
              {generating?<><div style={{width:16,height:16,border:"2px solid rgba(255,255,255,0.3)",borderTopColor:"#fff",borderRadius:"50%"}} className="spin"/>Writing captions…</>:"🚀 Generate Drafts"}
            </button>
          </div>
        )}

        {/* ╔══════════════════════════════╗
            ║       REVIEW DRAFTS          ║
            ╚══════════════════════════════╝ */}
        {tab === "review" && (
          <div id="t-review" style={{display:"flex",flexDirection:"column",gap:14}}>
            <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",padding:"4px 0 8px"}}>
              <div><div className="section-title">Review</div><div className="section-sub">Edit & approve your drafts.</div></div>
              <button onClick={()=>setTab("create")} className="btn btn-ghost" style={{padding:"8px 14px",fontSize:12}}>← Back</button>
            </div>

            {drafts.length===0 ? (
              <div className="card empty">
                <div className="empty-icon">✍️</div>
                <div className="empty-title">No drafts yet</div>
                <div className="empty-sub">Create a post and generate AI drafts first.</div>
                <button onClick={()=>setTab("create")} className="btn btn-indigo" style={{padding:"12px 20px",fontSize:13,marginTop:4}}>→ Create Post</button>
              </div>
            ) : (
              <>
                {drafts.map((d,i)=>(
                  <div key={d.platform} className="card" style={{overflow:"hidden"}}>
                    {/* Platform header */}
                    <div style={{padding:"12px 14px",borderBottom:"1px solid rgba(255,255,255,0.05)",display:"flex",alignItems:"center",gap:10}}>
                      <div style={{width:28,height:28,borderRadius:"50%",background:"linear-gradient(135deg,#6366f1,#4f46e5)",display:"flex",alignItems:"center",justifyContent:"center",fontSize:11,fontWeight:800,color:"#fff",flexShrink:0}}>{client?.business_name?.[0]?.toUpperCase()||"C"}</div>
                      <div><div style={{fontSize:12,fontWeight:700,color:"#e2e4ec"}}>{client?.business_name||client?.slug}</div><div style={{fontSize:9,color:"#6366f1",textTransform:"capitalize",fontWeight:700}}>{d.platform} Draft</div></div>
                    </div>
                    {/* Image */}
                    {previews.length>0&&<div style={{aspectRatio:"16/9",overflow:"hidden",background:"#080a12"}}><img src={previews[0]} alt="" style={{width:"100%",height:"100%",objectFit:"cover"}}/></div>}
                    {/* Caption */}
                    <div style={{padding:14}}>
                      <textarea value={d.caption} onChange={e=>{const u=[...drafts];u[i].caption=e.target.value;setDrafts(u);}} className="inp" style={{minHeight:80,resize:"vertical",background:"transparent",border:"none",padding:0,color:"#c9cbd6",fontSize:13,lineHeight:1.6}}/>
                      <div style={{display:"flex",flexWrap:"wrap",gap:4,marginTop:8,borderTop:"1px solid rgba(255,255,255,0.04)",paddingTop:8}}>
                        {d.hashtags?.map((h:string)=><span key={h} style={{fontSize:11,color:"#6366f1"}}>{h}</span>)}
                      </div>
                      <div style={{fontSize:10,color:"#3d4155",marginTop:6}}>Best slot: {fmt(d.scheduledAt)}</div>
                    </div>
                  </div>
                ))}

                {/* Approve */}
                <div className="card" style={{padding:18,border:"1px solid rgba(99,102,241,0.22)"}}>
                  {approved ? (
                    <div style={{textAlign:"center",padding:"8px 0"}}>
                      <div style={{fontSize:48,marginBottom:10}}>🎉</div>
                      <div style={{fontSize:17,fontWeight:800,color:"#10b981"}}>Post Queued!</div>
                      <div style={{fontSize:12,color:"#4b5563",marginTop:4}}>$100 AUD logged to your account.</div>
                    </div>
                  ) : (
                    <>
                      <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:14}}>
                        <div><div className="lbl">Charge</div><div style={{fontSize:14,fontWeight:700,color:"#e2e4ec",marginTop:2}}>{drafts.length} platform{drafts.length!==1?"s":""}</div></div>
                        <div style={{fontSize:22,fontWeight:800,color:"#10b981"}}>$100 AUD</div>
                      </div>
                      <button onClick={approve} disabled={approving} className="btn btn-green" style={{width:"100%",padding:"14px",fontSize:14}}>
                        {approving?<><div style={{width:16,height:16,border:"2px solid rgba(255,255,255,0.3)",borderTopColor:"#fff",borderRadius:"50%"}} className="spin"/>Processing…</>:"Approve & Publish →"}
                      </button>
                    </>
                  )}
                </div>
              </>
            )}
          </div>
        )}

        {/* ╔══════════════════════════════╗
            ║       POSTING QUEUE          ║
            ╚══════════════════════════════╝ */}
        {tab === "calendar" && (
          <div id="t-queue" style={{display:"flex",flexDirection:"column",gap:14}}>
            <div style={{padding:"4px 0 8px"}}><div className="section-title">Queue</div><div className="section-sub">Approved posts scheduled for publishing.</div></div>
            {queue.length===0 ? (
              <div className="card empty"><div className="empty-icon">📅</div><div className="empty-title">Empty queue</div><div className="empty-sub">Approved posts will show up here once you've reviewed and confirmed drafts.</div></div>
            ) : (
              queue.map((p:any,i:number)=>(
                <div key={p.id||i} className="card" style={{padding:16,display:"flex",gap:12,alignItems:"flex-start"}}>
                  <div style={{width:38,height:38,borderRadius:10,background:"rgba(16,185,129,0.1)",border:"1px solid rgba(16,185,129,0.15)",display:"flex",alignItems:"center",justifyContent:"center",fontSize:18,flexShrink:0}}>📱</div>
                  <div style={{flex:1,minWidth:0}}>
                    <div style={{display:"flex",alignItems:"center",gap:7,marginBottom:5,flexWrap:"wrap"}}>
                      <span style={{fontSize:13,fontWeight:700,textTransform:"capitalize",color:"#e2e4ec"}}>{p.platform}</span>
                      <span className="badge bg-green">Queued</span>
                    </div>
                    <p style={{fontSize:12,color:"#6b7280",lineHeight:1.5}}>{p.caption}</p>
                    <div style={{fontSize:10,color:"#3d4155",marginTop:6}}>📅 {fmt(p.scheduledAt)}</div>
                  </div>
                </div>
              ))
            )}
          </div>
        )}

        {/* ╔══════════════════════════════╗
            ║         BILLING              ║
            ╚══════════════════════════════╝ */}
        {tab === "billing" && (
          <div id="t-billing" style={{display:"flex",flexDirection:"column",gap:14}}>
            <div style={{padding:"4px 0 8px"}}><div className="section-title">Billing</div><div className="section-sub">$100 flat-fee per approved post.</div></div>
            <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:12}}>
              <div className="card" style={{padding:18}}>
                <div className="lbl">Total</div>
                <div style={{fontSize:26,fontWeight:800,color:"#10b981",marginTop:5}}>${(payments.length*100).toFixed(2)}</div>
                <div style={{fontSize:10,color:"#3d4155",marginTop:2}}>AUD</div>
              </div>
              <div className="card" style={{padding:18}}>
                <div className="lbl">Invoices</div>
                <div style={{fontSize:26,fontWeight:800,color:"#a5b4fc",marginTop:5}}>{payments.length}</div>
                <div style={{fontSize:10,color:"#3d4155",marginTop:2}}>issued</div>
              </div>
            </div>
            <div className="card" style={{padding:18}}>
              <div className="lbl" style={{marginBottom:12}}>Transaction History</div>
              {payments.length===0 ? (
                <div style={{textAlign:"center",padding:"24px 0",color:"#3d4155",fontSize:13}}>No transactions yet.</div>
              ) : (
                payments.map(p=>(
                  <div key={p.id} style={{display:"flex",justifyContent:"space-between",alignItems:"center",padding:"12px 0",borderBottom:"1px solid rgba(255,255,255,0.04)"}}>
                    <div style={{display:"flex",gap:10,alignItems:"center"}}>
                      <div style={{width:34,height:34,borderRadius:9,background:"rgba(16,185,129,0.08)",display:"flex",alignItems:"center",justifyContent:"center",fontSize:15}}>💳</div>
                      <div><div style={{fontSize:12,fontWeight:600,color:"#e2e4ec"}}>Social Post Fee</div><div style={{fontSize:10,color:"#3d4155",marginTop:1}}>{new Date(p.created_at).toLocaleDateString("en-AU")} · #{p.id?.slice(0,8)}</div></div>
                    </div>
                    <div style={{textAlign:"right"}}><div style={{fontSize:13,fontWeight:700,color:"#10b981"}}>$100.00</div><span className="badge bg-green" style={{marginTop:3}}>Paid</span></div>
                  </div>
                ))
              )}
            </div>
          </div>
        )}

        {/* ╔══════════════════════════════╗
            ║      REPORTS (hidden in nav) ║
            ╚══════════════════════════════╝ */}
        {tab === "reports" && (
          <div style={{display:"flex",flexDirection:"column",gap:14}}>
            <div style={{padding:"4px 0 8px"}}><div className="section-title">Reports</div><div className="section-sub">Monthly performance summaries.</div></div>
            {[
              {month:"May 2026",count:4,reach:"12.4K",eng:"8.2%",trend:"+14%",note:"Strong — engagement up 14%. Focus June: video."},
              {month:"April 2026",count:3,reach:"9.8K",eng:"7.1%",trend:"+11%",note:"Good start. Logo reveal drove brand awareness."},
              {month:"March 2026",count:2,reach:"5.2K",eng:"6.4%",trend:"—",note:"First live month. Audience building steadily."},
            ].map(r=>(
              <div key={r.month} className="card" style={{padding:18}}>
                <div style={{display:"flex",justifyContent:"space-between",marginBottom:12}}><div style={{fontWeight:800,fontSize:15,color:"#e2e4ec"}}>{r.month}</div><div style={{display:"flex",gap:6}}><span className="badge bg-indigo">Published</span>{r.trend!=="—"&&<span className="badge bg-green">{r.trend}</span>}</div></div>
                <div style={{display:"grid",gridTemplateColumns:"repeat(3,1fr)",gap:10,background:"rgba(255,255,255,0.02)",padding:12,borderRadius:10,marginBottom:12}}>
                  {[{l:"Posts",v:r.count,c:"#a5b4fc"},{l:"Reach",v:r.reach,c:"#10b981"},{l:"Engagement",v:r.eng,c:"#3b82f6"}].map(s=>(
                    <div key={s.l} style={{textAlign:"center"}}><div style={{fontSize:9,color:"#4b5563",marginBottom:3}}>{s.l}</div><div style={{fontSize:18,fontWeight:800,color:s.c}}>{s.v}</div></div>
                  ))}
                </div>
                <p style={{fontSize:12,color:"#4b5563",lineHeight:1.6}}>{r.note}</p>
              </div>
            ))}
          </div>
        )}

        {/* Brand Accounts (accessible from profile) */}
        {tab === "stats" && (
          <div style={{display:"flex",flexDirection:"column",gap:14}}>
            <div style={{padding:"4px 0 8px"}}><div className="section-title">Brand Accounts</div><div className="section-sub">Connected social channels.</div></div>
            <div className="card" style={{padding:18}}>
              {[{p:"Instagram",h:"@webgecko",s:"Linked",c:"#e1306c",i:"📸"},{p:"Facebook",h:"WebGecko Business",s:"Linked",c:"#1877f2",i:"👥"},{p:"LinkedIn",h:"WebGecko Corp",s:"Linked",c:"#0a66c2",i:"💼"},{p:"TikTok",h:"@webgecko",s:"Awaiting auth",c:"#ff0050",i:"🎵"},{p:"X",h:"@webgecko_au",s:"Awaiting auth",c:"#1da1f2",i:"🐦"}].map((a,i,arr)=>(
                <div key={a.p} style={{display:"flex",justifyContent:"space-between",alignItems:"center",padding:"13px 0",borderBottom:i<arr.length-1?"1px solid rgba(255,255,255,0.04)":"none"}}>
                  <div style={{display:"flex",alignItems:"center",gap:12}}>
                    <div style={{width:36,height:36,borderRadius:10,background:`${a.c}18`,border:`1px solid ${a.c}30`,display:"flex",alignItems:"center",justifyContent:"center",fontSize:17}}>{a.i}</div>
                    <div><div style={{fontSize:13,fontWeight:700,color:"#e2e4ec"}}>{a.p}</div><div style={{fontSize:11,color:"#4b5563",marginTop:1}}>{a.h}</div></div>
                  </div>
                  <span className={`badge ${a.s==="Linked"?"bg-green":"bg-amber"}`}>{a.s}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* ╔══════════════════════════════╗
            ║        PROFILE               ║
            ╚══════════════════════════════╝ */}
        {tab === "profile" && (
          <div id="t-profile" style={{display:"flex",flexDirection:"column",gap:14}}>
            <div style={{padding:"4px 0 8px"}}><div className="section-title">Profile</div><div className="section-sub">Your account & agreements.</div></div>

            {/* Avatar + name */}
            <div className="card" style={{padding:20,display:"flex",gap:14,alignItems:"center"}}>
              <div style={{width:52,height:52,borderRadius:"50%",background:"linear-gradient(135deg,#6366f1,#4f46e5)",display:"flex",alignItems:"center",justifyContent:"center",fontSize:22,fontWeight:800,color:"#fff",flexShrink:0}}>{client?.business_name?.[0]?.toUpperCase()||"C"}</div>
              <div>
                <div style={{fontSize:16,fontWeight:800,color:"#f3f4f6"}}>{client?.business_name||client?.slug}</div>
                <div style={{fontSize:12,color:hasSocial?"#10b981":"#4b5563",fontWeight:600,marginTop:2}}>{hasSocial?"✦ Social Bundle Active":"Starter Plan"}</div>
              </div>
            </div>

            <div className="card" style={{padding:18}}>
              <div className="lbl" style={{marginBottom:12}}>Account Details</div>
              {[{label:"Email",value:client?.email||"—"},{label:"Phone",value:client?.phone||"—"},{label:"Job Ref",value:client?.job_id,mono:true}].map(row=>(
                <div key={row.label} style={{display:"flex",justifyContent:"space-between",alignItems:"center",padding:"10px 0",borderBottom:"1px solid rgba(255,255,255,0.04)"}}>
                  <span style={{fontSize:12,color:"#4b5563",fontWeight:600}}>{row.label}</span>
                  <span style={{fontSize:12,fontWeight:600,color:"#e2e4ec",fontFamily:row.mono?"monospace":"inherit",maxWidth:"60%",textAlign:"right",wordBreak:"break-all"}}>{row.value}</span>
                </div>
              ))}
            </div>

            {/* More links */}
            <div className="card" style={{padding:18}}>
              <div className="lbl" style={{marginBottom:12}}>More</div>
              {[{label:"Monthly Reports",icon:"📊",action:()=>setTab("reports")},{label:"Brand Accounts",icon:"📡",action:()=>setTab("stats")}].map(r=>(
                <button key={r.label} onClick={r.action} style={{width:"100%",display:"flex",justifyContent:"space-between",alignItems:"center",padding:"12px 14px",background:"rgba(255,255,255,0.02)",border:"1px solid rgba(255,255,255,0.05)",borderRadius:12,color:"#d1d5db",fontSize:13,cursor:"pointer",marginBottom:8,fontFamily:"inherit"}}>
                  <span>{r.icon} {r.label}</span><span style={{color:"#6366f1"}}>→</span>
                </button>
              ))}
            </div>

            <div className="card" style={{padding:18}}>
              <div className="lbl" style={{marginBottom:12}}>Legal Agreements</div>
              {Object.keys(LEGAL).map(k=>(
                <button key={k} onClick={()=>setLegalDoc(k)} style={{width:"100%",display:"flex",justifyContent:"space-between",alignItems:"center",padding:"12px 14px",background:"rgba(255,255,255,0.02)",border:"1px solid rgba(255,255,255,0.05)",borderRadius:12,color:"#d1d5db",fontSize:13,cursor:"pointer",marginBottom:8,fontFamily:"inherit"}}>
                  <span>📄 {LEGAL[k].title}</span><span style={{color:"#6366f1"}}>View →</span>
                </button>
              ))}
            </div>

            <button onClick={logout} className="btn btn-danger-ghost" style={{width:"100%",padding:14,fontSize:13,fontFamily:"inherit",borderRadius:14}}>Sign Out</button>
          </div>
        )}
      </div>

      {/* ── Bottom Nav ── */}
      <nav className="app-nav">
        {NAV_ITEMS.map(n=>{
          const active = tab===n.id;
          return (
            <button key={n.id} onClick={()=>go(n.id as Tab)} className={`nav-btn${active?" active":""}`}>
              <span className="nav-icon">
                {n.icon}
                {n.locked && <span className="nav-lock">🔒</span>}
                {active && <span className="nav-active-pip"/>}
              </span>
              <span className="nav-label">{n.label}</span>
            </button>
          );
        })}
      </nav>

      {/* ── Upsell Modal ── */}
      {showUpsell && (
        <div style={{position:"fixed",inset:0,zIndex:400,display:"flex",alignItems:"flex-end",justifyContent:"center",padding:"0 0 80px"}}>
          <div style={{position:"absolute",inset:0,background:"rgba(0,0,0,0.8)",backdropFilter:"blur(8px)"}} onClick={()=>setShowUpsell(false)}/>
          <div className="card fade-up" style={{width:"calc(100% - 32px)",maxWidth:398,padding:28,zIndex:1,textAlign:"center",border:"1px solid rgba(99,102,241,0.3)",borderRadius:24,position:"relative",background:"#0d1020"}}>
            <button onClick={()=>setShowUpsell(false)} style={{position:"absolute",top:14,right:14,background:"none",border:"none",color:"#4b5563",cursor:"pointer",fontSize:20}}>×</button>
            <div style={{fontSize:52,marginBottom:14}}>🔒</div>
            <div style={{fontFamily:"'Outfit',sans-serif",fontSize:21,fontWeight:900,marginBottom:10,color:"#f3f4f6"}}>Social Bundle Required</div>
            <p style={{fontSize:13,color:"#4b5563",lineHeight:1.7,marginBottom:22}}>Unlock AI-powered posting. We'll draft platform-specific captions based on your photos, videos, or voice notes — <strong style={{color:"#e2e4ec"}}>$100 AUD flat fee</strong> per approved post.</p>
            <div style={{display:"flex",flexDirection:"column",gap:10}}>
              <a href={`mailto:hello@webgecko.au?subject=Activate Social Bundle - ${client?.business_name||client?.slug}`} style={{display:"block",textDecoration:"none",background:"linear-gradient(135deg,#6366f1,#4f46e5)",color:"#fff",borderRadius:14,padding:14,fontSize:14,fontWeight:700,boxShadow:"0 4px 20px rgba(99,102,241,0.35)"}}>Contact Team to Activate ✉️</a>
              <button onClick={()=>setShowUpsell(false)} className="btn btn-ghost" style={{width:"100%",padding:13,fontSize:13,borderRadius:14}}>Maybe Later</button>
            </div>
          </div>
        </div>
      )}

      {/* ── Legal Sheet ── */}
      {legalDoc && (
        <div style={{position:"fixed",inset:0,zIndex:500,background:"#07090f",display:"flex",flexDirection:"column"}} className="fade-up">
          <div className="app-header"><button onClick={()=>setLegalDoc(null)} style={{background:"none",border:"none",color:"#6366f1",cursor:"pointer",fontSize:15,fontWeight:700,fontFamily:"inherit"}}>← Close</button><div style={{fontSize:14,fontWeight:800,color:"#e2e4ec"}}>{LEGAL[legalDoc].title}</div><div style={{width:60}}/></div>
          <div style={{flex:1,padding:24,overflowY:"auto",lineHeight:1.8,fontSize:14,color:"#6b7280"}}>
            <div style={{fontSize:11,color:"#3d4155",marginBottom:16}}>Updated: {LEGAL[legalDoc].updated}</div>
            <p>{LEGAL[legalDoc].body}</p>
          </div>
        </div>
      )}

      {/* ── Tour ── */}
      {tourOn && (
        <>
          <div className="tour-overlay"/>
          <div className="tour-card" style={{top:tourY, bottom:"auto"}}>
            <div className="tour-prog"><div className="tour-prog-fill" style={{width:`${((tourStep+1)/TOUR.length)*100}%`}}/></div>
            <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:12}}>
              <span style={{fontSize:11,color:"#3d4155",fontWeight:600}}>Step {tourStep+1} of {TOUR.length}</span>
              <button onClick={endTour} style={{background:"none",border:"none",color:"#3d4155",cursor:"pointer",fontSize:18,lineHeight:1}}>×</button>
            </div>
            <div style={{display:"flex",gap:12,marginBottom:12}}>
              <div style={{width:42,height:42,borderRadius:12,background:"rgba(99,102,241,0.1)",border:"1px solid rgba(99,102,241,0.2)",display:"flex",alignItems:"center",justifyContent:"center",fontSize:20,flexShrink:0}}>{TOUR[tourStep].emoji}</div>
              <div style={{fontSize:14,fontWeight:800,color:"#f3f4f6",lineHeight:1.35,alignSelf:"center"}}>{TOUR[tourStep].title}</div>
            </div>
            <p style={{fontSize:13,color:"#4b5563",lineHeight:1.7,marginBottom:18}}>{TOUR[tourStep].desc}</p>
            <div style={{display:"flex",gap:8}}>
              {tourStep>0 && <button onClick={tourPrev} className="btn btn-ghost" style={{flex:1,padding:"10px",fontSize:12}}>← Back</button>}
              <button onClick={tourNext} className="btn btn-indigo" style={{flex:2,padding:"10px",fontSize:12,justifyContent:"center"}}>
                {tourStep===TOUR.length-1?"Finish 🎉":"Next →"}
              </button>
            </div>
            {tourStep===0 && <button onClick={endTour} style={{width:"100%",marginTop:10,background:"none",border:"none",color:"#3d4155",fontSize:11,cursor:"pointer",fontFamily:"inherit"}}>Skip tour</button>}
          </div>
        </>
      )}
    </div>
  );
}
