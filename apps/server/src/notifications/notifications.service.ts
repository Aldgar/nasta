import { Injectable, Logger } from '@nestjs/common';
import { EventEmitter } from 'events';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../prisma/prisma.service';
import { EmailTranslationsService } from './email-translations.service';

export type DeletionRequestCreatedEvent = {
  userId: string;
  requestId: string;
  reason?: string;
};

export type BackgroundCheckSubmittedEvent = {
  userId: string;
  checkId: string;
};

@Injectable()
export class NotificationsService {
  private readonly emitter = new EventEmitter();
  private readonly logger = new Logger('Notifications');
  private mailReady = false;
  private smsReady = false;
  private mailConfigWarned = false;

  constructor(
    private readonly config: ConfigService,
    private readonly prisma: PrismaService,
    private readonly emailTranslations: EmailTranslationsService,
  ) {}

  private ensureMailReady() {
    if (this.mailReady) return true;
    const apiKey = this.config.get<string>('RESEND_API_KEY');
    const from = this.config.get<string>('RESEND_FROM');
    if (!apiKey || !from) return false;
    this.mailReady = true;
    return true;
  }

  private ensureSmsReady() {
    if (this.smsReady) return true;
    const apiKey = this.config.get<string>('VONAGE_API_KEY');
    const apiSecret = this.config.get<string>('VONAGE_API_SECRET');
    const from =
      this.config.get<string>('SMS_FROM') ||
      this.config.get<string>('VONAGE_FROM');
    if (!apiKey || !apiSecret || !from) return false;
    this.smsReady = true;
    return true;
  }

  private normalizeHtmlLang(language: string | undefined): 'en' | 'pt' {
    return language?.toLowerCase().startsWith('pt') ? 'pt' : 'en';
  }

  private getServerPublicUrl(): string {
    // Prefer a public server URL so email links work without the web client deployed.
    const raw =
      this.config.get<string>('SERVER_PUBLIC_URL') ||
      this.config.get<string>('CLIENT_BASE_URL') ||
      'http://localhost:3001';
    return raw;
  }

  private buildVerifyEmailRedirectLink(token: string): string {
    const base = this.getServerPublicUrl();
    const url = new URL('/verify-email', base);
    url.searchParams.set('token', token);
    return url.toString();
  }

  private getPaymentTypeLabel(
    paymentType: string | null | undefined,
    t: (key: string, params?: any) => string,
  ): string | null {
    if (!paymentType) return null;
    const normalized = paymentType.trim().toUpperCase();
    switch (normalized) {
      case 'HOURLY':
        return t('onboarding.hourly');
      case 'DAILY':
        return t('onboarding.daily');
      case 'WEEKLY':
        return t('onboarding.weekly');
      case 'MONTHLY':
        return t('onboarding.monthly');
      case 'HOUR':
        return t('onboarding.hour');
      case 'OTHER':
        return t('onboarding.other');
      default:
        return null;
    }
  }

  private getReferralEmailHtml(
    friendName: string,
    referrerName: string,
    referrerEmail: string,
    signupLink: string,
    t: (key: string, params?: any) => string,
    language: 'en' | 'pt' = 'en',
  ): string {
    return `
<!DOCTYPE html>
<html lang="${language}">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${t('email.referral.invitationTitle')}</title>
</head>
<body style="margin: 0; padding: 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; background-color: #f5f5f5;">
  <table role="presentation" style="width: 100%; border-collapse: collapse; background-color: #f5f5f5;">
    <tr>
      <td align="center" style="padding: 40px 20px;">
        <table role="presentation" style="max-width: 600px; width: 100%; border-collapse: collapse; background-color: #ffffff; border-radius: 12px; box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);">
          <!-- Header -->
          <tr>
            <td style="padding: 40px 40px 30px; text-align: center; background: linear-gradient(135deg, #6366f1 0%, #8b5cf6 100%); border-radius: 12px 12px 0 0;">
              <h1 style="margin: 0; color: #ffffff; font-size: 32px; font-weight: 700; letter-spacing: -0.5px;">${t('email.referral.invitationHeader')}</h1>
            </td>
          </tr>
          
          <!-- Content -->
          <tr>
            <td style="padding: 40px;">
              <h2 style="margin: 0 0 20px; color: #1f2937; font-size: 24px; font-weight: 600;">${t('email.referral.invitationGreeting', { friendName })} 👋</h2>
              <p style="margin: 0 0 24px; color: #4b5563; font-size: 16px; line-height: 1.6;">
                ${t('email.referral.invitationMessage1', { referrerName, referrerEmail })}
              </p>
              
              <p style="margin: 0 0 24px; color: #4b5563; font-size: 16px; line-height: 1.6;">
                ${t('email.referral.invitationMessage2')}
              </p>
              
              <!-- CTA Button -->
              <table role="presentation" style="width: 100%; border-collapse: collapse; margin: 32px 0;">
                <tr>
                  <td align="center" style="padding: 0;">
                    <a href="${signupLink}" style="display: inline-block; padding: 16px 32px; background: linear-gradient(135deg, #6366f1 0%, #8b5cf6 100%); color: #ffffff; text-decoration: none; border-radius: 8px; font-weight: 600; font-size: 16px; box-shadow: 0 4px 6px rgba(99, 102, 241, 0.3);">${t('email.referral.joinButton')}</a>
                  </td>
                </tr>
              </table>
              
              <!-- Features -->
              <div style="margin: 40px 0 0; padding: 24px; background-color: #f9fafb; border-radius: 8px;">
                <h3 style="margin: 0 0 16px; color: #1f2937; font-size: 18px; font-weight: 600;">${t('email.referral.whyJoin')}</h3>
                <ul style="margin: 0; padding-left: 20px; color: #4b5563; font-size: 15px; line-height: 1.8;">
                  <li style="margin-bottom: 8px;">${t('email.referral.benefit1')}</li>
                  <li style="margin-bottom: 8px;">${t('email.referral.benefit2')}</li>
                  <li style="margin-bottom: 8px;">${t('email.referral.benefit3')}</li>
                  <li style="margin-bottom: 8px;">${t('email.referral.benefit4')}</li>
                </ul>
              </div>
              
              <p style="margin: 32px 0 0; color: #6b7280; font-size: 14px; line-height: 1.6; text-align: center;">
                ${t('email.referral.invitationFooter', { referrerName })}
              </p>
            </td>
          </tr>
          
          <!-- Footer -->
          <tr>
            <td style="padding: 30px 40px; text-align: center; background-color: #f9fafb; border-radius: 0 0 12px 12px; border-top: 1px solid #e5e7eb;">
              <p style="margin: 0; color: #6b7280; font-size: 14px;">
                ${t('email.common.copyright', { year: new Date().getFullYear().toString() })}
              </p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>
    `;
  }

