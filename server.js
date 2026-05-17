import { createServer } from "node:http";
import { readFile, writeFile, mkdir } from "node:fs/promises";
import { extname, join, resolve } from "node:path";

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
    sendJson(response, 400, { error: "缺少 RSS 地址" });
    return;
  }

  let parsedUrl;
  try {
    parsedUrl = new URL(feedUrl);
  } catch {
    sendJson(response, 400, { error: "RSS 地址格式不正确" });
    return;
  }

  if (!["http:", "https:"].includes(parsedUrl.protocol)) {
    sendJson(response, 400, { error: "RSS 地址必须是 http 或 https" });
    return;
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 15000);

  try {
    const upstream = await fetch(parsedUrl.href, {
      headers: {
        Accept: "application/rss+xml, application/xml, text/xml, */*",
        "User-Agent": "PodNote/0.4.0"
      },
      signal: controller.signal
    });

    if (!upstream.ok) {
      sendJson(response, upstream.status, { error: `RSS 抓取失败：HTTP ${upstream.status}` });
      return;
    }

    const contentLength = Number(upstream.headers.get("content-length") || 0);
    if (contentLength > maxFeedBytes) {
      sendJson(response, 413, { error: "RSS 文件过大" });
      return;
    }

    const xml = await upstream.text();
    if (Buffer.byteLength(xml, "utf8") > maxFeedBytes) {
      sendJson(response, 413, { error: "RSS 文件过大" });
      return;
    }

    sendJson(response, 200, {
      ok: true,
      url: upstream.url,
      xml
    });
  } catch (error) {
    const message = error.name === "AbortError" ? "RSS 抓取超时" : "RSS 抓取失败";
    sendJson(response, 502, { error: message });
  } finally {
    clearTimeout(timeout);
  }
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
