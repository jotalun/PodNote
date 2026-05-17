let episodes = [
  {
    id: "ai-work",
    show: "声动活泼",
    title: "AI 原生应用为什么会改变知识工作",
    desc: "从桌面端收听、字幕跟读、结构化摘要到 Obsidian 笔记，本集适合整理成长期可复用的知识卡片。",
    duration: "48:12",
    progress: 27,
    color: ["#111111", "#4b4b50", "#d8d8dc"],
    chapters: [
      ["00:00", "开场：为什么桌面端播客仍然重要", "通勤之外，播客正在变成工作流里的背景输入。"],
      ["08:20", "从听见到看见：字幕的价值", "中文字幕让搜索、引用和复盘变得稳定。"],
      ["19:40", "AI 摘要不该只是压缩文本", "好的摘要要保留论点、例子、反方观点和待验证问题。"],
      ["35:10", "连接 Obsidian 的知识闭环", "把时间戳、标签、反思和双链写入同一个 Markdown 模板。"]
    ],
    transcript: [
      ["12:02", "很多播客 App 把桌面端当成附属品，但真正高频的知识整理往往发生在电脑上。", "Most knowledge processing still happens on desktop."],
      ["12:28", "如果播放器、字幕和笔记是分开的，用户会在复制、暂停、切换窗口里损失注意力。", "Context switching breaks the flow."],
      ["13:05", "所以这个产品的核心不是再做一个播放器，而是做一个播客知识工作台。", "The product is a podcast knowledge workspace."],
      ["13:44", "字幕需要按句子对齐时间戳，用户点一句话就能回到原声语境。", "Sentence-level timestamps keep the original context reachable."],
      ["14:18", "摘要最好拆成主要观点、相关知识点、可行动事项和可以放进 Obsidian 的原子笔记。", "Summaries should become reusable notes, not just short text."]
    ]
  },
  {
    id: "city",
    show: "忽左忽右",
    title: "城市更新、社区记忆与年轻人的迁徙",
    desc: "一集适合边听边整理城市研究、地方叙事和公共空间案例的长谈。",
    duration: "63:08",
    progress: 42,
    color: ["#202024", "#6e6e73", "#f5f5f7"],
    chapters: [
      ["00:00", "社区为什么会留下记忆", "讨论城市空间如何承载个人经验。"],
      ["16:30", "更新与替换的边界", "城市治理里常见的效率和情感冲突。"],
      ["41:15", "迁徙之后如何重新建立关系", "年轻人如何在新城市形成弱连接。"]
    ],
    transcript: [
      ["22:10", "所谓社区记忆并不抽象，它常常藏在一条小路、一个菜场和反复见到的人里面。", "Community memory lives in repeated places and faces."],
      ["23:02", "城市更新的问题，是我们很难给情感价值定价。", "Emotional value is hard to price."],
      ["23:39", "对年轻人来说，新城市的归属感通常不是买房开始的，而是从熟悉路线开始的。", "Belonging often starts with familiar routes."]
    ]
  },
  {
    id: "money",
    show: "商业就是这样",
    title: "订阅制、会员费和内容产品的长期价值",
    desc: "围绕内容付费、用户留存和产品定位的一期商业分析。",
    duration: "52:35",
    progress: 18,
    color: ["#000000", "#3a3a3c", "#a1a1a6"],
    chapters: [
      ["00:00", "内容产品为什么爱订阅制", "稳定现金流和持续交付之间的关系。"],
      ["14:50", "会员费不只是价格问题", "用户对价值的判断来自频率、信任和省心。"],
      ["32:25", "工具型内容的机会", "内容和工作流结合后更容易产生长期留存。"]
    ],
    transcript: [
      ["09:32", "订阅制真正卖的不是某一期内容，而是持续降低用户选择成本。", "Subscriptions reduce recurring decision cost."],
      ["10:16", "当内容能进入工作流，它的价值就不再只由播放量决定。", "Workflow integration changes the value metric."],
      ["11:05", "播客如果能自动沉淀为笔记，它就从媒体消费变成了知识资产。", "Podcast listening can become a knowledge asset."]
    ]
  }
];

