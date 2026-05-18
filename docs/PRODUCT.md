# PodNote Desktop 产品说明

版本：`0.14.0`  
更新日期：2026-05-18

## 产品定位

PodNote 是一个面向播客重度用户的知识整理工具。它把小宇宙/播客网页/RSS 导入、播放、transcript 和 AI Markdown 笔记放到一个简单流程里。

核心思路是：

```text
小宇宙、播客网页或 RSS
→ 获取 transcript
→ 基于 transcript 分析重点
→ 下载 Markdown 笔记
```

## 适合谁用

- 平时大量听播客，希望在电脑上整理内容的人。
- 希望把节目里的观点、知识点、原话摘录沉淀到 Obsidian 的人。
- 想用 DeepSeek 根据 transcript 自动生成播客笔记的人。
- 不想只看一句摘要，而是希望保留时间戳和原始语境的人。

## 当前功能

### 0. 访问密码

网站现在有一个临时访问密码页。未输入密码时，页面和 API 都不能直接访问。

默认密码：

```text
123456
```

后续可以通过环境变量 `PODNOTE_PASSWORD` 改成更强的密码。

### 1. 简化主流程

首页顶部就是主输入框，用户第一眼就能知道从哪里粘贴小宇宙、播客网页或 RSS 链接。

主流程被压缩成三步：

1. 粘贴小宇宙、播客网页或 RSS 链接并解析。
2. 自动查找公开 transcript；没有的话用 OpenAI 或 Deepgram 生成 transcript。
3. 下载 Markdown。

### 2. 视觉风格

当前界面采用更接近 Apple 桌面应用的简约风格：

- 白底、黑白灰主色调。
- 轻量毛玻璃面板。
- 克制的细边框和浅阴影。
- 更少装饰色，默认播客封面使用灰阶视觉。
- 顶部只保留一个主入口，减少设置项对初次使用的干扰。

### 3. 小宇宙 / 播客网页 / RSS 导入

页面顶部支持填写小宇宙公开节目页、小宇宙公开单集页、播客单集网页、节目主页或 RSS 地址，导入后会显示单集列表。

- 如果填写的是 RSS，会直接解析。
- 如果填写的是播客网页，会先自动寻找页面里的 RSS 链接。
- 如果填写的是小宇宙公开页面，会从页面公开数据里读取节目、单集、简介、封面、时间轴和公开音频。
- 付费或私密单集不会导入，也不会尝试绕过平台限制。
- 解析节目标题、单集标题、简介、封面、发布时间、时长和音频地址。
- 导入后可以选择单集并播放。
- 粘贴单集网页时，会尽量自动选中对应单集。

示例：

```text
https://podcast.latepost.com/164
https://www.xiaoyuzhoufm.com/podcast/5e4ee557418a84a0466737b7
```

### 4. Transcript-first 工作流

产品默认把 transcript 当作原始材料。中间有一个明确的 `Transcript` 输入区，可以自动查找公开文字稿，也可以手动粘贴节目转写文本。

生成笔记时，系统会基于这里的 transcript 来整理内容，而不是只根据节目标题或简介生成摘要。

### 5. 自动查找 transcript

点击 `自动查找` 后，PodNote 会按顺序检查：

- RSS 单集里的标准 `podcast:transcript` 标签。
- RSS 单集里的字幕 / 文字稿链接。
- 单集网页里的 transcript、字幕、文字稿、VTT、SRT 或纯文本链接。

如果找到，会自动填入 transcript 输入区，并刷新左侧字幕预览和右侧 Markdown 草稿。

如果没有找到，会提示这期节目没有公开 transcript，需要手动粘贴，或后续接入语音转写服务生成。

### 6. 生成 transcript

如果节目没有公开 transcript，可以点击 `生成 transcript`。

当前实现：

- 25MB 以下音频使用 OpenAI `gpt-4o-mini-transcribe`。
- 超过 25MB 的公开音频使用 Deepgram `nova-3` URL 转写。
- 调用前需要两步确认，第一次点击会显示按时长估算的费用，第二次点击才会真正开始转写。
- 生成前会显示转写服务商、音频大小和预估费用。
- 同一浏览器里生成过的 transcript 会缓存，重复点击会直接载入缓存，避免重复扣费。
- 浏览器端有默认每日 300 分钟转写保护，防止误触连续转写。
- 结果会自动填入 transcript 输入区，并刷新字幕预览和 Markdown 草稿。
- 当前 transcript 可以直接下载为 `.txt` 文件。
- OpenAI API Key 和 Deepgram API Key 只放在后端环境变量，不在页面暴露。

当前限制：

- Deepgram 当前默认语言为中文 `zh`，主要面向中文播客。
- 当前缓存和每日额度是浏览器端保护；如果把网站开放给别人用，后续需要接 Cloudflare KV 做服务端缓存和限额。
- 付费或私密音频不会被转写。

### 7. 中文字幕与时间线

中间区域展示逐句 transcript，每一句带时间戳。当前支持：

- 查看逐句中文 transcript。
- 播放真实音频时，字幕预览会按当前播放时间自动高亮并滚动。
- 播放器卡片内会同步显示当前字幕，方便像听歌看歌词一样跟读。
- 点击某句高亮。
- 切换中英对照展示。

导入真实 RSS 或小宇宙公开音频后，点击 transcript 时间戳会跳转到音频对应位置。播放时，当前时间对应的字幕会自动同步到播放器卡片和左侧字幕预览。

### 8. 真实音频播放器

