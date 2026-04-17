"use client";

import { useState } from "react";

const API_URL = "/api/worker";

export default function HomePage() {
  const [step, setStep] = useState(1);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");

  // client details
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");

  // project
  const [businessName, setBusinessName] = useState("");
  const [industry, setIndustry] = useState("");
  const [audience, setAudience] = useState("");
  const [styleNotes, setStyleNotes] = useState("");

  async function generateWebsite() {
    setLoading(true);

    const payload = {
      name,
      email,
      phone,
      businessName,
      industry,
      audience,
      styleNotes,
    };

    const res = await fetch(API_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });

    const data = await res.json();
    setMessage(data.message);
    setLoading(false);
  }

  function next() {
    if (step < 3) setStep(step + 1);
    else generateWebsite();
  }

  function back() {
    setStep(Math.max(1, step - 1));
  }

  return (
    <main className="min-h-screen bg-[#0f172a] text-white p-6 md:p-10">
      <div className="max-w-6xl mx-auto grid lg:grid-cols-[1fr_320px] gap-6">

        {/* MAIN FORM */}
        <div className="rounded-[2rem] bg-[#111827] border border-white/10 p-8 shadow-2xl">

          {/* HEADER */}
          <div className="mb-8">
            <p className="text-sm uppercase tracking-widest text-slate-400">
              Project Request
            </p>

            <h1 className="text-3xl md:text-5xl font-semibold mt-2">
              Tell us about your website
            </h1>

            {/* progress bar */}
            <div className="mt-6 h-2 bg-white/10 rounded-full overflow-hidden">
              <div
                className="h-full bg-white transition-all"
                style={{ width: `${(step / 3) * 100}%` }}
              />
            </div>
          </div>

          {/* STEP 1 — PROJECT */}
          {step === 1 && (
            <div className="space-y-4">
              <input
                placeholder="Business name"
                value={businessName}
                onChange={(e) => setBusinessName(e.target.value)}
                className="w-full h-14 rounded-2xl bg-slate-900 px-4"
              />

              <input
                placeholder="Industry"
                value={industry}
                onChange={(e) => setIndustry(e.target.value)}
                className="w-full h-14 rounded-2xl bg-slate-900 px-4"
              />

              <input
                placeholder="Target audience"
                value={audience}
                onChange={(e) => setAudience(e.target.value)}
                className="w-full h-14 rounded-2xl bg-slate-900 px-4"
              />

              <textarea
                placeholder="Describe your vision, style, and goals"
                value={styleNotes}
                onChange={(e) => setStyleNotes(e.target.value)}
                className="w-full min-h-32 rounded-2xl bg-slate-900 p-4"
              />
            </div>
          )}

          {/* STEP 2 — CONTACT */}
          {step === 2 && (
            <div className="space-y-4">
              <input
                placeholder="Full Name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="w-full h-14 rounded-2xl bg-slate-900 px-4"
              />

              <input
                placeholder="Email Address"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full h-14 rounded-2xl bg-slate-900 px-4"
              />

              <input
                placeholder="Phone Number"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                className="w-full h-14 rounded-2xl bg-slate-900 px-4"
              />
            </div>
          )}

          {/* STEP 3 — CONFIRM */}
          {step === 3 && (
            <div className="text-slate-300">
              Review your details and submit your request.
            </div>
          )}

          {/* BUTTONS */}
          <div className="flex gap-4 mt-8">
            <button
              onClick={back}
              className="flex-1 h-14 rounded-2xl border border-white/20"
            >
              Back
            </button>

            <button
              onClick={next}
              className="flex-1 h-14 rounded-2xl bg-white text-black font-semibold"
            >
              {loading
                ? "Submitting..."
                : step === 3
                ? "Submit Request"
                : "Next"}
            </button>
          </div>

          {/* MESSAGE */}
          {message && (
            <div className="mt-6 p-4 bg-emerald-500/20 rounded-xl text-emerald-300">
              {message}
            </div>
          )}
        </div>

        {/* SIDE PANEL */}
        <div className="hidden lg:block rounded-[2rem] bg-black border border-white/10 p-6 h-fit sticky top-10">
          <h2 className="text-xl font-semibold">Summary</h2>

          <ul className="mt-6 space-y-3 text-sm text-slate-400">
            <li>Step {step} of 3</li>
            <li>Business: {businessName || "-"}</li>
            <li>Industry: {industry || "-"}</li>
            <li>Contact: {name || "-"}</li>
          </ul>
        </div>

      </div>
    </main>
  );
}