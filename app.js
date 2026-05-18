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
let pendingTranscribeConfirmation = false;
let pendingTranscribeTimer = 0;
const maxTranscribeBytes = 25 * 1024 * 1024;
const openAiTranscribeCostPerMinuteUsd = 0.003;
const deepgramTranscribeCostPerMinuteUsd = 0.0043;
const dailyTranscribeLimitMinutes = 300;
const transcriptCachePrefix = "podnote-transcript-cache-v4:";
const transcribeUsageKey = "podnote-transcribe-usage";

const episodeList = document.querySelector("#episodeList");
const transcriptEl = document.querySelector("#transcript");
const chaptersEl = document.querySelector("#chapters");
const rawTranscript = document.querySelector("#rawTranscript");
const noteOutput = document.querySelector("#noteOutput");
const markdownStatus = document.querySelector("#markdownStatus");
const copyButton = document.querySelector("#copyButton");
const downloadButton = document.querySelector("#downloadButton");
const exportButton = document.querySelector("#exportButton");
const toast = document.querySelector("#toast");
const analysisStatus = document.querySelector("#analysisStatus");
const deepseekButton = document.querySelector("#deepseekButton");
const fetchTranscriptButton = document.querySelector("#fetchTranscriptButton");
const generateTranscriptButton = document.querySelector("#generateTranscriptButton");
const downloadTranscriptButton = document.querySelector("#downloadTranscriptButton");
const transcriptStatus = document.querySelector("#transcriptStatus");
const audioPlayer = document.querySelector("#audioPlayer");
const audioStatus = document.querySelector("#audioStatus");
const captionTime = document.querySelector("#captionTime");
const captionText = document.querySelector("#captionText");
let activeTranscriptIndex = -1;

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

  rawTranscript.value = getEpisodeTranscriptText(activeEpisode);
  renderTranscriptPreview();
  updateTranscriptStatus();
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
  restoreEpisodeMarkdown();
  renderEpisodes();
}

function restoreEpisodeMarkdown() {
  const markdown = activeEpisode.markdown || "";
  noteOutput.value = markdown;
  noteOutput.readOnly = !markdown.trim();
  updateMarkdownControls();
  updatePipeline(markdown.trim() ? activeEpisode.markdownState || "ai" : "idle");
}

function setMarkdownOutput(markdown, state = "ai") {
  activeEpisode.markdown = markdown;
  activeEpisode.markdownState = state;
  noteOutput.value = markdown;
  noteOutput.readOnly = false;
  updateMarkdownControls();
  updatePipeline(state);
}

function clearMarkdownOutput(message = "") {
  activeEpisode.markdown = "";
  activeEpisode.markdownState = "idle";
  noteOutput.value = "";
  noteOutput.readOnly = true;
  updateMarkdownControls(message);
  updatePipeline("idle");
}

function updateMarkdownControls(message = "") {
  const hasMarkdown = Boolean(noteOutput.value.trim());
  noteOutput.classList.toggle("empty", !hasMarkdown);
  noteOutput.readOnly = !hasMarkdown;
  copyButton.disabled = !hasMarkdown;
  downloadButton.disabled = !hasMarkdown;
  exportButton.disabled = !hasMarkdown;

  if (message) {
    markdownStatus.textContent = message;
    return;
  }

  markdownStatus.textContent = hasMarkdown
    ? "DeepSeek 已生成 Markdown，可以复制或下载。"
    : "Transcript 准备好后，点击 DeepSeek 分析，这里才会生成可下载的 Obsidian Markdown。";
}

function getEpisodeTranscriptText(episode) {
  if (typeof episode.rawTranscript === "string") return episode.rawTranscript;
  if (episode.hasTranscript === false) return "";
  return (episode.transcript || []).map(([time, line]) => `[${time}] ${line}`).join("\n");
}

