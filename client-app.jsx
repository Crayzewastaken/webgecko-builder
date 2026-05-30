import { useState, useRef } from "react";

// ── Design tokens ──────────────────────────────────────────────────────────
const G = "#00C896";          // brand green
const BG = "#F7F8FA";         // page background
const CARD = "#FFFFFF";
const LINE = "#EAECF2";       // borders
const INK = "#111827";        // primary text
const DIM = "#6B7280";        // muted text
const DARK = "#0F1117";       // dark surfaces

const r = (n) => `${n}px`;

// ── Primitives ─────────────────────────────────────────────────────────────
const Ico = ({ d, size = 22, color = "currentColor", sw = 1.8 }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none"
    stroke={color} strokeWidth={sw} strokeLinecap="round" strokeLinejoin="round">
    <path d={d} />
  </svg>
);

const ic = {
  upload:   "M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4M17 8l-5-5-5 5M12 3v12",
  camera:   "M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2zM12 17a4 4 0 1 0 0-8 4 4 0 0 0 0 8z",
  mic:      "M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3zM19 10v2a7 7 0 0 1-14 0v-2M12 19v4M8 23h8",
  link:     "M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71",
  inbox:    "M22 12h-6l-2 3h-4l-2-3H2M5.45 5.11L2 12v6a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2v-6l-3.45-6.89A2 2 0 0 0 16.76 4H7.24a2 2 0 0 0-1.79 1.11z",
  check:    "M20 6L9 17l-5-5",
  dollar:   "M12 1v22M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6",
  user:     "M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2M12 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8z",
  plus:     "M12 5v14M5 12h14",
  x:        "M18 6L6 18M6 6l12 12",
  bell:     "M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9M13.73 21a2 2 0 0 1-3.46 0",
  send:     "M22 2L11 13M22 2L15 22l-4-9-9-4 20-7z",
  clock:    "M12 22a10 10 0 1 0 0-20 10 10 0 0 0 0 20zM12 6v6l4 2",
  chart:    "M18 20V10M12 20V4M6 20v-6",
  cal:      "M3 9h18M3 4h18v16a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1V4zM8 2v4M16 2v4",
  chevron:  "M9 18l6-6-6-6",
  back:     "M19 12H5M12 19l-7-7 7-7",
  dl:       "M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4M7 10l5 5 5-5M12 15V3",
  shield:   "M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z",
  home:     "M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2zM9 22V12h6v10",
  zap:      "M13 2L3 14h9l-1 8 10-12h-9l1-8z",
  trash:    "M3 6h18M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6M10 11v6M14 11v6M9 6V4h6v2",
};

const PL = {
  Instagram: { color: "#E1306C", bg: "#fdf0f4", label: "IG" },
  Facebook:  { color: "#1877F2", bg: "#eff5fe", label: "FB" },
  LinkedIn:  { color: "#0A66C2", bg: "#eef4fb", label: "LI" },
  TikTok:    { color: "#333",    bg: "#f3f3f3", label: "TT" },
};

const Badge = ({ platform }) => {
  const p = PL[platform] || { color: DIM, bg: BG, label: platform?.slice(0,2) };
  return <span style={{ fontSize: 11, fontWeight: 700, padding: "3px 8px", borderRadius: 6, color: p.color, background: p.bg, letterSpacing: ".2px" }}>{p.label} {platform}</span>;
};

// ── Gecko logo ─────────────────────────────────────────────────────────────
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

// ── Shared UI atoms ────────────────────────────────────────────────────────
const card = { background: CARD, borderRadius: 16, border: `1px solid ${LINE}` };
const pill = (active) => ({
  padding: "6px 14px", borderRadius: 20, border: `1.5px solid ${active ? G : LINE}`,
  background: active ? `${G}12` : "transparent",
  color: active ? G : DIM, fontWeight: active ? 700 : 500, fontSize: 13, cursor: "pointer", whiteSpace: "nowrap"
});
const btn = (variant = "primary") => ({
  width: "100%", padding: "15px 0", borderRadius: 14, border: "none", cursor: "pointer",
  fontWeight: 700, fontSize: 15, fontFamily: "inherit",
  ...(variant === "primary" ? { background: G, color: "#fff", boxShadow: `0 4px 16px ${G}33` }
    : variant === "ghost"   ? { background: "transparent", border: `1.5px solid ${LINE}`, color: INK }
    : variant === "danger"  ? { background: "rgba(239,68,68,.06)", border: "1px solid rgba(239,68,68,.25)", color: "#EF4444" }
    : { background: CARD, border: `1.5px solid ${LINE}`, color: INK })
});
const input = {
  width: "100%", background: BG, border: `1.5px solid ${LINE}`,
  borderRadius: 12, padding: "11px 14px", color: INK, fontSize: 14,
  outline: "none", fontFamily: "inherit", boxSizing: "border-box",
};

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
  const isVid = file.type.startsWith("video/");
  return (
    <div style={{ position: "relative", width: 76, height: 76, borderRadius: 12, overflow: "hidden", border: `1px solid ${LINE}`, flexShrink: 0 }}>
      {isVid ? <video src={url} style={{ width: "100%", height: "100%", objectFit: "cover" }} /> : <img src={url} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }} />}
      <button onClick={onRemove} style={{ position: "absolute", top: 4, right: 4, width: 20, height: 20, borderRadius: "50%", background: "rgba(0,0,0,.6)", border: "none", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center" }}>
        <Ico d={ic.x} size={11} color="#fff" />
      </button>
    </div>
  );
}

// ── Voice recorder ─────────────────────────────────────────────────────────
function VoiceRecorder({ onDone }) {
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
  const started = useRef(false);
  if (!started.current) { started.current = true; setTimeout(start, 0); }
  const stop = () => { clearInterval(timer.current); mr.current?.stop(); };
  const fmt = s => `${Math.floor(s/60)}:${String(s%60).padStart(2,"0")}`;

  return (
    <div style={{ ...card, padding: 16, display: "flex", flexDirection: "column", gap: 12 }}>
      <p style={{ margin: 0, fontWeight: 600, fontSize: 14, color: INK }}>Voice note</p>
      {phase === "starting" && <p style={{ margin: 0, color: DIM, fontSize: 13 }}>Requesting microphone…</p>}
      {phase === "error"    && <p style={{ margin: 0, color: "#EF4444", fontSize: 13 }}>Microphone access denied.</p>}
      {phase === "rec" && (
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <div style={{ width: 8, height: 8, borderRadius: "50%", background: "#EF4444" }} />
          <span style={{ flex: 1, fontWeight: 700, fontSize: 16, color: INK }}>{fmt(secs)}</span>
          <button onClick={stop} style={{ padding: "8px 16px", borderRadius: 10, border: "none", background: "#EF4444", color: "#fff", fontWeight: 700, fontSize: 13, cursor: "pointer" }}>Stop</button>
        </div>
      )}
      {phase === "done" && (
        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          <audio src={url} controls style={{ width: "100%", borderRadius: 8 }} />
          <div style={{ display: "flex", gap: 8 }}>
            <button onClick={() => { setPhase("starting"); setUrl(null); setBlob(null); setSecs(0); setTimeout(start, 0); }} style={{ flex: 1, padding: 10, borderRadius: 10, border: `1px solid ${LINE}`, background: "transparent", color: DIM, fontWeight: 600, fontSize: 13, cursor: "pointer" }}>Re-record</button>
            <button onClick={() => onDone(blob)} style={{ flex: 1, padding: 10, borderRadius: 10, border: "none", background: G, color: "#fff", fontWeight: 700, fontSize: 13, cursor: "pointer" }}>Use this</button>
          </div>
        </div>
      )}
    </div>
  );
}