let activeEpisode = episodes[0];
let isPlaying = true;
let bilingual = false;
let currentSpeed = 1.25;
let savedSettings = {};

const episodeList = document.querySelector("#episodeList");
const transcriptEl = document.querySelector("#transcript");
const chaptersEl = document.querySelector("#chapters");
const rawTranscript = document.querySelector("#rawTranscript");
const noteOutput = document.querySelector("#noteOutput");
const toast = document.querySelector("#toast");
const analysisStatus = document.querySelector("#analysisStatus");
const deepseekButton = document.querySelector("#deepseekButton");
const audioPlayer = document.querySelector("#audioPlayer");
const audioStatus = document.querySelector("#audioStatus");

function renderEpisodes(items = episodes) {
  episodeList.replaceChildren(...items.map(createEpisodeCard));
}

function createEpisodeCard(episode) {
  const button = document.createElement("button");
  button.className = `episode-card ${episode.id === activeEpisode.id ? "active" : ""}`;
  button.type = "button";
  button.dataset.id = episode.id;

  const cover = document.createElement("span");
  cover.className = "mini-cover";
  setCoverBackground(cover, episode);

  const copy = document.createElement("span");
  const title = document.createElement("strong");
  title.textContent = episode.title;
  const meta = document.createElement("span");
  meta.textContent = `${episode.show} · ${episode.duration || "未知时长"}`;
  copy.append(title, meta);
  button.append(cover, copy);
  return button;
}

function renderEpisode() {
  document.querySelector("#episodeTitle").textContent = `${activeEpisode.show}：${activeEpisode.title}`;
  document.querySelector("#showName").textContent = activeEpisode.show;
  document.querySelector("#episodeHeading").textContent = activeEpisode.title;
  document.querySelector("#episodeDesc").textContent = activeEpisode.desc;
  document.querySelector("#duration").textContent = activeEpisode.duration;
  document.querySelector("#progress").value = activeEpisode.progress;
  document.querySelector("#currentTime").textContent = progressToTime(activeEpisode.progress, activeEpisode.duration);
  setCoverBackground(document.querySelector("#coverArt"), activeEpisode);

  const transcriptRows = activeEpisode.transcript?.length ? activeEpisode.transcript : [["00:00", "请先粘贴 transcript，或接入转写后再生成笔记。", ""]];
  transcriptEl.innerHTML = transcriptRows
    .map(
      ([time, line, english], index) => `
        <button class="line ${index === 2 ? "active" : ""}" type="button" data-time="${time}">
          <time>${time}</time>
          <p>${line}${bilingual ? `<small>${english}</small>` : ""}</p>
        </button>
      `
    )
    .join("");

  rawTranscript.value = getEpisodeTranscriptText(activeEpisode);
  chaptersEl.innerHTML = activeEpisode.chapters
    .map(
      ([time, title, summary]) => `
        <article class="chapter">
          <time>${time}</time>
          <strong>${title}</strong>
          <p>${summary}</p>
        </article>
      `
    )
    .join("");

  setupAudioForEpisode(activeEpisode);
  generateNote();
  renderEpisodes();
}

function getEpisodeTranscriptText(episode) {
  if (typeof episode.rawTranscript === "string") return episode.rawTranscript;
  if (episode.hasTranscript === false) return "";
  return (episode.transcript || []).map(([time, line]) => `[${time}] ${line}`).join("\n");
}

