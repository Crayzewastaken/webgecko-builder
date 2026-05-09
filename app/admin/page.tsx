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
  userInput?: { features?: string[]; pages?: string[]; siteType?: string; style?: string; colorPrefs?: string; usp?: string; goal?: string; additionalNotes?: string; abn?: string; businessAddress?: string; facebookPage?: string; instagramUrl?: string; linkedinUrl?: string; };
  metadata?: { scheduledReleaseAt?: string; scheduledReleaseDays?: number; checklistCompletedAt?: string; alreadyReleased?: boolean; seo?: SeoData; domainStatus?: string; domainUrl?: string; lastGoodAt?: string; lastGoodUrl?: string; lastGoodHtml?: string; rolledBackAt?: string; };
}

// ── Themes ─────────────────────────────────────────────────────────────────────
const DARK = {
  bg:"#07070c", surface:"#0e0e17", raised:"#14141f", border:"#1c1c2a", borderHov:"#2d2d42",
  text:"#e8e8f0", textSec:"#8888a8", textMuted:"#44445a",
  green:"#00d47e", blue:"#4f9eff", amber:"#f5a030", red:"#ff5c5c", purple:"#9d6fff", cyan:"#00d4ff",
  overlay:"rgba(4,4,8,0.82)", shadow:"0 2px 8px rgba(0,0,0,0.45)", shadowLg:"0 12px 40px rgba(0,0,0,0.65)", shadowXl:"0 24px 72px rgba(0,0,0,0.85)",
};
const LIGHT = {
  bg:"#f3f4f8", surface:"#ffffff", raised:"#eef0f6", border:"#dde1ee", borderHov:"#b8bed6",
  text:"#0d0f1a", textSec:"#3a4260", textMuted:"#8892aa",
  green:"#00a85a", blue:"#2563eb", amber:"#b45309", red:"#dc2626", purple:"#7c3aed", cyan:"#0891b2",
  overlay:"rgba(0,0,0,0.55)", shadow:"0 1px 4px rgba(0,0,0,0.08)", shadowLg:"0 8px 28px rgba(0,0,0,0.14)", shadowXl:"0 20px 52px rgba(0,0,0,0.2)",
};
let T = DARK;