  private getJobReferralEmailHtml(
    candidateName: string,
    employerName: string,
    employerEmail: string,
    job: {
      id: string;
      title: string;
      description: string;
      location: string;
      city: string;
      country: string;
      category?: { id: string; name: string } | null;
      company?: { id: string; name: string } | null;
      rateAmount?: number | null;
      currency?: string | null;
      paymentType?: string | null;
    },
    jobLink: string,
    t: (key: string, params?: any) => string,
    language: 'en' | 'pt' = 'en',
  ): string {
    const locationText =
      job.city && job.country
        ? `${job.city}, ${job.country}`
        : job.location || t('email.jobs.locationNotSpecified');

    const paymentTypeLabel = this.getPaymentTypeLabel(job.paymentType, t);
    const rateText = job.rateAmount
      ? `${job.currency?.toUpperCase() || 'USD'} ${(job.rateAmount / 100).toFixed(2)}${paymentTypeLabel ? ` (${paymentTypeLabel})` : ''}`
      : t('email.jobs.rateNotSpecified');

    return `
<!DOCTYPE html>
<html lang="${language}">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${t('email.jobs.jobReferralTitle', { employerName })}</title>
</head>
<body style="margin: 0; padding: 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; background-color: #f5f5f5;">
  <table role="presentation" style="width: 100%; border-collapse: collapse; background-color: #f5f5f5;">
    <tr>
      <td align="center" style="padding: 40px 20px;">
        <table role="presentation" style="max-width: 600px; width: 100%; border-collapse: collapse; background-color: #ffffff; border-radius: 12px; box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);">
          <!-- Header -->
          <tr>
            <td style="padding: 40px 40px 30px; text-align: center; background: linear-gradient(135deg, #6366f1 0%, #8b5cf6 100%); border-radius: 12px 12px 0 0;">
              <h1 style="margin: 0; color: #ffffff; font-size: 32px; font-weight: 700; letter-spacing: -0.5px;">${t('email.jobs.jobReferralHeader')}</h1>
            </td>
          </tr>
          
          <!-- Content -->
          <tr>
            <td style="padding: 40px;">
              <h2 style="margin: 0 0 20px; color: #1f2937; font-size: 24px; font-weight: 600;">${t('email.jobs.jobReferralGreeting', { candidateName })} 👋</h2>
              <p style="margin: 0 0 24px; color: #4b5563; font-size: 16px; line-height: 1.6;">
                ${t('email.jobs.jobReferralMessage', { employerName, employerEmail })}
              </p>
              
              <!-- Job Details Card -->
              <div style="margin: 32px 0; padding: 24px; background-color: #f9fafb; border-radius: 8px; border-left: 4px solid #6366f1;">
                <h3 style="margin: 0 0 16px; color: #1f2937; font-size: 20px; font-weight: 600;">${job.title}</h3>
                
                ${job.category ? `<p style="margin: 0 0 12px; color: #4b5563; font-size: 15px;"><strong>${t('email.jobs.category')}:</strong> ${job.category.name}</p>` : ''}
                
                <p style="margin: 0 0 12px; color: #4b5563; font-size: 15px;"><strong>${t('email.jobs.location')}:</strong> ${locationText}</p>
                
                ${job.rateAmount ? `<p style="margin: 0 0 12px; color: #4b5563; font-size: 15px;"><strong>${t('email.jobs.rate')}:</strong> ${rateText}</p>` : ''}
                
                
                <div style="margin-top: 16px; padding-top: 16px; border-top: 1px solid #e5e7eb;">
                  <p style="margin: 0 0 8px; color: #1f2937; font-size: 15px; font-weight: 600;">${t('email.jobs.description')}:</p>
                  <p style="margin: 0; color: #4b5563; font-size: 14px; line-height: 1.6; white-space: pre-wrap;">${job.description}</p>
                </div>
              </div>
              
              <!-- CTA Button -->
              <table role="presentation" style="width: 100%; border-collapse: collapse; margin: 32px 0;">
                <tr>
                  <td align="center" style="padding: 0;">
                    <a href="${jobLink}" style="display: inline-block; padding: 16px 32px; background: linear-gradient(135deg, #6366f1 0%, #8b5cf6 100%); color: #ffffff; text-decoration: none; border-radius: 8px; font-weight: 600; font-size: 16px; box-shadow: 0 4px 6px rgba(99, 102, 241, 0.3);">${t('email.jobs.viewAndApplyButton')}</a>
                  </td>
                </tr>
              </table>
              
              <p style="margin: 32px 0 0; color: #6b7280; font-size: 14px; line-height: 1.6; text-align: center;">
                ${t('email.jobs.jobReferralFooter', { employerName })}
              </p>
            </td>
          </tr>
          
          <!-- Footer -->
          <tr>
            <td style="padding: 30px 40px; text-align: center; background-color: #f9fafb; border-radius: 0 0 12px 12px; border-top: 1px solid #e5e7eb;">
              <p style="margin: 0; color: #6b7280; font-size: 14px;">
                ${t('email.common.copyright', { year: new Date().getFullYear().toString() })}
              </p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>
    `;
  }

  async sendReferralEmail(
    to: string,
    friendName: string,
    referrerName: string,
    referrerEmail: string,
    signupLink: string,
    userId?: string,
  ) {
    const language = userId
      ? this.normalizeHtmlLang(
          await this.emailTranslations.getUserLanguage(userId),
        )
      : 'en';
    const t = userId
      ? await this.emailTranslations.getTranslatorForUser(userId)
      : this.emailTranslations.getTranslator('en');
    const subject = t('email.referral.invitationSubject', { referrerName });
    const text = t('email.referral.invitationText', {
      friendName,
      referrerName,
      referrerEmail,
      signupLink,
    });
    const html = this.getReferralEmailHtml(
      friendName,
      referrerName,
      referrerEmail,
      signupLink,
      t,
      language,
    );
    return await this.sendEmail(to, subject, text, html);
  }

  async sendJobReferralEmail(
    to: string,
    candidateName: string,
    employerName: string,
    employerEmail: string,
    job: {
      id: string;
      title: string;
      description: string;
      location: string;
      city: string;
      country: string;
      category?: { id: string; name: string } | null;
      company?: { id: string; name: string } | null;
      rateAmount?: number | null;
      currency?: string | null;
      paymentType?: string | null;
    },
    userId?: string,
  ) {
    const clientBaseUrl =
      this.config.get<string>('CLIENT_BASE_URL') || 'http://localhost:3002';
    const jobLink = `${clientBaseUrl}/jobs/${job.id}`;

    const language = userId
      ? this.normalizeHtmlLang(
          await this.emailTranslations.getUserLanguage(userId),
        )
      : 'en';
    const t = userId
      ? await this.emailTranslations.getTranslatorForUser(userId)
      : this.emailTranslations.getTranslator('en');

    const locationText =
      job.city && job.country
        ? `${job.city}, ${job.country}`
        : job.location || t('email.jobs.locationNotSpecified');

    const paymentTypeLabel = this.getPaymentTypeLabel(job.paymentType, t);
    const rateText = job.rateAmount
      ? `${job.currency?.toUpperCase() || 'USD'} ${(job.rateAmount / 100).toFixed(2)}${paymentTypeLabel ? ` (${paymentTypeLabel})` : ''}`
      : t('email.jobs.rateNotSpecified');

    const subject = t('email.jobs.jobReferralSubject', { employerName });
    const text = t('email.jobs.jobReferralText', {
      candidateName,
      employerName,
      employerEmail,
      jobTitle: job.title,
      category: job.category?.name || t('email.common.na'),
      location: `${job.city || job.location || t('email.common.na')}, ${job.country || t('email.common.na')}`,
      rate: job.rateAmount ? rateText : '',
      description: job.description,
      jobLink,
    });
    const html = this.getJobReferralEmailHtml(
      candidateName,
      employerName,
      employerEmail,
      job,
      jobLink,
      t,
      language,
    );
    return await this.sendEmail(to, subject, text, html);
  }

  async sendEmail(to: string, subject: string, text: string, html?: string) {
    try {
      const ok = this.ensureMailReady();
      if (!ok) {
        if (!this.mailConfigWarned) {
          this.mailConfigWarned = true;
          this.logger.warn(
            'Email is not configured (missing RESEND_API_KEY and/or RESEND_FROM). Skipping email sends.',
          );
        }
        return false;
      }

      const apiKey = this.config.get<string>('RESEND_API_KEY') || '';
      const fromEmail = this.config.get<string>('RESEND_FROM') || '';

      // Format from field with display name: "Cumprido <email@domain.com>"
      // Always use "Cumprido" as the display name, extract email if format already includes display name
      let emailAddress = fromEmail;
      if (fromEmail.includes('<') && fromEmail.includes('>')) {
        // Extract email from format like "Name <email@domain.com>"
        const match = fromEmail.match(/<([^>]+)>/);
        if (match && match[1]) {
          emailAddress = match[1];
        }
      }

      // Always format as "Cumprido <email@domain.com>"
      // Note: Brand name in from field is intentional and not translated
      const from = emailAddress ? `Cumprido <${emailAddress}>` : fromEmail;

      // Dynamic import of Resend SDK
      type ResendClient = {
        emails: {
          send: (args: {
            from: string;
            to: string | string[];
            subject: string;
            text?: string;
            html?: string;
          }) => Promise<{ data?: { id: string }; error?: { message: string } }>;
        };
      };

      // Resend constructor takes apiKey as a string parameter, not an object
      type ResendConstructor = new (apiKey?: string) => ResendClient;
      const resendMod = (await import('resend')) as {
        Resend: ResendConstructor;
      };

      const Resend = resendMod.Resend;
      const resend = new Resend(apiKey);

      const result = await resend.emails.send({
        from,
        to,
        subject,
        text,
        html,
      });

      if (result.error) {
        this.logger.error(
          `Resend email send failed to ${to}: ${result.error.message}`,
          result.error,
        );
        return false;
      }

      // Log the email ID if available for tracking
      const emailId = result.data?.id || 'unknown';
      this.logger.log(
        `Email sent to ${to} via Resend (ID: ${emailId}): ${subject}`,
      );

      // Additional debug logging with full response
      this.logger.debug(
        `Email details - From: ${from}, To: ${to}, Subject: ${subject}`,
      );
      this.logger.debug(`Resend response: ${JSON.stringify(result, null, 2)}`);

      // Check if email was actually queued/sent
      if (!result.data?.id) {
        this.logger.warn(
          `Email sent to ${to} but no ID returned from Resend. Full response: ${JSON.stringify(result)}`,
        );
      } else {
        // Log helpful troubleshooting info
        this.logger.log(
          `📧 Email queued successfully. Check Resend dashboard: https://resend.com/emails/${emailId} | Troubleshooting: Check spam folder, verify domain in Resend, ensure account is not in test mode`,
        );
      }

      return true;
    } catch (err) {
      this.logger.warn(`Email send failed: ${(err as Error).message}`);
      return false;
    }
  }

