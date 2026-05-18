# Cloudflare 部署说明

版本：`0.19.2`
更新日期：2026-05-19

## 线上版能做什么

Cloudflare 线上版支持：

- 打开网页界面。
- 通过 `/api/rss` 抓取 RSS、从播客网页自动发现 RSS，或导入小宇宙公开页面。
- 通过 `/api/transcript` 查找公开 transcript。
- 通过 `/api/transcribe` 调用 OpenAI 或 Deepgram 生成 transcript。
- 通过 `/api/analyze` 调用 DeepSeek。
- 通过 `/api/config` 检查线上配置状态。
- 生成和下载 Markdown。
- 用邀请码保护未完善的预览版本。
- 显示当前用户额度用量。
- 用 Cloudflare KV 记录用户额度和 transcript 缓存。

Cloudflare 线上版不支持直接写入你电脑里的 Obsidian Vault。当前主流程统一为下载 Markdown。

## 部署前准备

需要：

- Cloudflare 账号。
- DeepSeek API Key。
- OpenAI API Key，用于没有公开 transcript 时生成文字稿。
- Deepgram API Key，用于小宇宙等长音频 URL 转写。
- 邀请码和 session secret。
- Cloudflare KV namespace，推荐绑定名为 `PODNOTE_KV`。
- 本机可以运行 `npx wrangler`。

## 本地构建

```bash
npm run build
```

构建产物会进入：

```text
dist/
```

## 登录 Cloudflare

```bash
npx wrangler login
```

## 创建或部署 Pages 项目

首次部署：

```bash
npm run deploy:cloudflare
```

Wrangler 会提示你选择或创建 Pages 项目。项目名可以使用：

```text
podnote-desktop
```

也可以显式指定项目名：

```bash
npx wrangler pages deploy dist --project-name podnote-desktop
```

## 设置 DeepSeek API Key

进入 Cloudflare Dashboard：

```text
Workers & Pages → podnote-desktop → Settings → Environment variables
```

添加变量：

```text
DEEPSEEK_API_KEY
```

类型建议设为 Secret，值填你的 DeepSeek API Key。

也可以用 Wrangler 设置：

```bash
npx wrangler pages secret put DEEPSEEK_API_KEY --project-name podnote-desktop
```

设置后重新部署一次。

## 设置 OpenAI API Key

进入 Cloudflare Dashboard：

```text
Workers & Pages → podnote-desktop → Settings → Environment variables
```

添加变量：

```text
OPENAI_API_KEY
```

类型设为 Secret，值填你的 OpenAI API Key。

也可以用 Wrangler 设置：

```bash
npx wrangler pages secret put OPENAI_API_KEY --project-name podnote-desktop
```

设置后重新部署一次。

## 设置 Deepgram API Key

进入 Cloudflare Dashboard：

```text
Workers & Pages → podnote-desktop → Settings → Environment variables
```

添加变量：

```text
DEEPGRAM_API_KEY
```

类型设为 Secret，值填你的 Deepgram API Key。

也可以用 Wrangler 设置：

```bash
npx wrangler pages secret put DEEPGRAM_API_KEY --project-name podnote-desktop
```

设置后重新部署一次。

## 设置邀请码和额度

建议先设置正式邀请码。没有配置正式邀请码时，系统会临时允许 `123456` 作为内测默认邀请码进入；公开分享前一定要换成自己的邀请码。

最简单的内测方式是在 Cloudflare 环境变量里添加：

```text
PODNOTE_INVITE_CODES
```

值可以是一个或多个邀请码：

```text
podnote-beta
```

多个邀请码用英文逗号隔开：

```text
alice-001,bob-002,creator-003
```

也可以给邀请码加显示名和套餐：

```text
alice-001|Alice|free,bob-002|Bob|free,jotalun-owner-2026|Jotalun|owner
```

陌生人内测时，建议一人一个独立邀请码，避免多人共用一份额度。可以在本地生成一批 `free` 邀请码：

```bash
npm run invites -- 10 free xhs
```

命令输出的第一段就是 `PODNOTE_INVITE_CODES` 可以填写的值。生成后复制到 Cloudflare 的环境变量里，再重新部署。

再添加一个 session 签名密钥：

```text
PODNOTE_SESSION_SECRET
```

值填一段足够长的随机字符串。它不等于邀请码，不要发给用户。

默认额度可以通过这些变量调整：

```text
PODNOTE_MONTHLY_TRANSCRIBE_MINUTES=60
PODNOTE_DAILY_TRANSCRIBE_MINUTES=120
PODNOTE_MAX_SINGLE_TRANSCRIBE_MINUTES=120
PODNOTE_MONTHLY_ANALYZE_COUNT=30
PODNOTE_GLOBAL_DAILY_TRANSCRIBE_MINUTES=1000
PODNOTE_GLOBAL_DAILY_COST_USD=20
```

代码内置的套餐默认值是：

| 套餐 | 本月转写 | 今日转写 | 单集上限 | 每月分析 |
| --- | ---: | ---: | ---: | ---: |
| `free` | 60 分钟 | 120 分钟 | 120 分钟 | 30 次 |
| `owner` | 3000 分钟 | 600 分钟 | 240 分钟 | 1000 次 |

