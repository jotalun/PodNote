import { createServer } from "node:http";
import { readFile, writeFile, mkdir } from "node:fs/promises";
import { extname, join, resolve } from "node:path";
import { findTranscript } from "./lib/transcript.js";

const root = resolve(".");
const port = Number(process.env.PORT || 4174);
const host = process.env.HOST || "127.0.0.1";
const deepSeekEndpoint = "https://api.deepseek.com/chat/completions";
const maxFeedBytes = 5 * 1024 * 1024;

const mimeTypes = {
  ".html": "text/html; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".md": "text/markdown; charset=utf-8"
};

createServer(async (request, response) => {
  try {
    const url = new URL(request.url || "/", `http://${request.headers.host}`);

    if (request.method === "POST" && url.pathname === "/api/analyze") {
      await handleAnalyze(request, response);
      return;
    }

    if (request.method === "POST" && url.pathname === "/api/export") {
      await handleExport(request, response);
      return;
    }

    if (request.method === "GET" && url.pathname === "/api/rss") {
      await handleRss(url, response);
      return;
    }

    if (request.method === "GET" && url.pathname === "/api/transcript") {
      await handleTranscript(url, response);
      return;
    }

    if (request.method === "GET" && url.pathname === "/api/health") {
      sendJson(response, 200, { ok: true });
      return;
    }

    await serveStatic(url.pathname, response);
  } catch (error) {
    console.error(error);
    sendJson(response, 500, { error: "服务器处理失败" });
  }
}).listen(port, host, () => {
  console.log(`PodNote running at http://${host}:${port}`);
});