function renderTranscriptPreview() {
  const transcriptRows = activeEpisode.transcript?.length ? activeEpisode.transcript : [["00:00", "请先粘贴 transcript，或点击自动查找公开文字稿。", ""]];
  transcriptEl.innerHTML = transcriptRows
    .map(
      ([time, line, english], index) => `
        <button class="line" type="button" data-time="${time}" data-index="${index}">
          <time>${time}</time>
          <p>${line}${bilingual && english ? `<small>${english}</small>` : ""}</p>
        </button>
      `
    )
    .join("");
  syncTranscriptWithAudio(activeEpisode.audioUrl ? audioPlayer.currentTime : parseTimeToSeconds(transcriptRows[0]?.[0]), {
    force: true,
    scroll: false
  });
}

function updateTranscriptStatus(message = "") {
  const hasText = Boolean(rawTranscript.value.trim());
  document.querySelector("#stepTranscript").classList.toggle("done", hasText);

  if (message) {
    transcriptStatus.textContent = message;
    return;
  }

  if (hasText) {
    const lineCount = rawTranscript.value.split("\n").filter(Boolean).length;
    transcriptStatus.textContent = `已载入 transcript，共 ${lineCount} 行。`;
    return;
  }

  const provider = transcribeProviderForEpisode(activeEpisode);
  const estimate = estimateTranscriptionCost(activeEpisode.duration, provider);
  const cached = loadCachedTranscript(activeEpisode);
  const cacheText = cached ? " 本地已有 transcript 缓存，点击生成会直接载入。" : "";
  const providerText = provider === "deepgram" ? "长音频会走 Deepgram URL 转写。" : "短音频会走 OpenAI 转写。";
  const costText = estimate ? ` ${providerText} 预计约 $${estimate}。` : ` ${providerText}`;
  transcriptStatus.textContent = activeEpisode.transcriptStatus || `这期还没有 transcript。可以先自动查找公开文字稿；没有的话再生成。${costText}`;
  if (cacheText) transcriptStatus.textContent += cacheText;
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
    updatePlayerCaption("00:00", "等待字幕");
    return;
  }

  audioPlayer.src = episode.audioUrl;
  audioPlayer.playbackRate = currentSpeed;
  audioPlayer.load();
  audioStatus.textContent = "真实音频已连接，点击播放开始收听";
  syncTranscriptWithAudio(parseTimeToSeconds(activeEpisode.transcript?.[0]?.[0]), { force: true, scroll: false });
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

