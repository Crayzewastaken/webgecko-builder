// app/api/admin/woo-products/route.ts
// Fetches product list from WooCommerce REST API and returns it as JSON.

import { NextRequest } from "next/server";
import { isAdminAuthedLegacy } from "@/lib/admin-auth";

export async function GET(req: NextRequest) {
  if (!isAdminAuthedLegacy(req)) {
    return Response.json({ error: "Forbidden" }, { status: 403 });
  }

  const wooUrl = process.env.WOOCOMMERCE_URL;
  const wooKey = process.env.WOOCOMMERCE_KEY;
  const wooSecret = process.env.WOOCOMMERCE_SECRET;

  if (!wooUrl || !wooKey || !wooSecret) {
    return Response.json({ error: "WooCommerce env vars not configured" }, { status: 500 });
  }

  const credentials = Buffer.from(`${wooKey}:${wooSecret}`).toString("base64");

  try {
    const res = await fetch(
      `${wooUrl}/wp-json/wc/v3/products?per_page=50&status=publish`,
      {
        headers: {
          Authorization: `Basic ${credentials}`,
          "Content-Type": "application/json",
        },
        // Bypass any Next.js cache — always fetch fresh stock data
        cache: "no-store",
      }
    );

    if (!res.ok) {
      const text = await res.text();
      return Response.json(
        { error: `WooCommerce API error ${res.status}`, detail: text },
        { status: 502 }
      );
    }

    const raw: any[] = await res.json();

    const products = raw.map(p => ({
      id: p.id,
      name: p.name,
      sku: p.sku || "",
      stock_quantity: p.stock_quantity ?? null,
      price: p.price || "0",
    }));

    return Response.json({ products });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Unknown error";
    return Response.json({ error: msg }, { status: 500 });
  }
}
