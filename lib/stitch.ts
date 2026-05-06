import { stitch, StitchToolClient } from "@google/stitch-sdk";

// High-level SDK singleton — reads STITCH_API_KEY from env automatically
export const stitchSdk = stitch;

// Low-level tool client for any direct callTool() needs
export const stitchClient = new StitchToolClient({
  apiKey: process.env.STITCH_API_KEY!,
});
