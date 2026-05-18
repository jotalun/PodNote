# PodNote Desktop

一个 transcript-first 的播客知识工作台：粘贴小宇宙、播客网页或 RSS，播放单集，获取 transcript，再用 DeepSeek 整理成 Markdown 笔记。

当前版本：`0.18.0`

## 文档入口

- [产品介绍与使用说明](./docs/PRODUCT.md)
- [更新记录](./docs/CHANGELOG.md)
- [后续路线图](./docs/ROADMAP.md)
- [Cloudflare 部署说明](./docs/DEPLOYMENT.md)

## 启动

```bash
npm start
```

打开：

```text
http://127.0.0.1:4174
```

也可以直接带小宇宙、播客网页或 RSS 地址打开：

```text
http://127.0.0.1:4174/?rss=http%3A%2F%2F127.0.0.1%3A4174%2Ffixtures%2Fsample-feed.xml
```

## 使用流程

1. 输入邀请码进入页面。
2. 可以先打开顶部的 `内测说明` 看完整流程，打开 `配置检查` 确认 API 配置，或打开 `额度用量` 查看剩余额度。
3. 在页面顶部粘贴小宇宙、播客网页或 RSS 链接并解析。
4. 选择一集播放。
5. 点击 `自动查找` 获取公开 transcript；没有的话点击 `生成 transcript`。
6. 点击 `DeepSeek 分析`。
7. 下载 `.md` 文件。

## 当前架构

- `server.js`：本地静态服务、邀请码登录、额度保护、配置检查、DeepSeek 代理、播客网页/RSS 抓取、transcript 查找、OpenAI 短音频转写和 Deepgram 长音频转写。
- `lib/metering.js`：邀请码、用户额度、服务端 transcript 缓存和用量记录。
- `index.html`：产品界面。
- `app.js`：RSS 导入、播放器、transcript、笔记生成和导出交互。
- `styles.css`：界面样式。

## 下一步

- 部署到 Cloudflare Pages 并设置 `DEEPSEEK_API_KEY`、`OPENAI_API_KEY`、`DEEPGRAM_API_KEY`。
- 绑定 Cloudflare KV 为 `PODNOTE_KV`，用于长期保存用户额度和 transcript 缓存。
- 配置 `PODNOTE_INVITE_CODES` 和 `PODNOTE_SESSION_SECRET`，用邀请码控制内测用户。
- 用 Electron 或 Tauri 打包成真正桌面 App。

## 文档维护约定

之后每次新增或修改功能，都同步更新：

- `docs/PRODUCT.md`：写清楚功能怎么用。
- `docs/CHANGELOG.md`：记录版本、日期和改了什么。
- `docs/ROADMAP.md`：调整下一步计划。