function estimateTranscriptionCost(duration, provider = "openai") {
  const seconds = parseTimeToSeconds(duration);
  if (!seconds) return "";
  const rate = provider === "deepgram" ? deepgramTranscribeCostPerMinuteUsd : openAiTranscribeCostPerMinuteUsd;
  return ((seconds / 60) * rate).toFixed(2);
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
  analyzeStep.classList.toggle("done", state === "ai" || state === "exported");
  exportStep.classList.toggle("done", state === "exported");

  const labels = {
    idle: "等待 DeepSeek",
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
  const generatedAt = new Date().toLocaleString("zh-CN");
  const transcriptSource = activeEpisode.transcriptSource || "manual";
  const episodeUrl = activeEpisode.webUrl || activeEpisode.sourceUrl || "";
  const audioUrl = activeEpisode.audioUrl || "";
  const pubDate = activeEpisode.pubDate || "";

  return `你是一个严谨的播客知识管理助手，目标是把一整期播客 transcript 整理成适合 Obsidian 知识库长期保存的 Markdown 笔记。

你必须遵守：
1. 只能基于 transcript 和节目元信息整理，不要编造没有出现的事实。
2. 如果 transcript 有断句、口语、重复、明显转写空格问题，请在不改变原意的前提下整理为清晰中文。
3. 输出必须是完整 Markdown，不要解释你的处理过程。
4. 必须使用 Obsidian 友好的格式：YAML frontmatter、[[双向链接]]、标签、标题层级、引用块、任务列表。
5. 双向链接要克制但有价值，只给重要概念、人物、书籍、理论、事件、地点、机构、方法论加 [[链接]]。
6. 每个重要观点尽量保留时间戳，方便回听。
7. 如果 transcript 信息不足，请写“transcript 中未明确说明”，不要猜。

整理偏好：
- 模板偏好：${template}
- 标签：${tags}
- 输出语言：${language}

节目元信息：
- 节目名称：${activeEpisode.show}
- 单集标题：${activeEpisode.title}
- 发布时间：${pubDate || "transcript 中未明确说明"}
- 时长：${activeEpisode.duration || "未知时长"}
- 单集链接：${episodeUrl || "transcript 中未明确说明"}
- 音频链接：${audioUrl || "transcript 中未明确说明"}
- 转写来源：${transcriptSource}
- 整理日期：${generatedAt}

请严格按以下结构输出：

---
type: podcast-note
show: "${frontmatterEscape(activeEpisode.show)}"
episode: "${frontmatterEscape(activeEpisode.title)}"
date: "${frontmatterEscape(pubDate)}"
duration: "${frontmatterEscape(activeEpisode.duration || "未知时长")}"
source: "${frontmatterEscape(episodeUrl)}"
audio: "${frontmatterEscape(audioUrl)}"
transcript_source: "${frontmatterEscape(transcriptSource)}"
status: processed
tags:
  - podcast
  - podnote
---

# ${activeEpisode.title}

> [!info] 节目信息
> - 播客：[[${activeEpisode.show}]]
> - 单集：${activeEpisode.title}
> - 时长：${activeEpisode.duration || "未知时长"}
> - 链接：${episodeUrl || "transcript 中未明确说明"}
> - 整理日期：${generatedAt}

## 一句话总结

用 1-2 句话说明这一集最核心的讨论对象、问题意识和结论。不要写泛泛而谈的宣传语。

## 这集在讲什么

用 3-5 段自然语言概括这一集的主线。要求说明讨论从哪里开始，如何展开，最后落到哪里。不要只罗列点，要写出逻辑关系。如果有争议、反方观点、历史背景或案例，要指出来。

## Topic Map

用 Markdown 表格列出这一集的主要 topic。

| Topic | 这一部分在讨论什么 | 相关概念 | 时间戳 |
| --- | --- | --- | --- |

要求：
- Topic 应该是语义主题，不是机械章节名。
- 相关概念使用 Obsidian 双链，例如 [[启蒙运动]]、[[公共空间]]。
- 时间戳用 transcript 中出现的时间。

## 核心观点

整理 5-10 条最重要的观点。每条使用以下格式：

### 观点标题

- 时间戳：\`[xx:xx]\`
- 核心意思：
- 为什么重要：
- 相关概念：[[概念A]]、[[概念B]]
- 可以继续追问：

## 关键概念与知识点

列出本集出现的关键概念、人物、书籍、理论、历史事件、机构或方法论。每条使用以下格式：

### [[概念名]]

- 出现场景：
- 在本集中的含义：
- 与哪些概念相关：[[概念A]]、[[概念B]]
- 我可以如何理解它：

如果 transcript 中只是提到名字但没有解释，请标注“transcript 中未展开”。

## 人物 / 书籍 / 作品 / 事件

如果 transcript 中出现人物、书籍、电影、理论、历史事件、地点、机构，请整理成表格。

| 类型 | 名称 | 本集如何提到 | 可链接笔记 |
| --- | --- | --- | --- |

可链接笔记一列使用 [[名称]]。

## 值得摘录的原话

选择 5-8 条值得保存的原话或近似原话。每条必须带时间戳。不要选空泛句子，优先选择有判断、有洞察、有概念密度的表达。

格式：

> [xx:xx] 原话内容

## 我的认知增量

请从“扩展认知边界”的角度，提炼这集对听众可能有价值的新视角。

### 我以前可能忽略了什么

### 这一集提供了什么新框架

### 它改变了我对什么问题的理解

### 值得继续研究的问题

## 可沉淀为 Obsidian 原子笔记

请生成 5-10 条可以单独成为 Obsidian 笔记的原子笔记标题。

格式：

- [[原子笔记标题]]：一句话说明这条笔记应该写什么。

要求：
- 标题要像知识卡片，不要像章节标题。
- 尽量使用判断句或概念句。
- 不要太宽泛。

## 行动项 / 后续阅读

如果 transcript 中有明确提到可以阅读、搜索、观看、实践的内容，请列出任务。

格式：

- [ ] 阅读 / 搜索 / 了解 [[主题]]
- [ ] 回听 \`[xx:xx]\` 附近关于某问题的讨论

如果没有明确行动项，请写“本集没有明确行动项”。

## 标签建议

给出 5-10 个适合 Obsidian 的标签。

格式：
#播客 #知识管理 #历史 #商业 #人物研究

## Transcript 索引

按照主题整理时间线，不要逐字复制全文。

格式：

- \`[00:00]\` 主题 A：这一段主要讲什么
- \`[12:30]\` 主题 B：这一段主要讲什么
- \`[35:10]\` 主题 C：这一段主要讲什么

Transcript:
${transcriptText}`;
}

function frontmatterEscape(value) {
  return String(value || "")
    .replaceAll("\\", "\\\\")
    .replaceAll('"', '\\"')
    .replace(/\r?\n/g, " ");
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
            content:
              "你是一个严谨的 Obsidian 播客知识库编辑器。你擅长把长 transcript 整理成可复盘、可链接、可长期保存的中文 Markdown 知识笔记。只输出 Markdown，不要解释过程，不要编造 transcript 中没有的信息。"
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
        updatePipeline("error");
        showToast("缺少 DeepSeek API Key");
        return;
      }
      throw new Error(errorText || `HTTP ${response.status}`);
    }

    const data = await response.json();
    const markdown = data.choices?.[0]?.message?.content?.trim();
    if (!markdown) throw new Error("DeepSeek 没有返回可用内容");

    setMarkdownOutput(markdown, "ai");
    showToast("DeepSeek 已生成笔记");
  } catch (error) {
    updatePipeline("error");
    showToast("DeepSeek 请求失败，Markdown 未更新");
    console.error(error);
  } finally {
    deepseekButton.disabled = false;
    deepseekButton.textContent = "DeepSeek 分析";
  }
}

