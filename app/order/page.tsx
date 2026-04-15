"use client";

import { useState } from "react";

export default function OrderPage() {
  const [businessName, setBusinessName] = useState("");
  const [industry, setIndustry] = useState("");
  const [style, setStyle] = useState("");

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    const res = await fetch("/api/secure-submit", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        businessName,
        industry,
        style,
      }),
    });

    let data;

    try {
      data = await res.json();
    } catch {
      alert("Server returned invalid response");
      return;
    }

    alert(data.message);
  };

  return (
    <main className="min-h-screen p-10">
      <h1 className="text-4xl font-bold">WebGecko Website Order</h1>
      <p className="mt-4 text-lg">
        Tell us what website you need and we’ll build it automatically.
      </p>

      <form
        onSubmit={handleSubmit}
        className="mt-8 flex flex-col gap-4 max-w-xl"
      >
        <input
          type="text"
          placeholder="Business Name"
          value={businessName}
          onChange={(e) => setBusinessName(e.target.value)}
          className="rounded border p-3 text-black"
        />

        <input
          type="text"
          placeholder="Industry"
          value={industry}
          onChange={(e) => setIndustry(e.target.value)}
          className="rounded border p-3 text-black"
        />

        <input
          type="text"
          placeholder="Style"
          value={style}
          onChange={(e) => setStyle(e.target.value)}
          className="rounded border p-3 text-black"
        />

        <button className="rounded bg-white text-black p-3 font-bold">
          Generate Website
        </button>
      </form>
    </main>
  );
}