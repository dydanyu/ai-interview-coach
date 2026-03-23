import { useState } from 'react';
import './App.css';

function App() {
  const [message, setMessage] = useState('');
  const [reply, setReply] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleSend = async () => {
    const trimmedMessage = message.trim();
    if (!trimmedMessage) return;

    setLoading(true);
    setReply('');
    setError('');

    try {
      const res = await fetch('http://localhost:3001/chat/stream', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ message: trimmedMessage }),
      });

      if (!res.ok || !res.body) {
        throw new Error('流式请求失败，请检查后端接口');
      }

      const reader = res.body.getReader();
      const decoder = new TextDecoder();

      // 持续读取后端返回的文本块，并追加到现有回复里。
      while (true) {
        const { value, done } = await reader.read();

        if (done) break;

        const chunk = decoder.decode(value, { stream: true });
        setReply((prev) => prev + chunk);
      }
    } catch (err) {
      const message =
        err instanceof Error
          ? err.message
          : '请求失败，请检查后端服务和模型配置';
      setError(message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <main className="page">
      <section className="panel">
        <div className="panel__header">
          <p className="eyebrow">Day 2</p>
          <h1>AI 陪练</h1>
          <p className="subtitle">
            当前目标是把普通聊天升级成流式输出聊天。
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
            {loading ? '流式生成中...' : '发送'}
          </button>
          <button
            className="button button--ghost"
            onClick={() => {
              setMessage('');
              setReply('');
              setError('');
            }}
            disabled={loading}
          >
            清空
          </button>
        </div>

        <section className="result">
          <div className="result__header">
            <h2>模型回复</h2>
            {loading ? <span className="status">正在流式输出</span> : null}
          </div>

          {error ? <div className="error">{error}</div> : null}

          <div className="reply">
            {reply || '这里会逐步显示模型的流式返回内容。'}
          </div>
        </section>
      </section>
    </main>
  );
}

export default App;
