import { NextRequest, NextResponse } from "next/server";
import fs from "fs";
import path from "path";

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const doc = searchParams.get("doc"); // "terms" | "privacy" | "refunds"

  let filename = "";
  if (doc === "terms") filename = "terms-and-conditions.html";
  else if (doc === "privacy") filename = "privacy-policy.html";
  else if (doc === "refunds") filename = "returns-and-refunds.html";
  else return NextResponse.json({ error: "Invalid document type" }, { status: 400 });

  try {
    const filePath = path.join(process.cwd(), "legal", filename);
    if (!fs.existsSync(filePath)) {
      return NextResponse.json({ error: "Document not found" }, { status: 404 });
    }
    const htmlContent = fs.readFileSync(filePath, "utf-8");
    return new NextResponse(htmlContent, {
      headers: { "Content-Type": "text/html; charset=utf-8" },
    });
  } catch (err) {
    return NextResponse.json({ error: "Failed to read document" }, { status: 500 });
  }
}
