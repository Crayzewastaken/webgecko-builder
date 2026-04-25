"use client";

import React, { useState, useEffect, useRef, useCallback } from "react";

// ─── Types ────────────────────────────────────────────────────────────────────

interface QuoteResult {
  packageName: string;
  totalPrice: number;
  monthlyPrice: number;
  savings: number;
  competitorPrice: number;
  deposit: number;
}

interface FormState {
  businessName: string;
  industry: string;
  usp: string;
  existingWebsite: string;
  targetAudience: string;
  businessAddress: string;
  goal: string;
  siteType: string;
  pages: string[];
  features: string[];
  hasPricing: string;
  pricingType: string;
  pricingMethod: string;
  pricingDetails: string;
  pricingUrl: string;
  style: string;
  colorPrefs: string;
  references: string;
  hasLogo: string;
  hasContent: string;
  additionalNotes: string;
  name: string;
  email: string;
  phone: string;
  abn: string;
}

// ─── Constants ────────────────────────────────────────────────────────────────

const PAGES_OPTIONS = [
  "Home", "About", "Services", "Team", "Gallery", "Portfolio",
  "Blog", "Testimonials", "FAQ", "Pricing", "Contact", "Booking",
  "Shop", "Privacy Policy", "Terms",
];

const FEATURE_BUNDLES = [
  { id: "contact", icon: "📬", label: "Contact & Enquiries", desc: "Contact form, social media links", features: ["Contact Form", "Social Media Links"] },
  { id: "trust", icon: "⭐", label: "Trust & Reviews", desc: "Customer reviews, testimonials, FAQ section", features: ["Reviews & Testimonials", "FAQ Section"] },
  { id: "location", icon: "📍", label: "Location & Maps", desc: "Google Maps, directions to your business", features: ["Google Maps"] },
  { id: "booking", icon: "📅", label: "Bookings & Appointments", desc: "Online booking system for appointments", features: ["Booking System"] },
  { id: "shop", icon: "🛒", label: "Online Shop & Payments", desc: "Sell products or services", features: ["Payments / Shop"] },
  { id: "content", icon: "📰", label: "Blog & Content", desc: "Blog posts, news, articles", features: ["Blog"] },
  { id: "gallery", icon: "🖼️", label: "Photo Gallery", desc: "Showcase your work or portfolio", features: ["Photo Gallery"] },
  { id: "growth", icon: "📈", label: "Growth & Marketing", desc: "Newsletter signup, live chat, pop-up forms", features: ["Newsletter Signup", "Live Chat", "Pop-up Form"] },
  { id: "video", icon: "🎥", label: "Video Background", desc: "Cinematic video hero section", features: ["Video Background"] },
];

const STYLE_OPTIONS = ["Modern & Minimal", "Bold & Vibrant", "Corporate & Professional", "Warm & Friendly", "Dark & Premium", "Playful & Creative"];
const GOAL_OPTIONS = ["Get more leads & enquiries", "Sell products online", "Build brand awareness", "Share information & content", "Showcase portfolio & work", "Accept bookings & appointments"];

const STEPS = [
  { id: "business", label: "Business" },
  { id: "goals", label: "Goals" },
  { id: "pages", label: "Pages" },
  { id: "features", label: "Features" },
  { id: "pricing", label: "Pricing" },
  { id: "pricing_details", label: "Pricing Details" },
  { id: "design", label: "Design" },
  { id: "assets", label: "Assets" },
  { id: "contact", label: "Contact" },
];

const STORAGE_KEY = "webgecko_form_v3";

// ─── Quote calculator ─────────────────────────────────────────────────────────

function calculateQuote(pages: string[], features: string[], siteType: string): QuoteResult {
  let packageName = "Starter";
  let basePrice = 1800;
  let competitorPrice = 3500;
  let monthlyPrice = 79;

  const hasEcom = features.includes("Payments / Shop");
  const hasBooking = features.includes("Booking System");
  const pageCount = pages.length;
  const isMulti = siteType === "multi";

  if (pageCount >= 8 || hasEcom) {
    packageName = "Premium";
    basePrice = 5500;
    competitorPrice = 15000;
    monthlyPrice = 149;
  } else if (pageCount >= 4 || isMulti || hasBooking) {
    packageName = "Business";
    basePrice = 3200;
    competitorPrice = 7500;
    monthlyPrice = 99;
  }

  let addOns = 0;
  if (hasEcom) addOns += 300;
  if (hasBooking) addOns += 200;
  if (features.includes("Blog")) addOns += 150;
  if (features.includes("Photo Gallery")) addOns += 100;
  if (features.includes("Reviews & Testimonials")) addOns += 100;
  if (features.includes("Live Chat")) addOns += 150;
  if (features.includes("Newsletter Signup")) addOns += 100;

  const totalPrice = basePrice + addOns;
  const deposit = Math.round(totalPrice / 2);
  const savings = competitorPrice - totalPrice;

  return { packageName, totalPrice, monthlyPrice, savings, competitorPrice, deposit };
}

// ─── Image compression ────────────────────────────────────────────────────────

async function compressImage(file: File, maxWidthPx: number, qualityVal: number): Promise<File> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    const url = URL.createObjectURL(file);
    img.onload = () => {
      URL.revokeObjectURL(url);
      const canvas = document.createElement("canvas");
      let { width, height } = img;
      if (width > maxWidthPx) {
        height = Math.round((height * maxWidthPx) / width);
        width = maxWidthPx;
      }
      canvas.width = width;
      canvas.height = height;
      const ctx = canvas.getContext("2d");
      if (!ctx) return reject(new Error("No canvas context"));
      ctx.drawImage(img, 0, 0, width, height);
      canvas.toBlob(
        (blob) => {
          if (!blob) return reject(new Error("Compression failed"));
          const compressed = new File([blob], file.name.replace(/\.[^.]+$/, ".jpg"), {
            type: "image/jpeg",
            lastModified: Date.now(),
          });
          resolve(compressed);
        },
        "image/jpeg",
        qualityVal / 100
      );
    };
    img.onerror = () => { URL.revokeObjectURL(url); reject(new Error("Image load failed")); };
    img.src = url;
  });
}

