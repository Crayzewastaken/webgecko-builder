// lib/inngest.ts
import { Inngest } from "inngest";

export const inngest = new Inngest({
  id: "webgecko",
  name: "WebGecko",
  retryConfig: {
    initialDelayMs: 500,
    maxAttempts: 3,
  },
});
