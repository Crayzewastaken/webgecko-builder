"use client";

import { useState, useMemo, useRef, useEffect } from "react";
import { calculatePrice } from "@/lib/pricing";

// Thin adapter so the rest of the page component doesn't need changing.
// All prices are sourced from lib/pricing.ts — the single source of truth.
function calculateQuote(pages: string[], features: string[], siteType: string) {
  const result = calculatePrice({ pages, features, siteType });
  return {
    packageName:     result.packageName,
    totalPrice:      result.totalPrice,
    monthlyPrice:    result.monthlyPrice,
    monthlyIntro:    result.monthlyPrice,
    monthlyOngoing:  result.monthlyOngoing,
    savings:         result.savings,
    competitorPrice: result.competitorPrice,
  };
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
  { id: 'contact', icon: '📬', label: 'Contact & Enquiries', desc: 'Contact form, social media links', features: ['Contact Form', 'Social Media Links'], exclusiveGroup: null, requiresPage: null },
  { id: 'trust', icon: '⭐', label: 'Trust & Reviews', desc: 'Customer reviews, testimonials, FAQ section', features: ['Reviews & Testimonials', 'FAQ Section'], exclusiveGroup: null, requiresPage: null },
  { id: 'location', icon: '📍', label: 'Location & Maps', desc: 'Google Maps, directions to your business', features: ['Google Maps'], exclusiveGroup: null, requiresPage: null },
  { id: 'booking', icon: '📅', label: 'Bookings & Appointments', desc: 'Online booking system for appointments or classes', features: ['Booking System'], exclusiveGroup: 'commerce', requiresPage: 'Booking' },
  { id: 'shop', icon: '🛒', label: 'Online Shop & Payments', desc: 'Sell products online and accept payments via Square', features: ['Payments / Shop'], exclusiveGroup: 'commerce', requiresPage: 'Shop' },
  { id: 'content', icon: '📰', label: 'Blog & Content', desc: 'Blog posts, news, articles and updates', features: ['Blog'], exclusiveGroup: null, requiresPage: 'Blog' },
  { id: 'gallery', icon: '🖼️', label: 'Photo Gallery', desc: 'Showcase your work, products or portfolio', features: ['Photo Gallery'], exclusiveGroup: null, requiresPage: 'Gallery' },
  { id: 'growth', icon: '📈', label: 'Growth & Marketing', desc: 'Newsletter signup, live chat, pop-up forms', features: ['Newsletter Signup', 'Live Chat', 'Pop-up Form'], exclusiveGroup: null, requiresPage: null },
  { id: 'video', icon: '🎥', label: 'Video Background', desc: 'Cinematic video hero section', features: ['Video Background'], exclusiveGroup: null, requiresPage: null },
];

// ── Shared UI primitives (defined OUTSIDE component to prevent remount on re-render) ──

const Label = ({ children }: { children: React.ReactNode }) => (
  <label className="block text-xs font-bold text-slate-400 uppercase tracking-widest mb-2">{children}</label>
);

const InputField = ({ icon, label, value, onChange, placeholder, required, type = 'text', hint, maxLength, inputMode, pattern }: any) => (
  <div className="space-y-1.5">
    <Label>{icon && <span className="mr-1.5">{icon}</span>}{label}{required && <span className="text-red-400 ml-1">*</span>}</Label>
    <input
      type={type} value={value} onChange={onChange} placeholder={placeholder}
      maxLength={maxLength} inputMode={inputMode} pattern={pattern}
      className="w-full h-[52px] rounded-xl bg-[#111827] border border-white/10 px-4 text-white placeholder:text-slate-600 focus:outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/20 transition-all text-base"
    />
    {hint && <p className="text-slate-500 text-xs leading-relaxed">{hint}</p>}
  </div>
);

const TextAreaField = ({ icon, label, value, onChange, placeholder, required, rows = 4 }: any) => (
  <div className="space-y-1.5">
    <Label>{icon && <span className="mr-1.5">{icon}</span>}{label}{required && <span className="text-red-400 ml-1">*</span>}</Label>
    <textarea
      value={value} onChange={onChange} placeholder={placeholder} rows={rows}
      className="w-full rounded-xl bg-[#111827] border border-white/10 px-4 py-3 text-white placeholder:text-slate-600 focus:outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/20 transition-all resize-none text-base leading-relaxed"
    />
  </div>
);

const SelectCard = ({ selected, onClick, label, desc, icon, badge }: any) => (
  <button
    type="button"
    onClick={onClick}
    className={`w-full text-left rounded-xl p-4 border-2 transition-all duration-200 active:scale-[0.98] ${selected ? 'border-emerald-500 bg-emerald-500/10 shadow-[0_0_20px_rgba(16,185,129,0.12)]' : 'border-white/8 bg-[#111827] hover:border-white/20'}`}
  >
    <div className="flex items-center gap-3">
      <div className={`w-5 h-5 rounded-full border-2 flex-shrink-0 flex items-center justify-center transition-all ${selected ? 'border-emerald-500 bg-emerald-500' : 'border-white/25'}`}>
        {selected && <div className="w-2 h-2 rounded-full bg-white" />}
      </div>
      {icon && <span className="text-xl flex-shrink-0">{icon}</span>}
      <div className="flex-1 min-w-0">
        <p className={`font-semibold text-sm ${selected ? 'text-white' : 'text-slate-200'}`}>{label}</p>
        {desc && <p className="text-slate-500 text-xs mt-0.5 leading-relaxed">{desc}</p>}
      </div>
      {badge && <span className="text-xs font-bold text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded-full flex-shrink-0">{badge}</span>}
    </div>
  </button>
);

const CheckCard = ({ checked, onClick, label, desc, icon }: any) => (
  <button
    type="button"
    onClick={onClick}
    className={`w-full text-left rounded-xl p-4 border-2 transition-all duration-200 active:scale-[0.98] ${checked ? 'border-emerald-500 bg-emerald-500/10 shadow-[0_0_20px_rgba(16,185,129,0.10)]' : 'border-white/8 bg-[#111827] hover:border-white/20'}`}
  >
    <div className="flex items-center gap-3">
      <div className={`w-5 h-5 rounded-md border-2 flex-shrink-0 flex items-center justify-center transition-all ${checked ? 'border-emerald-500 bg-emerald-500' : 'border-white/25'}`}>
        {checked && (
          <svg className="w-3 h-3 text-white" fill="none" viewBox="0 0 12 12">
            <path d="M2 6l3 3 5-5" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        )}
      </div>
      {icon && <span className="text-xl flex-shrink-0">{icon}</span>}
      <div className="flex-1 min-w-0">
        <p className={`font-semibold text-sm ${checked ? 'text-white' : 'text-slate-200'}`}>{label}</p>
        {desc && <p className="text-slate-500 text-xs mt-0.5 leading-relaxed">{desc}</p>}
      </div>
    </div>
  </button>
);

const FileUploadBox = ({ label, file, onChange, inputRef, accept, hint, icon = '📎' }: any) => (
  <button
    type="button"
    onClick={() => inputRef.current?.click()}
    className={`w-full border-2 border-dashed rounded-xl p-5 text-center transition-all active:scale-[0.98] ${file ? 'border-emerald-500/50 bg-emerald-500/5' : 'border-white/10 bg-[#111827] hover:border-white/20'}`}
  >
    <input ref={inputRef} type="file" accept={accept} className="hidden" onChange={onChange} />
    {file ? (
      <div>
        <p className="text-emerald-400 font-semibold text-sm">✓ {file.name}</p>
        <p className="text-slate-500 text-xs mt-1">{(file.size / 1024).toFixed(0)} KB · Tap to replace</p>
      </div>
    ) : (
      <div>
        <p className="text-2xl mb-2">{icon}</p>
        <p className="text-slate-300 font-semibold text-sm">{label}</p>
        <p className="text-slate-500 text-xs mt-1">{hint}</p>
      </div>
    )}
  </button>
);

