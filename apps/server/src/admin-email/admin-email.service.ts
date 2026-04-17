import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { NotificationsService } from '../notifications/notifications.service';
import { SendAdminEmailDto } from './dto/send-email.dto';

@Injectable()
export class AdminEmailService {
  private readonly logger = new Logger(AdminEmailService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly notifications: NotificationsService,
  ) {}

  async send(dto: SendAdminEmailDto) {
    const htmlBody = this.buildHtml(dto.subject, dto.body);

    const sent = await this.notifications.sendEmail(
      dto.to,
      dto.subject,
      dto.body,
      htmlBody,
    );

    const record = await this.prisma.adminEmail.create({
      data: {
        from: 'support@nasta.app',
        to: dto.to,
        subject: dto.subject,
        body: dto.body,
        htmlBody,
        userId: dto.userId || null,
        direction: 'OUTBOUND',
        context: dto.context || null,
      },
    });

    this.logger.log(
      `Admin email ${sent ? 'sent' : 'queued (mail not configured)'} to ${dto.to} — id=${record.id}`,
    );

    return { id: record.id, sent };
  }

  async getThreads(page = 1, pageSize = 20) {
    // Get distinct recipient emails with their latest email
    const emails = await this.prisma.adminEmail.groupBy({
      by: ['to'],
      _count: { id: true },
      _max: { createdAt: true },
      orderBy: { _max: { createdAt: 'desc' } },
      skip: (page - 1) * pageSize,
      take: pageSize,
    });

    const totalResult = await this.prisma.adminEmail.groupBy({
      by: ['to'],
      _count: { id: true },
    });
    const total = totalResult.length;

    // Get the latest email for each thread to show preview
    const threads = await Promise.all(
      emails.map(async (group) => {
        const lastEmail = await this.prisma.adminEmail.findFirst({
          where: { to: group.to },
          orderBy: { createdAt: 'desc' },
        });
        return {
          email: group.to,
          count: group._count.id,
          lastEmailAt: group._max.createdAt,
          lastSubject: lastEmail?.subject || '',
          lastBody: lastEmail?.body || '',
          context: lastEmail?.context || null,
          userId: lastEmail?.userId || null,
        };
      }),
    );

    return { threads, total, page, pageSize };
  }

  async getThread(email: string) {
    const messages = await this.prisma.adminEmail.findMany({
      where: { to: email },
      orderBy: { createdAt: 'asc' },
    });
    return messages;
  }

  async getThreadByUserId(userId: string) {
    // Find user email first
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { email: true, firstName: true, lastName: true },
    });
    if (!user) return { messages: [], user: null };

    const messages = await this.prisma.adminEmail.findMany({
      where: { to: user.email },
      orderBy: { createdAt: 'asc' },
    });
    return { messages, user };
  }

  private buildHtml(subject: string, body: string): string {
    const escapedBody = body
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/\n/g, '<br/>');

    return `
<!DOCTYPE html>
<html lang="en">
<head><meta charset="UTF-8"/></head>
<body style="margin:0;padding:0;background:#f4f4f5;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#f4f4f5;padding:32px 16px">
    <tr><td align="center">
      <table width="600" cellpadding="0" cellspacing="0" style="background:#ffffff;border-radius:12px;overflow:hidden;box-shadow:0 1px 3px rgba(0,0,0,.1)">
        <tr><td style="background:#b8822a;padding:24px 32px">
          <h1 style="margin:0;color:#ffffff;font-size:20px;font-weight:700">Nasta</h1>
        </td></tr>
        <tr><td style="padding:32px">
          <h2 style="margin:0 0 16px;color:#1a1a1a;font-size:18px;font-weight:600">${subject}</h2>
          <div style="color:#374151;font-size:14px;line-height:1.6">${escapedBody}</div>
        </td></tr>
        <tr><td style="padding:16px 32px;background:#f9fafb;border-top:1px solid #e5e7eb">
          <p style="margin:0;color:#9ca3af;font-size:12px">This email was sent by the Nasta support team — support@nasta.app</p>
        </td></tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`.trim();
  }
}
