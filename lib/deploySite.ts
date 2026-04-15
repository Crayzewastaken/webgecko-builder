import fs from "fs";
import path from "path";

export function deployGeneratedSite(code: string) {
  const targetPath = path.join(
    process.cwd(),
    "app",
    "generated-site",
    "page.tsx"
  );

  fs.mkdirSync(path.dirname(targetPath), { recursive: true });
  fs.writeFileSync(targetPath, code);

  return "/generated-site";
}