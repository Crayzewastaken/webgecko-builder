"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";

export default function ClientLogin() {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const router = useRouter();

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      const res = await fetch("/api/client-login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username: username.trim(), password: password.trim() }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Invalid credentials");
      // Store auth flag in sessionStorage so dashboard knows we're logged in
      sessionStorage.setItem(`wg_auth_${data.slug}`, "1");
      router.push(`/c/${data.slug}`);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Login failed");
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="min-h-screen bg-[#0a0f1a] flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <div className="text-4xl mb-3">🦎</div>
          <h1 className="text-2xl font-bold text-white">WebGecko Client Portal</h1>
          <p className="text-slate-400 text-sm mt-2">Sign in to view your website project</p>
        </div>
        <div className="bg-[#0f1623] border border-white/8 rounded-2xl p-8">
          <form onSubmit={handleLogin} className="space-y-4">
            <div>
              <label className="block text-xs font-semibold text-slate-400 uppercase tracking-widest mb-2">Username</label>
              <input
                type="text"
                value={username}
                onChange={e => setUsername(e.target.value)}
                placeholder="your-business-name"
                required
                autoComplete="username"
                className="w-full h-12 rounded-xl bg-slate-900/80 border border-white/10 px-4 text-white placeholder:text-slate-600 focus:outline-none focus:border-emerald-500/50 transition-all"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-400 uppercase tracking-widest mb-2">Password</label>
              <input
                type="password"
                value={password}
                onChange={e => setPassword(e.target.value)}
                placeholder="••••••••"
                required
                autoComplete="current-password"
                className="w-full h-12 rounded-xl bg-slate-900/80 border border-white/10 px-4 text-white placeholder:text-slate-600 focus:outline-none focus:border-emerald-500/50 transition-all"
              />
            </div>
            {error && (
              <div className="bg-red-500/10 border border-red-500/20 rounded-xl p-3 text-red-400 text-sm">{error}</div>
            )}
            <button
              type="submit"
              disabled={loading}
              className="w-full h-12 rounded-xl bg-emerald-500 hover:bg-emerald-400 disabled:opacity-50 text-black font-bold transition-all"
            >
              {loading ? "Signing in..." : "Sign In →"}
            </button>
          </form>
          <p className="text-slate-600 text-xs text-center mt-6">
            Your login credentials were sent in your confirmation email.<br />
            Need help? Contact <span className="text-slate-400">hello@webgecko.au</span>
          </p>
        </div>
      </div>
    </main>
  );
}