如果 Cloudflare 环境变量里设置了 `PODNOTE_OWNER_MONTHLY_TRANSCRIBE_MINUTES` 这类变量，会覆盖代码默认值。

设置后重新部署一次。

## 绑定 Cloudflare KV

KV 用来长期保存：

- 邀请码对应的用户记录。
- 每个用户的每日 / 每月转写额度。
- 每个用户的 DeepSeek 分析次数。
- 服务端 transcript 缓存，避免同一集重复转写。
- 全站每日美元预算上限，避免突然爆量。

创建 KV namespace 后，在 Pages 项目里添加绑定：

```text
Workers & Pages → podnote-desktop → Settings → Functions → KV namespace bindings
Variable name: PODNOTE_KV
KV namespace: 选择你创建的 namespace
```

如果用 Wrangler，也可以把真实 namespace id 填进 `wrangler.toml` 里的注释示例后再部署。

## Cloudflare 项目设置

如果通过 Dashboard 连接 Git 仓库，推荐设置：

```text
Build command: npm run build
Build output directory: dist
Root directory: /
```

Functions 目录保持默认：

```text
functions/
```

## 常见部署错误

### Can't set compatibility date in the future

如果日志里出现：

```text
Error: Failed to publish your Function. Got error: Can't set compatibility date in the future: 2026-05-18
```

说明 Cloudflare 发布 Function 时使用 UTC 日期判断，而本地时区可能已经进入下一天。当前项目把 `wrangler.toml` 的 `compatibility_date` 固定为：

```text
2026-05-17
```

重新部署即可。

### Output directory "dist" not found

如果日志里出现：

```text
No build command specified. Skipping build step.
Error: Output directory "dist" not found.
```

说明 Cloudflare 没有运行构建命令，所以仓库里的源文件没有被复制到 `dist/`。

修复方式：

1. 进入 Cloudflare Pages 项目。
2. 打开 `Settings → Build & deployments`。
3. 设置：

```text
Build command: npm run build
Build output directory: dist
Root directory: /
```

4. 保存后重新部署。

注意：`dist/` 是构建产物，不提交到 Git。Cloudflare 必须先运行 `npm run build`，才会生成这个目录。

## 线上使用方式

部署完成后打开 Cloudflare 给你的域名。

使用流程：

1. 输入邀请码。
2. 粘贴小宇宙、播客网页或 RSS 地址并解析。
3. 播放音频。
4. 点击 `自动查找` 获取公开 transcript；没有的话点击 `生成 transcript`。
5. 点击 `DeepSeek 分析`。
6. 下载 Markdown。

线上版不需要在页面里填写 API Key；Cloudflare Function 会读取 `DEEPSEEK_API_KEY`、`OPENAI_API_KEY` 和 `DEEPGRAM_API_KEY`。

注意：25MB 以下音频会走 OpenAI；超过 25MB 的公开音频会走 Deepgram URL 转写。服务端会优先检查 KV transcript 缓存，命中缓存时不再重复调用转写服务。

## 配置检查页

登录后，点击顶部 `配置检查` 可以查看当前部署是否完成关键配置。

它会检查：

- 邀请码或临时内测码。
- `PODNOTE_SESSION_SECRET`。
- `PODNOTE_KV`。
- `DEEPSEEK_API_KEY`。
- `OPENAI_API_KEY`。
- `DEEPGRAM_API_KEY`。
- `PODNOTE_GLOBAL_DAILY_COST_USD` 等额度保护。

这个页面只显示状态，不会显示任何 Key 原文。它适合每次改 Cloudflare 环境变量或重新部署后快速确认。

## 访问保护

如果网站公开，别人也可能消耗你的转写和 DeepSeek 额度。

当前已经有：

- 邀请码登录。
- 用户级转写分钟数限制。
- 用户级 DeepSeek 分析次数限制。
- 全站每日转写分钟数上限。
- 服务端 transcript 缓存。

继续公开扩散前，建议再加 Cloudflare Turnstile 或 Cloudflare Access。

## 本地版和线上版区别

| 能力 | 本地版 | Cloudflare 线上版 |
| --- | --- | --- |
| RSS 导入 | 支持 | 支持 |
| DeepSeek 分析 | 支持 | 支持 |
| 播放音频 | 支持 | 支持 |
| 下载 Markdown | 支持 | 支持 |
| 写入本机 Obsidian Vault | 暂不作为主流程 | 不支持 |
| API Key 存放 | 本机环境变量或页面输入 | Cloudflare Secret |
| 生成 transcript | OpenAI 短音频 + Deepgram 长音频 | OpenAI 短音频 + Deepgram 长音频 |
| 邀请码登录 | 支持，内存存储 | 支持，推荐 KV 持久化 |
| 用户额度 | 支持，内存存储 | 支持，推荐 KV 持久化 |
| 服务端 transcript 缓存 | 支持，内存存储 | 支持，推荐 KV 持久化 |
