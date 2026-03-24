import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Post,
  Res,
} from '@nestjs/common';
import type { Response } from 'express';
import { ChatService } from './chat.service';
import { ChatDto, SessionChatDto } from './chat.dto';

@Controller('chat')
export class ChatController {
  constructor(private readonly chatService: ChatService) {}

  @Post()
  async chat(@Body() body: ChatDto) {
    return this.chatService.chat(body.messages);
  }

  @Post('stream')
  async stream(@Body() body: ChatDto, @Res() res: Response) {
    // 使用底层 Response 直接写入数据，才能持续把模型增量内容推给前端。
    res.setHeader('Content-Type', 'text/plain; charset=utf-8');
    res.setHeader('Cache-Control', 'no-cache, no-transform');
    res.setHeader('Connection', 'keep-alive');
    await this.chatService.stream(body.messages, res);
  }

  @Post('sessions')
  createSession() {
    return this.chatService.createSession();
  }

  @Get('sessions')
  listSessions() {
    return this.chatService.listSessions();
  }

  @Get('sessions/:id/messages')
  getSessionMessages(@Param('id') id: string) {
    return this.chatService.getSessionMessages(id);
  }

  @Delete('sessions/:id')
  deleteSession(@Param('id') id: string) {
    return this.chatService.deleteSession(id);
  }

  @Post('sessions/:id/stream')
  async streamSessionChat(
    @Param('id') id: string,
    @Body() body: SessionChatDto,
    @Res() res: Response,
  ) {
    res.setHeader('Content-Type', 'text/plain; charset=utf-8');
    res.setHeader('Cache-Control', 'no-cache, no-transform');
    res.setHeader('Connection', 'keep-alive');
    await this.chatService.streamSessionChat(id, body.message, res);
  }
}