async function fetchTranscriptForActiveEpisode() {
  if (!activeEpisode.audioUrl && !activeEpisode.webUrl && !activeEpisode.sourceUrl && !activeEpisode.transcriptUrl) {
    showToast("请先导入一集播客");
    return;
  }

  fetchTranscriptButton.disabled = true;
  fetchTranscriptButton.textContent = "查找中";
  updateTranscriptStatus("正在查找 RSS 或网页里的公开 transcript...");

  try {
    const params = new URLSearchParams();
    appendParam(params, "feedUrl", activeEpisode.sourceUrl);
    appendParam(params, "episodeUrl", activeEpisode.webUrl);
    appendParam(params, "audioUrl", activeEpisode.audioUrl);
    appendParam(params, "transcriptUrl", activeEpisode.transcriptUrl);
    appendParam(params, "title", activeEpisode.title);

    const response = await fetch(`/api/transcript?${params.toString()}`);
    const data = await response.json();
    if (!response.ok || !data.transcript) {
      throw new Error(data.message || data.error || "没有找到公开 transcript");
    }

    applyTranscript(data.transcript, data);
    showToast("已找到并载入 transcript");
  } catch (error) {
    const message = error.message || "没有找到公开 transcript";
    activeEpisode.transcriptStatus = `${message} 后续可以接入语音转写服务自动生成。`;
    updateTranscriptStatus(activeEpisode.transcriptStatus);
    showToast("没有找到公开 transcript");
  } finally {
    fetchTranscriptButton.disabled = false;
    fetchTranscriptButton.textContent = "自动查找";
  }
}

