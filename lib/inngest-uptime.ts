// lib/inngest-uptime.ts
// Inngest scheduled function — runs every 30 minutes to check all live client sites.
// Imported and served by app/api/inngest/route.ts.

import { inngest } from "./inngest";
import { checkAllSites, saveUptimeResults, alertOnDownSites } from "./uptime-monitor";

export const uptimeMonitor = inngest.createFunction(
  {
    id: "uptime-monitor",
    name: "Uptime Monitor — check all live sites",
    // Concurrency: only one check run at a time to avoid spamming Vercel
    concurrency: { limit: 1 },
    triggers: [{ cron: "*/30 * * * *" }],
  },
  async ({ step }: { step: any }) => {
    const results = await step.run("check-all-sites", async () => {
      console.log("[UptimeMonitor] Starting site health checks...");
      const r = await checkAllSites();
      console.log(`[UptimeMonitor] Checked ${r.length} sites`);
      return r;
    });

    await step.run("save-results", async () => {
      await saveUptimeResults(results);
    });

    const downSites = (results as { status: string }[]).filter(r => r.status === "down");
    const slowSites = (results as { status: string }[]).filter(r => r.status === "slow");

    console.log(
      `[UptimeMonitor] Summary: ${results.length} sites — ` +
      `${results.length - downSites.length - slowSites.length} up, ` +
      `${slowSites.length} slow, ${downSites.length} down`
    );

    if (downSites.length > 0) {
      await step.run("alert-admin", async () => {
        await alertOnDownSites(downSites as any);
      });
    }

    return {
      total: results.length,
      up:    (results as { status: string }[]).filter(r => r.status === "up").length,
      slow:  slowSites.length,
      down:  downSites.length,
    };
  }
);
