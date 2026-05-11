"use client";
import { useState } from "react";
import Link from "next/link";

const T = {
  bg: "#07070c", surface: "#0d0d18", raised: "#12121f",
  border: "#1a1a2e", text: "#e8e8f0", textSec: "#c8c8e0",
  textMuted: "#8888aa", green: "#00c896", blue: "#3b82f6",
  amber: "#f59e0b", purple: "#a855f7", red: "#ef4444",
};

const VERSIONS = [
  {
    label: "v1 — Original Dashboard",
    date: "28 Apr 2026",
    commit: "bef18902",
    lines: 197,
    desc: "First admin dashboard. Simple card list, basic analytics grid per client. No tabs, no pipeline view.",
    features: ["Client card list","Analytics grid","Payment status badges","Send monthly report","Link to bookings"],
    screenshot: "v1",
  },
  {
    label: "v2 — Dashboard Rewrite",
    date: "06 May 2026",
    commit: "d20491f2",
    lines: 571,
    desc: "Major rewrite with dark/light mode toggle, professional theme, fee quoting system, and contact tab.",
    features: ["Dark/light mode","Fee quoting","Contact tab","Tabbed layout (first iteration)","Rebuild button"],
    screenshot: "v2",
  },
  {
    label: "v3 — Modern Redesign",
    date: "09 May 2026",
    commit: "862b3241",
    lines: 1050,
    desc: "Full modern redesign. Introduced sidebar client list, tabbed client panels with Perf/SEO/Site/Assets/Actions.",
    features: ["Sidebar client list","Tabbed panels (Perf, SEO, Site, Assets, Actions)","Theme token system","Pipeline log tab","Deploy HTML action"],
    screenshot: "v3",
  },
  {
    label: "v4 — Full-Width + Pipeline",
    date: "10 May 2026",
    commit: "e3030005",
    lines: 1626,
    desc: "Full-width layout with persistent KPI strip at top. Needs Attention auto-fix, content management tabs.",
    features: ["Full-width layout","KPI one-liner strip","Needs Attention auto-fix","Content mgmt (blog, newsletter, deals)","Integrations tab","GA4 + Tawk.to + Square fields"],
    screenshot: "v4",
  },
  {
    label: "v5 — Current Build",
    date: "11 May 2026",
    commit: "7c342cd",
    lines: 3014,
    desc: "Stripe Connect integration, Archive tab, per-client setup checklist with full AU legal walkthrough, payments tab.",
    features: ["Stripe Connect + Account Links","Archive tab (version history)","AU legal checklist (Termly, Spam Act, ABN, SSL)","Payments tab","Engagement analytics","Feature requests tab","🗂 Archive"],
    screenshot: "v5",
  },
];

