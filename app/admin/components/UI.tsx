// app/admin/components/UI.tsx

import React, { useState, useEffect, useRef, useCallback } from "react";
import { DARK, LIGHT } from "../types";

// Helper to resolve current theme
const getTheme = (dark: boolean) => (dark ? DARK : LIGHT);

export function GeckoLogo({ size = 28, color = "#00d4a0" }: { size?: number; color?: string }) {
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

export function SparkLine({ data, color = "#4a9eff", height = 36, width = 90 }: { data: number[]; color?: string; height?: number; width?: number }) {
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
    <svg width={width} height={height} viewBox={`0 0 ${width} ${height}`} style={{ overflow: "visible" }}>
      <defs>
        <linearGradient id={`sg-${color.replace("#", "")}`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={color} stopOpacity="0.3"/>
          <stop offset="100%" stopColor={color} stopOpacity="0.0"/>
        </linearGradient>
      </defs>
      <path d={areaPath} fill={`url(#sg-${color.replace("#", "")})`}/>
      <polyline points={polyline} fill="none" stroke={color} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/>
    </svg>
  );
}

export function AnimNum({ value, color }: { value: number; color: string }) {
  const [d, setD] = useState(0);
  const r = useRef<any>(null);
  useEffect(() => {
    if (r.current) clearInterval(r.current);
    let i = 0; const steps = 30;
    r.current = setInterval(() => {
      i++; setD(Math.round(value * (i / steps)));
      if (i >= steps) { clearInterval(r.current); setD(value); }
    }, 16);
    return () => clearInterval(r.current);
  }, [value]);

  return <span style={{ color }}>{d.toLocaleString()}</span>;
}

export function Pill({ color, children }: { color: string; children: React.ReactNode }) {
  return (
    <span style={{ display: "inline-flex", alignItems: "center", background: color + "18", color, border: `1px solid ${color}38`, borderRadius: 6, padding: "2px 8px", fontSize: 11, fontWeight: 600, letterSpacing: "0.02em", whiteSpace: "nowrap" as const }}>
      {children}
    </span>
  );
}

export function InfoRow({ label, value, mono = false, dark = true }: { label: string; value?: string | null; mono?: boolean; dark?: boolean }) {
  if (!value) return null;
  const T = getTheme(dark);
  return (
    <div style={{ marginBottom: 12 }}>
      <div style={{ fontSize: 10, color: T.textSec, textTransform: "uppercase", letterSpacing: "0.08em", fontWeight: 700, marginBottom: 4 }}>{label}</div>
      <div style={{ fontSize: 13, color: T.text, fontFamily: mono ? "'SF Mono','Fira Code',monospace" : "inherit", wordBreak: "break-all" as const, lineHeight: 1.5 }}>{value}</div>
    </div>
  );
}

export function ActionBtn({ label, color, confirm, onConfirm, fill = false, toast, dark = true }: {
  label: string; color: string; confirm: string; onConfirm: () => Promise<any>; fill?: boolean;
  toast?: (msg: string, type: "ok" | "err" | "info") => void; dark?: boolean;
}) {
  const [st, setSt] = useState<"idle" | "confirming" | "loading" | "ok" | "err">("idle");
  const [msg, setMsg] = useState("");
  const T = getTheme(dark);

  if (st === "ok") return <div style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 12, color: T.green, fontWeight: 500 }}>✓ {msg || "Done"}</div>;
  if (st === "err") return <div style={{ fontSize: 12, color: T.red }}>✗ {msg}</div>;

  if (st === "confirming") return (
    <div style={{ background: T.raised, border: `1px solid ${T.border}`, borderRadius: 10, padding: "12px 16px", animation: "wg-up 0.15s ease" }}>
      <div style={{ color: T.textSec, fontSize: 12, marginBottom: 12, lineHeight: 1.6 }}>{confirm}</div>
      <div style={{ display: "flex", gap: 8 }}>
        <button
          style={{ background: fill ? color : "transparent", color: fill ? "#fff" : color, border: `1px solid ${color}`, borderRadius: 7, padding: "7px 16px", fontSize: 12, fontWeight: 600, cursor: "pointer" }}
          onClick={async () => {
            setSt("loading");
            try {
              const r = await onConfirm();
              const m = r?.message || "Done";
              setMsg(m); setSt("ok"); toast?.(m, "ok");
            } catch (e) { const m = e instanceof Error ? e.message : "Failed"; setMsg(m); setSt("err"); toast?.(m, "err"); }
          }}
        >Confirm</button>
        <button style={{ background: "transparent", color: T.textMuted, border: `1px solid ${T.border}`, borderRadius: 7, padding: "7px 16px", fontSize: 12, cursor: "pointer" }} onClick={() => setSt("idle")}>Cancel</button>
      </div>
    </div>
  );

  return (
    <button
      style={{ background: fill ? color : "transparent", color: fill ? "#fff" : color, border: `1px solid ${fill ? "transparent" : color + "55"}`, borderRadius: 8, padding: "7px 16px", fontSize: 12, fontWeight: 500, cursor: "pointer", opacity: st === "loading" ? 0.5 : 1 }}
      onClick={() => setSt("confirming")}
    >{st === "loading" ? "Working…" : label}</button>
  );
}

