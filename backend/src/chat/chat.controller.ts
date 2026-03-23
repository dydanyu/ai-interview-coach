import { Body, Controller, Post, Res } from '@nestjs/common';
import type { Response } from 'express';
import { ChatService } from './chat.service';
import { ChatDto } from './chat.dto';

@Controller('chat')
export class ChatController {
  constructor(private readonly chatService: ChatService) {}

  @Post()
  async chat(@Body() body: ChatDto) {
    return this.chatService.chat(body.message);
  }

  @Post('stream')
  async stream(@Body() body: ChatDto, @Res() res: Response) {
    // 使用底层 Response 直接写入数据，才能持续把模型增量内容推给前端。
    res.setHeader('Content-Type', 'text/plain; charset=utf-8');
    res.setHeader('Cache-Control', 'no-cache, no-transform');
    res.setHeader('Connection', 'keep-alive');
    await this.chatService.stream(body.message, res);
  }
}