// ─── Main component ───────────────────────────────────────────────────────────

export default function HomePage() {
  const [step, setStep] = useState(0);
  const [form, setForm] = useState<FormState>({
    businessName: "", industry: "", usp: "", existingWebsite: "",
    targetAudience: "", businessAddress: "", goal: "", siteType: "single",
    pages: [], features: [], hasPricing: "No", pricingType: "",
    pricingMethod: "", pricingDetails: "", pricingUrl: "", style: "",
    colorPrefs: "", references: "", hasLogo: "No", hasContent: "No",
    additionalNotes: "", name: "", email: "", phone: "", abn: "",
  });

  const [logoFile, setLogoFile] = useState<File | null>(null);
  const [heroFile, setHeroFile] = useState<File | null>(null);
  const [photoFiles, setPhotoFiles] = useState<(File | null)[]>([null, null, null, null, null]);

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [submitted, setSubmitted] = useState(false);
  const [submitResult, setSubmitResult] = useState<{ quote: QuoteResult; previewUrl: string } | null>(null);
  const [turnstileToken, setTurnstileToken] = useState("");
  const turnstileRef = useRef<HTMLDivElement>(null);
  const turnstileRendered = useRef(false);

  // Derived steps — skip pricing_details if hasPricing !== "Yes"
  const visibleSteps = STEPS.filter((s) => {
    if (s.id === "pricing_details") return form.hasPricing === "Yes";
    return true;
  });

  const currentStep = visibleSteps[step];
  const isLastStep = step === visibleSteps.length - 1;

  // ─── Persistence ────────────────────────────────────────────────────────────

  useEffect(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved) {
        const parsed = JSON.parse(saved);
        if (parsed.form) setForm(parsed.form);
        if (typeof parsed.step === "number") setStep(parsed.step);
      }
    } catch {
      // ignore
    }
  }, []);

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify({ form, step }));
    } catch {
      // ignore
    }
  }, [form, step]);

  // ─── Turnstile ──────────────────────────────────────────────────────────────

  useEffect(() => {
    if (currentStep?.id !== "contact") return;
    if (turnstileRendered.current) return;

    const siteKey = process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY;
    if (!siteKey) return;

    const script = document.createElement("script");
    script.src = "https://challenges.cloudflare.com/turnstile/v0/api.js";
    script.async = true;
    script.onload = () => {
      if (turnstileRef.current && !turnstileRendered.current) {
        turnstileRendered.current = true;
        // @ts-ignore
        window.turnstile?.render(turnstileRef.current, {
          sitekey: siteKey,
          callback: (token: string) => setTurnstileToken(token),
          "expired-callback": () => setTurnstileToken(""),
        });
      }
    };
    document.head.appendChild(script);
  }, [currentStep]);

  // ─── Field helpers ──────────────────────────────────────────────────────────

  const setField = useCallback(<K extends keyof FormState>(key: K, value: FormState[K]) => {
    setForm((prev) => ({ ...prev, [key]: value }));
  }, []);

  const toggleArray = useCallback((key: "pages" | "features", value: string) => {
    setForm((prev) => {
      const arr = prev[key] as string[];
      return {
        ...prev,
        [key]: arr.includes(value) ? arr.filter((v) => v !== value) : [...arr, value],
      };
    });
  }, []);

  const toggleBundle = useCallback((bundleFeatures: string[]) => {
    setForm((prev) => {
      const current = prev.features;
      const allOn = bundleFeatures.every((f) => current.includes(f));
      if (allOn) {
        return { ...prev, features: current.filter((f) => !bundleFeatures.includes(f)) };
      } else {
        const added = [...current];
        for (const f of bundleFeatures) {
          if (!added.includes(f)) added.push(f);
        }
        return { ...prev, features: added };
      }
    });
  }, []);

  // ─── Navigation ─────────────────────────────────────────────────────────────

  const next = () => setStep((s) => Math.min(s + 1, visibleSteps.length - 1));
  const prev = () => setStep((s) => Math.max(s - 1, 0));

  // ─── Submit ─────────────────────────────────────────────────────────────────

  const handleSubmit = async () => {
    setError("");
    setLoading(true);

    try {
      const fd = new FormData();
      fd.append("businessName", form.businessName);
      fd.append("industry", form.industry);
      fd.append("usp", form.usp);
      fd.append("existingWebsite", form.existingWebsite);
      fd.append("targetAudience", form.targetAudience);
      fd.append("businessAddress", form.businessAddress);
      fd.append("goal", form.goal);
      fd.append("siteType", form.siteType);
      fd.append("hasPricing", form.hasPricing);
      fd.append("pricingType", form.pricingType);
      fd.append("pricingMethod", form.pricingMethod);
      fd.append("pricingDetails", form.pricingDetails);
      fd.append("pricingUrl", form.pricingUrl);
      fd.append("style", form.style);
      fd.append("colorPrefs", form.colorPrefs);
      fd.append("references", form.references);
      fd.append("hasLogo", form.hasLogo);
      fd.append("hasContent", form.hasContent);
      fd.append("additionalNotes", form.additionalNotes);
      fd.append("name", form.name);
      fd.append("email", form.email);
      fd.append("phone", form.phone);
      fd.append("abn", form.abn);
      fd.append("pages", JSON.stringify(form.pages));
      fd.append("features", JSON.stringify(form.features));
      fd.append("products", JSON.stringify([]));
      fd.append("turnstileToken", turnstileToken);

      if (logoFile) {
        const compressed = await compressImage(logoFile, 400, 85);
        fd.append("logo", compressed, compressed.name);
      }
      if (heroFile) {
        const compressed = await compressImage(heroFile, 1400, 75);
        fd.append("hero", compressed, compressed.name);
      }
      for (let i = 0; i < photoFiles.length; i++) {
        if (photoFiles[i]) {
          const compressed = await compressImage(photoFiles[i]!, 1000, 70);
          fd.append(`photo_${i}`, compressed, compressed.name);
        }
      }

      const resp = await fetch("/api/worker", { method: "POST", body: fd });
      const data = await resp.json();

      if (!resp.ok) {
        throw new Error(data.error || "Submission failed");
      }

      localStorage.removeItem(STORAGE_KEY);
      setSubmitResult({ quote: data.quote, previewUrl: data.previewUrl });
      setSubmitted(true);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Something went wrong. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  const quote = calculateQuote(form.pages, form.features, form.siteType);

  // ─── Success Screen ──────────────────────────────────────────────────────────

  if (submitted && submitResult) {
    const firstName = form.name.split(" ")[0];
    const q = submitResult.quote || quote;

    const timeline = [
      { icon: "🤖", day: "Day 1", title: "AI Build", desc: "Your site is generated by our AI pipeline" },
      { icon: "🎨", day: "Day 2–4", title: "Design Review", desc: "Our team refines and polishes your site" },
      { icon: "✉️", day: "Day 5–7", title: "Your Review", desc: "We send you the preview for feedback" },
      { icon: "🔧", day: "Day 8–10", title: "Revisions", desc: "We make any changes you request" },
      { icon: "🚀", day: "Day 10–12", title: "Launch!", desc: "Your website goes live on your domain" },
    ];

    return (
      <div style={{ minHeight: "100vh", background: "#0a0f1a", color: "#e2e8f0", fontFamily: "sans-serif", padding: "40px 20px" }}>
        <div style={{ maxWidth: 640, margin: "0 auto" }}>
          <div style={{ textAlign: "center", marginBottom: 40 }}>
            <div style={{ fontSize: 56, marginBottom: 16 }}>🎉</div>
            <h1 style={{ fontSize: "2rem", fontWeight: 800, color: "#ffffff", margin: "0 0 8px" }}>
              You&apos;re all set, {firstName}!
            </h1>
            <p style={{ color: "#94a3b8", fontSize: "1.05rem", margin: 0 }}>
              We&apos;ve received your submission for <strong style={{ color: "#10b981" }}>{form.businessName}</strong>
            </p>
          </div>

          {/* Quote card */}
          <div style={{ background: "#0f1623", border: "1px solid rgba(255,255,255,0.08)", borderRadius: 16, padding: 28, marginBottom: 24 }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20 }}>
              <div>
                <div style={{ color: "#64748b", fontSize: "0.75rem", textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: 4 }}>Your Package</div>
                <div style={{ color: "#10b981", fontSize: "1.4rem", fontWeight: 700 }}>{q.packageName}</div>
              </div>
              <div style={{ textAlign: "right" }}>
                <div style={{ color: "#64748b", fontSize: "0.75rem", textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: 4 }}>Total Investment</div>
                <div style={{ color: "#ffffff", fontSize: "2rem", fontWeight: 800 }}>${q.totalPrice.toLocaleString()}</div>
              </div>
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginBottom: 20 }}>
              <div style={{ background: "#0a0f1a", borderRadius: 10, padding: "14px 16px" }}>
                <div style={{ color: "#64748b", fontSize: "0.75rem", marginBottom: 4 }}>Deposit to start</div>
                <div style={{ color: "#e2e8f0", fontSize: "1.1rem", fontWeight: 700 }}>${q.deposit.toLocaleString()}</div>
              </div>
              <div style={{ background: "#0a0f1a", borderRadius: 10, padding: "14px 16px" }}>
                <div style={{ color: "#64748b", fontSize: "0.75rem", marginBottom: 4 }}>Monthly hosting</div>
                <div style={{ color: "#e2e8f0", fontSize: "1.1rem", fontWeight: 700 }}>${q.monthlyPrice}/mo</div>
              </div>
            </div>
            <button
              disabled
              style={{ width: "100%", background: "#1f2937", color: "#64748b", border: "1px solid rgba(255,255,255,0.08)", borderRadius: 10, padding: "14px", fontSize: "1rem", fontWeight: 600, cursor: "not-allowed" }}
            >
              Pay Deposit — Coming Soon
            </button>
          </div>

          {/* Timeline */}
          <div style={{ background: "#0f1623", border: "1px solid rgba(255,255,255,0.08)", borderRadius: 16, padding: 28, marginBottom: 24 }}>
            <h3 style={{ color: "#e2e8f0", margin: "0 0 20px", fontSize: "1.1rem" }}>What happens next</h3>
            <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
              {timeline.map((t, i) => (
                <div key={i} style={{ display: "flex", gap: 16, alignItems: "flex-start" }}>
                  <div style={{ width: 40, height: 40, borderRadius: 10, background: "#0a0f1a", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 20, flexShrink: 0 }}>
                    {t.icon}
                  </div>
                  <div>
                    <div style={{ display: "flex", gap: 8, alignItems: "center", marginBottom: 2 }}>
                      <span style={{ color: "#10b981", fontSize: "0.75rem", fontWeight: 600 }}>{t.day}</span>
                      <span style={{ color: "#e2e8f0", fontWeight: 600 }}>{t.title}</span>
                    </div>
                    <p style={{ color: "#64748b", fontSize: "0.88rem", margin: 0 }}>{t.desc}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Preview link */}
          {submitResult.previewUrl && (
            <div style={{ background: "#052e16", border: "1px solid #10b981", borderRadius: 12, padding: 20, marginBottom: 24, textAlign: "center" }}>
              <p style={{ color: "#10b981", fontWeight: 600, margin: "0 0 12px" }}>Your preview is ready!</p>
              <a
                href={submitResult.previewUrl}
                target="_blank"
                rel="noopener noreferrer"
                style={{ display: "inline-block", background: "#10b981", color: "#fff", padding: "12px 24px", borderRadius: 8, textDecoration: "none", fontWeight: 600 }}
              >
                View Website Preview →
              </a>
            </div>
          )}

          {/* Contact details */}
          <div style={{ background: "#0f1623", border: "1px solid rgba(255,255,255,0.08)", borderRadius: 16, padding: 24, textAlign: "center" }}>
            <p style={{ color: "#94a3b8", margin: "0 0 12px" }}>Questions? We&apos;re here to help.</p>
            <p style={{ color: "#e2e8f0", margin: "0 0 4px" }}>📧 hello@webgecko.au &nbsp;·&nbsp; 📞 1300 WEBGECKO</p>
            <p style={{ color: "#475569", fontSize: "0.8rem", margin: "12px 0 0" }}>
              Didn&apos;t get an email? Check your spam or contact hello@webgecko.au
            </p>
          </div>
        </div>
      </div>
    );
  }

  // ─── Step renderers ───────────────────────────────────────────────────────────

  const renderStep = () => {
    switch (currentStep?.id) {

      case "business":
        return (
          <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
            <InputField label="Business Name *" value={form.businessName} onChange={(v) => setField("businessName", v)} placeholder="e.g. Sunrise Plumbing" />
            <InputField label="Industry *" value={form.industry} onChange={(v) => setField("industry", v)} placeholder="e.g. Plumbing, Dentist, Real Estate" />
            <InputField label="Business Address" value={form.businessAddress} onChange={(v) => setField("businessAddress", v)} placeholder="123 Main St, Brisbane QLD 4000" hint="Used for Google Maps embed on your site" />
            <InputField label="Target Audience" value={form.targetAudience} onChange={(v) => setField("targetAudience", v)} placeholder="e.g. Home owners in Brisbane" />
            <InputField label="Unique Selling Point" value={form.usp} onChange={(v) => setField("usp", v)} placeholder="What makes you different?" />
            <InputField label="Existing Website (optional)" value={form.existingWebsite} onChange={(v) => setField("existingWebsite", v)} placeholder="https://yoursite.com.au" />
          </div>
        );

      case "goals":
        return (
          <div style={{ display: "flex", flexDirection: "column", gap: 24 }}>
            <div>
              <label style={labelStyle}>Main Goal *</label>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
                {GOAL_OPTIONS.map((g) => (
                  <button
                    key={g}
                    onClick={() => setField("goal", g)}
                    style={{
                      ...radioCardStyle,
                      borderColor: form.goal === g ? "#10b981" : "rgba(255,255,255,0.08)",
                      background: form.goal === g ? "rgba(16,185,129,0.08)" : "#0a0f1a",
                    }}
                  >
                    <span style={{ color: form.goal === g ? "#10b981" : "#94a3b8", fontSize: "0.9rem" }}>{g}</span>
                  </button>
                ))}
              </div>
            </div>
            <div>
              <label style={labelStyle}>Website Type *</label>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
                {[
                  { v: "single", label: "Single Page", desc: "Smooth scroll, one URL" },
                  { v: "multi", label: "Multi Page", desc: "Separate pages with navigation" },
                ].map(({ v, label, desc }) => (
                  <button
                    key={v}
                    onClick={() => setField("siteType", v)}
                    style={{
                      ...radioCardStyle,
                      borderColor: form.siteType === v ? "#10b981" : "rgba(255,255,255,0.08)",
                      background: form.siteType === v ? "rgba(16,185,129,0.08)" : "#0a0f1a",
                    }}
                  >
                    <div style={{ color: form.siteType === v ? "#10b981" : "#e2e8f0", fontWeight: 600, marginBottom: 4 }}>{label}</div>
                    <div style={{ color: "#64748b", fontSize: "0.8rem" }}>{desc}</div>
                  </button>
                ))}
              </div>
            </div>
          </div>
        );

      case "pages":
        return (
          <div>
            <p style={{ color: "#94a3b8", marginBottom: 16, fontSize: "0.95rem" }}>Choose the pages you want on your website.</p>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 10 }}>
              {PAGES_OPTIONS.map((p) => {
                const selected = form.pages.includes(p);
                return (
                  <button
                    key={p}
                    onClick={() => toggleArray("pages", p)}
                    style={{
                      padding: "12px 8px",
                      borderRadius: 10,
                      border: `1px solid ${selected ? "#10b981" : "rgba(255,255,255,0.08)"}`,
                      background: selected ? "rgba(16,185,129,0.08)" : "#0a0f1a",
                      color: selected ? "#10b981" : "#94a3b8",
                      cursor: "pointer",
                      fontSize: "0.85rem",
                      fontWeight: selected ? 600 : 400,
                      transition: "all 0.15s",
                    }}
                  >
                    {selected ? "✓ " : ""}{p}
                  </button>
                );
              })}
            </div>
          </div>
        );

      case "features":
        return (
          <div>
            <p style={{ color: "#94a3b8", marginBottom: 16, fontSize: "0.95rem" }}>Select the features you want included.</p>
            <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
              {FEATURE_BUNDLES.map((bundle) => {
                const active = bundle.features.every((f) => form.features.includes(f));
                return (
                  <button
                    key={bundle.id}
                    onClick={() => toggleBundle(bundle.features)}
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: 16,
                      padding: "16px 20px",
                      borderRadius: 12,
                      border: `1px solid ${active ? "#10b981" : "rgba(255,255,255,0.08)"}`,
                      background: active ? "rgba(16,185,129,0.08)" : "#0a0f1a",
                      cursor: "pointer",
                      textAlign: "left",
                      transition: "all 0.15s",
                      width: "100%",
                    }}
                  >
                    <span style={{ fontSize: 28, flexShrink: 0 }}>{bundle.icon}</span>
                    <div style={{ flex: 1 }}>
                      <div style={{ color: active ? "#10b981" : "#e2e8f0", fontWeight: 600, marginBottom: 2 }}>{bundle.label}</div>
                      <div style={{ color: "#64748b", fontSize: "0.82rem" }}>{bundle.desc}</div>
                    </div>
                    <div style={{
                      width: 22, height: 22, borderRadius: 6,
                      border: `2px solid ${active ? "#10b981" : "rgba(255,255,255,0.2)"}`,
                      background: active ? "#10b981" : "transparent",
                      display: "flex", alignItems: "center", justifyContent: "center",
                      flexShrink: 0,
                    }}>
                      {active && <span style={{ color: "#fff", fontSize: 13, fontWeight: 700 }}>✓</span>}
                    </div>
                  </button>
                );
              })}
            </div>
          </div>
        );

      case "pricing":
        return (
          <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
            <div>
              <label style={labelStyle}>Do you want to display pricing on your website? *</label>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
                {["Yes", "No"].map((v) => (
                  <button
                    key={v}
                    onClick={() => setField("hasPricing", v)}
                    style={{
                      ...radioCardStyle,
                      borderColor: form.hasPricing === v ? "#10b981" : "rgba(255,255,255,0.08)",
                      background: form.hasPricing === v ? "rgba(16,185,129,0.08)" : "#0a0f1a",
                    }}
                  >
                    <span style={{ color: form.hasPricing === v ? "#10b981" : "#94a3b8", fontWeight: 600 }}>{v}</span>
                  </button>
                ))}
              </div>
            </div>
            {form.hasPricing === "Yes" && (
              <div>
                <label style={labelStyle}>Pricing Type *</label>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
                  {["Fixed prices", "Quote-based", "Subscription", "Hourly rates"].map((v) => (
                    <button
                      key={v}
                      onClick={() => setField("pricingType", v)}
                      style={{
                        ...radioCardStyle,
                        borderColor: form.pricingType === v ? "#10b981" : "rgba(255,255,255,0.08)",
                        background: form.pricingType === v ? "rgba(16,185,129,0.08)" : "#0a0f1a",
                      }}
                    >
                      <span style={{ color: form.pricingType === v ? "#10b981" : "#94a3b8", fontSize: "0.9rem" }}>{v}</span>
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>
        );

      case "pricing_details":
        return (
          <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
            <div>
              <label style={labelStyle}>How will you provide your pricing? *</label>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
                {[
                  { v: "manual", label: "I'll type it in", desc: "Enter prices manually" },
                  { v: "url", label: "Link to page", desc: "URL with pricing info" },
                  { v: "upload", label: "Upload file", desc: "PDF or image" },
                  { v: "weknow", label: "You decide", desc: "Use industry standard" },
                ].map(({ v, label, desc }) => (
                  <button
                    key={v}
                    onClick={() => setField("pricingMethod", v)}
                    style={{
                      ...radioCardStyle,
                      borderColor: form.pricingMethod === v ? "#10b981" : "rgba(255,255,255,0.08)",
                      background: form.pricingMethod === v ? "rgba(16,185,129,0.08)" : "#0a0f1a",
                    }}
                  >
                    <div style={{ color: form.pricingMethod === v ? "#10b981" : "#e2e8f0", fontWeight: 600, marginBottom: 4 }}>{label}</div>
                    <div style={{ color: "#64748b", fontSize: "0.8rem" }}>{desc}</div>
                  </button>
                ))}
              </div>
            </div>
            {form.pricingMethod === "manual" && (
              <div>
                <label style={labelStyle}>Enter your pricing details</label>
                <textarea
                  value={form.pricingDetails}
                  onChange={(e) => setField("pricingDetails", e.target.value)}
                  placeholder="e.g. Basic service $150, Premium $280..."
                  style={{ ...inputStyle, minHeight: 120, resize: "vertical" as const }}
                />
              </div>
            )}
            {form.pricingMethod === "url" && (
              <InputField label="URL with pricing info" value={form.pricingUrl} onChange={(v) => setField("pricingUrl", v)} placeholder="https://..." />
            )}
          </div>
        );

      case "design":
        return (
          <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
            <div>
              <label style={labelStyle}>Design Style *</label>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
                {STYLE_OPTIONS.map((s) => (
                  <button
                    key={s}
                    onClick={() => setField("style", s)}
                    style={{
                      ...radioCardStyle,
                      borderColor: form.style === s ? "#10b981" : "rgba(255,255,255,0.08)",
                      background: form.style === s ? "rgba(16,185,129,0.08)" : "#0a0f1a",
                    }}
                  >
                    <span style={{ color: form.style === s ? "#10b981" : "#94a3b8", fontSize: "0.88rem" }}>{s}</span>
                  </button>
                ))}
              </div>
            </div>
            <InputField label="Colour preferences" value={form.colorPrefs} onChange={(v) => setField("colorPrefs", v)} placeholder="e.g. Navy blue and gold, or green tones" />
            <InputField label="Reference websites (optional)" value={form.references} onChange={(v) => setField("references", v)} placeholder="Sites you like the look of" />
            <div>
              <label style={labelStyle}>Do you have a logo?</label>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
                {["Yes", "No"].map((v) => (
                  <button
                    key={v}
                    onClick={() => setField("hasLogo", v)}
                    style={{
                      ...radioCardStyle,
                      borderColor: form.hasLogo === v ? "#10b981" : "rgba(255,255,255,0.08)",
                      background: form.hasLogo === v ? "rgba(16,185,129,0.08)" : "#0a0f1a",
                    }}
                  >
                    <span style={{ color: form.hasLogo === v ? "#10b981" : "#94a3b8", fontWeight: 600 }}>{v}</span>
                  </button>
                ))}
              </div>
            </div>
          </div>
        );

      case "assets":
        return (
          <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
            {form.hasLogo === "Yes" && (
              <FileUploadField
                label="Upload your logo"
                accept="image/*"
                file={logoFile}
                onChange={async (f) => {
                  if (f) {
                    const c = await compressImage(f, 400, 85);
                    setLogoFile(c);
                  } else {
                    setLogoFile(null);
                  }
                }}
              />
            )}
            <FileUploadField
              label="Hero / banner image (optional)"
              accept="image/*"
              file={heroFile}
              onChange={async (f) => {
                if (f) {
                  const c = await compressImage(f, 1400, 75);
                  setHeroFile(c);
                } else {
                  setHeroFile(null);
                }
              }}
            />
            <div>
              <label style={labelStyle}>Additional photos (up to 5)</label>
              <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                {photoFiles.map((pf, i) => (
                  <FileUploadField
                    key={i}
                    label={`Photo ${i + 1}`}
                    accept="image/*"
                    file={pf}
                    onChange={async (f) => {
                      const newArr = [...photoFiles];
                      if (f) {
                        const c = await compressImage(f, 1000, 70);
                        newArr[i] = c;
                      } else {
                        newArr[i] = null;
                      }
                      setPhotoFiles(newArr);
                    }}
                  />
                ))}
              </div>
            </div>
          </div>
        );

      case "contact":
        return (
          <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
            <div>
              <label style={labelStyle}>Do you have content ready? (text, descriptions)</label>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
                {["Yes", "No"].map((v) => (
                  <button
                    key={v}
                    onClick={() => setField("hasContent", v)}
                    style={{
                      ...radioCardStyle,
                      borderColor: form.hasContent === v ? "#10b981" : "rgba(255,255,255,0.08)",
                      background: form.hasContent === v ? "rgba(16,185,129,0.08)" : "#0a0f1a",
                    }}
                  >
                    <span style={{ color: form.hasContent === v ? "#10b981" : "#94a3b8", fontWeight: 600 }}>{v}</span>
                  </button>
                ))}
              </div>
            </div>
            <div>
              <label style={labelStyle}>Additional notes (optional)</label>
              <textarea
                value={form.additionalNotes}
                onChange={(e) => setField("additionalNotes", e.target.value)}
                placeholder="Anything else we should know..."
                style={{ ...inputStyle, minHeight: 90, resize: "vertical" as const }}
              />
            </div>
            <InputField label="Your Full Name *" value={form.name} onChange={(v) => setField("name", v)} placeholder="Jane Smith" />
            <InputField label="Email Address *" value={form.email} onChange={(v) => setField("email", v)} placeholder="jane@example.com" type="email" />
            <InputField label="Phone Number *" value={form.phone} onChange={(v) => setField("phone", v)} placeholder="0400 000 000" type="tel" />
            <InputField
              label="ABN (optional)"
              value={form.abn}
              onChange={(v) => setField("abn", v)}
              placeholder="12 345 678 901"
              hint="Required to register your .com.au domain. You can provide this later."
            />

            {/* Quote summary */}
            <div style={{ background: "#0a0f1a", borderRadius: 12, padding: 20, border: "1px solid rgba(255,255,255,0.08)", marginTop: 8 }}>
              <div style={{ color: "#64748b", fontSize: "0.75rem", textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: 12 }}>Your Quote Summary</div>
              <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 8 }}>
                <span style={{ color: "#94a3b8" }}>Package</span>
                <span style={{ color: "#10b981", fontWeight: 700 }}>{quote.packageName}</span>
              </div>
              <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 8 }}>
                <span style={{ color: "#94a3b8" }}>Total</span>
                <span style={{ color: "#ffffff", fontWeight: 700 }}>${quote.totalPrice.toLocaleString()}</span>
              </div>
              <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 8 }}>
                <span style={{ color: "#94a3b8" }}>Deposit</span>
                <span style={{ color: "#e2e8f0" }}>${quote.deposit.toLocaleString()}</span>
              </div>
              <div style={{ display: "flex", justifyContent: "space-between" }}>
                <span style={{ color: "#94a3b8" }}>Monthly</span>
                <span style={{ color: "#e2e8f0" }}>${quote.monthlyPrice}/mo</span>
              </div>
            </div>

            {/* Turnstile */}
            {process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY && (
              <div>
                <div ref={turnstileRef} style={{ marginTop: 8 }} />
              </div>
            )}

            {error && (
              <div style={{ background: "#2d0a0a", border: "1px solid #ef4444", borderRadius: 10, padding: "14px 16px", color: "#f87171", fontSize: "0.9rem" }}>
                {error}
              </div>
            )}
          </div>
        );

      default:
        return null;
    }
  };

  // ─── Validate current step ────────────────────────────────────────────────────

  const canContinue = () => {
    switch (currentStep?.id) {
      case "business": return !!form.businessName && !!form.industry;
      case "goals": return !!form.goal && !!form.siteType;
      case "pages": return form.pages.length > 0;
      case "features": return true;
      case "pricing": return true;
      case "pricing_details": return !!form.pricingMethod;
      case "design": return !!form.style;
      case "assets": return true;
      case "contact":
        return !!form.name && !!form.email && !!form.phone &&
          (!process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY || !!turnstileToken);
      default: return true;
    }
  };

  // ─── Render ──────────────────────────────────────────────────────────────────

  const stepLabel = currentStep ? (
    STEPS.findIndex((s) => s.id === currentStep.id) + 1
  ) : 1;
  const totalSteps = visibleSteps.length;

  return (
    <div style={{ minHeight: "100vh", background: "#0a0f1a", color: "#e2e8f0", fontFamily: "'Inter', 'Segoe UI', sans-serif" }}>
      {/* Mobile header */}
      <div style={{ background: "#0f1623", borderBottom: "1px solid rgba(255,255,255,0.06)", padding: "16px 20px", display: "flex", alignItems: "center", gap: 12 }}>
        <span style={{ fontSize: 24 }}>🦎</span>
        <span style={{ fontWeight: 700, fontSize: "1.1rem", color: "#10b981" }}>WebGecko</span>
      </div>

      <div style={{ display: "flex", maxWidth: 1100, margin: "0 auto", padding: "0 0 80px" }}>
        {/* Sidebar */}
        <div style={{ width: 280, flexShrink: 0, padding: "32px 24px", display: "none" }} className="sidebar">
          <div style={{ marginBottom: 32 }}>
            <div style={{ fontSize: 32, marginBottom: 4 }}>🦎</div>
            <div style={{ fontWeight: 800, fontSize: "1.3rem", color: "#10b981" }}>WebGecko</div>
            <div style={{ color: "#64748b", fontSize: "0.8rem" }}>Automated Web Design Agency</div>
          </div>

          {/* Step list */}
          <div style={{ marginBottom: 32 }}>
            {visibleSteps.map((s, i) => {
              const done = i < step;
              const current = i === step;
              return (
                <div key={s.id} style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 12, opacity: i > step ? 0.4 : 1 }}>
                  <div style={{
                    width: 24, height: 24, borderRadius: "50%", flexShrink: 0,
                    border: `2px solid ${done || current ? "#10b981" : "rgba(255,255,255,0.15)"}`,
                    background: done ? "#10b981" : "transparent",
                    display: "flex", alignItems: "center", justifyContent: "center",
                    fontSize: 12,
                  }}>
                    {done ? "✓" : <span style={{ color: current ? "#10b981" : "#475569", fontWeight: 600, fontSize: 11 }}>{i + 1}</span>}
                  </div>
                  <span style={{ color: current ? "#e2e8f0" : done ? "#10b981" : "#64748b", fontSize: "0.88rem", fontWeight: current ? 600 : 400 }}>
                    {s.label}
                  </span>
                </div>
              );
            })}
          </div>

          {/* Live summary */}
          {(form.businessName || form.industry) && (
            <div style={{ background: "#0a0f1a", borderRadius: 10, padding: 16, marginBottom: 20, border: "1px solid rgba(255,255,255,0.06)" }}>
              <div style={{ color: "#64748b", fontSize: "0.7rem", textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: 10 }}>Summary</div>
              {form.businessName && <SummaryRow label="Business" value={form.businessName} />}
              {form.industry && <SummaryRow label="Industry" value={form.industry} />}
              {form.goal && <SummaryRow label="Goal" value={form.goal} />}
              {form.siteType && <SummaryRow label="Type" value={form.siteType} />}
              {form.pages.length > 0 && <SummaryRow label="Pages" value={`${form.pages.length} selected`} />}
              {form.name && <SummaryRow label="Name" value={form.name} />}
              {form.abn && <SummaryRow label="ABN" value={form.abn} />}
            </div>
          )}

          {/* Live quote */}
          <div style={{ background: "#0a0f1a", borderRadius: 10, padding: 16, border: "1px solid rgba(255,255,255,0.06)" }}>
            <div style={{ color: "#64748b", fontSize: "0.7rem", textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: 10 }}>Live Quote</div>
            <div style={{ color: "#10b981", fontWeight: 700, fontSize: "1rem", marginBottom: 4 }}>{quote.packageName}</div>
            <div style={{ color: "#ffffff", fontWeight: 800, fontSize: "1.4rem", marginBottom: 8 }}>${quote.totalPrice.toLocaleString()}</div>
            <SummaryRow label="Deposit" value={`$${quote.deposit.toLocaleString()}`} />
            <SummaryRow label="Monthly" value={`$${quote.monthlyPrice}/mo`} />
            <SummaryRow label="You save" value={`$${quote.savings.toLocaleString()}`} accent />
          </div>
        </div>

        {/* Main content */}
        <div style={{ flex: 1, padding: "32px 20px 20px", maxWidth: 680 }}>
          {/* Progress bar */}
          <div style={{ marginBottom: 28 }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
              <span style={{ color: "#64748b", fontSize: "0.8rem" }}>Step {stepLabel} of {totalSteps}</span>
              <span style={{ color: "#10b981", fontSize: "0.8rem", fontWeight: 600 }}>{Math.round((step / (totalSteps - 1)) * 100)}% complete</span>
            </div>
            <div style={{ height: 4, background: "rgba(255,255,255,0.06)", borderRadius: 2 }}>
              <div style={{
                height: "100%",
                width: `${Math.round(((step + 1) / totalSteps) * 100)}%`,
                background: "#10b981",
                borderRadius: 2,
                transition: "width 0.3s ease",
              }} />
            </div>
          </div>

          {/* Step heading */}
          <div style={{ marginBottom: 28 }}>
            <h2 style={{ color: "#ffffff", fontSize: "1.6rem", fontWeight: 700, margin: "0 0 6px" }}>
              {stepHeadings[currentStep?.id || ""] || currentStep?.label}
            </h2>
            <p style={{ color: "#64748b", margin: 0, fontSize: "0.95rem" }}>
              {stepSubheadings[currentStep?.id || ""] || ""}
            </p>
          </div>

          {/* Step content */}
          <div style={{ marginBottom: 32 }}>
            {renderStep()}
          </div>

          {/* Navigation */}
          <div style={{ display: "flex", gap: 12, justifyContent: "space-between" }}>
            <button
              onClick={prev}
              disabled={step === 0}
              style={{
                padding: "13px 24px",
                borderRadius: 10,
                border: "1px solid rgba(255,255,255,0.12)",
                background: "transparent",
                color: step === 0 ? "#374151" : "#94a3b8",
                cursor: step === 0 ? "not-allowed" : "pointer",
                fontSize: "0.95rem",
                fontWeight: 500,
              }}
            >
              ← Back
            </button>

            {isLastStep ? (
              <button
                onClick={handleSubmit}
                disabled={loading || !canContinue()}
                style={{
                  flex: 1,
                  padding: "13px 24px",
                  borderRadius: 10,
                  border: "none",
                  background: canContinue() && !loading ? "#10b981" : "#1f2937",
                  color: canContinue() && !loading ? "#ffffff" : "#64748b",
                  cursor: canContinue() && !loading ? "pointer" : "not-allowed",
                  fontSize: "1rem",
                  fontWeight: 600,
                  transition: "all 0.15s",
                }}
              >
                {loading ? "Building your website…" : "Submit & Build My Website 🚀"}
              </button>
            ) : (
              <button
                onClick={next}
                disabled={!canContinue()}
                style={{
                  flex: 1,
                  padding: "13px 24px",
                  borderRadius: 10,
                  border: "none",
                  background: canContinue() ? "#10b981" : "#1f2937",
                  color: canContinue() ? "#ffffff" : "#64748b",
                  cursor: canContinue() ? "pointer" : "not-allowed",
                  fontSize: "1rem",
                  fontWeight: 600,
                  transition: "all 0.15s",
                }}
              >
                Continue →
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── Shared styles ────────────────────────────────────────────────────────────

const inputStyle: React.CSSProperties = {
  width: "100%",
  background: "rgba(15,22,35,0.8)",
  border: "1px solid rgba(255,255,255,0.1)",
  borderRadius: 12,
  color: "#e2e8f0",
  padding: "14px 16px",
  fontSize: "0.95rem",
  outline: "none",
  fontFamily: "inherit",
  height: 56,
  boxSizing: "border-box",
};

const labelStyle: React.CSSProperties = {
  display: "block",
  color: "#94a3b8",
  fontSize: "0.85rem",
  marginBottom: 8,
  fontWeight: 500,
};

const radioCardStyle: React.CSSProperties = {
  padding: "14px 16px",
  borderRadius: 12,
  border: "1px solid rgba(255,255,255,0.08)",
  background: "#0a0f1a",
  cursor: "pointer",
  textAlign: "left",
  transition: "all 0.15s",
  width: "100%",
};

const stepHeadings: Record<string, string> = {
  business: "Tell us about your business",
  goals: "What are your goals?",
  pages: "Which pages do you need?",
  features: "What features do you want?",
  pricing: "Do you want pricing on your site?",
  pricing_details: "Tell us about your pricing",
  design: "How should your site look?",
  assets: "Upload your assets",
  contact: "Your contact details",
};

const stepSubheadings: Record<string, string> = {
  business: "This helps us build a site that truly represents your brand",
  goals: "We'll optimise your site to achieve what matters most",
  pages: "Select all the sections you want included",
  features: "Bundle features to add powerful functionality",
  pricing: "Display your services and pricing clearly",
  pricing_details: "Help us show your pricing the right way",
  design: "Tell us the vibe and aesthetic you're going for",
  assets: "Upload any images you have — we'll handle the rest",
  contact: "Almost done! We'll send your preview here",
};

// ─── Sub-components ───────────────────────────────────────────────────────────

function InputField({
  label, value, onChange, placeholder, hint, type = "text",
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  hint?: string;
  type?: string;
}) {
  return (
    <div>
      <label style={labelStyle}>{label}</label>
      <input
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        style={inputStyle}
      />
      {hint && <p style={{ color: "#475569", fontSize: "0.78rem", margin: "6px 0 0" }}>{hint}</p>}
    </div>
  );
}

function FileUploadField({
  label, accept, file, onChange,
}: {
  label: string;
  accept: string;
  file: File | null;
  onChange: (f: File | null) => void;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  return (
    <div>
      <label style={labelStyle}>{label}</label>
      <div
        onClick={() => inputRef.current?.click()}
        style={{
          border: `2px dashed ${file ? "#10b981" : "rgba(255,255,255,0.12)"}`,
          borderRadius: 12,
          padding: "20px 16px",
          textAlign: "center",
          cursor: "pointer",
          background: file ? "rgba(16,185,129,0.05)" : "transparent",
          transition: "all 0.15s",
        }}
      >
        <div style={{ fontSize: 24, marginBottom: 6 }}>{file ? "✅" : "📁"}</div>
        <div style={{ color: file ? "#10b981" : "#64748b", fontSize: "0.88rem" }}>
          {file ? file.name : "Click to upload"}
        </div>
        {file && (
          <button
            onClick={(e) => { e.stopPropagation(); onChange(null); }}
            style={{ marginTop: 8, background: "none", border: "none", color: "#ef4444", cursor: "pointer", fontSize: "0.8rem" }}
          >
            Remove
          </button>
        )}
      </div>
      <input
        ref={inputRef}
        type="file"
        accept={accept}
        style={{ display: "none" }}
        onChange={(e) => {
          const f = e.target.files?.[0] || null;
          onChange(f);
          e.target.value = "";
        }}
      />
    </div>
  );
}

function SummaryRow({ label, value, accent }: { label: string; value: string; accent?: boolean }) {
  return (
    <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 6 }}>
      <span style={{ color: "#475569", fontSize: "0.78rem" }}>{label}</span>
      <span style={{ color: accent ? "#10b981" : "#94a3b8", fontSize: "0.78rem", fontWeight: accent ? 600 : 400, textAlign: "right", maxWidth: 140, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{value}</span>
    </div>
  );
}