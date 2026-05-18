import { createServer } from "node:http";
import { readFile, writeFile, mkdir } from "node:fs/promises";
import { extname, join, resolve } from "node:path";
import {
  clearAuthCookie,
  createAuthCookie,
  getAuthorizedSession,
  getSessionSecret,
  renderLoginPage,
  shouldReturnJson,
  unauthorizedJson
} from "./lib/auth.js";
import {
  commitAnalyzeUsage,
  commitTranscribeUsage,
  getQuotaSnapshot,
  guardAnalyzeQuota,
  guardTranscribeQuota,
  hasInviteConfiguration,
  redeemInvite
} from "./lib/metering.js";
import { resolvePodcastSource } from "./lib/podcast-source.js";
import { findTranscript } from "./lib/transcript.js";
import { transcribeAudio } from "./lib/transcribe.js";

const root = resolve(".");
const port = Number(process.env.PORT || 4174);
const host = process.env.HOST || "127.0.0.1";
const deepSeekEndpoint = "https://api.deepseek.com/chat/completions";

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
    const secret = getSessionSecret(process.env);

    if (await handleAuth(request, response, url, secret)) {
      return;
    }

    const session = await getAuthorizedSession(request.headers.cookie, secret);
    if (!session) {
      handleUnauthorized(response, url);
      return;
    }

    if (request.method === "POST" && url.pathname === "/api/analyze") {
      await handleAnalyze(request, response, session);
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

    if (request.method === "POST" && url.pathname === "/api/transcribe") {
      await handleTranscribe(request, response, session);
      return;
    }

    if (request.method === "GET" && url.pathname === "/api/me") {
      await handleMe(response, session);
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

async function handleAuth(request, response, url, secret) {
  if (request.method === "POST" && url.pathname === "/api/auth/login") {
    const body = await readRequestText(request);
    const params = new URLSearchParams(body);
    const nextUrl = safeNext(params.get("next"));
    const user = await redeemInvite(params.get("inviteCode") || params.get("password"), process.env);

    if (user) {
      response.writeHead(303, {
        Location: nextUrl,
        "Set-Cookie": await createAuthCookie(user, secret, url.href),
        "Cache-Control": "no-store"
      });
      response.end();
      return true;
    }

    response.writeHead(303, { Location: "/?auth=failed", "Cache-Control": "no-store" });
    response.end();
    return true;
  }

  if (url.pathname === "/api/auth/logout") {
    response.writeHead(303, {
      Location: "/",
      "Set-Cookie": clearAuthCookie(url.href),
      "Cache-Control": "no-store"
    });
    response.end();
    return true;
  }

  return false;
}

function handleUnauthorized(response, url) {
  if (shouldReturnJson(url.pathname)) {
    response.writeHead(401, { "Content-Type": "application/json; charset=utf-8", "Cache-Control": "no-store" });
    response.end(unauthorizedJson());
    return;
  }

  response.writeHead(200, { "Content-Type": "text/html; charset=utf-8", "Cache-Control": "no-store" });
  response.end(renderLoginPage({ error: url.searchParams.get("auth") === "failed", setup: !hasInviteConfiguration(process.env), next: `${url.pathname}${url.search}` }));
}

function safeNext(value) {
  const next = String(value || "/");
  if (!next.startsWith("/") || next.startsWith("//") || next.includes("://")) return "/";
  if (next.startsWith("/api/auth/")) return "/";
  return next;
}

async function handleAnalyze(request, response, session) {
  const body = await readJson(request);
  const apiKey = body.apiKey || process.env.DEEPSEEK_API_KEY;

  if (!apiKey) {
    sendJson(response, 400, { error: "缺少 DeepSeek API Key" });
    return;
  }

  try {
    await guardAnalyzeQuota(process.env, session);

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
    if (!upstream.ok) {
      response.writeHead(upstream.status, {
        "Content-Type": upstream.headers.get("content-type") || "application/json; charset=utf-8"
      });
      response.end(text);
      return;
    }

    const quota = await commitAnalyzeUsage(process.env, session);
    const payload = safeJson(text);
    if (payload && typeof payload === "object") {
      payload.quota = quota;
      sendJson(response, upstream.status, payload);
      return;
    }

    response.writeHead(upstream.status, {
      "Content-Type": upstream.headers.get("content-type") || "application/json; charset=utf-8"
    });
    response.end(text);
  } catch (error) {
    const status = Number(error.status || 500);
    sendJson(response, status, { error: error.message || "DeepSeek 分析失败", quota: error.quota });
  }
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
    const feed = await resolvePodcastSource(parsedUrl.href, { signal: controller.signal });
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

async function handleTranscribe(request, response, session) {
  const body = await readJson(request);
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 540000);

  try {
    const quotaGuard = await guardTranscribeQuota(process.env, session, body);
    if (quotaGuard.cached) {
      sendJson(response, 200, quotaGuard.cached);
      return;
    }

    const result = await transcribeAudio(body, {
      openAiApiKey: body.apiKey || process.env.OPENAI_API_KEY,
      deepgramApiKey: body.deepgramApiKey || process.env.DEEPGRAM_API_KEY,
      signal: controller.signal
    });
    const quota = await commitTranscribeUsage(process.env, session, body, result, quotaGuard);
    sendJson(response, 200, { ...result, quota });
  } catch (error) {
    const status = Number(error.status || 502);
    const message = error.name === "AbortError" ? "音频转写超时" : error.message || "音频转写失败";
    const quota = error.quota || (status === 429 ? await getQuotaSnapshot(process.env, session).catch(() => null) : null);
    sendJson(response, status, {
      ok: false,
      error: message,
      setupRequired: Boolean(error.setupRequired),
      contentLength: error.contentLength,
      maxBytes: error.maxBytes,
      provider: error.provider,
      quota
    });
  } finally {
    clearTimeout(timeout);
  }
}

async function handleMe(response, session) {
  const quota = await getQuotaSnapshot(process.env, session);
  sendJson(response, 200, { ok: true, user: quota.user, quota });
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
  const raw = await readRequestText(request);
  return raw ? JSON.parse(raw) : {};
}

async function readRequestText(request) {
  let raw = "";
  for await (const chunk of request) {
    raw += chunk;
  }
  return raw;
}

function sendJson(response, status, payload) {
  response.writeHead(status, { "Content-Type": "application/json; charset=utf-8" });
  response.end(JSON.stringify(payload));
}

function safeJson(text) {
  try {
    return JSON.parse(text);
  } catch {
    return null;
  }
}

function sanitizeFileName(value) {
  return value.replace(/[\\/:*?"<>|]/g, "-").replace(/\s+/g, " ").trim() || "podcast-note.md";
}