// ── Global CSS ─────────────────────────────────────────────────────────────────
const CSS = `
  @import url('https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700&display=swap');
  *, *::before, *::after { box-sizing: border-box; }
  body { margin: 0; }
  @keyframes wg-fade { from { opacity: 0 } to { opacity: 1 } }
  @keyframes wg-up { from { opacity:0; transform:translateY(10px) } to { opacity:1; transform:translateY(0) } }
  @keyframes wg-panel { from { transform:translateX(100%); opacity:0 } to { transform:translateX(0); opacity:1 } }
  @keyframes wg-ping { 0% { transform:scale(1); opacity:.9 } 100% { transform:scale(2.4); opacity:0 } }
  @keyframes wg-spin { from { transform:rotate(0deg) } to { transform:rotate(360deg) } }
  @keyframes wg-toast { 0%{opacity:0;transform:translateY(8px) scale(.95)} 100%{opacity:1;transform:none} }
  @keyframes wg-shimmer { 0%{background-position:-800px 0} 100%{background-position:800px 0} }
  .wg-panel { animation: wg-panel 0.28s cubic-bezier(0.25,0.46,0.45,0.94) }
  .wg-card { animation: wg-up 0.22s ease both }
  .wg-tab { animation: wg-fade 0.16s ease }
  .wg-toast { animation: wg-toast 0.2s ease }
  .wg-cc { transition: all 0.18s ease; cursor:pointer }
  .wg-cc:hover { transform:translateY(-2px) }
  button { transition: opacity 0.15s ease, transform 0.12s ease !important }
  button:active:not(:disabled) { transform: scale(0.95) !important }
  ::-webkit-scrollbar { width:4px; height:4px }
  ::-webkit-scrollbar-track { background:transparent }
  ::-webkit-scrollbar-thumb { background:#2a2a3a; border-radius:99px }
  input, textarea, select { font-family: inherit }
  .wg-shimmer {
    background: linear-gradient(90deg, rgba(255,255,255,.04) 25%, rgba(255,255,255,.1) 50%, rgba(255,255,255,.04) 75%);
    background-size: 800px 100%; animation: wg-shimmer 1.5s infinite;
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
  const [thumbErr, setThumbErr] = useState(false);
  const [key, setKey] = useState(() => builtAt ? new Date(builtAt).getTime() : Math.floor(Date.now()/60000));
  const [refreshing, setRefreshing] = useState(false);
  const prevRef = useRef(builtAt);
  useEffect(() => {
    if (builtAt && builtAt!==prevRef.current) { prevRef.current=builtAt; setKey(new Date(builtAt).getTime()); setThumbErr(false); }
  }, [builtAt]);
  const bust = `${previewUrl}${previewUrl.includes("?")?"&":"?"}_wg=${key}`;
  const thumb = `https://api.screenshotone.com/take?url=${encodeURIComponent(bust)}&viewport_width=1280&viewport_height=800&format=jpg&image_quality=80&block_ads=true&cache=false&delay=3`;
  const doRefresh = () => { setThumbErr(false); setRefreshing(true); setKey(Math.floor(Date.now()/1000)); setTimeout(()=>setRefreshing(false),6000); };
  return (
    <div style={{ borderRadius:12, overflow:"hidden", border:`1px solid ${T.border}` }}>
      <div style={{ display:"flex", alignItems:"center", gap:8, padding:"8px 12px", background:T.surface, borderBottom:`1px solid ${T.border}` }}>
        <div style={{ display:"flex", gap:5 }}>
          {["#ff5f57","#febc2e","#28c840"].map((c,i)=><div key={i} style={{ width:10,height:10,borderRadius:"50%",background:c }}/>)}
        </div>
        <div style={{ flex:1, background:T.raised, borderRadius:6, padding:"3px 10px", fontSize:11, color:T.textMuted, fontFamily:"monospace", overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap" as const }}>{previewUrl}</div>
        <button onClick={doRefresh} disabled={refreshing} style={{ background:"none", border:`1px solid ${T.border}`, borderRadius:6, padding:"3px 8px", fontSize:12, cursor:refreshing?"wait":"pointer", color:T.textMuted }}>
          {refreshing?"⏳":"↺"}
        </button>
        <a href={previewUrl} target="_blank" rel="noreferrer" style={{ background:T.green+"20", color:T.green, border:`1px solid ${T.green}35`, borderRadius:6, padding:"3px 10px", fontSize:11, fontWeight:700, textDecoration:"none" }}>Open →</a>
      </div>
      <a href={previewUrl} target="_blank" rel="noreferrer" style={{ display:"block", position:"relative" }}>
        {refreshing && <div style={{ position:"absolute", inset:0, background:T.raised+"cc", display:"flex", alignItems:"center", justifyContent:"center", zIndex:1, fontSize:13, color:T.textMuted }}>Taking screenshot…</div>}
        {!thumbErr
          ? <img key={key} src={thumb} alt="Preview" onError={()=>setThumbErr(true)} style={{ width:"100%", display:"block", maxHeight:380, objectFit:"cover", objectPosition:"top" }}/>
          : <div style={{ height:240, display:"flex", flexDirection:"column", alignItems:"center", justifyContent:"center", gap:10, color:T.textMuted }}>
              <div style={{ fontSize:28 }}>🌐</div>
              <div style={{ fontSize:13, color:T.textSec, fontWeight:600 }}>Click to open site</div>
              <button onClick={e=>{e.preventDefault();doRefresh();}} style={{ fontSize:11,color:T.blue,background:"none",border:"none",cursor:"pointer",textDecoration:"underline" }}>Retry screenshot</button>
            </div>}
      </a>
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
  const [tab, setTab] = useState<"overview"|"analytics"|"seo"|"site"|"payments"|"actions"|"requests">("overview");
  const [featureRequests, setFeatureRequests] = useState<any[]>([]);
  const [frLoading, setFrLoading] = useState(false);
  const [frUpdating, setFrUpdating] = useState<string|null>(null);
  const [feeInputs, setFeeInputs] = useState<Record<string,string>>({});
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
  const tabs = ["overview","analytics","seo","site","payments","actions","requests"] as const;

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
          {tabBtn("overview","Overview")}
          {tabBtn("analytics","Analytics")}
          {tabBtn("seo","SEO")}
          {tabBtn("site","Site")}
          {tabBtn("payments","Payments")}
          {tabBtn("actions","Actions")}
          {tabBtn("requests", `Requests${pending>0?` (${pending})`:""}`)}
        </div>

        {/* Tab content */}
        <div key={tab} className="wg-tab" style={{ flex:1, overflowY:"auto" as const, padding:"24px" }}>

          {/* OVERVIEW */}
          {tab==="overview"&&(
            <>
              <div style={{ display:"grid", gridTemplateColumns:"repeat(auto-fill,minmax(130px,1fr))", gap:10, marginBottom:24 }}>
                {[
                  {label:"Views/month",value:a?.thisMonth.views??0,color:T.blue},
                  {label:"Today",value:a?.today.views??0,color:T.green},
                  {label:"All-time",value:a?.totals.views??0,color:T.textSec},
                  {label:"Booking clicks",value:a?.thisMonth.bookingClicks??0,color:T.amber},
                  {label:"Bookings",value:c.bookingCount,color:T.purple},
                  {label:"Form submits",value:a?.totals.formSubmits??0,color:T.cyan},
                ].map(s=>(
                  <div key={s.label} style={{ background:T.surface, border:`1px solid ${T.border}`, borderRadius:10, padding:"14px 16px", boxShadow:T.shadow }}>
                    <div style={{ fontSize:22,fontWeight:700,color:s.color,letterSpacing:"-0.02em",lineHeight:1 }}>{s.value}</div>
                    <div style={{ fontSize:11,color:T.textMuted,marginTop:5,fontWeight:500 }}>{s.label}</div>
                  </div>
                ))}
              </div>
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

          {/* ANALYTICS */}
          {tab==="analytics"&&(
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
              {c.previewUrl&&(
                <div style={{marginBottom:20}}>
                  {sectionTitle("Live preview")}
                  {c.buildStatus==="building"
                    ? <div style={{borderRadius:10,border:`1px solid ${T.border}`,background:T.raised,height:160,display:"flex",alignItems:"center",justifyContent:"center"}}><div style={{color:T.textMuted,fontSize:13}}>⏳ Building… preview appears when done</div></div>
                    : <PreviewFrame previewUrl={c.previewUrl} builtAt={c.builtAt}/>}
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
        background:T.surface, border:`1px solid ${T.border}`, borderRadius:14,
        padding:"18px 20px", boxShadow:T.shadow, position:"relative", overflow:"hidden",
      }}
      onMouseEnter={e=>(e.currentTarget as HTMLElement).style.borderColor=T.borderHov}
      onMouseLeave={e=>(e.currentTarget as HTMLElement).style.borderColor=T.border}
      >
        {/* Status glow */}
        <div style={{ position:"absolute", top:0, right:0, width:100, height:100, background:`radial-gradient(circle at top right, ${statusColor}15, transparent 70%)`, pointerEvents:"none" }}/>

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
          <div style={{ width:40,height:40,borderRadius:10,background:`linear-gradient(135deg,${statusColor}28,${statusColor}0c)`,border:`1px solid ${statusColor}35`,display:"flex",alignItems:"center",justifyContent:"center",fontSize:14,fontWeight:700,color:statusColor,flexShrink:0 }}>
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

// ── Admin dashboard ────────────────────────────────────────────────────────────
function AdminDashboard() {
  const [dark, setDark] = useState(true);
  useEffect(()=>{ const s=localStorage.getItem("wg_admin_theme"); setDark(s!=="light"); },[]);
  T = dark ? DARK : LIGHT;

  const [clients, setClients] = useState<ClientAnalytics[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState<"all"|"active"|"building"|"unpaid">("all");
  const [sort, setSort] = useState<"views"|"name"|"status">("views");
  const { toasts, add: toast } = useToast();

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

  const inp:React.CSSProperties={flex:1,minWidth:200,background:T.surface,border:`1px solid ${T.border}`,borderRadius:8,padding:"9px 14px",color:T.text,fontSize:13,outline:"none",boxSizing:"border-box",fontFamily:"inherit"};

  return (
    <div style={{ minHeight:"100vh", background:T.bg, color:T.text, fontFamily:"'Inter',-apple-system,BlinkMacSystemFont,sans-serif", transition:"background 0.25s, color 0.25s" }}>
      <style>{CSS}</style>
      <Toasts toasts={toasts}/>

      {/* Top nav */}
      <div style={{ background:T.surface, borderBottom:`1px solid ${T.border}`, padding:"0 24px", display:"flex", alignItems:"center", justifyContent:"space-between", height:56, position:"sticky" as const, top:0, zIndex:100, boxShadow:T.shadow, transition:"background 0.25s, border-color 0.25s" }}>
        <div style={{ display:"flex", alignItems:"center", gap:12 }}>
          <div style={{ width:30,height:30,borderRadius:8,background:`linear-gradient(135deg,${T.green},#0ea5e9)`,flexShrink:0 }}/>
          <span style={{ fontSize:15,fontWeight:800,color:T.text,letterSpacing:"-0.03em" }}>WebGecko</span>
          <span style={{ fontSize:10,color:T.textMuted,background:T.raised,border:`1px solid ${T.border}`,borderRadius:5,padding:"2px 7px",fontWeight:700,letterSpacing:"0.07em" }}>ADMIN</span>
          {clients.some(c=>c.buildStatus==="building")&&(
            <div style={{ display:"flex",alignItems:"center",gap:6,background:T.amber+"12",border:`1px solid ${T.amber}30`,borderRadius:20,padding:"3px 10px" }}>
              <div style={{ width:6,height:6,borderRadius:"50%",background:T.amber,animation:"wg-ping 1.2s infinite" }}/>
              <span style={{ fontSize:11,color:T.amber,fontWeight:600 }}>{clients.filter(c=>c.buildStatus==="building").length} building</span>
            </div>
          )}
        </div>
        <div style={{ display:"flex",gap:8,alignItems:"center" }}>
          <button onClick={loadDashboard} style={{ background:T.raised,border:`1px solid ${T.border}`,color:T.textMuted,borderRadius:8,padding:"6px 14px",fontSize:12,cursor:"pointer" }}>↻ Refresh</button>
          <button onClick={toggleTheme} title={dark?"Light mode":"Dark mode"} style={{ background:T.raised,border:`1px solid ${T.border}`,color:T.textMuted,borderRadius:8,padding:"6px 10px",fontSize:14,cursor:"pointer",width:36,height:32,display:"flex",alignItems:"center",justifyContent:"center" }}>
            {dark?"☀️":"🌙"}
          </button>
          <button onClick={handleLogout} style={{ background:"transparent",color:T.textMuted,border:`1px solid ${T.border}`,borderRadius:8,padding:"6px 14px",fontSize:12,cursor:"pointer" }}>Sign out</button>
        </div>
      </div>

      <div style={{ maxWidth:1100,margin:"0 auto",padding:"28px 24px" }}>

        {/* Stats */}
        {!loading&&!error&&(
          <div style={{ display:"grid",gridTemplateColumns:"repeat(auto-fill,minmax(175px,1fr))",gap:12,marginBottom:28 }}>
            {[
              {label:"Total clients",value:totals.clients,color:T.text,icon:"👥"},
              {label:"Monthly active",value:totals.active,color:T.green,icon:"✅"},
              {label:"Est. MRR",value:"$"+totals.mrr.toLocaleString(),color:T.green,icon:"💰"},
              {label:"Views this month",value:totals.views,color:T.blue,icon:"👁"},
              {label:"Total bookings",value:totals.bookings,color:T.amber,icon:"📅"},
            ].map(s=>(
              <div key={s.label} className="wg-card" style={{ background:T.surface,border:`1px solid ${T.border}`,borderRadius:14,padding:"18px 20px",boxShadow:T.shadow,position:"relative",overflow:"hidden",transition:"border-color 0.2s" }}
                onMouseEnter={e=>(e.currentTarget as HTMLElement).style.borderColor=s.color+"50"}
                onMouseLeave={e=>(e.currentTarget as HTMLElement).style.borderColor=T.border}>
                <div style={{ position:"absolute",top:0,right:0,width:80,height:80,background:`radial-gradient(circle at top right,${s.color}12,transparent 70%)`,pointerEvents:"none" }}/>
                <div style={{ fontSize:20,marginBottom:10 }}>{s.icon}</div>
                <div style={{ fontSize:26,fontWeight:700,letterSpacing:"-0.03em",lineHeight:1,marginBottom:6 }}>
                  {typeof s.value==="number" ? <AnimNum value={s.value} color={s.color}/> : <span style={{color:s.color}}>{s.value}</span>}
                </div>
                <div style={{ fontSize:12,color:T.textMuted,fontWeight:500 }}>{s.label}</div>
              </div>
            ))}
          </div>
        )}

        {/* Error */}
        {error&&<div style={{ background:T.red+"0a",border:`1px solid ${T.red}25`,borderRadius:10,padding:"14px 18px",color:T.red,marginBottom:20,fontSize:13 }}>{error}</div>}

        {/* Search + filters */}
        <div style={{ display:"flex",gap:10,marginBottom:16,flexWrap:"wrap" as const,alignItems:"center" }}>
          <input type="text" placeholder="Search clients by name or industry…" value={search} onChange={e=>setSearch(e.target.value)} style={inp}/>
          <div style={{ display:"flex",gap:3,background:T.surface,border:`1px solid ${T.border}`,borderRadius:8,padding:3 }}>
            {(["all","active","building","unpaid"] as const).map(f=>(
              <button key={f} onClick={()=>setFilter(f)} style={{ padding:"5px 12px",fontSize:12,fontWeight:filter===f?600:400,color:filter===f?T.text:T.textMuted,background:filter===f?T.raised:"transparent",border:filter===f?`1px solid ${T.border}`:"1px solid transparent",borderRadius:6,cursor:"pointer",transition:"all 0.15s" }}>
                {f==="all"?"All":f.charAt(0).toUpperCase()+f.slice(1)}
              </button>
            ))}
          </div>
          <select value={sort} onChange={e=>setSort(e.target.value as any)} style={{ background:T.surface,border:`1px solid ${T.border}`,borderRadius:8,padding:"7px 12px",color:T.text,fontSize:12,cursor:"pointer",outline:"none" }}>
            <option value="views">Sort: Views</option>
            <option value="name">Sort: Name</option>
            <option value="status">Sort: Status</option>
          </select>
          <div style={{ marginLeft:"auto",fontSize:12,color:T.textMuted }}>{filtered.length} of {clients.length} clients</div>
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