// ── New Post screen ────────────────────────────────────────────────────────
function NewPostScreen({ onSubmit }) {
  const uploadRef = useRef(), cameraRef = useRef();
  const [files, setFiles] = useState([]);
  const [desc, setDesc] = useState("");
  const [link, setLink] = useState("");
  const [showLink, setShowLink] = useState(false);
  const [showVoice, setShowVoice] = useState(false);
  const [schedMode, setSchedMode] = useState("now");
  const [schedDate, setSchedDate] = useState("");
  const [schedTime, setSchedTime] = useState("");
  const [done, setDone] = useState(false);

  const tomorrow = new Date(); tomorrow.setDate(tomorrow.getDate() + 1);
  const minDate = tomorrow.toISOString().split("T")[0];
  const addFiles = f => setFiles(p => [...p, ...Array.from(f)]);
  const hasContent = files.length > 0 || desc.trim() || link.trim();

  const submit = () => {
    if (!hasContent) return;
    setDone(true);
    setTimeout(() => { onSubmit(); setFiles([]); setDesc(""); setLink(""); setDone(false); setSchedMode("now"); }, 1800);
  };

  if (done) return (
    <div style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 16, paddingTop: 80, textAlign: "center" }}>
      <div style={{ width: 72, height: 72, borderRadius: "50%", background: `${G}18`, display: "flex", alignItems: "center", justifyContent: "center" }}>
        <Ico d={ic.send} size={30} color={G} />
      </div>
      <p style={{ margin: 0, fontWeight: 800, fontSize: 20, color: INK }}>Sent to Web Gecko!</p>
      <p style={{ margin: 0, color: DIM, fontSize: 14, lineHeight: 1.7, maxWidth: 280 }}>
        {schedMode === "later" && schedDate
          ? `Scheduled for ${new Date(schedDate).toLocaleDateString("en-AU", { day: "numeric", month: "long" })}.`
          : "We'll notify you when your post is ready to review."}
      </p>
    </div>
  );

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 24, paddingBottom: 24 }}>
      <div>
        <h1 style={{ margin: "0 0 4px", fontSize: 24, fontWeight: 800, color: INK, letterSpacing: "-0.4px" }}>New post</h1>
        <p style={{ margin: 0, color: DIM, fontSize: 14 }}>Upload your content and we'll handle the rest.</p>
      </div>

      {/* Upload zone */}
      <input ref={uploadRef} type="file" multiple accept="image/*,video/*" hidden onChange={e => addFiles(e.target.files)} />
      <input ref={cameraRef} type="file" accept="image/*,video/*" capture="environment" hidden onChange={e => addFiles(e.target.files)} />
      <div style={{ display: "flex", gap: 10 }}>
        <button onClick={() => cameraRef.current.click()} style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", gap: 10, padding: "22px 12px", borderRadius: 18, border: "none", background: DARK, cursor: "pointer" }}>
          <div style={{ width: 48, height: 48, borderRadius: "50%", background: `${G}20`, display: "flex", alignItems: "center", justifyContent: "center" }}>
            <Ico d={ic.camera} size={24} color={G} />
          </div>
          <span style={{ color: "#fff", fontWeight: 700, fontSize: 13 }}>Take photo</span>
        </button>
        <button onClick={() => uploadRef.current.click()} style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", gap: 10, padding: "22px 12px", borderRadius: 18, border: `1.5px solid ${LINE}`, background: CARD, cursor: "pointer" }}>
          <div style={{ width: 48, height: 48, borderRadius: "50%", background: `${G}12`, display: "flex", alignItems: "center", justifyContent: "center" }}>
            <Ico d={ic.upload} size={24} color={G} />
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
      <div>
        <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 10 }}>
          <span style={{ fontWeight: 700, fontSize: 14, color: INK }}>Description</span>
          <span style={{ fontSize: 11, fontWeight: 600, color: G, background: `${G}15`, padding: "2px 8px", borderRadius: 20 }}>optional</span>
        </div>
        <div style={{ position: "relative" }}>
          <textarea value={desc} onChange={e => setDesc(e.target.value.slice(0, 500))}
            placeholder="What's this post about? Add context, tone, or anything useful…"
            rows={4}
            style={{ ...input, resize: "none", lineHeight: 1.6, paddingBottom: 30, borderRadius: 14 }}
            onFocus={e => e.target.style.borderColor = G}
            onBlur={e => e.target.style.borderColor = LINE} />
          <span style={{ position: "absolute", bottom: 10, right: 12, fontSize: 11, color: desc.length > 450 ? "#F59E0B" : DIM }}>{desc.length}/500</span>
        </div>
        <p style={{ margin: "6px 0 0", color: DIM, fontSize: 12 }}>You can edit this later from your draft.</p>
      </div>

      {/* Add-ons */}
      <div style={{ display: "flex", gap: 10 }}>
        {[{ label: "Add link", icon: ic.link, key: "link", active: showLink, toggle: () => setShowLink(v => !v) },
          { label: "Voice note", icon: ic.mic, key: "voice", active: showVoice, toggle: () => setShowVoice(v => !v) }
        ].map(a => (
          <button key={a.key} onClick={a.toggle} style={{
            flex: 1, display: "flex", alignItems: "center", justifyContent: "center", gap: 8,
            padding: "12px 0", borderRadius: 14, cursor: "pointer", fontFamily: "inherit",
            border: `1.5px solid ${a.active ? G : LINE}`,
            background: a.active ? `${G}10` : CARD,
            color: a.active ? G : DIM, fontSize: 13, fontWeight: 600
          }}>
            <Ico d={a.icon} size={16} color={a.active ? G : DIM} sw={2} />
            {a.label}
          </button>
        ))}
      </div>

      {showVoice && <VoiceRecorder onDone={b => { addFiles([new File([b], `voice-${Date.now()}.webm`, { type: b.type })]); setShowVoice(false); }} />}

      {showLink && (
        <input type="url" value={link} onChange={e => setLink(e.target.value)} placeholder="https://…"
          style={{ ...input, borderColor: G, borderRadius: 14 }} />
      )}

      {/* Schedule toggle */}
      <div style={{ ...card, overflow: "hidden" }}>
        <div style={{ display: "flex" }}>
          {[{ id: "now", label: "Post ASAP", icon: ic.zap }, { id: "later", label: "Schedule", icon: ic.cal }].map(o => (
            <button key={o.id} onClick={() => setSchedMode(o.id)} style={{
              flex: 1, padding: "12px 0", border: "none", cursor: "pointer", fontFamily: "inherit",
              background: schedMode === o.id ? G : "transparent",
              color: schedMode === o.id ? "#fff" : DIM,
              fontWeight: schedMode === o.id ? 700 : 500, fontSize: 14,
              display: "flex", alignItems: "center", justifyContent: "center", gap: 6
            }}>
              <Ico d={o.icon} size={15} color={schedMode === o.id ? "#fff" : DIM} />
              {o.label}
            </button>
          ))}
        </div>
        {schedMode === "later" && (
          <div style={{ padding: "14px 16px", display: "flex", gap: 10, borderTop: `1px solid ${LINE}` }}>
            <input type="date" min={minDate} value={schedDate} onChange={e => setSchedDate(e.target.value)}
              style={{ ...input, flex: 1 }}
              onFocus={e => e.target.style.borderColor = G} onBlur={e => e.target.style.borderColor = LINE} />
            <input type="time" value={schedTime} onChange={e => setSchedTime(e.target.value)}
              style={{ ...input, flex: 1 }}
              onFocus={e => e.target.style.borderColor = G} onBlur={e => e.target.style.borderColor = LINE} />
          </div>
        )}
      </div>

      <button onClick={submit} disabled={!hasContent} style={{
        ...btn(hasContent ? "primary" : "ghost"),
        opacity: hasContent ? 1 : 0.45, cursor: hasContent ? "pointer" : "not-allowed", fontFamily: "inherit"
      }}>
        {schedMode === "later" && schedDate
          ? `Schedule for ${new Date(schedDate).toLocaleDateString("en-AU", { day: "numeric", month: "short" })} →`
          : "Submit to Web Gecko →"}
      </button>
    </div>
  );
}