export default function HomePage() {
  const [step, setStep] = useState(1);
  const [submitted, setSubmitted] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [compressing, setCompressing] = useState(false);
  const [turnstileToken, setTurnstileToken] = useState("");
  const [turnstileReady, setTurnstileReady] = useState(false);
  const [errors, setErrors] = useState<string[]>([]);
  const [showSidebar, setShowSidebar] = useState(false);
  const turnstileRef = useRef<HTMLDivElement>(null);
  const topRef = useRef<HTMLDivElement>(null);

  const [businessName, setBusinessName] = useState("");
  const [industry, setIndustry] = useState("");
  const [industryOther, setIndustryOther] = useState("");
  const INDUSTRY_OPTIONS = [
    "Food & Hospitality", "Health & Wellness", "Hospitals & Doctors", "Dental & Allied Health",
    "Beauty & Hair Salons", "Fitness & Gym", "Real Estate", "Legal & Law",
    "Accounting & Finance", "Construction & Trades", "Automotive", "Retail & E-commerce",
    "Education & Tutoring", "Childcare & Family", "Pet Services", "Photography & Creative",
    "IT & Technology", "Cleaning & Home Services", "Landscaping & Garden",
    "Events & Entertainment", "Non-Profit & Community", "Other",
  ];
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
  const [domain, setDomain] = useState("");
  const [ga4Id, setGa4Id] = useState("");
  const [businessAddress, setBusinessAddress] = useState("");
  const [facebookPage, setFacebookPage] = useState("");
  const [existingBookingUrl, setExistingBookingUrl] = useState("");
  const [bookingServices, setBookingServices] = useState("");
  const [instagramUrl, setInstagramUrl] = useState("");
  const [linkedinUrl, setLinkedinUrl] = useState("");
  const [tiktokUrl, setTiktokUrl] = useState("");
  const [realTestimonials, setRealTestimonials] = useState("");
  const [blogTopics, setBlogTopics] = useState("");
  const [videoUrl, setVideoUrl] = useState("");
  const [shopProducts, setShopProducts] = useState("");
  const [confirmRemovePage, setConfirmRemovePage] = useState<string | null>(null);
  const [logoFile, setLogoFile] = useState<File | null>(null);
  const [heroFile, setHeroFile] = useState<File | null>(null);
  const [photoFiles, setPhotoFiles] = useState<File[]>([]);

  const logoRef = useRef<HTMLInputElement>(null);
  const heroRef = useRef<HTMLInputElement>(null);
  const photosRef = useRef<HTMLInputElement>(null);
  const pricingSheetRef = useRef<HTMLInputElement>(null);
  const productPhotoRefs = useRef<(HTMLInputElement | null)[]>([]);

  const isMultiPage = siteType === 'multi';

  const steps = useMemo(() => {
    const base = [
      { id: 'business', label: 'Your Business', icon: '🏢' },
      { id: 'goals', label: 'Website Goals', icon: '🎯' },
      { id: 'features', label: 'Features', icon: '⚙️' },
      { id: 'pages', label: isMultiPage ? 'Pages' : siteType === 'single' ? 'Sections' : 'Pages / Sections', icon: '📄' },
      { id: 'pricing', label: 'Pricing', icon: '💰' },
    ];
    if (hasPricing === 'Yes' && pricingType !== 'quote') base.push({ id: 'pricing_details', label: 'Pricing Details', icon: '📋' });
    base.push({ id: 'design', label: 'Design', icon: '🎨' });
    base.push({ id: 'assets', label: 'Assets', icon: '🖼️' });
    base.push({ id: 'contact', label: 'Final Details', icon: '📬' });
    return base;
  }, [hasPricing, pricingType, siteType]);

  const requiredPages = useMemo(() => {
    const req: string[] = [];
    selectedBundles.forEach(id => {
      const bundle = FEATURE_BUNDLES.find(b => b.id === id);
      if (bundle?.requiresPage) req.push(bundle.requiresPage);
    });
    return req;
  }, [selectedBundles]);

  const totalSteps = steps.length;
  const currentStepId = steps[step - 1]?.id;
  const progressPct = Math.round((step / totalSteps) * 100);

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
    if (siteType && !pages.includes("Home")) {
      setPages(p => ["Home", ...p.filter(pg => pg !== "Home")]);
    }
  }, [siteType]);

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
    if (saved.abn) setAbn(saved.abn);
    if (saved.domain) setDomain(saved.domain);
    if (saved.businessAddress) setBusinessAddress(saved.businessAddress);
    if (saved.facebookPage) setFacebookPage(saved.facebookPage);
    if (saved.step) setStep(saved.step);
  }, []);

  useEffect(() => {
    saveToStorage({ businessName, industry, usp, existingWebsite, targetAudience, goal, siteType, pages, selectedBundles, hasPricing, pricingType, pricingMethod, pricingDetails, pricingUrl, style, colorPrefs, references, hasLogo, hasContent, additionalNotes, name, email, phone, abn, domain, businessAddress, facebookPage, existingBookingUrl, bookingServices, instagramUrl, linkedinUrl, tiktokUrl, realTestimonials, blogTopics, videoUrl, shopProducts, step });
  }, [businessName, industry, usp, existingWebsite, targetAudience, goal, siteType, pages, selectedBundles, hasPricing, pricingType, pricingMethod, pricingDetails, pricingUrl, style, colorPrefs, references, hasLogo, hasContent, additionalNotes, name, email, phone, businessAddress, facebookPage, existingBookingUrl, bookingServices, instagramUrl, linkedinUrl, tiktokUrl, realTestimonials, blogTopics, videoUrl, shopProducts, step]);

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

  function toggleBundle(id: string) {
    const bundle = FEATURE_BUNDLES.find(b => b.id === id);
    if (!bundle) return;
    setSelectedBundles(prev => {
      const isSelected = prev.includes(id);
      if (isSelected) {
        const next = prev.filter(b => b !== id);
        if (bundle.requiresPage) {
          const stillNeeded = next.some(bid => {
            const b2 = FEATURE_BUNDLES.find(b => b.id === bid);
            return b2?.requiresPage === bundle.requiresPage;
          });
          if (!stillNeeded) setPages(p => p.filter(pg => pg !== bundle.requiresPage));
        }
        return next;
      } else {
        let next = [...prev];
        if (bundle.exclusiveGroup) {
          const conflicting = FEATURE_BUNDLES.filter(b => b.exclusiveGroup === bundle.exclusiveGroup && b.id !== id);
          conflicting.forEach(c => {
            next = next.filter(bid => bid !== c.id);
            if (c.requiresPage) setPages(p => p.filter(pg => pg !== c.requiresPage));
          });
        }
        next.push(id);
        if (bundle.requiresPage) setPages(p => p.includes(bundle.requiresPage!) ? p : [...p, bundle.requiresPage!]);
        return next;
      }
    });
  }

  function toggleItem(arr: string[], value: string, setFn: any) {
    setFn(arr.includes(value) ? arr.filter(v => v !== value) : [...arr, value]);
  }
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
      if (industry === "Other" && !industryOther.trim()) errs.push("Please describe your industry");
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
      if (!phone.trim() || phone.replace(/\D/g, '').length < 8) errs.push("A valid phone number is required");
      if (abn.trim() && abn.replace(/\s/g, '').length !== 11) errs.push("ABN must be 11 digits");
      if (!turnstileToken) errs.push("Please wait for the security check to complete");
    }
    return errs;
  }

  async function submit() {
    const errs = validateStep();
    if (errs.length > 0) { setErrors(errs); return; }
    setErrors([]);
    localStorage.removeItem(STORAGE_KEY);

    const formData = new FormData();
    const industryValue = industry === "Other" ? (industryOther.trim() || "Other") : industry;
    const fields: Record<string, string> = { businessName, industry: industryValue, usp, existingWebsite, targetAudience, goal, siteType, hasPricing, pricingType, pricingMethod, pricingDetails, pricingUrl, style, colorPrefs, references, hasLogo, hasContent, additionalNotes, name, email, phone, abn, domain, ga4Id, businessAddress, facebookPage, existingBookingUrl, bookingServices, instagramUrl, linkedinUrl, tiktokUrl, realTestimonials, blogTopics, videoUrl, shopProducts, turnstileToken };
    Object.entries(fields).forEach(([k, v]) => formData.append(k, v));
    formData.append("pages", JSON.stringify(pages));
    formData.append("features", JSON.stringify(features));
    formData.append("products", JSON.stringify(products.map(p => ({ name: p.name, price: p.price }))));
    products.forEach((p, i) => { if (p.photo) formData.append(`product_photo_${i}`, p.photo); });
    if (pricingFile) formData.append("pricing_sheet", pricingFile);
    if (logoFile) formData.append("logo", logoFile);
    if (heroFile) formData.append("hero", heroFile);
    photoFiles.forEach((f, i) => formData.append(`photo_${i}`, f));

    setSubmitting(true);
    try {
      const res = await fetch("/api/worker", { method: "POST", body: formData });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || data.success === false) {
        setErrors([data.message || "Something went wrong. Please try again."]);
        setSubmitting(false);
        return;
      }
      setSubmitted(true);
      setSubmitting(false);
    } catch (err) {
      setErrors(["Network error - please check your connection and try again."]);
      setSubmitting(false);
    }
  }

  function next() {
    const errs = validateStep();
    if (errs.length > 0) { setErrors(errs); topRef.current?.scrollIntoView({ behavior: 'smooth' }); return; }
    setErrors([]);
    if (step < totalSteps) { setStep(step + 1); topRef.current?.scrollIntoView({ behavior: 'smooth' }); }
    else submit();
  }

  function back() { setErrors([]); setStep(Math.max(1, step - 1)); topRef.current?.scrollIntoView({ behavior: 'smooth' }); }

  // ── Success screen ────────────────────────────────────────────────────

  if (submitted) {
    return (
      <main className="min-h-screen bg-[#070d19] text-white flex items-center justify-center p-5">
        <div className="max-w-md w-full text-center">
          <div className="relative w-28 h-28 mx-auto mb-8">
            <div className="absolute inset-0 rounded-full bg-emerald-500/20 animate-ping" />
            <div className="relative w-28 h-28 rounded-full bg-gradient-to-br from-emerald-500 to-emerald-600 flex items-center justify-center shadow-[0_0_60px_rgba(16,185,129,0.4)]">
              <svg className="w-14 h-14 text-white" fill="none" viewBox="0 0 24 24">
                <path d="M5 13l4 4L19 7" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </div>
          </div>
          <h1 className="text-3xl font-bold mb-3 tracking-tight">You're all set!</h1>
          <p className="text-slate-400 text-base mb-8 leading-relaxed">
            Your website request is in. Check <strong className="text-white">{email}</strong> - a confirmation lands in <strong className="text-white">2-5 minutes</strong>.
          </p>
          <div className="bg-[#0f1623] border border-white/8 rounded-2xl p-5 text-left space-y-4 mb-8">
            {[
              { icon: '📧', title: 'Confirmation email', sub: 'Arrives within 5 minutes (check spam if needed)' },
              { icon: '📞', title: "We'll be in touch within a few days", sub: phone || 'To review your request' },
              { icon: '🌐', title: businessName || 'Your new website', sub: "We'll prepare your custom preview. Most agencies take months - we take weeks." },
            ].map(({ icon, title, sub }) => (
              <div key={title} className="flex items-center gap-4">
                <div className="w-11 h-11 rounded-xl bg-emerald-500/15 border border-emerald-500/20 flex items-center justify-center text-xl flex-shrink-0">{icon}</div>
                <div>
                  <p className="text-white font-semibold text-sm">{title}</p>
                  <p className="text-slate-500 text-xs mt-0.5">{sub}</p>
                </div>
              </div>
            ))}
          </div>
          <p className="text-slate-600 text-xs">Didn't receive anything? Email <span className="text-slate-400">hello@webgecko.au</span></p>
        </div>
      </main>
    );
  }

  // ── Main form ─────────────────────────────────────────────────────────

  return (
    <div className="min-h-screen bg-[#070d19] text-white" ref={topRef}>

      {/* ── Sticky top progress bar ── */}
      <div className="sticky top-0 z-40 bg-[#070d19]/95 backdrop-blur-md border-b border-white/6 px-4 py-3">
        <div className="max-w-2xl mx-auto flex items-center gap-3">
          {/* Mobile sidebar toggle */}
          <button
            type="button"
            onClick={() => setShowSidebar(true)}
            className="lg:hidden w-9 h-9 rounded-lg bg-white/5 border border-white/10 flex items-center justify-center flex-shrink-0"
            aria-label="View steps"
          >
            <svg className="w-4 h-4 text-slate-400" fill="none" viewBox="0 0 16 16">
              <path d="M2 4h12M2 8h12M2 12h12" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
            </svg>
          </button>

          {/* Progress */}
          <div className="flex-1 min-w-0">
            <div className="flex items-center justify-between mb-1.5">
              <p className="text-xs text-slate-400 font-medium truncate">
                <span className="text-white font-semibold">{steps[step - 1]?.icon} {steps[step - 1]?.label}</span>
                <span className="hidden sm:inline text-slate-600"> - Step {step} of {totalSteps}</span>
              </p>
              <p className="text-xs font-bold text-emerald-400 ml-2 flex-shrink-0">{progressPct}%</p>
            </div>
            <div className="h-1.5 bg-white/6 rounded-full overflow-hidden">
              <div
                className="h-full bg-gradient-to-r from-emerald-500 to-emerald-400 rounded-full transition-all duration-500 ease-out"
                style={{ width: `${progressPct}%` }}
              />
            </div>
          </div>
        </div>
      </div>

      {/* ── Mobile sidebar overlay ── */}
      {showSidebar && (
        <div className="fixed inset-0 z-50 flex">
          <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={() => setShowSidebar(false)} />
          <div className="relative ml-auto w-72 max-w-[85vw] h-full bg-[#0f1623] border-l border-white/8 p-6 overflow-y-auto flex flex-col">
            <div className="flex items-center justify-between mb-6">
              <div className="flex items-center gap-2">
                <div className="w-7 h-7 rounded-lg bg-emerald-500/20 border border-emerald-500/30 flex items-center justify-center">
                  <span className="text-emerald-400 font-black text-xs">W</span>
                </div>
                <span className="font-bold text-white text-sm">WebGecko</span>
              </div>
              <button type="button" onClick={() => setShowSidebar(false)} className="w-8 h-8 rounded-lg bg-white/5 flex items-center justify-center text-slate-400">✕</button>
            </div>
            <div className="space-y-1 flex-1">
              {steps.map((s, i) => (
                <div key={s.id} className={`flex items-center gap-3 px-3 py-2.5 rounded-xl transition-all ${i + 1 === step ? 'bg-emerald-500/12 border border-emerald-500/20' : i + 1 < step ? 'opacity-70' : 'opacity-30'}`}>
                  <div className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold flex-shrink-0 ${i + 1 < step ? 'bg-emerald-500 text-black' : i + 1 === step ? 'border-2 border-emerald-500 text-emerald-400' : 'border border-white/20 text-slate-600'}`}>
                    {i + 1 < step ? (
                      <svg className="w-3 h-3" fill="none" viewBox="0 0 12 12">
                        <path d="M2 6l3 3 5-5" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
                      </svg>
                    ) : i + 1}
                  </div>
                  <span className={`text-xs font-medium ${i + 1 === step ? 'text-white' : 'text-slate-500'}`}>{s.icon} {s.label}</span>
                </div>
              ))}
            </div>
            {(businessName || industry || goal) && (
              <div className="mt-6 pt-5 border-t border-white/8 space-y-1.5 text-xs text-slate-600">
                {businessName && <p className="truncate">🏢 {businessName}</p>}
                {industry && <p>🏭 {industry}</p>}
                {goal && <p>🎯 {goal}</p>}
                {siteType && <p>📄 {siteType === 'multi' ? 'Multi Page' : 'Single Page'}</p>}
                {pages.length > 0 && <p className="truncate">📑 {pages.join(', ')}</p>}
              </div>
            )}
          </div>
        </div>
      )}

      {/* ── Page layout ── */}
      <div className="max-w-6xl mx-auto px-4 py-6 pb-28 lg:pb-10 lg:grid lg:grid-cols-[1fr_280px] lg:gap-8 lg:items-start">

        {/* ── Main form card ── */}
        <div className="bg-[#0f1623] border border-white/8 rounded-2xl shadow-2xl overflow-hidden">

          {/* Step header */}
          <div className="px-6 pt-6 pb-5 border-b border-white/6">
            <div className="flex items-center gap-3">
              <div className="w-11 h-11 rounded-xl bg-emerald-500/15 border border-emerald-500/25 flex items-center justify-center text-2xl flex-shrink-0">
                {steps[step - 1]?.icon}
              </div>
              <div>
                <p className="text-xs text-slate-500 font-medium">Step {step} of {totalSteps}</p>
                <h2 className="text-lg font-bold text-white leading-tight">{steps[step - 1]?.label}</h2>
              </div>
            </div>
          </div>

          {/* Step content */}
          <div className="px-6 py-6 space-y-5">

            {/* ── STEP: business ── */}
            {currentStepId === 'business' && (
              <div className="space-y-5">
                <InputField icon="🏢" label="Business Name" value={businessName} onChange={(e: any) => setBusinessName(e.target.value)} placeholder="e.g. Sunrise Bakery" required />
                <div className="space-y-1.5">
                  <Label>🏭 Industry <span className="text-red-400">*</span></Label>
                  <select
                    value={industry}
                    onChange={(e: any) => { setIndustry(e.target.value); if (e.target.value !== "Other") setIndustryOther(""); }}
                    className="w-full h-[52px] bg-[#111827] border border-white/10 rounded-xl px-4 text-white text-base focus:outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/20 appearance-none transition-all"
                    style={{ backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='12' viewBox='0 0 12 12'%3E%3Cpath fill='%2364748b' d='M6 8L1 3h10z'/%3E%3C/svg%3E")`, backgroundRepeat: "no-repeat", backgroundPosition: "right 16px center" }}
                  >
                    <option value="" disabled>Select your industry…</option>
                    {INDUSTRY_OPTIONS.map(opt => <option key={opt} value={opt}>{opt}</option>)}
                  </select>
                  {industry === "Other" && (
                    <input
                      type="text" value={industryOther}
                      onChange={(e: any) => setIndustryOther(e.target.value)}
                      placeholder="Please describe your industry…"
                      className="mt-2 w-full h-[52px] bg-[#111827] border border-white/10 rounded-xl px-4 text-white placeholder:text-slate-600 text-base focus:outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/20 transition-all"
                    />
                  )}
                </div>
                <InputField icon="🎯" label="Target Audience" value={targetAudience} onChange={(e: any) => setTargetAudience(e.target.value)} placeholder="e.g. Homeowners in Brisbane aged 30-55" required />
                <TextAreaField icon="⭐" label="What makes you unique?" value={usp} onChange={(e: any) => setUsp(e.target.value)} placeholder="What do you offer that competitors don't? What's your edge?" required rows={3} />
                <InputField icon="🌐" label="Existing Website (optional)" value={existingWebsite} onChange={(e: any) => setExistingWebsite(e.target.value)} placeholder="https://yourwebsite.com.au" />
              </div>
            )}

            {/* ── STEP: goals ── */}
            {currentStepId === 'goals' && (
              <div className="space-y-6">
                <div className="space-y-2">
                  <Label>🎯 Main Goal <span className="text-red-400">*</span></Label>
                  <div className="space-y-2">
                    {[
                      { val: "Generate leads", icon: "📥", desc: "Capture enquiries and contact requests" },
                      { val: "Sell products online", icon: "🛍️", desc: "Run an online shop or storefront" },
                      { val: "Accept bookings", icon: "📅", desc: "Let customers book appointments online" },
                      { val: "Showcase portfolio", icon: "🖼️", desc: "Show off your work or projects" },
                      { val: "Provide information", icon: "📋", desc: "Share info about your services" },
                      { val: "Build brand awareness", icon: "🚀", desc: "Get found and grow your brand" },
                    ].map(({ val, icon, desc }) => (
                      <SelectCard key={val} selected={goal === val} onClick={() => setGoal(val)} label={val} desc={desc} icon={icon} />
                    ))}
                  </div>
                </div>
                <div className="space-y-2">
                  <Label>📄 Website Type <span className="text-red-400">*</span></Label>
                  <div className="space-y-2">
                    <SelectCard selected={siteType === "single"} onClick={() => setSiteType("single")} label="Single Page" desc="Everything on one scrollable page. Clean, fast and modern." icon="📃" badge="Popular" />
                    <SelectCard selected={siteType === "multi"} onClick={() => setSiteType("multi")} label="Multi Page" desc="Separate pages like Home, About, Services, Contact." icon="📑" />
                  </div>
                </div>
              </div>
            )}

            {/* ── STEP: pages / sections ── */}
            {currentStepId === 'pages' && (
              <div className="space-y-4">
                <div>
                  <Label>
                    {siteType === 'single' ? '📃 Select Sections' : '📑 Select Pages'} <span className="text-red-400">*</span>
                  </Label>
                  <p className="text-slate-500 text-sm mb-4 leading-relaxed">
                    {siteType === 'single' ? 'Choose which sections appear on your page.' : 'Choose which pages your website will have.'}{' '}
                    Home is always included.{requiredPages.length > 0 && ' Locked pages are required by your selected features.'}
                  </p>
                </div>

                {confirmRemovePage && (
                  <div className="p-4 bg-amber-500/10 border border-amber-500/30 rounded-xl">
                    <p className="text-amber-400 font-semibold text-sm mb-1">Remove "{confirmRemovePage}"?</p>
                    <p className="text-slate-400 text-xs mb-3">This is required by a feature you selected. Removing it may affect functionality.</p>
                    <div className="flex gap-2">
                      <button type="button" onClick={() => { setPages(p => p.filter(pg => pg !== confirmRemovePage)); setConfirmRemovePage(null); }} className="flex-1 h-9 rounded-lg bg-amber-500 text-black text-xs font-bold">Yes, remove</button>
                      <button type="button" onClick={() => setConfirmRemovePage(null)} className="flex-1 h-9 rounded-lg border border-white/10 text-slate-400 text-xs">Keep it</button>
                    </div>
                  </div>
                )}

                <div className="grid grid-cols-2 gap-2">
                  {["Home", "About", "Services", "Contact", "Shop", "Gallery", "Blog", "Booking", "FAQ", "Testimonials", "Pricing", "Portfolio", "Team", "Menu"].map(pg => {
                    const isHome = pg === "Home";
                    const isRequired = isHome || requiredPages.includes(pg);
                    const isChecked = isHome ? true : pages.includes(pg);
                    return (
                      <button
                        type="button"
                        key={pg}
                        onClick={() => {
                          if (isHome) return;
                          if (isRequired && isChecked) { setConfirmRemovePage(pg); return; }
                          toggleItem(pages, pg, setPages);
                        }}
                        className={`rounded-xl p-3 border-2 transition-all flex items-center gap-2.5 active:scale-[0.97] text-left ${isHome ? 'border-emerald-500/40 bg-emerald-500/5 cursor-default' : isChecked ? 'border-emerald-500 bg-emerald-500/10' : 'border-white/8 bg-[#111827] hover:border-white/20'}`}
                      >
                        <div className={`w-4.5 h-4.5 rounded-md flex-shrink-0 flex items-center justify-center border-2 transition-all ${isChecked ? 'border-emerald-500 bg-emerald-500' : 'border-white/25'}`}>
                          {isChecked && (
                            isRequired
                              ? <span className="text-[9px]">🔒</span>
                              : <svg className="w-2.5 h-2.5 text-white" fill="none" viewBox="0 0 10 10"><path d="M1.5 5l2.5 2.5 4.5-4.5" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" /></svg>
                          )}
                        </div>
                        <span className={`text-xs font-semibold ${isChecked ? 'text-white' : 'text-slate-400'}`}>{pg}</span>
                      </button>
                    );
                  })}
                </div>

                {pages.length > 1 && (
                  <div className="p-3 bg-[#111827] rounded-xl border border-white/8">
                    <p className="text-xs text-slate-500 leading-relaxed">
                      <span className="text-white font-semibold">Selected: </span>{["Home", ...pages.filter(p => p !== "Home")].join(' · ')}
                    </p>
                  </div>
                )}
              </div>
            )}

            {/* ── STEP: features ── */}
            {currentStepId === 'features' && (
              <div className="space-y-5">
                <p className="text-slate-400 text-sm leading-relaxed">Pick the feature bundles that suit your business. You can always add more later.</p>

                <div className="space-y-2">
                  <div className="flex items-center gap-2 mb-3">
                    <div className="h-px flex-1 bg-amber-500/20" />
                    <p className="text-xs font-bold text-amber-400 uppercase tracking-widest whitespace-nowrap">Pick one - Bookings or Shop</p>
                    <div className="h-px flex-1 bg-amber-500/20" />
                  </div>
                  {FEATURE_BUNDLES.filter(b => b.exclusiveGroup === 'commerce').map(bundle => {
                    const isSelected = selectedBundles.includes(bundle.id);
                    const conflictSelected = FEATURE_BUNDLES.filter(b2 => b2.exclusiveGroup === 'commerce' && b2.id !== bundle.id).some(b2 => selectedBundles.includes(b2.id));
                    return (
                      <button
                        type="button"
                        key={bundle.id}
                        onClick={() => toggleBundle(bundle.id)}
                        className={`w-full text-left rounded-xl p-4 border-2 transition-all duration-200 active:scale-[0.98] ${isSelected ? 'border-emerald-500 bg-emerald-500/10 shadow-[0_0_20px_rgba(16,185,129,0.12)]' : conflictSelected ? 'border-white/5 bg-[#111827]/40 opacity-40' : 'border-white/8 bg-[#111827] hover:border-white/20'}`}
                      >
                        <div className="flex items-start gap-3">
                          <div className={`w-5 h-5 rounded-full border-2 flex-shrink-0 mt-0.5 flex items-center justify-center ${isSelected ? 'border-emerald-500 bg-emerald-500' : 'border-white/25'}`}>
                            {isSelected && <div className="w-2 h-2 rounded-full bg-white" />}
                          </div>
                          <span className="text-xl flex-shrink-0">{bundle.icon}</span>
                          <div>
                            <p className="font-semibold text-white text-sm">{bundle.label}</p>
                            <p className="text-slate-500 text-xs mt-0.5">{bundle.desc}</p>
                            {isSelected && bundle.requiresPage && <p className="text-emerald-400 text-xs mt-1.5">✓ "{bundle.requiresPage}" page added automatically</p>}
                          </div>
                        </div>
                      </button>
                    );
                  })}
                </div>

                <div className="space-y-2">
                  {FEATURE_BUNDLES.filter(b => !b.exclusiveGroup).map(bundle => {
                    const isSelected = selectedBundles.includes(bundle.id);
                    return (
                      <button
                        type="button"
                        key={bundle.id}
                        onClick={() => toggleBundle(bundle.id)}
                        className={`w-full text-left rounded-xl p-4 border-2 transition-all duration-200 active:scale-[0.98] ${isSelected ? 'border-emerald-500 bg-emerald-500/10 shadow-[0_0_20px_rgba(16,185,129,0.10)]' : 'border-white/8 bg-[#111827] hover:border-white/20'}`}
                      >
                        <div className="flex items-start gap-3">
                          <div className={`w-5 h-5 rounded-md border-2 flex-shrink-0 mt-0.5 flex items-center justify-center ${isSelected ? 'border-emerald-500 bg-emerald-500' : 'border-white/25'}`}>
                            {isSelected && (
                              <svg className="w-3 h-3 text-white" fill="none" viewBox="0 0 12 12">
                                <path d="M2 6l3 3 5-5" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
                              </svg>
                            )}
                          </div>
                          <span className="text-xl flex-shrink-0">{bundle.icon}</span>
                          <div>
                            <p className="font-semibold text-white text-sm">{bundle.label}</p>
                            <p className="text-slate-500 text-xs mt-0.5">{bundle.desc}</p>
                            {isSelected && bundle.requiresPage && <p className="text-emerald-400 text-xs mt-1.5">✓ "{bundle.requiresPage}" page added automatically</p>}
                          </div>
                        </div>
                      </button>
                    );
                  })}
                </div>

                {selectedBundles.length > 0 && (
                  <div className="p-3 bg-emerald-500/8 border border-emerald-500/20 rounded-xl">
                    <p className="text-xs text-emerald-400 font-medium leading-relaxed">✓ {features.join(' · ')}</p>
                  </div>
                )}
              </div>
            )}

            {/* ── STEP: pricing ── */}
            {currentStepId === 'pricing' && (
              <div className="space-y-6">
                <div className="space-y-2">
                  <Label>💰 Pricing Section <span className="text-red-400">*</span></Label>
                  <div className="space-y-2">
                    <SelectCard selected={hasPricing === "Yes"} onClick={() => setHasPricing("Yes")} label="Yes - include pricing" desc="Show your prices, packages or menu on the site" icon="💰" />
                    <SelectCard selected={hasPricing === "No"} onClick={() => setHasPricing("No")} label="No - clients contact me for a quote" desc="No prices shown - leads submit enquiries instead" icon="💬" />
                  </div>
                </div>
                {hasPricing === "Yes" && (
                  <div className="space-y-2">
                    <Label>📊 Pricing Type</Label>
                    <div className="space-y-2">
                      <SelectCard selected={pricingType === "products"} onClick={() => setPricingType("products")} label="Individual Products / Services" desc="Each item has its own name, price and photo" icon="🛍️" />
                      <SelectCard selected={pricingType === "tiers"} onClick={() => setPricingType("tiers")} label="Pricing Tiers / Packages" desc="Starter / Business / Premium packages" icon="📦" />
                      <SelectCard selected={pricingType === "quote"} onClick={() => setPricingType("quote")} label="Quote Based" desc="Customers request a custom quote" icon="📋" />
                      <SelectCard selected={pricingType === "hourly"} onClick={() => setPricingType("hourly")} label="Hourly / Day Rate" desc="You charge by the hour or day" icon="⏱️" />
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* ── STEP: pricing_details ── */}
            {currentStepId === 'pricing_details' && (
              <div className="space-y-5">
                <div className="space-y-2">
                  <Label>📤 How to provide pricing</Label>
                  <div className="space-y-2">
                    <SelectCard selected={pricingMethod === "upload"} onClick={() => setPricingMethod("upload")} label="Upload a menu or price list" desc="PDF, image or Word document" icon="📄" />
                    <SelectCard selected={pricingMethod === "url"} onClick={() => setPricingMethod("url")} label="Use my existing website" desc="We'll pull pricing from your current site" icon="🌐" />
                    <SelectCard selected={pricingMethod === "manual"} onClick={() => setPricingMethod("manual")} label="Enter manually" desc="Type each item, price and upload photos" icon="✏️" />
                    <SelectCard selected={pricingMethod === "weknow"} onClick={() => setPricingMethod("weknow")} label="You decide for us" desc="We'll create a professional pricing section" icon="🤝" />
                  </div>
                </div>

                {pricingMethod === "upload" && (
                  <div onClick={() => pricingSheetRef.current?.click()} className={`border-2 border-dashed rounded-xl p-5 cursor-pointer text-center transition-all ${pricingFile ? 'border-emerald-500/50 bg-emerald-500/5' : 'border-white/10 bg-[#111827] hover:border-white/20'}`}>
                    <input ref={pricingSheetRef} type="file" accept="image/*,.pdf,.doc,.docx" className="hidden" onChange={(e) => { const f = e.target.files?.[0]; if (f) setPricingFile(f); }} />
                    {pricingFile ? <p className="text-emerald-400 font-semibold text-sm">✓ {pricingFile.name}</p> : <div><p className="text-2xl mb-2">📎</p><p className="text-slate-300 font-semibold text-sm">Upload menu or price list</p><p className="text-slate-500 text-xs mt-1">PDF, image, Word doc</p></div>}
                  </div>
                )}

                {pricingMethod === "url" && (
                  <InputField icon="🌐" label="Existing Website URL" value={pricingUrl} onChange={(e: any) => setPricingUrl(e.target.value)} placeholder="https://yourwebsite.com.au" />
                )}

                {pricingMethod === "manual" && pricingType === "products" && (
                  <div className="space-y-3">
                    {products.map((product, index) => (
                      <div key={index} className="bg-[#111827] border border-white/8 rounded-xl p-4 space-y-3">
                        <div className="flex justify-between items-center">
                          <p className="text-emerald-400 font-bold text-sm">Item {index + 1}</p>
                          {products.length > 1 && <button type="button" onClick={() => removeProduct(index)} className="text-red-400 text-xs font-medium">Remove</button>}
                        </div>
                        <InputField icon="🏷️" label="Product / Service Name" value={product.name} onChange={(e: any) => updateProduct(index, 'name', e.target.value)} placeholder="e.g. Sourdough Loaf" />
                        <InputField icon="💵" label="Price" value={product.price} onChange={(e: any) => updateProduct(index, 'price', e.target.value)} placeholder="e.g. $12 or from $85" />
                        <button type="button" onClick={() => productPhotoRefs.current[index]?.click()} className={`w-full border-2 border-dashed rounded-xl p-3 text-center transition-all ${product.photo ? 'border-emerald-500/50' : 'border-white/10 hover:border-white/20'}`}>
                          <input ref={(el) => { productPhotoRefs.current[index] = el; }} type="file" accept="image/*" className="hidden" onChange={(e) => { const f = e.target.files?.[0]; if (f) handleProductPhoto(index, f); }} />
                          {product.photo ? <p className="text-emerald-400 text-sm">✓ {product.photo.name}</p> : <p className="text-slate-500 text-sm">📷 Upload photo (optional)</p>}
                        </button>
                      </div>
                    ))}
                    {products.length < 12 && (
                      <button type="button" onClick={addProduct} className="w-full h-12 rounded-xl border border-white/10 text-slate-400 text-sm font-medium hover:border-white/20 transition-all">
                        + Add another item
                      </button>
                    )}
                  </div>
                )}

                {pricingMethod === "manual" && pricingType !== "products" && (
                  <TextAreaField icon="💰" label="Pricing Details" value={pricingDetails} onChange={(e: any) => setPricingDetails(e.target.value)} placeholder={pricingType === "tiers" ? "e.g. Starter $99/mo - X, Y, Z. Business $199/mo - A, B, C" : pricingType === "hourly" ? "e.g. $85/hour, minimum 2 hours" : "Describe how your quoting works"} />
                )}

                {pricingMethod === "weknow" && (
                  <div className="bg-emerald-500/10 border border-emerald-500/20 rounded-xl p-4">
                    <p className="text-emerald-400 text-sm">✓ We'll create a professional pricing section that suits your industry and style.</p>
                  </div>
                )}
              </div>
            )}

            {/* ── STEP: design ── */}
            {currentStepId === 'design' && (
              <div className="space-y-5">
                <InputField icon="✨" label="Style / Vibe" value={style} onChange={(e: any) => setStyle(e.target.value)} placeholder="e.g. Luxury dark, Clean minimal, Warm rustic, Bold modern" hint="Describe the look and feel you're going for." />
                <InputField icon="🎨" label="Colour Preferences" value={colorPrefs} onChange={(e: any) => setColorPrefs(e.target.value)} placeholder="e.g. Navy and gold, Black and white, Cream and terracotta" hint="Your brand colours, or colours you love." />
                <TextAreaField icon="🔗" label="Reference Websites (optional)" value={references} onChange={(e: any) => setReferences(e.target.value)} placeholder="Links to websites you love, or describe what appeals to you" rows={3} />
                <div className="space-y-2">
                  <Label>🖼️ Do you have a logo?</Label>
                  <div className="space-y-2">
                    {["Yes - I will provide it", "No - I need one designed", "No - please use text only"].map(opt => (
                      <SelectCard key={opt} selected={hasLogo === opt} onClick={() => setHasLogo(opt)} label={opt} />
                    ))}
                  </div>
                </div>
              </div>
            )}

            {/* ── STEP: assets ── */}
            {currentStepId === 'assets' && (
              <div className="space-y-4">
                <p className="text-slate-400 text-sm leading-relaxed">All images are compressed automatically. Skip anything you don't have yet - we'll use professional stock imagery.</p>
                <FileUploadBox label="Upload Your Logo" hint="Any size - PNG or SVG preferred" file={logoFile} onChange={handleLogoChange} inputRef={logoRef} accept="image/*" icon="🏷️" />
                <FileUploadBox label="Upload Hero / Banner Image" hint="Main background image - any size" file={heroFile} onChange={handleHeroChange} inputRef={heroRef} accept="image/*" icon="🖼️" />
                <button
                  type="button"
                  onClick={() => photosRef.current?.click()}
                  className={`w-full border-2 border-dashed rounded-xl p-5 text-center transition-all ${photoFiles.length > 0 ? 'border-emerald-500/50 bg-emerald-500/5' : 'border-white/10 bg-[#111827] hover:border-white/20'}`}
                >
                  <input ref={photosRef} type="file" accept="image/*" multiple className="hidden" onChange={handlePhotoChange} />
                  <p className="text-2xl mb-2">📷</p>
                  <p className="text-slate-300 font-semibold text-sm">Additional Photos</p>
                  <p className="text-slate-500 text-xs mt-1">Up to 5 general photos of your business or work</p>
                  {photoFiles.length > 0 && (
                    <div className="mt-2 space-y-0.5">
                      {photoFiles.map((f, i) => <p key={i} className="text-emerald-400 text-xs">✓ {f.name}</p>)}
                    </div>
                  )}
                </button>
              </div>
            )}

            {/* ── STEP: contact ── */}
            {currentStepId === 'contact' && (
              <div className="space-y-5">
                <div className="space-y-2">
                  <Label>📝 Do you have website copy ready?</Label>
                  <div className="space-y-2">
                    {["Yes - I will provide all text", "Partially - I have some text", "No - please write it for me"].map(opt => (
                      <SelectCard key={opt} selected={hasContent === opt} onClick={() => setHasContent(opt)} label={opt} />
                    ))}
                  </div>
                </div>

                <TextAreaField icon="📌" label="Anything else we should know? (optional)" value={additionalNotes} onChange={(e: any) => setAdditionalNotes(e.target.value)} placeholder="Deadline, special requirements, competitors to reference, links to pull content from…" rows={3} />

                {features.includes("Social Media Links") && (
                  <div className="space-y-4 p-4 rounded-xl border border-white/8 bg-[#111827]">
                    <div>
                      <p className="text-white font-semibold text-sm mb-1">📲 Social Media Links</p>
                      <p className="text-slate-500 text-xs leading-relaxed">We'll add these to your website footer and header. Leave blank for any you don't use.</p>
                    </div>
                    <InputField icon="📘" label="Facebook Page URL" value={facebookPage} onChange={(e: any) => setFacebookPage(e.target.value)} placeholder="facebook.com/yourbusiness" />
                    <InputField icon="📸" label="Instagram URL (optional)" value={instagramUrl} onChange={(e: any) => setInstagramUrl(e.target.value)} placeholder="instagram.com/yourbusiness" />
                    <InputField icon="💼" label="LinkedIn URL (optional)" value={linkedinUrl} onChange={(e: any) => setLinkedinUrl(e.target.value)} placeholder="linkedin.com/company/yourbusiness" />
                    <InputField icon="🎵" label="TikTok URL (optional)" value={tiktokUrl} onChange={(e: any) => setTiktokUrl(e.target.value)} placeholder="tiktok.com/@yourbusiness" />
                  </div>
                )}

                {features.includes("Reviews & Testimonials") && (
                  <div className="space-y-3 p-4 rounded-xl border border-white/8 bg-[#111827]">
                    <div>
                      <p className="text-white font-semibold text-sm mb-1">⭐ Customer Testimonials</p>
                      <p className="text-slate-500 text-xs leading-relaxed">Paste real reviews and we'll use them on your site. Leave blank and we'll write them for you.</p>
                    </div>
                    <TextAreaField icon="💬" label="Customer reviews (optional)" value={realTestimonials} onChange={(e: any) => setRealTestimonials(e.target.value)} placeholder={`"Amazing service, would highly recommend!" - Sarah M., Brisbane\n"Best in the business, 5 stars!" - John T., Gold Coast`} rows={4} />
                  </div>
                )}

                {features.includes("Blog") && (
                  <div className="space-y-3 p-4 rounded-xl border border-white/8 bg-[#111827]">
                    <div>
                      <p className="text-white font-semibold text-sm mb-1">📰 Blog Topics</p>
                      <p className="text-slate-500 text-xs leading-relaxed">Give us a few topics and we'll create preview blog cards. Leave blank and we'll come up with relevant topics for your industry.</p>
                    </div>
                    <InputField icon="✍️" label="Blog topics (optional)" value={blogTopics} onChange={(e: any) => setBlogTopics(e.target.value)} placeholder="e.g. Tips for saving water, 5 signs your pipes need fixing, DIY vs calling a plumber" hint="Comma-separated list of topics or post ideas." />
                  </div>
                )}

                {features.includes("Video Background") && (
                  <div className="space-y-3 p-4 rounded-xl border border-white/8 bg-[#111827]">
                    <div>
                      <p className="text-white font-semibold text-sm mb-1">🎥 Hero Video</p>
                      <p className="text-slate-500 text-xs leading-relaxed">YouTube URL or direct .mp4 link. Leave blank and we'll use a looping stock video matching your industry.</p>
                    </div>
                    <InputField icon="🔗" label="Video URL (optional)" value={videoUrl} onChange={(e: any) => setVideoUrl(e.target.value)} placeholder="https://youtube.com/watch?v=xxxxx or https://cdn.example.com/video.mp4" hint="YouTube URLs are automatically converted to embed format." />
                    <div className="bg-amber-500/10 border border-amber-500/20 rounded-lg p-3">
                      <p className="text-amber-400 text-xs">💡 Keep videos under 30 seconds for best hero performance.</p>
                    </div>
                  </div>
                )}

                {features.includes("Payments / Shop") && (
                  <div className="space-y-3 p-4 rounded-xl border border-white/8 bg-[#111827]">
                    <div>
                      <p className="text-white font-semibold text-sm mb-1">🛒 Online Shop Setup</p>
                      <p className="text-slate-500 text-xs leading-relaxed">Your shop will be built using Square. After launch, connect your Square account in your client portal.</p>
                    </div>
                    {products.some(p => p.name) ? (
                      <div className="bg-emerald-500/10 border border-emerald-500/20 rounded-lg p-3">
                        <p className="text-emerald-400 text-xs">✓ Using the {products.filter(p => p.name).length} product(s) you entered in the pricing step.</p>
                      </div>
                    ) : (
                      <TextAreaField icon="🏷️" label="Products to sell (optional)" value={shopProducts} onChange={(e: any) => setShopProducts(e.target.value)} placeholder={"Sourdough Loaf - $12\nCroissant - $5\nCoffee Subscription - $45/month"} rows={4} />
                    )}
                  </div>
                )}

                {features.includes("Booking System") && (
                  <div className="space-y-3 p-4 rounded-xl border border-white/8 bg-[#111827]">
                    <div>
                      <p className="text-white font-semibold text-sm mb-1">📅 Booking System</p>
                      <p className="text-slate-500 text-xs">Do you already have a booking system (e.g. SuperSaas, Calendly)?</p>
                    </div>
                    <div className="grid grid-cols-2 gap-2">
                      <button type="button" onClick={() => setExistingBookingUrl("")} className={`rounded-xl p-3 border-2 text-sm font-semibold text-center transition-all ${!existingBookingUrl ? "border-emerald-500 bg-emerald-500/10 text-white" : "border-white/10 bg-[#111827] text-slate-400"}`}>No - set it up for me</button>
                      <button type="button" onClick={() => { if (!existingBookingUrl) setExistingBookingUrl("https://"); }} className={`rounded-xl p-3 border-2 text-sm font-semibold text-center transition-all ${existingBookingUrl ? "border-emerald-500 bg-emerald-500/10 text-white" : "border-white/10 bg-[#111827] text-slate-400"}`}>Yes - I have one</button>
                    </div>
                    {existingBookingUrl && (
                      <InputField icon="🔗" label="Your booking link" value={existingBookingUrl} onChange={(e: any) => setExistingBookingUrl(e.target.value)} placeholder="e.g. https://supersaas.com/schedule/yourbusiness/appointments" hint="We'll embed this directly into your site." />
                    )}
                    <InputField icon="🗂️" label="Services offered (for booking dropdown)" value={bookingServices} onChange={(e: any) => setBookingServices(e.target.value)} placeholder="e.g. Haircut, Colour, Blowdry" hint="Comma-separated. Added as options in the booking form." />
                  </div>
                )}

                <div className="border-t border-white/8 pt-5 space-y-4">
                  <p className="text-white font-semibold text-sm">📬 Your Contact Details</p>
                  <InputField icon="👤" label="Full Name" value={name} onChange={(e: any) => setName(e.target.value)} placeholder="Your full name" required />
                  <InputField icon="📧" label="Email Address" value={email} onChange={(e: any) => setEmail(e.target.value)} placeholder="your@email.com.au" required type="email" />
                  <InputField icon="📱" label="Phone Number" value={phone} onChange={(e: any) => { const digits = e.target.value.replace(/\D/g, "").slice(0, 10); setPhone(digits); }} placeholder="0412345678" required type="tel" inputMode="numeric" maxLength={10} />
                  <InputField icon="🔢" label="ABN (optional)" value={abn} onChange={(e: any) => setAbn(e.target.value)} placeholder="12 345 678 901" hint="You can add this later in your client dashboard. Required before we register your domain." />
                  <InputField icon="🌐" label="Preferred Domain Name (optional)" value={domain} onChange={(e: any) => setDomain(e.target.value)} placeholder="e.g. mysalonbrisbane.com.au" hint="Already have one? Enter it here. Don't have one? No worries — you can add this in your dashboard after signing up." />
                  <InputField icon="📍" label="Business Address (optional)" value={businessAddress} onChange={(e: any) => setBusinessAddress(e.target.value)} placeholder="e.g. 123 Main St, Brisbane QLD 4000" hint="Used to embed a Google Map. You can add this later in your dashboard." />
                  <InputField icon="📊" label="Google Analytics ID (optional)" value={ga4Id} onChange={(e: any) => setGa4Id(e.target.value)} placeholder="G-XXXXXXXXXX" hint="Don't have one yet? No problem — you can add this anytime from your client dashboard." />
                </div>

                <div className="pt-1">
                  <div ref={turnstileRef} />
                  {!turnstileToken && turnstileReady && <p className="text-slate-500 text-xs mt-2">Complete the security check above to submit.</p>}
                </div>
              </div>
            )}

            {/* ── Errors ── */}
            {errors.length > 0 && (
              <div className="mt-4 p-4 bg-red-500/10 border border-red-500/25 rounded-xl space-y-1">
                {errors.map((err, i) => (
                  <div key={i} className="flex items-start gap-2">
                    <span className="text-red-400 mt-0.5 flex-shrink-0">⚠</span>
                    <p className="text-red-400 text-sm">{err}</p>
                  </div>
                ))}
              </div>
            )}

            {/* ── Desktop nav ── */}
            <div className="hidden lg:flex gap-3 mt-6">
              {step > 1 && (
                <button type="button" onClick={back} className="h-13 px-7 rounded-xl border border-white/10 text-slate-300 font-semibold text-sm hover:border-white/25 hover:text-white transition-all">
                  ← Back
                </button>
              )}
              <button
                type="button"
                onClick={next}
                disabled={compressing || submitting || (currentStepId === 'contact' && !turnstileToken)}
                className="flex-1 h-13 rounded-xl bg-emerald-500 hover:bg-emerald-400 active:bg-emerald-600 disabled:opacity-40 disabled:cursor-not-allowed text-black font-bold text-sm transition-all shadow-[0_4px_20px_rgba(16,185,129,0.3)]"
              >
                {submitting ? "⏳ Submitting…" : compressing ? "⏳ Compressing…" : currentStepId === 'contact' ? "🚀 Submit Request" : `Continue → `}
              </button>
            </div>
          </div>
        </div>

        {/* ── Desktop sidebar ── */}
        <div className="hidden lg:block sticky top-24">
          <div className="bg-[#0f1623] border border-white/8 rounded-2xl p-5">
            <div className="flex items-center gap-2.5 mb-5">
              <div className="w-8 h-8 rounded-lg bg-emerald-500/20 border border-emerald-500/30 flex items-center justify-center">
                <span className="text-emerald-400 font-black text-xs">W</span>
              </div>
              <span className="font-bold text-white">WebGecko</span>
            </div>
            <div className="space-y-0.5 mb-5">
              {steps.map((s, i) => (
                <div key={s.id} className={`flex items-center gap-2.5 px-3 py-2.5 rounded-xl transition-all ${i + 1 === step ? 'bg-emerald-500/12 border border-emerald-500/20' : i + 1 < step ? 'opacity-65' : 'opacity-25'}`}>
                  <div className={`w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-bold flex-shrink-0 ${i + 1 < step ? 'bg-emerald-500 text-black' : i + 1 === step ? 'border-2 border-emerald-500 text-emerald-400' : 'border border-white/20 text-slate-600'}`}>
                    {i + 1 < step ? (
                      <svg className="w-2.5 h-2.5" fill="none" viewBox="0 0 10 10"><path d="M1.5 5l2.5 2.5 4.5-4.5" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" /></svg>
                    ) : i + 1}
                  </div>
                  <span className={`text-xs font-medium truncate ${i + 1 === step ? 'text-white' : 'text-slate-500'}`}>{s.icon} {s.label}</span>
                </div>
              ))}
            </div>
            {(businessName || industry || goal) && (
              <div className="border-t border-white/8 pt-4 space-y-1.5 text-xs text-slate-600">
                {businessName && <p className="truncate">🏢 {businessName}</p>}
                {industry && <p>🏭 {industry}</p>}
                {goal && <p>🎯 {goal}</p>}
                {siteType && <p>📄 {siteType === 'multi' ? 'Multi Page' : 'Single Page'}</p>}
                {pages.length > 0 && <p className="truncate">📑 {pages.join(', ')}</p>}
                {name && <p>👤 {name}</p>}
              </div>
            )}
          </div>

          {/* Trust badges */}
          <div className="mt-4 bg-[#0f1623] border border-white/8 rounded-2xl p-4 space-y-3">
            {[
              { icon: '🔒', text: 'Secure & private - your data is never sold' },
              { icon: '⚡', text: 'Sites delivered in weeks, not months' },
              { icon: '💬', text: 'Free revisions included' },
              { icon: '🇦🇺', text: 'Australian-owned & operated' },
            ].map(({ icon, text }) => (
              <div key={text} className="flex items-center gap-2.5">
                <span className="text-base flex-shrink-0">{icon}</span>
                <p className="text-slate-500 text-xs leading-relaxed">{text}</p>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* ── Mobile floating bottom nav ── */}
      <div className="lg:hidden fixed bottom-0 left-0 right-0 z-30 bg-[#070d19]/95 backdrop-blur-md border-t border-white/8 px-4 py-3 safe-area-bottom">
        <div className="flex gap-3 max-w-2xl mx-auto">
          {step > 1 && (
            <button type="button" onClick={back} className="w-14 h-14 rounded-xl border border-white/12 flex items-center justify-center text-slate-300 flex-shrink-0 active:bg-white/5 transition-all">
              <svg className="w-5 h-5" fill="none" viewBox="0 0 20 20"><path d="M12 4l-6 6 6 6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" /></svg>
            </button>
          )}
          <button
            type="button"
            onClick={next}
            disabled={compressing || submitting || (currentStepId === 'contact' && !turnstileToken)}
            className="flex-1 h-14 rounded-xl bg-emerald-500 hover:bg-emerald-400 active:bg-emerald-600 disabled:opacity-40 disabled:cursor-not-allowed text-black font-bold text-sm transition-all shadow-[0_4px_24px_rgba(16,185,129,0.35)]"
          >
            {submitting ? "⏳ Submitting…" : compressing ? "⏳ Compressing…" : currentStepId === 'contact' ? "🚀 Submit Request" : "Continue →"}
          </button>
        </div>
      </div>

    </div>
  );
}
