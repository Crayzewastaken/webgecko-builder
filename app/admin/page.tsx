"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { Suspense } from "react";
import uiHistory from "@/lib/ui-history.json";

// ── Interfaces ─────────────────────────────────────────────────────────────────
interface SeoData {
  lsiKeywords?: string[];
  metaDescription?: string;
  serpInsights?: { avgWordCount: number; avgH2Count: number; topHeadings: string[]; winningStructure: string } | null;
  projectTitle?: string;
}
interface ClientAnalytics {
  slug: string; jobId: string; businessName: string; industry: string;
  previewUrl: string; buildStatus: string; domain?: string; liveDomain?: string;
  liveUrl?: string; vercelProjectName?: string;
  paymentState: { depositPaid: boolean; finalPaid: boolean; monthlyActive: boolean };
  analytics: { thisMonth: { views: number; bookingClicks: number; contactClicks: number }; today: { views: number; bookingClicks: number }; totals: { views: number; bookingClicks: number; formSubmits: number }; spark?: number[]; sparkMonths?: string[] } | null;
  bookingCount: number; hasBooking: boolean; builtAt?: string; supersaasId?: string;
  supersaasUrl?: string; bookingServices?: string; clientEmail?: string; clientPhone?: string;
  tawktoPropertyId?: string; shopCatalogue?: any[] | null;
  logoUrl?: string; heroUrl?: string; photoUrls?: string[];
  squareAccessToken?: string; squareLocationId?: string; ga4Id?: string;
  stripeAccountId?: string; stripeConnectedAt?: string; shopPlatform?: string;
  userInput?: { features?: string[]; pages?: string[]; siteType?: string; style?: string; colorPrefs?: string; usp?: string; goal?: string; additionalNotes?: string; abn?: string; businessAddress?: string; facebookPage?: string; instagramUrl?: string; linkedinUrl?: string; bookingServices?: string; businessDescription?: string; };
  metadata?: { scheduledReleaseAt?: string; scheduledReleaseDays?: number; checklistCompletedAt?: string; alreadyReleased?: boolean; seo?: SeoData; domainStatus?: string; domainUrl?: string; lastGoodAt?: string; lastGoodUrl?: string; lastGoodHtml?: string; rolledBackAt?: string; };
}

// ── Themes ─────────────────────────────────────────────────────────────────────
const DARK = {
  bg:"#070d1a", surface:"#0c1526", raised:"#111f36", border:"rgba(255,255,255,0.07)", borderHov:"rgba(255,255,255,0.17)",
  text:"#f0f4ff", textSec:"#b8c8e0", textMuted:"#7a90a8",
  green:"#00d4a0", blue:"#4a9eff", amber:"#ff9f24", red:"#f43f5e", purple:"#8347ff", cyan:"#00e5ff",
  overlay:"rgba(4,8,15,0.92)", shadow:"0 4px 24px rgba(0,0,0,0.7), inset 0 1px 0 rgba(255,255,255,0.03)", shadowLg:"0 12px 40px rgba(0,0,0,0.85)", shadowXl:"-4px 0 60px rgba(0,0,0,0.95)",
};
const LIGHT = {
  bg:"#f4f7fb", surface:"#ffffff", raised:"#eef2f8", border:"rgba(0,0,0,0.07)", borderHov:"rgba(0,0,0,0.16)",
  text:"#0a0f1e", textSec:"#1e3a5f", textMuted:"#4a6080",
  green:"#059669", blue:"#2563eb", amber:"#d97706", red:"#dc2626", purple:"#7c3aed", cyan:"#0284c7",
  overlay:"rgba(0,0,0,0.55)", shadow:"0 1px 4px rgba(0,0,0,0.08)", shadowLg:"0 8px 28px rgba(0,0,0,0.12)", shadowXl:"0 20px 52px rgba(0,0,0,0.18)",
};
let T = DARK;

// ── GeckoLogo component ────────────────────────────────────────────────────────
function GeckoLogo({ size = 28, color = "#00d4a0" }: { size?: number; color?: string }) {
  return (
    <svg width={size} height={Math.round(size * 1.15)} viewBox="0 0 40 46" fill="none" xmlns="http://www.w3.org/2000/svg">
      {/* Body */}
      <ellipse cx="20" cy="22" rx="5.5" ry="9.5" fill={color}/>
      {/* Head */}
      <ellipse cx="20" cy="8" rx="6" ry="5.5" fill={color}/>
      {/* Eyes */}
      <circle cx="17.2" cy="7" r="2.2" fill="#070d1a"/>
      <circle cx="22.8" cy="7" r="2.2" fill="#070d1a"/>
      <circle cx="17.8" cy="6.5" r="0.9" fill="white" opacity="0.85"/>
      <circle cx="23.4" cy="6.5" r="0.9" fill="white" opacity="0.85"/>
      {/* Left arm */}
      <path d="M14.5 19 C10 17 7 18 5 20 C4 21.5 5.5 23 7 22 C9 21 11.5 21.5 14.5 22" stroke={color} strokeWidth="2.5" strokeLinecap="round" fill="none"/>
      {/* Left toe pads */}
      <circle cx="5.2" cy="20.2" r="1.1" fill={color}/>
      <circle cx="4.6" cy="22.5" r="1.1" fill={color}/>
      <circle cx="6.8" cy="23.6" r="1.1" fill={color}/>
      {/* Right arm */}
      <path d="M25.5 19 C30 17 33 18 35 20 C36 21.5 34.5 23 33 22 C31 21 28.5 21.5 25.5 22" stroke={color} strokeWidth="2.5" strokeLinecap="round" fill="none"/>
      {/* Right toe pads */}
      <circle cx="34.8" cy="20.2" r="1.1" fill={color}/>
      <circle cx="35.4" cy="22.5" r="1.1" fill={color}/>
      <circle cx="33.2" cy="23.6" r="1.1" fill={color}/>
      {/* Tail */}
      <path d="M17.5 31 C17 36 15.5 40 14.5 43 C14 44.2 14.8 45 16 44.5 C17 44 17.5 42 18 39 C18.5 41.5 19 43.5 18.5 45 C19.5 45.5 20.5 44.8 20.5 43.5 C20.5 41 20 38 20 31" stroke={color} strokeWidth="2.2" strokeLinecap="round" fill="none"/>
    </svg>
  );
}

// ── SparkLine component ─────────────────────────────────────────────────────────
function SparkLine({ data, color = "#4a9eff", height = 36, width = 90 }: { data: number[]; color?: string; height?: number; width?: number }) {
  if (!data || data.length < 2) return null;
  const min = Math.min(...data);
  const max = Math.max(...data);
  const range = max - min || 1;
  const pts = data.map((v, i) => {
    const x = (i / (data.length - 1)) * width;
    const y = height - ((v - min) / range) * (height - 4) - 2;
    return `${x},${y}`;
  });
  const polyline = pts.join(" ");
  const areaPath = `M${pts[0]} L${pts.slice(1).join(" L")} L${width},${height} L0,${height} Z`;
  return (
    <svg width={width} height={height} viewBox={`0 0 ${width} ${height}`} style={{ overflow:"visible" }}>
      <defs>
        <linearGradient id={`sg-${color.replace("#","")}`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={color} stopOpacity="0.3"/>
          <stop offset="100%" stopColor={color} stopOpacity="0.0"/>
        </linearGradient>
      </defs>
      <path d={areaPath} fill={`url(#sg-${color.replace("#","")})`}/>
      <polyline points={polyline} fill="none" stroke={color} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/>
    </svg>
  );
}

// ── Global CSS ─────────────────────────────────────────────────────────────────
const CSS = `
  @import url('https://fonts.googleapis.com/css2?family=Space+Grotesk:wght@400;500;600;700&family=Inter:wght@400;500;600&family=JetBrains+Mono:wght@400;500&display=swap');
  *, *::before, *::after { box-sizing: border-box; }
  body { margin: 0; }

  /* Keyframes */
  @keyframes wg-fade    { from{opacity:0} to{opacity:1} }
  @keyframes wg-up      { from{opacity:0;transform:translateY(14px)} to{opacity:1;transform:translateY(0)} }
  @keyframes wg-panel   { from{transform:translateX(100%);opacity:0} to{transform:translateX(0);opacity:1} }
  @keyframes wg-ping    { 0%{transform:scale(1);opacity:.9} 100%{transform:scale(2.4);opacity:0} }
  @keyframes wg-spin    { from{transform:rotate(0deg)} to{transform:rotate(360deg)} }
  @keyframes wg-toast   { 0%{opacity:0;transform:translateY(8px) scale(.95)} 100%{opacity:1;transform:none} }
  @keyframes wg-shimmer { 0%{background-position:-800px 0} 100%{background-position:800px 0} }
  @keyframes wg-pulse   { 0%,100%{opacity:.6} 50%{opacity:1} }
  @keyframes wg-scan    { 0%{transform:translateY(-100%)} 100%{transform:translateY(500%)} }
  @keyframes wg-border  { 0%{background-position:0% 50%} 100%{background-position:200% 50%} }

  /* Component animations */
  .wg-panel { animation: wg-panel 0.3s cubic-bezier(0.22,1,0.36,1) }
  .wg-card  { animation: wg-up 0.3s cubic-bezier(0.22,1,0.36,1) both }
  .wg-tab   { animation: wg-fade 0.18s ease }
  .wg-toast { animation: wg-toast 0.22s ease }

  /* Grid bg — visible blueprint grid */
  .wg-grid-bg {
    background-color: #04080f;
    background-image:
      radial-gradient(ellipse 70% 50% at 50% 0%, rgba(79,158,255,0.13) 0%, transparent 55%),
      radial-gradient(ellipse 40% 30% at 80% 80%, rgba(167,133,255,0.07) 0%, transparent 55%),
      linear-gradient(rgba(79,158,255,0.06) 1px, transparent 1px),
      linear-gradient(90deg, rgba(79,158,255,0.06) 1px, transparent 1px);
    background-size: 100% 100%, 100% 100%, 52px 52px, 52px 52px;
  }

  /* Client card — clickable grid item */
  .wg-cc {
    transition: transform 0.22s cubic-bezier(0.22,1,0.36,1), box-shadow 0.22s ease, border-color 0.22s ease;
    cursor: pointer;
  }
  .wg-cc:hover { transform: translateY(-4px) scale(1.005); }

  /* Gradient text */
  .wg-brand-text {
    background: linear-gradient(130deg, #cce0ff 20%, #b085ff 80%);
    -webkit-background-clip: text; -webkit-text-fill-color: transparent;
    background-clip: text;
  }
  .wg-accent-text {
    background: linear-gradient(130deg, #4f9eff 0%, #00e5ff 100%);
    -webkit-background-clip: text; -webkit-text-fill-color: transparent;
    background-clip: text;
  }

  /* Glass — nav */
  .wg-glass {
    backdrop-filter: blur(24px) saturate(200%);
    -webkit-backdrop-filter: blur(24px) saturate(200%);
  }

  /* Scan line effect on stat cards */
  .wg-stat-scan::after {
    content:''; position:absolute; inset:0;
    background: linear-gradient(transparent 45%, rgba(79,158,255,0.05) 50%, transparent 55%);
    animation: wg-scan 4s linear infinite; pointer-events:none; border-radius:inherit;
  }

  /* Neon glow ring around a card — apply as extra class */
  .wg-neon { box-shadow: 0 0 0 1px rgba(79,158,255,0.12), 0 4px 28px rgba(0,0,0,0.8), inset 0 1px 0 rgba(255,255,255,0.05) !important; }

  button { font-family:inherit; transition: opacity 0.15s ease, transform 0.12s ease, box-shadow 0.15s ease !important }
  button:active:not(:disabled) { transform: scale(0.95) !important }
  ::-webkit-scrollbar { width:4px; height:4px }
  ::-webkit-scrollbar-track { background:transparent }
  ::-webkit-scrollbar-thumb { background:rgba(79,158,255,0.3); border-radius:99px }
  ::-webkit-scrollbar-thumb:hover { background:rgba(79,158,255,0.55) }
  input, textarea, select { font-family: inherit }
  input:focus, textarea:focus, select:focus { outline: none; border-color: rgba(79,158,255,0.6) !important; box-shadow: 0 0 0 3px rgba(79,158,255,0.12) !important; }

  /* View toggle active tab */
  .wg-view-active {
    background: linear-gradient(135deg, rgba(79,158,255,0.22) 0%, rgba(167,139,250,0.15) 100%) !important;
    color: #e0eaff !important;
    border-color: rgba(79,158,255,0.4) !important;
    box-shadow: 0 0 16px rgba(79,158,255,0.1) !important;
  }
  .wg-shimmer {
    background: linear-gradient(90deg, rgba(255,255,255,.03) 25%, rgba(255,255,255,.08) 50%, rgba(255,255,255,.03) 75%);
    background-size: 800px 100%; animation: wg-shimmer 1.8s infinite;
  }

  /* ── Admin sidebar layout ── */
  .wg-admin-layout    { display:flex; min-height:100vh; }
  .wg-admin-sidebar   { width:240px; flex-shrink:0; position:sticky; top:0; height:100vh;
                        overflow-y:auto; display:flex; flex-direction:column;
                        border-right:1px solid rgba(79,158,255,0.12); z-index:50; }
  .wg-admin-main      { flex:1; min-width:0; }
  .wg-admin-topnav    { display:none; }
  .wg-sidebar-item    { display:flex; align-items:center; gap:10px; padding:9px 14px; margin:1px 8px;
                        border-radius:9px; cursor:pointer; font-size:13px; font-weight:500;
                        transition:all 0.15s ease; border:none; width:calc(100% - 16px);
                        text-align:left; background:none; font-family:inherit; }
  .wg-sidebar-item:hover { background: rgba(79,158,255,0.08) !important; }
  .wg-sidebar-item.active { background: rgba(131,71,255,0.14) !important; color:#8347ff !important; font-weight:700 !important; }

  @media (max-width: 900px) {
    .wg-admin-sidebar  { display:none !important; }
    .wg-admin-topnav   { display:flex !important; align-items:center; justify-content:space-between;
                         padding:0 20px; height:58px; position:sticky; top:0; z-index:100;
                         border-bottom:1px solid rgba(79,158,255,0.15);
                         backdrop-filter:blur(24px); -webkit-backdrop-filter:blur(24px); }
    .wg-admin-main     { padding-top:0; }
  }
  @media (min-width: 901px) {
    .wg-admin-topnav   { display:none !important; }
  }
`;

// ── Toast ──────────────────────────────────────────────────────────────────────
interface Toast { id:string; msg:string; type:"ok"|"err"|"info" }
function Toasts({ toasts }: { toasts:Toast[] }) {
  return (
    <div style={{ position:"fixed", bottom:24, right:24, zIndex:9999, display:"flex", flexDirection:"column", gap:8, pointerEvents:"none" }}>
      {toasts.map(t => (
        <div key={t.id} className="wg-toast" style={{
          background: t.type==="ok" ? T.green+"18" : t.type==="err" ? T.red+"18" : T.blue+"18",
          border: `1px solid ${t.type==="ok" ? T.green : t.type==="err" ? T.red : T.blue}45`,
          color: t.type==="ok" ? T.green : t.type==="err" ? T.red : T.blue,
          padding:"10px 16px", borderRadius:10, fontSize:13, fontWeight:500,
          boxShadow: T.shadowLg, maxWidth:320, lineHeight:1.4, pointerEvents:"auto",
        }}>
          {t.type==="ok"?"✓ ":t.type==="err"?"✗ ":"ℹ "}{t.msg}
        </div>
      ))}
    </div>
  );
}
function useToast() {
  const [toasts, setToasts] = useState<Toast[]>([]);
  const add = useCallback((msg:string, type:"ok"|"err"|"info"="ok") => {
    const id = Math.random().toString(36).slice(2);
    setToasts(t => [...t, {id, msg, type}]);
    setTimeout(() => setToasts(t => t.filter(x => x.id!==id)), 3600);
  }, []);
  return { toasts, add };
}

// ── Helpers ────────────────────────────────────────────────────────────────────
function AnimNum({ value, color }: { value:number; color:string }) {
  const [d, setD] = useState(0);
  const r = useRef<any>(null);
  useEffect(() => {
    if (r.current) clearInterval(r.current);
    let i=0; const steps=30;
    r.current = setInterval(() => {
      i++; setD(Math.round(value*(i/steps)));
      if (i>=steps) { clearInterval(r.current); setD(value); }
    }, 16);
    return () => clearInterval(r.current);
  }, [value]);
  return <span style={{color}}>{d.toLocaleString()}</span>;
}

function Pill({ color, children }: { color:string; children:React.ReactNode }) {
  return (
    <span style={{ display:"inline-flex", alignItems:"center", background:color+"18", color, border:`1px solid ${color}38`, borderRadius:6, padding:"2px 8px", fontSize:11, fontWeight:600, letterSpacing:"0.02em", whiteSpace:"nowrap" as const }}>
      {children}
    </span>
  );
}

function InfoRow({ label, value, mono=false }: { label:string; value?:string|null; mono?:boolean }) {
  if (!value) return null;
  return (
    <div style={{ marginBottom:12 }}>
      <div style={{ fontSize:10, color:T.textSec, textTransform:"uppercase", letterSpacing:"0.08em", fontWeight:700, marginBottom:4 }}>{label}</div>
      <div style={{ fontSize:13, color:T.text, fontFamily:mono?"'SF Mono','Fira Code',monospace":"inherit", wordBreak:"break-all" as const, lineHeight:1.5 }}>{value}</div>
    </div>
  );
}

// ── Action button ──────────────────────────────────────────────────────────────
function ActionBtn({ label, color, confirm, onConfirm, fill=false, toast }: {
  label:string; color:string; confirm:string; onConfirm:()=>Promise<any>; fill?:boolean;
  toast?:(msg:string,type:"ok"|"err"|"info")=>void;
}) {
  const [st, setSt] = useState<"idle"|"confirming"|"loading"|"ok"|"err">("idle");
  const [msg, setMsg] = useState("");

  if (st==="ok") return <div style={{ display:"flex", alignItems:"center", gap:6, fontSize:12, color:T.green, fontWeight:500 }}>✓ {msg||"Done"}</div>;
  if (st==="err") return <div style={{ fontSize:12, color:T.red }}>✗ {msg}</div>;

  if (st==="confirming") return (
    <div style={{ background:T.raised, border:`1px solid ${T.border}`, borderRadius:10, padding:"12px 16px", animation:"wg-up 0.15s ease" }}>
      <div style={{ color:T.textSec, fontSize:12, marginBottom:12, lineHeight:1.6 }}>{confirm}</div>
      <div style={{ display:"flex", gap:8 }}>
        <button
          style={{ background:fill?color:"transparent", color:fill?"#fff":color, border:`1px solid ${color}`, borderRadius:7, padding:"7px 16px", fontSize:12, fontWeight:600, cursor:"pointer" }}
          onClick={async () => {
            setSt("loading");
            try {
              const r = await onConfirm();
              const m = r?.message||"Done";
              setMsg(m); setSt("ok"); toast?.(m,"ok");
            } catch(e) { const m=e instanceof Error?e.message:"Failed"; setMsg(m); setSt("err"); toast?.(m,"err"); }
          }}
        >Confirm</button>
        <button style={{ background:"transparent", color:T.textMuted, border:`1px solid ${T.border}`, borderRadius:7, padding:"7px 16px", fontSize:12, cursor:"pointer" }} onClick={()=>setSt("idle")}>Cancel</button>
      </div>
    </div>
  );

  return (
    <button
      style={{ background:fill?color:"transparent", color:fill?"#fff":color, border:`1px solid ${fill?"transparent":color+"55"}`, borderRadius:8, padding:"7px 16px", fontSize:12, fontWeight:500, cursor:"pointer", opacity:st==="loading"?0.5:1 }}
      onClick={()=>setSt("confirming")}
    >{st==="loading"?"Working…":label}</button>
  );
}

// ── Info Button ────────────────────────────────────────────────────────────────
function InfoBtn({ text }: { text: string }) {
  const [open, setOpen] = useState(false);
  return (
    <span style={{ position:"relative", display:"inline-block" }}>
      <button
        onClick={e=>{e.stopPropagation();setOpen(o=>!o);}}
        style={{ background:"none", border:`1px solid ${T.border}`, borderRadius:"50%", width:16, height:16, fontSize:9, fontWeight:700, color:T.textMuted, cursor:"pointer", lineHeight:"14px", padding:0, flexShrink:0, verticalAlign:"middle" }}
        title="Info"
      >ℹ</button>
      {open&&(
        <div onClick={e=>e.stopPropagation()} style={{ position:"absolute", zIndex:9999, left:"50%", top:22, transform:"translateX(-50%)", minWidth:220, maxWidth:300, background:T.raised, border:`1px solid ${T.border}`, borderRadius:10, padding:"12px 14px", boxShadow:T.shadowLg, fontSize:12, color:T.textSec, lineHeight:1.6, animation:"wg-up 0.15s ease" }}>
          <button onClick={()=>setOpen(false)} style={{ position:"absolute", top:6, right:8, background:"none", border:"none", color:T.textMuted, cursor:"pointer", fontSize:14 }}>×</button>
          {text}
        </div>
      )}
    </span>
  );
}

// ── Preview frame ──────────────────────────────────────────────────────────────
function PreviewFrame({ previewUrl, builtAt, jobId }: { previewUrl:string; builtAt?:string; jobId?:string }) {
  const [key, setKey] = useState(()=>Date.now());
  const prevRef = useRef({ builtAt, previewUrl });
  useEffect(()=>{
    if(builtAt!==prevRef.current.builtAt || previewUrl!==prevRef.current.previewUrl){
      prevRef.current={builtAt,previewUrl};
      setKey(Date.now());
    }
  },[builtAt, previewUrl]);
  const doRefresh = ()=>setKey(Date.now());
  // Scale 1280px iframe to fit ~710px panel content width
  const SCALE=0.55, IW=1280, IH=800;
  const containerH=Math.round(IH*SCALE);
  // Always serve from proxy (Supabase) to guarantee fresh HTML — Vercel CDN caches stable alias
  const proxySrc = jobId ? `/api/preview/proxy?jobId=${encodeURIComponent(jobId)}&_wg=${key}` : `${previewUrl}${previewUrl.includes("?")?"&":"?"}_wg=${key}`;
  const src = proxySrc;
  return (
    <div style={{borderRadius:12,overflow:"hidden",border:`1px solid ${T.border}`}}>
      <div style={{display:"flex",alignItems:"center",gap:8,padding:"8px 12px",background:T.surface,borderBottom:`1px solid ${T.border}`}}>
        <div style={{display:"flex",gap:5}}>
          {["#ff5f57","#febc2e","#28c840"].map((c,i)=><div key={i} style={{width:10,height:10,borderRadius:"50%",background:c}}/>)}
        </div>
        <div style={{flex:1,background:T.raised,borderRadius:6,padding:"3px 10px",fontSize:11,color:T.textMuted,fontFamily:"monospace",overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap" as const}}>{previewUrl}</div>
        <button onClick={doRefresh} style={{background:"none",border:`1px solid ${T.border}`,borderRadius:6,padding:"3px 8px",fontSize:12,cursor:"pointer",color:T.textMuted}}>↺</button>
        <a href={previewUrl} target="_blank" rel="noreferrer" style={{background:T.green+"20",color:T.green,border:`1px solid ${T.green}35`,borderRadius:6,padding:"3px 10px",fontSize:11,fontWeight:700,textDecoration:"none"}}>Open →</a>
      </div>
      <div style={{position:"relative",height:containerH,overflow:"hidden",background:T.raised}}>
        <iframe
          key={key}
          src={src}
          style={{width:IW,height:IH,border:"none",transform:`scale(${SCALE})`,transformOrigin:"top left",pointerEvents:"auto"}}
          sandbox="allow-scripts allow-forms allow-popups allow-popups-to-escape-sandbox allow-same-origin"
          title="Site preview"
        />
      </div>
    </div>
  );
}

// ── Deploy HTML as live preview ────────────────────────────────────────────────
function DeployHtmlLive({ jobId, onDeployed, toast }: { jobId:string; onDeployed:(url:string)=>void; toast:(msg:string,t:"ok"|"err"|"info")=>void }) {
  const [deploying, setDeploying] = useState(false);
  const [err, setErr] = useState("");
  const [done, setDone] = useState("");
  const fileRef = useRef<HTMLInputElement>(null);

  async function handleDeploy(e: React.FormEvent) {
    e.preventDefault(); setErr(""); setDone("");
    const file = fileRef.current?.files?.[0];
    if (!file) { setErr("Select an HTML file first"); return; }
    setDeploying(true);
    try {
      const fd = new FormData(); fd.append("file", file); fd.append("jobId", jobId);
      const r = await fetch("/api/admin/deploy-html", { method:"POST", body:fd });
      const d = await r.json();
      if (!r.ok) { setErr(d.error || "Deploy failed"); return; }
      setDone(d.previewUrl);
      onDeployed(d.previewUrl);
      toast("Deployed as live preview", "ok");
      if (fileRef.current) fileRef.current.value = "";
    } catch(e) { setErr(String(e)); }
    finally { setDeploying(false); }
  }

  const inp:React.CSSProperties = {background:T.raised,border:`1px solid ${T.border}`,borderRadius:8,padding:"8px 12px",color:T.text,fontSize:13,outline:"none",fontFamily:"inherit"};
  return (
    <div style={{ background:`${T.green}0a`, border:`1px solid ${T.green}30`, borderRadius:12, padding:"18px 20px" }}>
      <div style={{ fontSize:11, fontWeight:700, color:T.green, marginBottom:4, textTransform:"uppercase" as const, letterSpacing:"0.07em" }}>Deploy HTML as Live Preview</div>
      <div style={{ fontSize:11, color:T.textMuted, marginBottom:14, lineHeight:1.6 }}>Upload a hand-edited HTML file to instantly replace what's shown at the client's preview URL. Bypasses the build pipeline entirely.</div>
      <form onSubmit={handleDeploy} style={{ display:"flex", gap:8, flexWrap:"wrap" as const, alignItems:"center" }}>
        <input ref={fileRef} type="file" accept=".html,.htm" style={{fontSize:12,color:T.textSec,flex:1}}/>
        <button type="submit" disabled={deploying} style={{background:`linear-gradient(135deg,${T.green},#00b365)`,color:"#000",border:"none",borderRadius:8,padding:"8px 18px",fontSize:12,fontWeight:700,cursor:"pointer",opacity:deploying?.6:1,boxShadow:`0 4px 14px ${T.green}30`}}>
          {deploying?"Deploying…":"Deploy Live →"}
        </button>
      </form>
      {err && <div style={{fontSize:12,color:T.red,marginTop:8}}>{err}</div>}
      {done && <div style={{fontSize:11,color:T.green,marginTop:8}}>✓ Live at <a href={done} target="_blank" rel="noreferrer" style={{color:T.green}}>{done}</a></div>}
    </div>
  );
}

// ── Client HTML upload ─────────────────────────────────────────────────────────


// ── Cash Payment Panel ─────────────────────────────────────────────────────────
function CashPaymentPanel({ jobId, paymentState, toast }: {
  jobId: string;
  paymentState: { depositPaid: boolean; finalPaid: boolean; monthlyActive: boolean } | null;
  toast: (msg: string, t: "ok"|"err"|"info") => void;
}) {
  const [cashNote, setCashNote] = useState("");
  const [saving, setSaving] = useState(false);

  async function markPaid(field: "deposit"|"final"|"monthly", value = true) {
    setSaving(true);
    try {
      const body: any = { jobId, note: cashNote || (value ? "Cash payment — recorded by admin" : "Reversed by admin") };
      if (field === "deposit")  body.depositPaid   = value;
      if (field === "final")    body.finalPaid      = value;
      if (field === "monthly")  body.monthlyActive  = value;
      const r = await fetch("/api/admin/mark-payment", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
      const d = await r.json();
      if (!r.ok) throw new Error(d.error || "Failed");
      toast(value ? `${field} marked as paid` : `${field} reversed`, "ok");
    } catch(e) { toast((e as Error).message, "err"); }
    setSaving(false);
  }

  const ps = paymentState;
  return (
    <div style={{display:"flex",flexDirection:"column" as const,gap:10}}>
      <div>
        <div style={{fontSize:11,color:T.textMuted,marginBottom:5}}>Payment note (optional)</div>
        <input
          value={cashNote} onChange={e=>setCashNote(e.target.value)}
          placeholder="e.g. Cash received in person 28/05/26, receipt #042"
          style={{width:"100%",boxSizing:"border-box" as const,background:T.bg,border:`1px solid ${T.border}`,borderRadius:7,padding:"8px 12px",color:T.text,fontSize:12,outline:"none",fontFamily:"inherit"}}
        />
      </div>
      <div style={{display:"grid",gridTemplateColumns:"1fr 1fr 1fr",gap:8}}>
        {!ps?.depositPaid && (
          <button disabled={saving} onClick={()=>markPaid("deposit")}
            style={{background:T.green,color:"#000",border:"none",borderRadius:8,padding:"9px 6px",fontSize:12,fontWeight:700,cursor:"pointer",opacity:saving?.6:1}}>
            ✓ Deposit paid
          </button>
        )}
        {!ps?.finalPaid && (
          <button disabled={saving} onClick={()=>markPaid("final")}
            style={{background:T.amber,color:"#000",border:"none",borderRadius:8,padding:"9px 6px",fontSize:12,fontWeight:700,cursor:"pointer",opacity:saving?.6:1}}>
            ✓ Final paid
          </button>
        )}
        {!ps?.monthlyActive && (
          <button disabled={saving} onClick={()=>markPaid("monthly")}
            style={{background:T.blue,color:"#fff",border:"none",borderRadius:8,padding:"9px 6px",fontSize:12,fontWeight:700,cursor:"pointer",opacity:saving?.6:1}}>
            ✓ Monthly active
          </button>
        )}
        {ps?.depositPaid && ps?.finalPaid && ps?.monthlyActive && (
          <div style={{gridColumn:"1/-1",fontSize:12,color:T.green,fontWeight:600}}>✓ All payments received</div>
        )}
      </div>
      {(ps?.depositPaid || ps?.finalPaid || ps?.monthlyActive) && (
        <div style={{borderTop:`1px solid ${T.border}`,paddingTop:10,marginTop:2}}>
          <div style={{fontSize:10,color:T.textMuted,marginBottom:6}}>Reverse a payment</div>
          <div style={{display:"flex",gap:6,flexWrap:"wrap" as const}}>
            {ps?.depositPaid  && <button disabled={saving} onClick={()=>markPaid("deposit",false)}  style={{background:"none",border:`1px solid ${T.red}40`,color:T.red,borderRadius:6,padding:"4px 10px",fontSize:11,cursor:"pointer"}}>Reverse deposit</button>}
            {ps?.finalPaid    && <button disabled={saving} onClick={()=>markPaid("final",false)}    style={{background:"none",border:`1px solid ${T.red}40`,color:T.red,borderRadius:6,padding:"4px 10px",fontSize:11,cursor:"pointer"}}>Reverse final</button>}
            {ps?.monthlyActive && <button disabled={saving} onClick={()=>markPaid("monthly",false)} style={{background:"none",border:`1px solid ${T.red}40`,color:T.red,borderRadius:6,padding:"4px 10px",fontSize:11,cursor:"pointer"}}>Deactivate monthly</button>}
          </div>
        </div>
      )}
    </div>
  );
}

// ── Custom Quote card (used inside ClientPanel → Actions tab) ──────────────────
function ClientCustomQuote({ jobId, slug, secret, existingQuote, toast }: {
  jobId: string;
  slug: string;
  secret: string;
  existingQuote?: { deposit: number; final: number; monthly: number; total: number };
  toast: (msg: string, t: "ok" | "err" | "info") => void;
}) {
  const [open, setOpen] = useState(false);
  const [deposit, setDeposit] = useState(existingQuote ? String(existingQuote.deposit) : "");
  const [final, setFinal] = useState(existingQuote ? String(existingQuote.final) : "");
  const [monthly, setMonthly] = useState(existingQuote ? String(existingQuote.monthly) : "");
  const [saving, setSaving] = useState(false);
  const [clearing, setClearing] = useState(false);

  const total = (parseFloat(deposit) || 0) + (parseFloat(final) || 0);

  async function save() {
    if (!deposit || !final || !monthly) { toast("Fill in all three amounts", "err"); return; }
    setSaving(true);
    try {
      const r = await fetch("/api/admin/clients", {
        method: "PATCH",
        headers: { "Content-Type": "application/json", "x-process-secret": secret },
        body: JSON.stringify({
          jobId,
          metadata: {
            customQuote: {
              deposit: parseFloat(deposit),
              final: parseFloat(final),
              monthly: parseFloat(monthly),
              total: parseFloat(deposit) + parseFloat(final),
              sentAt: new Date().toISOString(),
            },
          },
        }),
      });
      if (!r.ok) throw new Error(await r.text());
      toast("Custom quote saved — client portal will now show these amounts.", "ok");
      setOpen(false);
    } catch (e) {
      toast("Failed: " + String(e), "err");
    }
    setSaving(false);
  }

  async function clearQuote() {
    if (!confirm("Remove custom quote? Client will revert to auto-calculated price.")) return;
    setClearing(true);
    try {
      const r = await fetch("/api/admin/clients", {
        method: "PATCH",
        headers: { "Content-Type": "application/json", "x-process-secret": secret },
        body: JSON.stringify({ jobId, metadata: { customQuote: null } }),
      });
      if (!r.ok) throw new Error(await r.text());
      toast("Custom quote removed — prices are auto-calculated again.", "ok");
      setDeposit(""); setFinal(""); setMonthly("");
    } catch (e) {
      toast("Failed: " + String(e), "err");
    }
    setClearing(false);
  }

  const inp: React.CSSProperties = { background: T.raised, border: `1px solid ${T.border}`, borderRadius: 7, padding: "7px 10px", color: T.text, fontSize: 13, outline: "none", width: "100%", boxSizing: "border-box" as const };

  return (
    <div style={{ background: T.raised, border: `1px solid ${existingQuote ? T.amber+"60" : T.border}`, borderRadius: 12, padding: "16px 18px" }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: open ? 14 : 0 }}>
        <div>
          <div style={{ fontSize: 12, fontWeight: 700, color: T.amber, marginBottom: 2 }}>
            💰 Custom Quote{existingQuote ? " (active)" : ""}
          </div>
          {!open && (
            <div style={{ fontSize: 11, color: T.textMuted }}>
              {existingQuote
                ? `Deposit $${existingQuote.deposit} · Final $${existingQuote.final} · Monthly $${existingQuote.monthly}/mo`
                : "Override the auto-calculated price shown in client portal."}
            </div>
          )}
        </div>
        <div style={{ display: "flex", gap: 6 }}>
          {existingQuote && !open && (
            <button
              onClick={clearQuote}
              disabled={clearing}
              style={{ background: "none", border: `1px solid ${T.red}40`, color: T.red, borderRadius: 7, padding: "5px 10px", fontSize: 11, cursor: "pointer", opacity: clearing ? 0.5 : 1 }}
            >
              {clearing ? "…" : "Remove"}
            </button>
          )}
          <button
            onClick={() => setOpen(o => !o)}
            style={{ background: open ? T.surface : T.amber, color: open ? T.textMuted : "#000", border: `1px solid ${open ? T.border : "transparent"}`, borderRadius: 7, padding: "5px 14px", fontSize: 11, fontWeight: 700, cursor: "pointer" }}
          >
            {open ? "Cancel" : existingQuote ? "Edit →" : "Set quote →"}
          </button>
        </div>
      </div>

      {open && (
        <div style={{ display: "flex", flexDirection: "column" as const, gap: 10 }}>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 10 }}>
            <div>
              <div style={{ fontSize: 10, color: T.textMuted, marginBottom: 4, textTransform: "uppercase" as const, letterSpacing: "0.07em" }}>Deposit ($)</div>
              <input type="number" min="0" step="10" value={deposit} onChange={e => setDeposit(e.target.value)} placeholder="e.g. 750" style={inp} />
            </div>
            <div>
              <div style={{ fontSize: 10, color: T.textMuted, marginBottom: 4, textTransform: "uppercase" as const, letterSpacing: "0.07em" }}>Final payment ($)</div>
              <input type="number" min="0" step="10" value={final} onChange={e => setFinal(e.target.value)} placeholder="e.g. 750" style={inp} />
            </div>
            <div>
              <div style={{ fontSize: 10, color: T.textMuted, marginBottom: 4, textTransform: "uppercase" as const, letterSpacing: "0.07em" }}>Monthly ($)</div>
              <input type="number" min="0" step="5" value={monthly} onChange={e => setMonthly(e.target.value)} placeholder="e.g. 109" style={inp} />
            </div>
          </div>
          {total > 0 && (
            <div style={{ fontSize: 11, color: T.textMuted }}>
              Total: <strong style={{ color: T.text }}>${total.toFixed(0)}</strong> · Client will see Deposit ${deposit || "0"} + Final ${final || "0"}, then ${monthly || "0"}/mo
            </div>
          )}
          <button
            onClick={save}
            disabled={saving || !deposit || !final || !monthly}
            style={{ background: (!saving && deposit && final && monthly) ? T.amber : T.raised, color: (!saving && deposit && final && monthly) ? "#000" : T.textMuted, border: "none", borderRadius: 8, padding: "10px", fontSize: 13, fontWeight: 700, cursor: (!saving && deposit && final && monthly) ? "pointer" : "not-allowed", transition: "all 0.2s ease" }}
          >
            {saving ? "Saving…" : "Save custom quote →"}
          </button>
        </div>
      )}
    </div>
  );
}


// ── Client Content Brief — paste raw client content to feed the AI ──────────
function ClientContentBrief({ jobId, existing, toast }: {
  jobId: string;
  existing: { additionalNotes?: string; usp?: string; goal?: string; businessDescription?: string };
  toast: (msg: string, t: "ok"|"err"|"info") => void;
}) {
  const [open, setOpen] = useState(false);
  const [notes, setNotes]   = useState(existing?.additionalNotes || "");
  const [usp, setUsp]       = useState(existing?.usp || "");
  const [goal, setGoal]     = useState(existing?.goal || "");
  const [desc, setDesc]     = useState(existing?.businessDescription || "");
  const [saving, setSaving] = useState(false);

  async function save() {
    setSaving(true);
    try {
      const res = await fetch("/api/admin/clients", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          jobId,
          userInput: {
            additionalNotes: notes,
            usp,
            goal,
            businessDescription: desc,
          },
        }),
      });
      if (!res.ok) throw new Error("Save failed");
      toast("Content brief saved — rebuild the site to apply", "ok");
    } catch {
      toast("Failed to save content brief", "err");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div style={{ background: T.raised, border: `1px solid ${T.border}`, borderRadius: 12, overflow: "hidden" }}>
      <div
        onClick={() => setOpen(o => !o)}
        style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "14px 18px", cursor: "pointer" }}
      >
        <div>
          <div style={{ fontSize: 12, fontWeight: 700, color: T.cyan }}>📋 Client Content Brief</div>
          <div style={{ fontSize: 11, color: T.textMuted, marginTop: 2 }}>Paste client-supplied text — descriptions, USP, goals — to feed the AI rebuild</div>
        </div>
        <div style={{ fontSize: 16, color: T.textMuted }}>{open ? "▲" : "▼"}</div>
      </div>
      {open && (
        <div style={{ padding: "0 18px 18px", display: "flex", flexDirection: "column" as const, gap: 14 }}>

          <div>
            <div style={{ fontSize: 11, fontWeight: 600, color: T.textSec, marginBottom: 6 }}>Business description / About us</div>
            <textarea
              rows={5}
              value={desc}
              onChange={e => setDesc(e.target.value)}
              placeholder={"Paste the client's business description, about us text, or anything they sent about what they do…"}
              style={{ width: "100%", background: T.bg, border: `1px solid ${T.border}`, borderRadius: 8, padding: "10px 12px", fontSize: 13, color: T.text, resize: "vertical" as const, fontFamily: "inherit", lineHeight: 1.6, boxSizing: "border-box" as const }}
            />
          </div>

          <div>
            <div style={{ fontSize: 11, fontWeight: 600, color: T.textSec, marginBottom: 6 }}>Unique selling point / Why choose them</div>
            <textarea
              rows={3}
              value={usp}
              onChange={e => setUsp(e.target.value)}
              placeholder={"What makes them different? E.g. 'Family-owned, 20 years experience, free quotes, same-day service'"}
              style={{ width: "100%", background: T.bg, border: `1px solid ${T.border}`, borderRadius: 8, padding: "10px 12px", fontSize: 13, color: T.text, resize: "vertical" as const, fontFamily: "inherit", lineHeight: 1.6, boxSizing: "border-box" as const }}
            />
          </div>

          <div>
            <div style={{ fontSize: 11, fontWeight: 600, color: T.textSec, marginBottom: 6 }}>Goal / Call-to-action</div>
            <textarea
              rows={2}
              value={goal}
              onChange={e => setGoal(e.target.value)}
              placeholder={"What's the main goal of the site? E.g. 'Get people to call for a free quote' or 'Drive bookings via the online form'"}
              style={{ width: "100%", background: T.bg, border: `1px solid ${T.border}`, borderRadius: 8, padding: "10px 12px", fontSize: 13, color: T.text, resize: "vertical" as const, fontFamily: "inherit", lineHeight: 1.6, boxSizing: "border-box" as const }}
            />
          </div>

          <div>
            <div style={{ fontSize: 11, fontWeight: 600, color: T.textSec, marginBottom: 6 }}>Additional notes / Raw client content</div>
            <div style={{ fontSize: 11, color: T.textMuted, marginBottom: 6, lineHeight: 1.5 }}>
              Dump anything else here — service descriptions, team bios, testimonials, page copy, tone preferences. The AI will use all of it.
            </div>
            <textarea
              rows={10}
              value={notes}
              onChange={e => setNotes(e.target.value)}
              placeholder={"Paste anything the client gave you — service list, team descriptions, testimonials, FAQ answers, raw notes…"}
              style={{ width: "100%", background: T.bg, border: `1px solid ${T.border}`, borderRadius: 8, padding: "10px 12px", fontSize: 13, color: T.text, resize: "vertical" as const, fontFamily: "inherit", lineHeight: 1.6, boxSizing: "border-box" as const }}
            />
          </div>

          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <button
              onClick={save}
              disabled={saving}
              style={{ padding: "9px 20px", background: T.cyan, color: "#fff", border: "none", borderRadius: 8, fontSize: 13, fontWeight: 600, cursor: saving ? "not-allowed" : "pointer", opacity: saving ? 0.6 : 1 }}
            >
              {saving ? "Saving…" : "Save content brief"}
            </button>
            <div style={{ fontSize: 11, color: T.textMuted }}>After saving, use Actions → Rebuild to apply to the site</div>
          </div>
        </div>
      )}
    </div>
  );
}

function ClientHtmlUpload({ jobId, toast }: { jobId:string; toast:(msg:string,t:"ok"|"err"|"info")=>void }) {
  const [files, setFiles] = useState<{name:string;label:string;size:number;createdAt:string}[]>([]);
  const [uploading, setUploading] = useState(false);
  const [label, setLabel] = useState("");
  const [err, setErr] = useState("");
  const fileRef = useRef<HTMLInputElement>(null);
  useEffect(()=>{ load(); },[jobId]);
  async function load() {
    try { const r=await fetch(`/api/admin/example-htmls?jobId=${jobId}`); if(r.ok){const d=await r.json();setFiles(d.files||[]);} } catch {}
  }
  async function handleUpload(e:React.FormEvent) {
    e.preventDefault(); setErr("");
    const file=fileRef.current?.files?.[0];
    if(!file){setErr("Select a .html file first");return;}
    setUploading(true);
    try {
      const fd=new FormData(); fd.append("file",file); fd.append("jobId",jobId); fd.append("label",label||file.name.replace(/\.html?$/i,""));
      const r=await fetch("/api/admin/example-htmls",{method:"POST",body:fd});
      const d=await r.json();
      if(!r.ok){setErr(d.error||"Upload failed");return;}
      if(fileRef.current)fileRef.current.value="";
      setLabel(""); await load(); toast("File uploaded","ok");
    } catch(e){setErr(String(e));}
    finally{setUploading(false);}
  }
  async function handleDelete(name:string) {
    if(!confirm(`Delete ${name}?`))return;
    await fetch("/api/admin/example-htmls",{method:"DELETE",headers:{"Content-Type":"application/json"},body:JSON.stringify({name})});
    await load(); toast("Deleted","ok");
  }
  const inp:React.CSSProperties={background:T.raised,border:`1px solid ${T.border}`,borderRadius:8,padding:"8px 12px",color:T.text,fontSize:13,outline:"none",fontFamily:"inherit",width:"100%",boxSizing:"border-box"};
  return (
    <div style={{ background:T.raised, border:`1px solid ${T.border}`, borderRadius:12, padding:"18px 20px" }}>
      <div style={{ fontSize:11, fontWeight:700, color:T.blue, marginBottom:4, textTransform:"uppercase" as const, letterSpacing:"0.07em" }}>Reference HTML Files</div>
      <div style={{ fontSize:11, color:T.textMuted, marginBottom:14, lineHeight:1.6 }}>Upload HTML files for Claude to reference when building this site.</div>
      <form onSubmit={handleUpload} style={{ display:"flex", gap:8, flexWrap:"wrap" as const, marginBottom:14 }}>
        <input style={{...inp,flex:1,minWidth:140}} placeholder="Label (optional)" value={label} onChange={e=>setLabel(e.target.value)}/>
        <input ref={fileRef} type="file" accept=".html,.htm" style={{fontSize:12,color:T.textSec}}/>
        <button type="submit" disabled={uploading} style={{background:T.blue,color:"#fff",border:"none",borderRadius:8,padding:"8px 16px",fontSize:12,fontWeight:600,cursor:"pointer",opacity:uploading?.6:1}}>
          {uploading?"Uploading…":"Upload"}
        </button>
      </form>
      {err&&<div style={{fontSize:12,color:T.red,marginBottom:10}}>{err}</div>}
      {files.map(f=>(
        <div key={f.name} style={{display:"flex",alignItems:"center",justifyContent:"space-between",background:T.surface,borderRadius:8,padding:"8px 12px",border:`1px solid ${T.border}`,marginBottom:6}}>
          <div><span style={{fontSize:13,color:T.text,fontWeight:500}}>{f.label}</span><span style={{fontSize:11,color:T.textMuted,marginLeft:8}}>{Math.round(f.size/1024)}KB</span></div>
          <button onClick={()=>handleDelete(f.name)} style={{background:"none",border:`1px solid ${T.red}40`,color:T.red,borderRadius:6,padding:"3px 10px",fontSize:11,cursor:"pointer"}}>Delete</button>
        </div>
      ))}
      {files.length===0&&<div style={{fontSize:12,color:T.textMuted}}>No reference files yet.</div>}
    </div>
  );
}

// ── Stitch Prompt copy card ────────────────────────────────────────────────────
function StitchPromptCard({ prompt, toast }: { prompt: string; toast: (msg: string, t: "ok"|"err"|"info") => void }) {
  const [copied, setCopied] = useState(false);
  return (
    <div style={{background:"rgba(0,212,160,0.06)",border:"1px solid rgba(0,212,160,0.25)",borderRadius:12,padding:"16px 18px"}}>
      <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:10}}>
        <div style={{fontSize:13,fontWeight:700,color:"#00d4a0"}}>📋 Stitch Prompt</div>
        <div style={{display:"flex",gap:8}}>
          <button
            onClick={()=>{ navigator.clipboard.writeText(prompt); setCopied(true); toast("Prompt copied!","ok"); setTimeout(()=>setCopied(false),2000); }}
            style={{padding:"5px 14px",borderRadius:6,fontSize:12,fontWeight:700,background:copied?"#00d4a0":"rgba(0,212,160,0.15)",color:copied?"#0a0f1a":"#00d4a0",border:"1px solid rgba(0,212,160,0.35)",cursor:"pointer"}}>
            {copied ? "✓ Copied!" : "Copy prompt"}
          </button>
          <a href="https://labs.google/stitch" target="_blank" rel="noopener noreferrer"
            style={{padding:"5px 14px",borderRadius:6,fontSize:12,fontWeight:700,background:"rgba(74,158,255,0.15)",color:"#4a9eff",border:"1px solid rgba(74,158,255,0.35)",textDecoration:"none"}}>
            Open Stitch ↗
          </a>
        </div>
      </div>
      <div style={{background:"rgba(0,0,0,0.3)",borderRadius:8,padding:"10px 12px",fontFamily:"monospace",fontSize:11.5,lineHeight:1.65,color:"#b8c8e0",whiteSpace:"pre-wrap",wordBreak:"break-word",maxHeight:180,overflowY:"auto"}}>
        {prompt}
      </div>
      <div style={{fontSize:11,color:"rgba(255,255,255,0.3)",marginTop:8}}>Copy → paste into Stitch Studio → Generate → Export HTML → upload via Pending Stitch Builds ↗</div>
    </div>
  );
}

// ── Client slide-over panel ────────────────────────────────────────────────────
function ClientPanel({ c, secret, onClose, toast }: { c:ClientAnalytics; secret:string; onClose:()=>void; toast:(msg:string,t:"ok"|"err"|"info")=>void }) {
  const [tab, setTab] = useState<"perf"|"engagement"|"seo"|"site"|"assets"|"integrations"|"content"|"payments"|"actions"|"requests"|"checklist"|"social">("perf");
  const [checklistDone, setChecklistDone] = useState<Record<string,boolean>>({});
  const [checklistLinks, setChecklistLinks] = useState<Record<string,string>>({});
  useEffect(()=>{
    try {
      const s=localStorage.getItem("wg_checklist_"+jid); if(s)setChecklistDone(JSON.parse(s));
      const l=localStorage.getItem("wg_checklist_links_"+jid); if(l)setChecklistLinks(JSON.parse(l));
    } catch {}
    // Also load from Supabase (source of truth)
    fetch(`/api/admin/checklist-links?jobId=${jid}`,{headers:{"x-process-secret":secret}})
      .then(r=>r.ok?r.json():null)
      .then(d=>{ if(d?.links&&Object.keys(d.links).length>0){ setChecklistLinks(d.links); try{localStorage.setItem("wg_checklist_links_"+jid,JSON.stringify(d.links));}catch{} } })
      .catch(()=>{});
  // eslint-disable-next-line react-hooks/exhaustive-deps
  },[]);
  function toggleCheck(key:string){
    setChecklistDone(prev=>{
      const next={...prev,[key]:!prev[key]};
      try{localStorage.setItem("wg_checklist_"+jid,JSON.stringify(next));}catch{}
      return next;
    });
  }
  function saveLink(key:string, val:string){
    setChecklistLinks(prev=>{
      const next={...prev,[key]:val};
      try{localStorage.setItem("wg_checklist_links_"+jid,JSON.stringify(next));}catch{}
      // Persist to Supabase so links survive across devices/sessions
      fetch("/api/admin/checklist-links",{
        method:"POST",
        headers:{"Content-Type":"application/json","x-process-secret":secret},
        body:JSON.stringify({jobId:jid,links:next}),
      }).catch(()=>{});
      return next;
    });
  }
  // ── Content management state ──────────────────────────────────────────────────
  const [contentItems, setContentItems] = useState<any[]>([]);
  const [contentLoading, setContentLoading] = useState(false);
  const [contentSaving, setContentSaving] = useState(false);
  const [contentMsg, setContentMsg] = useState("");
  const [contentSubTab, setContentSubTab] = useState<"blog"|"newsletter"|"deal"|"product"|"review">("blog");
  const [contentForm, setContentForm] = useState<any>(null);
  const [genPrompt, setGenPrompt] = useState("");
  const [genLoading, setGenLoading] = useState(false);
  // ─────────────────────────────────────────────────────────────────────────────
  const [assetUploading, setAssetUploading] = useState(false);
  const [assetMsg, setAssetMsg] = useState("");
  const [intSaving, setIntSaving] = useState(false);
  const [intMsg, setIntMsg] = useState("");
  const [squareToken, setSquareToken] = useState(c.squareAccessToken||"");
  const [squareLocation, setSquareLocation] = useState(c.squareLocationId||"");
  const [stripeSyncing, setStripeSyncing] = useState(false);
  const [stripeMsg, setStripeMsg] = useState("");
  const [ga4Id, setGa4Id] = useState(c.ga4Id||"");
  const [customDomain, setCustomDomain] = useState(c.domain||"");
  const [featureRequests, setFeatureRequests] = useState<any[]>([]);
  const [frLoading, setFrLoading] = useState(false);
  const [frUpdating, setFrUpdating] = useState<string|null>(null);
  const [feeInputs, setFeeInputs] = useState<Record<string,string>>({});
  const [deployedAt, setDeployedAt] = useState<string|null>(null);
  // ── Archive tab state ─────────────────────────────────────────────────────────
  const [archiveVersions, setArchiveVersions] = useState<any[]>([]);
  const [archiveLoading, setArchiveLoading] = useState(false);
  const [archiveMsg, setArchiveMsg] = useState("");
  const [archiveSnapshotting, setArchiveSnapshotting] = useState(false);
  const [archiveSelected, setArchiveSelected] = useState<any|null>(null);
  const [archivePreviewHtml, setArchivePreviewHtml] = useState<string|null>(null);
  const [archivePreviewLoading, setArchivePreviewLoading] = useState(false);
  const [archiveSubTab, setArchiveSubTab] = useState<"config"|"logs"|"preview">("preview");
  // ─────────────────────────────────────────────────────────────────────────────
  // ── Social offboarding state ──────────────────────────────────────────────────
  const [offboardType, setOffboardType] = useState<"full"|"remove">("full");
  const [offboardGmail, setOffboardGmail] = useState<string>((c as any).metadata?.socialGmail || "");
  const [offboardPassword, setOffboardPassword] = useState("");
  const [offboardNote, setOffboardNote] = useState("");
  const [offboardSending, setOffboardSending] = useState(false);
  const [offboardDone, setOffboardDone] = useState(false);
  const [offboardErr, setOffboardErr] = useState("");
  const [offboardConfirmed, setOffboardConfirmed] = useState(false);
  // ─────────────────────────────────────────────────────────────────────────────
  const a = c.analytics;
  const seo = c.metadata?.seo;
  const ui = c.userInput||{};
  const features = ui.features||[];
  const jid = c.jobId;
  const sec = encodeURIComponent(secret);

  useEffect(() => {
    function onKey(e:KeyboardEvent) { if(e.key==="Escape")onClose(); }
    window.addEventListener("keydown",onKey);
    return ()=>window.removeEventListener("keydown",onKey);
  },[onClose]);

  const statusColor = c.buildStatus==="completed"||c.buildStatus==="complete" ? T.green : c.buildStatus==="building" ? T.amber : T.red;
  const initials = c.businessName.split(" ").map(w=>w[0]).slice(0,2).join("").toUpperCase();

  async function api(path:string, method="GET", body?:any) {
    const r=await fetch(path,{method,headers:body?{"Content-Type":"application/json"}:{},body:body?JSON.stringify(body):undefined});
    const d=await r.json().catch(()=>({}));
    if(!r.ok)throw new Error((d as any).error||`HTTP ${r.status}`);
    return d;
  }

  async function loadFeatureRequests() {
    setFrLoading(true);
    try { const r=await fetch(`/api/feature-requests?secret=${sec}`); if(r.ok){const d=await r.json();setFeatureRequests((d.requests||[]).filter((x:any)=>x.jobId===jid));} }
    catch {} finally{setFrLoading(false);}
  }

  async function updateRequestStatus(requestId:string, status:string, draftUrl?:string, quotedFee?:number) {
    setFrUpdating(requestId);
    try { await api("/api/feature-requests","PATCH",{jobId:jid,requestId,status,draftUrl,...(quotedFee!==undefined?{quotedFee:{}}:{})}); await loadFeatureRequests(); }
    catch(e){toast(e instanceof Error?e.message:"Failed","err");}
    finally{setFrUpdating(null);}
  }

  const pending = featureRequests.filter(r=>r.status==="pending"||r.status==="draft").length;
  const tabs = ["perf","engagement","seo","site","assets","integrations","content","payments","actions","requests","checklist","social"] as const;

  // ── Content helpers ────────────────────────────────────────────────────────
  async function loadContent() {
    setContentLoading(true); setContentMsg("");
    try {
      const r = await fetch(`/api/admin/content?jobId=${jid}`);
      const d = await r.json();
      setContentItems(d.items || []);
    } catch { setContentMsg("Failed to load content"); }
    finally { setContentLoading(false); }
  }

  async function saveContent(item: any) {
    setContentSaving(true); setContentMsg("");
    try {
      const r = await fetch("/api/admin/content", { method:"POST", headers:{"Content-Type":"application/json"}, body:JSON.stringify({ jobId:jid, item }) });
      const d = await r.json();
      if (!r.ok) throw new Error(d.error||"Save failed");
      setContentMsg("✓ Saved");
      setContentForm(null);
      await loadContent();
      toast("Content saved","ok");
    } catch(e) { setContentMsg((e as Error).message); toast("Save failed","err"); }
    finally { setContentSaving(false); }
  }

  async function deleteContent(itemId: string) {
    if (!confirm("Delete this item?")) return;
    try {
      await fetch("/api/admin/content", { method:"DELETE", headers:{"Content-Type":"application/json"}, body:JSON.stringify({ jobId:jid, itemId }) });
      await loadContent();
      toast("Deleted","ok");
    } catch { toast("Delete failed","err"); }
  }

  async function generateContent(type: string, extraPrompt: string) {
    setGenLoading(true); setContentMsg("");
    try {
      const r = await fetch("/api/admin/content/generate", {
        method:"POST", headers:{"Content-Type":"application/json"},
        body:JSON.stringify({ type, businessName:c.businessName, industry:c.industry, prompt:extraPrompt, tone:"professional, friendly, and authentic" })
      });
      const d = await r.json();
      if (!r.ok) throw new Error(d.error||"Generation failed");
      setContentForm((prev: any) => ({ ...prev, ...(d.generated||{}), type }));
      setContentMsg("✓ Draft generated — review and save");
      toast("Draft generated","ok");
    } catch(e) { setContentMsg((e as Error).message); toast("Generation failed","err"); }
    finally { setGenLoading(false); }
  }

  const sectionTitle = (text:string) => (
    <div style={{ fontSize:10, color:T.textSec, textTransform:"uppercase" as const, letterSpacing:"0.09em", fontWeight:700, marginBottom:12, paddingBottom:8, borderBottom:`1px solid ${T.border}` }}>{text}</div>
  );

  async function loadArchiveVersions() {
    setArchiveLoading(true);
    setArchiveMsg("");
    try {
      const r = await fetch(`/api/versions?jobId=${jid}`, { headers: { "x-process-secret": secret } });
      const d = await r.json();
      if (!r.ok) throw new Error(d.error || "Failed to load versions");
      setArchiveVersions(d.versions || []);
    } catch(e) { setArchiveMsg((e as Error).message); }
    finally { setArchiveLoading(false); }
  }

  async function takeSnapshot() {
    setArchiveSnapshotting(true);
    setArchiveMsg("");
    try {
      const r = await fetch("/api/versions/snapshot", {
        method: "POST",
        headers: { "Content-Type": "application/json", "x-process-secret": secret },
        body: JSON.stringify({ jobId: jid, trigger: "manual" }),
      });
      const d = await r.json();
      if (!r.ok) throw new Error(d.error || "Snapshot failed");
      setArchiveMsg("✓ Snapshot saved");
      await loadArchiveVersions();
    } catch(e) { setArchiveMsg((e as Error).message); }
    finally { setArchiveSnapshotting(false); }
  }

  async function loadVersionHtml(version: any) {
    setArchiveSelected(version);
    setArchivePreviewHtml(null);
    setArchiveSubTab("preview");
    if (!version.html_loaded) {
      setArchivePreviewLoading(true);
      try {
        const r = await fetch(`/api/versions/html?id=${version.id}`, { headers: { "x-process-secret": secret } });
        const d = await r.json();
        if (r.ok) {
          setArchivePreviewHtml(d.html || null);
          // cache it so we don't re-fetch
          setArchiveVersions(prev => prev.map(v => v.id === version.id ? { ...v, html_loaded: true, html: d.html } : v));
        }
      } catch {}
      finally { setArchivePreviewLoading(false); }
    } else {
      setArchivePreviewHtml(version.html || null);
    }
  }

  async function deleteVersion(id: string) {
    if (!confirm("Delete this snapshot? This cannot be undone.")) return;
    try {
      const r = await fetch(`/api/versions?id=${id}`, { method: "DELETE", headers: { "x-process-secret": secret } });
      if (r.ok) {
        setArchiveVersions(prev => prev.filter(v => v.id !== id));
        if (archiveSelected?.id === id) { setArchiveSelected(null); setArchivePreviewHtml(null); }
        setArchiveMsg("Snapshot deleted");
      }
    } catch {}
  }

  const tabBtn = (id:typeof tabs[number], label:string) => (
    <button key={id} onClick={()=>{setTab(id);if(id==="requests"&&featureRequests.length===0)loadFeatureRequests();if(id==="content"&&contentItems.length===0)loadContent();}}
      style={{ display:"flex", alignItems:"center", gap:8, padding:"9px 12px", fontSize:12, fontWeight:tab===id?700:400, color:tab===id?T.blue:T.textMuted, background:tab===id?T.raised:"transparent", border:"none", borderRadius:7, cursor:"pointer", transition:"all 0.15s ease", textAlign:"left" as const, width:"100%", fontFamily:"inherit" }}>
      {label}
    </button>
  );

  const btn = (color:string, fill=false):React.CSSProperties => ({
    background:fill?color:"transparent", color:fill?"#fff":color, border:`1px solid ${fill?"transparent":color+"55"}`,
    borderRadius:8, padding:"7px 14px", fontSize:12, fontWeight:500, cursor:"pointer", textDecoration:"none" as const,
  });

  return (
    <>
      <div onClick={onClose} style={{ position:"fixed", inset:0, background:T.overlay, zIndex:200, backdropFilter:"blur(4px)", animation:"wg-fade 0.2s ease" }}/>
      <div className="wg-panel" style={{
        position:"fixed", inset:0, zIndex:201, maxWidth:"100vw",
        background:T.bg, borderLeft:`1px solid ${T.border}`,
        display:"flex", flexDirection:"column",
        boxShadow:T.shadowXl,
      }}>
        {/* Panel header */}
        <div style={{ padding:"20px 24px 16px", borderBottom:`1px solid ${T.border}`, flexShrink:0, background:T.surface }}>
          <div style={{ display:"flex", alignItems:"flex-start", justifyContent:"space-between", marginBottom:12 }}>
            <div style={{ display:"flex", alignItems:"center", gap:12 }}>
              <div style={{ width:42,height:42,borderRadius:11,background:`linear-gradient(135deg,${statusColor}28,${statusColor}0c)`,border:`1px solid ${statusColor}35`,display:"flex",alignItems:"center",justifyContent:"center",fontSize:15,fontWeight:700,color:statusColor,flexShrink:0 }}>
                {initials}
              </div>
              <div>
                <div style={{ fontSize:16, fontWeight:700, color:T.text, letterSpacing:"-0.02em" }}>{c.businessName}</div>
                <div style={{ fontSize:12, color:T.textMuted, marginTop:2 }}>{c.industry}</div>
              </div>
            </div>
            <button onClick={onClose} style={{ background:T.raised, border:`1px solid ${T.border}`, borderRadius:8, color:T.textMuted, fontSize:16, cursor:"pointer", width:32, height:32, display:"flex", alignItems:"center", justifyContent:"center" }}>×</button>
          </div>
          <div style={{ display:"flex", gap:5, flexWrap:"wrap" as const }}>
            <Pill color={statusColor}>{c.buildStatus||"pending"}</Pill>
            {c.paymentState?.monthlyActive&&<Pill color={T.green}>Monthly</Pill>}
            {c.paymentState?.finalPaid&&!c.paymentState?.monthlyActive&&<Pill color={T.blue}>Final Paid</Pill>}
            {c.paymentState?.depositPaid&&!c.paymentState?.finalPaid&&<Pill color={T.amber}>Deposit</Pill>}
            {!c.paymentState?.depositPaid&&<Pill color={T.textMuted}>Unpaid</Pill>}
            {c.hasBooking&&<Pill color={T.purple}>Booking</Pill>}
            {c.metadata?.alreadyReleased&&<Pill color={T.green}>Released</Pill>}
            {(ui.features||[]).slice(0,3).map(f=><Pill key={f} color={T.textMuted}>{f}</Pill>)}
          </div>
        </div>

        {/* Body: vertical sidebar + content */}
        <div style={{ flex:1, display:"flex", overflow:"hidden" }}>
          {/* Vertical tab sidebar */}
          <div style={{ width:130, flexShrink:0, borderRight:`1px solid ${T.border}`, background:T.surface, overflowY:"auto" as const, display:"flex", flexDirection:"column" as const, padding:"8px 0" }}>
            {tabBtn("perf","📊 Perf")}
            {tabBtn("engagement","🔥 Engage")}
            {tabBtn("seo","🔍 SEO")}
            {tabBtn("site","🌐 Site")}
            {tabBtn("assets","🖼️ Assets")}
            {tabBtn("integrations","🔌 Integr.")}
            {tabBtn("content","📝 Content")}
            {tabBtn("payments","💳 Payments")}
            {tabBtn("actions","⚡ Actions")}
            {tabBtn("requests",`📬 Req${pending>0?" ("+pending+")":""}`)}
            {tabBtn("checklist","✅ Checklist")}
            {((c as any).metadata?.serviceType==="social"||(c as any).metadata?.serviceType==="both")&&tabBtn("social","📱 Social")}
          </div>

          {/* Tab content */}
          <div key={tab} className="wg-tab" style={{ flex:1, overflowY:"auto" as const, padding:"24px" }}>

          {/* Tab info banner */}
          {(()=>{
            const INFO: Record<string,string> = {
              perf: "Performance shows real visitor data tracked by WebGecko's pixel. Views = page loads. Booking clicks = taps on the booking button. Form submits = contact form sends. Data updates every few hours.",
              engagement: "Engagement tracks how visitors interact with the site — scroll depth, time on page, CTA clicks. Use this to identify which sections are working and which aren't.",
              seo: "SEO shows the keywords and meta data used by the search engine optimiser during the build. LSI keywords are injected into the page. SERP insights show what the top-ranking competitors are doing.",
              site: "Site shows the live preview of the client's website. The preview always shows the latest deployed HTML. The Live URL is what the public sees. Use Actions → Fix URL if the URL looks wrong.",
              assets: "Assets are the images and files uploaded for this client — logo, hero image, photos. These are injected into the site at build time. Upload new ones and rebuild to update.",
              integrations: "Integrations connect third-party services: GA4 (analytics), SuperSaas (bookings), Square (payments), Tawk.to (live chat). Add IDs/keys here then rebuild the site for them to take effect.",
              content: "Content is how you push updates to the client's live site. Blog posts, newsletters, deals, reviews and products are all managed here.\n\n📰 Blog — client submits a post via their portal → you review and approve → pushed live on next redeploy.\n✉️ Newsletter — captured emails go to Beehiiv. You send campaigns from Beehiiv's dashboard. WebGecko doesn't send newsletters directly.\n🏷️ Deals — create a promo that appears as a popup or banner. You rebuild the site to push it live.\n⭐ Reviews — add or approve testimonials. Pushed live on next rebuild.\n🛍️ Products — manage the shop catalogue. Updates go live on next rebuild.",
              payments: "Payments shows Stripe connection status and payment history. Deposit = first payment. Final = second payment. Monthly = subscription. Connect Stripe via the button below.",
              actions: "Actions let you control the build pipeline for this client. Force redeploy = push current HTML instantly. Fix site = run an AI fix pass. Rebuild = full regeneration from scratch (5–10 min). Fix URL = correct the saved URL in the database.",
              requests: "Requests are change requests submitted by the client through their portal. They can request blog posts, text changes, new images, or links. You review here, approve or reject, and push changes. Approved requests trigger a site rebuild.",
              checklist: "The checklist guides you through every step needed to fully set up and launch this client's site — legal pages, domain, analytics, booking, go-live. Items marked REQUIRED must be completed before the site can launch. URL fields must be filled before an item can be marked done.",
            };
            const info = INFO[tab];
            if (!info) return null;
            return (
              <div style={{background:T.surface,border:`1px solid ${T.border}`,borderRadius:10,padding:"12px 16px",marginBottom:20,display:"flex",gap:10,alignItems:"flex-start"}}>
                <span style={{fontSize:16,flexShrink:0,marginTop:1}}>ℹ️</span>
                <div style={{fontSize:12,color:T.textMuted,lineHeight:1.7,whiteSpace:"pre-line" as const}}>{info}</div>
              </div>
            );
          })()}

          {/* PERFORMANCE */}
          {tab==="perf"&&(
            <>
              {/* 6 mini KPI cards */}
              <div style={{ display:"grid", gridTemplateColumns:"repeat(auto-fill,minmax(130px,1fr))", gap:10, marginBottom:20 }}>
                {[
                  {label:"Views/month",value:a?.thisMonth.views??0,color:T.blue},
                  {label:"Today",value:a?.today.views??0,color:T.green},
                  {label:"All-time views",value:a?.totals.views??0,color:T.textSec},
                  {label:"Booking clicks",value:a?.thisMonth.bookingClicks??0,color:T.amber},
                  {label:"Bookings",value:c.bookingCount,color:T.purple},
                  {label:"Form submits",value:a?.totals.formSubmits??0,color:T.cyan},
                ].map(s=>(
                  <div key={s.label} style={{ background:T.surface, border:`1px solid ${s.color}28`, borderRadius:10, padding:"14px 16px", boxShadow:`0 0 0 1px ${s.color}10, 0 4px 20px rgba(0,0,0,0.6)`, position:"relative", overflow:"hidden" }}>
                    <div style={{ position:"absolute",left:0,top:0,bottom:0,width:3,borderRadius:"10px 0 0 10px",background:`linear-gradient(180deg,${s.color},${s.color}40)` }}/>
                    <div style={{ position:"absolute",top:0,right:0,width:60,height:60,background:`radial-gradient(circle at top right,${s.color}18,transparent 65%)`,pointerEvents:"none" }}/>
                    <div style={{ fontSize:24,fontWeight:800,color:s.color,letterSpacing:"-0.03em",lineHeight:1,marginBottom:6 }}><AnimNum value={s.value} color={s.color}/></div>
                    <div style={{ fontSize:10,color:T.textMuted,fontWeight:700,letterSpacing:"0.07em",textTransform:"uppercase" as const }}>{s.label}</div>
                  </div>
                ))}
              </div>
              {/* Traffic breakdown bar */}
              {a&&(()=>{
                const views = a.thisMonth.views||1;
                const bars = [
                  {label:"Views",val:a.thisMonth.views,color:T.blue,pct:100},
                  {label:"Booking clicks",val:a.thisMonth.bookingClicks,color:T.amber,pct:Math.round(a.thisMonth.bookingClicks/views*100)},
                  {label:"Bookings",val:c.bookingCount,color:T.purple,pct:Math.round(c.bookingCount/views*100)},
                  {label:"Form submits",val:a.totals.formSubmits,color:T.cyan,pct:Math.round(a.totals.formSubmits/views*100)},
                ];
                return (
                  <div style={{ background:T.raised, border:`1px solid ${T.border}`, borderRadius:12, padding:"16px 18px", marginBottom:20 }}>
                    {sectionTitle("Traffic breakdown")}
                    {bars.map(b=>(
                      <div key={b.label} style={{ marginBottom:10 }}>
                        <div style={{ display:"flex",justifyContent:"space-between",fontSize:11,color:T.textSec,marginBottom:4 }}>
                          <span>{b.label}</span>
                          <span style={{ color:b.color,fontWeight:600 }}>{b.val} ({b.pct}%)</span>
                        </div>
                        <div style={{ height:6,borderRadius:99,background:T.surface,overflow:"hidden" }}>
                          <div style={{ width:`${Math.min(b.pct,100)}%`,height:"100%",borderRadius:99,background:b.color,transition:"width 0.6s cubic-bezier(0.22,1,0.36,1)" }}/>
                        </div>
                      </div>
                    ))}
                  </div>
                );
              })()}
              <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:20 }}>
                <div>
                  {sectionTitle("Client info")}
                  <InfoRow label="Email" value={c.clientEmail}/>
                  <InfoRow label="Phone" value={c.clientPhone}/>
                  <InfoRow label="ABN" value={ui.abn} mono/>
                  <InfoRow label="Address" value={ui.businessAddress}/>
                  <InfoRow label="USP" value={ui.usp}/>
                  <InfoRow label="Goal" value={ui.goal}/>
                </div>
                <div>
                  {sectionTitle("Build info")}
                  <InfoRow label="Job ID" value={jid} mono/>
                  <InfoRow label="Built at" value={c.builtAt?new Date(c.builtAt).toLocaleString("en-AU"):undefined}/>
                  <InfoRow label="Site type" value={ui.siteType}/>
                  <InfoRow label="Pages" value={(ui.pages||[]).join(", ")}/>
                  <InfoRow label="Style" value={ui.style}/>
                  <InfoRow label="Colour prefs" value={ui.colorPrefs}/>
                  {c.metadata?.scheduledReleaseAt&&<InfoRow label="Auto-release" value={new Date(c.metadata.scheduledReleaseAt).toLocaleDateString("en-AU",{day:"numeric",month:"short",year:"numeric"})}/>}
                </div>
              </div>
              {ui.additionalNotes&&(
                <div style={{ marginTop:20 }}>
                  {sectionTitle("Additional notes")}
                  <div style={{ fontSize:13,color:T.textSec,lineHeight:1.7,background:T.raised,borderRadius:8,padding:"12px 14px",border:`1px solid ${T.border}`,whiteSpace:"pre-wrap" as const }}>{ui.additionalNotes}</div>
                </div>
              )}
              {(ui.facebookPage||ui.instagramUrl||ui.linkedinUrl)&&(
                <div style={{ marginTop:20 }}>
                  {sectionTitle("Social links")}
                  <div style={{ display:"flex",gap:8,flexWrap:"wrap" as const }}>
                    {ui.facebookPage&&<a href={ui.facebookPage} target="_blank" rel="noreferrer" style={{...btn(T.blue),display:"inline-flex",alignItems:"center"}}>Facebook →</a>}
                    {ui.instagramUrl&&<a href={ui.instagramUrl} target="_blank" rel="noreferrer" style={{...btn(T.purple),display:"inline-flex",alignItems:"center"}}>Instagram →</a>}
                    {ui.linkedinUrl&&<a href={ui.linkedinUrl} target="_blank" rel="noreferrer" style={{...btn(T.cyan),display:"inline-flex",alignItems:"center"}}>LinkedIn →</a>}
                  </div>
                </div>
              )}
            </>
          )}

          {/* ENGAGEMENT */}
          {tab==="engagement"&&(
            <>
              <div style={{ display:"grid", gridTemplateColumns:"repeat(auto-fill,minmax(155px,1fr))", gap:10, marginBottom:20 }}>
                {[
                  {label:"Views today",value:a?.today.views??0,color:T.green},
                  {label:"Book clicks today",value:a?.today.bookingClicks??0,color:T.amber},
                  {label:"Views/month",value:a?.thisMonth.views??0,color:T.blue},
                  {label:"Book clicks/month",value:a?.thisMonth.bookingClicks??0,color:T.amber},
                  {label:"Contact clicks/month",value:a?.thisMonth.contactClicks??0,color:T.cyan},
                  {label:"All-time views",value:a?.totals.views??0,color:T.textSec},
                  {label:"All-time book clicks",value:a?.totals.bookingClicks??0,color:T.purple},
                  {label:"Form submits",value:a?.totals.formSubmits??0,color:T.green},
                  {label:"Total bookings",value:c.bookingCount,color:T.purple},
                ].map(s=>(
                  <div key={s.label} style={{ background:T.surface,border:`1px solid ${T.border}`,borderRadius:10,padding:"14px 16px",boxShadow:T.shadow }}>
                    <div style={{ fontSize:22,fontWeight:700,color:s.color,letterSpacing:"-0.02em",lineHeight:1 }}>{s.value}</div>
                    <div style={{ fontSize:11,color:T.textMuted,marginTop:5,fontWeight:500 }}>{s.label}</div>
                  </div>
                ))}
              </div>
              <div style={{ display:"flex",gap:8 }}>
                <a href={`/bookings?jobId=${jid}&secret=${secret}`} target="_blank" rel="noreferrer" style={{...btn(T.purple),display:"inline-flex",alignItems:"center"}}>View bookings →</a>
                <button style={btn(T.cyan)} onClick={()=>api(`/api/analytics/monthly?jobId=${jid}&secret=${sec}&send=true`).then(()=>toast("Report sent","ok")).catch(()=>toast("Failed to send","err"))}>Send monthly report</button>
              </div>
            </>
          )}

          {/* SEO */}
          {tab==="seo"&&(
            <>
              {!seo&&<div style={{color:T.textMuted,fontSize:13,padding:"20px 0"}}>No SEO data yet — populated on next build.</div>}
              {seo&&(
                <>
                  <div style={{marginBottom:20}}>
                    {sectionTitle("Meta description")}
                    <div style={{fontSize:13,color:T.textSec,background:T.raised,borderRadius:8,padding:"12px 14px",border:`1px solid ${T.border}`,lineHeight:1.7}}>{seo.metaDescription||"Not set"}</div>
                  </div>
                  <div style={{marginBottom:20}}>
                    {sectionTitle(`LSI Keywords (${(seo.lsiKeywords||[]).length})`)}
                    <div style={{display:"flex",flexWrap:"wrap" as const,gap:6}}>
                      {(seo.lsiKeywords||[]).length===0&&<span style={{color:T.textMuted,fontSize:12}}>None generated</span>}
                      {(seo.lsiKeywords||[]).map((k,i)=>(
                        <span key={i} style={{background:T.blue+"12",border:`1px solid ${T.blue}25`,color:T.blue,borderRadius:6,padding:"3px 10px",fontSize:11,fontWeight:500}}>{k}</span>
                      ))}
                    </div>
                  </div>
                  {seo.serpInsights&&(()=>{
                    const si=seo.serpInsights!;
                    const wc=si.avgWordCount||800; const h2=si.avgH2Count||6;
                    type IS="good"|"warn"|"bad";
                    const ind=(s:IS)=>{const m={good:{icon:"✓",color:T.green},warn:{icon:"!",color:T.amber},bad:{icon:"✗",color:T.red}}[s];return <span style={{display:"inline-flex",alignItems:"center",gap:4,background:m.color+"15",color:m.color,border:`1px solid ${m.color}30`,borderRadius:20,padding:"2px 10px",fontSize:11,fontWeight:700}}>{m.icon} {s==="good"?"Good":s==="warn"?"Needs work":"Action needed"}</span>;};
                    return (
                      <div style={{marginBottom:20}}>
                        {sectionTitle("SERP intelligence")}
                        {[
                          {title:"Content length",note:`Competitors avg ${wc} words`,status:(wc>1200?"bad":wc>600?"good":"warn") as IS,detail:wc>1200?`Match competitor depth — add FAQs, detail sections.`:wc>600?`Content depth is competitive.`:`Concise sites can outrank with good structure.`},
                          {title:"Section headings (H2s)",note:`Competitors use ${h2} headings`,status:(h2>=5&&h2<=10?"good":h2<3?"bad":"warn") as IS,detail:h2>=5&&h2<=10?`${h2} H2s is solid.`:h2<3?`Use more clear section headings.`:`${h2} H2s -- ensure each targets a keyword.`},
                        ].map(row=>(
                          <div key={row.title} style={{background:T.raised,borderRadius:10,padding:"14px 16px",border:`1px solid ${T.border}`,marginBottom:10}}>
                            <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:6}}>
                              <div><span style={{fontSize:13,fontWeight:600,color:T.text}}>{row.title}</span><span style={{fontSize:11,color:T.textMuted,marginLeft:8}}>{row.note}</span></div>
                              <div style={{display:"flex",gap:8,alignItems:"center"}}>
                                {(row.status==="warn"||row.status==="bad")&&(
                                  <button onClick={()=>api(`/api/admin/fix-proxy?jobId=${jid}&secret=${sec}`).then(()=>toast("SEO fix pass started","ok")).catch((e:any)=>toast(e.message,"err"))} style={{fontSize:11,background:T.amber+"20",color:T.amber,border:`1px solid ${T.amber}40`,borderRadius:6,padding:"3px 10px",cursor:"pointer",fontWeight:700}}>Fix SEO</button>
                                )}
                                {ind(row.status)}
                              </div>
                            </div>
                            <div style={{fontSize:12,color:T.textMuted,lineHeight:1.6}}>{row.detail}</div>
                          </div>
                        ))}
                        <div style={{background:T.raised,borderRadius:10,padding:"14px 16px",border:`1px solid ${T.border}`,marginBottom:10}}>
                          <div style={{fontSize:13,fontWeight:600,color:T.text,marginBottom:6}}>Winning structure</div>
                          <div style={{fontSize:12,color:T.textSec,lineHeight:1.7}}>{si.winningStructure}</div>
                        </div>
                        <div style={{background:T.raised,borderRadius:10,padding:"14px 16px",border:`1px solid ${T.border}`}}>
                          <div style={{fontSize:13,fontWeight:600,color:T.text,marginBottom:8}}>Top competitor headings</div>
                          <div style={{display:"flex",flexDirection:"column" as const,gap:6}}>
                            {(si.topHeadings||[]).map((h,i)=>(
                              <div key={i} style={{display:"flex",alignItems:"center",gap:10,background:T.surface,borderRadius:7,padding:"8px 12px",border:`1px solid ${T.border}`}}>
                                <span style={{background:T.blue+"20",color:T.blue,borderRadius:4,padding:"1px 7px",fontSize:10,fontWeight:700,flexShrink:0}}>#{i+1}</span>
                                <span style={{fontSize:12,color:T.textSec}}>{h}</span>
                              </div>
                            ))}
                          </div>
                        </div>
                      </div>
                    );
                  })()}
                </>
              )}
            </>
          )}

          {/* SITE */}
          {tab==="site"&&(
            <>
              <div style={{marginBottom:20}}>
                {sectionTitle("URLs")}
                <div style={{display:"flex",gap:8,flexWrap:"wrap" as const,marginBottom:14}}>
                  {c.previewUrl&&<a href={c.previewUrl} target="_blank" rel="noreferrer" style={{...btn(T.green),display:"inline-flex",alignItems:"center"}}>Preview →</a>}
                  {c.liveUrl&&c.liveDomain&&<a href={c.liveUrl} target="_blank" rel="noreferrer" style={{...btn(T.green,true),display:"inline-flex",alignItems:"center"}}>Live →</a>}
                  <a href={`/c/${c.slug}`} target="_blank" rel="noreferrer" style={{...btn(T.textMuted),display:"inline-flex",alignItems:"center"}}>Client portal →</a>
                </div>
                <InfoRow label="Preview URL" value={c.previewUrl} mono/>
                <InfoRow label="Desired domain" value={c.domain} mono/>
                {c.metadata?.domainStatus&&<InfoRow label="Domain status" value={c.metadata.domainStatus}/>}
                {c.metadata?.domainUrl&&<InfoRow label="Domain URL" value={c.metadata.domainUrl} mono/>}
                <InfoRow label="Vercel project" value={c.vercelProjectName} mono/>
              </div>
              <div style={{marginBottom:20}}>
                {sectionTitle("Deploy HTML as live preview")}
                <DeployHtmlLive jobId={jid} onDeployed={()=>setDeployedAt(new Date().toISOString())} toast={toast}/>
              </div>
              {c.previewUrl&&(
                <div style={{marginBottom:20}}>
                  {sectionTitle("Live preview")}
                  {c.buildStatus==="building"
                    ? <div style={{borderRadius:10,border:`1px solid ${T.border}`,background:T.raised,height:160,display:"flex",alignItems:"center",justifyContent:"center"}}><div style={{color:T.textMuted,fontSize:13}}>⏳ Building… preview appears when done</div></div>
                    : <PreviewFrame key={`${jid}-${deployedAt||c.builtAt||"init"}`} previewUrl={c.previewUrl} builtAt={deployedAt||c.builtAt} jobId={jid}/>}
                </div>
              )}
              {c.hasBooking&&(
                <div style={{marginBottom:20}}>
                  {sectionTitle("Booking system")}
                  <InfoRow label="SuperSaas ID" value={c.supersaasId} mono/>
                  <InfoRow label="SuperSaas URL" value={c.supersaasUrl} mono/>
                  <InfoRow label="Services" value={c.bookingServices}/>
                  {c.supersaasUrl&&<a href={c.supersaasUrl} target="_blank" rel="noreferrer" style={{...btn(T.purple),display:"inline-block",marginTop:8}}>Open SuperSaas →</a>}
                </div>
              )}
              {c.tawktoPropertyId&&(
                <div style={{marginBottom:20}}>
                  {sectionTitle("Live chat (Tawk.to)")}
                  <InfoRow label="Property ID" value={c.tawktoPropertyId} mono/>
                  <a href="https://dashboard.tawk.to" target="_blank" rel="noreferrer" style={{...btn(T.green),display:"inline-block",marginTop:8}}>Open Tawk.to →</a>
                </div>
              )}
              {c.shopCatalogue&&c.shopCatalogue.length>0&&(
                <div>
                  {sectionTitle(`Shop products (${c.shopCatalogue.length})`)}
                  <div style={{display:"flex",flexDirection:"column" as const,gap:6}}>
                    {c.shopCatalogue.map((item:any,i:number)=>(
                      <div key={i} style={{display:"flex",justifyContent:"space-between",alignItems:"center",background:T.raised,borderRadius:8,padding:"10px 14px",border:`1px solid ${T.border}`}}>
                        <div>
                          <div style={{fontSize:13,color:T.text,fontWeight:500}}>{item.name}</div>
                          <div style={{fontSize:11,color:T.textMuted,fontFamily:"monospace",marginTop:2}}>{item.variationId||"no Square ID"}</div>
                        </div>
                        <div style={{textAlign:"right" as const}}>
                          <div style={{fontSize:14,color:T.green,fontWeight:600}}>${(item.priceCents/100).toFixed(2)}</div>
                          {item.paymentLinkUrl&&<a href={item.paymentLinkUrl} target="_blank" rel="noreferrer" style={{fontSize:10,color:T.blue}}>Payment link →</a>}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </>
          )}


          {/* ASSETS */}
          {tab==="assets"&&(
            <div style={{display:"flex",flexDirection:"column" as const,gap:20}}>
              {/* Gallery photos */}
              <div>
                {sectionTitle("Gallery photos")}
                <div style={{fontSize:12,color:T.textMuted,marginBottom:12,lineHeight:1.6}}>
                  Upload photos for the gallery section. These will be injected into the site's gallery grid on next fix/rebuild.
                </div>
                <div style={{display:"flex",flexWrap:"wrap" as const,gap:8,marginBottom:12}}>
                  {(c.photoUrls||[]).map((url:string,i:number)=>(
                    <div key={i} style={{position:"relative",width:80,height:80,borderRadius:8,overflow:"hidden",border:`1px solid ${T.border}`}}>
                      <img src={url} style={{width:"100%",height:"100%",objectFit:"cover"}} alt={`Photo ${i+1}`}/>
                    </div>
                  ))}
                  {(c.photoUrls||[]).length===0&&<div style={{fontSize:12,color:T.textMuted}}>No photos uploaded yet.</div>}
                </div>
                <input type="file" id={`gallery-upload-${jid}`} multiple accept="image/*" style={{display:"none"}} onChange={async(e)=>{
                  const files=Array.from(e.target.files||[]);
                  if(!files.length)return;
                  setAssetUploading(true); setAssetMsg("");
                  try {
                    const fd=new FormData();
                    fd.append("jobId",jid);
                    fd.append("type","gallery");
                    files.forEach(f=>fd.append("photos",f));
                    const r=await fetch("/api/admin/upload-assets",{method:"POST",body:fd});
                    const d=await r.json();
                    if(!r.ok)throw new Error(d.error||"Upload failed");
                    setAssetMsg(`✓ ${files.length} photo${files.length>1?"s":""} uploaded`);
                    toast("Photos uploaded","ok");
                  } catch(e){setAssetMsg((e as Error).message);toast("Upload failed","err");}
                  finally{setAssetUploading(false);}
                }}/>
                <label htmlFor={`gallery-upload-${jid}`} style={{display:"inline-flex",alignItems:"center",gap:8,background:T.raised,border:`1px solid ${T.border}`,borderRadius:8,padding:"8px 16px",fontSize:12,fontWeight:500,color:T.text,cursor:"pointer",opacity:assetUploading?0.6:1}}>
                  {assetUploading?"Uploading…":"📷 Upload gallery photos"}
                </label>
                {assetMsg&&<div style={{fontSize:12,color:assetMsg.startsWith("✓")?T.green:T.red,marginTop:8}}>{assetMsg}</div>}
              </div>

              {/* Logo */}
              <div>
                {sectionTitle("Logo")}
                {c.logoUrl&&<img src={c.logoUrl} style={{maxHeight:60,maxWidth:200,objectFit:"contain",marginBottom:12,border:`1px solid ${T.border}`,borderRadius:6,padding:4,background:"#fff"}} alt="Logo"/>}
                <input type="file" id={`logo-upload-${jid}`} accept="image/*" style={{display:"none"}} onChange={async(e)=>{
                  const file=e.target.files?.[0]; if(!file)return;
                  setAssetUploading(true); setAssetMsg("");
                  try {
                    const fd=new FormData();
                    fd.append("jobId",jid);
                    fd.append("type","logo");
                    fd.append("photos",file);
                    const r=await fetch("/api/admin/upload-assets",{method:"POST",body:fd});
                    const d=await r.json();
                    if(!r.ok)throw new Error(d.error||"Upload failed");
                    setAssetMsg("✓ Logo uploaded");
                    toast("Logo uploaded","ok");
                  } catch(e){setAssetMsg((e as Error).message);toast("Upload failed","err");}
                  finally{setAssetUploading(false);}
                }}/>
                <label htmlFor={`logo-upload-${jid}`} style={{display:"inline-flex",alignItems:"center",gap:8,background:T.raised,border:`1px solid ${T.border}`,borderRadius:8,padding:"8px 16px",fontSize:12,fontWeight:500,color:T.text,cursor:"pointer",opacity:assetUploading?0.6:1}}>
                  {assetUploading?"Uploading…":"🏷 Upload logo"}
                </label>
              </div>

              {/* Hero image */}
              <div>
                {sectionTitle("Hero image")}
                {c.heroUrl&&<img src={c.heroUrl} style={{maxHeight:80,maxWidth:280,objectFit:"cover",marginBottom:12,border:`1px solid ${T.border}`,borderRadius:6}} alt="Hero"/>}
                <input type="file" id={`hero-upload-${jid}`} accept="image/*" style={{display:"none"}} onChange={async(e)=>{
                  const file=e.target.files?.[0]; if(!file)return;
                  setAssetUploading(true); setAssetMsg("");
                  try {
                    const fd=new FormData();
                    fd.append("jobId",jid);
                    fd.append("type","hero");
                    fd.append("photos",file);
                    const r=await fetch("/api/admin/upload-assets",{method:"POST",body:fd});
                    const d=await r.json();
                    if(!r.ok)throw new Error(d.error||"Upload failed");
                    setAssetMsg("✓ Hero uploaded");
                    toast("Hero uploaded","ok");
                  } catch(e){setAssetMsg((e as Error).message);toast("Upload failed","err");}
                  finally{setAssetUploading(false);}
                }}/>
                <label htmlFor={`hero-upload-${jid}`} style={{display:"inline-flex",alignItems:"center",gap:8,background:T.raised,border:`1px solid ${T.border}`,borderRadius:8,padding:"8px 16px",fontSize:12,fontWeight:500,color:T.text,cursor:"pointer",opacity:assetUploading?0.6:1}}>
                  {assetUploading?"Uploading…":"🖼 Upload hero image"}
                </label>
              </div>
            </div>
          )}

          {/* INTEGRATIONS */}
          {tab==="integrations"&&(
            <div style={{display:"flex",flexDirection:"column" as const,gap:20}}>

              {/* Stripe Connect */}
              <div style={{background:T.raised,border:`1px solid ${T.border}`,borderRadius:12,padding:"20px 22px"}}>
                {sectionTitle("Stripe Connect (Payments / Shop)")}
                <div style={{fontSize:13,color:T.textSec,marginBottom:16,lineHeight:1.7}}>
                  Connect this client's Stripe account via OAuth. Payments go directly to the client. WebGecko automatically takes a <strong style={{color:T.green}}>2% application fee</strong> on every transaction.
                </div>
                {c.stripeAccountId ? (
                  <div style={{display:"flex",flexDirection:"column" as const,gap:12}}>
                    <div style={{display:"flex",alignItems:"center",gap:10,background:T.green+"14",border:`1px solid ${T.green}40`,borderRadius:9,padding:"12px 16px"}}>
                      <span>&#x2705;</span>
                      <div>
                        <div style={{fontSize:13,fontWeight:700,color:T.green}}>Stripe Connected</div>
                        <div style={{fontSize:11,color:T.textSec,marginTop:2,fontFamily:"monospace"}}>{c.stripeAccountId}</div>
                        {c.stripeConnectedAt&&<div style={{fontSize:10,color:T.textMuted,marginTop:2}}>Connected {new Date(c.stripeConnectedAt).toLocaleDateString("en-AU")}</div>}
                      </div>
                    </div>
                    {features.includes("Payments / Shop")&&(
                      <div style={{borderTop:`1px solid ${T.border}`,paddingTop:14,marginTop:4}}>
                        <div style={{fontSize:12,fontWeight:700,color:T.text,marginBottom:8}}>Shop Products</div>
                        {(c.shopCatalogue&&c.shopCatalogue.length>0)&&(
                          <div style={{marginBottom:14}}>
                            <div style={{fontSize:11,color:T.textSec,fontWeight:600,marginBottom:8}}>Synced products ({c.shopCatalogue.length}):</div>
                            {c.shopCatalogue.map((item:any,sidx:number)=>(
                              <div key={sidx} style={{display:"flex",alignItems:"center",gap:10,padding:"8px 12px",background:T.bg,border:`1px solid ${T.border}`,borderRadius:7,marginBottom:6}}>
                                <div style={{flex:1}}>
                                  <div style={{fontSize:12,fontWeight:600,color:T.text}}>{item.name}</div>
                                  <div style={{fontSize:11,color:T.textSec}}>${(item.priceCents/100).toFixed(2)} AUD</div>
                                </div>
                                {item.paymentLinkUrl&&<a href={item.paymentLinkUrl} target="_blank" rel="noopener noreferrer" style={{fontSize:10,color:T.blue,textDecoration:"none",border:`1px solid ${T.blue}40`,borderRadius:5,padding:"3px 8px"}}>Link</a>}
                              </div>
                            ))}
                          </div>
                        )}
                        <button disabled={stripeSyncing} onClick={async()=>{
                          const products=(c.userInput as any)?.shopProducts||[];
                          if(!products.length){setStripeMsg("No products in intake form.");return;}
                          setStripeSyncing(true);setStripeMsg("");
                          try{
                            const r=await fetch("/api/stripe/sync-shop",{method:"POST",headers:{"Content-Type":"application/json","x-process-secret":secret||""},body:JSON.stringify({jobId:jid,products})});
                            const d=await r.json();
                            if(!r.ok)throw new Error(d.error||"Sync failed");
                            setStripeMsg("Synced "+d.count+" products to Stripe");
                            toast("Shop synced","ok");
                          }catch(e){setStripeMsg((e as Error).message);toast("Sync failed","err");}
                          finally{setStripeSyncing(false);}
                        }} style={{background:T.purple,color:"#fff",border:"none",borderRadius:8,padding:"9px 18px",fontSize:12,fontWeight:600,cursor:"pointer",opacity:stripeSyncing?0.6:1}}>
                          {stripeSyncing?"Syncing...":"Sync Shop to Stripe"}
                        </button>
                        {stripeMsg&&<div style={{fontSize:11,color:T.textSec,marginTop:8}}>{stripeMsg}</div>}
                      </div>
                    )}
                  </div>
                ):(
                  <div style={{display:"flex",flexDirection:"column" as const,gap:12}}>
                    <div style={{fontSize:12,color:T.textSec,lineHeight:1.7,background:T.bg,border:`1px solid ${T.border}`,borderRadius:9,padding:"12px 16px"}}>
                      <strong style={{color:T.text}}>How it works:</strong> Client connects their Stripe account (free, 30 seconds). WebGecko takes 2% of every sale automatically. All funds go directly to the client.
                    </div>
                    <div style={{fontSize:11,color:T.amber,background:T.amber+"12",border:`1px solid ${T.amber}30`,borderRadius:7,padding:"8px 12px"}}>
                      Stripe verification is usually instant for AU businesses with an ABN.
                    </div>
                    <a href={"/api/stripe/connect?jobId="+jid} style={{display:"inline-flex",alignItems:"center",gap:8,background:"#635BFF",color:"#fff",borderRadius:8,padding:"10px 20px",fontSize:13,fontWeight:700,textDecoration:"none",width:"fit-content"}}>
                      Connect with Stripe
                    </a>
                    <div style={{fontSize:11,color:T.textMuted}}>Client will be redirected to Stripe to authorise. You will be returned here when done.</div>
                  </div>
                )}
              </div>

              {/* Google Analytics */}
              <div style={{background:T.raised,border:`1px solid ${T.border}`,borderRadius:12,padding:"16px 18px"}}>
                {sectionTitle("Google Analytics 4")}
                <div style={{fontSize:13,color:T.textSec,marginBottom:16,lineHeight:1.7}}>
                  Injected into the site's HTML on next fix/rebuild.
                </div>
                <div style={{fontSize:11,color:T.blue,background:T.blue+"12",border:`1px solid ${T.blue}30`,borderRadius:7,padding:"7px 12px",marginBottom:14,display:"flex",alignItems:"center",gap:6}}>
                  <span>&#x1F4BE;</span> Stored in <code style={{fontFamily:"monospace",background:"transparent"}}>jobs.ga4_id</code>
                </div>
                <div style={{display:"flex",gap:10,alignItems:"flex-end"}}>
                  <div style={{flex:1}}>
                    <label style={{fontSize:12,color:T.textSec,fontWeight:700,display:"block",marginBottom:6}}>Measurement ID</label>
                    <input value={ga4Id} onChange={e=>setGa4Id(e.target.value)} placeholder="G-XXXXXXXXXX"
                      style={{width:"100%",boxSizing:"border-box" as const,background:T.bg,border:`1px solid ${T.border}`,borderRadius:7,padding:"10px 14px",color:T.text,fontSize:13,outline:"none",fontFamily:"monospace"}}/>
                    <div style={{fontSize:11,color:T.textSec,marginTop:4}}>GA4 &rarr; Admin &rarr; Data Streams &rarr; Web stream details</div>
                  </div>
                  <button disabled={intSaving} onClick={async()=>{
                    setIntSaving(true); setIntMsg("");
                    try {
                      const r=await fetch("/api/admin/update-integration",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({jobId:jid,ga4Id})});
                      const d=await r.json();
                      if(!r.ok)throw new Error(d.error||"Failed");
                      setIntMsg("✓ GA4 ID saved");
                      toast("Saved","ok");
                    } catch(e){setIntMsg((e as Error).message);toast("Save failed","err");}
                    finally{setIntSaving(false);}
                  }} style={{background:T.blue,color:"#fff",border:"none",borderRadius:8,padding:"9px 18px",fontSize:12,fontWeight:600,cursor:"pointer",opacity:intSaving?0.6:1}}>
                    {intSaving?"Saving…":"Save"}
                  </button>
                </div>
              </div>

              {/* Custom domain */}
              <div style={{background:T.raised,border:`1px solid ${T.border}`,borderRadius:12,padding:"16px 18px"}}>
                {sectionTitle("Custom Domain")}

                {/* Current live URL */}
                {(c.liveUrl||c.domain)&&(
                  <div style={{display:"flex",alignItems:"center",gap:10,background:T.green+"10",border:`1px solid ${T.green}30`,borderRadius:8,padding:"10px 14px",marginBottom:14}}>
                    <span style={{fontSize:14}}>🌐</span>
                    <div style={{flex:1}}>
                      <div style={{fontSize:10,color:T.textMuted,fontWeight:700,textTransform:"uppercase" as const,letterSpacing:"0.07em"}}>Current live URL</div>
                      <a href={c.liveUrl||`https://${c.domain}`} target="_blank" rel="noreferrer"
                        style={{fontSize:13,color:T.green,fontWeight:600,fontFamily:"monospace",textDecoration:"none"}}>
                        {c.liveUrl||`https://${c.domain}`}
                      </a>
                    </div>
                    <a href={c.liveUrl||`https://${c.domain}`} target="_blank" rel="noreferrer"
                      style={{fontSize:11,color:T.blue,border:`1px solid ${T.blue}30`,borderRadius:6,padding:"4px 10px",textDecoration:"none",fontWeight:600,flexShrink:0}}>
                      Open →
                    </a>
                  </div>
                )}

                {/* DNS instructions */}
                <div style={{background:T.bg,border:`1px solid ${T.border}`,borderRadius:9,padding:"12px 14px",marginBottom:14}}>
                  <div style={{fontSize:11,fontWeight:700,color:T.textSec,marginBottom:8}}>📋 DNS setup — tell your client to add these records:</div>
                  <div style={{display:"flex",flexDirection:"column" as const,gap:4}}>
                    {[
                      {type:"A",name:"@",value:"76.76.21.21",note:"Apex / root domain"},
                      {type:"CNAME",name:"www",value:"cname.vercel-dns.com",note:"www subdomain"},
                    ].map(r=>(
                      <div key={r.type} style={{display:"flex",gap:8,alignItems:"center",background:T.surface,borderRadius:6,padding:"7px 10px"}}>
                        <span style={{fontSize:10,fontWeight:800,color:T.purple,background:T.purple+"18",borderRadius:4,padding:"2px 6px",flexShrink:0}}>{r.type}</span>
                        <code style={{fontSize:11,color:T.amber,minWidth:40}}>{r.name}</code>
                        <code style={{fontSize:11,color:T.text,flex:1}}>{r.value}</code>
                        <span style={{fontSize:10,color:T.textMuted}}>{r.note}</span>
                      </div>
                    ))}
                  </div>
                  <div style={{fontSize:10,color:T.textMuted,marginTop:8}}>DNS changes take up to 24h. Once live, assign below to connect to this client's Vercel project.</div>
                </div>

                {/* Assign via Vercel API */}
                <div style={{fontSize:11,fontWeight:700,color:T.textSec,marginBottom:8}}>Connect domain to Vercel project</div>
                <div style={{display:"flex",gap:10,alignItems:"flex-end",marginBottom:10}}>
                  <div style={{flex:1}}>
                    <input value={customDomain} onChange={e=>setCustomDomain(e.target.value)} placeholder="ironcorefitness.com.au"
                      style={{width:"100%",boxSizing:"border-box" as const,background:T.bg,border:`1px solid ${T.border}`,borderRadius:7,padding:"10px 14px",color:T.text,fontSize:13,outline:"none",fontFamily:"monospace"}}/>
                    <div style={{fontSize:10,color:T.textMuted,marginTop:3}}>No https:// or trailing slash. Assigns domain in Vercel + updates DB.</div>
                  </div>
                  <button disabled={intSaving||!customDomain.trim()} onClick={async()=>{
                    setIntSaving(true); setIntMsg("");
                    try {
                      const r=await fetch("/api/admin/assign-domain",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({jobId:jid,domain:customDomain.trim()})});
                      const d=await r.json();
                      if(!r.ok)throw new Error(d.error||"Failed");
                      setIntMsg("✓ Domain assigned to Vercel project — DNS may take up to 24h");
                      toast("Domain assigned","ok");
                    } catch(e){setIntMsg((e as Error).message);toast("Failed: "+(e as Error).message,"err");}
                    finally{setIntSaving(false);}
                  }} style={{background:(!intSaving&&customDomain.trim())?T.blue:T.raised,color:(!intSaving&&customDomain.trim())?"#fff":T.textMuted,border:"none",borderRadius:8,padding:"9px 18px",fontSize:12,fontWeight:600,cursor:"pointer",whiteSpace:"nowrap" as const,flexShrink:0}}>
                    {intSaving?"Assigning…":"Assign in Vercel"}
                  </button>
                </div>

                {/* URL-only override (no Vercel API — just update DB) */}
                <div style={{borderTop:`1px solid ${T.border}`,paddingTop:12,marginTop:4}}>
                  <div style={{fontSize:11,fontWeight:700,color:T.textSec,marginBottom:6}}>
                    Or just update the URL in the database
                    <span style={{fontWeight:400,color:T.textMuted,marginLeft:6}}>— use when domain is already set up elsewhere</span>
                  </div>
                  <div style={{display:"flex",gap:10,alignItems:"center"}}>
                    <input
                      defaultValue={c.liveUrl||""}
                      id={`liveurl-${jid}`}
                      placeholder="https://clientsite.com.au"
                      style={{flex:1,background:T.bg,border:`1px solid ${T.border}`,borderRadius:7,padding:"8px 12px",color:T.text,fontSize:12,outline:"none",fontFamily:"monospace",boxSizing:"border-box" as const}}
                    />
                    <button onClick={async()=>{
                      const el=document.getElementById(`liveurl-${jid}`) as HTMLInputElement;
                      const url=el?.value?.trim();
                      if(!url)return;
                      setIntSaving(true);setIntMsg("");
                      try{
                        const r=await fetch("/api/admin/clients",{method:"PATCH",headers:{"Content-Type":"application/json"},body:JSON.stringify({jobId:jid,liveUrl:url})});
                        if(!r.ok)throw new Error("Failed");
                        setIntMsg("✓ URL updated in database");
                        toast("URL saved","ok");
                      }catch(e){setIntMsg((e as Error).message);toast("Failed","err");}
                      setIntSaving(false);
                    }} style={{background:T.purple,color:"#fff",border:"none",borderRadius:8,padding:"8px 16px",fontSize:12,fontWeight:600,cursor:"pointer",flexShrink:0}}>
                      Save URL
                    </button>
                  </div>
                </div>

                {c.metadata?.domainStatus&&<div style={{fontSize:12,color:c.metadata.domainStatus==="Active"?T.green:T.amber,marginTop:10,display:"flex",alignItems:"center",gap:6}}><span>{c.metadata.domainStatus==="Active"?"✓":"⏳"}</span> Status: <strong>{c.metadata.domainStatus}</strong></div>}
                {intMsg&&<div style={{fontSize:12,color:intMsg.startsWith("✓")?T.green:T.red,marginTop:10,padding:"8px 12px",background:intMsg.startsWith("✓")?T.green+"10":T.red+"10",borderRadius:7,border:`1px solid ${intMsg.startsWith("✓")?T.green:T.red}30`}}>{intMsg}</div>}
              </div>

            </div>
          )}

          {/* CONTENT MANAGEMENT */}
          {tab==="content"&&(
            <div style={{display:"flex",flexDirection:"column" as const,gap:0,height:"100%"}}>
              {/* Sub-tab bar */}
              {(()=>{
                const cFeatures = ui.features||[];
                const contentGates: Record<string,{icon:string;label:string;feature:string|null;featureLabel:string|null}> = {
                  blog:       {icon:"📰",label:"Blog Posts",      feature:"Blog",              featureLabel:"Blog & Content"},
                  newsletter: {icon:"✉️",label:"Newsletters",     feature:"Newsletter Signup", featureLabel:"Growth & Marketing"},
                  deal:       {icon:"🏷️",label:"Deals & Promos",  feature:null,                featureLabel:null},
                  product:    {icon:"🛍️",label:"Products",        feature:"Payments / Shop",   featureLabel:"Online Shop"},
                  review:     {icon:"⭐",label:"Reviews",         feature:null,                featureLabel:null},
                };
                return (
              <div style={{display:"flex",gap:4,marginBottom:20,flexWrap:"wrap" as const}}>
                {(["blog","newsletter","deal","product","review"] as const).map(st=>{
                  const g = contentGates[st];
                  const locked = g.feature ? !cFeatures.includes(g.feature) : false;
                  const pendingCount = contentItems.filter(i=>i.type===st&&i.requestedByClient&&i.status==="draft").length;
                  return (
                  <button key={st} onClick={()=>{setContentSubTab(st);setContentForm(null);setContentMsg("");}}
                    style={{padding:"7px 14px",fontSize:12,fontWeight:contentSubTab===st?600:400,
                      color:locked?T.textMuted:contentSubTab===st?T.text:T.textMuted,
                      background:contentSubTab===st?T.raised:"transparent",
                      border:contentSubTab===st?`1px solid ${T.border}`:"1px solid transparent",
                      borderRadius:7,cursor:"pointer",transition:"all 0.15s",whiteSpace:"nowrap" as const,
                      opacity:locked?0.5:1,position:"relative" as const}}>
                    {locked?"🔒":g.icon} {g.label}
                    {pendingCount>0&&!locked&&(
                      <span style={{marginLeft:6,background:T.amber,color:"#000",borderRadius:10,padding:"1px 6px",fontSize:10,fontWeight:700}}>
                        {pendingCount}
                      </span>
                    )}
                  </button>
                  );
                })}
                <button onClick={loadContent} style={{marginLeft:"auto",padding:"7px 12px",fontSize:11,color:T.textMuted,background:"transparent",border:`1px solid ${T.border}`,borderRadius:7,cursor:"pointer"}}>&#x21BB;</button>
              </div>
                );
              })()}

              {/* Locked state */}
              {(()=>{
                const cFeatures = ui.features||[];
                const lockedMap: Record<string,{feature:string;featureLabel:string}|null> = {
                  blog:       {feature:"Blog",             featureLabel:"Blog & Content"},
                  newsletter: {feature:"Newsletter Signup",featureLabel:"Growth & Marketing"},
                  deal:       null,
                  product:    {feature:"Payments / Shop",  featureLabel:"Online Shop"},
                  review:     null,
                };
                const gate = lockedMap[contentSubTab];
                const isLocked = gate ? !cFeatures.includes(gate.feature) : false;
                if (!isLocked) return null;
                return (
                  <div style={{textAlign:"center" as const,padding:"52px 24px",background:T.surface,borderRadius:14,border:`1px dashed ${T.border}`}}>
                    <div style={{fontSize:36,marginBottom:12}}>🔒</div>
                    <div style={{fontSize:15,fontWeight:700,color:T.text,marginBottom:8}}>{contentSubTab.charAt(0).toUpperCase()+contentSubTab.slice(1)} not included</div>
                    <div style={{fontSize:13,color:T.textMuted,marginBottom:4}}>This client did not select <strong style={{color:T.textSec}}>{gate!.featureLabel}</strong> in their intake form.</div>
                    <div style={{fontSize:12,color:T.textMuted}}>To unlock, the client needs to upgrade their package. Use the Requests tab to manage feature add-ons.</div>
                  </div>
                );
              })()}

              {/* Newsletter unsubscribe compliance notice */}
              {contentSubTab==="newsletter"&&(ui.features||[]).includes("Newsletter Signup")&&(
                <div style={{background:T.amber+"12",border:`1px solid ${T.amber}30`,borderRadius:10,padding:"12px 16px",marginBottom:16,display:"flex",gap:12,alignItems:"flex-start"}}>
                  <span style={{fontSize:18,flexShrink:0}}>{"\u2696\ufe0f"}</span>
                  <div>
                    <div style={{fontSize:12,fontWeight:700,color:T.amber,marginBottom:4}}>Spam Act 2003 — Legal Requirement</div>
                    <div style={{fontSize:12,color:T.textMuted,lineHeight:1.7}}>
                      Every newsletter sent must include: <strong style={{color:T.textSec}}>sender name ({c.businessName})</strong>, <strong style={{color:T.textSec}}>business address ({(ui.businessAddress)||"(add in checklist)"})</strong>, and a working <strong style={{color:T.textSec}}>unsubscribe link</strong>. Failure to include these is a breach of Australian law and can result in fines up to $2.2M.
                    </div>
                    <div style={{fontSize:11,color:T.amber,marginTop:6,fontWeight:600}}>→ Always paste an unsubscribe link into the newsletter body before sending. e.g. "Unsubscribe: [link]"</div>
                  </div>
                </div>
              )}

              {contentLoading&&<div style={{color:T.textMuted,fontSize:13}}>Loading&hellip;</div>}

              {/* Content form / editor — only when not locked */}
              {contentForm!==null&&!(()=>{const cF=ui.features||[];const lm:Record<string,string|null>={blog:"Blog",newsletter:"Newsletter Signup",deal:null,product:"Payments / Shop",review:null};const f=lm[contentSubTab];return f?!cF.includes(f):false;})()&&(
                <div style={{background:T.surface,border:`1px solid ${T.border}`,borderRadius:12,padding:"20px",marginBottom:20}}>
                  <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:16}}>
                    <div style={{fontSize:13,fontWeight:700,color:T.text}}>{contentForm.id?"Edit":"New"} {contentSubTab.charAt(0).toUpperCase()+contentSubTab.slice(1)}</div>
                    <button onClick={()=>{setContentForm(null);setContentMsg("");}} style={{background:"transparent",border:"none",color:T.textMuted,fontSize:18,cursor:"pointer"}}>&#x2715;</button>
                  </div>

                  {/* AI generation strip */}
                  <div style={{background:T.raised,border:`1px solid ${T.border}`,borderRadius:9,padding:"12px 14px",marginBottom:16}}>
                    <div style={{fontSize:11,fontWeight:600,color:T.purple,marginBottom:8,letterSpacing:"0.06em",textTransform:"uppercase" as const}}>&#x2728; AI Generate</div>
                    <div style={{display:"flex",gap:8}}>
                      <input value={genPrompt} onChange={e=>setGenPrompt(e.target.value)}
                        placeholder="Brief for AI generation (e.g. tips for choosing a tradie)..."
                        style={{flex:1,background:T.surface,border:`1px solid ${T.border}`,borderRadius:7,padding:"8px 12px",color:T.text,fontSize:12,outline:"none"}}/>
                      <button disabled={genLoading} onClick={()=>generateContent(contentSubTab,genPrompt)}
                        style={{background:T.purple,color:"#fff",border:"none",borderRadius:7,padding:"8px 16px",fontSize:12,fontWeight:600,cursor:"pointer",opacity:genLoading?0.6:1,whiteSpace:"nowrap" as const}}>
                        {genLoading?"Generating...":"Generate"}
                      </button>
                    </div>
                  </div>

                  {/* Common fields */}
                  <div style={{display:"flex",flexDirection:"column" as const,gap:12}}>
                    <div>
                      <label style={{fontSize:11,color:T.textMuted,fontWeight:600,display:"block",marginBottom:5}}>Title *</label>
                      <input value={contentForm.title||""} onChange={e=>setContentForm((p:any)=>({...p,title:e.target.value}))}
                        style={{width:"100%",boxSizing:"border-box" as const,background:T.bg,border:`1px solid ${T.border}`,borderRadius:7,padding:"9px 12px",color:T.text,fontSize:13,outline:"none"}}/>
                    </div>

                    {contentSubTab==="newsletter"&&(
                      <div>
                        <label style={{fontSize:11,color:T.textMuted,fontWeight:600,display:"block",marginBottom:5}}>Email Subject Line</label>
                        <input value={contentForm.subject||""} onChange={e=>setContentForm((p:any)=>({...p,subject:e.target.value}))}
                          style={{width:"100%",boxSizing:"border-box" as const,background:T.bg,border:`1px solid ${T.border}`,borderRadius:7,padding:"9px 12px",color:T.text,fontSize:13,outline:"none"}}/>
                      </div>
                    )}

                    {contentSubTab==="deal"&&(
                      <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:10}}>
                        <div>
                          <label style={{fontSize:11,color:T.textMuted,fontWeight:600,display:"block",marginBottom:5}}>Discount</label>
                          <input value={contentForm.discount||""} onChange={e=>setContentForm((p:any)=>({...p,discount:e.target.value}))} placeholder="e.g. 20% off"
                            style={{width:"100%",boxSizing:"border-box" as const,background:T.bg,border:`1px solid ${T.border}`,borderRadius:7,padding:"9px 12px",color:T.text,fontSize:13,outline:"none"}}/>
                        </div>
                        <div>
                          <label style={{fontSize:11,color:T.textMuted,fontWeight:600,display:"block",marginBottom:5}}>Promo Code</label>
                          <input value={contentForm.promoCode||""} onChange={e=>setContentForm((p:any)=>({...p,promoCode:e.target.value}))} placeholder="SAVE20"
                            style={{width:"100%",boxSizing:"border-box" as const,background:T.bg,border:`1px solid ${T.border}`,borderRadius:7,padding:"9px 12px",color:T.text,fontSize:13,outline:"none",fontFamily:"monospace"}}/>
                        </div>
                        <div>
                          <label style={{fontSize:11,color:T.textMuted,fontWeight:600,display:"block",marginBottom:5}}>Valid Until</label>
                          <input type="date" value={contentForm.validUntil||""} onChange={e=>setContentForm((p:any)=>({...p,validUntil:e.target.value}))}
                            style={{width:"100%",boxSizing:"border-box" as const,background:T.bg,border:`1px solid ${T.border}`,borderRadius:7,padding:"9px 12px",color:T.text,fontSize:13,outline:"none"}}/>
                        </div>
                      </div>
                    )}

                    {contentSubTab==="product"&&(
                      <div style={{display:"grid",gridTemplateColumns:"1fr 1fr 1fr",gap:10}}>
                        <div>
                          <label style={{fontSize:11,color:T.textMuted,fontWeight:600,display:"block",marginBottom:5}}>Price (AUD)</label>
                          <input type="number" value={contentForm.price||""} onChange={e=>setContentForm((p:any)=>({...p,price:parseFloat(e.target.value)}))} placeholder="0.00"
                            style={{width:"100%",boxSizing:"border-box" as const,background:T.bg,border:`1px solid ${T.border}`,borderRadius:7,padding:"9px 12px",color:T.text,fontSize:13,outline:"none"}}/>
                        </div>
                        <div>
                          <label style={{fontSize:11,color:T.textMuted,fontWeight:600,display:"block",marginBottom:5}}>SKU</label>
                          <input value={contentForm.sku||""} onChange={e=>setContentForm((p:any)=>({...p,sku:e.target.value}))} placeholder="SKU-001"
                            style={{width:"100%",boxSizing:"border-box" as const,background:T.bg,border:`1px solid ${T.border}`,borderRadius:7,padding:"9px 12px",color:T.text,fontSize:13,outline:"none",fontFamily:"monospace"}}/>
                        </div>
                        <div>
                          <label style={{fontSize:11,color:T.textMuted,fontWeight:600,display:"block",marginBottom:5}}>Stock</label>
                          <input type="number" value={contentForm.stockCount||""} onChange={e=>setContentForm((p:any)=>({...p,stockCount:parseInt(e.target.value)}))} placeholder="unlimited"
                            style={{width:"100%",boxSizing:"border-box" as const,background:T.bg,border:`1px solid ${T.border}`,borderRadius:7,padding:"9px 12px",color:T.text,fontSize:13,outline:"none"}}/>
                        </div>
                      </div>
                    )}

                    {contentSubTab==="review"&&(
                      <div style={{display:"grid",gridTemplateColumns:"1fr 1fr 1fr",gap:10}}>
                        <div>
                          <label style={{fontSize:11,color:T.textMuted,fontWeight:600,display:"block",marginBottom:5}}>Customer Name</label>
                          <input value={contentForm.authorName||""} onChange={e=>setContentForm((p:any)=>({...p,authorName:e.target.value}))}
                            style={{width:"100%",boxSizing:"border-box" as const,background:T.bg,border:`1px solid ${T.border}`,borderRadius:7,padding:"9px 12px",color:T.text,fontSize:13,outline:"none"}}/>
                        </div>
                        <div>
                          <label style={{fontSize:11,color:T.textMuted,fontWeight:600,display:"block",marginBottom:5}}>Rating (1-5)</label>
                          <input type="number" min={1} max={5} value={contentForm.rating||""} onChange={e=>setContentForm((p:any)=>({...p,rating:parseInt(e.target.value)}))}
                            style={{width:"100%",boxSizing:"border-box" as const,background:T.bg,border:`1px solid ${T.border}`,borderRadius:7,padding:"9px 12px",color:T.text,fontSize:13,outline:"none"}}/>
                        </div>
                        <div>
                          <label style={{fontSize:11,color:T.textMuted,fontWeight:600,display:"block",marginBottom:5}}>Platform</label>
                          <select value={contentForm.platform||"manual"} onChange={e=>setContentForm((p:any)=>({...p,platform:e.target.value}))}
                            style={{width:"100%",boxSizing:"border-box" as const,background:T.bg,border:`1px solid ${T.border}`,borderRadius:7,padding:"9px 12px",color:T.text,fontSize:13,outline:"none"}}>
                            <option value="manual">Manual</option>
                            <option value="google">Google</option>
                            <option value="facebook">Facebook</option>
                          </select>
                        </div>
                      </div>
                    )}

                    {contentSubTab==="blog"&&(
                      <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:10}}>
                        <div>
                          <label style={{fontSize:11,color:T.textMuted,fontWeight:600,display:"block",marginBottom:5}}>URL Slug</label>
                          <input value={contentForm.slug||""} onChange={e=>setContentForm((p:any)=>({...p,slug:e.target.value}))} placeholder="my-blog-post"
                            style={{width:"100%",boxSizing:"border-box" as const,background:T.bg,border:`1px solid ${T.border}`,borderRadius:7,padding:"9px 12px",color:T.text,fontSize:13,outline:"none",fontFamily:"monospace"}}/>
                        </div>
                        <div>
                          <label style={{fontSize:11,color:T.textMuted,fontWeight:600,display:"block",marginBottom:5}}>Tags (comma-separated)</label>
                          <input value={(contentForm.tags||[]).join(",")} onChange={e=>setContentForm((p:any)=>({...p,tags:e.target.value.split(",").map((t:string)=>t.trim()).filter(Boolean)}))}
                            style={{width:"100%",boxSizing:"border-box" as const,background:T.bg,border:`1px solid ${T.border}`,borderRadius:7,padding:"9px 12px",color:T.text,fontSize:13,outline:"none"}}/>
                        </div>
                        <div style={{gridColumn:"1/-1"}}>
                          <label style={{fontSize:11,color:T.textMuted,fontWeight:600,display:"block",marginBottom:5}}>Meta Description (SEO)</label>
                          <input value={contentForm.metaDescription||""} onChange={e=>setContentForm((p:any)=>({...p,metaDescription:e.target.value}))} maxLength={160} placeholder="150-160 char SEO description"
                            style={{width:"100%",boxSizing:"border-box" as const,background:T.bg,border:`1px solid ${T.border}`,borderRadius:7,padding:"9px 12px",color:T.text,fontSize:13,outline:"none"}}/>
                        </div>
                      </div>
                    )}

                    <div>
                      <label style={{fontSize:11,color:T.textMuted,fontWeight:600,display:"block",marginBottom:5}}>
                        {contentSubTab==="review"?"Response / Display Text":"Body / Content"}
                      </label>
                      <textarea value={contentForm.body||""} onChange={e=>setContentForm((p:any)=>({...p,body:e.target.value}))} rows={10}
                        placeholder="Content..."
                        style={{width:"100%",boxSizing:"border-box" as const,background:T.bg,border:`1px solid ${T.border}`,borderRadius:7,padding:"9px 12px",color:T.text,fontSize:12,outline:"none",resize:"vertical" as const,fontFamily:"monospace",lineHeight:1.6}}/>
                    </div>

                    {contentForm.clientNote&&(
                      <div style={{background:T.amber+"15",border:`1px solid ${T.amber}30`,borderRadius:8,padding:"10px 14px"}}>
                        <div style={{fontSize:11,color:T.amber,fontWeight:600,marginBottom:4}}>Client Note</div>
                        <div style={{fontSize:12,color:T.textSec,lineHeight:1.6}}>{contentForm.clientNote}</div>
                      </div>
                    )}

                    <div style={{display:"flex",gap:10,alignItems:"center"}}>
                      <div style={{flex:1}}>
                        <label style={{fontSize:11,color:T.textMuted,fontWeight:600,display:"block",marginBottom:5}}>Status</label>
                        <select value={contentForm.status||"draft"} onChange={e=>setContentForm((p:any)=>({...p,status:e.target.value}))}
                          style={{background:T.bg,border:`1px solid ${T.border}`,borderRadius:7,padding:"8px 12px",color:T.text,fontSize:12,outline:"none"}}>
                          <option value="draft">Draft</option>
                          <option value="scheduled">Scheduled</option>
                          <option value="live">Live</option>
                          <option value="archived">Archived</option>
                        </select>
                      </div>
                      <button disabled={contentSaving||!contentForm.title} onClick={()=>saveContent({...contentForm,type:contentSubTab})}
                        style={{background:T.green,color:"#000",border:"none",borderRadius:8,padding:"10px 24px",fontSize:13,fontWeight:700,cursor:"pointer",opacity:(contentSaving||!contentForm.title)?.5:1}}>
                        {contentSaving?"Saving...":"Save Item"}
                      </button>
                    </div>
                    {contentMsg&&<div style={{fontSize:12,color:contentMsg.startsWith("✓")?T.green:T.red,padding:"8px 12px",background:contentMsg.startsWith("✓")?T.green+"10":T.red+"10",borderRadius:7,border:`1px solid ${contentMsg.startsWith("✓")?T.green:T.red}25`}}>{contentMsg}</div>}
                  </div>
                </div>
              )}

              {/* List of content items — only when not locked */}
              {contentForm===null&&!(()=>{const cF=ui.features||[];const lm:Record<string,string|null>={blog:"Blog",newsletter:"Newsletter Signup",deal:null,product:"Payments / Shop",review:null};const f=lm[contentSubTab];return f?!cF.includes(f):false;})()&&(
                <div>
                  <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:14}}>
                    <div style={{fontSize:12,color:T.textMuted}}>
                      {contentItems.filter(i=>i.type===contentSubTab).length} item{contentItems.filter(i=>i.type===contentSubTab).length!==1?"s":""}
                    </div>
                    <button onClick={()=>{setContentForm({type:contentSubTab,title:"",body:"",status:"draft"});setContentMsg("");setGenPrompt("");}}
                      style={{background:T.blue,color:"#fff",border:"none",borderRadius:8,padding:"8px 18px",fontSize:12,fontWeight:600,cursor:"pointer"}}>
                      + New {contentSubTab.charAt(0).toUpperCase()+contentSubTab.slice(1)}
                    </button>
                  </div>

                  {contentItems.filter(i=>i.type===contentSubTab).length===0&&!contentLoading&&(
                    <div style={{textAlign:"center" as const,padding:"48px 0",color:T.textMuted}}>
                      <div style={{fontSize:32,marginBottom:12}}>
                        {contentSubTab==="blog"?"📰":contentSubTab==="newsletter"?"✉️":contentSubTab==="deal"?"🏷️":contentSubTab==="product"?"🛍️":"⭐"}
                      </div>
                      <div style={{fontSize:14,fontWeight:600,color:T.textSec,marginBottom:6}}>No {contentSubTab} content yet</div>
                      <div style={{fontSize:12,marginBottom:16}}>Create your first item or use AI to generate one.</div>
                      <button onClick={()=>{setContentForm({type:contentSubTab,title:"",body:"",status:"draft"});setGenPrompt("");}}
                        style={{background:T.blue,color:"#fff",border:"none",borderRadius:8,padding:"10px 20px",fontSize:12,fontWeight:600,cursor:"pointer"}}>
                        + Create {contentSubTab}
                      </button>
                    </div>
                  )}

                  <div style={{display:"flex",flexDirection:"column" as const,gap:10}}>
                    {contentItems.filter(i=>i.type===contentSubTab).map((item:any)=>{
                      const statusCol:Record<string,string>={draft:T.amber,scheduled:T.blue,live:T.green,archived:T.textMuted};
                      const sc = statusCol[item.status]||T.textMuted;
                      return (
                        <div key={item.id} style={{background:T.surface,border:`1px solid ${T.border}`,borderRadius:12,padding:"14px 16px",borderLeft:`3px solid ${sc}`,boxShadow:T.shadow}}>
                          <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",gap:10}}>
                            <div style={{flex:1,minWidth:0}}>
                              <div style={{display:"flex",alignItems:"center",gap:8,marginBottom:4,flexWrap:"wrap" as const}}>
                                <span style={{fontSize:13,fontWeight:600,color:T.text,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap" as const}}>{item.title}</span>
                                <span style={{fontSize:10,color:sc,background:sc+"15",border:`1px solid ${sc}30`,borderRadius:5,padding:"2px 8px",fontWeight:600,whiteSpace:"nowrap" as const,flexShrink:0}}>{item.status}</span>
                                {item.requestedByClient&&<span style={{fontSize:10,color:T.amber,background:T.amber+"15",border:`1px solid ${T.amber}30`,borderRadius:5,padding:"2px 8px",fontWeight:600,flexShrink:0}}>Client Request</span>}
                              </div>
                              {item.discount&&<div style={{fontSize:12,color:T.green,marginBottom:2}}>🏷️ {item.discount}{item.promoCode&&` · Code: ${item.promoCode}`}</div>}
                              {item.subject&&<div style={{fontSize:12,color:T.textSec,marginBottom:2}}>Subject: {item.subject}</div>}
                              {item.rating&&<div style={{fontSize:12,color:T.amber}}>{"★".repeat(item.rating)}{"☆".repeat(5-item.rating)} {item.authorName&&`— ${item.authorName}`}</div>}
                              {item.price&&<div style={{fontSize:12,color:T.green,marginBottom:2}}>AUD ${item.price}{item.sku&&` · SKU: ${item.sku}`}</div>}
                              {item.clientNote&&<div style={{fontSize:11,color:T.amber,marginTop:4,fontStyle:"italic"}}>"{item.clientNote}"</div>}
                              <div style={{fontSize:11,color:T.textMuted,marginTop:4}}>{new Date(item.createdAt).toLocaleDateString("en-AU",{day:"numeric",month:"short",year:"numeric"})}</div>
                            </div>
                            <div style={{display:"flex",gap:6,flexShrink:0}}>
                              <button onClick={()=>{setContentForm(item);setGenPrompt("");setContentMsg("");}}
                                style={{background:T.raised,border:`1px solid ${T.border}`,borderRadius:7,padding:"6px 14px",fontSize:11,color:T.text,cursor:"pointer",fontWeight:500}}>Edit</button>
                              <button onClick={()=>deleteContent(item.id)}
                                style={{background:"transparent",border:`1px solid ${T.red}40`,borderRadius:7,padding:"6px 10px",fontSize:11,color:T.red,cursor:"pointer"}}>✕</button>
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* PAYMENTS */}
          {tab==="payments"&&(
            <div style={{display:"flex",flexDirection:"column" as const,gap:16}}>
              {/* Status tiles */}
              <div style={{display:"grid",gridTemplateColumns:"repeat(3,1fr)",gap:10}}>
                {[
                  {label:"Deposit",value:c.paymentState?.depositPaid?"Paid":"Unpaid",color:c.paymentState?.depositPaid?T.green:T.red},
                  {label:"Final payment",value:c.paymentState?.finalPaid?"Paid":"Pending",color:c.paymentState?.finalPaid?T.green:T.amber},
                  {label:"Monthly",value:c.paymentState?.monthlyActive?"Active":"Inactive",color:c.paymentState?.monthlyActive?T.green:T.textMuted},
                ].map(s=>(
                  <div key={s.label} style={{background:T.surface,border:`1px solid ${T.border}`,borderRadius:10,padding:"16px",boxShadow:T.shadow}}>
                    <div style={{fontSize:18,fontWeight:700,color:s.color}}>{s.value}</div>
                    <div style={{fontSize:11,color:T.textMuted,marginTop:4,fontWeight:500}}>{s.label}</div>
                  </div>
                ))}
              </div>

              {/* Stripe unlock */}
              <ActionBtn label="Unlock final payment (Stripe)" color={T.amber} confirm="Unlock final payment? Client will be emailed to pay remaining balance." onConfirm={()=>api(`/api/payment/unlock?jobId=${jid}&secret=${sec}`)} toast={toast}/>

              {/* Cash / manual payment override */}
              <div style={{background:T.raised,border:`1px solid ${T.amber}40`,borderRadius:12,padding:"18px 20px"}}>
                <div style={{fontSize:12,fontWeight:700,color:T.amber,marginBottom:4}}>💵 Manual / Cash Payment Override</div>
                <div style={{fontSize:11,color:T.textMuted,marginBottom:14,lineHeight:1.6}}>
                  Mark payments as received without Stripe — for cash, bank transfer, or any offline payment. Logged with a note.
                </div>
                <CashPaymentPanel jobId={jid} paymentState={c.paymentState} toast={toast}/>
              </div>
            </div>
          )}

          {/* ACTIONS */}
          {tab==="actions"&&(
            <div style={{display:"flex",flexDirection:"column" as const,gap:12}}>
              {/* Pending Stitch — top of actions */}
              <a href="/admin/pending" target="_blank" rel="noopener noreferrer" style={{textDecoration:"none"}}>
                <div style={{background:"linear-gradient(135deg, rgba(74,158,255,0.12), rgba(74,158,255,0.06))",border:"1px solid rgba(74,158,255,0.35)",borderRadius:12,padding:"14px 18px",display:"flex",alignItems:"center",justifyContent:"space-between",cursor:"pointer"}}>
                  <div>
                    <div style={{fontSize:13,fontWeight:700,color:"#4a9eff",marginBottom:3}}>⏳ Pending Stitch Builds</div>
                    <div style={{fontSize:11,color:T.textMuted,lineHeight:1.5}}>Sites waiting for you to generate HTML in Stitch Studio and upload.</div>
                  </div>
                  <div style={{fontSize:18,color:"#4a9eff",marginLeft:12}}>↗</div>
                </div>
              </a>
              {/* Stitch Prompt — copy to paste into Stitch Studio */}
              {(c as any).metadata?.stitchPrompt && (
                <StitchPromptCard prompt={(c as any).metadata.stitchPrompt} toast={toast} />
              )}
              <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:10}}>
                {[
                  {title:"Release preview",color:T.green,desc:"Email the client their portal link to review the site.",label:"Release preview →",confirm:`Release preview to ${c.businessName}? This emails the client.`,fn:()=>api(`/api/unlock/release?jobId=${jid}&secret=${sec}`)},
                  {title:"Force redeploy",color:T.green,desc:"Deploy current stored HTML instantly — no fix pass, no rebuild. Use when preview shows old site.",label:"Force redeploy →",confirm:"Force-redeploy stored HTML to Vercel now?",fn:()=>api(`/api/admin/redeploy`,"POST",{jobId:jid})},
                  {title:"Fix live URL",color:T.cyan,desc:"Updates the saved URL to the stable alias (wg-xxx.vercel.app). Use when the admin shows an old unique deploy URL.",label:"Fix URL in DB →",confirm:"Update saved URL to stable Vercel alias?",fn:async()=>{const d=await api(`/api/admin/fix-url`,"POST",{jobId:jid});return {message:`URL fixed → ${d.stableUrl}`};}},
                  {title:"Fix site",color:T.blue,desc:"Run a code fix pass and redeploy. Takes 1–2 min.",label:"Fix this site",confirm:"Run a fix pass on this site?",fn:()=>api(`/api/admin/fix-proxy?jobId=${jid}&secret=${sec}`)},
                  {title:"Rebuild site",color:T.amber,desc:"Full rebuild from scratch — regenerates design. 5–10 min.",label:"Rebuild site",confirm:`Fully rebuild ${c.businessName} from scratch?`,fn:async()=>{await api(`/api/admin/reset-job`,"POST",{jobId:jid,action:"reset-and-rebuild",secret:sec});}},
                  {title:"Monthly report",color:T.cyan,desc:"Email this month's analytics to the client.",label:"Send report",confirm:"Send monthly analytics report?",fn:()=>api(`/api/analytics/monthly?jobId=${jid}&secret=${sec}&send=true`)},
                  {title:"Reset password",color:T.textSec,desc:"Generate a new portal login password.",label:"Reset password",confirm:"Generate a new password?",fn:async()=>{const d=await api(`/api/admin/reset-password?secret=${sec}`,"POST",{slug:c.slug});toast(`New password: ${d.password}`,"info");return d;}},
                  ...(c.metadata?.lastGoodAt?[{title:"Rollback to last good",color:T.purple,desc:`Restores snapshot from ${new Date(c.metadata.lastGoodAt).toLocaleDateString("en-AU")}.`,label:"Rollback",confirm:`Roll back ${c.businessName} to last good build?`,fn:()=>api(`/api/admin/reset-job`,"POST",{jobId:jid,action:"rollback",secret:sec})}]:[]),
                  ...(c.hasBooking?[{title:"Unlock booking",color:T.purple,desc:"Enable the booking system for this client.",label:"Unlock booking",confirm:`Enable booking for ${c.businessName}?`,fn:()=>api(`/api/unlock/booking?jobId=${jid}&secret=${sec}`)}]:[]),
                  ...(!((c as any).metadata?.serviceType==="social"||(c as any).metadata?.serviceType==="both")?[{title:"Unlock Social Media",color:T.purple,desc:"Grant this client access to the Social Media portal without requiring payment.",label:"📱 Unlock Social",confirm:`Unlock Social Media for ${c.businessName}?`,fn:async()=>{await api(`/api/admin/clients`,"PATCH",{jobId:jid,metadata:{...((c as any).metadata||{}),serviceType:"social"}});}}]:[]),
                ].map(action=>(
                  <div key={action.title} style={{background:T.raised,border:`1px solid ${T.border}`,borderRadius:12,padding:"16px 18px"}}>
                    <div style={{fontSize:12,fontWeight:700,color:action.color,marginBottom:4}}>{action.title}</div>
                    <div style={{fontSize:11,color:T.textMuted,marginBottom:12,lineHeight:1.5}}>{action.desc}</div>
                    <ActionBtn label={action.label} color={action.color} confirm={action.confirm} onConfirm={action.fn} toast={toast}/>
                  </div>
                ))}
              </div>
              <ClientHtmlUpload jobId={jid} toast={toast}/>
              <ClientCustomQuote
                jobId={jid}
                slug={c.slug}
                secret={secret}
                existingQuote={(c as any).metadata?.customQuote}
                toast={toast}
              />
              <ClientContentBrief
                jobId={jid}
                existing={{
                  additionalNotes: c.userInput?.additionalNotes,
                  usp: c.userInput?.usp,
                  goal: c.userInput?.goal,
                  businessDescription: (c as any).userInput?.businessDescription,
                }}
                toast={toast}
              />
              <div style={{background:T.red+"08",border:`1px solid ${T.red}20`,borderRadius:12,padding:"16px 18px"}}>
                <div style={{fontSize:12,fontWeight:700,color:T.red,marginBottom:4}}>Danger zone</div>
                <div style={{fontSize:11,color:T.textMuted,marginBottom:12}}>Permanently delete this client and all their data. Cannot be undone.</div>
                <ActionBtn label="Delete client" color={T.red} confirm={`PERMANENTLY delete ${c.businessName}? All data will be destroyed.`} onConfirm={async()=>{await api(`/api/admin/delete-client?jobId=${jid}&slug=${c.slug}&secret=${sec}`,"DELETE");window.location.reload();}} toast={toast}/>
              </div>
            </div>
          )}

          {/* FEATURE REQUESTS */}
          {tab==="requests"&&(
            <div>
              {frLoading&&<div style={{color:T.textMuted,fontSize:13,padding:"20px 0"}}>Loading…</div>}
              {!frLoading&&featureRequests.length===0&&(
                <div style={{textAlign:"center" as const,padding:"48px 0",color:T.textMuted}}>
                  <div style={{fontSize:28,marginBottom:12}}>📬</div>
                  <div style={{fontSize:14,fontWeight:600,color:T.textSec,marginBottom:6}}>No feature requests yet</div>
                  <div style={{fontSize:12}}>Clients can request features from their portal.</div>
                </div>
              )}
              {!frLoading&&featureRequests.length>0&&(
                <div style={{display:"flex",flexDirection:"column" as const,gap:10}}>
                  {featureRequests.map((req:any)=>{
                    const sc:Record<string,string>={pending:T.amber,processing:T.blue,draft:T.purple,approved:T.blue,live:T.green,rejected:T.red};
                    const c=sc[req.status]||T.textMuted;
                    const isUpd=frUpdating===req.id;
                    return (
                      <div key={req.id} style={{background:T.surface,border:`1px solid ${T.border}`,borderRadius:12,padding:"16px 18px",borderLeft:`3px solid ${c}`,boxShadow:T.shadow}}>
                        <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",marginBottom:8}}>
                          <div style={{display:"flex",alignItems:"center",gap:8}}>
                            <span style={{fontSize:13,fontWeight:600,color:T.text}}>{req.featureId}</span>
                            <Pill color={c}>{req.status}</Pill>
                            {req.quotedFee&&<Pill color={T.amber}>💰 ${req.quotedFee} quoted</Pill>}
                          </div>
                          <div style={{fontSize:11,color:T.textMuted}}>{new Date(req.createdAt).toLocaleDateString("en-AU")}</div>
                        </div>
                        {req.message&&<div style={{fontSize:12,color:T.textSec,marginBottom:10,lineHeight:1.6,fontStyle:"italic"}}>"{req.message}"</div>}
                        {req.draftUrl&&<a href={req.draftUrl} target="_blank" rel="noreferrer" style={{...btn(T.blue),display:"inline-flex",alignItems:"center",marginBottom:10,fontSize:11}}>View draft →</a>}
                        {(req.status==="pending"||req.status==="processing")&&(
                          <div style={{display:"flex",gap:8,alignItems:"center",marginBottom:10}}>
                            <span style={{fontSize:11,color:T.textMuted,flexShrink:0}}>Quote fee (AUD):</span>
                            <input type="number" min="0" placeholder="e.g. 250"
                              value={feeInputs[req.id]??(req.quotedFee??"")}
                              onChange={e=>setFeeInputs(p=>({...p,[req.id]:e.target.value}))}
                              style={{width:90,background:T.raised,border:`1px solid ${T.border}`,borderRadius:6,padding:"5px 10px",color:T.text,fontSize:12,outline:"none"}}/>
                            <button disabled={isUpd||!feeInputs[req.id]} onClick={()=>updateRequestStatus(req.id,req.status,undefined,parseFloat(feeInputs[req.id]||"0"))}
                              style={{background:T.amber,color:"#000",border:"none",borderRadius:6,padding:"5px 12px",fontSize:11,fontWeight:600,cursor:"pointer",opacity:(!feeInputs[req.id]||isUpd)?.5:1}}>
                              Send fee
                            </button>
                          </div>
                        )}
                        <div style={{display:"flex",gap:6,flexWrap:"wrap" as const}}>
                          {req.status==="pending"&&<button disabled={isUpd} onClick={()=>updateRequestStatus(req.id,"approved",undefined,req.quotedFee)} style={{background:T.green,color:"#000",border:"none",borderRadius:7,padding:"6px 14px",fontSize:11,fontWeight:600,cursor:"pointer",opacity:isUpd?.5:1}}>{isUpd?"…":"Approve & build"}</button>}
                          {req.status==="draft"&&<button disabled={isUpd} onClick={()=>updateRequestStatus(req.id,"live")} style={{background:T.green,color:"#000",border:"none",borderRadius:7,padding:"6px 14px",fontSize:11,fontWeight:600,cursor:"pointer",opacity:isUpd?.5:1}}>{isUpd?"…":"Push live"}</button>}
                          {(req.status==="pending"||req.status==="draft"||req.status==="processing")&&<button disabled={isUpd} onClick={()=>updateRequestStatus(req.id,"rejected")} style={{background:"transparent",color:T.red,border:`1px solid ${T.red}50`,borderRadius:7,padding:"6px 14px",fontSize:11,cursor:"pointer",opacity:isUpd?.5:1}}>Reject</button>}
                          {req.status==="approved"&&<div style={{fontSize:11,color:T.blue}}>⏳ Building…</div>}
                          {req.status==="live"&&<div style={{fontSize:11,color:T.green}}>✓ Live</div>}
                          {req.status==="rejected"&&<div style={{fontSize:11,color:T.red}}>✗ Rejected</div>}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
              <button onClick={loadFeatureRequests} style={{...btn(T.textMuted),marginTop:16,fontSize:11}}>↻ Refresh</button>
            </div>
          )}

          {/* CHECKLIST */}
          {tab==="checklist"&&(()=>{
            const features = ui.features||[];
            const hasShop = features.includes("Payments / Shop");
            const hasBooking = features.includes("Booking System");
            const hasNewsletter = features.includes("Newsletter Signup");
            const hasChat = features.includes("Live Chat");
            const hasGA4 = !!(c.ga4Id);
            const hasFacebook = !!(ui.facebookPage);
            const hasInstagram = !!(ui.instagramUrl);
            const domain = c.domain||c.userInput?.abn||"";
            const abn = c.userInput?.abn||"";
            const email = c.clientEmail||"";
            const biz = c.businessName;
            const addr = c.userInput?.businessAddress||"";
            const siteUrl = c.liveUrl||c.previewUrl||"";

            // Pre-fill Termly URLs
            const termlyPrivacyUrl = `https://app.termly.io/dashboard/website/add-website`;
            const _termlyTosUrl = `https://app.termly.io/dashboard/website/add-website`; // unused — Terms moved to freeprivacypolicy.com

            type CheckItem = { key:string; label:string; detail:string; link?:string; linkLabel?:string; linkInput?:{placeholder:string;label:string}; required?:boolean };
            type Section = { title:string; color:string; icon:string; items:CheckItem[]; postLaunch?:boolean };

            // Dynamic section numbering
            let secNum = 0;
            const n = () => ++secNum;

            const sections: Section[] = [

              {
                title:`${n()}. Privacy Policy`,
                color:T.blue,
                icon:"🔒",
                items:[
                  { key:"termly_account", label:"Sign up to Termly (free, one-time)", detail:"1. Click the link below\n2. Sign up with your WebGecko email\n3. Done — you only ever need one account", link:"https://app.termly.io/authentication/sign-up", linkLabel:"Sign up to Termly →", required:true },
                  { key:"termly_add_site", label:`Add ${biz} as a website in Termly`, detail:`1. Click the link below\n2. Website name: ${biz}\n3. Website URL: ${siteUrl||"(client domain)"}\n4. Country: Australia\n5. Industry: ${c.industry||"(pick closest)"}\n6. Click Save`, link:"https://app.termly.io/dashboard/website/add-website", linkLabel:"Add website in Termly →", required:true },
                  { key:"termly_privacy_wizard", label:"Generate the Privacy Policy", detail:`In Termly, click Generate Policy. Answer:\n• Collect names/emails? YES\n• Analytics? ${hasGA4?"YES":"NO"}\n• Payments? ${hasShop?"YES":"NO"}\n• Cookies? YES\n• Country: Australia\n• Email: ${email||"(client email)"}\n• Address: ${addr||"(client address)"}`, required:true },
                  { key:"termly_privacy_embed", label:"Paste the Privacy Policy URL here", detail:`1. In Termly, click Embed on your policy\n2. Copy the Hosted Policy URL\n3. Paste it below`, required:true, linkInput:{ label:"Termly Privacy Policy URL", placeholder:"https://app.termly.io/document/privacy-policy/xxxx" } },
                  { key:"termly_cookie_banner", label:"Turn on the Cookie Banner in Termly", detail:"1. In Termly go to Cookie Consent\n2. Click Cookie Banner\n3. Toggle ON\n\nDone. The banner auto-appears on the site.", required:true },
                ],
              },

              {
                title:`${n()}. Terms of Service`,
                color:T.purple,
                icon:"📄",
                items:[
                  { key:"tos_generate", label:"Generate Terms of Service (free, no account)", detail:`1. Click the link below\n2. Fill in:\n   • Company: ${biz}\n   • URL: ${siteUrl||"(client domain)"}\n   • Country: Australia\n   • ABN: ${abn||"(client ABN)"}\n   • Email: ${email||"(client email)"}\n3. Select: Contact forms YES${hasBooking?" · Bookings YES":""}${hasShop?" · Payments YES":""}\n4. Click Generate`, link:"https://www.freeprivacypolicy.com/free-terms-and-conditions-generator/", linkLabel:"Generate Terms →", required:true },
                  { key:"tos_embed", label:"Paste the Terms URL here", detail:"1. After generating, copy the hosted URL\n2. Paste it below", required:true, linkInput:{ label:"Terms of Service URL", placeholder:"https://www.freeprivacypolicy.com/live/xxxx" } },
                ],
              },

              {
                title:`${n()}. Legal Checks`,
                color:T.amber,
                icon:"⚖️",
                items:[
                  { key:"legal_abn", label:`ABN ${abn||"(not provided)"} visible in footer`, detail:`Open the live site. Scroll to the footer. You should see "ABN ${abn||"(ask client)"}" in the copyright line. The pipeline injects this automatically.`, required:true },
                  { key:"legal_ssl", label:"Site loads on https:// with padlock", detail:"Open the live site URL. Check the browser address bar shows a padlock icon and https://. If missing, go to Vercel → Domains and check SSL status.", required:true },
                  { key:"legal_copyright", label:"Copyright line in footer", detail:`Footer should show: © ${new Date().getFullYear()} ${biz}. All rights reserved.`, required:true },
                  ...(hasNewsletter||hasChat ? [{ key:"legal_spam", label:"Every newsletter has unsubscribe link", detail:`Australian law requires every marketing email to include:\n• Sender name: ${biz}\n• Unsubscribe link (Beehiiv adds this automatically)\n• Business address: ${addr||"(add in checklist)"}` }] : []),
                ],
              },

              {
                title:`${n()}. Domain & Hosting`,
                color:T.cyan,
                icon:"🌐",
                items:[
                  { key:"domain_check", label:`Client domain: ${domain||"(not provided — ask client)"}`, detail:`Client requested: ${domain||"(not provided)"}\n\nIf they already own it: get their registrar login (GoDaddy, Crazy Domains, VentraIP) and skip to DNS step.\nIf they need one: register it on VentraIP.`, required:true },
                  { key:"domain_register", label:"Register the domain on VentraIP (~$20/yr)", detail:`1. Click the link below\n2. Search for: ${domain||"(client domain)"}\n3. At checkout:\n   • ABN: ${abn||"(required for .com.au)"}\n   • Name: ${biz}\n   • Email: ${email}\n   • Address: ${addr||"(client address)"}`, link:"https://ventraip.com.au", linkLabel:"Open VentraIP →" },
                  { key:"domain_dns", label:"Point DNS to Vercel (2 records)", detail:"In the domain registrar DNS settings:\n\n1. Add A record:\n   Name: @\n   Value: 76.76.21.21\n\n2. Add CNAME record:\n   Name: www\n   Value: cname.vercel-dns.com\n\nSave. Takes 5-60 min to go live.", required:true },
                  { key:"domain_vercel", label:"Add domain in Vercel", detail:"1. Go to vercel.com → your project → Settings → Domains\n2. Click Add\n3. Type the client domain\n4. Click Add\n5. Wait for green tick (SSL auto-issues)\n\nThen come back here → Integrations tab → update the Live URL field.", required:true },
                  { key:"domain_gsc", label:"Add site to Google Search Console", detail:`1. Go to the link below\n2. Click Add Property → URL prefix\n3. Enter: ${siteUrl||"https://clientdomain.com.au"}\n4. Verify via HTML tag (add to site head, then rebuild)\n5. Submit sitemap: ${siteUrl||"https://clientdomain.com.au"}/sitemap.xml\n\nNote: Add the WebGecko service account email as Owner to enable auto-indexing.`, link:"https://search.google.com/search-console", linkLabel:"Open Search Console →" },
                ],
              },

              {
                title:`${n()}. Newsletter — Beehiiv`,
                color:T.cyan,
                icon:"✉️",
                items: hasNewsletter ? [
                  { key:"beehiiv_account", label:"Log in to Beehiiv (one account for all clients)", detail:"Go to beehiiv.com and log in with your WebGecko account. One account handles all clients — you add each client as a separate publication inside it.", link:"https://app.beehiiv.com", linkLabel:"Open Beehiiv →", required:true },
                  { key:"beehiiv_publication", label:"Create a publication for this client", detail:`Inside Beehiiv:\n1. Click '+ New Publication' (bottom-left)\n2. Publication name: ${biz}\n3. Description: Newsletter for ${biz} customers\n4. Complete setup → you're now inside the publication`, required:true },
                  { key:"beehiiv_api_key", label:"Get the API key", detail:"Inside the client's publication:\n1. Click Settings (bottom-left)\n2. Click API tab\n3. Click 'New API Key' → name it 'WebGecko'\n4. Copy the key\n5. Go to Vercel → Settings → Environment Variables → update BEEHIIV_API_KEY", required:true },
                  { key:"beehiiv_pub_id", label:"Get the Publication ID", detail:"Inside the client's publication:\n1. Click Settings (bottom-left)\n2. Click Publication tab\n3. Copy the Publication ID (starts with pub_)\n4. Go to Vercel → Settings → Environment Variables → update BEEHIIV_PUBLICATION_ID", required:true },
                  { key:"beehiiv_redeploy", label:"Redeploy the site to wire up the new IDs", detail:"After updating both env vars in Vercel:\n1. Go to Vercel → Deployments\n2. Click ••• on the latest deployment → Redeploy\n3. Wait 2 min\n4. Test by submitting an email on the live site → should appear in Beehiiv Subscribers within 1 min" },
                  { key:"beehiiv_send", label:"How to send a newsletter", detail:`When ${biz} wants to send a newsletter:\n1. Log into beehiiv.com\n2. Click Newsletter in the left sidebar\n3. Click 'New Post'\n4. Write and design the email\n5. Click Send/Schedule\n\nEVERY email MUST include:\n• Sender name: ${biz}\n• Business address: ${addr||"(add in checklist)"}\n• Unsubscribe link (Beehiiv adds this automatically)\n\nThis is required by Australian Spam Act 2003.` },
                ] : [
                  { key:"beehiiv_na", label:"Newsletter not selected for this client", detail:"This client did not select the Newsletter Signup feature. No Beehiiv setup needed. If they want to add it later, rebuild with Newsletter Signup enabled." },
                ],
              },

              {
                title:`${n()}. Google Analytics (GA4)`,
                color:T.amber,
                icon:"📊",
                items: hasGA4 ? [
                  { key:"ga4_verify", label:"GA4 ID already added ✓", detail:`GA4 ID on file: ${c.ga4Id}\n\nVerify it's the correct format (starts with G-). It's already injected into the site during build.` },
                  { key:"ga4_test", label:"Test GA4 is firing on the live site", detail:"1. Open the live site in your browser\n2. Go to analytics.google.com → your property → Reports → Realtime\n3. You should appear as an active user within 30 seconds\n\nIf not firing: check the G- ID in the site HTML matches the GA4 property.", link:"https://analytics.google.com", linkLabel:"Open GA4 →" },
                ] : [
                  { key:"ga4_account", label:"Open Google Analytics (one account for all clients)", detail:"Go to analytics.google.com. Sign in with your WebGecko Google account. You only need ONE Google Analytics account — each client gets their own property inside it.\n\nIf first time: click 'Start measuring' → Account name: WebGecko → Next.", link:"https://analytics.google.com", linkLabel:"Open GA4 →", required:true },
                  { key:"ga4_property", label:"Create a property for this client", detail:`1. Click Admin (bottom-left gear icon)\n2. Click 'Create Property'\n3. Property name: ${biz}\n4. Reporting timezone: Australia/${addr.includes("VIC")?"Melbourne":addr.includes("WA")?"Perth":addr.includes("SA")?"Adelaide":addr.includes("QLD")?"Brisbane":"Sydney"}\n5. Currency: Australian Dollar (AUD)\n6. Click Next → fill in business details → Create`, required:true },
                  { key:"ga4_stream", label:"Add a data stream for the website", detail:`After creating the property:\n1. Click 'Data Streams' in the left sidebar\n2. Click 'Add Stream' → Web\n3. Website URL: ${siteUrl||"(client domain)"}\n4. Stream name: ${biz}\n5. Leave Enhanced Measurement ON\n6. Click 'Create stream'`, required:true },
                  { key:"ga4_id_add", label:"Copy Measurement ID → paste into Integrations tab", detail:"On the stream detail page:\n1. Copy the Measurement ID (format: G-XXXXXXXXXX)\n2. Go to the Integrations tab in this admin panel\n3. Paste into the GA4 Measurement ID field\n4. Click Save\n5. Then go to Actions tab → Rebuild Site to inject it", required:true, linkInput:{ label:"GA4 Measurement ID", placeholder:"G-XXXXXXXXXX" } },
                  { key:"ga4_test", label:"Test GA4 is firing after rebuild", detail:"1. Open the live site in your browser\n2. Go to GA4 → Reports → Realtime\n3. Should show 1 active user within 30 seconds\n\nIf not: confirm the G- ID in the Integrations tab matches the one in GA4.", link:"https://analytics.google.com", linkLabel:"Open GA4 →" },
                ],
              },

              ...(hasShop ? [{
                title:`${n()}. Stripe Shop Setup`,
                color:T.purple,
                icon:"&#x1F6CD;",
                items:[
                  { key:"stripe_account", label:"Client signs up for Stripe (free, ~5 min)", detail:"Client needs a free Stripe account at dashboard.stripe.com. They need their ABN, business address, and Australian bank BSB/account number. Verification is usually instant in AU.", link:"https://dashboard.stripe.com/register", linkLabel:"Stripe Sign Up", required:true },
                  { key:"stripe_connect", label:"Connect client Stripe via OAuth (Integrations tab)", detail:"In the Integrations tab, click Connect with Stripe. Client approves in 30 seconds. WebGecko automatically takes 2% of every sale.", required:true },
                  { key:"stripe_sync", label:"Sync products to Stripe (Integrations tab)", detail:"In the Integrations tab, click Sync Shop to Stripe. Creates a Stripe Product and Payment Link for each item from the intake form.", required:true },
                  { key:"stripe_test", label:"Test a transaction end-to-end", detail:"Place a test order and confirm payment completes, appears in client Stripe Dashboard, and WebGecko 2% fee shows as application fee. Test card: 4242 4242 4242 4242" },
                ] as CheckItem[],
              }] : []),

              ...(hasBooking ? [{
                title:`${n()}. Booking System (SuperSaas)`,
                color:T.purple,
                icon:"📅",
                items:[
                  { key:"supersaas_account", label:"Create SuperSaas account for client", detail:`Go to supersaas.com → Sign Up → Free plan (upgrade later if needed).\n\nUse the client's email: ${email}\nBusiness name: ${biz}\n\nCopy the account username — you'll need it for the booking URL.`, link:"https://supersaas.com", linkLabel:"Open SuperSaas →", required:true },
                  { key:"supersaas_schedule", label:"Set up the booking schedule", detail:`In SuperSaas, create a new schedule:\n• Name: ${biz} Bookings\n• Type: Resource (for appointments) or Service (for classes)\n• Services: ${ui.bookingServices||"(from client intake — add each service)"}\n• Duration: set per service\n• Availability: set client's working hours\n• Buffer time: 15 min between appointments (recommended)`, required:true },
                  { key:"supersaas_url", label:"Get the booking URL and add to site", detail:'In SuperSaas, go to the schedule → Share → copy the public booking URL (looks like supersaas.com/schedule/accountname/schedulename).\n\nPaste it into the Integrations tab in this panel. The site will embed it via iframe.', required:true },
                  { key:"supersaas_notifications", label:"Set up email notifications", detail:`In SuperSaas → Configure → Notifications:\n• New booking: email to ${email}\n• Confirmation to customer: YES\n• Reminder: 24 hours before appointment\n• Cancellation: notify both parties` },
                ] as CheckItem[],
              }] : []),

              {
                title:`${n()}. Pre-Launch Checks`,
                color:T.green,
                icon:"🚀",
                items:[
                  { key:"golive_preview", label:"Review the preview site end to end", detail:"Click every nav link, submit the contact form (check it sends to the client email), test on mobile by resizing browser. Check all images load, all text is correct, no placeholder content remains.", required:true },
                  { key:"golive_policies", label:"Confirm Privacy Policy and Terms pages work", detail:"Click the Privacy Policy and Terms of Service links in the footer. Both pages should load. If using Termly hosted URLs, confirm those links open the correct Termly documents.", required:true },
                  { key:"golive_speed", label:"Run a PageSpeed test", detail:"Go to pagespeed.web.dev, enter the preview URL. Aim for 80+ on mobile. Flag anything under 60 to fix before launch.", link:"https://pagespeed.web.dev", linkLabel:"Open PageSpeed →", required:true },
                  { key:"golive_search_console", label:"Add site to Google Search Console", detail:`Go to search.google.com/search-console → Add Property → URL prefix → enter ${siteUrl||"(client domain after launch)"}.

Verify ownership via HTML tag method — add the meta tag to the site <head>, then redeploy.

Once verified, submit the sitemap: ${siteUrl||"https://clientdomain.com.au"}/sitemap.xml`, link:"https://search.google.com/search-console", linkLabel:"Open Search Console →", required:true },
                ],
              },

              {
                title:`${n()}. Post-Launch`,
                color:"#a78bfa",
                icon:"🎉",
                postLaunch:true,
                items:[
                  { key:"golive_email_client", label:"Send go-live email to client", detail:`Email ${email} with:
• Link to their live site
• Login details for any platforms (Stripe, SuperSaas, GA4)
• Link to their Termly policies
• Instructions for updating content via the client portal
• Your support contact details` },
                  { key:"golive_handoff", label:"Mark job as complete in admin", detail:"Update payment status, confirm domain is live, tick off this checklist. Archive the job notes." },
                  { key:"post_monthly", label:"Confirm monthly subscription is active", detail:"Check that the client's ongoing monthly payment is set up in Stripe. Go to Payments tab → confirm Monthly Active is green." },
                  { key:"post_monitor", label:"Monitor site performance for first 7 days", detail:"Check GA4 daily for the first week. Look for any drop-offs or errors. Run a Lighthouse test on the live domain. Confirm Google Search Console has no crawl errors." },
                  { key:"post_review", label:"Request a Google review from the client", detail:"After handoff, send the client a friendly message asking them to leave a Google review for WebGecko. Happy clients at this point rarely say no." },
                ],
              },
            ];

            const totalItems = sections.flatMap(s=>s.items).length;
            const doneCount = sections.flatMap(s=>s.items).filter(i=>checklistDone[i.key]).length;
            const pct = Math.round((doneCount/totalItems)*100);

            // Pre-launch = all sections except "Go-Live Checklist" post-launch items
            // The Go-Live section itself is still pre-launch; after it's done = ready to ship
            const preLaunchSections = sections.filter(s=>!s.postLaunch);
            const preLaunchRequired = preLaunchSections.flatMap(s=>s.items).filter(i=>i.required);
            const allRequiredDone = preLaunchRequired.length>0 && preLaunchRequired.every(i=>!!checklistDone[i.key]);
            const alreadyReleased = !!c.metadata?.alreadyReleased;

            function markSectionComplete(section: Section){
              const completable = section.items.filter(i=>!(i.linkInput&&!checklistLinks[i.key]));
              const keys = completable.map(i=>i.key);
              const next={...checklistDone};
              keys.forEach(k=>{next[k]=true;});
              try{localStorage.setItem("wg_checklist_"+jid,JSON.stringify(next));}catch{}
              setChecklistDone(next);
            }

            return (
              <div>
                {/* Progress bar */}
                <div style={{marginBottom:24}}>
                  <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:8}}>
                    <div style={{fontSize:13,fontWeight:700,color:T.text}}>Client Setup Progress</div>
                    <div style={{fontSize:13,fontWeight:700,color:pct===100?T.green:T.amber}}>{doneCount}/{totalItems} done · {pct}%</div>
                  </div>
                  <div style={{height:6,background:T.raised,borderRadius:4,overflow:"hidden"}}>
                    <div style={{height:"100%",width:`${pct}%`,background:pct===100?T.green:T.blue,borderRadius:4,transition:"width 0.4s ease"}}/>
                  </div>
                  {pct===100&&<div style={{marginTop:8,fontSize:12,color:T.green,fontWeight:600}}>✓ All steps complete — ready to hand off!</div>}
                </div>

                {/* 🚀 Final Submit — Go Live CTA (appears only when all required pre-launch items done) */}
                {allRequiredDone&&!alreadyReleased&&(
                  <div style={{marginBottom:28,padding:"24px 28px",background:`linear-gradient(135deg,${T.green}18,${T.green}08)`,border:`2px solid ${T.green}`,borderRadius:16,textAlign:"center" as const}}>
                    <div style={{fontSize:24,marginBottom:8}}>🚀</div>
                    <div style={{fontSize:16,fontWeight:800,color:T.green,marginBottom:6}}>All pre-launch steps complete!</div>
                    <div style={{fontSize:13,color:T.textSec,marginBottom:20}}>Every required item is checked off. This site is ready to go live.</div>
                    <button
                      onClick={()=>{
                        if(!confirm(`Push ${c.businessName} live? This will release the site to the client and cannot be undone.`))return;
                        api(`/api/unlock/release?jobId=${jid}&secret=${sec}`)
                          .then(()=>toast("Site released to client! 🚀","ok"))
                          .catch((e:any)=>toast(e.message,"err"));
                      }}
                      style={{fontSize:16,fontWeight:800,color:"#000",background:T.green,border:"none",borderRadius:12,padding:"16px 48px",cursor:"pointer",letterSpacing:"0.02em",boxShadow:`0 4px 24px ${T.green}60`,transition:"transform 0.15s ease,box-shadow 0.15s ease"}}
                      onMouseEnter={e=>{(e.currentTarget as HTMLElement).style.transform="scale(1.03)";(e.currentTarget as HTMLElement).style.boxShadow=`0 6px 32px ${T.green}80`;}}
                      onMouseLeave={e=>{(e.currentTarget as HTMLElement).style.transform="scale(1)";(e.currentTarget as HTMLElement).style.boxShadow=`0 4px 24px ${T.green}60`;}}
                    >
                      Final Submit — Push Website Live
                    </button>
                  </div>
                )}
                {alreadyReleased&&(
                  <div style={{marginBottom:24,padding:"14px 20px",background:`${T.green}10`,border:`1px solid ${T.green}40`,borderRadius:12,display:"flex",alignItems:"center",gap:12}}>
                    <span style={{fontSize:20}}>✅</span>
                    <div>
                      <div style={{fontSize:13,fontWeight:700,color:T.green}}>Site is live</div>
                      <div style={{fontSize:12,color:T.textMuted}}>This site has already been released to the client.</div>
                    </div>
                  </div>
                )}

                {sections.map((section,si)=>{
                  const sectionDoneCount = section.items.filter(i=>!!checklistDone[i.key]).length;
                  const sectionAllDone = sectionDoneCount===section.items.length;
                  const sectionCompletable = section.items.filter(i=>!(i.linkInput&&!checklistLinks[i.key]));
                  const sectionCanMarkAll = sectionCompletable.length>0 && sectionCompletable.some(i=>!checklistDone[i.key]);
                  const isFirstPostLaunch = section.postLaunch && (si===0||!sections[si-1].postLaunch);
                  return (
                  <div key={section.title}>
                  {isFirstPostLaunch&&(
                    <div style={{marginBottom:24,marginTop:8,display:"flex",alignItems:"center",gap:12}}>
                      <div style={{flex:1,height:1,background:"linear-gradient(90deg,transparent,#a78bfa40,transparent)"}}/>
                      <div style={{fontSize:11,fontWeight:700,color:"#a78bfa",letterSpacing:"0.12em",textTransform:"uppercase" as const,padding:"4px 14px",background:"#a78bfa15",border:"1px solid #a78bfa30",borderRadius:20}}>Post-Launch</div>
                      <div style={{flex:1,height:1,background:"linear-gradient(90deg,transparent,#a78bfa40,transparent)"}}/>
                    </div>
                  )}
                  <div style={{marginBottom:28}}>
                    <div style={{display:"flex",alignItems:"center",gap:8,marginBottom:12,paddingBottom:8,borderBottom:`1px solid ${section.color}30`}}>
                      <span style={{fontSize:16}}>{section.icon}</span>
                      <div style={{fontSize:12,fontWeight:800,color:section.color,textTransform:"uppercase" as const,letterSpacing:"0.08em",flex:1}}>{section.title}</div>
                      <div style={{display:"flex",alignItems:"center",gap:8}}>
                        <span style={{fontSize:11,color:sectionAllDone?T.green:T.textMuted,fontWeight:600}}>{sectionDoneCount}/{section.items.length}</span>
                        {sectionAllDone ? (
                          <span style={{fontSize:11,fontWeight:700,color:T.green,background:`${T.green}18`,border:`1px solid ${T.green}40`,borderRadius:20,padding:"3px 12px"}}>✓ Done</span>
                        ) : sectionCanMarkAll ? (
                          <button
                            onClick={()=>markSectionComplete(section)}
                            style={{fontSize:11,fontWeight:700,color:section.color,background:`${section.color}15`,border:`1px solid ${section.color}50`,borderRadius:20,padding:"5px 14px",cursor:"pointer",transition:"all 0.15s ease",whiteSpace:"nowrap" as const}}
                            onMouseEnter={e=>{const el=e.currentTarget as HTMLElement;el.style.background=`${section.color}30`;}}
                            onMouseLeave={e=>{const el=e.currentTarget as HTMLElement;el.style.background=`${section.color}15`;}}
                          >
                            ✓ Mark section complete
                          </button>
                        ) : null}
                      </div>
                    </div>
                    <div style={{display:"flex",flexDirection:"column" as const,gap:10}}>
                      {section.items.map(item=>{
                        const done = !!checklistDone[item.key];
                        const needsLink = !!(item.linkInput && !checklistLinks[item.key]);
                        const canComplete = !needsLink;
                        return (
                          <div key={item.key} style={{background:done?`${section.color}0a`:T.surface,border:`1px solid ${done?section.color+"40":T.border}`,borderRadius:10,padding:"14px 16px",transition:"all 0.2s ease"}}>
                            <div style={{display:"flex",alignItems:"flex-start",gap:12}}>
                              <button onClick={()=>toggleCheck(item.key)} style={{
                                width:22,height:22,borderRadius:6,flexShrink:0,marginTop:1,
                                background:done?section.color:"transparent",
                                border:`2px solid ${done?section.color:T.border}`,
                                display:"flex",alignItems:"center",justifyContent:"center",
                                cursor:canComplete?"pointer":"not-allowed",transition:"all 0.15s ease",
                                opacity:canComplete?1:0.4,
                              }}>
                                {done&&<span style={{color:"#000",fontSize:13,fontWeight:900,lineHeight:1}}>✓</span>}
                              </button>
                              <div style={{flex:1,minWidth:0}}>
                                <div style={{display:"flex",alignItems:"center",gap:8,marginBottom:6,flexWrap:"wrap" as const}}>
                                  <div style={{fontSize:13,fontWeight:600,color:done?T.textMuted:T.text,textDecoration:done?"line-through":"none"}}>{item.label}</div>
                                  {done&&<span style={{fontSize:10,fontWeight:700,color:section.color,background:`${section.color}18`,border:`1px solid ${section.color}40`,padding:"1px 8px",borderRadius:20,flexShrink:0}}>✓ COMPLETED</span>}
                                  {item.required&&!done&&!needsLink&&<span style={{fontSize:10,fontWeight:700,color:section.color,background:`${section.color}18`,padding:"1px 7px",borderRadius:20,flexShrink:0}}>REQUIRED</span>}
                                  {needsLink&&!done&&<span style={{fontSize:10,fontWeight:700,color:T.amber,background:`${T.amber}18`,padding:"1px 7px",borderRadius:20,flexShrink:0}}>🔒 Paste URL to unlock</span>}
                                </div>
                                {(()=>{
                                  if(!item.detail.startsWith("QUESTIONS\n")){
                                    return <div style={{fontSize:12,color:T.textMuted,lineHeight:1.7,whiteSpace:"pre-line" as const}}>{item.detail}</div>;
                                  }
                                  const [qBlock,aBlock] = item.detail.split("\nANSWERS\n");
                                  const qs = qBlock.replace("QUESTIONS\n","").split("\n");
                                  const as = (aBlock||"").split("\n");
                                  return (
                                    <div style={{marginTop:4,display:"grid",gridTemplateColumns:"1fr 1fr",gap:"2px 16px"}}>
                                      <div style={{fontSize:10,fontWeight:700,color:T.textMuted,textTransform:"uppercase" as const,letterSpacing:"0.08em",marginBottom:4}}>Question</div>
                                      <div style={{fontSize:10,fontWeight:700,color:section.color,textTransform:"uppercase" as const,letterSpacing:"0.08em",marginBottom:4}}>Your Answer</div>
                                      {qs.map((q,i)=>(
                                        <>
                                          <div key={"q"+i} style={{fontSize:12,color:T.textMuted,padding:"5px 0",borderTop:`1px solid ${T.border}`,lineHeight:1.5}}>{q}</div>
                                          <div key={"a"+i} onClick={()=>{try{navigator.clipboard.writeText(as[i]||"")}catch{}}} title="Click to copy" style={{fontSize:12,color:T.text,fontWeight:500,padding:"5px 0",borderTop:`1px solid ${T.border}`,lineHeight:1.5,cursor:"copy",userSelect:"all" as const}}>{as[i]||"—"}</div>
                                        </>
                                      ))}
                                    </div>
                                  );
                                })()}
                                {item.link&&(
                                  <a href={item.link} target="_blank" rel="noopener noreferrer" style={{display:"inline-block",marginTop:10,fontSize:11,fontWeight:600,color:section.color,textDecoration:"none",background:`${section.color}15`,border:`1px solid ${section.color}40`,borderRadius:6,padding:"5px 12px"}}>
                                    {item.linkLabel||item.link} ↗
                                  </a>
                                )}
                                {item.linkInput&&(
                                  <div style={{marginTop:12}}>
                                    <div style={{fontSize:10,fontWeight:700,color:T.textMuted,textTransform:"uppercase" as const,letterSpacing:"0.08em",marginBottom:6}}>{item.linkInput.label}</div>
                                    <div style={{display:"flex",gap:8,alignItems:"center"}}>
                                      <input
                                        type="url"
                                        placeholder={item.linkInput.placeholder}
                                        value={checklistLinks[item.key]||""}
                                        onChange={e=>saveLink(item.key,e.target.value)}
                                        style={{flex:1,background:T.raised,border:`1px solid ${checklistLinks[item.key]?section.color:T.border}`,borderRadius:7,padding:"8px 12px",fontSize:12,color:T.text,outline:"none"}}
                                      />
                                      {checklistLinks[item.key]&&(
                                        <a href={checklistLinks[item.key]} target="_blank" rel="noopener noreferrer" style={{flexShrink:0,fontSize:11,fontWeight:600,color:section.color,textDecoration:"none",background:`${section.color}15`,border:`1px solid ${section.color}40`,borderRadius:6,padding:"8px 12px",whiteSpace:"nowrap" as const}}>
                                          Open ↗
                                        </a>
                                      )}
                                    </div>
                                    {checklistLinks[item.key]&&<div style={{fontSize:10,color:T.green,marginTop:4}}>✓ Saved</div>}
                                  </div>
                                )}
                              </div>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                  </div>
                );
                })}
              </div>
            );
          })()}


          {/* SOCIAL TAB */}
          {tab==="social"&&(()=>{
            const st = (c as any).metadata?.serviceType;
            const sp = (c as any).metadata?.socialPlan || "Growth";
            const platforms: string[] = (c as any).metadata?.socialPlatforms || [];
            const pIcon = (p: string) => p==="Instagram"?"📸":p==="Facebook"?"👍":p==="TikTok"?"🎵":p==="LinkedIn"?"💼":p==="YouTube"?"▶️":p==="Google Business"?"📍":"📱";
            const pColor = (p: string) => p==="Instagram"?"#E1306C":p==="Facebook"?"#1877F2":p==="TikTok"?"#69C9D0":p==="LinkedIn"?"#0A66C2":p==="YouTube"?"#FF0000":p==="Google Business"?"#4285F4":T.blue;
            return (
              <div style={{ display:"flex", flexDirection:"column" as const, gap:16 }}>
                <div style={{ background:T.surface, border:`1px solid ${T.border}`, borderRadius:12, padding:"18px 20px" }}>
                  <div style={{ fontSize:10, fontWeight:700, color:T.textMuted, textTransform:"uppercase" as const, letterSpacing:"0.1em", marginBottom:10 }}>Social Plan</div>
                  <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center" }}>
                    <div>
                      <div style={{ fontSize:18, fontWeight:800, color:T.text }}>{sp} Plan</div>
                      <div style={{ fontSize:12, color:T.textMuted, marginTop:3 }}>
                        {st==="both" ? "Website + Social Media" : "Social Media Only"}
                      </div>
                    </div>
                    <span style={{ fontSize:11, fontWeight:700, color:T.purple, background:`${T.purple}18`, border:`1px solid ${T.purple}30`, borderRadius:99, padding:"3px 12px" }}>📱 {sp}</span>
                  </div>
                </div>

                {platforms.length > 0 && (
                  <div style={{ background:T.surface, border:`1px solid ${T.border}`, borderRadius:12, padding:"18px 20px" }}>
                    <div style={{ fontSize:10, fontWeight:700, color:T.textMuted, textTransform:"uppercase" as const, letterSpacing:"0.1em", marginBottom:12 }}>Connected Platforms</div>
                    <div style={{ display:"flex", flexWrap:"wrap" as const, gap:8 }}>
                      {platforms.map((p:string) => (
                        <div key={p} style={{ display:"flex", alignItems:"center", gap:6, background:`${pColor(p)}18`, border:`1px solid ${pColor(p)}35`, borderRadius:99, padding:"5px 12px", fontSize:12, fontWeight:600, color:pColor(p) }}>
                          <span>{pIcon(p)}</span>{p}
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                <div style={{ background:T.surface, border:`1px solid ${T.border}`, borderRadius:12, padding:"18px 20px" }}>
                  <div style={{ fontSize:10, fontWeight:700, color:T.textMuted, textTransform:"uppercase" as const, letterSpacing:"0.1em", marginBottom:12 }}>Manage in Postiz</div>
                  <a href="https://app.postiz.com" target="_blank" rel="noreferrer"
                    style={{ display:"inline-flex", alignItems:"center", gap:8, background:T.blue+"18", border:`1px solid ${T.blue}40`, color:T.blue, borderRadius:8, padding:"8px 16px", fontSize:13, fontWeight:600, textDecoration:"none" }}>
                    📅 Open Postiz →
                  </a>
                  <div style={{ fontSize:11, color:T.textMuted, marginTop:8 }}>Schedule and manage posts for {c.businessName}</div>
                </div>

                {/* ── Offboarding ── */}
                <div style={{ background:T.surface, border:`1px solid ${T.border}`, borderRadius:12, padding:"18px 20px" }}>
                  <div style={{ fontSize:10, fontWeight:700, color:T.textMuted, textTransform:"uppercase" as const, letterSpacing:"0.1em", marginBottom:12 }}>Client Offboarding</div>
                  {offboardDone ? (
                    <div style={{ textAlign:"center" as const, padding:"12px 0" }}>
                      <div style={{ fontSize:24, marginBottom:8 }}>✅</div>
                      <div style={{ fontSize:14, fontWeight:700, color:T.green, marginBottom:4 }}>Offboarding email sent</div>
                      <div style={{ fontSize:12, color:T.textMuted }}>Client has been emailed confirmation and credentials.</div>
                      <button onClick={()=>{setOffboardDone(false);setOffboardConfirmed(false);setOffboardPassword("");setOffboardErr("");}} style={{ marginTop:12, background:"none", border:`1px solid ${T.border}`, borderRadius:7, color:T.textMuted, fontSize:12, cursor:"pointer", padding:"6px 14px" }}>Reset</button>
                    </div>
                  ) : (
                    <div style={{ display:"flex", flexDirection:"column" as const, gap:12 }}>
                      <div style={{ fontSize:12, color:T.textMuted, lineHeight:1.6 }}>
                        Formally offboard this client from social media management. An email is sent with legal confirmation, sign-out proof, and (if full handover) their Gmail credentials.
                      </div>

                      <div style={{ display:"flex", gap:8 }}>
                        {(["full","remove"] as const).map(v => (
                          <button key={v} onClick={()=>setOffboardType(v)}
                            style={{ flex:1, padding:"8px 10px", borderRadius:8, fontSize:12, fontWeight:600, cursor:"pointer", border:`1px solid ${offboardType===v ? T.purple : T.border}`, background:offboardType===v ? T.purple+"18" : T.raised, color:offboardType===v ? T.purple : T.textMuted, transition:"all 0.15s", fontFamily:"inherit" }}>
                            {v==="full" ? "📱 Full Handover ($299)" : "🗑️ Stop Management (Free)"}
                          </button>
                        ))}
                      </div>

                      <div>
                        <div style={{ fontSize:11, color:T.textMuted, marginBottom:4 }}>Gmail Address (created for this client)</div>
                        <input value={offboardGmail} onChange={e=>setOffboardGmail(e.target.value)} placeholder="e.g. timsplumbing@gmail.com"
                          style={{ width:"100%", background:T.raised, border:`1px solid ${T.border}`, borderRadius:7, padding:"8px 12px", color:T.text, fontSize:13, outline:"none", boxSizing:"border-box" as const, fontFamily:"inherit" }}/>
                      </div>

                      {offboardType === "full" && (
                        <div>
                          <div style={{ fontSize:11, color:T.textMuted, marginBottom:4 }}>New Gmail Password (set this before sending)</div>
                          <input value={offboardPassword} onChange={e=>setOffboardPassword(e.target.value)} placeholder="Temporary password to send client"
                            style={{ width:"100%", background:T.raised, border:`1px solid ${T.border}`, borderRadius:7, padding:"8px 12px", color:T.text, fontSize:13, outline:"none", boxSizing:"border-box" as const, fontFamily:"inherit" }}/>
                          <div style={{ fontSize:11, color:T.amber, marginTop:4 }}>Reset the Gmail password BEFORE clicking send.</div>
                        </div>
                      )}

                      <div>
                        <div style={{ fontSize:11, color:T.textMuted, marginBottom:4 }}>Note to client (optional)</div>
                        <textarea value={offboardNote} onChange={e=>setOffboardNote(e.target.value)} rows={2} placeholder="Any personal message to include..."
                          style={{ width:"100%", background:T.raised, border:`1px solid ${T.border}`, borderRadius:7, padding:"8px 12px", color:T.text, fontSize:13, outline:"none", resize:"vertical" as const, fontFamily:"inherit", boxSizing:"border-box" as const }}/>
                      </div>

                      <div style={{ background:T.raised, border:`1px solid ${offboardConfirmed ? T.green+"40" : T.border}`, borderRadius:8, padding:"12px 14px" }}>
                        <div style={{ fontSize:11, fontWeight:700, color:T.textMuted, textTransform:"uppercase" as const, letterSpacing:"0.07em", marginBottom:8 }}>Before sending, confirm you have:</div>
                        {(offboardType === "full"
                          ? ["Signed out of all social platforms in Postiz","Signed out of the Gmail account on all devices","Reset the Gmail password to the one entered above"]
                          : ["Stopped all scheduled posts in Postiz","Confirmed no future posts are queued","Noted accounts remain dormant — no further access"]
                        ).map((item, i) => (
                          <div key={i} style={{ display:"flex", alignItems:"flex-start", gap:8, fontSize:12, color:T.textSec, marginBottom:i<2?6:0, lineHeight:1.5 }}>
                            <span style={{ color:T.green, fontWeight:700, flexShrink:0 }}>✓</span>{item}
                          </div>
                        ))}
                        <label style={{ display:"flex", alignItems:"center", gap:8, marginTop:10, cursor:"pointer" }}>
                          <input type="checkbox" checked={offboardConfirmed} onChange={e=>setOffboardConfirmed(e.target.checked)} style={{ accentColor:T.green, width:14, height:14 }}/>
                          <span style={{ fontSize:12, fontWeight:600, color:T.text }}>I confirm all steps above are done</span>
                        </label>
                      </div>

                      {offboardErr && <div style={{ fontSize:12, color:T.red }}>{offboardErr}</div>}

                      <button
                        disabled={offboardSending || !offboardConfirmed || !offboardGmail || (offboardType==="full" && !offboardPassword)}
                        onClick={async () => {
                          setOffboardSending(true); setOffboardErr("");
                          try {
                            const platforms: string[] = (c as any).metadata?.socialPlatforms || [];
                            const r = await fetch("/api/admin/offboard-social", {
                              method:"POST",
                              headers:{"Content-Type":"application/json","x-process-secret":secret},
                              body:JSON.stringify({
                                businessName: c.businessName,
                                clientEmail: c.clientEmail || "",
                                slug: c.jobId,
                                gmailAddress: offboardGmail,
                                gmailPassword: offboardType==="full" ? offboardPassword : undefined,
                                platforms,
                                handoverType: offboardType,
                                adminNote: offboardNote || undefined,
                              }),
                            });
                            const d = await r.json();
                            if (!r.ok) throw new Error(d.error || "Failed");
                            setOffboardDone(true);
                            toast("Offboarding email sent to " + c.businessName, "ok");
                          } catch(e) {
                            setOffboardErr((e as Error).message);
                            toast("Failed to send offboarding email", "err");
                          } finally { setOffboardSending(false); }
                        }}
                        style={{ width:"100%", padding:"11px", borderRadius:9, fontSize:13, fontWeight:700, cursor: offboardConfirmed && offboardGmail && (offboardType==="remove"||offboardPassword) ? "pointer" : "not-allowed", border:"none", background: offboardConfirmed && offboardGmail && (offboardType==="remove"||offboardPassword) ? (offboardType==="full" ? T.purple : T.blue) : T.raised, color: offboardConfirmed && offboardGmail && (offboardType==="remove"||offboardPassword) ? "#fff" : T.textMuted, opacity: offboardSending ? 0.6 : 1, transition:"all 0.15s", fontFamily:"inherit" }}>
                        {offboardSending ? "Sending…" : offboardType==="full" ? "Send Handover Email + Credentials →" : "Send Offboarding Confirmation →"}
                      </button>
                    </div>
                  )}
                </div>
              </div>
            );
          })()}

          </div>{/* end tab content */}
        </div>{/* end body flex row */}
      </div>
    </>
  );
}

// ── Client card (grid) ─────────────────────────────────────────────────────────
function ClientCard({ c, secret, dark, toast }: { c:ClientAnalytics; secret:string; dark:boolean; toast:(msg:string,t:"ok"|"err"|"info")=>void }) {
  const [open, setOpen] = useState(false);
  const statusColor = c.buildStatus==="completed"||c.buildStatus==="complete" ? T.green : c.buildStatus==="building" ? T.amber : T.textMuted;
  const isBuilding = c.buildStatus==="building";
  const initials = c.businessName.split(" ").map(w=>w[0]).slice(0,2).join("").toUpperCase();
  const a = c.analytics;

  return (
    <>
      {open&&<ClientPanel c={c} secret={secret} onClose={()=>setOpen(false)} toast={toast}/>}
      <div className="wg-card wg-cc" onClick={()=>setOpen(true)} style={{
        background:T.surface, border:`1px solid ${statusColor}25`, borderRadius:16,
        padding:"18px 20px 18px 24px", position:"relative", overflow:"hidden",
        boxShadow:`0 0 0 1px ${statusColor}12, 0 6px 28px rgba(0,0,0,0.7), inset 0 1px 0 rgba(255,255,255,0.04)`,
        display:"flex", flexDirection:"column" as const, height:190,
      }}
      onMouseEnter={e=>{const el=e.currentTarget as HTMLElement;el.style.borderColor=statusColor+"55";el.style.boxShadow=`0 0 28px ${statusColor}25, 0 8px 40px rgba(0,0,0,0.85), inset 0 1px 0 rgba(255,255,255,0.06)`;}}
      onMouseLeave={e=>{const el=e.currentTarget as HTMLElement;el.style.borderColor=statusColor+"25";el.style.boxShadow=`0 0 0 1px ${statusColor}12, 0 6px 28px rgba(0,0,0,0.7), inset 0 1px 0 rgba(255,255,255,0.04)`;}}
      >
        {/* Left accent bar */}
        <div style={{ position:"absolute",left:0,top:0,bottom:0,width:4,borderRadius:"16px 0 0 16px",background:`linear-gradient(180deg,${statusColor},${statusColor}30)`,boxShadow:`2px 0 10px ${statusColor}35` }}/>
        {/* Status glow corner */}
        <div style={{ position:"absolute", top:0, right:0, width:110, height:110, background:`radial-gradient(circle at top right, ${statusColor}18, transparent 65%)`, pointerEvents:"none" }}/>

        {/* Building pulse */}
        {isBuilding&&(
          <div style={{ position:"absolute", top:14, right:14 }}>
            <div style={{ position:"relative", width:10, height:10 }}>
              <div style={{ position:"absolute", inset:0, borderRadius:"50%", background:T.amber, animation:"wg-ping 1.4s cubic-bezier(0,0,.2,1) infinite" }}/>
              <div style={{ position:"absolute", inset:0, borderRadius:"50%", background:T.amber }}/>
            </div>
          </div>
        )}

        <div style={{ display:"flex", alignItems:"flex-start", gap:12, marginBottom:14 }}>
          <div style={{ width:42,height:42,borderRadius:11,background:`linear-gradient(135deg,${statusColor}40,${statusColor}18)`,border:`1.5px solid ${statusColor}55`,display:"flex",alignItems:"center",justifyContent:"center",fontSize:15,fontWeight:800,color:statusColor,flexShrink:0,boxShadow:`0 0 16px ${statusColor}35, inset 0 1px 0 rgba(255,255,255,0.1)`,letterSpacing:"-0.02em" }}>
            {initials}
          </div>
          <div style={{ flex:1, minWidth:0 }}>
            <div style={{ fontWeight:600, fontSize:14, color:T.text, letterSpacing:"-0.01em", marginBottom:2, overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap" as const }}>{c.businessName}</div>
            <div style={{ fontSize:11, color:T.textMuted }}>{c.industry}</div>
          </div>
        </div>

        <div style={{ display:"flex", gap:5, flexWrap:"wrap" as const, flex:1, alignContent:"flex-start" as const }}>
          <Pill color={statusColor}>{c.buildStatus||"pending"}</Pill>
          {c.paymentState?.monthlyActive&&<Pill color={T.green}>Monthly</Pill>}
          {c.paymentState?.depositPaid&&!c.paymentState?.monthlyActive&&<Pill color={T.amber}>Deposit</Pill>}
          {!c.paymentState?.depositPaid&&<Pill color={T.textMuted}>Unpaid</Pill>}
          {c.hasBooking&&<Pill color={T.purple}>Booking</Pill>}
          {c.metadata?.alreadyReleased&&<Pill color={T.green}>Released</Pill>}
          {((c as any).metadata?.serviceType==="social"||(c as any).metadata?.serviceType==="both")&&<Pill color={T.purple}>📱 Social</Pill>}
        </div>


        <div style={{ display:"flex", justifyContent:"space-between", fontSize:12, color:T.textMuted, borderTop:`1px solid ${T.border}`, paddingTop:12, marginTop:"auto" }}>
          <div style={{ display:"flex", flexDirection:"column" as const, alignItems:"center" }}>
            <span style={{ fontSize:17, fontWeight:700, color:T.blue, letterSpacing:"-0.02em" }}>{a?.thisMonth.views??0}</span>
            <span style={{ fontSize:10, marginTop:2, letterSpacing:"0.04em" }}>VIEWS</span>
          </div>
          <div style={{ display:"flex", flexDirection:"column" as const, alignItems:"center" }}>
            <span style={{ fontSize:17, fontWeight:700, color:T.amber, letterSpacing:"-0.02em" }}>{a?.thisMonth.bookingClicks??0}</span>
            <span style={{ fontSize:10, marginTop:2, letterSpacing:"0.04em" }}>CLICKS</span>
          </div>
          <div style={{ display:"flex", flexDirection:"column" as const, alignItems:"center" }}>
            <span style={{ fontSize:17, fontWeight:700, color:T.purple, letterSpacing:"-0.02em" }}>{c.bookingCount}</span>
            <span style={{ fontSize:10, marginTop:2, letterSpacing:"0.04em" }}>BOOKINGS</span>
          </div>
          {/* Quick Links — stops propagation so it doesn't open the panel */}
          <div style={{ display:"flex", flexDirection:"column" as const, alignItems:"center" }} onClick={e=>e.stopPropagation()}>
            <button
              title="Open all client URLs"
              onClick={e=>{
                e.stopPropagation();
                const slug = c.jobId;
                const links = [
                  `https://webgeckofl.vercel.app/c/${slug}`,
                  c.liveUrl || c.previewUrl,
                  c.metadata?.domainUrl || "",
                  c.hasBooking && (c.metadata as any)?.supersaasUrl ? (c.metadata as any).supersaasUrl : "",
                ].filter(Boolean) as string[];
                links.forEach(url => window.open(url, "_blank", "noopener"));
                toast(`Opened ${links.length} link${links.length!==1?"s":""} for ${c.businessName}`,"info");
              }}
              style={{ background:"none", border:`1px solid ${T.border}`, borderRadius:7, color:T.textMuted, fontSize:13, cursor:"pointer", width:30, height:30, display:"flex", alignItems:"center", justifyContent:"center", transition:"all 0.15s ease" }}
              onMouseEnter={e=>{(e.currentTarget as HTMLElement).style.background=T.raised;(e.currentTarget as HTMLElement).style.color=T.blue;}}
              onMouseLeave={e=>{(e.currentTarget as HTMLElement).style.background="none";(e.currentTarget as HTMLElement).style.color=T.textMuted;}}
            >⧉</button>
            <span style={{ fontSize:9, marginTop:3, letterSpacing:"0.04em", color:T.textMuted }}>LINKS</span>
          </div>
        </div>
      </div>
    </>
  );
}

// ── Example HTML library ───────────────────────────────────────────────────────
function ExampleHtmlsPanel({ toast }: { toast:(msg:string,t:"ok"|"err"|"info")=>void }) {
  const [files, setFiles] = useState<{name:string;label:string;industry:string;size:number;createdAt:string}[]>([]);
  const [open, setOpen] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [industry, setIndustry] = useState("general");
  const [label, setLabel] = useState("");
  const [err, setErr] = useState("");
  const fileRef = useRef<HTMLInputElement>(null);

  async function load() {
    try { const r=await fetch("/api/admin/example-htmls"); if(r.ok){const d=await r.json();setFiles(d.files||[]);} } catch {}
  }
  useEffect(()=>{if(open)load();},[open]);

  async function handleUpload(e:React.FormEvent) {
    e.preventDefault(); setErr("");
    const file=fileRef.current?.files?.[0];
    if(!file){setErr("Select a .html file first");return;}
    setUploading(true);
    try {
      const fd=new FormData(); fd.append("file",file); fd.append("industry",industry); fd.append("label",label||file.name.replace(/\.html?$/i,""));
      const r=await fetch("/api/admin/example-htmls",{method:"POST",body:fd});
      const d=await r.json();
      if(!r.ok){setErr(d.error||"Upload failed");return;}
      if(fileRef.current)fileRef.current.value="";
      setLabel(""); await load(); toast("File uploaded","ok");
    } catch(e){setErr(String(e));}
    finally{setUploading(false);}
  }

  async function handleDelete(name:string) {
    if(!confirm(`Delete ${name}?`))return;
    await fetch("/api/admin/example-htmls",{method:"DELETE",headers:{"Content-Type":"application/json"},body:JSON.stringify({name})});
    await load(); toast("Deleted","ok");
  }

  const inp:React.CSSProperties={background:T.raised,border:`1px solid ${T.border}`,borderRadius:8,padding:"8px 12px",color:T.text,fontSize:13,outline:"none",fontFamily:"inherit",width:"100%",boxSizing:"border-box"};

  return (
    <div style={{ background:T.surface, border:`1px solid ${T.border}`, borderRadius:16, overflow:"hidden", marginTop:32, boxShadow:T.shadow }}>
      <button onClick={()=>setOpen(o=>!o)} style={{ width:"100%", background:"none", border:"none", cursor:"pointer", display:"flex", alignItems:"center", justifyContent:"space-between", padding:"18px 24px", color:T.text }}>
        <div style={{ display:"flex", alignItems:"center", gap:10 }}>
          <div style={{ width:34,height:34,borderRadius:8,background:T.blue+"20",border:`1px solid ${T.blue}30`,display:"flex",alignItems:"center",justifyContent:"center",fontSize:14 }}>📄</div>
          <div style={{ textAlign:"left" as const }}>
            <div style={{ fontSize:14, fontWeight:700, color:T.text }}>Example HTML Library</div>
            <div style={{ fontSize:12, color:T.textMuted, marginTop:2 }}>{files.length} reference files · matched by industry at build time</div>
          </div>
        </div>
        <div style={{ color:T.textMuted, fontSize:12 }}>{open?"▲":"▼"}</div>
      </button>
      {open&&(
        <div style={{ padding:"0 24px 24px", borderTop:`1px solid ${T.border}` }}>
          <form onSubmit={handleUpload} style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:10, marginBottom:20, padding:16, background:T.raised, borderRadius:10, marginTop:16, border:`1px solid ${T.border}` }}>
            <div style={{ gridColumn:"1/-1", fontSize:11, fontWeight:700, color:T.textMuted, textTransform:"uppercase" as const, letterSpacing:"0.07em" }}>Upload new example</div>
            <div><div style={{fontSize:11,color:T.textMuted,marginBottom:4}}>Industry tag</div><input style={inp} placeholder="e.g. beauty, dental, general" value={industry} onChange={e=>setIndustry(e.target.value)}/></div>
            <div><div style={{fontSize:11,color:T.textMuted,marginBottom:4}}>Label</div><input style={inp} placeholder="e.g. hero-style" value={label} onChange={e=>setLabel(e.target.value)}/></div>
            <div style={{ gridColumn:"1/-1" }}>
              <div style={{fontSize:11,color:T.textMuted,marginBottom:4}}>HTML file (max 2MB)</div>
              <input ref={fileRef} type="file" accept=".html,.htm" style={{fontSize:12,color:T.textSec}}/>
            </div>
            {err&&<div style={{fontSize:12,color:T.red,gridColumn:"1/-1"}}>{err}</div>}
            <button type="submit" disabled={uploading} style={{background:T.green,color:"#000",border:"none",borderRadius:8,padding:"8px 18px",fontSize:12,fontWeight:700,cursor:"pointer",opacity:uploading?.6:1,justifySelf:"start" as const}}>
              {uploading?"Uploading…":"Upload file"}
            </button>
          </form>
          {files.length===0
            ? <div style={{color:T.textMuted,fontSize:13,textAlign:"center" as const,padding:"20px 0"}}>No example files uploaded yet.</div>
            : files.map(f=>(
              <div key={f.name} style={{display:"flex",alignItems:"center",justifyContent:"space-between",background:T.raised,borderRadius:8,padding:"10px 14px",border:`1px solid ${T.border}`,marginBottom:8}}>
                <div>
                  <Pill color={T.blue}>{f.industry}</Pill>
                  <span style={{fontSize:13,color:T.text,fontWeight:500,marginLeft:10}}>{f.label}</span>
                  <span style={{fontSize:11,color:T.textMuted,marginLeft:8}}>{Math.round(f.size/1024)}KB · {new Date(f.createdAt).toLocaleDateString("en-AU")}</span>
                </div>
                <button onClick={()=>handleDelete(f.name)} style={{background:"none",border:`1px solid ${T.red}40`,color:T.red,borderRadius:6,padding:"4px 10px",fontSize:11,cursor:"pointer"}}>Delete</button>
              </div>
            ))}
        </div>
      )}
    </div>
  );
}

// ── Loading skeleton ───────────────────────────────────────────────────────────
function Skeleton() {
  return (
    <div style={{ background:T.surface, border:`1px solid ${T.border}`, borderRadius:14, padding:"18px 20px", boxShadow:T.shadow }}>
      {[60,40,80].map((w,i)=>(
        <div key={i} className="wg-shimmer" style={{ height:i===0?16:12, width:`${w}%`, borderRadius:6, marginBottom:i<2?12:0, background:T.raised }}/>
      ))}
    </div>
  );
}

// ── Pipeline logs panel ────────────────────────────────────────────────────────
// ── All known errors from ERRORS.md + PIPELINE-ERRORS.md ─────────────────────
const KNOWN_ERRORS: {id:string;cat:string;title:string;error:string;fix:string}[] = [
  {id:"1.1",cat:"Stitch SDK",title:"Stitch MCP OAuth / Tool not found",error:"Tool stitch_generate not found / MCP server not reachable",fix:"Replaced raw MCP calls with @google/stitch-sdk"},
  {id:"1.2",cat:"Stitch SDK",title:"get_screen not found error",error:"get_screen: resource not found when polling for screen",fix:"Changed to use list_screens to find actual screenId"},
  {id:"1.3",cat:"Stitch SDK",title:"list_screens returning 0 screens",error:"STEP 3b: screens list returned 0 items (poll 1/8)",fix:"Added projectId param; extended sleep to 90s; increased polls"},
  {id:"1.4",cat:"Stitch SDK",title:"Stitch: no signed URL after polling — fundamental architecture error",error:"Error: Stitch: no signed URL after polling — pipeline failing completely",fix:"generate() is blocking — collapsed to single step, call getHtml() immediately"},
  {id:"1.5",cat:"Stitch SDK",title:"getHtml() returning empty URL",error:"STEP 3: getHtml() returned url length=0",fix:"Poll project.getScreen(screenId) up to 5x with exponential backoff"},
  {id:"1.6",cat:"Stitch SDK",title:"Stitch SDK version mismatch",error:"@google/stitch-sdk at ^0.1.0 outdated; getScreen() signature changed",fix:"Upgraded to ^0.3.4"},
  {id:"1.7",cat:"Stitch SDK",title:"DO NOT RETRY rule violated",error:"Retry causes duplicate generations and billing",fix:"Removed all retry loops around generate(); one attempt only"},
  {id:"1.8",cat:"Stitch SDK",title:"Stitch nav scripts conflicting with injected navigation",error:"Stitch scripts overriding window.navigateTo or duplicate event listeners",fix:"Added stripping pass to remove Stitch-generated nav/scroll scripts"},
  {id:"1.9",cat:"Stitch SDK",title:"Stitch generating signup-style contact form",error:"Contact section had Business Name dropdown, Initialize Transmission button",fix:"Blueprint mandates exactly 4 fields: Name, Email, Phone, Message"},
  {id:"1.10",cat:"Stitch SDK",title:"Stitch generating address in hero subheadline",error:"Physical address appearing in hero copy",fix:"Blueprint: address ONLY inside id=contact, nowhere else"},
  {id:"1.11",cat:"Stitch SDK",title:"Stitch generating map as text link",error:"Map rendered as plain [a href=maps...] link instead of iframe",fix:"Strip pass for map links; inject proper iframe embed"},
  {id:"1.12",cat:"Stitch SDK",title:"Duplicate map in output",error:"Both pipeline-injected map AND Stitch map appearing",fix:"Strip pre-existing maps before injecting authoritative iframe"},
  {id:"1.13",cat:"Stitch SDK",title:"Map overlapping two-column contact layout",error:"Map iframe injected inside contact section, breaking layout",fix:"Map now injects as full-width block AFTER contact section close tag"},
  {id:"1.14",cat:"Stitch SDK",title:"Stitch progressive prompt fallback",error:"Stitch failing completely for certain industry/business types",fix:"Progressive prompt fallback; Claude HTML generation as final fallback"},
  {id:"2.1",cat:"Buttons & Nav",title:"CTA buttons linking to webgecko-builder.vercel.app",error:"Book Now, Get Started linked to builder domain instead of client site",fix:"Hard URL sweep regex replaces all *.vercel.app hrefs with navigateTo"},
  {id:"2.2",cat:"Buttons & Nav",title:"CTA keywords not matching plan buttons",error:"Start Starter Plan / Start Business Plan not wired",fix:"Added start-prefixed plan names to CTA keyword list"},
  {id:"2.3",cat:"Buttons & Nav",title:"Multi-page nav buttons silently failing",error:"Buttons did nothing — scrollIntoView on hidden elements",fix:"ctaOnclick simplified to window.navigateTo&&navigateTo(target)"},
  {id:"2.4",cat:"Buttons & Nav",title:"href=#section links not working on multi-page",error:"[a href=#contact] scrolled nowhere — element hidden",fix:"Changed to window.navigateTo(hr.substring(1))"},
  {id:"2.5",cat:"Buttons & Nav",title:"Frankenstein onclick handlers",error:"navigateTo call present but old scrollIntoView code also running",fix:"Deleted client-side IIFE; server-side fixNavigateToTargets handles it"},
  {id:"2.6",cat:"Buttons & Nav",title:"Single-page navigateTo hiding all content",error:"Clicking nav link hid all sections on single-page sites",fix:"navigateTo detects single vs multi-page; smooth scroll on single"},
  {id:"2.7",cat:"Buttons & Nav",title:"Hamburger menu not wiring correctly",error:"Mobile hamburger had no click handler",fix:"Added SVG detection to hamburger wiring logic"},
  {id:"2.8",cat:"Buttons & Nav",title:"clientCtaUrl sending users to existing website",error:"CTA buttons linking to client existing website",fix:"Removed clientCtaUrl; all CTAs scroll to booking or contact"},
  {id:"3.1",cat:"Blueprint",title:"Prompt capped at 5,000 chars",error:"stitchPrompt consistently 5,000 chars despite 12,000 limit",fix:"Changed .slice(0,5000) to .slice(0,12000) in blueprint.ts"},
  {id:"3.2",cat:"Blueprint",title:"Gemini API unusable (rate limits)",error:"Gemini 503/429 errors — Resource Exhausted immediately",fix:"Replaced Gemini with Claude Haiku for blueprint generation"},
  {id:"3.3",cat:"Blueprint",title:"Gemini JSON with unescaped quotes",error:"JSON.parse failed on unescaped double quotes in string values",fix:"6-strategy fallback JSON parser chain; surgical stitchPrompt extraction"},
  {id:"3.4",cat:"Blueprint",title:"Gemini JSON with control characters",error:"JSON.parse failed — control characters inside strings",fix:"Sanitize Gemini JSON response before parsing"},
  {id:"3.5",cat:"Blueprint",title:"Gemini wrong model name",error:"Model not found: gemini-2.5-flash",fix:"Corrected to gemini-1.5-pro-latest, then gemini-2.0-flash"},
  {id:"3.6",cat:"Blueprint",title:"Blueprint JSON truncation",error:"extractJson: unterminated string — Claude response cut off mid-JSON",fix:"Raised token limit; robust JSON extractor with multi-strategy fallback"},
  {id:"3.7",cat:"Blueprint",title:"stitchPrompt word count too vague",error:"Prompts under 500 words or over 3,000 words",fix:"Explicit 1000-2000 words instruction in blueprint prompt"},
  {id:"3.8",cat:"Blueprint",title:"CRITICAL RULES block not found by Python",error:"Python replacement failed to find target string",fix:"Line-number based replacement instead of string search"},
  {id:"4.1",cat:"File Corruption",title:"blueprint.ts truncated — Expected colon got eof",error:"Vercel build: Expected ':' got 'eof' at blueprint.ts line 510",fix:"Python atomic write to restore last 3 lines correctly"},
  {id:"4.2",cat:"File Corruption",title:"blueprint.ts junk appended",error:"Expression expected at line 512 — '} : String(e))' on own line",fix:"Python to detect 512-line file, strip 3 appended junk lines"},
  {id:"4.3",cat:"File Corruption",title:"blueprint.ts truncated at Authorizati",error:"File ended abruptly mid-word at line 497",fix:"git show HEAD:lib/blueprint.ts restore, Python re-apply changes"},
  {id:"4.4",cat:"File Corruption",title:"blueprint.ts duplicate tail",error:"Build error: duplicate code at end of blueprint.ts",fix:"Remove duplicate tail"},
  {id:"4.5",cat:"File Corruption",title:"blueprint.ts corrupt tail — second instance",error:"Build error from corrupt/duplicate tail",fix:"Remove corrupt tail"},
  {id:"4.6",cat:"File Corruption",title:"pipeline-helpers.ts truncated at line 1292",error:"File missing closing brace — 1292 lines instead of 1293",fix:"git show HEAD restore"},
  {id:"4.7",cat:"File Corruption",title:"route.ts duplicate tail",error:"Build error from duplicate closing code at end of route.ts",fix:"Remove duplicate tail"},
  {id:"4.8",cat:"File Corruption",title:"Null byte corruption — 2,774 null bytes in route.ts",error:"Vercel Turbopack: error TS1127: Invalid character at line 1779",fix:"Python data.replace(b'\\x00', b'') stripped all null bytes"},
  {id:"4.9",cat:"File Corruption",title:"gemini.ts duplicate tail",error:"Build error from duplicate tail",fix:"Remove duplicate tail"},
  {id:"4.10",cat:"File Corruption",title:"page.tsx trailing junk",error:"Build error from trailing characters after last JSX element",fix:"Remove trailing junk"},
  {id:"4.11",cat:"File Corruption",title:"echo append causing corruption",error:"Multiple echo appends writing new lines instead of replacing",fix:"All file writes now use Python atomic writes exclusively"},
  {id:"4.12",cat:"File Corruption",title:"Git HEAD.lock / index.lock blocking every commit",error:"fatal: Unable to create .git/index.lock: File exists",fix:"User must run Remove-Item .git/*.lock -Force before each push"},
  {id:"5.1",cat:"Inngest",title:"Vercel killing background jobs",error:"Generation silently failing after 30s Vercel timeout",fix:"Migrated to Inngest for background job processing"},
  {id:"5.2",cat:"Inngest",title:"Inngest createFunction syntax error",error:"Inngest function not registering — wrong trigger config syntax",fix:"Move trigger to config object"},
  {id:"5.3",cat:"Inngest",title:"Inngest steps non-serializable values",error:"Step replay failing — Screen objects not serializable across step boundary",fix:"Steps return only primitive values; Screen used within single step"},
  {id:"5.4",cat:"Inngest",title:"Inngest step cache not busting on rebuild",error:"Rebuild still using old cached HTML from previous Inngest run",fix:"Appended -v2 suffix to force fresh; rebuild wipes cached HTML first"},
  {id:"5.5",cat:"Inngest",title:"Inngest streaming timeout",error:"Steps timing out at Vercel function limit",fix:"Enable Inngest streaming; bump maxDuration to 800s"},
  {id:"5.6",cat:"Inngest",title:"Inngest serve route not found",error:"Inngest webhook 404 on serve route",fix:"Multiple iterations configuring inngest/route.ts correctly"},
  {id:"5.7",cat:"Inngest",title:"Payment webhook auto-triggering build",error:"Build triggering automatically on payment, bypassing admin review",fix:"Webhook now only notifies owner; admin triggers build manually"},
  {id:"5.8",cat:"Inngest",title:"Rebuild not wiping cached HTML",error:"Full rebuild still serving old HTML — Supabase html field not cleared",fix:"Rebuild endpoint clears html field before triggering Inngest"},
  {id:"6.1",cat:"Admin / Preview",title:"Preview never auto-refreshing after rebuild",error:"Admin iframe showed old site after rebuild — required manual refresh",fix:"Changed useState to useRef+useEffect([builtAt]) — tracks value correctly"},
  {id:"6.2",cat:"Admin / Preview",title:"Preview iframe serving Vercel CDN cache",error:"Stale cached version showing even after new HTML uploaded",fix:"Preview proxy sets Cache-Control: no-store; bust via builtAt timestamp"},
  {id:"6.3",cat:"Admin / Preview",title:"Screenshot thumbnail not updating",error:"Admin thumbnail showing old screenshot after rebuild",fix:"Cache bust via builtAt timestamp appended to screenshot URL"},
  {id:"6.4",cat:"Admin / Preview",title:"Admin login 404 / redirect broken",error:"After login, window.location.href redirect not working",fix:"Use window.location.replace(); add credential headers"},
  {id:"6.5",cat:"Admin / Preview",title:"Admin middleware blocking /api routes",error:"Login POST returning 403 — middleware matching all API routes",fix:"Exclude /api routes from middleware matcher pattern"},
  {id:"6.6",cat:"Admin / Preview",title:"Admin login showing no error message",error:"Wrong password showed blank screen instead of error",fix:"Show exact error; remove button disabled state"},
  {id:"6.7",cat:"Admin / Preview",title:"Admin middleware Node crypto Edge incompatible",error:"Build error: crypto module not available in Edge runtime",fix:"Rewrite middleware using Web Crypto API"},
  {id:"7.1",cat:"SuperSaas",title:"SuperSaas 400 errors — sub-user creation",error:"400 Bad Request: role field expected integer; name field wrong; owner email sent",fix:"Fixed role to integer; set name=email; added owner email guard"},
  {id:"7.2",cat:"SuperSaas",title:"Sub-user creation on free plan",error:"400/403 — sub-user API not available on free plan",fix:"Skip sub-user creation if client on free plan"},
  {id:"7.3",cat:"SuperSaas",title:"SuperSaas Basic auth failing",error:"API calls returning 401 — authentication header malformed",fix:"Correct Basic auth header format"},
  {id:"7.4",cat:"SuperSaas",title:"SuperSaas parse array response",error:"JSON parse error — sometimes returns array, sometimes object",fix:"Handle both array and object response shapes"},
  {id:"7.5",cat:"SuperSaas",title:"SuperSaas confirm email not sending",error:"Clients not receiving booking confirmation emails",fix:"Set confirm_email flag on booking creation"},
  {id:"7.6",cat:"SuperSaas",title:"SuperSaas availability config missing",error:"Booking widget showing no available slots",fix:"Auto-create availability config on SuperSaas account setup"},
  {id:"8.1",cat:"Square",title:"Square payment JSON parse error",error:"JSON.parse failure on Square webhook payload",fix:"Defensive JSON parsing with try/catch"},
  {id:"8.2",cat:"Square",title:"Square webhook duplicate events",error:"Build triggering multiple times per payment",fix:"Added dedup guard on webhook handler"},
  {id:"8.3",cat:"Square",title:"Square webhook wrong event type",error:"Payment confirmation not processed — wrong event name",fix:"Handle both payment.created and payment.completed"},
  {id:"8.4",cat:"Square",title:"Square shop catalogue API errors",error:"Product listing failing for shop feature",fix:"Correct Square Catalogue API endpoint and auth headers"},
  {id:"8.5",cat:"Square",title:"Em dash in pricing causing build error",error:"TypeScript error: em dash in string literal",fix:"Replace em dash with regular hyphen"},
  {id:"9.1",cat:"Database",title:"Redis to Supabase migration",error:"Redis unreliable; data lost between sessions; no queryability",fix:"Full migration from Upstash Redis to Supabase"},
  {id:"9.2",cat:"Database",title:"Supabase metadata jsonb field type mismatches",error:"Client fields not persisting — jsonb field receiving wrong type",fix:"Correct field type handling for jsonb"},
  {id:"9.3",cat:"Database",title:"pricing_details field not excluded for quote pricing",error:"Pricing section broken for quote-based clients",fix:"Skip pricing_details when pricingMethod is quote type"},
  {id:"10.1",cat:"TypeScript",title:"Stitch SDK TypeScript typing errors",error:"Property stitch does not exist on type / type errors on SDK usage",fix:"Hard-fix typing; correct import/usage pattern"},
  {id:"10.2",cat:"TypeScript",title:"Replacer callback params missing types",error:"TypeScript strict mode errors on String.replace() callbacks",fix:"Add explicit types to all replacer callback params"},
  {id:"10.3",cat:"TypeScript",title:"formatDate not in scope — BookingManager",error:"Build error: formatDate is not defined",fix:"Hoist formatDate to module scope"},
  {id:"10.4",cat:"TypeScript",title:"Duplicate return in feature-requests PATCH",error:"Unreachable code after return",fix:"Remove duplicate return"},
  {id:"10.5",cat:"TypeScript",title:"Admin page missing default export",error:"Next.js page not found — missing export default",fix:"Add default export to admin page"},
  {id:"10.6",cat:"TypeScript",title:"JSX structure errors in client portal",error:"Build error: unclosed JSX elements",fix:"Fix JSX nesting and closing tags"},
  {id:"10.7",cat:"TypeScript",title:"@types/jsdom missing",error:"TypeScript error: cannot find type definitions for jsdom",fix:"Add @types/jsdom to devDependencies"},
  {id:"11.1",cat:"Email",title:"Emails not sending from correct domain",error:"Client emails going to spam / sent from wrong domain",fix:"Send all emails from hello@webgecko.au"},
  {id:"11.2",cat:"Email",title:"Lead notification email missing client fields",error:"Owner notification not including all intake form fields",fix:"Restore full field set in lead notification email"},
  {id:"11.3",cat:"Email",title:"HTML email attachment not working",error:"HTML attachment not appearing in client email",fix:"Fix Resend attachment format"},
  {id:"12.1",cat:"Client Portal",title:"Fix-it route job lookup failing",error:"Fix My Site route returning 404 / can't find client job",fix:"Correct job lookup logic"},
  {id:"12.2",cat:"Client Portal",title:"Portal showing AI mentions",error:"Portal UI mentioning AI, Claude, Anthropic — should be invisible",fix:"Remove all AI/Claude branding from client-facing portal"},
  {id:"12.3",cat:"Client Portal",title:"Booking availability not showing after unlock",error:"Booking tab showing no availability after plan upgrade",fix:"Create availability config on plan unlock"},
  {id:"12.4",cat:"Client Portal",title:"14-day login persistence not working",error:"Clients being logged out after session ended",fix:"Fix cookie maxAge/expires for 14-day persistence"},
  {id:"13.1",cat:"Maps",title:"OpenStreetMap fallback — Google Maps blocked by CSP",error:"Google Maps embed blocked in some browser/CSP configs",fix:"Added OpenStreetMap as iframe fallback"},
  {id:"13.2",cat:"Maps",title:"Maps injection placement breaking layout",error:"Map appearing in middle of contact section",fix:"Inject map after entire contact section, not inside it"},
  {id:"13.3",cat:"Maps",title:"google.com/maps not in maps guard",error:"Maps guard not triggering for google.com/maps URL variant",fix:"Added google.com/maps to maps URL guard pattern"},
  {id:"14.1",cat:"Images",title:"Image upload payload too large",error:"413 Payload Too Large on image upload",fix:"Client-side image compression before upload"},
  {id:"15.1",cat:"Turnstile",title:"Turnstile token timing out",error:"Turnstile token expired before form submission",fix:"Generate token closer to submission"},
  {id:"15.2",cat:"Turnstile",title:"Turnstile blocking form during domain config",error:"Intake form unusable while Cloudflare domain being configured",fix:"Make Turnstile non-blocking — form submits even if Turnstile unavailable"},
  {id:"16.1",cat:"Multi-page",title:"Multi-page JS hiding single-page sections",error:"Multi-page show/hide logic applied on single-page sites",fix:"Detect site type; only apply multi-page toggling on multi-page sites"},
  {id:"16.2",cat:"Multi-page",title:"navigateTo target mismatch (label vs ID)",error:"Clicking nav links navigated to wrong page",fix:"fixNavigateToTargets rewrites onclick targets from labels to page IDs"},
  {id:"16.3",cat:"Multi-page",title:"Multi-page rebuild/fix route breakage (4 bugs)",error:"Multiple simultaneous breakages in multi-page nav after rebuild",fix:"4-bug fix commit c2ee433"},
  {id:"17.1",cat:"Preview",title:"Preview iframe URL encoding issue",error:"Encoded characters broke iframe src",fix:"Fix Vercel encoding of preview URL value"},
  {id:"17.2",cat:"Preview",title:"Preview iframe src using relative URL",error:"Iframe src was relative path — didn't work in different context",fix:"Ensure iframe src uses absolute URL"},
  {id:"17.3",cat:"Preview",title:"WordPress iframe embedding blocked",error:"Preview not loading when embedded in WordPress",fix:"Add correct X-Frame-Options / CSP headers"},
  {id:"18.1",cat:"Misc",title:"Phone number double-replacement",error:"Phone number appearing twice in generated HTML",fix:"Add guard to prevent double replacement"},
  {id:"18.2",cat:"Misc",title:"Business name not enforced in title tag",error:"Site [title] tag not using client business name",fix:"Enforce business name in title tag replacement"},
  {id:"18.3",cat:"Misc",title:"FAQ accordion not functioning",error:"FAQ accordion open/close not working",fix:"Fix accordion JS"},
  {id:"18.4",cat:"Misc",title:"Location keyword appearing in hero copy",error:"City/suburb in hero headline or subheadline",fix:"Only inject location into services section; not hero"},
  {id:"18.5",cat:"Misc",title:"CSS threshold too strict — Stitch uses inline styles",error:"Pipeline rejecting valid Stitch HTML — CSS under 500 chars",fix:"Lower CSS threshold to 500 chars"},
  {id:"18.6",cat:"Misc",title:"Tawk.to shared property across clients",error:"All client sites sharing single Tawk.to property — chats mixed",fix:"Per-client Tawk.to property ID stored and injected individually"},
  {id:"18.7",cat:"Misc",title:"Beehiiv newsletter form posting to central app",error:"Newsletter forms calling internal WebGecko API",fix:"Newsletter forms post directly to Beehiiv API"},
  {id:"18.8",cat:"Misc",title:"clientSlug issues — wrong URL routing",error:"Client portal not resolving correct client from slug",fix:"Fix slug generation and lookup"},
  {id:"18.9",cat:"Misc",title:"ABN field issues",error:"ABN field not saving/displaying correctly",fix:"Fix ABN field handling"},
  {id:"18.10",cat:"Misc",title:"Plan pricing display broken (/ character)",error:"Pricing display showing / in wrong place",fix:"Fix pricing display format"},
  {id:"18.11",cat:"Misc",title:"stitch.ts singleton export",error:"Stitch SDK singleton not exporting correctly — cannot find module",fix:"Correct export syntax for Stitch SDK singleton"},
  {id:"P-001",cat:"Known Issue",title:"Booking iframe shows SuperSaas template",error:"Booking section shows SuperSaas loading spinner — real schedule never loads",fix:"Broadened strip regex; smoke test rejects /template URLs"},
  {id:"P-002",cat:"Known Issue",title:"Hamburger button not wired",error:"Tapping mobile menu icon does nothing",fix:"3-strategy fix in auditor.ts; injectEssentials detects missing drawer"},
  {id:"P-003",cat:"Known Issue",title:"Missing FAQ/Testimonials/Booking sections",error:"No id=faq, id=testimonials, or id=booking in output",fix:"Step 6c fallback; Auditor injects FAQ + testimonials"},
  {id:"P-004",cat:"Known Issue",title:"Smoke test passes /template iframe as valid",error:"Smoke test not catching SuperSaas template URL",fix:"Smoke test explicitly rejects /template URLs"},
  {id:"P-005",cat:"Known Issue",title:"SuperSaas sub-account creation crash",error:"Missing DB columns causing crash on sub-account creation",fix:"Added missing columns to Supabase schema"},
  {id:"P-019",cat:"Known Issue",title:"Stitch incomplete multi-page: 1 page, no nav",error:"Stitch outputs only 1 page div, ignores multi-page requirements",fix:"ensureMultiPageStructure() guarantees all requested pages exist"},
  {id:"P-020",cat:"Known Issue",title:"Admin preview shows stale site after fix-proxy",error:"Preview iframe showed old site after redeploy",fix:"PreviewFrame now routes through /api/preview/proxy?jobId= with no-store"},
  {id:"P-021",cat:"Known Issue",title:"Generated site too basic / thin content",error:"Sparse sections, weak copy, no pricing or process section",fix:"Industry-specific extra sections in blueprint scaffold; button wiring; pass all fields to generateSiteBlueprint"},
];

const ALL_CATS = ["All", ...Array.from(new Set(KNOWN_ERRORS.map(e => e.cat)))];

function ErrorHistorySection() {
  const [search, setSearch] = useState("");
  const [cat, setCat] = useState("All");
  const [expanded, setExpanded] = useState<string|null>(null);

  const filtered = KNOWN_ERRORS.filter(e => {
    const matchCat = cat === "All" || e.cat === cat;
    const q = search.toLowerCase();
    const matchSearch = !q || e.id.toLowerCase().includes(q) || e.title.toLowerCase().includes(q) || e.error.toLowerCase().includes(q) || e.fix.toLowerCase().includes(q) || e.cat.toLowerCase().includes(q);
    return matchCat && matchSearch;
  });

  const catColor = (c:string) => c==="File Corruption"?T.red:c==="Stitch SDK"?T.blue:c==="Buttons & Nav"?T.amber:c==="Blueprint"?"#a78bfa":c==="Inngest"?"#34d399":c==="Admin / Preview"?"#60a5fa":c==="Multi-page"?"#f472b6":T.textSec;

  return (
    <div style={{marginTop:32}}>
      <div style={{display:"flex",alignItems:"center",gap:8,marginBottom:14,paddingBottom:10,borderBottom:`1px solid ${T.red}30`}}>
        <span style={{fontSize:14}}>🗂️</span>
        <span style={{fontSize:12,fontWeight:700,color:T.red,textTransform:"uppercase" as const,letterSpacing:"0.07em"}}>Error History</span>
        <span style={{fontSize:11,color:T.textSec,background:T.red+"18",borderRadius:10,padding:"1px 8px",fontWeight:600,marginLeft:2}}>{KNOWN_ERRORS.length}</span>
        <span style={{fontSize:11,color:T.textSec,marginLeft:4}}>all-time known errors across {KNOWN_ERRORS.length} issues</span>
      </div>

      {/* Search + category filter */}
      <div style={{display:"flex",gap:8,marginBottom:12,flexWrap:"wrap" as const}}>
        <input
          value={search} onChange={e=>setSearch(e.target.value)}
          placeholder="Search errors, fixes, categories…"
          style={{flex:"1 1 200px",minWidth:180,padding:"7px 12px",fontSize:12,background:T.raised,border:`1px solid ${T.border}`,borderRadius:6,color:T.text,outline:"none"}}
        />
        <select value={cat} onChange={e=>setCat(e.target.value)}
          style={{padding:"7px 12px",fontSize:12,background:T.raised,border:`1px solid ${T.border}`,borderRadius:6,color:T.text,cursor:"pointer"}}>
          {ALL_CATS.map(c=><option key={c} value={c}>{c} {c!=="All"?"("+KNOWN_ERRORS.filter(e=>e.cat===c).length+")":""}</option>)}
        </select>
        {(search||cat!=="All")&&<button onClick={()=>{setSearch("");setCat("All");}} style={{padding:"7px 12px",fontSize:12,background:T.raised,border:`1px solid ${T.border}`,borderRadius:6,color:T.textSec,cursor:"pointer"}}>✕ Clear</button>}
      </div>

      <div style={{fontSize:11,color:T.textSec,marginBottom:8}}>{filtered.length} of {KNOWN_ERRORS.length} errors shown</div>

      <div style={{display:"flex",flexDirection:"column" as const,gap:3}}>
        {filtered.map(e=>(
          <div key={e.id} style={{background:T.raised,border:`1px solid ${T.border}`,borderRadius:8,overflow:"hidden"}}>
            <div
              onClick={()=>setExpanded(expanded===e.id?null:e.id)}
              style={{display:"grid",gridTemplateColumns:"40px 90px 1fr auto",gap:"0 10px",alignItems:"center",padding:"9px 14px",cursor:"pointer"}}
            >
              <span style={{fontSize:10,fontWeight:800,color:T.textSec,fontFamily:"monospace"}}>{e.id}</span>
              <span style={{fontSize:10,fontWeight:700,color:catColor(e.cat),background:catColor(e.cat)+"20",borderRadius:4,padding:"2px 7px",textAlign:"center" as const,whiteSpace:"nowrap" as const,overflow:"hidden",textOverflow:"ellipsis"}}>{e.cat}</span>
              <span style={{fontSize:12,color:T.text,fontWeight:500}}>{e.title}</span>
              <span style={{fontSize:12,color:T.textSec,userSelect:"none" as const}}>{expanded===e.id?"▲":"▼"}</span>
            </div>
            {expanded===e.id&&(
              <div style={{padding:"0 14px 12px",borderTop:`1px solid ${T.border}`}}>
                <div style={{marginTop:10,display:"grid",gridTemplateColumns:"1fr 1fr",gap:10}}>
                  <div style={{background:T.red+"10",border:`1px solid ${T.red}25`,borderRadius:6,padding:"10px 12px"}}>
                    <div style={{fontSize:10,fontWeight:700,color:T.red,marginBottom:5,letterSpacing:"0.05em"}}>ERROR</div>
                    <div style={{fontSize:12,color:T.text,lineHeight:1.6}}>{e.error}</div>
                  </div>
                  <div style={{background:"#10b98110",border:"1px solid #10b98125",borderRadius:6,padding:"10px 12px"}}>
                    <div style={{fontSize:10,fontWeight:700,color:"#10b981",marginBottom:5,letterSpacing:"0.05em"}}>FIX</div>
                    <div style={{fontSize:12,color:T.text,lineHeight:1.6}}>{e.fix}</div>
                  </div>
                </div>
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

const MD_STEPS = new Set(["validate", "validate-md", "content-check", "schema-check"]);

function LogRow({ l }: { l: any }) {
  const lvlColor = (lv:string) => lv==="error"?T.red:lv==="warn"?T.amber:T.blue;
  const lvlBg    = (lv:string) => lv==="error"?T.red+"18":lv==="warn"?T.amber+"18":T.raised;
  return (
    <div style={{background:lvlBg(l.level),border:`1px solid ${lvlColor(l.level)}35`,borderRadius:8,padding:"11px 16px",display:"grid",gridTemplateColumns:"auto auto auto 1fr",gap:"0 12px",alignItems:"start"}}>
      <span style={{fontSize:10,fontWeight:800,color:lvlColor(l.level),background:lvlColor(l.level)+"22",borderRadius:4,padding:"3px 8px",whiteSpace:"nowrap" as const,marginTop:1,letterSpacing:"0.04em"}}>{l.level.toUpperCase()}</span>
      <span style={{fontSize:11,color:T.textSec,fontFamily:"monospace",whiteSpace:"nowrap" as const,marginTop:2}}>{l.ts ? new Date(l.ts).toLocaleString("en-AU",{day:"2-digit",month:"short",hour:"2-digit",minute:"2-digit",second:"2-digit"}) : ""}</span>
      <span style={{fontSize:11,color:T.blue,background:T.blue+"18",borderRadius:4,padding:"2px 8px",fontFamily:"monospace",whiteSpace:"nowrap" as const,marginTop:1,fontWeight:600}}>{l.step||"—"}</span>
      <div style={{marginTop:1}}>
        {l.businessName&&<span style={{fontSize:12,fontWeight:700,color:T.text,marginRight:8}}>{l.businessName}</span>}
        <span style={{fontSize:12,color:T.text,opacity:0.85,wordBreak:"break-word" as const,lineHeight:1.5}}>{l.msg}</span>
      </div>
    </div>
  );
}

function LogSection({ title, icon, logs, accentColor, emptyMsg }: { title:string; icon:string; logs:any[]; accentColor:string; emptyMsg:string }) {
  return (
    <div style={{marginBottom:24}}>
      <div style={{display:"flex",alignItems:"center",gap:8,marginBottom:10,paddingBottom:8,borderBottom:`1px solid ${accentColor}30`}}>
        <span style={{fontSize:14}}>{icon}</span>
        <span style={{fontSize:12,fontWeight:700,color:accentColor,textTransform:"uppercase" as const,letterSpacing:"0.07em"}}>{title}</span>
        <span style={{fontSize:11,color:T.textSec,background:accentColor+"18",borderRadius:10,padding:"1px 8px",fontWeight:600,marginLeft:2}}>{logs.length}</span>
      </div>
      {logs.length===0
        ? <div style={{fontSize:12,color:T.textSec,padding:"10px 14px",background:T.raised,borderRadius:8,border:`1px solid ${T.border}`}}>{emptyMsg}</div>
        : <div style={{display:"flex",flexDirection:"column" as const,gap:4}}>{logs.map((l,i)=><LogRow key={i} l={l}/>)}</div>
      }
    </div>
  );
}

function ClearBuildingBtn() {
  const [busy, setBusy] = useState(false);
  const [count, setCount] = useState<number|null>(null);

  useEffect(()=>{
    fetch("/api/admin/clients").then(r=>r.json()).then(d=>{
      const n=(d.clients||[]).filter((c:any)=>c.buildStatus==="building").length;
      setCount(n);
    }).catch(()=>{});
  },[]);

  if (!count) return null;

  async function clear() {
    if(!confirm(`Reset ${count} building job(s) to completed?`)) return;
    setBusy(true);
    const r = await fetch("/api/admin/clear-building-jobs",{method:"POST"}).then(r=>r.json()).catch(()=>({error:"Failed"}));
    setBusy(false);
    if(r.error){alert("Error: "+r.error);return;}
    setCount(0);
    alert(`Cleared ${r.cleared} stuck job(s)`);
  }

  return (
    <button onClick={clear} disabled={busy} style={{background:T.amber+"18",border:`1px solid ${T.amber}55`,color:T.amber,borderRadius:6,padding:"5px 12px",fontSize:12,cursor:"pointer",fontWeight:700}}>
      {busy?"Clearing…":`✕ Clear ${count} building`}
    </button>
  );
}

function PipelineLogsPanel() {
  const [logs, setLogs] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [lvl, setLvl] = useState<"all"|"warn"|"error">("all");

  async function load() {
    setLoading(true);
    try { const r=await fetch("/api/admin/logs"); if(r.ok){const d=await r.json();setLogs(d.logs||[]);} }
    catch {} finally { setLoading(false); }
  }
  useEffect(()=>{load();const iv=setInterval(load,30000);return()=>clearInterval(iv);},[]);

  // Split: md/validation errors vs live pipeline errors
  const allFiltered = lvl==="all" ? logs : logs.filter(l=>l.level===lvl);
  const mdErrors    = allFiltered.filter(l => l.source==="md_file" || MD_STEPS.has(l.step||""));
  const liveErrors  = allFiltered.filter(l => !l.source && !MD_STEPS.has(l.step||""));

  const lvlColor = (lv:string) => lv==="error"?T.red:lv==="warn"?T.amber:T.textSec;

  return (
    <div>
      {/* Filter bar */}
      <div style={{display:"flex",alignItems:"center",gap:8,marginBottom:20,flexWrap:"wrap" as const}}>
        <div style={{fontSize:12,color:T.textSec,fontWeight:700,marginRight:4}}>Filter:</div>
        {(["all","warn","error"] as const).map(f=>(
          <button key={f} onClick={()=>setLvl(f)} style={{padding:"5px 14px",fontSize:12,fontWeight:lvl===f?700:400,color:lvl===f?T.text:T.textSec,background:lvl===f?T.raised:"transparent",border:lvl===f?`1px solid ${T.border}`:"1px solid transparent",borderRadius:6,cursor:"pointer"}}>
            {f==="all"?"All":f.charAt(0).toUpperCase()+f.slice(1)}
            {f!=="all"&&<span style={{marginLeft:5,color:lvlColor(f),fontWeight:700}}>{logs.filter(l=>l.level===f).length}</span>}
          </button>
        ))}
        <div style={{marginLeft:"auto",display:"flex",gap:8}}>
          <ClearBuildingBtn/>
          <button onClick={load} style={{background:T.raised,border:`1px solid ${T.border}`,color:T.textSec,borderRadius:6,padding:"5px 12px",fontSize:12,cursor:"pointer",fontWeight:500}}>↻ Refresh</button>
        </div>
      </div>

      {loading&&<div style={{color:T.textSec,fontSize:13,padding:"40px 0",textAlign:"center" as const}}>Loading logs…</div>}

      {!loading&&(
        <>
          {/* .md / validation errors section */}
          <LogSection
            title="Content Validation (.md)"
            icon="📄"
            logs={mdErrors}
            accentColor={T.amber}
            emptyMsg="No content validation errors — all page specs look good."
          />
          {/* Live pipeline errors section */}
          <LogSection
            title="Live Pipeline Errors"
            icon="⚡"
            logs={liveErrors}
            accentColor={T.blue}
            emptyMsg="No live pipeline errors."
          />
          <ErrorHistorySection />
        </>
      )}
    </div>
  );
}

// ── Needs Attention row ────────────────────────────────────────────────────────
function AttentionRow({ cl, badge, color, howToFix, action, onOpen, initials }: {
  cl: ClientAnalytics; badge: string; color: string; howToFix: string; action: string;
  onOpen: (c: ClientAnalytics) => void; initials: (n: string) => string;
}) {
  const [fixing, setFixing] = useState(false);
  const [fixDone, setFixDone] = useState("");
  const [fixErr, setFixErr] = useState("");

  async function doAutoFix() {
    setFixing(true); setFixErr(""); setFixDone("");
    try {
      let r: Response;
      if (action === "fix") {
        r = await fetch(`/api/admin/fix-proxy?jobId=${cl.jobId}`, { method: "GET" });
      } else if (action === "redeploy") {
        r = await fetch("/api/admin/redeploy", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ jobId: cl.jobId }) });
      } else {
        window.open(`/c/${cl.slug}`, "_blank");
        setFixDone("Portal opened in new tab"); setFixing(false); return;
      }
      const d = await r.json();
      if (!r.ok) throw new Error(d.error || "Failed");
      setFixDone(d.previewUrl || "Done ✓");
    } catch (e) { setFixErr(e instanceof Error ? e.message : "Failed"); }
    finally { setFixing(false); }
  }

  const actionLabel = action === "fix" ? "⚡ Fix this site" : action === "redeploy" ? "⚡ Force redeploy" : "📤 Open portal";

  return (
    <div style={{ background: T.raised, borderRadius: 12, padding: "14px 18px", borderLeft: `3px solid ${color}`, display: "flex", flexDirection: "column" as const, gap: 8 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
        <div style={{ width: 32, height: 32, borderRadius: 8, background: color + "20", border: `1px solid ${color}30`, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 11, fontWeight: 800, color, flexShrink: 0 }}>{initials(cl.businessName)}</div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 13, fontWeight: 600, color: T.text }}>{cl.businessName}</div>
          <div style={{ fontSize: 11, color: T.textMuted }}>{cl.industry}</div>
        </div>
        <Pill color={color}>{badge}</Pill>
        <button onClick={() => onOpen(cl)} style={{ background: "transparent", color: T.textMuted, border: `1px solid ${T.border}`, borderRadius: 8, padding: "5px 12px", fontSize: 11, cursor: "pointer", flexShrink: 0 }}>Open →</button>
      </div>
      <div style={{ fontSize: 11, color: T.textSec, lineHeight: 1.6, padding: "6px 10px", background: color + "08", borderRadius: 8, border: `1px solid ${color}20` }}>
        💡 <strong style={{ color }}>How to fix:</strong> {howToFix}
      </div>
      <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
        {fixDone
          ? <span style={{ fontSize: 11, color: T.green }}>✓ {fixDone}</span>
          : fixErr
          ? <span style={{ fontSize: 11, color: T.red }}>✗ {fixErr}</span>
          : <button disabled={fixing} onClick={doAutoFix} style={{ background: color === T.textMuted ? T.blue : color, color: "#000", border: "none", borderRadius: 8, padding: "6px 14px", fontSize: 11, fontWeight: 700, cursor: "pointer", opacity: fixing ? 0.6 : 1, flexShrink: 0 }}>
              {fixing ? "Working…" : actionLabel}
            </button>
        }
      </div>
    </div>
  );
}

// ── Analytics view ─────────────────────────────────────────────────────────────
function AnalyticsView({ clients, onOpenClient, onClearBuilding }: { clients: ClientAnalytics[]; onOpenClient: (c: ClientAnalytics) => void; onClearBuilding: () => Promise<void> }) {
  const total = clients.length || 1;
  const active = clients.filter(c=>c.paymentState?.monthlyActive).length;
  const MONTHLY_PRICE = 109; // ← update this when pricing changes
  const mrr = active * MONTHLY_PRICE;
  const todayViews = clients.reduce((a,c)=>a+(c.analytics?.today.views||0),0);
  const monthViews = clients.reduce((a,c)=>a+(c.analytics?.thisMonth.views||0),0);
  const totalBookings = clients.reduce((a,c)=>a+c.bookingCount,0);
  const totalForms = clients.reduce((a,c)=>a+(c.analytics?.totals.formSubmits||0),0);

  // Revenue breakdown
  const monthly = clients.filter(c=>c.paymentState?.monthlyActive).length;
  const finalPaidOnly = clients.filter(c=>c.paymentState?.finalPaid&&!c.paymentState?.monthlyActive).length;
  const depositOnly = clients.filter(c=>c.paymentState?.depositPaid&&!c.paymentState?.finalPaid&&!c.paymentState?.monthlyActive).length;
  const unpaid = clients.filter(c=>!c.paymentState?.depositPaid).length;

  // Top performers by thisMonth views
  const topPerformers = [...clients]
    .sort((a,b)=>(b.analytics?.thisMonth.views||0)-(a.analytics?.thisMonth.views||0))
    .slice(0,8);
  const maxViews = topPerformers[0]?.analytics?.thisMonth.views || 1;

  // Build pipeline
  const pipelineCounts = {
    completed: clients.filter(c=>c.buildStatus==="completed"||c.buildStatus==="complete").length,
    building: clients.filter(c=>c.buildStatus==="building").length,
    pending: clients.filter(c=>!c.buildStatus||c.buildStatus==="pending").length,
    failed: clients.filter(c=>c.buildStatus==="failed").length,
  };

  // Industries
  const industryMap: Record<string,number> = {};
  clients.forEach(c=>{ if(c.industry) industryMap[c.industry]=(industryMap[c.industry]||0)+1; });
  const topIndustries = Object.entries(industryMap).sort((a,b)=>b[1]-a[1]).slice(0,6);
  const maxIndustryCount = topIndustries[0]?.[1] || 1;

  // Funnel
  const totalBookingClicks = clients.reduce((a,c)=>a+(c.analytics?.totals.bookingClicks||0),0);
  const allTimeViews = clients.reduce((a,c)=>a+(c.analytics?.totals.views||0),1);
  const funnelSteps = [
    {label:"All-time views",value:allTimeViews,color:T.blue},
    {label:"Booking clicks",value:totalBookingClicks,color:T.amber},
    {label:"Bookings",value:totalBookings,color:T.purple},
    {label:"Form submits",value:totalForms,color:T.cyan},
  ];

  // Needs attention
  const failed = clients.filter(c=>c.buildStatus==="failed");
  const stuck = clients.filter(c=>c.buildStatus==="building"&&!c.builtAt);
  const unpaidClients = clients.filter(c=>!c.paymentState?.depositPaid);
  const needsAttention = [
    ...failed.map(c=>({c,badge:"Failed",color:T.red,
      howToFix:"The build pipeline failed for this site. Use 'Fix this site' to attempt a fix pass and redeploy, or 'Rebuild site' to start fresh.",
      action:"fix",
    })),
    ...stuck.map(c=>({c,badge:"Stuck building",color:T.amber,
      howToFix:"This job is stuck in 'building' status. Use 'Force redeploy' to push the stored HTML live, or 'Rebuild site' to restart.",
      action:"redeploy",
    })),
    ...unpaidClients.map(c=>({c,badge:"Unpaid",color:T.textMuted,
      howToFix:`${c.businessName} hasn't paid a deposit yet. Send them their client portal link to complete payment.`,
      action:"portal",
    })),
  ];

  // Recent builds
  const recentBuilds = [...clients]
    .filter(c=>!!c.builtAt)
    .sort((a,b)=>new Date(b.builtAt!).getTime()-new Date(a.builtAt!).getTime())
    .slice(0,8);

  const kpi = (label:string,value:number|string,color:string,icon:string,sub?:string) => (
    <div key={label} className="wg-card wg-stat-scan" style={{ background:T.surface,border:`1px solid ${color}28`,borderRadius:16,padding:"20px 20px 18px 26px",position:"relative",overflow:"hidden",boxShadow:`0 0 0 1px ${color}14, 0 6px 32px rgba(0,0,0,0.7), inset 0 1px 0 rgba(255,255,255,0.05)`,transition:"border-color 0.2s, box-shadow 0.2s" }}
      onMouseEnter={e=>{const el=e.currentTarget as HTMLElement;el.style.borderColor=color+"55";el.style.boxShadow=`0 0 32px ${color}22, 0 8px 40px rgba(0,0,0,0.8), inset 0 1px 0 rgba(255,255,255,0.06)`;}}
      onMouseLeave={e=>{const el=e.currentTarget as HTMLElement;el.style.borderColor=color+"28";el.style.boxShadow=`0 0 0 1px ${color}14, 0 6px 32px rgba(0,0,0,0.7), inset 0 1px 0 rgba(255,255,255,0.05)`;}}
    >
      <div style={{ position:"absolute",left:0,top:0,bottom:0,width:4,borderRadius:"16px 0 0 16px",background:`linear-gradient(180deg,${color},${color}33)`,boxShadow:`2px 0 12px ${color}40` }}/>
      <div style={{ position:"absolute",top:0,right:0,width:100,height:100,background:`radial-gradient(circle at top right,${color}22,transparent 60%)`,pointerEvents:"none" }}/>
      <div style={{ width:32,height:32,borderRadius:9,background:color+"22",border:`1px solid ${color}40`,display:"flex",alignItems:"center",justifyContent:"center",fontSize:14,fontWeight:900,color,marginBottom:14,boxShadow:`0 0 12px ${color}30` }}>{icon}</div>
      <div style={{ fontSize:28,fontWeight:800,letterSpacing:"-0.04em",lineHeight:1,marginBottom:sub?4:7 }}>
        {typeof value==="number" ? <AnimNum value={value} color={color}/> : <span style={{color}}>{value}</span>}
      </div>
      {sub&&<div style={{ fontSize:11,color:color,opacity:0.7,marginBottom:7 }}>{sub}</div>}
      <div style={{ fontSize:10,color:T.textMuted,fontWeight:700,letterSpacing:"0.08em",textTransform:"uppercase" as const }}>{label}</div>
    </div>
  );

  const sectionDivider = (title:string) => (
    <div style={{ display:"flex",alignItems:"center",gap:10,marginBottom:16,marginTop:32 }}>
      <div style={{ height:1,width:20,background:"rgba(79,158,255,0.35)" }}/>
      <span style={{ fontSize:10,fontWeight:800,letterSpacing:"0.14em",color:"rgba(79,158,255,0.55)",textTransform:"uppercase" as const }}>{title}</span>
      <div style={{ height:1,flex:1,background:"linear-gradient(90deg,rgba(79,158,255,0.2),transparent)" }}/>
    </div>
  );

  const cardStyle:React.CSSProperties = { background:T.surface, border:`1px solid ${T.border}`, borderRadius:14, padding:"20px 22px", boxShadow:T.shadow };

  const initials = (name:string) => name.split(" ").map(w=>w[0]).slice(0,2).join("").toUpperCase();
  const statusColor = (s:string) => s==="completed"||s==="complete" ? T.green : s==="building" ? T.amber : s==="failed" ? T.red : T.textMuted;

  return (
    <div className="wg-tab">
      {/* A. Hero KPI row */}
      <div style={{ display:"grid", gridTemplateColumns:"repeat(6,1fr)", gap:12, marginBottom:8 }}>
        {kpi("Est. MRR","$"+mrr.toLocaleString(),T.green,"$")}
        {kpi("Active plans",active,T.green,"●")}
        {kpi("Today's views",todayViews,T.cyan,"◎",monthViews.toLocaleString()+" this month")}
        {kpi("Views this month",monthViews,T.blue,"◈")}
        {kpi("Total bookings",totalBookings,T.amber,"◆")}
        {kpi("Form submits",totalForms,T.purple,"⬡")}
      </div>

      {/* B. Revenue breakdown + Top performers */}
      {sectionDivider("Breakdown")}
      <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:16, marginBottom:8 }}>
        {/* Revenue breakdown */}
        <div style={cardStyle}>
          <div style={{ fontSize:12,fontWeight:700,color:T.text,marginBottom:16,letterSpacing:"-0.01em" }}>Revenue Breakdown</div>
          {[
            {label:"Monthly Plans",count:monthly,color:T.green},
            {label:"Final Paid",count:finalPaidOnly,color:T.blue},
            {label:"Deposit Only",count:depositOnly,color:T.amber},
            {label:"Unpaid",count:unpaid,color:T.red},
          ].map(row=>(
            <div key={row.label} style={{ marginBottom:12 }}>
              <div style={{ display:"flex",justifyContent:"space-between",fontSize:11,marginBottom:5 }}>
                <span style={{ color:T.textSec }}>{row.label}</span>
                <span style={{ color:row.color,fontWeight:700 }}>{row.count}/{total}</span>
              </div>
              <div style={{ height:7,borderRadius:99,background:T.raised,overflow:"hidden" }}>
                <div style={{ width:`${Math.round(row.count/total*100)}%`,height:"100%",borderRadius:99,background:row.color,boxShadow:`0 0 8px ${row.color}60`,transition:"width 0.7s cubic-bezier(0.22,1,0.36,1)" }}/>
              </div>
            </div>
          ))}
        </div>

        {/* Top performers */}
        <div style={cardStyle}>
          <div style={{ fontSize:12,fontWeight:700,color:T.text,marginBottom:16,letterSpacing:"-0.01em" }}>Top Performers</div>
          {topPerformers.map((cl,i)=>{
            const sc = statusColor(cl.buildStatus);
            const views = cl.analytics?.thisMonth.views||0;
            const rankColor = i===0?T.amber:i===1?"#c0c0c0":i===2?T.amber:T.textMuted;
            return (
              <div key={cl.slug} style={{ display:"flex",alignItems:"center",gap:10,marginBottom:10 }}>
                <span style={{ fontSize:11,fontWeight:800,color:rankColor,width:20,flexShrink:0,textAlign:"right" as const }}>#{i+1}</span>
                <div style={{ width:28,height:28,borderRadius:7,background:`linear-gradient(135deg,${sc}30,${sc}10)`,border:`1px solid ${sc}40`,display:"flex",alignItems:"center",justifyContent:"center",fontSize:10,fontWeight:800,color:sc,flexShrink:0 }}>{initials(cl.businessName)}</div>
                <div style={{ flex:1,minWidth:0 }}>
                  <div style={{ fontSize:11,fontWeight:600,color:T.text,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap" as const }}>{cl.businessName}</div>
                  <div style={{ height:4,borderRadius:99,background:T.raised,overflow:"hidden",marginTop:3 }}>
                    <div style={{ width:`${Math.round(views/maxViews*100)}%`,height:"100%",background:"linear-gradient(90deg,#4f9eff,#00e5ff)",borderRadius:99 }}/>
                  </div>
                </div>
                <span style={{ fontSize:11,fontWeight:700,color:T.cyan,flexShrink:0 }}>{views.toLocaleString()}</span>
              </div>
            );
          })}
          {topPerformers.length===0&&<div style={{ fontSize:12,color:T.textMuted }}>No analytics data yet.</div>}
        </div>
      </div>

      {/* C. Build Pipeline + Industries + Engagement Funnel */}
      {sectionDivider("Platform health")}
      <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr 1fr", gap:16, marginBottom:8 }}>
        {/* Build pipeline */}
        <div style={cardStyle}>
          <div style={{ fontSize:12,fontWeight:700,color:T.text,marginBottom:16,letterSpacing:"-0.01em" }}>Build Pipeline</div>
          {([
            {label:"Completed",count:pipelineCounts.completed,color:T.green},
            {label:"Building",count:pipelineCounts.building,color:T.amber},
            {label:"Pending",count:pipelineCounts.pending,color:T.textMuted},
            {label:"Failed",count:pipelineCounts.failed,color:T.red},
          ] as {label:string;count:number;color:string}[]).map(row=>(
            <div key={row.label} style={{ display:"flex",alignItems:"center",gap:8,marginBottom:10 }}>
              <div style={{ width:8,height:8,borderRadius:"50%",background:row.color,boxShadow:`0 0 6px ${row.color}70`,flexShrink:0 }}/>
              <span style={{ fontSize:11,color:T.textSec,flex:1 }}>{row.label}</span>
              <span style={{ fontSize:13,fontWeight:700,color:row.color }}>{row.count}</span>
            </div>
          ))}
          {/* Segmented bar */}
          <div style={{ display:"flex",height:8,borderRadius:99,overflow:"hidden",marginTop:12,gap:1 }}>
            {([
              {count:pipelineCounts.completed,color:T.green},
              {count:pipelineCounts.building,color:T.amber},
              {count:pipelineCounts.pending,color:T.textMuted},
              {count:pipelineCounts.failed,color:T.red},
            ] as {count:number;color:string}[]).map((seg,i)=>seg.count>0&&(
              <div key={i} style={{ flex:seg.count,background:seg.color,minWidth:2 }}/>
            ))}
          </div>
          {pipelineCounts.building > 0 && (
            <button
              onClick={async()=>{ if(!confirm(`Reset all ${pipelineCounts.building} building job(s) to completed?`)) return; await onClearBuilding(); }}
              style={{marginTop:14,width:"100%",padding:"7px 0",borderRadius:7,border:`1px solid ${T.amber}55`,background:T.amber+"12",color:T.amber,fontSize:11,fontWeight:700,cursor:"pointer",letterSpacing:"0.02em"}}
            >✕ Clear {pipelineCounts.building} building job{pipelineCounts.building>1?"s":""}</button>
          )}
        </div>

        {/* Industries */}
        <div style={cardStyle}>
          <div style={{ fontSize:12,fontWeight:700,color:T.text,marginBottom:16,letterSpacing:"-0.01em" }}>Industries Served</div>
          {topIndustries.map(([industry,count])=>(
            <div key={industry} style={{ marginBottom:10 }}>
              <div style={{ display:"flex",justifyContent:"space-between",fontSize:11,marginBottom:4 }}>
                <span style={{ color:T.textSec,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap" as const,flex:1,marginRight:8 }}>{industry}</span>
                <span style={{ color:T.purple,fontWeight:600,flexShrink:0 }}>{count}</span>
              </div>
              <div style={{ height:5,borderRadius:99,background:T.raised,overflow:"hidden" }}>
                <div style={{ width:`${Math.round(count/maxIndustryCount*100)}%`,height:"100%",borderRadius:99,background:"linear-gradient(90deg,#b085ff,#4f9eff)" }}/>
              </div>
            </div>
          ))}
          {topIndustries.length===0&&<div style={{ fontSize:12,color:T.textMuted }}>No industries found.</div>}
        </div>

        {/* Engagement funnel */}
        <div style={cardStyle}>
          <div style={{ fontSize:12,fontWeight:700,color:T.text,marginBottom:16,letterSpacing:"-0.01em" }}>Engagement Funnel</div>
          {funnelSteps.map(step=>{
            const pct = Math.round(step.value/allTimeViews*100);
            return (
              <div key={step.label} style={{ marginBottom:12 }}>
                <div style={{ display:"flex",justifyContent:"space-between",fontSize:11,marginBottom:4 }}>
                  <span style={{ color:T.textSec }}>{step.label}</span>
                  <span style={{ color:step.color,fontWeight:600 }}>{step.value.toLocaleString()} ({pct}%)</span>
                </div>
                <div style={{ height:6,borderRadius:99,background:T.raised,overflow:"hidden" }}>
                  <div style={{ width:`${Math.min(pct,100)}%`,height:"100%",borderRadius:99,background:step.color }}/>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* D. Needs Attention */}
      {sectionDivider("Needs attention")}
      <div style={{ ...cardStyle, marginBottom:8 }}>
        {needsAttention.length===0 ? (
          <div style={{ display:"flex",alignItems:"center",gap:10,padding:"8px 0" }}>
            <div style={{ width:28,height:28,borderRadius:8,background:T.green+"20",border:`1px solid ${T.green}30`,display:"flex",alignItems:"center",justifyContent:"center",fontSize:14 }}>✓</div>
            <span style={{ fontSize:13,color:T.green,fontWeight:600 }}>All systems normal — no clients need attention.</span>
          </div>
        ) : (
          <div style={{ display:"flex",flexDirection:"column" as const,gap:10 }}>
            {needsAttention.map(({c:cl,badge,color,howToFix,action},i)=>(
              <AttentionRow key={`${cl.slug}-${badge}-${i}`} cl={cl} badge={badge} color={color} howToFix={howToFix} action={action} onOpen={onOpenClient} initials={initials}/>
            ))}
          </div>
        )}
      </div>

      {/* E. Recent Builds */}
      {recentBuilds.length>0&&(
        <>
          {sectionDivider("Recent builds")}
          <div style={{ display:"flex",gap:12,overflowX:"auto" as const,paddingBottom:8 }}>
            {recentBuilds.map(cl=>{
              const sc = statusColor(cl.buildStatus);
              return (
                <div key={cl.slug} onClick={()=>onOpenClient(cl)} className="wg-cc" style={{ flexShrink:0,width:180,background:T.surface,border:`1px solid ${sc}25`,borderRadius:12,padding:"14px 16px",cursor:"pointer",boxShadow:`0 4px 20px rgba(0,0,0,0.5)` }}>
                  <div style={{ width:36,height:36,borderRadius:9,background:`linear-gradient(135deg,${sc}30,${sc}10)`,border:`1px solid ${sc}40`,display:"flex",alignItems:"center",justifyContent:"center",fontSize:13,fontWeight:800,color:sc,marginBottom:10 }}>{initials(cl.businessName)}</div>
                  <div style={{ fontSize:12,fontWeight:600,color:T.text,marginBottom:3,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap" as const }}>{cl.businessName}</div>
                  <div style={{ fontSize:10,color:T.textMuted,marginBottom:6 }}>{cl.industry}</div>
                  <div style={{ fontSize:10,color:T.textMuted,fontFamily:"monospace" }}>{cl.builtAt?new Date(cl.builtAt).toLocaleDateString("en-AU",{day:"numeric",month:"short",year:"numeric"}):""}</div>
                </div>
              );
            })}
          </div>
        </>
      )}
    </div>
  );
}

// ── Admin dashboard ────────────────────────────────────────────────────────────


// ── History View ────────────────────────────────────────────────────────────────
const UI_HISTORY_TYPE_COLOR: Record<string, string> = {
  feat: "#3b82f6", redesign: "#a855f7", fix: "#f59e0b", chore: "#8888aa",
};
interface PipelineError {
  id: string; job_id: string; step: string; type: string;
  message: string; fixed: boolean; created_at: string;
}
function HistoryView() {
  const [tab, setTab] = useState<"history"|"errors">("history");
  const [selected, setSelected] = useState<number | null>(uiHistory.length - 1);
  const [errors, setErrors] = useState<PipelineError[]>([]);
  const [loadingErrors, setLoadingErrors] = useState(false);
  const versions = [...uiHistory].reverse();

  useEffect(() => {
    if (tab === "errors") {
      setLoadingErrors(true);
      fetch("/api/admin/error-log", { headers: { "x-process-secret": "" } })
        .then(r => r.json())
        .then(d => { setErrors(Array.isArray(d) ? d : []); })
        .catch(() => {})
        .finally(() => setLoadingErrors(false));
    }
  }, [tab]);

  const unfixed = errors.filter(e => !e.fixed).length;

  const markFixed = async (id: string) => {
    await fetch("/api/admin/error-log", {
      method: "PATCH",
      headers: { "Content-Type": "application/json", "x-process-secret": "" },
      body: JSON.stringify({ id }),
    });
    setErrors(prev => prev.map(e => e.id === id ? { ...e, fixed: true } : e));
  };

  return (
    <div>
      <div style={{ marginBottom:20 }}>
        <h2 style={{ margin:0, fontSize:20, fontWeight:800, letterSpacing:"-0.03em", color:T.text }}>WebGecko History</h2>
        <div style={{ fontSize:12, color:T.textMuted, marginTop:3 }}>Auto-updated on each push</div>
      </div>

      <div style={{ display:"flex", gap:8, marginBottom:24 }}>
        {(["history","errors"] as const).map(t => (
          <button key={t} onClick={() => setTab(t)} style={{
            background: tab===t ? T.raised : T.surface,
            border: `1px solid ${tab===t ? T.blue+"80" : T.border}`,
            color: tab===t ? T.text : T.textMuted,
            borderRadius:8, padding:"8px 18px", fontSize:13, fontWeight:600, cursor:"pointer",
            display:"flex", alignItems:"center", gap:8
          }}>
            {t === "history" ? `🗂 UI History (${uiHistory.length})` : `🔴 Pipeline Errors`}
            {t === "errors" && unfixed > 0 && (
              <span style={{ background:T.red, color:"#fff", borderRadius:99, fontSize:10, fontWeight:800, padding:"1px 7px" }}>{unfixed} open</span>
            )}
          </button>
        ))}
      </div>

      {tab === "history" && (
        <div style={{ display:"grid", gridTemplateColumns:"280px 1fr", gap:20 }}>
          <div style={{ display:"flex", flexDirection:"column" as const, gap:8 }}>
            {versions.map((v, i) => {
              const idx = uiHistory.length - 1 - i;
              const isSelected = selected === idx;
              const col = UI_HISTORY_TYPE_COLOR[v.type] || T.blue;
              return (
                <div key={v.version} onClick={() => setSelected(idx)}
                  style={{ background: isSelected ? T.raised : T.surface, border:`1px solid ${isSelected ? col+"80" : T.border}`, borderRadius:10, padding:"12px 14px", cursor:"pointer", transition:"all 0.15s", borderLeft:`3px solid ${col}` }}>
                  <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:4 }}>
                    <span style={{ fontSize:13, fontWeight:700, color:T.text }}>{v.version}</span>
                    <span style={{ fontSize:9, fontWeight:700, color:col, background:`${col}18`, border:`1px solid ${col}30`, borderRadius:10, padding:"1px 7px" }}>{v.type}</span>
                  </div>
                  <div style={{ fontSize:11, color:T.textMuted }}>{v.date}</div>
                  <div style={{ fontSize:11, color:T.textSec, marginTop:4, lineHeight:1.4, overflow:"hidden", textOverflow:"ellipsis", display:"-webkit-box", WebkitLineClamp:2, WebkitBoxOrient:"vertical" as const }}>{v.description}</div>
                </div>
              );
            })}
          </div>

          {selected !== null && (() => {
            const v = uiHistory[selected];
            const col = UI_HISTORY_TYPE_COLOR[v.type] || T.blue;
            return (
              <div style={{ background:T.surface, border:`1px solid ${T.border}`, borderRadius:14, padding:"28px 32px" }}>
                <div style={{ display:"flex", alignItems:"center", gap:12, marginBottom:20 }}>
                  <span style={{ fontSize:28, fontWeight:900, color:col }}>{v.version}</span>
                  <div>
                    <div style={{ fontSize:14, fontWeight:700, color:T.text }}>{v.date}</div>
                    <div style={{ fontSize:11, color:T.textMuted, fontFamily:"monospace" }}>commit {v.commit} · {v.lines} lines</div>
                  </div>
                </div>
                <p style={{ fontSize:14, color:T.textSec, lineHeight:1.7, marginBottom:24 }}>{v.description}</p>
                <div style={{ background:T.raised, border:`1px solid ${T.border}`, borderRadius:10, padding:"18px 20px" }}>
                  <div style={{ fontSize:10, fontWeight:700, color:T.textMuted, textTransform:"uppercase" as const, letterSpacing:"0.1em", marginBottom:12 }}>Stats</div>
                  <div style={{ display:"flex", gap:24 }}>
                    <div><div style={{ fontSize:22, fontWeight:800, color:col }}>{v.lines}</div><div style={{ fontSize:11, color:T.textMuted }}>Lines</div></div>
                    <div><div style={{ fontSize:22, fontWeight:800, color:T.text }}>{v.version}</div><div style={{ fontSize:11, color:T.textMuted }}>Version</div></div>
                    <div><div style={{ fontSize:22, fontWeight:800, color:T.green }}>{v.type}</div><div style={{ fontSize:11, color:T.textMuted }}>Type</div></div>
                  </div>
                </div>
              </div>
            );
          })()}
        </div>
      )}

      {tab === "errors" && (
        <div style={{ display:"flex", flexDirection:"column" as const, gap:12 }}>
          {loadingErrors && <div style={{ color:T.textMuted, fontSize:13 }}>Loading...</div>}
          {!loadingErrors && errors.length === 0 && <div style={{ color:T.green, fontSize:13 }}>No pipeline errors logged.</div>}
          {errors.map((e) => {
            const col = e.fixed ? T.green : T.red;
            return (
              <div key={e.id} style={{ background:T.surface, border:`1px solid ${T.border}`, borderLeft:`3px solid ${col}`, borderRadius:10, padding:"16px 20px" }}>
                <div style={{ display:"flex", justifyContent:"space-between", alignItems:"flex-start", marginBottom:8 }}>
                  <div style={{ display:"flex", alignItems:"center", gap:10, flexWrap:"wrap" as const }}>
                    <span style={{ fontSize:11, fontWeight:700, color:col, background:`${col}18`, border:`1px solid ${col}30`, borderRadius:99, padding:"2px 10px" }}>
                      {e.fixed ? "✓ FIXED" : "● OPEN"}
                    </span>
                    <span style={{ fontSize:12, fontWeight:700, color:T.amber, fontFamily:"monospace" }}>{e.type}</span>
                    <span style={{ fontSize:12, color:T.textMuted, fontFamily:"monospace" }}>{e.step}</span>
                    <span style={{ fontSize:12, color:T.purple, fontFamily:"monospace" }}>{e.job_id}</span>
                  </div>
                  <div style={{ display:"flex", alignItems:"center", gap:10 }}>
                    <div style={{ fontSize:11, color:T.textMuted }}>{e.created_at?.slice(0,10)}</div>
                    {!e.fixed && (
                      <button onClick={() => markFixed(e.id)} style={{ background:T.green+"18", border:`1px solid ${T.green}30`, color:T.green, borderRadius:6, padding:"3px 10px", fontSize:11, cursor:"pointer", fontWeight:600 }}>
                        Mark Fixed
                      </button>
                    )}
                  </div>
                </div>
                <p style={{ margin:0, fontSize:13, color:T.textSec, lineHeight:1.6 }}>{e.message}</p>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

// ── Social View ────────────────────────────────────────────────────────────────
function SocialView({ clients }: { clients: ClientAnalytics[] }) {
  const socialClients = clients.filter(c => {
    const st = (c as any).metadata?.serviceType;
    return st === "social" || st === "both";
  });

  // Posts come from Postiz via the approval queue — no mock data
  const MOCK_POSTS: any[] = [];

  const pIcon = (p: string) => p==="Instagram"?"📸":p==="Facebook"?"👍":p==="TikTok"?"🎵":p==="LinkedIn"?"💼":p==="YouTube"?"▶️":p==="Google Business"?"📍":"📱";
  const pColor = (p: string) => p==="Instagram"?"#E1306C":p==="Facebook"?"#1877F2":p==="TikTok"?"#69C9D0":p==="LinkedIn"?"#0A66C2":p==="YouTube"?"#FF0000":p==="Google Business"?"#4285F4":T.blue;

  // Per-client checklist state (localStorage keyed by slug)
  const [selectedClientSlug, setSelectedClientSlug] = useState<string|null>(null);
  const [checks, setChecks] = useState<Record<string,boolean>>({});
  const [openedUrls, setOpenedUrls] = useState<Record<string,boolean>>({});

  // Postiz connection test
  const [postizTestState, setPostizTestState] = useState<"idle"|"loading"|"ok"|"err">("idle");
  const [postizChannels, setPostizChannels] = useState<{id:string;name:string;platform:string;disabled:boolean}[]>([]);
  const [postizError, setPostizError] = useState("");

  async function testPostizConnection() {
    setPostizTestState("loading");
    setPostizChannels([]);
    setPostizError("");
    try {
      const res = await fetch("/api/admin/postiz-test", { credentials:"include" });
      const data = await res.json();
      if (data.ok) {
        setPostizChannels(data.channels || []);
        setPostizTestState("ok");
      } else {
        setPostizError(data.error || "Unknown error");
        setPostizTestState("err");
      }
    } catch (e) {
      setPostizError(e instanceof Error ? e.message : String(e));
      setPostizTestState("err");
    }
  }

  const STEPS = [
    { step:"1",  icon:"📧", title:"Send welcome email",       desc:"Confirm package, pricing, what's included. Attach Social Media Service Agreement.",
      urls:[] },
    { step:"2",  icon:"📋", title:"Sign service agreement",   desc:"Client signs management clause — ownership, posting authority, liability, cancellation.",
      urls:[] },
    { step:"3",  icon:"📅", title:"Book setup call (15 min)", desc:"Schedule Zoom or phone call. They need phone access for SMS verification during setup.",
      urls:["https://calendly.com"] },
    { step:"4",  icon:"📧", title:"Create Google account",    desc:"Create Gmail (businessname.au@gmail.com) WITH client present — they set their own password. Auto-forward to their main email.",
      urls:["https://accounts.google.com/signup","https://mail.google.com"] },
    { step:"5",  icon:"📘", title:"Set up Facebook + Instagram", desc:"New Gmail → create Facebook Page + Instagram Business. Add Meta Business Manager as Partner. Client stays as account owner.",
      urls:["https://business.facebook.com","https://www.facebook.com/pages/create","https://www.instagram.com/accounts/emailsignup/"] },
    { step:"6",  icon:"🎵", title:"Set up TikTok Business",   desc:"Create TikTok Business account with same Gmail. Add TikTok Business Center as team member.",
      urls:["https://business.tiktok.com","https://ads.tiktok.com/business/en"] },
    { step:"7",  icon:"💼", title:"Set up LinkedIn company",  desc:"Use client's personal LinkedIn (or create) to create company page. Add yourself as Page Admin.",
      urls:["https://www.linkedin.com/company/setup/new/"] },
    { step:"8",  icon:"📍", title:"Google Business + YouTube", desc:"Google Business Profile and YouTube channel tied to Step 4 Gmail. Enable both from Google dashboard.",
      urls:["https://business.google.com","https://www.youtube.com/create_channel"] },
    { step:"9",  icon:"📌", title:"Connect to Postiz",          desc:"Add client as a new Brand in Postiz. Connect all platforms via OAuth — no login sharing. All posts route through here.",
      urls:["https://app.postiz.com","https://app.postiz.com"] },
    { step:"10", icon:"🗓️", title:"Set posting schedule",     desc:"Agree frequency — standard plan is 12 posts/month total (split across platforms, not per platform). Set in client portal Social tab. Confirm auto-post vs. manual approval.",
      urls:[] },
    { step:"11", icon:"🤖", title:"Configure AI brand voice", desc:"Note industry, tone preferences, content restrictions in client record. Seeds the caption generator.",
      urls:[] },
    { step:"12", icon:"🚀", title:"First post goes live",      desc:"Prepare 4–8 posts. Send preview to client if manual approval. Schedule and confirm in Postiz.",
      urls:["https://app.postiz.com"] },
  ] as const;

  function loadChecks(slug: string) {
    try {
      const raw = localStorage.getItem(`wg_social_checks_${slug}`);
      setChecks(raw ? JSON.parse(raw) : {});
      const raw2 = localStorage.getItem(`wg_social_urls_${slug}`);
      setOpenedUrls(raw2 ? JSON.parse(raw2) : {});
    } catch { setChecks({}); setOpenedUrls({}); }
  }

  function saveChecks(slug: string, next: Record<string,boolean>) {
    localStorage.setItem(`wg_social_checks_${slug}`, JSON.stringify(next));
  }

  function saveOpenedUrls(slug: string, next: Record<string,boolean>) {
    localStorage.setItem(`wg_social_urls_${slug}`, JSON.stringify(next));
  }

  function toggleCheck(slug: string, stepKey: string) {
    setChecks(prev => {
      const next = { ...prev, [stepKey]: !prev[stepKey] };
      saveChecks(slug, next);
      return next;
    });
  }

  function openStepUrls(slug: string, stepKey: string, urls: readonly string[]) {
    urls.forEach(u => window.open(u, "_blank"));
    setOpenedUrls(prev => {
      const next = { ...prev, [stepKey]: true };
      saveOpenedUrls(slug, next);
      return next;
    });
  }

  const selectedClient = selectedClientSlug
    ? socialClients.find((c: any) => c.slug === selectedClientSlug)
    : null;

  const completedCount = STEPS.filter(s => checks[`step_${s.step}`]).length;
  const progressPct = Math.round((completedCount / STEPS.length) * 100);

  const cardStyle: React.CSSProperties = { background:T.surface, border:`1px solid ${T.border}`, borderRadius:14, padding:"18px 20px", boxShadow:T.shadow };

  const displayClients: any[] = socialClients;;

  return (
    <div style={{ padding:"24px 28px", maxWidth:1200, height:"calc(100vh - 60px)", display:"flex", flexDirection:"column", overflow:"hidden" }}>

      {/* ── Header + stats ── */}
      <div style={{ flexShrink:0, marginBottom:16 }}>
        <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between", marginBottom:14 }}>
          <div>
            <div style={{ fontSize:20, fontWeight:800, color:T.text, letterSpacing:"-0.04em", marginBottom:2 }}>Social Media</div>
            <div style={{ fontSize:12, color:T.textMuted }}>Manage client accounts, onboarding checklists, and post queues.</div>
          </div>
          <a href="https://app.postiz.com" target="_blank" rel="noreferrer"
            style={{ display:"flex", alignItems:"center", gap:7, background:T.blue+"18", color:T.blue, border:`1px solid ${T.blue}30`, borderRadius:8, padding:"7px 14px", fontSize:12, fontWeight:700, textDecoration:"none" }}>
            Open Postiz ↗
          </a>
        </div>

        {/* Stats strip */}
        <div style={{ display:"grid", gridTemplateColumns:"repeat(2,1fr)", gap:10 }}>
          {[
            { label:"Social clients",    value:displayClients.length, color:T.blue,  icon:"👥" },
            { label:"Pending approvals", value:MOCK_POSTS.length,     color:T.amber, icon:"🕐" },
          ].map(s => (
            <div key={s.label} style={{ ...cardStyle, padding:"12px 16px", borderTop:`3px solid ${s.color}` }}>
              <div style={{ fontSize:16, marginBottom:4 }}>{s.icon}</div>
              <div style={{ fontSize:22, fontWeight:800, color:s.color, letterSpacing:"-0.04em", lineHeight:1, marginBottom:2 }}>
                {typeof s.value==="number"?<AnimNum value={s.value} color={s.color}/>:<span style={{color:s.color}}>{s.value}</span>}
              </div>
              <div style={{ fontSize:10, color:T.textMuted, fontWeight:600, textTransform:"uppercase" as const, letterSpacing:"0.06em" }}>{s.label}</div>
            </div>
          ))}
        </div>
      </div>

      {/* ── Main content: 3-column ── */}
      <div style={{ flex:1, display:"grid", gridTemplateColumns:"220px 1fr 300px", gap:14, overflow:"hidden", minHeight:0 }}>

        {/* ── Column 1: Client roster ── */}
        <div style={{ display:"flex", flexDirection:"column", gap:0, overflowY:"auto" }}>
          <div style={{ ...cardStyle, padding:"12px 14px", flex:1 }}>
            <div style={{ fontSize:10, fontWeight:700, color:T.textMuted, textTransform:"uppercase" as const, letterSpacing:"0.1em", marginBottom:12 }}>Social Clients</div>
            <div style={{ display:"flex", flexDirection:"column", gap:6 }}>
              {displayClients.length === 0 && (
                <div style={{ padding:"20px 16px", textAlign:"center" as const }}>
                  <div style={{ fontSize:28, marginBottom:8 }}>👥</div>
                  <div style={{ fontSize:12, fontWeight:600, color:T.textSec, marginBottom:4 }}>No social clients yet</div>
                  <div style={{ fontSize:11, color:T.textMuted, lineHeight:1.5 }}>Clients with a social media plan will appear here.</div>
                </div>
              )}
              {displayClients.map((cl: any) => {
                const platforms: string[] = (cl.metadata as any)?.socialPlatforms || [];
                const slug = cl.slug || cl.jobId;
                const checksForClient = (() => { try { const r = localStorage.getItem(`wg_social_checks_${slug}`); return r ? JSON.parse(r) : {}; } catch { return {}; } })();
                const done = STEPS.filter(s => checksForClient[`step_${s.step}`]).length;
                const isSelected = selectedClientSlug === slug;
                return (
                  <button key={slug} onClick={() => { setSelectedClientSlug(slug); loadChecks(slug); }}
                    style={{ background: isSelected ? T.blue+"18" : T.raised, border:`1px solid ${isSelected ? T.blue+"50" : T.border}`, borderRadius:10, padding:"10px 12px", cursor:"pointer", textAlign:"left" as const, transition:"all 0.15s ease", fontFamily:"inherit", width:"100%" }}>
                    <div style={{ display:"flex", alignItems:"center", gap:8, marginBottom:6 }}>
                      <div style={{ width:28, height:28, borderRadius:7, background:`linear-gradient(135deg,${T.blue}30,${T.purple}20)`, border:`1px solid ${T.blue}25`, display:"flex", alignItems:"center", justifyContent:"center", fontSize:11, fontWeight:800, color:T.blue, flexShrink:0 }}>
                        {cl.businessName.split(" ").map((w: string)=>w[0]).slice(0,2).join("").toUpperCase()}
                      </div>
                      <div style={{ flex:1, minWidth:0 }}>
                        <div style={{ fontSize:12, fontWeight:700, color:T.text, overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap" as const }}>{cl.businessName}</div>
                        <div style={{ fontSize:10, color:T.textMuted }}>{cl.industry || "—"}</div>
                      </div>
                    </div>
                    {/* Platform icons */}
                    <div style={{ display:"flex", gap:3, flexWrap:"wrap" as const, marginBottom:6 }}>
                      {(platforms.length > 0 ? platforms : ["Instagram","Facebook"]).map((p: string) => (
                        <span key={p} title={p} style={{ fontSize:13 }}>{pIcon(p)}</span>
                      ))}
                    </div>
                    {/* Progress bar */}
                    <div style={{ display:"flex", alignItems:"center", gap:6 }}>
                      <div style={{ flex:1, height:4, background:T.border, borderRadius:2, overflow:"hidden" }}>
                        <div style={{ height:"100%", width:`${Math.round((done/STEPS.length)*100)}%`, background:done===STEPS.length?T.green:T.blue, borderRadius:2, transition:"width 0.3s ease" }}/>
                      </div>
                      <span style={{ fontSize:9, color:T.textMuted, flexShrink:0 }}>{done}/{STEPS.length}</span>
                    </div>
                  </button>
                );
              })}
            </div>
            <div style={{ marginTop:12, paddingTop:10, borderTop:`1px solid ${T.border}` }}>
              <div style={{ fontSize:10, color:T.textMuted, textAlign:"center" as const }}>Click a client to manage their onboarding</div>
            </div>
          </div>
        </div>

        {/* ── Column 2: Onboarding checklist ── */}
        <div style={{ overflowY:"auto" }}>
          {!selectedClientSlug ? (
            <div style={{ ...cardStyle, height:"100%", display:"flex", alignItems:"center", justifyContent:"center", flexDirection:"column", gap:12 }}>
              <div style={{ fontSize:36 }}>👈</div>
              <div style={{ fontSize:14, fontWeight:700, color:T.text }}>Select a client</div>
              <div style={{ fontSize:12, color:T.textMuted, textAlign:"center" as const, maxWidth:220, lineHeight:1.6 }}>Click a client from the roster to view and manage their onboarding checklist.</div>
            </div>
          ) : (
            <div style={{ ...cardStyle, padding:"16px 18px" }}>
              {/* Client header */}
              <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between", marginBottom:14 }}>
                <div style={{ display:"flex", alignItems:"center", gap:10 }}>
                  <div>
                    <div style={{ fontSize:14, fontWeight:800, color:T.text }}>{selectedClient?.businessName || selectedClientSlug}</div>
                    <div style={{ fontSize:11, color:T.textMuted, marginTop:1 }}>Onboarding checklist · {completedCount}/{STEPS.length} steps done</div>
                  </div>
                </div>
                <div style={{ display:"flex", alignItems:"center", gap:8 }}>
                  {/* Progress pill */}
                  <div style={{ background: progressPct===100 ? T.green+"20" : T.blue+"15", border:`1px solid ${progressPct===100?T.green:T.blue}30`, borderRadius:20, padding:"4px 10px", fontSize:11, fontWeight:700, color:progressPct===100?T.green:T.blue }}>
                    {progressPct===100 ? "✓ Complete" : `${progressPct}%`}
                  </div>
                  <button onClick={() => { setSelectedClientSlug(null); setChecks({}); setOpenedUrls({}); }}
                    style={{ background:"none", border:`1px solid ${T.border}`, borderRadius:7, padding:"4px 10px", fontSize:11, color:T.textMuted, cursor:"pointer", fontFamily:"inherit" }}>✕</button>
                </div>
              </div>

              {/* Progress bar */}
              <div style={{ height:5, background:T.border, borderRadius:3, overflow:"hidden", marginBottom:16 }}>
                <div style={{ height:"100%", width:`${progressPct}%`, background:`linear-gradient(90deg,${T.blue},${T.purple})`, borderRadius:3, transition:"width 0.35s ease" }}/>
              </div>

              {/* Steps */}
              <div style={{ display:"flex", flexDirection:"column", gap:8 }}>
                {STEPS.map((s) => {
                  const key = `step_${s.step}`;
                  const done = checks[key];
                  const urlsOpened = openedUrls[key];
                  const hasUrls = s.urls.length > 0;
                  return (
                    <div key={key} style={{ display:"flex", gap:10, padding:"10px 12px", background: done ? T.green+"0a" : T.raised, border:`1px solid ${done ? T.green+"30" : T.border}`, borderRadius:10, transition:"all 0.15s ease" }}>
                      {/* Checkbox */}
                      <button onClick={() => toggleCheck(selectedClientSlug!, key)}
                        style={{ width:22, height:22, borderRadius:6, border:`2px solid ${done ? T.green : T.border}`, background: done ? T.green : "transparent", display:"flex", alignItems:"center", justifyContent:"center", cursor:"pointer", flexShrink:0, marginTop:1, transition:"all 0.15s ease" }}>
                        {done && <span style={{ color:"#fff", fontSize:11, fontWeight:900, lineHeight:1 }}>✓</span>}
                      </button>
                      {/* Content */}
                      <div style={{ flex:1, minWidth:0 }}>
                        <div style={{ display:"flex", alignItems:"center", gap:6, marginBottom:3 }}>
                          <span style={{ fontSize:10, fontWeight:800, color:done?T.green:T.blue, background:done?T.green+"18":T.blue+"15", border:`1px solid ${done?T.green:T.blue}25`, borderRadius:4, padding:"1px 5px" }}>{s.step}</span>
                          <span style={{ fontSize:12, fontWeight:700, color: done ? T.textMuted : T.text, textDecoration: done ? "line-through" : "none" }}>{s.icon} {s.title}</span>
                        </div>
                        <div style={{ fontSize:11, color:T.textMuted, lineHeight:1.5, marginBottom: hasUrls ? 8 : 0 }}>{s.desc}</div>
                        {/* URL launcher */}
                        {hasUrls && !done && (
                          <button onClick={() => openStepUrls(selectedClientSlug!, key, s.urls)}
                            style={{ display:"inline-flex", alignItems:"center", gap:5, background: urlsOpened ? T.green+"18" : T.blue+"18", color: urlsOpened ? T.green : T.blue, border:`1px solid ${urlsOpened?T.green:T.blue}30`, borderRadius:6, padding:"4px 10px", fontSize:10, fontWeight:700, cursor:"pointer", fontFamily:"inherit" }}>
                            {urlsOpened ? "↗ Reopened" : "↗ Open URLs"} ({s.urls.length})
                          </button>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>

              {progressPct === 100 && (
                <div style={{ marginTop:14, background:T.green+"12", border:`1px solid ${T.green}30`, borderRadius:10, padding:"12px 16px", textAlign:"center" as const }}>
                  <div style={{ fontSize:20, marginBottom:4 }}>🎉</div>
                  <div style={{ fontSize:13, fontWeight:700, color:T.green }}>Onboarding complete!</div>
                  <div style={{ fontSize:11, color:T.textMuted, marginTop:3 }}>All 12 steps done for {selectedClient?.businessName}.</div>
                </div>
              )}
            </div>
          )}
        </div>

        {/* ── Column 3: Approval queue + Postiz ── */}
        <div style={{ display:"flex", flexDirection:"column", gap:12, overflowY:"auto" }}>

          {/* Approval queue */}
          <div style={{ ...cardStyle, padding:"14px 16px" }}>
            <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between", marginBottom:12 }}>
              <div style={{ fontSize:12, fontWeight:700, color:T.text }}>Approval Queue</div>
              <span style={{ background:T.amber+"20", color:T.amber, border:`1px solid ${T.amber}35`, borderRadius:6, padding:"2px 8px", fontSize:10, fontWeight:700 }}>{MOCK_POSTS.length} pending</span>
            </div>
            <div style={{ display:"flex", flexDirection:"column" as const, gap:8 }}>
              {MOCK_POSTS.map(post => (
                <div key={post.id} style={{ background:T.raised, border:`1px solid ${T.border}`, borderRadius:10, padding:"10px 12px", borderLeft:`3px solid ${T.amber}` }}>
                  <div style={{ display:"flex", alignItems:"center", gap:6, marginBottom:6 }}>
                    <span style={{ fontSize:13 }}>{pIcon(post.platform)}</span>
                    <span style={{ fontSize:11, fontWeight:700, color:T.text }}>{post.client}</span>
                    <span style={{ marginLeft:"auto", fontSize:10, color:T.amber, fontWeight:600 }}>{post.scheduled}</span>
                  </div>
                  <div style={{ fontSize:11, color:T.textSec, lineHeight:1.4, marginBottom:8, overflow:"hidden", display:"-webkit-box", WebkitLineClamp:2, WebkitBoxOrient:"vertical" as any }}>{post.caption}</div>
                  <div style={{ display:"flex", gap:5 }}>
                    <button style={{ flex:1, background:T.green+"18", color:T.green, border:`1px solid ${T.green}30`, borderRadius:6, padding:"5px 0", fontSize:10, fontWeight:700, cursor:"pointer" }}>✓ Approve</button>
                    <button style={{ flex:1, background:T.blue+"18", color:T.blue, border:`1px solid ${T.blue}30`, borderRadius:6, padding:"5px 0", fontSize:10, fontWeight:600, cursor:"pointer" }}>✎ Edit</button>
                    <button style={{ flex:1, background:T.red+"18", color:T.red, border:`1px solid ${T.red}30`, borderRadius:6, padding:"5px 0", fontSize:10, fontWeight:600, cursor:"pointer" }}>✕ Reject</button>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Postiz Connection */}
          <div style={{ ...cardStyle, padding:"14px 16px" }}>
            <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between", marginBottom:12 }}>
              <div style={{ fontSize:12, fontWeight:700, color:T.text }}>Postiz Scheduler</div>
              {postizTestState === "ok" && (
                <div style={{ display:"flex", alignItems:"center", gap:5, background:T.green+"18", border:`1px solid ${T.green}30`, borderRadius:20, padding:"3px 10px" }}>
                  <div style={{ width:5, height:5, borderRadius:"50%", background:T.green }}/>
                  <span style={{ fontSize:10, color:T.green, fontWeight:600 }}>Connected</span>
                </div>
              )}
              {postizTestState === "err" && (
                <div style={{ display:"flex", alignItems:"center", gap:5, background:"#ef444418", border:"1px solid #ef444430", borderRadius:20, padding:"3px 10px" }}>
                  <div style={{ width:5, height:5, borderRadius:"50%", background:"#ef4444" }}/>
                  <span style={{ fontSize:10, color:"#ef4444", fontWeight:600 }}>Error</span>
                </div>
              )}
              {(postizTestState === "idle" || postizTestState === "loading") && (
                <div style={{ display:"flex", alignItems:"center", gap:5, background:T.raised, border:`1px solid ${T.border}`, borderRadius:20, padding:"3px 10px" }}>
                  <div style={{ width:5, height:5, borderRadius:"50%", background:T.textMuted }}/>
                  <span style={{ fontSize:10, color:T.textMuted, fontWeight:600 }}>{postizTestState === "loading" ? "Testing…" : "Not tested"}</span>
                </div>
              )}
            </div>

            {postizTestState === "ok" && postizChannels.length > 0 && (
              <div style={{ marginBottom:10 }}>
                <div style={{ fontSize:10, fontWeight:700, color:T.textMuted, textTransform:"uppercase" as const, letterSpacing:"0.07em", marginBottom:6 }}>
                  {postizChannels.length} channel{postizChannels.length !== 1 ? "s" : ""} connected
                </div>
                <div style={{ display:"flex", flexDirection:"column" as const, gap:4, maxHeight:120, overflowY:"auto" as const }}>
                  {postizChannels.map(ch => (
                    <div key={ch.id} style={{ display:"flex", alignItems:"center", gap:7, padding:"4px 7px", background:T.raised, borderRadius:6, border:`1px solid ${T.border}` }}>
                      <span style={{ fontSize:12 }}>
                        {ch.platform==="instagram"?"📸":ch.platform==="facebook"?"👍":ch.platform==="tiktok"?"🎵":ch.platform==="linkedin"||ch.platform==="linkedin-page"?"💼":ch.platform==="youtube"?"▶️":ch.platform==="x"?"𝕏":"📱"}
                      </span>
                      <span style={{ fontSize:10, color:T.text, flex:1, overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap" as const }}>{ch.name}</span>
                      {ch.disabled && <span style={{ fontSize:9, color:"#ef4444", fontWeight:600 }}>DISABLED</span>}
                    </div>
                  ))}
                </div>
              </div>
            )}

            {postizTestState === "ok" && postizChannels.length === 0 && (
              <div style={{ fontSize:11, color:T.textMuted, marginBottom:10, padding:"8px", background:T.raised, borderRadius:6 }}>
                ⚠️ API connected but no channels found. Connect client accounts in Postiz first.
              </div>
            )}

            {postizTestState === "err" && (
              <div style={{ fontSize:11, color:"#ef4444", marginBottom:10, padding:"8px", background:"#ef444410", borderRadius:6, wordBreak:"break-all" as const }}>
                {postizError}
              </div>
            )}

            <div style={{ display:"flex", gap:7, marginTop:4 }}>
              <button
                onClick={testPostizConnection}
                disabled={postizTestState === "loading"}
                style={{ flex:1, background:postizTestState==="loading"?T.raised:T.blue+"18", color:postizTestState==="loading"?T.textMuted:T.blue, border:`1px solid ${postizTestState==="loading"?T.border:T.blue+"40"}`, borderRadius:7, padding:"7px 0", fontSize:11, fontWeight:700, cursor:postizTestState==="loading"?"default":"pointer" }}>
                {postizTestState === "loading" ? "Testing…" : postizTestState === "ok" ? "↻ Retest" : "Test Connection"}
              </button>
              <a href="https://app.postiz.com" target="_blank" rel="noreferrer"
                style={{ flex:1, background:T.raised, color:T.textSec, border:`1px solid ${T.border}`, borderRadius:7, padding:"7px 0", fontSize:11, fontWeight:600, cursor:"pointer", textDecoration:"none", display:"flex", alignItems:"center", justifyContent:"center" }}>
                Open ↗
              </a>
            </div>
          </div>

          {/* Quick links */}
          <div style={{ ...cardStyle, padding:"14px 16px" }}>
            <div style={{ fontSize:11, fontWeight:700, color:T.textMuted, textTransform:"uppercase" as const, letterSpacing:"0.08em", marginBottom:10 }}>Quick Setup Links</div>
            <div style={{ display:"flex", flexDirection:"column" as const, gap:6 }}>
              {[
                { label:"Meta Business Suite",   url:"https://business.facebook.com",              icon:"📘" },
                { label:"TikTok Business Center",url:"https://business.tiktok.com",                icon:"🎵" },
                { label:"Google Workspace",       url:"https://accounts.google.com/signup",         icon:"📧" },
                { label:"LinkedIn Pages",         url:"https://www.linkedin.com/company/setup/new/",icon:"💼" },
                { label:"Google Business",        url:"https://business.google.com",                icon:"📍" },
                { label:"YouTube Studio",         url:"https://studio.youtube.com",                 icon:"▶️" },
                { label:"Postiz Scheduler",        url:"https://app.postiz.com",                  icon:"📅" },
              ].map(link => (
                <a key={link.label} href={link.url} target="_blank" rel="noreferrer"
                  style={{ display:"flex", alignItems:"center", gap:8, padding:"6px 8px", background:T.raised, border:`1px solid ${T.border}`, borderRadius:7, fontSize:11, color:T.textSec, textDecoration:"none", transition:"border-color 0.15s ease" }}
                  onMouseEnter={e=>(e.currentTarget.style.borderColor=T.blue)} onMouseLeave={e=>(e.currentTarget.style.borderColor=T.border)}>
                  <span style={{ fontSize:13 }}>{link.icon}</span>
                  <span style={{ flex:1 }}>{link.label}</span>
                  <span style={{ fontSize:10, color:T.textMuted }}>↗</span>
                </a>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

// ── Legal Docs Panel ──────────────────────────────────────────────────────────
function LegalDocsPanel() {
  const [legalOpen, setLegalOpen] = useState(false);
  const DOCS = [
    { title:"Terms & Conditions", ref:"WG-TNC-001", file:"WebGecko_Terms_and_Conditions.pdf", desc:"Full service agreement, payment terms, IP, liability, dispute resolution." },
    { title:"Privacy Policy", ref:"WG-PRV-001", file:"WebGecko_Privacy_Policy.pdf", desc:"Privacy Act 1988 (Cth) compliance, data handling, OAIC complaint pathway." },
    { title:"Cancellation & Refund Policy", ref:"WG-CAN-001", file:"WebGecko_Cancellation_and_Refund_Policy.pdf", desc:"Cancellation process, refund rights, handover package pricing, ACL." },
    { title:"Social Media Agreement", ref:"WG-SOC-001", file:"WebGecko_Social_Media_Agreement.pdf", desc:"Account ownership, credentials, community management, offboarding." },
  ];
  return (
    <div style={{ background:T.surface, border:`1px solid ${T.border}`, borderRadius:16, overflow:"hidden", marginTop:32, boxShadow:T.shadow }}>
      <button onClick={()=>setLegalOpen(o=>!o)} style={{ width:"100%", background:"none", border:"none", cursor:"pointer", display:"flex", alignItems:"center", justifyContent:"space-between", padding:"18px 24px", color:T.text, fontFamily:"inherit" }}>
        <div style={{ display:"flex", alignItems:"center", gap:10 }}>
          <div style={{ width:34,height:34,borderRadius:8,background:T.purple+"20",border:`1px solid ${T.purple}30`,display:"flex",alignItems:"center",justifyContent:"center",fontSize:16 }}>{"⚖️"}</div>
          <div style={{ textAlign:"left" as const }}>
            <div style={{ fontSize:14, fontWeight:700, color:T.text }}>Legal Documents</div>
            <div style={{ fontSize:12, color:T.textMuted, marginTop:2 }}>{DOCS.length} documents · Queensland, Australia · ABN 32 300 992 377</div>
          </div>
        </div>
        <div style={{ color:T.textMuted, fontSize:12 }}>{legalOpen?"▲":"▼"}</div>
      </button>
      {legalOpen && (
        <div style={{ padding:"0 24px 24px", borderTop:`1px solid ${T.border}` }}>
          <div style={{ fontSize:12, color:T.textMuted, lineHeight:1.6, margin:"16px 0 14px" }}>
            These documents are served to clients at <b style={{color:T.textSec}}>webgecko.au/legal/</b> and must be accepted by clients before their first payment. Download to keep offline copies.
          </div>
          <div style={{ display:"grid", gridTemplateColumns:"repeat(2,1fr)", gap:10 }}>
            {DOCS.map(doc => (
              <div key={doc.ref} style={{ background:T.raised, border:`1px solid ${T.border}`, borderRadius:12, padding:"14px 16px", display:"flex", flexDirection:"column" as const, gap:8 }}>
                <div style={{ display:"flex", justifyContent:"space-between", alignItems:"flex-start", gap:8 }}>
                  <div style={{ fontSize:13, fontWeight:700, color:T.text, lineHeight:1.3 }}>{doc.title}</div>
                  <span style={{ fontSize:9, fontWeight:700, color:T.purple, background:T.purple+"18", border:`1px solid ${T.purple}30`, borderRadius:5, padding:"2px 7px", whiteSpace:"nowrap" as const, flexShrink:0 }}>{doc.ref}</span>
                </div>
                <div style={{ fontSize:11, color:T.textMuted, lineHeight:1.5, flex:1 }}>{doc.desc}</div>
                <div style={{ display:"flex", gap:8, marginTop:4 }}>
                  <a href={"/legal/"+doc.file} target="_blank" rel="noreferrer"
                    style={{ flex:1, display:"flex", alignItems:"center", justifyContent:"center", gap:6, background:T.purple+"18", border:`1px solid ${T.purple}40`, color:T.purple, borderRadius:7, padding:"7px 10px", fontSize:12, fontWeight:600, textDecoration:"none" }}>
                    View ↗
                  </a>
                  <a href={"/legal/"+doc.file} download={doc.file}
                    style={{ flex:1, display:"flex", alignItems:"center", justifyContent:"center", gap:6, background:T.raised, border:`1px solid ${T.border}`, color:T.textSec, borderRadius:7, padding:"7px 10px", fontSize:12, fontWeight:600, textDecoration:"none" }}>
                    ↓ Download
                  </a>
                </div>
              </div>
            ))}
          </div>
          <div style={{ marginTop:14, background:T.raised, border:`1px solid ${T.border}`, borderRadius:8, padding:"10px 14px", fontSize:11, color:T.textMuted, lineHeight:1.6 }}>
            {"\u26a0\ufe0f"} These documents were generated on {new Date().toLocaleDateString("en-AU")}. If you update pricing, plans, or service terms, regenerate the PDFs and redeploy. Clients who accepted prior versions are bound to those terms — notify them of material changes via email.
          </div>
        </div>
      )}
    </div>
  );
}

function OriginsView() {
  // WooCommerce products state
  const [wooProducts, setWooProducts] = useState<Array<{
    id: number;
    name: string;
    sku: string;
    stock_quantity: number | null;
    price: string;
  }>>([]);
  const [wooLoading, setWooLoading] = useState(true);
  const [wooError, setWooError] = useState("");

  // Postiz social post state
  const [postizChannels, setPostizChannels] = useState<Array<{ id: string; name: string; platform: string; picture?: string }>>([]);
  const [postizLoading, setPostizLoading] = useState(true);
  const [postizError, setPostizError] = useState("");
  const [selectedChannels, setSelectedChannels] = useState<Set<string>>(new Set());
  const [postContent, setPostContent] = useState("");
  const [postImageUrl, setPostImageUrl] = useState("");
  const [postDropActive, setPostDropActive] = useState(false);
  const [postImageUploading, setPostImageUploading] = useState(false);
  const [postType, setPostType] = useState<"now" | "draft" | "schedule">("now");
  const [scheduleDate, setScheduleDate] = useState("");
  const [postSubmitting, setPostSubmitting] = useState(false);
  const [postResult, setPostResult] = useState<{ ok: boolean; msg: string } | null>(null);

  // Shipped orders log (localStorage)
  const [shippedOrders, setShippedOrders] = useState<any[]>(() => {
    try { return JSON.parse(localStorage.getItem("wg_origins_shipped") || "[]"); } catch { return []; }
  });

  // Ship Order form state
  const CHECKLIST_STEPS = [
    "Print label",
    "Package item(s)",
    "Bubble wrap / padding added",
    "Seal box/satchel",
    "Attach label",
    "Drop off / booked courier",
  ];
  const [shipForm, setShipForm] = useState({
    orderRef: "",
    customerName: "",
    productId: "",
    qty: 1,
  });
  const [checklist, setChecklist] = useState<boolean[]>(CHECKLIST_STEPS.map(() => false));

  const allChecked = checklist.every(Boolean);

  useEffect(() => {
    setWooLoading(true);
    fetch("/api/admin/woo-products")
      .then(r => {
        if (!r.ok) throw new Error(`HTTP ${r.status}`);
        return r.json();
      })
      .then(data => {
        setWooProducts(data.products || []);
        // Pre-select first product in ship form
        if ((data.products || []).length > 0) {
          setShipForm(f => ({ ...f, productId: String(data.products[0].id) }));
        }
        setWooLoading(false);
      })
      .catch(e => {
        setWooError(e.message || "Failed to load WooCommerce products");
        setWooLoading(false);
      });
  }, []);

  useEffect(() => {
    setPostizLoading(true);
    fetch("/api/admin/origins-post")
      .then(r => r.json())
      .then(data => {
        setPostizChannels(data.channels || []);
        if (!data.ok && data.error) setPostizError(data.error);
        setPostizLoading(false);
      })
      .catch(e => {
        setPostizError(e.message || "Failed to load channels");
        setPostizLoading(false);
      });
  }, []);

  async function handlePostSubmit() {
    if (selectedChannels.size === 0 || !postContent.trim()) return;
    setPostSubmitting(true);
    setPostResult(null);
    try {
      const r = await fetch("/api/admin/origins-post", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          integrationIds: [...selectedChannels],
          content: postContent,
          imageUrl: postImageUrl || undefined,
          type: postType,
          scheduledAt: postType === "schedule" && scheduleDate ? new Date(scheduleDate).toISOString() : undefined,
        }),
      });
      const data = await r.json();
      if (data.ok) {
        setPostResult({ ok: true, msg: postType === "draft" ? `Saved as draft on ${data.postCount} channel(s).` : postType === "schedule" ? `Scheduled on ${data.postCount} channel(s).` : `Posted to ${data.postCount} channel(s)!` });
        setPostContent("");
        setPostImageUrl("");
        setSelectedChannels(new Set());
      } else {
        setPostResult({ ok: false, msg: data.error || "Post failed" });
      }
    } catch (e) {
      setPostResult({ ok: false, msg: e instanceof Error ? e.message : "Unknown error" });
    }
    setPostSubmitting(false);
  }

  const PLATFORM_ICONS: Record<string, string> = {
    instagram: "📸",
    facebook: "👤",
    tiktok: "🎵",
    linkedin: "💼",
    "linkedin-page": "🏢",
    youtube: "▶️",
    threads: "🧵",
    x: "✕",
    twitter: "✕",
    pinterest: "📌",
    gmb: "📍",
  };

  function saveShipped(orders: any[]) {
    setShippedOrders(orders);
    localStorage.setItem("wg_origins_shipped", JSON.stringify(orders));
  }

  function handleMarkShipped() {
    if (!allChecked) return;
    const product = wooProducts.find(p => String(p.id) === shipForm.productId);
    const entry = {
      id: Date.now(),
      orderRef: shipForm.orderRef,
      customerName: shipForm.customerName,
      productId: shipForm.productId,
      productName: product?.name || "Unknown product",
      qty: shipForm.qty,
      date: new Date().toISOString(),
      checklistConfirmed: true,
    };
    saveShipped([entry, ...shippedOrders]);
    // Reset form
    setShipForm({ orderRef: "", customerName: "", productId: wooProducts[0] ? String(wooProducts[0].id) : "", qty: 1 });
    setChecklist(CHECKLIST_STEPS.map(() => false));
  }

  const cardS: React.CSSProperties = { background: T.surface, border: `1px solid ${T.border}`, borderRadius: 12, padding: "18px 20px" };
  const labelS: React.CSSProperties = { fontSize: 10, fontWeight: 700, color: T.textMuted, textTransform: "uppercase", letterSpacing: "0.1em", marginBottom: 10 };
  const inputS: React.CSSProperties = { width: "100%", background: T.raised, border: `1px solid ${T.border}`, borderRadius: 7, padding: "7px 10px", color: T.text, fontSize: 12, outline: "none", boxSizing: "border-box" };

  return (
    <div style={{ maxWidth: 900, margin: "0 auto", display: "flex", flexDirection: "column", gap: 20 }}>
      {/* Header */}
      <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
        <div style={{ width: 44, height: 44, borderRadius: 12, background: "linear-gradient(135deg,#00d4a0,#4f9eff)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 22 }}>&#x2B21;</div>
        <div>
          <div style={{ fontSize: 20, fontWeight: 900, color: T.text, letterSpacing: "-0.02em" }}>3D Origins</div>
          <div style={{ fontSize: 12, color: T.textMuted }}>3dorigins.com.au — Hex Coasters & Custom 3D Prints</div>
        </div>
        <a href="https://3dorigins.com.au" target="_blank" rel="noreferrer" style={{ marginLeft: "auto", fontSize: 12, color: T.blue, textDecoration: "none", border: `1px solid ${T.blue}40`, borderRadius: 7, padding: "5px 12px", fontWeight: 600 }}>Open Store &#x2192;</a>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
        {/* WooCommerce Products */}
        <div style={cardS}>
          <div style={labelS}>WooCommerce Products</div>
          {wooLoading && (
            <div style={{ fontSize: 12, color: T.textMuted, textAlign: "center", padding: "20px 0" }}>Loading products...</div>
          )}
          {wooError && (
            <div style={{ fontSize: 12, color: "#ff6b6b", background: "#ff6b6b10", border: "1px solid #ff6b6b30", borderRadius: 8, padding: "10px 14px" }}>
              Failed to load: {wooError}
            </div>
          )}
          {!wooLoading && !wooError && wooProducts.length === 0 && (
            <div style={{ fontSize: 12, color: T.textMuted, textAlign: "center", padding: "20px 0" }}>No products found.</div>
          )}
          {!wooLoading && wooProducts.map(p => {
            const qty = p.stock_quantity;
            const isLow = qty !== null && qty < 5;
            return (
              <div key={p.id} style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 10, padding: "8px 10px", borderRadius: 8, background: isLow ? "#ff6b6b10" : T.raised, border: `1px solid ${isLow ? "#ff6b6b30" : T.border}` }}>
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: 12, fontWeight: 700, color: T.text }}>{p.name}</div>
                  {p.sku && <div style={{ fontSize: 10, color: T.textMuted, marginTop: 2 }}>SKU: {p.sku}</div>}
                </div>
                <div style={{ textAlign: "right" as const }}>
                  <div style={{ fontSize: 13, fontWeight: 800, color: isLow ? "#ff6b6b" : "#00d4a0" }}>
                    {qty === null ? "--" : qty}
                    <span style={{ fontSize: 10, color: T.textMuted, fontWeight: 400, marginLeft: 3 }}>units</span>
                  </div>
                  <div style={{ fontSize: 11, fontWeight: 600, color: T.textSec }}>${parseFloat(p.price || "0").toFixed(2)}</div>
                </div>
              </div>
            );
          })}
        </div>

        {/* Ship Order Checklist */}
        <div style={cardS}>
          <div style={labelS}>Ship Order</div>
          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
              <div>
                <div style={{ fontSize: 11, color: T.textMuted, marginBottom: 4 }}>Order #</div>
                <input value={shipForm.orderRef} onChange={e => setShipForm(f => ({ ...f, orderRef: e.target.value }))} placeholder="e.g. #1042"
                  style={inputS} />
              </div>
              <div>
                <div style={{ fontSize: 11, color: T.textMuted, marginBottom: 4 }}>Customer name</div>
                <input value={shipForm.customerName} onChange={e => setShipForm(f => ({ ...f, customerName: e.target.value }))} placeholder="e.g. Jane Smith"
                  style={inputS} />
              </div>
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr auto", gap: 8 }}>
              <div>
                <div style={{ fontSize: 11, color: T.textMuted, marginBottom: 4 }}>Product</div>
                <select value={shipForm.productId} onChange={e => setShipForm(f => ({ ...f, productId: e.target.value }))}
                  style={inputS} disabled={wooLoading || wooProducts.length === 0}>
                  {wooLoading && <option>Loading...</option>}
                  {wooProducts.map(p => (
                    <option key={p.id} value={String(p.id)}>{p.name}</option>
                  ))}
                </select>
              </div>
              <div>
                <div style={{ fontSize: 11, color: T.textMuted, marginBottom: 4 }}>Qty</div>
                <input type="number" min="1" value={shipForm.qty} onChange={e => setShipForm(f => ({ ...f, qty: parseInt(e.target.value) || 1 }))}
                  style={{ ...inputS, width: 60 }} />
              </div>
            </div>

            {/* Checklist */}
            <div style={{ background: T.raised, border: `1px solid ${T.border}`, borderRadius: 8, padding: "10px 14px", display: "flex", flexDirection: "column", gap: 7 }}>
              {CHECKLIST_STEPS.map((step, i) => (
                <label key={step} style={{ display: "flex", alignItems: "center", gap: 8, cursor: "pointer", fontSize: 12, color: checklist[i] ? "#00d4a0" : T.text }}>
                  <div
                    onClick={() => setChecklist(c => c.map((v, j) => j === i ? !v : v))}
                    style={{
                      width: 16, height: 16, borderRadius: 4, border: `2px solid ${checklist[i] ? "#00d4a0" : T.border}`,
                      background: checklist[i] ? "#00d4a020" : "transparent",
                      display: "flex", alignItems: "center", justifyContent: "center",
                      flexShrink: 0, cursor: "pointer", transition: "all 0.15s ease",
                    }}
                  >
                    {checklist[i] && <span style={{ fontSize: 10, color: "#00d4a0", fontWeight: 700 }}>&#x2713;</span>}
                  </div>
                  <span style={{ textDecoration: checklist[i] ? "line-through" : "none", opacity: checklist[i] ? 0.7 : 1 }}>{step}</span>
                </label>
              ))}
            </div>

            <button
              onClick={handleMarkShipped}
              disabled={!allChecked}
              style={{
                background: allChecked ? "linear-gradient(135deg,#00d4a0,#4f9eff)" : T.raised,
                border: allChecked ? "none" : `1px solid ${T.border}`,
                borderRadius: 9, padding: "10px", fontSize: 13, fontWeight: 700,
                color: allChecked ? "#fff" : T.textMuted,
                cursor: allChecked ? "pointer" : "not-allowed",
                transition: "all 0.2s ease",
              }}
            >
              Mark as Shipped
            </button>
          </div>
        </div>
      </div>

      {/* Shipped Orders Log */}
      {shippedOrders.length > 0 && (
        <div style={cardS}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 14 }}>
            <div style={labelS}>Shipped Orders ({shippedOrders.length})</div>
            <button onClick={() => { if (confirm("Clear all shipped order history?")) saveShipped([]); }}
              style={{ fontSize: 11, color: T.red, background: "none", border: `1px solid ${T.red}30`, borderRadius: 6, padding: "3px 10px", cursor: "pointer" }}>
              Clear all
            </button>
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 6, maxHeight: 280, overflowY: "auto" }}>
            {shippedOrders.map((o: any) => (
              <div key={o.id} style={{ display: "flex", alignItems: "center", gap: 10, padding: "8px 12px", background: T.raised, borderRadius: 8, border: `1px solid ${T.border}` }}>
                <div style={{ width: 6, height: 6, borderRadius: "50%", background: "#00d4a0", flexShrink: 0 }} />
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: 12, fontWeight: 700, color: T.text }}>{o.orderRef ? `#${o.orderRef.replace(/^#/, "")} -- ` : ""}{o.productName} x{o.qty}</div>
                  {o.customerName && <div style={{ fontSize: 11, color: T.textMuted }}>{o.customerName}</div>}
                </div>
                <div style={{ fontSize: 10, color: "#00d4a0", fontWeight: 700 }}>&#x2713; Shipped</div>
                <div style={{ fontSize: 10, color: T.textMuted }}>{new Date(o.date).toLocaleDateString("en-AU", { day: "numeric", month: "short" })}</div>
                <button onClick={() => saveShipped(shippedOrders.filter((x: any) => x.id !== o.id))}
                  style={{ fontSize: 11, color: T.textMuted, background: "none", border: "none", cursor: "pointer", padding: "2px 6px" }}>&#x2715;</button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Postiz Social Post */}
      <div style={cardS}>
        <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 16 }}>
          <div style={{ fontSize: 18 }}>📡</div>
          <div style={labelS}>Post to Social Media</div>
          {postizLoading && <div style={{ fontSize: 11, color: T.textMuted, marginLeft: "auto" }}>Loading channels...</div>}
          {!postizLoading && postizChannels.length > 0 && (
            <div style={{ fontSize: 11, color: "#00d4a0", marginLeft: "auto" }}>{postizChannels.length} channel{postizChannels.length !== 1 ? "s" : ""} connected</div>
          )}
        </div>

        {postizError && !postizLoading && (
          <div style={{ fontSize: 12, color: "#ff6b6b", background: "#ff6b6b10", border: "1px solid #ff6b6b30", borderRadius: 8, padding: "10px 14px", marginBottom: 14 }}>
            {postizError}
          </div>
        )}

        {!postizLoading && postizChannels.length === 0 && !postizError && (
          <div style={{ fontSize: 12, color: T.textMuted, textAlign: "center", padding: "16px 0" }}>
            No channels connected in Postiz yet.
          </div>
        )}

        {postizChannels.length > 0 && (
          <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
            {/* Channel selector */}
            <div>
              <div style={{ fontSize: 11, color: T.textMuted, marginBottom: 8 }}>Select channels</div>
              <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
                {postizChannels.map(ch => {
                  const active = selectedChannels.has(ch.id);
                  return (
                    <button
                      key={ch.id}
                      onClick={() => setSelectedChannels(prev => {
                        const next = new Set(prev);
                        if (next.has(ch.id)) next.delete(ch.id); else next.add(ch.id);
                        return next;
                      })}
                      style={{
                        display: "flex", alignItems: "center", gap: 6,
                        padding: "6px 12px", borderRadius: 20, cursor: "pointer", fontSize: 12, fontWeight: 600,
                        border: `1.5px solid ${active ? "#4f9eff" : T.border}`,
                        background: active ? "#4f9eff18" : T.raised,
                        color: active ? "#4f9eff" : T.textSec,
                        transition: "all 0.15s ease",
                      }}
                    >
                      <span>{PLATFORM_ICONS[ch.platform] || "🌐"}</span>
                      <span>{ch.name}</span>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Caption */}
            <div>
              <div style={{ fontSize: 11, color: T.textMuted, marginBottom: 6 }}>Caption</div>
              <textarea
                value={postContent}
                onChange={e => setPostContent(e.target.value)}
                placeholder="Write your post caption..."
                rows={4}
                style={{ ...inputS, resize: "vertical", fontFamily: "inherit", lineHeight: 1.5 }}
              />
              <div style={{ fontSize: 10, color: T.textMuted, textAlign: "right", marginTop: 3 }}>
                {postContent.length} chars
              </div>
            </div>

            {/* Image Upload (drag-drop or click) */}
            <div>
              <div style={{ fontSize: 11, color: T.textMuted, marginBottom: 6 }}>
                Image <span style={{ opacity: 0.6 }}>(optional)</span>
                {postImageUploading && <span style={{ marginLeft: 8, color: T.blue }}>Uploading…</span>}
              </div>
              {/* Drop zone */}
              <div
                onDragOver={e => { e.preventDefault(); setPostDropActive(true); }}
                onDragLeave={() => setPostDropActive(false)}
                onDrop={async e => {
                  e.preventDefault(); setPostDropActive(false);
                  const file = e.dataTransfer.files[0];
                  if (!file) return;
                  setPostImageUploading(true);
                  try {
                    const fd = new FormData(); fd.append("file", file);
                    const r = await fetch("/api/admin/upload-social-image", { method: "POST", body: fd });
                    const d = await r.json();
                    if (d.ok) setPostImageUrl(d.url);
                    else alert("Upload failed: " + (d.error || "unknown"));
                  } catch (err) { alert("Upload error: " + err); }
                  setPostImageUploading(false);
                }}
                onClick={() => { const inp = document.createElement("input"); inp.type="file"; inp.accept="image/*,video/*"; inp.onchange=async(ev)=>{ const file=(ev.target as HTMLInputElement).files?.[0]; if(!file)return; setPostImageUploading(true); try{ const fd=new FormData(); fd.append("file",file); const r=await fetch("/api/admin/upload-social-image",{method:"POST",body:fd}); const d=await r.json(); if(d.ok)setPostImageUrl(d.url); else alert("Upload failed: "+(d.error||"unknown")); }catch(err){alert("Upload error: "+err);} setPostImageUploading(false); }; inp.click(); }}
                style={{
                  border: `2px dashed ${postDropActive ? "#4f9eff" : postImageUrl ? "#00d4a050" : T.border}`,
                  borderRadius: 10,
                  padding: postImageUrl ? "8px" : "20px 12px",
                  textAlign: "center" as const,
                  cursor: "pointer",
                  background: postDropActive ? "#4f9eff10" : postImageUrl ? "#00d4a008" : T.raised,
                  transition: "all 0.15s ease",
                  position: "relative" as const,
                }}
              >
                {postImageUrl ? (
                  <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                    <img src={postImageUrl} alt="Preview" style={{ width: 56, height: 56, objectFit: "cover", borderRadius: 7, flexShrink: 0 }}/>
                    <div style={{ flex: 1, textAlign: "left" as const }}>
                      <div style={{ fontSize: 11, color: T.text, fontWeight: 600, wordBreak: "break-all" as const }}>{postImageUrl.split("/").pop()?.slice(0,40)}</div>
                      <div style={{ fontSize: 10, color: T.textMuted, marginTop: 2 }}>Click or drop to replace</div>
                    </div>
                    <button
                      onClick={e => { e.stopPropagation(); setPostImageUrl(""); }}
                      style={{ background: "none", border: `1px solid ${T.red}40`, color: T.red, borderRadius: 6, padding: "3px 8px", fontSize: 11, cursor: "pointer", flexShrink: 0 }}
                    >✕</button>
                  </div>
                ) : (
                  <div>
                    <div style={{ fontSize: 22, marginBottom: 6 }}>🖼️</div>
                    <div style={{ fontSize: 12, color: T.textSec, fontWeight: 600 }}>Drop image here or click to browse</div>
                    <div style={{ fontSize: 10, color: T.textMuted, marginTop: 3 }}>PNG, JPG, GIF, MP4 up to 20MB</div>
                  </div>
                )}
              </div>
              {/* Manual URL fallback */}
              <input
                value={postImageUrl}
                onChange={e => setPostImageUrl(e.target.value)}
                placeholder="Or paste image URL directly…"
                style={{ ...inputS, marginTop: 6, fontSize: 11, opacity: 0.7 }}
              />
            </div>

            {/* Post type + schedule date */}
            <div style={{ display: "grid", gridTemplateColumns: postType === "schedule" ? "1fr 1fr" : "1fr", gap: 10 }}>
              <div>
                <div style={{ fontSize: 11, color: T.textMuted, marginBottom: 6 }}>When</div>
                <select value={postType} onChange={e => setPostType(e.target.value as "now" | "draft" | "schedule")} style={inputS}>
                  <option value="now">Post now</option>
                  <option value="draft">Save as draft</option>
                  <option value="schedule">Schedule for later</option>
                </select>
              </div>
              {postType === "schedule" && (
                <div>
                  <div style={{ fontSize: 11, color: T.textMuted, marginBottom: 6 }}>Date &amp; time</div>
                  <input
                    type="datetime-local"
                    value={scheduleDate}
                    onChange={e => setScheduleDate(e.target.value)}
                    style={inputS}
                  />
                </div>
              )}
            </div>

            {/* Result message */}
            {postResult && (
              <div style={{
                fontSize: 12, padding: "10px 14px", borderRadius: 8,
                background: postResult.ok ? "#00d4a010" : "#ff6b6b10",
                border: `1px solid ${postResult.ok ? "#00d4a030" : "#ff6b6b30"}`,
                color: postResult.ok ? "#00d4a0" : "#ff6b6b",
              }}>
                {postResult.ok ? "✓ " : "✕ "}{postResult.msg}
              </div>
            )}

            {/* Submit */}
            <button
              onClick={handlePostSubmit}
              disabled={postSubmitting || selectedChannels.size === 0 || !postContent.trim() || (postType === "schedule" && !scheduleDate)}
              style={{
                background: (!postSubmitting && selectedChannels.size > 0 && postContent.trim())
                  ? "linear-gradient(135deg,#4f9eff,#a78bfa)"
                  : T.raised,
                border: "none", borderRadius: 9, padding: "11px",
                fontSize: 13, fontWeight: 700,
                color: (!postSubmitting && selectedChannels.size > 0 && postContent.trim()) ? "#fff" : T.textMuted,
                cursor: (!postSubmitting && selectedChannels.size > 0 && postContent.trim()) ? "pointer" : "not-allowed",
                transition: "all 0.2s ease",
              }}
            >
              {postSubmitting ? "Posting..." : postType === "draft" ? "Save Draft" : postType === "schedule" ? "Schedule Post" : "Post Now"}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}


// ── Pricing View ───────────────────────────────────────────────────────────────
function PricingView() {
  const [editMode, setEditMode] = useState(false);

  const sectionHead = (label: string, color: string): React.CSSProperties => ({
    fontSize: 11, fontWeight: 800, color, textTransform: "uppercase", letterSpacing: "0.12em", marginBottom: 14,
    paddingBottom: 8, borderBottom: `2px solid ${color}30`,
  });
  const card: React.CSSProperties = {
    background: T.surface, border: `1px solid ${T.border}`, borderRadius: 14, padding: "22px 24px", boxShadow: T.shadow,
  };
  const th: React.CSSProperties = {
    fontSize: 10, fontWeight: 800, color: T.textMuted, textTransform: "uppercase", letterSpacing: "0.09em",
    padding: "8px 14px", textAlign: "left", borderBottom: `1px solid ${T.border}`,
  };
  const td: React.CSSProperties = {
    fontSize: 12, color: T.text, padding: "10px 14px", borderBottom: `1px solid ${T.border}20`,
    verticalAlign: "top",
  };
  const tdMuted: React.CSSProperties = { ...td, color: T.textMuted, fontSize: 11 };
  const pill = (color: string, text: string) => (
    <span style={{ fontSize: 10, fontWeight: 700, color, background: color+"18", border: `1px solid ${color}40`, borderRadius: 20, padding: "2px 8px", display: "inline-block" }}>{text}</span>
  );
  const money = (n: number) => `$${n.toLocaleString()}`;
  const strike = (n: number) => <span style={{ textDecoration: "line-through", color: T.red, opacity: 0.7, marginLeft: 6, fontSize: 11 }}>{money(n)}</span>;

  return (
    <div style={{ display: "flex", flexDirection: "column" as const, gap: 28, maxWidth: 1100 }}>

      {/* Header */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <div>
          <div style={{ fontSize: 22, fontWeight: 900, color: T.text, letterSpacing: "-0.02em" }}>WebGecko Pricing</div>
          <div style={{ fontSize: 12, color: T.textMuted, marginTop: 3 }}>Internal reference — all prices in AUD incl. GST</div>
        </div>
        <div style={{ fontSize: 11, color: T.textMuted, background: T.raised, border: `1px solid ${T.border}`, borderRadius: 8, padding: "6px 14px" }}>
          🔒 Admin only
        </div>
      </div>

      {/* ── WEBSITE PACKAGES ─────────────────────────────────────────────────── */}
      <div style={card}>
        <div style={sectionHead("🌐  Website Build Packages", T.blue)}>🌐  Website Build Packages</div>
        <table style={{ width: "100%", borderCollapse: "collapse" as const }}>
          <thead>
            <tr>
              <th style={th}>Package</th>
              <th style={th}>Pages</th>
              <th style={{ ...th, color: T.green }}>Our Price</th>
              <th style={{ ...th, color: T.red, opacity: 0.7 }}>Competitor</th>
              <th style={{ ...th, color: T.amber }}>Client Saves</th>
              <th style={th}>Deposit (50%)</th>
              <th style={th}>Final (50%)</th>
              <th style={th}>Includes</th>
            </tr>
          </thead>
          <tbody>
            {[
              { name: "Starter", badge: T.green, pages: "1–3", price: 1500, competitor: 3000, includes: "AI build, hosting setup, analytics, contact form, mobile responsive" },
              { name: "Business", badge: T.blue, pages: "4–6", price: 2400, competitor: 6500, includes: "All Starter + multi-page nav, booking or gallery, SEO optimised" },
              { name: "Premium", badge: T.purple, pages: "7+", price: 3800, competitor: 12000, includes: "All Business + shop/payments, full feature suite, priority support" },
            ].map(p => (
              <tr key={p.name} style={{ transition: "background 0.1s" }} onMouseEnter={e=>(e.currentTarget.style.background=T.raised)} onMouseLeave={e=>(e.currentTarget.style.background="")}>
                <td style={td}><span style={{ fontWeight: 700, color: p.badge }}>{p.name}</span></td>
                <td style={tdMuted}>{p.pages} pages</td>
                <td style={{ ...td, fontWeight: 800, color: T.green }}>{money(p.price)}</td>
                <td style={{ ...td, color: T.red, opacity: 0.7, textDecoration: "line-through" }}>{money(p.competitor)}</td>
                <td style={{ ...td, fontWeight: 700, color: T.amber }}>{money(p.competitor - p.price)}</td>
                <td style={td}>{money(Math.round(p.price * 0.5))}</td>
                <td style={td}>{money(p.price - Math.round(p.price * 0.5))}</td>
                <td style={{ ...tdMuted, maxWidth: 260, lineHeight: 1.5 }}>{p.includes}</td>
              </tr>
            ))}
          </tbody>
        </table>

        {/* Add-ons */}
        <div style={{ marginTop: 20 }}>
          <div style={{ fontSize: 10, fontWeight: 700, color: T.textMuted, textTransform: "uppercase" as const, letterSpacing: "0.09em", marginBottom: 10 }}>Add-ons (bolt-on to any package)</div>
          <div style={{ display: "flex", flexWrap: "wrap" as const, gap: 8 }}>
            {[
              ["Booking System", 400],
              ["Payments / Shop", 600],
              ["Blog", 200],
              ["Photo Gallery", 150],
              ["Reviews & Testimonials", 100],
              ["Live Chat", 150],
              ["Newsletter Signup", 100],
              ["Video Background", 200],
            ].map(([name, price]) => (
              <div key={name as string} style={{ background: T.raised, border: `1px solid ${T.border}`, borderRadius: 8, padding: "7px 14px", display: "flex", gap: 10, alignItems: "center" }}>
                <span style={{ fontSize: 12, color: T.text, fontWeight: 600 }}>{name}</span>
                <span style={{ fontSize: 12, color: T.amber, fontWeight: 800 }}>+{money(price as number)}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* ── MONTHLY HOSTING ──────────────────────────────────────────────────── */}
      <div style={card}>
        <div style={sectionHead("📅  Monthly Hosting & Maintenance", T.cyan)}>📅  Monthly Hosting & Maintenance</div>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 14 }}>
          {[
            { label: "Months 1–3 (Intro rate)", price: 109, note: "Charged after build is live", color: T.green },
            { label: "Month 4+ (Ongoing)", price: 119, note: "Auto-billing, cancel anytime", color: T.blue },
            { label: "Floor / minimum", price: 99, note: "Never quote below this — covers hosting + SSL", color: T.amber },
          ].map(m => (
            <div key={m.label} style={{ background: T.raised, border: `1px solid ${m.color}30`, borderRadius: 10, padding: "16px 18px" }}>
              <div style={{ fontSize: 11, color: T.textMuted, marginBottom: 6, fontWeight: 600 }}>{m.label}</div>
              <div style={{ fontSize: 24, fontWeight: 800, color: m.color }}>{money(m.price)}<span style={{ fontSize: 12, fontWeight: 500, color: T.textMuted }}>/mo</span></div>
              <div style={{ fontSize: 10, color: T.textMuted, marginTop: 6, lineHeight: 1.5 }}>{m.note}</div>
            </div>
          ))}
        </div>
      </div>

      {/* ── SOCIAL MEDIA PACKAGES ─────────────────────────────────────────────── */}
      <div style={card}>
        <div style={sectionHead("📱  Social Media Management", T.purple)}>📱  Social Media Management</div>
        <table style={{ width: "100%", borderCollapse: "collapse" as const }}>
          <thead>
            <tr>
              <th style={th}>Plan</th>
              <th style={th}>Monthly Price</th>
              <th style={th}>Posts / Week</th>
              <th style={th}>Platforms</th>
              <th style={th}>AI Generation</th>
              <th style={th}>Reporting</th>
              <th style={th}>Extras</th>
            </tr>
          </thead>
          <tbody>
            {[
              {
                name: "Social Starter", color: T.green, price: 299,
                posts: "3×/week", platforms: "1 platform", ai: "Captions + hashtags",
                reporting: "Monthly PDF report", extras: "Post approval via portal",
              },
              {
                name: "Social Growth", color: T.blue, price: 499,
                posts: "5×/week", platforms: "Up to 3 platforms", ai: "Captions, hashtags, schedule times",
                reporting: "Bi-weekly report + analytics", extras: "Client media uploads, competitor hashtags",
              },
              {
                name: "Social Pro", color: T.purple, price: 799,
                posts: "Daily + stories", platforms: "5+ platforms", ai: "AI + human review",
                reporting: "Weekly + live dashboard", extras: "Ad management, reel scripting, influencer brief",
              },
            ].map(p => (
              <tr key={p.name} onMouseEnter={e=>(e.currentTarget.style.background=T.raised)} onMouseLeave={e=>(e.currentTarget.style.background="")}>
                <td style={td}><span style={{ fontWeight: 700, color: p.color }}>{p.name}</span></td>
                <td style={{ ...td, fontWeight: 800, color: T.green }}>{money(p.price)}<span style={{ fontSize: 10, color: T.textMuted, fontWeight: 400 }}>/mo</span></td>
                <td style={tdMuted}>{p.posts}</td>
                <td style={tdMuted}>{p.platforms}</td>
                <td style={tdMuted}>{p.ai}</td>
                <td style={tdMuted}>{p.reporting}</td>
                <td style={{ ...tdMuted, lineHeight: 1.5 }}>{p.extras}</td>
              </tr>
            ))}
          </tbody>
        </table>
        <div style={{ marginTop: 12, fontSize: 11, color: T.textMuted, fontStyle: "italic" }}>
          * Social setup fee (one-time): $149 — covers channel audit, bio optimisation, content calendar setup. Waived for Website + Social bundles.
        </div>
      </div>

      {/* ── BUNDLE (PERFORMANCE PLAN) ─────────────────────────────────────────── */}
      <div style={{ ...card, border: `1px solid ${T.amber}40`, background: `linear-gradient(135deg,${T.surface},${T.amber}08)` }}>
        <div style={sectionHead("⚡  Performance Plan Bundles (Website + Social)", T.amber)}>⚡  Performance Plan Bundles (Website + Social)</div>
        <div style={{ fontSize: 11, color: T.textMuted, marginBottom: 16, lineHeight: 1.6 }}>
          Clients who take both website + social get a <strong style={{ color: T.amber }}>15% discount on monthly social</strong> and the social setup fee is waived. Position this as the "done-for-you growth system".
        </div>
        <table style={{ width: "100%", borderCollapse: "collapse" as const }}>
          <thead>
            <tr>
              <th style={th}>Bundle</th>
              <th style={th}>Build Cost (one-time)</th>
              <th style={th}>Monthly (incl. social disc.)</th>
              <th style={th}>vs. buying separately</th>
              <th style={th}>Best for</th>
            </tr>
          </thead>
          <tbody>
            {[
              {
                name: "Starter + Social Starter",
                build: 1500, standardMonthly: 109 + 299, discountedMonthly: Math.round((109 + 299 * 0.85)),
                bestFor: "New small businesses, tradies, solo operators",
              },
              {
                name: "Business + Social Growth",
                build: 2400, standardMonthly: 109 + 499, discountedMonthly: Math.round((109 + 499 * 0.85)),
                bestFor: "Growing businesses wanting leads + brand presence",
              },
              {
                name: "Premium + Social Pro",
                build: 3800, standardMonthly: 119 + 799, discountedMonthly: Math.round((119 + 799 * 0.85)),
                bestFor: "Established businesses, restaurants, clinics, agencies",
              },
            ].map(b => (
              <tr key={b.name} onMouseEnter={e=>(e.currentTarget.style.background=T.raised)} onMouseLeave={e=>(e.currentTarget.style.background="")}>
                <td style={td}><span style={{ fontWeight: 700, color: T.amber }}>{b.name}</span></td>
                <td style={{ ...td, fontWeight: 700, color: T.text }}>{money(b.build)}</td>
                <td style={{ ...td, fontWeight: 800, color: T.green }}>
                  {money(b.discountedMonthly)}/mo
                  <span style={{ marginLeft: 6, fontSize: 10, color: T.amber, fontWeight: 700 }}>-15% social</span>
                </td>
                <td style={tdMuted}>
                  vs. {money(b.standardMonthly)}/mo separately
                  <span style={{ display: "block", color: T.green, fontSize: 10, fontWeight: 600 }}>
                    Save {money(b.standardMonthly - b.discountedMonthly)}/mo
                  </span>
                </td>
                <td style={{ ...tdMuted, lineHeight: 1.5 }}>{b.bestFor}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* ── DISCOUNTS & FLOORS ────────────────────────────────────────────────── */}
      <div style={card}>
        <div style={sectionHead("🏷️  Discounts & Floor Pricing", T.green)}>🏷️  Discounts & Floor Pricing</div>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 }}>
          {/* Discounts */}
          <div>
            <div style={{ fontSize: 11, fontWeight: 700, color: T.textSec, marginBottom: 10 }}>Available discounts</div>
            <div style={{ display: "flex", flexDirection: "column" as const, gap: 8 }}>
              {[
                { label: "Referral discount", value: "10% off build", note: "When referred client signs up — applied to referrer's next renewal" },
                { label: "Annual social upfront", value: "15% off social", note: "Client pays 12 months social upfront — better retention, better margin" },
                { label: "Bundle (Website + Social)", value: "15% off social monthly", note: "Automatic when both services active" },
                { label: "Multi-site / franchise", value: "Custom — call it", note: "2+ sites from same owner — negotiate but never below floor" },
                { label: "Early bird / promo", value: "Up to 20% off build", note: "Limited time only — flag to admin before applying" },
              ].map(d => (
                <div key={d.label} style={{ background: T.raised, border: `1px solid ${T.border}`, borderRadius: 8, padding: "10px 14px" }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 4 }}>
                    <span style={{ fontSize: 12, fontWeight: 600, color: T.text }}>{d.label}</span>
                    {pill(T.green, d.value)}
                  </div>
                  <div style={{ fontSize: 10, color: T.textMuted, lineHeight: 1.5 }}>{d.note}</div>
                </div>
              ))}
            </div>
          </div>
          {/* Floors */}
          <div>
            <div style={{ fontSize: 11, fontWeight: 700, color: T.textSec, marginBottom: 10 }}>Floor pricing — never quote below these</div>
            <div style={{ display: "flex", flexDirection: "column" as const, gap: 8 }}>
              {[
                { label: "Build floor (1-page)", value: "$1,200", note: "One-pager only — no add-ons. Covers AI time + deploy + support." },
                { label: "Build floor (multi-page)", value: "$1,500", note: "Starter package minimum, no negotiation." },
                { label: "Monthly hosting floor", value: "$99/mo", note: "Covers Vercel + Supabase + domain + support margin." },
                { label: "Social floor", value: "$249/mo", note: "2–3 posts/week, 1 platform — below this is unprofitable." },
                { label: "Social setup fee floor", value: "$99 one-time", note: "Only waive for bundles or referrals — not as a default." },
              ].map(f => (
                <div key={f.label} style={{ background: T.raised, border: `1px solid ${T.red}20`, borderRadius: 8, padding: "10px 14px" }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 4 }}>
                    <span style={{ fontSize: 12, fontWeight: 600, color: T.text }}>{f.label}</span>
                    {pill(T.red, f.value)}
                  </div>
                  <div style={{ fontSize: 10, color: T.textMuted, lineHeight: 1.5 }}>{f.note}</div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* ── QUICK QUOTE CHEATSHEET ────────────────────────────────────────────── */}
      <div style={{ ...card, border: `1px solid ${T.cyan}30` }}>
        <div style={sectionHead("⚡  Quick Quote Cheatsheet", T.cyan)}>⚡  Quick Quote Cheatsheet (use in calls)</div>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 14 }}>
          {[
            { scenario: "Tradie / 1-3 page site", quote: "$1,500 build + $109/mo", position: "Half of what a web agency charges. AI-built in 24 hrs, looks premium." },
            { scenario: "Small business + social", quote: "$2,400 build + $525/mo bundle", position: "Full growth system: website + daily social content for less than one employee's weekly cost." },
            { scenario: "Restaurant / cafe", quote: "$2,400 build + add-ons + social", position: "Menu page, bookings, Google Maps, reviews widget. Social does the marketing." },
            { scenario: "Healthcare / clinic", quote: "$3,800 Premium + booking", position: "Fully custom look, HIPAA-friendly contact forms, online booking, SEO optimised." },
            { scenario: "E-commerce / shop", quote: "$2,400+ with shop add-on $600", position: "Stripe payments, product pages, order confirmation — up in 48 hrs." },
            { scenario: "Client wants to negotiate", quote: "Max 10% off — never below floor", position: "Hold the price. Emphasise speed (24hr), quality, vs $6k+ agency alternative." },
          ].map(s => (
            <div key={s.scenario} style={{ background: T.raised, border: `1px solid ${T.border}`, borderRadius: 10, padding: "14px 16px" }}>
              <div style={{ fontSize: 10, fontWeight: 700, color: T.cyan, textTransform: "uppercase" as const, letterSpacing: "0.08em", marginBottom: 6 }}>{s.scenario}</div>
              <div style={{ fontSize: 13, fontWeight: 800, color: T.text, marginBottom: 8 }}>{s.quote}</div>
              <div style={{ fontSize: 11, color: T.textMuted, lineHeight: 1.6 }}>{s.position}</div>
            </div>
          ))}
        </div>
      </div>

    </div>
  );
}

function AdminDashboard() {
  const [dark, setDark] = useState(true);
  useEffect(()=>{ const s=localStorage.getItem("wg_admin_theme"); setDark(s!=="light"); },[]);
  T = dark ? DARK : LIGHT;

  const [clients, setClients] = useState<ClientAnalytics[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [view, setView] = useState<"workbook"|"analytics"|"clients"|"logs"|"social"|"history"|"3dorigins"|"pricing">("workbook");
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState<"all"|"active"|"building"|"unpaid">("all");
  const [sort, setSort] = useState<"views"|"name"|"status">("views");
  const [selectedClient, setSelectedClient] = useState<ClientAnalytics|null>(null);
  const [bulkSelected, setBulkSelected] = useState<Set<string>>(new Set());
  const [bulkDeleting, setBulkDeleting] = useState(false);
  const [clientSubTab, setClientSubTab] = useState<"all"|"website"|"social"|"both">("all");
  const { toasts, add: toast } = useToast();

  function openClient(c: ClientAnalytics) {
    setSelectedClient(c);
  }

  function toggleTheme() {
    const next=!dark; setDark(next);
    localStorage.setItem("wg_admin_theme",next?"dark":"light");
  }

  async function handleLogout() {
    try { await fetch("/api/admin/login", { method: "DELETE" }); } catch {}
    window.location.replace("/admin/login");
  }

  async function loadDashboard() {
    setLoading(true); setError("");
    try {
      const r=await fetch("/api/admin/clients");
      if(r.status===403){window.location.href="/admin/login";return;}
      if(!r.ok)throw new Error("Failed to load");
      const d=await r.json(); setClients(d.clients||[]);
    } catch(e){setError(e instanceof Error?e.message:"Failed");}
    finally{setLoading(false);}
  }

  async function bulkDelete() {
    if (bulkSelected.size === 0) return;
    const names = clients.filter(c => bulkSelected.has(c.jobId)).map(c => c.businessName).join(", ");
    if (!confirm(`Permanently delete ${bulkSelected.size} client(s)?\n\n${names}\n\nThis cannot be undone.`)) return;
    setBulkDeleting(true);
    try {
      const r = await fetch("/api/admin/delete-client", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ jobIds: [...bulkSelected] }),
      });
      const d = await r.json();
      if (d.ok || d.deleted > 0) {
        toast(`Deleted ${d.deleted} client(s)`, "ok");
        setBulkSelected(new Set());
        await loadDashboard();
      } else {
        toast(`Failed to delete: ${d.error || "unknown error"}`, "err");
      }
    } catch (e) {
      toast("Bulk delete failed", "err");
    } finally {
      setBulkDeleting(false);
    }
  }

  useEffect(()=>{
    loadDashboard();
    const iv=setInterval(async()=>{
      const r=await fetch("/api/admin/clients").catch(()=>null);
      if(!r||!r.ok)return;
      const d=await r.json().catch(()=>({}));
      const fresh:ClientAnalytics[]=d.clients||[];
      setClients(prev=>{
        const changed=fresh.some(f=>{const p=prev.find(p=>p.jobId===f.jobId);return !p||p.buildStatus!==f.buildStatus||p.previewUrl!==f.previewUrl||p.builtAt!==f.builtAt;});
        return changed?fresh:prev;
      });
    },8000);
    return ()=>clearInterval(iv);
  },[]);

  T = dark ? DARK : LIGHT;

  const filtered = clients
    .filter(c=>{
      const ms=!search||c.businessName.toLowerCase().includes(search.toLowerCase())||c.industry?.toLowerCase().includes(search.toLowerCase());
      const mf=filter==="all"?true:filter==="active"?c.paymentState?.monthlyActive:filter==="building"?c.buildStatus==="building":!c.paymentState?.depositPaid;
      return ms&&mf;
    })
    .sort((a,b)=>{
      if(sort==="name")return a.businessName.localeCompare(b.businessName);
      if(sort==="status"){const o=["building","completed","complete","pending","failed"];return o.indexOf(a.buildStatus)-o.indexOf(b.buildStatus);}
      return (b.analytics?.thisMonth.views||0)-(a.analytics?.thisMonth.views||0);
    });

  // Real 8-month sparkline: sum spark arrays across all clients
  const platformSpark = clients.reduce((acc, c) => {
    const s = c.analytics?.spark || new Array(8).fill(0);
    return acc.map((v:number, i:number) => v + (s[i] || 0));
  }, new Array(8).fill(0) as number[]);

  const totals = {
    clients:clients.length,
    active:clients.filter(c=>c.paymentState?.monthlyActive).length,
    views:clients.reduce((a,c)=>a+(c.analytics?.thisMonth.views||0),0),
    bookings:clients.reduce((a,c)=>a+c.bookingCount,0),
    mrr:clients.filter(c=>c.paymentState?.monthlyActive).length*109, // sync with MONTHLY_PRICE above
    totalViews:clients.reduce((a,c)=>a+(c.analytics?.totals.views||0),0),
    totalBookingClicks:clients.reduce((a,c)=>a+(c.analytics?.totals.bookingClicks||0),0),
    totalFormSubmits:clients.reduce((a,c)=>a+(c.analytics?.totals.formSubmits||0),0),
  };

  const inp:React.CSSProperties={flex:1,minWidth:200,background:T.raised,border:`1px solid ${T.border}`,borderRadius:9,padding:"9px 14px",color:T.text,fontSize:13,outline:"none",boxSizing:"border-box",fontFamily:"inherit",transition:"border-color 0.2s, box-shadow 0.2s"};

  return (
    <div className="wg-grid-bg" style={{ minHeight:"100vh", background:T.bg, color:T.text, fontFamily:"'Space Grotesk','Inter',-apple-system,sans-serif", transition:"background 0.25s, color 0.25s" }}>
      <style>{CSS}</style>
      <Toasts toasts={toasts}/>

      {/* ── Layout: sidebar + main ─────────────────────────────────────────── */}
      <div className="wg-admin-layout">

        {/* ── Sidebar (desktop) ─────────────────────────────────────────────── */}
        <aside className="wg-admin-sidebar" style={{ background: dark?"#090e1c":"#ffffff" }}>
          {/* Top gradient line */}
          <div style={{ height:2, background:"linear-gradient(90deg,#8347ff,#00d4a0,#4a9eff)", flexShrink:0 }}/>
          {/* Logo */}
          <div style={{ padding:"18px 16px 16px", borderBottom:`1px solid ${T.border}`, flexShrink:0 }}>
            <div style={{ display:"flex", alignItems:"center", gap:10, marginBottom:14 }}>
              <div style={{ width:34,height:34,borderRadius:10,background:"linear-gradient(135deg,#4f9eff,#9d6fff)",display:"flex",alignItems:"center",justifyContent:"center",boxShadow:"0 0 18px rgba(79,158,255,0.5)",fontSize:15,fontWeight:900,color:"#fff",flexShrink:0 }}>W</div>
              <div>
                <div className="wg-brand-text" style={{ fontSize:15,fontWeight:800,letterSpacing:"-0.04em" }}>WebGecko</div>
                <div style={{ fontSize:9,color:"#4f9eff",fontWeight:800,letterSpacing:"0.1em",textTransform:"uppercase" as const }}>Admin</div>
              </div>
            </div>
            {clients.some(c=>c.buildStatus==="building")&&(
              <div style={{ display:"flex",alignItems:"center",gap:6,background:T.amber+"14",border:`1px solid ${T.amber}35`,borderRadius:20,padding:"5px 12px" }}>
                <div style={{ position:"relative",width:6,height:6,flexShrink:0 }}>
                  <div style={{ position:"absolute",inset:0,borderRadius:"50%",background:T.amber,animation:"wg-ping 1.2s infinite" }}/>
                  <div style={{ position:"absolute",inset:0,borderRadius:"50%",background:T.amber }}/>
                </div>
                <span style={{ fontSize:11,color:T.amber,fontWeight:600 }}>{clients.filter(c=>c.buildStatus==="building").length} building</span>
              </div>
            )}
          </div>

          {/* Nav items */}
          <div style={{ flex:1, padding:"10px 0", overflowY:"auto" as const }}>
            {([
              { v:"workbook"  as const, label:"Strategy Board", svg:<svg width="15" height="15" viewBox="0 0 15 15" fill="none"><rect x="1" y="1" width="13" height="13" rx="1.5" stroke="currentColor" strokeWidth="1.5"/><line x1="1" y1="5" x2="14" y2="5" stroke="currentColor" strokeWidth="1.5"/><line x1="5" y1="5" x2="5" y2="14" stroke="currentColor" strokeWidth="1.5"/></svg> },
              { v:"analytics" as const, label:"System Stats",   svg:<svg width="15" height="15" viewBox="0 0 15 15" fill="none"><rect x="1" y="8" width="3" height="6" rx="1" fill="currentColor"/><rect x="6" y="5" width="3" height="9" rx="1" fill="currentColor"/><rect x="11" y="1" width="3" height="13" rx="1" fill="currentColor"/></svg> },
              { v:"clients"   as const, label:"Clients",      svg:<svg width="15" height="15" viewBox="0 0 15 15" fill="none"><circle cx="7.5" cy="5" r="3" stroke="currentColor" strokeWidth="1.5"/><path d="M2 13c0-3 2.5-5 5.5-5s5.5 2 5.5 5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/></svg> },
              { v:"social"    as const, label:"Social Media", svg:<svg width="15" height="15" viewBox="0 0 15 15" fill="none"><circle cx="3" cy="7.5" r="2" stroke="currentColor" strokeWidth="1.5"/><circle cx="12" cy="3" r="2" stroke="currentColor" strokeWidth="1.5"/><circle cx="12" cy="12" r="2" stroke="currentColor" strokeWidth="1.5"/><line x1="4.9" y1="6.5" x2="10.1" y2="4" stroke="currentColor" strokeWidth="1.3"/><line x1="4.9" y1="8.5" x2="10.1" y2="11" stroke="currentColor" strokeWidth="1.3"/></svg> },
              { v:"logs"      as const, label:"Pipeline",     svg:<svg width="15" height="15" viewBox="0 0 15 15" fill="none"><path d="M2 4h11M2 7.5h8M2 11h5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/></svg> },
              { v:"history"   as const, label:"History",      svg:<svg width="15" height="15" viewBox="0 0 15 15" fill="none"><circle cx="7.5" cy="7.5" r="5.5" stroke="currentColor" strokeWidth="1.5"/><path d="M7.5 4.5v3.5l2.5 1.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/></svg> },
              { v:"3dorigins" as const, label:"3D Origins", svg:<svg width="15" height="15" viewBox="0 0 15 15" fill="none"><path d="M7.5 1L13 4.5v6L7.5 14 2 10.5v-6L7.5 1z" stroke="currentColor" strokeWidth="1.4"/><path d="M7.5 5L11 7.5 7.5 10 4 7.5 7.5 5z" fill="currentColor" opacity="0.6"/></svg> },
              { v:"pricing"   as const, label:"Pricing",      svg:<svg width="15" height="15" viewBox="0 0 15 15" fill="none"><circle cx="7.5" cy="7.5" r="6" stroke="currentColor" strokeWidth="1.5"/><path d="M5.5 9.5c0 1.1.9 2 2 2s2-.9 2-2-.9-1.5-2-1.5S5.5 7.4 5.5 6.5c0-1 .9-2 2-2s2 1 2 2" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round"/><line x1="7.5" y1="3.5" x2="7.5" y2="4.5" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round"/><line x1="7.5" y1="10.5" x2="7.5" y2="11.5" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round"/></svg> },
            ]).map(({v,svg,label}) => (
              <button key={v} onClick={()=>setView(v)} className={`wg-sidebar-item${view===v?" active":""}`}
                style={{ color: view===v ? T.purple : T.textMuted }}>
                <span style={{ width:18,display:"flex",alignItems:"center",justifyContent:"center",flexShrink:0 }}>{svg}</span>
                <span>{label}</span>
              </button>
            ))}

            <div style={{ height:1, background:T.border, margin:"12px 16px" }}/>
            <button onClick={loadDashboard} className="wg-sidebar-item" style={{ color:T.textMuted }}>
              <span style={{ fontSize:14,width:18,textAlign:"center" as const }}>↻</span>
              <span>Refresh</span>
            </button>

          </div>

          {/* Sidebar footer */}
          <div style={{ padding:"12px 16px", borderTop:`1px solid ${T.border}`, flexShrink:0 }}>
            <button onClick={toggleTheme} className="wg-sidebar-item" style={{ color:T.textMuted, marginBottom:2 }}>
              <span style={{ fontSize:14,width:18,textAlign:"center" as const }}>{dark?"☀":"🌙"}</span>
              <span>{dark?"Light mode":"Dark mode"}</span>
            </button>
            <button onClick={handleLogout} className="wg-sidebar-item" style={{ color:T.red }}>
              <span style={{ fontSize:14,width:18,textAlign:"center" as const }}>↩</span>
              <span>Sign out</span>
            </button>
          </div>
        </aside>

        {/* ── Mobile top nav ──────────────────────────────────────────────────── */}
        <div className="wg-admin-topnav wg-glass" style={{ background: dark?"rgba(4,8,15,0.92)":"rgba(255,255,255,0.95)" }}>
          <div style={{ display:"flex",alignItems:"center",gap:10 }}>
            <div style={{ width:30,height:30,borderRadius:10,background:"linear-gradient(135deg,#4f9eff,#9d6fff)",display:"flex",alignItems:"center",justifyContent:"center",boxShadow:"0 0 18px rgba(79,158,255,0.5)",fontSize:13,fontWeight:900,color:"#fff",flexShrink:0 }}>W</div>
            <span className="wg-brand-text" style={{ fontSize:15,fontWeight:800 }}>WebGecko</span>
            <span style={{ fontSize:9,color:"#4f9eff",background:"rgba(79,158,255,0.15)",border:"1px solid rgba(79,158,255,0.25)",borderRadius:4,padding:"2px 7px",fontWeight:800,letterSpacing:"0.1em" }}>ADMIN</span>
          </div>
          <div style={{ display:"flex",gap:6,alignItems:"center" }}>
            {([
              { v:"workbook"  as const, svg:<svg width="14" height="14" viewBox="0 0 15 15" fill="none"><rect x="1" y="1" width="13" height="13" rx="1.5" stroke="currentColor" strokeWidth="1.5"/><line x1="1" y1="5" x2="14" y2="5" stroke="currentColor" strokeWidth="1.5"/><line x1="5" y1="5" x2="5" y2="14" stroke="currentColor" strokeWidth="1.5"/></svg> },
              { v:"analytics" as const, svg:<svg width="14" height="14" viewBox="0 0 15 15" fill="none"><rect x="1" y="8" width="3" height="6" rx="1" fill="currentColor"/><rect x="6" y="5" width="3" height="9" rx="1" fill="currentColor"/><rect x="11" y="1" width="3" height="13" rx="1" fill="currentColor"/></svg> },
              { v:"clients"   as const, svg:<svg width="14" height="14" viewBox="0 0 15 15" fill="none"><circle cx="7.5" cy="5" r="3" stroke="currentColor" strokeWidth="1.5"/><path d="M2 13c0-3 2.5-5 5.5-5s5.5 2 5.5 5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/></svg> },
              { v:"social"    as const, svg:<svg width="14" height="14" viewBox="0 0 15 15" fill="none"><circle cx="3" cy="7.5" r="2" stroke="currentColor" strokeWidth="1.5"/><circle cx="12" cy="3" r="2" stroke="currentColor" strokeWidth="1.5"/><circle cx="12" cy="12" r="2" stroke="currentColor" strokeWidth="1.5"/><line x1="4.9" y1="6.5" x2="10.1" y2="4" stroke="currentColor" strokeWidth="1.3"/><line x1="4.9" y1="8.5" x2="10.1" y2="11" stroke="currentColor" strokeWidth="1.3"/></svg> },
              { v:"logs"      as const, svg:<svg width="14" height="14" viewBox="0 0 15 15" fill="none"><path d="M2 4h11M2 7.5h8M2 11h5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/></svg> },
              { v:"history"   as const, svg:<svg width="14" height="14" viewBox="0 0 15 15" fill="none"><circle cx="7.5" cy="7.5" r="5.5" stroke="currentColor" strokeWidth="1.5"/><path d="M7.5 4.5v3.5l2.5 1.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/></svg> },
              { v:"3dorigins" as const, svg:<svg width="14" height="14" viewBox="0 0 15 15" fill="none"><path d="M7.5 1L13 4.5v6L7.5 14 2 10.5v-6L7.5 1z" stroke="currentColor" strokeWidth="1.4"/><path d="M7.5 5L11 7.5 7.5 10 4 7.5 7.5 5z" fill="currentColor" opacity="0.6"/></svg> },
              { v:"pricing"   as const, svg:<svg width="14" height="14" viewBox="0 0 15 15" fill="none"><circle cx="7.5" cy="7.5" r="6" stroke="currentColor" strokeWidth="1.5"/><path d="M5.5 9.5c0 1.1.9 2 2 2s2-.9 2-2-.9-1.5-2-1.5S5.5 7.4 5.5 6.5c0-1 .9-2 2-2s2 1 2 2" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round"/><line x1="7.5" y1="3.5" x2="7.5" y2="4.5" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round"/><line x1="7.5" y1="10.5" x2="7.5" y2="11.5" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round"/></svg> },
            ]).map(({v,svg}) => (
              <button key={v} onClick={()=>setView(v)} style={{ background:view===v?T.raised:"transparent", border:`1px solid ${view===v?T.border:"transparent"}`, borderRadius:7, width:32,height:30, display:"flex",alignItems:"center",justifyContent:"center", cursor:"pointer", color:view===v?T.text:T.textMuted }}>{svg}</button>
            ))}
            <button onClick={toggleTheme} style={{ background:T.raised,border:`1px solid ${T.border}`,color:T.textMuted,borderRadius:7,width:30,height:30,display:"flex",alignItems:"center",justifyContent:"center",cursor:"pointer",fontSize:13 }}>{dark?"☀":"🌙"}</button>
            <button onClick={handleLogout} style={{ background:"transparent",color:T.textMuted,border:`1px solid ${T.border}`,borderRadius:7,padding:"5px 10px",fontSize:11,cursor:"pointer" }}>Out</button>
          </div>
        </div>

        {/* ── Main content ────────────────────────────────────────────────────── */}
        <div className="wg-admin-main">
          <div style={{ maxWidth:"100%",padding:"28px 32px" }}>

        {/* Section label */}
        {!loading&&!error&&view==="analytics"&&(
          <div style={{ display:"flex",alignItems:"center",gap:10,marginBottom:18 }}>
            <div style={{ height:1,flex:1,background:"linear-gradient(90deg,rgba(79,158,255,0.3),transparent)" }}/>
            <span style={{ fontSize:10,fontWeight:800,letterSpacing:"0.14em",color:"rgba(79,158,255,0.6)",textTransform:"uppercase" as const }}>Platform Overview</span>
            <div style={{ height:1,flex:1,background:"linear-gradient(90deg,transparent,rgba(79,158,255,0.3))" }}/>
          </div>
        )}

        {/* Stats — analytics only */}
        {!loading&&!error&&view==="analytics"&&(
          <div style={{ display:"grid",gridTemplateColumns:"repeat(5,1fr)",gap:12,marginBottom:28 }}>
            {[
              {label:"Total clients",   value:totals.clients,                            color:T.blue,   spark:new Array(8).fill(0).map((_,i)=>i<clients.length?i+1:clients.length)},
              {label:"Monthly active",  value:totals.active,                             color:T.green,  spark:new Array(8).fill(0).map((_,i)=>i<totals.active?i+1:totals.active)},
              {label:"Est. MRR",        value:"$"+totals.mrr.toLocaleString(),           color:T.green,  spark:new Array(8).fill(0).map((_,i)=>totals.mrr*((i+1)/8))},
              {label:"Views / month",   value:totals.views,                              color:T.cyan,   spark:platformSpark},
              {label:"Total bookings",  value:totals.bookings,                           color:T.amber,  spark:new Array(8).fill(0).map((_,i)=>Math.round(totals.bookings*((i+1)/8)))},
            ].map(s=>(
              <div key={s.label} className="wg-card wg-stat-scan" style={{ background:T.surface,border:`1px solid ${s.color}28`,borderRadius:14,padding:"16px 18px 10px 22px",position:"relative",overflow:"hidden",transition:"border-color 0.2s, box-shadow 0.2s",boxShadow:`0 0 0 1px ${s.color}14, 0 6px 32px rgba(0,0,0,0.7), inset 0 1px 0 rgba(255,255,255,0.05)` }}
                onMouseEnter={e=>{const el=e.currentTarget as HTMLElement;el.style.borderColor=s.color+"55";el.style.boxShadow=`0 0 32px ${s.color}22, 0 8px 40px rgba(0,0,0,0.8), inset 0 1px 0 rgba(255,255,255,0.06)`;}}
                onMouseLeave={e=>{const el=e.currentTarget as HTMLElement;el.style.borderColor=s.color+"28";el.style.boxShadow=`0 0 0 1px ${s.color}14, 0 6px 32px rgba(0,0,0,0.7), inset 0 1px 0 rgba(255,255,255,0.05)`;}}>
                <div style={{ position:"absolute",left:0,top:0,bottom:0,width:4,borderRadius:"14px 0 0 14px",background:`linear-gradient(180deg,${s.color},${s.color}33)`,boxShadow:`2px 0 12px ${s.color}40` }}/>
                <div style={{ position:"absolute",top:0,right:0,width:80,height:80,background:`radial-gradient(circle at top right,${s.color}22,transparent 60%)`,pointerEvents:"none" }}/>
                <div style={{ display:"flex",alignItems:"center",gap:8,marginBottom:10 }}>
                  <div style={{ fontSize:9,color:T.textMuted,fontWeight:700,letterSpacing:"0.08em",textTransform:"uppercase" as const }}>{s.label}</div>
                </div>
                <div style={{ fontSize:26,fontWeight:800,letterSpacing:"-0.04em",lineHeight:1,marginBottom:8 }}>
                  {typeof s.value==="number" ? <AnimNum value={s.value} color={s.color}/> : <span style={{color:s.color}}>{s.value}</span>}
                </div>
                <div style={{ position:"absolute",bottom:0,right:0,opacity:0.7 }}>
                  <SparkLine data={s.spark} color={s.color} width={88} height={32}/>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Error */}
        {error&&<div style={{ background:T.red+"0a",border:`1px solid ${T.red}25`,borderRadius:10,padding:"14px 18px",color:T.red,marginBottom:20,fontSize:13 }}>{error}</div>}

        {/* Global selected-client panel (from Analytics view) */}
        {selectedClient&&<ClientPanel c={selectedClient} secret="" onClose={()=>setSelectedClient(null)} toast={toast}/>}

        {view==="workbook"&&(
          <div style={{ background:T.surface, borderRadius:12, border:`1px solid ${T.border}`, overflow:"hidden", boxShadow:T.shadowXl, marginBottom:28 }}>
            <iframe src="/webgecko-analytics-dashboard.html" style={{ width:"100%", height:"820px", border:"none", background:"transparent" }} title="WebGecko Strategy Board"/>
          </div>
        )}

        {view==="analytics"&&!loading&&!error&&(
          <AnalyticsView clients={clients} onOpenClient={openClient} onClearBuilding={async()=>{ const r=await fetch("/api/admin/clear-building-jobs",{method:"POST"}).then(r=>r.json()).catch(()=>({error:"Failed"})); if(r.error){alert("Error: "+r.error);return;} toast(`Cleared ${r.cleared} stuck job(s)`,"ok"); await loadDashboard(); }}/>
        )}

        {view==="logs"&&<PipelineLogsPanel/>}
        {view==="social"&&<SocialView clients={clients}/>}
        {view==="history"&&<HistoryView/>}
        {view==="3dorigins"&&<OriginsView/>}
        {view==="pricing"&&<PricingView/>}

        {view==="clients"&&(<>
        {/* Client grid header with service-type sub-tabs */}
        {(()=>{
          const websiteClients = filtered.filter((c:ClientAnalytics) => { const st=(c as any).metadata?.serviceType; return !st||st==="website"; });
          const socialClients  = filtered.filter((c:ClientAnalytics) => (c as any).metadata?.serviceType==="social");
          const bothClients    = filtered.filter((c:ClientAnalytics) => (c as any).metadata?.serviceType==="both");
          const displayClients = clientSubTab==="website" ? websiteClients : clientSubTab==="social" ? socialClients : clientSubTab==="both" ? bothClients : filtered;
          return (<>
          <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between", marginBottom:16, flexWrap:"wrap" as const, gap:10 }}>
            <div style={{ display:"flex", gap:3, background:T.raised, border:`1px solid ${T.border}`, borderRadius:10, padding:3 }}>
              {([
                { id:"all"     as const, label:"All Clients",    count:filtered.length },
                { id:"website" as const, label:"🌐 Website",     count:websiteClients.length },
                { id:"social"  as const, label:"📱 Social Only", count:socialClients.length },
                { id:"both"    as const, label:"⚡ Website + Social", count:bothClients.length },
              ]).map(t => (
                <button key={t.id} onClick={()=>setClientSubTab(t.id)}
                  className={clientSubTab===t.id?"wg-view-active":""}
                  style={{ padding:"6px 14px", fontSize:12, fontWeight:clientSubTab===t.id?700:400,
                    color:clientSubTab===t.id?T.text:T.textMuted, background:"transparent",
                    border:"1px solid transparent", borderRadius:7, cursor:"pointer",
                    transition:"all 0.15s", display:"flex", alignItems:"center", gap:6, whiteSpace:"nowrap" as const }}>
                  {t.label}
                  <span style={{ background:clientSubTab===t.id?T.blue+"30":T.raised, color:clientSubTab===t.id?T.blue:T.textMuted,
                    borderRadius:10, padding:"1px 7px", fontSize:10, fontWeight:700 }}>{t.count}</span>
                </button>
              ))}
            </div>
            <div style={{ fontSize:11, color:T.textMuted }}>
              {clientSubTab==="social" && "Clients with Social Media package only — no website"}
              {clientSubTab==="both"   && "Clients with both Website + Social Media active"}
              {clientSubTab==="website"&& "Clients with Website package only"}
            </div>
          </div>

        {/* Search + filters */}
        <div style={{ display:"flex",gap:10,marginBottom:12,flexWrap:"wrap" as const,alignItems:"center" }}>
          <input type="text" placeholder="⌕  Search clients by name or industry…" value={search} onChange={e=>setSearch(e.target.value)} style={inp}/>
          <div style={{ display:"flex",gap:2,background:T.raised,border:`1px solid ${T.border}`,borderRadius:9,padding:3,boxShadow:T.shadow }}>
            {(["all","active","building","unpaid"] as const).map(f=>(
              <button key={f} onClick={()=>setFilter(f)} style={{ padding:"5px 12px",fontSize:11,fontWeight:filter===f?700:400,color:filter===f?T.text:T.textMuted,background:filter===f?T.surface:"transparent",border:filter===f?`1px solid ${T.border}`:"1px solid transparent",borderRadius:7,cursor:"pointer",transition:"all 0.15s",letterSpacing:"0.02em" }}>
                {f==="all"?"All":f.charAt(0).toUpperCase()+f.slice(1)}
              </button>
            ))}
          </div>
          <select value={sort} onChange={e=>setSort(e.target.value as any)} style={{ background:T.raised,border:`1px solid ${T.border}`,borderRadius:9,padding:"7px 12px",color:T.textSec,fontSize:12,cursor:"pointer",outline:"none",fontFamily:"inherit" }}>
            <option value="views">Sort: Views</option>
            <option value="name">Sort: Name</option>
            <option value="status">Sort: Status</option>
          </select>
          <div style={{ marginLeft:"auto",fontSize:11,color:T.textMuted,letterSpacing:"0.02em" }}>{filtered.length} of {clients.length}</div>
        </div>

        {/* Bulk action bar */}
        {bulkSelected.size > 0 && (
          <div style={{ display:"flex",alignItems:"center",gap:12,background:"rgba(239,68,68,0.08)",border:"1px solid rgba(239,68,68,0.3)",borderRadius:10,padding:"10px 16px",marginBottom:12 }}>
            <span style={{ fontSize:13,color:T.text,fontWeight:600 }}>{bulkSelected.size} selected</span>
            <button onClick={()=>setBulkSelected(new Set())} style={{ fontSize:11,color:T.textMuted,background:"transparent",border:"none",cursor:"pointer",padding:"2px 6px" }}>x Clear</button>
            <button onClick={()=>{const all=new Set(filtered.map((c:ClientAnalytics)=>c.jobId));setBulkSelected(all);}} style={{ fontSize:11,color:T.blue,background:"transparent",border:"none",cursor:"pointer",padding:"2px 6px" }}>
              Select all {filtered.length}
            </button>
            <button onClick={bulkDelete} disabled={bulkDeleting} style={{ marginLeft:"auto",background:"#ef4444",color:"#fff",border:"none",borderRadius:8,padding:"8px 20px",fontSize:13,fontWeight:700,cursor:bulkDeleting?"not-allowed":"pointer",opacity:bulkDeleting?0.6:1 }}>
              {bulkDeleting ? "Deleting..." : `Delete ${bulkSelected.size} client${bulkSelected.size===1?"":"s"}`}
            </button>
          </div>
        )}

        {/* Select all shortcut */}
        {bulkSelected.size === 0 && !loading && filtered.length > 0 && (
          <div style={{ marginBottom:10 }}>
            <button onClick={()=>setBulkSelected(new Set(filtered.map((c:ClientAnalytics)=>c.jobId)))} style={{ fontSize:11,color:T.textMuted,background:"transparent",border:`1px solid ${T.border}`,borderRadius:6,padding:"4px 10px",cursor:"pointer" }}>
              Select all for bulk delete
            </button>
          </div>
        )}

        {/* Grid */}
        {loading&&(
          <div style={{ display:"grid",gridTemplateColumns:"repeat(auto-fill,minmax(280px,1fr))",gap:12,marginBottom:12 }}>
            {Array(6).fill(0).map((_,i)=><Skeleton key={i}/>)}
          </div>
        )}
        {!loading&&displayClients.length===0&&(
          <div style={{ textAlign:"center" as const,padding:"80px 0",color:T.textMuted }}>
            <div style={{ fontSize:36,marginBottom:12 }}>&#x1F50D;</div>
            <div style={{ fontSize:16,fontWeight:600,color:T.textSec,marginBottom:6 }}>No clients found</div>
            <div style={{ fontSize:13 }}>Try adjusting your search or filter.</div>
          </div>
        )}
        {!loading&&displayClients.length>0&&(
          <div style={{ display:"grid",gridTemplateColumns:"repeat(auto-fill,minmax(280px,1fr))",gap:12 }}>
            {displayClients.map((c:ClientAnalytics,i:number)=>{
              const isSelected = bulkSelected.has(c.jobId);
              return (
                <div key={c.slug} style={{ animationDelay:`${i*0.03}s`,position:"relative" as const }}>
                  <div
                    onClick={e=>{e.stopPropagation();setBulkSelected((prev:Set<string>)=>{const n=new Set(prev);if(n.has(c.jobId))n.delete(c.jobId);else n.add(c.jobId);return n;});}}
                    style={{ position:"absolute",top:10,right:10,zIndex:10,width:20,height:20,borderRadius:5,border:`2px solid ${isSelected?"#ef4444":T.border}`,background:isSelected?"#ef4444":"transparent",cursor:"pointer",display:"flex",alignItems:"center",justifyContent:"center",transition:"all 0.15s",boxShadow:isSelected?"0 0 8px rgba(239,68,68,0.4)":"none" }}>
                    {isSelected&&<span style={{color:"#fff",fontSize:12,lineHeight:1,fontWeight:900}}>&#x2713;</span>}
                  </div>
                  <div style={{ outline:isSelected?"2px solid rgba(239,68,68,0.5)":"none",borderRadius:14,transition:"outline 0.15s" }}>
                    <ClientCard c={c} secret="" dark={dark} toast={toast}/>
                  </div>
                </div>
              );
            })}
          </div>
        )}


        {/* ── Legal Documents Panel ─────────────────────────────── */}
        {!loading && <LegalDocsPanel/>}
        {!loading&&<ExampleHtmlsPanel toast={toast}/>}
          </>);
        })()}
        </>)}

          </div>{/* end padding div */}
        </div>{/* end wg-admin-main */}
      </div>{/* end wg-admin-layout */}
    </div>
  );
}
export default AdminDashboard;
