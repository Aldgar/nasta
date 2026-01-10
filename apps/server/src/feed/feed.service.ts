import {
  BadRequestException,
  ForbiddenException,
  Injectable,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { NotificationsService } from '../notifications/notifications.service';

@Injectable()
export class FeedService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly notifications: NotificationsService,
  ) {}

  private isValidObjectId(id: string | undefined | null): id is string {
    return typeof id === 'string' && /^[0-9a-fA-F]{24}$/.test(id);
  }

  async createAdminPost(
    adminId: string,
    dto: {
      title?: string;
      body: string;
      visibility?: 'ALL' | 'JOB_SEEKERS' | 'EMPLOYERS';
      attachments?: string[];
      rich?: Record<string, unknown>;
      notify?: boolean;
    },
  ) {
    const visibility = dto.visibility ?? 'ALL';
    const feed = (
      this.prisma as unknown as {
        feedPost: { create: (args: unknown) => Promise<unknown> };
      }
    ).feedPost;
    const created = await feed.create({
      data: {
        authorType: 'ADMIN',
        authorUserId: adminId,
        title: dto.title ?? null,
        body: dto.body,
        visibility,
        attachments: dto.attachments ?? [],
        rich: dto.rich ?? undefined,
      },
      select: {
        id: true,
        title: true,
        body: true,
        visibility: true,
        attachments: true,
        rich: true,
        createdAt: true,
      },
    });
    if (dto.notify === true) {
      await this.notifyAudience(
        visibility,
        created as { id: string; title?: string | null; body: string },
      );
    }
    return { post: created };
  }

  async createEmployerJobPost(
    employerId: string,
    jobId: string,
    dto: {
      title?: string;
      body: string;
      visibility?: 'ALL' | 'JOB_SEEKERS' | 'EMPLOYERS';
      attachments?: string[];
      rich?: Record<string, unknown>;
      notify?: boolean;
    },
  ) {
    if (!this.isValidObjectId(jobId))
      throw new BadRequestException('Invalid job id');
    // Ensure employer owns the job
    const job = await this.prisma.job.findUnique({
      where: { id: jobId },
      select: { employerId: true },
    });
    if (!job || job.employerId !== employerId)
      throw new ForbiddenException('Not your job');
    const visibility = dto.visibility ?? 'JOB_SEEKERS';
    const feed = (
      this.prisma as unknown as {
        feedPost: { create: (args: unknown) => Promise<unknown> };
      }
    ).feedPost;
    const created = await feed.create({
      data: {
        authorType: 'EMPLOYER',
        authorUserId: employerId,
        jobId,
        title: dto.title ?? null,
        body: dto.body,
        visibility,
        attachments: dto.attachments ?? [],
        rich: dto.rich ?? undefined,
      },
      select: {
        id: true,
        title: true,
        body: true,
        visibility: true,
        attachments: true,
        rich: true,
        createdAt: true,
      },
    });
    if (dto.notify === true) {
      await this.notifyAudience(
        visibility,
        created as { id: string; title?: string | null; body: string },
      );
    }
    return { post: created };
  }

  async listForUser(
    userId: string,
    role: 'ADMIN' | 'EMPLOYER' | 'JOB_SEEKER' | undefined,
    opts: { page: number; limit: number },
  ) {
    const feed = (
      this.prisma as unknown as {
        feedPost: {
          findMany: (args: unknown) => Promise<unknown[]>;
          count: (args: unknown) => Promise<number>;
        };
      }
    ).feedPost;
    const where = (() => {
      if (role === 'ADMIN') return {};
      if (role === 'EMPLOYER')
        return { OR: [{ visibility: 'ALL' }, { visibility: 'EMPLOYERS' }] };
      // default to job seeker
      return { OR: [{ visibility: 'ALL' }, { visibility: 'JOB_SEEKERS' }] };
    })();
    const [items, total] = await Promise.all([
      feed.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip: (opts.page - 1) * opts.limit,
        take: opts.limit,
        select: {
          id: true,
          title: true,
          body: true,
          visibility: true,
          attachments: true,
          rich: true,
          createdAt: true,
          authorType: true,
          jobId: true,
        },
      }),
      feed.count({ where }),
    ]);
    const withCounts = await this.attachAckCounts(
      items as Array<{ id: string }>,
      userId,
    );
    return { items: withCounts, total, page: opts.page, limit: opts.limit };
  }

  // Cursor-based listing for infinite scroll
  async listForUserCursor(
    userId: string,
    role: 'ADMIN' | 'EMPLOYER' | 'JOB_SEEKER' | undefined,
    opts: { cursor?: string; limit: number },
  ) {
    const feed = (
      this.prisma as unknown as {
        feedPost: {
          findMany: (args: unknown) => Promise<unknown[]>;
        };
      }
    ).feedPost;
    const whereBase = (() => {
      if (role === 'ADMIN') return {};
      if (role === 'EMPLOYER')
        return { OR: [{ visibility: 'ALL' }, { visibility: 'EMPLOYERS' }] };
      return { OR: [{ visibility: 'ALL' }, { visibility: 'JOB_SEEKERS' }] };
    })();
    let cursorFilter: Record<string, unknown> | undefined;
    if (opts.cursor) {
      const cur = this.decodeCursor(opts.cursor);
      cursorFilter = {
        OR: [
          { createdAt: { lt: new Date(cur.ts) } },
          {
            AND: [
              { createdAt: { equals: new Date(cur.ts) } },
              { id: { lt: cur.id } },
            ],
          },
        ],
      };
    }
    const items = (await feed.findMany({
      where: cursorFilter ? { AND: [whereBase, cursorFilter] } : whereBase,
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
      take: opts.limit,
      select: {
        id: true,
        title: true,
        body: true,
        visibility: true,
        attachments: true,
        rich: true,
        createdAt: true,
        authorType: true,
        jobId: true,
      },
    })) as Array<{
      id: string;
      createdAt: Date;
    }>;
    const augmented = await this.attachAckCounts(items, userId);
    const last = augmented[augmented.length - 1];
    const nextCursor = last
      ? this.encodeCursor({ id: last.id, ts: last.createdAt.getTime() })
      : undefined;
    return { items: augmented, nextCursor, limit: opts.limit };
  }

  async acknowledge(postId: string, userId: string) {
    if (!this.isValidObjectId(postId))
      throw new BadRequestException('Invalid post id');
    const rx = (
      this.prisma as unknown as {
        feedReaction: {
          create: (args: unknown) => Promise<unknown>;
          deleteMany: (args: unknown) => Promise<unknown>;
          count: (args: unknown) => Promise<number>;
        };
      }
    ).feedReaction;
    // Create if not exists (unique constraint will protect duplicates)
    try {
      await rx.create({
        data: { postId, userId, type: 'ACK' },
      });
    } catch {
      // ignore duplicate errors
    }
    const ackCount = await rx.count({ where: { postId, type: 'ACK' } });
    return { acknowledged: true, ackCount };
  }

  async unacknowledge(postId: string, userId: string) {
    if (!this.isValidObjectId(postId))
      throw new BadRequestException('Invalid post id');
    const rx = (
      this.prisma as unknown as {
        feedReaction: {
          deleteMany: (args: unknown) => Promise<unknown>;
          count: (args: unknown) => Promise<number>;
        };
      }
    ).feedReaction;
    await rx.deleteMany({ where: { postId, userId, type: 'ACK' } });
    const ackCount = await rx.count({ where: { postId, type: 'ACK' } });
    return { acknowledged: false, ackCount };
  }

  private async attachAckCounts<T extends { id: string }>(
    items: T[],
    currentUserId: string,
  ) {
    if (items.length === 0)
      return items.map((it) => ({
        ...it,
        ackCount: 0,
        acknowledgedByMe: false,
      }));
    const ids = items.map((i) => i.id);
    const rx = (
      this.prisma as unknown as {
        feedReaction: {
          findMany: (
            args: unknown,
          ) => Promise<Array<{ postId: string; userId: string }>>;
          count: (args: unknown) => Promise<number>;
        };
      }
    ).feedReaction;
    const reactions = await rx.findMany({
      where: { postId: { in: ids }, type: 'ACK' },
      select: { postId: true, userId: true },
    });
    const ackMap = new Map<string, number>();
    const meSet = new Set<string>();
    for (const r of reactions) {
      ackMap.set(r.postId, (ackMap.get(r.postId) ?? 0) + 1);
      if (r.userId === currentUserId) meSet.add(r.postId);
    }
    return items.map((it) => ({
      ...it,
      ackCount: ackMap.get(it.id) ?? 0,
      acknowledgedByMe: meSet.has(it.id),
    }));
  }

  private encodeCursor(cur: { id: string; ts: number }) {
    const raw = `${cur.ts}:${cur.id}`;
    return Buffer.from(raw).toString('base64url');
  }

  private decodeCursor(cursor: string): { id: string; ts: number } {
    const raw = Buffer.from(cursor, 'base64url').toString('utf8');
    const [tsStr, id] = raw.split(':');
    const ts = Number(tsStr);
    if (!id || Number.isNaN(ts))
      throw new BadRequestException('Invalid cursor');
    return { id, ts };
  }

  private async notifyAudience(
    visibility: 'ALL' | 'JOB_SEEKERS' | 'EMPLOYERS',
    post: { id: string; title?: string | null; body: string },
  ) {
    let roles: Array<'JOB_SEEKER' | 'EMPLOYER'>;
    if (visibility === 'ALL') roles = ['JOB_SEEKER', 'EMPLOYER'];
    else if (visibility === 'JOB_SEEKERS') roles = ['JOB_SEEKER'];
    else roles = ['EMPLOYER'];
    const users = await this.prisma.user.findMany({
      where: {
        role: { in: roles },
        isActive: true,
      },
      select: { id: true },
      take: 1000, // safety cap; can batch in future
    });
    if (users.length === 0) return;
    const notifTitle = post.title ?? 'New announcement';
    const notifBody = post.body.slice(0, 160);
    const payload = { postId: post.id };
    await Promise.all(
      users.map((u) =>
        this.notifications.createNotification({
          userId: u.id,
          type: 'SYSTEM',
          title: notifTitle,
          body: notifBody,
          payload,
        }),
      ),
    );
  }
}
