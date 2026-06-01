import { useState, useRef } from "react";

const G    = "#00C896";
const BG   = "#F7F8FA";
const CARD = "#FFFFFF";
const LINE = "#EAECF2";
const INK  = "#111827";
const DIM  = "#6B7280";
const DARK = "#0F1117";

const Ico = ({ d, size = 22, color = "currentColor", sw = 1.8 }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none"
    stroke={color} strokeWidth={sw} strokeLinecap="round" strokeLinejoin="round">
    <path d={d} />
  </svg>
);

const ic = {
  upload:  "M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4M17 8l-5-5-5 5M12 3v12",
  camera:  "M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2zM12 17a4 4 0 1 0 0-8 4 4 0 0 0 0 8z",
  mic:     "M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3zM19 10v2a7 7 0 0 1-14 0v-2M12 19v4M8 23h8",
  link:    "M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71",
  inbox:   "M22 12h-6l-2 3h-4l-2-3H2M5.45 5.11L2 12v6a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2v-6l-3.45-6.89A2 2 0 0 0 16.76 4H7.24a2 2 0 0 0-1.79 1.11z",
  check:   "M20 6L9 17l-5-5",
  dollar:  "M12 1v22M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6",
  user:    "M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2M12 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8z",
  plus:    "M12 5v14M5 12h14",
  x:       "M18 6L6 18M6 6l12 12",
  bell:    "M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9M13.73 21a2 2 0 0 1-3.46 0",
  send:    "M22 2L11 13M22 2L15 22l-4-9-9-4 20-7z",
  chart:   "M18 20V10M12 20V4M6 20v-6",
  cal:     "M3 9h18M3 4h18v16a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1V4zM8 2v4M16 2v4",
  chevron: "M9 18l6-6-6-6",
  back:    "M19 12H5M12 19l-7-7 7-7",
  dl:      "M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4M7 10l5 5 5-5M12 15V3",
  shield:  "M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z",
  home:    "M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2zM9 22V12h6v10",
};

const PL = {
  Instagram: { color: "#E1306C", bg: "#fdf0f4", label: "IG" },
  Facebook:  { color: "#1877F2", bg: "#eff5fe", label: "FB" },
  LinkedIn:  { color: "#0A66C2", bg: "#eef4fb", label: "LI" },
  TikTok:    { color: "#333",    bg: "#f3f3f3", label: "TT" },
};

const Badge = ({ platform }) => {
  const p = PL[platform] || { color: DIM, bg: BG, label: platform?.slice(0,2) };
  return <span style={{ fontSize: 11, fontWeight: 700, padding: "3px 8px", borderRadius: 6, color: p.color, background: p.bg }}>{p.label} {platform}</span>;
};

const GeckoMark = ({ size = 28, color = G }) => (
  <svg width={size} height={size} viewBox="0 0 64 64" fill="none">
    <g transform="translate(32,32)">
      <path fill={color} d="M 18 28 Q 44 36 46 56 Q 38 44 20 34 Z" />
      <path fill={color} d="M -9 22 Q -28 30 -36 42 L -32 44 Q -25 33 -8 26 Z" />
      <path stroke={color} strokeWidth="2.5" strokeLinecap="round" fill="none" d="M -36 42 Q -42 46 -44 52 M -36 42 Q -39 50 -37 56 M -36 42 Q -32 50 -30 54" />
      <path fill={color} d="M 9 22 Q 26 30 32 42 L 28 44 Q 22 33 8 26 Z" />
      <path stroke={color} strokeWidth="2.5" strokeLinecap="round" fill="none" d="M 32 42 Q 38 46 40 52 M 32 42 Q 35 50 33 56 M 32 42 Q 28 50 26 54" />
      <ellipse cx="0" cy="16" rx="11" ry="16" fill={color} />
      <path fill={color} d="M -10 4 Q -28 2 -38 -8 L -34 -12 Q -26 -4 -9 0 Z" />
      <path stroke={color} strokeWidth="2.5" strokeLinecap="round" fill="none" d="M -38 -8 Q -44 -12 -46 -18 M -38 -8 Q -42 -16 -40 -22 M -38 -8 Q -34 -16 -32 -20" />
      <path fill={color} d="M 10 4 Q 28 2 36 -10 L 32 -14 Q 26 -6 9 0 Z" />
      <path stroke={color} strokeWidth="2.5" strokeLinecap="round" fill="none" d="M 36 -10 Q 42 -14 44 -20 M 36 -10 Q 40 -18 38 -24 M 36 -10 Q 32 -18 30 -22" />
      <ellipse cx="0" cy="-4" rx="8" ry="8" fill={color} />
      <ellipse cx="0" cy="-18" rx="11" ry="13" fill={color} />
      <ellipse cx="0" cy="-28" rx="6" ry="6" fill={color} />
      <path stroke="#007a5c" strokeWidth="1.5" fill="none" strokeLinecap="round" d="M -5 -24 Q 0 -21 5 -24" />
      <circle cx="-3" cy="-32" r="1.2" fill="#007a5c" /><circle cx="3" cy="-32" r="1.2" fill="#007a5c" />
      <circle cx="-8" cy="-22" r="5.5" fill="#fff" /><circle cx="8" cy="-22" r="5.5" fill="#fff" />
      <ellipse cx="-8" cy="-22" rx="2" ry="3.5" fill="#003d2e" /><ellipse cx="8" cy="-22" rx="2" ry="3.5" fill="#003d2e" />
      <circle cx="-6.5" cy="-24" r="1.2" fill="#fff" /><circle cx="9.5" cy="-24" r="1.2" fill="#fff" />
    </g>
  </svg>
);

// ── Shared atoms ───────────────────────────────────────────────────────────
const card  = { background: CARD, borderRadius: 16, border: `1px solid ${LINE}` };
const pill  = active => ({ padding: "6px 14px", borderRadius: 20, border: `1.5px solid ${active ? G : LINE}`, background: active ? `${G}12` : "transparent", color: active ? G : DIM, fontWeight: active ? 700 : 500, fontSize: 13, cursor: "pointer", whiteSpace: "nowrap" });
const input = { width: "100%", background: BG, border: `1.5px solid ${LINE}`, borderRadius: 12, padding: "11px 14px", color: INK, fontSize: 14, outline: "none", fontFamily: "inherit", boxSizing: "border-box" };

const PrimaryBtn = ({ children, onClick, disabled, style = {} }) => (
  <button onClick={onClick} disabled={disabled} style={{ width: "100%", padding: "15px 0", borderRadius: 14, border: "none", background: disabled ? LINE : G, color: disabled ? DIM : "#fff", fontWeight: 700, fontSize: 15, cursor: disabled ? "not-allowed" : "pointer", fontFamily: "inherit", opacity: disabled ? .5 : 1, boxShadow: disabled ? "none" : `0 4px 14px ${G}30`, ...style }}>{children}</button>
);
const GhostBtn = ({ children, onClick, style = {} }) => (
  <button onClick={onClick} style={{ width: "100%", padding: "15px 0", borderRadius: 14, border: `1.5px solid ${LINE}`, background: "transparent", color: INK, fontWeight: 600, fontSize: 15, cursor: "pointer", fontFamily: "inherit", ...style }}>{children}</button>
);
const DangerBtn = ({ children, onClick }) => (
  <button onClick={onClick} style={{ width: "100%", padding: "14px 0", borderRadius: 14, border: "1px solid rgba(239,68,68,.25)", background: "rgba(239,68,68,.05)", color: "#EF4444", fontWeight: 600, fontSize: 14, cursor: "pointer", fontFamily: "inherit" }}>{children}</button>
);

function Toggle({ on, onToggle }) {
  return (
    <div onClick={onToggle} style={{ width: 44, height: 26, borderRadius: 13, background: on ? G : LINE, cursor: "pointer", position: "relative", transition: "background .2s", flexShrink: 0 }}>
      <div style={{ position: "absolute", top: 3, left: on ? 21 : 3, width: 20, height: 20, borderRadius: "50%", background: "#fff", transition: "left .2s" }} />
    </div>
  );
}

// ── File chip ──────────────────────────────────────────────────────────────
function FileChip({ file, onRemove }) {
  const url = URL.createObjectURL(file);
  return (
    <div style={{ position: "relative", width: 76, height: 76, borderRadius: 12, overflow: "hidden", border: `1px solid ${LINE}`, flexShrink: 0 }}>
      {file.type.startsWith("video/")
        ? <video src={url} style={{ width: "100%", height: "100%", objectFit: "cover" }} />
        : <img src={url} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }} />}
      <button onClick={onRemove} style={{ position: "absolute", top: 4, right: 4, width: 20, height: 20, borderRadius: "50%", background: "rgba(0,0,0,.55)", border: "none", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center" }}>
        <Ico d={ic.x} size={11} color="#fff" />
      </button>
    </div>
  );
}