async function generateTranscriptForActiveEpisode() {
  if (!activeEpisode.audioUrl) {
    showToast("这集没有可转写的音频地址");
    return;
  }

  const cached = loadCachedTranscript(activeEpisode);
  if (cached?.transcript) {
    applyTranscript(cached.transcript, {
      sourceType: cached.sourceType || "cache-transcript",
      provider: cached.provider || "cache"
    });
    showToast("已从本地缓存载入 transcript");
    return;
  }

  const provider = transcribeProviderForEpisode(activeEpisode);
  const durationMinutes = Math.ceil(parseTimeToSeconds(activeEpisode.duration) / 60);
  if (wouldExceedDailyTranscribeLimit(durationMinutes)) {
    const used = getTodayTranscribeUsage().minutes;
    const message = `今天已转写约 ${used} 分钟，默认上限 ${dailyTranscribeLimitMinutes} 分钟。为了控制成本，今天先暂停生成。`;
    updateTranscriptStatus(message);
    showToast("已达到今日转写保护额度");
    return;
  }

  const estimate = estimateTranscriptionCost(activeEpisode.duration, provider);
  const providerName = transcribeProviderName(provider);
  const costText = estimate ? `预计费用约 $${estimate}。` : "会产生转写费用。";
  if (!pendingTranscribeConfirmation) {
    pendingTranscribeConfirmation = true;
    generateTranscriptButton.textContent = estimate ? `确认生成 $${estimate}` : "确认生成";
    const sizeText = activeEpisode.audioBytes ? `音频约 ${formatBytes(activeEpisode.audioBytes)}。` : "";
    updateTranscriptStatus(`将调用 ${providerName} 生成 transcript，${sizeText}${costText} 再次点击确认。`);
    showToast("再次点击确认生成 transcript");
    window.clearTimeout(pendingTranscribeTimer);
    pendingTranscribeTimer = window.setTimeout(resetTranscribeConfirmation, 9000);
    return;
  }

  resetTranscribeConfirmation();

  generateTranscriptButton.disabled = true;
  generateTranscriptButton.textContent = "生成中";
  updateTranscriptStatus(`正在调用 ${providerName} 转写，可能需要几十秒到几分钟...`);

  try {
    const response = await fetch("/api/transcribe", {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        audioUrl: activeEpisode.audioUrl,
        audioBytes: activeEpisode.audioBytes,
        title: activeEpisode.title,
        duration: activeEpisode.duration,
        provider,
        model: "gpt-4o-mini-transcribe",
        deepgramModel: "nova-3",
        language: "zh"
      })
    });

    const data = await response.json();
    if (!response.ok || !data.transcript) {
      throw new Error(data.error || "音频转写失败");
    }

    saveCachedTranscript(activeEpisode, data);
    recordTranscribeUsage(durationMinutes, data.provider || provider);
    applyTranscript(data.transcript, data);
    showToast("已生成 transcript");
  } catch (error) {
    const message = error.message || "音频转写失败";
    activeEpisode.transcriptStatus = message;
    updateTranscriptStatus(message);
    showToast(message);
  } finally {
    generateTranscriptButton.disabled = false;
    generateTranscriptButton.textContent = "生成 transcript";
  }
}

function resetTranscribeConfirmation() {
  pendingTranscribeConfirmation = false;
  window.clearTimeout(pendingTranscribeTimer);
  if (!generateTranscriptButton.disabled) {
    generateTranscriptButton.textContent = "生成 transcript";
  }
}

function appendParam(params, key, value) {
  if (value) params.set(key, value);
}

function applyTranscript(text, source) {
  activeEpisode.rawTranscript = text;
  activeEpisode.hasTranscript = true;
  activeEpisode.transcript = transcriptTextToRows(text);
  activeEpisode.transcriptSource = source.url || source.sourceType || "public-transcript";
  rawTranscript.value = text;
  renderTranscriptPreview();
  updateTranscriptStatus(`已从${transcriptSourceLabel(source.sourceType)}载入 transcript。`);
  clearMarkdownOutput("Transcript 已准备好。点击 DeepSeek 分析后，这里会生成 Markdown。");
}

function transcriptSourceLabel(sourceType = "") {
  const labels = {
    "provided-transcript": " RSS 文字稿",
    "rss-transcript": " RSS 文字稿",
    "rss-inline-transcript": " RSS 内嵌文字稿",
    "episode-page": "单集网页",
    "episode-page-link": "单集网页链接",
    "openai-transcribe": " OpenAI 转写",
    "deepgram-transcribe": " Deepgram 转写",
    "cache-transcript": "本地缓存"
  };
  return labels[sourceType] || "公开来源";
}

