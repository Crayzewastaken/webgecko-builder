"use client";

import { useState, useEffect, useRef } from "react";

// ── Types ──────────────────────────────────────────────────────────────────────
interface PendingJob {
  jobId: string;
  businessName: string;
  industry: string;
  pages: string[];
  stitchPrompt: string;
  awaitingStitchAt: string;
  clientEmail: string;
}

// ── Theme ──────────────────────────────────────────────────────────────────────
const T = {
  bg: "#070d1a", surface: "#0c1526", raised: "#111f36",
  border: "rgba(255,255,255,0.07)", borderHov: "rgba(255,255,255,0.17)",
  text: "#f0f4ff", textSec: "#b8c8e0", textMuted: "#7a90a8",
  green: "#00d4a0", blue: "#4a9eff", amber: "#ff9f24", red: "#f43f5e",
  shadow: "0 4px 24px rgba(0,0,0,0.7), inset 0 1px 0 rgba(255,255,255,0.03)",
};

const CSS = `
  @import url('https://fonts.googleapis.com/css2?family=Space+Grotesk:wght@400;500;600;700&family=JetBrains+Mono:wght@400;500&display=swap');
  *, *::before, *::after { box-sizing: border-box; }
  body { margin: 0; background: ${T.bg}; color: ${T.text}; font-family: 'Space Grotesk', sans-serif; }
  @keyframes fadeUp { from{opacity:0;transform:translateY(12px)} to{opacity:1;transform:none} }
  @keyframes spin { to{transform:rotate(360deg)} }
  .fade-up { animation: fadeUp 0.3s ease both; }
  .spin { animation: spin 0.8s linear infinite; }
  textarea:focus, input:focus { outline: none; border-color: ${T.blue} !important; }
  ::-webkit-scrollbar { width: 4px; } ::-webkit-scrollbar-track { background: transparent; }
  ::-webkit-scrollbar-thumb { background: rgba(255,255,255,0.1); border-radius: 2px; }
  .drop-zone { border: 2px dashed ${T.border}; transition: border-color 0.2s; }
  .drop-zone.drag-over { border-color: ${T.blue}; background: rgba(74,158,255,0.05); }
  .copy-btn:active { transform: scale(0.94); }
`;

// ── Helpers ────────────────────────────────────────────────────────────────────
function timeAgo(iso: string): string {
  if (!iso) return "";
  const diff = Date.now() - new Date(iso).getTime();
  const m = Math.floor(diff / 60000);
  if (m < 1) return "just now";
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  return `${Math.floor(h / 24)}d ago`;
}