function setCoverBackground(element, episode) {
  if (episode.image) {
    element.style.backgroundImage = `url("${episode.image.replaceAll('"', "%22")}")`;
    element.style.backgroundSize = "cover";
    element.style.backgroundPosition = "center";
    return;
  }

  const colors = episode.color || ["#111111", "#4b4b50", "#d8d8dc"];
  element.style.backgroundImage = `radial-gradient(circle at 30% 25%, rgba(255,255,255,.55), transparent 32%), linear-gradient(135deg, ${colors.join(", ")})`;
  element.style.backgroundSize = "cover";
  element.style.backgroundPosition = "center";
}

function setupAudioForEpisode(episode) {
  audioPlayer.pause();
  audioPlayer.removeAttribute("src");
  audioPlayer.load();
  isPlaying = false;
  document.querySelector("#playButton").textContent = "播放";

  if (!episode.audioUrl) {
    audioStatus.textContent = "示例单集，尚未连接真实音频";
    return;
  }

  audioPlayer.src = episode.audioUrl;
  audioPlayer.playbackRate = currentSpeed;
  audioPlayer.load();
  audioStatus.textContent = "真实音频已连接，点击播放开始收听";
}

function generateNote() {
  const template = document.querySelector("#templateSelect").value;
  const tags = document.querySelector("#tagInput").value;
  const chapterList = activeEpisode.chapters.map(([time, title, summary]) => `- [${time}] ${title}：${summary}`).join("\n");
  const transcriptText = rawTranscript.value.trim() || activeEpisode.transcript.map(([time, line]) => `[${time}] ${line}`).join("\n");
  const transcriptLines = transcriptText.split("\n").filter(Boolean);
  const quoteList = transcriptLines.slice(0, 6).map((line) => `> ${line}`).join("\n\n");
  const extractedPoints = buildPointsFromTranscript(transcriptText);

  const blocks = {
    knowledge: `# ${activeEpisode.title}

${tags}

## 一句话总结
这期节目讨论了「${activeEpisode.title}」。下面的整理基于完整 transcript，不直接依赖节目简介，所以后续可以替换成真实转写文本。

## 主要内容
${chapterList}

## 从 transcript 提取的重点
${extractedPoints}

## 相关知识点
- 桌面端播客：适合长时间收听、资料检索和笔记整理。
- 中文字幕：让音频内容具备搜索、引用和复盘能力。
- AI 摘要：应保留论点、例子、疑问和行动项，而不是只做短摘要。
- Obsidian 工作流：用标签、双链、时间戳把播客内容沉淀为知识库。

## 可行动事项
- 找到这期节目中值得二次研究的 2 个概念。
- 把一个观点拆成独立卡片，并链接到已有主题。
- 回听一个带时间戳的关键片段，补充原始语境。

## 原声摘录
${quoteList}

## Transcript 原文
${transcriptText}
`,
    meeting: `# ${activeEpisode.title}

${tags}

## 原始材料
整理依据：完整 transcript

## 议题
${chapterList}

## 从 transcript 提取的重点
${extractedPoints}

## 决策与判断
- 播客桌面端的机会在于整合收听、字幕、摘要和知识库。
- 导出格式优先选择 Markdown，便于进入 Obsidian。

## 后续动作
- 设计 RSS 导入。
- 接入转写和翻译。
- 生成 Obsidian 模板。
`,
    zettel: `# ${activeEpisode.title}

${tags}

## Permanent note
播客内容的长期价值不在播放完成，而在完整 transcript 能否被重新组织成个人知识系统里的观点、证据和链接。桌面端播放器如果能把转写、时间戳、摘要和 Markdown 导出放在同一界面，就能把音频消费变成知识生产。

## Extracted points
${extractedPoints}

## Links
- [[播客]]
- [[知识管理]]
- [[Obsidian]]

## Evidence
${quoteList}
`
  };

  noteOutput.value = blocks[template];
  updatePipeline("local");
}

function buildPointsFromTranscript(text) {
  const lines = text
    .split("\n")
    .map((line) => line.replace(/^\[[^\]]+\]\s*/, "").trim())
    .filter(Boolean);

  if (!lines.length) {
    return "- 暂无 transcript 内容。";
  }

  return lines
    .slice(0, 5)
    .map((line) => {
      const clipped = line.length > 44 ? `${line.slice(0, 44)}...` : line;
      return `- ${clipped}`;
    })
    .join("\n");
}