function MockV1() {
  return (
    <div style={{background:"#080808",color:"#fff",fontFamily:"Inter,sans-serif",borderRadius:8,overflow:"hidden",fontSize:11}}>
      <div style={{padding:"10px 14px",borderBottom:"1px solid #1a1a1a",display:"flex",alignItems:"center",gap:8}}>
        <span style={{fontSize:16}}>🦎</span>
        <span style={{fontWeight:800,fontSize:13}}>WebGecko Admin</span>
        <span style={{color:"#444",fontSize:10}}>Client Analytics Overview</span>
        <button style={{marginLeft:"auto",background:"#111",border:"1px solid #1a1a1a",color:"#555",borderRadius:6,padding:"4px 8px",fontSize:10}}>↻ Refresh</button>
      </div>
      <div style={{display:"flex",gap:6,padding:10}}>
        {[["4","#fff","Total Clients"],["3","#00c896","Active"],["1.2k","#3b82f6","Views/Mo"],["28","#f59e0b","Bookings"]].map(([v,c,l])=>(
          <div key={l} style={{background:"#0f0f0f",border:"1px solid #1a1a1a",borderRadius:8,padding:"8px 10px",flex:1,textAlign:"center"}}>
            <div style={{fontSize:16,fontWeight:800,color:c}}>{v}</div>
            <div style={{fontSize:9,color:"#444"}}>{l}</div>
          </div>
        ))}
      </div>
      <div style={{margin:"0 10px 8px",background:"#0f0f0f",border:"1px solid #1a1a1a",borderRadius:8,padding:"10px 12px"}}>
        <div style={{fontWeight:700,fontSize:12}}>Acme Dental</div>
        <div style={{color:"#555",fontSize:10}}>dental · /c/acme-dental</div>
        <div style={{display:"flex",gap:4,marginTop:6}}>
          <span style={{background:"#00c89618",color:"#00c896",border:"1px solid #00c89633",borderRadius:20,padding:"2px 7px",fontSize:9,fontWeight:700}}>completed</span>
          <span style={{background:"#3b82f618",color:"#3b82f6",border:"1px solid #3b82f633",borderRadius:20,padding:"2px 7px",fontSize:9,fontWeight:700}}>Active</span>
        </div>
        <div style={{display:"grid",gridTemplateColumns:"1fr 1fr 1fr",gap:4,marginTop:8}}>
          {[["420","#3b82f6","Views"],["12","#f59e0b","Bookings"],["5","#06b6d4","Forms"]].map(([v,c,l])=>(
            <div key={l} style={{background:"#111",borderRadius:6,padding:"6px 8px"}}>
              <div style={{fontSize:14,fontWeight:800,color:c}}>{v}</div>
              <div style={{fontSize:9,color:"#444"}}>{l}</div>
            </div>
          ))}
        </div>
        <div style={{display:"flex",gap:4,marginTop:8}}>
          {["🌐 Preview","📅 Bookings","📧 Report"].map(l=>(
            <span key={l} style={{background:"#111",border:"1px solid #222",color:"#00c896",borderRadius:6,padding:"4px 7px",fontSize:9}}>{l}</span>
          ))}
        </div>
      </div>
    </div>
  );
}

function MockV2() {
  return (
    <div style={{background:"#07070c",color:"#e8e8f0",fontFamily:"Inter,sans-serif",borderRadius:8,overflow:"hidden",fontSize:11}}>
      <div style={{padding:"8px 12px",borderBottom:"1px solid #1a1a2e",display:"flex",alignItems:"center",gap:8,background:"#0a0a14"}}>
        <span style={{fontSize:14}}>🦎</span><span style={{fontWeight:800,fontSize:12}}>WebGecko Admin</span>
        <div style={{display:"flex",gap:6,marginLeft:"auto"}}>
          <button style={{background:"#1a1a2e",border:"1px solid #2a2a4a",color:"#8888aa",borderRadius:5,padding:"3px 7px",fontSize:9}}>☀ Light</button>
          <button style={{background:"#0d0d18",border:"1px solid #1a1a2e",color:"#8888aa",borderRadius:5,padding:"3px 7px",fontSize:9}}>↻</button>
        </div>
      </div>
      <div style={{display:"flex",gap:4,padding:"8px 10px"}}>
        {[["4","#fff","Clients"],["3","#00c896","Active"],["$2.4k","#f59e0b","Revenue"],["1.2k","#3b82f6","Views"]].map(([v,c,l])=>(
          <div key={l} style={{background:"#0d0d18",border:"1px solid #1a1a2e",borderRadius:7,padding:"7px 9px",flex:1,textAlign:"center"}}>
            <div style={{fontSize:14,fontWeight:800,color:c}}>{v}</div><div style={{fontSize:9,color:"#8888aa"}}>{l}</div>
          </div>
        ))}
      </div>
      <div style={{display:"flex",gap:4,padding:"0 10px 8px"}}>
        {["Overview","Contact","Analytics"].map((t,i)=>(
          <span key={t} style={{background:i===0?"#1a1a30":"transparent",border:i===0?"1px solid #2a2a50":"1px solid transparent",color:i===0?"#e8e8f0":"#8888aa",borderRadius:5,padding:"3px 9px",fontSize:10}}>{t}</span>
        ))}
      </div>
      <div style={{margin:"0 10px 8px",background:"#0d0d18",border:"1px solid #1a1a2e",borderRadius:8,padding:"8px 10px"}}>
        <div style={{display:"flex",justifyContent:"space-between",alignItems:"center"}}>
          <div><div style={{fontWeight:700,fontSize:11}}>Acme Dental</div><div style={{color:"#8888aa",fontSize:9}}>dental · fee: $199/mo</div></div>
          <div style={{display:"flex",gap:3}}>
            <span style={{background:"#00c89618",color:"#00c896",borderRadius:20,padding:"1px 6px",fontSize:8,fontWeight:700,border:"1px solid #00c89633"}}>live</span>
            <span style={{background:"#3b82f618",color:"#3b82f6",borderRadius:20,padding:"1px 6px",fontSize:8,fontWeight:700,border:"1px solid #3b82f633"}}>Paid</span>
          </div>
        </div>
        <div style={{display:"flex",gap:4,marginTop:6}}>
          {["Preview ↗","Edit","Report","Rebuild"].map(b=>(
            <span key={b} style={{background:"#12121f",border:"1px solid #1a1a2e",color:"#aaaacc",borderRadius:5,padding:"3px 7px",fontSize:9}}>{b}</span>
          ))}
        </div>
      </div>
    </div>
  );
}