导入 RSS 后，如果单集里有音频 enclosure，播放器会连接真实音频。导入小宇宙公开页面时，如果单集公开了音频地址，也会连接真实音频。

当前支持：

- 播放 / 暂停
- 后退 15 秒
- 前进 30 秒
- 倍速切换
- 进度条拖动
- 自动显示当前播放时间和总时长

### 9. 本地规则整理

如果没有配置 DeepSeek API Key，点击 `本地整理` 可以先用本地规则生成 Markdown。

本地规则适合做原型预览，但不等同于真正 AI 分析。

### 10. DeepSeek 分析

部署版配置好 Cloudflare 环境变量 `DEEPSEEK_API_KEY` 后，点击 `DeepSeek 分析`，系统会把当前 transcript 发给后端，再由后端调用 DeepSeek。

当前默认模型是：

```text
deepseek-v4-flash
```

DeepSeek 默认使用 `Obsidian 知识库笔记` 模板，会生成适合长期保存的 Markdown，包含：

- YAML frontmatter。
- 节目信息 Callout。
- 一句话总结和整集主线。
- Topic Map。
- 核心观点。
- 关键概念与知识点。
- 人物 / 书籍 / 作品 / 事件表格。
- 值得摘录的原话。
- 我的认知增量。
- 可沉淀为 Obsidian 原子笔记的标题。
- 行动项 / 后续阅读。
- 标签建议。
- Transcript 索引。

模板会要求 DeepSeek 克制地使用 Obsidian `[[双向链接]]`，优先链接重要概念、人物、书籍、理论、事件、地点、机构和方法论。

### 11. Markdown 下载

右侧可以复制或下载 Markdown。

当前主界面不再提供本机 Obsidian Vault 写入，避免部署版和本地版概念混在一起。生成笔记后直接下载 `.md` 文件，再放入 Obsidian。

### 12. 本地后端代理

当前版本新增了本地服务 `server.js`。

它负责：

- 托管本地网页。
- 解析小宇宙公开页面。
- 抓取播客网页并自动发现 RSS。
- 抓取 RSS。
- 查找公开 transcript。
- 调用 OpenAI 或 Deepgram 生成 transcript。
- 代理 DeepSeek 请求。
- 提供本地开发时的静态服务和 API 代理。
- 提供健康检查接口 `/api/health`。

这样做的原因是：API Key 不应该直接暴露在前端请求里。

### 13. Cloudflare 线上版

当前项目已经支持部署到 Cloudflare Pages。

线上版支持：

- 网页界面。
- 小宇宙公开页面导入。
- RSS 抓取。
- 公开 transcript 查找。
- OpenAI 短音频转写。
- Deepgram 长音频 URL 转写。
- DeepSeek 分析。
- Markdown 下载。

线上版和主界面都以下载 Markdown 为主。

## 如何使用

### 第一步：启动

在项目目录运行：

```bash
npm start
```

打开：

```text
http://127.0.0.1:4174
```

也可以用 `rss` 参数直接导入一个订阅源：

```text
http://127.0.0.1:4174/?rss=你的RSS地址
```

本地示例：

```text
http://127.0.0.1:4174/?rss=http%3A%2F%2F127.0.0.1%3A4174%2Ffixtures%2Fsample-feed.xml
```

### 第二步：解析播客链接

在页面顶部输入框里填入小宇宙、播客网页或 RSS 地址，然后点击 `解析链接`。

导入成功后，左侧会出现单集列表。

### 第三步：准备 transcript

如果你已经导入播客，可以先点 `自动查找`。

如果节目 RSS 或网页公开了 transcript，系统会自动填入。没有公开 transcript 时，可以点 `生成 transcript`。短音频会走 OpenAI，长音频会走 Deepgram；如果暂时不想付费，也可以在 `Transcript` 输入区手动粘贴完整转写文本。

建议格式：

```text
[00:12] 主持人：这里是一句话。
[00:28] 嘉宾：这里是另一句话。
```

没有时间戳也可以，但带时间戳更适合回听和引用。

### 第四步：生成笔记

可以选择：

- `本地整理`：用本地规则整理。
- `DeepSeek 分析`：用 DeepSeek 生成更完整的笔记。

### 第五步：下载 Markdown

点击 `下载 .md`，把文件放进 Obsidian 或其他 Markdown 知识库。

## 当前限制

- OPML 暂时不在主界面显示。
- `生成 transcript` 的长音频能力依赖 `DEEPGRAM_API_KEY`。
- 长音频还没有做切片转写。
- 线上版依赖 Cloudflare 环境变量 `DEEPSEEK_API_KEY`。
- 线上版生成 transcript 依赖 Cloudflare 环境变量 `OPENAI_API_KEY` 和 `DEEPGRAM_API_KEY`。
- 还没有打包成真正的 Mac/Windows 桌面 App。

## 推荐使用方式

当前最稳的试用流程是：

1. 找一集你喜欢的播客。
2. 复制它的单集网页或 RSS 地址并解析。
3. 播放音频确认单集无误。
4. 点击 `自动查找`。
5. 如果没有公开 transcript，再点击 `生成 transcript`。
6. 确认 Cloudflare 已经配置 `DEEPSEEK_API_KEY`。
7. 确认 Cloudflare 已经配置 `OPENAI_API_KEY` 和 `DEEPGRAM_API_KEY`。
8. 点击 `DeepSeek 分析`。
9. 检查生成的 Markdown。
10. 下载 Markdown 文件并放入 Obsidian。
