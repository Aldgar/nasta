import {
  BadRequestException,
  Body,
  Controller,
  Get,
  Param,
  Post,
  Query,
  Req,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { memoryStorage } from 'multer';
import type { Request } from 'express';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { ChatService } from './chat.service';
import { CreateConversationDto } from './dto/create-conversation.dto';
import { SendMessageDto } from './dto/send-message.dto';
import { ChatFileUploadService } from './chat-file-upload.service';

interface RequestWithUser extends Request {
  user?: { id?: string; userId?: string };
}

@Controller('chat')
@UseGuards(JwtAuthGuard)
export class ChatController {
  constructor(
    private readonly chat: ChatService,
    private readonly fileUploadService: ChatFileUploadService,
  ) {}

  @Post('conversations')
  async createConversation(
    @Req() req: RequestWithUser,
    @Body() dto: CreateConversationDto,
  ) {
    const userId = String(req.user?.userId ?? req.user?.id);
    const result = await this.chat.createConversation(userId, {
      type: dto.type,
      title: dto.title ?? null,
      jobId: dto.jobId ?? null,
      participantIds: dto.participantIds,
    });
    return result;
  }

  @Get('conversations')
  async listConversations(
    @Req() req: RequestWithUser,
    @Query('page') page = '1',
    @Query('pageSize') pageSize = '20',
  ) {
    const userId = String(req.user?.userId ?? req.user?.id);
    return this.chat.listConversations(userId, {
      page: Number.parseInt(page) || 1,
      pageSize: Number.parseInt(pageSize) || 20,
    });
  }

  @Get('conversations/:id/messages')
  async listMessages(
    @Req() req: RequestWithUser,
    @Param('id') id: string,
    @Query('page') page = '1',
    @Query('pageSize') pageSize = '50',
  ) {
    const userId = String(req.user?.userId ?? req.user?.id);
    return this.chat.listMessages(userId, id, {
      page: Number.parseInt(page) || 1,
      pageSize: Number.parseInt(pageSize) || 50,
    });
  }

  @Post('messages')
  async sendMessage(@Req() req: RequestWithUser, @Body() dto: SendMessageDto) {
    const userId = String(req.user?.userId ?? req.user?.id);
    return this.chat.sendMessage(userId, dto);
  }

  @Post('messages/upload')
  @UseInterceptors(
    FileInterceptor('file', {
      storage: memoryStorage(),
      limits: { fileSize: 10 * 1024 * 1024 }, // 10MB
    }),
  )
  async uploadMessageFile(
    @Req() req: RequestWithUser,
    @UploadedFile() file: Express.Multer.File,
    @Body('conversationId') conversationId: string,
    @Body('type') type: 'image' | 'document',
  ) {
    if (!file) {
      throw new BadRequestException('File is required');
    }
    if (!conversationId) {
      throw new BadRequestException('Conversation ID is required');
    }
    if (!type || !['image', 'document'].includes(type)) {
      throw new BadRequestException('Type must be "image" or "document"');
    }

    const userId = String(req.user?.userId ?? req.user?.id);
    const fileUrl = await this.fileUploadService.saveFile(file, type);

    // Create message with file attachment
    return this.chat.sendMessage(userId, {
      conversationId,
      body: type === 'image' ? '📷 Image' : '📄 Document',
      payload: {
        type,
        fileUrl,
        fileName: file.originalname,
        fileType: file.mimetype,
        ...(type === 'image' && { imageUrl: fileUrl }),
      },
    });
  }
}
