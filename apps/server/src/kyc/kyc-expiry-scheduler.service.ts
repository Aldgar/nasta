import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { PrismaService } from '../prisma/prisma.service';
import { NotificationsService } from '../notifications/notifications.service';
import { EmailTranslationsService } from '../notifications/email-translations.service';

// Dynamic Prisma accessor for fields not yet in generated types
interface IdVerificationDelegate {
  findMany(args: unknown): Promise<unknown[]>;
  update(args: unknown): Promise<unknown>;
}

@Injectable()
export class KycExpirySchedulerService {
  private readonly logger = new Logger(KycExpirySchedulerService.name);

  private get idVerification(): IdVerificationDelegate {
    // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-return
    return (this.prisma as any).idVerification;
  }

  constructor(
    private readonly prisma: PrismaService,
    private readonly notifications: NotificationsService,
    private readonly emailTranslations: EmailTranslationsService,
  ) {}

  /**
   * Check for non-EU citizens with documents approaching expiry (15 days).
   * Sends email + push notification. Runs daily at 8 AM.
   */
  @Cron(CronExpression.EVERY_DAY_AT_8AM)
  async checkDocumentExpiry() {
    this.logger.log('Starting document expiry check for non-EU citizens...');

    const now = new Date();
    const fifteenDaysFromNow = new Date();
    fifteenDaysFromNow.setDate(fifteenDaysFromNow.getDate() + 15);

    try {
      // 1. Find verified non-EU citizens with documents expiring within 15 days
      //    that haven't been notified yet
      const expiringVerifications = (await this.idVerification.findMany({
        where: {
          status: 'VERIFIED',
          documentExpiry: {
            lte: fifteenDaysFromNow,
            gt: now, // Not yet expired
          },
          documentExpiryNotifiedAt: null, // Haven't sent warning yet
          documentExpiryRestricted: false,
        },
        select: {
          id: true,
          userId: true,
          documentExpiry: true,
          extractedData: true,
          user: {
            select: {
              id: true,
              email: true,
              firstName: true,
              lastName: true,
            },
          },
        },
      })) as Array<{
        id: string;
        userId: string;
        documentExpiry: Date | null;
        extractedData: Record<string, unknown> | null;
        user: {
          id: string;
          email: string;
          firstName: string;
          lastName: string;
        };
      }>;

      // Filter to non-EU citizens only (isEuCitizen === false in extractedData)
      const nonEuExpiring = expiringVerifications.filter((v) => {
        return v.extractedData?.isEuCitizen === false;
      });

      this.logger.log(
        `Found ${nonEuExpiring.length} non-EU verifications expiring within 15 days`,
      );

      for (const verification of nonEuExpiring) {
        await this.sendExpiryWarning(verification);
      }

      // 2. Find non-EU citizens with expired documents that haven't been restricted yet
      const expiredVerifications = (await this.idVerification.findMany({
        where: {
          status: 'VERIFIED',
          documentExpiry: {
            lte: now,
          },
          documentExpiryRestricted: false,
        },
        select: {
          id: true,
          userId: true,
          documentExpiry: true,
          extractedData: true,
          user: {
            select: {
              id: true,
              email: true,
              firstName: true,
              lastName: true,
            },
          },
        },
      })) as Array<{
        id: string;
        userId: string;
        documentExpiry: Date | null;
        extractedData: Record<string, unknown> | null;
        user: {
          id: string;
          email: string;
          firstName: string;
          lastName: string;
        };
      }>;

      const nonEuExpired = expiredVerifications.filter((v) => {
        return v.extractedData?.isEuCitizen === false;
      });

      this.logger.log(
        `Found ${nonEuExpired.length} non-EU verifications with expired documents`,
      );

      for (const verification of nonEuExpired) {
        await this.restrictExpiredUser(verification);
      }

      this.logger.log('Document expiry check completed');
    } catch (error) {
      this.logger.error('Document expiry check failed', error);
    }
  }

