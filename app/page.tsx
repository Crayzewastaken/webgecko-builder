"use client";

import { useState, useMemo, useRef, useEffect } from "react";

function calculateQuote(pages: string[], features: string[], siteType: string) {
  const pageCount = pages.length || 1;
  const hasEcommerce = features.includes('Payments / Shop');
  const hasBooking = features.includes('Booking System');
  const hasBlog = features.includes('Blog');
  const isMultiPage = siteType === 'multi';
  let packageName = 'Starter'; let basePrice = 1800; let competitorPrice = 3500;
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

async function compressImage(file: File, maxWidthPx = 1200, qualityVal = 0.75): Promise<File> {
  return new Promise((resolve) => {
    const img = new Image();
    const url = URL.createObjectURL(file);
    img.onload = () => {
      const canvas = document.createElement('canvas');
      let { width, height } = img;
      if (width > maxWidthPx) { height = Math.round((height * maxWidthPx) / width); width = maxWidthPx; }
      canvas.width = width; canvas.height = height;
      const ctx = canvas.getContext('2d')!;
      ctx.drawImage(img, 0, 0, width, height);
      canvas.toBlob((blob) => {
        URL.revokeObjectURL(url);
        if (blob) resolve(new File([blob], file.name.replace(/\.[^.]+$/, '.jpg'), { type: 'image/jpeg' }));
        else resolve(file);
      }, 'image/jpeg', qualityVal);
    };
    img.src = url;
  });
}

type Product = { name: string; price: string; photo: File | null };

const STORAGE_KEY = 'webgecko_form';

function saveToStorage(data: any) {
  try { localStorage.setItem(STORAGE_KEY, JSON.stringify(data)); } catch (e) {}
}

function loadFromStorage() {
  try { const d = localStorage.getItem(STORAGE_KEY); return d ? JSON.parse(d) : null; } catch (e) { return null; }
}

const InputField = ({ icon, label, value, onChange, placeholder, required, type = 'text' }: any) => (
  <div className="relative">
    <label className="block text-xs font-semibold text-slate-400 uppercase tracking-widest mb-2">
      {icon} {label} {required && <span className="text-red-400">*</span>}
    </label>
    <input
      type={type}
      value={value}
      onChange={onChange}
      placeholder={placeholder}
      required={required}
      className="w-full h-14 rounded-2xl bg-slate-900/80 border border-white/10 px-5 text-white placeholder:text-slate-600 focus:outline-none focus:border-emerald-500/50 focus:bg-slate-900 transition-all"
    />
  </div>
);

const TextAreaField = ({ icon, label, value, onChange, placeholder, required }: any) => (
  <div className="relative">
    <label className="block text-xs font-semibold text-slate-400 uppercase tracking-widest mb-2">
      {icon} {label} {required && <span className="text-red-400">*</span>}
    </label>
    <textarea
      value={value}
      onChange={onChange}
      placeholder={placeholder}
      required={required}
      className="w-full min-h-[120px] rounded-2xl bg-slate-900/80 border border-white/10 px-5 py-4 text-white placeholder:text-slate-600 focus:outline-none focus:border-emerald-500/50 focus:bg-slate-900 transition-all resize-none"
    />
  </div>
);

const SelectCard = ({ value, selected, onClick, label, desc, icon }: any) => (
  <div
    onClick={onClick}
    className={`cursor-pointer rounded-2xl p-4 border-2 transition-all ${selected ? 'border-emerald-500 bg-emerald-500/10' : 'border-white/10 bg-slate-900/50 hover:border-white/30'}`}
  >
    <div className="flex items-start gap-3">
      <div className={`w-5 h-5 rounded-full border-2 flex-shrink-0 mt-0.5 flex items-center justify-center ${selected ? 'border-emerald-500 bg-emerald-500' : 'border-white/30'}`}>
        {selected && <div className="w-2 h-2 rounded-full bg-white" />}
      </div>
      <div>
        <p className="font-semibold text-white">{icon && <span className="mr-2">{icon}</span>}{label}</p>
        {desc && <p className="text-slate-400 text-sm mt-0.5">{desc}</p>}
      </div>
    </div>
  </div>
);

const CheckCard = ({ checked, onClick, label }: any) => (
  <div
    onClick={onClick}
    className={`cursor-pointer rounded-xl p-3 border transition-all flex items-center gap-3 ${checked ? 'border-emerald-500 bg-emerald-500/10' : 'border-white/10 bg-slate-900/50 hover:border-white/20'}`}
  >
    <div className={`w-5 h-5 rounded flex-shrink-0 flex items-center justify-center border-2 transition-all ${checked ? 'border-emerald-500 bg-emerald-500' : 'border-white/30'}`}>
      {checked && <span className="text-white text-xs font-bold">✓</span>}
    </div>
    <span className="text-sm text-white">{label}</span>
  </div>
);

export default function HomePage() {
  const [step, setStep] = useState(1);
  const [loading, setLoading] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [compressing, setCompressing] = useState(false);
  const [turnstileToken, setTurnstileToken] = useState("");
  const [turnstileReady, setTurnstileReady] = useState(false);
  const [errors, setErrors] = useState<string[]>([]);
  const turnstileRef = useRef<HTMLDivElement>(null);

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
  const [pricingMethod, setPricingMethod] = useState("");
  const [products, setProducts] = useState<Product[]>([{ name: "", price: "", photo: null }]);
  const [pricingDetails, setPricingDetails] = useState("");
  const [pricingFile, setPricingFile] = useState<File | null>(null);
  const [pricingUrl, setPricingUrl] = useState("");
  const [style, setStyle] = useState("");
  const [colorPrefs, setColorPrefs] = useState("");
  const [references, setReferences] = useState("");
  const [hasLogo, setHasLogo] = useState("");
  const [hasContent, setHasContent] = useState("");
  const [additionalNotes, setAdditionalNotes] = useState("");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");

  const [logoFile, setLogoFile] = useState<File | null>(null);
  const [heroFile, setHeroFile] = useState<File | null>(null);
  const [photoFiles, setPhotoFiles] = useState<File[]>([]);

  const logoRef = useRef<HTMLInputElement>(null);
  const heroRef = useRef<HTMLInputElement>(null);
  const photosRef = useRef<HTMLInputElement>(null);
  const pricingSheetRef = useRef<HTMLInputElement>(null);
  const productPhotoRefs = useRef<(HTMLInputElement | null)[]>([]);

  const totalSteps = 9;

  const quote = useMemo(() => {
    if (pages.length === 0 && features.length === 0 && !siteType) return null;
    return calculateQuote(pages, features, siteType);
  }, [pages, features, siteType]);

  // Load from localStorage on mount
  useEffect(() => {
    const saved = loadFromStorage();
    if (saved) {
      if (saved.businessName) setBusinessName(saved.businessName);
      if (saved.industry) setIndustry(saved.industry);
      if (saved.usp) setUsp(saved.usp);
      if (saved.existingWebsite) setExistingWebsite(saved.existingWebsite);
      if (saved.targetAudience) setTargetAudience(saved.targetAudience);
      if (saved.goal) setGoal(saved.goal);
      if (saved.siteType) setSiteType(saved.siteType);
      if (saved.pages) setPages(saved.pages);
      if (saved.features) setFeatures(saved.features);
      if (saved.hasPricing) setHasPricing(saved.hasPricing);
      if (saved.pricingType) setPricingType(saved.pricingType);
      if (saved.pricingMethod) setPricingMethod(saved.pricingMethod);
      if (saved.pricingDetails) setPricingDetails(saved.pricingDetails);
      if (saved.pricingUrl) setPricingUrl(saved.pricingUrl);
      if (saved.style) setStyle(saved.style);
      if (saved.colorPrefs) setColorPrefs(saved.colorPrefs);
      if (saved.references) setReferences(saved.references);
      if (saved.hasLogo) setHasLogo(saved.hasLogo);
      if (saved.hasContent) setHasContent(saved.hasContent);
      if (saved.additionalNotes) setAdditionalNotes(saved.additionalNotes);
      if (saved.name) setName(saved.name);
      if (saved.email) setEmail(saved.email);
      if (saved.phone) setPhone(saved.phone);
      if (saved.step) setStep(saved.step);
    }
  }, []);

  // Save to localStorage whenever fields change
  useEffect(() => {
    saveToStorage({
      businessName, industry, usp, existingWebsite, targetAudience,
      goal, siteType, pages, features, hasPricing, pricingType,
      pricingMethod, pricingDetails, pricingUrl, style, colorPrefs,
      references, hasLogo, hasContent, additionalNotes, name, email, phone, step,
    });
  }, [businessName, industry, usp, existingWebsite, targetAudience, goal, siteType, pages, features, hasPricing, pricingType, pricingMethod, pricingDetails, pricingUrl, style, colorPrefs, references, hasLogo, hasContent, additionalNotes, name, email, phone, step]);

  // Load Turnstile on final step
  useEffect(() => {
    if (step === totalSteps) {
      const existing = document.querySelector('script[src*="turnstile"]');
      if (existing) {
        setTurnstileReady(true);
        if (turnstileRef.current && (window as any).turnstile) {
          (window as any).turnstile.render(turnstileRef.current, {
            sitekey: process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY,
            callback: (token: string) => setTurnstileToken(token),
            'expired-callback': () => setTurnstileToken(""),
          });
        }
        return;
      }
      const script = document.createElement('script');
      script.src = 'https://challenges.cloudflare.com/turnstile/v0/api.js';
      script.async = true;
      script.onload = () => {
        setTurnstileReady(true);
        setTimeout(() => {
          if (turnstileRef.current && (window as any).turnstile) {
            (window as any).turnstile.render(turnstileRef.current, {
              sitekey: process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY,
              callback: (token: string) => setTurnstileToken(token),
              'expired-callback': () => setTurnstileToken(""),
            });
          }
        }, 100);
      };
      document.head.appendChild(script);
    }
  }, [step]);

  function toggleItem(arr: string[], value: string, setFn: any) {
    if (arr.includes(value)) setFn(arr.filter((v) => v !== value));
    else setFn([...arr, value]);
  }

  function addProduct() { if (products.length < 12) setProducts(prev => [...prev, { name: "", price: "", photo: null }]); }
  function removeProduct(index: number) { setProducts(prev => prev.filter((_, i) => i !== index)); }
  function updateProduct(index: number, field: keyof Product, value: any) {
    setProducts(prev => prev.map((p, i) => i === index ? { ...p, [field]: value } : p));
  }

  async function handleProductPhoto(index: number, file: File) {
    setCompressing(true);
    const compressed = await compressImage(file, 600, 0.6);
    updateProduct(index, 'photo', compressed);
    setCompressing(false);
  }

  async function handleLogoChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]; if (!file) return;
    setCompressing(true); setLogoFile(await compressImage(file, 400, 0.85)); setCompressing(false);
  }

  async function handleHeroChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]; if (!file) return;
    setCompressing(true); setHeroFile(await compressImage(file, 1400, 0.75)); setCompressing(false);
  }

  async function handlePhotoChange(e: React.ChangeEvent<HTMLInputElement>) {
    const files = Array.from(e.target.files || []);
    setCompressing(true);
    const compressed = await Promise.all(files.slice(0, 5).map(f => compressImage(f, 1000, 0.7)));
    setPhotoFiles(prev => [...prev, ...compressed].slice(0, 5));
    setCompressing(false);
  }

  function validateStep(): string[] {
    const errs: string[] = [];
    if (step === 1) {
      if (!businessName.trim()) errs.push("Business name is required");
      if (!industry.trim()) errs.push("Industry is required");
      if (!targetAudience.trim()) errs.push("Target audience is required");
      if (!usp.trim()) errs.push("Please describe what makes your business unique");
    }
    if (step === 2) {
      if (!goal) errs.push("Please select the main goal of your website");
      if (!siteType) errs.push("Please select single page or multi page");
    }
    if (step === 3) {
      if (pages.length === 0) errs.push("Please select at least one page");
    }
    if (step === 5) {
      if (!hasPricing) errs.push("Please select whether you need a pricing section");
    }
    if (step === 9) {
      if (!name.trim()) errs.push("Full name is required");
      if (!email.trim()) errs.push("Email address is required");
      if (!email.includes('@')) errs.push("Please enter a valid email address");
      if (!phone.trim()) errs.push("Phone number is required");
      if (!turnstileToken) errs.push("Please wait for the security check");
    }
    return errs;
  }

  async function submit() {
    const errs = validateStep();
    if (errs.length > 0) { setErrors(errs); return; }

    setLoading(true);
    setErrors([]);

    const formData = new FormData();
    const fields: Record<string, string> = {
      businessName, industry, usp, existingWebsite, targetAudience,
      goal, siteType, hasPricing, pricingType, pricingMethod, pricingDetails, pricingUrl,
      style, colorPrefs, references, hasLogo, hasContent, additionalNotes, name, email, phone,
      turnstileToken,
    };
    Object.entries(fields).forEach(([key, val]) => formData.append(key, val));
    formData.append("pages", JSON.stringify(pages));
    formData.append("features", JSON.stringify(features));
    formData.append("products", JSON.stringify(products.map(p => ({ name: p.name, price: p.price }))));
    products.forEach((p, i) => { if (p.photo) formData.append(`product_photo_${i}`, p.photo); });
    if (pricingFile) formData.append("pricing_sheet", pricingFile);
    if (logoFile) formData.append("logo", logoFile);
    if (heroFile) formData.append("hero", heroFile);
    photoFiles.forEach((file, i) => formData.append(`photo_${i}`, file));

    try {
      const res = await fetch("/api/worker", { method: "POST", body: formData });
      const data = await res.json();
      if (data.success) {
        setSubmitted(true);
        localStorage.removeItem(STORAGE_KEY);
      } else {
        setErrors([data.message || "Something went wrong"]);
      }
    } catch (error: any) {
      setErrors(["Connection error. Please try again."]);
    }
    setLoading(false);
  }

  function next() {
    const errs = validateStep();
    if (errs.length > 0) { setErrors(errs); return; }
    setErrors([]);
    if (step < totalSteps) setStep(step + 1);
    else submit();
  }

  function back() {
    setErrors([]);
    setStep(Math.max(1, step - 1));
  }

  const FileUploadBox = ({ label, file, onChange, inputRef, accept, hint }: any) => (
    <div onClick={() => inputRef.current?.click()} className="border-2 border-dashed border-white/10 rounded-2xl p-6 cursor-pointer hover:border-emerald-500/30 transition-all text-center bg-slate-900/50">
      <input ref={inputRef} type="file" accept={accept} className="hidden" onChange={onChange} />
      {file ? (
        <div><p className="text-emerald-400 font-semibold">✓ {file.name}</p><p className="text-slate-500 text-xs mt-1">{(file.size / 1024).toFixed(0)}KB compressed</p></div>
      ) : (
        <div><p className="text-slate-300 font-semibold">{label}</p><p className="text-slate-500 text-sm mt-1">{hint}</p></div>
      )}
    </div>
  );

  if (submitted) {
    return (
      <main className="min-h-screen bg-[#0a0f1a] text-white flex items-center justify-center p-6">
        <div className="max-w-lg w-full text-center">
          <div className="w-20 h-20 rounded-full bg-emerald-500/20 border-2 border-emerald-500 flex items-center justify-center mx-auto mb-8">
            <span className="text-4xl">✓</span>
          </div>
          <h1 className="text-4xl font-bold mb-4">Request Submitted!</h1>
          <p className="text-slate-400 text-lg mb-6">Your website request has been received. You will receive a confirmation email within <strong className="text-white">2 to 5 minutes</strong>.</p>
          <div className="bg-slate-900/80 border border-white/10 rounded-2xl p-6 text-left space-y-3">
            <p className="text-slate-400 text-sm"><span className="text-white font-semibold">📧 Check your email</span> at <span className="text-emerald-400">{email}</span></p>
            <p className="text-slate-400 text-sm"><span className="text-white font-semibold">📞 We'll call you</span> on <span className="text-emerald-400">{phone}</span> within 24 hours</p>
            <p className="text-slate-400 text-sm"><span className="text-white font-semibold">🌐 Business:</span> {businessName}</p>
          </div>
          <p className="text-slate-600 text-sm mt-8">If you don't receive an email within 5 minutes, please check your spam folder or contact us at hello@webgecko.au</p>
        </div>
      </main>
    );
  }

  const stepTitles = [
    "Your Business",
    "Website Goals",
    "Pages",
    "Features",
    "Pricing",
    hasPricing === "Yes" ? "Pricing Details" : "Design",
    "Design",
    "Assets",
    "Contact",
  ];

  return (
    <main className="min-h-screen bg-[#0a0f1a] text-white p-4 md:p-8">
      <div className="max-w-6xl mx-auto grid lg:grid-cols-[1fr_320px] gap-6">
        <div className="rounded-3xl bg-[#0f1623] border border-white/8 p-6 md:p-10 shadow-2xl">

          {/* Header */}
          <div className="flex items-center gap-3 mb-8">
            <div className="w-10 h-10 rounded-xl bg-emerald-500/20 border border-emerald-500/30 flex items-center justify-center text-emerald-400 font-bold text-sm">{step}</div>
            <div>
              <p className="text-xs text-slate-500 uppercase tracking-widest">Step {step} of {totalSteps}</p>
              <p className="text-white font-semibold">{stepTitles[step - 1]}</p>
            </div>
            <div className="ml-auto text-xs text-slate-600">{Math.round((step / totalSteps) * 100)}%</div>
          </div>

          {/* Progress */}
          <div className="h-1 bg-white/5 rounded-full overflow-hidden mb-8">
            <div className="h-full bg-gradient-to-r from-emerald-500 to-emerald-400 transition-all duration-500 rounded-full" style={{ width: `${(step / totalSteps) * 100}%` }} />
          </div>

          {/* STEP 1 */}
          {step === 1 && (
            <div className="space-y-5">
              <InputField icon="🏢" label="Business Name" value={businessName} onChange={(e: any) => setBusinessName(e.target.value)} placeholder="e.g. Sunrise Bakery" required />
              <InputField icon="🏭" label="Industry" value={industry} onChange={(e: any) => setIndustry(e.target.value)} placeholder="e.g. Food & Hospitality, Real Estate, Fitness" required />
              <InputField icon="🎯" label="Target Audience" value={targetAudience} onChange={(e: any) => setTargetAudience(e.target.value)} placeholder="e.g. Young professionals in Brisbane aged 25-40" required />
              <TextAreaField icon="⭐" label="What makes you unique?" value={usp} onChange={(e: any) => setUsp(e.target.value)} placeholder="What do you offer that competitors don't? What are you known for?" required />
              <InputField icon="🌐" label="Existing Website (optional)" value={existingWebsite} onChange={(e: any) => setExistingWebsite(e.target.value)} placeholder="https://yourwebsite.com.au" />
            </div>
          )}

          {/* STEP 2 */}
          {step === 2 && (
            <div className="space-y-6">
              <div>
                <label className="block text-xs font-semibold text-slate-400 uppercase tracking-widest mb-3">🎯 Main Goal <span className="text-red-400">*</span></label>
                <div className="grid gap-2">
                  {["Generate leads", "Sell products online", "Accept bookings", "Showcase portfolio", "Provide information", "Build brand awareness"].map(opt => (
                    <SelectCard key={opt} selected={goal === opt} onClick={() => setGoal(opt)} label={opt} />
                  ))}
                </div>
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-400 uppercase tracking-widest mb-3">📄 Website Type <span className="text-red-400">*</span></label>
                <div className="grid gap-3">
                  <SelectCard selected={siteType === "single"} onClick={() => setSiteType("single")} label="Single Page" desc="Everything on one scrollable page. Clean, fast and modern." icon="📃" />
                  <SelectCard selected={siteType === "multi"} onClick={() => setSiteType("multi")} label="Multi Page" desc="Separate pages like Home, About, Services, Contact." icon="📑" />
                </div>
              </div>
            </div>
          )}

          {/* STEP 3 */}
          {step === 3 && (
            <div className="space-y-3">
              <label className="block text-xs font-semibold text-slate-400 uppercase tracking-widest mb-3">📑 Select Pages <span className="text-red-400">*</span></label>
              <div className="grid grid-cols-2 gap-2">
                {["Home", "About", "Services", "Contact", "Shop", "Gallery", "Blog", "Booking", "FAQ", "Testimonials", "Pricing", "Portfolio", "Team", "Menu"].map(p => (
                  <CheckCard key={p} checked={pages.includes(p)} onClick={() => toggleItem(pages, p, setPages)} label={p} />
                ))}
              </div>
            </div>
          )}

          {/* STEP 4 */}
          {step === 4 && (
            <div className="space-y-3">
              <label className="block text-xs font-semibold text-slate-400 uppercase tracking-widest mb-3">⚙️ Features Needed</label>
              <div className="grid grid-cols-2 gap-2">
                {["Contact Form", "Booking System", "Payments / Shop", "Blog", "Reviews & Testimonials", "Live Chat", "Photo Gallery", "FAQ Section", "Newsletter Signup", "Social Media Links", "Google Maps", "Video Background", "Countdown Timer", "Pop-up Form"].map(f => (
                  <CheckCard key={f} checked={features.includes(f)} onClick={() => toggleItem(features, f, setFeatures)} label={f} />
                ))}
              </div>
            </div>
          )}

          {/* STEP 5 */}
          {step === 5 && (
            <div className="space-y-5">
              <div>
                <label className="block text-xs font-semibold text-slate-400 uppercase tracking-widest mb-3">💰 Pricing Section <span className="text-red-400">*</span></label>
                <div className="grid gap-3">
                  <SelectCard selected={hasPricing === "Yes"} onClick={() => setHasPricing("Yes")} label="Yes — include pricing" desc="Show your prices, packages or menu on the site" icon="✅" />
                  <SelectCard selected={hasPricing === "No"} onClick={() => setHasPricing("No")} label="No — no pricing needed" desc="Clients contact you for a quote" icon="❌" />
                </div>
              </div>
              {hasPricing === "Yes" && (
                <div>
                  <label className="block text-xs font-semibold text-slate-400 uppercase tracking-widest mb-3">📊 Pricing Type</label>
                  <div className="grid gap-3">
                    <SelectCard selected={pricingType === "products"} onClick={() => setPricingType("products")} label="Individual Products / Services" desc="Each item has its own name, price and photo" icon="🛍️" />
                    <SelectCard selected={pricingType === "tiers"} onClick={() => setPricingType("tiers")} label="Pricing Tiers" desc="Starter / Business / Premium packages" icon="📦" />
                    <SelectCard selected={pricingType === "quote"} onClick={() => setPricingType("quote")} label="Quote Based" desc="Customers request a custom quote" icon="📋" />
                    <SelectCard selected={pricingType === "hourly"} onClick={() => setPricingType("hourly")} label="Hourly / Day Rate" desc="You charge by the hour or day" icon="⏱️" />
                  </div>
                </div>
              )}
            </div>
          )}

          {/* STEP 6 */}
          {step === 6 && hasPricing === "Yes" && (
            <div className="space-y-5">
              <div>
                <label className="block text-xs font-semibold text-slate-400 uppercase tracking-widest mb-3">📤 How to provide pricing</label>
                <div className="grid gap-3">
                  <SelectCard selected={pricingMethod === "upload"} onClick={() => setPricingMethod("upload")} label="Upload a menu or price list" desc="PDF, image or Word document" icon="📄" />
                  <SelectCard selected={pricingMethod === "url"} onClick={() => setPricingMethod("url")} label="Use my existing website" desc="We'll pull pricing from your current site" icon="🌐" />
                  <SelectCard selected={pricingMethod === "manual"} onClick={() => setPricingMethod("manual")} label="Enter manually" desc="Type each item, price and upload photos" icon="✏️" />
                  <SelectCard selected={pricingMethod === "weknow"} onClick={() => setPricingMethod("weknow")} label="You decide for us" desc="We'll create a professional pricing section" icon="🤝" />
                </div>
              </div>

              {pricingMethod === "upload" && (
                <div onClick={() => pricingSheetRef.current?.click()} className="border-2 border-dashed border-white/10 rounded-2xl p-6 cursor-pointer hover:border-emerald-500/30 transition-all text-center bg-slate-900/50">
                  <input ref={pricingSheetRef} type="file" accept="image/*,.pdf,.doc,.docx" className="hidden" onChange={(e) => { const f = e.target.files?.[0]; if (f) setPricingFile(f); }} />
                  {pricingFile ? <p className="text-emerald-400 font-semibold">✓ {pricingFile.name}</p> : <div><p className="text-slate-300 font-semibold">📎 Upload menu or price list</p><p className="text-slate-500 text-sm mt-1">PDF, image, Word doc</p></div>}
                </div>
              )}

              {pricingMethod === "url" && (
                <InputField icon="🌐" label="Existing Website URL" value={pricingUrl} onChange={(e: any) => setPricingUrl(e.target.value)} placeholder="https://yourwebsite.com.au" />
              )}

              {pricingMethod === "manual" && pricingType === "products" && (
                <div className="space-y-4">
                  {products.map((product, index) => (
                    <div key={index} className="bg-slate-900/80 border border-white/10 rounded-2xl p-5 space-y-3">
                      <div className="flex justify-between items-center">
                        <p className="text-emerald-400 font-semibold text-sm">Item {index + 1}</p>
                        {products.length > 1 && <button onClick={() => removeProduct(index)} className="text-red-400 text-xs hover:text-red-300 transition-colors">Remove</button>}
                      </div>
                      <InputField icon="🏷️" label="Product / Service Name" value={product.name} onChange={(e: any) => updateProduct(index, 'name', e.target.value)} placeholder="e.g. Sourdough Loaf" />
                      <InputField icon="💵" label="Price" value={product.price} onChange={(e: any) => updateProduct(index, 'price', e.target.value)} placeholder="e.g. $12 or from $85" />
                      <div onClick={() => productPhotoRefs.current[index]?.click()} className="border-2 border-dashed border-white/10 rounded-xl p-4 cursor-pointer hover:border-emerald-500/30 transition-all text-center">
                        <input ref={(el) => { productPhotoRefs.current[index] = el; }} type="file" accept="image/*" className="hidden" onChange={(e) => { const f = e.target.files?.[0]; if (f) handleProductPhoto(index, f); }} />
                        {product.photo ? <p className="text-emerald-400 text-sm">✓ {product.photo.name} ({(product.photo.size / 1024).toFixed(0)}KB)</p> : <p className="text-slate-500 text-sm">📷 Upload photo (optional)</p>}
                      </div>
                    </div>
                  ))}
                  {products.length < 12 && (
                    <button onClick={addProduct} className="w-full h-12 rounded-2xl border border-white/10 text-slate-400 hover:text-white hover:border-white/20 transition-all text-sm">+ Add another item</button>
                  )}
                </div>
              )}

              {pricingMethod === "manual" && pricingType !== "products" && (
                <TextAreaField icon="💰" label="Pricing Details" value={pricingDetails} onChange={(e: any) => setPricingDetails(e.target.value)} placeholder={pricingType === "tiers" ? "e.g. Starter $99/month - includes X, Y, Z. Business $199/month - includes A, B, C" : pricingType === "hourly" ? "e.g. $85/hour, minimum 2 hours. Day rate $600" : "Describe how your quoting works"} />
              )}

              {pricingMethod === "weknow" && (
                <div className="bg-emerald-500/10 border border-emerald-500/20 rounded-2xl p-4">
                  <p className="text-emerald-400 text-sm">✓ No problem — we'll create a professional pricing section that suits your industry and style.</p>
                </div>
              )}
            </div>
          )}

          {/* STEP 6 (no pricing) or STEP 7 */}
          {((step === 6 && hasPricing !== "Yes") || step === 7) && (
            <div className="space-y-5">
              <InputField icon="🎨" label="Style" value={style} onChange={(e: any) => setStyle(e.target.value)} placeholder="e.g. Luxury dark, Clean minimal, Warm rustic, Bold modern" />
              <InputField icon="🎨" label="Colour Preferences" value={colorPrefs} onChange={(e: any) => setColorPrefs(e.target.value)} placeholder="e.g. Navy and gold, Black and white, Cream and terracotta" />
              <TextAreaField icon="🔗" label="Reference Websites (optional)" value={references} onChange={(e: any) => setReferences(e.target.value)} placeholder="Links to websites you like, or describe what you like about them" />
              <div>
                <label className="block text-xs font-semibold text-slate-400 uppercase tracking-widest mb-3">🖼️ Do you have a logo?</label>
                <div className="grid gap-2">
                  {["Yes — I will provide it", "No — I need one designed", "No — please use text only"].map(opt => (
                    <SelectCard key={opt} selected={hasLogo === opt} onClick={() => setHasLogo(opt)} label={opt} />
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* STEP 8 */}
          {step === 8 && (
            <div className="space-y-5">
              <p className="text-slate-400 text-sm">All images are compressed automatically. Skip anything you don't have yet.</p>
              <FileUploadBox label="📎 Upload Your Logo" hint="Any size — we compress it automatically" file={logoFile} onChange={handleLogoChange} inputRef={logoRef} accept="image/*" />
              <FileUploadBox label="🖼️ Upload Hero / Banner Image" hint="Main background image — any size" file={heroFile} onChange={handleHeroChange} inputRef={heroRef} accept="image/*" />
              <div onClick={() => photosRef.current?.click()} className="border-2 border-dashed border-white/10 rounded-2xl p-6 cursor-pointer hover:border-emerald-500/30 transition-all text-center bg-slate-900/50">
                <input ref={photosRef} type="file" accept="image/*" multiple className="hidden" onChange={handlePhotoChange} />
                <p className="text-slate-300 font-semibold">📷 Additional Photos</p>
                <p className="text-slate-500 text-sm mt-1">Up to 5 general photos for your site</p>
                {photoFiles.length > 0 && photoFiles.map((f, i) => <p key={i} className="text-emerald-400 text-sm mt-1">✓ {f.name} ({(f.size / 1024).toFixed(0)}KB)</p>)}
              </div>
              <p className="text-slate-600 text-xs text-center">No assets? Skip this — we'll use professional stock images.</p>
            </div>
          )}

          {/* STEP 9 */}
          {step === 9 && (
            <div className="space-y-5">
              <div>
                <label className="block text-xs font-semibold text-slate-400 uppercase tracking-widest mb-3">📝 Do you have website copy ready?</label>
                <div className="grid gap-2">
                  {["Yes — I will provide all text", "Partially — I have some text", "No — please write it for me"].map(opt => (
                    <SelectCard key={opt} selected={hasContent === opt} onClick={() => setHasContent(opt)} label={opt} />
                  ))}
                </div>
              </div>
              <TextAreaField icon="📌" label="Anything else we should know? (optional)" value={additionalNotes} onChange={(e: any) => setAdditionalNotes(e.target.value)} placeholder="Deadline, special requirements, competitors to beat, links to pull content from..." />

              <div className="border-t border-white/8 pt-6 space-y-5">
                <p className="text-white font-semibold">📬 Your Contact Details</p>
                <InputField icon="👤" label="Full Name" value={name} onChange={(e: any) => setName(e.target.value)} placeholder="Your full name" required />
                <InputField icon="📧" label="Email Address" value={email} onChange={(e: any) => setEmail(e.target.value)} placeholder="your@email.com" required type="email" />
                <InputField icon="📱" label="Phone Number" value={phone} onChange={(e: any) => setPhone(e.target.value)} placeholder="04XX XXX XXX" required type="tel" />
              </div>

              <div className="mt-2">
                <div ref={turnstileRef} />
                {!turnstileToken && turnstileReady && <p className="text-slate-500 text-xs mt-2">Complete the security check above to submit</p>}
              </div>

              {quote && (
                <div className="mt-4 rounded-2xl bg-gradient-to-br from-emerald-950/50 to-slate-900/50 border border-emerald-500/20 p-6">
                  <p className="text-xs font-semibold text-emerald-400 uppercase tracking-widest mb-3">💰 Your Estimated Quote</p>
                  <div className="flex items-end gap-2 mb-1">
                    <p className="text-5xl font-bold text-white">${quote.totalPrice.toLocaleString()}</p>
                    <p className="text-slate-400 mb-2">one-time</p>
                  </div>
                  <p className="text-slate-400 text-sm mb-4">+ ${quote.monthlyPrice}/month hosting & maintenance</p>
                  <div className="bg-emerald-500/10 border border-emerald-500/20 rounded-xl p-3">
                    <p className="text-emerald-400 font-semibold text-sm">🎉 Saving ${quote.savings.toLocaleString()} vs the industry average of ${quote.competitorPrice.toLocaleString()}</p>
                  </div>
                  <p className="text-slate-600 text-xs mt-3">{quote.packageName} Package</p>
                </div>
              )}
            </div>
          )}

          {/* Errors */}
          {errors.length > 0 && (
            <div className="mt-6 p-4 bg-red-500/10 border border-red-500/20 rounded-2xl">
              {errors.map((err, i) => <p key={i} className="text-red-400 text-sm">⚠️ {err}</p>)}
            </div>
          )}

          {/* Buttons */}
          <div className="flex gap-3 mt-8">
            {step > 1 && (
              <button onClick={back} className="h-14 px-8 rounded-2xl border border-white/10 text-slate-400 hover:text-white hover:border-white/20 transition-all font-medium">
                ← Back
              </button>
            )}
            <button
              onClick={next}
              disabled={loading || compressing || (step === totalSteps && !turnstileToken)}
              className="flex-1 h-14 rounded-2xl bg-emerald-500 hover:bg-emerald-400 disabled:opacity-50 disabled:cursor-not-allowed text-black font-bold transition-all text-sm tracking-wide"
            >
              {compressing ? "⏳ Compressing..." : loading ? "⏳ Submitting..." : step === totalSteps ? "🚀 Submit Request" : "Continue →"}
            </button>
          </div>
        </div>

        {/* Side Panel */}
        <div className="hidden lg:block">
          <div className="rounded-3xl bg-[#0f1623] border border-white/8 p-6 sticky top-8">
            <div className="flex items-center gap-2 mb-6">
              <div className="w-8 h-8 rounded-lg bg-emerald-500/20 flex items-center justify-center text-emerald-400 text-sm">W</div>
              <span className="font-semibold text-white">WebGecko</span>
            </div>

            <div className="space-y-1 mb-6">
              {stepTitles.map((title, i) => (
                <div key={i} className={`flex items-center gap-3 p-2 rounded-xl transition-all ${i + 1 === step ? 'bg-emerald-500/10 border border-emerald-500/20' : i + 1 < step ? 'opacity-50' : 'opacity-30'}`}>
                  <div className={`w-5 h-5 rounded-full flex items-center justify-center text-xs flex-shrink-0 ${i + 1 < step ? 'bg-emerald-500 text-black font-bold' : i + 1 === step ? 'border-2 border-emerald-500 text-emerald-400' : 'border border-white/20 text-slate-600'}`}>
                    {i + 1 < step ? '✓' : i + 1}
                  </div>
                  <span className={`text-xs ${i + 1 === step ? 'text-white font-semibold' : 'text-slate-500'}`}>{title}</span>
                </div>
              ))}
            </div>

            <div className="border-t border-white/8 pt-4 space-y-2 text-xs text-slate-600">
              {businessName && <p>🏢 {businessName}</p>}
              {industry && <p>🏭 {industry}</p>}
              {goal && <p>🎯 {goal}</p>}
              {siteType && <p>📄 {siteType === 'multi' ? 'Multi Page' : 'Single Page'}</p>}
              {pages.length > 0 && <p>📑 {pages.join(', ')}</p>}
              {name && <p>👤 {name}</p>}
            </div>

            {quote && (
              <div className="mt-4 border-t border-white/8 pt-4">
                <p className="text-xs text-slate-500 uppercase tracking-widest mb-2">Live Quote</p>
                <p className="text-2xl font-bold text-white">${quote.totalPrice.toLocaleString()}</p>
                <p className="text-slate-500 text-xs">+ ${quote.monthlyPrice}/month</p>
                <p className="text-emerald-400 text-xs mt-1 font-semibold">{quote.packageName} Package</p>
                <div className="mt-2 bg-emerald-500/10 rounded-lg p-2">
                  <p className="text-emerald-400 text-xs">Saving ${quote.savings.toLocaleString()} vs agencies</p>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </main>
  );
}