  private getWelcomeEmailHtml(
    firstName: string,
    deepLink: string,
    universalLink: string,
    token: string,
    t: (key: string, params?: any) => string,
    language: 'en' | 'pt' = 'en',
  ): string {
    return `
<!DOCTYPE html>
<html lang="${language}">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${t('email.auth.welcomeTitle')}</title>
</head>
<body style="margin: 0; padding: 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; background-color: #f5f5f5;">
  <table role="presentation" style="width: 100%; border-collapse: collapse; background-color: #f5f5f5;">
    <tr>
      <td align="center" style="padding: 40px 20px;">
        <table role="presentation" style="max-width: 600px; width: 100%; border-collapse: collapse; background-color: #ffffff; border-radius: 12px; box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);">
          <!-- Header -->
          <tr>
            <td style="padding: 40px 40px 30px; text-align: center; background: linear-gradient(135deg, #6366f1 0%, #8b5cf6 100%); border-radius: 12px 12px 0 0;">
              <h1 style="margin: 0; color: #ffffff; font-size: 32px; font-weight: 700; letter-spacing: -0.5px;">${t('email.auth.welcomeHeader')}</h1>
            </td>
          </tr>
          
          <!-- Content -->
          <tr>
            <td style="padding: 40px;">
              <h2 style="margin: 0 0 20px; color: #1f2937; font-size: 24px; font-weight: 600;">${t('email.auth.welcomeGreeting', { firstName })} 👋</h2>
              <p style="margin: 0 0 24px; color: #4b5563; font-size: 16px; line-height: 1.6;">
                ${t('email.auth.welcomeMessage1')}
              </p>
              
              <p style="margin: 0 0 24px; color: #4b5563; font-size: 16px; line-height: 1.6;">
                ${t('email.auth.welcomeMessage2')}
              </p>
              
              <!-- CTA Button - Uses HTTPS Universal Link (email-safe) -->
              <table role="presentation" style="width: 100%; border-collapse: collapse; margin: 32px 0;">
                <tr>
                  <td align="center" style="padding: 0;">
                    <a href="${universalLink}" style="display: inline-block; padding: 16px 32px; background: linear-gradient(135deg, #6366f1 0%, #8b5cf6 100%); color: #ffffff; text-decoration: none; border-radius: 8px; font-weight: 600; font-size: 16px; box-shadow: 0 4px 6px rgba(99, 102, 241, 0.3);">${t('email.auth.verifyEmailButton')}</a>
                  </td>
                </tr>
              </table>

              <!-- Verification Code Fallback -->
              <div style="margin: 0 0 32px; padding: 20px; background-color: #f9fafb; border-radius: 8px; border-left: 4px solid #6366f1;">
                <p style="margin: 0 0 8px; color: #374151; font-size: 14px; font-weight: 600;">${t('email.auth.alternativeCode')}</p>
                <p style="margin: 0; color: #1f2937; font-size: 18px; font-weight: 700; font-family: 'Courier New', monospace; letter-spacing: 2px;">${token}</p>
              </div>
              
              <!-- Features -->
              <div style="margin: 40px 0 0; padding: 24px; background-color: #f9fafb; border-radius: 8px;">
                <h3 style="margin: 0 0 16px; color: #1f2937; font-size: 18px; font-weight: 600;">${t('email.auth.whatsNext')}</h3>
                <ul style="margin: 0; padding-left: 20px; color: #4b5563; font-size: 15px; line-height: 1.8;">
                  <li style="margin-bottom: 8px;">${t('email.auth.nextStep1')}</li>
                  <li style="margin-bottom: 8px;">${t('email.auth.nextStep2')}</li>
                  <li style="margin-bottom: 8px;">${t('email.auth.nextStep3')}</li>
                  <li>${t('email.auth.nextStep4')}</li>
                </ul>
              </div>
            </td>
          </tr>
          
          <!-- Footer -->
          <tr>
            <td style="padding: 30px 40px; background-color: #f9fafb; border-radius: 0 0 12px 12px; border-top: 1px solid #e5e7eb;">
              <p style="margin: 0 0 12px; color: #6b7280; font-size: 14px; line-height: 1.6;">
                ${t('email.auth.ignoreEmail')}
              </p>
              <p style="margin: 0; color: #9ca3af; font-size: 12px; line-height: 1.6;">
                ${t('email.auth.verificationExpiry')}
              </p>
            </td>
          </tr>
        </table>
        
        <!-- Footer Text -->
        <p style="margin: 24px 0 0; color: #9ca3af; font-size: 12px; text-align: center;">
          ${t('email.common.copyright', { year: new Date().getFullYear().toString() })}
        </p>
      </td>
    </tr>
  </table>
</body>
</html>
    `.trim();
  }

  private getEmailVerificationHtml(
    deepLink: string,
    universalLink: string,
    token: string,
    t: (key: string, params?: any) => string,
    language: 'en' | 'pt' = 'en',
  ): string {
    return `
<!DOCTYPE html>
<html lang="${language}">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${t('email.auth.verifyEmailTitle')}</title>
</head>
<body style="margin: 0; padding: 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; background-color: #f5f5f5;">
  <table role="presentation" style="width: 100%; border-collapse: collapse; background-color: #f5f5f5;">
    <tr>
      <td align="center" style="padding: 40px 20px;">
        <table role="presentation" style="max-width: 600px; width: 100%; border-collapse: collapse; background-color: #ffffff; border-radius: 12px; box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);">
          <!-- Header -->
          <tr>
            <td style="padding: 40px 40px 30px; text-align: center; background: linear-gradient(135deg, #6366f1 0%, #8b5cf6 100%); border-radius: 12px 12px 0 0;">
              <h1 style="margin: 0; color: #ffffff; font-size: 32px; font-weight: 700; letter-spacing: -0.5px;">${t('email.common.brandName')}</h1>
            </td>
          </tr>
          
          <!-- Content -->
          <tr>
            <td style="padding: 40px;">
              <h2 style="margin: 0 0 20px; color: #1f2937; font-size: 24px; font-weight: 600;">${t('email.auth.verifyEmailWelcome')}</h2>
              <p style="margin: 0 0 24px; color: #4b5563; font-size: 16px; line-height: 1.6;">
                ${t('email.auth.verifyEmailMessage')}
              </p>
              
              <!-- CTA Button - Uses HTTPS Universal Link (email-safe) -->
              <table role="presentation" style="width: 100%; border-collapse: collapse; margin: 32px 0;">
                <tr>
                  <td align="center" style="padding: 0;">
                    <a href="${universalLink}" style="display: inline-block; padding: 16px 32px; background: linear-gradient(135deg, #6366f1 0%, #8b5cf6 100%); color: #ffffff; text-decoration: none; border-radius: 8px; font-weight: 600; font-size: 16px; box-shadow: 0 4px 6px rgba(99, 102, 241, 0.3);">${t('email.auth.verifyEmailButton')}</a>
                  </td>
                </tr>
              </table>
              
              <!-- Alternative Link -->
              <p style="margin: 32px 0 0; color: #6b7280; font-size: 14px; line-height: 1.6; text-align: center;">
                ${t('email.auth.alternativeLink')}<br>
                <a href="${universalLink}" style="color: #6366f1; text-decoration: none; word-break: break-all;">${universalLink}</a>
              </p>
              
              <!-- Token Fallback -->
              <div style="margin: 32px 0 0; padding: 20px; background-color: #f9fafb; border-radius: 8px; border-left: 4px solid #6366f1;">
                <p style="margin: 0 0 8px; color: #374151; font-size: 14px; font-weight: 600;">${t('email.auth.alternativeCode')}</p>
                <p style="margin: 0; color: #1f2937; font-size: 18px; font-weight: 700; font-family: 'Courier New', monospace; letter-spacing: 2px;">${token}</p>
              </div>
            </td>
          </tr>
          
          <!-- Footer -->
          <tr>
            <td style="padding: 30px 40px; background-color: #f9fafb; border-radius: 0 0 12px 12px; border-top: 1px solid #e5e7eb;">
              <p style="margin: 0 0 12px; color: #6b7280; font-size: 14px; line-height: 1.6;">
                ${t('email.auth.ignoreEmail')}
              </p>
              <p style="margin: 0; color: #9ca3af; font-size: 12px; line-height: 1.6;">
                ${t('email.auth.verificationExpiry')}
              </p>
            </td>
          </tr>
        </table>
        
        <!-- Footer Text -->
        <p style="margin: 24px 0 0; color: #9ca3af; font-size: 12px; text-align: center;">
          ${t('email.common.copyright', { year: new Date().getFullYear().toString() })}
        </p>
      </td>
    </tr>
  </table>
</body>
</html>
    `.trim();
  }

