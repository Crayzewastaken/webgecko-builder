"use client";

import { useState, useMemo, useRef } from "react";

function calculateQuote(pages: string[], features: string[], siteType: string) {
  const pageCount = pages.length || 1;
  const hasEcommerce = features.includes('Payments / Shop');
  const hasBooking = features.includes('Booking System');
  const hasBlog = features.includes('Blog');
  const isMultiPage = siteType === 'multi';

  let packageName = 'Starter';
  let basePrice = 1800;
  let competitorPrice = 3500;

  if (pageCount >= 8 || hasEcommerce || hasBooking) { packageName = 'Premium'; basePrice = 5500; competitorPrice = 15000; }
  else if (pageCount >= 4 || isMultiPage) { packageName = 'Business'; basePrice = 3200; competitorPrice = 7500; }

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
  const [existingWebsite, setExistingWebsite] = useState("");
  const [targetAudience, setTargetAudience] = useState("");
  const [goal, setGoal] = useState("");
  const [siteType, setSiteType] = useState("");
  const [pages, setPages] = useState<string[]>([]);
  const [features, setFeatures] = useState<string[]>([]);
  const [hasPricing, setHasPricing] = useState("");
  const [pricingType, setPricingType] = useState("");
  const [pricingDetails, setPricingDetails] = useState("");
  const [style, setStyle] = useState("");
  const [colorPrefs, setColorPrefs] = useState("");
  const [references, setReferences] = useState("");
  const [hasLogo, setHasLogo] = useState("");
  const [hasContent, setHasContent] = useState("");
  const [hasImages, setHasImages] = useState("");
  const [additionalNotes, setAdditionalNotes] = useState("");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");

  // Image uploads
  const [logoFile, setLogoFile] = useState<File | null>(null);
  const [heroFile, setHeroFile] = useState<File | null>(null);
  const [photoFiles, setPhotoFiles] = useState<File[]>([]);
  const logoRef = useRef<HTMLInputElement>(null);
  const heroRef = useRef<HTMLInputElement>(null);
  const photosRef = useRef<HTMLInputElement>(null);

  const totalSteps = 9;

  const quote = useMemo(() => {
    if (pages.length === 0 && features.length === 0 && !siteType) return null;
    return calculateQuote(pages, features, siteType);
  }, [pages, features, siteType]);

  function toggleItem(arr: string[], value: string, setFn: any) {
    if (arr.includes(value)) setFn(arr.filter((v) => v !== value));
    else setFn([...arr, value]);
  }

  function handlePhotoChange(e: React.ChangeEvent<HTMLInputElement>) {
    const files = Array.from(e.target.files || []);
    setPhotoFiles(prev => [...prev, ...files].slice(0, 5));
  }

  async function submit() {
    setLoading(true);
    setMessage("Uploading your assets...");

    const formData = new FormData();

    // Text fields
    const fields: Record<string, string> = {
      businessName, industry, usp, existingWebsite, targetAudience,
      goal, siteType, hasPricing, pricingType, pricingDetails,
      style, colorPrefs, references, hasLogo, hasContent, hasImages,
      additionalNotes, name, email, phone,
    };
    Object.entries(fields).forEach(([key, val]) => formData.append(key, val));
    formData.append("pages", JSON.stringify(pages));
    formData.append("features", JSON.stringify(features));

    // Image files
    if (logoFile) formData.append("logo", logoFile);
    if (heroFile) formData.append("hero", heroFile);
    photoFiles.forEach((file, i) => formData.append(`photo_${i}`, file));

    try {
      const res = await fetch("/api/worker", {
        method: "POST",
        body: formData,
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

  const FileUploadBox = ({ label, file, onFile, inputRef, accept, hint }: any) => (
    <div
      onClick={() => inputRef.current?.click()}
      className="border-2 border-dashed border-white/20 rounded-2xl p-6 cursor-pointer hover:border-white/40 transition-all text-center"
    >
      <input ref={inputRef} type="file" accept={accept} className="hidden" onChange={(e) => {
        const f = e.target.files?.[0];
        if (f) onFile(f);
      }} />
      {file ? (
        <div>
          <p className="text-emerald-400 font-semibold">✓ {file.name}</p>
          <p className="text-slate-500 text-xs mt-1">{(file.size / 1024).toFixed(0)}KB</p>
        </div>
      ) : (
        <div>
          <p className="text-slate-300 font-semibold">{label}</p>
          <p className="text-slate-500 text-sm mt-1">{hint}</p>
        </div>
      )}
    </div>
  );

  return (
    <main className="min-h-screen bg-[#0f172a] text-white p-6 md:p-10">
      <div className="max-w-6xl mx-auto grid lg:grid-cols-[1fr_340px] gap-6">

        <div className="rounded-[2rem] bg-[#111827] border border-white/10 p-8 shadow-2xl">
          <p className="text-sm uppercase tracking-widest text-slate-400">Project Brief</p>
          <h1 className="text-3xl md:text-4xl font-semibold mt-2">Website Project Questionnaire</h1>

          <div className="mt-6 h-2 bg-white/10 rounded-full overflow-hidden">
            <div className="h-full bg-white transition-all" style={{ width: `${(step / totalSteps) * 100}%` }} />
          </div>
          <p className="text-slate-500 text-xs mt-2">Step {step} of {totalSteps}</p>

          {step === 1 && (
            <div className="space-y-4 mt-8">
              <p className="text-white font-semibold text-lg">Tell us about your business</p>
              <input placeholder="Business Name" value={businessName} onChange={(e) => setBusinessName(e.target.value)} className="input" />
              <input placeholder="Industry (e.g. Real Estate, Fitness, Retail)" value={industry} onChange={(e) => setIndustry(e.target.value)} className="input" />
              <input placeholder="Target Audience (e.g. Young professionals in Brisbane)" value={targetAudience} onChange={(e) => setTargetAudience(e.target.value)} className="input" />
              <textarea placeholder="What makes your business unique?" value={usp} onChange={(e) => setUsp(e.target.value)} className="textarea" />
              <input placeholder="Existing website URL (if any)" value={existingWebsite} onChange={(e) => setExistingWebsite(e.target.value)} className="input" />
            </div>
          )}

          {step === 2 && (
            <div className="space-y-4 mt-8">
              <p className="text-white font-semibold text-lg">What do you need the website to do?</p>
              <select value={goal} onChange={(e) => setGoal(e.target.value)} className="input">
                <option value="">Main goal of your website</option>
                <option>Generate leads</option>
                <option>Sell products online</option>
                <option>Accept bookings</option>
                <option>Showcase portfolio</option>
                <option>Provide information</option>
                <option>Build brand awareness</option>
              </select>
              <p className="text-slate-400 text-sm mt-4 mb-2">What type of website?</p>
              <div className="grid gap-3">
                {[
                  { value: "single", label: "Single Page", desc: "Everything on one scrollable page." },
                  { value: "multi", label: "Multi Page", desc: "Separate pages like Home, About, Services, Contact." },
                ].map((opt) => (
                  <label key={opt.value} className={`card cursor-pointer border-2 transition-all ${siteType === opt.value ? "border-white" : "border-transparent"}`}>
                    <input type="radio" name="siteType" value={opt.value} checked={siteType === opt.value} onChange={() => setSiteType(opt.value)} className="hidden" />
                    <div><p className="font-semibold">{opt.label}</p><p className="text-slate-400 text-sm">{opt.desc}</p></div>
                  </label>
                ))}
              </div>
            </div>
          )}

          {step === 3 && (
            <div className="grid gap-3 mt-8">
              <p className="text-white font-semibold text-lg">Select the pages you want</p>
              {["Home", "About", "Services", "Contact", "Shop", "Gallery", "Blog", "Booking", "FAQ", "Testimonials", "Pricing", "Portfolio", "Team"].map(p => (
                <label key={p} className="card cursor-pointer">
                  <input type="checkbox" checked={pages.includes(p)} onChange={() => toggleItem(pages, p, setPages)} />
                  <span>{p}</span>
                </label>
              ))}
            </div>
          )}

          {step === 4 && (
            <div className="grid gap-3 mt-8">
              <p className="text-white font-semibold text-lg">Select features you need</p>
              {["Contact Form", "Booking System", "Payments / Shop", "Blog", "Reviews & Testimonials", "Live Chat", "Photo Gallery", "FAQ Section", "Newsletter Signup", "Social Media Links", "Google Maps", "Video Background", "Countdown Timer", "Pop-up Form"].map(f => (
                <label key={f} className="card cursor-pointer">
                  <input type="checkbox" checked={features.includes(f)} onChange={() => toggleItem(features, f, setFeatures)} />
                  <span>{f}</span>
                </label>
              ))}
            </div>
          )}

          {step === 5 && (
            <div className="space-y-4 mt-8">
              <p className="text-white font-semibold text-lg">Do you need a pricing section?</p>
              <div className="grid gap-3">
                {["Yes", "No"].map(opt => (
                  <label key={opt} className={`card cursor-pointer border-2 transition-all ${hasPricing === opt ? "border-white" : "border-transparent"}`}>
                    <input type="radio" name="hasPricing" checked={hasPricing === opt} onChange={() => setHasPricing(opt)} className="hidden" />
                    <span>{opt}</span>
                  </label>
                ))}
              </div>
              {hasPricing === "Yes" && (
                <>
                  <p className="text-slate-400 text-sm mt-4">What type of pricing?</p>
                  <div className="grid gap-3">
                    {[
                      { value: "tiers", label: "Pricing Tiers", desc: "Starter / Business / Premium packages" },
                      { value: "products", label: "Individual Products", desc: "Each product/service has its own price" },
                      { value: "quote", label: "Quote Based", desc: "Customers request a custom quote" },
                      { value: "hourly", label: "Hourly / Day Rate", desc: "You charge by the hour or day" },
                    ].map(opt => (
                      <label key={opt.value} className={`card cursor-pointer border-2 transition-all ${pricingType === opt.value ? "border-white" : "border-transparent"}`}>
                        <input type="radio" name="pricingType" checked={pricingType === opt.value} onChange={() => setPricingType(opt.value)} className="hidden" />
                        <div><p className="font-semibold">{opt.label}</p><p className="text-slate-400 text-sm">{opt.desc}</p></div>
                      </label>
                    ))}
                  </div>
                  <textarea
                    placeholder={
                      pricingType === "tiers" ? "e.g. Starter $99/month - X, Y, Z. Business $199/month - A, B, C"
                      : pricingType === "products" ? "e.g. Haircut $45, Colour $120, Treatment $80"
                      : pricingType === "hourly" ? "e.g. $85/hour, minimum 2 hours. Day rate $600"
                      : "Describe how your quoting works"
                    }
                    value={pricingDetails}
                    onChange={(e) => setPricingDetails(e.target.value)}
                    className="textarea mt-4"
                  />
                </>
              )}
            </div>
          )}

          {step === 6 && (
            <div className="space-y-4 mt-8">
              <p className="text-white font-semibold text-lg">Design preferences</p>
              <input placeholder="Style (e.g. Luxury dark, Clean minimal, Bold modern)" value={style} onChange={(e) => setStyle(e.target.value)} className="input" />
              <input placeholder="Colour preferences (e.g. Navy blue and gold, Black and white)" value={colorPrefs} onChange={(e) => setColorPrefs(e.target.value)} className="input" />
              <textarea placeholder="Websites you like for reference (paste links or describe)" value={references} onChange={(e) => setReferences(e.target.value)} className="textarea" />
              <p className="text-slate-400 text-sm mt-2">Do you have a logo?</p>
              <div className="grid gap-3">
                {["Yes — I will provide it", "No — I need one designed", "No — please use text only"].map(opt => (
                  <label key={opt} className={`card cursor-pointer border-2 transition-all ${hasLogo === opt ? "border-white" : "border-transparent"}`}>
                    <input type="radio" name="hasLogo" checked={hasLogo === opt} onChange={() => setHasLogo(opt)} className="hidden" />
                    <span className="text-sm">{opt}</span>
                  </label>
                ))}
              </div>
            </div>
          )}

          {step === 7 && (
            <div className="space-y-4 mt-8">
              <p className="text-white font-semibold text-lg">Upload your assets</p>
              <p className="text-slate-400 text-sm">Upload your logo, hero image and any photos. These will be used directly in your website.</p>

              <FileUploadBox
                label="Upload Your Logo"
                hint="PNG, SVG or JPG — max 2MB"
                file={logoFile}
                onFile={setLogoFile}
                inputRef={logoRef}
                accept="image/*"
              />

              <FileUploadBox
                label="Upload Hero / Banner Image"
                hint="Main background image — JPG or PNG, max 3MB"
                file={heroFile}
                onFile={setHeroFile}
                inputRef={heroRef}
                accept="image/*"
              />

              <div
                onClick={() => photosRef.current?.click()}
                className="border-2 border-dashed border-white/20 rounded-2xl p-6 cursor-pointer hover:border-white/40 transition-all text-center"
              >
                <input ref={photosRef} type="file" accept="image/*" multiple className="hidden" onChange={handlePhotoChange} />
                <p className="text-slate-300 font-semibold">Upload Additional Photos</p>
                <p className="text-slate-500 text-sm mt-1">Up to 5 photos — JPG or PNG, max 1MB each</p>
                {photoFiles.length > 0 && (
                  <div className="mt-3 space-y-1">
                    {photoFiles.map((f, i) => (
                      <p key={i} className="text-emerald-400 text-sm">✓ {f.name}</p>
                    ))}
                  </div>
                )}
              </div>

              <p className="text-slate-500 text-xs">Don't have images yet? Skip this step — we'll use professional stock images.</p>
            </div>
          )}

          {step === 8 && (
            <div className="space-y-4 mt-8">
              <p className="text-white font-semibold text-lg">Content & anything else</p>
              <p className="text-slate-400 text-sm">Do you have website copy/text ready?</p>
              <div className="grid gap-3">
                {["Yes — I will provide all text", "Partially — I have some text", "No — please write it for me"].map(opt => (
                  <label key={opt} className={`card cursor-pointer border-2 transition-all ${hasContent === opt ? "border-white" : "border-transparent"}`}>
                    <input type="radio" name="hasContent" checked={hasContent === opt} onChange={() => setHasContent(opt)} className="hidden" />
                    <span className="text-sm">{opt}</span>
                  </label>
                ))}
              </div>
              <textarea placeholder="Anything else we should know? Deadline, special requirements, competitors, anything" value={additionalNotes} onChange={(e) => setAdditionalNotes(e.target.value)} className="textarea mt-4" />
            </div>
          )}

          {step === 9 && (
            <div className="space-y-4 mt-8">
              <p className="text-white font-semibold text-lg">Your contact details</p>
              <p className="text-slate-400 text-sm">We will send a confirmation to your email and be in touch within 24 hours.</p>
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

        <div className="hidden lg:block">
          <div className="rounded-[2rem] bg-black border border-white/10 p-6 sticky top-10">
            <h2 className="text-xl font-semibold">Progress</h2>
            <p className="text-slate-400 mt-2 text-sm">Step {step} of {totalSteps}</p>
            <div className="mt-6 space-y-2 text-sm text-slate-500">
              <p>Business: {businessName || "-"}</p>
              <p>Industry: {industry || "-"}</p>
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