function transcriptTextToRows(text) {
  const lines = String(text || "")
    .replace(/\s*(?=\[\d{1,2}:\d{2}(?::\d{2})?\])/g, "\n")
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean);

  if (!lines.length) {
    return [["00:00", "请先粘贴 transcript，或点击自动查找公开文字稿。", ""]];
  }

  return lines.slice(0, 1200).map((line) => {
    const match = line.match(/^\[?(\d{1,2}:\d{2}(?::\d{2})?)\]?\s*(.*)$/);
    if (match) return [match[1], match[2] || line, ""];
    return ["00:00", line, ""];
  });
}

function syncTranscriptWithAudio(currentSeconds, options = {}) {
  const rows = activeEpisode.transcript || [];
  if (!rows.length) return;

  const currentIndex = findTranscriptIndexAtTime(rows, currentSeconds);
  if (currentIndex < 0) return;
  if (!options.force && currentIndex === activeTranscriptIndex) return;

  activeTranscriptIndex = currentIndex;
  const activeLine = transcriptEl.querySelector(`.line[data-index="${currentIndex}"]`);
  if (!activeLine) return;

  updatePlayerCaption(rows[currentIndex][0], rows[currentIndex][1]);
  transcriptEl.querySelectorAll(".line.active").forEach((line) => line.classList.remove("active"));
  activeLine.classList.add("active");

  if (options.scroll !== false) {
    scrollTranscriptLineIntoView(activeLine);
  }
}

function updatePlayerCaption(time, text) {
  captionTime.textContent = time || "00:00";
  captionText.textContent = text || "等待字幕";
}

function scrollTranscriptLineIntoView(line) {
  const lineTop = line.offsetTop;
  const targetTop = lineTop - transcriptEl.clientHeight / 2 + line.clientHeight / 2;
  transcriptEl.scrollTo({
    top: Math.max(0, targetTop),
    behavior: "smooth"
  });
}

function findTranscriptIndexAtTime(rows, currentSeconds) {
  const current = Number(currentSeconds || 0);
  let index = 0;

  for (let rowIndex = 0; rowIndex < rows.length; rowIndex += 1) {
    const seconds = parseTimeToSeconds(rows[rowIndex][0]);
    if (seconds <= current + 0.25) {
      index = rowIndex;
    } else {
      break;
    }
  }

  return index;
}

async function exportToObsidian() {
  if (!noteOutput.value.trim()) {
    showToast("请先点击 DeepSeek 分析生成 Markdown");
    return;
  }

  if (!downloadMarkdown()) return;
  updatePipeline("exported");
  showToast("已生成 Markdown 文件");
}

