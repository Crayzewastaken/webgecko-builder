"use client";

import { useState, useMemo, useRef, useEffect } from "react";

function calculateQuote(pages: string[], features: string[], siteType: string) {
  const pageCount = pages.length || 1;
  const hasEcommerce = features.includes('Payments / Shop');
  const hasBooking = features.includes('Booking System');
  const isMultiPage = siteType === 'multi';
  let packageName = 'Starter'; let basePrice = 1800; let competitorPrice = 3500;
  if (pageCount >= 8 || hasEcommerce || hasBooking) { packageName = 'Premium'; basePrice = 5500; competitorPrice = 15000; }
  else if (pageCount >= 4 || isMultiPage) { packageName = 'Business'; basePrice = 3200; competitorPrice = 7500; }
  let addons = 0;
  if (hasEcommerce && packageName !== 'Premium') addons += 300;
  if (hasBooking && packageName !== 'Premium') addons += 200;
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
const STORAGE_KEY = 'webgecko_v3_full';
function saveToStorage(data: any) { try { localStorage.setItem(STORAGE_KEY, JSON.stringify(data)); } catch (e) {} }
function loadFromStorage() { try { const d = localStorage.getItem(STORAGE_KEY); return d ? JSON.parse(d) : null; } catch { return null; } }

const FEATURE_BUNDLES = [
  { id: 'contact', icon: '📬', label: 'Contact & Enquiries', desc: 'Contact form, social media links', features: ['Contact Form', 'Social Media Links'] },
  { id: 'trust', icon: '⭐', label: 'Trust & Reviews', desc: 'Testimonials, FAQ, Social Proof', features: ['Reviews & Testimonials', 'FAQ Section'] },
  { id: 'booking', icon: '📅', label: 'Bookings', desc: 'Online appointment system', features: ['Booking System'] },
  { id: 'shop', icon: '🛒', label: 'Online Shop', desc: 'Sell products & accept payments', features: ['Payments / Shop'] },
  { id: 'growth', icon: '📈', label: 'Growth Tools', desc: 'Newsletter & Live Chat', features: ['Newsletter Signup', 'Live Chat'] },
];

const InputField = ({ icon, label, value, onChange, placeholder, required, type = 'text' }: any) => (
  <div className="mb-4">
    <label className="block text-[10px] font-black text-slate-500 uppercase tracking-widest mb-2">{icon} {label}</label>
    <input type={type} value={value} onChange={onChange} placeholder={placeholder} className="w-full h-14 rounded-2xl bg-slate-900 border border-white/10 px-5 text-white placeholder:text-slate-600 focus:outline-none focus:border-emerald-500/50 transition-all" />
  </div>
);

export default function HomePage() {
  const [step, setStep] = useState(1);
  const [submitted, setSubmitted] = useState(false);
  const [compressing, setCompressing] = useState(false);
  const [turnstileToken, setTurnstileToken] = useState("");
  const turnstileRef = useRef<HTMLDivElement>(null);

  const [businessName, setBusinessName] = useState("");
  const [industry, setIndustry] = useState("");
  const [usp, setUsp] = useState("");
  const [goal, setGoal] = useState("");
  const [siteType, setSiteType] = useState("");
  const [pages, setPages] = useState<string[]>([]);
  const [selectedBundles, setSelectedBundles] = useState<string[]>([]);
  const [hasPricing, setHasPricing] = useState("");
  const [pricingMethod, setPricingMethod] = useState("");
  const [pricingDetails, setPricingDetails] = useState("");
  const [style, setStyle] = useState("");
  const [colorPrefs, setColorPrefs] = useState("");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [logoFile, setLogoFile] = useState<File | null>(null);

  const logoRef = useRef<HTMLInputElement>(null);

  const steps = useMemo(() => {
    const base = [
      { id: 'business', label: 'Your Business' },
      { id: 'goals', label: 'Website Goals' },
      { id: 'pages', label: 'Pages' },
      { id: 'features', label: 'Features' },
      { id: 'pricing', label: 'Pricing' }
    ];
    if (hasPricing === 'Yes') base.push({ id: 'pricing_details', label: 'Pricing Details' });
    base.push({ id: 'design', label: 'Design' }, { id: 'assets', label: 'Assets' }, { id: 'contact', label: 'Final Details' });
    return base;
  }, [hasPricing]);

  const totalSteps = steps.length;
  const currentStepId = steps[step - 1]?.id;

  const features = useMemo(() => {
    const all: string[] = [];
    selectedBundles.forEach(id => FEATURE_BUNDLES.find(b => b.id === id)?.features.forEach(f => !all.includes(f) && all.push(f)));
    return all;
  }, [selectedBundles]);

  const quote = useMemo(() => calculateQuote(pages, features, siteType), [pages, features, siteType]);

  useEffect(() => {
    if (currentStepId !== 'contact') return;
    const script = document.createElement('script');
    script.src = 'https://challenges.cloudflare.com/turnstile/v0/api.js';
    script.async = true;
    script.onload = () => {
      if (turnstileRef.current && (window as any).turnstile) {
        (window as any).turnstile.render(turnstileRef.current, {
          sitekey: process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY,
          callback: (token: string) => setTurnstileToken(token),
        });
      }
    };
    document.head.appendChild(script);
  }, [currentStepId]);

  async function submit() {
    setSubmitted(true);
    const formData = new FormData();
    const fields: any = { businessName, industry, usp, goal, siteType, hasPricing, pricingMethod, pricingDetails, style, colorPrefs, name, email, phone, turnstileToken };
    Object.entries(fields).forEach(([k, v]) => formData.append(k, v as string));
    formData.append("pages", JSON.stringify(pages));
    formData.append("features", JSON.stringify(features));
    if (logoFile) formData.append("logo", logoFile);
    fetch("/api/worker", { method: "POST", body: formData }).catch(console.error);
  }

  return (
    <main className="min-h-screen bg-[#0a0f1a] text-white p-4 md:p-10">
      {!submitted ? (
        <div className="max-w-3xl mx-auto bg-[#0f1623] border border-white/10 rounded-[2.5rem] p-6 md:p-12 shadow-2xl">
          <div className="flex justify-between items-center mb-10">
            <span className="text-xs font-black text-emerald-400 uppercase tracking-[0.2em]">Step {step} / {totalSteps}</span>
            <div className="w-40 h-1.5 bg-white/5 rounded-full overflow-hidden">
               <div className="h-full bg-emerald-500 transition-all duration-700" style={{ width: `${(step/totalSteps)*100}%` }} />
            </div>
          </div>

          <h2 className="text-3xl font-bold mb-8">{steps[step-1]?.label}</h2>

          {currentStepId === 'business' && (
            <div className="space-y-4">
              <InputField icon="🏢" label="Business Name" value={businessName} onChange={(e:any)=>setBusinessName(e.target.value)} />
              <InputField icon="🏭" label="Industry" value={industry} onChange={(e:any)=>setIndustry(e.target.value)} />
              <TextAreaField label="Unique Selling Point" value={usp} onChange={(e:any)=>setUsp(e.target.value)} />
            </div>
          )}

          {currentStepId === 'goals' && (
            <div className="grid gap-3">
              {['Generate leads', 'Sell products', 'Accept bookings'].map(g => (
                <div key={g} onClick={()=>setGoal(g)} className={`p-6 rounded-2xl border-2 cursor-pointer transition-all ${goal === g ? 'border-emerald-500 bg-emerald-500/10' : 'border-white/5 bg-slate-900/50'}`}>{g}</div>
              ))}
              <div className="flex gap-4 mt-6">
                <div onClick={()=>setSiteType('single')} className={`flex-1 p-6 rounded-2xl border-2 text-center cursor-pointer ${siteType === 'single' ? 'border-emerald-500 bg-emerald-500/10' : 'border-white/5'}`}>Single Page</div>
                <div onClick={()=>setSiteType('multi')} className={`flex-1 p-6 rounded-2xl border-2 text-center cursor-pointer ${siteType === 'multi' ? 'border-emerald-500 bg-emerald-500/10' : 'border-white/5'}`}>Multi Page</div>
              </div>
            </div>
          )}

          {currentStepId === 'features' && (
            <div className="space-y-3">
              {FEATURE_BUNDLES.map(b => (
                <div key={b.id} onClick={()=>setSelectedBundles(selectedBundles.includes(b.id)?selectedBundles.filter(x=>x!==b.id):[...selectedBundles,b.id])} className={`p-5 rounded-2xl border-2 cursor-pointer transition-all ${selectedBundles.includes(b.id)?'border-emerald-500 bg-emerald-500/10':'border-white/5 bg-slate-900/50'}`}>
                  <div className="flex gap-4 items-center">
                    <span className="text-2xl">{b.icon}</span>
                    <div><p className="font-bold">{b.label}</p><p className="text-xs text-slate-500">{b.desc}</p></div>
                  </div>
                </div>
              ))}
            </div>
          )}

          {currentStepId === 'pricing' && (
            <div className="flex flex-col gap-4">
               <div onClick={()=>setHasPricing('Yes')} className={`p-10 rounded-2xl border-2 text-center cursor-pointer ${hasPricing === 'Yes'?'border-emerald-500 bg-emerald-500/10':'border-white/5'}`}>Include Pricing Section</div>
               <div onClick={()=>setHasPricing('No')} className={`p-10 rounded-2xl border-2 text-center cursor-pointer ${hasPricing === 'No'?'border-emerald-500 bg-emerald-500/10':'border-white/5'}`}>No Pricing Needed</div>
            </div>
          )}

          {currentStepId === 'pricing_details' && <TextAreaField label="List your Tiers or Products" value={pricingDetails} onChange={(e:any)=>setPricingDetails(e.target.value)} />}

          {currentStepId === 'design' && (
            <div className="space-y-6">
              <InputField label="Visual Style" value={style} onChange={(e:any)=>setStyle(e.target.value)} placeholder="Modern Dark, High-end Tech" />
              <InputField label="Brand Colors" value={colorPrefs} onChange={(e:any)=>setColorPrefs(e.target.value)} placeholder="Green accents on Dark Navy" />
            </div>
          )}

          {currentStepId === 'assets' && (
            <div onClick={()=>logoRef.current?.click()} className="p-20 border-4 border-dashed border-white/5 rounded-3xl text-center cursor-pointer hover:bg-white/5 transition-all">
              <input type="file" ref={logoRef} className="hidden" onChange={(e)=>setLogoFile(e.target.files?.[0] || null)} />
              <p className="text-4xl mb-4">📸</p>
              <p className="text-xl font-bold">{logoFile ? logoFile.name : "Upload Your Logo"}</p>
            </div>
          )}

          {currentStepId === 'contact' && (
            <div className="space-y-6">
              <InputField label="Full Name" value={name} onChange={(e:any)=>setName(e.target.value)} />
              <InputField label="Email Address" value={email} onChange={(e:any)=>setEmail(e.target.value)} type="email" />
              <InputField label="Phone Number" value={phone} onChange={(e:any)=>setPhone(e.target.value)} />
              <div ref={turnstileRef} className="mt-6" />
            </div>
          )}

          <div className="flex gap-4 mt-12">
            {step > 1 && <button onClick={()=>setStep(step-1)} className="h-16 px-10 rounded-2xl bg-white/5 font-bold uppercase text-[10px] tracking-widest">Back</button>}
            <button onClick={step === totalSteps ? submit : ()=>setStep(step+1)} className="flex-1 h-16 rounded-2xl bg-emerald-500 text-black font-black uppercase text-[10px] tracking-widest">
              {step === totalSteps ? "🚀 Build My Project" : "Continue →"}
            </button>
          </div>
        </div>
      ) : (
        <div className="max-w-md mx-auto text-center py-32">
          <div className="w-20 h-20 bg-emerald-500/20 rounded-full flex items-center justify-center mx-auto mb-8 border-2 border-emerald-500">✓</div>
          <h1 className="text-4xl font-bold mb-4">Request Sent!</h1>
          <p className="text-slate-400">Check your email <span className="text-white font-bold">{email}</span> in 2-5 minutes for your preview and quote.</p>
        </div>
      )}
    </main>
  );
}

const TextAreaField = ({ label, value, onChange, placeholder }: any) => (
  <div className="mb-4">
    <label className="block text-[10px] font-black text-slate-500 uppercase tracking-widest mb-2">{label}</label>
    <textarea value={value} onChange={onChange} placeholder={placeholder} className="w-full h-32 rounded-2xl bg-slate-900 border border-white/10 p-5 text-white text-sm resize-none" />
  </div>
);

const CheckCard = ({ label, checked, onClick }: any) => (
  <div onClick={onClick} className={`p-4 rounded-xl border-2 cursor-pointer text-center transition-all ${checked ? 'border-emerald-500 bg-emerald-500/10' : 'border-white/5 bg-slate-900/50'}`}>{label}</div>
);