export function InfoBtn({ text, dark = true }: { text: string; dark?: boolean }) {
  const [open, setOpen] = useState(false);
  const T = getTheme(dark);
  return (
    <span style={{ position: "relative", display: "inline-block" }}>
      <button
        onClick={e => { e.stopPropagation(); setOpen(o => !o); }}
        style={{ background: "none", border: `1px solid ${T.border}`, borderRadius: "50%", width: 16, height: 16, fontSize: 9, fontWeight: 700, color: T.textMuted, cursor: "pointer", lineHeight: "14px", padding: 0, flexShrink: 0, verticalAlign: "middle" }}
        title="Info"
      >ℹ</button>
      {open && (
        <div onClick={e => e.stopPropagation()} style={{ position: "absolute", zIndex: 9999, left: "50%", top: 22, transform: "translateX(-50%)", minWidth: 220, maxWidth: 300, background: T.raised, border: `1px solid ${T.border}`, borderRadius: 10, padding: "12px 14px", boxShadow: T.shadowLg, fontSize: 12, color: T.textSec, lineHeight: 1.6, animation: "wg-up 0.15s ease" }}>
          <button onClick={() => setOpen(false)} style={{ position: "absolute", top: 6, right: 8, background: "none", border: "none", color: T.textMuted, cursor: "pointer", fontSize: 14 }}>×</button>
          {text}
        </div>
      )}
    </span>
  );
}

