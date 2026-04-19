"use client";

import { useState, useMemo } from "react";

function calculateQuote(pages: string[], features: string[], siteType: string) {
  const pageCount = pages.length || 1;
  const hasEcommerce = features.includes('Payments / Shop');
  const hasBooking = features.includes('Booking System');
  const hasBlog = features.includes('Blog');
  const isMultiPage = siteType === 'multi';

  let packageName = 'Starter';
  let basePrice = 1800;
  let competitorPrice = 3500;

  if (pageCount >= 8 || hasEcommerce || hasBooking) {
    packageName = 'Premium';
    basePrice = 5500;
    competitorPrice = 15000;
  } else if (pageCount >= 4 || isMultiPage) {
    packageName = 'Business';
    basePrice = 3200;
    competitorPrice = 7500;
  }

  let addons = 0;
  if (hasEcommerce && packageName !== 'Premium') addons += 300;
  if (hasBooking && packageName !== 'Premium') addons += 200;
  if (hasBlog) addons += 150;
  if (features.includes('Photo Gallery')) addons += 100;
  if (features.includes('Reviews & Testimonials')) addons += 100;
  if (features.includes('Live Chat')) addons += 150;
  if (features.includes('Newsletter Signup')) addons += 100;

  const totalPrice = basePrice + addons;
  const monthlyPrice = packageName === 'Premium' ? 149 : packageName === 'Business' ? 99 : 79;
  const savings = competitorPrice - totalPrice;

  return { packageName, totalPrice, monthlyPrice, savings, competitorPrice };
}

