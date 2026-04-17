"use client";

import { useState } from "react";

const API_URL = "/api/worker";

export default function HomePage() {
  const [step, setStep] = useState(1);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");

  // BUSINESS
  const [businessName, setBusinessName] = useState("");
  const [industry, setIndustry] = useState("");
  const [usp, setUsp] = useState("");

  // GOALS
  const [goal, setGoal] = useState("");

  // PAGES
  const [pages, setPages] = useState<string[]>([]);

  // FEATURES
  const [features, setFeatures] = useState<string[]>([]);

  // DESIGN
  const [style, setStyle] = useState("");
  const [references, setReferences] = useState("");

  // BUDGET
  const [budget, setBudget] = useState("");
  const [timeline, setTimeline] = useState("");

  // CONTACT
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");

  const totalSteps = 7;

  function toggleItem(arr: string[], value: string, setFn: any) {
    if (arr.includes(value)) {
      setFn(arr.filter((v) => v !== value));
    } else {
      setFn([...arr, value]);
    }
  }

  async function submit() {
    setLoading(true);

    const payload = {
      businessName,
      industry,
      usp,
      goal,
      pages,
      features,
      style,
      references,
      budget,
      timeline,
      name,
      email,
      phone,
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
    if (step < totalSteps) setStep(step + 1);
    else submit();
  }

  function back() {
    setStep(Math.max(1, step - 1));
  }

  return (
    <main className="min-h-screen bg-[#0f172a] text-white p-6 md:p-10">
      <div className="max-w-6xl mx-auto grid lg:grid-cols-[1fr_320px] gap-6">

        {/* MAIN */}
        <div className="rounded-[2rem] bg-[#111827] border border-white/10 p-8 shadow-2xl">

          <p className="text-sm uppercase tracking-widest text-slate-400">
            Project Brief
          </p>

          <h1 className="text-3xl md:text-5xl font-semibold mt-2">
            Website Project Questionnaire
          </h1>

          <div className="mt-6 h-2 bg-white/10 rounded-full overflow-hidden">
            <div
              className="h-full bg-white transition-all"
              style={{ width: `${(step / totalSteps) * 100}%` }}
            />
          </div>

          {/* STEP 1 */}
          {step === 1 && (
            <div className="space-y-4 mt-8">
              <input placeholder="Business Name" value={businessName} onChange={(e)=>setBusinessName(e.target.value)} className="input" />
              <input placeholder="Industry" value={industry} onChange={(e)=>setIndustry(e.target.value)} className="input" />
              <textarea placeholder="What makes your business unique?" value={usp} onChange={(e)=>setUsp(e.target.value)} className="textarea"/>
            </div>
          )}

          {/* STEP 2 */}
          {step === 2 && (
            <div className="space-y-4 mt-8">
              <select value={goal} onChange={(e)=>setGoal(e.target.value)} className="input">
                <option value="">Main goal of your website</option>
                <option>Generate leads</option>
                <option>Sell products</option>
                <option>Bookings</option>
                <option>Portfolio showcase</option>
              </select>
            </div>
          )}

          {/* STEP 3 */}
          {step === 3 && (
            <div className="grid gap-3 mt-8">
              {["Home","About","Services","Contact","Shop","Gallery"].map(p=>(
                <label key={p} className="card">
                  <input type="checkbox" onChange={()=>toggleItem(pages,p,setPages)} />
                  {p}
                </label>
              ))}
            </div>
          )}

          {/* STEP 4 */}
          {step === 4 && (
            <div className="grid gap-3 mt-8">
              {["Booking","Payments","Blog","Reviews","Live Chat","CRM"].map(f=>(
                <label key={f} className="card">
                  <input type="checkbox" onChange={()=>toggleItem(features,f,setFeatures)} />
                  {f}
                </label>
              ))}
            </div>
          )}

          {/* STEP 5 */}
          {step === 5 && (
            <div className="space-y-4 mt-8">
              <input placeholder="Style (Luxury, Modern...)" value={style} onChange={(e)=>setStyle(e.target.value)} className="input"/>
              <textarea placeholder="Websites you like (links)" value={references} onChange={(e)=>setReferences(e.target.value)} className="textarea"/>
            </div>
          )}

          {/* STEP 6 */}
          {step === 6 && (
            <div className="space-y-4 mt-8">
              <input placeholder="Budget Range" value={budget} onChange={(e)=>setBudget(e.target.value)} className="input"/>
              <input placeholder="Timeline" value={timeline} onChange={(e)=>setTimeline(e.target.value)} className="input"/>
            </div>
          )}

          {/* STEP 7 */}
          {step === 7 && (
            <div className="space-y-4 mt-8">
              <input placeholder="Full Name" value={name} onChange={(e)=>setName(e.target.value)} className="input"/>
              <input placeholder="Email" value={email} onChange={(e)=>setEmail(e.target.value)} className="input"/>
              <input placeholder="Phone" value={phone} onChange={(e)=>setPhone(e.target.value)} className="input"/>
            </div>
          )}

          {/* BUTTONS */}
          <div className="flex gap-4 mt-8">
            <button onClick={back} className="btn-outline">Back</button>
            <button onClick={next} className="btn-primary">
              {loading ? "Submitting..." : step === totalSteps ? "Submit" : "Next"}
            </button>
          </div>

          {message && <div className="mt-6 text-emerald-400">{message}</div>}
        </div>

        {/* SIDE */}
        <div className="hidden lg:block rounded-[2rem] bg-black border border-white/10 p-6 h-fit sticky top-10">
          <h2 className="text-xl font-semibold">Progress</h2>
          <p className="text-slate-400 mt-4">Step {step} of {totalSteps}</p>
          <p className="text-slate-500 mt-6 text-sm">
            This brief helps us create a tailored website for your business.
          </p>
        </div>
      </div>

      <style jsx>{`
        .input { height:56px;border-radius:16px;background:#1f2937;padding:0 16px;width:100% }
        .textarea { min-height:120px;border-radius:16px;background:#1f2937;padding:16px;width:100% }
        .card { display:flex;gap:10px;padding:14px;border-radius:16px;background:#1f2937 }
        .btn-primary { flex:1;height:56px;border-radius:16px;background:white;color:black }
        .btn-outline { flex:1;height:56px;border-radius:16px;border:1px solid white }
      `}</style>
    </main>
  );
}