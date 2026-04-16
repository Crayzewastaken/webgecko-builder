"use client";

import { useMemo, useState } from "react";

const API_URL =
  "https://webgecko-builder.vercel.app/api/worker";

const productOptions = ["1", "2", "3", "4", "5", "6+"];

export default function HomePage() {
  const [step, setStep] = useState(1);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");

  const [businessName, setBusinessName] = useState("");
  const [industry, setIndustry] = useState("");
  const [audience, setAudience] = useState("");
  const [styleNotes, setStyleNotes] = useState("");

  const [sellsProducts, setSellsProducts] = useState(false);
  const [productCount, setProductCount] = useState("1");
  const [products, setProducts] = useState([
    { name: "", price: "", description: "" },
  ]);

  const count = useMemo(
    () => (productCount === "6+" ? 6 : Number(productCount)),
    [productCount]
  );

  function updateProductCount(value: string) {
    setProductCount(value);
    const nextCount = value === "6+" ? 6 : Number(value);

    setProducts((prev) => {
      const clone = [...prev];
      while (clone.length < nextCount) {
        clone.push({
          name: "",
          price: "",
          description: "",
        });
      }
      return clone.slice(0, nextCount);
    });
  }

  function updateProduct(
    index: number,
    field: string,
    value: string
  ) {
    setProducts((prev) =>
      prev.map((p, i) =>
        i === index ? { ...p, [field]: value } : p
      )
    );
  }

  async function generateWebsite() {
    setLoading(true);
    setMessage("");

    const payload = {
      businessName,
      industry,
      audience,
      styleNotes,
      sellsProducts,
      products,
    };

    try {
      const res = await fetch(API_URL, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(payload),
      });

      const rawText = await res.text();
      let data: any;

      try {
        data = JSON.parse(rawText);
      } catch {
        setMessage(`Backend error: ${rawText}`);
        setLoading(false);
        return;
      }

      setMessage(
        data.message ||
          "Website generated and sent to your email"
      );
    } catch (error: any) {
      setMessage(error.message || "Request failed");
    }

    setLoading(false);
  }

  function handleNext() {
    if (step < 4) {
      setStep((s) => s + 1);
    } else {
      generateWebsite();
    }
  }

  return (
    <main className="min-h-screen bg-[#0f172a] text-white p-4 md:p-8">
      <div className="max-w-6xl mx-auto grid lg:grid-cols-[1fr_320px] gap-6">
        <div className="rounded-[2rem] shadow-2xl bg-[#111827] border border-white/10 p-6 md:p-10">
          <div className="mb-8">
            <p className="text-sm uppercase tracking-[0.3em] text-slate-400">
              AI Website Concierge
            </p>

            <h1 className="text-3xl md:text-5xl font-semibold mt-4 leading-tight">
              Build your premium website brief
            </h1>

            <div className="mt-6 h-2 bg-white/10 rounded-full overflow-hidden">
              <div
                className="h-full bg-white rounded-full transition-all"
                style={{ width: `${(step / 4) * 100}%` }}
              />
            </div>
          </div>

          {step === 1 && (
            <div className="space-y-4">
              <input
                value={businessName}
                onChange={(e) =>
                  setBusinessName(e.target.value)
                }
                placeholder="Business name"
                className="w-full h-14 rounded-2xl bg-slate-900 border border-white/10 px-4"
              />
              <input
                value={industry}
                onChange={(e) => setIndustry(e.target.value)}
                placeholder="Industry"
                className="w-full h-14 rounded-2xl bg-slate-900 border border-white/10 px-4"
              />
              <input
                value={audience}
                onChange={(e) => setAudience(e.target.value)}
                placeholder="Target audience"
                className="w-full h-14 rounded-2xl bg-slate-900 border border-white/10 px-4"
              />
              <textarea
                value={styleNotes}
                onChange={(e) =>
                  setStyleNotes(e.target.value)
                }
                placeholder="Describe the style, goals, and dream feel"
                className="w-full min-h-32 rounded-2xl bg-slate-900 border border-white/10 p-4"
              />
            </div>
          )}

          {step === 2 && (
            <div className="space-y-6">
              <div className="rounded-2xl border border-white/10 bg-slate-900 p-4 flex items-center justify-between">
                <span>Does this business sell products?</span>
                <button
                  onClick={() =>
                    setSellsProducts(!sellsProducts)
                  }
                  className="px-4 py-2 rounded-xl bg-white text-black"
                >
                  {sellsProducts ? "Yes" : "No"}
                </button>
              </div>

              {sellsProducts && (
                <>
                  <select
                    value={productCount}
                    onChange={(e) =>
                      updateProductCount(e.target.value)
                    }
                    className="w-full h-14 rounded-2xl bg-slate-900 border border-white/10 px-4"
                  >
                    {productOptions.map((option) => (
                      <option key={option}>{option}</option>
                    ))}
                  </select>

                  <div className="grid gap-4">
                    {Array.from({ length: count }).map(
                      (_, index) => (
                        <div
                          key={index}
                          className="rounded-3xl border border-white/10 bg-slate-900 p-5 grid gap-3"
                        >
                          <input
                            placeholder={`Product ${
                              index + 1
                            } name`}
                            value={products[index]?.name || ""}
                            onChange={(e) =>
                              updateProduct(
                                index,
                                "name",
                                e.target.value
                              )
                            }
                            className="w-full h-12 rounded-xl bg-slate-800 border border-white/10 px-4"
                          />

                          <input
                            placeholder="Price"
                            value={products[index]?.price || ""}
                            onChange={(e) =>
                              updateProduct(
                                index,
                                "price",
                                e.target.value
                              )
                            }
                            className="w-full h-12 rounded-xl bg-slate-800 border border-white/10 px-4"
                          />

                          <label className="border-2 border-dashed border-white/20 rounded-2xl p-6 text-center cursor-pointer hover:border-white/40 transition">
                            📁 Upload product image
                            <input
                              type="file"
                              className="hidden"
                            />
                          </label>
                        </div>
                      )
                    )}
                  </div>
                </>
              )}
            </div>
          )}

          {step === 3 && (
            <div className="space-y-4">
              <label className="border-2 border-dashed border-white/20 rounded-3xl p-8 text-center block cursor-pointer hover:border-white/40 transition">
                🖼️ Upload logo, hero, gallery, brand assets
                <input type="file" multiple className="hidden" />
              </label>

              <textarea
                placeholder="Brand colours, references, competitor websites"
                className="w-full min-h-32 rounded-2xl bg-slate-900 border border-white/10 p-4"
              />
            </div>
          )}

          {step === 4 && (
            <div className="grid sm:grid-cols-2 gap-4">
              {[
                "Bookings",
                "WooCommerce",
                "Quote Form",
                "Maps",
                "Reviews",
                "Live Chat",
              ].map((feature) => (
                <label
                  key={feature}
                  className="rounded-2xl border border-white/10 bg-slate-900 p-4 flex gap-3"
                >
                  <input type="checkbox" />
                  <span>{feature}</span>
                </label>
              ))}
            </div>
          )}

          <div className="flex justify-between mt-8 gap-4">
            <button
              disabled={step === 1}
              onClick={() =>
                setStep((s) => Math.max(1, s - 1))
              }
              className="flex-1 h-14 rounded-2xl border border-white/20"
            >
              Back
            </button>

            <button
              onClick={handleNext}
              className="flex-1 h-14 rounded-2xl bg-white text-black font-semibold"
            >
              {loading
                ? "Generating..."
                : step === 4
                ? "Generate Website"
                : "Next"}
            </button>
          </div>

          {message && (
            <div className="mt-6 rounded-2xl bg-emerald-500/20 text-emerald-300 p-4">
              {message}
            </div>
          )}
        </div>

        <div className="hidden lg:block rounded-[2rem] bg-black border border-white/10 p-6 h-fit sticky top-8">
          <h2 className="text-2xl font-semibold">
            Live summary
          </h2>

          <ul className="mt-6 space-y-3 text-sm text-slate-400">
            <li>Step {step} of 4</li>
            <li>
              Products: {sellsProducts ? `${count}` : "None"}
            </li>
            <li>Mobile friendly</li>
            <li>WordPress ready</li>
          </ul>
        </div>
      </div>
    </main>
  );
}