export default function HomePage() {
  const [step, setStep] = useState(1);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");

  const [businessName, setBusinessName] = useState("");
  const [industry, setIndustry] = useState("");
  const [usp, setUsp] = useState("");
  const [goal, setGoal] = useState("");
  const [siteType, setSiteType] = useState("");
  const [pages, setPages] = useState<string[]>([]);
  const [features, setFeatures] = useState<string[]>([]);
  const [style, setStyle] = useState("");
  const [references, setReferences] = useState("");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");

  const totalSteps = 6;

  const quote = useMemo(() => {
    if (pages.length === 0 && features.length === 0 && !siteType) return null;
    return calculateQuote(pages, features, siteType);
  }, [pages, features, siteType]);

  function toggleItem(arr: string[], value: string, setFn: any) {
    if (arr.includes(value)) setFn(arr.filter((v) => v !== value));
    else setFn([...arr, value]);
  }

  async function submit() {
    setLoading(true);
    setMessage("Submitting your request...");

    const payload = {
      businessName, industry, usp, goal, siteType,
      pages, features, style, references, name, email, phone,
    };

    try {
      const res = await fetch("/api/worker", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = await res.json();
      setMessage(data.message);
    } catch (error: any) {
      setMessage("Error: " + error.message);
    }

    setLoading(false);
  }

  function next() {
    if (step < totalSteps) setStep(step + 1);
    else submit();
  }

  function back() {
    setStep(Math.max(1, step - 1));
  }

  return (
    <main className="min-h-screen bg-[#0f172a] text-white p-6 md:p-10">
      <div className="max-w-6xl mx-auto grid lg:grid-cols-[1fr_340px] gap-6">

        <div className="rounded-[2rem] bg-[#111827] border border-white/10 p-8 shadow-2xl">
          <p className="text-sm uppercase tracking-widest text-slate-400">Project Brief</p>
          <h1 className="text-3xl md:text-5xl font-semibold mt-2">Website Project Questionnaire</h1>

          <div className="mt-6 h-2 bg-white/10 rounded-full overflow-hidden">
            <div className="h-full bg-white transition-all" style={{ width: `${(step / totalSteps) * 100}%` }} />
          </div>

          {step === 1 && (
            <div className="space-y-4 mt-8">
              <input placeholder="Business Name" value={businessName} onChange={(e) => setBusinessName(e.target.value)} className="input" />
              <input placeholder="Industry" value={industry} onChange={(e) => setIndustry(e.target.value)} className="input" />
              <textarea placeholder="What makes your business unique?" value={usp} onChange={(e) => setUsp(e.target.value)} className="textarea" />
            </div>
          )}

          {step === 2 && (
            <div className="space-y-4 mt-8">
              <p className="text-slate-400 text-sm mb-2">What is the main goal of your website?</p>
              <select value={goal} onChange={(e) => setGoal(e.target.value)} className="input">
                <option value="">Select a goal</option>
                <option>Generate leads</option>
                <option>Sell products</option>
                <option>Bookings</option>
                <option>Portfolio showcase</option>
                <option>Provide information</option>
              </select>
              <p className="text-slate-400 text-sm mt-6 mb-2">What type of website do you want?</p>
              <div className="grid gap-3">
                {[
                  { value: "single", label: "Single Page", desc: "Everything on one scrollable page. Clean and fast." },
                  { value: "multi", label: "Multi Page", desc: "Separate pages like Home, About, Services, Contact." },
                ].map((opt) => (
                  <label key={opt.value} className={`card cursor-pointer border-2 transition-all ${siteType === opt.value ? "border-white" : "border-transparent"}`}>
                    <input type="radio" name="siteType" value={opt.value} checked={siteType === opt.value} onChange={() => setSiteType(opt.value)} className="hidden" />
                    <div>
                      <p className="font-semibold">{opt.label}</p>
                      <p className="text-slate-400 text-sm">{opt.desc}</p>
                    </div>
                  </label>
                ))}
              </div>
            </div>
          )}

          {step === 3 && (
            <div className="grid gap-3 mt-8">
              <p className="text-slate-400 text-sm">Select the pages you want</p>
              {["Home", "About", "Services", "Contact", "Shop", "Gallery", "Blog", "Booking", "FAQ", "Testimonials"].map(p => (
                <label key={p} className="card cursor-pointer">
                  <input type="checkbox" checked={pages.includes(p)} onChange={() => toggleItem(pages, p, setPages)} />
                  <span>{p}</span>
                </label>
              ))}
            </div>
          )}

          {step === 4 && (
            <div className="grid gap-3 mt-8">
              <p className="text-slate-400 text-sm">Select features you need</p>
              {["Contact Form", "Booking System", "Payments / Shop", "Blog", "Reviews & Testimonials", "Live Chat", "Photo Gallery", "FAQ Section", "Newsletter Signup", "Social Media Links"].map(f => (
                <label key={f} className="card cursor-pointer">
                  <input type="checkbox" checked={features.includes(f)} onChange={() => toggleItem(features, f, setFeatures)} />
                  <span>{f}</span>
                </label>
              ))}
            </div>
          )}

          {step === 5 && (
            <div className="space-y-4 mt-8">
              <input placeholder="Style (e.g. Luxury dark, Clean minimal, Bold modern)" value={style} onChange={(e) => setStyle(e.target.value)} className="input" />
              <textarea placeholder="Websites you like for reference" value={references} onChange={(e) => setReferences(e.target.value)} className="textarea" />
            </div>
          )}

          {step === 6 && (
            <div className="space-y-4 mt-8">
              <p className="text-slate-400 text-sm">We will be in touch once we have reviewed your request.</p>
              <input placeholder="Full Name" value={name} onChange={(e) => setName(e.target.value)} className="input" />
              <input placeholder="Email Address" value={email} onChange={(e) => setEmail(e.target.value)} className="input" />
              <input placeholder="Phone Number" value={phone} onChange={(e) => setPhone(e.target.value)} className="input" />

              {quote && (
                <div className="mt-6 rounded-2xl bg-[#0f172a] border border-white/10 p-6">
                  <p className="text-xs uppercase tracking-widest text-slate-400 mb-4">Your Estimated Quote</p>
                  <div className="flex items-end gap-2 mb-1">
                    <p className="text-4xl font-bold">${quote.totalPrice.toLocaleString()}</p>
                    <p className="text-slate-400 mb-1">one-time</p>
                  </div>
                  <p className="text-slate-400 text-sm mb-4">+ ${quote.monthlyPrice}/month hosting & maintenance</p>
                  <div className="bg-emerald-500/20 border border-emerald-500/30 rounded-xl p-4">
                    <p className="text-emerald-400 font-bold">🎉 You are saving ${quote.savings.toLocaleString()} compared to the industry average of ${quote.competitorPrice.toLocaleString()}!</p>
                  </div>
                  <p className="text-slate-500 text-xs mt-3">Package: {quote.packageName}</p>
                </div>
              )}
            </div>
          )}

          <div className="flex gap-4 mt-8">
            <button onClick={back} className="btn-outline">Back</button>
            <button onClick={next} disabled={loading} className="btn-primary">
              {loading ? message || "Processing..." : step === totalSteps ? "Submit Request" : "Next"}
            </button>
          </div>

          {message && !loading && (
            <div className="mt-6 p-4 bg-emerald-500/20 rounded-xl text-emerald-300">{message}</div>
          )}
        </div>

        <div className="hidden lg:block space-y-4">
          <div className="rounded-[2rem] bg-black border border-white/10 p-6 sticky top-10">
            <h2 className="text-xl font-semibold">Progress</h2>
            <p className="text-slate-400 mt-4">Step {step} of {totalSteps}</p>
            <div className="mt-6 space-y-2 text-sm text-slate-500">
              <p>Business: {businessName || "-"}</p>
              <p>Goal: {goal || "-"}</p>
              <p>Type: {siteType || "-"}</p>
              <p>Pages: {pages.length > 0 ? pages.join(", ") : "-"}</p>
              <p>Features: {features.length > 0 ? features.join(", ") : "-"}</p>
              <p>Contact: {name || "-"}</p>
            </div>

            {quote && (
              <div className="mt-6 border-t border-white/10 pt-6">
                <p className="text-xs uppercase tracking-widest text-slate-400 mb-3">Live Quote</p>
                <p className="text-3xl font-bold">${quote.totalPrice.toLocaleString()}</p>
                <p className="text-slate-400 text-sm">+ ${quote.monthlyPrice}/month</p>
                <p className="text-xs text-slate-500 mt-1">{quote.packageName} Package</p>
                <div className="mt-3 bg-emerald-500/20 rounded-lg p-3">
                  <p className="text-emerald-400 text-xs font-bold">Saving ${quote.savings.toLocaleString()} vs industry average</p>
                </div>
              </div>
            )}
          </div>
        </div>

      </div>

      <style jsx>{`
        .input { height:56px;border-radius:16px;background:#1f2937;padding:0 16px;width:100%;color:white; }
        .textarea { min-height:120px;border-radius:16px;background:#1f2937;padding:16px;width:100%;color:white; }
        .card { display:flex;gap:10px;align-items:center;padding:14px;border-radius:16px;background:#1f2937; }
        .btn-primary { flex:1;height:56px;border-radius:16px;background:white;color:black;font-weight:600; }
        .btn-outline { flex:1;height:56px;border-radius:16px;border:1px solid rgba(255,255,255,0.2);color:white; }
      `}</style>
    </main>
  );
}