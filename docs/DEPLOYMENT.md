# Cloudflare 部署说明

版本：`0.11.0`  
更新日期：2026-05-18

## 线上版能做什么

Cloudflare 线上版支持：

- 打开网页界面。
- 通过 `/api/rss` 抓取 RSS、从播客网页自动发现 RSS，或导入小宇宙公开页面。
- 通过 `/api/transcript` 查找公开 transcript。
- 通过 `/api/transcribe` 调用 OpenAI 或 Deepgram 生成 transcript。
- 通过 `/api/analyze` 调用 DeepSeek。
- 生成和下载 Markdown。
- 用访问密码保护未完善的预览版本。

Cloudflare 线上版不支持直接写入你电脑里的 Obsidian Vault。当前主流程统一为下载 Markdown。

## 部署前准备

需要：

- Cloudflare 账号。
- DeepSeek API Key。
- OpenAI API Key，用于没有公开 transcript 时生成文字稿。
- Deepgram API Key，用于小宇宙等长音频 URL 转写。
- 访问密码，默认是 `123456`。
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

## 设置访问密码

当前默认密码是：

```text
123456
```

如果要改密码，在 Cloudflare 环境变量里添加：

```text
PODNOTE_PASSWORD
```

类型可以设为 Secret，值填你的新密码。设置后重新部署一次。

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

1. 输入访问密码。
2. 粘贴小宇宙、播客网页或 RSS 地址并解析。
3. 播放音频。
4. 点击 `自动查找` 获取公开 transcript；没有的话点击 `生成 transcript`。
5. 点击 `DeepSeek 分析`。
6. 下载 Markdown。

线上版不需要在页面里填写 API Key；Cloudflare Function 会读取 `DEEPSEEK_API_KEY`、`OPENAI_API_KEY` 和 `DEEPGRAM_API_KEY`。

注意：25MB 以下音频会走 OpenAI；超过 25MB 的公开音频会走 Deepgram URL 转写。浏览器本地会缓存已生成 transcript，避免同一单集重复扣费。

## 访问保护

如果网站公开，别人也可能调用你的 DeepSeek API 额度。

建议先做其中一种保护：

- 用 Cloudflare Access 限制只有你能访问。
- 不公开分享部署地址。
- 后续给产品加简单访问密码。
- 后续给 `/api/analyze` 加限流。

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
