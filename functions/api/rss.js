const maxFeedBytes = 5 * 1024 * 1024;

export async function onRequestGet({ request }) {
  const url = new URL(request.url);
  const feedUrl = String(url.searchParams.get("url") || "").trim();

  if (!feedUrl) {
    return sendJson({ error: "缺少播客链接" }, 400);
  }

  let parsedUrl;
  try {
    parsedUrl = new URL(feedUrl);
  } catch {
    return sendJson({ error: "播客链接格式不正确" }, 400);
  }

  if (!["http:", "https:"].includes(parsedUrl.protocol)) {
    return sendJson({ error: "播客链接必须是 http 或 https" }, 400);
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 15000);

  try {
    const feed = await fetchFeedOrDiscover(parsedUrl.toString(), controller.signal);
    return sendJson(feed);
  } catch (error) {
    const message = error.name === "AbortError" ? "链接解析超时" : error.message || "链接解析失败";
    return sendJson({ error: message }, 502);
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
  if (new TextEncoder().encode(text).byteLength > maxFeedBytes) {
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

function sendJson(payload, status = 200) {
  return new Response(JSON.stringify(payload), {
    status,
    headers: { "Content-Type": "application/json; charset=utf-8" }
  });
}
