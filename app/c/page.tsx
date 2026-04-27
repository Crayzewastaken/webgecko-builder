"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";

export default function ClientLoginPage() {
  const router = useRouter();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleLogin() {
    setError("");
    if (!username || !password) {
      setError("Please enter your username and password.");
      return;
    }
    setLoading(true);
    try {
      const res = await fetch("/api/client-login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ slug: username.trim().toLowerCase(), password }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "Invalid credentials.");
        return;
      }
      // Set session flag
      sessionStorage.setItem(`wg_auth_${username.trim().toLowerCase()}`, "1");
      router.push(`/c/${username.trim().toLowerCase()}`);
    } catch {
      setError("Something went wrong. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div
      style={{
        minHeight: "100vh",
        background: "#0f0f0f",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        fontFamily: "'Inter', sans-serif",
        padding: "20px",
      }}
    >
      <div
        style={{
          background: "#1a1a1a",
          border: "1px solid #2a2a2a",
          borderRadius: "16px",
          padding: "48px 40px",
          width: "100%",
          maxWidth: "400px",
        }}
      >
        {/* Logo */}
        <div style={{ textAlign: "center", marginBottom: "32px" }}>
          <div
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: "10px",
              marginBottom: "8px",
            }}
          >
            <div
              style={{
                width: "36px",
                height: "36px",
                background: "linear-gradient(135deg, #00c896, #0099ff)",
                borderRadius: "8px",
              }}
            />
            <span style={{ color: "#fff", fontSize: "20px", fontWeight: 700 }}>
              WebGecko
            </span>
          </div>
          <p style={{ color: "#666", fontSize: "14px", marginTop: "4px" }}>
            Client Portal
          </p>
        </div>

        <h1
          style={{
            color: "#fff",
            fontSize: "22px",
            fontWeight: 600,
            marginBottom: "24px",
            textAlign: "center",
          }}
        >
          Sign in to your project
        </h1>

        {error && (
          <div
            style={{
              background: "#2a1515",
              border: "1px solid #ff4444",
              color: "#ff6666",
              borderRadius: "8px",
              padding: "12px 16px",
              fontSize: "14px",
              marginBottom: "20px",
            }}
          >
            {error}
          </div>
        )}

        <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
          <div>
            <label
              style={{ color: "#aaa", fontSize: "13px", display: "block", marginBottom: "6px" }}
            >
              Username
            </label>
            <input
              type="text"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleLogin()}
              placeholder="e.g. ironclassgym"
              style={{
                width: "100%",
                background: "#111",
                border: "1px solid #333",
                borderRadius: "8px",
                padding: "12px 14px",
                color: "#fff",
                fontSize: "15px",
                outline: "none",
                boxSizing: "border-box",
              }}
            />
          </div>

          <div>
            <label
              style={{ color: "#aaa", fontSize: "13px", display: "block", marginBottom: "6px" }}
            >
              Password
            </label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleLogin()}
              placeholder="••••••••••"
              style={{
                width: "100%",
                background: "#111",
                border: "1px solid #333",
                borderRadius: "8px",
                padding: "12px 14px",
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
              background: loading
                ? "#333"
                : "linear-gradient(135deg, #00c896, #0099ff)",
              color: "#fff",
              border: "none",
              borderRadius: "8px",
              padding: "14px",
              fontSize: "15px",
              fontWeight: 600,
              cursor: loading ? "not-allowed" : "pointer",
              marginTop: "4px",
              transition: "opacity 0.2s",
            }}
          >
            {loading ? "Signing in…" : "Sign In"}
          </button>
        </div>

        <p
          style={{
            color: "#444",
            fontSize: "12px",
            textAlign: "center",
            marginTop: "24px",
          }}
        >
          Credentials were emailed to you when your project started.
        </p>
      </div>
    </div>
  );
}