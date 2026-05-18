const maxTranscriptBytes = 5 * 1024 * 1024;
const userAgent = "PodNote/0.15.0";

export async function findTranscript(params, options = {}) {
  const checked = [];
  const signal = options.signal;

  const directUrl = normalizeHttpUrl(params.transcriptUrl);
  if (directUrl) {
    const direct = await loadTranscriptFromUrl(directUrl, "provided-transcript", signal, checked);
    if (direct) return direct;
  }

  const feedUrl = normalizeHttpUrl(params.feedUrl || params.sourceUrl || params.feed);
  if (feedUrl) {
    const feed = await fetchText(feedUrl, signal);
    checked.push({ type: "feed", url: feed.url });
    const fromFeed = await findTranscriptInFeed(feed.text, feed.url, params, signal, checked);
    if (fromFeed) return fromFeed;
  }

  const episodeUrl = normalizeHttpUrl(params.episodeUrl || params.pageUrl || params.url);
  if (episodeUrl) {
    const page = await fetchText(episodeUrl, signal);
    checked.push({ type: "episode-page", url: page.url });

    const embedded = extractHtmlTranscript(page.text);
    if (embedded) {
      return {
        ok: true,
        sourceType: "episode-page",
        url: page.url,
        transcript: embedded
      };
    }

    const candidates = discoverTranscriptUrls(page.text, page.url);
    for (const candidate of candidates) {
      const result = await loadTranscriptFromUrl(candidate, "episode-page-link", signal, checked);
      if (result) return result;
    }
  }

  return {
    ok: false,
    needsTranscription: true,
    checked,
    message: "这期节目没有公开 transcript。需要接入语音转写服务，或先手动粘贴文字稿。"
  };
}

async function findTranscriptInFeed(xml, feedUrl, params, signal, checked) {
  const blocks = extractFeedItemBlocks(xml);
  const scoredBlocks = blocks
    .map((block, index) => ({ block, index, score: scoreFeedItem(block, params) }))
    .filter((item) => item.score > 0 || !hasAnyMatchInput(params))
    .sort((a, b) => b.score - a.score || a.index - b.index);

  for (const { block } of scoredBlocks) {
    const inlineTranscript = readInlineTranscript(block);
    if (inlineTranscript) {
      return {
        ok: true,
        sourceType: "rss-inline-transcript",
        url: feedUrl,
        transcript: inlineTranscript
      };
    }

    const candidates = readFeedTranscriptUrls(block, feedUrl);
    for (const candidate of candidates) {
      const result = await loadTranscriptFromUrl(candidate, "rss-transcript", signal, checked);
      if (result) return result;
    }
  }

  return null;
}

async function loadTranscriptFromUrl(url, sourceType, signal, checked) {
  try {
    const resource = await fetchText(url, signal);
    checked.push({ type: sourceType, url: resource.url });
    const parsed = parseTranscriptResource(resource.text, resource.url, resource.contentType);
    if (!parsed.transcript) return null;
    return {
      ok: true,
      sourceType,
      url: resource.url,
      format: parsed.format,
      transcript: parsed.transcript
    };
  } catch (error) {
    checked.push({ type: sourceType, url, error: error.message || "fetch failed" });
    return null;
  }
}

async function fetchText(url, signal) {
  const upstream = await fetch(url, {
    headers: {
      Accept: "text/vtt, application/srt, application/json, text/plain, text/html, application/xml, text/xml, */*",
      "User-Agent": userAgent
    },
    signal
  });

  if (!upstream.ok) {
    throw new Error(`抓取失败：HTTP ${upstream.status}`);
  }

  const contentLength = Number(upstream.headers.get("content-length") || 0);
  if (contentLength > maxTranscriptBytes) {
    throw new Error("transcript 文件过大");
  }

  const text = await upstream.text();
  if (new TextEncoder().encode(text).byteLength > maxTranscriptBytes) {
    throw new Error("transcript 文件过大");
  }

  return {
    text,
    url: upstream.url,
    contentType: upstream.headers.get("content-type") || ""
  };
}

