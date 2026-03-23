# Frontend

这个目录是 `AI Interview Coach` 的前端项目，使用 `React`、`Vite` 和 `TypeScript` 搭建。

当前版本的目标是完成 Day 1 最小闭环：

- 提供一个聊天输入界面
- 调用后端 `POST /chat`
- 展示加载态、错误提示和模型回复

## Scripts

```bash
npm install
npm run dev
```

其他常用命令：

```bash
npm run build
npm run lint
npm run preview
```

## Local Development

前端默认运行在：

```text
http://localhost:5173
```

当前页面会直接请求：

```text
http://localhost:3001/chat
```

所以本地开发时需要先启动后端服务。

## Current UI Scope

当前前端包含这些基础能力：

- 输入问题并发送请求
- 清空输入和结果
- 展示后端处理中状态
- 展示模型回复
- 展示基础错误信息

## Key File

- `src/App.tsx`: 当前聊天页主逻辑
- `src/App.css`: 页面样式
- `src/index.css`: 全局样式

## Next Steps

后续会继续在前端补这些能力：

- 流式输出逐字渲染
- 对话历史列表
- 面试报告展示
- 简历和 JD 上传入口
- 更完整的状态管理
