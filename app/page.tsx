"use client";

import { useState } from "react";

type FormData = {
  businessName: string;
  industry: string;
  pages: string;
  style: string;
  audience: string;
  cta: string;
  notes: string;
};

const API_URL =
  "https://webgecko-builder.vercel.app/api/worker";

export default function HomePage() {
  const [form, setForm] = useState<FormData>({
    businessName: "",
    industry: "",
    pages: "",
    style: "",
    audience: "",
    cta: "",
    notes: "",
  });

  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState("");
  const [error, setError] = useState("");

  function updateField(key: keyof FormData, value: string) {
    setForm((prev) => ({
      ...prev,
      [key]: value,
    }));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setResult("");
    setError("");

    try {
      const res = await fetch(API_URL, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(form),
      });

      const data = await res.json();

      if (!data.success) {
        setError(data.message || "Unknown backend error");
      } else {
        setResult(
          data.message ||
            "Website generated and emailed successfully"
        );
      }
    } catch (err: any) {
      setError(err.message || "Frontend request failed");
    }

    setLoading(false);
  }

  return (
    <main className="min-h-screen bg-[#f8f8f8] px-8 py-16">
      <div className="max-w-4xl mx-auto bg-white rounded-3xl shadow-xl p-10">
        <h1 className="text-4xl font-semibold mb-8">
          Premium AI Website Builder
        </h1>

        <form onSubmit={handleSubmit} className="space-y-5">
          <input
            className="w-full border p-4 rounded-xl"
            placeholder="Business Name"
            value={form.businessName}
            onChange={(e) =>
              updateField("businessName", e.target.value)
            }
          />

          <input
            className="w-full border p-4 rounded-xl"
            placeholder="Industry"
            value={form.industry}
            onChange={(e) =>
              updateField("industry", e.target.value)
            }
          />

          <input
            className="w-full border p-4 rounded-xl"
            placeholder="Pages Needed"
            value={form.pages}
            onChange={(e) =>
              updateField("pages", e.target.value)
            }
          />

          <input
            className="w-full border p-4 rounded-xl"
            placeholder="Style / Aesthetic"
            value={form.style}
            onChange={(e) =>
              updateField("style", e.target.value)
            }
          />

          <input
            className="w-full border p-4 rounded-xl"
            placeholder="Target Audience"
            value={form.audience}
            onChange={(e) =>
              updateField("audience", e.target.value)
            }
          />

          <input
            className="w-full border p-4 rounded-xl"
            placeholder="Primary CTA Goal"
            value={form.cta}
            onChange={(e) =>
              updateField("cta", e.target.value)
            }
          />

          <textarea
            className="w-full border p-4 rounded-xl h-40"
            placeholder="Extra notes..."
            value={form.notes}
            onChange={(e) =>
              updateField("notes", e.target.value)
            }
          />

          <button
            type="submit"
            className="px-6 py-4 rounded-xl bg-black text-white w-full"
          >
            {loading ? "Generating..." : "Generate Website"}
          </button>
        </form>

        {result && (
          <div className="mt-8 rounded-xl bg-green-100 text-green-800 p-5">
            {result}
          </div>
        )}

        {error && (
          <div className="mt-8 rounded-xl bg-red-100 text-red-800 p-5">
            {error}
          </div>
        )}
      </div>
    </main>
  );
}