import { randomBytes } from "node:crypto";

const count = clampNumber(process.argv[2], 5, 1, 200);
const plan = safeToken(process.argv[3] || "free");
const labelPrefix = safeToken(process.argv[4] || "beta").toUpperCase();
const codePrefix = safeToken(process.argv[5] || "pn");

const entries = Array.from({ length: count }, (_, index) => {
  const code = `${codePrefix}-${randomBytes(5).toString("hex")}`;
  const label = `${labelPrefix}-${String(index + 1).padStart(3, "0")}`;
  return `${code}|${label}|${plan}`;
});

console.log("");
console.log("PODNOTE_INVITE_CODES value:");
console.log(entries.join(","));
console.log("");
console.log("One invite per line:");
for (const entry of entries) console.log(entry);

function clampNumber(value, fallback, min, max) {
  const number = Number(value);
  if (!Number.isFinite(number)) return fallback;
  return Math.min(max, Math.max(min, Math.floor(number)));
}

function safeToken(value) {
  return String(value || "")
    .trim()
    .replace(/[^a-zA-Z0-9_-]+/g, "-")
    .replace(/^-+|-+$/g, "") || "invite";
}