async function handleAnalyze(request, response) {
  const body = await readJson(request);
  const apiKey = body.apiKey || process.env.DEEPSEEK_API_KEY;

  if (!apiKey) {
    sendJson(response, 400, { error: "缺少 DeepSeek API Key" });
    return;
  }

  const upstream = await fetch(deepSeekEndpoint, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`
    },
    body: JSON.stringify({
      model: body.model || "deepseek-v4-flash",
      messages: body.messages,
      thinking: { type: "disabled" },
      stream: false
    })
  });

  const text = await upstream.text();
  response.writeHead(upstream.status, {
    "Content-Type": upstream.headers.get("content-type") || "application/json; charset=utf-8"
  });
  response.end(text);
}

async function handleRss(url, response) {
  const feedUrl = String(url.searchParams.get("url") || "").trim();

  if (!feedUrl) {
    sendJson(response, 400, { error: "缺少播客链接" });
    return;
  }

  let parsedUrl;
  try {
    parsedUrl = new URL(feedUrl);
  } catch {
    sendJson(response, 400, { error: "播客链接格式不正确" });
    return;
  }

  if (!["http:", "https:"].includes(parsedUrl.protocol)) {
    sendJson(response, 400, { error: "播客链接必须是 http 或 https" });
    return;
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 15000);

  try {
    const feed = await fetchFeedOrDiscover(parsedUrl.href, controller.signal);
    sendJson(response, 200, feed);
  } catch (error) {
    const message = error.name === "AbortError" ? "链接解析超时" : error.message || "链接解析失败";
    sendJson(response, 502, { error: message });
  } finally {
    clearTimeout(timeout);
  }
}

async function handleTranscript(url, response) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 20000);

  try {
    const result = await findTranscript(
      {
        feedUrl: url.searchParams.get("feedUrl"),
        episodeUrl: url.searchParams.get("episodeUrl"),
        audioUrl: url.searchParams.get("audioUrl"),
        transcriptUrl: url.searchParams.get("transcriptUrl"),
        title: url.searchParams.get("title")
      },
      { signal: controller.signal }
    );
    sendJson(response, result.ok ? 200 : 404, result);
  } catch (error) {
    const message = error.name === "AbortError" ? "transcript 查找超时" : error.message || "transcript 查找失败";
    sendJson(response, 502, { ok: false, error: message });
  } finally {
    clearTimeout(timeout);
  }
}

async function fetchFeedOrDiscover(inputUrl, signal) {
  const first = await fetchText(inputUrl, signal);
  if (looksLikeFeed(first.text)) {
    return { ok: true, url: first.url, xml: first.text };
  }

  const discoveredUrl = discoverFeedUrl(first.text, first.url);
  if (!discoveredUrl) {
    throw new Error("没有在这个页面找到 RSS。请打开播客的订阅页，复制 RSS 链接。");
  }

  const second = await fetchText(discoveredUrl, signal);
  if (!looksLikeFeed(second.text)) {
    throw new Error("找到了候选 RSS，但内容不是有效 RSS。");
  }

  return {
    ok: true,
    url: second.url,
    sourceUrl: first.url,
    discovered: true,
    xml: second.text
  };
}

async function fetchText(url, signal) {
  const upstream = await fetch(url, {
    headers: {
      Accept: "application/rss+xml, application/atom+xml, application/xml, text/xml, text/html, */*",
      "User-Agent": "PodNote/0.7.0"
    },
    signal
  });

  if (!upstream.ok) {
    throw new Error(`链接抓取失败：HTTP ${upstream.status}`);
  }

  const contentLength = Number(upstream.headers.get("content-length") || 0);
  if (contentLength > maxFeedBytes) {
    throw new Error("文件过大");
  }

  const text = await upstream.text();
  if (Buffer.byteLength(text, "utf8") > maxFeedBytes) {
    throw new Error("文件过大");
  }

  return { text, url: upstream.url };
}

function looksLikeFeed(text) {
  const head = text.slice(0, 600).toLowerCase();
  return head.includes("<rss") || head.includes("<feed") || head.includes("<rdf:rdf");
}

function discoverFeedUrl(html, baseUrl) {
  const candidates = [];
  const linkPattern = /<link\b[^>]*>/gi;
  for (const [tag] of html.matchAll(linkPattern)) {
    const rel = readHtmlAttr(tag, "rel");
    const type = readHtmlAttr(tag, "type");
    const href = readHtmlAttr(tag, "href");
    if (!href) continue;
    const scoreText = `${rel} ${type} ${href}`.toLowerCase();
    if (scoreText.includes("alternate") && /rss|atom|xml|feed/.test(scoreText)) {
      candidates.push(href);
    }
  }

  const anchorPattern = /<a\b[^>]*href=["']([^"']+)["'][^>]*>([\s\S]*?)<\/a>/gi;
  for (const [, href, label] of html.matchAll(anchorPattern)) {
    const scoreText = `${href} ${label.replace(/<[^>]*>/g, " ")}`.toLowerCase();
    if (/\brss\b|feed|订阅/.test(scoreText)) {
      candidates.push(href);
    }
  }

  for (const candidate of candidates) {
    try {
      return new URL(candidate, baseUrl).href;
    } catch {
      // Try the next candidate.
    }
  }

  return "";
}

function readHtmlAttr(tag, attr) {
  const match = tag.match(new RegExp(`${attr}=["']([^"']+)["']`, "i"));
  return match?.[1] || "";
}

async function handleExport(request, response) {
  const body = await readJson(request);
  const markdown = String(body.markdown || "");
  const vaultPath = String(body.vaultPath || "").trim();
  const fileName = sanitizeFileName(String(body.fileName || "podcast-note.md"));

  if (!markdown.trim()) {
    sendJson(response, 400, { error: "Markdown 内容为空" });
    return;
  }

  if (!vaultPath) {
    sendJson(response, 400, { error: "缺少 Obsidian Vault 路径" });
    return;
  }

  const notesDir = resolve(vaultPath, "PodNote");
  await mkdir(notesDir, { recursive: true });
  const outputPath = join(notesDir, fileName.endsWith(".md") ? fileName : `${fileName}.md`);
  await writeFile(outputPath, markdown, "utf8");
  sendJson(response, 200, { ok: true, path: outputPath });
}

async function serveStatic(pathname, response) {
  const cleanPath = pathname === "/" ? "/index.html" : pathname;
  const filePath = resolve(root, `.${decodeURIComponent(cleanPath)}`);

  if (!filePath.startsWith(root)) {
    sendJson(response, 403, { error: "路径不可访问" });
    return;
  }

  try {
    const file = await readFile(filePath);
    response.writeHead(200, { "Content-Type": mimeTypes[extname(filePath)] || "application/octet-stream" });
    response.end(file);
  } catch {
    sendJson(response, 404, { error: "文件不存在" });
  }
}

async function readJson(request) {
  let raw = "";
  for await (const chunk of request) {
    raw += chunk;
  }
  return raw ? JSON.parse(raw) : {};
}

function sendJson(response, status, payload) {
  response.writeHead(status, { "Content-Type": "application/json; charset=utf-8" });
  response.end(JSON.stringify(payload));
}

function sanitizeFileName(value) {
  return value.replace(/[\\/:*?"<>|]/g, "-").replace(/\s+/g, " ").trim() || "podcast-note.md";
}
