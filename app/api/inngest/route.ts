// app/api/inngest/route.ts
import { serve } from "inngest/next";
import { inngest } from "@/lib/inngest";

// Define the pipeline function as an Inngest function
export const buildWebsite = inngest.createFunction(
  { id: "build-website" },
  { event: "payment/deposit.completed" },
  async ({ event, step }) => {
    const { jobId } = event.data;

    console.log(`[Inngest] Starting pipeline for jobId=${jobId}`);

    try {
      const result = await step.run("run-pipeline", async () => {
        // Call the pipeline endpoint (internal call, no time limit in Inngest)
        const response = await fetch(
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

        if (!response.ok) {
          throw new Error(`Pipeline failed: ${response.status} ${await response.text()}`);
        }

        return await response.json();
      });

      console.log(`[Inngest] Pipeline completed for jobId=${jobId}:`, result);
      return result;
    } catch (error) {
      console.error(`[Inngest] Pipeline failed for jobId=${jobId}:`, error);
      throw error;
    }
  }
);

// Serve the Inngest functions
export const { GET, POST, PUT } = serve({
  client: inngest,
  functions: [buildWebsite],
});
