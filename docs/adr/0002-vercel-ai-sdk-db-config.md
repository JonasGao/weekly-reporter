# 使用 Vercel AI SDK + 数据库配置替代 raw fetch + 环境变量

引入 Vercel AI SDK（`ai` + `@ai-sdk/openai` + `@ai-sdk/anthropic`）作为 AI 调用层，将 AI 配置（协议格式、URL、Key、模型）从环境变量迁移到数据库，通过设置页面管理。

## 背景

原有方案：`src/lib/ai.ts` 通过 `fetch` 直接调用 OpenAI-compatible 接口，配置通过 `.env` 注入。三个 AI 功能（润色、扩写、风格统一）仅有 stub 实现。

痛点：
- 换模型/换 Key 需要改 `.env` 重启，无 UI 可操作
- 手写 fetch + JSON.parse 脆弱，不支持结构化输出
- 无法切换 Anthropic 协议
- 新增 AI 功能需重复写 fetch 逻辑

## 决策

1. **SDK 选型**：Vercel AI SDK。统一 `generateObject` 接口处理结构化输出，底层 provider 可切换
2. **协议支持**：OpenAI-compatible（`@ai-sdk/openai`，覆盖 Qwen/DeepSeek 等）和 Anthropic（`@ai-sdk/anthropic`）。不支持 Ollama
3. **配置存储**：数据库单行记录，完全移除环境变量。用户在设置页面配置协议格式、URL、Key、模型
4. **模型列表**：OpenAI 协议支持自动拉取（`GET /models`），失败则回退手动输入；Anthropic 协议始终手动输入。拉取结果缓存，提供刷新按钮
5. **连接测试**：设置页提供手动测试按钮，不自动测试
6. **未配置时的 UI**：AI 功能入口可见，点击后提示「请先配置 AI」并引导至设置页
7. **风格系统**：`styles.ts` 保持不变（temperature、score weights、system prompt 均不动）
8. **占位功能**：先搭好 AI SDK 调用框架，三个 stub 功能（润色、扩写、风格统一）的 prompt 后续再调
9. **流式输出**：当前阶段保持结构化输出，框架预留 streaming 能力

## 为什么选 Vercel AI SDK 而非其他

| 方案 | 取舍 |
|------|------|
| raw fetch（现状） | 零依赖但每次调用重复写 fetch/parse，不支持结构化输出，换协议要重写 |
| OpenAI SDK | 只能对接 OpenAI 协议，无法支持 Anthropic |
| LangChain | 过重，本项目只需要 chat completion + 结构化输出 |
| **Vercel AI SDK** | 轻量、原生 Next.js 集成、`generateObject` 解决结构化输出、多 provider 切换 |
