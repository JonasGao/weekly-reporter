# 📊 智能周报生成工具

一个基于 AI 的工作周报生成助手，通过简单的输入快速生成专业的工作周报。

## 🌟 功能特点

- **直观的用户界面**：简洁明了的输入区域和结果展示
- **智能内容生成**：基于 Dify API 的智能内容生成
- **自动移除 Think 内容**：清理 AI 思考过程，只保留有用内容
- **文本格式化处理**：简单的文本格式化，使结果易于阅读
- **多种结果处理选项**：复制、下载或打印生成的周报
- **钉钉周报集成**：支持直接发送周报到钉钉工作汇报
- **配置持久化**：API 配置和输入内容自动保存
- **数据导入/导出**：支持将输入数据保存为 JSON 文件或从文件加载

## 🚀 使用方法

1. 打开 `index.html` 文件在浏览器中运行
2. 配置 Dify API（需要设置 API URL 和 API Key）
3. (可选) 配置钉钉周报API，用于自动发送周报到钉钉
4. 填写四个输入框：
   - 上周工作计划
   - 上周工作内容
   - 下周工作计划
   - 上周工作额外说明（可选）
5. 点击"生成周报"按钮
6. 查看生成的周报内容
7. 根据需要复制、下载或打印结果
8. 如果配置了钉钉周报API，周报会自动发送到钉钉工作汇报

## 📋 输入格式建议

为获得最佳效果，建议使用以下格式输入工作内容：

```
项目A | 工作项 | 工作内容及进度说明
项目B | 工作项 | 工作内容及进度说明
```

## ⚙️ 配置 Dify API

1. 在 Dify.AI 平台创建一个应用
2. 创建一个 Workflow，添加以下参数：
   - `prev_week_plan`: 上周工作计划
   - `prev_week_work`: 上周工作内容
   - `curr_week_plan`: 下周工作计划
   - `prev_week_additional_notes`: 上周工作额外说明
3. 复制 Workflow 的 API URL 和 API Key
4. 在应用中填入这些配置信息

## 🔄 配置钉钉周报API

1. 在钉钉开放平台创建一个企业内部应用
2. 开通工作通知权限
3. 配置以下信息：
   - 企业ID (CorpId)
   - 应用的AppKey
   - 应用的AppSecret
   - 钉钉用户ID (接收周报的用户ID)
4. 在应用中启用钉钉周报功能并填入配置信息
5. 生成周报后将自动发送到钉钉的工作汇报中

### 📚 钉钉周报API参考文档

本工具使用了以下钉钉开放平台API：

- [日志/周报API使用场景](https://open.dingtalk.com/document/isvapp/log-api-use-cases) - API概述与使用场景
- [创建日志](https://open.dingtalk.com/document/isvapp/create-a-log) - 用于创建和发送周报
- [保存自定义日志内容](https://open.dingtalk.com/document/isvapp/save-custom-log-content) - 自定义日志内容格式
- [查询模板详情](https://open.dingtalk.com/document/isvapp/query-template-details) - 获取周报模板信息
- [获取用户发出的日志列表](https://open.dingtalk.com/document/isvapp/obtains-a-list-of-the-logs-that-are-sent-by) - 查询历史周报

## 🔧 技术实现

- 纯前端实现，无需服务器
- 使用 HTML5, CSS3 和 JavaScript (ES6+)
- 响应式设计，适配不同设备
- localStorage 用于配置和草稿存储
- 模块化代码结构，易于维护
- 钉钉开放平台API集成，支持工作汇报功能
  - 使用OAuth 2.0授权获取access_token
  - 支持周报内容的Markdown格式化
  - 支持钉钉工作汇报自定义模板

## 💡 未来计划

- [x] 集成钉钉工作汇报API
- [ ] 更丰富的报告模板选择
- [ ] 支持在线协作和共享
- [ ] 支持更多的 AI 服务提供商
- [ ] 增加数据统计和可视化功能
- [ ] 支持更多第三方平台集成（如企业微信、飞书等）

## 📄 许可证

MIT License
