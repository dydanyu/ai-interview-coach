# AI Interview Coach

一个用于练习 AI Agent 应用开发的全栈项目，当前目标是基于 `React` 和 `NestJS` 搭建一个可逐步演进的 AI 面试陪练平台。

目前仓库已经完成 Day 1 的最小闭环：

- `React` 前端提供输入、发送、加载态和错误提示
- `NestJS` 后端提供 `POST /chat` 接口
- 后端通过 OpenAI 兼容接口调用大模型
- 前后端已经可以本地联调，完成一次完整对话请求

## Tech Stack

- Frontend: `React` + `Vite` + `TypeScript`
- Backend: `NestJS` + `TypeScript`
- Model Access: `openai` SDK with OpenAI-compatible API

## Project Structure

```text
.
├── frontend/   # React + Vite client
├── backend/    # NestJS server
└── README.md
```

## Current Features

- 单轮聊天请求
- 前端基础交互界面
- 后端模块化拆分
- 环境变量读取
- 模型调用封装

## Quick Start

### 1. Install dependencies

```bash
cd frontend && npm install
cd ../backend && npm install
```

### 2. Configure backend env

在 `backend/.env` 中添加以下变量：

```env
OPENAI_API_KEY=your_api_key
OPENAI_BASE_URL=https://api.openai.com/v1
OPENAI_MODEL=qwen-plus
PORT=3001
```

如果你使用的是其他 OpenAI 兼容服务，请将 `OPENAI_BASE_URL` 和 `OPENAI_MODEL` 替换成对应配置。

### 3. Start backend

```bash
cd backend
npm run start:dev
```

默认启动在 `http://localhost:3001`。

### 4. Start frontend

```bash
cd frontend
npm run dev
```

默认启动在 `http://localhost:5173`。

## API

### `POST /chat`

Request:

```json
{
  "message": "请模拟一轮前端转 AI Agent 开发岗位的面试"
}
```

Response:

```json
{
  "reply": "..."
}
```

## Development Notes

- 前端当前直接请求 `http://localhost:3001/chat`
- 后端已开启 CORS，便于本地联调
- 模型调用统一封装在 `backend/src/llm.service.ts`

## Roadmap

- Day 2: 流式输出聊天
- Day 3: Prompt 管理与对话历史
- Day 4: RAG 接入
- Day 5: Tool Calling
- Day 6+: 面试流程编排、评分与报告

## Why This Project

这个项目的定位不是单纯做一个聊天页面，而是作为“前端转 AI Agent 开发”的练习载体，逐步覆盖这些核心能力：

- AI 应用前后端协作
- 大模型接入与封装
- Agent 基础能力建设
- 面向面试展示的项目表达

后续会继续围绕“AI 面试陪练平台”这个主题，把它完善成一个可演示、可讲解、可用于面试展示的项目。
