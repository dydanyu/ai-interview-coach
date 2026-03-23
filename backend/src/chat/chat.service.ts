import { Injectable } from '@nestjs/common';
import type { Response } from 'express';
import { LlmService } from '../llm.service';
import { ChatMessageDto } from './chat.dto';
import { ChatCompletionMessageParam } from 'openai/resources/chat/completions';
import { INTERVIEW_COACH_SYSTEM_PROMPT } from './chat.constants';

@Injectable()
export class ChatService {
  constructor(private readonly llmService: LlmService) {}
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
}