function extractFeedItemBlocks(xml) {
  const itemBlocks = [...xml.matchAll(/<item\b[\s\S]*?<\/item>/gi)].map(([block]) => block);
  if (itemBlocks.length) return itemBlocks;
  return [...xml.matchAll(/<entry\b[\s\S]*?<\/entry>/gi)].map(([block]) => block);
}

function hasAnyMatchInput(params) {
  return Boolean(params.episodeUrl || params.pageUrl || params.audioUrl || params.title);
}

function scoreFeedItem(block, params) {
  let score = 0;
  const decodedBlock = decodeEntities(block);
  const normalizedBlock = normalizeUrlForCompare(decodedBlock);

  for (const url of [params.episodeUrl, params.pageUrl, params.audioUrl]) {
    const normalizedUrl = normalizeUrlForCompare(url);
    if (normalizedUrl && normalizedBlock.includes(normalizedUrl)) score += 6;
  }

  const itemTitle = normalizeTitle(readFirstXmlText(block, ["title"]));
  const targetTitle = normalizeTitle(params.title);
  if (itemTitle && targetTitle) {
    if (itemTitle === targetTitle) score += 5;
    else if (itemTitle.includes(targetTitle) || targetTitle.includes(itemTitle)) score += 3;
  }

  return score;
}

function readFeedTranscriptUrls(block, feedUrl) {
  const candidates = [];
  const transcriptTagPattern =
    /<((?:[\w.-]+:)?transcript)\b([^>]*)>([\s\S]*?)<\/\1>|<((?:[\w.-]+:)?transcript)\b([^>]*)\/>/gi;

  for (const match of block.matchAll(transcriptTagPattern)) {
    const attrs = match[2] || match[5] || "";
    const url = readHtmlAttr(attrs, "url") || readHtmlAttr(attrs, "href") || readHtmlAttr(attrs, "src");
    if (url) candidates.push(url);
  }

  for (const [tag] of block.matchAll(/<link\b[^>]*>/gi)) {
    const rel = readHtmlAttr(tag, "rel");
    const type = readHtmlAttr(tag, "type");
    const href = readHtmlAttr(tag, "href");
    const scoreText = `${rel} ${type} ${href}`.toLowerCase();
    if (href && isTranscriptCandidate(scoreText)) {
      candidates.push(href);
    }
  }

  return uniqueUrls(candidates, feedUrl);
}

