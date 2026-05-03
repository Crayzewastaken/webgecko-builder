"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";

export default function ClientLogin() {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const router = useRouter();

  async function handleLogin() {
    setError("");
    if (!username.trim() || !password.trim()) {
      setError("Username and password required");
      return;
    }
    setLoading(true);
    try {
      const res = await fetch("/api/client-login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username: username.trim(), password: password.trim() }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Invalid credentials");
      const wgExpiry = Date.now() + 14 * 24 * 60 * 60 * 1000; // 14 days
      localStorage.setItem(`wg_auth_${data.slug}`, String(wgExpiry));
      router.push(`/c/${data.slug}`);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Login failed");
    } finally {
      setLoading(false);
    }
  }

  return (
    <main style={{
      minHeight: "100vh",
      background: "#0a0f1a",
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      padding: "20px",
      fontFamily: "'Inter', -apple-system, sans-serif",
    }}>
      <div style={{ width: "100%", maxWidth: "420px" }}>

        {/* Logo */}
        <div style={{ textAlign: "center", marginBottom: "32px" }}>
          <div style={{ display: "inline-flex", alignItems: "center", gap: "10px", marginBottom: "6px" }}>
            <div style={{
              width: "36px", height: "36px",
              background: "linear-gradient(135deg, #00c896, #0099ff)",
              borderRadius: "9px",
            }} />
            <span style={{ color: "#fff", fontSize: "20px", fontWeight: 700 }}>WebGecko</span>
          </div>
          <div style={{ color: "#475569", fontSize: "14px" }}>Client Portal</div>
        </div>

        {/* Card */}
        <div style={{
          background: "#0f1623",
          border: "1px solid rgba(255,255,255,0.08)",
          borderRadius: "16px",
          padding: "36px 32px",
        }}>
          <h1 style={{ color: "#fff", fontSize: "22px", fontWeight: 700, textAlign: "center", margin: "0 0 28px" }}>
            Sign in to your project
          </h1>

          {error && (
            <div style={{
              background: "rgba(239,68,68,0.1)",
              border: "1px solid rgba(239,68,68,0.3)",
              color: "#f87171",
              borderRadius: "10px",
              padding: "12px 14px",
              fontSize: "14px",
              marginBottom: "20px",
            }}>
              {error}
            </div>
          )}

          <div style={{ marginBottom: "16px" }}>
            <label style={{ display: "block", color: "#64748b", fontSize: "12px", fontWeight: 600, textTransform: "uppercase", letterSpacing: ".06em", marginBottom: "8px" }}>
              Username
            </label>
            <input
              type="text"
              value={username}
              onChange={e => setUsername(e.target.value)}
              onKeyDown={e => e.key === "Enter" && handleLogin()}
              placeholder="your-business-name"
              autoComplete="username"
              style={{
                width: "100%",
                height: "48px",
                background: "rgba(15,22,35,0.8)",
                border: "1px solid rgba(255,255,255,0.1)",
                borderRadius: "10px",
                padding: "0 14px",
                color: "#fff",
                fontSize: "15px",
                outline: "none",
                boxSizing: "border-box",
              }}
            />
          </div>

          <div style={{ marginBottom: "24px" }}>
            <label style={{ display: "block", color: "#64748b", fontSize: "12px", fontWeight: 600, textTransform: "uppercase", letterSpacing: ".06em", marginBottom: "8px" }}>
              Password
            </label>
            <input
              type="password"
              value={password}
              onChange={e => setPassword(e.target.value)}
              onKeyDown={e => e.key === "Enter" && handleLogin()}
              placeholder="••••••••"
              autoComplete="current-password"
              style={{
                width: "100%",
                height: "48px",
                background: "rgba(15,22,35,0.8)",
                border: "1px solid rgba(255,255,255,0.1)",
                borderRadius: "10px",
                padding: "0 14px",
                color: "#fff",
                fontSize: "15px",
                outline: "none",
                boxSizing: "border-box",
              }}
            />
          </div>

          <button
            onClick={handleLogin}
            disabled={loading}
            style={{
              width: "100%",
              height: "48px",
              background: loading ? "#1e293b" : "linear-gradient(135deg, #00c896, #0099ff)",
              color: loading ? "#475569" : "#000",
              border: "none",
              borderRadius: "10px",
              fontSize: "15px",
              fontWeight: 700,
              cursor: loading ? "not-allowed" : "pointer",
              transition: "opacity .15s",
            }}
          >
            {loading ? "Signing in…" : "Sign In →"}
          </button>

          <p style={{ color: "#334155", fontSize: "12px", textAlign: "center", marginTop: "20px", lineHeight: 1.5 }}>
            Credentials were emailed to you when your project started.<br />
            Need help? <span style={{ color: "#475569" }}>hello@webgecko.au</span>
          </p>
        </div>
      </div>
    </main>
  );
}