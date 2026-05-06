import { Stitch, StitchToolClient } from "@google/stitch-sdk";

// High-level SDK client — use this for project.generate() / screen.getHtml()
export const stitchSdk = new Stitch(
  new StitchToolClient({ apiKey: process.env.STITCH_API_KEY! })
);

// Low-level tool client kept for any direct callTool() needs
export const stitchClient = new StitchToolClient({
  apiKey: process.env.STITCH_API_KEY!,
});