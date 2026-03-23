import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import OpenAI from 'openai';
import {
  ChatCompletionChunk,
  ChatCompletionMessageParam,
} from 'openai/resources/chat/completions';

@Injectable()
export class LlmService {
  private client: OpenAI;
  private model: string;

  constructor(private configService: ConfigService) {
    this.client = new OpenAI({
      apiKey: this.configService.get('OPENAI_API_KEY'),
      baseURL: this.configService.get('OPENAI_BASE_URL'),
    });
    this.model = this.configService.get('OPENAI_MODEL') || 'qwen-plus';
  }

  async chat(messages: ChatCompletionMessageParam[]): Promise<string> {
    const response = await this.client.chat.completions.create({
      model: this.model,
      messages,
    });

    return response.choices[0].message.content || '模型没有返回内容';
  }

  async chatStream(
    messages: ChatCompletionMessageParam[],
  ): Promise<AsyncIterable<ChatCompletionChunk>> {
    // 开启 stream 后，SDK 会返回一个可异步迭代的增量结果流。
    return this.client.chat.completions.create({
      model: this.model,
      stream: true,
      messages,
    });
  }
}
