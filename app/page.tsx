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
        clone.push({ name: "", price: "", description: "" });
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
    <main className="min-h-screen bg-neutral-100 p-6 md:p-10">
      <div className="max-w-6xl mx-auto grid md:grid-cols-[1fr_320px] gap-6">
        <div className="rounded-[2rem] shadow-xl bg-white p-8 md:p-10">
          <div className="mb-8">
            <p className="text-sm uppercase tracking-[0.25em] text-neutral-500">
              AI Website Concierge
            </p>
            <h1 className="text-4xl md:text-5xl font-semibold mt-3">
              Build your premium website brief
            </h1>

            <div className="mt-6 h-2 bg-neutral-200 rounded-full overflow-hidden">
              <div
                className="h-full bg-black rounded-full transition-all"
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
                className="w-full h-14 rounded-2xl border px-4"
              />
              <input
                value={industry}
                onChange={(e) => setIndustry(e.target.value)}
                placeholder="Industry"
                className="w-full h-14 rounded-2xl border px-4"
              />
              <input
                value={audience}
                onChange={(e) => setAudience(e.target.value)}
                placeholder="Target audience"
                className="w-full h-14 rounded-2xl border px-4"
              />
              <textarea
                value={styleNotes}
                onChange={(e) =>
                  setStyleNotes(e.target.value)
                }
                placeholder="Describe the style, goals, and dream feel"
                className="w-full min-h-32 rounded-2xl border p-4"
              />
            </div>
          )}

          {step === 2 && (
            <div className="space-y-6">
              <div className="flex items-center justify-between rounded-2xl border p-4">
                <div>
                  <h3 className="font-medium">
                    Does this business sell products?
                  </h3>
                </div>

                <button
                  onClick={() =>
                    setSellsProducts(!sellsProducts)
                  }
                  className="px-4 py-2 rounded-xl border"
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
                    className="w-full h-14 rounded-2xl border px-4"
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
                          className="rounded-3xl border p-5 grid gap-3"
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
                            className="w-full h-12 rounded-xl border px-4"
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
                            className="w-full h-12 rounded-xl border px-4"
                          />
                        </div>
                      )
                    )}
                  </div>
                </>
              )}
            </div>
          )}

          <div className="flex justify-between mt-8">
            <button
              disabled={step === 1}
              onClick={() =>
                setStep((s) => Math.max(1, s - 1))
              }
              className="px-6 py-3 rounded-xl border"
            >
              Back
            </button>

            <button
              onClick={handleNext}
              className="px-6 py-3 rounded-xl bg-black text-white"
            >
              {loading
                ? "Generating..."
                : step === 4
                ? "Generate Website"
                : "Next"}
            </button>
          </div>

          {message && (
            <div className="mt-6 rounded-2xl bg-green-100 text-green-800 p-4">
              {message}
            </div>
          )}
        </div>

        <div className="rounded-[2rem] shadow-xl bg-black text-white h-fit sticky top-6 p-6">
          <h2 className="text-2xl font-semibold">
            Premium build data
          </h2>

          <ul className="mt-6 space-y-3 text-sm text-neutral-300">
            <li>Step {step} of 4 complete</li>
            <li>
              Products enabled: {sellsProducts ? "Yes" : "No"}
            </li>
            <li>
              Product slots: {sellsProducts ? count : 0}
            </li>
          </ul>
        </div>
      </div>
    </main>
  );
}