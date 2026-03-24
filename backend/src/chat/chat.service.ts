import { Injectable, NotFoundException } from '@nestjs/common';
import type { Response } from 'express';
import { LlmService } from '../llm.service';
import { ChatMessageDto } from './chat.dto';
import { ChatCompletionMessageParam } from 'openai/resources/chat/completions';
import { INTERVIEW_COACH_SYSTEM_PROMPT } from './chat.constants';
import { randomUUID } from 'crypto';

type ChatRole = 'user' | 'assistant';
type SessionMessage = {
  role: ChatRole;
  content: string;
  createdAt: string;
};
type ChatSession = {
  id: string;
  title: string;
  createdAt: string;
  updatedAt: string;
  messages: SessionMessage[];
};

@Injectable()
export class ChatService {
  constructor(private readonly llmService: LlmService) {}

  private sessions = new Map<string, ChatSession>();

  private now() {
    return new Date().toISOString();
  }

  private buildTitle(message: string) {
    return message.trim().slice(0, 20) || '新对话';
  }

  private getSessionOrThrow(sessionId: string) {
    const session = this.sessions.get(sessionId);
    if (!session) {
      throw new NotFoundException('会话不存在');
    }
    return session;
  }

  private buildModelMessages(
    messages: ChatMessageDto[],
  ): ChatCompletionMessageParam[] {
    const recentMessages = messages.slice(-10);

    return [
      {
        role: 'system',
        content: INTERVIEW_COACH_SYSTEM_PROMPT,
      },
      ...recentMessages,
    ];
  }

  async chat(messages: ChatMessageDto[]) {
    const finalMessages = this.buildModelMessages(messages);
    // 普通模式下，等待模型完整返回后再一次性响应给前端。
    const reply = await this.llmService.chat(finalMessages);
    return { reply };
  }

  // 流式模式下，后端会持续把模型增量内容写入 HTTP 响应。
  async stream(messages: ChatMessageDto[], res: Response) {
    // 用于区分“还没开始输出就失败”和“输出到一半失败”两种情况。
    let hasWrittenContent = false;

    try {
      const finalMessages = this.buildModelMessages(messages);
      const stream = await this.llmService.chatStream(finalMessages);

      for await (const chunk of stream) {
        // 流式响应里只把本次新增文本写回去，前端负责逐段拼接。
        const content = chunk.choices[0]?.delta?.content || '';
        if (content) {
          hasWrittenContent = true;
          res.write(content);
        }
      }
    } catch {
      // 如果上游在开始输出前就失败，返回标准错误响应给前端处理。
      if (!hasWrittenContent) {
        res.status(500).json({ message: '流式输出失败，请稍后重试' });
        return;
      }
    } finally {
      // 正常结束或中途异常都要显式关闭连接，避免前端一直等待。
      if (!res.writableEnded) {
        res.end();
      }
    }
  }

  // 创建新会话
  createSession() {
    const now = this.now();
    const session: ChatSession = {
      id: randomUUID(),
      title: '新会话',
      createdAt: now,
      updatedAt: now,
      messages: [],
    };

    this.sessions.set(session.id, session);
    return {
      id: session.id,
      title: session.title,
      createdAt: session.createdAt,
      updatedAt: session.updatedAt,
      lastMessage: '',
      messageCount: 0,
    };
  }

  // 获取会话列表
  listSessions() {
    return Array.from(this.sessions.values())
      .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))
      .map((session) => ({
        id: session.id,
        title: session.title,
        createdAt: session.createdAt,
        updatedAt: session.updatedAt,
        lastMessage:
          session.messages[session.messages.length - 1]?.content || '',
        messageCount: session.messages.length,
      }));
  }

  // 获取单个会话消息历史
  getSessionMessages(sessionId: string) {
    const session = this.getSessionOrThrow(sessionId);
    return {
      id: session.id,
      title: session.title,
      messages: session.messages,
    };
  }

  // 删除指定会话
  deleteSession(sessionId: string) {
    this.getSessionOrThrow(sessionId);
    this.sessions.delete(sessionId);
    return { success: true };
  }

  // 指定会话下继续聊天
  async streamSessionChat(sessionId: string, message: string, res: Response) {
    const session = this.getSessionOrThrow(sessionId);
    const isFirstUserMessage = session.messages.length === 0;
    const userMessage: SessionMessage = {
      role: 'user',
      content: message,
      createdAt: this.now(),
    };

    session.messages.push(userMessage);

    if (isFirstUserMessage) {
      session.title = this.buildTitle(message);
    }

    session.updatedAt = this.now();

    const finalMessages = this.buildModelMessages(session.messages);

    let hasWrittenContent = false;
    let assistantReply = '';

    try {
      const stream = await this.llmService.chatStream(finalMessages);

      for await (const chunk of stream) {
        const content = chunk.choices[0]?.delta?.content || '';
        if (content) {
          hasWrittenContent = true;
          assistantReply += content;
          res.write(content);
        }
      }
      if (assistantReply) {
        session.messages.push({
          role: 'assistant',
          content: assistantReply,
          createdAt: this.now(),
        });
        session.updatedAt = this.now();
      }
    } catch {
      if (!hasWrittenContent) {
        res.status(500).json({ message: '流式输出失败，请稍后重试' });
        return;
      }
    } finally {
      if (!res.writableEnded) {
        res.end();
      }
    }
  }
}
