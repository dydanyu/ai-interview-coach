import { Injectable } from '@nestjs/common';
import { LlmService } from '../llm.service';

@Injectable()
export class ChatService {
  constructor(private readonly llmService: LlmService) {}

  async chat(message: string) {
    const reply = await this.llmService.chat(message);
    return { reply };
  }
}
