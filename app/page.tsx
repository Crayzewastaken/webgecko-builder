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
      canvas.getContext('2d')!.drawImage(img, 0, 0, width, height);
      canvas.toBlob((blob) => {
        URL.revokeObjectURL(url);
        resolve(blob ? new File([blob], file.name.replace(/\.[^.]+$/, '.jpg'), { type: 'image/jpeg' }) : file);
      }, 'image/jpeg', qualityVal);
    };
    img.src = url;
  });
}

type Product = { name: string; price: string; photo: File | null };
const STORAGE_KEY = 'webgecko_form_v3';
function saveToStorage(data: any) { try { localStorage.setItem(STORAGE_KEY, JSON.stringify(data)); } catch (e) {} }
function loadFromStorage() { try { const d = localStorage.getItem(STORAGE_KEY); return d ? JSON.parse(d) : null; } catch { return null; } }

const FEATURE_BUNDLES = [
  { id: 'contact', icon: '📬', label: 'Contact & Enquiries', desc: 'Contact form, social media links', features: ['Contact Form', 'Social Media Links'] },
  { id: 'trust', icon: '⭐', label: 'Trust & Reviews', desc: 'Customer reviews, testimonials, FAQ section', features: ['Reviews & Testimonials', 'FAQ Section'] },
  { id: 'location', icon: '📍', label: 'Location & Maps', desc: 'Google Maps, directions to your business', features: ['Google Maps'] },
  { id: 'booking', icon: '📅', label: 'Bookings & Appointments', desc: 'Online booking system for appointments or classes', features: ['Booking System'] },
  { id: 'shop', icon: '🛒', label: 'Online Shop & Payments', desc: 'Sell products or services and accept payments', features: ['Payments / Shop'] },
  { id: 'content', icon: '📰', label: 'Blog & Content', desc: 'Blog posts, news, articles and updates', features: ['Blog'] },
  { id: 'gallery', icon: '🖼️', label: 'Photo Gallery', desc: 'Showcase your work, products or portfolio', features: ['Photo Gallery'] },
  { id: 'growth', icon: '📈', label: 'Growth & Marketing', desc: 'Newsletter signup, live chat, pop-up forms', features: ['Newsletter Signup', 'Live Chat', 'Pop-up Form'] },
  { id: 'video', icon: '🎥', label: 'Video Background', desc: 'Cinematic video hero section', features: ['Video Background'] },
];

// Steps:
// 1 - Business
// 2 - Goals
// 3 - Pages
// 4 - Features
// 5 - Pricing (yes/no + type)
// 6 - Pricing Details (ONLY if hasPricing=Yes)
// 7 - Design (always)
// 8 - Assets (always)
// 9 - Final Details (always)

const InputField = ({ icon, label, value, onChange, placeholder, required, type = 'text' }: any) => (
  <div>
    <label className="block text-xs font-semibold text-slate-400 uppercase tracking-widest mb-2">{icon} {label} {required && <span className="text-red-400">*</span>}</label>
    <input type={type} value={value} onChange={onChange} placeholder={placeholder} className="w-full h-14 rounded-2xl bg-slate-900/80 border border-white/10 px-5 text-white placeholder:text-slate-600 focus:outline-none focus:border-emerald-500/50 transition-all text-base" />
  </div>
);

const TextAreaField = ({ icon, label, value, onChange, placeholder, required }: any) => (
  <div>
    <label className="block text-xs font-semibold text-slate-400 uppercase tracking-widest mb-2">{icon} {label} {required && <span className="text-red-400">*</span>}</label>
    <textarea value={value} onChange={onChange} placeholder={placeholder} className="w-full min-h-[120px] rounded-2xl bg-slate-900/80 border border-white/10 px-5 py-4 text-white placeholder:text-slate-600 focus:outline-none focus:border-emerald-500/50 transition-all resize-none text-base" />
  </div>
);

