# 校园科技讲座 AI 海报生成工具

一个基于 Next.js + TypeScript 的校园讲座海报生成 Web 应用。用户填写讲座信息、上传主讲人头像和 1-2 个 Logo 后，可以调用 AI 生成无文字科技风背景，在浏览器中拖动调整文字与图片位置，并导出竖版 PNG 海报或可编辑 PPTX 文件。

当前稳定版本：`v1.0.1`

## 主要功能

- 自动生成无文字、无 Logo、无水印的校园科技风海报背景
- 默认使用 GPT Image，支持 OpenAI 或兼容 OpenAI Images API 的服务
- 可选使用阿里云百炼 DashScope / Qwen Image 2.0 生成背景
- 支持基于当前背景进行微调；该能力仅适用于 GPT Image
- 支持上传主讲人头像和 1-2 个主办方 Logo
- 支持在预览画布中拖动、缩放文字框和图片元素
- 支持背景历史记录，可在最近生成或微调的背景之间切换
- 支持导出 PNG 图片和可编辑 PPTX 文件
- 服务端使用固定模板合成最终海报，避免 AI 直接生成文字导致错字

## 技术栈

- Next.js App Router
- React + TypeScript
- Sharp，用于服务端图片合成
- PptxGenJS，用于生成可编辑 PPTX
- GPT Image / OpenAI Images API
- DashScope / Qwen Image 2.0，可选

## 本地运行

```bash
npm install
npm run dev
```

打开：

```text
http://localhost:3000
```

如果在 Windows 上使用项目自带 Node，可以先把本地 Node 加入 PATH：

```cmd
set "PATH=%CD%\tools\node-v24.15.0-win-x64;%PATH%"
npm run dev
```

## 环境变量

复制 `.env.example` 为 `.env.local`，然后按需填写密钥和模型参数。

### GPT Image / OpenAI 兼容接口

```bash
AI_IMAGE_PROVIDER=openai
AI_IMAGE_API_KEY=your_api_key
AI_IMAGE_API_BASE=https://api.openai.com/v1
AI_IMAGE_MODEL=gpt-image-2
AI_IMAGE_SIZE=1024x1536
AI_IMAGE_QUALITY=medium
AI_IMAGE_OUTPUT_FORMAT=png
```

也可以使用以下兼容变量名：

```bash
OPENAI_IMAGE_API_KEY=your_api_key
OPENAI_IMAGE_API_BASE=https://api.openai.com/v1
OPENAI_IMAGE_MODEL=gpt-image-2
OPENAI_IMAGE_SIZE=512x768
OPENAI_IMAGE_QUALITY=low
OPENAI_IMAGE_OUTPUT_FORMAT=png
```

### DashScope / Qwen Image

```bash
AI_IMAGE_PROVIDER=dashscope
DASHSCOPE_API_KEY=your_dashscope_api_key
DASHSCOPE_API_BASE=https://dashscope.aliyuncs.com/api/v1
DASHSCOPE_IMAGE_MODEL=qwen-image-2.0
DASHSCOPE_IMAGE_SIZE=512*768
```

说明：

- `openai` 是默认 provider。
- `mock` provider 仍可用于本地无密钥演示，但当前默认配置不再使用它。
- DashScope 当前只支持重新生成背景，不支持基于当前背景微调。
- 如果本机访问 OpenAI 或兼容接口需要代理，可设置 `HTTPS_PROXY`、`HTTP_PROXY` 和 `NO_PROXY`。

## 健康检查

启动应用后可以访问：

```text
/api/ai-health
```

该接口会返回当前 provider、模型配置、密钥是否存在以及基础连通性检查结果，便于排查部署环境中的 API 配置问题。

## 输出规格

- PNG 尺寸：`1209 x 1814`
- PPTX 尺寸：与海报比例一致，背景作为底图，文字、头像、Logo、分隔符和箭头作为可编辑对象导出
- 模板：单一竖版校园科技讲座模板
- 数据保存：不持久化保存用户填写内容、上传图片或生成历史；背景历史仅保存在当前浏览器会话状态中

## 部署

当前项目包含 Meoo runtime 配置，可按如下方式部署：

```cmd
cd /d "C:\Users\sangu\Documents\Codex\2026-05-31\files-mentioned-by-the-user-222e2ac9252eb153876e248c89502f8"
set "PATH=%CD%\tools\node-v24.15.0-win-x64;%PATH%"
npx @aliyun-meoo/cli deploy --runtime image --force
```

部署环境需要配置相应的 AI 图片服务密钥。生产环境示例可参考 `.env.production.example` 和 `.env.meoo.example`。

## 使用流程

1. 填写讲座主题、时间、地点、主讲人介绍、主讲内容和主办单位。
2. 上传主讲人头像和至少一个 Logo。
3. 选择背景模型，并按需要填写背景要求。
4. 点击“生成新海报”生成 AI 背景。
5. 在右侧预览画布中拖动或缩放文字、头像和 Logo。
6. 如需保留整体风格并调整背景，使用“微调当前背景”。
7. 导出 PNG 图片或可编辑 PPTX。

