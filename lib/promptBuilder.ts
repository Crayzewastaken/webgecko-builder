export function buildClaudePrompt(data: any) {
  return `
Create a premium modern business website.

Business Name: ${data.businessName}
Industry: ${data.industry}
Style: ${data.style}

Requirements:
- premium homepage
- hero section
- services section
- about section
- testimonials
- contact CTA
- mobile responsive
- modern UI
- clean animations
- SEO-ready structure
- professional copywriting
- high conversion design

Return production-ready Next.js + Tailwind code.
`;
}