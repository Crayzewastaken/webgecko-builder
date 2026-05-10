"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { Suspense } from "react";

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
  analytics: { thisMonth: { views: number; bookingClicks: number; contactClicks: number }; today: { views: number; bookingClicks: number }; totals: { views: number; bookingClicks: number; formSubmits: number } } | null;
  bookingCount: number; hasBooking: boolean; builtAt?: string; supersaasId?: string;
  supersaasUrl?: string; bookingServices?: string; clientEmail?: string; clientPhone?: string;
  tawktoPropertyId?: string; shopCatalogue?: any[] | null;
  logoUrl?: string; heroUrl?: string; photoUrls?: string[];
  squareAccessToken?: string; squareLocationId?: string; ga4Id?: string;
  userInput?: { features?: string[]; pages?: string[]; siteType?: string; style?: string; colorPrefs?: string; usp?: string; goal?: string; additionalNotes?: string; abn?: string; businessAddress?: string; facebookPage?: string; instagramUrl?: string; linkedinUrl?: string; };
  metadata?: { scheduledReleaseAt?: string; scheduledReleaseDays?: number; checklistCompletedAt?: string; alreadyReleased?: boolean; seo?: SeoData; domainStatus?: string; domainUrl?: string; lastGoodAt?: string; lastGoodUrl?: string; lastGoodHtml?: string; rolledBackAt?: string; };
}

// ── Themes ─────────────────────────────────────────────────────────────────────
const DARK = {
  bg:"#04080f", surface:"#0a1628", raised:"#102240", border:"#1e3560", borderHov:"#3060a0",
  text:"#e0eaff", textSec:"#7a9ad4", textMuted:"#3a5080",
  green:"#00f080", blue:"#4f9eff", amber:"#ffa830", red:"#ff4060", purple:"#b085ff", cyan:"#00e5ff",
  overlay:"rgba(4,8,15,0.92)", shadow:"0 4px 24px rgba(0,0,0,0.7), inset 0 1px 0 rgba(255,255,255,0.04)", shadowLg:"0 12px 40px rgba(0,0,0,0.85)", shadowXl:"-4px 0 60px rgba(0,0,0,0.95)",
};
const LIGHT = {
  bg:"#f0f2fa", surface:"#ffffff", raised:"#eaecf8", border:"#d4d8f0", borderHov:"#a0acdc",
  text:"#080d22", textSec:"#2a3460", textMuted:"#7080aa",
  green:"#059669", blue:"#2563eb", amber:"#d97706", red:"#dc2626", purple:"#7c3aed", cyan:"#0284c7",
  overlay:"rgba(0,0,0,0.55)", shadow:"0 1px 4px rgba(0,0,0,0.08)", shadowLg:"0 8px 28px rgba(0,0,0,0.12)", shadowXl:"0 20px 52px rgba(0,0,0,0.18)",
};
let T = DARK;

