import React, { useState, useEffect, useRef, useCallback } from 'react';
import { ClientAnalytics, DARK, LIGHT } from '../types';
import { GeckoLogo, SparkLine, AnimNum, Pill, InfoRow, ActionBtn, InfoBtn, PreviewFrame, DeployHtmlLive, ClientHtmlUpload } from './UI';

interface ClientPanelProps {
  c: ClientAnalytics;
  secret: string;
  onClose: () => void;
  toast: (msg: string, t: 'ok' | 'err' | 'info') => void;
  dark?: boolean;
}

export default function ClientPanel({ c, secret, onClose, toast, dark = true }: ClientPanelProps) {
  const T = dark ? DARK : LIGHT;
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
                <div style={{fontSize:13,color:T.textSec,marginBottom:16,lineHeight:1.7}}>
                  Point the domain A record to Vercel's IP, then assign here to activate it.
                </div>
                <div style={{fontSize:11,color:T.blue,background:T.blue+"12",border:`1px solid ${T.blue}30`,borderRadius:7,padding:"7px 12px",marginBottom:14,display:"flex",alignItems:"center",gap:6}}>
                  <span>&#x1F4BE;</span> Stored in <code style={{fontFamily:"monospace",background:"transparent"}}>metadata.domainUrl</code>
                </div>
                <div style={{display:"flex",gap:10,alignItems:"flex-end"}}>
                  <div style={{flex:1}}>
                    <label style={{fontSize:12,color:T.textSec,fontWeight:700,display:"block",marginBottom:6}}>Domain</label>
                    <input value={customDomain} onChange={e=>setCustomDomain(e.target.value)} placeholder="example.com.au"
                      style={{width:"100%",boxSizing:"border-box" as const,background:T.bg,border:`1px solid ${T.border}`,borderRadius:7,padding:"10px 14px",color:T.text,fontSize:13,outline:"none",fontFamily:"monospace"}}/>
                    <div style={{fontSize:11,color:T.textSec,marginTop:4}}>Without https:// or trailing slash</div>
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
                {c.metadata?.domainStatus&&<div style={{fontSize:12,color:c.metadata.domainStatus==="Active"?T.green:T.amber,marginTop:10,display:"flex",alignItems:"center",gap:6}}><span>{c.metadata.domainStatus==="Active"?"✓":"⏳"}</span> Status: <strong>{c.metadata.domainStatus}</strong></div>}
              </div>

              {intMsg&&<div style={{fontSize:13,color:intMsg.startsWith("✓")?T.green:T.red,padding:"10px 14px",background:intMsg.startsWith("✓")?T.green+"12":T.red+"12",borderRadius:8,border:`1px solid ${intMsg.startsWith("✓")?T.green:T.red}30`,fontWeight:500}}>{intMsg}</div>}
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