function progressToTime(progress, duration) {
  if (!duration || duration === "未知时长") return "00:00";
  const total = parseTimeToSeconds(duration);
  if (!total) return "00:00";
  const current = Math.floor((total * progress) / 100);
  return secondsToTimestamp(current);
}

function parseTimeToSeconds(value) {
  if (!value) return 0;
  if (/^\d+$/.test(String(value))) return Number(value);
  const parts = String(value).split(":").map(Number);
  if (parts.some((part) => !Number.isFinite(part))) return 0;
  return parts.reduce((total, part) => total * 60 + part, 0);
}

function secondsToTimestamp(totalSeconds) {
  const total = Math.max(0, Math.floor(totalSeconds || 0));
  const hours = Math.floor(total / 3600);
  const mins = Math.floor((total % 3600) / 60);
  const secs = total % 60;
  if (hours) return `${hours}:${String(mins).padStart(2, "0")}:${String(secs).padStart(2, "0")}`;
  return `${String(mins).padStart(2, "0")}:${String(secs).padStart(2, "0")}`;
}

function showToast(message) {
  toast.textContent = message;
  toast.classList.add("show");
  window.setTimeout(() => toast.classList.remove("show"), 1800);
}

function loadSettings() {
  savedSettings = JSON.parse(localStorage.getItem("podnote-settings") || "{}");
  document.querySelector("#rssInput").value = savedSettings.rss || "";
  document.querySelector("#transcriptSourceSelect").value = savedSettings.transcriptSource || "manual";
  document.querySelector("#languageSelect").value = savedSettings.language || "zh-CN";
  document.querySelector("#apiKeyInput").value = savedSettings.apiKey || "";
  document.querySelector("#modelSelect").value = savedSettings.model || "deepseek-v4-flash";
  document.querySelector("#vaultInput").value = savedSettings.vault || "";
}

function saveSettings() {
  savedSettings = {
    rss: document.querySelector("#rssInput").value.trim(),
    transcriptSource: document.querySelector("#transcriptSourceSelect").value,
    language: document.querySelector("#languageSelect").value,
    apiKey: document.querySelector("#apiKeyInput").value.trim(),
    model: document.querySelector("#modelSelect").value,
    vault: document.querySelector("#vaultInput").value.trim()
  };
  localStorage.setItem("podnote-settings", JSON.stringify(savedSettings));
  showToast("设置已保存在本机浏览器");
}

function updatePipeline(state) {
  const analyzeStep = document.querySelector("#stepAnalyze");
  const exportStep = document.querySelector("#stepExport");
  analyzeStep.classList.toggle("active", state === "analyzing");
  analyzeStep.classList.toggle("done", state === "ai" || state === "local" || state === "exported");
  exportStep.classList.toggle("done", state === "exported");

  const labels = {
    idle: "等待 DeepSeek",
    local: "已本地整理",
    analyzing: "正在分析",
    ai: "已用 AI 整理",
    error: "分析失败",
    exported: "Markdown 就绪"
  };
  analysisStatus.textContent = labels[state] || labels.idle;
}

function buildDeepSeekPrompt() {
  const template = document.querySelector("#templateSelect").value;
  const tags = document.querySelector("#tagInput").value.trim();
  const transcriptText = rawTranscript.value.trim();
  const language = document.querySelector("#languageSelect").selectedOptions[0].textContent;

  return `请基于下面的播客 transcript 生成一份可以直接放进 Obsidian 的 Markdown 笔记。

要求：
- 只能基于 transcript，不要编造没有出现的信息。
- 保留关键时间戳，重要原话用引用块。
- 输出结构包含：一句话总结、主要观点、相关知识点、可行动事项、值得回听的原声摘录、可建立的双链。
- 如果 transcript 里有主持人和嘉宾，请尽量区分观点来源。
- 模板偏好：${template}
- 标签：${tags}
- 输出语言：${language}
- 只输出 Markdown 正文，不要额外解释。

节目：${activeEpisode.show} - ${activeEpisode.title}

Transcript:
${transcriptText}`;
}