const SelectCard = ({ selected, onClick, label, desc, icon }: any) => (
  <div onClick={onClick} className={`cursor-pointer rounded-2xl p-4 border-2 transition-all active:scale-98 ${selected ? 'border-emerald-500 bg-emerald-500/10' : 'border-white/10 bg-slate-900/50'}`}>
    <div className="flex items-start gap-3">
      <div className={`w-5 h-5 rounded-full border-2 flex-shrink-0 mt-0.5 flex items-center justify-center ${selected ? 'border-emerald-500 bg-emerald-500' : 'border-white/30'}`}>
        {selected && <div className="w-2 h-2 rounded-full bg-white" />}
      </div>
      <div><p className="font-semibold text-white text-sm">{icon && <span className="mr-1">{icon}</span>}{label}</p>{desc && <p className="text-slate-400 text-xs mt-0.5">{desc}</p>}</div>
    </div>
  </div>
);

const CheckCard = ({ checked, onClick, label }: any) => (
  <div onClick={onClick} className={`cursor-pointer rounded-xl p-3 border transition-all flex items-center gap-3 active:scale-98 ${checked ? 'border-emerald-500 bg-emerald-500/10' : 'border-white/10 bg-slate-900/50'}`}>
    <div className={`w-5 h-5 rounded flex-shrink-0 flex items-center justify-center border-2 transition-all ${checked ? 'border-emerald-500 bg-emerald-500' : 'border-white/30'}`}>
      {checked && <span className="text-white text-xs font-bold">✓</span>}
    </div>
    <span className="text-sm text-white">{label}</span>
  </div>
);

