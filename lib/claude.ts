import Anthropic from "@anthropic-ai/sdk";

const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY!,
});

export async function generateWebsiteBlueprint(prompt: string) {
  const response = await anthropic.messages.create({
    model: "claude-sonnet-4-5",
    max_tokens: 800,
    temperature: 0.2,
    messages: [
      {
        role: "user",
        content: `${prompt}

Return ONLY valid JSON in this format:
{
  "businessName": "",
  "heroTitle": "",
  "heroSubtitle": "",
  "services": ["", "", ""],
  "ctaText": ""
}

No markdown.
No backticks.
No explanations.
`,
      },
    ],
  });

  const firstBlock = response.content[0];

  if (firstBlock.type !== "text") {
    throw new Error("Claude returned non-text");
  }

  return JSON.parse(firstBlock.text);
}