// ── Voice recorder (inline, auto-starts) ──────────────────────────────────
function VoiceRecorder({ onDone, onCancel }) {
  const [phase, setPhase] = useState("starting");
  const [secs, setSecs] = useState(0);
  const [url, setUrl] = useState(null);
  const [blob, setBlob] = useState(null);
  const mr = useRef(null), chunks = useRef([]), timer = useRef(null);

  const start = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const rec = new MediaRecorder(stream);
      mr.current = rec; chunks.current = [];
      rec.ondataavailable = e => chunks.current.push(e.data);
      rec.onstop = () => {
        const b = new Blob(chunks.current, { type: "audio/webm" });
        setBlob(b); setUrl(URL.createObjectURL(b)); setPhase("done");
        stream.getTracks().forEach(t => t.stop());
      };
      rec.start(); setPhase("rec"); setSecs(0);
      timer.current = setInterval(() => setSecs(s => s + 1), 1000);
    } catch { setPhase("error"); }
  };
  const booted = useRef(false);
  if (!booted.current) { booted.current = true; setTimeout(start, 0); }
  const stop = () => { clearInterval(timer.current); mr.current?.stop(); };
  const fmt  = s => `${Math.floor(s/60)}:${String(s%60).padStart(2,"0")}`;

  return (
    <div style={{ ...card, padding: "12px 14px", display: "flex", flexDirection: "column", gap: 10 }}>
      {phase === "starting" && <p style={{ margin: 0, color: DIM, fontSize: 13 }}>Requesting microphone…</p>}
      {phase === "error"    && <p style={{ margin: 0, color: "#EF4444", fontSize: 13 }}>Microphone access denied.</p>}
      {phase === "rec" && (
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <div style={{ width: 8, height: 8, borderRadius: "50%", background: "#EF4444", flexShrink: 0 }} />
          <span style={{ flex: 1, fontWeight: 700, color: INK }}>{fmt(secs)}</span>
          <button onClick={stop} style={{ padding: "7px 14px", borderRadius: 8, border: "none", background: "#EF4444", color: "#fff", fontWeight: 700, fontSize: 13, cursor: "pointer" }}>Stop</button>
          <button onClick={onCancel} style={{ padding: "7px 14px", borderRadius: 8, border: `1px solid ${LINE}`, background: "transparent", color: DIM, fontWeight: 600, fontSize: 13, cursor: "pointer" }}>Cancel</button>
        </div>
      )}
      {phase === "done" && (
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          <audio src={url} controls style={{ width: "100%", borderRadius: 8 }} />
          <div style={{ display: "flex", gap: 8 }}>
            <button onClick={() => { setPhase("starting"); setUrl(null); setBlob(null); setSecs(0); setTimeout(start, 0); }} style={{ flex: 1, padding: 9, borderRadius: 9, border: `1px solid ${LINE}`, background: "transparent", color: DIM, fontWeight: 600, fontSize: 13, cursor: "pointer" }}>Re-record</button>
            <button onClick={() => onDone(blob)} style={{ flex: 1, padding: 9, borderRadius: 9, border: "none", background: G, color: "#fff", fontWeight: 700, fontSize: 13, cursor: "pointer" }}>Use this</button>
          </div>
        </div>
      )}
      {phase === "error" && <button onClick={onCancel} style={{ padding: 9, borderRadius: 9, border: `1px solid ${LINE}`, background: "transparent", color: DIM, fontWeight: 600, fontSize: 13, cursor: "pointer" }}>Dismiss</button>}
    </div>
  );
}

// ── New Post ───────────────────────────────────────────────────────────────
function NewPostScreen({ onSubmit }) {
  const uploadRef = useRef(), cameraRef = useRef();
  const [files,     setFiles]     = useState([]);
  const [desc,      setDesc]      = useState("");
  const [link,      setLink]      = useState("");
  const [addon,     setAddon]     = useState(null); // null | "link" | "voice"
  const [schedDate, setSchedDate] = useState("");
  const [schedTime, setSchedTime] = useState("");
  const [showSched, setShowSched] = useState(false);
  const [done,      setDone]      = useState(false);

  const tomorrow = new Date(); tomorrow.setDate(tomorrow.getDate() + 1);
  const minDate  = tomorrow.toISOString().split("T")[0];
  const addFiles = f => setFiles(p => [...p, ...Array.from(f)]);
  const hasContent = files.length > 0 || desc.trim() || link.trim();

  const submit = () => {
    if (!hasContent) return;
    setDone(true);
    setTimeout(() => { onSubmit(); setFiles([]); setDesc(""); setLink(""); setDone(false); setShowSched(false); setSchedDate(""); }, 1800);
  };

  if (done) return (
    <div style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 14, paddingTop: 80, textAlign: "center" }}>
      <div style={{ width: 64, height: 64, borderRadius: "50%", background: `${G}18`, display: "flex", alignItems: "center", justifyContent: "center" }}>
        <Ico d={ic.send} size={28} color={G} />
      </div>
      <p style={{ margin: 0, fontWeight: 800, fontSize: 20, color: INK }}>Sent!</p>
      <p style={{ margin: 0, color: DIM, fontSize: 14, lineHeight: 1.6, maxWidth: 260 }}>
        {schedDate ? `Scheduled for ${new Date(schedDate).toLocaleDateString("en-AU", { day: "numeric", month: "long" })}.` : "We'll notify you when your post is ready to review."}
      </p>
    </div>
  );

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 22, paddingBottom: 24 }}>
      <div>
        <h1 style={{ margin: "0 0 3px", fontSize: 24, fontWeight: 800, color: INK, letterSpacing: "-0.4px" }}>New post</h1>
        <p style={{ margin: 0, color: DIM, fontSize: 14 }}>Upload your content and we'll handle the rest.</p>
      </div>

      {/* Upload buttons */}
      <input ref={uploadRef} type="file" multiple accept="image/*,video/*" hidden onChange={e => addFiles(e.target.files)} />
      <input ref={cameraRef} type="file" accept="image/*,video/*" capture="environment" hidden onChange={e => addFiles(e.target.files)} />
      <div style={{ display: "flex", gap: 10 }}>
        <button onClick={() => cameraRef.current.click()} style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", gap: 9, padding: "20px 12px", borderRadius: 18, border: "none", background: DARK, cursor: "pointer" }}>
          <div style={{ width: 46, height: 46, borderRadius: "50%", background: `${G}22`, display: "flex", alignItems: "center", justifyContent: "center" }}>
            <Ico d={ic.camera} size={22} color={G} />
          </div>
          <span style={{ color: "#fff", fontWeight: 700, fontSize: 13 }}>Take photo</span>
        </button>
        <button onClick={() => uploadRef.current.click()} style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", gap: 9, padding: "20px 12px", borderRadius: 18, border: `1.5px solid ${LINE}`, background: CARD, cursor: "pointer" }}>
          <div style={{ width: 46, height: 46, borderRadius: "50%", background: `${G}12`, display: "flex", alignItems: "center", justifyContent: "center" }}>
            <Ico d={ic.upload} size={22} color={G} />
          </div>
          <span style={{ color: INK, fontWeight: 700, fontSize: 13 }}>Upload file</span>
        </button>
      </div>

      {/* File previews */}
      {files.length > 0 && (
        <div style={{ display: "flex", gap: 8, overflowX: "auto", paddingBottom: 2 }}>
          {files.map((f, i) => <FileChip key={i} file={f} onRemove={() => setFiles(p => p.filter((_, j) => j !== i))} />)}
        </div>
      )}

      {/* Description */}
      <div style={{ position: "relative" }}>
        <textarea value={desc} onChange={e => setDesc(e.target.value.slice(0, 500))}
          placeholder="Description (optional) — context, tone, anything useful…"
          rows={4}
          style={{ ...input, resize: "none", lineHeight: 1.6, paddingBottom: 28, borderRadius: 14 }}
          onFocus={e => e.target.style.borderColor = G}
          onBlur={e => e.target.style.borderColor = LINE} />
        <span style={{ position: "absolute", bottom: 9, right: 12, fontSize: 11, color: desc.length > 450 ? "#F59E0B" : DIM }}>{desc.length}/500</span>
      </div>

      {/* Add-ons row */}
      {addon === null && (
        <div style={{ display: "flex", gap: 10 }}>
          {[{ key: "link", icon: ic.link, label: "Add link" }, { key: "voice", icon: ic.mic, label: "Voice note" }].map(a => (
            <button key={a.key} onClick={() => setAddon(a.key)} style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center", gap: 7, padding: "11px 0", borderRadius: 12, border: `1.5px solid ${LINE}`, background: CARD, color: DIM, fontSize: 13, fontWeight: 600, cursor: "pointer", fontFamily: "inherit" }}>
              <Ico d={a.icon} size={15} color={DIM} sw={2} />{a.label}
            </button>
          ))}
        </div>
      )}

      {addon === "link" && (
        <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
          <input type="url" value={link} onChange={e => setLink(e.target.value)} placeholder="https://…"
            style={{ ...input, flex: 1, borderColor: G, borderRadius: 12 }} autoFocus />
          <button onClick={() => { setLink(""); setAddon(null); }} style={{ padding: "11px 14px", borderRadius: 12, border: `1px solid ${LINE}`, background: "transparent", color: DIM, cursor: "pointer", fontFamily: "inherit", fontSize: 13 }}>Cancel</button>
        </div>
      )}

      {addon === "voice" && (
        <VoiceRecorder
          onDone={b => { addFiles([new File([b], `voice-${Date.now()}.webm`, { type: b.type })]); setAddon(null); }}
          onCancel={() => setAddon(null)}
        />
      )}

      {/* Schedule row */}
      <div style={{ ...card, overflow: "hidden" }}>
        <div onClick={() => setShowSched(v => !v)} style={{ padding: "13px 16px", display: "flex", justifyContent: "space-between", alignItems: "center", cursor: "pointer" }}>
          <div>
            <span style={{ fontWeight: 600, fontSize: 14, color: INK }}>Schedule for later</span>
            {schedDate && <span style={{ marginLeft: 8, fontSize: 13, color: G }}>{new Date(schedDate).toLocaleDateString("en-AU", { day: "numeric", month: "short" })}{schedTime ? ` at ${schedTime}` : ""}</span>}
          </div>
          <Toggle on={showSched} onToggle={() => setShowSched(v => !v)} />
        </div>
        {showSched && (
          <div style={{ padding: "0 16px 14px", display: "flex", gap: 10, borderTop: `1px solid ${LINE}`, paddingTop: 12 }}>
            <input type="date" min={minDate} value={schedDate} onChange={e => setSchedDate(e.target.value)}
              style={{ ...input, flex: 1 }}
              onFocus={e => e.target.style.borderColor = G} onBlur={e => e.target.style.borderColor = LINE} />
            <input type="time" value={schedTime} onChange={e => setSchedTime(e.target.value)}
              style={{ ...input, flex: 1 }}
              onFocus={e => e.target.style.borderColor = G} onBlur={e => e.target.style.borderColor = LINE} />
          </div>
        )}
      </div>

      <PrimaryBtn onClick={submit} disabled={!hasContent}>
        {schedDate ? `Schedule for ${new Date(schedDate).toLocaleDateString("en-AU", { day: "numeric", month: "short" })} →` : "Submit to Web Gecko →"}
      </PrimaryBtn>
    </div>
  );
}

