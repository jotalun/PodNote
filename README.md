# PodNote Desktop

一个 transcript-first 的播客知识工作台原型：先拿到完整转写，再用 DeepSeek 整理成适合 Obsidian 的 Markdown 笔记。

当前版本：`0.5.1`

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

也可以直接带 RSS 地址打开：

```text
http://127.0.0.1:4174/?rss=http%3A%2F%2F127.0.0.1%3A4174%2Ffixtures%2Fsample-feed.xml
```

## 必要设置

- RSS 地址：单个播客节目的订阅源。
- OPML：一批播客订阅源的导入清单。
- Transcript 来源：先支持手动粘贴，后面可接本地 Whisper 或第三方转写 API。
- DeepSeek API Key：可在页面输入，也可用环境变量 `DEEPSEEK_API_KEY`。
- Obsidian Vault：填写你的 vault 文件夹路径，导出时会写入 `PodNote/节目名.md`。

## 当前架构

- `server.js`：本地静态服务、DeepSeek 代理、Obsidian Markdown 写入。
- `index.html`：产品界面。
- `app.js`：RSS 导入、播放器、transcript、笔记生成和导出交互。
- `styles.css`：界面样式。

## 下一步

- 部署到 Cloudflare Pages 并设置 `DEEPSEEK_API_KEY` secret。
- 接音频转写，生成带时间戳的 transcript。
- 把 DeepSeek API Key 存入系统钥匙串或桌面应用安全存储。
- 用 Electron 或 Tauri 打包成真正桌面 App。

## 文档维护约定

之后每次新增或修改功能，都同步更新：

- `docs/PRODUCT.md`：写清楚功能怎么用。
- `docs/CHANGELOG.md`：记录版本、日期和改了什么。
- `docs/ROADMAP.md`：调整下一步计划。
