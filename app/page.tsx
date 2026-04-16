"use client";

import { useMemo, useState } from "react";

const productOptions = ["1", "2", "3", "4", "5", "6+"];

export default function HomePage() {
  const [step, setStep] = useState(1);
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
                placeholder="Business name"
                className="w-full h-14 rounded-2xl border px-4"
              />
              <input
                placeholder="Industry"
                className="w-full h-14 rounded-2xl border px-4"
              />
              <input
                placeholder="Target audience"
                className="w-full h-14 rounded-2xl border px-4"
              />
              <textarea
                placeholder="Describe the style, goals, and dream feel of the website"
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
                  <p className="text-sm text-neutral-500">
                    Enable dynamic catalog collection
                  </p>
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
                          className="rounded-3xl border border-neutral-200 shadow-sm p-5 grid gap-3"
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
                          <textarea
                            placeholder="Description"
                            value={
                              products[index]?.description || ""
                            }
                            onChange={(e) =>
                              updateProduct(
                                index,
                                "description",
                                e.target.value
                              )
                            }
                            className="w-full min-h-24 rounded-xl border p-4"
                          />
                          <input type="file" />
                        </div>
                      )
                    )}
                  </div>
                </>
              )}
            </div>
          )}

          {step === 3 && (
            <div className="grid gap-4">
              <input type="file" className="w-full" />
              <input type="file" className="w-full" />
              <textarea
                placeholder="Brand colours, references, competitor websites"
                className="w-full min-h-32 rounded-2xl border p-4"
              />
            </div>
          )}

          {step === 4 && (
            <div className="grid md:grid-cols-2 gap-4">
              {[
                "Bookings",
                "WooCommerce",
                "Quote Form",
                "Maps",
                "Reviews",
                "Newsletter",
                "Live Chat",
                "Memberships",
              ].map((feature) => (
                <label
                  key={feature}
                  className="rounded-2xl border p-4 flex items-center gap-3"
                >
                  <input type="checkbox" />
                  <span>{feature}</span>
                </label>
              ))}
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
              onClick={() =>
                setStep((s) => Math.min(4, s + 1))
              }
              className="px-6 py-3 rounded-xl bg-black text-white"
            >
              {step === 4 ? "Generate Website" : "Next"}
            </button>
          </div>
        </div>

        <div className="rounded-[2rem] shadow-xl bg-black text-white h-fit sticky top-6 p-6">
          <p className="text-sm uppercase tracking-[0.25em] text-neutral-400">
            Live summary
          </p>

          <h2 className="text-2xl font-semibold mt-3">
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
            <li>Ready for WordPress plugin fusion</li>
          </ul>
        </div>
      </div>
    </main>
  );
}