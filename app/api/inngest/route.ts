// app/api/inngest/route.ts
import { serve } from "inngest/next";
import { inngest } from "@/lib/inngest";

// Import your pipeline function
import { runPipeline } from "@/app/api/pipeline/run/route";

// Define the pipeline function as an Inngest function
export const buildWebsite = inngest.createFunction(
  { id: "build-website" },
  { event: "payment/deposit.completed" },
  async ({ event, step }) => {
    const { jobId } = event.data;

    console.log(`[Inngest] Starting pipeline for jobId=${jobId}`);

    try {
      const result = await step.run("run-pipeline", async () => {
        return await runPipeline(jobId);
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
