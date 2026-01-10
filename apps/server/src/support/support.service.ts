import {
  Injectable,
  NotFoundException,
  BadRequestException,
  UnauthorizedException,
  Logger,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { AdminCapability } from '@prisma/client';
import { NotificationsService } from '../notifications/notifications.service';
import { EmailTranslationsService } from '../notifications/email-translations.service';

type SupportStatus = 'OPEN' | 'IN_PROGRESS' | 'RESOLVED' | 'CLOSED';
type SupportCategory = 'GENERAL' | 'TECHNICAL' | 'BILLING' | 'VERIFICATION' | 'ACCOUNT' | 'REPORT' | 'ABUSE' | 'SECURITY' | 'EMPLOYER_SURVEY' | 'PROVIDER_SURVEY';
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
      const lastSequence = parseInt(lastTicket.ticketNumber.replace(prefix, ''), 10);
      if (!isNaN(lastSequence)) {
        sequence = lastSequence + 1;
      }
    }

    // Format with leading zeros (6 digits)
    const ticketNumber = `${prefix}${sequence.toString().padStart(6, '0')}`;
    return ticketNumber;
  }

  async createTicket(
    data: {
      subject: string;
      message: string;
      category?: SupportCategory;
      priority?: SupportPriority;
      userId?: string;
      name?: string;
      email?: string;
      ipAddress?: string;
      userAgent?: string;
    },
  ) {
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
        userName = `${user.firstName || ''} ${user.lastName || ''}`.trim() || userEmail;
        this.logger.log(`Fetched user info for ticket: ${userName} (${userEmail}), phone: ${user.phone || 'N/A'}`);
      } else {
        this.logger.warn(`User ${data.userId} not found when creating ticket`);
      }
    } else {
      this.logger.warn(`No userId provided when creating ticket. Name: ${data.name}, Email: ${data.email}`);
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
    this.logger.log(`Ticket created: ${ticketNumber}, userId: ${ticket.userId || 'none'}, userEmail: ${userEmail || 'none'}, userName: ${userName || 'none'}`);

    // Send confirmation email to user
    // Always send email if we have an email address (from user record or provided)
    const emailToSend = userEmail || ticket.email;
    if (emailToSend) {
      try {
        this.logger.log(`Attempting to send confirmation email to: ${emailToSend}`);
        
        // Get personalized email content based on category
        const emailContent = await this.getEmailContentForCategory(
          ticket.category as SupportCategory,
          ticketNumber,
          ticket.subject,
          ticket.priority,
          userName || 'there',
          ticket.userId || undefined
        );

        await this.notifications.sendEmail(emailToSend, emailContent.subject, emailContent.text, emailContent.html);
        this.logger.log(`✅ ${emailContent.type} confirmation email sent to ${emailToSend} for ticket ${ticketNumber}`);
      } catch (emailError) {
        this.logger.error(`❌ Failed to send confirmation email to ${emailToSend}: ${emailError}`);
        // Don't fail ticket creation if email fails
      }
    } else {
      this.logger.warn(`⚠️ No email address available to send confirmation email for ticket ${ticketNumber}`);
    }

    return { 
      ticket: {
        id: ticket.id,
        ticketNumber: ticket.ticketNumber,
        subject: ticket.subject,
        status: ticket.status,
        createdAt: ticket.createdAt,
      },
      message: 'Support ticket created successfully' 
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
    userId?: string
  ): Promise<{ subject: string; text: string; html: string; type: string }> {
    const t = await this.emailTranslations.getTranslatorForUser(userId);
    const language = await this.emailTranslations.getUserLanguage(userId);
    
    switch (category) {
      case 'ABUSE':
        return await this.getAbuseReportEmail(ticketNumber, subject, priority, userName, t, language);
      case 'SECURITY':
        return await this.getSecurityReportEmail(ticketNumber, subject, priority, userName, t, language);
      case 'EMPLOYER_SURVEY':
        return await this.getSurveyThankYouEmail(ticketNumber, userName, 'employer', t, language);
      case 'PROVIDER_SURVEY':
        return await this.getSurveyThankYouEmail(ticketNumber, userName, 'provider', t, language);
      default:
        return await this.getSupportTicketEmail(ticketNumber, subject, category, priority, userName, t, language);
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
    language: 'en' | 'pt'
  ): Promise<{ subject: string; text: string; html: string; type: string }> {
    const subjectText = t('email.support.abuseReportSubject', { ticketNumber });
    const textContent = t('email.support.abuseReportText', {
      userName,
      ticketNumber,
      subject,
      priority
    });

    const htmlContent = `
      <!DOCTYPE html>
      <html lang="${language}">
      <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>${t('email.support.abuseReportTitle')}</title>
      </head>
      <body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
        <div style="background: linear-gradient(135deg, #ef4444 0%, #dc2626 100%); padding: 30px; text-align: center; border-radius: 10px 10px 0 0;">
          <h1 style="color: #fff; margin: 0; font-size: 28px;">${t('email.support.abuseReportHeader')}</h1>
        </div>
        <div style="background: #f9fafb; padding: 30px; border-radius: 0 0 10px 10px; border: 1px solid #e5e7eb; border-top: none;">
          <p style="font-size: 16px; margin-bottom: 20px;">${t('email.support.greeting', { userName })}</p>
          <p style="font-size: 16px; margin-bottom: 20px; color: #1f2937; font-weight: 500;">
            ${t('email.support.abuseReportThankYou')}
          </p>
          
          <div style="background: #fff; padding: 20px; border-radius: 8px; margin: 20px 0; border-left: 4px solid #ef4444;">
            <p style="margin: 10px 0;"><strong>${t('email.support.ticketNumber')}:</strong> <span style="color: #ef4444; font-weight: 700; font-size: 18px;">${ticketNumber}</span></p>
            <p style="margin: 10px 0;"><strong>${t('email.support.subject')}:</strong> ${subject}</p>
            <p style="margin: 10px 0;"><strong>${t('email.support.priority')}:</strong> <span style="color: #ef4444; font-weight: 600;">${priority}</span></p>
          </div>
          
          <div style="background: #fef2f2; padding: 16px; border-radius: 8px; margin: 20px 0; border-left: 4px solid #ef4444;">
            <p style="font-size: 15px; margin: 0; color: #991b1b; font-weight: 500;">
              ${t('email.support.abuseReportInvestigation')}
            </p>
          </div>
          
          <p style="font-size: 16px; margin-top: 20px;">
            ${t('email.support.abuseReportReview')}
          </p>
          
          <div style="background: #fff3cd; padding: 16px; border-radius: 8px; margin: 20px 0; border-left: 4px solid #f59e0b;">
            <p style="font-size: 14px; margin: 0; color: #92400e; font-weight: 600;">
              ⚠️ ${t('email.support.emergencyContact')}
            </p>
          </div>
          
          <p style="font-size: 16px; margin-top: 20px;">
            ${t('email.support.abuseReportThankYouCommunity')}
          </p>
          
          <div style="margin-top: 30px; padding-top: 20px; border-top: 1px solid #e5e7eb; text-align: center;">
            <p style="color: #6b7280; font-size: 14px; margin: 0;">${t('email.support.bestRegards')}<br><strong style="color: #ef4444;">${t('email.support.safetyTeam')}</strong></p>
          </div>
        </div>
      </body>
      </html>
    `;

    return { subject: subjectText, text: textContent, html: htmlContent, type: 'Abuse report' };
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
    language: 'en' | 'pt'
  ): Promise<{ subject: string; text: string; html: string; type: string }> {
    const subjectText = t('email.support.securityReportSubject', { ticketNumber });
    const textContent = t('email.support.securityReportText', {
      userName,
      ticketNumber,
      subject,
      priority
    });

    const htmlContent = `
      <!DOCTYPE html>
      <html lang="${language}">
      <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>${t('email.support.securityReportTitle')}</title>
      </head>
      <body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
        <div style="background: linear-gradient(135deg, #f59e0b 0%, #d97706 100%); padding: 30px; text-align: center; border-radius: 10px 10px 0 0;">
          <h1 style="color: #fff; margin: 0; font-size: 28px;">${t('email.support.securityReportHeader')}</h1>
        </div>
        <div style="background: #f9fafb; padding: 30px; border-radius: 0 0 10px 10px; border: 1px solid #e5e7eb; border-top: none;">
          <p style="font-size: 16px; margin-bottom: 20px;">${t('email.support.greeting', { userName })}</p>
          <p style="font-size: 16px; margin-bottom: 20px; color: #1f2937; font-weight: 500;">
            ${t('email.support.securityReportThankYou')}
          </p>
          
          <div style="background: #fff; padding: 20px; border-radius: 8px; margin: 20px 0; border-left: 4px solid #f59e0b;">
            <p style="margin: 10px 0;"><strong>${t('email.support.ticketNumber')}:</strong> <span style="color: #f59e0b; font-weight: 700; font-size: 18px;">${ticketNumber}</span></p>
            <p style="margin: 10px 0;"><strong>${t('email.support.subject')}:</strong> ${subject}</p>
            <p style="margin: 10px 0;"><strong>${t('email.support.priority')}:</strong> <span style="color: #f59e0b; font-weight: 600;">${priority}</span></p>
          </div>
          
          <div style="background: #fffbeb; padding: 16px; border-radius: 8px; margin: 20px 0; border-left: 4px solid #f59e0b;">
            <p style="font-size: 15px; margin: 0; color: #92400e; font-weight: 500;">
              ${t('email.support.securityReportInvestigation')}
            </p>
          </div>
          
          <p style="font-size: 16px; margin-top: 20px;">
            ${t('email.support.securityReportThoroughInvestigation')}
          </p>
          
          <div style="background: #fef3c7; padding: 16px; border-radius: 8px; margin: 20px 0; border-left: 4px solid #f59e0b;">
            <p style="font-size: 14px; margin: 0 0 12px 0; color: #92400e; font-weight: 600;">
              🔒 ${t('email.support.securityReportRecommendations')}
            </p>
            <ul style="margin: 0; padding-left: 20px; color: #92400e;">
              <li style="margin-bottom: 8px;">${t('email.support.securityRecommendation1')}</li>
              <li style="margin-bottom: 8px;">${t('email.support.securityRecommendation2')}</li>
              <li style="margin-bottom: 8px;">${t('email.support.securityRecommendation3')}</li>
            </ul>
          </div>
          
          <p style="font-size: 16px; margin-top: 20px;">
            ${t('email.support.securityReportThankYouCooperation')}
          </p>
          
          <div style="margin-top: 30px; padding-top: 20px; border-top: 1px solid #e5e7eb; text-align: center;">
            <p style="color: #6b7280; font-size: 14px; margin: 0;">${t('email.support.bestRegards')}<br><strong style="color: #f59e0b;">${t('email.support.securityTeam')}</strong></p>
          </div>
        </div>
      </body>
      </html>
    `;

    return { subject: subjectText, text: textContent, html: htmlContent, type: 'Security report' };
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
    language: 'en' | 'pt'
  ): Promise<{ subject: string; text: string; html: string; type: string }> {
    const subjectText = t('email.support.ticketCreatedSubject', { ticketNumber });
    const textContent = t('email.support.ticketCreatedText', {
      userName,
      ticketNumber,
      subject,
      category,
      priority
    });

    const htmlContent = `
      <!DOCTYPE html>
      <html lang="${language}">
      <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>${t('email.support.ticketCreatedTitle')}</title>
      </head>
      <body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
        <div style="background: linear-gradient(135deg, #6366f1 0%, #8b5cf6 100%); padding: 30px; text-align: center; border-radius: 10px 10px 0 0;">
          <h1 style="color: #fff; margin: 0; font-size: 28px;">${t('email.support.ticketCreatedHeader')}</h1>
        </div>
        <div style="background: #f9fafb; padding: 30px; border-radius: 0 0 10px 10px; border: 1px solid #e5e7eb; border-top: none;">
          <p style="font-size: 16px; margin-bottom: 20px;">${t('email.support.greeting', { userName })}</p>
          <p style="font-size: 16px; margin-bottom: 20px;">${t('email.support.ticketCreatedMessage')}</p>
          
          <div style="background: #fff; padding: 20px; border-radius: 8px; margin: 20px 0; border-left: 4px solid #6366f1;">
            <p style="margin: 10px 0;"><strong>${t('email.support.ticketNumber')}:</strong> <span style="color: #6366f1; font-weight: 700;">${ticketNumber}</span></p>
            <p style="margin: 10px 0;"><strong>${t('email.support.subject')}:</strong> ${subject}</p>
            <p style="margin: 10px 0;"><strong>${t('email.support.category')}:</strong> ${category}</p>
            <p style="margin: 10px 0;"><strong>${t('email.support.priority')}:</strong> ${priority}</p>
          </div>
          
          <p style="font-size: 16px; margin-top: 20px;">${t('email.support.reviewMessage')}</p>
          <p style="font-size: 16px; margin-top: 20px;">${t('email.support.thankYouMessage')}</p>
          
          <div style="margin-top: 30px; padding-top: 20px; border-top: 1px solid #e5e7eb; text-align: center;">
            <p style="color: #6b7280; font-size: 14px; margin: 0;">${t('email.support.bestRegards')}<br><strong style="color: #6366f1;">${t('email.support.supportTeam')}</strong></p>
          </div>
        </div>
      </body>
      </html>
    `;

    return { subject: subjectText, text: textContent, html: htmlContent, type: 'Support ticket' };
  }

  /**
   * Email template for Survey Thank You
   */
  private async getSurveyThankYouEmail(
    ticketNumber: string,
    userName: string,
    surveyType: 'employer' | 'provider',
    t: (key: string, params?: any) => string,
    language: 'en' | 'pt'
  ): Promise<{ subject: string; text: string; html: string; type: string }> {
    const roleName = surveyType === 'employer' ? t('email.common.employer') : t('common.serviceProvider');
    const subjectText = t('email.support.surveyThankYouSubject', { ticketNumber });
    const textContent = t('email.support.surveyThankYouText', {
      userName,
      roleName,
      ticketNumber
    });

    const htmlContent = `
      <!DOCTYPE html>
      <html lang="${language}">
      <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>${t('email.support.surveyThankYouTitle')}</title>
      </head>
      <body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
        <div style="background: linear-gradient(135deg, #6366f1 0%, #8b5cf6 100%); padding: 40px; text-align: center; border-radius: 10px 10px 0 0;">
          <h1 style="color: #fff; margin: 0; font-size: 32px; font-weight: 600;">${t('email.support.surveyThankYouHeader')}</h1>
          <p style="color: #e0e7ff; margin: 10px 0 0 0; font-size: 18px;">${t('email.support.surveyThankYouSubheader')}</p>
        </div>
        <div style="background: #f9fafb; padding: 40px; border-radius: 0 0 10px 10px; border: 1px solid #e5e7eb; border-top: none;">
          <p style="font-size: 18px; margin-bottom: 20px; color: #1f2937; font-weight: 500;">${t('email.support.greeting', { userName })}</p>
          
          <p style="font-size: 16px; margin-bottom: 20px; color: #374151; line-height: 1.8;">
            ${t('email.support.surveyThankYouMessage', { roleName })}
          </p>
          
          <div style="background: #fff; padding: 25px; border-radius: 12px; margin: 25px 0; border-left: 4px solid #6366f1; box-shadow: 0 2px 4px rgba(0,0,0,0.05);">
            <p style="margin: 0; color: #6b7280; font-size: 14px; font-weight: 600; text-transform: uppercase; letter-spacing: 0.5px;">${t('email.support.surveyReference')}</p>
            <p style="margin: 8px 0 0 0; color: #6366f1; font-weight: 700; font-size: 20px;">${ticketNumber}</p>
          </div>
          
          <p style="font-size: 16px; margin-top: 25px; margin-bottom: 20px; color: #374151; line-height: 1.8;">
            ${t('email.support.surveyAppreciation')}
          </p>
          
          <div style="background: #f0f9ff; padding: 20px; border-radius: 8px; margin: 20px 0; border-left: 4px solid #3b82f6;">
            <ul style="margin: 0; padding-left: 20px; color: #1e40af;">
              <li style="margin: 8px 0; font-size: 15px; line-height: 1.6;">${t('email.support.surveyUse1')}</li>
              <li style="margin: 8px 0; font-size: 15px; line-height: 1.6;">${t('email.support.surveyUse2')}</li>
              <li style="margin: 8px 0; font-size: 15px; line-height: 1.6;">${t('email.support.surveyUse3')}</li>
              <li style="margin: 8px 0; font-size: 15px; line-height: 1.6;">${t('email.support.surveyUse4')}</li>
            </ul>
          </div>
          
          <p style="font-size: 16px; margin-top: 25px; margin-bottom: 20px; color: #374151; line-height: 1.8;">
            ${t('email.support.surveyVoiceMatters')}
          </p>
          
          <p style="font-size: 16px; margin-top: 20px; margin-bottom: 20px; color: #374151; line-height: 1.8;">
            ${t('email.support.surveyAdditionalThoughts')}
          </p>
          
          <div style="background: linear-gradient(135deg, #fef3c7 0%, #fde68a 100%); padding: 20px; border-radius: 8px; margin: 25px 0; text-align: center; border: 1px solid #fbbf24;">
            <p style="font-size: 16px; margin: 0; color: #92400e; font-weight: 600;">
              ${t('email.support.surveyThankYouCommunity')}
            </p>
          </div>
          
          <div style="margin-top: 40px; padding-top: 25px; border-top: 1px solid #e5e7eb; text-align: center;">
            <p style="color: #6b7280; font-size: 15px; margin: 0;">${t('email.support.warmRegards')}</p>
            <p style="color: #6366f1; font-size: 16px; margin: 5px 0 0 0; font-weight: 600;">${t('email.support.cumpridoTeam')}</p>
          </div>
        </div>
      </body>
      </html>
    `;

    return { subject: subjectText, text: textContent, html: htmlContent, type: 'Survey thank you' };
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
      },
    });

    if (!ticket) {
      throw new NotFoundException('Support ticket not found');
    }

    return ticket;
  }

  async assignTicket(ticketId: string, adminId: string, adminCapabilities: string[]) {
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
      throw new UnauthorizedException('You can only resolve tickets assigned to you');
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
      throw new UnauthorizedException('You can only update tickets assigned to you');
    }

    const updated = await this.prisma.supportTicket.update({
      where: { id: ticketId },
      data: {
        status,
        adminNotes: notes || ticket.adminNotes,
      },
    });

    return { ticket: updated, message: 'Ticket status updated successfully' };
  }

  /**
   * Respond to a support ticket (send email to user)
   */
  async respondToTicket(
    ticketId: string,
    adminId: string,
    response: string,
  ) {
    const ticket = await this.getTicket(ticketId);

    // Get user email
    const userEmail = ticket.user?.email || ticket.email;
    const userName = ticket.user 
      ? `${ticket.user.firstName || ''} ${ticket.user.lastName || ''}`.trim() || ticket.user.email
      : ticket.name || 'there';

    if (!userEmail) {
      throw new BadRequestException('Cannot respond to ticket: no email address found');
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

    // Send response email
    try {
      const userId = ticket.userId || undefined;
      const t = await this.emailTranslations.getTranslatorForUser(userId);
      const language = await this.emailTranslations.getUserLanguage(userId);
      
      const emailSubject = t('email.support.responseSubject', { 
        subject: ticket.subject, 
        ticketNumber: ticket.ticketNumber 
      });
      const emailText = t('email.support.responseText', {
        userName,
        ticketNumber: ticket.ticketNumber,
        response,
        adminName
      });

      const emailHtml = `
        <!DOCTYPE html>
        <html lang="${language}">
        <head>
          <meta charset="utf-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
          <title>${t('email.support.responseTitle')}</title>
        </head>
        <body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
          <div style="background: linear-gradient(135deg, #6366f1 0%, #8b5cf6 100%); padding: 30px; text-align: center; border-radius: 10px 10px 0 0;">
            <h1 style="color: #fff; margin: 0; font-size: 28px;">${t('email.support.responseHeader')}</h1>
          </div>
          <div style="background: #f9fafb; padding: 30px; border-radius: 0 0 10px 10px; border: 1px solid #e5e7eb; border-top: none;">
            <p style="font-size: 16px; margin-bottom: 20px;">${t('email.support.greeting', { userName })}</p>
            <p style="font-size: 16px; margin-bottom: 20px;">${t('email.support.responseThankYou')}</p>
            
            <div style="background: #fff; padding: 20px; border-radius: 8px; margin: 20px 0; border-left: 4px solid #6366f1;">
              <p style="margin: 10px 0; color: #6b7280; font-size: 14px;"><strong>${t('email.support.ticketNumber')}:</strong> ${ticket.ticketNumber}</p>
              <p style="margin: 10px 0; color: #6b7280; font-size: 14px;"><strong>${t('email.support.subject')}:</strong> ${ticket.subject}</p>
            </div>
            
            <div style="background: #fff; padding: 20px; border-radius: 8px; margin: 20px 0;">
              <p style="white-space: pre-wrap; font-size: 16px; line-height: 1.8;">${response.replace(/\n/g, '<br>')}</p>
            </div>
            
            <p style="font-size: 16px; margin-top: 20px;">${t('email.support.responseFurtherQuestions', { ticketNumber: ticket.ticketNumber })}</p>
            
            <div style="margin-top: 30px; padding-top: 20px; border-top: 1px solid #e5e7eb;">
              <p style="color: #6b7280; font-size: 14px; margin: 0;">${t('email.support.bestRegards')}<br><strong style="color: #6366f1;">${adminName}</strong><br>${t('email.support.supportTeam')}</p>
            </div>
          </div>
        </body>
        </html>
      `;

      await this.notifications.sendEmail(userEmail, emailSubject, emailText, emailHtml);
      this.logger.log(`Support ticket response email sent to ${userEmail} for ticket ${ticket.ticketNumber}`);

      return { success: true, message: 'Response sent successfully' };
    } catch (emailError) {
      this.logger.error(`Failed to send support ticket response email: ${emailError}`);
      throw new BadRequestException('Failed to send response email');
    }
  }
}