export function PreviewFrame({ previewUrl, builtAt, jobId, dark = true }: { previewUrl: string; builtAt?: string; jobId?: string; dark?: boolean }) {
  const [key, setKey] = useState(() => Date.now());
  const prevRef = useRef({ builtAt, previewUrl });
  const T = getTheme(dark);

  useEffect(() => {
    if (builtAt !== prevRef.current.builtAt || previewUrl !== prevRef.current.previewUrl) {
      prevRef.current = { builtAt, previewUrl };
      setKey(Date.now());
    }
  }, [builtAt, previewUrl]);

  const doRefresh = () => setKey(Date.now());
  const SCALE = 0.55, IW = 1280, IH = 800;
  const containerH = Math.round(IH * SCALE);
  const proxySrc = jobId ? `/api/preview/proxy?jobId=${encodeURIComponent(jobId)}&_wg=${key}` : `${previewUrl}${previewUrl.includes("?") ? "&" : "?"}_wg=${key}`;
  const src = proxySrc;

  return (
    <div style={{ borderRadius: 12, overflow: "hidden", border: `1px solid ${T.border}` }}>
      <div style={{ display: "flex", alignItems: "center", gap: 8, padding: "8px 12px", background: T.surface, borderBottom: `1px solid ${T.border}` }}>
        <div style={{ display: "flex", gap: 5 }}>
          {["#ff5f57", "#febc2e", "#28c840"].map((c, i) => <div key={i} style={{ width: 10, height: 10, borderRadius: "50%", background: c }}/>)}
        </div>
        <div style={{ flex: 1, background: T.raised, borderRadius: 6, padding: "3px 10px", fontSize: 11, color: T.textMuted, fontFamily: "monospace", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" as const }}>{previewUrl}</div>
        <button onClick={doRefresh} style={{ background: "none", border: `1px solid ${T.border}`, borderRadius: 6, padding: "3px 8px", fontSize: 12, cursor: "pointer", color: T.textMuted }}>↺</button>
        <a href={previewUrl} target="_blank" rel="noreferrer" style={{ background: T.green + "20", color: T.green, border: `1px solid ${T.green}35`, borderRadius: 6, padding: "3px 10px", fontSize: 11, fontWeight: 700, textDecoration: "none" }}>Open →</a>
      </div>
      <div style={{ position: "relative", height: containerH, overflow: "hidden", background: T.raised }}>
        <iframe
          key={key}
          src={src}
          style={{ width: IW, height: IH, border: "none", transform: `scale(${SCALE})`, transformOrigin: "top left", pointerEvents: "auto" }}
          sandbox="allow-scripts allow-forms allow-popups allow-popups-to-escape-sandbox allow-same-origin"
          title="Site preview"
        />
      </div>
    </div>
  );
}

export function DeployHtmlLive({ jobId, onDeployed, toast, dark = true }: { jobId: string; onDeployed: (url: string) => void; toast: (msg: string, t: "ok" | "err" | "info") => void; dark?: boolean }) {
  const [deploying, setDeploying] = useState(false);
  const [err, setErr] = useState("");
  const [done, setDone] = useState("");
  const fileRef = useRef<HTMLInputElement>(null);
  const T = getTheme(dark);

  async function handleDeploy(e: React.FormEvent) {
    e.preventDefault(); setErr(""); setDone("");
    const file = fileRef.current?.files?.[0];
    if (!file) { setErr("Select an HTML file first"); return; }
    setDeploying(true);
    try {
      const fd = new FormData(); fd.append("file", file); fd.append("jobId", jobId);
      const r = await fetch("/api/admin/deploy-html", { method: "POST", body: fd });
      const d = await r.json();
      if (!r.ok) { setErr(d.error || "Deploy failed"); return; }
      setDone(d.previewUrl);
      onDeployed(d.previewUrl);
      toast("Deployed as live preview", "ok");
      if (fileRef.current) fileRef.current.value = "";
    } catch (e) { setErr(String(e)); }
    finally { setDeploying(false); }
  }

  return (
    <div style={{ background: `${T.green}0a`, border: `${T.green}30`, borderRadius: 12, padding: "18px 20px" }}>
      <div style={{ fontSize: 11, fontWeight: 700, color: T.green, marginBottom: 4, textTransform: "uppercase" as const, letterSpacing: "0.07em" }}>Deploy HTML as Live Preview</div>
      <div style={{ fontSize: 11, color: T.textMuted, marginBottom: 14, lineHeight: 1.6 }}>Upload a hand-edited HTML file to instantly replace what's shown at the client's preview URL. Bypasses the build pipeline entirely.</div>
      <form onSubmit={handleDeploy} style={{ display: "flex", gap: 8, flexWrap: "wrap" as const, alignItems: "center" }}>
        <input ref={fileRef} type="file" accept=".html,.htm" style={{ fontSize: 12, color: T.textSec, flex: 1 }}/>
        <button type="submit" disabled={deploying} style={{ background: `linear-gradient(135deg,${T.green},#00b365)`, color: "#000", border: "none", borderRadius: 8, padding: "8px 18px", fontSize: 12, fontWeight: 700, cursor: "pointer", opacity: deploying ? 0.6 : 1, boxShadow: `0 4px 14px ${T.green}30` }}>
          {deploying ? "Deploying…" : "Deploy Live →"}
        </button>
      </form>
      {err && <div style={{ fontSize: 12, color: T.red, marginTop: 8 }}>{err}</div>}
      {done && <div style={{ fontSize: 11, color: T.green, marginTop: 8 }}>✓ Live at <a href={done} target="_blank" rel="noreferrer" style={{ color: T.green }}>{done}</a></div>}
    </div>
  );
}

export function ClientHtmlUpload({ jobId, toast, dark = true }: { jobId: string; toast: (msg: string, t: "ok" | "err" | "info") => void; dark?: boolean }) {
  const [files, setFiles] = useState<{ name: string; label: string; size: number; createdAt: string }[]>([]);
  const [uploading, setUploading] = useState(false);
  const [label, setLabel] = useState("");
  const [err, setErr] = useState("");
  const fileRef = useRef<HTMLInputElement>(null);
  const T = getTheme(dark);

  useEffect(() => { load(); }, [jobId]);
  async function load() {
    try { const r = await fetch(`/api/admin/example-htmls?jobId=${jobId}`); if (r.ok) { const d = await r.json(); setFiles(d.files || []); } } catch { }
  }

  async function handleUpload(e: React.FormEvent) {
    e.preventDefault(); setErr("");
    const file = fileRef.current?.files?.[0];
    if (!file) { setErr("Select a .html file first"); return; }
    setUploading(true);
    try {
      const fd = new FormData(); fd.append("file", file); fd.append("jobId", jobId); fd.append("label", label || file.name.replace(/\.html?$/i, ""));
      const r = await fetch("/api/admin/example-htmls", { method: "POST", body: fd });
      const d = await r.json();
      if (!r.ok) { setErr(d.error || "Upload failed"); return; }
      if (fileRef.current) fileRef.current.value = "";
      setLabel(""); await load(); toast("File uploaded", "ok");
    } catch (e) { setErr(String(e)); }
    finally { setUploading(false); }
  }

  async function handleDelete(name: string) {
    if (!confirm(`Delete ${name}?`)) return;
    await fetch("/api/admin/example-htmls", { method: "DELETE", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ name }) });
    await load(); toast("Deleted", "ok");
  }

  const inp: React.CSSProperties = { background: T.raised, border: `1px solid ${T.border}`, borderRadius: 8, padding: "8px 12px", color: T.text, fontSize: 13, outline: "none", fontFamily: "inherit", width: "100%", boxSizing: "border-box" };
  return (
    <div style={{ background: T.raised, border: `1px solid ${T.border}`, borderRadius: 12, padding: "18px 20px" }}>
      <div style={{ fontSize: 11, fontWeight: 700, color: T.blue, marginBottom: 4, textTransform: "uppercase" as const, letterSpacing: "0.07em" }}>Reference HTML Files</div>
      <div style={{ fontSize: 11, color: T.textMuted, marginBottom: 14, lineHeight: 1.6 }}>Upload HTML files for Claude to reference when building this site.</div>
      <form onSubmit={handleUpload} style={{ display: "flex", gap: 8, flexWrap: "wrap" as const, marginBottom: 14 }}>
        <input style={{ ...inp, flex: 1, minWidth: 140 }} placeholder="Label (optional)" value={label} onChange={e => setLabel(e.target.value)}/>
        <input ref={fileRef} type="file" accept=".html,.htm" style={{ fontSize: 12, color: T.textSec }}/>
        <button type="submit" disabled={uploading} style={{ background: T.blue, color: "#fff", border: "none", borderRadius: 8, padding: "8px 16px", fontSize: 12, fontWeight: 600, cursor: "pointer", opacity: uploading ? 0.6 : 1 }}>
          {uploading ? "Uploading…" : "Upload"}
        </button>
      </form>
      {err && <div style={{ fontSize: 12, color: T.red, marginBottom: 10 }}>{err}</div>}
      {files.map(f => (
        <div key={f.name} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", background: T.surface, borderRadius: 8, padding: "8px 12px", border: `1px solid ${T.border}`, marginBottom: 6 }}>
          <div><span style={{ fontSize: 13, color: T.text, fontWeight: 500 }}>{f.label}</span><span style={{ fontSize: 11, color: T.textMuted, marginLeft: 8 }}>{Math.round(f.size / 1024)}KB</span></div>
          <button onClick={() => handleDelete(f.name)} style={{ background: "none", border: `1px solid ${T.red}40`, color: T.red, borderRadius: 6, padding: "3px 10px", fontSize: 11, cursor: "pointer" }}>Delete</button>
        </div>
      ))}
      {files.length === 0 && <div style={{ fontSize: 12, color: T.textMuted }}>No reference files yet.</div>}
    </div>
  );
}
