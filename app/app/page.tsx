"use client";
import { useState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { supabasePublic } from "@/lib/supabase";

const CSS = `
  @import url('https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700;800&family=Outfit:wght@400;600;700;800;900&display=swap');
  
  *, *::before, *::after {
    box-sizing: border-box;
    margin: 0;
    padding: 0;
  }
  
  body {
    background: #040814;
    color: #f3f4f6;
    font-family: 'Inter', -apple-system, sans-serif;
    min-height: 100vh;
    overflow-x: hidden;
  }

  .glass-card {
    background: rgba(13, 20, 38, 0.6);
    backdrop-filter: blur(16px);
    -webkit-backdrop-filter: blur(16px);
    border: 1px solid rgba(255, 255, 255, 0.06);
    border-radius: 16px;
    box-shadow: 0 16px 36px rgba(0, 0, 0, 0.5), inset 0 1px 0 rgba(255, 255, 255, 0.04);
  }

  .nav-blur {
    background: rgba(4, 8, 20, 0.85);
    backdrop-filter: blur(12px);
    -webkit-backdrop-filter: blur(12px);
    border-top: 1px solid rgba(255, 255, 255, 0.06);
  }

  input, textarea, select {
    transition: all 0.2s ease;
  }

  input:focus, textarea:focus, select:focus {
    outline: none;
    border-color: #8b5cf6 !important;
    box-shadow: 0 0 0 3px rgba(139, 92, 246, 0.15) !important;
  }

  .pulse-btn {
    animation: pulseGlow 2s infinite;
  }

  @keyframes pulseGlow {
    0% { box-shadow: 0 0 0 0 rgba(239, 68, 68, 0.4); }
    70% { box-shadow: 0 0 0 12px rgba(239, 68, 68, 0); }
    100% { box-shadow: 0 0 0 0 rgba(239, 68, 68, 0); }
  }

  .fade-in {
    animation: fadeIn 0.3s ease forwards;
  }

  @keyframes fadeIn {
    from { opacity: 0; transform: translateY(8px); }
    to { opacity: 1; transform: translateY(0); }
  }

  /* Custom audio waveform keyframes */
  @keyframes audioBar {
    0%, 100% { height: 4px; }
    50% { height: 28px; }
  }

  .audio-wave-bar {
    width: 3px;
    height: 10px;
    background: #8b5cf6;
    border-radius: 2px;
    animation: audioBar 1.2s ease-in-out infinite;
  }
`;

export default function SocialApp() {
  const router = useRouter();
  
  // ── Authentication State ───────────────────────────────────────────────────
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [authLoading, setAuthLoading] = useState(true);
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [loginError, setLoginError] = useState("");
  const [loginLoading, setLoginLoading] = useState(false);
  const [client, setClient] = useState<any>(null);
  
  // ── App Core State ─────────────────────────────────────────────────────────
  const [activeTab, setActiveTab] = useState<"create" | "review" | "calendar" | "billing" | "stats" | "profile">("create");
  
  // ── Create Post Screen Inputs ──────────────────────────────────────────────
  const [brief, setBrief] = useState("");
  const [tone, setTone] = useState("friendly");
  const [selectedPlatforms, setSelectedPlatforms] = useState<string[]>(["instagram", "facebook"]);
  const [files, setFiles] = useState<File[]>([]);
  const [previewUrls, setPreviewUrls] = useState<string[]>([]);
  
  // ── Voiceover Recording & Transcription State ──────────────────────────────
  const [isRecording, setIsRecording] = useState(false);
  const [voiceBlob, setVoiceBlob] = useState<Blob | null>(null);
  const [voiceUrl, setVoiceUrl] = useState<string>("");
  const [voiceTranscript, setVoiceTranscript] = useState("");
  const [speechSupported, setSpeechSupported] = useState(false);
  
  // ── Generation Drafts State ────────────────────────────────────────────────
  const [isGenerating, setIsGenerating] = useState(false);
  const [drafts, setDrafts] = useState<any[]>([]);
  const [generatedMediaUrls, setGeneratedMediaUrls] = useState<string[]>([]);
  const [approving, setApproving] = useState(false);
  const [approvalSuccess, setApprovalSuccess] = useState(false);
  
  // ── Database Data States ───────────────────────────────────────────────────
  const [payments, setPayments] = useState<any[]>([]);
  const [approvedPosts, setApprovedPosts] = useState<any[]>([]);
  
  // ── Canvas Confetti & Audio Ref ────────────────────────────────────────────
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const audioCtxRef = useRef<AudioContext | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const recognitionRef = useRef<any>(null);
  const recordingAnimFrame = useRef<number>(0);
  const micStreamRef = useRef<MediaStream | null>(null);

  // 1. Initial Authentication Check
  useEffect(() => {
    async function checkAuth() {
      const savedSlug = localStorage.getItem("wg_app_slug");
      if (savedSlug) {
        try {
          const res = await fetch(`/api/client-login?slug=${savedSlug}`);
          if (res.ok) {
            const data = await res.json();
            setClient(data);
            setIsAuthenticated(true);
            await fetchClientDbData(savedSlug, data.job_id);
          } else {
            localStorage.removeItem("wg_app_slug");
          }
        } catch {
          localStorage.removeItem("wg_app_slug");
        }
      }
      setAuthLoading(false);
    }
    checkAuth();
  }, []);

  // Fetch billing & approved post history from Supabase Public
  async function fetchClientDbData(slug: string, jobId: string) {
    try {
      // 1. Fetch payments
      const { data: payData } = await supabasePublic
        .from("payments")
        .select("*")
        .eq("client_slug", slug)
        .order("created_at", { ascending: false });
      if (payData) setPayments(payData);

      // 2. Fetch approved posts from job metadata
      if (jobId) {
        const { data: jobRow } = await supabasePublic
          .from("jobs")
          .select("metadata")
          .eq("id", jobId)
          .single();
        if (jobRow?.metadata?.approvedPosts) {
          setApprovedPosts(jobRow.metadata.approvedPosts.reverse());
        }
      }
    } catch (e) {
      console.warn("Error fetching client database history:", e);
    }
  }

  // 2. Browser Speech Recognition Init
  useEffect(() => {
    if (typeof window !== "undefined") {
      const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
      if (SpeechRecognition) {
        setSpeechSupported(true);
        const recognition = new SpeechRecognition();
        recognition.continuous = true;
        recognition.interimResults = true;
        recognition.lang = "en-AU";

        recognition.onresult = (event: any) => {
          let interimTranscript = "";
          let finalTranscript = "";
          for (let i = event.resultIndex; i < event.results.length; ++i) {
            if (event.results[i].isFinal) {
              finalTranscript += event.results[i][0].transcript;
            } else {
              interimTranscript += event.results[i][0].transcript;
            }
          }
          if (finalTranscript || interimTranscript) {
            setVoiceTranscript((prev) => prev + " " + (finalTranscript || interimTranscript));
          }
        };
        recognitionRef.current = recognition;
      }
    }
  }, []);

  // ── AUTHENTICATION FLOW ────────────────────────────────────────────────────
  async function handleLogin(e: React.FormEvent) {
    e.preventDefault();
    setLoginError("");
    setLoginLoading(true);
    try {
      const res = await fetch("/api/client-login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username: username.trim(), password: password.trim() }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Credentials incorrect");
      
      localStorage.setItem("wg_app_slug", data.slug);
      
      const portalRes = await fetch(`/api/client-login?slug=${data.slug}`);
      const portalData = await portalRes.json();
      setClient(portalData);
      setIsAuthenticated(true);
      await fetchClientDbData(data.slug, portalData.job_id);
    } catch (err: any) {
      setLoginError(err.message || "Failed to authenticate");
    } finally {
      setLoginLoading(false);
    }
  }

  function handleLogout() {
    localStorage.removeItem("wg_app_slug");
    setIsAuthenticated(false);
    setClient(null);
    setActiveTab("create");
  }

  // ── FILE CAPTURE HANDLERS ──────────────────────────────────────────────────
  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const picked = Array.from(e.target.files || []);
    setFiles((prev) => [...prev, ...picked].slice(0, 5));
    const urls = picked.map((f) => URL.createObjectURL(f));
    setPreviewUrls((prev) => [...prev, ...urls].slice(0, 5));
  }

  function removeFile(index: number) {
    setFiles((prev) => prev.filter((_, i) => i !== index));
    setPreviewUrls((prev) => prev.filter((_, i) => i !== index));
  }

  // ── MICROPHONE & VOICE RECORDING FLOW ──────────────────────────────────────
  async function startRecording() {
    setVoiceTranscript("");
    setVoiceBlob(null);
    setVoiceUrl("");
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      micStreamRef.current = stream;
      setIsRecording(true);

      // Web Audio API Visualizer Setup
      const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
      if (AudioCtx) {
        const audioCtx = new AudioCtx();
        const source = audioCtx.createMediaStreamSource(stream);
        const analyser = audioCtx.createAnalyser();
        analyser.fftSize = 64;
        source.connect(analyser);
        audioCtxRef.current = audioCtx;
        analyserRef.current = analyser;
        drawVisualWave();
      }

      // Speech Recognition Start
      if (recognitionRef.current) {
        recognitionRef.current.start();
      }

      const recorder = new MediaRecorder(stream);
      const chunks: Blob[] = [];
      recorder.ondataavailable = (e) => {
        if (e.data && e.data.size > 0) chunks.push(e.data);
      };
      recorder.onstop = () => {
        const blob = new Blob(chunks, { type: "audio/wav" });
        setVoiceBlob(blob);
        setVoiceUrl(URL.createObjectURL(blob));
      };

      mediaRecorderRef.current = recorder;
      recorder.start();
    } catch (e) {
      alert("Microphone permission denied or not found");
      setIsRecording(false);
    }
  }

  function stopRecording() {
    setIsRecording(false);
    if (mediaRecorderRef.current) {
      mediaRecorderRef.current.stop();
    }
    if (recognitionRef.current) {
      recognitionRef.current.stop();
    }
    if (micStreamRef.current) {
      micStreamRef.current.getTracks().forEach((track) => track.stop());
    }
    cancelAnimationFrame(recordingAnimFrame.current);
    if (audioCtxRef.current) {
      audioCtxRef.current.close();
    }
  }

  function drawVisualWave() {
    const analyser = analyserRef.current;
    if (!analyser) return;
    const bufferLength = analyser.frequencyBinCount;
    const dataArray = new Uint8Array(bufferLength);
    
    const draw = () => {
      recordingAnimFrame.current = requestAnimationFrame(draw);
      analyser.getByteFrequencyData(dataArray);
      
      const bars = document.querySelectorAll(".visualizer-bar");
      if (bars.length > 0) {
        bars.forEach((bar: any, index) => {
          if (dataArray[index] !== undefined) {
            const height = Math.max(4, (dataArray[index] / 255) * 40);
            bar.style.height = `${height}px`;
          }
        });
      }
    };
    draw();
  }

  // ── UPLOAD & AI DRAFTING FLOW ──────────────────────────────────────────────
  async function handleSubmitBrief() {
    if (!brief.trim() && !voiceTranscript.trim() && files.length === 0) {
      alert("Please upload a file, write a description, or record a voiceover.");
      return;
    }
    setIsGenerating(true);
    setDrafts([]);
    
    try {
      const fd = new FormData();
      fd.append("slug", client.slug);
      fd.append("brief", brief);
      fd.append("tone", tone);
      fd.append("platforms", JSON.stringify(selectedPlatforms));
      fd.append("voiceTranscript", voiceTranscript);

      files.forEach((f) => fd.append("files", f));
      if (voiceBlob) {
        fd.append("voiceover", voiceBlob, "voiceover.wav");
      }

      const res = await fetch("/api/client/social-upload-app", {
        method: "POST",
        body: fd,
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Generation failed");

      setDrafts(data.drafts);
      setGeneratedMediaUrls(data.mediaUrls);
      setActiveTab("review");
    } catch (e: any) {
      alert("Error generating drafts: " + e.message);
    } finally {
      setIsGenerating(false);
    }
  }

  // ── APPROVAL & CHECKOUT FLOW ────────────────────────────────────────────────
  async function handleApprovePost() {
    setApproving(true);
    try {
      const payload = {
        slug: client.slug,
        posts: drafts.map((d) => ({
          platform: d.platform,
          caption: d.caption,
          hashtags: d.hashtags,
          scheduledAt: d.scheduledAt,
          mediaUrls: generatedMediaUrls,
        })),
      };

      const res = await fetch("/api/client/social-approve", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Approval failed");

      setApprovalSuccess(true);
      triggerConfetti();

      // Refresh listings
      await fetchClientDbData(client.slug, client.job_id);

      setTimeout(() => {
        setApprovalSuccess(false);
        setBrief("");
        setFiles([]);
        setPreviewUrls([]);
        setVoiceBlob(null);
        setVoiceUrl("");
        setVoiceTranscript("");
        setDrafts([]);
        setActiveTab("calendar");
      }, 4000);

    } catch (e: any) {
      alert("Failed to register post: " + e.message);
    } finally {
      setApproving(false);
    }
  }

  function handleDraftCaptionChange(index: number, val: string) {
    const updated = [...drafts];
    updated[index].caption = val;
    setDrafts(updated);
  }

  // Confetti Blast Animation (Canvas-based)
  function triggerConfetti() {
    const canvas = canvasRef.current;
    if (!canvas) return;
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const colors = ["#8b5cf6", "#a78bfa", "#10b981", "#3b82f6", "#f59e0b", "#ef4444"];
    const pieces: any[] = [];
    for (let i = 0; i < 120; i++) {
      pieces.push({
        x: Math.random() * canvas.width,
        y: canvas.height + 20,
        vx: (Math.random() - 0.5) * 8,
        vy: -Math.random() * 15 - 10,
        size: Math.random() * 8 + 4,
        color: colors[Math.floor(Math.random() * colors.length)],
        rotation: Math.random() * 360,
        rSpeed: Math.random() * 4 - 2,
      });
    }

    const animate = () => {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      let active = false;
      pieces.forEach((p) => {
        p.x += p.vx;
        p.y += p.vy;
        p.vy += 0.35; // Gravity
        p.rotation += p.rSpeed;

        ctx.save();
        ctx.translate(p.x, p.y);
        ctx.rotate((p.rotation * Math.PI) / 180);
        ctx.fillStyle = p.color;
        ctx.fillRect(-p.size / 2, -p.size / 2, p.size, p.size);
        ctx.restore();

        if (p.y < canvas.height + 20) active = true;
      });

      if (active) {
        requestAnimationFrame(animate);
      } else {
        ctx.clearRect(0, 0, canvas.width, canvas.height);
      }
    };
    animate();
  }

  // Helper formatting dates
  const formatDate = (iso: string) => {
    return new Date(iso).toLocaleDateString("en-AU", {
      weekday: "short",
      day: "numeric",
      month: "short",
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  if (authLoading) {
    return (
      <div style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", background: "#040814" }}>
        <div style={{ width: 40, height: 40, border: "3px solid rgba(139,92,246,0.1)", borderTopColor: "#8b5cf6", borderRadius: "50%", animation: "audioBar 1s linear infinite" }} />
      </div>
    );
  }

  // ───────────────────────────────────────────────────────────────────────────
  // LOGIN PORTAL VIEW
  // ───────────────────────────────────────────────────────────────────────────
  if (!isAuthenticated) {
    return (
      <div style={{
        minHeight: "100vh",
        background: "#040814",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        padding: "24px",
        position: "relative",
        overflow: "hidden",
      }}>
        <style>{CSS}</style>

        {/* Backdrop visual elements */}
        <div style={{ position: "absolute", top: "15%", left: "50%", transform: "translateX(-50%)", width: 600, height: 400, background: "radial-gradient(ellipse, rgba(139,92,246,0.08) 0%, transparent 70%)", pointerEvents: "none" }} />
        <div style={{ position: "absolute", bottom: "10%", left: "10%", width: 300, height: 300, background: "radial-gradient(circle, rgba(16,185,129,0.04) 0%, transparent 70%)", pointerEvents: "none" }} />

        <div className="glass-card" style={{ width: "100%", maxWidth: 400, padding: "36px 28px", zIndex: 1 }}>
          <div style={{ textAlign: "center", marginBottom: 28 }}>
            <div style={{ fontSize: 44, marginBottom: 12 }}>🦎</div>
            <h1 style={{ fontFamily: "'Outfit', sans-serif", fontSize: 24, fontWeight: 800, letterSpacing: "-0.03em", marginBottom: 4 }}>WebGecko</h1>
            <p style={{ fontSize: 13, color: "#9ca3af" }}>Social Poster Companion App</p>
          </div>

          <form onSubmit={handleLogin} style={{ display: "flex", flexDirection: "column", gap: 16 }}>
            {loginError && (
              <div style={{ background: "rgba(239, 68, 68, 0.1)", border: "1px solid rgba(239, 68, 68, 0.2)", borderRadius: 10, padding: "10px 14px", color: "#f87171", fontSize: 13 }}>
                {loginError}
              </div>
            )}

            <div>
              <label style={{ display: "block", fontSize: 11, fontWeight: 700, color: "#9ca3af", textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 6 }}>Username / business name</label>
              <input
                type="text"
                required
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                placeholder="your-business-name"
                style={{ width: "100%", background: "#0b1226", border: "1px solid rgba(255,255,255,0.08)", borderRadius: 10, padding: "11px 14px", color: "#fff", fontSize: 14 }}
              />
            </div>

            <div>
              <label style={{ display: "block", fontSize: 11, fontWeight: 700, color: "#9ca3af", textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 6 }}>Password</label>
              <input
                type="password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                style={{ width: "100%", background: "#0b1226", border: "1px solid rgba(255,255,255,0.08)", borderRadius: 10, padding: "11px 14px", color: "#fff", fontSize: 14 }}
              />
            </div>

            <button
              type="submit"
              disabled={loginLoading}
              style={{
                width: "100%",
                background: "linear-gradient(135deg, #8b5cf6, #7c3aed)",
                color: "#fff",
                border: "none",
                borderRadius: 10,
                padding: "13px",
                fontSize: 14,
                fontWeight: 700,
                cursor: loginLoading ? "not-allowed" : "pointer",
                boxShadow: "0 4px 20px rgba(139, 92, 246, 0.25)",
                marginTop: 8,
              }}
            >
              {loginLoading ? "Authenticating..." : "Sign In to App →"}
            </button>
          </form>

          <div style={{ marginTop: 24, paddingTop: 16, borderTop: "1px solid rgba(255,255,255,0.06)", textAlign: "center", fontSize: 11, color: "#6b7280", lineHeight: 1.6 }}>
            Use the credentials sent to you in your project onboarding email.
          </div>
        </div>
      </div>
    );
  }

  // ───────────────────────────────────────────────────────────────────────────
  // COMPANION APP MAIN VIEW
  // ───────────────────────────────────────────────────────────────────────────
  return (
    <div style={{ minHeight: "100vh", display: "flex", flexDirection: "column", background: "#040814", position: "relative" }}>
      <style>{CSS}</style>
      <canvas ref={canvasRef} style={{ position: "fixed", top: 0, left: 0, width: "100vw", height: "100vh", pointerEvents: "none", zIndex: 99 }} />

      {/* Header */}
      <header className="glass-card" style={{ borderRadius: 0, borderLeft: "none", borderRight: "none", borderTop: "none", padding: "14px 20px", display: "flex", justifyContent: "space-between", alignItems: "center", position: "sticky", top: 0, zIndex: 10 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <div style={{ fontSize: 28 }}>🦎</div>
          <div>
            <div style={{ fontFamily: "'Outfit', sans-serif", fontSize: 16, fontWeight: 800, letterSpacing: "-0.02em" }}>WebGecko</div>
            <div style={{ fontSize: 10, color: "#8b5cf6", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.05em" }}>Social App</div>
          </div>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <div style={{ textAlign: "right" }}>
            <div style={{ fontSize: 12, fontWeight: 700 }}>{client?.business_name || client?.slug}</div>
            <div style={{ fontSize: 9, color: "#10b981", fontWeight: 600 }}>Active Posting Plan</div>
          </div>
          <div style={{ width: 34, height: 34, borderRadius: "50%", background: "linear-gradient(135deg, #8b5cf6, #3b82f6)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 14, fontWeight: 800, color: "#fff" }}>
            {client?.business_name?.[0]?.toUpperCase() || "C"}
          </div>
        </div>
      </header>

      {/* Scrollable Content Body */}
      <main style={{ flex: 1, padding: "20px 16px 88px", maxWidth: 680, width: "100%", margin: "0 auto" }} className="fade-in">
        
        {/* ── CREATE POST TAB ── */}
        {activeTab === "create" && (
          <div style={{ display: "flex", flexDirection: "column", gap: 18 }}>
            
            {/* Camera / File Uploader Component */}
            <div className="glass-card" style={{ padding: 20 }}>
              <div style={{ fontSize: 11, fontWeight: 700, color: "#9ca3af", textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: 12 }}>Upload Media</div>
              
              <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                <label style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 10, padding: "28px 16px", background: "rgba(13,20,38,0.4)", border: "2px dashed rgba(139,92,246,0.3)", borderRadius: 12, cursor: "pointer", textAlign: "center" }}>
                  <input type="file" accept="image/*,video/*" multiple onChange={handleFileChange} style={{ display: "none" }} />
                  <div style={{ fontSize: 32 }}>📸</div>
                  <div>
                    <div style={{ fontSize: 14, fontWeight: 700, color: "#a78bfa" }}>Take Photo/Video or Browse</div>
                    <div style={{ fontSize: 11, color: "#6b7280", marginTop: 4 }}>Supports photos and video clips up to 50MB</div>
                  </div>
                </label>

                {previewUrls.length > 0 && (
                  <div style={{ display: "grid", gridTemplateColumns: "repeat(5, 1fr)", gap: 8, marginTop: 4 }}>
                    {previewUrls.map((url, idx) => (
                      <div key={url} style={{ position: "relative", aspectRatio: "1/1", borderRadius: 8, overflow: "hidden", border: "1px solid rgba(255,255,255,0.1)" }}>
                        <img src={url} alt="preview" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                        <button onClick={() => removeFile(idx)} style={{ position: "absolute", top: 2, right: 2, background: "rgba(0,0,0,0.7)", border: "none", borderRadius: "50%", width: 18, height: 18, color: "#fff", fontSize: 10, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center" }}>×</button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>

            {/* Voiceover Recorder Component */}
            <div className="glass-card" style={{ padding: 20 }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
                <div style={{ fontSize: 11, fontWeight: 700, color: "#9ca3af", textTransform: "uppercase", letterSpacing: "0.08em" }}>Add Voiceover Instruction</div>
                {speechSupported && <span style={{ fontSize: 10, color: "#10b981", background: "rgba(16,185,129,0.1)", padding: "2px 8px", borderRadius: 20, fontWeight: 600 }}>Real-time Text Sync</span>}
              </div>

              <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
                  {isRecording ? (
                    <button onClick={stopRecording} className="pulse-btn" style={{ background: "#ef4444", border: "none", color: "#fff", padding: "10px 20px", borderRadius: 30, fontSize: 12, fontWeight: 700, display: "flex", alignItems: "center", gap: 8, cursor: "pointer" }}>
                      <span style={{ width: 8, height: 8, background: "#fff", borderRadius: "50%", display: "inline-block" }} />
                      Stop Recording
                    </button>
                  ) : (
                    <button onClick={startRecording} style={{ background: "linear-gradient(135deg, #8b5cf6, #7c3aed)", border: "none", color: "#fff", padding: "10px 20px", borderRadius: 30, fontSize: 12, fontWeight: 700, display: "flex", alignItems: "center", gap: 8, cursor: "pointer" }}>
                      <span style={{ fontSize: 14 }}>🎤</span>
                      Record Voiceover
                    </button>
                  )}

                  {/* Active Visualizer Wave */}
                  {isRecording && (
                    <div style={{ display: "flex", alignItems: "center", gap: 3, height: 40, flex: 1, justifyContent: "center" }}>
                      {Array.from({ length: 15 }).map((_, i) => (
                        <div key={i} className="visualizer-bar" style={{ width: 3, height: 6, background: "linear-gradient(to top, #8b5cf6, #a78bfa)", borderRadius: 2, transition: "height 0.1s ease" }} />
                      ))}
                    </div>
                  )}
                </div>

                {voiceUrl && (
                  <div style={{ background: "rgba(13,20,38,0.4)", border: "1px solid rgba(255,255,255,0.06)", borderRadius: 10, padding: 12 }}>
                    <div style={{ fontSize: 12, fontWeight: 600, color: "#a78bfa", marginBottom: 6 }}>Voiceover Preview</div>
                    <audio src={voiceUrl} controls style={{ width: "100%", height: 32 }} />
                  </div>
                )}

                {voiceTranscript && (
                  <div>
                    <label style={{ display: "block", fontSize: 11, color: "#9ca3af", marginBottom: 6, fontWeight: 600 }}>Transcribed text (Auto-generated):</label>
                    <textarea
                      value={voiceTranscript}
                      onChange={(e) => setVoiceTranscript(e.target.value)}
                      style={{ width: "100%", minHeight: 60, background: "#0b1226", border: "1px solid rgba(255,255,255,0.08)", borderRadius: 10, padding: "10px 12px", color: "#d1d5db", fontSize: 12, resize: "vertical", fontFamily: "inherit", lineHeight: 1.5 }}
                    />
                  </div>
                )}
              </div>
            </div>

            {/* Description Text & Settings Component */}
            <div className="glass-card" style={{ padding: 20 }}>
              <div style={{ fontSize: 11, fontWeight: 700, color: "#9ca3af", textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: 12 }}>Write Post Brief</div>
              
              <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
                <textarea
                  value={brief}
                  onChange={(e) => setBrief(e.target.value)}
                  rows={4}
                  placeholder="Tell the AI what this post is about... (e.g. Roof restoration job we did today, 10% off for new clients in June)"
                  style={{ width: "100%", background: "#0b1226", border: "1px solid rgba(255,255,255,0.08)", borderRadius: 10, padding: "12px 14px", color: "#fff", fontSize: 13, resize: "vertical", fontFamily: "inherit", lineHeight: 1.6 }}
                />

                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
                  <div>
                    <label style={{ display: "block", fontSize: 11, color: "#9ca3af", marginBottom: 6, fontWeight: 600 }}>Tone of voice</label>
                    <select value={tone} onChange={(e) => setTone(e.target.value)} style={{ width: "100%", background: "#0b1226", border: "1px solid rgba(255,255,255,0.08)", borderRadius: 10, padding: "10px 12px", color: "#fff", fontSize: 13 }}>
                      <option value="friendly">Friendly & Warm</option>
                      <option value="professional">Professional & Brand-focused</option>
                      <option value="casual">Casual & Conversational</option>
                      <option value="promotional">Excited & Promotional</option>
                    </select>
                  </div>
                  <div>
                    <label style={{ display: "block", fontSize: 11, color: "#9ca3af", marginBottom: 6, fontWeight: 600 }}>Billing Estimate</label>
                    <div style={{ display: "flex", alignItems: "center", background: "rgba(139,92,246,0.06)", border: "1px solid rgba(139,92,246,0.2)", borderRadius: 10, padding: "10px 12px", height: 40 }}>
                      <span style={{ fontSize: 16, marginRight: 6 }}>💰</span>
                      <span style={{ fontSize: 13, fontWeight: 700, color: "#a78bfa" }}>$100 Flat Fee</span>
                    </div>
                  </div>
                </div>

                <div>
                  <label style={{ display: "block", fontSize: 11, color: "#9ca3af", marginBottom: 8, fontWeight: 600 }}>Post to platforms</label>
                  <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
                    {["instagram", "facebook", "linkedin", "tiktok", "x"].map((p) => {
                      const active = selectedPlatforms.includes(p);
                      const platformColors: Record<string, string> = { instagram: "#e1306c", facebook: "#1877f2", linkedin: "#0a66c2", tiktok: "#ff0050", x: "#1da1f2" };
                      const col = platformColors[p] || "#8b5cf6";
                      return (
                        <button key={p} onClick={() => setSelectedPlatforms(prev => active ? prev.filter(x => x !== p) : [...prev, p])}
                          style={{ display: "flex", alignItems: "center", gap: 6, background: active ? `${col}18` : "rgba(255,255,255,0.03)", border: `1px solid ${active ? col : "rgba(255,255,255,0.08)"}`, borderRadius: 20, padding: "6px 14px", fontSize: 12, fontWeight: 600, color: active ? col : "#9ca3af", cursor: "pointer", transition: "all 0.2s ease" }}>
                          <span style={{ textTransform: "capitalize" }}>{p}</span>
                          {active && <span>✓</span>}
                        </button>
                      );
                    })}
                  </div>
                </div>
              </div>
            </div>

            {/* AI Generator Trigger */}
            <button
              onClick={handleSubmitBrief}
              disabled={isGenerating || (!brief.trim() && !voiceTranscript.trim() && files.length === 0)}
              style={{
                background: "linear-gradient(135deg, #8b5cf6, #7c3aed)",
                color: "#fff",
                border: "none",
                borderRadius: 12,
                padding: "16px",
                fontSize: 14,
                fontWeight: 700,
                cursor: (isGenerating || (!brief.trim() && !voiceTranscript.trim() && files.length === 0)) ? "not-allowed" : "pointer",
                boxShadow: "0 6px 24px rgba(139, 92, 246, 0.3)",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                gap: 10,
              }}
            >
              {isGenerating ? (
                <>
                  <div style={{ width: 16, height: 16, border: "2px solid rgba(255,255,255,0.2)", borderTopColor: "#fff", borderRadius: "50%", animation: "audioBar 1s linear infinite" }} />
                  AI Writing Post Captions...
                </>
              ) : (
                <>
                  <span>🚀</span>
                  Generate Post Drafts
                </>
              )}
            </button>
          </div>
        )}

        {/* ── REVIEW DRAFTS TAB ── */}
        {activeTab === "review" && (
          <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <div>
                <h2 style={{ fontFamily: "'Outfit', sans-serif", fontSize: 18, fontWeight: 800 }}>Review Generated Drafts</h2>
                <p style={{ fontSize: 12, color: "#9ca3af", marginTop: 2 }}>Edit captions directly in the mockups below</p>
              </div>
              <button onClick={() => setActiveTab("create")} style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.08)", color: "#9ca3af", borderRadius: 8, padding: "6px 12px", fontSize: 11, cursor: "pointer" }}>← Create Tab</button>
            </div>

            {drafts.length === 0 ? (
              <div className="glass-card" style={{ padding: 40, textAlign: "center" }}>
                <div style={{ fontSize: 32, marginBottom: 12 }}>✍️</div>
                <div style={{ fontSize: 14, fontWeight: 700, color: "#fff", marginBottom: 6 }}>No active drafts to review</div>
                <p style={{ fontSize: 12, color: "#6b7280", maxWidth: 280, margin: "0 auto" }}>Go back to the Create tab to upload media and generate post drafts first.</p>
              </div>
            ) : (
              <>
                <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
                  {drafts.map((post, idx) => {
                    const avatarInit = client?.business_name?.[0]?.toUpperCase() || "C";
                    return (
                      <div key={post.platform} className="glass-card" style={{ overflow: "hidden" }}>
                        {/* Mock header */}
                        <div style={{ display: "flex", alignItems: "center", gap: 10, padding: 12, borderBottom: "1px solid rgba(255,255,255,0.06)" }}>
                          <div style={{ width: 28, height: 28, borderRadius: "50%", background: "linear-gradient(135deg, #8b5cf6, #3b82f6)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 11, fontWeight: 800, color: "#fff" }}>{avatarInit}</div>
                          <div>
                            <div style={{ fontSize: 12, fontWeight: 700 }}>{client?.business_name || client?.slug}</div>
                            <div style={{ fontSize: 9, color: "#8b5cf6", textTransform: "capitalize", fontWeight: 700 }}>{post.platform} Mockup</div>
                          </div>
                        </div>

                        {/* Image Preview Block */}
                        {previewUrls.length > 0 && (
                          <div style={{ aspectRatio: "1.91/1", width: "100%", overflow: "hidden", background: "#0b1226", borderBottom: "1px solid rgba(255,255,255,0.06)" }}>
                            <img src={previewUrls[0]} alt="post" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                          </div>
                        )}

                        {/* Caption input block */}
                        <div style={{ padding: 14 }}>
                          <textarea
                            value={post.caption}
                            onChange={(e) => handleDraftCaptionChange(idx, e.target.value)}
                            style={{ width: "100%", minHeight: 80, background: "transparent", border: "none", color: "#e5e7eb", fontSize: 13, resize: "none", fontFamily: "inherit", lineHeight: 1.5 }}
                          />
                          <div style={{ display: "flex", flexWrap: "wrap", gap: 4, marginTop: 10, borderTop: "1px solid rgba(255,255,255,0.04)", paddingTop: 10 }}>
                            {post.hashtags?.map((tag: string) => (
                              <span key={tag} style={{ fontSize: 11, color: "#8b5cf6", fontWeight: 500 }}>{tag}</span>
                            ))}
                          </div>
                          <div style={{ fontSize: 10, color: "#6b7280", marginTop: 8 }}>
                            Best posting slot: {formatDate(post.scheduledAt)}
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>

                {/* Confirm Approval section */}
                <div className="glass-card" style={{ padding: 20, border: "1px solid rgba(139,92,246,0.3)" }}>
                  {approvalSuccess ? (
                    <div style={{ textAlign: "center", padding: "12px 0" }}>
                      <div style={{ fontSize: 36, marginBottom: 8 }}>🎉</div>
                      <div style={{ fontSize: 16, fontWeight: 800, color: "#10b981", marginBottom: 4 }}>Post Approved & Queued!</div>
                      <p style={{ fontSize: 12, color: "#9ca3af" }}>Billing of $100.00 flat-fee has been logged to your account.</p>
                    </div>
                  ) : (
                    <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                        <div>
                          <div style={{ fontSize: 11, fontWeight: 700, color: "#9ca3af", textTransform: "uppercase" }}>Charge Summary</div>
                          <div style={{ fontSize: 14, fontWeight: 700, color: "#fff", marginTop: 2 }}>Social Media Posting Charge</div>
                        </div>
                        <div style={{ fontSize: 18, fontWeight: 800, color: "#10b981" }}>$100.00 AUD</div>
                      </div>
                      <button
                        onClick={handleApprovePost}
                        disabled={approving}
                        style={{
                          width: "100%",
                          background: approving ? "rgba(16,185,129,0.5)" : "linear-gradient(135deg, #10b981, #059669)",
                          color: "#fff",
                          border: "none",
                          borderRadius: 10,
                          padding: "14px",
                          fontSize: 14,
                          fontWeight: 700,
                          cursor: approving ? "not-allowed" : "pointer",
                          boxShadow: "0 4px 16px rgba(16, 185, 129, 0.25)",
                        }}
                      >
                        {approving ? "Registering Approval..." : "Approve & Publish ($100)"}
                      </button>
                    </div>
                  )}
                </div>
              </>
            )}
          </div>
        )}

        {/* ── CALENDAR TAB ── */}
        {activeTab === "calendar" && (
          <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
            <div>
              <h2 style={{ fontFamily: "'Outfit', sans-serif", fontSize: 18, fontWeight: 800 }}>Social Posting Queue</h2>
              <p style={{ fontSize: 12, color: "#9ca3af", marginTop: 2 }}>History of approved and scheduled platform posts</p>
            </div>

            {approvedPosts.length === 0 ? (
              <div className="glass-card" style={{ padding: 40, textAlign: "center" }}>
                <div style={{ fontSize: 32, marginBottom: 12 }}>📅</div>
                <div style={{ fontSize: 14, fontWeight: 700, color: "#fff", marginBottom: 6 }}>No posts scheduled yet</div>
                <p style={{ fontSize: 12, color: "#6b7280" }}>Approved posts will appear here once you approve drafts.</p>
              </div>
            ) : (
              <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                {approvedPosts.map((post: any) => (
                  <div key={post.id || post.approvedAt} className="glass-card" style={{ padding: 14 }}>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 8 }}>
                      <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                        <span style={{ fontSize: 15 }}>📱</span>
                        <span style={{ fontSize: 12, fontWeight: 700, textTransform: "capitalize" }}>{post.platform}</span>
                        <span style={{ fontSize: 10, padding: "2px 8px", background: "rgba(16,185,129,0.1)", border: "1px solid rgba(16,185,129,0.2)", color: "#10b981", borderRadius: 4, fontWeight: 700 }}>Queued / Scheduled</span>
                      </div>
                      <div style={{ fontSize: 10, color: "#6b7280" }}>Ref: {post.chargeId}</div>
                    </div>
                    <p style={{ fontSize: 12, color: "#d1d5db", lineHeight: 1.5 }}>{post.caption}</p>
                    <div style={{ display: "flex", gap: 4, flexWrap: "wrap", marginTop: 6 }}>
                      {post.hashtags?.map((tag: string) => (
                        <span key={tag} style={{ fontSize: 10, color: "#a78bfa" }}>{tag}</span>
                      ))}
                    </div>
                    <div style={{ fontSize: 10, color: "#9ca3af", marginTop: 10, borderTop: "1px solid rgba(255,255,255,0.04)", paddingTop: 8 }}>
                      Scheduled for: {formatDate(post.scheduledAt)}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* ── BILLING TAB ── */}
        {activeTab === "billing" && (
          <div style={{ display: "flex", flexDirection: "column", gap: 18 }}>
            <div>
              <h2 style={{ fontFamily: "'Outfit', sans-serif", fontSize: 18, fontWeight: 800 }}>Billing & Activity</h2>
              <p style={{ fontSize: 12, color: "#9ca3af", marginTop: 2 }}>Summary of flat-fee billing records</p>
            </div>

            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
              <div className="glass-card" style={{ padding: 16 }}>
                <div style={{ fontSize: 10, color: "#6b7280", textTransform: "uppercase", fontWeight: 700, letterSpacing: "0.05em" }}>Total Charged</div>
                <div style={{ fontSize: 24, fontWeight: 800, color: "#10b981", marginTop: 4 }}>${(payments.length * 100).toFixed(2)} AUD</div>
                <div style={{ fontSize: 10, color: "#9ca3af", marginTop: 4 }}>At $100 flat-fee per post</div>
              </div>
              <div className="glass-card" style={{ padding: 16 }}>
                <div style={{ fontSize: 10, color: "#6b7280", textTransform: "uppercase", fontWeight: 700, letterSpacing: "0.05em" }}>Invoices Issued</div>
                <div style={{ fontSize: 24, fontWeight: 800, color: "#8b5cf6", marginTop: 4 }}>{payments.length}</div>
                <div style={{ fontSize: 10, color: "#9ca3af", marginTop: 4 }}>Paid via card on file</div>
              </div>
            </div>

            <div className="glass-card" style={{ padding: 20 }}>
              <div style={{ fontSize: 11, fontWeight: 700, color: "#9ca3af", textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: 12 }}>Billing Activity</div>

              {payments.length === 0 ? (
                <div style={{ textAlign: "center", padding: "20px 0", color: "#6b7280", fontSize: 12 }}>No transactions found</div>
              ) : (
                <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                  {payments.map((pay) => (
                    <div key={pay.id} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "10px 0", borderBottom: "1px solid rgba(255,255,255,0.04)" }}>
                      <div>
                        <div style={{ fontSize: 12, fontWeight: 700 }}>Social Post Approval Flat Fee</div>
                        <div style={{ fontSize: 10, color: "#6b7280", marginTop: 2 }}>{new Date(pay.created_at).toLocaleDateString("en-AU")} · Ref: {pay.id}</div>
                      </div>
                      <div style={{ textAlign: "right" }}>
                        <div style={{ fontSize: 13, fontWeight: 700, color: "#10b981" }}>+$100.00 AUD</div>
                        <div style={{ fontSize: 9, color: "#10b981", background: "rgba(16,185,129,0.1)", padding: "2px 6px", borderRadius: 4, display: "inline-block", marginTop: 2 }}>Success</div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}

        {/* ── STATS TAB ── */}
        {activeTab === "stats" && (
          <div style={{ display: "flex", flexDirection: "column", gap: 18 }}>
            <div>
              <h2 style={{ fontFamily: "'Outfit', sans-serif", fontSize: 18, fontWeight: 800 }}>Account Diagnostics</h2>
              <p style={{ fontSize: 12, color: "#9ca3af", marginTop: 2 }}>Social performance overview indicators</p>
            </div>

            <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 10 }}>
              {[
                { label: "Followers", val: "1.2K", icon: "👥" },
                { label: "Weekly Growth", val: "+4.8%", icon: "📈" },
                { label: "Likes Recieved", val: "420", icon: "❤️" },
              ].map((s) => (
                <div key={s.label} className="glass-card" style={{ padding: 14, textAlign: "center" }}>
                  <div style={{ fontSize: 20, marginBottom: 4 }}>{s.icon}</div>
                  <div style={{ fontSize: 16, fontWeight: 800, color: "#8b5cf6" }}>{s.val}</div>
                  <div style={{ fontSize: 10, color: "#9ca3af", marginTop: 2 }}>{s.label}</div>
                </div>
              ))}
            </div>

            <div className="glass-card" style={{ padding: 16 }}>
              <div style={{ fontSize: 11, fontWeight: 700, color: "#9ca3af", textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: 12 }}>Connected Brand Accounts</div>
              <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                {[
                  { platform: "Instagram", id: "@webgecko", status: "Linked" },
                  { platform: "Facebook", id: "Webgecko Business", status: "Linked" },
                  { platform: "LinkedIn", id: "Webgecko Corporation", status: "Linked" },
                  { platform: "TikTok", id: "@webgecko", status: "Awaiting auth" },
                ].map((acc) => (
                  <div key={acc.platform} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", fontSize: 12 }}>
                    <div>
                      <div style={{ fontWeight: 700 }}>{acc.platform}</div>
                      <div style={{ fontSize: 10, color: "#6b7280" }}>{acc.id}</div>
                    </div>
                    <span style={{ fontSize: 10, padding: "2px 8px", background: acc.status === "Linked" ? "rgba(16,185,129,0.1)" : "rgba(245,158,11,0.1)", color: acc.status === "Linked" ? "#10b981" : "#f59e0b", borderRadius: 4 }}>{acc.status}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* ── PROFILE TAB ── */}
        {activeTab === "profile" && (
          <div className="glass-card" style={{ padding: 20, display: "flex", flexDirection: "column", gap: 16 }}>
            <div>
              <h2 style={{ fontFamily: "'Outfit', sans-serif", fontSize: 18, fontWeight: 800 }}>Profile & Settings</h2>
              <p style={{ fontSize: 12, color: "#9ca3af", marginTop: 2 }}>Manage client details</p>
            </div>

            <div style={{ borderTop: "1px solid rgba(255,255,255,0.06)", paddingTop: 14, display: "flex", flexDirection: "column", gap: 12 }}>
              <div style={{ display: "flex", justifyContent: "space-between", fontSize: 13 }}>
                <span style={{ color: "#9ca3af" }}>Business Name:</span>
                <span style={{ fontWeight: 600 }}>{client?.business_name || client?.slug}</span>
              </div>
              <div style={{ display: "flex", justifyContent: "space-between", fontSize: 13 }}>
                <span style={{ color: "#9ca3af" }}>Account Email:</span>
                <span style={{ fontWeight: 600 }}>{client?.email || "No email on record"}</span>
              </div>
              <div style={{ display: "flex", justifyContent: "space-between", fontSize: 13 }}>
                <span style={{ color: "#9ca3af" }}>Registered Phone:</span>
                <span style={{ fontWeight: 600 }}>{client?.phone || "No phone on record"}</span>
              </div>
              <div style={{ display: "flex", justifyContent: "space-between", fontSize: 13 }}>
                <span style={{ color: "#9ca3af" }}>Job ID Reference:</span>
                <span style={{ fontWeight: 600, fontFamily: "monospace" }}>{client?.job_id}</span>
              </div>
            </div>

            <button
              onClick={handleLogout}
              style={{
                width: "100%",
                background: "rgba(239, 68, 68, 0.1)",
                color: "#f87171",
                border: "1px solid rgba(239, 68, 68, 0.2)",
                borderRadius: 10,
                padding: "12px",
                fontSize: 13,
                fontWeight: 700,
                cursor: "pointer",
                marginTop: 8,
                transition: "background 0.2s",
              }}
              onMouseEnter={(e) => (e.currentTarget.style.background = "rgba(239, 68, 68, 0.18)")}
              onMouseLeave={(e) => (e.currentTarget.style.background = "rgba(239, 68, 68, 0.1)")}
            >
              Sign Out from App
            </button>
          </div>
        )}

      </main>

      {/* Sticky Bottom Nav Bar (Styled like native app) */}
      <nav className="nav-blur" style={{ position: "fixed", bottom: 0, left: 0, width: "100%", zIndex: 10, padding: "8px 10px 18px" }}>
        <div style={{ display: "flex", justifyContent: "space-around", maxWidth: 500, margin: "0 auto" }}>
          {[
            { id: "create", label: "Create", icon: "📸" },
            { id: "review", label: "Reviews", icon: "✍️" },
            { id: "calendar", label: "Queue", icon: "📅" },
            { id: "billing", label: "Billing", icon: "💰" },
            { id: "stats", label: "Stats", icon: "📈" },
            { id: "profile", label: "Profile", icon: "⚙️" },
          ].map((item) => {
            const active = activeTab === item.id;
            return (
              <button
                key={item.id}
                onClick={() => setActiveTab(item.id as any)}
                style={{
                  background: "none",
                  border: "none",
                  display: "flex",
                  flexDirection: "column",
                  alignItems: "center",
                  gap: 4,
                  cursor: "pointer",
                  color: active ? "#8b5cf6" : "#6b7280",
                  padding: "6px",
                  transition: "color 0.2s ease",
                  fontFamily: "inherit",
                }}
              >
                <span style={{ fontSize: 20 }}>{item.icon}</span>
                <span style={{ fontSize: 9, fontWeight: active ? 700 : 500 }}>{item.label}</span>
              </button>
            );
          })}
        </div>
      </nav>
    </div>
  );
}