export default function HomePage() {
  const [step, setStep] = useState(1);
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
  const [selectedBundles, setSelectedBundles] = useState<string[]>([]);
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
  const [abn, setAbn] = useState("");
  const [logoFile, setLogoFile] = useState<File | null>(null);
  const [heroFile, setHeroFile] = useState<File | null>(null);
  const [photoFiles, setPhotoFiles] = useState<File[]>([]);

  const logoRef = useRef<HTMLInputElement>(null);
  const heroRef = useRef<HTMLInputElement>(null);
  const photosRef = useRef<HTMLInputElement>(null);
  const pricingSheetRef = useRef<HTMLInputElement>(null);
  const productPhotoRefs = useRef<(HTMLInputElement | null)[]>([]);

  // Dynamic steps based on whether pricing is needed
  const steps = useMemo(() => {
    const base = [
      { id: 'business', label: 'Your Business' },
      { id: 'goals', label: 'Website Goals' },
      { id: 'pages', label: 'Pages' },
      { id: 'features', label: 'Features' },
      { id: 'pricing', label: 'Pricing' },
    ];
    if (hasPricing === 'Yes') base.push({ id: 'pricing_details', label: 'Pricing Details' });
    base.push({ id: 'design', label: 'Design' });
    base.push({ id: 'assets', label: 'Assets' });
    base.push({ id: 'contact', label: 'Final Details' });
    return base;
  }, [hasPricing]);

  const totalSteps = steps.length;
  const currentStepId = steps[step - 1]?.id;

  const features = useMemo(() => {
    const all: string[] = [];
    selectedBundles.forEach(id => {
      const bundle = FEATURE_BUNDLES.find(b => b.id === id);
      if (bundle) bundle.features.forEach(f => { if (!all.includes(f)) all.push(f); });
    });
    return all;
  }, [selectedBundles]);

  const quote = useMemo(() => {
    if (pages.length === 0 && features.length === 0 && !siteType) return null;
    return calculateQuote(pages, features, siteType);
  }, [pages, features, siteType]);

  useEffect(() => {
    const saved = loadFromStorage();
    if (!saved) return;
    if (saved.businessName) setBusinessName(saved.businessName);
    if (saved.industry) setIndustry(saved.industry);
    if (saved.usp) setUsp(saved.usp);
    if (saved.existingWebsite) setExistingWebsite(saved.existingWebsite);
    if (saved.targetAudience) setTargetAudience(saved.targetAudience);
    if (saved.goal) setGoal(saved.goal);
    if (saved.siteType) setSiteType(saved.siteType);
    if (saved.pages) setPages(saved.pages);
    if (saved.selectedBundles) setSelectedBundles(saved.selectedBundles);
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
  }, []);

  useEffect(() => {
    saveToStorage({ businessName, industry, usp, existingWebsite, targetAudience, goal, siteType, pages, selectedBundles, hasPricing, pricingType, pricingMethod, pricingDetails, pricingUrl, style, colorPrefs, references, hasLogo, hasContent, additionalNotes, name, email, phone, step });
  }, [businessName, industry, usp, existingWebsite, targetAudience, goal, siteType, pages, selectedBundles, hasPricing, pricingType, pricingMethod, pricingDetails, pricingUrl, style, colorPrefs, references, hasLogo, hasContent, additionalNotes, name, email, phone, step]);

  useEffect(() => {
    if (currentStepId !== 'contact') return;
    const renderWidget = () => {
      setTimeout(() => {
        if (turnstileRef.current && (window as any).turnstile) {
          (window as any).turnstile.render(turnstileRef.current, {
            sitekey: process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY,
            callback: (token: string) => setTurnstileToken(token),
            'expired-callback': () => setTurnstileToken(""),
          });
          setTurnstileReady(true);
        }
      }, 150);
    };
    if (document.querySelector('script[src*="turnstile"]')) { renderWidget(); return; }
    const script = document.createElement('script');
    script.src = 'https://challenges.cloudflare.com/turnstile/v0/api.js';
    script.async = true;
    script.onload = renderWidget;
    document.head.appendChild(script);
  }, [currentStepId]);

  function toggleBundle(id: string) { setSelectedBundles(prev => prev.includes(id) ? prev.filter(b => b !== id) : [...prev, id]); }
  function toggleItem(arr: string[], value: string, setFn: any) { setFn(arr.includes(value) ? arr.filter(v => v !== value) : [...arr, value]); }
  function addProduct() { if (products.length < 12) setProducts(p => [...p, { name: "", price: "", photo: null }]); }
  function removeProduct(i: number) { setProducts(p => p.filter((_, idx) => idx !== i)); }
  function updateProduct(i: number, field: keyof Product, val: any) { setProducts(p => p.map((x, idx) => idx === i ? { ...x, [field]: val } : x)); }

  async function handleProductPhoto(i: number, file: File) { setCompressing(true); updateProduct(i, 'photo', await compressImage(file, 600, 0.6)); setCompressing(false); }
  async function handleLogoChange(e: any) { const f = e.target.files?.[0]; if (!f) return; setCompressing(true); setLogoFile(await compressImage(f, 400, 0.85)); setCompressing(false); }
  async function handleHeroChange(e: any) { const f = e.target.files?.[0]; if (!f) return; setCompressing(true); setHeroFile(await compressImage(f, 1400, 0.75)); setCompressing(false); }
  async function handlePhotoChange(e: any) { const files = Array.from(e.target.files || []) as File[]; setCompressing(true); const c = await Promise.all(files.slice(0, 5).map(f => compressImage(f as File, 1000, 0.7))); setPhotoFiles(prev => [...prev, ...c].slice(0, 5)); setCompressing(false); }

  function validateStep(): string[] {
    const errs: string[] = [];
    if (currentStepId === 'business') {
      if (!businessName.trim()) errs.push("Business name is required");
      if (!industry.trim()) errs.push("Industry is required");
      if (!targetAudience.trim()) errs.push("Target audience is required");
      if (!usp.trim()) errs.push("Please describe what makes your business unique");
    }
    if (currentStepId === 'goals') {
      if (!goal) errs.push("Please select the main goal of your website");
      if (!siteType) errs.push("Please select single page or multi page");
    }
    if (currentStepId === 'pages') { if (pages.length === 0) errs.push("Please select at least one page"); }
    if (currentStepId === 'pricing') { if (!hasPricing) errs.push("Please select whether you need a pricing section"); }
    if (currentStepId === 'contact') {
      if (!name.trim()) errs.push("Full name is required");
      if (!email.trim() || !email.includes('@')) errs.push("A valid email address is required");
      if (!phone.trim()) errs.push("Phone number is required");
      if (!turnstileToken) errs.push("Please wait for the security check to complete");
    }
    return errs;
  }

  async function submit() {
    const errs = validateStep();
    if (errs.length > 0) { setErrors(errs); return; }
    setErrors([]);
    setSubmitted(true);
    localStorage.removeItem(STORAGE_KEY);

    const formData = new FormData();
    const fields: Record<string, string> = { businessName, industry, usp, existingWebsite, targetAudience, goal, siteType, hasPricing, pricingType, pricingMethod, pricingDetails, pricingUrl, style, colorPrefs, references, hasLogo, hasContent, additionalNotes, name, email, phone, turnstileToken };
    Object.entries(fields).forEach(([k, v]) => formData.append(k, v));
    formData.append("pages", JSON.stringify(pages));
    formData.append("features", JSON.stringify(features));
    formData.append("products", JSON.stringify(products.map(p => ({ name: p.name, price: p.price }))));
    products.forEach((p, i) => { if (p.photo) formData.append(`product_photo_${i}`, p.photo); });
    if (pricingFile) formData.append("pricing_sheet", pricingFile);
    if (logoFile) formData.append("logo", logoFile);
    if (heroFile) formData.append("hero", heroFile);
    photoFiles.forEach((f, i) => formData.append(`photo_${i}`, f));

    fetch("/api/worker", { method: "POST", body: formData }).catch(console.error);
  }

  function next() {
    const errs = validateStep();
    if (errs.length > 0) { setErrors(errs); return; }
    setErrors([]);
    if (step < totalSteps) setStep(step + 1);
    else submit();
  }

  function back() { setErrors([]); setStep(Math.max(1, step - 1)); }

  const FileUploadBox = ({ label, file, onChange, inputRef, accept, hint }: any) => (
    <div onClick={() => inputRef.current?.click()} className="border-2 border-dashed border-white/10 rounded-2xl p-5 cursor-pointer active:scale-98 transition-all text-center bg-slate-900/50">
      <input ref={inputRef} type="file" accept={accept} className="hidden" onChange={onChange} />
      {file ? <div><p className="text-emerald-400 font-semibold text-sm">✓ {file.name}</p><p className="text-slate-500 text-xs mt-1">{(file.size/1024).toFixed(0)}KB</p></div>
             : <div><p className="text-slate-300 font-semibold text-sm">{label}</p><p className="text-slate-500 text-xs mt-1">{hint}</p></div>}
    </div>
  );

  if (submitted) {
    return (
      <main className="min-h-screen bg-[#0a0f1a] text-white flex items-center justify-center p-6">
        <div className="max-w-lg w-full text-center">
          <div className="w-24 h-24 rounded-full bg-emerald-500/20 border-2 border-emerald-500 flex items-center justify-center mx-auto mb-8">
            <span className="text-5xl">✓</span>
          </div>
          <h1 className="text-3xl md:text-4xl font-bold mb-3">Request Submitted!</h1>
          <p className="text-slate-400 text-base md:text-lg mb-8">Your website request has been received. Your confirmation email will arrive within <strong className="text-white">2 to 5 minutes</strong>.</p>
          <div className="bg-[#0f1623] border border-white/10 rounded-3xl p-6 text-left space-y-4 mb-8">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-emerald-500/20 flex items-center justify-center text-xl flex-shrink-0">📧</div>
              <div><p className="text-white font-semibold text-sm">Check your email</p><p className="text-slate-400 text-sm">{email}</p></div>
            </div>
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-emerald-500/20 flex items-center justify-center text-xl flex-shrink-0">📞</div>
              <div><p className="text-white font-semibold text-sm">We'll call you within 24 hours</p><p className="text-slate-400 text-sm">{phone}</p></div>
            </div>
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-emerald-500/20 flex items-center justify-center text-xl flex-shrink-0">🌐</div>
              <div><p className="text-white font-semibold text-sm">{businessName}</p><p className="text-slate-400 text-sm">{quote ? `${quote.packageName} — $${quote.totalPrice.toLocaleString()} + $${quote.monthlyPrice}/month` : "Quote on the way"}</p></div>
            </div>
          </div>
          <p className="text-slate-600 text-sm">Didn't receive an email? Check spam or contact <span className="text-slate-400">hello@webgecko.au</span></p>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-[#0a0f1a] text-white p-3 md:p-8">
      <div className="max-w-6xl mx-auto grid lg:grid-cols-[1fr_300px] gap-4 md:gap-6">
        <div className="rounded-2xl md:rounded-3xl bg-[#0f1623] border border-white/8 p-5 md:p-10 shadow-2xl">

          {/* Header */}
          <div className="flex items-center gap-3 mb-5">
            <div className="w-9 h-9 md:w-10 md:h-10 rounded-xl bg-emerald-500/20 border border-emerald-500/30 flex items-center justify-center text-emerald-400 font-bold text-sm flex-shrink-0">{step}</div>
            <div className="min-w-0">
              <p className="text-xs text-slate-500 uppercase tracking-widest">Step {step} of {totalSteps}</p>
              <p className="text-white font-semibold truncate">{steps[step-1]?.label}</p>
            </div>
            <div className="ml-auto text-xs text-slate-600 flex-shrink-0">{Math.round((step / totalSteps) * 100)}%</div>
          </div>
          <div className="h-1 bg-white/5 rounded-full overflow-hidden mb-6 md:mb-8">
            <div className="h-full bg-gradient-to-r from-emerald-500 to-emerald-400 transition-all duration-500 rounded-full" style={{ width: `${(step / totalSteps) * 100}%` }} />
          </div>

          {/* STEP: business */}
          {currentStepId === 'business' && (
            <div className="space-y-4 md:space-y-5">
              <InputField icon="🏢" label="Business Name" value={businessName} onChange={(e: any) => setBusinessName(e.target.value)} placeholder="e.g. Sunrise Bakery" required />
              <InputField icon="🏭" label="Industry" value={industry} onChange={(e: any) => setIndustry(e.target.value)} placeholder="e.g. Food & Hospitality, Real Estate, Fitness" required />
              <InputField icon="🎯" label="Target Audience" value={targetAudience} onChange={(e: any) => setTargetAudience(e.target.value)} placeholder="e.g. Homeowners in Brisbane aged 30-55" required />
              <TextAreaField icon="⭐" label="What makes you unique?" value={usp} onChange={(e: any) => setUsp(e.target.value)} placeholder="What do you offer that competitors don't?" required />
              <InputField icon="🌐" label="Existing Website (optional)" value={existingWebsite} onChange={(e: any) => setExistingWebsite(e.target.value)} placeholder="https://yourwebsite.com.au" />
            </div>
          )}

          {/* STEP: goals */}
          {currentStepId === 'goals' && (
            <div className="space-y-5 md:space-y-6">
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

          {/* STEP: pages */}
          {currentStepId === 'pages' && (
            <div>
              <label className="block text-xs font-semibold text-slate-400 uppercase tracking-widest mb-4">📑 Select Pages <span className="text-red-400">*</span></label>
              <div className="grid grid-cols-2 gap-2">
                {["Home", "About", "Services", "Contact", "Shop", "Gallery", "Blog", "Booking", "FAQ", "Testimonials", "Pricing", "Portfolio", "Team", "Menu"].map(p => (
                  <CheckCard key={p} checked={pages.includes(p)} onClick={() => toggleItem(pages, p, setPages)} label={p} />
                ))}
              </div>
            </div>
          )}

          {/* STEP: features */}
          {currentStepId === 'features' && (
            <div>
              <label className="block text-xs font-semibold text-slate-400 uppercase tracking-widest mb-2">⚙️ Website Features</label>
              <p className="text-slate-500 text-sm mb-4">Select the bundles that suit your business.</p>
              <div className="grid gap-3">
                {FEATURE_BUNDLES.map(bundle => (
                  <div key={bundle.id} onClick={() => toggleBundle(bundle.id)} className={`cursor-pointer rounded-2xl p-4 border-2 transition-all ${selectedBundles.includes(bundle.id) ? 'border-emerald-500 bg-emerald-500/10' : 'border-white/10 bg-slate-900/50'}`}>
                    <div className="flex items-center gap-3">
                      <div className={`w-5 h-5 rounded border-2 flex-shrink-0 flex items-center justify-center ${selectedBundles.includes(bundle.id) ? 'border-emerald-500 bg-emerald-500' : 'border-white/30'}`}>
                        {selectedBundles.includes(bundle.id) && <span className="text-white text-xs font-bold">✓</span>}
                      </div>
                      <span className="text-lg">{bundle.icon}</span>
                      <div><p className="font-semibold text-white text-sm">{bundle.label}</p><p className="text-slate-400 text-xs">{bundle.desc}</p></div>
                    </div>
                  </div>
                ))}
              </div>
              {selectedBundles.length > 0 && (
                <div className="mt-4 p-3 bg-slate-900/80 rounded-xl border border-white/10">
                  <p className="text-xs text-emerald-400">{features.join(', ')}</p>
                </div>
              )}
            </div>
          )}

          {/* STEP: pricing */}
          {currentStepId === 'pricing' && (
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
                  <div className="grid gap-2">
                    <SelectCard selected={pricingType === "products"} onClick={() => setPricingType("products")} label="Individual Products / Services" desc="Each item has its own name, price and photo" icon="🛍️" />
                    <SelectCard selected={pricingType === "tiers"} onClick={() => setPricingType("tiers")} label="Pricing Tiers" desc="Starter / Business / Premium packages" icon="📦" />
                    <SelectCard selected={pricingType === "quote"} onClick={() => setPricingType("quote")} label="Quote Based" desc="Customers request a custom quote" icon="📋" />
                    <SelectCard selected={pricingType === "hourly"} onClick={() => setPricingType("hourly")} label="Hourly / Day Rate" desc="You charge by the hour or day" icon="⏱️" />
                  </div>
                </div>
              )}
            </div>
          )}

          {/* STEP: pricing_details */}
          {currentStepId === 'pricing_details' && (
            <div className="space-y-5">
              <div>
                <label className="block text-xs font-semibold text-slate-400 uppercase tracking-widest mb-3">📤 How to provide pricing</label>
                <div className="grid gap-2">
                  <SelectCard selected={pricingMethod === "upload"} onClick={() => setPricingMethod("upload")} label="Upload a menu or price list" desc="PDF, image or Word document" icon="📄" />
                  <SelectCard selected={pricingMethod === "url"} onClick={() => setPricingMethod("url")} label="Use my existing website" desc="We'll pull pricing from your current site" icon="🌐" />
                  <SelectCard selected={pricingMethod === "manual"} onClick={() => setPricingMethod("manual")} label="Enter manually" desc="Type each item, price and upload photos" icon="✏️" />
                  <SelectCard selected={pricingMethod === "weknow"} onClick={() => setPricingMethod("weknow")} label="You decide for us" desc="We'll create a professional pricing section" icon="🤝" />
                </div>
              </div>
              {pricingMethod === "upload" && (
                <div onClick={() => pricingSheetRef.current?.click()} className="border-2 border-dashed border-white/10 rounded-2xl p-5 cursor-pointer text-center bg-slate-900/50">
                  <input ref={pricingSheetRef} type="file" accept="image/*,.pdf,.doc,.docx" className="hidden" onChange={(e) => { const f = e.target.files?.[0]; if (f) setPricingFile(f); }} />
                  {pricingFile ? <p className="text-emerald-400 font-semibold text-sm">✓ {pricingFile.name}</p> : <div><p className="text-slate-300 font-semibold text-sm">📎 Upload menu or price list</p><p className="text-slate-500 text-xs mt-1">PDF, image, Word doc</p></div>}
                </div>
              )}
              {pricingMethod === "url" && <InputField icon="🌐" label="Existing Website URL" value={pricingUrl} onChange={(e: any) => setPricingUrl(e.target.value)} placeholder="https://yourwebsite.com.au" />}
              {pricingMethod === "manual" && pricingType === "products" && (
                <div className="space-y-4">
                  {products.map((product, index) => (
                    <div key={index} className="bg-slate-900/80 border border-white/10 rounded-2xl p-4 space-y-3">
                      <div className="flex justify-between items-center">
                        <p className="text-emerald-400 font-semibold text-sm">Item {index + 1}</p>
                        {products.length > 1 && <button onClick={() => removeProduct(index)} className="text-red-400 text-xs">Remove</button>}
                      </div>
                      <InputField icon="🏷️" label="Product / Service Name" value={product.name} onChange={(e: any) => updateProduct(index, 'name', e.target.value)} placeholder="e.g. Sourdough Loaf" />
                      <InputField icon="💵" label="Price" value={product.price} onChange={(e: any) => updateProduct(index, 'price', e.target.value)} placeholder="e.g. $12 or from $85" />
                      <div onClick={() => productPhotoRefs.current[index]?.click()} className="border-2 border-dashed border-white/10 rounded-xl p-3 cursor-pointer text-center">
                        <input ref={(el) => { productPhotoRefs.current[index] = el; }} type="file" accept="image/*" className="hidden" onChange={(e) => { const f = e.target.files?.[0]; if (f) handleProductPhoto(index, f); }} />
                        {product.photo ? <p className="text-emerald-400 text-sm">✓ {product.photo.name}</p> : <p className="text-slate-500 text-sm">📷 Upload photo (optional)</p>}
                      </div>
                    </div>
                  ))}
                  {products.length < 12 && <button onClick={addProduct} className="w-full h-12 rounded-2xl border border-white/10 text-slate-400 text-sm">+ Add another item</button>}
                </div>
              )}
              {pricingMethod === "manual" && pricingType !== "products" && (
                <TextAreaField icon="💰" label="Pricing Details" value={pricingDetails} onChange={(e: any) => setPricingDetails(e.target.value)} placeholder={pricingType === "tiers" ? "e.g. Starter $99/month - X, Y, Z. Business $199/month - A, B, C" : pricingType === "hourly" ? "e.g. $85/hour, minimum 2 hours" : "Describe how your quoting works"} />
              )}
              {pricingMethod === "weknow" && (
                <div className="bg-emerald-500/10 border border-emerald-500/20 rounded-2xl p-4">
                  <p className="text-emerald-400 text-sm">✓ We'll create a professional pricing section that suits your industry and style.</p>
                </div>
              )}
            </div>
          )}

          {/* STEP: design */}
          {currentStepId === 'design' && (
            <div className="space-y-4 md:space-y-5">
              <InputField icon="🎨" label="Style" value={style} onChange={(e: any) => setStyle(e.target.value)} placeholder="e.g. Luxury dark, Clean minimal, Warm rustic, Bold modern" />
              <InputField icon="🎨" label="Colour Preferences" value={colorPrefs} onChange={(e: any) => setColorPrefs(e.target.value)} placeholder="e.g. Navy and gold, Black and white, Cream and terracotta" />
              <TextAreaField icon="🔗" label="Reference Websites (optional)" value={references} onChange={(e: any) => setReferences(e.target.value)} placeholder="Links to websites you like, or describe what appeals to you" />
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

          {/* STEP: assets */}
          {currentStepId === 'assets' && (
            <div className="space-y-4">
              <p className="text-slate-400 text-sm">All images compressed automatically. Skip anything you don't have yet.</p>
              <FileUploadBox label="📎 Upload Your Logo" hint="Any size — we compress it" file={logoFile} onChange={handleLogoChange} inputRef={logoRef} accept="image/*" />
              <FileUploadBox label="🖼️ Upload Hero / Banner Image" hint="Main background image — any size" file={heroFile} onChange={handleHeroChange} inputRef={heroRef} accept="image/*" />
              <div onClick={() => photosRef.current?.click()} className="border-2 border-dashed border-white/10 rounded-2xl p-5 cursor-pointer text-center bg-slate-900/50">
                <input ref={photosRef} type="file" accept="image/*" multiple className="hidden" onChange={handlePhotoChange} />
                <p className="text-slate-300 font-semibold text-sm">📷 Additional Photos</p>
                <p className="text-slate-500 text-xs mt-1">Up to 5 general photos</p>
                {photoFiles.length > 0 && photoFiles.map((f, i) => <p key={i} className="text-emerald-400 text-xs mt-1">✓ {f.name}</p>)}
              </div>
              <p className="text-slate-600 text-xs text-center">No assets? Skip this — we'll use professional stock images.</p>
            </div>
          )}

          {/* STEP: contact */}
          {currentStepId === 'contact' && (
            <div className="space-y-4 md:space-y-5">
              <div>
                <label className="block text-xs font-semibold text-slate-400 uppercase tracking-widest mb-3">📝 Do you have website copy ready?</label>
                <div className="grid gap-2">
                  {["Yes — I will provide all text", "Partially — I have some text", "No — please write it for me"].map(opt => (
                    <SelectCard key={opt} selected={hasContent === opt} onClick={() => setHasContent(opt)} label={opt} />
                  ))}
                </div>
              </div>
              <TextAreaField icon="📌" label="Anything else we should know? (optional)" value={additionalNotes} onChange={(e: any) => setAdditionalNotes(e.target.value)} placeholder="Deadline, special requirements, competitors, links to pull content from..." />
              <div className="border-t border-white/8 pt-5 space-y-4">
                <p className="text-white font-semibold">📬 Your Contact Details</p>
                <InputField icon="👤" label="Full Name" value={name} onChange={(e: any) => setName(e.target.value)} placeholder="Your full name" required />
                <InputField icon="📧" label="Email Address" value={email} onChange={(e: any) => setEmail(e.target.value)} placeholder="your@email.com.au" required type="email" />
                <InputField icon="📱" label="Phone Number" value={phone} onChange={(e: any) => setPhone(e.target.value)} placeholder="04XX XXX XXX" required type="tel" />
                <InputField icon="🔢" label="ABN (optional)" value={abn} onChange={(e: any) => setAbn(e.target.value)} placeholder="12 345 678 901" />
              </div>
              <div><div ref={turnstileRef} />{!turnstileToken && turnstileReady && <p className="text-slate-500 text-xs mt-2">Complete the security check above to submit</p>}</div>
              {quote && (
                <div className="rounded-2xl bg-gradient-to-br from-emerald-950/50 to-slate-900/50 border border-emerald-500/20 p-5">
                  <p className="text-xs font-semibold text-emerald-400 uppercase tracking-widest mb-3">💰 Your Estimated Quote</p>
                  <div className="flex items-end gap-2 mb-1">
                    <p className="text-4xl md:text-5xl font-bold text-white">${quote.totalPrice.toLocaleString()}</p>
                    <p className="text-slate-400 mb-1 text-sm">one-time</p>
                  </div>
                  <p className="text-slate-400 text-sm mb-3">+ ${quote.monthlyPrice}/month hosting & maintenance</p>
                  <div className="bg-emerald-500/10 border border-emerald-500/20 rounded-xl p-3">
                    <p className="text-emerald-400 font-semibold text-sm">🎉 Saving ${quote.savings.toLocaleString()} vs the industry average</p>
                  </div>
                  <p className="text-slate-600 text-xs mt-2">{quote.packageName} Package</p>
                </div>
              )}
            </div>
          )}

          {/* Errors */}
          {errors.length > 0 && (
            <div className="mt-5 p-4 bg-red-500/10 border border-red-500/20 rounded-2xl">
              {errors.map((err, i) => <p key={i} className="text-red-400 text-sm">⚠️ {err}</p>)}
            </div>
          )}

          {/* Nav */}
          <div className="flex gap-3 mt-6 md:mt-8">
            {step > 1 && <button onClick={back} className="h-14 px-6 md:px-8 rounded-2xl border border-white/10 text-slate-400 font-medium text-sm">← Back</button>}
            <button onClick={next} disabled={compressing || (currentStepId === 'contact' && !turnstileToken)} className="flex-1 h-14 rounded-2xl bg-emerald-500 hover:bg-emerald-400 disabled:opacity-50 disabled:cursor-not-allowed text-black font-bold transition-all text-sm">
              {compressing ? "⏳ Compressing..." : currentStepId === 'contact' ? "🚀 Submit Request" : "Continue →"}
            </button>
          </div>
        </div>

        {/* Side Panel — hidden on mobile */}
        <div className="hidden lg:block">
          <div className="rounded-3xl bg-[#0f1623] border border-white/8 p-6 sticky top-8">
            <div className="flex items-center gap-2 mb-6">
              <div className="w-8 h-8 rounded-lg bg-emerald-500/20 flex items-center justify-center text-emerald-400 font-bold text-sm">W</div>
              <span className="font-semibold text-white">WebGecko</span>
            </div>
            <div className="space-y-1 mb-5">
              {steps.map((s, i) => (
                <div key={s.id} className={`flex items-center gap-3 p-2 rounded-xl transition-all ${i + 1 === step ? 'bg-emerald-500/10 border border-emerald-500/20' : i + 1 < step ? 'opacity-60' : 'opacity-25'}`}>
                  <div className={`w-5 h-5 rounded-full flex items-center justify-center text-xs flex-shrink-0 ${i + 1 < step ? 'bg-emerald-500 text-black font-bold' : i + 1 === step ? 'border-2 border-emerald-500 text-emerald-400' : 'border border-white/20 text-slate-600'}`}>
                    {i + 1 < step ? '✓' : i + 1}
                  </div>
                  <span className={`text-xs ${i + 1 === step ? 'text-white font-semibold' : 'text-slate-500'}`}>{s.label}</span>
                </div>
              ))}
            </div>
            <div className="border-t border-white/8 pt-4 space-y-1 text-xs text-slate-600">
              {businessName && <p>🏢 {businessName}</p>}
              {industry && <p>🏭 {industry}</p>}
              {goal && <p>🎯 {goal}</p>}
              {siteType && <p>📄 {siteType === 'multi' ? 'Multi Page' : 'Single Page'}</p>}
              {pages.length > 0 && <p className="truncate">📑 {pages.join(', ')}</p>}
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