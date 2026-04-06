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
import { AdminJwtGuard } from '../auth/guards/admin-jwt.guard';
import { ChatService } from './chat.service';
import { CreateConversationDto } from './dto/create-conversation.dto';
import { SendMessageDto } from './dto/send-message.dto';
import { ChatFileUploadService } from './chat-file-upload.service';
import { ConversationType } from '@prisma/client';

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

  @Get('conversations/:id')
  async getConversation(@Req() req: RequestWithUser, @Param('id') id: string) {
    const userId = String(req.user?.userId ?? req.user?.id);
    return this.chat.getConversation(userId, id);
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

  /* ── Admin endpoints ──────────────────────────────────────────── */

  @Get('admin/conversations')
  @UseGuards(AdminJwtGuard)
  async adminListConversations(
    @Query('page') page = '1',
    @Query('pageSize') pageSize = '20',
    @Query('type') type?: string,
  ) {
    const validTypes: Record<string, ConversationType> = {
      SUPPORT: ConversationType.SUPPORT,
      JOB: ConversationType.JOB,
    };
    return this.chat.adminListConversations({
      page: Number.parseInt(page) || 1,
      pageSize: Number.parseInt(pageSize) || 20,
      type: type ? validTypes[type.toUpperCase()] : undefined,
    });
  }

  @Get('admin/conversations/:id/messages')
  @UseGuards(AdminJwtGuard)
  async adminListMessages(
    @Param('id') id: string,
    @Query('page') page = '1',
    @Query('pageSize') pageSize = '50',
  ) {
    return this.chat.adminListMessages(id, {
      page: Number.parseInt(page) || 1,
      pageSize: Number.parseInt(pageSize) || 50,
    });
  }

  @Post('admin/conversations/:id/messages')
  @UseGuards(AdminJwtGuard)
  async adminSendMessage(
    @Req() req: RequestWithUser,
    @Param('id') id: string,
    @Body('body') body: string,
  ) {
    const adminId = String(req.user?.userId ?? req.user?.id);
    if (!body?.trim())
      throw new BadRequestException('Message body is required');
    return this.chat.adminSendMessage(adminId, id, body.trim());
  }

  /**
   * Start a support chat with a user by ticket number.
   */
  @Post('admin/conversations/start-by-ticket')
  @UseGuards(AdminJwtGuard)
  async startChatByTicket(
    @Req() req: RequestWithUser,
    @Body('ticketNumber') ticketNumber: string,
  ) {
    if (!ticketNumber?.trim())
      throw new BadRequestException('Ticket number is required');
    const adminId = String(req.user?.userId ?? req.user?.id);
    return this.chat.adminStartChatByTicket(adminId, ticketNumber.trim());
  }

  /**
   * Start a support chat with a user by email.
   */
  @Post('admin/conversations/start-by-email')
  @UseGuards(AdminJwtGuard)
  async startChatByEmail(
    @Req() req: RequestWithUser,
    @Body('email') email: string,
  ) {
    if (!email?.trim()) throw new BadRequestException('Email is required');
    const adminId = String(req.user?.userId ?? req.user?.id);
    return this.chat.adminStartChatByEmail(adminId, email.trim().toLowerCase());
  }

  /**
   * Start a support chat with a user by userId (from users tab).
   */
  @Post('admin/conversations/start-by-user')
  @UseGuards(AdminJwtGuard)
  async startChatByUser(
    @Req() req: RequestWithUser,
    @Body('userId') userId: string,
  ) {
    if (!userId?.trim()) throw new BadRequestException('User ID is required');
    const adminId = String(req.user?.userId ?? req.user?.id);
    return this.chat.adminStartChatByUserId(adminId, userId.trim());
  }

  /**
   * Close/end a support conversation (locks it permanently).
   */
  @Post('admin/conversations/:id/close')
  @UseGuards(AdminJwtGuard)
  async closeConversation(@Param('id') id: string) {
    return this.chat.adminCloseConversation(id);
  }

  /**
   * Pause a conversation (temporarily block user messages).
   */
  @Post('admin/conversations/:id/pause')
  @UseGuards(AdminJwtGuard)
  async pauseConversation(@Param('id') id: string) {
    return this.chat.adminPauseConversation(id);
  }

  /**
   * Reopen a conversation (unlock and unpause).
   */
  @Post('admin/conversations/:id/reopen')
  @UseGuards(AdminJwtGuard)
  async reopenConversation(@Param('id') id: string) {
    return this.chat.adminReopenConversation(id);
  }
}
