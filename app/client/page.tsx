"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";

const CSS = `
  @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap');
  *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
  body { font-family: 'Inter', -apple-system, sans-serif; }
  @keyframes fadeUp { from { opacity:0; transform:translateY(18px) } to { opacity:1; transform:none } }
  @keyframes float { 0%,100%{ transform:translateY(0) rotate(-2deg) } 50%{ transform:translateY(-8px) rotate(2deg) } }
  @keyframes glow { 0%,100%{ opacity:.6 } 50%{ opacity:1 } }
  @keyframes spin { from{transform:rotate(0)} to{transform:rotate(360deg)} }
  .wg-card { animation: fadeUp 0.32s cubic-bezier(0.25,0.46,0.45,0.94) both; }
  .wg-gecko { animation: float 5s ease-in-out infinite; display: inline-block; }
  input:focus { outline:none; border-color:#00d47e !important; box-shadow:0 0 0 3px rgba(0,212,126,0.12) !important; }
  button { transition: all 0.18s ease; }
  button:active:not(:disabled) { transform: scale(0.97); }
`;

export default function ClientLogin() {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [showPw, setShowPw] = useState(false);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const router = useRouter();

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault();
    setError(""); setLoading(true);
    try {
      const res = await fetch("/api/client-login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username: username.trim(), password: password.trim() }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Invalid credentials");
      const expiry = Date.now() + 24 * 60 * 60 * 1000;
      localStorage.setItem(`wg_auth_${data.slug}`, String(expiry));
      router.push(`/c/${data.slug}`);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Login failed");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div style={{
      minHeight: "100vh",
      background: "#07070c",
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      padding: "24px",
      position: "relative",
      overflow: "hidden",
    }}>
      <style>{CSS}</style>

      {/* Grid bg */}
      <div style={{
        position: "absolute", inset: 0, pointerEvents: "none",
        backgroundImage: "linear-gradient(rgba(255,255,255,0.022) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.022) 1px, transparent 1px)",
        backgroundSize: "52px 52px",
      }}/>

      {/* Glow orb */}
      <div style={{ position:"absolute", top:"15%", left:"50%", transform:"translateX(-50%)", width:700, height:500, background:"radial-gradient(ellipse, rgba(0,212,126,0.07) 0%, transparent 68%)", pointerEvents:"none", animation:"glow 4s ease-in-out infinite" }}/>

      <div className="wg-card" style={{ width:"100%", maxWidth:420, position:"relative", zIndex:1 }}>

        {/* Header */}
        <div style={{ textAlign:"center", marginBottom:32 }}>
          <div className="wg-gecko" style={{ fontSize:48, marginBottom:16 }}>🦎</div>
          <div style={{ fontSize:24, fontWeight:800, color:"#e8e8f0", letterSpacing:"-0.04em", marginBottom:6 }}>
            Client Portal
          </div>
          <div style={{ fontSize:13, color:"#44445a" }}>Sign in to view your website project</div>
        </div>

        {/* Card */}
        <div style={{
          background: "#0e0e17",
          border: "1px solid #1c1c2a",
          borderRadius: 20,
          padding: "32px",
          boxShadow: "0 24px 72px rgba(0,0,0,0.7), 0 1px 0 rgba(255,255,255,0.04) inset",
        }}>
          <form onSubmit={handleLogin} style={{ display:"flex", flexDirection:"column", gap:18 }}>

            <div>
              <div style={{ fontSize:11, fontWeight:700, color:"#44445a", textTransform:"uppercase", letterSpacing:"0.1em", marginBottom:8 }}>Username</div>
              <input
                type="text"
                value={username}
                onChange={e => setUsername(e.target.value)}
                placeholder="your-business-name"
                required
                autoComplete="username"
                style={{
                  width:"100%", padding:"12px 14px", fontSize:14,
                  border:"1.5px solid #1c1c2a", borderRadius:10,
                  background:"#14141f", color:"#e8e8f0",
                  boxSizing:"border-box", transition:"border-color 0.2s, box-shadow 0.2s",
                }}
              />
            </div>

            <div>
              <div style={{ fontSize:11, fontWeight:700, color:"#44445a", textTransform:"uppercase", letterSpacing:"0.1em", marginBottom:8 }}>Password</div>
              <div style={{ position:"relative" }}>
                <input
                  type={showPw ? "text" : "password"}
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                  placeholder="••••••••"
                  required
                  autoComplete="current-password"
                  style={{
                    width:"100%", padding:"12px 44px 12px 14px", fontSize:14,
                    border:"1.5px solid #1c1c2a", borderRadius:10,
                    background:"#14141f", color:"#e8e8f0",
                    boxSizing:"border-box", transition:"border-color 0.2s, box-shadow 0.2s",
                  }}
                />
                <button
                  type="button"
                  onClick={() => setShowPw(s => !s)}
                  style={{ position:"absolute", right:12, top:"50%", transform:"translateY(-50%)", background:"none", border:"none", color:"#44445a", cursor:"pointer", fontSize:14, padding:"4px", lineHeight:1 }}
                >{showPw?"🙈":"👁"}</button>
              </div>
            </div>

            {error && (
              <div style={{ background:"rgba(255,92,92,0.08)", border:"1px solid rgba(255,92,92,0.25)", borderRadius:10, padding:"10px 14px", color:"#ff5c5c", fontSize:13, display:"flex", alignItems:"center", gap:8 }}>
                <span>✗</span> {error}
              </div>
            )}

            <button
              type="submit"
              disabled={loading || !username || !password}
              style={{
                width:"100%", padding:"13px",
                fontSize:14, fontWeight:700,
                background: loading || !username || !password
                  ? "#1c1c2a"
                  : "linear-gradient(135deg, #00d47e, #00b36a)",
                color: loading || !username || !password ? "#44445a" : "#000",
                border:"none", borderRadius:10,
                cursor: loading || !username || !password ? "not-allowed" : "pointer",
                boxShadow: !loading && username && password ? "0 4px 20px rgba(0,212,126,0.3)" : "none",
                transition:"all 0.2s ease",
                marginTop:4,
              }}
            >
              {loading
                ? <span style={{ display:"flex", alignItems:"center", justifyContent:"center", gap:8 }}>
                    <span style={{ display:"inline-block", width:14, height:14, border:"2px solid #44445a", borderTopColor:"#e8e8f0", borderRadius:"50%", animation:"spin 0.7s linear infinite" }}/>
                    Signing in…
                  </span>
                : "Sign in →"}
            </button>
          </form>

          <div style={{ marginTop:24, paddingTop:20, borderTop:"1px solid #1c1c2a", textAlign:"center" }}>
            <div style={{ fontSize:12, color:"#44445a", lineHeight:1.7 }}>
              Your login credentials were sent in your confirmation email.
              <br/>
              Need help? <a href="mailto:hello@webgecko.au" style={{ color:"#00d47e", textDecoration:"none", fontWeight:500 }}>hello@webgecko.au</a>
            </div>
          </div>
        </div>

        {/* Powered by */}
        <div style={{ textAlign:"center", marginTop:20, fontSize:12, color:"#2d2d42" }}>
          Powered by <span style={{ color:"#00d47e", fontWeight:600 }}>WebGecko</span>
        </div>
      </div>
    </div>
  );
}