## English

# Campus AI Lecture Poster Generator

A Next.js + TypeScript web application for generating campus technology lecture posters. Users enter lecture details, upload a speaker portrait and 1-2 organizer logos, generate a no-text AI background, adjust text and image elements in the browser preview, and export either a vertical PNG poster or an editable PPTX file.

Current stable version: `v1.0.1`

## Features

- Generates no-text, no-logo, no-watermark technology-style poster backgrounds
- Uses GPT Image by default through OpenAI or OpenAI-compatible Images APIs
- Optionally supports Alibaba Cloud DashScope / Qwen Image 2.0 for background generation
- Supports refining the current background when using GPT Image
- Supports speaker portrait upload and 1-2 organizer logos
- Provides draggable and resizable text and image elements in the preview canvas
- Keeps a short in-session background history for switching between generated or refined backgrounds
- Exports both PNG images and editable PPTX files
- Uses deterministic server-side rendering for final text, portraits, logos, separators, and arrows, avoiding AI-rendered text errors

## Tech Stack

- Next.js App Router
- React + TypeScript
- Sharp for server-side image composition
- PptxGenJS for editable PPTX export
- GPT Image / OpenAI Images API
- DashScope / Qwen Image 2.0, optional

## Local Development

```bash
npm install
npm run dev
```

Open:

```text
http://localhost:3000
```

On Windows, if you want to use the Node.js runtime bundled with this project, add it to PATH first:

```cmd
set "PATH=%CD%\tools\node-v24.15.0-win-x64;%PATH%"
npm run dev
```

## Environment Variables

Copy `.env.example` to `.env.local`, then fill in the required API keys and model settings.

### GPT Image / OpenAI-Compatible API

```bash
AI_IMAGE_PROVIDER=openai
AI_IMAGE_API_KEY=your_api_key
AI_IMAGE_API_BASE=https://api.openai.com/v1
AI_IMAGE_MODEL=gpt-image-2
AI_IMAGE_SIZE=1024x1536
AI_IMAGE_QUALITY=medium
AI_IMAGE_OUTPUT_FORMAT=png
```

The following compatible variable names are also supported:

```bash
OPENAI_IMAGE_API_KEY=your_api_key
OPENAI_IMAGE_API_BASE=https://api.openai.com/v1
OPENAI_IMAGE_MODEL=gpt-image-2
OPENAI_IMAGE_SIZE=512x768
OPENAI_IMAGE_QUALITY=low
OPENAI_IMAGE_OUTPUT_FORMAT=png
```

### DashScope / Qwen Image

```bash
AI_IMAGE_PROVIDER=dashscope
DASHSCOPE_API_KEY=your_dashscope_api_key
DASHSCOPE_API_BASE=https://dashscope.aliyuncs.com/api/v1
DASHSCOPE_IMAGE_MODEL=qwen-image-2.0
DASHSCOPE_IMAGE_SIZE=512*768
```

Notes:

- `openai` is the default provider.
- The `mock` provider is still available for local demos without API keys, but it is no longer the default configuration.
- DashScope currently supports only fresh background generation, not refinement based on the current background.
- If your machine needs a proxy to reach OpenAI or a compatible API service, configure `HTTPS_PROXY`, `HTTP_PROXY`, and `NO_PROXY`.

## Health Check

After starting the app, visit:

```text
/api/ai-health
```

This endpoint reports the active provider, model settings, whether API keys are configured, and basic connectivity checks. It is useful for diagnosing API configuration problems in deployment environments.

## Output

- PNG size: `1209 x 1814`
- PPTX: uses the same poster aspect ratio; the AI background is exported as the slide background, while text, portrait, logos, separators, and arrows remain editable PowerPoint objects
- Template: one vertical campus technology lecture poster template
- Data storage: lecture content, uploaded images, and generated history are not persisted; background history is kept only in the current browser session state

## Deployment

The project includes Meoo runtime configuration and can be deployed with:

```cmd
cd /d "C:\Users\sangu\Documents\Codex\2026-05-31\files-mentioned-by-the-user-222e2ac9252eb153876e248c89502f8"
set "PATH=%CD%\tools\node-v24.15.0-win-x64;%PATH%"
npx @aliyun-meoo/cli deploy --runtime image --force
```

The deployment environment must provide the required AI image service secrets. See `.env.production.example` and `.env.meoo.example` for production examples.

## Workflow

1. Enter the lecture topic, time, location, speaker information, lecture content, and organizer.
2. Upload the speaker portrait and at least one logo.
3. Choose the background model and optionally enter background requirements.
4. Click "生成新海报" to generate an AI background.
5. Drag or resize text, portrait, and logo elements in the preview canvas.
6. Use "微调当前背景" if you want to preserve the general style while refining the background.
7. Export the result as PNG or editable PPTX.
