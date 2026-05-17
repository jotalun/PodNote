# 更新记录

## 0.9.0 - 2026-05-18

### 新增

- 新增访问密码页，未登录时页面和 API 都会被拦截。
- Cloudflare Pages 新增 `functions/_middleware.js`，线上访问会先校验密码。
- 本地 `server.js` 新增同样的密码保护逻辑。
- 默认密码为 `123456`，也可以通过环境变量 `PODNOTE_PASSWORD` 覆盖。

## 0.8.1 - 2026-05-18

### 修复

- `生成 transcript` 改为页面内两步确认，第一次点击会显示预计费用并把按钮改成 `确认生成`，避免浏览器原生弹窗不明显导致像是没反应。
- 给 `app.js` 和 `styles.css` 增加版本参数，减少 Cloudflare 或浏览器加载旧脚本的概率。
- 页面增加 `podnote-version` 元信息，方便检查当前部署版本。

## 0.8.0 - 2026-05-18

### 新增

- 新增 `/api/transcribe`，使用 OpenAI `gpt-4o-mini-transcribe` 从音频生成 transcript。
- 新增 `生成 transcript` 按钮，调用前会弹出预计费用确认。
- 新增 OpenAI Key 环境变量说明，Cloudflare 线上版读取 `OPENAI_API_KEY`。

### 改进

- transcript 状态会显示预计转写费用。
- 当前版本会拦截超过 25MB 的音频，并提示需要切片或支持 URL 转写的服务，避免静默失败。
- `.env.example` 增加 `OPENAI_API_KEY`。

## 0.7.0 - 2026-05-18

### 新增

- 新增 `/api/transcript`，可以从 RSS 标准 `podcast:transcript` 标签读取文字稿。
- 新增单集网页 transcript 自动发现，支持常见的文字稿、字幕、VTT、SRT、纯文本链接。
- 新增 `自动查找` 按钮，找到公开 transcript 后会自动填入输入区并刷新字幕预览和 Markdown 草稿。
- 新增本地示例 transcript fixture，用于验证 RSS transcript 流程。

### 改进

- 如果节目没有公开 transcript，会明确提示需要接入语音转写服务或手动粘贴，不再让用户以为 RSS 一定包含文字稿。
- 文档更新到 `0.7.0`，说明 transcript 查找和语音转写的边界。

## 0.6.1 - 2026-05-18

### 修复

- `/api/rss` 现在支持先解析播客网页，再自动发现页面里的 RSS 链接。
- 修复 `https://podcast.latepost.com/164` 这类单集网页无法导入的问题。
- 粘贴单集网页时，导入后会尽量选中对应单集。

### 改进

- 重写主界面样式，改成更简洁的白底、黑白灰、轻毛玻璃工作台。
- 顶部只保留一个明确的链接输入入口，按钮文案统一为 `解析链接`。
- Markdown 导出继续保持复制和下载 `.md`，不在主界面显示本地 Vault 写入。
- 更新 README、产品说明和部署说明到 `0.6.1`。

## 0.6.0 - 2026-05-18

### 改进

- 重新设计主界面，改为更清晰的三步流程：粘贴 RSS、粘贴 transcript、下载 Markdown。
- 将 RSS 输入框移动到页面顶部，作为最明显的主入口。
- 从主界面移除 OPML、DeepSeek Key、模型、Vault 路径等高级设置。
- 从主界面移除 `导出到 Obsidian`，统一为下载 `.md` 文件。
- 右侧笔记区只保留 transcript、DeepSeek 分析、本地整理、复制和下载。

### 文档

- 更新 README 和产品说明，强调当前主流程只下载 Markdown。

## 0.5.2 - 2026-05-18

### 修复

- 将 `wrangler.toml` 的 `compatibility_date` 从 `2026-05-18` 改为 `2026-05-17`，避免 Cloudflare 按 UTC 判断时认为日期在未来。
- 部署文档新增 `Can't set compatibility date in the future` 故障说明。

## 0.5.1 - 2026-05-18

### 改进

- 新增标准构建脚本 `npm run build`，内部调用 `npm run build:pages`。
- 部署文档改用 `npm run build` 作为 Cloudflare Pages Build command。
- 部署文档新增 `Output directory "dist" not found` 故障说明。

