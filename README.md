# 校园科技讲座 AI 海报生成工具

一个 Next.js + TypeScript 全栈应用。用户填写讲座信息、上传主讲人头像和 1-2 个 Logo 后，系统生成无文字科技风背景，并按固定模板合成可直接下载的竖版 PNG 海报。

## 运行

```bash
npm install
npm run dev
```

打开 `http://localhost:3000`。

## AI 背景配置

默认使用 `mock` provider，会生成一张无文字的蓝色科技风 SVG 背景，适合本地开发和无密钥演示。

复制 `.env.example` 为 `.env.local` 后可以切换 provider：

```bash
AI_IMAGE_PROVIDER=openai
AI_IMAGE_API_KEY=your_api_key
AI_IMAGE_MODEL=gpt-image-1.5
```

`openai` provider 会请求 Images API，并要求模型生成无文字、无 Logo、无水印的蓝色科技风背景。无论背景来自 AI 还是 mock，最终文字、头像和 Logo 都由服务端模板确定性合成。

## 输出规格

- 格式：PNG
- 可选导出：PPTX，文字、头像、Logo、分隔符和箭头作为 PowerPoint 对象导出，可在 PPT 中移动和编辑；AI 背景作为底图导出。
- 尺寸：`1209 x 1814`
- 模板：单一竖版校园科技讲座模板
- 数据保存：不保存用户数据和生成历史
