import {
  Injectable,
  ForbiddenException,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { ConversationType, ParticipantRole, Prisma } from '@prisma/client';
import { NotificationsService } from '../notifications/notifications.service';
import { EmailTranslationsService } from '../notifications/email-translations.service';

@Injectable()
export class ChatService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly notifications: NotificationsService,
    private readonly emailTranslations: EmailTranslationsService,
  ) {}

  async createConversation(
    createdById: string,
    dto: {
      type: ConversationType;
      title?: string | null;
      jobId?: string | null;
      participantIds: string[];
    },
  ) {
    const convo = await this.prisma.conversation.create({
      data: {
        type: dto.type,
        title: dto.title ?? null,
        jobId: dto.jobId ?? null,
        createdById,
      },
    });

    // Ensure unique participants including creator
    const uniqueIds = Array.from(new Set([createdById, ...dto.participantIds]));

    // Check both User and Admin collections
    const [users, admins] = await Promise.all([
      this.prisma.user.findMany({
        where: { id: { in: uniqueIds } },
        select: { id: true, role: true },
      }),
      (this.prisma as any).admin.findMany({
        where: { id: { in: uniqueIds } },
        select: { id: true },
      }),
    ]);

    const roleMap: Record<string, ParticipantRole> = {};

    // Map users
    for (const u of users) {
      if (u.role === 'EMPLOYER') {
        roleMap[u.id] = ParticipantRole.EMPLOYER;
      } else {
        roleMap[u.id] = ParticipantRole.JOB_SEEKER;
      }
    }

    // Map admins (admins can be creators or participants)
    for (const admin of admins) {
      roleMap[admin.id] = ParticipantRole.ADMIN;
    }

    // If creator is admin but not found in users, check if they're in admin collection
    if (
      !roleMap[createdById] &&
      admins.some((a: any) => a.id === createdById)
    ) {
      roleMap[createdById] = ParticipantRole.ADMIN;
    }

    await this.prisma.conversationParticipant.createMany({
      data: uniqueIds.map((id) => ({
        conversationId: convo.id,
        userId: id,
        role: roleMap[id] ?? ParticipantRole.JOB_SEEKER,
      })),
    });

    return { id: convo.id };
  }

  async assertParticipant(userId: string, conversationId: string) {
    const participant = await this.prisma.conversationParticipant.findFirst({
      where: { conversationId, userId },
    });
    if (!participant)
      throw new ForbiddenException('Not a participant in this conversation');
    return participant;
  }

  async listConversations(
    userId: string,
    opts?: { page?: number; pageSize?: number },
  ) {
    const page = Math.max(1, opts?.page ?? 1);
    const pageSize = Math.min(100, Math.max(1, opts?.pageSize ?? 20));
    const skip = (page - 1) * pageSize;

    const rows = await this.prisma.conversation.findMany({
      where: { participants: { some: { userId } } },
      orderBy: { updatedAt: 'desc' },
      skip,
      take: pageSize,
      select: {
        id: true,
        type: true,
        title: true,
        jobId: true,
        createdAt: true,
        updatedAt: true,
        participants: {
          where: { userId: { not: userId } },
          select: { userId: true, role: true },
          take: 10,
        },
        messages: {
          orderBy: { createdAt: 'desc' },
          take: 1,
          select: {
            id: true,
            body: true,
            createdAt: true,
            senderUserId: true,
          },
        },
      },
    });

    // Fetch participant details (names) for all conversations
    const allOtherUserIds = new Set<string>();
    rows.forEach((c) => {
      c.participants.forEach((p) => {
        allOtherUserIds.add(p.userId);
      });
    });

    // Fetch user details from both User and Admin collections
    const [users, admins] = await Promise.all([
      this.prisma.user.findMany({
        where: { id: { in: Array.from(allOtherUserIds) } },
        select: {
          id: true,
          firstName: true,
          lastName: true,
          email: true,
          role: true,
        },
      }),
      (this.prisma as any).admin.findMany({
        where: { id: { in: Array.from(allOtherUserIds) } },
        select: { id: true, firstName: true, lastName: true, email: true },
      }),
    ]);

    // Create a map of userId -> user details
    const userMap = new Map<
      string,
      { firstName: string; lastName: string; email: string; role?: string }
    >();
    users.forEach((u) => {
      userMap.set(u.id, {
        firstName: u.firstName,
        lastName: u.lastName,
        email: u.email,
        role: u.role,
      });
    });
    admins.forEach((a: any) => {
      userMap.set(a.id, {
        firstName: a.firstName,
        lastName: a.lastName,
        email: a.email,
        role: 'ADMIN',
      });
    });

    return rows.map((c) => ({
      id: c.id,
      type: c.type,
      title: c.title,
      jobId: c.jobId,
      updatedAt: c.updatedAt,
      lastMessage: c.messages[0] ?? null,
      others: c.participants.map((p) => {
        const userInfo = userMap.get(p.userId);
        // Use the actual user role from User/Admin collection, not the participant role
        // This ensures admins show as ADMIN even if participant role was set incorrectly
        const actualRole = userInfo?.role || p.role;
        return {
          userId: p.userId,
          role: actualRole, // Use actual user role, fallback to participant role
          firstName: userInfo?.firstName || null,
          lastName: userInfo?.lastName || null,
          email: userInfo?.email || null,
        };
      }),
    }));
  }

  async listMessages(
    userId: string,
    conversationId: string,
    opts?: { page?: number; pageSize?: number },
  ) {
    await this.assertParticipant(userId, conversationId);
    const page = Math.max(1, opts?.page ?? 1);
    const pageSize = Math.min(100, Math.max(1, opts?.pageSize ?? 50));
    const skip = (page - 1) * pageSize;
    const messages = await this.prisma.message.findMany({
      where: { conversationId },
      orderBy: { createdAt: 'asc' },
      skip,
      take: pageSize,
      select: {
        id: true,
        body: true,
        payload: true,
        createdAt: true,
        senderUserId: true,
        senderRole: true,
      },
    });
    return messages;
  }

  async sendMessage(
    userId: string,
    dto: {
      conversationId: string;
      body: string;
      payload?: Prisma.InputJsonValue;
    },
  ) {
    const participant = await this.assertParticipant(
      userId,
      dto.conversationId,
    );
    const conv = await this.prisma.conversation.findUnique({
      where: { id: dto.conversationId },
      select: { id: true },
    });
    if (!conv) throw new NotFoundException('Conversation not found');
    const msg = await this.prisma.message.create({
      data: {
        conversationId: dto.conversationId,
        senderUserId: userId,
        senderRole: participant.role,
        body: dto.body,
        payload: dto.payload ?? undefined,
      },
      select: {
        id: true,
        body: true,
        createdAt: true,
        senderUserId: true,
        senderRole: true,
        payload: true,
      },
    });

    // Touch conversation update time
    await this.prisma.conversation.update({
      where: { id: dto.conversationId },
      data: { updatedAt: new Date() },
    });

    // Get all participants except the sender to notify them
    const participants = await this.prisma.conversationParticipant.findMany({
      where: {
        conversationId: dto.conversationId,
        userId: { not: userId },
      },
      select: { userId: true },
    });

    // Send notifications to all other participants
    await Promise.all(
      participants.map(async (p) => {
        const t = await this.emailTranslations.getTranslatorForUser(p.userId);
        return this.notifications.createNotification({
          userId: p.userId,
          type: 'JOB_MESSAGE',
          title: t('notifications.templates.newMessageTitle'),
          body:
            dto.body.length > 100
              ? dto.body.substring(0, 100) + '...'
              : dto.body,
          payload: {
            conversationId: dto.conversationId,
            messageId: msg.id,
            senderUserId: userId,
          },
        });
      }),
    );

    return msg;
  }
}
