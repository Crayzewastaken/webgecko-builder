// app/api/inngest/route.ts
import { serve } from "inngest/next";
import { inngest } from "@/lib/inngest";
import { runPipeline } from "@/app/api/pipeline/run/route";

const buildWebsite = inngest.createFunction(
  {
    id: "build-website",
    name: "Build Website",
    retries: 1,
    triggers: [{ event: "build/website" }],
  },
  async ({ event, step }: { event: { data: { jobId: string } }; step: any }) => {
    const { jobId } = event.data;
    console.log(`[Inngest] Starting build for jobId=${jobId}`);
    const result = await step.run("run-pipeline", async () => {
      return await runPipeline(jobId);
    });
    console.log(`[Inngest] Build finished for jobId=${jobId}:`, result);
    return result;
  }
);

export const { GET, POST, PUT } = serve({
  client: inngest,
  functions: [buildWebsite],
});
