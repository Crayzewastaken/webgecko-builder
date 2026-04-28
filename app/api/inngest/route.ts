// app/api/inngest/route.ts
import { serve } from "inngest/next";
import { inngest } from "@/lib/inngest";

export const buildWebsite = inngest.createFunction(
  { id: "build-website" },
  { event: "payment.deposit.completed" },
  async ({ event, step }) => {
    const { jobId } = event.data;

    console.log(`[Inngest] Starting build for ${jobId}`);

    return await step.run("execute-pipeline", async () => {
      const res = await fetch(
        `${process.env.NEXT_PUBLIC_BASE_URL}/api/pipeline/run`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            jobId,
            secret: process.env.PROCESS_SECRET,
          }),
        }
      );

      if (!res.ok) {
        throw new Error(`Pipeline failed: ${res.status}`);
      }

      return res.json();
    });
  }
);

export const { GET, POST, PUT } = serve({
  client: inngest,
  functions: [buildWebsite],
});