// ── Post detail sheet ──────────────────────────────────────────────────────
function PostSheet({ post, onClose, onApprove, onRevision, onDelete }) {
  const [revText, setRevText] = useState("");
  const [revMode, setRevMode] = useState(false);
  const [sent,    setSent]    = useState(false);

  const sendRev = () => {
    if (!revText.trim()) return;
    setSent(true);
    setTimeout(() => { onRevision(post.id); onClose(); }, 700);
  };

  return (
    <div style={{ position: "absolute", inset: 0, zIndex: 150, background: BG, display: "flex", flexDirection: "column", overflowY: "auto" }}>
      <div style={{ padding: "13px 20px", display: "flex", alignItems: "center", gap: 12, borderBottom: `1px solid ${LINE}`, background: CARD }}>
        <button onClick={onClose} style={{ background: "none", border: "none", cursor: "pointer", padding: 4 }}>
          <Ico d={ic.back} size={20} color={G} />
        </button>
        <span style={{ flex: 1, fontWeight: 700, fontSize: 16, color: INK }}>Post preview</span>
        <Badge platform={post.platform} />
      </div>

      <div style={{ padding: 20, display: "flex", flexDirection: "column", gap: 14 }}>
        {/* Mock preview */}
        <div style={{ ...card, overflow: "hidden" }}>
          <div style={{ background: "#F3F4F6", height: 130, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 32 }}>🖼️</div>
          <div style={{ padding: 16 }}>
            <div style={{ display: "flex", gap: 10, alignItems: "center", marginBottom: 10 }}>
              <div style={{ width: 32, height: 32, borderRadius: "50%", background: G, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                <Ico d={ic.user} size={16} color="#000" />
              </div>
              <div>
                <p style={{ margin: 0, fontWeight: 700, fontSize: 13, color: INK }}>Zack's Construction Co.</p>
                <p style={{ margin: 0, fontSize: 11, color: DIM }}>{post.date}</p>
              </div>
            </div>
            <p style={{ margin: 0, color: INK, fontSize: 14, lineHeight: 1.7 }}>{post.preview}</p>
            {post.hashtags && <p style={{ margin: "8px 0 0", color: G, fontSize: 13 }}>{post.hashtags}</p>}
          </div>
        </div>

        {post.scheduledFor && (
          <div style={{ background: `${G}10`, borderRadius: 12, padding: "10px 14px", border: `1px solid ${G}28`, display: "flex", alignItems: "center", gap: 8 }}>
            <Ico d={ic.cal} size={15} color={G} />
            <span style={{ color: INK, fontSize: 14 }}>Scheduled for <strong>{post.scheduledFor}</strong></span>
          </div>
        )}

        {post.status === "ready" && !revMode && !sent && (
          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            <PrimaryBtn onClick={() => onApprove(post.id)}>Approve & post</PrimaryBtn>
            <GhostBtn onClick={() => setRevMode(true)}>Request a revision</GhostBtn>
            <DangerBtn onClick={() => onDelete(post.id)}>Delete draft</DangerBtn>
          </div>
        )}

        {revMode && !sent && (
          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            <textarea value={revText} onChange={e => setRevText(e.target.value)}
              placeholder="What needs changing? e.g. More casual tone, mention the June promo…" rows={4}
              style={{ ...input, resize: "none", lineHeight: 1.6, borderRadius: 12 }}
              onFocus={e => e.target.style.borderColor = G} onBlur={e => e.target.style.borderColor = LINE} />
            <div style={{ display: "flex", gap: 8 }}>
              <GhostBtn onClick={() => setRevMode(false)} style={{ padding: "12px 0" }}>Cancel</GhostBtn>
              <PrimaryBtn onClick={sendRev}>Send feedback</PrimaryBtn>
            </div>
          </div>
        )}

        {sent && <p style={{ textAlign: "center", color: G, fontWeight: 700, fontSize: 15, margin: 0 }}>✓ Revision sent — we'll update and notify you.</p>}
        {post.status === "approved" && (
          <div style={{ background: `${G}10`, borderRadius: 12, padding: 14, textAlign: "center", border: `1px solid ${G}28` }}>
            <p style={{ margin: 0, color: G, fontWeight: 700 }}>✓ This post is live</p>
          </div>
        )}
      </div>
    </div>
  );
}

// ── Posts ──────────────────────────────────────────────────────────────────
function PostsScreen() {
  const [posts, setPosts] = useState([
    { id: 1, status: "ready",     date: "Today, 2:14 PM",     preview: "🚧 On-site progress at the Greenfield build — new framing going up fast.", platform: "Instagram", hashtags: "#construction #progress #build" },
    { id: 2, status: "generating",date: "Today, 11:30 AM",    preview: "",  platform: "Facebook", eta: "~10 min" },
    { id: 3, status: "ready",     date: "Yesterday, 4:00 PM", preview: "Big things coming this June — stay tuned for our biggest promo yet.", platform: "LinkedIn", scheduledFor: "June 1, 2026" },
    { id: 4, status: "approved",  date: "May 21",             preview: "Team spotlight — meet the crew keeping every project on track.", platform: "LinkedIn", hashtags: "#team #construction" },
  ]);
  const [sel,    setSel]    = useState(null);
  const [filter, setFilter] = useState("all");

  const STATUS = {
    ready:     { label: "Ready to review", color: G,         bg: `${G}15` },
    generating:{ label: "Generating…",     color: "#F59E0B", bg: "#FEF9EC" },
    approved:  { label: "Live",            color: DIM,       bg: LINE },
    revision:  { label: "Revision sent",   color: "#8B5CF6", bg: "#F5F3FF" },
  };

  const approve = id => setPosts(p => p.map(x => x.id === id ? { ...x, status: "approved" } : x));
  const remove  = id => { setPosts(p => p.filter(x => x.id !== id)); setSel(null); };
  const revise  = id => setPosts(p => p.map(x => x.id === id ? { ...x, status: "revision" } : x));

  const shown   = filter === "all" ? posts : posts.filter(p => p.status === filter);
  const readyN  = posts.filter(p => p.status === "ready").length;

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 14, position: "relative" }}>
      {sel && <PostSheet post={posts.find(p => p.id === sel)} onClose={() => setSel(null)}
        onApprove={id => { approve(id); setSel(null); }} onRevision={revise} onDelete={remove} />}

      <div>
        <h1 style={{ margin: "0 0 3px", fontSize: 24, fontWeight: 800, color: INK, letterSpacing: "-0.4px" }}>Posts</h1>
        {readyN > 0 && <p style={{ margin: 0, color: G, fontSize: 13, fontWeight: 600 }}>{readyN} ready to review</p>}
      </div>

      <div style={{ display: "flex", gap: 8, overflowX: "auto", paddingBottom: 2 }}>
        {[{ id: "all", label: "All" }, { id: "ready", label: "To review" }, { id: "generating", label: "In progress" }, { id: "approved", label: "Live" }].map(f => (
          <button key={f.id} onClick={() => setFilter(f.id)} style={pill(filter === f.id)}>{f.label}</button>
        ))}
      </div>

      {shown.length === 0 && <p style={{ textAlign: "center", color: DIM, padding: "32px 0", margin: 0 }}>Nothing here yet.</p>}

      {shown.map(p => {
        const s = STATUS[p.status] || STATUS.generating;
        return (
          <div key={p.id} onClick={() => p.status !== "generating" && setSel(p.id)}
            style={{ ...card, padding: 16, cursor: p.status !== "generating" ? "pointer" : "default", borderColor: p.status === "ready" ? `${G}44` : LINE }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}>
              <span style={{ fontSize: 11, fontWeight: 700, padding: "3px 9px", borderRadius: 20, color: s.color, background: s.bg }}>{s.label}</span>
              <span style={{ color: DIM, fontSize: 12 }}>{p.date}</span>
            </div>
            {p.status === "generating"
              ? <div style={{ display: "flex", justifyContent: "space-between" }}>
                  <span style={{ color: DIM, fontSize: 14 }}>Generating your post…</span>
                  {p.eta && <span style={{ color: DIM, fontSize: 12 }}>ETA {p.eta}</span>}
                </div>
              : <p style={{ margin: "0 0 10px", color: INK, fontSize: 14, lineHeight: 1.6 }}>{p.preview}</p>}
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <Badge platform={p.platform} />
              {p.status !== "generating" && <span style={{ color: DIM, fontSize: 12 }}>Tap to review →</span>}
            </div>
          </div>
        );
      })}
    </div>
  );
}