function MockV3() {
  return (
    <div style={{background:"#07070c",color:"#e8e8f0",fontFamily:"Inter,sans-serif",borderRadius:8,overflow:"hidden",fontSize:11,display:"flex",flexDirection:"column"}}>
      <div style={{padding:"8px 12px",borderBottom:"1px solid #1a1a2e",display:"flex",alignItems:"center",gap:8,background:"#0a0a14"}}>
        <span>🦎</span><span style={{fontWeight:800,fontSize:12}}>WebGecko Admin</span>
      </div>
      <div style={{display:"flex",flex:1}}>
        <div style={{width:160,borderRight:"1px solid #1a1a2e",padding:6}}>
          <input readOnly placeholder="Search…" style={{width:"100%",background:"#111120",border:"1px solid #1a1a2e",borderRadius:5,padding:"4px 7px",color:"#8888aa",fontSize:9,outline:"none",marginBottom:6}}/>
          <div style={{background:"#12121f",border:"1px solid #3b82f680",borderRadius:7,padding:"6px 8px",marginBottom:4}}>
            <div style={{fontWeight:600,fontSize:11}}>Acme Dental</div>
            <div style={{color:"#8888aa",fontSize:9}}>dental</div>
            <span style={{background:"#00c89618",color:"#00c896",borderRadius:20,padding:"1px 5px",fontSize:8,fontWeight:700,border:"1px solid #00c89633",marginTop:3,display:"inline-block"}}>live</span>
          </div>
          <div style={{background:"#0d0d18",border:"1px solid #1a1a2e",borderRadius:7,padding:"6px 8px",opacity:.6}}>
            <div style={{fontWeight:600,fontSize:11}}>Brisbane Physio</div>
            <div style={{color:"#8888aa",fontSize:9}}>physio</div>
          </div>
        </div>
        <div style={{flex:1,padding:8}}>
          <div style={{display:"flex",gap:3,marginBottom:8,flexWrap:"wrap"}}>
            {["Perf","SEO","Site","Assets","Actions","Pipeline"].map((t,i)=>(
              <span key={t} style={{background:i===0?"#1a1a30":"transparent",border:i===0?"1px solid #3b82f680":"1px solid #1a1a2e",color:i===0?"#e8e8f0":"#8888aa",borderRadius:5,padding:"2px 7px",fontSize:9}}>{t}</span>
            ))}
          </div>
          <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:6,marginBottom:8}}>
            {[["420","#3b82f6","Views/Mo"],["12","#f59e0b","Bookings"]].map(([v,c,l])=>(
              <div key={l} style={{background:"#0d0d18",border:"1px solid #1a1a2e",borderRadius:7,padding:"7px 9px"}}>
                <div style={{fontSize:16,fontWeight:800,color:c}}>{v}</div><div style={{fontSize:9,color:"#8888aa"}}>{l}</div>
              </div>
            ))}
          </div>
          <div style={{background:"#010508",border:"1px solid #1a1a2e",borderRadius:7,padding:"7px 9px",fontFamily:"monospace",fontSize:9}}>
            <div style={{color:"#00c896"}}>✓ Step1 blueprint built</div>
            <div style={{color:"#00c896"}}>✓ Step3 HTML generated</div>
            <div style={{color:"#f59e0b"}}>⚠ Step5 map replaced</div>
            <div style={{color:"#00c896"}}>✓ Step8 deployed</div>
          </div>
        </div>
      </div>
    </div>
  );
}

