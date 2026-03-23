# Backend

这个目录是 `AI Interview Coach` 的后端项目，使用 `NestJS` 和 `TypeScript` 搭建。

当前版本的目标是完成 Day 1 的最小后端闭环：

- 提供 `POST /chat` 接口
- 接收前端传入的 `message`
- 通过 OpenAI 兼容接口调用模型
- 将模型返回内容整理后返回给前端

## Scripts

```bash
npm install
npm run start:dev
```

其他常用命令：

```bash
npm run build
npm run start
npm run start:prod
npm run lint
npm run test
npm run test:e2e
```

## Environment Variables

在 `backend/.env` 中添加：

```env
OPENAI_API_KEY=your_api_key
OPENAI_BASE_URL=https://api.openai.com/v1
OPENAI_MODEL=qwen-plus
PORT=3001
```

说明：

- `OPENAI_API_KEY`: 模型服务密钥
- `OPENAI_BASE_URL`: OpenAI 兼容接口地址
- `OPENAI_MODEL`: 模型名称
- `PORT`: 本地服务端口，默认 `3001`

## Local Development

启动命令：

```bash
npm run start:dev
```

默认服务地址：

```text
http://localhost:3001
```

当前已开启 CORS，便于本地前端联调。

## API

### `POST /chat`

Request:

```json
{
  "message": "请模拟一轮 AI Agent 开发岗位的面试"
}
```

Response:

```json
{
  "reply": "..."
}
```

## Current Structure

- `src/main.ts`: 启动入口和 CORS 配置
- `src/app.module.ts`: 根模块
- `src/chat/`: 聊天接口和业务逻辑
- `src/llm.service.ts`: 模型调用封装

## Current Responsibilities

当前后端主要承担这些职责：

- 统一管理模型调用
- 对前端隐藏 API Key
- 作为后续 RAG、Tool Calling、会话管理的扩展入口

## Next Steps

后续计划继续补充：

- 流式输出接口
- DTO 和参数校验
- 更清晰的异常处理
- 对话历史管理
- RAG 和工具调用能力
