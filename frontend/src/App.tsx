import {
  type MouseEvent,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import "./App.css";

const API_BASE_URL = "http://localhost:3001/chat";

type ChatRole = "user" | "assistant";

type ChatMessage = {
  role: ChatRole;
  content: string;
  createdAt: string;
};

type ChatSessionSummary = {
  id: string;
  title: string;
  createdAt: string;
  updatedAt: string;
  lastMessage: string;
  messageCount: number;
};

type SessionDetail = {
  id: string;
  title: string;
  messages: ChatMessage[];
};

function formatMessageTime(value: string) {
  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return value;
  }

  return date.toLocaleTimeString([], {
    hour: "2-digit",
    minute: "2-digit",
  });
}

function formatSessionTime(value: string) {
  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return value;
  }

  return date.toLocaleString([], {
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function getSessionDisplayTitle(session: ChatSessionSummary) {
  if (session.title !== "新会话") {
    return session.title;
  }

  return session.lastMessage.slice(0, 20) || session.title;
}

function App() {
  const [sessions, setSessions] = useState<ChatSessionSummary[]>([]);
  const [activeSessionId, setActiveSessionId] = useState<string | null>(null);
  const [input, setInput] = useState("");
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [loading, setLoading] = useState(false);
  const [sidebarLoading, setSidebarLoading] = useState(false);
  const [deletingSessionId, setDeletingSessionId] = useState<string | null>(
    null,
  );
  const [pendingDeleteSession, setPendingDeleteSession] =
    useState<ChatSessionSummary | null>(null);
  const [error, setError] = useState("");
  const [copiedMessageIndex, setCopiedMessageIndex] = useState<number | null>(
    null,
  );
  const conversationRef = useRef<HTMLDivElement | null>(null);
  const inputRef = useRef<HTMLTextAreaElement | null>(null);
  const abortControllerRef = useRef<AbortController | null>(null);
  const sessionMessagesRef = useRef<Record<string, ChatMessage[]>>({});

  const activeSession = useMemo(
    () => sessions.find((session) => session.id === activeSessionId) ?? null,
    [activeSessionId, sessions],
  );

  const assistantMessageCount = useMemo(
    () => messages.filter((message) => message.role === "assistant").length,
    [messages],
  );

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

  const parseErrorResponse = useCallback(
    async (res: Response, fallback: string) => {
      let errorMessage = fallback;

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

      return errorMessage;
    },
    [],
  );

  const fetchSessions = useCallback(async () => {
    const res = await fetch(`${API_BASE_URL}/sessions`);

    if (!res.ok) {
      throw new Error(
        await parseErrorResponse(res, "获取会话列表失败，请检查后端接口"),
      );
    }

    return (await res.json()) as ChatSessionSummary[];
  }, [parseErrorResponse]);

  const createSession = useCallback(async () => {
    const res = await fetch(`${API_BASE_URL}/sessions`, {
      method: "POST",
    });

    if (!res.ok) {
      throw new Error(
        await parseErrorResponse(res, "创建会话失败，请检查后端接口"),
      );
    }

    return (await res.json()) as ChatSessionSummary;
  }, [parseErrorResponse]);

  const deleteSession = useCallback(
    async (sessionId: string) => {
      const res = await fetch(`${API_BASE_URL}/sessions/${sessionId}`, {
        method: "DELETE",
      });

      if (!res.ok) {
        throw new Error(
          await parseErrorResponse(res, "删除会话失败，请检查后端接口"),
        );
      }
    },
    [parseErrorResponse],
  );

  const fetchSessionMessages = useCallback(
    async (sessionId: string, sourceSessions: ChatSessionSummary[]) => {
      const res = await fetch(`${API_BASE_URL}/sessions/${sessionId}/messages`);

      if (!res.ok) {
        if (res.status === 404) {
          return {
            id: sessionId,
            title:
              sourceSessions.find((session) => session.id === sessionId)
                ?.title ?? "新会话",
            messages: sessionMessagesRef.current[sessionId] ?? [],
          } as SessionDetail;
        }

        throw new Error(
          await parseErrorResponse(res, "获取会话详情失败，请检查后端接口"),
        );
      }

      return (await res.json()) as SessionDetail;
    },
    [parseErrorResponse],
  );

  const syncSessionMessages = (
    sessionId: string,
    nextMessages: ChatMessage[],
  ) => {
    sessionMessagesRef.current[sessionId] = nextMessages;
  };

  const loadSessionMessages = useCallback(
    async (sessionId: string, sourceSessions: ChatSessionSummary[]) => {
      const detail = await fetchSessionMessages(sessionId, sourceSessions);
      setActiveSessionId(sessionId);
      setMessages(detail.messages);
      syncSessionMessages(sessionId, detail.messages);
      setCopiedMessageIndex(null);
    },
    [fetchSessionMessages],
  );

  const refreshSessions = async (preferredSessionId?: string) => {
    const nextSessions = await fetchSessions();
    setSessions(nextSessions);

    if (!activeSessionId && preferredSessionId) {
      setActiveSessionId(preferredSessionId);
    }
  };

  useEffect(() => {
    const bootstrap = async () => {
      try {
        setSidebarLoading(true);
        setError("");

        const sessionList = await fetchSessions();

        if (sessionList.length === 0) {
          const newSession = await createSession();
          sessionMessagesRef.current[newSession.id] = [];
          setSessions([newSession]);
          setActiveSessionId(newSession.id);
          setMessages([]);
          return;
        }

        setSessions(sessionList);
        await loadSessionMessages(sessionList[0].id, sessionList);
      } catch (err) {
        setError(
          err instanceof Error ? err.message : "初始化会话失败，请检查后端接口",
        );
      } finally {
        setSidebarLoading(false);
      }
    };

    void bootstrap();
  }, [createSession, fetchSessions, loadSessionMessages]);

  const runConversation = async (
    sessionId: string,
    userMessage: ChatMessage,
  ) => {
    const assistantPlaceholder: ChatMessage = {
      role: "assistant",
      content: "",
      createdAt: new Date().toISOString(),
    };

    setError("");
    setLoading(true);
    abortControllerRef.current = new AbortController();

    setMessages((prev) => {
      const next = [...prev, userMessage, assistantPlaceholder];
      syncSessionMessages(sessionId, next);
      return next;
    });

    try {
      const res = await fetch(`${API_BASE_URL}/sessions/${sessionId}/stream`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ message: userMessage.content }),
        signal: abortControllerRef.current.signal,
      });

      if (!res.ok) {
        throw new Error(
          await parseErrorResponse(res, "流式请求失败，请检查后端接口"),
        );
      }

      if (!res.body) {
        throw new Error("流式响应为空，请检查后端接口");
      }

      const reader = res.body.getReader();
      const decoder = new TextDecoder();

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

          syncSessionMessages(sessionId, next);
          return next;
        });
      }

      await refreshSessions(sessionId);
    } catch (err) {
      if (err instanceof DOMException && err.name === "AbortError") {
        return;
      }

      setError(
        err instanceof Error
          ? err.message
          : "请求失败，请检查后端服务和模型配置",
      );

      setMessages((prev) => {
        const next = [...prev];
        const last = next[next.length - 1];

        if (last?.role === "assistant" && !last.content) {
          next.pop();
        }

        syncSessionMessages(sessionId, next);
        return next;
      });
    } finally {
      abortControllerRef.current = null;
      setLoading(false);
    }
  };

  const handleCreateSession = async () => {
    if (loading) return;

    try {
      setError("");
      const newSession = await createSession();
      sessionMessagesRef.current[newSession.id] = [];
      setSessions((prev) => [newSession, ...prev]);
      setActiveSessionId(newSession.id);
      setMessages([]);
      setInput("");
      setCopiedMessageIndex(null);
      inputRef.current?.focus();
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "创建会话失败，请检查后端接口",
      );
    }
  };

  const handleSelectSession = async (sessionId: string) => {
    if (loading || sessionId === activeSessionId) return;

    try {
      setSidebarLoading(true);
      setError("");
      await loadSessionMessages(sessionId, sessions);
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "切换会话失败，请检查后端接口",
      );
    } finally {
      setSidebarLoading(false);
    }
  };

  const openDeleteSessionDialog = (
    session: ChatSessionSummary,
    event: MouseEvent<HTMLButtonElement>,
  ) => {
    event.stopPropagation();
    setPendingDeleteSession(session);
  };

  const closeDeleteSessionDialog = () => {
    if (deletingSessionId) return;
    setPendingDeleteSession(null);
    inputRef.current?.focus();
  };

  const handleConfirmDeleteSession = async () => {
    if (!pendingDeleteSession || loading) return;

    const sessionId = pendingDeleteSession.id;
    const remainingSessions = sessions.filter(
      (session) => session.id !== sessionId,
    );

    try {
      setDeletingSessionId(sessionId);
      setError("");
      await deleteSession(sessionId);
      delete sessionMessagesRef.current[sessionId];
      setPendingDeleteSession(null);
      setSessions(remainingSessions);

      if (remainingSessions.length === 0) {
        const newSession = await createSession();
        sessionMessagesRef.current[newSession.id] = [];
        setSessions([newSession]);
        setActiveSessionId(newSession.id);
        setMessages([]);
        inputRef.current?.focus();
        return;
      }

      if (activeSessionId === sessionId) {
        const nextSession = remainingSessions[0];
        await loadSessionMessages(nextSession.id, remainingSessions);
      }
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "删除会话失败，请检查后端接口",
      );
    } finally {
      setDeletingSessionId(null);
    }
  };

  const handleSend = async () => {
    const trimmedInput = input.trim();
    if (!trimmedInput || loading) return;

    let sessionId = activeSessionId;

    try {
      if (!sessionId) {
        const newSession = await createSession();
        sessionMessagesRef.current[newSession.id] = [];
        setSessions((prev) => [newSession, ...prev]);
        setActiveSessionId(newSession.id);
        setMessages([]);
        sessionId = newSession.id;
      }
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "创建会话失败，请检查后端接口",
      );
      return;
    }

    const userMessage: ChatMessage = {
      role: "user",
      content: trimmedInput,
      createdAt: new Date().toISOString(),
    };

    setInput("");
    await runConversation(sessionId, userMessage);
  };

  const handleStopGenerating = () => {
    abortControllerRef.current?.abort();
    abortControllerRef.current = null;
    setLoading(false);
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
      <section className="layout">
        <aside className="sidebar">
          <div className="sidebar__header">
            <div>
              <p className="eyebrow">Day 4</p>
              <h1 className="sidebar__title">会话管理</h1>
              <p className="subtitle">
                把多轮聊天升级为可创建、切换和恢复的会话体验。
              </p>
            </div>

            <button
              className="button sidebar__create"
              onClick={() => void handleCreateSession()}
            >
              新建会话
            </button>
          </div>

          <div className="sidebar__meta">
            <span className="meta-chip">会话数 {sessions.length}</span>
            <span className="meta-chip">
              {sidebarLoading ? "同步中" : "会话已就绪"}
            </span>
          </div>

          <div className="session-list">
            {sessions.length === 0 ? (
              <div className="session-empty">
                暂无会话，点击“新建会话”开始第一轮 AI 陪练。
              </div>
            ) : (
              sessions.map((session) => (
                <article
                  key={session.id}
                  className={`session-item ${
                    session.id === activeSessionId ? "session-item--active" : ""
                  }`}
                >
                  <button
                    type="button"
                    className="session-item__surface"
                    onClick={() => void handleSelectSession(session.id)}
                  >
                    <div className="session-item__title">
                      {getSessionDisplayTitle(session)}
                    </div>
                    <div className="session-item__meta">
                      <span>{session.messageCount} 条消息</span>
                      <span>{formatSessionTime(session.updatedAt)}</span>
                    </div>
                    <div className="session-item__preview">
                      {session.lastMessage ||
                        "还没有消息，开始你的第一轮提问吧。"}
                    </div>
                  </button>

                  <div className="session-item__actions">
                    <button
                      type="button"
                      className="session-delete"
                      onClick={(event) =>
                        openDeleteSessionDialog(session, event)
                      }
                      disabled={loading || deletingSessionId === session.id}
                      aria-label={`删除会话 ${getSessionDisplayTitle(session)}`}
                    >
                      {deletingSessionId === session.id ? "删除中" : "删除"}
                    </button>
                  </div>
                </article>
              ))
            )}
          </div>
        </aside>

        <section className="panel">
          <div className="panel__header">
            <div>
              <p className="eyebrow">Day 4</p>
              <h2 className="panel__title">
                {activeSession
                  ? getSessionDisplayTitle(activeSession)
                  : "AI 陪练"}
              </h2>
              <p className="subtitle">
                当前目标是支持会话切换、历史恢复和基于 session 的流式对话。
              </p>
            </div>

            <div className="panel__meta">
              <span className="meta-chip">消息 {messages.length}</span>
              <span className="meta-chip">AI 回复 {assistantMessageCount}</span>
              <div className="panel__badge">
                <span className="panel__badge-dot" />
                {loading ? "Streaming" : "Session Ready"}
              </div>
            </div>
          </div>

          <section className="result">
            <div className="result__header">
              <div>
                <p className="result__eyebrow">Conversation</p>
                <h3 className="result__title">当前会话记录</h3>
              </div>
              {loading ? <span className="status">正在流式输出</span> : null}
            </div>

            {error ? <div className="error">{error}</div> : null}

            <div className="conversation" ref={conversationRef}>
              {messages.length === 0 ? (
                <div className="empty-state">
                  当前会话还没有消息，可以直接输入问题开始面试陪练。
                </div>
              ) : (
                messages.map((message, index) => (
                  <article
                    key={`${message.role}-${index}`}
                    className={`message message--${message.role}`}
                  >
                    <div className="message__label">
                      <span>{message.role === "user" ? "你" : "AI"}</span>
                      <time className="message__time">
                        {formatMessageTime(message.createdAt)}
                      </time>
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
                          <span
                            className="message__action-icon"
                            aria-hidden="true"
                          >
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
              <span className="composer__hint">
                当前基于 session 发送消息，支持切换会话继续追问
              </span>
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
                  void handleSend();
                }
              }}
              placeholder="例如：请继续追问我为什么想从前端转向 AI Agent 开发"
              rows={1}
            />

            <div className="actions">
              <button
                className="button button--ghost"
                onClick={() => void handleCreateSession()}
                disabled={loading}
              >
                新建会话
              </button>

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
                  onClick={() => void handleSend()}
                  disabled={!input.trim() || sidebarLoading}
                >
                  发送
                </button>
              )}
            </div>
          </section>
        </section>
      </section>

      {pendingDeleteSession ? (
        <div
          className="modal-backdrop"
          onClick={closeDeleteSessionDialog}
          role="presentation"
        >
          <section
            className="modal"
            role="dialog"
            aria-modal="true"
            aria-labelledby="delete-session-title"
            onClick={(event) => event.stopPropagation()}
          >
            <p className="modal__eyebrow">Delete Session</p>
            <h2 id="delete-session-title" className="modal__title">
              删除当前会话？
            </h2>
            <p className="modal__content">
              将删除“{getSessionDisplayTitle(pendingDeleteSession)}
              ”及其全部消息记录， 且无法恢复。
            </p>
            <div className="modal__actions">
              <button
                className="button button--ghost"
                onClick={closeDeleteSessionDialog}
                disabled={Boolean(deletingSessionId)}
              >
                取消
              </button>
              <button
                className="button button--danger"
                onClick={() => void handleConfirmDeleteSession()}
                disabled={Boolean(deletingSessionId)}
              >
                {deletingSessionId ? "删除中..." : "确认删除"}
              </button>
            </div>
          </section>
        </div>
      ) : null}
    </main>
  );
}

export default App;