async function analyzeWithDeepSeek() {
  const apiKey = document.querySelector("#apiKeyInput").value.trim();
  const model = document.querySelector("#modelSelect").value;
  const transcriptText = rawTranscript.value.trim();

  if (!transcriptText) {
    showToast("请先放入 transcript");
    return;
  }

  updatePipeline("analyzing");
  deepseekButton.disabled = true;
  deepseekButton.textContent = "分析中";

  try {
    const response = await fetch("/api/analyze", {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        apiKey,
        model,
        messages: [
          {
            role: "system",
            content: "你是一个播客知识管理助手，擅长把 transcript 整理成严谨、可复盘、适合 Obsidian 的中文 Markdown。"
          },
          {
            role: "user",
            content: buildDeepSeekPrompt()
          }
        ]
      })
    });

    if (!response.ok) {
      const errorText = await response.text();
      if (response.status === 400 && errorText.includes("DeepSeek API Key")) {
        generateNote();
        showToast("没有 API Key，已先用本地规则整理");
        return;
      }
      throw new Error(errorText || `HTTP ${response.status}`);
    }

    const data = await response.json();
    const markdown = data.choices?.[0]?.message?.content?.trim();
    if (!markdown) throw new Error("DeepSeek 没有返回可用内容");

    noteOutput.value = markdown;
    updatePipeline("ai");
    showToast("DeepSeek 已生成笔记");
  } catch (error) {
    updatePipeline("error");
    showToast("DeepSeek 请求失败，已保留本地笔记");
    console.error(error);
  } finally {
    deepseekButton.disabled = false;
    deepseekButton.textContent = "DeepSeek 分析";
  }
}

async function exportToObsidian() {
  downloadMarkdown();
  updatePipeline("exported");
  showToast("已生成 Markdown 文件");
}

