import { useState } from "react";
import "./App.css";

type ChatResponse = {
  reply?: string;
  message?: string;
};

function App() {
  const [message, setMessage] = useState("");
  const [reply, setReply] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const handleSend = async () => {
    const trimmedMessage = message.trim();
    if (!trimmedMessage) return;

    setLoading(true);
    setReply("");
    setError("");

    try {
      const res = await fetch("http://localhost:3001/chat", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ message: trimmedMessage }),
      });

      const data = (await res.json()) as ChatResponse;

      if (!res.ok) {
        throw new Error(data.message || "请求失败，请稍后重试");
      }

      setReply(data.reply || "模型没有返回内容");
    } catch (err) {
      const message =
        err instanceof Error
          ? err.message
          : "请求失败，请检查后端服务和模型配置";
      setError(message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <main className="page">
      <section className="panel">
        <div className="panel__header">
          <p className="eyebrow">Day 1</p>
          <h1>AI 陪练</h1>
          <p className="subtitle">
            先跑通 React 到 NestJS 的最小聊天链路，后面再加流式输出、RAG
            和工具调用。
          </p>
        </div>

        <label className="label" htmlFor="message">
          输入你的问题
        </label>
        <textarea
          id="message"
          className="textarea"
          value={message}
          onChange={(e) => setMessage(e.target.value)}
          placeholder="例如：请模拟一轮前端转 AI Agent 开发岗位的自我介绍追问"
          rows={7}
        />

        <div className="actions">
          <button className="button" onClick={handleSend} disabled={loading}>
            {loading ? "请求中..." : "发送"}
          </button>
          <button
            className="button button--ghost"
            onClick={() => {
              setMessage("");
              setReply("");
              setError("");
            }}
            disabled={loading}
          >
            清空
          </button>
        </div>

        <section className="result">
          <div className="result__header">
            <h2>模型回复</h2>
            {loading ? <span className="status">后端处理中</span> : null}
          </div>

          {error ? <div className="error">{error}</div> : null}

          <div className="reply">
            {reply || "这里会显示 NestJS 调用模型后的返回结果。"}
          </div>
        </section>
      </section>
    </main>
  );
}

export default App;