  async getDocumentRequestHtml(
    firstName: string,
    documentName: string,
    reason: string,
    userId?: string,
  ): Promise<string> {
    const language = this.normalizeHtmlLang(
      await this.emailTranslations.getUserLanguage(userId),
    );
    const t = await this.emailTranslations.getTranslatorForUser(userId);
    return `
<!DOCTYPE html>
<html lang="${language}">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${t('email.kyc.documentRequiredTitle')}</title>
</head>
<body style="margin: 0; padding: 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; background-color: #f5f5f5;">
  <table role="presentation" style="width: 100%; border-collapse: collapse; background-color: #f5f5f5;">
    <tr>
      <td align="center" style="padding: 40px 20px;">
        <table role="presentation" style="max-width: 600px; width: 100%; border-collapse: collapse; background-color: #ffffff; border-radius: 12px; box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);">
          <!-- Header -->
          <tr>
            <td style="padding: 40px 40px 30px; text-align: center; background: linear-gradient(135deg, #6366f1 0%, #8b5cf6 100%); border-radius: 12px 12px 0 0;">
              <h1 style="margin: 0; color: #ffffff; font-size: 32px; font-weight: 700; letter-spacing: -0.5px;">${t('email.common.brandName')}</h1>
            </td>
          </tr>
          
          <!-- Content -->
          <tr>
            <td style="padding: 40px;">
              <h2 style="margin: 0 0 20px; color: #1f2937; font-size: 24px; font-weight: 600;">${t('email.kyc.documentRequiredHeader')}</h2>
              <p style="margin: 0 0 24px; color: #4b5563; font-size: 16px; line-height: 1.6;">
                ${t('email.kyc.documentRequiredGreeting', { firstName })}
              </p>
              <p style="margin: 0 0 24px; color: #4b5563; font-size: 16px; line-height: 1.6;">
                ${t('email.kyc.documentRequiredMessage')}
              </p>
              
              <!-- Document Details Card -->
              <div style="margin: 32px 0; padding: 24px; background: linear-gradient(135deg, rgba(99, 102, 241, 0.1) 0%, rgba(139, 92, 246, 0.1) 100%); border-radius: 8px; border-left: 4px solid #6366f1;">
                <p style="margin: 0 0 12px; color: #1f2937; font-size: 16px; font-weight: 600;">
                  <strong>${t('email.kyc.document')}:</strong> ${documentName}
                </p>
                <p style="margin: 0; color: #4b5563; font-size: 14px; line-height: 1.6;">
                  <strong>${t('email.kyc.reason')}:</strong> ${reason}
                </p>
              </div>
              
              <!-- Instructions -->
              <div style="margin: 32px 0; padding: 20px; background-color: #f9fafb; border-radius: 8px;">
                <p style="margin: 0 0 12px; color: #1f2937; font-size: 16px; font-weight: 600;">
                  ${t('email.kyc.whatToDoNext')}:
                </p>
                <ol style="margin: 0; padding-left: 20px; color: #4b5563; font-size: 14px; line-height: 1.8;">
                  <li style="margin-bottom: 8px;">${t('email.kyc.instruction1')}</li>
                  <li style="margin-bottom: 8px;">${t('email.kyc.instruction2')}</li>
                  <li style="margin-bottom: 8px;">${t('email.kyc.instruction3')}</li>
                  <li>${t('email.kyc.instruction4')}</li>
                </ol>
              </div>
            </td>
          </tr>
          
          <!-- Footer -->
          <tr>
            <td style="padding: 30px 40px; background-color: #f9fafb; border-radius: 0 0 12px 12px; border-top: 1px solid #e5e7eb;">
              <p style="margin: 0; color: #6b7280; font-size: 14px; line-height: 1.6;">
                ${t('email.common.supportMessage')}
              </p>
            </td>
          </tr>
        </table>
        
        <!-- Footer Text -->
        <p style="margin: 24px 0 0; color: #9ca3af; font-size: 12px; text-align: center;">
          ${t('email.common.copyright', { year: new Date().getFullYear().toString() })}
        </p>
      </td>
    </tr>
  </table>
</body>
</html>
    `.trim();
  }

  private getEmailVerifiedHtml(
    firstName: string,
    t: (key: string, params?: any) => string,
    language: 'en' | 'pt' = 'en',
  ): string {
    return `
<!DOCTYPE html>
<html lang="${language}">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${t('email.auth.emailVerifiedTitle')}</title>
</head>
<body style="margin: 0; padding: 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; background-color: #f5f5f5;">
  <table role="presentation" style="width: 100%; border-collapse: collapse; background-color: #f5f5f5;">
    <tr>
      <td align="center" style="padding: 40px 20px;">
        <table role="presentation" style="max-width: 600px; width: 100%; border-collapse: collapse; background-color: #ffffff; border-radius: 12px; box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);">
          <!-- Header -->
          <tr>
            <td style="padding: 40px 40px 30px; text-align: center; background: linear-gradient(135deg, #6366f1 0%, #8b5cf6 100%); border-radius: 12px 12px 0 0;">
              <h1 style="margin: 0; color: #ffffff; font-size: 32px; font-weight: 700; letter-spacing: -0.5px;">${t('email.common.brandName')}</h1>
            </td>
          </tr>
          
          <!-- Content -->
          <tr>
            <td style="padding: 40px;">
              <h2 style="margin: 0 0 20px; color: #1f2937; font-size: 24px; font-weight: 600;">${t('email.auth.emailVerifiedHeader')}</h2>
              <p style="margin: 0 0 24px; color: #4b5563; font-size: 16px; line-height: 1.6;">
                ${t('email.auth.emailVerifiedGreeting', { firstName })}
              </p>
              <p style="margin: 0 0 24px; color: #4b5563; font-size: 16px; line-height: 1.6;">
                ${t('email.auth.emailVerifiedMessage')}
              </p>
              
              <!-- Success Icon/Message -->
              <div style="margin: 32px 0; padding: 24px; background: linear-gradient(135deg, rgba(99, 102, 241, 0.1) 0%, rgba(139, 92, 246, 0.1) 100%); border-radius: 8px; border-left: 4px solid #6366f1;">
                <p style="margin: 0; color: #1f2937; font-size: 16px; font-weight: 600; text-align: center;">
                  ✓ ${t('email.auth.accountActivated')}
                </p>
              </div>
              
              <!-- Next Steps -->
              <div style="margin: 40px 0 0; padding: 24px; background-color: #f9fafb; border-radius: 8px;">
                <h3 style="margin: 0 0 16px; color: #1f2937; font-size: 18px; font-weight: 600;">${t('email.auth.whatsNext')}</h3>
                <ul style="margin: 0; padding-left: 20px; color: #4b5563; font-size: 15px; line-height: 1.8;">
                  <li style="margin-bottom: 8px;">${t('email.auth.nextStep1')}</li>
                  <li style="margin-bottom: 8px;">${t('email.auth.nextStep2')}</li>
                  <li style="margin-bottom: 8px;">${t('email.auth.nextStep3')}</li>
                  <li>${t('email.auth.nextStep4')}</li>
                </ul>
              </div>
            </td>
          </tr>
          
          <!-- Footer -->
          <tr>
            <td style="padding: 30px 40px; background-color: #f9fafb; border-radius: 0 0 12px 12px; border-top: 1px solid #e5e7eb;">
              <p style="margin: 0; color: #6b7280; font-size: 14px; line-height: 1.6;">
                ${t('email.common.supportMessage')}
              </p>
            </td>
          </tr>
        </table>
        
        <!-- Footer Text -->
        <p style="margin: 24px 0 0; color: #9ca3af; font-size: 12px; text-align: center;">
          ${t('email.common.copyright', { year: new Date().getFullYear().toString() })}
        </p>
      </td>
    </tr>
  </table>
</body>
</html>
    `.trim();
  }

  private async sendSms(to: string, body: string) {
    try {
      const ok = this.ensureSmsReady();
      if (!ok) {
        this.logger.warn('SMS not ready - missing Vonage configuration');
        return false;
      }

      const apiKey = this.config.get<string>('VONAGE_API_KEY') || '';
      const apiSecret = this.config.get<string>('VONAGE_API_SECRET') || '';
      const configuredFrom =
        this.config.get<string>('SMS_FROM') ||
        this.config.get<string>('VONAGE_FROM') ||
        '';

      let from = configuredFrom.trim();
      if (!from) {
        this.logger.warn(
          'SMS sender not configured (set SMS_FROM or VONAGE_FROM)',
        );
        return false;
      }

      // Vonage supports both numeric senders and alphanumeric sender IDs (market-dependent).
      // If it's not a phone-like sender, normalize it to a safe alphanumeric ID.
      const isNumericSender = /^\+?\d+$/.test(from);
      if (!isNumericSender) {
        const cleaned = from.replace(/[^a-z0-9]/gi, '').slice(0, 11);
        if (!cleaned) {
          this.logger.warn(
            `Invalid SMS sender name: ${from}. Set SMS_FROM to something like "Cumprido".`,
          );
          return false;
        }
        from = cleaned;
      }

      // Validate phone number format (should be E.164 format: +[country code][number])
      if (!to.startsWith('+')) {
        this.logger.warn(
          `Invalid phone number format: ${to}. Expected E.164 format (e.g., +351924243340)`,
        );
        // Try to fix it by adding + if it starts with a number
        if (/^\d/.test(to)) {
          to = '+' + to;
          this.logger.log(`Auto-corrected phone number to: ${to}`);
        } else {
          return false;
        }
      }

      // Dynamic import of Vonage SDK - it uses named export { Vonage }
      type VonageClient = {
        sms: {
          send: (args: { from: string; to: string; text: string }) => Promise<{
            messages: Array<{
              status: string;
              errorText?: string;
              errorCode?: string;
              messageId?: string;
            }>;
          }>;
        };
      };

      type VonageConstructor = new (opts: {
        apiKey: string;
        apiSecret: string;
      }) => VonageClient;
      let Vonage: VonageConstructor | undefined;
      try {
        // eslint-disable-next-line @typescript-eslint/no-require-imports
        const vonageMod = require('@vonage/server-sdk') as {
          Vonage?: VonageConstructor;
        };
        Vonage = vonageMod?.Vonage;
      } catch {
        this.logger.warn('Vonage SDK not installed - SMS disabled');
        return false;
      }

      if (!Vonage) {
        this.logger.warn('Vonage SDK missing Vonage export - SMS disabled');
        return false;
      }

      const vonage = new Vonage({ apiKey, apiSecret });

      this.logger.debug(`Attempting to send SMS to ${to} from ${from}`);

      const result = await vonage.sms.send({
        from,
        to,
        text: body,
      });

      // Log full response for debugging
      this.logger.debug(`Vonage SMS response: ${JSON.stringify(result)}`);

      // Check if message was sent successfully
      // Status '0' means success, but we should also check for other success indicators
      if (result.messages && result.messages.length > 0) {
        const message = result.messages[0];
        const status = message.status;
        const errorCode = message.errorCode;
        const errorText = message.errorText;

        // Status codes: '0' = success, others = various errors
        if (status === '0') {
          this.logger.log(
            `SMS sent to ${to} via Vonage (message ID: ${message.messageId || 'N/A'})`,
          );
          return true;
        } else {
          // Log detailed error information
          this.logger.error(
            `Vonage SMS send failed for ${to}: status=${status}, errorCode=${errorCode}, errorText=${errorText || 'N/A'}`,
          );
          return false;
        }
      } else {
        this.logger.warn(
          `Vonage SMS send failed: No messages in response for ${to}`,
        );
        return false;
      }
    } catch (err) {
      this.logger.error(
        `SMS send failed for ${to}: ${(err as Error).message}`,
        (err as Error).stack,
      );
      return false;
    }
  }

