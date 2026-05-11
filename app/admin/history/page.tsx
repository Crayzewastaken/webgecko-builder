"use client";
import { useState, useEffect } from "react";
import Link from "next/link";
import uiHistory from "@/lib/ui-history.json";

const T = {
  bg: "#07070c", surface: "#0d0d18", raised: "#12121f",
  border: "#1a1a2e", text: "#e8e8f0", textSec: "#c8c8e0",
  textMuted: "#8888aa", green: "#00c896", blue: "#3b82f6",
  amber: "#f59e0b", purple: "#a855f7", red: "#ef4444",
};

const TYPE_COLOR: Record<string, string> = {
  feat: "#3b82f6", redesign: "#a855f7", fix: "#f59e0b", chore: "#8888aa",
};

interface PipelineError {
  id: string;
  job_id: string;
  step: string;
  type: string;
  message: string;
  fixed: boolean;
  created_at: string;
}

export default function AdminUIHistory() {
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
    <div style={{ minHeight:"100vh", background:T.bg, color:T.text, fontFamily:"'Space Grotesk','Inter',-apple-system,sans-serif", padding:"32px" }}>
      <div style={{ maxWidth:1100, margin:"0 auto" }}>
        <div style={{ display:"flex", alignItems:"center", gap:16, marginBottom:24 }}>
          <Link href="/admin" style={{ color:T.textMuted, fontSize:13, textDecoration:"none", background:T.surface, border:`1px solid ${T.border}`, borderRadius:8, padding:"6px 14px" }}>← Admin</Link>
          <div>
            <h1 style={{ margin:0, fontSize:22, fontWeight:800, letterSpacing:"-0.03em" }}>WebGecko History</h1>
            <div style={{ fontSize:12, color:T.textMuted, marginTop:3 }}>Auto-updated on each push</div>
          </div>
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
                const col = TYPE_COLOR[v.type] || T.blue;
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
              const col = TYPE_COLOR[v.type] || T.blue;
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
    </div>
  );
}
