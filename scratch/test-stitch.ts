import { stitchCreateProject, stitchGenerateScreen, stitchGetScreen, stitchListLatestScreen } from "../lib/stitch";
import fs from "fs";
import path from "path";

const envStr = fs.readFileSync(path.join(process.cwd(), ".env.local"), "utf-8");
for (const line of envStr.split("\n")) {
  if (line.includes("=")) {
    const [k, ...v] = line.split("=");
    process.env[k.trim()] = v.join("=").trim().replace(/^"|"$/g, "");
  }
}
async function callMcp(method: string, params: Record<string, unknown>, timeoutMs = 240000): Promise<unknown> {
  const id = 1;
  const res = await fetch("https://stitch.googleapis.com/mcp", {
    method: "POST",
    headers: {
      "X-Goog-Api-Key": process.env.STITCH_API_KEY!,
      "Content-Type": "application/json",
      "Accept": "application/json, text/event-stream",
    },
    body: JSON.stringify({ jsonrpc: "2.0", id, method, params }),
  });
  if (!res.ok) throw new Error("HTTP " + res.status);
  return res.json();
}

async function main() {
  const result = await callMcp("tools/list", {});
  console.log(JSON.stringify(result, null, 2));
}

main().catch(console.error);