  onDeletionRequestCreated(listener: (e: DeletionRequestCreatedEvent) => void) {
    this.emitter.on('deletion.request.created', listener);
  }

  onBackgroundCheckSubmitted(
    listener: (e: BackgroundCheckSubmittedEvent) => void,
  ) {
    this.emitter.on('backgroundCheck.submitted', listener);
  }

  emitDeletionRequestCreated(event: DeletionRequestCreatedEvent) {
    this.logger.debug(
      `DeletionRequestCreated user=${event.userId} request=${event.requestId}`,
    );
    this.emitter.emit('deletion.request.created', event);
  }

  emitBackgroundCheckSubmitted(event: BackgroundCheckSubmittedEvent) {
    this.logger.debug(
      `BackgroundCheckSubmitted user=${event.userId} check=${event.checkId}`,
    );
    this.emitter.emit('backgroundCheck.submitted', event);
  }

  // Dev convenience for verification flows
  async sendWelcomeEmail(userId: string, token: string) {
    try {
      const user = await this.prisma.user.findUnique({
        where: { id: userId },
        select: { email: true, firstName: true },
      });
      if (user?.email) {
        // Deep link for mobile app (primary)
        const deepLink = `cumprido://verify-email?token=${token}`;

        // Clickable HTTPS link that redirects into the app (does not require the web client)
        const universalLink = this.buildVerifyEmailRedirectLink(token);

        const language = this.normalizeHtmlLang(
          await this.emailTranslations.getUserLanguage(userId),
        );
        const t = await this.emailTranslations.getTranslatorForUser(userId);
        const firstName = user.firstName || t('email.common.there');

        const subject = t('email.auth.welcomeSubject');
        const text = t('email.auth.welcomeText', {
          firstName,
          verificationLink: universalLink,
          token,
        });
        const html = this.getWelcomeEmailHtml(
          firstName,
          deepLink,
          universalLink,
          token,
          t,
          language,
        );

        await this.sendEmail(user.email, subject, text, html);
      }
    } catch (err) {
      this.logger.warn(`Send welcome email failed: ${(err as Error).message}`);
    }
  }

  async emitEmailVerificationToken(event: { userId: string; token: string }) {
    this.logger.debug(
      `EmailVerifyToken user=${event.userId} token=${event.token}`,
    );
    this.emitter.emit('email.verify.token', event);
    // Try to send email if configured
    try {
      const user = await this.prisma.user.findUnique({
        where: { id: event.userId },
        select: { email: true },
      });
      if (user?.email) {
        // Deep link for mobile app (primary)
        const deepLink = `cumprido://verify-email?token=${event.token}`;

        // Clickable HTTPS link that redirects into the app (does not require the web client)
        const universalLink = this.buildVerifyEmailRedirectLink(event.token);

        const language = this.normalizeHtmlLang(
          await this.emailTranslations.getUserLanguage(event.userId),
        );
        const t = await this.emailTranslations.getTranslatorForUser(
          event.userId,
        );
        const subject = t('email.auth.verifyEmailSubject');
        const text = t('email.auth.verifyEmailText', {
          verificationLink: universalLink,
          token: event.token,
        });
        const html = this.getEmailVerificationHtml(
          deepLink,
          universalLink,
          event.token,
          t,
          language,
        );

        await this.sendEmail(user.email, subject, text, html);
      }
    } catch (err) {
      this.logger.warn(`Lookup/send email failed: ${(err as Error).message}`);
    }
  }

  async emitPhoneOtp(event: { userId: string; code: string }) {
    this.logger.debug(`PhoneOTP user=${event.userId} code=${event.code}`);
    this.emitter.emit('phone.verify.otp', event);
    // Try to send SMS if configured
    try {
      const user = await this.prisma.user.findUnique({
        where: { id: event.userId },
        select: { phone: true },
      });
      if (user?.phone) {
        const t = this.emailTranslations.getTranslator('en');
        const body = t('email.auth.verificationCodeSms', { code: event.code });
        await this.sendSms(user.phone, body);
      }
    } catch (err) {
      this.logger.warn(`Lookup/send SMS failed: ${(err as Error).message}`);
    }
  }

  async sendEmailVerifiedNotification(userId: string) {
    try {
      const user = await this.prisma.user.findUnique({
        where: { id: userId },
        select: { email: true, firstName: true },
      });
      if (user?.email) {
        const language = this.normalizeHtmlLang(
          await this.emailTranslations.getUserLanguage(userId),
        );
        const t = await this.emailTranslations.getTranslatorForUser(userId);
        const firstName = user.firstName || t('email.common.there');
        const subject = t('email.auth.emailVerifiedSubject');
        const text = t('email.auth.emailVerifiedText', { firstName });
        const html = this.getEmailVerifiedHtml(firstName, t, language);
        await this.sendEmail(user.email, subject, text, html);

        // Also send in-app notification
        await this.createNotification({
          userId,
          type: 'SYSTEM',
          title: t('email.auth.emailVerifiedTitle'),
          body: t('email.auth.emailVerifiedBody'),
        });
      }
    } catch (err) {
      this.logger.warn(`Send email verified failed: ${(err as Error).message}`);
    }
  }

  async emitPasswordResetToken(event: { userId: string; token: string }) {
    this.logger.debug(
      `PasswordResetToken user=${event.userId} token=${event.token}`,
    );
    this.emitter.emit('password.reset.token', event);
    try {
      const user = await this.prisma.user.findUnique({
        where: { id: event.userId },
        select: { email: true },
      });
      if (user?.email) {
        const t = await this.emailTranslations.getTranslatorForUser(
          event.userId,
        );
        const subject = t('email.auth.passwordResetSubject');
        const text = t('email.auth.passwordResetText', { token: event.token });
        await this.sendEmail(user.email, subject, text);
      }
    } catch (err) {
      this.logger.warn(
        `Lookup/send password reset failed: ${(err as Error).message}`,
      );
    }
  }

  async emitTemporaryPassword(event: { userId: string; tempPassword: string }) {
    this.logger.debug(`TemporaryPassword user=${event.userId}`);
    this.emitter.emit('password.temporary', event);
    try {
      const user = await this.prisma.user.findUnique({
        where: { id: event.userId },
        select: { email: true, firstName: true },
      });
      if (user?.email) {
        const t = await this.emailTranslations.getTranslatorForUser(
          event.userId,
        );
        const subject = t('email.auth.temporaryPasswordSubject');
        const text = t('email.auth.temporaryPasswordText', {
          tempPassword: event.tempPassword,
          firstName: user.firstName || 'User',
        });
        await this.sendEmail(user.email, subject, text);
      }
    } catch (err) {
      this.logger.warn(
        `Lookup/send temporary password failed: ${(err as Error).message}`,
      );
    }
  }

  async emitEmailChangeToken(event: {
    userId: string;
    token: string;
    newEmail: string;
  }) {
    this.logger.debug(
      `EmailChangeToken user=${event.userId} newEmail=${event.newEmail} token=${event.token}`,
    );
    this.emitter.emit('email.change.token', event);
    try {
      const t = await this.emailTranslations.getTranslatorForUser(event.userId);
      const subject = t('email.auth.emailChangeSubject');
      const text = t('email.auth.emailChangeText', { token: event.token });
      await this.sendEmail(event.newEmail, subject, text);
    } catch (err) {
      this.logger.warn(
        `Send email change token failed: ${(err as Error).message}`,
      );
    }
  }

