// app/api/inngest/route.ts
import { serve } from "inngest/next";
import { inngest } from "@/lib/inngest";
import { runPipeline } from "@/app/api/pipeline/run/route";
import { Redis } from "@upstash/redis";

const redis = new Redis({
  url: process.env.UPSTASH_REDIS_REST_URL!,
  token: process.env.UPSTASH_REDIS_REST_TOKEN!,
});

const buildWebsite = inngest.createFunction(
  {
    id: "build-website",
    name: "Build Website",
    retries: 1,
    triggers: [{ event: "build/website" }],
  },
  async ({ event, step }: { event: { data: { jobId: string } }; step: any }) => {
    const { jobId } = event.data;
    console.log("[Inngest] Starting build for jobId=" + jobId);
    const result = await step.run("run-pipeline", async () => {
      return await runPipeline(jobId);
    });
    console.log("[Inngest] Build finished for jobId=" + jobId);
    return result;
  }
);

const monthlyReports = inngest.createFunction(
  {
    id: "monthly-analytics-reports",
    name: "Send Monthly Analytics Reports",
    triggers: [{ cron: "0 22 28-31 * *" }],
  },
  async ({ step }: { step: any }) => {
    const now = new Date();
    const tomorrow = new Date(now);
    tomorrow.setUTCDate(now.getUTCDate() + 1);
    if (tomorrow.getUTCDate() !== 1) {
      return { skipped: true, reason: "Not the last day of the month" };
    }

    const clientKeys: string[] = await step.run("scan-clients", async () => {
      let cursor = 0;
      const keys: string[] = [];
      do {
        const [nextCursor, batch] = await redis.scan(cursor, { match: "client:*", count: 100 });
        cursor = Number(nextCursor);
        keys.push(...(batch as string[]));
      } while (cursor !== 0);
      return keys;
    });

    const base = process.env.NEXT_PUBLIC_BASE_URL || "https://webgecko-builder.vercel.app";
    const secret = process.env.PROCESS_SECRET || "";

    for (const key of clientKeys) {
      const slug = key.replace("client:", "");
      await step.run("send-report-" + slug, async () => {
        const clientData = await redis.get<any>(key);
        if (!clientData || !clientData.jobId) return { skipped: true };
        const url = base + "/api/analytics/monthly?jobId=" + clientData.jobId + "&secret=" + encodeURIComponent(secret) + "&send=true";
        const res = await fetch(url);
        const json = await res.json().catch(() => ({}));
        console.log("[MonthlyReport] " + slug + ":", json);
        return json;
      });
    }

    return { sent: clientKeys.length };
  }
);

export const { GET, POST, PUT } = serve({
  client: inngest,
  functions: [buildWebsite, monthlyReports],
});
