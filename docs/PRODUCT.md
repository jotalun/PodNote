# PodNote Desktop 产品说明

版本：`0.5.2`  
更新日期：2026-05-18

## 产品定位

PodNote Desktop 是一个面向播客重度用户的桌面知识工作台。它不是单纯复刻手机播客 App，而是把播客收听、transcript、AI 整理和 Obsidian 笔记放到同一个流程里。

核心思路是：

```text
播客音频 / RSS / OPML
→ 获取 transcript
→ 基于 transcript 分析重点
→ 生成 Markdown 笔记
→ 写入 Obsidian 知识库
```

## 适合谁用

- 平时大量听播客，希望在电脑上整理内容的人。
- 希望把节目里的观点、知识点、原话摘录沉淀到 Obsidian 的人。
- 想用 DeepSeek 根据 transcript 自动生成播客笔记的人。
- 不想只看一句摘要，而是希望保留时间戳和原始语境的人。

## 当前功能

### 1. 播客桌面工作台

首页左侧是播客列表和设置区，中间是播放器和 transcript，右侧是 Obsidian 笔记区。

现在内置了几条示例单集，也支持导入真实 RSS，导入后会用真实节目和单集替换示例数据。

### 2. 视觉风格

当前界面采用更接近 Apple 桌面应用的简约风格：

- 白底、黑白灰主色调。
- 轻量毛玻璃侧栏和顶部工具区。
- 克制的细边框和浅阴影。
- 更少装饰色，默认播客封面使用灰阶渐变。
- 右侧 Markdown 编辑区保留深色编辑器视觉，方便长文本阅读和区分输出区。

### 3. RSS 和 OPML 设置

左侧设置区支持填写：

- `RSS 地址`：单个播客节目的订阅源。
- `OPML 订阅清单`：从其他播客 App 导出的订阅列表。

当前版本已经支持：

- 填写 RSS 地址后抓取节目。
- 解析节目标题、单集标题、简介、封面、发布时间、时长和音频地址。
- 导入 OPML 后识别 RSS 地址，并自动导入第一个 feed。

### 4. Transcript-first 工作流

产品默认把 transcript 当作原始材料。右侧有 `Transcript 原文` 输入区，可以手动粘贴节目转写文本。

生成笔记时，系统会基于这里的 transcript 来整理内容，而不是只根据节目标题或简介生成摘要。

### 5. 中文字幕与时间线

中间区域展示逐句 transcript，每一句带时间戳。当前支持：

- 查看逐句中文 transcript。
- 点击某句高亮。
- 切换中英对照展示。

导入真实 RSS 后，点击 transcript 时间戳会跳转到音频对应位置。

### 6. 真实音频播放器

导入 RSS 后，如果单集里有音频 enclosure，播放器会连接真实音频。

当前支持：

- 播放 / 暂停
- 后退 15 秒
- 前进 30 秒
- 倍速切换
- 进度条拖动
- 自动显示当前播放时间和总时长

### 7. 本地规则整理

没有 DeepSeek API Key 时，点击 `重新整理` 或 `DeepSeek 分析`，系统会先用本地规则生成 Markdown。

本地规则适合做原型预览，但不等同于真正 AI 分析。

### 8. DeepSeek 分析

填写 DeepSeek API Key 后，点击顶部的 `DeepSeek 分析`，系统会把当前 transcript 发给本机后端，再由本机后端调用 DeepSeek。

默认模型是：

```text
deepseek-v4-flash
```

也可以切换为：

```text
deepseek-v4-pro
```

DeepSeek 会生成适合 Obsidian 的 Markdown，包含：

- 一句话总结
- 主要观点
- 相关知识点
- 可行动事项
- 值得回听的原声摘录
- 可建立的双链

### 9. Obsidian 导出

右侧可以复制或下载 Markdown。

如果填写了 `Obsidian Vault` 路径，点击 `导出到 Obsidian` 时，本地服务会把笔记写入：

```text
你的Vault/PodNote/节目名.md
```

如果没有填写 Vault 路径，系统会改为下载 `.md` 文件。

### 10. 本地后端代理

当前版本新增了本地服务 `server.js`。

它负责：

- 托管本地网页。
- 抓取 RSS。
- 代理 DeepSeek 请求。
- 写入 Obsidian Markdown 文件。
- 提供健康检查接口 `/api/health`。

这样做的原因是：API Key 不应该直接暴露在前端请求里，后续桌面版也更适合由本机服务负责读写文件。

### 11. Cloudflare 线上版

当前项目已经支持部署到 Cloudflare Pages。

线上版支持：

- 网页界面。
- RSS 抓取。
- DeepSeek 分析。
- Markdown 下载。

线上版不支持直接写入本机 Obsidian Vault。需要写入 Vault 时，使用本地版。

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

### 第二步：填写设置

在左侧 `处理设置` 里填写：

- RSS 地址，可先不填。
- Transcript 来源，当前建议选择 `手动粘贴`。
- 目标语言，默认 `简体中文`。
- DeepSeek API Key。
- Obsidian Vault 路径。

然后点击 `保存设置`。

### 第三步：准备 transcript

如果你已经导入 RSS，可以先播放真实音频。然后在右侧 `Transcript 原文` 输入区粘贴完整转写文本。

建议格式：

```text
[00:12] 主持人：这里是一句话。
[00:28] 嘉宾：这里是另一句话。
```

没有时间戳也可以，但带时间戳更适合回听和引用。

### 第四步：生成笔记

可以选择：

- `重新整理`：用本地规则整理。
- `DeepSeek 分析`：用 DeepSeek 生成更完整的笔记。

### 第五步：导出到 Obsidian

如果已经填写 Vault 路径，点击：

```text
导出到 Obsidian
```

系统会把 Markdown 写入 Vault 下的 `PodNote` 文件夹。

## 当前限制

- OPML 目前会导入第一个 RSS 源，还没有完整批量订阅管理。
- Transcript 主要依赖手动粘贴，还没有接 Whisper 或转写 API。
- API Key 当前可保存在浏览器本地存储，后续应改成系统钥匙串或桌面应用安全存储。
- 还没有打包成真正的 Mac/Windows 桌面 App。

## 推荐使用方式

当前最稳的试用流程是：

1. 找一集你喜欢的播客。
2. 找到它的 RSS 地址并导入。
3. 播放音频确认单集无误。
4. 用任意工具先拿到 transcript。
5. 把 transcript 粘进右侧输入区。
6. 填 DeepSeek API Key。
7. 点击 `DeepSeek 分析`。
8. 检查生成的 Markdown。
9. 填 Obsidian Vault 路径并导出。