// ── Post detail sheet ──────────────────────────────────────────────────────
function PostSheet({ post, onClose, onApprove, onRevision, onDelete }) {
  const [revText, setRevText] = useState("");
  const [revMode, setRevMode] = useState(false);
  const [sent, setSent] = useState(false);

  const sendRev = () => {
    if (!revText.trim()) return;
    setSent(true);
    setTimeout(() => { onRevision(post.id, revText); onClose(); }, 700);
  };

  return (
    <div style={{ position: "absolute", inset: 0, zIndex: 150, background: BG, display: "flex", flexDirection: "column", overflowY: "auto" }}>
      {/* Top bar */}
      <div style={{ padding: "14px 20px", display: "flex", alignItems: "center", gap: 12, borderBottom: `1px solid ${LINE}`, background: CARD }}>
        <button onClick={onClose} style={{ background: "none", border: "none", cursor: "pointer", padding: 4 }}>
          <Ico d={ic.back} size={20} color={G} />
        </button>
        <span style={{ flex: 1, fontWeight: 700, fontSize: 16, color: INK }}>Post preview</span>
        <Badge platform={post.platform} />
      </div>

      <div style={{ padding: 20, display: "flex", flexDirection: "column", gap: 16 }}>
        {/* Preview card */}
        <div style={{ ...card, overflow: "hidden" }}>
          <div style={{ background: "#F3F4F6", height: 140, display: "flex", alignItems: "center", justifyContent: "center" }}>
            <span style={{ fontSize: 36 }}>🖼️</span>
          </div>
          <div style={{ padding: 16 }}>
            <div style={{ display: "flex", gap: 10, alignItems: "center", marginBottom: 10 }}>
              <div style={{ width: 34, height: 34, borderRadius: "50%", background: G, display: "flex", alignItems: "center", justifyContent: "center" }}>
                <Ico d={ic.user} size={18} color="#000" />
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
          <div style={{ background: `${G}10`, borderRadius: 12, padding: "11px 14px", border: `1px solid ${G}30`, display: "flex", alignItems: "center", gap: 10 }}>
            <Ico d={ic.cal} size={16} color={G} />
            <span style={{ color: INK, fontSize: 14 }}>Scheduled for <strong>{post.scheduledFor}</strong></span>
          </div>
        )}

        {post.status === "ready" && !revMode && !sent && (
          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            <button onClick={() => onApprove(post.id)} style={{ ...btn("primary"), fontFamily: "inherit" }}>Approve & post</button>
            <button onClick={() => setRevMode(true)} style={{ ...btn("secondary"), fontFamily: "inherit" }}>Request a revision</button>
            <button onClick={() => onDelete(post.id)} style={{ ...btn("danger"), fontFamily: "inherit" }}>Delete draft</button>
          </div>
        )}

        {revMode && !sent && (
          <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
            <label style={{ fontWeight: 700, fontSize: 14, color: INK }}>What needs changing?</label>
            <textarea value={revText} onChange={e => setRevText(e.target.value)}
              placeholder="e.g. Make the tone more casual, mention the June promo…" rows={4}
              style={{ ...input, resize: "none", lineHeight: 1.6, borderRadius: 12 }}
              onFocus={e => e.target.style.borderColor = G} onBlur={e => e.target.style.borderColor = LINE} />
            <div style={{ display: "flex", gap: 8 }}>
              <button onClick={() => setRevMode(false)} style={{ flex: 1, padding: 13, borderRadius: 12, border: `1px solid ${LINE}`, background: "transparent", color: DIM, fontWeight: 600, fontSize: 14, cursor: "pointer", fontFamily: "inherit" }}>Cancel</button>
              <button onClick={sendRev} style={{ flex: 1, padding: 13, borderRadius: 12, border: "none", background: G, color: "#fff", fontWeight: 700, fontSize: 14, cursor: "pointer", fontFamily: "inherit" }}>Send feedback</button>
            </div>
          </div>
        )}

        {sent && <p style={{ textAlign: "center", color: G, fontWeight: 700, fontSize: 15, margin: 0 }}>✓ Revision sent — we'll update and notify you.</p>}
        {post.status === "approved" && (
          <div style={{ background: `${G}10`, borderRadius: 12, padding: 14, textAlign: "center", border: `1px solid ${G}30` }}>
            <p style={{ margin: 0, color: G, fontWeight: 700 }}>✓ This post is live</p>
          </div>
        )}
      </div>
    </div>
  );
}

