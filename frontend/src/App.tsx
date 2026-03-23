import { useEffect, useRef, useState } from "react";
import "./App.css";

type ChatRole = "user" | "assistant";

type ChatMessage = {
  role: ChatRole;
  content: string;
  createdAt: string;
};

function App() {
  const [input, setInput] = useState("");
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [copiedMessageIndex, setCopiedMessageIndex] = useState<number | null>(
    null,
  );
  const [showClearDialog, setShowClearDialog] = useState(false);
  const conversationRef = useRef<HTMLDivElement | null>(null);
  const inputRef = useRef<HTMLTextAreaElement | null>(null);
  const abortControllerRef = useRef<AbortController | null>(null);

  useEffect(() => {
    if (!conversationRef.current) return;

    conversationRef.current.scrollTo({
      top: conversationRef.current.scrollHeight,
      behavior: "smooth",
    });
  }, [messages, loading]);

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  const runConversation = async (
    userMessage: ChatMessage,
    nextRequestMessages: ChatMessage[],
    options?: { reuseLastAssistant?: boolean },
  ) => {
    const assistantPlaceholder: ChatMessage = {
      role: "assistant",
      content: "",
      createdAt: new Date().toLocaleTimeString([], {
        hour: "2-digit",
        minute: "2-digit",
      }),
    };
    setError("");
    setLoading(true);
    abortControllerRef.current = new AbortController();

    // 普通发送插入新消息；重新生成时复用上一条 user，只替换末尾 assistant。
    setMessages((prev) => {
      if (options?.reuseLastAssistant) {
        const next = [...prev];
        const lastIndex = next.length - 1;

        if (next[lastIndex]?.role === "assistant") {
          next[lastIndex] = assistantPlaceholder;
          return next;
        }
      }

      return [...prev, userMessage, assistantPlaceholder];
    });

    try {
      const res = await fetch("http://localhost:3001/chat/stream", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ messages: nextRequestMessages }),
        signal: abortControllerRef.current.signal,
      });

      if (!res.ok) {
        let errorMessage = "流式请求失败，请检查后端接口";

        try {
          const errorData = (await res.json()) as {
            message?: string | string[];
          };
          if (Array.isArray(errorData.message)) {
            errorMessage = errorData.message.join("；");
          } else if (errorData.message) {
            errorMessage = errorData.message;
          }
        } catch {
          // 非 JSON 错误响应时，保留默认提示即可。
        }

        throw new Error(errorMessage);
      }

      if (!res.body) {
        throw new Error("流式响应为空，请检查后端接口");
      }

      const reader = res.body.getReader();
      const decoder = new TextDecoder();

      // 持续读取后端返回的文本块，并追加到现有 assistant 消息里。
      while (true) {
        const { value, done } = await reader.read();

        if (done) break;

        const chunk = decoder.decode(value, { stream: true });
        setMessages((prev) => {
          const next = [...prev];
          const lastIndex = next.length - 1;

          if (next[lastIndex]?.role === "assistant") {
            next[lastIndex] = {
              ...next[lastIndex],
              content: next[lastIndex].content + chunk,
            };
          }

          return next;
        });
      }
    } catch (err) {
      if (err instanceof DOMException && err.name === "AbortError") {
        return;
      }

      const errorMessage =
        err instanceof Error
          ? err.message
          : "请求失败，请检查后端服务和模型配置";

      setError(errorMessage);

      // 如果失败，移除尾部空 assistant 占位，避免页面残留一条空消息。
      setMessages((prev) => {
        const next = [...prev];
        const last = next[next.length - 1];

        if (last?.role === "assistant" && !last.content) {
          next.pop();
        }

        return next;
      });
    } finally {
      abortControllerRef.current = null;
      setLoading(false);
    }
  };

  const handleSend = async () => {
    const trimmedInput = input.trim();
    if (!trimmedInput || loading) return;

    const userMessage: ChatMessage = {
      role: "user",
      content: trimmedInput,
      createdAt: new Date().toLocaleTimeString([], {
        hour: "2-digit",
        minute: "2-digit",
      }),
    };

    const requestMessages = [...messages, userMessage];

    setInput("");
    await runConversation(userMessage, requestMessages);
  };

  const handleStopGenerating = () => {
    abortControllerRef.current?.abort();
    abortControllerRef.current = null;
    setLoading(false);
    inputRef.current?.focus();
  };

  const handleClearConversation = () => {
    if (loading || messages.length === 0) {
      setInput("");
      setError("");
      return;
    }

    setShowClearDialog(true);
  };

  const cancelClearConversation = () => {
    setShowClearDialog(false);
    inputRef.current?.focus();
  };

  const confirmClearConversation = () => {
    setShowClearDialog(false);

    setInput("");
    setMessages([]);
    setError("");
    inputRef.current?.focus();
  };

  const handleCopyMessage = async (content: string, index: number) => {
    try {
      await navigator.clipboard.writeText(content);
      setCopiedMessageIndex(index);
      window.setTimeout(() => {
        setCopiedMessageIndex((current) =>
          current === index ? null : current,
        );
      }, 1500);
    } catch {
      setError("复制失败，请检查浏览器权限");
    }
  };

  return (
    <main className="page">
      <section className="panel">
        <div className="panel__header">
          <div>
            <p className="eyebrow">Day 3</p>
            <h1 className="panel__title">AI 陪练</h1>
            <p className="subtitle">
              当前目标是支持多轮上下文、消息列表和流式更新。
            </p>
          </div>
          <div className="panel__badge">
            <span className="panel__badge-dot" />
            Streaming Ready
          </div>
        </div>
        <section className="result">
          <div className="result__header">
            <div>
              <p className="result__eyebrow">Conversation</p>
              <h2 className="result__title">对话记录</h2>
            </div>
            {loading ? <span className="status">正在流式输出</span> : null}
          </div>

          {error ? <div className="error">{error}</div> : null}

          <div className="conversation" ref={conversationRef}>
            {messages.length === 0 ? (
              <div className="empty-state">这里会显示多轮对话记录。</div>
            ) : (
              messages.map((message, index) => (
                <article
                  key={`${message.role}-${index}`}
                  className={`message message--${message.role}`}
                >
                  <div className="message__label">
                    <span>{message.role === "user" ? "你" : "AI"}</span>
                    <time className="message__time">{message.createdAt}</time>
                  </div>
                  <div className="message__content">
                    {message.content ? (
                      message.content
                    ) : (
                      <span
                        className="typing-indicator"
                        aria-label="AI 正在输入"
                      >
                        <span />
                        <span />
                        <span />
                      </span>
                    )}
                  </div>
                  {message.role === "assistant" && message.content ? (
                    <div className="message__actions">
                      <button
                        className={`message__action ${
                          copiedMessageIndex === index
                            ? "message__action--copied"
                            : "message__action--copy"
                        }`}
                        type="button"
                        onClick={() =>
                          handleCopyMessage(message.content, index)
                        }
                      >
                        <span className="message__action-icon" aria-hidden="true">
                          <svg
                            className="message__action-glyph message__action-glyph--copy"
                            viewBox="0 0 20 20"
                            fill="none"
                          >
                            <path
                              d="M7.5 7.5H5.75C4.92157 7.5 4.25 8.17157 4.25 9V14.25C4.25 15.0784 4.92157 15.75 5.75 15.75H11C11.8284 15.75 12.5 15.0784 12.5 14.25V12.5"
                              stroke="currentColor"
                              strokeWidth="1.5"
                              strokeLinecap="round"
                              strokeLinejoin="round"
                            />
                            <path
                              d="M9 4.25H14.25C15.0784 4.25 15.75 4.92157 15.75 5.75V11C15.75 11.8284 15.0784 12.5 14.25 12.5H9C8.17157 12.5 7.5 11.8284 7.5 11V5.75C7.5 4.92157 8.17157 4.25 9 4.25Z"
                              stroke="currentColor"
                              strokeWidth="1.5"
                              strokeLinecap="round"
                              strokeLinejoin="round"
                            />
                          </svg>
                          <svg
                            className="message__action-glyph message__action-glyph--check"
                            viewBox="0 0 20 20"
                            fill="none"
                          >
                            <path
                              d="M5.5 10.5L8.5 13.5L14.5 7"
                              stroke="currentColor"
                              strokeWidth="1.8"
                              strokeLinecap="round"
                              strokeLinejoin="round"
                            />
                          </svg>
                        </span>
                        <span className="message__action-text">
                          {copiedMessageIndex === index ? "已复制" : "复制"}
                        </span>
                      </button>
                    </div>
                  ) : null}
                </article>
              ))
            )}
          </div>
        </section>

        <section className="composer">
          <div className="composer__header">
            <label className="label" htmlFor="message">
              输入你的问题
            </label>
            <span className="composer__hint">支持多轮上下文继续追问</span>
          </div>

          <textarea
            id="message"
            ref={inputRef}
            className="textarea"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                handleSend();
              }
            }}
            placeholder="例如：请模拟前端转 AI Agent 开发岗位的面试开场"
            rows={1}
          />

          <div className="actions">
            {loading ? (
              <button
                className="button button--danger"
                onClick={handleStopGenerating}
              >
                停止生成
              </button>
            ) : (
              <button
                className="button"
                onClick={handleSend}
                disabled={!input.trim()}
              >
                发送
              </button>
            )}

            <button
              className="button button--ghost"
              onClick={handleClearConversation}
              disabled={loading}
            >
              清空会话
            </button>
          </div>
        </section>
      </section>

      {showClearDialog ? (
        <div
          className="modal-backdrop"
          onClick={cancelClearConversation}
          role="presentation"
        >
          <section
            className="modal"
            role="dialog"
            aria-modal="true"
            aria-labelledby="clear-dialog-title"
            onClick={(event) => event.stopPropagation()}
          >
            <h2 id="clear-dialog-title" className="modal__title">
              清空当前会话？
            </h2>
            <p className="modal__content">
              这会移除当前页面中的所有消息记录，且无法恢复。
            </p>
            <div className="modal__actions">
              <button
                className="button button--ghost"
                onClick={cancelClearConversation}
              >
                取消
              </button>
              <button
                className="button button--danger"
                onClick={confirmClearConversation}
              >
                确认清空
              </button>
            </div>
          </section>
        </div>
      ) : null}
    </main>
  );
}

export default App;
