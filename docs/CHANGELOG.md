# 更新记录

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