// ── Job Card ───────────────────────────────────────────────────────────────────
function JobCard({ job, onResumed }: { job: PendingJob; onResumed: () => void }) {
  const [copied, setCopied] = useState(false);
  const [dragging, setDragging] = useState(false);
  const [file, setFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  const [status, setStatus] = useState<{ ok: boolean; msg: string } | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  function copyPrompt() {
    navigator.clipboard.writeText(job.stitchPrompt).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  }

  function handleDrop(e: React.DragEvent) {
    e.preventDefault();
    setDragging(false);
    const f = e.dataTransfer.files[0];
    if (f && (f.name.endsWith(".html") || f.name.endsWith(".htm") || f.type === "text/html")) {
      setFile(f);
      setStatus(null);
    } else {
      setStatus({ ok: false, msg: "Please drop an .html file" });
    }
  }

  async function handleUpload() {
    if (!file) return;
    setUploading(true);
    setStatus(null);
    try {
      const form = new FormData();
      form.append("jobId", job.jobId);
      form.append("html", file);
      const res = await fetch("/api/admin/resume-stitch", { method: "POST", body: form });
      const data = await res.json();
      if (res.ok) {
        setStatus({ ok: true, msg: `Resumed! ${data.htmlLength?.toLocaleString() ?? "?"} chars — building now` });
        setTimeout(onResumed, 1500);
      } else {
        setStatus({ ok: false, msg: data.error || "Upload failed" });
      }
    } catch (err: any) {
      setStatus({ ok: false, msg: err.message || "Network error" });
    } finally {
      setUploading(false);
    }
  }

  return (
    <div className="fade-up" style={{
      background: T.surface, border: `1px solid ${T.border}`,
      borderRadius: 12, padding: 24, display: "flex", flexDirection: "column", gap: 20,
      boxShadow: T.shadow,
    }}>
      {/* Header */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", flexWrap: "wrap", gap: 12 }}>
        <div>
          <div style={{ fontSize: 20, fontWeight: 700, color: T.text }}>{job.businessName}</div>
          <div style={{ fontSize: 13, color: T.textMuted, marginTop: 4 }}>
            {job.industry} &nbsp;·&nbsp; Pages: {job.pages.join(", ")} &nbsp;·&nbsp; {timeAgo(job.awaitingStitchAt)}
          </div>
          {job.clientEmail && (
            <div style={{ fontSize: 12, color: T.textMuted, marginTop: 2 }}>{job.clientEmail}</div>
          )}
        </div>
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          <a
            href="https://labs.google/stitch"
            target="_blank"
            rel="noopener noreferrer"
            style={{
              display: "inline-flex", alignItems: "center", gap: 6,
              padding: "7px 14px", borderRadius: 7, fontSize: 13, fontWeight: 600,
              background: T.blue, color: "#fff", textDecoration: "none",
              transition: "opacity 0.15s",
            }}
            onMouseOver={e => (e.currentTarget.style.opacity = "0.85")}
            onMouseOut={e => (e.currentTarget.style.opacity = "1")}
          >
            <span>↗</span> Open Stitch
          </a>
        </div>
      </div>

      {/* Stitch Prompt */}
      <div>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
          <span style={{ fontSize: 12, fontWeight: 600, color: T.textMuted, letterSpacing: "0.06em", textTransform: "uppercase" }}>
            Stitch Prompt
          </span>
          <button
            className="copy-btn"
            onClick={copyPrompt}
            style={{
              display: "inline-flex", alignItems: "center", gap: 5,
              padding: "5px 12px", borderRadius: 6, fontSize: 12, fontWeight: 600,
              border: `1px solid ${T.border}`, background: T.raised, color: T.textSec,
              cursor: "pointer", transition: "all 0.15s",
            }}
          >
            {copied ? "✓ Copied!" : "Copy prompt"}
          </button>
        </div>
        <div style={{
          background: T.raised, borderRadius: 8, padding: "12px 14px",
          fontFamily: "'JetBrains Mono', monospace", fontSize: 12.5, lineHeight: 1.65,
          color: T.textSec, whiteSpace: "pre-wrap", wordBreak: "break-word",
          maxHeight: 200, overflowY: "auto", border: `1px solid ${T.border}`,
        }}>
          {job.stitchPrompt || <span style={{ color: T.textMuted }}>No prompt saved</span>}
        </div>
      </div>

      {/* Step-by-step instructions */}
      <div style={{
        background: "rgba(74,158,255,0.06)", border: `1px solid rgba(74,158,255,0.15)`,
        borderRadius: 8, padding: "12px 14px", fontSize: 13, lineHeight: 1.7, color: T.textSec,
      }}>
        <strong style={{ color: T.blue }}>How to generate:</strong>
        <ol style={{ margin: "8px 0 0 18px", padding: 0 }}>
          <li>Click <strong>Copy prompt</strong> above</li>
          <li>Click <strong>Open Stitch</strong> → create a new project → paste the prompt</li>
          <li>Click Generate and wait ~30–60 seconds</li>
          <li>In Stitch, click <strong>Export → Download HTML</strong></li>
          <li>Drop the .html file below and click <strong>Resume Pipeline</strong></li>
        </ol>
      </div>

      {/* Drop zone */}
      <div
        className={`drop-zone${dragging ? " drag-over" : ""}`}
        style={{
          borderRadius: 8, padding: "28px 20px", textAlign: "center",
          cursor: "pointer", background: file ? "rgba(0,212,160,0.05)" : T.raised,
          borderColor: file ? T.green : undefined,
        }}
        onClick={() => fileRef.current?.click()}
        onDragOver={e => { e.preventDefault(); setDragging(true); }}
        onDragLeave={() => setDragging(false)}
        onDrop={handleDrop}
      >
        <input
          ref={fileRef}
          type="file"
          accept=".html,.htm"
          style={{ display: "none" }}
          onChange={e => {
            const f = e.target.files?.[0];
            if (f) { setFile(f); setStatus(null); }
          }}
        />
        {file ? (
          <div>
            <div style={{ fontSize: 28, marginBottom: 6 }}>✅</div>
            <div style={{ fontWeight: 600, color: T.green }}>{file.name}</div>
            <div style={{ fontSize: 12, color: T.textMuted, marginTop: 4 }}>
              {(file.size / 1024).toFixed(0)} KB — click to change
            </div>
          </div>
        ) : (
          <div>
            <div style={{ fontSize: 32, marginBottom: 8 }}>📄</div>
            <div style={{ fontWeight: 600, color: T.textSec }}>Drop Stitch HTML here</div>
            <div style={{ fontSize: 12, color: T.textMuted, marginTop: 4 }}>or click to browse</div>
          </div>
        )}
      </div>

      {/* Status / Error */}
      {status && (
        <div style={{
          padding: "10px 14px", borderRadius: 7, fontSize: 13, fontWeight: 500,
          background: status.ok ? "rgba(0,212,160,0.1)" : "rgba(244,63,94,0.1)",
          border: `1px solid ${status.ok ? T.green : T.red}`,
          color: status.ok ? T.green : T.red,
        }}>
          {status.msg}
        </div>
      )}

      {/* Upload button */}
      <button
        disabled={!file || uploading}
        onClick={handleUpload}
        style={{
          padding: "12px 24px", borderRadius: 8, fontSize: 14, fontWeight: 700,
          background: file && !uploading ? T.green : T.raised,
          color: file && !uploading ? "#0a0f1a" : T.textMuted,
          border: "none", cursor: file && !uploading ? "pointer" : "not-allowed",
          transition: "all 0.2s", display: "flex", alignItems: "center", justifyContent: "center", gap: 8,
        }}
      >
        {uploading ? (
          <>
            <span className="spin" style={{ display: "inline-block", width: 16, height: 16, border: "2px solid rgba(255,255,255,0.3)", borderTopColor: T.green, borderRadius: "50%" }} />
            Uploading…
          </>
        ) : "▶ Resume Pipeline"}
      </button>
    </div>
  );
}

// ── Main Page ──────────────────────────────────────────────────────────────────
export default function PendingStitchPage() {
  const [jobs, setJobs] = useState<PendingJob[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [lastRefresh, setLastRefresh] = useState(Date.now());

  async function loadJobs() {
    setLoading(true);
    try {
      const res = await fetch("/api/admin/pending-stitch");
      if (res.status === 403) { setError("Not logged in — please visit /admin first"); return; }
      const data = await res.json();
      setJobs(data.pending || []);
      setLastRefresh(Date.now());
    } catch {
      setError("Failed to load pending jobs");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { loadJobs(); }, []);

  // Auto-refresh every 30s
  useEffect(() => {
    const id = setInterval(loadJobs, 30000);
    return () => clearInterval(id);
  }, []);

  return (
    <>
      <style>{CSS}</style>
      <div style={{ minHeight: "100vh", background: T.bg, padding: "32px 20px" }}>
        <div style={{ maxWidth: 780, margin: "0 auto" }}>

          {/* Header */}
          <div style={{ marginBottom: 32, display: "flex", justifyContent: "space-between", alignItems: "flex-start", flexWrap: "wrap", gap: 12 }}>
            <div>
              <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 6 }}>
                <a href="/admin" style={{ color: T.textMuted, textDecoration: "none", fontSize: 13 }}>← Admin</a>
              </div>
              <h1 style={{ fontSize: 28, fontWeight: 800, margin: 0, color: T.text }}>
                Pending Stitch Builds
              </h1>
              <p style={{ margin: "8px 0 0", color: T.textMuted, fontSize: 14 }}>
                These sites are waiting for you to generate HTML in Stitch and upload it here.
              </p>
            </div>
            <button
              onClick={loadJobs}
              style={{
                padding: "8px 16px", borderRadius: 7, fontSize: 13, fontWeight: 600,
                background: T.raised, color: T.textSec, border: `1px solid ${T.border}`,
                cursor: "pointer",
              }}
            >
              ↻ Refresh
            </button>
          </div>

          {/* Workflow summary */}
          <div style={{
            background: T.surface, border: `1px solid ${T.border}`, borderRadius: 10,
            padding: "16px 20px", marginBottom: 28, fontSize: 13, color: T.textMuted, lineHeight: 1.7,
          }}>
            <strong style={{ color: T.textSec }}>Workflow:</strong>&nbsp;
            Blueprint (auto) → <strong style={{ color: T.amber }}>You: generate in Stitch → upload here</strong> → Inject contact/images/booking → Deploy → Email client
          </div>

          {/* Content */}
          {loading && jobs.length === 0 ? (
            <div style={{ textAlign: "center", padding: "60px 0", color: T.textMuted }}>
              <div className="spin" style={{ display: "inline-block", width: 28, height: 28, border: `2px solid ${T.border}`, borderTopColor: T.blue, borderRadius: "50%", marginBottom: 16 }} />
              <div>Loading…</div>
            </div>
          ) : error ? (
            <div style={{ textAlign: "center", padding: "60px 0", color: T.red }}>{error}</div>
          ) : jobs.length === 0 ? (
            <div style={{
              textAlign: "center", padding: "60px 0", color: T.textMuted,
              background: T.surface, borderRadius: 12, border: `1px solid ${T.border}`,
            }}>
              <div style={{ fontSize: 40, marginBottom: 12 }}>✓</div>
              <div style={{ fontWeight: 600, fontSize: 16, color: T.textSec }}>No pending builds</div>
              <div style={{ fontSize: 13, marginTop: 6 }}>All sites are building automatically</div>
            </div>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: 24 }}>
              {jobs.map(job => (
                <JobCard
                  key={job.jobId}
                  job={job}
                  onResumed={() => setJobs(prev => prev.filter(j => j.jobId !== job.jobId))}
                />
              ))}
            </div>
          )}

          {/* Footer */}
          <div style={{ textAlign: "center", marginTop: 40, fontSize: 12, color: T.textMuted }}>
            Auto-refreshes every 30s &nbsp;·&nbsp; Last updated {new Date(lastRefresh).toLocaleTimeString()}
          </div>
        </div>
      </div>
    </>
  );
}
