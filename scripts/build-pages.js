import { cp, mkdir, rm } from "node:fs/promises";

const files = ["index.html", "app.js", "styles.css", "fixtures"];

await rm("dist", { recursive: true, force: true });
await mkdir("dist", { recursive: true });

for (const file of files) {
  await cp(file, `dist/${file}`, { recursive: true });
}

console.log("Cloudflare Pages build written to dist/");