function downloadMarkdown() {
  const blob = new Blob([noteOutput.value], { type: "text/markdown;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = `${activeEpisode.title}.md`;
  link.click();
  URL.revokeObjectURL(url);
}

async function handleOpmlImport(event) {
  const file = event.target.files?.[0];
  if (!file) return;
  const text = await file.text();
  const doc = new DOMParser().parseFromString(text, "text/xml");
  const feeds = [...doc.querySelectorAll("outline[xmlUrl]")].map((node) => node.getAttribute("xmlUrl"));
  if (!feeds.length) {
    showToast("没有识别到 RSS 源");
    return;
  }
  localStorage.setItem("podnote-opml-feeds", JSON.stringify(feeds));
  document.querySelector("#rssInput").value = feeds[0];
  showToast(`已识别 ${feeds.length} 个 RSS 源，正在导入第一个`);
  await loadRssFeed(feeds[0]);
}

async function loadRssFeed(feedUrl = document.querySelector("#rssInput").value.trim()) {
  if (!feedUrl) {
    showToast("请先粘贴播客链接");
    return;
  }

  const importButton = document.querySelector("#importButton");
  importButton.disabled = true;
  importButton.textContent = "解析中";

  try {
    const response = await fetch(`/api/rss?url=${encodeURIComponent(feedUrl)}`);
    const data = await response.json();
    if (!response.ok) throw new Error(data.error || "链接解析失败");

    const parsed = parsePodcastFeed(data.xml, data.url || feedUrl);
    if (!parsed.episodes.length) throw new Error("没有在 RSS 中找到可播放单集");

    episodes = parsed.episodes;
    activeEpisode = findEpisodeFromSource(episodes, feedUrl, data.sourceUrl) || episodes[0];
    document.querySelector("#rssInput").value = feedUrl;
    renderEpisode();
    document.querySelector("#stepSource").classList.add("done");
    showToast(`${data.discovered ? "已从网页找到 RSS，" : ""}已导入 ${parsed.episodes.length} 集：${parsed.showTitle}`);
  } catch (error) {
    console.error(error);
    showToast(error.message || "链接解析失败");
  } finally {
    importButton.disabled = false;
    importButton.textContent = "解析链接";
  }
}

function parsePodcastFeed(xml, sourceUrl) {
  const doc = new DOMParser().parseFromString(xml, "application/xml");
  if (doc.querySelector("parsererror")) {
    throw new Error("RSS XML 解析失败");
  }

  const channel = doc.querySelector("channel") || doc.querySelector("feed") || doc.documentElement;
  const showTitle = readFirstText(channel, ["title"]) || "未命名播客";
  const showImage = readImage(channel);
  const itemNodes = [...doc.querySelectorAll("item")];
  const entryNodes = itemNodes.length ? itemNodes : [...doc.querySelectorAll("entry")];

  const parsedEpisodes = entryNodes
    .map((item, index) => {
      const title = readFirstText(item, ["title"]) || `未命名单集 ${index + 1}`;
      const desc = stripHtml(readFirstText(item, ["description", "summary", "content:encoded", "content"])) || "这集还没有简介。";
      const audioUrl = readAudioUrl(item);
      const duration = normalizeDuration(readFirstText(item, ["itunes:duration", "duration"]));
      const image = readImage(item) || showImage;
      const pubDate = readFirstText(item, ["pubDate", "published", "updated"]);
      const webUrl = readEpisodePageUrl(item);

      return {
        id: `rss-${hashString(`${sourceUrl}-${webUrl || title}-${index}`)}`,
        show: showTitle,
        title,
        desc,
        duration,
        progress: 0,
        color: colorForIndex(index),
        image,
        audioUrl,
        pubDate,
        webUrl,
        sourceUrl,
        hasTranscript: false,
        rawTranscript: "",
        chapters: [["00:00", "节目简介", desc.slice(0, 140)]],
        transcript: [["00:00", "这集已经从 RSS 导入。请粘贴 transcript，或接入转写后再整理笔记。", ""]]
      };
    })
    .filter((episode) => episode.audioUrl);

  return { showTitle, episodes: parsedEpisodes };
}

function findEpisodeFromSource(items, inputUrl, sourceUrl = "") {
  const targets = [inputUrl, sourceUrl].map(normalizeUrlForCompare).filter(Boolean);
  if (!targets.length) return null;
  return items.find((episode) => targets.includes(normalizeUrlForCompare(episode.webUrl))) || null;
}

function normalizeUrlForCompare(value) {
  if (!value) return "";
  try {
    const url = new URL(value);
    url.hash = "";
    return url.href.replace(/\/$/, "");
  } catch {
    return String(value).trim().replace(/\/$/, "");
  }
}

function readFirstText(node, tagNames) {
  for (const tagName of tagNames) {
    const element = node.getElementsByTagName(tagName)[0];
    const text = element?.textContent?.trim();
    if (text) return text;
  }
  return "";
}

function readImage(node) {
  const itunesImage = node.getElementsByTagName("itunes:image")[0]?.getAttribute("href");
  if (itunesImage) return itunesImage;

  const imageNode = node.getElementsByTagName("image")[0];
  const imageUrl = imageNode?.getElementsByTagName("url")[0]?.textContent?.trim();
  if (imageUrl) return imageUrl;

  return "";
}

function readAudioUrl(item) {
  const enclosure = item.querySelector("enclosure[url]");
  if (enclosure?.getAttribute("url")) return enclosure.getAttribute("url");

  const links = [...item.getElementsByTagName("link")];
  const audioLink = links.find((link) => {
    const type = link.getAttribute("type") || "";
    const rel = link.getAttribute("rel") || "";
    return rel === "enclosure" || type.startsWith("audio/");
  });

  return audioLink?.getAttribute("href") || audioLink?.textContent?.trim() || "";
}

function readEpisodePageUrl(item) {
  const links = [...item.getElementsByTagName("link")];
  const alternate = links.find((link) => {
    const href = link.getAttribute("href") || "";
    const rel = link.getAttribute("rel") || "";
    const type = link.getAttribute("type") || "";
    return href && (!rel || rel === "alternate") && (!type || type.includes("html"));
  });
  if (alternate?.getAttribute("href")) return alternate.getAttribute("href");

  const textLink = links.map((link) => link.textContent?.trim() || "").find((href) => /^https?:\/\//.test(href));
  if (textLink) return textLink;

  const guid = readFirstText(item, ["guid", "id"]);
  return /^https?:\/\//.test(guid) ? guid : "";
}

function stripHtml(value) {
  const html = new DOMParser().parseFromString(value || "", "text/html");
  return html.body.textContent.trim();
}

function normalizeDuration(value) {
  const seconds = parseTimeToSeconds(String(value || "").trim());
  return seconds ? secondsToTimestamp(seconds) : "未知时长";
}

function colorForIndex(index) {
  const palette = [
    ["#111111", "#4b4b50", "#d8d8dc"],
    ["#202024", "#6e6e73", "#f5f5f7"],
    ["#000000", "#3a3a3c", "#a1a1a6"],
    ["#2c2c2e", "#8e8e93", "#ffffff"]
  ];
  return palette[index % palette.length];
}

function hashString(value) {
  let hash = 0;
  for (let index = 0; index < value.length; index += 1) {
    hash = (hash << 5) - hash + value.charCodeAt(index);
    hash |= 0;
  }
  return Math.abs(hash).toString(36);
}

episodeList.addEventListener("click", (event) => {
  const card = event.target.closest(".episode-card");
  if (!card) return;
  activeEpisode = episodes.find((episode) => episode.id === card.dataset.id);
  renderEpisode();
});

document.querySelector("#searchInput").addEventListener("input", (event) => {
  const keyword = event.target.value.trim().toLowerCase();
  const filtered = episodes.filter((episode) => `${episode.title} ${episode.show} ${episode.desc}`.toLowerCase().includes(keyword));
  renderEpisodes(filtered);
});

document.querySelector("#playButton").addEventListener("click", () => {
  if (activeEpisode.audioUrl) {
    if (audioPlayer.paused) {
      audioPlayer.play().catch((error) => {
        console.error(error);
        showToast("音频播放失败");
      });
    } else {
      audioPlayer.pause();
    }
    return;
  }

  isPlaying = !isPlaying;
  document.querySelector("#playButton").textContent = isPlaying ? "暂停" : "播放";
});

document.querySelector("#speedButton").addEventListener("click", () => {
  const speeds = [1, 1.25, 1.5, 2];
  currentSpeed = speeds[(speeds.indexOf(currentSpeed) + 1) % speeds.length];
  document.querySelector("#speedButton").textContent = `${currentSpeed}x`;
  audioPlayer.playbackRate = currentSpeed;
});

document.querySelector("#progress").addEventListener("input", (event) => {
  const progress = Number(event.target.value);
  activeEpisode.progress = progress;

  if (activeEpisode.audioUrl && Number.isFinite(audioPlayer.duration)) {
    audioPlayer.currentTime = (audioPlayer.duration * progress) / 100;
    return;
  }

  document.querySelector("#currentTime").textContent = progressToTime(progress, activeEpisode.duration);
});

document.querySelector("#translateButton").addEventListener("click", () => {
  bilingual = !bilingual;
  document.querySelector("#translateButton").textContent = bilingual ? "只看中文" : "中英对照";
  renderEpisode();
});

document.querySelector("#regenerateButton").addEventListener("click", () => {
  generateNote();
  showToast("已根据 transcript 重新整理");
});

document.querySelector("#templateSelect").addEventListener("change", generateNote);
document.querySelector("#tagInput").addEventListener("input", generateNote);
rawTranscript.addEventListener("input", () => {
  activeEpisode.rawTranscript = rawTranscript.value;
  generateNote();
});

document.querySelector("#saveSettingsButton").addEventListener("click", saveSettings);
document.querySelector("#opmlInput").addEventListener("change", handleOpmlImport);
deepseekButton.addEventListener("click", analyzeWithDeepSeek);

document.querySelector("#copyButton").addEventListener("click", async () => {
  await navigator.clipboard.writeText(noteOutput.value);
  showToast("Markdown 已复制");
});

document.querySelector("#downloadButton").addEventListener("click", () => {
  downloadMarkdown();
  showToast("已生成 Markdown 文件");
});

document.querySelector("#exportButton").addEventListener("click", exportToObsidian);

document.querySelector("#importButton").addEventListener("click", () => loadRssFeed());
document.querySelector("#rssInput").addEventListener("keydown", (event) => {
  if (event.key !== "Enter") return;
  event.preventDefault();
  loadRssFeed();
});

document.querySelector("#backButton").addEventListener("click", () => {
  if (activeEpisode.audioUrl) {
    audioPlayer.currentTime = Math.max(0, audioPlayer.currentTime - 15);
  }
  showToast("已后退 15 秒");
});

document.querySelector("#forwardButton").addEventListener("click", () => {
  if (activeEpisode.audioUrl && Number.isFinite(audioPlayer.duration)) {
    audioPlayer.currentTime = Math.min(audioPlayer.duration, audioPlayer.currentTime + 30);
  }
  showToast("已前进 30 秒");
});

transcriptEl.addEventListener("click", (event) => {
  const line = event.target.closest(".line");
  if (!line) return;
  document.querySelectorAll(".line").forEach((item) => item.classList.remove("active"));
  line.classList.add("active");
  if (activeEpisode.audioUrl) {
    audioPlayer.currentTime = parseTimeToSeconds(line.dataset.time);
  }
  showToast(`已跳转到 ${line.dataset.time}`);
});

audioPlayer.addEventListener("loadedmetadata", () => {
  document.querySelector("#duration").textContent = secondsToTimestamp(audioPlayer.duration);
  audioStatus.textContent = "音频已加载";
});

audioPlayer.addEventListener("timeupdate", () => {
  if (!activeEpisode.audioUrl || !Number.isFinite(audioPlayer.duration) || !audioPlayer.duration) return;
  const progress = (audioPlayer.currentTime / audioPlayer.duration) * 100;
  activeEpisode.progress = progress;
  document.querySelector("#progress").value = progress;
  document.querySelector("#currentTime").textContent = secondsToTimestamp(audioPlayer.currentTime);
});

audioPlayer.addEventListener("play", () => {
  isPlaying = true;
  document.querySelector("#playButton").textContent = "暂停";
  audioStatus.textContent = "正在播放真实音频";
});

audioPlayer.addEventListener("pause", () => {
  isPlaying = false;
  document.querySelector("#playButton").textContent = "播放";
  if (activeEpisode.audioUrl) audioStatus.textContent = "已暂停";
});

audioPlayer.addEventListener("ended", () => {
  isPlaying = false;
  document.querySelector("#playButton").textContent = "播放";
  audioStatus.textContent = "播放完成";
});

audioPlayer.addEventListener("error", () => {
  audioStatus.textContent = "音频加载失败";
  showToast("音频加载失败");
});

loadSettings();
const initialRss = new URLSearchParams(window.location.search).get("rss");
if (initialRss) {
  document.querySelector("#rssInput").value = initialRss;
  renderEpisode();
  loadRssFeed(initialRss);
} else {
  renderEpisode();
}
