import {
  Injectable,
  NotFoundException,
  BadRequestException,
  UnauthorizedException,
  Logger,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import {
  AdminCapability,
  SupportStatus,
  ResponseChannel,
} from '@prisma/client';
import { NotificationsService } from '../notifications/notifications.service';
import { EmailTranslationsService } from '../notifications/email-translations.service';

type SupportCategory =
  | 'GENERAL'
  | 'TECHNICAL'
  | 'BILLING'
  | 'VERIFICATION'
  | 'ACCOUNT'
  | 'REPORT'
  | 'ABUSE'
  | 'SECURITY'
  | 'EMPLOYER_SURVEY'
  | 'PROVIDER_SURVEY';
type SupportPriority = 'LOW' | 'NORMAL' | 'HIGH' | 'URGENT';

@Injectable()
export class SupportService {
  private readonly logger = new Logger(SupportService.name);

  constructor(
    private prisma: PrismaService,
    private notifications: NotificationsService,
    private emailTranslations: EmailTranslationsService,
  ) {}

  /**
   * Generate a unique ticket number in format TKT-YYYY-NNNNNN
   */
  private async generateTicketNumber(): Promise<string> {
    const year = new Date().getFullYear();
    const prefix = `TKT-${year}-`;

    // Find the highest ticket number for this year
    const lastTicket = await this.prisma.supportTicket.findFirst({
      where: {
        ticketNumber: {
          startsWith: prefix,
        },
      },
      orderBy: {
        ticketNumber: 'desc',
      },
      select: {
        ticketNumber: true,
      },
    });

    let sequence = 1;
    if (lastTicket) {
      // Extract sequence number from last ticket (e.g., TKT-2025-001234 -> 1234)
      const lastSequence = parseInt(
        lastTicket.ticketNumber.replace(prefix, ''),
        10,
      );
      if (!isNaN(lastSequence)) {
        sequence = lastSequence + 1;
      }
    }

    // Format with leading zeros (6 digits)
    const ticketNumber = `${prefix}${sequence.toString().padStart(6, '0')}`;
    return ticketNumber;
  }

  async createTicket(data: {
    subject: string;
    message: string;
    category?: SupportCategory;
    priority?: SupportPriority;
    userId?: string;
    name?: string;
    email?: string;
    ipAddress?: string;
    userAgent?: string;
  }) {
    // Generate ticket number (handle existing tickets without numbers)
    let ticketNumber: string;
    try {
      ticketNumber = await this.generateTicketNumber();
    } catch (error) {
      // If generation fails (e.g., unique constraint), try again with a timestamp-based fallback
      this.logger.warn('Ticket number generation failed, using fallback');
      const timestamp = Date.now();
      ticketNumber = `TKT-${new Date().getFullYear()}-${timestamp.toString().slice(-6)}`;
    }

    // If userId is provided, fetch user details
    let userEmail = data.email;
    let userName = data.name;

    if (data.userId) {
      const user = await this.prisma.user.findUnique({
        where: { id: data.userId },
        select: {
          email: true,
          phone: true,
          firstName: true,
          lastName: true,
        },
      });

      if (user) {
        userEmail = user.email;
        userName =
          `${user.firstName || ''} ${user.lastName || ''}`.trim() || userEmail;
        this.logger.log(
          `Fetched user info for ticket: ${userName} (${userEmail}), phone: ${user.phone || 'N/A'}`,
        );
      } else {
        this.logger.warn(`User ${data.userId} not found when creating ticket`);
      }
    } else {
      this.logger.warn(
        `No userId provided when creating ticket. Name: ${data.name}, Email: ${data.email}`,
      );
    }

    const ticket = await this.prisma.supportTicket.create({
      data: {
        ticketNumber,
        subject: data.subject,
        message: data.message,
        category: data.category || 'GENERAL',
        priority: data.priority || 'NORMAL',
        status: 'OPEN',
        userId: data.userId || null,
        name: userName || null,
        email: userEmail || null,
        ipAddress: data.ipAddress || null,
        userAgent: data.userAgent || null,
      },
      include: {
        user: {
          select: {
            id: true,
            email: true,
            phone: true,
            firstName: true,
            lastName: true,
          },
        },
      },
    });

    // Log ticket creation for debugging
    this.logger.log(
      `Ticket created: ${ticketNumber}, userId: ${ticket.userId || 'none'}, userEmail: ${userEmail || 'none'}, userName: ${userName || 'none'}`,
    );

    // Send confirmation email to user
    // Always send email if we have an email address (from user record or provided)
    const emailToSend = userEmail || ticket.email;
    if (emailToSend) {
      try {
        this.logger.log(
          `Attempting to send confirmation email to: ${emailToSend}`,
        );

        // Get personalized email content based on category
        const emailContent = await this.getEmailContentForCategory(
          ticket.category as SupportCategory,
          ticketNumber,
          ticket.subject,
          ticket.priority,
          userName || 'there',
          ticket.userId || undefined,
        );

        await this.notifications.sendEmail(
          emailToSend,
          emailContent.subject,
          emailContent.text,
          emailContent.html,
        );
        this.logger.log(
          `✅ ${emailContent.type} confirmation email sent to ${emailToSend} for ticket ${ticketNumber}`,
        );
      } catch (emailError) {
        this.logger.error(
          `❌ Failed to send confirmation email to ${emailToSend}: ${emailError}`,
        );
        // Don't fail ticket creation if email fails
      }
    } else {
      this.logger.warn(
        `⚠️ No email address available to send confirmation email for ticket ${ticketNumber}`,
      );
    }

    return {
      ticket: {
        id: ticket.id,
        ticketNumber: ticket.ticketNumber,
        subject: ticket.subject,
        status: ticket.status,
        createdAt: ticket.createdAt,
      },
      message: 'Support ticket created successfully',
    };
  }

  /**
   * Get personalized email content based on ticket category
   */
  private async getEmailContentForCategory(
    category: SupportCategory,
    ticketNumber: string,
    subject: string,
    priority: string,
    userName: string,
    userId?: string,
  ): Promise<{ subject: string; text: string; html: string; type: string }> {
    const t = await this.emailTranslations.getTranslatorForUser(userId);
    const language = await this.emailTranslations.getUserLanguage(userId);

    switch (category) {
      case 'ABUSE':
        return await this.getAbuseReportEmail(
          ticketNumber,
          subject,
          priority,
          userName,
          t,
          language,
        );
      case 'SECURITY':
        return await this.getSecurityReportEmail(
          ticketNumber,
          subject,
          priority,
          userName,
          t,
          language,
        );
      case 'EMPLOYER_SURVEY':
        return await this.getSurveyThankYouEmail(
          ticketNumber,
          userName,
          'employer',
          t,
          language,
        );
      case 'PROVIDER_SURVEY':
        return await this.getSurveyThankYouEmail(
          ticketNumber,
          userName,
          'provider',
          t,
          language,
        );
      default:
        return await this.getSupportTicketEmail(
          ticketNumber,
          subject,
          category,
          priority,
          userName,
          t,
          language,
        );
    }
  }

  /**
   * Email template for Abuse Reports
   */
  private async getAbuseReportEmail(
    ticketNumber: string,
    subject: string,
    priority: string,
    userName: string,
    t: (key: string, params?: any) => string,
    language: 'en' | 'pt',
  ): Promise<{ subject: string; text: string; html: string; type: string }> {
    const subjectText = t('email.support.abuseReportSubject', { ticketNumber });
    const textContent = t('email.support.abuseReportText', {
      userName,
      ticketNumber,
      subject,
      priority,
    });

    const htmlContent = `
      <!DOCTYPE html>
      <html lang="${language}">
      <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>${t('email.support.abuseReportTitle')}</title>
      </head>
      <body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; line-height: 1.6; color: #B8A88A; background-color: #080F1E; max-width: 600px; margin: 0 auto; padding: 20px;">
        <div style="background: linear-gradient(135deg, #0D1A30 0%, #162540 50%, #0D1A30 100%); border-top: 3px solid #ef4444; padding: 30px; text-align: center; border-radius: 10px 10px 0 0;">
          <h1 style="color: #F5E6C8; margin: 0; font-size: 28px;">${t('email.support.abuseReportHeader')}</h1>
        </div>
        <div style="background: #0E1B32; padding: 30px; border-radius: 0 0 10px 10px; border: 1px solid #1E3048; border-top: none;">
          <p style="font-size: 16px; margin-bottom: 20px;">${t('email.support.greeting', { userName })}</p>
          <p style="font-size: 16px; margin-bottom: 20px; color: #F5E6C8; font-weight: 500;">
            ${t('email.support.abuseReportThankYou')}
          </p>
          
          <div style="background: #0D1A30; padding: 20px; border-radius: 8px; margin: 20px 0; border-left: 4px solid #ef4444;">
            <p style="margin: 10px 0;"><strong>${t('email.support.ticketNumber')}:</strong> <span style="color: #ef4444; font-weight: 700; font-size: 18px;">${ticketNumber}</span></p>
            <p style="margin: 10px 0;"><strong>${t('email.support.subject')}:</strong> ${subject}</p>
            <p style="margin: 10px 0;"><strong>${t('email.support.priority')}:</strong> <span style="color: #ef4444; font-weight: 600;">${priority}</span></p>
          </div>
          
          <div style="background: rgba(239, 68, 68, 0.08); padding: 16px; border-radius: 8px; margin: 20px 0; border-left: 4px solid #ef4444;">
            <p style="font-size: 15px; margin: 0; color: #f87171; font-weight: 500;">
              ${t('email.support.abuseReportInvestigation')}
            </p>
          </div>
          
          <p style="font-size: 16px; margin-top: 20px;">
            ${t('email.support.abuseReportReview')}
          </p>
          
          <div style="background: rgba(245, 158, 11, 0.1); padding: 16px; border-radius: 8px; margin: 20px 0; border-left: 4px solid #f59e0b;">
            <p style="font-size: 14px; margin: 0; color: #fbbf24; font-weight: 600;">
              ⚠️ ${t('email.support.emergencyContact')}
            </p>
          </div>
          
          <p style="font-size: 16px; margin-top: 20px;">
            ${t('email.support.abuseReportThankYouCommunity')}
          </p>
          
          <div style="margin-top: 30px; padding-top: 20px; border-top: 1px solid #1E3048; text-align: center;">
            <p style="color: #8B7A5E; font-size: 14px; margin: 0;">${t('email.support.bestRegards')}<br><strong style="color: #ef4444;">${t('email.support.safetyTeam')}</strong></p>
          </div>
        </div>
      </body>
      </html>
    `;

    return {
      subject: subjectText,
      text: textContent,
      html: htmlContent,
      type: 'Abuse report',
    };
  }

  /**
   * Email template for Security Reports
   */
  private async getSecurityReportEmail(
    ticketNumber: string,
    subject: string,
    priority: string,
    userName: string,
    t: (key: string, params?: any) => string,
    language: 'en' | 'pt',
  ): Promise<{ subject: string; text: string; html: string; type: string }> {
    const subjectText = t('email.support.securityReportSubject', {
      ticketNumber,
    });
    const textContent = t('email.support.securityReportText', {
      userName,
      ticketNumber,
      subject,
      priority,
    });

    const htmlContent = `
      <!DOCTYPE html>
      <html lang="${language}">
      <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>${t('email.support.securityReportTitle')}</title>
      </head>
      <body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; line-height: 1.6; color: #B8A88A; background-color: #080F1E; max-width: 600px; margin: 0 auto; padding: 20px;">
        <div style="background: linear-gradient(135deg, #0D1A30 0%, #162540 50%, #0D1A30 100%); border-top: 3px solid #f59e0b; padding: 30px; text-align: center; border-radius: 10px 10px 0 0;">
          <h1 style="color: #F5E6C8; margin: 0; font-size: 28px;">${t('email.support.securityReportHeader')}</h1>
        </div>
        <div style="background: #0E1B32; padding: 30px; border-radius: 0 0 10px 10px; border: 1px solid #1E3048; border-top: none;">
          <p style="font-size: 16px; margin-bottom: 20px;">${t('email.support.greeting', { userName })}</p>
          <p style="font-size: 16px; margin-bottom: 20px; color: #F5E6C8; font-weight: 500;">
            ${t('email.support.securityReportThankYou')}
          </p>
          
          <div style="background: #0D1A30; padding: 20px; border-radius: 8px; margin: 20px 0; border-left: 4px solid #f59e0b;">
            <p style="margin: 10px 0;"><strong>${t('email.support.ticketNumber')}:</strong> <span style="color: #f59e0b; font-weight: 700; font-size: 18px;">${ticketNumber}</span></p>
            <p style="margin: 10px 0;"><strong>${t('email.support.subject')}:</strong> ${subject}</p>
            <p style="margin: 10px 0;"><strong>${t('email.support.priority')}:</strong> <span style="color: #f59e0b; font-weight: 600;">${priority}</span></p>
          </div>
          
          <div style="background: rgba(245, 158, 11, 0.08); padding: 16px; border-radius: 8px; margin: 20px 0; border-left: 4px solid #f59e0b;">
            <p style="font-size: 15px; margin: 0; color: #fbbf24; font-weight: 500;">
              ${t('email.support.securityReportInvestigation')}
            </p>
          </div>
          
          <p style="font-size: 16px; margin-top: 20px;">
            ${t('email.support.securityReportThoroughInvestigation')}
          </p>
          
          <div style="background: rgba(245, 158, 11, 0.12); padding: 16px; border-radius: 8px; margin: 20px 0; border-left: 4px solid #f59e0b;">
            <p style="font-size: 14px; margin: 0 0 12px 0; color: #fbbf24; font-weight: 600;">
              🔒 ${t('email.support.securityReportRecommendations')}
            </p>
            <ul style="margin: 0; padding-left: 20px; color: #fbbf24;">
              <li style="margin-bottom: 8px;">${t('email.support.securityRecommendation1')}</li>
              <li style="margin-bottom: 8px;">${t('email.support.securityRecommendation2')}</li>
              <li style="margin-bottom: 8px;">${t('email.support.securityRecommendation3')}</li>
            </ul>
          </div>
          
          <p style="font-size: 16px; margin-top: 20px;">
            ${t('email.support.securityReportThankYouCooperation')}
          </p>
          
          <div style="margin-top: 30px; padding-top: 20px; border-top: 1px solid #1E3048; text-align: center;">
            <p style="color: #8B7A5E; font-size: 14px; margin: 0;">${t('email.support.bestRegards')}<br><strong style="color: #f59e0b;">${t('email.support.securityTeam')}</strong></p>
          </div>
        </div>
      </body>
      </html>
    `;

    return {
      subject: subjectText,
      text: textContent,
      html: htmlContent,
      type: 'Security report',
    };
  }

  /**
   * Email template for General Support Tickets
   */
  private async getSupportTicketEmail(
    ticketNumber: string,
    subject: string,
    category: string,
    priority: string,
    userName: string,
    t: (key: string, params?: any) => string,
    language: 'en' | 'pt',
  ): Promise<{ subject: string; text: string; html: string; type: string }> {
    const subjectText = t('email.support.ticketCreatedSubject', {
      ticketNumber,
    });
    const textContent = t('email.support.ticketCreatedText', {
      userName,
      ticketNumber,
      subject,
      category,
      priority,
    });

    const htmlContent = `
      <!DOCTYPE html>
      <html lang="${language}">
      <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>${t('email.support.ticketCreatedTitle')}</title>
      </head>
      <body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; line-height: 1.6; color: #B8A88A; background-color: #080F1E; max-width: 600px; margin: 0 auto; padding: 20px;">
        <div style="background: linear-gradient(135deg, #0D1A30 0%, #162540 50%, #0D1A30 100%); border-top: 3px solid #C9963F; padding: 30px; text-align: center; border-radius: 10px 10px 0 0;">
          <h1 style="color: #F5E6C8; margin: 0; font-size: 28px;">${t('email.support.ticketCreatedHeader')}</h1>
        </div>
        <div style="background: #0E1B32; padding: 30px; border-radius: 0 0 10px 10px; border: 1px solid #1E3048; border-top: none;">
          <p style="font-size: 16px; margin-bottom: 20px;">${t('email.support.greeting', { userName })}</p>
          <p style="font-size: 16px; margin-bottom: 20px;">${t('email.support.ticketCreatedMessage')}</p>
          
          <div style="background: #0D1A30; padding: 20px; border-radius: 8px; margin: 20px 0; border-left: 4px solid #C9963F;">
            <p style="margin: 10px 0;"><strong>${t('email.support.ticketNumber')}:</strong> <span style="color: #C9963F; font-weight: 700;">${ticketNumber}</span></p>
            <p style="margin: 10px 0;"><strong>${t('email.support.subject')}:</strong> ${subject}</p>
            <p style="margin: 10px 0;"><strong>${t('email.support.category')}:</strong> ${category}</p>
            <p style="margin: 10px 0;"><strong>${t('email.support.priority')}:</strong> ${priority}</p>
          </div>
          
          <p style="font-size: 16px; margin-top: 20px;">${t('email.support.reviewMessage')}</p>
          <p style="font-size: 16px; margin-top: 20px;">${t('email.support.thankYouMessage')}</p>
          
          <div style="margin-top: 30px; padding-top: 20px; border-top: 1px solid #1E3048; text-align: center;">
            <p style="color: #8B7A5E; font-size: 14px; margin: 0;">${t('email.support.bestRegards')}<br><strong style="color: #C9963F;">${t('email.support.supportTeam')}</strong></p>
          </div>
        </div>
      </body>
      </html>
    `;

    return {
      subject: subjectText,
      text: textContent,
      html: htmlContent,
      type: 'Support ticket',
    };
  }

  /**
   * Email template for Survey Thank You
   */
  private async getSurveyThankYouEmail(
    ticketNumber: string,
    userName: string,
    surveyType: 'employer' | 'provider',
    t: (key: string, params?: any) => string,
    language: 'en' | 'pt',
  ): Promise<{ subject: string; text: string; html: string; type: string }> {
    const roleName =
      surveyType === 'employer'
        ? t('email.common.employer')
        : t('email.common.serviceProvider');
    const subjectText = t('email.support.surveyThankYouSubject', {
      ticketNumber,
    });
    const textContent = t('email.support.surveyThankYouText', {
      userName,
      roleName,
      ticketNumber,
    });

    const htmlContent = `
      <!DOCTYPE html>
      <html lang="${language}">
      <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>${t('email.support.surveyThankYouTitle')}</title>
      </head>
      <body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; line-height: 1.6; color: #B8A88A; background-color: #080F1E; max-width: 600px; margin: 0 auto; padding: 20px;">
        <div style="background: linear-gradient(135deg, #0D1A30 0%, #162540 50%, #0D1A30 100%); border-top: 3px solid #C9963F; padding: 40px; text-align: center; border-radius: 10px 10px 0 0;">
          <h1 style="color: #F5E6C8; margin: 0; font-size: 32px; font-weight: 600;">${t('email.support.surveyThankYouHeader')}</h1>
          <p style="color: #8B7A5E; margin: 10px 0 0 0; font-size: 18px;">${t('email.support.surveyThankYouSubheader')}</p>
        </div>
        <div style="background: #0E1B32; padding: 40px; border-radius: 0 0 10px 10px; border: 1px solid #1E3048; border-top: none;">
          <p style="font-size: 18px; margin-bottom: 20px; color: #F5E6C8; font-weight: 500;">${t('email.support.greeting', { userName })}</p>
          
          <p style="font-size: 16px; margin-bottom: 20px; color: #D4A853; line-height: 1.8;">
            ${t('email.support.surveyThankYouMessage', { roleName })}
          </p>
          
          <div style="background: #0D1A30; padding: 25px; border-radius: 12px; margin: 25px 0; border-left: 4px solid #C9963F; box-shadow: 0 2px 8px rgba(0, 0, 0, 0.4);">
            <p style="margin: 0; color: #8B7A5E; font-size: 14px; font-weight: 600; text-transform: uppercase; letter-spacing: 0.5px;">${t('email.support.surveyReference')}</p>
            <p style="margin: 8px 0 0 0; color: #C9963F; font-weight: 700; font-size: 20px;">${ticketNumber}</p>
          </div>
          
          <p style="font-size: 16px; margin-top: 25px; margin-bottom: 20px; color: #D4A853; line-height: 1.8;">
            ${t('email.support.surveyAppreciation')}
          </p>
          
          <div style="background: #f0f9ff; padding: 20px; border-radius: 8px; margin: 20px 0; border-left: 4px solid #60a5fa;">
            <ul style="margin: 0; padding-left: 20px; color: #60a5fa;">
              <li style="margin: 8px 0; font-size: 15px; line-height: 1.6;">${t('email.support.surveyUse1')}</li>
              <li style="margin: 8px 0; font-size: 15px; line-height: 1.6;">${t('email.support.surveyUse2')}</li>
              <li style="margin: 8px 0; font-size: 15px; line-height: 1.6;">${t('email.support.surveyUse3')}</li>
              <li style="margin: 8px 0; font-size: 15px; line-height: 1.6;">${t('email.support.surveyUse4')}</li>
            </ul>
          </div>
          
          <p style="font-size: 16px; margin-top: 25px; margin-bottom: 20px; color: #D4A853; line-height: 1.8;">
            ${t('email.support.surveyVoiceMatters')}
          </p>
          
          <p style="font-size: 16px; margin-top: 20px; margin-bottom: 20px; color: #D4A853; line-height: 1.8;">
            ${t('email.support.surveyAdditionalThoughts')}
          </p>
          
          <div style="background: rgba(201, 150, 63, 0.15); padding: 20px; border-radius: 8px; margin: 25px 0; text-align: center; border: 1px solid #C9963F;">
            <p style="font-size: 16px; margin: 0; color: #fbbf24; font-weight: 600;">
              ${t('email.support.surveyThankYouCommunity')}
            </p>
          </div>
          
          <div style="margin-top: 40px; padding-top: 25px; border-top: 1px solid #1E3048; text-align: center;">
            <p style="color: #8B7A5E; font-size: 15px; margin: 0;">${t('email.support.warmRegards')}</p>
            <p style="color: #C9963F; font-size: 16px; margin: 5px 0 0 0; font-weight: 600;">${t('email.support.nestaTeam')}</p>
          </div>
        </div>
      </body>
      </html>
    `;

    return {
      subject: subjectText,
      text: textContent,
      html: htmlContent,
      type: 'Survey thank you',
    };
  }

  async listTickets(
    adminId: string,
    options: {
      status?: SupportStatus;
      scope?: 'all' | 'mine' | 'unassigned';
      isSuperAdmin?: boolean;
      category?: SupportCategory;
    },
  ) {
    const { status, scope = 'all', isSuperAdmin = false, category } = options;

    const where: any = {
      // Exclude action-related tickets (these should only appear in Action History)
      NOT: {
        OR: [
          { subject: { contains: 'Legal Action:' } },
          { subject: { contains: 'Warning:' } },
          { subject: { contains: 'Action Form:' } },
          { subject: { contains: 'Request Information:' } },
          { message: { contains: 'Admin Request:' } },
        ],
      },
    };

    if (status) {
      where.status = status;
    }

    if (category) {
      where.category = category;
    }

    if (scope === 'mine') {
      where.assignedTo = adminId;
    } else if (scope === 'unassigned') {
      where.assignedTo = null;
    }

    const tickets = await this.prisma.supportTicket.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      include: {
        user: {
          select: {
            id: true,
            email: true,
            phone: true,
            firstName: true,
            lastName: true,
          },
        },
      },
    });

    return { tickets, total: tickets.length };
  }

  async getTicket(id: string) {
    const ticket = await this.prisma.supportTicket.findUnique({
      where: { id },
      include: {
        user: {
          select: {
            id: true,
            email: true,
            phone: true,
            firstName: true,
            lastName: true,
          },
        },
        responses: {
          orderBy: { createdAt: 'asc' },
        },
      },
    });

    if (!ticket) {
      throw new NotFoundException('Support ticket not found');
    }

    return ticket;
  }

  async assignTicket(
    ticketId: string,
    adminId: string,
    adminCapabilities: string[],
  ) {
    const ticket = await this.getTicket(ticketId);

    // All admins can assign tickets (removed SUPPORT capability requirement)
    // Determine the capability to assign - prefer SUPPORT if available, otherwise use first capability or default to SUPPORT
    let assignedCapability: AdminCapability | null = null;
    if (adminCapabilities.includes('SUPPORT')) {
      assignedCapability = AdminCapability.SUPPORT;
    } else if (adminCapabilities.length > 0) {
      // Try to map the first capability to the enum
      const firstCap = adminCapabilities[0].toUpperCase();
      if (firstCap === 'SUPER_ADMIN') {
        assignedCapability = AdminCapability.SUPER_ADMIN;
      } else if (firstCap === 'BACKGROUND_CHECK_REVIEWER') {
        assignedCapability = AdminCapability.BACKGROUND_CHECK_REVIEWER;
      } else if (firstCap === 'DELETION_REQUEST_REVIEWER') {
        assignedCapability = AdminCapability.DELETION_REQUEST_REVIEWER;
      } else if (firstCap === 'SUPPORT') {
        assignedCapability = AdminCapability.SUPPORT;
      } else {
        assignedCapability = AdminCapability.SUPPORT; // Default fallback
      }
    } else {
      assignedCapability = AdminCapability.SUPPORT; // Default fallback
    }

    const updated = await this.prisma.supportTicket.update({
      where: { id: ticketId },
      data: {
        assignedTo: adminId,
        assignedCapability,
        assignedAt: new Date(),
        status: ticket.status === 'OPEN' ? 'IN_PROGRESS' : ticket.status,
      },
    });

    return { ticket: updated, message: 'Ticket assigned successfully' };
  }

  async resolveTicket(
    ticketId: string,
    adminId: string,
    data: { resolution: string; notes?: string },
  ) {
    const ticket = await this.getTicket(ticketId);

    if (ticket.assignedTo && ticket.assignedTo !== adminId) {
      throw new UnauthorizedException(
        'You can only resolve tickets assigned to you',
      );
    }

    const updated = await this.prisma.supportTicket.update({
      where: { id: ticketId },
      data: {
        status: 'RESOLVED',
        resolvedBy: adminId,
        resolvedAt: new Date(),
        resolution: data.resolution,
        adminNotes: data.notes || null,
      },
    });

    return { ticket: updated, message: 'Ticket resolved successfully' };
  }

  async updateTicketStatus(
    ticketId: string,
    adminId: string,
    status: SupportStatus,
    notes?: string,
  ) {
    const ticket = await this.getTicket(ticketId);

    if (ticket.assignedTo && ticket.assignedTo !== adminId) {
      throw new UnauthorizedException(
        'You can only update tickets assigned to you',
      );
    }

    // Build update data
    const data: Record<string, unknown> = {
      status,
      adminNotes: notes || ticket.adminNotes,
    };

    // Handle escalation statuses
    const escalationMap: Record<string, string> = {
      ESCALATED_KYC: 'KYC',
      ESCALATED_ADMIN: 'ADMIN',
      ESCALATED_BUG_TEAM: 'BUG_TEAM',
    };

    if (escalationMap[status]) {
      data.escalatedTo = escalationMap[status];
      data.escalatedAt = new Date();
      data.escalatedBy = adminId;
    }

    const updated = await this.prisma.supportTicket.update({
      where: { id: ticketId },
      data,
    });

    return { ticket: updated, message: 'Ticket status updated successfully' };
  }

  /**
   * Respond to a support ticket via email, chat, or both
   */
  async respondToTicket(
    ticketId: string,
    adminId: string,
    response: string,
    channel: 'EMAIL' | 'CHAT' | 'BOTH' = 'EMAIL',
  ) {
    const ticket = await this.getTicket(ticketId);

    // Get user email
    const userEmail = ticket.user?.email || ticket.email;
    const userName = ticket.user
      ? `${ticket.user.firstName || ''} ${ticket.user.lastName || ''}`.trim() ||
        ticket.user.email
      : ticket.name || 'there';

    if (!userEmail && (channel === 'EMAIL' || channel === 'BOTH')) {
      throw new BadRequestException(
        'Cannot send email: no email address found',
      );
    }

    // Get admin details
    const admin = await this.prisma.user.findUnique({
      where: { id: adminId },
      select: {
        firstName: true,
        lastName: true,
        email: true,
      },
    });

    const adminName = admin
      ? `${admin.firstName || ''} ${admin.lastName || ''}`.trim() || admin.email
      : 'Support Team';

    let emailSent = false;

    // Send email if channel is EMAIL or BOTH
    if ((channel === 'EMAIL' || channel === 'BOTH') && userEmail) {
      try {
        const userId = ticket.userId || undefined;
        const t = await this.emailTranslations.getTranslatorForUser(userId);
        const language = await this.emailTranslations.getUserLanguage(userId);

        const emailSubject = t('email.support.responseSubject', {
          subject: ticket.subject,
          ticketNumber: ticket.ticketNumber,
        });
        const emailText = t('email.support.responseText', {
          userName,
          ticketNumber: ticket.ticketNumber,
          response,
          adminName,
        });

        const emailHtml = `
          <!DOCTYPE html>
          <html lang="${language}">
          <head>
            <meta charset="utf-8">
            <meta name="viewport" content="width=device-width, initial-scale=1.0">
            <title>${t('email.support.responseTitle')}</title>
          </head>
          <body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; line-height: 1.6; color: #B8A88A; background-color: #080F1E; max-width: 600px; margin: 0 auto; padding: 20px;">
            <div style="background: linear-gradient(135deg, #0D1A30 0%, #162540 50%, #0D1A30 100%); border-top: 3px solid #C9963F; padding: 30px; text-align: center; border-radius: 10px 10px 0 0;">
              <h1 style="color: #F5E6C8; margin: 0; font-size: 28px;">${t('email.support.responseHeader')}</h1>
            </div>
            <div style="background: #0E1B32; padding: 30px; border-radius: 0 0 10px 10px; border: 1px solid #1E3048; border-top: none;">
              <p style="font-size: 16px; margin-bottom: 20px;">${t('email.support.greeting', { userName })}</p>
              <p style="font-size: 16px; margin-bottom: 20px;">${t('email.support.responseThankYou')}</p>
              
              <div style="background: #0D1A30; padding: 20px; border-radius: 8px; margin: 20px 0; border-left: 4px solid #C9963F;">
                <p style="margin: 10px 0; color: #8B7A5E; font-size: 14px;"><strong>${t('email.support.ticketNumber')}:</strong> ${ticket.ticketNumber}</p>
                <p style="margin: 10px 0; color: #8B7A5E; font-size: 14px;"><strong>${t('email.support.subject')}:</strong> ${ticket.subject}</p>
              </div>
              
              <div style="background: #0D1A30; padding: 20px; border-radius: 8px; margin: 20px 0;">
                <p style="white-space: pre-wrap; font-size: 16px; line-height: 1.8;">${response.replace(/\n/g, '<br>')}</p>
              </div>
              
              <p style="font-size: 16px; margin-top: 20px;">${t('email.support.responseFurtherQuestions', { ticketNumber: ticket.ticketNumber })}</p>
              
              <div style="margin-top: 30px; padding-top: 20px; border-top: 1px solid #1E3048;">
                <p style="color: #8B7A5E; font-size: 14px; margin: 0;">${t('email.support.bestRegards')}<br><strong style="color: #C9963F;">${adminName}</strong><br>${t('email.support.supportTeam')}</p>
              </div>
            </div>
          </body>
          </html>
        `;

        await this.notifications.sendEmail(
          userEmail,
          emailSubject,
          emailText,
          emailHtml,
        );
        emailSent = true;
        this.logger.log(
          `Support ticket response email sent to ${userEmail} for ticket ${ticket.ticketNumber}`,
        );
      } catch (emailError) {
        this.logger.error(
          `Failed to send support ticket response email: ${emailError}`,
        );
        if (channel === 'EMAIL') {
          throw new BadRequestException('Failed to send response email');
        }
      }
    }

    // Send chat message if channel is CHAT or BOTH
    if (channel === 'CHAT' || channel === 'BOTH') {
      if (ticket.userId) {
        // Ensure we have a conversation linked to this ticket
        let conversationId = ticket.conversationId;
        if (!conversationId) {
          // Create a support conversation
          const conversation = await this.prisma.conversation.create({
            data: {
              type: 'SUPPORT',
              title: `Support: ${ticket.subject}`,
              createdById: adminId,
            },
          });
          conversationId = conversation.id;

          // Add participants
          const participantData = [
            {
              conversationId: conversation.id,
              userId: adminId,
              role: 'ADMIN' as const,
            },
            {
              conversationId: conversation.id,
              userId: ticket.userId,
              role: 'JOB_SEEKER' as const,
            },
          ];

          await this.prisma.conversationParticipant.createMany({
            data: participantData,
          });

          // Link conversation to ticket
          await this.prisma.supportTicket.update({
            where: { id: ticketId },
            data: { conversationId: conversation.id },
          });
        }

        // Send the message in the conversation
        await this.prisma.message.create({
          data: {
            conversationId,
            senderUserId: adminId,
            senderRole: 'ADMIN',
            body: response,
            payload: {
              ticketId,
              ticketNumber: ticket.ticketNumber,
              isTicketResponse: true,
            },
          },
        });

        // Touch conversation timestamp
        await this.prisma.conversation.update({
          where: { id: conversationId },
          data: { updatedAt: new Date() },
        });

        // Send push notification
        await this.notifications.createNotification({
          userId: ticket.userId,
          type: 'JOB_MESSAGE',
          title: 'Support Response',
          body:
            response.length > 100
              ? response.substring(0, 100) + '...'
              : response,
          payload: {
            conversationId,
            ticketId,
          },
        });
      }
    }

    // Log the response
    await this.prisma.ticketResponse.create({
      data: {
        ticketId,
        adminId,
        channel:
          channel === 'BOTH' ? ResponseChannel.EMAIL : ResponseChannel[channel],
        message: response,
        emailSent,
      },
    });

    // Update ticket status to WAITING_USER_RESPONSE if still open/in-progress
    if (ticket.status === 'OPEN' || ticket.status === 'IN_PROGRESS') {
      await this.prisma.supportTicket.update({
        where: { id: ticketId },
        data: { status: 'WAITING_USER_RESPONSE' },
      });
    }

    return { success: true, message: 'Response sent successfully', emailSent };
  }
}
