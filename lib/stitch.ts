/**
 * Stitch MCP client — calls stitch.googleapis.com/mcp directly via HTTP.
 * No SDK dependency. Works fully serverless (Vercel/Inngest), PC never needed.
 *
 * API key is stored in env var STITCH_API_KEY.
 * MCP protocol: JSON-RPC 2.0 over HTTP POST.
 */

const STITCH_MCP_URL = "https://stitch.googleapis.com/mcp";

function getApiKey(): string {
  const key = process.env.STITCH_API_KEY;
  if (!key) throw new Error("STITCH_API_KEY env var is not set");
  return key;
}

let _reqId = 1;

async function callMcp(method: string, params: Record<string, unknown>, timeoutMs = 240000): Promise<unknown> {
  const id = _reqId++;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  let res: Response;
  try {
    res = await fetch(STITCH_MCP_URL, {
      method: "POST",
      headers: {
        "X-Goog-Api-Key": getApiKey(),
        "Content-Type": "application/json",
        "Accept": "application/json, text/event-stream",
      },
      body: JSON.stringify({ jsonrpc: "2.0", id, method, params }),
      signal: controller.signal,
    });
  } finally {
    clearTimeout(timer);
  }

  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`Stitch MCP HTTP ${res.status}: ${text.slice(0, 300)}`);
  }

  const contentType = res.headers.get("content-type") || "";

  // Some MCP servers respond with SSE (text/event-stream) — parse the last data: line
  if (contentType.includes("text/event-stream")) {
    const text = await res.text();
    const lines = text.split("\n").filter(l => l.startsWith("data:"));
    if (!lines.length) throw new Error("Stitch MCP: empty SSE response");
    const lastLine = lines[lines.length - 1].replace(/^data:\s*/, "");
    const parsed = JSON.parse(lastLine);
    if (parsed.error) throw new Error(`Stitch MCP error: ${JSON.stringify(parsed.error)}`);
    const toolResult = parsed.result;
    if (toolResult?.isError) {
      const msg = toolResult?.content?.[0]?.text || "unknown tool error";
      throw new Error(`Stitch MCP tool error: ${msg}`);
    }
    return toolResult;
  }

  // Standard JSON response
  const json = await res.json();
  if (json.error) throw new Error(`Stitch MCP error: ${JSON.stringify(json.error)}`);
  const toolResult = json.result;
  // MCP tool errors come back as { isError: true, content: [{ text: "..." }] }
  if (toolResult?.isError) {
    const msg = toolResult?.content?.[0]?.text || "unknown tool error";
    throw new Error(`Stitch MCP tool error: ${msg}`);
  }
  return toolResult;
}

// ── Tool helpers ────────────────────────────────────────────────────────────

export interface StitchProject {
  name: string;        // "projects/{id}"
  projectId: string;   // just the numeric id
  title?: string;
}

export interface StitchScreen {
  name: string;        // "projects/{projectId}/screens/{screenId}"
  projectId: string;
  screenId: string;
  state?: string;
  outputComponents?: string;
  htmlUri?: string;    // signed URL to the rendered HTML
}

/**
 * Creates a new Stitch project and returns its projectId.
 */
export async function stitchCreateProject(title: string): Promise<StitchProject> {
  const result = await callMcp("tools/call", {
    name: "create_project",
    arguments: { title },
  }) as any;
  // result.content is an array of content blocks; find the JSON one
  const content = extractJson(result);
  return {
    name: content.name,
    projectId: content.name?.split("/").pop() || content.projectId,
    title: content.title,
  };
}

/**
 * Generates a screen from a text prompt and returns the screenId.
 * NOTE: Generation takes 1–3 minutes. Call stitchGetScreen() afterwards.
 */
export async function stitchGenerateScreen(
  projectId: string,
  prompt: string,
  deviceType: "DESKTOP" | "MOBILE" = "DESKTOP",
  modelId: "GEMINI_3_1_PRO" | "GEMINI_3_FLASH" = "GEMINI_3_1_PRO"
): Promise<StitchScreen> {
  const result = await callMcp("tools/call", {
    name: "generate_screen_from_text",
    arguments: { projectId, prompt, deviceType, modelId },
  }) as any;

  console.log("[Stitch MCP] generate raw result keys:", JSON.stringify(Object.keys(result || {})));
  const content = extractJson(result);
  console.log("[Stitch MCP] generate content keys:", JSON.stringify(Object.keys(content || {})));
  console.log("[Stitch MCP] generate projectId:", content?.projectId, "sessionId:", content?.sessionId, "screenId:", content?.screenId);
  if (Array.isArray(content?.outputComponents)) {
    console.log("[Stitch MCP] outputComponents count:", content.outputComponents.length);
    console.log("[Stitch MCP] outputComponents[0] keys:", JSON.stringify(Object.keys(content.outputComponents[0] || {})));
  }

  const screen = normaliseScreen(content);
  console.log("[Stitch MCP] normalised screen:", JSON.stringify({ projectId: screen.projectId, screenId: screen.screenId, htmlUri: !!screen.htmlUri }));
  return screen;
}