// ── Posts screen ───────────────────────────────────────────────────────────
function PostsScreen() {
  const [posts, setPosts] = useState([
    { id: 1, status: "ready", date: "Today, 2:14 PM", preview: "🚧 On-site progress at the Greenfield build — new framing going up fast. Swipe to see the transformation.", platform: "Instagram", hashtags: "#construction #progress #build" },
    { id: 2, status: "generating", date: "Today, 11:30 AM", preview: "", platform: "Facebook", eta: "~10 min" },
    { id: 3, status: "ready", date: "Yesterday, 4:00 PM", preview: "Big things coming this June — stay tuned for our biggest promo yet.", platform: "LinkedIn", scheduledFor: "June 1, 2026" },
    { id: 4, status: "approved", date: "May 21", preview: "Team spotlight — meet the crew keeping every project on track and on time.", platform: "LinkedIn", hashtags: "#team #construction" },
  ]);
  const [selected, setSelected] = useState(null);
  const [filter, setFilter] = useState("all");

  const approve = id => setPosts(p => p.map(x => x.id === id ? { ...x, status: "approved" } : x));
  const remove  = id => { setPosts(p => p.filter(x => x.id !== id)); setSelected(null); };
  const revise  = (id, t) => setPosts(p => p.map(x => x.id === id ? { ...x, status: "revision" } : x));

  const STATUS = {
    ready:     { label: "Ready to review", color: G,         bg: `${G}15` },
    generating:{ label: "Generating…",     color: "#F59E0B", bg: "#FEF3C710" },
    approved:  { label: "Live",            color: DIM,       bg: `${LINE}` },
    revision:  { label: "Revision sent",   color: "#8B5CF6", bg: "#8B5CF615" },
  };

  const filtered = filter === "all" ? posts : posts.filter(p => p.status === filter);
  const readyN = posts.filter(p => p.status === "ready").length;

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16, position: "relative" }}>
      {selected && (
        <PostSheet post={posts.find(p => p.id === selected)} onClose={() => setSelected(null)}
          onApprove={id => { approve(id); setSelected(null); }} onRevision={revise} onDelete={remove} />
      )}

      <div>
        <h1 style={{ margin: "0 0 4px", fontSize: 24, fontWeight: 800, color: INK, letterSpacing: "-0.4px" }}>Posts</h1>
        {readyN > 0 && <p style={{ margin: 0, color: G, fontSize: 13, fontWeight: 600 }}>{readyN} ready to review</p>}
      </div>

      <div style={{ display: "flex", gap: 8, overflowX: "auto", paddingBottom: 2 }}>
        {[{ id: "all", label: "All" }, { id: "ready", label: "To review" }, { id: "generating", label: "In progress" }, { id: "approved", label: "Live" }].map(f => (
          <button key={f.id} onClick={() => setFilter(f.id)} style={pill(filter === f.id)}>{f.label}</button>
        ))}
      </div>

      {filtered.length === 0 && <p style={{ textAlign: "center", color: DIM, padding: "32px 0" }}>Nothing here yet.</p>}

      {filtered.map(p => {
        const s = STATUS[p.status] || STATUS.generating;
        return (
          <div key={p.id} onClick={() => p.status !== "generating" && setSelected(p.id)}
            style={{ ...card, padding: 16, cursor: p.status !== "generating" ? "pointer" : "default", border: `1px solid ${p.status === "ready" ? G + "44" : LINE}` }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}>
              <span style={{ fontSize: 11, fontWeight: 700, padding: "3px 9px", borderRadius: 20, color: s.color, background: s.bg }}>{s.label}</span>
              <span style={{ color: DIM, fontSize: 12 }}>{p.date}</span>
            </div>
            {p.status === "generating"
              ? <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                  <span style={{ color: DIM, fontSize: 14 }}>Generating your post…</span>
                  {p.eta && <span style={{ color: DIM, fontSize: 12 }}>ETA {p.eta}</span>}
                </div>
              : <p style={{ margin: "0 0 10px", color: INK, fontSize: 14, lineHeight: 1.6 }}>{p.preview}</p>
            }
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

// ── Invoices screen ────────────────────────────────────────────────────────
function InvoicesScreen() {
  const [invoices, setInvoices] = useState([
    { id: "INV-004", date: "May 28, 2026", post: "On-site progress post", amount: 100, status: "due" },
    { id: "INV-003", date: "May 21, 2026", post: "Team spotlight",        amount: 100, status: "paid" },
    { id: "INV-002", date: "May 14, 2026", post: "Logo reveal",           amount: 100, status: "paid" },
    { id: "INV-001", date: "May 7, 2026",  post: "Business intro post",   amount: 100, status: "paid" },
  ]);
  const [paying, setPaying] = useState(false);
  const [flash, setFlash] = useState(false);
  const due   = invoices.filter(i => i.status === "due").reduce((a, i) => a + i.amount, 0);
  const total = invoices.reduce((a, i) => a + i.amount, 0);

  const pay = () => {
    setPaying(true);
    setTimeout(() => {
      setInvoices(v => v.map(i => i.status === "due" ? { ...i, status: "paid" } : i));
      setPaying(false); setFlash(true);
      setTimeout(() => setFlash(false), 3000);
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

      {/* Summary */}
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

      {due > 0 && (
        <button onClick={pay} disabled={paying} style={{ ...btn("primary"), opacity: paying ? .6 : 1, fontFamily: "inherit" }}>
          {paying ? "Processing…" : `Pay $${due} now`}
        </button>
      )}
      {due === 0 && !flash && (
        <div style={{ background: `${G}10`, border: `1px solid ${G}30`, borderRadius: 12, padding: "12px 14px", display: "flex", alignItems: "center", gap: 8 }}>
          <Ico d={ic.check} size={16} color={G} /><span style={{ color: INK, fontWeight: 600, fontSize: 14 }}>All paid — you're up to date.</span>
        </div>
      )}

      {/* Card on file */}
      <div style={{ ...card, padding: "14px 16px", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <div style={{ width: 36, height: 36, borderRadius: 8, background: "#1a1a2e", display: "flex", alignItems: "center", justifyContent: "center" }}>
            <span style={{ color: "#fff", fontSize: 11, fontWeight: 800 }}>VISA</span>
          </div>
          <div>
            <p style={{ margin: 0, fontWeight: 600, fontSize: 14, color: INK }}>Visa ···· 4242</p>
            <p style={{ margin: 0, fontSize: 12, color: DIM }}>Expires 08/28</p>
          </div>
        </div>
        <button style={{ background: "none", border: "none", color: G, fontSize: 13, fontWeight: 600, cursor: "pointer" }}>Update</button>
      </div>

      <p style={{ margin: "4px 0 0", color: DIM, fontSize: 12, fontWeight: 600 }}>History</p>

      {invoices.map(inv => (
        <div key={inv.id} style={{ ...card, padding: "14px 16px", display: "flex", alignItems: "center", gap: 14 }}>
          <div style={{ width: 38, height: 38, borderRadius: 10, flexShrink: 0, background: inv.status === "paid" ? LINE : `${G}15`, display: "flex", alignItems: "center", justifyContent: "center" }}>
            <Ico d={inv.status === "paid" ? ic.check : ic.dollar} size={17} color={inv.status === "paid" ? DIM : G} />
          </div>
          <div style={{ flex: 1 }}>
            <p style={{ margin: "0 0 2px", color: INK, fontSize: 14, fontWeight: 600 }}>{inv.id}</p>
            <p style={{ margin: 0, color: DIM, fontSize: 12 }}>{inv.post} · {inv.date}</p>
          </div>
          <div style={{ textAlign: "right", display: "flex", flexDirection: "column", alignItems: "flex-end", gap: 4 }}>
            <p style={{ margin: 0, color: INK, fontWeight: 700, fontSize: 15 }}>${inv.amount}</p>
            <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
              <span style={{ fontSize: 11, fontWeight: 700, padding: "2px 8px", borderRadius: 20, color: inv.status === "paid" ? DIM : G, background: inv.status === "paid" ? LINE : `${G}15` }}>
                {inv.status === "paid" ? "Paid" : "Due"}
              </span>
              {inv.status === "paid" && (
                <button style={{ background: "none", border: "none", cursor: "pointer", padding: 2 }}>
                  <Ico d={ic.dl} size={13} color={DIM} />
                </button>
              )}
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}

// ── Reports screen ─────────────────────────────────────────────────────────
function ReportsScreen() {
  const [sel, setSel] = useState(null);
  const reports = [
    { id: 1, month: "May 2026",   stats: { posts: 4, reach: "12,400", engagement: "8.2%", topPost: "Team spotlight" }, trends: { posts: 1, reach: 27, eng: 1.1 }, summary: "Strong month — engagement up 14% from April. Team spotlight was your best performer. LinkedIn outperforming Facebook 2:1. Focus for June: video content." },
    { id: 2, month: "April 2026", stats: { posts: 3, reach: "9,800",  engagement: "7.1%", topPost: "Logo reveal"    }, trends: { posts: 1, reach: 88, eng: 0.7 }, summary: "Solid start. Logo reveal drove strong brand awareness. Facebook driving most traffic. Consider adding Instagram to the mix." },
    { id: 3, month: "March 2026", stats: { posts: 2, reach: "5,200",  engagement: "6.4%", topPost: "Business intro" }, trends: { posts: null, reach: null, eng: null }, summary: "First full month live. Business intro post performed well. Audience growing steadily." },
  ];

  const Stat = ({ label, value, trend }) => (
    <div style={{ flex: 1, background: BG, borderRadius: 12, padding: "12px 14px", border: `1px solid ${LINE}` }}>
      <p style={{ margin: "0 0 4px", color: DIM, fontSize: 11, fontWeight: 600, textTransform: "uppercase", letterSpacing: ".5px" }}>{label}</p>
      <p style={{ margin: "0 0 4px", color: INK, fontSize: 18, fontWeight: 800 }}>{value}</p>
      {trend != null && <span style={{ fontSize: 11, fontWeight: 700, color: trend >= 0 ? G : "#EF4444" }}>{trend >= 0 ? "↑" : "↓"} {Math.abs(trend)}{typeof trend === "number" ? "%" : ""}</span>}
    </div>
  );

  if (sel) {
    const r = reports.find(x => x.id === sel);
    return (
      <div style={{ display: "flex", flexDirection: "column", gap: 16, paddingBottom: 24 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
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
        <div style={{ background: `${G}10`, borderRadius: 12, padding: 14, border: `1px solid ${G}30`, display: "flex", gap: 12, alignItems: "center" }}>
          <span style={{ fontSize: 20 }}>📧</span>
          <div>
            <p style={{ margin: "0 0 2px", fontWeight: 700, fontSize: 13, color: INK }}>Email copy sent</p>
            <p style={{ margin: 0, color: DIM, fontSize: 12 }}>Sent to zack@example.com</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16, paddingBottom: 24 }}>
      <div>
        <h1 style={{ margin: "0 0 4px", fontSize: 24, fontWeight: 800, color: INK, letterSpacing: "-0.4px" }}>Reports</h1>
        <p style={{ margin: 0, color: DIM, fontSize: 14 }}>Sent by email monthly. Full history below.</p>
      </div>

      {/* Next report */}
      <div style={{ background: DARK, borderRadius: 16, padding: "16px 18px", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <div>
          <p style={{ margin: "0 0 4px", color: "#ffffff55", fontSize: 12 }}>Next report</p>
          <p style={{ margin: 0, color: "#fff", fontWeight: 800, fontSize: 16 }}>June 2026</p>
          <p style={{ margin: "4px 0 0", color: "#ffffff44", fontSize: 12 }}>Auto-emailed Jul 1</p>
        </div>
        <div style={{ background: `${G}22`, borderRadius: 12, padding: "12px 16px", textAlign: "center" }}>
          <p style={{ margin: 0, color: G, fontWeight: 900, fontSize: 22 }}>2</p>
          <p style={{ margin: 0, color: G, fontSize: 11, fontWeight: 600 }}>days left</p>
        </div>
      </div>

      {reports.map(r => (
        <div key={r.id} onClick={() => setSel(r.id)} style={{ ...card, padding: "16px 18px", display: "flex", alignItems: "center", justifyContent: "space-between", cursor: "pointer" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
            <div style={{ width: 40, height: 40, borderRadius: 10, background: `${G}15`, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 18 }}>📊</div>
            <div>
              <p style={{ margin: "0 0 3px", color: INK, fontWeight: 700, fontSize: 15 }}>{r.month}</p>
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

// ── Account screen ─────────────────────────────────────────────────────────
function AccountScreen({ onSignOut }) {
  const [tab, setTab] = useState("profile");
  const [editing, setEditing] = useState(false);
  const [profile, setProfile] = useState({ name: "Zack's Construction Co.", email: "zack@example.com", phone: "+1 (555) 012-3456" });
  const [draft, setDraft] = useState({ ...profile });
  const [saved, setSaved] = useState(false);
  const [notifs, setNotifs] = useState({ postReady: true, invoiceDue: true, reportReady: true, postLive: false });
  const [msg, setMsg] = useState("");
  const [msgSent, setMsgSent] = useState(false);

  const save = () => { setProfile({ ...draft }); setSaved(true); setTimeout(() => { setSaved(false); setEditing(false); }, 900); };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16, paddingBottom: 24 }}>
      {/* Header */}
      <div style={{ textAlign: "center", paddingTop: 4 }}>
        <div style={{ width: 68, height: 68, borderRadius: "50%", background: G, display: "flex", alignItems: "center", justifyContent: "center", margin: "0 auto 10px" }}>
          <Ico d={ic.user} size={30} color="#000" />
        </div>
        <p style={{ margin: "0 0 2px", fontWeight: 800, fontSize: 17, color: INK }}>{profile.name}</p>
        <p style={{ margin: 0, color: DIM, fontSize: 13 }}>Client since May 2026 · 9 posts live</p>
      </div>

      {/* Tabs */}
      <div style={{ display: "flex", background: CARD, borderRadius: 12, padding: 4, border: `1px solid ${LINE}`, gap: 4 }}>
        {[{ id: "profile", label: "Profile" }, { id: "alerts", label: "Alerts" }, { id: "support", label: "Support" }].map(t => (
          <button key={t.id} onClick={() => setTab(t.id)} style={{ flex: 1, padding: "7px 4px", borderRadius: 9, border: "none", cursor: "pointer", fontSize: 12, fontWeight: tab === t.id ? 700 : 500, background: tab === t.id ? G : "transparent", color: tab === t.id ? "#fff" : DIM, fontFamily: "inherit" }}>{t.label}</button>
        ))}
      </div>

      {tab === "profile" && (
        <>
          {!editing ? (
            <div style={{ ...card, overflow: "hidden" }}>
              {[{ label: "Business name", value: profile.name }, { label: "Email", value: profile.email }, { label: "Phone", value: profile.phone }, { label: "Plan", value: "Pay-per-post · $100" }].map((row, i, arr) => (
                <div key={row.label} style={{ padding: "14px 16px", display: "flex", justifyContent: "space-between", alignItems: "center", borderBottom: i < arr.length - 1 ? `1px solid ${LINE}` : "none" }}>
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
                <button onClick={() => { setDraft({ ...profile }); setEditing(false); }} style={{ flex: 1, padding: 12, borderRadius: 12, border: `1px solid ${LINE}`, background: "transparent", color: DIM, fontWeight: 600, fontSize: 14, cursor: "pointer", fontFamily: "inherit" }}>Cancel</button>
                <button onClick={save} style={{ flex: 1, padding: 12, borderRadius: 12, border: "none", background: saved ? "#059669" : G, color: "#fff", fontWeight: 700, fontSize: 14, cursor: "pointer", fontFamily: "inherit" }}>{saved ? "✓ Saved" : "Save"}</button>
              </div>
            </div>
          )}

          {/* Connected platforms */}
          <div style={{ ...card, padding: "12px 14px" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
              <span style={{ fontWeight: 700, fontSize: 13, color: INK }}>Active platforms</span>
              <button onClick={() => setTab("support")} style={{ background: "none", border: "none", color: G, fontSize: 12, fontWeight: 600, cursor: "pointer", padding: 0 }}>+ Request a platform</button>
            </div>
            <div style={{ display: "flex", gap: 8 }}>
              {[{ name: "Instagram", ...PL.Instagram }, { name: "Facebook", ...PL.Facebook }].map(p => (
                <div key={p.name} style={{ display: "flex", alignItems: "center", gap: 5, padding: "5px 10px", borderRadius: 8, background: p.bg }}>
                  <span style={{ color: p.color, fontWeight: 800, fontSize: 11 }}>{p.label}</span>
                  <span style={{ color: p.color, fontWeight: 600, fontSize: 13 }}>{p.name}</span>
                </div>
              ))}
            </div>
            <p style={{ margin: "8px 0 0", color: DIM, fontSize: 11 }}>Managed by Web Gecko.</p>
          </div>

          {!editing && <button onClick={() => setEditing(true)} style={{ ...btn("ghost"), fontFamily: "inherit" }}>Edit profile</button>}
          <button onClick={onSignOut} style={{ ...btn("danger"), fontFamily: "inherit" }}>Sign out</button>
        </>
      )}

      {tab === "alerts" && (
        <div style={{ ...card, overflow: "hidden" }}>
          {[
            { key: "postReady",  label: "Post ready to review", sub: "When your draft is ready" },
            { key: "invoiceDue", label: "Invoice due",           sub: "When a payment is due" },
            { key: "reportReady",label: "Monthly report",        sub: "When your report is ready" },
            { key: "postLive",   label: "Post went live",        sub: "Confirmation after posting" },
          ].map((item, i, arr) => (
            <div key={item.key} style={{ padding: "14px 16px", display: "flex", justifyContent: "space-between", alignItems: "center", borderBottom: i < arr.length - 1 ? `1px solid ${LINE}` : "none" }}>
              <div>
                <p style={{ margin: 0, fontWeight: 600, fontSize: 14, color: INK }}>{item.label}</p>
                <p style={{ margin: "2px 0 0", fontSize: 12, color: DIM }}>{item.sub}</p>
              </div>
              <Toggle on={notifs[item.key]} onToggle={() => setNotifs(n => ({ ...n, [item.key]: !n[item.key] }))} />
            </div>
          ))}
        </div>
      )}

      {tab === "support" && (
        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          {[{ icon: "📞", label: "Call us", val: "+61 400 000 000" }, { icon: "📧", label: "Email", val: "hello@webgecko.com.au" }].map(c => (
            <div key={c.label} style={{ ...card, padding: "14px 16px", display: "flex", alignItems: "center", gap: 14 }}>
              <span style={{ fontSize: 22 }}>{c.icon}</span>
              <div><p style={{ margin: 0, fontWeight: 700, fontSize: 14, color: INK }}>{c.label}</p><p style={{ margin: 0, fontSize: 13, color: G }}>{c.val}</p></div>
            </div>
          ))}
          <div>
            <label style={{ fontWeight: 700, fontSize: 14, color: INK, display: "block", marginBottom: 8 }}>Send a message</label>
            {msgSent ? (
              <div style={{ background: `${G}12`, borderRadius: 12, padding: 16, textAlign: "center" }}>
                <p style={{ margin: 0, color: G, fontWeight: 700 }}>✓ Sent — we'll reply within 24 hours.</p>
              </div>
            ) : (
              <>
                <textarea value={msg} onChange={e => setMsg(e.target.value)} placeholder="Describe your issue or question…" rows={4}
                  style={{ ...input, resize: "none", lineHeight: 1.6, borderRadius: 12 }}
                  onFocus={e => e.target.style.borderColor = G} onBlur={e => e.target.style.borderColor = LINE} />
                <button onClick={() => { if (msg.trim()) setMsgSent(true); }} style={{ ...btn("primary"), marginTop: 10, fontFamily: "inherit" }}>Send message</button>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

// ── Dashboard ──────────────────────────────────────────────────────────────
function DashboardScreen({ onNav }) {
  const stats = [
    { label: "Posts live",      value: "9",     trend: "+2",    warn: false },
    { label: "This month",      value: "4",      trend: "+1",    warn: false },
    { label: "Avg engagement",  value: "8.2%",   trend: "+1.1%", warn: false },
    { label: "Outstanding",     value: "$100",   trend: "due",   warn: true  },
  ];
  const activity = [
    { icon: "✅", text: "On-site progress post ready to review", time: "2 min ago", nav: "drafts" },
    { icon: "⏳", text: "Logo reveal being generated (~10 min)", time: "30 min ago", nav: null },
    { icon: "🚀", text: "Team spotlight is live on LinkedIn",    time: "2 days ago", nav: null },
    { icon: "📊", text: "May report is ready",                  time: "Yesterday",  nav: "reports" },
  ];

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 22, paddingBottom: 24 }}>
      <div>
        <h1 style={{ margin: "0 0 4px", fontSize: 24, fontWeight: 800, color: INK, letterSpacing: "-0.4px" }}>Good morning, Zack 👋</h1>
        <p style={{ margin: 0, color: DIM, fontSize: 14 }}>Here's what's happening with your socials.</p>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
        {stats.map(s => (
          <div key={s.label} style={{ ...card, padding: "14px 16px", border: `1px solid ${s.warn ? "#EF444430" : LINE}` }}>
            <p style={{ margin: "0 0 6px", fontSize: 12, color: DIM }}>{s.label}</p>
            <p style={{ margin: "0 0 5px", fontSize: 22, fontWeight: 900, color: s.warn ? "#EF4444" : INK }}>{s.value}</p>
            <span style={{ fontSize: 11, fontWeight: 700, color: s.warn ? "#EF4444" : G }}>{s.trend}</span>
          </div>
        ))}
      </div>

      {/* Next scheduled */}
      <div style={{ background: DARK, borderRadius: 16, padding: "16px 18px", display: "flex", alignItems: "center", gap: 14 }}>
        <div style={{ width: 42, height: 42, borderRadius: 12, background: `${G}20`, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
          <Ico d={ic.cal} size={22} color={G} />
        </div>
        <div style={{ flex: 1 }}>
          <p style={{ margin: "0 0 2px", color: "#ffffff55", fontSize: 11, textTransform: "uppercase", letterSpacing: ".4px", fontWeight: 600 }}>Next scheduled</p>
          <p style={{ margin: "0 0 4px", color: "#fff", fontWeight: 700, fontSize: 15 }}>Big June promo</p>
          <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
            <span style={{ color: "#ffffff44", fontSize: 12 }}>June 1</span>
            <Badge platform="LinkedIn" />
          </div>
        </div>
      </div>

      <div style={{ display: "flex", gap: 10 }}>
        <button onClick={() => onNav("upload")} style={{ flex: 1, padding: "13px 0", borderRadius: 14, border: "none", background: G, color: "#fff", fontWeight: 700, fontSize: 14, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", gap: 6, fontFamily: "inherit" }}>
          <Ico d={ic.plus} size={17} color="#fff" sw={2.5} /> New post
        </button>
        <button onClick={() => onNav("posts")} style={{ flex: 1, padding: "13px 0", borderRadius: 14, border: `1.5px solid ${LINE}`, background: CARD, color: INK, fontWeight: 600, fontSize: 14, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", gap: 6, fontFamily: "inherit" }}>
          <Ico d={ic.inbox} size={17} color={DIM} /> Review posts
        </button>
      </div>

      <div>
        <p style={{ margin: "0 0 10px", fontWeight: 700, fontSize: 14, color: INK }}>Recent activity</p>
        <div style={{ ...card, overflow: "hidden" }}>
          {activity.map((a, i) => (
            <div key={i} style={{ padding: "12px 16px", display: "flex", alignItems: "center", gap: 12, borderBottom: i < activity.length - 1 ? `1px solid ${LINE}` : "none" }}>
              <span style={{ fontSize: 18, flexShrink: 0 }}>{a.icon}</span>
              <div style={{ flex: 1 }}>
                <p style={{ margin: "0 0 2px", fontSize: 13, color: INK, lineHeight: 1.4 }}>{a.text}</p>
                <p style={{ margin: 0, fontSize: 11, color: DIM }}>{a.time}</p>
              </div>
              {a.nav && (
                <button onClick={() => onNav(a.nav)} style={{ padding: "5px 12px", borderRadius: 8, border: `1px solid ${G}`, background: `${G}12`, color: G, fontWeight: 700, fontSize: 12, cursor: "pointer", flexShrink: 0, fontFamily: "inherit" }}>
                  View
                </button>
              )}
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
    { id: 1, read: false, icon: "✅", title: "Post ready to review", body: "On-site progress post is ready.", time: "2 min ago" },
    { id: 2, read: false, icon: "🧾", title: "Invoice due",          body: "INV-004 for $100 is due.",       time: "1 hr ago" },
    { id: 3, read: true,  icon: "📊", title: "May report available", body: "Your monthly report is ready.",  time: "Yesterday" },
    { id: 4, read: true,  icon: "🚀", title: "Post went live",       body: "Team spotlight is live on LinkedIn.", time: "2 days ago" },
  ]);
  const unread = items.filter(n => !n.read).length;
  const markRead = id => setItems(v => v.map(x => x.id === id ? { ...x, read: true } : x));

  return (
    <div style={{ position: "absolute", inset: 0, zIndex: 200, background: BG, display: "flex", flexDirection: "column" }}>
      <div style={{ padding: "14px 20px", display: "flex", alignItems: "center", justifyContent: "space-between", borderBottom: `1px solid ${LINE}`, background: CARD }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <span style={{ fontWeight: 800, fontSize: 17, color: INK }}>Notifications</span>
          {unread > 0 && <span style={{ fontSize: 11, fontWeight: 700, padding: "2px 8px", borderRadius: 20, background: G, color: "#fff" }}>{unread}</span>}
        </div>
        <div style={{ display: "flex", gap: 14, alignItems: "center" }}>
          {unread > 0 && <button onClick={() => setItems(v => v.map(x => ({ ...x, read: true })))} style={{ background: "none", border: "none", color: G, fontSize: 13, fontWeight: 600, cursor: "pointer", padding: 0 }}>Mark all read</button>}
          <button onClick={onClose} style={{ background: "none", border: "none", cursor: "pointer", padding: 4 }}><Ico d={ic.x} size={20} color={DIM} /></button>
        </div>
      </div>
      <div style={{ flex: 1, overflowY: "auto" }}>
        {items.map(n => (
          <div key={n.id} onClick={() => markRead(n.id)}
            style={{ padding: "14px 20px", display: "flex", gap: 14, alignItems: "flex-start", borderBottom: `1px solid ${LINE}`, background: n.read ? "transparent" : `${G}06`, cursor: "pointer" }}>
            <div style={{ width: 40, height: 40, borderRadius: 12, flexShrink: 0, background: n.read ? LINE : `${G}15`, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 18 }}>{n.icon}</div>
            <div style={{ flex: 1 }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 3 }}>
                <span style={{ fontWeight: n.read ? 500 : 700, fontSize: 14, color: INK }}>{n.title}</span>
                {!n.read && <div style={{ width: 7, height: 7, borderRadius: "50%", background: G, flexShrink: 0 }} />}
              </div>
              <p style={{ margin: "0 0 4px", color: DIM, fontSize: 13 }}>{n.body}</p>
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
    { id: "home",     label: "Home",     icon: ic.home },
    { id: "posts",    label: "Posts",    icon: ic.inbox },
    { id: "upload",   label: "Post",     icon: ic.plus, cta: true },
    { id: "invoices", label: "Invoices", icon: ic.dollar },
    { id: "account",  label: "Account",  icon: ic.user },
  ];
  return (
    <nav style={{ display: "flex", background: CARD, borderTop: `1px solid ${LINE}`, paddingBottom: "env(safe-area-inset-bottom,8px)" }}>
      {tabs.map(t => {
        const on = active === t.id;
        return (
          <button key={t.id} onClick={() => onChange(t.id)} style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", gap: 3, padding: t.cta ? "6px 0" : "10px 0", border: "none", background: "transparent", cursor: "pointer", position: "relative", fontFamily: "inherit" }}>
            {t.id === "posts" && badge > 0 && (
              <span style={{ position: "absolute", top: 6, right: "calc(50% - 16px)", width: 15, height: 15, borderRadius: "50%", background: G, color: "#fff", fontSize: 9, fontWeight: 800, display: "flex", alignItems: "center", justifyContent: "center" }}>{badge}</span>
            )}
            {t.cta ? (
              <div style={{ width: 44, height: 44, borderRadius: 14, background: on ? "#007a5c" : G, display: "flex", alignItems: "center", justifyContent: "center", boxShadow: `0 2px 10px ${G}44` }}>
                <Ico d={t.icon} size={22} color="#fff" sw={2.5} />
              </div>
            ) : (
              <Ico d={t.icon} size={22} color={on ? G : DIM} sw={on ? 2.2 : 1.8} />
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
    { id: "google", label: "Continue with Google", logo: <svg width="18" height="18" viewBox="0 0 24 24"><path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/><path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/><path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/><path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/></svg> },
    { id: "microsoft", label: "Continue with Microsoft", logo: <svg width="18" height="18" viewBox="0 0 24 24"><rect x="1" y="1" width="10" height="10" fill="#F25022"/><rect x="13" y="1" width="10" height="10" fill="#7FBA00"/><rect x="1" y="13" width="10" height="10" fill="#00A4EF"/><rect x="13" y="13" width="10" height="10" fill="#FFB900"/></svg> },
    { id: "apple", label: "Continue with Apple", logo: <svg width="18" height="18" viewBox="0 0 24 24" fill={INK}><path d="M18.71 19.5c-.83 1.24-1.71 2.45-3.05 2.47-1.34.03-1.77-.79-3.29-.79-1.53 0-2 .77-3.27.82-1.31.05-2.3-1.32-3.14-2.53C4.25 17 2.94 12.45 4.7 9.39c.87-1.52 2.43-2.48 4.12-2.51 1.28-.02 2.5.87 3.29.87.78 0 2.26-1.07 3.8-.91.65.03 2.47.26 3.64 1.98-.09.06-2.17 1.28-2.15 3.81.03 3.02 2.65 4.03 2.68 4.04-.03.07-.42 1.44-1.38 2.83M13 3.5c.73-.83 1.94-1.46 2.94-1.5.13 1.17-.34 2.35-1.04 3.19-.69.85-1.83 1.51-2.95 1.42-.15-1.15.41-2.35 1.05-3.11z"/></svg> },
  ];
  return (
    <div style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", padding: "40px 28px" }}>
      <div style={{ marginBottom: 36, textAlign: "center" }}>
        <div style={{ width: 76, height: 76, borderRadius: 22, background: DARK, display: "flex", alignItems: "center", justifyContent: "center", margin: "0 auto 16px", boxShadow: `0 8px 28px rgba(0,200,150,.2)` }}>
          <GeckoMark size={52} color={G} />
        </div>
        <div style={{ fontSize: 24, fontWeight: 900, letterSpacing: "-0.5px" }}>
          <span style={{ color: G }}>WEB</span><span style={{ color: INK }}>GECKO</span>
        </div>
        <p style={{ color: DIM, margin: "6px 0 0", fontSize: 14 }}>Client portal</p>
      </div>
      <h2 style={{ margin: "0 0 6px", fontSize: 20, fontWeight: 800, color: INK, textAlign: "center" }}>Sign in</h2>
      <p style={{ margin: "0 0 28px", color: DIM, fontSize: 14, textAlign: "center" }}>Use your work or personal account.</p>
      <div style={{ width: "100%", display: "flex", flexDirection: "column", gap: 10 }}>
        {providers.map(p => (
          <button key={p.id} onClick={() => { setLoading(p.id); setTimeout(() => { setLoading(null); onSignIn(); }, 1600); }} disabled={!!loading}
            style={{ width: "100%", display: "flex", alignItems: "center", justifyContent: "center", gap: 12, padding: "13px 20px", borderRadius: 14, border: `1.5px solid ${LINE}`, background: CARD, color: INK, fontSize: 14, fontWeight: 600, cursor: "pointer", opacity: loading && loading !== p.id ? 0.45 : 1, fontFamily: "inherit" }}>
            {loading === p.id ? <span style={{ color: G, fontSize: 13 }}>Connecting…</span> : <>{p.logo}{p.label}</>}
          </button>
        ))}
      </div>
      <div style={{ marginTop: 28, display: "flex", alignItems: "center", gap: 6, color: DIM, fontSize: 12 }}>
        <Ico d={ic.shield} size={13} color={DIM} /> Secured with SSO — no password required
      </div>
      <p style={{ color: DIM, fontSize: 12, marginTop: 20, textAlign: "center", lineHeight: 1.6 }}>
        By signing in you agree to our <span style={{ color: G, cursor: "pointer" }}>Terms</span> and <span style={{ color: G, cursor: "pointer" }}>Privacy Policy</span>.
      </p>
    </div>
  );
}

// ── App ────────────────────────────────────────────────────────────────────
export default function App() {
  const [authed, setAuthed] = useState(false);
  const [tab, setTab] = useState("upload");
  const [badge, setBadge] = useState(2);
  const [notifs, setNotifs] = useState(false);

  const submit = () => { setBadge(b => b + 1); setTimeout(() => setTab("posts"), 900); };

  const shell = { fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif", color: INK };

  if (!authed) return (
    <div style={{ ...shell, width: "100%", maxWidth: 430, margin: "0 auto", height: "100vh", display: "flex", flexDirection: "column", background: BG, overflow: "hidden" }}>
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
    <div style={{ ...shell, width: "100%", maxWidth: 430, margin: "0 auto", height: "100vh", display: "flex", flexDirection: "column", background: BG, overflow: "hidden", position: "relative" }}>
      {notifs && <NotifsPanel onClose={() => setNotifs(false)} />}

      {/* Header */}
      <div style={{ padding: "12px 20px", display: "flex", justifyContent: "space-between", alignItems: "center", borderBottom: `1px solid ${LINE}`, background: CARD }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <div style={{ width: 30, height: 30, borderRadius: 9, background: DARK, display: "flex", alignItems: "center", justifyContent: "center" }}>
            <GeckoMark size={22} color={G} />
          </div>
          <span style={{ fontWeight: 900, fontSize: 16, letterSpacing: "-0.4px" }}>
            <span style={{ color: G }}>WEB</span><span style={{ color: INK }}>GECKO</span>
          </span>
        </div>
        <button onClick={() => setNotifs(true)} style={{ background: "none", border: "none", cursor: "pointer", padding: 4, position: "relative" }}>
          <Ico d={ic.bell} size={22} color={INK} />
          <span style={{ position: "absolute", top: 2, right: 2, width: 8, height: 8, borderRadius: "50%", background: G }} />
        </button>
      </div>

      <div style={{ flex: 1, overflowY: "auto", padding: "20px 20px 0" }}>
        {screens[tab]}
      </div>

      <Nav active={tab} onChange={setTab} badge={badge} />
    </div>
  );
}
