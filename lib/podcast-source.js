const maxFeedBytes = 5 * 1024 * 1024;
const userAgent = "PodNote/0.14.0";

export async function resolvePodcastSource(inputUrl, options = {}) {
  const signal = options.signal;
  const first = await fetchText(inputUrl, signal);
  if (looksLikeFeed(first.text)) {
    return { ok: true, url: first.url, xml: first.text };
  }

  const discoveredUrl = discoverFeedUrl(first.text, first.url);
  if (discoveredUrl) {
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

  const xiaoyuzhouFeed = buildXiaoyuzhouFeed(first.text, first.url);
  if (xiaoyuzhouFeed) {
    return {
      ok: true,
      url: first.url,
      sourceUrl: first.url,
      discovered: true,
      platform: "xiaoyuzhou",
      xml: xiaoyuzhouFeed.xml,
      importedCount: xiaoyuzhouFeed.importedCount,
      skippedCount: xiaoyuzhouFeed.skippedCount
    };
  }

  throw new Error("没有在这个页面找到 RSS 或可导入的公开播客数据。请换播客订阅页、RSS 链接，或使用小宇宙公开节目页。");
}

async function fetchText(url, signal) {
  const upstream = await fetch(url, {
    headers: {
      Accept: "application/rss+xml, application/atom+xml, application/xml, text/xml, text/html, */*",
      "User-Agent": userAgent
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

function buildXiaoyuzhouFeed(html, pageUrl) {
  const pageHost = safeUrl(pageUrl)?.hostname || "";
  if (!/(^|\.)xiaoyuzhoufm\.com$/i.test(pageHost)) return null;

  const data = parseNextData(html);
  const pageProps = data?.props?.pageProps;
  const podcast = pageProps?.podcast || pageProps?.episode?.podcast;
  const rawEpisodes = pageProps?.podcast?.episodes || (pageProps?.episode ? [pageProps.episode] : []);
  if (!podcast || !rawEpisodes.length) return null;

  const publicEpisodes = rawEpisodes.map((episode) => normalizeXiaoyuzhouEpisode(episode, podcast)).filter(Boolean);
  if (!publicEpisodes.length) {
    throw new Error("这个小宇宙页面没有可导入的公开音频。付费或私密单集暂时不能转写。");
  }

  const skippedCount = rawEpisodes.length - publicEpisodes.length;
  return {
    importedCount: publicEpisodes.length,
    skippedCount,
    xml: renderRssXml({
      title: podcast.title || "小宇宙播客",
      author: podcast.author || "",
      description: podcast.description || podcast.brief || "",
      image: readImageUrl(podcast.image),
      link: pageUrl,
      items: publicEpisodes
    })
  };
}

function parseNextData(html) {
  const match = html.match(/<script id="__NEXT_DATA__" type="application\/json">([\s\S]*?)<\/script>/);
  if (!match) return null;
  try {
    return JSON.parse(match[1]);
  } catch {
    return null;
  }
}

function normalizeXiaoyuzhouEpisode(episode, podcast) {
  if (!episode || episode.isPrivateMedia) return null;

  const audioUrl = episode.enclosure?.url || episode.media?.source?.url || episode.media?.url || "";
  if (!audioUrl) return null;

  const image = readImageUrl(episode.image) || readImageUrl(podcast.image);
  const episodeUrl = episode.eid ? `https://www.xiaoyuzhoufm.com/episode/${episode.eid}` : "";

  return {
    id: episode.eid || audioUrl,
    title: episode.title || "未命名单集",
    description: episode.description || episode.shownotes || "",
    pubDate: episode.pubDate || "",
    link: episodeUrl,
    duration: secondsToDuration(Number(episode.duration || 0)),
    audioUrl,
    audioLength: Number(episode.media?.size || 0),
    audioType: episode.media?.mimeType || inferAudioType(audioUrl),
    image
  };
}

function renderRssXml(feed) {
  const items = feed.items.map(renderRssItem).join("\n");

  return `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0" xmlns:itunes="http://www.itunes.com/dtds/podcast-1.0.dtd">
  <channel>
    <title>${escapeXml(feed.title)}</title>
    <link>${escapeXml(feed.link)}</link>
    <description>${cdata(feed.description)}</description>
    ${feed.author ? `<itunes:author>${escapeXml(feed.author)}</itunes:author>` : ""}
    ${feed.image ? `<itunes:image href="${escapeXml(feed.image)}" />` : ""}
${items}
  </channel>
</rss>`;
}

function renderRssItem(item) {
  const image = item.image ? `    <itunes:image href="${escapeXml(item.image)}" />\n` : "";
  const pubDate = item.pubDate ? `    <pubDate>${escapeXml(new Date(item.pubDate).toUTCString())}</pubDate>\n` : "";
  const link = item.link ? `    <link>${escapeXml(item.link)}</link>\n` : "";
  const duration = item.duration ? `    <itunes:duration>${escapeXml(item.duration)}</itunes:duration>\n` : "";
  const length = item.audioLength || 0;
  const type = item.audioType || inferAudioType(item.audioUrl);

  return `  <item>
    <title>${escapeXml(item.title)}</title>
    <description>${cdata(item.description)}</description>
${link}${pubDate}    <guid isPermaLink="false">${escapeXml(item.id)}</guid>
${duration}${image}    <enclosure url="${escapeXml(item.audioUrl)}" length="${length}" type="${escapeXml(type)}" />
  </item>`;
}

function readImageUrl(image) {
  return image?.picUrl || image?.largePicUrl || image?.middlePicUrl || image?.thumbnailUrl || "";
}

function secondsToDuration(seconds) {
  if (!Number.isFinite(seconds) || seconds <= 0) return "";
  const rounded = Math.round(seconds);
  const hours = Math.floor(rounded / 3600);
  const minutes = Math.floor((rounded % 3600) / 60);
  const rest = rounded % 60;
  return hours ? `${hours}:${pad(minutes)}:${pad(rest)}` : `${minutes}:${pad(rest)}`;
}

function inferAudioType(url) {
  const cleanUrl = String(url || "").split("?")[0].toLowerCase();
  if (cleanUrl.endsWith(".mp3")) return "audio/mpeg";
  if (cleanUrl.endsWith(".m4a")) return "audio/mp4";
  if (cleanUrl.endsWith(".aac")) return "audio/aac";
  return "audio/mpeg";
}

function cdata(value) {
  return `<![CDATA[${String(value || "").replaceAll("]]>", "]]]]><![CDATA[>")}]]>`;
}

function escapeXml(value) {
  return String(value || "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&apos;");
}

function readHtmlAttr(tag, attr) {
  const match = tag.match(new RegExp(`${attr}=["']([^"']+)["']`, "i"));
  return match?.[1] || "";
}

function safeUrl(value) {
  try {
    return new URL(value);
  } catch {
    return null;
  }
}

function pad(value) {
  return String(value).padStart(2, "0");
}
