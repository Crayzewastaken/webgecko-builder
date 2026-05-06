"use client";

import { useState } from "react";

export default function AdminLoginPage() {
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      const res = await fetch("/api/admin/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ password }),
      });
      if (res.ok) {
        window.location.href = "/admin";
      } else {
        const data = await res.json().catch(() => ({}));
        setError(data.error || "Incorrect password");
      }
    } catch {
      setError("Network error — please try again");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div style={{
      minHeight: "100vh",
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      background: "#f8f9fb",
      fontFamily: "'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif",
    }}>
      <div style={{
        background: "#ffffff",
        border: "1px solid #e5e7eb",
        borderRadius: "16px",
        padding: "48px 40px",
        width: "100%",
        maxWidth: "400px",
        boxShadow: "0 4px 24px rgba(0,0,0,0.06)",
      }}>
        <div style={{ textAlign: "center", marginBottom: "32px" }}>
          <div style={{
            display: "inline-flex",
            alignItems: "center",
            justifyContent: "center",
            width: "52px",
            height: "52px",
            background: "#f0fdf4",
            borderRadius: "14px",
            marginBottom: "16px",
          }}>
            <span style={{ fontSize: "26px" }}>&#x1F98E;</span>
          </div>
          <h1 style={{ margin: 0, fontSize: "22px", fontWeight: 700, color: "#111827", letterSpacing: "-0.3px" }}>
            WebGecko Admin
          </h1>
          <p style={{ margin: "6px 0 0", fontSize: "14px", color: "#6b7280" }}>
            Sign in to your dashboard
          </p>
        </div>

        <form onSubmit={handleSubmit}>
          <div style={{ marginBottom: "16px" }}>
            <label style={{
              display: "block",
              fontSize: "13px",
              fontWeight: 600,
              color: "#374151",
              marginBottom: "6px",
            }}>
              Password
            </label>
            <input
              type="password"
              value={password}
              onChange={e => setPassword(e.target.value)}
              placeholder="Enter admin password"
              autoFocus
              required
              style={{
                width: "100%",
                padding: "10px 14px",
                fontSize: "15px",
                border: error ? "1.5px solid #ef4444" : "1.5px solid #e5e7eb",
                borderRadius: "10px",
                outline: "none",
                background: "#f9fafb",
                color: "#111827",
                boxSizing: "border-box",
              }}
            />
            {error && (
              <p style={{ margin: "8px 0 0", fontSize: "13px", color: "#ef4444" }}>
                {error}
              </p>
            )}
          </div>

          <button
            type="submit"
            disabled={loading || !password}
            style={{
              width: "100%",
              padding: "11px",
              fontSize: "15px",
              fontWeight: 600,
              background: loading || !password ? "#d1d5db" : "#16a34a",
              color: loading || !password ? "#9ca3af" : "#ffffff",
              border: "none",
              borderRadius: "10px",
              cursor: loading || !password ? "not-allowed" : "pointer",
            }}
          >
            {loading ? "Signing in..." : "Sign in"}
          </button>
        </form>
      </div>
    </div>
  );
}
