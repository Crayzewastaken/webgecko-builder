import { stitch } from "@google/stitch-sdk";

// SDK singleton — handles OAuth automatically via STITCH_API_KEY env var
export const stitchSdk = stitch;