function downloadMarkdown() {
  const markdown = noteOutput.value.trim();
  if (!markdown) {
    showToast("请先点击 DeepSeek 分析生成 Markdown");
    return false;
  }

  const blob = new Blob([noteOutput.value], { type: "text/markdown;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = `${activeEpisode.title}.md`;
  link.click();
  URL.revokeObjectURL(url);
  return true;
}

function downloadTranscript() {
  const transcriptText = rawTranscript.value.trim() || getEpisodeTranscriptText(activeEpisode);
  if (!transcriptText.trim()) {
    showToast("还没有 transcript 可下载");
    return;
  }

  const header = `# ${activeEpisode.title}\n\n节目：${activeEpisode.show}\n导出时间：${new Date().toLocaleString()}\n\n`;
  const blob = new Blob([`${header}${transcriptText}\n`], { type: "text/plain;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = `${sanitizeDownloadName(activeEpisode.title)} transcript.txt`;
  link.click();
  URL.revokeObjectURL(url);
}

function sanitizeDownloadName(value) {
  return String(value || "podcast")
    .replace(/[\\/:*?"<>|]/g, "-")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 80);
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
    if (!parsed.episodes.length) throw new Error("没有在这个链接中找到可播放单集");

    episodes = parsed.episodes;
    activeEpisode = findEpisodeFromSource(episodes, feedUrl, data.sourceUrl) || episodes[0];
    document.querySelector("#rssInput").value = feedUrl;
    renderEpisode();
    document.querySelector("#stepSource").classList.add("done");
    showToast(`${importSourceLabel(data)}已导入 ${parsed.episodes.length} 集：${parsed.showTitle}`);
  } catch (error) {
    console.error(error);
    showToast(error.message || "链接解析失败");
  } finally {
    importButton.disabled = false;
    importButton.textContent = "解析链接";
  }
}

function importSourceLabel(data = {}) {
  if (data.platform === "xiaoyuzhou") {
    const skipped = data.skippedCount ? `，跳过 ${data.skippedCount} 个付费或私密单集` : "";
    return `已从小宇宙公开页面导入${skipped}，`;
  }

  return data.discovered ? "已从网页找到 RSS，" : "";
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
      const audioBytes = readAudioBytes(item);
      const duration = normalizeDuration(readFirstText(item, ["itunes:duration", "duration"]));
      const image = readImage(item) || showImage;
      const pubDate = readFirstText(item, ["pubDate", "published", "updated"]);
      const webUrl = resolveUrl(readEpisodePageUrl(item), sourceUrl);
      const transcriptUrl = resolveUrl(readTranscriptUrl(item), sourceUrl);
      const chapters = readChaptersFromDescription(desc);

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
        audioBytes,
        pubDate,
        webUrl,
        transcriptUrl,
        sourceUrl,
        hasTranscript: false,
        rawTranscript: "",
        chapters: chapters.length ? chapters : [["00:00", "节目简介", desc.slice(0, 140)]],
        transcript: [["00:00", "这集已经导入。请粘贴 transcript，或生成转写后再整理笔记。", ""]]
      };
    })
    .filter((episode) => episode.audioUrl);

  return { showTitle, episodes: parsedEpisodes };
}

function isAudioOverTranscribeLimit(episode) {
  return Number(episode.audioBytes || 0) > maxTranscribeBytes;
}

function transcribeProviderForEpisode(episode) {
  return isAudioOverTranscribeLimit(episode) ? "deepgram" : "openai";
}

function transcribeProviderName(provider) {
  return provider === "deepgram" ? "Deepgram" : "OpenAI";
}

function formatBytes(bytes) {
  const value = Number(bytes || 0);
  if (!value) return "未知大小";
  return `${(value / 1024 / 1024).toFixed(1)}MB`;
}

function loadCachedTranscript(episode) {
  try {
    return JSON.parse(localStorage.getItem(transcriptCacheKey(episode)) || "null");
  } catch {
    return null;
  }
}

function saveCachedTranscript(episode, data) {
  if (!data?.transcript) return;
  const payload = {
    transcript: data.transcript,
    provider: data.provider || "",
    sourceType: data.sourceType || "cache-transcript",
    model: data.model || "",
    savedAt: new Date().toISOString()
  };

  try {
    localStorage.setItem(transcriptCacheKey(episode), JSON.stringify(payload));
  } catch {
    showToast("transcript 已生成，但本地缓存空间不足");
  }
}

function transcriptCacheKey(episode) {
  return `${transcriptCachePrefix}${hashString(`${episode.audioUrl || ""}-${episode.title || ""}-${episode.duration || ""}`)}`;
}

function getTodayTranscribeUsage() {
  const today = new Date().toISOString().slice(0, 10);
  try {
    const usage = JSON.parse(localStorage.getItem(transcribeUsageKey) || "{}");
    if (usage.date === today) return { date: today, minutes: Number(usage.minutes || 0) };
  } catch {
    // Reset malformed usage data.
  }

  return { date: today, minutes: 0 };
}

function wouldExceedDailyTranscribeLimit(minutes) {
  if (!minutes) return false;
  const usage = getTodayTranscribeUsage();
  return usage.minutes + minutes > dailyTranscribeLimitMinutes;
}

function recordTranscribeUsage(minutes, provider) {
  if (!minutes) return;
  const usage = getTodayTranscribeUsage();
  const nextUsage = {
    date: usage.date,
    minutes: usage.minutes + minutes,
    provider,
    updatedAt: new Date().toISOString()
  };
  try {
    localStorage.setItem(transcribeUsageKey, JSON.stringify(nextUsage));
  } catch {
    // Usage protection is best-effort in the browser.
  }
}

function readChaptersFromDescription(desc) {
  return String(desc || "")
    .split(/\r?\n/)
    .map((line) => line.trim())
    .map((line) => line.match(/^(?:[-–—*]\s*)?((?:\d{1,2}:)?\d{1,2}:\d{2})\s+(.+)$/))
    .filter(Boolean)
    .slice(0, 40)
    .map((match) => {
      const time = secondsToTimestamp(parseTimeToSeconds(match[1]));
      const title = match[2].replace(/^[-–—]\s*/, "").trim();
      return [time, title, title];
    });
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

function readAudioBytes(item) {
  const enclosure = item.querySelector("enclosure[url]");
  return Number(enclosure?.getAttribute("length") || 0);
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

function readTranscriptUrl(item) {
  const transcriptNode = [...item.getElementsByTagName("*")].find((element) => {
    const name = `${element.prefix ? `${element.prefix}:` : ""}${element.localName || element.tagName}`.toLowerCase();
    return name.endsWith("transcript") && (element.getAttribute("url") || element.getAttribute("href") || element.getAttribute("src"));
  });

  return transcriptNode?.getAttribute("url") || transcriptNode?.getAttribute("href") || transcriptNode?.getAttribute("src") || "";
}

function resolveUrl(value, baseUrl) {
  if (!value) return "";
  try {
    return new URL(value, baseUrl).href;
  } catch {
    return value;
  }
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

document.querySelector("#templateSelect").addEventListener("change", () => {
  clearMarkdownOutput("笔记模板已改变，请重新点击 DeepSeek 分析。");
});
document.querySelector("#tagInput").addEventListener("input", () => {
  clearMarkdownOutput("标签已改变，请重新点击 DeepSeek 分析。");
});
rawTranscript.addEventListener("input", () => {
  activeEpisode.rawTranscript = rawTranscript.value;
  activeEpisode.hasTranscript = Boolean(rawTranscript.value.trim());
  activeEpisode.transcript = transcriptTextToRows(rawTranscript.value);
  renderTranscriptPreview();
  updateTranscriptStatus();
  clearMarkdownOutput(
    rawTranscript.value.trim()
      ? "Transcript 已更新。点击 DeepSeek 分析后，这里会生成 Markdown。"
      : "Transcript 准备好后，点击 DeepSeek 分析，这里才会生成可下载的 Obsidian Markdown。"
  );
});

noteOutput.addEventListener("input", () => {
  activeEpisode.markdown = noteOutput.value;
  activeEpisode.markdownState = noteOutput.value.trim() ? activeEpisode.markdownState || "ai" : "idle";
  updateMarkdownControls();
  if (!noteOutput.value.trim()) updatePipeline("idle");
});

document.querySelector("#saveSettingsButton").addEventListener("click", saveSettings);
document.querySelector("#opmlInput").addEventListener("change", handleOpmlImport);
deepseekButton.addEventListener("click", analyzeWithDeepSeek);
fetchTranscriptButton.addEventListener("click", fetchTranscriptForActiveEpisode);
generateTranscriptButton.addEventListener("click", generateTranscriptForActiveEpisode);
downloadTranscriptButton.addEventListener("click", () => {
  downloadTranscript();
  showToast("已生成 transcript 文件");
});

copyButton.addEventListener("click", async () => {
  if (!noteOutput.value.trim()) {
    showToast("请先点击 DeepSeek 分析生成 Markdown");
    return;
  }
  await navigator.clipboard.writeText(noteOutput.value);
  showToast("Markdown 已复制");
});

downloadButton.addEventListener("click", () => {
  if (downloadMarkdown()) showToast("已生成 Markdown 文件");
});

exportButton.addEventListener("click", exportToObsidian);

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
  transcriptEl.querySelectorAll(".line").forEach((item) => item.classList.remove("active"));
  line.classList.add("active");
  activeTranscriptIndex = Number(line.dataset.index || 0);
  updatePlayerCaption(line.dataset.time, line.querySelector("p")?.textContent || "");
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
  syncTranscriptWithAudio(audioPlayer.currentTime);
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
