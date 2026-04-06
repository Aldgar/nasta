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
        locked: true,
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
          avatar: true,
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
      { firstName: string; lastName: string; email: string; role?: string; avatar?: string | null }
    >();
    users.forEach((u) => {
      userMap.set(u.id, {
        firstName: u.firstName,
        lastName: u.lastName,
        email: u.email,
        role: u.role,
        avatar: u.avatar || null,
      });
    });
    admins.forEach((a: any) => {
      userMap.set(a.id, {
        firstName: a.firstName,
        lastName: a.lastName,
        email: a.email,
        role: 'ADMIN',
        avatar: null,
      });
    });

    return rows.map((c) => ({
      id: c.id,
      type: c.type,
      title: c.title,
      jobId: c.jobId,
      locked: c.locked,
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
          avatar: userInfo?.avatar || null,
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
      select: { id: true, locked: true, paused: true },
    });
    if (!conv) throw new NotFoundException('Conversation not found');
    if (conv.locked) {
      throw new ForbiddenException(
        'This conversation is locked. Messages cannot be sent after the job is completed.',
      );
    }
    if (conv.paused) {
      throw new ForbiddenException('This conversation is paused by an admin.');
    }
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

    // Resolve sender display name
    const senderUser = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { firstName: true, lastName: true },
    });
    const senderName = senderUser
      ? [senderUser.firstName, senderUser.lastName].filter(Boolean).join(' ')
      : null;

    // Send notifications to all other participants
    await Promise.all(
      participants.map(async (p) => {
        const t = await this.emailTranslations.getTranslatorForUser(p.userId);
        const title = senderName
          ? t('notifications.templates.newMessageTitle') + ` - ${senderName}`
          : t('notifications.templates.newMessageTitle');
        return this.notifications.createNotification({
          userId: p.userId,
          type: 'JOB_MESSAGE',
          title,
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

  /**
   * Lock all conversations associated with a specific jobId.
   * Used when a job is completed to prevent off-platform deals.
   */
  async lockConversationsByJobId(jobId: string) {
    const result = await this.prisma.conversation.updateMany({
      where: { jobId, locked: false },
      data: { locked: true },
    });
    return result.count;
  }

  /**
   * Get conversation details including locked status.
   */
  async getConversation(userId: string, conversationId: string) {
    await this.assertParticipant(userId, conversationId);
    const conv = await this.prisma.conversation.findUnique({
      where: { id: conversationId },
      select: {
        id: true,
        type: true,
        title: true,
        jobId: true,
        locked: true,
        paused: true,
        createdAt: true,
        updatedAt: true,
      },
    });
    if (!conv) throw new NotFoundException('Conversation not found');
    return conv;
  }

  /* ── Admin methods ────────────────────────────────────────────── */

  /**
   * List all conversations (admin view — no participant check).
   * Optionally filter by type (SUPPORT, JOB).
   */
  async adminListConversations(opts?: {
    page?: number;
    pageSize?: number;
    type?: ConversationType;
  }) {
    const page = Math.max(1, opts?.page ?? 1);
    const pageSize = Math.min(100, Math.max(1, opts?.pageSize ?? 20));
    const skip = (page - 1) * pageSize;

    const where: Prisma.ConversationWhereInput = {};
    if (opts?.type) where.type = opts.type;

    const [rows, total] = await Promise.all([
      this.prisma.conversation.findMany({
        where,
        orderBy: { updatedAt: 'desc' },
        skip,
        take: pageSize,
        select: {
          id: true,
          type: true,
          title: true,
          jobId: true,
          locked: true,
          paused: true,
          createdAt: true,
          updatedAt: true,
          participants: {
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
      }),
      this.prisma.conversation.count({ where }),
    ]);

    // Fetch participant details
    const allUserIds = new Set<string>();
    rows.forEach((c) =>
      c.participants.forEach((p) => allUserIds.add(p.userId)),
    );

    const [users, admins] = await Promise.all([
      this.prisma.user.findMany({
        where: { id: { in: Array.from(allUserIds) } },
        select: {
          id: true,
          firstName: true,
          lastName: true,
          email: true,
          role: true,
        },
      }),
      (this.prisma as any).admin.findMany({
        where: { id: { in: Array.from(allUserIds) } },
        select: { id: true, firstName: true, lastName: true, email: true },
      }),
    ]);

    const userMap = new Map<
      string,
      { firstName: string; lastName: string; email: string; role?: string }
    >();
    users.forEach((u) =>
      userMap.set(u.id, {
        firstName: u.firstName,
        lastName: u.lastName,
        email: u.email,
        role: u.role,
      }),
    );
    admins.forEach((a: any) =>
      userMap.set(a.id, {
        firstName: a.firstName,
        lastName: a.lastName,
        email: a.email,
        role: 'ADMIN',
      }),
    );

    return {
      conversations: rows.map((c) => ({
        id: c.id,
        type: c.type,
        title: c.title,
        jobId: c.jobId,
        locked: c.locked,
        paused: c.paused,
        updatedAt: c.updatedAt,
        lastMessage: c.messages[0] ?? null,
        participants: c.participants.map((p) => {
          const info = userMap.get(p.userId);
          return {
            userId: p.userId,
            role: info?.role || p.role,
            firstName: info?.firstName || null,
            lastName: info?.lastName || null,
            email: info?.email || null,
          };
        }),
      })),
      total,
      page,
      pageSize,
    };
  }

  /**
   * Get messages for a conversation without participant check (admin).
   */
  async adminListMessages(
    conversationId: string,
    opts?: { page?: number; pageSize?: number },
  ) {
    const conv = await this.prisma.conversation.findUnique({
      where: { id: conversationId },
      select: { id: true },
    });
    if (!conv) throw new NotFoundException('Conversation not found');

    const page = Math.max(1, opts?.page ?? 1);
    const pageSize = Math.min(100, Math.max(1, opts?.pageSize ?? 50));
    const skip = (page - 1) * pageSize;

    return this.prisma.message.findMany({
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
  }

  /**
   * Admin sends a message in any conversation (auto-joins as participant if needed).
   */
  async adminSendMessage(
    adminId: string,
    conversationId: string,
    body: string,
  ) {
    const conv = await this.prisma.conversation.findUnique({
      where: { id: conversationId },
      select: { id: true, locked: true },
    });
    if (!conv) throw new NotFoundException('Conversation not found');

    // Auto-join as participant if not already
    const existing = await this.prisma.conversationParticipant.findFirst({
      where: { conversationId, userId: adminId },
    });
    if (!existing) {
      await this.prisma.conversationParticipant.create({
        data: {
          conversationId,
          userId: adminId,
          role: ParticipantRole.ADMIN,
        },
      });
    }

    const msg = await this.prisma.message.create({
      data: {
        conversationId,
        senderUserId: adminId,
        senderRole: ParticipantRole.ADMIN,
        body,
      },
      select: {
        id: true,
        body: true,
        createdAt: true,
        senderUserId: true,
        senderRole: true,
      },
    });

    await this.prisma.conversation.update({
      where: { id: conversationId },
      data: { updatedAt: new Date() },
    });

    // Notify all other participants
    const participants = await this.prisma.conversationParticipant.findMany({
      where: { conversationId, userId: { not: adminId } },
      select: { userId: true },
    });

    const admin = await this.prisma.user.findUnique({
      where: { id: adminId },
      select: { firstName: true },
    });
    const adminLabel = admin?.firstName
      ? `${admin.firstName} - Admin`
      : 'Admin';

    await Promise.all(
      participants.map(async (p) => {
        const t = await this.emailTranslations.getTranslatorForUser(p.userId);
        return this.notifications.createNotification({
          userId: p.userId,
          type: 'JOB_MESSAGE',
          title:
            t('notifications.templates.newMessageTitle') + ' - ' + adminLabel,
          body: body.length > 100 ? body.substring(0, 100) + '...' : body,
          payload: { conversationId, messageId: msg.id, senderUserId: adminId },
        });
      }),
    );

    return msg;
  }

  /* ── Admin: Start support chat helpers ────────────────────────── */

  /**
   * Start or resume a SUPPORT chat with a user found by ticket number.
   * Links the conversation to the support ticket.
   */
  async adminStartChatByTicket(adminId: string, ticketNumber: string) {
    const ticket = await this.prisma.supportTicket.findUnique({
      where: { ticketNumber },
      select: { id: true, userId: true, subject: true, conversationId: true },
    });
    if (!ticket) throw new NotFoundException('Ticket not found');
    if (!ticket.userId)
      throw new NotFoundException(
        'This ticket has no associated user (anonymous ticket)',
      );

    // If ticket already has a conversation, return it
    if (ticket.conversationId) {
      return { id: ticket.conversationId, existing: true };
    }

    // Check for existing open SUPPORT conversation with this user
    const existingConvo = await this.findExistingSupportConvo(ticket.userId);
    if (existingConvo) {
      // Link ticket to existing conversation
      await this.prisma.supportTicket.update({
        where: { id: ticket.id },
        data: { conversationId: existingConvo.id },
      });
      return { id: existingConvo.id, existing: true };
    }

    // Create new support conversation
    const conv = await this.createSupportConversation(
      adminId,
      ticket.userId,
      `Support: ${ticket.subject}`,
    );

    // Link ticket to conversation
    await this.prisma.supportTicket.update({
      where: { id: ticket.id },
      data: { conversationId: conv.id },
    });

    return { id: conv.id, existing: false };
  }

  /**
   * Start or resume a SUPPORT chat with a user found by email.
   */
  async adminStartChatByEmail(adminId: string, email: string) {
    const user = await this.prisma.user.findUnique({
      where: { email },
      select: { id: true, firstName: true, lastName: true },
    });
    if (!user) throw new NotFoundException('No user found with that email');

    // Check for existing open SUPPORT conversation with this user
    const existingConvo = await this.findExistingSupportConvo(user.id);
    if (existingConvo) {
      return { id: existingConvo.id, existing: true };
    }

    const name = [user.firstName, user.lastName].filter(Boolean).join(' ');
    const conv = await this.createSupportConversation(
      adminId,
      user.id,
      `Support: ${name || email}`,
    );

    return { id: conv.id, existing: false };
  }

  /**
   * Start or resume a SUPPORT chat with a user by userId (from users page).
   */
  async adminStartChatByUserId(adminId: string, userId: string) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { id: true, firstName: true, lastName: true, email: true },
    });
    if (!user) throw new NotFoundException('User not found');

    // Check for existing open SUPPORT conversation with this user
    const existingConvo = await this.findExistingSupportConvo(user.id);
    if (existingConvo) {
      return { id: existingConvo.id, existing: true };
    }

    const name = [user.firstName, user.lastName].filter(Boolean).join(' ');
    const conv = await this.createSupportConversation(
      adminId,
      user.id,
      `Support: ${name || user.email}`,
    );

    return { id: conv.id, existing: false };
  }

  /**
   * Close a conversation (lock it permanently).
   */
  async adminCloseConversation(conversationId: string) {
    const conv = await this.prisma.conversation.findUnique({
      where: { id: conversationId },
      select: { id: true, locked: true },
    });
    if (!conv) throw new NotFoundException('Conversation not found');
    if (conv.locked) return { success: true, alreadyLocked: true };

    await this.prisma.conversation.update({
      where: { id: conversationId },
      data: { locked: true, paused: false },
    });
    return { success: true, alreadyLocked: false };
  }

  /**
   * Pause a conversation (temporarily block messages from users).
   */
  async adminPauseConversation(conversationId: string) {
    const conv = await this.prisma.conversation.findUnique({
      where: { id: conversationId },
      select: { id: true, locked: true, paused: true },
    });
    if (!conv) throw new NotFoundException('Conversation not found');
    if (conv.locked)
      throw new ForbiddenException('Cannot pause a closed conversation');
    if (conv.paused) return { success: true, alreadyPaused: true };

    await this.prisma.conversation.update({
      where: { id: conversationId },
      data: { paused: true },
    });
    return { success: true, alreadyPaused: false };
  }

  /**
   * Reopen a conversation (unlock and unpause).
   */
  async adminReopenConversation(conversationId: string) {
    const conv = await this.prisma.conversation.findUnique({
      where: { id: conversationId },
      select: { id: true, locked: true, paused: true },
    });
    if (!conv) throw new NotFoundException('Conversation not found');

    await this.prisma.conversation.update({
      where: { id: conversationId },
      data: { locked: false, paused: false },
    });
    return { success: true };
  }

  /* ── Private helpers ──────────────────────────────────────────── */

  private async findExistingSupportConvo(userId: string) {
    return this.prisma.conversation.findFirst({
      where: {
        type: ConversationType.SUPPORT,
        locked: false,
        participants: { some: { userId } },
      },
      select: { id: true },
      orderBy: { updatedAt: 'desc' },
    });
  }

  private async createSupportConversation(
    adminId: string,
    userId: string,
    title: string,
  ) {
    const conv = await this.prisma.conversation.create({
      data: {
        type: ConversationType.SUPPORT,
        title,
        createdById: adminId,
      },
    });

    // Add admin and user as participants
    await this.prisma.conversationParticipant.createMany({
      data: [
        {
          conversationId: conv.id,
          userId: adminId,
          role: ParticipantRole.ADMIN,
        },
        {
          conversationId: conv.id,
          userId,
          role: ParticipantRole.JOB_SEEKER, // Will be resolved by role lookup
        },
      ],
    });

    // Resolve the user's actual role
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { role: true },
    });
    if (user?.role === 'EMPLOYER') {
      await this.prisma.conversationParticipant.updateMany({
        where: { conversationId: conv.id, userId },
        data: { role: ParticipantRole.EMPLOYER },
      });
    }

    return conv;
  }
}