// ── Global CSS ─────────────────────────────────────────────────────────────────
const CSS = `
  @import url('https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700;800&family=Space+Grotesk:wght@400;500;600;700;800&display=swap');
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
      <div style={{ fontSize:10, color:T.textMuted, textTransform:"uppercase", letterSpacing:"0.08em", fontWeight:700, marginBottom:4 }}>{label}</div>
      <div style={{ fontSize:13, color:T.textSec, fontFamily:mono?"'SF Mono','Fira Code',monospace":"inherit", wordBreak:"break-all" as const, lineHeight:1.5 }}>{value}</div>
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

// ── Preview frame ──────────────────────────────────────────────────────────────
function PreviewFrame({ previewUrl, builtAt }: { previewUrl:string; builtAt?:string }) {
  const [key, setKey] = useState(()=>Date.now());
  const prevRef = useRef(builtAt);
  useEffect(()=>{
    if(builtAt!==prevRef.current){prevRef.current=builtAt;setKey(Date.now());}
  },[builtAt]);
  const doRefresh = ()=>setKey(Date.now());
  // Scale 1280px iframe to fit ~710px panel content width
  const SCALE=0.55, IW=1280, IH=800;
  const containerH=Math.round(IH*SCALE);
  const src=`${previewUrl}${previewUrl.includes("?")?"&":"?"}_wg=${key}`;
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
          style={{width:IW,height:IH,border:"none",transform:`scale(${SCALE})`,transformOrigin:"top left",pointerEvents:"none"}}
          sandbox="allow-scripts allow-same-origin"
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

// ── Client slide-over panel ────────────────────────────────────────────────────
function ClientPanel({ c, secret, onClose, toast }: { c:ClientAnalytics; secret:string; onClose:()=>void; toast:(msg:string,t:"ok"|"err"|"info")=>void }) {
  const [tab, setTab] = useState<"perf"|"engagement"|"seo"|"site"|"assets"|"integrations"|"payments"|"actions"|"requests">("perf");
  const [assetUploading, setAssetUploading] = useState(false);
  const [assetMsg, setAssetMsg] = useState("");
  const [intSaving, setIntSaving] = useState(false);
  const [intMsg, setIntMsg] = useState("");
  const [squareToken, setSquareToken] = useState(c.squareAccessToken||"");
  const [squareLocation, setSquareLocation] = useState(c.squareLocationId||"");
  const [ga4Id, setGa4Id] = useState(c.ga4Id||"");
  const [customDomain, setCustomDomain] = useState(c.domain||"");
  const [featureRequests, setFeatureRequests] = useState<any[]>([]);
  const [frLoading, setFrLoading] = useState(false);
  const [frUpdating, setFrUpdating] = useState<string|null>(null);
  const [feeInputs, setFeeInputs] = useState<Record<string,string>>({});
  const [deployedAt, setDeployedAt] = useState<string|null>(null);
  const a = c.analytics;
  const seo = c.metadata?.seo;
  const ui = c.userInput||{};
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
  const tabs = ["perf","engagement","seo","site","assets","integrations","payments","actions","requests"] as const;

  const sectionTitle = (text:string) => (
    <div style={{ fontSize:10, color:T.textMuted, textTransform:"uppercase" as const, letterSpacing:"0.09em", fontWeight:700, marginBottom:12, paddingBottom:8, borderBottom:`1px solid ${T.border}` }}>{text}</div>
  );

  const tabBtn = (id:typeof tabs[number], label:string) => (
    <button key={id} onClick={()=>{setTab(id);if(id==="requests"&&featureRequests.length===0)loadFeatureRequests();}}
      style={{ padding:"8px 14px", fontSize:12, fontWeight:tab===id?600:400, color:tab===id?T.text:T.textMuted, background:tab===id?T.raised:"transparent", border:tab===id?`1px solid ${T.border}`:"1px solid transparent", borderRadius:7, cursor:"pointer", transition:"all 0.15s ease", whiteSpace:"nowrap" as const }}>
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
        position:"fixed", top:0, right:0, bottom:0, width:"min(760px,100vw)", zIndex:201,
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

        {/* Tabs */}
        <div style={{ display:"flex", gap:4, padding:"10px 24px", borderBottom:`1px solid ${T.border}`, background:T.bg, flexWrap:"wrap" as const, flexShrink:0 }}>
          {tabBtn("perf","Performance")}
          {tabBtn("engagement","Engagement")}
          {tabBtn("seo","SEO")}
          {tabBtn("site","Site")}
          {tabBtn("assets","Assets")}
          {tabBtn("integrations","Integrations")}
          {tabBtn("payments","Payments")}
          {tabBtn("actions","Actions")}
          {tabBtn("requests", `Requests${pending>0?` (${pending})`:""}`)}
        </div>

        {/* Tab content */}
        <div key={tab} className="wg-tab" style={{ flex:1, overflowY:"auto" as const, padding:"24px" }}>

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
                          {title:"Content length",note:`Competitors avg ${wc} words`,status:(wc>1200?"bad":wc>600?"good":"warn") as IS,detail:wc>1200?`⚠️ Match competitor depth — add FAQs, detail sections.`:wc>600?`✓ Content depth is competitive.`:`ℹ️ Concise sites can outrank with good structure.`},
                          {title:"Section headings (H2s)",note:`Competitors use ${h2} headings`,status:(h2>=5&&h2<=10?"good":h2<3?"bad":"warn") as IS,detail:h2>=5&&h2<=10?`✓ ${h2} H2s is solid.`:h2<3?`⚠️ Use more clear section headings.`:`ℹ️ ${h2} H2s — ensure each targets a keyword.`},
                        ].map(row=>(
                          <div key={row.title} style={{background:T.raised,borderRadius:10,padding:"14px 16px",border:`1px solid ${T.border}`,marginBottom:10}}>
                            <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:6}}>
                              <div><span style={{fontSize:13,fontWeight:600,color:T.text}}>{row.title}</span><span style={{fontSize:11,color:T.textMuted,marginLeft:8}}>{row.note}</span></div>
                              {ind(row.status)}
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
                    : <PreviewFrame previewUrl={c.previewUrl} builtAt={deployedAt||c.builtAt}/>}
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

              {/* Square */}
              <div style={{background:T.raised,border:`1px solid ${T.border}`,borderRadius:12,padding:"16px 18px"}}>
                {sectionTitle("Square (Payments / Shop)")}
                <div style={{fontSize:12,color:T.textMuted,marginBottom:14,lineHeight:1.6}}>
                  Connect this client's Square account to enable the online shop and payment links. Get these from the Square Developer Dashboard.
                </div>
                <div style={{display:"flex",flexDirection:"column" as const,gap:10}}>
                  <div>
                    <label style={{fontSize:11,color:T.textMuted,fontWeight:600,display:"block",marginBottom:5}}>Access Token</label>
                    <input value={squareToken} onChange={e=>setSquareToken(e.target.value)} placeholder="EAAAl..." type="password"
                      style={{width:"100%",boxSizing:"border-box" as const,background:T.surface,border:`1px solid ${T.border}`,borderRadius:7,padding:"9px 12px",color:T.text,fontSize:12,outline:"none",fontFamily:"monospace"}}/>
                  </div>
                  <div>
                    <label style={{fontSize:11,color:T.textMuted,fontWeight:600,display:"block",marginBottom:5}}>Location ID</label>
                    <input value={squareLocation} onChange={e=>setSquareLocation(e.target.value)} placeholder="LXXXXXXXXXXXXXXXXX"
                      style={{width:"100%",boxSizing:"border-box" as const,background:T.surface,border:`1px solid ${T.border}`,borderRadius:7,padding:"9px 12px",color:T.text,fontSize:12,outline:"none",fontFamily:"monospace"}}/>
                  </div>
                  <button disabled={intSaving} onClick={async()=>{
                    setIntSaving(true); setIntMsg("");
                    try {
                      const r=await fetch("/api/admin/update-integration",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({jobId:jid,squareAccessToken:squareToken,squareLocationId:squareLocation})});
                      const d=await r.json();
                      if(!r.ok)throw new Error(d.error||"Failed");
                      setIntMsg("✓ Square credentials saved");
                      toast("Saved","ok");
                    } catch(e){setIntMsg((e as Error).message);toast("Save failed","err");}
                    finally{setIntSaving(false);}
                  }} style={{background:T.blue,color:"#fff",border:"none",borderRadius:8,padding:"9px 18px",fontSize:12,fontWeight:600,cursor:"pointer",opacity:intSaving?0.6:1,width:"fit-content"}}>
                    {intSaving?"Saving…":"Save Square credentials"}
                  </button>
                </div>
              </div>

              {/* Google Analytics */}
              <div style={{background:T.raised,border:`1px solid ${T.border}`,borderRadius:12,padding:"16px 18px"}}>
                {sectionTitle("Google Analytics 4")}
                <div style={{fontSize:12,color:T.textMuted,marginBottom:14,lineHeight:1.6}}>
                  Enter the GA4 Measurement ID (starts with G-). This will be injected into the site on next fix/rebuild.
                </div>
                <div style={{display:"flex",gap:10,alignItems:"flex-end"}}>
                  <div style={{flex:1}}>
                    <label style={{fontSize:11,color:T.textMuted,fontWeight:600,display:"block",marginBottom:5}}>Measurement ID</label>
                    <input value={ga4Id} onChange={e=>setGa4Id(e.target.value)} placeholder="G-XXXXXXXXXX"
                      style={{width:"100%",boxSizing:"border-box" as const,background:T.surface,border:`1px solid ${T.border}`,borderRadius:7,padding:"9px 12px",color:T.text,fontSize:12,outline:"none",fontFamily:"monospace"}}/>
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
                <div style={{fontSize:12,color:T.textMuted,marginBottom:14,lineHeight:1.6}}>
                  Client's desired domain. Point A record to Vercel, then assign here.
                </div>
                <div style={{display:"flex",gap:10,alignItems:"flex-end"}}>
                  <div style={{flex:1}}>
                    <label style={{fontSize:11,color:T.textMuted,fontWeight:600,display:"block",marginBottom:5}}>Domain</label>
                    <input value={customDomain} onChange={e=>setCustomDomain(e.target.value)} placeholder="example.com.au"
                      style={{width:"100%",boxSizing:"border-box" as const,background:T.surface,border:`1px solid ${T.border}`,borderRadius:7,padding:"9px 12px",color:T.text,fontSize:12,outline:"none",fontFamily:"monospace"}}/>
                  </div>
                  <button disabled={intSaving} onClick={async()=>{
                    setIntSaving(true); setIntMsg("");
                    try {
                      const r=await fetch("/api/admin/assign-domain",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({jobId:jid,domain:customDomain})});
                      const d=await r.json();
                      if(!r.ok)throw new Error(d.error||"Failed");
                      setIntMsg("✓ Domain assigned");
                      toast("Domain assigned","ok");
                    } catch(e){setIntMsg((e as Error).message);toast("Save failed","err");}
                    finally{setIntSaving(false);}
                  }} style={{background:T.blue,color:"#fff",border:"none",borderRadius:8,padding:"9px 18px",fontSize:12,fontWeight:600,cursor:"pointer",opacity:intSaving?0.6:1}}>
                    {intSaving?"Assigning…":"Assign domain"}
                  </button>
                </div>
                {c.metadata?.domainStatus&&<div style={{fontSize:11,color:T.textMuted,marginTop:8}}>Status: {c.metadata.domainStatus}</div>}
              </div>

              {intMsg&&<div style={{fontSize:12,color:intMsg.startsWith("✓")?T.green:T.red,padding:"8px 12px",background:intMsg.startsWith("✓")?T.green+"10":T.red+"10",borderRadius:7,border:`1px solid ${intMsg.startsWith("✓")?T.green:T.red}25`}}>{intMsg}</div>}
            </div>
          )}

          {/* PAYMENTS */}
          {tab==="payments"&&(
            <>
              <div style={{display:"grid",gridTemplateColumns:"repeat(3,1fr)",gap:10,marginBottom:20}}>
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
              <ActionBtn label="Unlock final payment" color={T.amber} confirm="Unlock final payment? Client will be emailed to pay remaining balance." onConfirm={()=>api(`/api/payment/unlock?jobId=${jid}&secret=${sec}`)} toast={toast}/>
            </>
          )}

          {/* ACTIONS */}
          {tab==="actions"&&(
            <div style={{display:"flex",flexDirection:"column" as const,gap:12}}>
              <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:10}}>
                {[
                  {title:"Release preview",color:T.green,desc:"Email the client their portal link to review the site.",label:"Release preview →",confirm:`Release preview to ${c.businessName}? This emails the client.`,fn:()=>api(`/api/unlock/release?jobId=${jid}&secret=${sec}`)},
                  {title:"Force redeploy",color:T.green,desc:"Deploy current stored HTML instantly — no fix pass, no rebuild. Use when preview shows old site.",label:"Force redeploy →",confirm:"Force-redeploy stored HTML to Vercel now?",fn:()=>api(`/api/admin/redeploy`,"POST",{jobId:jid})},
                  {title:"Fix site",color:T.blue,desc:"Run a code fix pass and redeploy. Takes 1–2 min.",label:"Fix this site",confirm:"Run a fix pass on this site?",fn:()=>api(`/api/admin/fix-proxy?jobId=${jid}&secret=${sec}`)},
                  {title:"Rebuild site",color:T.amber,desc:"Full rebuild from scratch — regenerates design. 5–10 min.",label:"Rebuild site",confirm:`Fully rebuild ${c.businessName} from scratch?`,fn:async()=>{await api(`/api/admin/reset-job`,"POST",{jobId:jid,action:"reset-and-rebuild",secret:sec});}},
                  {title:"Monthly report",color:T.cyan,desc:"Email this month's analytics to the client.",label:"Send report",confirm:"Send monthly analytics report?",fn:()=>api(`/api/analytics/monthly?jobId=${jid}&secret=${sec}&send=true`)},
                  {title:"Reset password",color:T.textSec,desc:"Generate a new portal login password.",label:"Reset password",confirm:"Generate a new password?",fn:async()=>{const d=await api(`/api/admin/reset-password?secret=${sec}`,"POST",{slug:c.slug});toast(`New password: ${d.password}`,"info");return d;}},
                  ...(c.metadata?.lastGoodAt?[{title:"Rollback to last good",color:T.purple,desc:`Restores snapshot from ${new Date(c.metadata.lastGoodAt).toLocaleDateString("en-AU")}.`,label:"Rollback",confirm:`Roll back ${c.businessName} to last good build?`,fn:()=>api(`/api/admin/reset-job`,"POST",{jobId:jid,action:"rollback",secret:sec})}]:[]),
                  ...(c.hasBooking?[{title:"Unlock booking",color:T.purple,desc:"Enable the booking system for this client.",label:"Unlock booking",confirm:`Enable booking for ${c.businessName}?`,fn:()=>api(`/api/unlock/booking?jobId=${jid}&secret=${sec}`)}]:[]),
                ].map(action=>(
                  <div key={action.title} style={{background:T.raised,border:`1px solid ${T.border}`,borderRadius:12,padding:"16px 18px"}}>
                    <div style={{fontSize:12,fontWeight:700,color:action.color,marginBottom:4}}>{action.title}</div>
                    <div style={{fontSize:11,color:T.textMuted,marginBottom:12,lineHeight:1.5}}>{action.desc}</div>
                    <ActionBtn label={action.label} color={action.color} confirm={action.confirm} onConfirm={action.fn} toast={toast}/>
                  </div>
                ))}
              </div>
              <ClientHtmlUpload jobId={jid} toast={toast}/>
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

        </div>
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

        <div style={{ display:"flex", gap:5, flexWrap:"wrap" as const, marginBottom:14 }}>
          <Pill color={statusColor}>{c.buildStatus||"pending"}</Pill>
          {c.paymentState?.monthlyActive&&<Pill color={T.green}>Monthly</Pill>}
          {c.paymentState?.depositPaid&&!c.paymentState?.monthlyActive&&<Pill color={T.amber}>Deposit</Pill>}
          {!c.paymentState?.depositPaid&&<Pill color={T.textMuted}>Unpaid</Pill>}
          {c.hasBooking&&<Pill color={T.purple}>Booking</Pill>}
          {c.metadata?.alreadyReleased&&<Pill color={T.green}>Released</Pill>}
        </div>

        <div style={{ display:"flex", justifyContent:"space-between", fontSize:12, color:T.textMuted, borderTop:`1px solid ${T.border}`, paddingTop:12 }}>
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
          <div style={{ display:"flex", flexDirection:"column" as const, alignItems:"center" }}>
            <div style={{ color:T.border, fontSize:20, lineHeight:1, marginTop:2 }}>›</div>
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

  const filtered = lvl==="all" ? logs : logs.filter(l=>l.level===lvl);
  const lvlColor = (l:string) => l==="error"?T.red:l==="warn"?T.amber:T.textMuted;
  const lvlBg   = (l:string) => l==="error"?T.red+"15":l==="warn"?T.amber+"15":T.raised;

  return (
    <div>
      <div style={{display:"flex",alignItems:"center",gap:8,marginBottom:16,flexWrap:"wrap" as const}}>
        <div style={{fontSize:12,color:T.textMuted,fontWeight:600,marginRight:4}}>Filter:</div>
        {(["all","warn","error"] as const).map(f=>(
          <button key={f} onClick={()=>setLvl(f)} style={{padding:"5px 14px",fontSize:12,fontWeight:lvl===f?600:400,color:lvl===f?T.text:T.textMuted,background:lvl===f?T.raised:"transparent",border:lvl===f?`1px solid ${T.border}`:"1px solid transparent",borderRadius:6,cursor:"pointer"}}>
            {f==="all"?"All":f.charAt(0).toUpperCase()+f.slice(1)}
            {f!=="all"&&<span style={{marginLeft:5,color:lvlColor(f),fontWeight:700}}>{logs.filter(l=>l.level===f).length}</span>}
          </button>
        ))}
        <button onClick={load} style={{marginLeft:"auto",background:T.raised,border:`1px solid ${T.border}`,color:T.textMuted,borderRadius:6,padding:"5px 12px",fontSize:12,cursor:"pointer"}}>↻ Refresh</button>
      </div>
      {loading&&<div style={{color:T.textMuted,fontSize:13,padding:"40px 0",textAlign:"center" as const}}>Loading logs…</div>}
      {!loading&&filtered.length===0&&(
        <div style={{textAlign:"center" as const,padding:"60px 0",color:T.textMuted}}>
          <div style={{fontSize:32,marginBottom:10}}>✅</div>
          <div style={{fontSize:14,fontWeight:600,color:T.textSec}}>No {lvl==="all"?"":lvl} log entries</div>
        </div>
      )}
      {!loading&&filtered.length>0&&(
        <div style={{display:"flex",flexDirection:"column" as const,gap:4}}>
          {filtered.map((l,i)=>(
            <div key={i} style={{background:lvlBg(l.level),border:`1px solid ${lvlColor(l.level)}25`,borderRadius:8,padding:"10px 14px",display:"grid",gridTemplateColumns:"auto auto auto 1fr",gap:"0 14px",alignItems:"start"}}>
              <span style={{fontSize:10,fontWeight:700,color:lvlColor(l.level),background:lvlColor(l.level)+"20",borderRadius:4,padding:"2px 7px",whiteSpace:"nowrap" as const,marginTop:1}}>{l.level.toUpperCase()}</span>
              <span style={{fontSize:11,color:T.textMuted,fontFamily:"monospace",whiteSpace:"nowrap" as const}}>{l.ts ? new Date(l.ts).toLocaleString("en-AU",{day:"2-digit",month:"short",hour:"2-digit",minute:"2-digit",second:"2-digit"}) : ""}</span>
              <span style={{fontSize:11,color:T.blue,background:T.blue+"12",borderRadius:4,padding:"2px 7px",fontFamily:"monospace",whiteSpace:"nowrap" as const}}>{l.step||"—"}</span>
              <div>
                {l.businessName&&<span style={{fontSize:11,fontWeight:600,color:T.text,marginRight:8}}>{l.businessName}</span>}
                <span style={{fontSize:11,color:T.textSec,wordBreak:"break-word" as const}}>{l.msg}</span>
              </div>
            </div>
          ))}
        </div>
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
function AnalyticsView({ clients, onOpenClient }: { clients: ClientAnalytics[]; onOpenClient: (c: ClientAnalytics) => void }) {
  const total = clients.length || 1;
  const active = clients.filter(c=>c.paymentState?.monthlyActive).length;
  const mrr = active * 109;
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
function AdminDashboard() {
  const [dark, setDark] = useState(true);
  useEffect(()=>{ const s=localStorage.getItem("wg_admin_theme"); setDark(s!=="light"); },[]);
  T = dark ? DARK : LIGHT;

  const [clients, setClients] = useState<ClientAnalytics[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [view, setView] = useState<"analytics"|"clients"|"logs">("analytics");
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState<"all"|"active"|"building"|"unpaid">("all");
  const [sort, setSort] = useState<"views"|"name"|"status">("views");
  const [selectedClient, setSelectedClient] = useState<ClientAnalytics|null>(null);
  const { toasts, add: toast } = useToast();

  function openClient(c: ClientAnalytics) {
    setSelectedClient(c);
  }

  function toggleTheme() {
    const next=!dark; setDark(next);
    localStorage.setItem("wg_admin_theme",next?"dark":"light");
  }

  async function handleLogout() {
    await fetch("/api/admin/login",{method:"DELETE"});
    window.location.href="/admin/login";
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

  useEffect(()=>{
    loadDashboard();
    const iv=setInterval(async()=>{
      const r=await fetch("/api/admin/clients").catch(()=>null);
      if(!r||!r.ok)return;
      const d=await r.json().catch(()=>({}));
      const fresh:ClientAnalytics[]=d.clients||[];
      setClients(prev=>{
        const changed=fresh.some(f=>{const p=prev.find(p=>p.jobId===f.jobId);return !p||p.buildStatus!==f.buildStatus||p.previewUrl!==f.previewUrl;});
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

  const totals = {
    clients:clients.length,
    active:clients.filter(c=>c.paymentState?.monthlyActive).length,
    views:clients.reduce((a,c)=>a+(c.analytics?.thisMonth.views||0),0),
    bookings:clients.reduce((a,c)=>a+c.bookingCount,0),
    mrr:clients.filter(c=>c.paymentState?.monthlyActive).length*109,
  };

  const inp:React.CSSProperties={flex:1,minWidth:200,background:T.raised,border:`1px solid ${T.border}`,borderRadius:9,padding:"9px 14px",color:T.text,fontSize:13,outline:"none",boxSizing:"border-box",fontFamily:"inherit",transition:"border-color 0.2s, box-shadow 0.2s"};

  return (
    <div className="wg-grid-bg" style={{ minHeight:"100vh", background:T.bg, color:T.text, fontFamily:"'Space Grotesk','Inter',-apple-system,sans-serif", transition:"background 0.25s, color 0.25s" }}>
      <style>{CSS}</style>
      <Toasts toasts={toasts}/>

      {/* Top nav */}
      <div className="wg-glass" style={{ background: dark ? "rgba(4,8,15,0.88)" : "rgba(255,255,255,0.92)", borderBottom:`1px solid rgba(79,158,255,0.15)`, padding:"0 28px", display:"flex", alignItems:"center", justifyContent:"space-between", height:62, position:"sticky" as const, top:0, zIndex:100, transition:"background 0.25s, border-color 0.25s", boxShadow:"0 1px 0 rgba(79,158,255,0.08), 0 4px 24px rgba(0,0,0,0.5)" }}>
        {/* Gradient line at very top */}
        <div style={{ position:"absolute", top:0, left:0, right:0, height:2, background:"linear-gradient(90deg, #4f9eff 0%, #b085ff 40%, #00f080 70%, transparent 100%)", pointerEvents:"none" }}/>
        <div style={{ display:"flex", alignItems:"center", gap:14 }}>
          {/* Logo mark */}
          <div style={{ width:36,height:36,borderRadius:10,background:"linear-gradient(135deg,#4f9eff,#9d6fff)",flexShrink:0,display:"flex",alignItems:"center",justifyContent:"center",boxShadow:"0 0 24px rgba(79,158,255,0.55), 0 0 48px rgba(79,158,255,0.2)",fontSize:16,fontWeight:900,color:"#fff" }}>W</div>
          <span className="wg-brand-text" style={{ fontSize:17,fontWeight:800,letterSpacing:"-0.04em" }}>WebGecko</span>
          <span style={{ fontSize:9,color:"#4f9eff",background:"rgba(79,158,255,0.15)",border:"1px solid rgba(79,158,255,0.3)",borderRadius:5,padding:"3px 9px",fontWeight:800,letterSpacing:"0.12em",boxShadow:"0 0 10px rgba(79,158,255,0.15)" }}>ADMIN</span>
          {clients.some(c=>c.buildStatus==="building")&&(
            <div style={{ display:"flex",alignItems:"center",gap:6,background:T.amber+"14",border:`1px solid ${T.amber}35`,borderRadius:20,padding:"4px 12px" }}>
              <div style={{ position:"relative",width:7,height:7 }}>
                <div style={{ position:"absolute",inset:0,borderRadius:"50%",background:T.amber,animation:"wg-ping 1.2s infinite" }}/>
                <div style={{ position:"absolute",inset:0,borderRadius:"50%",background:T.amber }}/>
              </div>
              <span style={{ fontSize:11,color:T.amber,fontWeight:700 }}>{clients.filter(c=>c.buildStatus==="building").length} building</span>
            </div>
          )}
        </div>
        <div style={{ display:"flex",gap:8,alignItems:"center" }}>
          <button onClick={loadDashboard} style={{ background:T.raised,border:`1px solid ${T.border}`,color:T.textSec,borderRadius:8,padding:"7px 16px",fontSize:12,fontWeight:500,cursor:"pointer" }}>↻ Refresh</button>
          <button onClick={toggleTheme} title={dark?"Light mode":"Dark mode"} style={{ background:T.raised,border:`1px solid ${T.border}`,color:T.textMuted,borderRadius:8,padding:"7px 10px",fontSize:14,cursor:"pointer",width:36,height:34,display:"flex",alignItems:"center",justifyContent:"center" }}>
            {dark?"☀":"🌙"}
          </button>
          <button onClick={handleLogout} style={{ background:"transparent",color:T.textMuted,border:`1px solid ${T.border}`,borderRadius:8,padding:"7px 16px",fontSize:12,cursor:"pointer" }}>Sign out</button>
        </div>
      </div>

      <div style={{ maxWidth:"100%",padding:"28px 32px" }}>

        {/* Section label */}
        {!loading&&!error&&(
          <div style={{ display:"flex",alignItems:"center",gap:10,marginBottom:18 }}>
            <div style={{ height:1,flex:1,background:"linear-gradient(90deg,rgba(79,158,255,0.3),transparent)" }}/>
            <span style={{ fontSize:10,fontWeight:800,letterSpacing:"0.14em",color:"rgba(79,158,255,0.6)",textTransform:"uppercase" as const }}>Platform Overview</span>
            <div style={{ height:1,flex:1,background:"linear-gradient(90deg,transparent,rgba(79,158,255,0.3))" }}/>
          </div>
        )}

        {/* Stats */}
        {!loading&&!error&&(
          <div style={{ display:"grid",gridTemplateColumns:"repeat(5,1fr)",gap:12,marginBottom:28 }}>
            {[
              {label:"Total clients",value:totals.clients,color:T.blue,icon:"◈"},
              {label:"Monthly active",value:totals.active,color:T.green,icon:"●"},
              {label:"Est. MRR",value:"$"+totals.mrr.toLocaleString(),color:T.green,icon:"$"},
              {label:"Views / month",value:totals.views,color:T.cyan,icon:"◎"},
              {label:"Total bookings",value:totals.bookings,color:T.amber,icon:"◆"},
            ].map(s=>(
              <div key={s.label} className="wg-card wg-stat-scan" style={{ background:T.surface,border:`1px solid ${s.color}28`,borderRadius:14,padding:"16px 18px 14px 22px",position:"relative",overflow:"hidden",transition:"border-color 0.2s, box-shadow 0.2s",boxShadow:`0 0 0 1px ${s.color}14, 0 6px 32px rgba(0,0,0,0.7), inset 0 1px 0 rgba(255,255,255,0.05)` }}
                onMouseEnter={e=>{const el=e.currentTarget as HTMLElement;el.style.borderColor=s.color+"55";el.style.boxShadow=`0 0 32px ${s.color}22, 0 8px 40px rgba(0,0,0,0.8), inset 0 1px 0 rgba(255,255,255,0.06)`;}}
                onMouseLeave={e=>{const el=e.currentTarget as HTMLElement;el.style.borderColor=s.color+"28";el.style.boxShadow=`0 0 0 1px ${s.color}14, 0 6px 32px rgba(0,0,0,0.7), inset 0 1px 0 rgba(255,255,255,0.05)`;}}>
                <div style={{ position:"absolute",left:0,top:0,bottom:0,width:4,borderRadius:"14px 0 0 14px",background:`linear-gradient(180deg,${s.color},${s.color}33)`,boxShadow:`2px 0 12px ${s.color}40` }}/>
                <div style={{ position:"absolute",top:0,right:0,width:80,height:80,background:`radial-gradient(circle at top right,${s.color}22,transparent 60%)`,pointerEvents:"none" }}/>
                <div style={{ display:"flex",alignItems:"center",gap:8,marginBottom:10 }}>
                  <div style={{ width:26,height:26,borderRadius:7,background:s.color+"22",border:`1px solid ${s.color}40`,display:"flex",alignItems:"center",justifyContent:"center",fontSize:12,fontWeight:900,color:s.color,flexShrink:0 }}>{s.icon}</div>
                  <div style={{ fontSize:9,color:T.textMuted,fontWeight:700,letterSpacing:"0.08em",textTransform:"uppercase" as const }}>{s.label}</div>
                </div>
                <div style={{ fontSize:26,fontWeight:800,letterSpacing:"-0.04em",lineHeight:1 }}>
                  {typeof s.value==="number" ? <AnimNum value={s.value} color={s.color}/> : <span style={{color:s.color}}>{s.value}</span>}
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Error */}
        {error&&<div style={{ background:T.red+"0a",border:`1px solid ${T.red}25`,borderRadius:10,padding:"14px 18px",color:T.red,marginBottom:20,fontSize:13 }}>{error}</div>}

        {/* View toggle */}
        <div style={{ display:"flex",gap:3,background:T.raised,border:`1px solid ${T.border}`,borderRadius:10,padding:4,marginBottom:20,width:"fit-content",boxShadow:T.shadow }}>
          {([
            {v:"analytics" as const,label:"◈ Analytics"},
            {v:"clients" as const,label:"⬡ Clients"},
            {v:"logs" as const,label:"⧉ Pipeline"},
          ]).map(({v,label})=>(
            <button key={v} onClick={()=>setView(v)} className={view===v?"wg-view-active":""} style={{ padding:"7px 22px",fontSize:12,fontWeight:view===v?700:400,color:view===v?T.text:T.textMuted,background:"transparent",border:"1px solid transparent",borderRadius:7,cursor:"pointer",transition:"all 0.18s",letterSpacing:"0.01em" }}>
              {label}
            </button>
          ))}
        </div>

        {/* Global selected-client panel (from Analytics view) */}
        {selectedClient&&<ClientPanel c={selectedClient} secret="" onClose={()=>setSelectedClient(null)} toast={toast}/>}

        {view==="analytics"&&!loading&&!error&&(
          <AnalyticsView clients={clients} onOpenClient={openClient}/>
        )}

        {view==="logs"&&<PipelineLogsPanel/>}

        {view==="clients"&&(<>
        {/* Client grid header */}
        <div style={{ display:"flex",alignItems:"center",gap:10,marginBottom:14 }}>
          <div style={{ height:1,width:24,background:"rgba(79,158,255,0.4)" }}/>
          <span style={{ fontSize:10,fontWeight:800,letterSpacing:"0.14em",color:"rgba(79,158,255,0.55)",textTransform:"uppercase" as const }}>Clients</span>
        </div>

        {/* Search + filters */}
                {/* Search + filters */}
        <div style={{ display:"flex",gap:10,marginBottom:20,flexWrap:"wrap" as const,alignItems:"center" }}>
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
          <div style={{ marginLeft:"auto",fontSize:11,color:T.textMuted,letterSpacing:"0.02em" }}>{filtered.length} <span style={{color:T.border}}/> of {clients.length}</div>
        </div>

        {/* Grid */}
        {loading&&(
          <div style={{ display:"grid",gridTemplateColumns:"repeat(auto-fill,minmax(280px,1fr))",gap:12,marginBottom:12 }}>
            {Array(6).fill(0).map((_,i)=><Skeleton key={i}/>)}
          </div>
        )}
        {!loading&&filtered.length===0&&(
          <div style={{ textAlign:"center" as const,padding:"80px 0",color:T.textMuted }}>
            <div style={{ fontSize:36,marginBottom:12 }}>🔍</div>
            <div style={{ fontSize:16,fontWeight:600,color:T.textSec,marginBottom:6 }}>No clients found</div>
            <div style={{ fontSize:13 }}>Try adjusting your search or filter.</div>
          </div>
        )}
        {!loading&&filtered.length>0&&(
          <div style={{ display:"grid",gridTemplateColumns:"repeat(auto-fill,minmax(280px,1fr))",gap:12 }}>
            {filtered.map((c,i)=>(
              <div key={c.slug} style={{ animationDelay:`${i*0.03}s` }}>
                <ClientCard c={c} secret="" dark={dark} toast={toast}/>
              </div>
            ))}
          </div>
        )}

        {!loading&&<ExampleHtmlsPanel toast={toast}/>}
        </>)}

      </div>
    </div>
  );
}

export default function AdminPage() {
  return (
    <Suspense fallback={<div style={{ color:"#e8e8f0",padding:40,fontFamily:"Inter,sans-serif",background:"#07070c",minHeight:"100vh",display:"flex",alignItems:"center",justifyContent:"center" }}>Loading…</div>}>
      <AdminDashboard/>
    </Suspense>
  );
}