/**
 * Fetches a screen by projectId + screenId.
 * Returns the screen including htmlUri when ready.
 */
export async function stitchGetScreen(
  projectId: string,
  screenId: string
): Promise<StitchScreen> {
  const name = `projects/${projectId}/screens/${screenId}`;
  const result = await callMcp("tools/call", {
    name: "get_screen",
    arguments: { name, projectId, screenId },
  }) as any;

  // Log full raw result so we can see the real shape
  console.log("[Stitch MCP] get_screen raw result:", JSON.stringify(result).slice(0, 2000));
  const content = extractJson(result);
  console.log("[Stitch MCP] get_screen parsed content keys:", JSON.stringify(Object.keys(content || {})));
  console.log("[Stitch MCP] get_screen content:", JSON.stringify(content).slice(0, 2000));

  return normaliseScreen(content);
}

/**
 * Lists all screens for a project and returns the most recently created one.
 * Used as fallback when generate_screen_from_text doesn't return a screenId.
 */
export async function stitchListLatestScreen(projectId: string): Promise<StitchScreen | null> {
  const result = await callMcp("tools/call", {
    name: "list_screens",
    arguments: { projectId },
  }) as any;
  console.log("[Stitch MCP] list_screens raw:", JSON.stringify(result).slice(0, 1000));
  const content = extractJson(result);
  // content may be { screens: [...] } or an array directly
  const screens: any[] = Array.isArray(content) ? content : (content?.screens || []);
  if (!screens.length) return null;
  console.log("[Stitch MCP] list_screens[last] keys:", JSON.stringify(Object.keys(screens[screens.length - 1] || {})));
  // Take the last one (most recently created)
  return normaliseScreen(screens[screens.length - 1]);
}

/**
 * Fetches the HTML content from a screen's htmlUri.
 */
export async function stitchFetchHtml(screen: StitchScreen): Promise<string> {
  if (!screen.htmlUri) throw new Error("Screen has no htmlUri — may still be generating");
  const res = await fetch(screen.htmlUri);
  if (!res.ok) throw new Error(`Failed to fetch Stitch HTML: HTTP ${res.status}`);
  const html = await res.text();
  if (!html || html.length < 1000) throw new Error(`Stitch HTML too short (${html.length} chars)`);
  return html;
}

// ── Internal helpers ────────────────────────────────────────────────────────

function extractJson(result: any): any {
  // MCP tool results are wrapped: { content: [{ type: "text", text: "..." }] }
  if (result?.content && Array.isArray(result.content)) {
    for (const block of result.content) {
      if (block.type === "text" && block.text) {
        try { return JSON.parse(block.text); } catch { return block.text; }
      }
    }
  }
  // Sometimes the result is the object directly
  return result;
}

function normaliseScreen(raw: any): StitchScreen {
  const name: string = raw.name || "";
  const parts = name.split("/");

  // Stitch MCP returns projectId + sessionId at the top level (not screenId)
  // The sessionId IS the screenId for subsequent get_screen calls
  const projectId = raw.projectId || parts[1] || "";
  const screenId = raw.screenId || raw.sessionId || parts[3] || "";

  // htmlUri may be inside outputComponents entries
  let htmlUri = raw.htmlUri || raw.signedUri || raw.uri || "";
  if (!htmlUri && Array.isArray(raw.outputComponents)) {
    for (const comp of raw.outputComponents) {
      const uri = comp?.htmlUri || comp?.signedUri || comp?.uri
        || comp?.screen?.htmlUri || comp?.screen?.signedUri;
      if (uri) { htmlUri = uri; break; }
    }
  }

  return {
    name: name || (projectId && screenId ? `projects/${projectId}/screens/${screenId}` : ""),
    projectId,
    screenId,
    state: raw.state,
    outputComponents: raw.outputComponents,
    htmlUri,
  };
}