### 修复

- 解释 Cloudflare Pages 因未设置 Build command 跳过构建，导致找不到 `dist/` 的部署失败问题。

## 0.5.0 - 2026-05-18

### 新增

- 新增 Cloudflare Pages Functions：`functions/api/analyze.js`、`functions/api/rss.js`、`functions/api/health.js`。
- 新增 Cloudflare 构建脚本 `scripts/build-pages.js`，构建产物输出到 `dist/`。
- 新增 `wrangler.toml`。
- 新增部署脚本 `npm run deploy:cloudflare`。
- 新增 Cloudflare 部署文档 `docs/DEPLOYMENT.md`。

### 改进

- 前端现在兼容本地版和 Cloudflare 线上版。
- 线上版 DeepSeek 分析会使用 Cloudflare Secret，不要求用户在页面输入 API Key。
- 线上版导出 Obsidian 时会下载 Markdown，而不是尝试写入本机 Vault。

### 验证

- `npm run check` 通过。
- `npm run build:pages` 可以生成 `dist/`。

## 0.4.1 - 2026-05-17

### 改进

- 将整体视觉改为更现代的白底、黑白灰、Apple 风格界面。
- 侧栏、设置区、面板和顶部工具区加入轻量毛玻璃效果。
- 按钮、输入框、流程条、章节卡片改为更克制的细边框和浅阴影。
- 默认播客封面和 RSS 示例封面改为灰阶风格。
- 产品文档新增视觉风格说明。

### 验证

- `npm run check` 通过。
- 浏览器刷新后页面无前端报错。

## 0.4.0 - 2026-05-17

### 新增

- 新增 RSS 抓取接口 `/api/rss`。
- 新增 RSS XML 解析逻辑，可解析节目标题、封面、单集、简介、时长和音频地址。
- 新增真实音频播放器，支持播放、暂停、进度同步、拖动进度、倍速、快进和后退。
- 新增本地示例 RSS：`fixtures/sample-feed.xml`。
- 支持通过 `?rss=...` 启动参数直接导入 RSS。
- OPML 导入后会自动使用第一个 RSS 源导入节目。

### 改进

- RSS 导入后会用真实节目单集替换示例数据。
- transcript 时间戳点击后，如果当前单集有真实音频，会跳转到对应播放位置。
- 文档更新到 `0.4.0`，补充真实 RSS 和音频播放说明。

### 验证

- `npm run check` 通过。
- `/api/rss` 能抓取本地示例 feed。
- 浏览器通过 `?rss=...` 自动导入示例 feed。
- 页面导入后显示真实单集，并连接音频地址。

## 0.3.0 - 2026-05-17

### 新增

- 新增本地服务 `server.js`。
- 新增 DeepSeek 本地代理接口 `/api/analyze`。
- 新增 Obsidian Markdown 写入接口 `/api/export`。
- 新增健康检查接口 `/api/health`。
- 新增 `package.json`，支持 `npm start` 和 `npm run check`。
- 新增 `.env.example`。
- 新增产品文档、更新记录和路线图。

### 改进

- 前端 DeepSeek 分析改为请求本地服务，减少 API Key 直接暴露在浏览器请求里的问题。
- `导出到 Obsidian` 现在会尝试写入本地 Vault；没有 Vault 路径时降级为下载 Markdown。
- 设置区补充了 Transcript 来源、目标语言、DeepSeek 模型和 Vault 路径。

### 验证

- `npm run check` 通过。
- 本地服务可在 `http://127.0.0.1:4174` 启动。
- `/api/health` 返回正常。
- 页面加载无前端报错。
- 没有 API Key 时，DeepSeek 分析按钮会降级为本地整理。

## 0.2.0 - 2026-05-17

### 新增

- 改成 transcript-first 工作流。
- 右侧新增 `Transcript 原文` 输入区。
- Markdown 生成逻辑改为基于 transcript。
- 笔记里新增 `从 transcript 提取的重点` 和 `Transcript 原文` 区块。

## 0.1.0 - 2026-05-17

### 新增

- 创建第一版静态网页原型。
- 增加播客列表、播放器、中文字幕、章节、笔记模板、复制和下载 Markdown。
- 支持示例单集切换、搜索、播放控制和中英对照切换。