// ── Invoices ───────────────────────────────────────────────────────────────
function InvoicesScreen() {
  const [invoices, setInvoices] = useState([
    { id: "INV-004", date: "May 28, 2026", post: "On-site progress post", amount: 100, status: "due" },
    { id: "INV-003", date: "May 21, 2026", post: "Team spotlight",        amount: 100, status: "paid" },
    { id: "INV-002", date: "May 14, 2026", post: "Logo reveal",           amount: 100, status: "paid" },
    { id: "INV-001", date: "May 7, 2026",  post: "Business intro post",   amount: 100, status: "paid" },
  ]);
  const [paying, setPaying] = useState(false);
  const [flash,  setFlash]  = useState(false);
  const due   = invoices.filter(i => i.status === "due").reduce((a, i) => a + i.amount, 0);
  const total = invoices.reduce((a, i) => a + i.amount, 0);

  const pay = () => {
    setPaying(true);
    setTimeout(() => {
      setInvoices(v => v.map(i => i.status === "due" ? { ...i, status: "paid" } : i));
      setPaying(false); setFlash(true); setTimeout(() => setFlash(false), 3000);
    }, 1500);
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 14, paddingBottom: 24 }}>
      <h1 style={{ margin: 0, fontSize: 24, fontWeight: 800, color: INK, letterSpacing: "-0.4px" }}>Invoices</h1>

      {flash && (
        <div style={{ background: `${G}15`, border: `1px solid ${G}44`, borderRadius: 12, padding: "11px 14px", display: "flex", alignItems: "center", gap: 8 }}>
          <Ico d={ic.check} size={16} color={G} /><span style={{ color: G, fontWeight: 600, fontSize: 14 }}>Payment received — receipt emailed.</span>
        </div>
      )}

      <div style={{ display: "flex", gap: 10 }}>
        <div style={{ flex: 1, background: due > 0 ? DARK : CARD, borderRadius: 16, padding: "16px 18px", border: `1px solid ${due > 0 ? "transparent" : LINE}` }}>
          <p style={{ margin: "0 0 4px", color: due > 0 ? "#ffffff66" : DIM, fontSize: 12 }}>Outstanding</p>
          <p style={{ margin: 0, color: due > 0 ? "#fff" : INK, fontSize: 26, fontWeight: 900 }}>${due}</p>
        </div>
        <div style={{ flex: 1, ...card, padding: "16px 18px" }}>
          <p style={{ margin: "0 0 4px", color: DIM, fontSize: 12 }}>Total spent</p>
          <p style={{ margin: 0, color: INK, fontSize: 26, fontWeight: 900 }}>${total}</p>
        </div>
      </div>

      {due > 0 && <PrimaryBtn onClick={pay} disabled={paying}>{paying ? "Processing…" : `Pay $${due} now`}</PrimaryBtn>}
      {due === 0 && !flash && (
        <div style={{ background: `${G}10`, border: `1px solid ${G}28`, borderRadius: 12, padding: "11px 14px", display: "flex", alignItems: "center", gap: 8 }}>
          <Ico d={ic.check} size={16} color={G} /><span style={{ color: INK, fontWeight: 600, fontSize: 14 }}>All paid — you're up to date.</span>
        </div>
      )}

      <p style={{ margin: "4px 0 0", color: DIM, fontSize: 12, fontWeight: 600 }}>History</p>

      {invoices.map(inv => (
        <div key={inv.id} style={{ ...card, padding: "13px 16px", display: "flex", alignItems: "center", gap: 14 }}>
          <div style={{ width: 36, height: 36, borderRadius: 10, flexShrink: 0, background: inv.status === "paid" ? LINE : `${G}15`, display: "flex", alignItems: "center", justifyContent: "center" }}>
            <Ico d={inv.status === "paid" ? ic.check : ic.dollar} size={16} color={inv.status === "paid" ? DIM : G} />
          </div>
          <div style={{ flex: 1 }}>
            <p style={{ margin: "0 0 2px", color: INK, fontSize: 14, fontWeight: 600 }}>{inv.id}</p>
            <p style={{ margin: 0, color: DIM, fontSize: 12 }}>{inv.post} · {inv.date}</p>
          </div>
          <div style={{ textAlign: "right", display: "flex", flexDirection: "column", alignItems: "flex-end", gap: 3 }}>
            <p style={{ margin: 0, color: INK, fontWeight: 700, fontSize: 15 }}>${inv.amount}</p>
            <div style={{ display: "flex", alignItems: "center", gap: 5 }}>
              <span style={{ fontSize: 11, fontWeight: 700, padding: "2px 7px", borderRadius: 20, color: inv.status === "paid" ? DIM : G, background: inv.status === "paid" ? LINE : `${G}15` }}>{inv.status === "paid" ? "Paid" : "Due"}</span>
              {inv.status === "paid" && <button style={{ background: "none", border: "none", cursor: "pointer", padding: 2 }}><Ico d={ic.dl} size={13} color={DIM} /></button>}
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}

// ── Reports ────────────────────────────────────────────────────────────────
function ReportsScreen() {
  const [sel, setSel] = useState(null);
  const reports = [
    { id: 1, month: "May 2026",   stats: { posts: 4, reach: "12,400", engagement: "8.2%", topPost: "Team spotlight" }, trends: { posts: 1, reach: 27, eng: 1.1 }, summary: "Strong month — engagement up 14% from April. Team spotlight was your best performer. LinkedIn outperforming Facebook 2:1. Focus for June: video content." },
    { id: 2, month: "April 2026", stats: { posts: 3, reach: "9,800",  engagement: "7.1%", topPost: "Logo reveal"    }, trends: { posts: 1, reach: 88, eng: 0.7 }, summary: "Solid start. Logo reveal drove strong brand awareness. Facebook driving most traffic. Consider adding Instagram to the mix." },
    { id: 3, month: "March 2026", stats: { posts: 2, reach: "5,200",  engagement: "6.4%", topPost: "Business intro" }, trends: { posts: null, reach: null, eng: null }, summary: "First full month live. Business intro post performed well. Audience growing steadily." },
  ];

  const Stat = ({ label, value, trend }) => (
    <div style={{ flex: 1, background: BG, borderRadius: 12, padding: "12px 14px", border: `1px solid ${LINE}` }}>
      <p style={{ margin: "0 0 3px", color: DIM, fontSize: 11, fontWeight: 600, textTransform: "uppercase", letterSpacing: ".5px" }}>{label}</p>
      <p style={{ margin: "0 0 3px", color: INK, fontSize: 18, fontWeight: 800 }}>{value}</p>
      {trend != null && <span style={{ fontSize: 11, fontWeight: 700, color: trend >= 0 ? G : "#EF4444" }}>{trend >= 0 ? "↑" : "↓"} {Math.abs(trend)}%</span>}
    </div>
  );

  if (sel) {
    const r = reports.find(x => x.id === sel);
    return (
      <div style={{ display: "flex", flexDirection: "column", gap: 14, paddingBottom: 24 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <button onClick={() => setSel(null)} style={{ background: "none", border: "none", cursor: "pointer", padding: 4 }}>
            <Ico d={ic.back} size={20} color={G} />
          </button>
          <h2 style={{ margin: 0, fontSize: 20, fontWeight: 800, color: INK }}>{r.month}</h2>
        </div>
        <div style={{ display: "flex", gap: 8 }}><Stat label="Posts" value={r.stats.posts} trend={r.trends.posts} /><Stat label="Reach" value={r.stats.reach} trend={r.trends.reach} /></div>
        <div style={{ display: "flex", gap: 8 }}><Stat label="Engagement" value={r.stats.engagement} trend={r.trends.eng} /><Stat label="Top post" value={r.stats.topPost} trend={null} /></div>
        <div style={{ ...card, padding: 18 }}>
          <p style={{ margin: "0 0 8px", fontWeight: 700, fontSize: 14, color: INK }}>Summary from Web Gecko</p>
          <p style={{ margin: 0, color: DIM, fontSize: 14, lineHeight: 1.7 }}>{r.summary}</p>
        </div>
        <div style={{ background: `${G}10`, borderRadius: 12, padding: 14, border: `1px solid ${G}28`, display: "flex", gap: 12, alignItems: "center" }}>
          <span style={{ fontSize: 20 }}>📧</span>
          <p style={{ margin: 0, color: DIM, fontSize: 13 }}>Emailed to zack@example.com</p>
        </div>
      </div>
    );
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 14, paddingBottom: 24 }}>
      <div>
        <h1 style={{ margin: "0 0 3px", fontSize: 24, fontWeight: 800, color: INK, letterSpacing: "-0.4px" }}>Reports</h1>
        <p style={{ margin: 0, color: DIM, fontSize: 14 }}>Emailed monthly. Full history below.</p>
      </div>
      <div style={{ background: DARK, borderRadius: 16, padding: "14px 18px", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <div>
          <p style={{ margin: "0 0 2px", color: "#ffffff55", fontSize: 12 }}>Next report</p>
          <p style={{ margin: 0, color: "#fff", fontWeight: 700, fontSize: 15 }}>June 2026</p>
          <p style={{ margin: "2px 0 0", color: "#ffffff44", fontSize: 12 }}>Auto-emailed Jul 1</p>
        </div>
        <div style={{ background: `${G}22`, borderRadius: 10, padding: "10px 14px", textAlign: "center" }}>
          <p style={{ margin: 0, color: G, fontWeight: 900, fontSize: 20 }}>2</p>
          <p style={{ margin: 0, color: G, fontSize: 11, fontWeight: 600 }}>days</p>
        </div>
      </div>
      {reports.map(r => (
        <div key={r.id} onClick={() => setSel(r.id)} style={{ ...card, padding: "14px 16px", display: "flex", alignItems: "center", justifyContent: "space-between", cursor: "pointer" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
            <div style={{ width: 38, height: 38, borderRadius: 10, background: `${G}15`, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 17 }}>📊</div>
            <div>
              <p style={{ margin: "0 0 2px", color: INK, fontWeight: 700, fontSize: 15 }}>{r.month}</p>
              <p style={{ margin: 0, color: DIM, fontSize: 12 }}>
                {r.stats.posts} posts · {r.stats.reach} reach
                {r.trends.eng != null && <span style={{ color: G, marginLeft: 4 }}>↑ {r.trends.eng}%</span>}
              </p>
            </div>
          </div>
          <Ico d={ic.chevron} size={18} color={DIM} />
        </div>
      ))}
    </div>
  );
}

// ── Legal screen ───────────────────────────────────────────────────────────
const LEGAL_DOCS = {
  tos: {
    title: "Terms of Service",
    updated: "1 May 2026",
    sections: [
      {
        heading: "1. About these terms",
        body: `These Terms of Service ("Terms") govern your use of the Web Gecko client portal and social media management services ("Services") provided by Web Gecko ABN [XX XXX XXX XXX] ("Web Gecko", "we", "us"). By accessing or using our Services you agree to be bound by these Terms. If you do not agree, do not use the Services.`,
      },
      {
        heading: "2. Services",
        body: `Web Gecko provides social media content creation, scheduling, and publishing services on your behalf. We will create posts based on the content and instructions you supply. You acknowledge that we act as your agent when publishing to connected social platforms, and that final approval before publishing rests with you.`,
      },
      {
        heading: "3. Your responsibilities",
        body: `You are responsible for: (a) ensuring all content you submit is accurate and does not infringe any third-party intellectual property rights; (b) obtaining all necessary licences, consents and permissions for images, videos, and other materials you upload; (c) maintaining the confidentiality of your account credentials; and (d) ensuring the contact details on your account are current and accurate.`,
      },
      {
        heading: "4. Approval and publishing",
        body: `Posts are not published without your explicit approval, unless you have enabled Auto-pay and the post has been approved through the app. Once you approve a post, you authorise us to publish it to your connected social media accounts at the scheduled time or immediately. You may request revisions before approving. After publishing, removal of content from third-party platforms is subject to each platform's own policies.`,
      },
      {
        heading: "5. Fees and payment",
        body: `Our current fee is AUD $100 (inclusive of GST where applicable) per published post. Fees are invoiced upon your approval of each post. Payment is due within 7 days of invoice unless Auto-pay is enabled, in which case your nominated payment method is charged immediately upon approval. We reserve the right to pause Services if payment remains outstanding beyond 14 days. Fees are subject to change with 30 days' written notice.`,
      },
      {
        heading: "6. GST",
        body: `All fees are quoted inclusive of Goods and Services Tax (GST) as required under the A New Tax System (Goods and Services Tax) Act 1999 (Cth). A tax invoice will be issued for each payment.`,
      },
      {
        heading: "7. Intellectual property",
        body: `You retain ownership of all content you submit to us. You grant Web Gecko a non-exclusive licence to use, reproduce, and modify your content solely for the purpose of providing the Services. Web Gecko retains ownership of all templates, tools, systems, and methodologies used to deliver the Services. We may include a "Powered by Web Gecko" attribution on posts unless you have requested otherwise in writing.`,
      },
      {
        heading: "8. Prohibited content",
        body: `You must not submit content that: (a) is false, misleading or deceptive in breach of the Australian Consumer Law; (b) infringes any copyright, trade mark, or other intellectual property right; (c) is defamatory, harassing, or discriminatory; (d) promotes illegal activity; or (e) violates the terms of service of any social media platform to which we post. We reserve the right to refuse to publish content that we reasonably believe violates these restrictions.`,
      },
      {
        heading: "9. Limitation of liability",
        body: `To the extent permitted by law, Web Gecko's total liability to you for any claim arising from the Services is limited to the fees paid by you in the 3 months preceding the claim. We are not liable for any indirect, incidental, or consequential loss. Nothing in these Terms limits any right you may have under the Australian Consumer Law that cannot be excluded.`,
      },
      {
        heading: "10. Australian Consumer Law",
        body: `Our Services come with guarantees that cannot be excluded under the Australian Consumer Law (Schedule 2 of the Competition and Consumer Act 2010 (Cth)). You are entitled to a remedy if our Services do not meet a consumer guarantee. Nothing in these Terms is intended to limit those rights.`,
      },
      {
        heading: "11. Termination",
        body: `Either party may terminate the arrangement with 14 days' written notice. We may terminate immediately if you breach these Terms or if any payment remains unpaid beyond 30 days. Upon termination, you remain liable for fees for posts published prior to the termination date.`,
      },
      {
        heading: "12. Governing law",
        body: `These Terms are governed by the laws of Queensland, Australia. You submit to the non-exclusive jurisdiction of the courts of Queensland.`,
      },
      {
        heading: "13. Changes to these Terms",
        body: `We may update these Terms from time to time. We will notify you via the app or email at least 14 days before material changes take effect. Continued use of the Services after that date constitutes acceptance.`,
      },
      {
        heading: "14. Contact",
        body: `Questions about these Terms? Email hello@webgecko.com.au or call +61 400 000 000.`,
      },
    ],
  },
  privacy: {
    title: "Privacy Policy",
    updated: "1 May 2026",
    sections: [
      {
        heading: "1. Our commitment",
        body: `Web Gecko ABN [XX XXX XXX XXX] is committed to protecting your personal information in accordance with the Privacy Act 1988 (Cth) and the Australian Privacy Principles (APPs). This Policy explains how we collect, use, disclose, and protect your personal information.`,
      },
      {
        heading: "2. Information we collect",
        body: `We collect: (a) Account information — name, business name, email address, phone number; (b) Content you submit — photos, videos, audio recordings, text descriptions, and links; (c) Payment information — handled by our payment processor; we do not store full card details; (d) Usage data — how you interact with the app, device type, and IP address; (e) Communications — support messages you send us.`,
      },
      {
        heading: "3. How we use your information",
        body: `We use your personal information to: (a) deliver the social media management Services; (b) process payments and issue invoices; (c) send notifications about your posts, invoices, and reports; (d) respond to your support requests; (e) improve our Services; and (f) comply with legal obligations. We do not use your information for marketing to third parties.`,
      },
      {
        heading: "4. Disclosure of your information",
        body: `We may share your information with: (a) social media platforms (Instagram, Facebook, LinkedIn, TikTok) to the extent necessary to publish your content; (b) payment processors to facilitate billing; (c) cloud hosting providers who store data on our behalf; and (d) legal or regulatory authorities where required by law. We do not sell your personal information to third parties.`,
      },
      {
        heading: "5. Overseas disclosure",
        body: `Some of our service providers (including social media platforms and cloud infrastructure) are located outside Australia. Where we disclose your information overseas, we take reasonable steps to ensure recipients handle it in a manner consistent with the APPs.`,
      },
      {
        heading: "6. Data security",
        body: `We use industry-standard security measures including encryption in transit (TLS) and at rest, access controls, and secure authentication (SSO). Despite these measures, no system is completely secure. Please notify us immediately at hello@webgecko.com.au if you suspect unauthorised access to your account.`,
      },
      {
        heading: "7. Retention",
        body: `We retain your personal information for as long as your account is active and as required to meet our legal and tax obligations (generally 7 years for financial records under the Corporations Act 2001 (Cth)). Content you submit is deleted upon your written request unless retention is required by law.`,
      },
      {
        heading: "8. Your rights",
        body: `Under the Privacy Act you have the right to: (a) access the personal information we hold about you; (b) request correction of inaccurate information; and (c) make a complaint if you believe we have breached the APPs. To exercise these rights, contact hello@webgecko.com.au. We will respond within 30 days.`,
      },
      {
        heading: "9. Cookies and analytics",
        body: `Our app may collect usage analytics to improve performance. We do not use advertising cookies or share analytics data with advertising networks.`,
      },
      {
        heading: "10. Complaints",
        body: `If you are not satisfied with our handling of a privacy complaint, you may contact the Office of the Australian Information Commissioner (OAIC) at www.oaic.gov.au or 1300 363 992.`,
      },
      {
        heading: "11. Updates",
        body: `We may update this Policy from time to time. We will notify you via the app or email. The current version is always available in the app under Account → Legal.`,
      },
      {
        heading: "12. Contact",
        body: `Privacy enquiries: hello@webgecko.com.au | +61 400 000 000 | Web Gecko, [Address], Queensland, Australia.`,
      },
    ],
  },
  refund: {
    title: "Refund & Cancellation Policy",
    updated: "1 May 2026",
    sections: [
      {
        heading: "1. Our commitment",
        body: `Web Gecko is committed to fair dealings in accordance with the Australian Consumer Law. This policy sets out your rights regarding refunds and cancellations.`,
      },
      {
        heading: "2. Refunds for completed posts",
        body: `Because each post involves creative work performed specifically for you, we generally do not provide refunds for posts that have already been published. However, if a published post contains a material error caused by Web Gecko (not arising from incorrect instructions you provided), we will work with you to resolve the issue, which may include a credit toward a future post.`,
      },
      {
        heading: "3. Refunds for unpublished posts",
        body: `If you have been charged for a post that has not yet been published, you may request a full refund by contacting us within 7 days of payment. Refunds for unpublished posts will be processed within 5–10 business days to your original payment method.`,
      },
      {
        heading: "4. Revision requests",
        body: `You are entitled to request revisions to a draft before approving it for publication. Revision requests are submitted through the app and are included in the service fee at no additional charge.`,
      },
      {
        heading: "5. Cancellation",
        body: `You may cancel the Service at any time with 14 days' written notice to hello@webgecko.com.au. You remain liable for fees for posts published during the notice period. No refunds are issued for fees already paid at the time of cancellation.`,
      },
      {
        heading: "6. Australian Consumer Law",
        body: `Nothing in this policy limits any right you have under the Australian Consumer Law, including the right to a remedy for a service that is not provided with due care and skill or that is not fit for purpose.`,
      },
      {
        heading: "7. How to request a refund",
        body: `Email hello@webgecko.com.au with your business name, invoice number, and the reason for your request. We will respond within 2 business days.`,
      },
    ],
  },
};

function LegalScreen({ doc, onBack }) {
  const d = LEGAL_DOCS[doc];
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 0, paddingBottom: 24 }}>
      {/* Header */}
      <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 16 }}>
        <button onClick={onBack} style={{ background: "none", border: "none", cursor: "pointer", padding: 4, flexShrink: 0 }}>
          <Ico d={ic.back} size={20} color={G} />
        </button>
        <div>
          <h1 style={{ margin: 0, fontSize: 20, fontWeight: 800, color: INK, letterSpacing: "-0.3px" }}>{d.title}</h1>
          <p style={{ margin: 0, color: DIM, fontSize: 12 }}>Last updated {d.updated}</p>
        </div>
      </div>

      <div style={{ display: "flex", flexDirection: "column", gap: 18 }}>
        {d.sections.map((s, i) => (
          <div key={i}>
            <p style={{ margin: "0 0 5px", fontWeight: 700, fontSize: 13, color: INK }}>{s.heading}</p>
            <p style={{ margin: 0, color: DIM, fontSize: 13, lineHeight: 1.75 }}>{s.body}</p>
          </div>
        ))}
      </div>

      <div style={{ marginTop: 24, padding: "14px 16px", background: `${G}10`, borderRadius: 12, border: `1px solid ${G}28` }}>
        <p style={{ margin: 0, color: DIM, fontSize: 12, lineHeight: 1.6 }}>
          Questions? Contact us at <span style={{ color: G, fontWeight: 600 }}>hello@webgecko.com.au</span> or <span style={{ color: G, fontWeight: 600 }}>+61 400 000 000</span>.
        </p>
      </div>
    </div>
  );
}

// ── Account ────────────────────────────────────────────────────────────────
function AccountScreen({ onSignOut }) {
  const [section,  setSection]  = useState("profile");
  const [editing,  setEditing]  = useState(false);
  const [profile,  setProfile]  = useState({ name: "Zack's Construction Co.", email: "zack@example.com", phone: "+1 (555) 012-3456" });
  const [draft,    setDraft]    = useState({ ...profile });
  const [saved,    setSaved]    = useState(false);
  const [notifs,   setNotifs]   = useState({ postReady: true, invoiceDue: true, reportReady: true, postLive: false });
  const [autoPay,  setAutoPay]  = useState(true);
  const [msg,            setMsg]            = useState("");
  const [msgSent,        setMsgSent]        = useState(false);
  const [confirmSignOut, setConfirmSignOut] = useState(false);
  const [legalDoc,       setLegalDoc]       = useState(null);

  const save = () => { setProfile({ ...draft }); setSaved(true); setTimeout(() => { setSaved(false); setEditing(false); }, 900); };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16, paddingBottom: 24 }}>
      {legalDoc && <LegalScreen doc={legalDoc} onBack={() => setLegalDoc(null)} />}
      {!legalDoc && <>
      <div style={{ textAlign: "center" }}>
        <div style={{ width: 64, height: 64, borderRadius: "50%", background: G, display: "flex", alignItems: "center", justifyContent: "center", margin: "0 auto 10px" }}>
          <Ico d={ic.user} size={28} color="#000" />
        </div>
        <p style={{ margin: "0 0 2px", fontWeight: 800, fontSize: 16, color: INK }}>{profile.name}</p>
        <p style={{ margin: 0, color: DIM, fontSize: 13 }}>Client since May 2026 · 9 posts live</p>
      </div>

      {/* Section tabs */}
      <div style={{ display: "flex", background: CARD, borderRadius: 12, padding: 4, border: `1px solid ${LINE}`, gap: 4 }}>
        {[{ id: "profile", label: "Profile" }, { id: "billing", label: "Billing" }, { id: "alerts", label: "Alerts" }].map(t => (
          <button key={t.id} onClick={() => setSection(t.id)} style={{ flex: 1, padding: "8px 4px", borderRadius: 9, border: "none", cursor: "pointer", fontSize: 13, fontWeight: section === t.id ? 700 : 500, background: section === t.id ? G : "transparent", color: section === t.id ? "#fff" : DIM, fontFamily: "inherit" }}>{t.label}</button>
        ))}
      </div>

      {/* ── Profile ── */}
      {section === "profile" && (
        <>
          {!editing ? (
            <div style={{ ...card, overflow: "hidden" }}>
              {[{ label: "Business name", value: profile.name }, { label: "Email", value: profile.email }, { label: "Phone", value: profile.phone }, { label: "Plan", value: "Pay-per-post · $100" }].map((row, i, arr) => (
                <div key={row.label} style={{ padding: "13px 16px", display: "flex", justifyContent: "space-between", alignItems: "center", borderBottom: i < arr.length - 1 ? `1px solid ${LINE}` : "none" }}>
                  <span style={{ color: DIM, fontSize: 14 }}>{row.label}</span>
                  <span style={{ color: INK, fontSize: 14, fontWeight: 500 }}>{row.value}</span>
                </div>
              ))}
            </div>
          ) : (
            <div style={{ ...card, padding: 16, display: "flex", flexDirection: "column", gap: 12 }}>
              {[{ label: "Business name", key: "name", type: "text" }, { label: "Email", key: "email", type: "email" }, { label: "Phone", key: "phone", type: "tel" }].map(f => (
                <div key={f.key}>
                  <label style={{ fontSize: 12, color: DIM, fontWeight: 600, display: "block", marginBottom: 5 }}>{f.label}</label>
                  <input type={f.type} value={draft[f.key]} onChange={e => setDraft(d => ({ ...d, [f.key]: e.target.value }))} style={input}
                    onFocus={e => e.target.style.borderColor = G} onBlur={e => e.target.style.borderColor = LINE} />
                </div>
              ))}
              <div style={{ display: "flex", gap: 8 }}>
                <GhostBtn onClick={() => { setDraft({ ...profile }); setEditing(false); }} style={{ padding: "11px 0", fontSize: 14 }}>Cancel</GhostBtn>
                <PrimaryBtn onClick={save} style={{ fontSize: 14, padding: "11px 0" }}>{saved ? "✓ Saved" : "Save"}</PrimaryBtn>
              </div>
            </div>
          )}

          {/* Active platforms */}
          <div style={{ ...card, padding: "12px 16px" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
              <span style={{ fontWeight: 600, fontSize: 13, color: INK }}>Active platforms</span>
              <button onClick={() => { setMsg("I'd like to add a new platform."); setSection("support"); setMsgSent(false); }} style={{ background: "none", border: "none", color: G, fontSize: 12, fontWeight: 600, cursor: "pointer", padding: 0 }}>+ Request</button>
            </div>
            <div style={{ display: "flex", gap: 8 }}>
              {[{ name: "Instagram", ...PL.Instagram }, { name: "Facebook", ...PL.Facebook }].map(p => (
                <div key={p.name} style={{ display: "flex", alignItems: "center", gap: 5, padding: "5px 10px", borderRadius: 8, background: p.bg }}>
                  <span style={{ color: p.color, fontWeight: 800, fontSize: 11 }}>{p.label}</span>
                  <span style={{ color: p.color, fontWeight: 600, fontSize: 13 }}>{p.name}</span>
                </div>
              ))}
            </div>
            <p style={{ margin: "7px 0 0", color: DIM, fontSize: 11 }}>Managed by Web Gecko.</p>
          </div>

          {!editing && <GhostBtn onClick={() => setEditing(true)}>Edit profile</GhostBtn>}

          {/* Support — collapsed into profile bottom */}
          <div style={{ borderTop: `1px solid ${LINE}`, paddingTop: 16, display: "flex", flexDirection: "column", gap: 10 }}>
            <p style={{ margin: 0, fontWeight: 700, fontSize: 13, color: INK }}>Get in touch</p>
            {[{ icon: "📞", label: "Call us", val: "+61 400 000 000" }, { icon: "📧", label: "Email", val: "hello@webgecko.com.au" }].map(c => (
              <div key={c.label} style={{ display: "flex", alignItems: "center", gap: 12 }}>
                <span style={{ fontSize: 18 }}>{c.icon}</span>
                <div><p style={{ margin: 0, fontWeight: 600, fontSize: 13, color: INK }}>{c.label}</p><p style={{ margin: 0, fontSize: 13, color: G }}>{c.val}</p></div>
              </div>
            ))}
            {msgSent ? (
              <div style={{ background: `${G}12`, borderRadius: 10, padding: "11px 14px" }}>
                <p style={{ margin: 0, color: G, fontWeight: 700, fontSize: 13 }}>✓ Sent — we'll reply within 24 hours.</p>
              </div>
            ) : (
              <>
                <textarea value={msg} onChange={e => setMsg(e.target.value)} placeholder="Send us a message…" rows={3}
                  style={{ ...input, resize: "none", lineHeight: 1.6, borderRadius: 12 }}
                  onFocus={e => e.target.style.borderColor = G} onBlur={e => e.target.style.borderColor = LINE} />
                <PrimaryBtn onClick={() => { if (msg.trim()) setMsgSent(true); }} style={{ fontSize: 14, padding: "12px 0" }}>Send message</PrimaryBtn>
              </>
            )}
          </div>

          {/* Sign out — always at the bottom with confirm */}
          <div style={{ borderTop: `1px solid ${LINE}`, paddingTop: 16 }}>
            {!confirmSignOut ? (
              <button onClick={() => setConfirmSignOut(true)} style={{ width: "100%", padding: "13px 0", borderRadius: 14, border: "none", background: "transparent", color: DIM, fontWeight: 500, fontSize: 14, cursor: "pointer", fontFamily: "inherit" }}>
                Sign out
              </button>
            ) : (
              <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                <p style={{ margin: 0, textAlign: "center", color: INK, fontSize: 14, fontWeight: 600 }}>Are you sure you want to sign out?</p>
                <div style={{ display: "flex", gap: 8 }}>
                  <GhostBtn onClick={() => setConfirmSignOut(false)} style={{ padding: "12px 0", fontSize: 14 }}>Cancel</GhostBtn>
                  <DangerBtn onClick={onSignOut}>Yes, sign out</DangerBtn>
                </div>
              </div>
            )}
          </div>
        </>
      )}

      {/* ── Billing ── */}
      {section === "billing" && (
        <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
          {/* Card on file */}
          <div style={{ ...card, padding: "13px 16px", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
              <div style={{ width: 36, height: 36, borderRadius: 8, background: DARK, display: "flex", alignItems: "center", justifyContent: "center" }}>
                <span style={{ color: "#fff", fontSize: 11, fontWeight: 800, letterSpacing: 1 }}>VISA</span>
              </div>
              <div>
                <p style={{ margin: 0, fontWeight: 600, fontSize: 14, color: INK }}>Visa ···· 4242</p>
                <p style={{ margin: 0, fontSize: 12, color: DIM }}>Expires 08/28</p>
              </div>
            </div>
            <button style={{ background: "none", border: "none", color: G, fontSize: 13, fontWeight: 600, cursor: "pointer", fontFamily: "inherit" }}>Update</button>
          </div>

          {/* Auto-pay */}
          <div style={{ ...card, padding: "13px 16px" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <div>
                <p style={{ margin: "0 0 2px", fontWeight: 700, fontSize: 14, color: INK }}>Auto-pay</p>
                <p style={{ margin: 0, fontSize: 12, color: DIM }}>Charge card automatically after approving a post</p>
              </div>
              <Toggle on={autoPay} onToggle={() => setAutoPay(v => !v)} />
            </div>
            <div style={{ marginTop: 10, background: autoPay ? `${G}10` : LINE, borderRadius: 8, padding: "9px 12px" }}>
              <p style={{ margin: 0, fontSize: 12, color: autoPay ? G : DIM, fontWeight: autoPay ? 600 : 400 }}>
                {autoPay ? "✓ $100 charged to Visa ···· 4242 each time a post goes live." : "You'll receive an invoice after each approved post."}
              </p>
            </div>
          </div>

          {/* Plan info */}
          <div style={{ ...card, overflow: "hidden" }}>
            {[{ label: "Plan", value: "Pay-per-post" }, { label: "Rate", value: "$100 per post" }, { label: "Billing", value: "Per approval" }].map((r, i, arr) => (
              <div key={r.label} style={{ padding: "12px 16px", display: "flex", justifyContent: "space-between", borderBottom: i < arr.length - 1 ? `1px solid ${LINE}` : "none" }}>
                <span style={{ color: DIM, fontSize: 14 }}>{r.label}</span>
                <span style={{ color: INK, fontSize: 14, fontWeight: 500 }}>{r.value}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ── Alerts ── */}
      {section === "alerts" && (
        <div style={{ ...card, overflow: "hidden" }}>
          {[
            { key: "postReady",   label: "Post ready to review", sub: "When your draft is ready" },
            { key: "invoiceDue",  label: "Invoice due",           sub: "When a payment is due" },
            { key: "reportReady", label: "Monthly report",        sub: "When your report is ready" },
            { key: "postLive",    label: "Post went live",        sub: "Confirmation after posting" },
          ].map((item, i, arr) => (
            <div key={item.key} style={{ padding: "13px 16px", display: "flex", justifyContent: "space-between", alignItems: "center", borderBottom: i < arr.length - 1 ? `1px solid ${LINE}` : "none" }}>
              <div>
                <p style={{ margin: 0, fontWeight: 600, fontSize: 14, color: INK }}>{item.label}</p>
                <p style={{ margin: "2px 0 0", fontSize: 12, color: DIM }}>{item.sub}</p>
              </div>
              <Toggle on={notifs[item.key]} onToggle={() => setNotifs(n => ({ ...n, [item.key]: !n[item.key] }))} />
            </div>
          ))}
        </div>
      )}

      {/* Legal links */}
      {section === "profile" && (
        <div style={{ borderTop: `1px solid ${LINE}`, paddingTop: 14, display: "flex", flexDirection: "column", gap: 2 }}>
          {[{ key: "tos", label: "Terms of Service" }, { key: "privacy", label: "Privacy Policy" }, { key: "refund", label: "Refund & Cancellation Policy" }].map(l => (
            <button key={l.key} onClick={() => setLegalDoc(l.key)} style={{ background: "none", border: "none", textAlign: "left", color: DIM, fontSize: 13, padding: "8px 0", cursor: "pointer", fontFamily: "inherit", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              {l.label}
              <Ico d={ic.chevron} size={16} color={DIM} />
            </button>
          ))}
          <p style={{ margin: "6px 0 0", color: DIM, fontSize: 11 }}>Web Gecko ABN [XX XXX XXX XXX] · Queensland, Australia</p>
        </div>
      )}
      </>}
    </div>
  );
}

// ── Dashboard ──────────────────────────────────────────────────────────────
function DashboardScreen({ onNav }) {
  const stats = [
    { label: "Posts live",     value: "9",    trend: "+2",    warn: false },
    { label: "This month",     value: "4",    trend: "+1",    warn: false },
    { label: "Avg engagement", value: "8.2%", trend: "+1.1%", warn: false },
  ];
  const activity = [
    { icon: "✅", text: "On-site progress post ready to review", time: "2 min ago",  nav: "posts" },
    { icon: "⏳", text: "Logo reveal being generated (~10 min)", time: "30 min ago", nav: null },
    { icon: "🚀", text: "Team spotlight is live on LinkedIn",    time: "2 days ago", nav: null },
    { icon: "📊", text: "May report is ready",                  time: "Yesterday",  nav: "reports" },
  ];
  const hasDue = true;

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 20, paddingBottom: 24 }}>
      <div>
        <h1 style={{ margin: "0 0 3px", fontSize: 24, fontWeight: 800, color: INK, letterSpacing: "-0.4px" }}>Good morning, Zack 👋</h1>
        <p style={{ margin: 0, color: DIM, fontSize: 14 }}>Here's what's happening.</p>
      </div>

      {/* Stats */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 10 }}>
        {stats.map(s => (
          <div key={s.label} style={{ ...card, padding: "12px 12px" }}>
            <p style={{ margin: "0 0 4px", fontSize: 11, color: DIM, lineHeight: 1.3 }}>{s.label}</p>
            <p style={{ margin: "0 0 3px", fontSize: 20, fontWeight: 900, color: INK }}>{s.value}</p>
            <span style={{ fontSize: 11, fontWeight: 700, color: G }}>{s.trend}</span>
          </div>
        ))}
      </div>

      {/* Due invoice banner */}
      {hasDue && (
        <div onClick={() => onNav("invoices")} style={{ background: DARK, borderRadius: 14, padding: "13px 16px", display: "flex", justifyContent: "space-between", alignItems: "center", cursor: "pointer" }}>
          <div>
            <p style={{ margin: "0 0 2px", color: "#ffffff88", fontSize: 12 }}>Invoice due</p>
            <p style={{ margin: 0, color: "#fff", fontWeight: 700, fontSize: 15 }}>$100 outstanding</p>
          </div>
          <span style={{ background: G, color: "#000", fontWeight: 700, fontSize: 13, padding: "7px 14px", borderRadius: 10 }}>Pay now</span>
        </div>
      )}

      {/* Next scheduled */}
      <div style={{ ...card, padding: "13px 16px", display: "flex", alignItems: "center", gap: 12 }}>
        <div style={{ width: 38, height: 38, borderRadius: 10, background: `${G}15`, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
          <Ico d={ic.cal} size={20} color={G} />
        </div>
        <div style={{ flex: 1 }}>
          <p style={{ margin: "0 0 2px", color: DIM, fontSize: 11, fontWeight: 600, textTransform: "uppercase", letterSpacing: ".3px" }}>Next scheduled</p>
          <p style={{ margin: 0, color: INK, fontWeight: 700, fontSize: 14 }}>Big June promo · June 1 <Badge platform="LinkedIn" /></p>
        </div>
      </div>

      {/* Quick actions */}
      <div style={{ display: "flex", gap: 10 }}>
        <button onClick={() => onNav("upload")} style={{ flex: 1, padding: "12px 0", borderRadius: 14, border: "none", background: G, color: "#fff", fontWeight: 700, fontSize: 14, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", gap: 6, fontFamily: "inherit", boxShadow: `0 3px 12px ${G}30` }}>
          <Ico d={ic.plus} size={16} color="#fff" sw={2.5} /> New post
        </button>
        <button onClick={() => onNav("posts")} style={{ flex: 1, padding: "12px 0", borderRadius: 14, border: `1.5px solid ${LINE}`, background: CARD, color: INK, fontWeight: 600, fontSize: 14, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", gap: 6, fontFamily: "inherit" }}>
          <Ico d={ic.inbox} size={16} color={DIM} /> Review posts
        </button>
      </div>

      {/* Activity */}
      <div>
        <p style={{ margin: "0 0 8px", fontWeight: 700, fontSize: 13, color: INK }}>Recent activity</p>
        <div style={{ ...card, overflow: "hidden" }}>
          {activity.map((a, i) => (
            <div key={i} style={{ padding: "11px 16px", display: "flex", alignItems: "center", gap: 12, borderBottom: i < activity.length - 1 ? `1px solid ${LINE}` : "none" }}>
              <span style={{ fontSize: 17, flexShrink: 0 }}>{a.icon}</span>
              <div style={{ flex: 1 }}>
                <p style={{ margin: "0 0 1px", fontSize: 13, color: INK, lineHeight: 1.4 }}>{a.text}</p>
                <p style={{ margin: 0, fontSize: 11, color: DIM }}>{a.time}</p>
              </div>
              {a.nav && <button onClick={() => onNav(a.nav)} style={{ padding: "4px 11px", borderRadius: 8, border: `1px solid ${G}`, background: `${G}10`, color: G, fontWeight: 700, fontSize: 12, cursor: "pointer", flexShrink: 0, fontFamily: "inherit" }}>View</button>}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

// ── Notifications panel ────────────────────────────────────────────────────
function NotifsPanel({ onClose }) {
  const [items, setItems] = useState([
    { id: 1, read: false, icon: "✅", title: "Post ready to review", body: "On-site progress post is ready.",  time: "2 min ago" },
    { id: 2, read: false, icon: "🧾", title: "Invoice due",          body: "INV-004 for $100 is due.",        time: "1 hr ago" },
    { id: 3, read: true,  icon: "📊", title: "May report available", body: "Your monthly report is ready.",   time: "Yesterday" },
    { id: 4, read: true,  icon: "🚀", title: "Post went live",       body: "Team spotlight is live on LinkedIn.", time: "2 days ago" },
  ]);
  const unread = items.filter(n => !n.read).length;

  return (
    <div style={{ position: "absolute", inset: 0, zIndex: 200, background: BG, display: "flex", flexDirection: "column" }}>
      <div style={{ padding: "13px 20px", display: "flex", alignItems: "center", justifyContent: "space-between", borderBottom: `1px solid ${LINE}`, background: CARD }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <span style={{ fontWeight: 800, fontSize: 16, color: INK }}>Notifications</span>
          {unread > 0 && <span style={{ fontSize: 11, fontWeight: 700, padding: "2px 7px", borderRadius: 20, background: G, color: "#fff" }}>{unread}</span>}
        </div>
        <div style={{ display: "flex", gap: 14, alignItems: "center" }}>
          {unread > 0 && <button onClick={() => setItems(v => v.map(x => ({ ...x, read: true })))} style={{ background: "none", border: "none", color: G, fontSize: 13, fontWeight: 600, cursor: "pointer", padding: 0 }}>Mark all read</button>}
          <button onClick={onClose} style={{ background: "none", border: "none", cursor: "pointer", padding: 4 }}><Ico d={ic.x} size={20} color={DIM} /></button>
        </div>
      </div>
      <div style={{ flex: 1, overflowY: "auto" }}>
        {items.map(n => (
          <div key={n.id} onClick={() => setItems(v => v.map(x => x.id === n.id ? { ...x, read: true } : x))}
            style={{ padding: "13px 18px", display: "flex", gap: 12, alignItems: "flex-start", borderBottom: `1px solid ${LINE}`, background: n.read ? "transparent" : `${G}06`, cursor: "pointer" }}>
            <div style={{ width: 38, height: 38, borderRadius: 10, flexShrink: 0, background: n.read ? LINE : `${G}15`, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 17 }}>{n.icon}</div>
            <div style={{ flex: 1 }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 2 }}>
                <span style={{ fontWeight: n.read ? 500 : 700, fontSize: 14, color: INK }}>{n.title}</span>
                {!n.read && <div style={{ width: 7, height: 7, borderRadius: "50%", background: G, flexShrink: 0 }} />}
              </div>
              <p style={{ margin: "0 0 3px", color: DIM, fontSize: 13 }}>{n.body}</p>
              <span style={{ color: DIM, fontSize: 11 }}>{n.time}</span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

// ── Bottom nav ─────────────────────────────────────────────────────────────
function Nav({ active, onChange, badge }) {
  const tabs = [
    { id: "home",     label: "Home",    icon: ic.home },
    { id: "posts",    label: "Posts",   icon: ic.inbox },
    { id: "upload",   label: "Post",    icon: ic.plus, cta: true },
    { id: "invoices", label: "Billing", icon: ic.dollar },
    { id: "account",  label: "Account", icon: ic.user },
  ];
  return (
    <nav style={{ display: "flex", background: CARD, borderTop: `1px solid ${LINE}`, paddingBottom: "env(safe-area-inset-bottom,8px)" }}>
      {tabs.map(t => {
        const on = active === t.id;
        return (
          <button key={t.id} onClick={() => onChange(t.id)} style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", gap: 3, padding: t.cta ? "5px 0" : "9px 0", border: "none", background: "transparent", cursor: "pointer", position: "relative", fontFamily: "inherit" }}>
            {t.id === "posts" && badge > 0 && (
              <span style={{ position: "absolute", top: 5, right: "calc(50% - 16px)", width: 15, height: 15, borderRadius: "50%", background: G, color: "#fff", fontSize: 9, fontWeight: 800, display: "flex", alignItems: "center", justifyContent: "center" }}>{badge}</span>
            )}
            {t.cta ? (
              <div style={{ width: 42, height: 42, borderRadius: 13, background: on ? "#007a5c" : G, display: "flex", alignItems: "center", justifyContent: "center", boxShadow: `0 2px 10px ${G}40` }}>
                <Ico d={t.icon} size={21} color="#fff" sw={2.5} />
              </div>
            ) : (
              <Ico d={t.icon} size={21} color={on ? G : DIM} sw={on ? 2.2 : 1.7} />
            )}
            <span style={{ fontSize: 10, fontWeight: on ? 700 : 400, color: on ? G : DIM }}>{t.label}</span>
          </button>
        );
      })}
    </nav>
  );
}

// ── Sign in ────────────────────────────────────────────────────────────────
function SignIn({ onSignIn }) {
  const [loading, setLoading] = useState(null);
  const providers = [
    { id: "google",    label: "Continue with Google",    logo: <svg width="18" height="18" viewBox="0 0 24 24"><path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/><path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/><path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/><path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/></svg> },
    { id: "microsoft", label: "Continue with Microsoft", logo: <svg width="18" height="18" viewBox="0 0 24 24"><rect x="1" y="1" width="10" height="10" fill="#F25022"/><rect x="13" y="1" width="10" height="10" fill="#7FBA00"/><rect x="1" y="13" width="10" height="10" fill="#00A4EF"/><rect x="13" y="13" width="10" height="10" fill="#FFB900"/></svg> },
    { id: "apple",     label: "Continue with Apple",     logo: <svg width="18" height="18" viewBox="0 0 24 24" fill={INK}><path d="M18.71 19.5c-.83 1.24-1.71 2.45-3.05 2.47-1.34.03-1.77-.79-3.29-.79-1.53 0-2 .77-3.27.82-1.31.05-2.3-1.32-3.14-2.53C4.25 17 2.94 12.45 4.7 9.39c.87-1.52 2.43-2.48 4.12-2.51 1.28-.02 2.5.87 3.29.87.78 0 2.26-1.07 3.8-.91.65.03 2.47.26 3.64 1.98-.09.06-2.17 1.28-2.15 3.81.03 3.02 2.65 4.03 2.68 4.04-.03.07-.42 1.44-1.38 2.83M13 3.5c.73-.83 1.94-1.46 2.94-1.5.13 1.17-.34 2.35-1.04 3.19-.69.85-1.83 1.51-2.95 1.42-.15-1.15.41-2.35 1.05-3.11z"/></svg> },
  ];
  return (
    <div style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", padding: "32px 28px" }}>
      <div style={{ marginBottom: 32, textAlign: "center" }}>
        <div style={{ width: 72, height: 72, borderRadius: 20, background: DARK, display: "flex", alignItems: "center", justifyContent: "center", margin: "0 auto 14px", boxShadow: `0 6px 24px rgba(0,200,150,.2)` }}>
          <GeckoMark size={50} color={G} />
        </div>
        <div style={{ fontSize: 22, fontWeight: 900, letterSpacing: "-0.5px" }}>
          <span style={{ color: G }}>WEB</span><span style={{ color: INK }}>GECKO</span>
        </div>
        <p style={{ color: DIM, margin: "5px 0 0", fontSize: 14 }}>Client portal</p>
      </div>
      <div style={{ width: "100%", display: "flex", flexDirection: "column", gap: 10, marginBottom: 24 }}>
        {providers.map(p => (
          <button key={p.id} onClick={() => { setLoading(p.id); setTimeout(() => { setLoading(null); onSignIn(); }, 1400); }} disabled={!!loading}
            style={{ width: "100%", display: "flex", alignItems: "center", justifyContent: "center", gap: 12, padding: "13px 20px", borderRadius: 14, border: `1.5px solid ${LINE}`, background: CARD, color: INK, fontSize: 14, fontWeight: 600, cursor: "pointer", opacity: loading && loading !== p.id ? 0.45 : 1, fontFamily: "inherit" }}>
            {loading === p.id ? <span style={{ color: G, fontSize: 13 }}>Connecting…</span> : <>{p.logo}{p.label}</>}
          </button>
        ))}
      </div>
      <div style={{ display: "flex", alignItems: "center", gap: 6, color: DIM, fontSize: 12 }}>
        <Ico d={ic.shield} size={13} color={DIM} /> Secured with SSO — no password required
      </div>
    </div>
  );
}

// ── App ────────────────────────────────────────────────────────────────────
export default function App() {
  const [authed, setAuthed] = useState(false);
  const [tab,    setTab]    = useState("upload");
  const [badge,  setBadge]  = useState(2);
  const [notifs, setNotifs] = useState(false);

  const submit = () => { setBadge(b => b + 1); setTimeout(() => setTab("posts"), 900); };
  const font = "-apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif";

  if (!authed) return (
    <div style={{ fontFamily: font, color: INK, width: "100%", maxWidth: 430, margin: "0 auto", height: "100vh", display: "flex", flexDirection: "column", background: BG, overflow: "hidden" }}>
      <SignIn onSignIn={() => setAuthed(true)} />
    </div>
  );

  const screens = {
    home:     <DashboardScreen onNav={setTab} />,
    upload:   <NewPostScreen onSubmit={submit} />,
    posts:    <PostsScreen />,
    invoices: <InvoicesScreen />,
    reports:  <ReportsScreen />,
    account:  <AccountScreen onSignOut={() => setAuthed(false)} />,
  };

  return (
    <div style={{ fontFamily: font, color: INK, width: "100%", maxWidth: 430, margin: "0 auto", height: "100vh", display: "flex", flexDirection: "column", background: BG, overflow: "hidden", position: "relative" }}>
      {notifs && <NotifsPanel onClose={() => setNotifs(false)} />}

      <div style={{ padding: "11px 20px", display: "flex", justifyContent: "space-between", alignItems: "center", borderBottom: `1px solid ${LINE}`, background: CARD }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <div style={{ width: 28, height: 28, borderRadius: 8, background: DARK, display: "flex", alignItems: "center", justifyContent: "center" }}>
            <GeckoMark size={20} color={G} />
          </div>
          <span style={{ fontWeight: 900, fontSize: 15, letterSpacing: "-0.3px" }}>
            <span style={{ color: G }}>WEB</span><span style={{ color: INK }}>GECKO</span>
          </span>
        </div>
        <button onClick={() => setNotifs(true)} style={{ background: "none", border: "none", cursor: "pointer", padding: 4, position: "relative" }}>
          <Ico d={ic.bell} size={21} color={INK} />
          <span style={{ position: "absolute", top: 3, right: 3, width: 7, height: 7, borderRadius: "50%", background: G }} />
        </button>
      </div>

      <div style={{ flex: 1, overflowY: "auto", padding: "18px 18px 0" }}>
        {screens[tab]}
      </div>

      <Nav active={tab} onChange={setTab} badge={badge} />
    </div>
  );
}