  // Notify job seekers near a newly created job
  async notifyUsersOfNewJobNearby(jobId: string, radiusKm = 10) {
    try {
      const job = await this.prisma.job.findUnique({
        where: { id: jobId },
        select: {
          id: true,
          title: true,
          location: true,
          city: true,
          country: true,
          coordinates: true,
          skills: {
            select: { skillId: true, isRequired: true },
          },
        },
      });
      if (!job || !job.coordinates || job.coordinates.length !== 2) {
        this.logger.debug(
          `notifyUsersOfNewJobNearby skipped: missing coordinates for job ${jobId}`,
        );
        return { notified: 0 };
      }
      const [lat, lng] = job.coordinates as [number, number];

      // Prepare job skill IDs for matching
      const requiredSkillIds = new Set(
        job.skills.filter((s) => s.isRequired).map((s) => s.skillId),
      );
      const optionalSkillIds = new Set(
        job.skills.filter((s) => !s.isRequired).map((s) => s.skillId),
      );
      const hasRequirements = requiredSkillIds.size > 0;
      const hasOptional = optionalSkillIds.size > 0;

      // Fetch candidate users (active job seekers with coordinates)
      // We also fetch their skills to do in-memory matching
      const users = await this.prisma.user.findMany({
        where: {
          role: 'JOB_SEEKER',
          isActive: true,
          coordinates: { isEmpty: false },
        },
        take: 500,
        select: {
          id: true,
          email: true,
          coordinates: true,
          skills: { select: { skillId: true } },
        },
      });

      let notified = 0;
      for (const u of users) {
        const coords = u.coordinates as [number, number] | null;
        if (!coords || coords.length !== 2) continue;

        // 1. Distance Check
        const d = haversineKm(lat, lng, coords[0], coords[1]);
        if (d > radiusKm) continue;

        // 2. Skill Match Check
        // If job has required skills, user MUST have ALL of them (or AT LEAST ONE? Usually match "at least one" or "all"?
        // "matching the user skills" usually implies relevance.
        // Let's implement: User must have at least one matching skill if job has skills defined.
        // OR strict mode: user must have all required skills.
        // Let's start with a "Relevance" check:
        // - If job has NO skills listed -> Match (location only)
        // - If job HAS skills -> User must match at least one of them.
        const userSkillIds = new Set(u.skills.map((s) => s.skillId));

        let skillsMatch = true;

        // Strategy: matching user skills
        if (hasRequirements || hasOptional) {
          // Check intersection
          const userHasRequired = [...requiredSkillIds].every((id) =>
            userSkillIds.has(id),
          );
          // If we enforce all required skills:
          if (hasRequirements && !userHasRequired) {
            skillsMatch = false;
          }

          // If we also want to ensure at least one skill match if no required skills but some optional?
          // Let's stick to: if there are required skills, user MUST have them.
          // If there are only optional skills, we don't strictly filter, but maybe we should?
          // Let's go with: Must have ALL required skills.
        }

        if (skillsMatch) {
          notified += 1;
          if (u.email) {
            // fire and forget; don't block on failures
            const t = await this.emailTranslations.getTranslatorForUser(u.id);
            void this.sendEmail(
              u.email,
              t('email.jobs.newJobMatchSubject', { jobTitle: job.title }),
              t('email.jobs.newJobMatchText', {
                jobTitle: job.title,
                city: job.city,
                location: job.location || '',
              }),
            );
          }
          // Persist an in-app notification (fire-and-forget)
          const t = await this.emailTranslations.getTranslatorForUser(u.id);
          void this.createNotification({
            userId: u.id,
            type: 'NEARBY_JOB',
            title: t('email.jobs.newJobMatchNotificationTitle', {
              jobTitle: job.title,
            }),
            body: t('email.jobs.newJobMatchNotificationBody', {
              city: job.city || '',
              country: job.country || '',
              location: job.location || '',
            }),
            payload: { jobId: job.id, distanceKm: Math.round(d * 10) / 10 },
          });
        }
      }
      this.logger.log(
        `Job ${jobId} near-notify completed: notified=${notified} (radiusKm=${radiusKm})`,
      );
      return { notified };
    } catch (err) {
      this.logger.warn(
        `notifyUsersOfNewJobNearby failed: ${(err as Error).message}`,
      );
      return { notified: 0 };
    }
  }

  // Persist a notification
  async createNotification(args: {
    userId: string;
    type:
      | 'NEARBY_JOB'
      | 'JOB_MESSAGE'
      | 'APPLICATION_UPDATE'
      | 'SYSTEM'
      | 'LEGAL_ACTION'
      | 'WARNING'
      | 'ACTION_FORM';
    title?: string;
    body?: string;
    payload?: unknown;
  }) {
    try {
      this.logger.log(
        `Creating notification for user ${args.userId}, type: ${args.type}`,
      );
      const notif = (
        this.prisma as unknown as {
          notification: {
            create: (args: unknown) => Promise<unknown>;
            findMany: (args: unknown) => Promise<unknown[]>;
            count: (args: unknown) => Promise<number>;
            update: (args: unknown) => Promise<unknown>;
            updateMany: (args: unknown) => Promise<unknown>;
          };
        }
      ).notification;
      const notification = await notif.create({
        data: {
          userId: args.userId,
          type: args.type,
          title: args.title ?? null,
          body: args.body ?? null,
          payload: args.payload ?? undefined,
          readAt: null, // Explicitly set to null to ensure it's unread
        },
        select: {
          id: true,
          type: true,
          title: true,
          body: true,
          readAt: true, // Include readAt in response to verify
          createdAt: true,
        },
      });

      this.logger.log(
        `✅ Notification created successfully for user ${args.userId}: ${JSON.stringify(notification)}`,
      );

      // Send push notification (fire and forget)
      if (args.title && args.body) {
        void this.sendPushNotification(
          args.userId,
          args.title,
          args.body,
          args.payload,
        );
      }

      return notification;
    } catch (error) {
      this.logger.error(
        `❌ Failed to create notification: ${(error as Error).message}`,
        error,
      );
      throw error;
    }
  }