function MockV4() {
  return (
    <div style={{background:"#07070c",color:"#e8e8f0",fontFamily:"Inter,sans-serif",borderRadius:8,overflow:"hidden",fontSize:11}}>
      <div style={{background:"#0a0a14",borderBottom:"1px solid #1a1a2e",padding:"7px 12px",display:"flex",alignItems:"center",gap:12}}>
        <span>🦎</span><span style={{fontWeight:800,fontSize:12}}>WebGecko</span>
        <div style={{display:"flex",gap:14,marginLeft:8}}>
          {[["4","#fff","Clients"],["3","#00c896","Active"],["2","#f59e0b","Attention"],["1.4k","#3b82f6","Views"]].map(([v,c,l])=>(
            <div key={l} style={{textAlign:"center"}}>
              <div style={{fontSize:13,fontWeight:800,color:c}}>{v}</div>
              <div style={{fontSize:8,color:"#8888aa"}}>{l}</div>
            </div>
          ))}
        </div>
      </div>
      <div style={{display:"flex",height:160}}>
        <div style={{width:155,borderRight:"1px solid #1a1a2e",padding:5}}>
          <input readOnly placeholder="Search…" style={{width:"100%",background:"#111120",border:"1px solid #1a1a2e",borderRadius:4,padding:"3px 6px",color:"#8888aa",fontSize:9,outline:"none",marginBottom:5}}/>
          <div style={{background:"#12121f",border:"1px solid #3b82f680",borderRadius:6,padding:"5px 7px",marginBottom:3}}>
            <div style={{fontWeight:600,fontSize:10}}>Acme Dental</div>
            <span style={{background:"#00c89618",color:"#00c896",borderRadius:20,padding:"1px 5px",fontSize:8,border:"1px solid #00c89633"}}>live</span>
          </div>
        </div>
        <div style={{flex:1,padding:7}}>
          <div style={{display:"flex",gap:3,marginBottom:7,flexWrap:"wrap"}}>
            {["Perf","SEO","Site","Assets","Integrations","Content","Actions","Pipeline"].map((t,i)=>(
              <span key={t} style={{background:i===0?"#1a1a30":"transparent",border:i===0?"1px solid #3b82f680":"1px solid #1a1a2e",color:i===0?"#e8e8f0":"#8888aa",borderRadius:4,padding:"2px 6px",fontSize:8}}>{t}</span>
            ))}
          </div>
          <div style={{background:"#0d0d18",border:"1px solid #a855f730",borderRadius:7,padding:"6px 8px",marginBottom:5}}>
            <div style={{fontSize:9,fontWeight:700,color:"#a855f7",marginBottom:4}}>⚠ NEEDS ATTENTION</div>
            <div style={{fontSize:9,color:"#8888aa"}}>Missing GA4 ID · No booking URL set</div>
            <button style={{marginTop:4,fontSize:8,background:"#a855f720",color:"#a855f7",border:"1px solid #a855f740",borderRadius:4,padding:"2px 7px"}}>Auto-Fix →</button>
          </div>
          <div style={{background:"#0d0d18",border:"1px solid #1a1a2e",borderRadius:7,padding:"6px 8px"}}>
            <div style={{fontSize:9,color:"#8888aa",marginBottom:3}}>Integrations</div>
            <div style={{display:"flex",gap:4}}>
              {["GA4","Tawk.to","Square","SuperSaas"].map(i=>(
                <span key={i} style={{background:"#12121f",border:"1px solid #1a1a2e",borderRadius:4,padding:"2px 5px",fontSize:8,color:"#aaaacc"}}>{i}</span>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function MockV5() {
  return (
    <div style={{background:"#07070c",color:"#e8e8f0",fontFamily:"Inter,sans-serif",borderRadius:8,overflow:"hidden",fontSize:11}}>
      <div style={{background:"#0a0a14",borderBottom:"1px solid #1a1a2e",padding:"7px 12px",display:"flex",alignItems:"center",gap:12}}>
        <span>🦎</span><span style={{fontWeight:800,fontSize:12}}>WebGecko</span>
        <div style={{display:"flex",gap:14,marginLeft:8}}>
          {[["4","#fff","Clients"],["3","#00c896","Active"],["1","#f59e0b","Attention"],["1.8k","#3b82f6","Views"]].map(([v,c,l])=>(
            <div key={l} style={{textAlign:"center"}}>
              <div style={{fontSize:13,fontWeight:800,color:c}}>{v}</div>
              <div style={{fontSize:8,color:"#8888aa"}}>{l}</div>
            </div>
          ))}
        </div>
      </div>
      <div style={{display:"flex",height:165}}>
        <div style={{width:155,borderRight:"1px solid #1a1a2e",padding:5}}>
          <input readOnly placeholder="Search…" style={{width:"100%",background:"#111120",border:"1px solid #1a1a2e",borderRadius:4,padding:"3px 6px",color:"#8888aa",fontSize:9,outline:"none",marginBottom:5}}/>
          <div style={{background:"#12121f",border:"1px solid #3b82f680",borderRadius:6,padding:"5px 7px",marginBottom:3}}>
            <div style={{fontWeight:600,fontSize:10}}>Acme Dental</div>
            <div style={{display:"flex",gap:3,marginTop:2}}>
              <span style={{background:"#00c89618",color:"#00c896",borderRadius:20,padding:"1px 5px",fontSize:7,border:"1px solid #00c89633"}}>live</span>
              <span style={{background:"#00c89618",color:"#00c896",borderRadius:20,padding:"1px 5px",fontSize:7,border:"1px solid #00c89633"}}>Stripe ✓</span>
            </div>
          </div>
        </div>
        <div style={{flex:1,padding:6}}>
          <div style={{display:"flex",gap:2,marginBottom:6,flexWrap:"wrap"}}>
            {["Perf","Engage","SEO","Site","Assets","Integrations","Content","Payments","Actions","Checklist","🗂 Archive"].map((t,i)=>(
              <span key={t} style={{background:i===10?"#a855f720":i===0?"#1a1a30":"transparent",border:i===10?"1px solid #a855f740":i===0?"1px solid #3b82f680":"1px solid #1a1a2e",color:i===10?"#a855f7":i===0?"#e8e8f0":"#8888aa",borderRadius:4,padding:"2px 5px",fontSize:7}}>{t}</span>
            ))}
          </div>
          <div style={{background:"#0d0d18",border:"1px solid #00c89630",borderRadius:7,padding:"6px 8px",marginBottom:4}}>
            <div style={{fontSize:9,color:"#00c896",fontWeight:700}}>STRIPE CONNECTED ✓</div>
            <div style={{fontSize:8,color:"#8888aa",marginTop:2}}>acct_1Qx... · 2% fee on all transactions</div>
            <button style={{marginTop:4,fontSize:8,background:"#00c89620",color:"#00c896",border:"1px solid #00c89640",borderRadius:4,padding:"2px 7px"}}>Sync Products →</button>
          </div>
          <div style={{background:"#0d0d18",border:"1px solid #1a1a2e",borderRadius:7,padding:"5px 8px",fontSize:8,color:"#8888aa"}}>
            ✅ Termly privacy policy · ✅ GA4 tracking · ⏳ Domain SSL pending
          </div>
        </div>
      </div>
    </div>
  );
}

const MOCKS = [MockV1, MockV2, MockV3, MockV4, MockV5];

export default function AdminHistoryPage() {
  const [selected, setSelected] = useState<number|null>(null);

  return (
    <div style={{minHeight:"100vh",background:T.bg,color:T.text,fontFamily:"Inter,system-ui,sans-serif"}}>
      {/* Header */}
      <div style={{background:T.surface,borderBottom:`1px solid ${T.border}`,padding:"24px 40px",display:"flex",alignItems:"center",gap:16}}>
        <Link href="/admin" style={{color:T.textMuted,textDecoration:"none",fontSize:13,display:"flex",alignItems:"center",gap:6}}>
          ← Back to Admin
        </Link>
        <div style={{width:1,height:20,background:T.border}}/>
        <div>
          <h1 style={{fontSize:22,fontWeight:800,background:"linear-gradient(135deg,#00c896,#a855f7)",WebkitBackgroundClip:"text",WebkitTextFillColor:"transparent"}}>
            Admin Dashboard — UI Progression
          </h1>
          <p style={{fontSize:13,color:T.textMuted,marginTop:2}}>How the WebGecko admin UI evolved from day one</p>
        </div>
        <div style={{marginLeft:"auto",display:"flex",gap:12}}>
          <div style={{textAlign:"center"}}>
            <div style={{fontSize:22,fontWeight:800,color:T.text}}>5</div>
            <div style={{fontSize:11,color:T.textMuted}}>Major Versions</div>
          </div>
          <div style={{textAlign:"center"}}>
            <div style={{fontSize:22,fontWeight:800,color:T.green}}>307</div>
            <div style={{fontSize:11,color:T.textMuted}}>Total Commits</div>
          </div>
          <div style={{textAlign:"center"}}>
            <div style={{fontSize:22,fontWeight:800,color:T.purple}}>25</div>
            <div style={{fontSize:11,color:T.textMuted}}>Days Built</div>
          </div>
        </div>
      </div>

      {/* Timeline */}
      <div style={{padding:"40px",maxWidth:1100,margin:"0 auto"}}>
        <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(380px,1fr))",gap:24}}>
          {VERSIONS.map((v,i)=>{
            const Mock = MOCKS[i];
            const isSelected = selected === i;
            return (
              <div key={i}
                onClick={()=>setSelected(isSelected?null:i)}
                style={{
                  background:T.surface,border:`1px solid ${isSelected?T.blue+"80":T.border}`,
                  borderRadius:14,overflow:"hidden",cursor:"pointer",
                  boxShadow:isSelected?`0 0 0 2px ${T.blue}30`:"none",
                  transition:"all 0.15s ease",
                }}>
                {/* Version header */}
                <div style={{padding:"16px 18px",borderBottom:`1px solid ${T.border}`,display:"flex",justifyContent:"space-between",alignItems:"flex-start"}}>
                  <div>
                    <div style={{fontSize:15,fontWeight:700,color:T.text}}>{v.label}</div>
                    <div style={{fontSize:11,color:T.textMuted,marginTop:3}}>{v.date} · {v.lines} lines · <code style={{background:T.raised,borderRadius:4,padding:"1px 4px",fontSize:10}}>{v.commit}</code></div>
                  </div>
                  <div style={{fontSize:28,fontWeight:900,color:T.border}}>v{i+1}</div>
                </div>

                {/* Description */}
                <div style={{padding:"10px 18px",borderBottom:`1px solid ${T.border}`,fontSize:12,color:T.textSec,lineHeight:1.6}}>
                  {v.desc}
                </div>

                {/* Mock browser */}
                <div style={{margin:0}}>
                  <div style={{background:"#0a0a14",padding:"7px 12px",borderBottom:`1px solid ${T.border}`,display:"flex",alignItems:"center",gap:6}}>
                    <span style={{width:8,height:8,borderRadius:"50%",background:"#ef4444",display:"inline-block"}}/>
                    <span style={{width:8,height:8,borderRadius:"50%",background:"#f59e0b",display:"inline-block"}}/>
                    <span style={{width:8,height:8,borderRadius:"50%",background:"#00c896",display:"inline-block"}}/>
                    <span style={{fontSize:10,color:T.textMuted,marginLeft:6,background:T.raised,borderRadius:4,padding:"1px 8px",flex:1}}>
                      webgecko-builder.vercel.app/admin
                    </span>
                  </div>
                  <div style={{padding:10,background:"#05050f"}}>
                    <Mock/>
                  </div>
                </div>

                {/* Features list */}
                {isSelected&&(
                  <div style={{padding:"12px 18px",background:T.raised,borderTop:`1px solid ${T.border}`}}>
                    <div style={{fontSize:10,fontWeight:700,color:T.textMuted,textTransform:"uppercase",letterSpacing:"0.08em",marginBottom:8}}>Features in this version</div>
                    {v.features.map(f=>(
                      <div key={f} style={{fontSize:12,color:T.textSec,padding:"3px 0",borderBottom:`1px solid ${T.border}`,display:"flex",alignItems:"center",gap:6}}>
                        <span style={{color:T.green}}>✓</span> {f}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
