"use client";

import { useState, useEffect } from "react";

const CSS = `
  @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap');
  *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
  body { font-family: 'Inter', -apple-system, BlinkMacSystemFont, sans-serif; }
  @keyframes fadeUp { from { opacity:0; transform:translateY(16px) } to { opacity:1; transform:none } }
  @keyframes float { 0%,100%{ transform:translateY(0) } 50%{ transform:translateY(-6px) } }
  @keyframes ping { 0%{ transform:scale(1); opacity:.8 } 100%{ transform:scale(2.2); opacity:0 } }
  @keyframes shimmer { 0%{background-position:-800px 0} 100%{background-position:800px 0} }
  .wg-login-card { animation: fadeUp 0.35s cubic-bezier(0.25,0.46,0.45,0.94) both; }
  .wg-logo { animation: float 4s ease-in-out infinite; }
  input:focus { outline: none; border-color: #00d47e !important; box-shadow: 0 0 0 3px rgba(0,212,126,0.15) !important; }
  button { transition: all 0.18s ease; }
  button:active:not(:disabled) { transform: scale(0.97); }
  ::-webkit-scrollbar { display: none; }
`;

export default function AdminLoginPage() {
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [locked, setLocked] = useState(false);
  const [showPw, setShowPw] = useState(false);
  const [attempts, setAttempts] = useState(0);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (locked) return;
    setError(""); setLoading(true);
    try {
      const res = await fetch("/api/admin/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "same-origin",
        body: JSON.stringify({ password }),
      });
      if (res.ok) {
        await new Promise(r => setTimeout(r, 120));
        window.location.replace("/admin");
      } else {
        let msg = "Incorrect password";
        try { const d = await res.json(); msg = d.error || msg; } catch {}
        if (res.status === 429) setLocked(true);
        setAttempts(a => a + 1);
        setError(msg);
        setPassword("");
      }
    } catch (err) {
      setError("Network error — please try again");
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

      {/* Background grid */}
      <div style={{
        position: "absolute", inset: 0, pointerEvents: "none",
        backgroundImage: "linear-gradient(rgba(255,255,255,0.025) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.025) 1px, transparent 1px)",
        backgroundSize: "48px 48px",
      }}/>

      {/* Glow */}
      <div style={{ position:"absolute", top:"20%", left:"50%", transform:"translateX(-50%)", width:600, height:400, background:"radial-gradient(ellipse, rgba(0,212,126,0.08) 0%, transparent 70%)", pointerEvents:"none" }}/>

      {/* Card */}
      <div className="wg-login-card" style={{
        width: "100%", maxWidth: 420, position: "relative", zIndex: 1,
      }}>
        {/* Logo */}
        <div className="wg-logo" style={{ textAlign: "center", marginBottom: 36 }}>
          <div style={{
            display: "inline-flex", alignItems: "center", justifyContent: "center",
            width: 60, height: 60, borderRadius: 16,
            background: locked ? "rgba(255,92,92,0.12)" : "rgba(0,212,126,0.12)",
            border: `1px solid ${locked ? "rgba(255,92,92,0.3)" : "rgba(0,212,126,0.3)"}`,
            marginBottom: 16, fontSize: 28,
            boxShadow: locked ? "0 0 32px rgba(255,92,92,0.15)" : "0 0 32px rgba(0,212,126,0.15)",
          }}>
            {locked ? "🔒" : "🦎"}
          </div>
          <div style={{ fontSize: 22, fontWeight: 800, color: "#e8e8f0", letterSpacing: "-0.04em" }}>
            WebGecko Admin
          </div>
          <div style={{ fontSize: 13, color: "#44445a", marginTop: 6 }}>
            {locked ? "Access temporarily restricted" : "Sign in to your dashboard"}
          </div>
        </div>

        {/* Form card */}
        <div style={{
          background: "#0e0e17",
          border: "1px solid #1c1c2a",
          borderRadius: 20,
          padding: "32px 32px 28px",
          boxShadow: "0 24px 72px rgba(0,0,0,0.7), 0 1px 0 rgba(255,255,255,0.04) inset",
        }}>
          {locked ? (
            <div style={{
              background: "rgba(255,92,92,0.08)", border: "1px solid rgba(255,92,92,0.25)",
              borderRadius: 12, padding: "20px", textAlign: "center",
            }}>
              <div style={{ fontSize: 32, marginBottom: 12 }}>⛔</div>
              <div style={{ fontSize: 15, fontWeight: 700, color: "#ff5c5c", marginBottom: 8 }}>
                Too many failed attempts
              </div>
              <div style={{ fontSize: 13, color: "#8888a8", lineHeight: 1.6 }}>
                Your login has been locked for 1 hour. A notification has been sent to your email.
              </div>
            </div>
          ) : (
            <form onSubmit={handleSubmit} style={{ display: "flex", flexDirection: "column", gap: 20 }}>
              <div>
                <div style={{ fontSize: 11, fontWeight: 700, color: "#44445a", textTransform: "uppercase", letterSpacing: "0.1em", marginBottom: 8 }}>
                  Admin Password
                </div>
                <div style={{ position: "relative" }}>
                  <input
                    type={showPw ? "text" : "password"}
                    value={password}
                    onChange={e => setPassword(e.target.value)}
                    placeholder="Enter your password"
                    autoFocus
                    required
                    style={{
                      width: "100%", padding: "12px 44px 12px 14px", fontSize: 15,
                      border: `1.5px solid ${error ? "#ff5c5c" : "#1c1c2a"}`,
                      borderRadius: 10, outline: "none", background: "#14141f",
                      color: "#e8e8f0", boxSizing: "border-box", transition: "border-color 0.2s, box-shadow 0.2s",
                    }}
                  />
                  <button
                    type="button"
                    onClick={() => setShowPw(s => !s)}
                    style={{ position:"absolute", right:12, top:"50%", transform:"translateY(-50%)", background:"none", border:"none", color:"#44445a", cursor:"pointer", fontSize:15, padding:"4px", lineHeight:1 }}
                  >{showPw ? "🙈" : "👁"}</button>
                </div>
                {error && (
                  <div style={{ marginTop: 8, fontSize: 12, color: "#ff5c5c", display: "flex", alignItems: "center", gap: 6 }}>
                    <span>✗</span> {error}
                    {attempts >= 5 && <span style={{ color: "#f5a030", marginLeft: 4 }}>({10 - attempts} attempts left)</span>}
                  </div>
                )}
              </div>

              <button
                type="submit"
                disabled={loading || !password}
                style={{
                  width: "100%", padding: "13px",
                  fontSize: 14, fontWeight: 700,
                  background: loading || !password
                    ? "#1c1c2a"
                    : "linear-gradient(135deg, #00d47e, #00b36a)",
                  color: loading || !password ? "#44445a" : "#000",
                  border: "none", borderRadius: 10,
                  cursor: loading || !password ? "not-allowed" : "pointer",
                  letterSpacing: "-0.01em",
                  boxShadow: !loading && password ? "0 4px 20px rgba(0,212,126,0.3)" : "none",
                  transition: "all 0.2s ease",
                }}
              >
                {loading ? (
                  <span style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 8 }}>
                    <span style={{ display: "inline-block", width: 14, height: 14, border: "2px solid #44445a", borderTopColor: "#e8e8f0", borderRadius: "50%", animation: "wg-spin 0.7s linear infinite" }}/>
                    Signing in…
                  </span>
                ) : "Sign in →"}
              </button>
            </form>
          )}

          <div style={{ marginTop: 20, paddingTop: 20, borderTop: "1px solid #1c1c2a", textAlign: "center" }}>
            <div style={{ fontSize: 11, color: "#2d2d42", letterSpacing: "0.02em" }}>
              Secured with rate limiting + account lockout
            </div>
          </div>
        </div>

        <div style={{ textAlign: "center", marginTop: 20, fontSize: 12, color: "#2d2d42" }}>
          WebGecko © {new Date().getFullYear()}
        </div>
      </div>

      <style>{`@keyframes wg-spin { from{transform:rotate(0deg)} to{transform:rotate(360deg)} }`}</style>
    </div>
  );
}