  async listNotifications(
    userId: string,
    opts: { status: 'unread' | 'all'; page: number; limit: number },
  ) {
    const where = {
      userId,
      ...(opts.status === 'unread' ? { readAt: null } : {}),
    } as const;
    const notif = (
      this.prisma as unknown as {
        notification: {
          create: (args: unknown) => Promise<unknown>;
          findMany: (args: unknown) => Promise<unknown[]>;
          count: (args: unknown) => Promise<number>;
          update: (args: unknown) => Promise<unknown>;
          updateMany: (args: unknown) => Promise<unknown>;
        };
      }
    ).notification;
    const [items, total] = await Promise.all([
      notif.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip: (opts.page - 1) * opts.limit,
        take: opts.limit,
        select: {
          id: true,
          type: true,
          title: true,
          body: true,
          payload: true,
          readAt: true,
          createdAt: true,
        },
      }),
      notif.count({ where }),
    ]);
    return { items, total, page: opts.page, limit: opts.limit };
  }

  async markNotificationRead(userId: string, id: string) {
    const notif = (
      this.prisma as unknown as {
        notification: { update: (args: unknown) => Promise<unknown> };
      }
    ).notification;
    await notif.update({
      where: { id },
      data: { readAt: new Date() },
    });
    return { success: true };
  }

  async getUnreadCount(userId: string) {
    const notif = (
      this.prisma as unknown as {
        notification: {
          count: (args: unknown) => Promise<number>;
        };
      }
    ).notification;

    const count = await notif.count({
      where: {
        userId,
        readAt: null,
      },
    });

    // Removed logging to reduce terminal noise - only log when count changes or on specific actions
    // Logging is now handled at the controller level only when needed

    return { count };
  }

  async markAllRead(userId: string) {
    const notif = (
      this.prisma as unknown as {
        notification: { updateMany: (args: unknown) => Promise<unknown> };
      }
    ).notification;
    await notif.updateMany({
      where: { userId, readAt: null },
      data: { readAt: new Date() },
    });
    return { success: true };
  }

  async sendAdminWelcomeEmail(data: {
    email: string;
    firstName: string;
    lastName: string;
    password: string;
    adminCapabilities: string[];
  }) {
    const t = this.emailTranslations.getTranslator('en'); // Admin emails default to English
    const capabilitiesText = data.adminCapabilities.join(', ');
    const subject = t('email.admin.welcomeSubject');
    const text = t('email.admin.welcomeText', {
      firstName: data.firstName,
      lastName: data.lastName,
      email: data.email,
      password: data.password,
      capabilities: capabilitiesText,
    });

    return await this.sendEmail(data.email, subject, text);
  }

  async sendJobApplicationConfirmationEmail(
    userId: string,
    jobId: string,
    jobTitle: string,
    jobLocation: string,
    employerName: string,
  ) {
    try {
      const user = await this.prisma.user.findUnique({
        where: { id: userId },
        select: { email: true, firstName: true },
      });
      if (user?.email) {
        const language = this.normalizeHtmlLang(
          await this.emailTranslations.getUserLanguage(userId),
        );
        const t = await this.emailTranslations.getTranslatorForUser(userId);
        const firstName = user.firstName || t('email.common.there');
        const subject = t('email.jobs.applicationSubmittedSubject');
        const text = t('email.jobs.applicationSubmittedText', {
          firstName,
          jobTitle,
          employerName,
          jobLocation,
        });
        const html = this.getJobApplicationConfirmationHtml(
          firstName,
          jobTitle,
          employerName,
          jobLocation,
          jobId,
          t,
          language,
        );
        await this.sendEmail(user.email, subject, text, html);
      }
    } catch (err) {
      this.logger.warn(
        `Send job application confirmation email failed: ${(err as Error).message}`,
      );
    }
  }

  private getJobApplicationConfirmationHtml(
    firstName: string,
    jobTitle: string,
    employerName: string,
    jobLocation: string,
    jobId: string,
    t: (key: string, params?: any) => string,
    language: 'en' | 'pt' = 'en',
  ): string {
    return `
<!DOCTYPE html>
<html lang="${language}">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${t('email.jobs.applicationSubmittedTitle')}</title>
</head>
<body style="margin: 0; padding: 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; background-color: #f5f5f5;">
  <table role="presentation" style="width: 100%; border-collapse: collapse; background-color: #f5f5f5;">
    <tr>
      <td align="center" style="padding: 40px 20px;">
        <table role="presentation" style="max-width: 600px; width: 100%; border-collapse: collapse; background-color: #ffffff; border-radius: 12px; box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);">
          <!-- Header -->
          <tr>
            <td style="padding: 40px 40px 30px; text-align: center; background: linear-gradient(135deg, #6366f1 0%, #8b5cf6 100%); border-radius: 12px 12px 0 0;">
              <h1 style="margin: 0; color: #ffffff; font-size: 32px; font-weight: 700; letter-spacing: -0.5px;">${t('email.common.brandName')}</h1>
            </td>
          </tr>
          
          <!-- Content -->
          <tr>
            <td style="padding: 40px;">
              <h2 style="margin: 0 0 20px; color: #1f2937; font-size: 24px; font-weight: 600;">${t('email.jobs.applicationSubmittedHeader')}</h2>
              <p style="margin: 0 0 24px; color: #4b5563; font-size: 16px; line-height: 1.6;">
                ${t('email.jobs.applicationSubmittedGreeting', { firstName })}
              </p>
              <p style="margin: 0 0 24px; color: #4b5563; font-size: 16px; line-height: 1.6;">
                ${t('email.jobs.applicationSubmittedMessage')}
              </p>
              
              <!-- Job Details Card -->
              <div style="margin: 32px 0; padding: 24px; background: linear-gradient(135deg, rgba(99, 102, 241, 0.1) 0%, rgba(139, 92, 246, 0.1) 100%); border-radius: 8px; border-left: 4px solid #6366f1;">
                <h3 style="margin: 0 0 12px; color: #1f2937; font-size: 18px; font-weight: 600;">${jobTitle}</h3>
                <p style="margin: 0 0 8px; color: #4b5563; font-size: 14px;">
                  <strong>${t('email.jobs.employer')}:</strong> ${employerName}
                </p>
                <p style="margin: 0; color: #4b5563; font-size: 14px;">
                  <strong>${t('email.jobs.location')}:</strong> ${jobLocation}
                </p>
              </div>
              
              <!-- Status Info -->
              <div style="margin: 32px 0; padding: 20px; background-color: #f9fafb; border-radius: 8px;">
                <p style="margin: 0 0 12px; color: #1f2937; font-size: 16px; font-weight: 600;">
                  ✓ ${t('email.jobs.applicationStatusPending')}
                </p>
                <p style="margin: 0; color: #4b5563; font-size: 14px; line-height: 1.6;">
                  ${t('email.jobs.applicationStatusMessage')}
                </p>
              </div>
              
              <!-- Next Steps -->
              <div style="margin: 40px 0 0; padding: 24px; background-color: #f9fafb; border-radius: 8px;">
                <h3 style="margin: 0 0 16px; color: #1f2937; font-size: 18px; font-weight: 600;">${t('email.auth.whatsNext')}</h3>
                <ul style="margin: 0; padding-left: 20px; color: #4b5563; font-size: 15px; line-height: 1.8;">
                  <li style="margin-bottom: 8px;">${t('email.jobs.nextStep1')}</li>
                  <li style="margin-bottom: 8px;">${t('email.jobs.nextStep2')}</li>
                  <li style="margin-bottom: 8px;">${t('email.jobs.nextStep3')}</li>
                  <li>${t('email.jobs.nextStep4')}</li>
                </ul>
              </div>
            </td>
          </tr>
          
          <!-- Footer -->
          <tr>
            <td style="padding: 30px 40px; background-color: #f9fafb; border-radius: 0 0 12px 12px; border-top: 1px solid #e5e7eb;">
              <p style="margin: 0; color: #6b7280; font-size: 14px; line-height: 1.6;">
                ${t('email.common.supportMessage')}
              </p>
            </td>
          </tr>
        </table>
        
        <!-- Footer Text -->
        <p style="margin: 24px 0 0; color: #9ca3af; font-size: 12px; text-align: center;">
          ${t('email.common.copyright', { year: new Date().getFullYear().toString() })}
        </p>
      </td>
    </tr>
  </table>
</body>
</html>
    `.trim();
  }

  async getApplicationAcceptedHtml(
    firstName: string,
    jobTitle: string,
    employerName: string,
    message?: string,
    userId?: string,
  ): Promise<string> {
    const language = this.normalizeHtmlLang(
      await this.emailTranslations.getUserLanguage(userId),
    );
    const t = await this.emailTranslations.getTranslatorForUser(userId);
    return `
<!DOCTYPE html>
<html lang="${language}">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${t('email.jobs.applicationAcceptedTitle')}</title>
</head>
<body style="margin: 0; padding: 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; background-color: #f5f5f5;">
  <table role="presentation" style="width: 100%; border-collapse: collapse; background-color: #f5f5f5;">
    <tr>
      <td align="center" style="padding: 40px 20px;">
        <table role="presentation" style="max-width: 600px; width: 100%; border-collapse: collapse; background-color: #ffffff; border-radius: 12px; box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);">
          <!-- Header -->
          <tr>
            <td style="padding: 40px 40px 30px; text-align: center; background: linear-gradient(135deg, #6366f1 0%, #8b5cf6 100%); border-radius: 12px 12px 0 0;">
              <h1 style="margin: 0; color: #ffffff; font-size: 32px; font-weight: 700; letter-spacing: -0.5px;">${t('email.common.brandName')}</h1>
            </td>
          </tr>
          
          <!-- Content -->
          <tr>
            <td style="padding: 40px;">
              <h2 style="margin: 0 0 20px; color: #1f2937; font-size: 24px; font-weight: 600;">${t('email.jobs.applicationAcceptedHeader')}</h2>
              <p style="margin: 0 0 24px; color: #4b5563; font-size: 16px; line-height: 1.6;">
                ${t('email.jobs.applicationAcceptedGreeting', { firstName })}
              </p>
              <p style="margin: 0 0 24px; color: #4b5563; font-size: 16px; line-height: 1.6;">
                ${t('email.jobs.applicationAcceptedMessage', { jobTitle, employerName })}
              </p>
              
              <!-- Success Card -->
              <div style="margin: 32px 0; padding: 24px; background: linear-gradient(135deg, rgba(34, 197, 94, 0.1) 0%, rgba(16, 185, 129, 0.1) 100%); border-radius: 8px; border-left: 4px solid #22c55e;">
                <p style="margin: 0; color: #1f2937; font-size: 18px; font-weight: 700; text-align: center;">
                  ✓ ${t('email.jobs.applicationAcceptedBadge')}
                </p>
              </div>
              
              ${
                message
                  ? `
              <!-- Employer Message -->
              <div style="margin: 32px 0; padding: 20px; background-color: #f9fafb; border-radius: 8px;">
                <p style="margin: 0 0 12px; color: #1f2937; font-size: 16px; font-weight: 600;">${t('email.jobs.messageFromEmployer')}:</p>
                <p style="margin: 0; color: #4b5563; font-size: 15px; line-height: 1.6;">${message}</p>
              </div>
              `
                  : ''
              }
              
              <!-- Next Steps -->
              <div style="margin: 40px 0 0; padding: 24px; background-color: #f9fafb; border-radius: 8px;">
                <h3 style="margin: 0 0 16px; color: #1f2937; font-size: 18px; font-weight: 600;">${t('email.auth.whatsNext')}</h3>
                <ul style="margin: 0; padding-left: 20px; color: #4b5563; font-size: 15px; line-height: 1.8;">
                  <li style="margin-bottom: 8px;">${t('email.jobs.acceptedNextStep1')}</li>
                  <li style="margin-bottom: 8px;">${t('email.jobs.acceptedNextStep2')}</li>
                  <li style="margin-bottom: 8px;">${t('email.jobs.acceptedNextStep3')}</li>
                  <li>${t('email.jobs.acceptedNextStep4')}</li>
                </ul>
              </div>
            </td>
          </tr>
          
          <!-- Footer -->
          <tr>
            <td style="padding: 30px 40px; background-color: #f9fafb; border-radius: 0 0 12px 12px; border-top: 1px solid #e5e7eb;">
              <p style="margin: 0; color: #6b7280; font-size: 14px; line-height: 1.6;">
                ${t('email.common.supportMessage')}
              </p>
            </td>
          </tr>
        </table>
        
        <!-- Footer Text -->
        <p style="margin: 24px 0 0; color: #9ca3af; font-size: 12px; text-align: center;">
          ${t('email.common.copyright', { year: new Date().getFullYear().toString() })}
        </p>
      </td>
    </tr>
  </table>
</body>
</html>
    `.trim();
  }

  async getApplicationRejectedHtml(
    firstName: string,
    jobTitle: string,
    employerName: string,
    message?: string,
    userId?: string,
  ): Promise<string> {
    const language = this.normalizeHtmlLang(
      await this.emailTranslations.getUserLanguage(userId),
    );
    const t = await this.emailTranslations.getTranslatorForUser(userId);
    return `
<!DOCTYPE html>
<html lang="${language}">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${t('email.jobs.applicationUpdateTitle')}</title>
</head>
<body style="margin: 0; padding: 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; background-color: #f5f5f5;">
  <table role="presentation" style="width: 100%; border-collapse: collapse; background-color: #f5f5f5;">
    <tr>
      <td align="center" style="padding: 40px 20px;">
        <table role="presentation" style="max-width: 600px; width: 100%; border-collapse: collapse; background-color: #ffffff; border-radius: 12px; box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);">
          <!-- Header -->
          <tr>
            <td style="padding: 40px 40px 30px; text-align: center; background: linear-gradient(135deg, #6366f1 0%, #8b5cf6 100%); border-radius: 12px 12px 0 0;">
              <h1 style="margin: 0; color: #ffffff; font-size: 32px; font-weight: 700; letter-spacing: -0.5px;">${t('email.common.brandName')}</h1>
            </td>
          </tr>
          
          <!-- Content -->
          <tr>
            <td style="padding: 40px;">
              <h2 style="margin: 0 0 20px; color: #1f2937; font-size: 24px; font-weight: 600;">${t('email.jobs.applicationUpdateHeader')}</h2>
              <p style="margin: 0 0 24px; color: #4b5563; font-size: 16px; line-height: 1.6;">
                ${t('email.jobs.applicationUpdateGreeting', { firstName })}
              </p>
              <p style="margin: 0 0 24px; color: #4b5563; font-size: 16px; line-height: 1.6;">
                ${t('email.jobs.applicationRejectedMessage', { jobTitle, employerName })}
              </p>
              
              ${
                message
                  ? `
              <!-- Employer Message -->
              <div style="margin: 32px 0; padding: 20px; background-color: #f9fafb; border-radius: 8px;">
                <p style="margin: 0 0 12px; color: #1f2937; font-size: 16px; font-weight: 600;">${t('email.jobs.messageFromEmployer')}:</p>
                <p style="margin: 0; color: #4b5563; font-size: 15px; line-height: 1.6;">${message}</p>
              </div>
              `
                  : ''
              }
              
              <!-- Encouragement -->
              <div style="margin: 32px 0; padding: 24px; background-color: #f9fafb; border-radius: 8px;">
                <h3 style="margin: 0 0 16px; color: #1f2937; font-size: 18px; font-weight: 600;">${t('email.jobs.keepGoing')}</h3>
                <p style="margin: 0 0 12px; color: #4b5563; font-size: 15px; line-height: 1.6;">
                  ${t('email.jobs.keepGoingMessage')}
                </p>
                <ul style="margin: 0; padding-left: 20px; color: #4b5563; font-size: 15px; line-height: 1.8;">
                  <li style="margin-bottom: 8px;">${t('email.jobs.rejectedNextStep1')}</li>
                  <li style="margin-bottom: 8px;">${t('email.jobs.rejectedNextStep2')}</li>
                  <li style="margin-bottom: 8px;">${t('email.jobs.rejectedNextStep3')}</li>
                  <li>${t('email.jobs.rejectedNextStep4')}</li>
                </ul>
              </div>
            </td>
          </tr>
          
          <!-- Footer -->
          <tr>
            <td style="padding: 30px 40px; background-color: #f9fafb; border-radius: 0 0 12px 12px; border-top: 1px solid #e5e7eb;">
              <p style="margin: 0; color: #6b7280; font-size: 14px; line-height: 1.6;">
                ${t('email.common.supportMessage')}
              </p>
            </td>
          </tr>
        </table>
        
        <!-- Footer Text -->
        <p style="margin: 24px 0 0; color: #9ca3af; font-size: 12px; text-align: center;">
          ${t('email.common.copyright', { year: new Date().getFullYear().toString() })}
        </p>
      </td>
    </tr>
  </table>
</body>
</html>
    `.trim();
  }

  async registerPushToken(userId: string, pushToken: string, platform: string) {
    try {
      await this.prisma.user.update({
        where: { id: userId },
        data: {
          pushToken,
          pushTokenPlatform: platform,
        },
      });
      this.logger.log(`Push token registered for user ${userId} (${platform})`);
      return { success: true, message: 'Push token registered' };
    } catch (err) {
      this.logger.warn(
        `Failed to register push token: ${(err as Error).message}`,
      );
      throw err;
    }
  }

  async sendPushNotification(
    userId: string,
    title: string,
    body: string,
    data?: unknown,
  ) {
    try {
      const user = await this.prisma.user.findUnique({
        where: { id: userId },
        select: { pushToken: true, pushTokenPlatform: true },
      });

      if (!user?.pushToken) {
        return false; // No push token registered
      }

      // Use Expo Push Notification API
      const response = await fetch('https://exp.host/--/api/v2/push/send', {
        method: 'POST',
        headers: {
          Accept: 'application/json',
          'Accept-Encoding': 'gzip, deflate',
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          to: user.pushToken,
          sound: 'default',
          title,
          body,
          data,
        }),
      });

      if (response.ok) {
        this.logger.log(`Push notification sent to user ${userId}`);
        return true;
      } else {
        const errorText = await response.text();
        this.logger.warn(`Failed to send push notification: ${errorText}`);
        return false;
      }
    } catch (err) {
      this.logger.warn(
        `Error sending push notification: ${(err as Error).message}`,
      );
      return false;
    }
  }

  /**
   * Generate a branded, professional email template
   */
  getBrandedEmailTemplate(
    title: string,
    greeting: string,
    content: string,
    footerNote?: string,
    t?: (key: string, params?: any) => string,
    language: 'en' | 'pt' = 'en',
  ): string {
    const translator = t || this.emailTranslations.getTranslator(language);
    return `
<!DOCTYPE html>
<html lang="${language}">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${title} - ${translator('email.common.brandName')}</title>
</head>
<body style="margin: 0; padding: 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; background-color: #f5f5f5;">
  <table role="presentation" style="width: 100%; border-collapse: collapse; background-color: #f5f5f5;">
    <tr>
      <td align="center" style="padding: 40px 20px;">
        <table role="presentation" style="max-width: 600px; width: 100%; border-collapse: collapse; background-color: #ffffff; border-radius: 12px; box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);">
          <!-- Header -->
          <tr>
            <td style="padding: 40px 40px 30px; text-align: center; background: linear-gradient(135deg, #6366f1 0%, #8b5cf6 100%); border-radius: 12px 12px 0 0;">
              <h1 style="margin: 0; color: #ffffff; font-size: 28px; font-weight: 700; letter-spacing: -0.5px;">${title}</h1>
            </td>
          </tr>
          
          <!-- Content -->
          <tr>
            <td style="padding: 40px;">
              <p style="margin: 0 0 24px; color: #1f2937; font-size: 16px; line-height: 1.6; font-weight: 500;">${greeting}</p>
              <div style="color: #4b5563; font-size: 16px; line-height: 1.7;">
                ${content}
              </div>
              ${
                footerNote
                  ? `
              <div style="margin-top: 32px; padding: 20px; background-color: #f9fafb; border-radius: 8px; border-left: 4px solid #6366f1;">
                <p style="margin: 0; color: #6b7280; font-size: 14px; line-height: 1.6;">${footerNote}</p>
              </div>
              `
                  : ''
              }
            </td>
          </tr>
          
          <!-- Footer -->
          <tr>
            <td style="padding: 30px 40px; background-color: #f9fafb; border-radius: 0 0 12px 12px; border-top: 1px solid #e5e7eb;">
              <p style="margin: 0 0 12px; color: #6b7280; font-size: 14px; line-height: 1.6;">
                <a href="mailto:${translator('email.common.supportEmail')}" style="color: #6366f1; text-decoration: none;">${translator('email.common.supportEmail')}</a>
              </p>
              <p style="margin: 0; color: #9ca3af; font-size: 12px; line-height: 1.6;">
                ${translator('email.common.copyright', { year: new Date().getFullYear().toString() })}
              </p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>
    `.trim();
  }
}

// Haversine distance in kilometers (duplicate of jobs.service helper)
function haversineKm(lat1: number, lon1: number, lat2: number, lon2: number) {
  const toRad = (d: number) => (d * Math.PI) / 180;
  const R = 6371; // km
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(toRad(lat1)) *
      Math.cos(toRad(lat2)) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}
