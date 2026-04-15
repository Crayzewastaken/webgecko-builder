import { StitchToolClient } from "@google/stitch-sdk";

export const stitchClient = new StitchToolClient({
  apiKey: process.env.STITCH_API_KEY!,
});