function readInlineTranscript(block) {
  const transcriptTagPattern = /<((?:[\w.-]+:)?transcript)\b([^>]*)>([\s\S]*?)<\/\1>/gi;
  for (const match of block.matchAll(transcriptTagPattern)) {
    const body = stripCdata(match[3] || "").trim();
    if (!body || /^https?:\/\//i.test(body)) continue;
    const text = normalizePlainTranscript(stripHtml(body));
    if (isUsefulTranscript(text)) return text;
  }
  return "";
}

function discoverTranscriptUrls(html, baseUrl) {
  const candidates = [];
  const linkPattern = /<link\b[^>]*>/gi;
  for (const [tag] of html.matchAll(linkPattern)) {
    const rel = readHtmlAttr(tag, "rel");
    const type = readHtmlAttr(tag, "type");
    const href = readHtmlAttr(tag, "href");
    const scoreText = `${rel} ${type} ${href}`.toLowerCase();
    if (href && isTranscriptCandidate(scoreText)) {
      candidates.push(href);
    }
  }

  const anchorPattern = /<a\b[^>]*href=["']([^"']+)["'][^>]*>([\s\S]*?)<\/a>/gi;
  for (const [, href, label] of html.matchAll(anchorPattern)) {
    const scoreText = `${href} ${stripHtml(label)}`.toLowerCase();
    if (isTranscriptCandidate(scoreText)) {
      candidates.push(href);
    }
  }

  return uniqueUrls(candidates, baseUrl);
}

function isTranscriptCandidate(value) {
  return (
    /transcript|caption|subtitle|show transcript|文字稿|文稿|字幕|转写|逐字稿|全文/.test(value) ||
    /\.(vtt|srt|ttml|txt)(?:[?#]|$)/i.test(value)
  );
}

function parseTranscriptResource(text, url, contentType) {
  const trimmed = text.trim();
  const lowerUrl = url.toLowerCase();
  const lowerType = contentType.toLowerCase();

  if (lowerType.includes("json") || lowerUrl.endsWith(".json") || /^[\[{]/.test(trimmed)) {
    const jsonTranscript = parseJsonTranscript(trimmed);
    if (jsonTranscript) return { format: "json", transcript: jsonTranscript };
  }

  if (lowerType.includes("vtt") || lowerUrl.endsWith(".vtt") || trimmed.startsWith("WEBVTT")) {
    const vttTranscript = parseTimedText(trimmed);
    if (vttTranscript) return { format: "vtt", transcript: vttTranscript };
  }

  if (lowerType.includes("srt") || lowerUrl.endsWith(".srt") || /^\d+\s*\n\d{1,2}:\d{2}/.test(trimmed)) {
    const srtTranscript = parseTimedText(trimmed);
    if (srtTranscript) return { format: "srt", transcript: srtTranscript };
  }

  if (/<html|<body|<article|<section|<div/i.test(trimmed)) {
    const htmlTranscript = extractHtmlTranscript(trimmed) || normalizePlainTranscript(stripHtml(trimmed));
    if (isUsefulTranscript(htmlTranscript)) return { format: "html", transcript: htmlTranscript };
  }

  const plainTranscript = normalizePlainTranscript(trimmed);
  if (isUsefulTranscript(plainTranscript)) return { format: "text", transcript: plainTranscript };

  return { format: "unknown", transcript: "" };
}

function parseJsonTranscript(text) {
  try {
    const data = JSON.parse(text);
    if (typeof data === "string") return normalizePlainTranscript(data);
    if (typeof data?.transcript === "string") return normalizePlainTranscript(data.transcript);
    if (typeof data?.text === "string" && isUsefulTranscript(data.text)) return normalizePlainTranscript(data.text);

    const segments = [];
    collectJsonSegments(data, segments);
    if (!segments.length) return "";

    return segments
      .map((segment) => {
        const time = Number.isFinite(segment.start) ? `[${secondsToTimestamp(segment.start)}] ` : "";
        return `${time}${segment.text}`.trim();
      })
      .filter(Boolean)
      .join("\n");
  } catch {
    return "";
  }
}

function collectJsonSegments(value, segments, depth = 0) {
  if (!value || depth > 5) return;

  if (Array.isArray(value)) {
    for (const item of value) collectJsonSegments(item, segments, depth + 1);
    return;
  }

  if (typeof value !== "object") return;

  const text = value.text || value.transcript || value.content;
  const start = Number(value.start ?? value.startTime ?? value.start_time ?? value.offset);
  if (typeof text === "string" && text.trim()) {
    segments.push({
      text: normalizeWhitespace(text),
      start: Number.isFinite(start) ? start : undefined
    });
  }

  for (const item of Object.values(value)) collectJsonSegments(item, segments, depth + 1);
}

function parseTimedText(text) {
  const lines = text.replace(/\r/g, "").split("\n");
  const cues = [];

  for (let index = 0; index < lines.length; index += 1) {
    const line = lines[index].trim();
    if (!line.includes("-->")) continue;

    const start = formatCueTime(line.split("-->")[0].trim());
    const cueText = [];
    index += 1;

    while (index < lines.length && lines[index].trim() && !lines[index].includes("-->")) {
      const value = lines[index].trim();
      if (!/^\d+$/.test(value) && !/^NOTE|STYLE|REGION$/i.test(value)) {
        cueText.push(cleanCaptionText(value));
      }
      index += 1;
    }

    const cleanText = normalizeWhitespace(cueText.join(" "));
    if (cleanText) cues.push(`[${start}] ${cleanText}`);
  }

  return cues.length ? cues.join("\n") : "";
}

function extractHtmlTranscript(html) {
  const cleanHtml = html
    .replace(/<script\b[\s\S]*?<\/script>/gi, " ")
    .replace(/<style\b[\s\S]*?<\/style>/gi, " ");

  const transcriptBlockPattern =
    /<(section|article|main|div)\b[^>]*(?:id|class)=["'][^"']*(?:transcript|caption|subtitle|文字稿|文稿|字幕|转写|逐字稿)[^"']*["'][^>]*>([\s\S]{80,300000}?)<\/\1>/gi;

  for (const match of cleanHtml.matchAll(transcriptBlockPattern)) {
    const text = normalizePlainTranscript(stripHtml(match[2]));
    if (isUsefulTranscript(text)) return text;
  }

  return "";
}

function readFirstXmlText(block, tagNames) {
  for (const tagName of tagNames) {
    const pattern = new RegExp(`<${tagName}\\b[^>]*>([\\s\\S]*?)<\\/${tagName}>`, "i");
    const match = block.match(pattern);
    const text = stripCdata(match?.[1] || "").trim();
    if (text) return decodeEntities(stripHtml(text));
  }
  return "";
}

function readHtmlAttr(value, attr) {
  const match = value.match(new RegExp(`${attr}\\s*=\\s*(?:"([^"]*)"|'([^']*)'|([^\\s>]+))`, "i"));
  return decodeEntities(match?.[1] || match?.[2] || match?.[3] || "");
}

function stripCdata(value) {
  return String(value || "").replace(/^<!\[CDATA\[/, "").replace(/\]\]>$/, "");
}

function stripHtml(value) {
  return decodeEntities(
    String(value || "")
      .replace(/<br\s*\/?>/gi, "\n")
      .replace(/<\/(p|div|li|section|article|h[1-6])>/gi, "\n")
      .replace(/<[^>]*>/g, " ")
  );
}

function normalizePlainTranscript(value) {
  return String(value || "")
    .replace(/\r/g, "")
    .split("\n")
    .map((line) => normalizeWhitespace(line))
    .filter(Boolean)
    .join("\n")
    .trim();
}

function cleanCaptionText(value) {
  return stripHtml(String(value || "").replace(/<\d{1,2}:\d{2}(?::\d{2})?[\d.,]*>/g, " "));
}

function normalizeWhitespace(value) {
  return String(value || "").replace(/\s+/g, " ").trim();
}

function isUsefulTranscript(text) {
  const compact = String(text || "").replace(/\s/g, "");
  return compact.length >= 80;
}

function formatCueTime(value) {
  const match = String(value).match(/(?:(\d{1,2}):)?(\d{1,2}):(\d{2})(?:[.,]\d+)?/);
  if (!match) return "00:00";
  const hours = Number(match[1] || 0);
  const minutes = Number(match[2] || 0);
  const seconds = Number(match[3] || 0);
  return hours
    ? `${hours}:${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`
    : `${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;
}

function secondsToTimestamp(totalSeconds) {
  const total = Math.max(0, Math.floor(totalSeconds || 0));
  const hours = Math.floor(total / 3600);
  const minutes = Math.floor((total % 3600) / 60);
  const seconds = total % 60;
  return hours
    ? `${hours}:${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`
    : `${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;
}

function uniqueUrls(urls, baseUrl) {
  const seen = new Set();
  const resolved = [];

  for (const url of urls) {
    const normalized = normalizeHttpUrl(url, baseUrl);
    if (!normalized || seen.has(normalized)) continue;
    seen.add(normalized);
    resolved.push(normalized);
  }

  return resolved;
}

function normalizeHttpUrl(value, baseUrl) {
  if (!value) return "";
  try {
    const url = new URL(String(value).trim(), baseUrl);
    if (!["http:", "https:"].includes(url.protocol)) return "";
    return url.href;
  } catch {
    return "";
  }
}

function normalizeUrlForCompare(value) {
  if (!value) return "";
  return decodeEntities(String(value))
    .replace(/\/$/, "")
    .toLowerCase();
}

function normalizeTitle(value) {
  return decodeEntities(String(value || ""))
    .toLowerCase()
    .replace(/[^\da-z\u4e00-\u9fff]+/g, "")
    .trim();
}

function decodeEntities(value) {
  return String(value || "")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;|&apos;/g, "'")
    .replace(/&#(\d+);/g, (_, code) => String.fromCharCode(Number(code)))
    .replace(/&#x([0-9a-f]+);/gi, (_, code) => String.fromCharCode(parseInt(code, 16)));
}
