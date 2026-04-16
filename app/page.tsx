"use client";

import { useMemo, useState } from "react";

const API_URL = "/api/worker";

const productOptions = ["1", "2", "3", "4", "5", "6+"];
const pageOptions = ["1", "2", "3", "4", "5", "6+"];

export default function HomePage() {
  const [step, setStep] = useState(1);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");

  const [businessName, setBusinessName] = useState("");
  const [industry, setIndustry] = useState("");
  const [audience, setAudience] = useState("");
  const [styleNotes, setStyleNotes] = useState("");

  const [pageCount, setPageCount] = useState("1");
  const [pageNames, setPageNames] = useState(["Home"]);

  const [sellsProducts, setSellsProducts] = useState(false);
  const [productCount, setProductCount] = useState("1");
  const [products, setProducts] = useState([
    { name: "", price: "", description: "" },
  ]);

  const count = useMemo(
    () => (productCount === "6+" ? 6 : Number(productCount)),
    [productCount]
  );

  const totalPages = useMemo(
    () => (pageCount === "6+" ? 6 : Number(pageCount)),
    [pageCount]
  );

  function updatePageCount(value: string) {
    setPageCount(value);
    const nextCount = value === "6+" ? 6 : Number(value);

    setPageNames((prev) => {
      const clone = [...prev];
      while (clone.length < nextCount) {
        clone.push(`Page ${clone.length + 1}`);
      }
      return clone.slice(0, nextCount);
    });
  }

  function updatePageName(index: number, value: string) {
    setPageNames((prev) =>
      prev.map((p, i) => (i === index ? value : p))
    );
  }

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

  async function generateWebsite() {
    setLoading(true);
    setMessage("");

    const payload = {
      businessName,
      industry,
      audience,
      styleNotes,
      pageCount: totalPages,
      pageNames,
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

      const data = await res.json();
      setMessage(data.message);
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
      <div className="max-w-6xl mx-auto rounded-[2rem] bg-[#111827] border border-white/10 p-6 md:p-10">
        <h1 className="text-4xl font-bold">WebGecko AI Builder</h1>

        {step === 1 && (
          <div className="space-y-4 mt-8">
            <input
              value={businessName}
              onChange={(e) => setBusinessName(e.target.value)}
              placeholder="Business name"
              className="w-full h-14 rounded-2xl bg-slate-900 px-4"
            />
            <input
              value={industry}
              onChange={(e) => setIndustry(e.target.value)}
              placeholder="Industry"
              className="w-full h-14 rounded-2xl bg-slate-900 px-4"
            />
            <input
              value={audience}
              onChange={(e) => setAudience(e.target.value)}
              placeholder="Target audience"
              className="w-full h-14 rounded-2xl bg-slate-900 px-4"
            />
            <textarea
              value={styleNotes}
              onChange={(e) => setStyleNotes(e.target.value)}
              placeholder="Describe style and goals"
              className="w-full min-h-32 rounded-2xl bg-slate-900 p-4"
            />
          </div>
        )}

        {step === 2 && (
          <div className="space-y-4 mt-8">
            <select
              value={pageCount}
              onChange={(e) => updatePageCount(e.target.value)}
              className="w-full h-14 rounded-2xl bg-slate-900 px-4"
            >
              {pageOptions.map((option) => (
                <option key={option}>{option}</option>
              ))}
            </select>

            {Array.from({ length: totalPages }).map((_, index) => (
              <input
                key={index}
                value={pageNames[index] || ""}
                onChange={(e) =>
                  updatePageName(index, e.target.value)
                }
                placeholder={`Page ${index + 1} name`}
                className="w-full h-14 rounded-2xl bg-slate-900 px-4"
              />
            ))}
          </div>
        )}

        {step === 3 && (
          <div className="space-y-6 mt-8">
            <button
              onClick={() => setSellsProducts(!sellsProducts)}
              className="px-4 py-2 rounded-xl bg-white text-black"
            >
              Sells products: {sellsProducts ? "Yes" : "No"}
            </button>

            {sellsProducts && (
              <select
                value={productCount}
                onChange={(e) =>
                  updateProductCount(e.target.value)
                }
                className="w-full h-14 rounded-2xl bg-slate-900 px-4"
              >
                {productOptions.map((option) => (
                  <option key={option}>{option}</option>
                ))}
              </select>
            )}
          </div>
        )}

        {step === 4 && (
          <div className="mt-8 text-slate-300">
            Review your request and generate.
          </div>
        )}

        <div className="flex gap-4 mt-8">
          <button
            disabled={step === 1}
            onClick={() => setStep((s) => Math.max(1, s - 1))}
            className="flex-1 h-14 rounded-2xl border"
          >
            Back
          </button>

          <button
            onClick={handleNext}
            className="flex-1 h-14 rounded-2xl bg-white text-black"
          >
            {loading
              ? "Generating..."
              : step === 4
              ? "Generate Website"
              : "Next"}
          </button>
        </div>

        {message && (
          <div className="mt-6 rounded-2xl bg-emerald-500/20 p-4">
            {message}
          </div>
        )}
      </div>
    </main>
  );
}