  /**
   * Send 15-day warning notification to service provider
   */
  private async sendExpiryWarning(verification: {
    id: string;
    userId: string;
    documentExpiry: Date | null;
    user: {
      id: string;
      email: string;
      firstName: string;
      lastName: string;
    };
  }) {
    const { user } = verification;
    const expiryDate = verification.documentExpiry
      ? verification.documentExpiry.toLocaleDateString('en-GB', {
          day: 'numeric',
          month: 'long',
          year: 'numeric',
        })
      : 'soon';

    try {
      // Mark as notified first to prevent duplicate sends
      await this.idVerification.update({
        where: { id: verification.id },
        data: { documentExpiryNotifiedAt: new Date() },
      });

      // Send push notification
      await this.notifications.createNotification({
        userId: user.id,
        type: 'WARNING',
        title: 'Document Expiring Soon',
        body: `Your identity document expires on ${expiryDate}. Please upload a new document to continue using the app. If you have any issues, contact support.`,
        payload: {
          action: 'DOCUMENT_EXPIRY_WARNING',
          verificationId: verification.id,
          expiryDate: verification.documentExpiry?.toISOString(),
        },
      });

      // Send email
      const subject = 'Your identity document is expiring soon';
      const text = [
        `Dear ${user.firstName},`,
        '',
        `Your identity document on file is set to expire on ${expiryDate}.`,
        '',
        'To continue using Nasta and applying for jobs, please upload a new valid document before the expiry date.',
        '',
        'If you are experiencing any issues with renewing your documents, please contact our support team and we will do our best to assist you.',
        '',
        'What happens if your document expires:',
        '- You will not be able to apply for new jobs',
        '- Instant job requests will be disabled',
        '- Your existing active jobs will not be affected',
        '',
        'Please update your documents as soon as possible.',
        '',
        'Best regards,',
        'The Nasta Team',
      ].join('\n');

      const html = `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <h2 style="color: #f59e0b;">⚠️ Document Expiring Soon</h2>
          <p>Dear ${user.firstName},</p>
          <p>Your identity document on file is set to expire on <strong>${expiryDate}</strong>.</p>
          <p>To continue using Nasta and applying for jobs, please upload a new valid document before the expiry date.</p>
          <p>If you are experiencing any issues with renewing your documents, please contact our support team and we will do our best to assist you.</p>
          <div style="background: #fef3c7; border-left: 4px solid #f59e0b; padding: 12px 16px; margin: 20px 0; border-radius: 4px;">
            <strong>What happens if your document expires:</strong>
            <ul style="margin: 8px 0; padding-left: 20px;">
              <li>You will not be able to apply for new jobs</li>
              <li>Instant job requests will be disabled</li>
              <li>Your existing active jobs will not be affected</li>
            </ul>
          </div>
          <p>Please update your documents as soon as possible.</p>
          <p>Best regards,<br/>The Nasta Team</p>
        </div>
      `;

      await this.notifications.sendEmail(user.email, subject, text, html);

      this.logger.log(
        `Sent expiry warning to user ${user.id} (${user.email}) - expires ${expiryDate}`,
      );
    } catch (error) {
      this.logger.error(
        `Failed to send expiry warning for verification ${verification.id}`,
        error,
      );
    }
  }

  /**
   * Restrict access for users with expired documents
   */
  private async restrictExpiredUser(verification: {
    id: string;
    userId: string;
    documentExpiry: Date | null;
    user: {
      id: string;
      email: string;
      firstName: string;
      lastName: string;
    };
  }) {
    const { user } = verification;

    try {
      // Mark verification as restricted
      await this.idVerification.update({
        where: { id: verification.id },
        data: { documentExpiryRestricted: true },
      });

      // Set restriction on user's idVerificationData
      const existingUser = await this.prisma.user.findUnique({
        where: { id: user.id },
        select: { idVerificationData: true },
      });
      const existingData =
        (existingUser?.idVerificationData as Record<string, unknown>) || {};
      const existingRestrictions =
        (existingData.restrictions as Record<string, unknown>) || {};

      await this.prisma.user.update({
        where: { id: user.id },
        data: {
          idVerificationData: {
            ...existingData,
            restricted: true,
            restrictionReason:
              'Identity document has expired. Please upload a new valid document.',
            restrictions: {
              ...existingRestrictions,
              canApplyToJobs: false,
              documentExpired: true,
            },
          },
        },
      });

      // Send notification about restriction
      await this.notifications.createNotification({
        userId: user.id,
        type: 'WARNING',
        title: 'Document Expired — Access Restricted',
        body: 'Your identity document has expired. Upload a new document to regain access to job applications and instant job requests.',
        payload: {
          action: 'DOCUMENT_EXPIRED_RESTRICTED',
          verificationId: verification.id,
        },
      });

      // Send email
      const subject = 'Your identity document has expired — Action required';
      const text = [
        `Dear ${user.firstName},`,
        '',
        'Your identity document on file has expired.',
        '',
        'As a result, the following restrictions are now in effect:',
        '- You cannot apply for new jobs',
        '- Instant job requests are disabled',
        '',
        'To restore full access, please upload a new valid identity document through the app.',
        '',
        'If you need assistance with document renewal, please contact our support team.',
        '',
        'Best regards,',
        'The Nasta Team',
      ].join('\n');

      const html = `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <h2 style="color: #ef4444;">🚫 Document Expired — Access Restricted</h2>
          <p>Dear ${user.firstName},</p>
          <p>Your identity document on file has expired.</p>
          <div style="background: #fef2f2; border-left: 4px solid #ef4444; padding: 12px 16px; margin: 20px 0; border-radius: 4px;">
            <strong>The following restrictions are now in effect:</strong>
            <ul style="margin: 8px 0; padding-left: 20px;">
              <li>You cannot apply for new jobs</li>
              <li>Instant job requests are disabled</li>
            </ul>
          </div>
          <p>To restore full access, please upload a new valid identity document through the app.</p>
          <p>If you need assistance with document renewal, please contact our support team.</p>
          <p>Best regards,<br/>The Nasta Team</p>
        </div>
      `;

      await this.notifications.sendEmail(user.email, subject, text, html);

      this.logger.log(
        `Restricted user ${user.id} (${user.email}) due to expired document`,
      );
    } catch (error) {
      this.logger.error(
        `Failed to restrict user for verification ${verification.id}`,
        error,
      );
    }
  }
}
