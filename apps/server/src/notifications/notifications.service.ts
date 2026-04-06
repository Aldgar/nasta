import { Injectable, Logger } from '@nestjs/common';
import { EventEmitter } from 'events';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../prisma/prisma.service';
import { EmailTranslationsService } from './email-translations.service';

export type DeletionRequestCreatedEvent = {
  userId: string;
  requestId: string;
  reason?: string;
  ticketNumber?: string;
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
    const apiKey = this.config.get<string>('POSTMARK_API_TOKEN');
    const from = this.config.get<string>('POSTMARK_FROM_EMAIL');
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

  private isHttpUrl(value: string | undefined): value is string {
    if (!value) return false;
    try {
      const url = new URL(value);
      return url.protocol === 'http:' || url.protocol === 'https:';
    } catch {
      return false;
    }
  }

  private getServerPublicUrl(): string {
    // Prefer a public server URL so email links work without the web client deployed.
    const serverPublic = this.config.get<string>('SERVER_PUBLIC_URL');
    if (this.isHttpUrl(serverPublic)) return serverPublic;

    // Backwards-compatible fallback: only use CLIENT_BASE_URL when it's actually HTTP(S).
    const clientBase = this.config.get<string>('CLIENT_BASE_URL');
    if (this.isHttpUrl(clientBase)) return clientBase;

    return 'http://localhost:3001';
  }

  private getClientUrl(): string {
    const clientBase = this.config.get<string>('CLIENT_BASE_URL');
    if (this.isHttpUrl(clientBase)) return clientBase;
    return 'http://localhost:3002';
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
<body style="margin: 0; padding: 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; background-color: #080F1E;">
  <table role="presentation" style="width: 100%; border-collapse: collapse; background-color: #080F1E;">
    <tr>
      <td align="center" style="padding: 40px 20px;">
        <table role="presentation" style="max-width: 600px; width: 100%; border-collapse: collapse; background-color: #0D1A30; border-radius: 12px; box-shadow: 0 4px 24px rgba(0, 0, 0, 0.5), 0 0 1px rgba(201, 150, 63, 0.2);">
          <!-- Header -->
          <tr>
            <td style="padding: 40px 40px 30px; text-align: center; background: linear-gradient(135deg, #0D1A30 0%, #162540 50%, #0D1A30 100%); border-top: 3px solid #C9963F; border-radius: 12px 12px 0 0;">
              <h1 style="margin: 0; color: #F5E6C8; font-size: 32px; font-weight: 700; letter-spacing: -0.5px;">${t('email.referral.invitationHeader')}</h1>
            </td>
          </tr>
          
          <!-- Content -->
          <tr>
            <td style="padding: 40px;">
              <h2 style="margin: 0 0 20px; color: #F5E6C8; font-size: 24px; font-weight: 600;">${t('email.referral.invitationGreeting', { friendName })} 👋</h2>
              <p style="margin: 0 0 24px; color: #B8A88A; font-size: 16px; line-height: 1.6;">
                ${t('email.referral.invitationMessage1', { referrerName, referrerEmail })}
              </p>
              
              <p style="margin: 0 0 24px; color: #B8A88A; font-size: 16px; line-height: 1.6;">
                ${t('email.referral.invitationMessage2')}
              </p>
              
              <!-- CTA Button -->
              <table role="presentation" style="width: 100%; border-collapse: collapse; margin: 32px 0;">
                <tr>
                  <td align="center" style="padding: 0;">
                    <a href="${signupLink}" style="display: inline-block; padding: 16px 32px; background: linear-gradient(135deg, #C9963F 0%, #D4A853 50%, #C9963F 100%); color: #0A1628; text-decoration: none; border-radius: 8px; font-weight: 600; font-size: 16px; box-shadow: 0 4px 6px rgba(201, 150, 63, 0.35);">${t('email.referral.joinButton')}</a>
                  </td>
                </tr>
              </table>
              
              <!-- Features -->
              <div style="margin: 40px 0 0; padding: 24px; background-color: #0E1B32; border-radius: 8px;">
                <h3 style="margin: 0 0 16px; color: #F5E6C8; font-size: 18px; font-weight: 600;">${t('email.referral.whyJoin')}</h3>
                <ul style="margin: 0; padding-left: 20px; color: #B8A88A; font-size: 15px; line-height: 1.8;">
                  <li style="margin-bottom: 8px;">${t('email.referral.benefit1')}</li>
                  <li style="margin-bottom: 8px;">${t('email.referral.benefit2')}</li>
                  <li style="margin-bottom: 8px;">${t('email.referral.benefit3')}</li>
                  <li style="margin-bottom: 8px;">${t('email.referral.benefit4')}</li>
                </ul>
              </div>
              
              <p style="margin: 32px 0 0; color: #8B7A5E; font-size: 14px; line-height: 1.6; text-align: center;">
                ${t('email.referral.invitationFooter', { referrerName })}
              </p>
            </td>
          </tr>
          
          <!-- Footer -->
          <tr>
            <td style="padding: 30px 40px; text-align: center; background-color: #0E1B32; border-radius: 0 0 12px 12px; border-top: 1px solid #1E3048;">
              <p style="margin: 0; color: #8B7A5E; font-size: 14px;">
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
    const e = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

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
<body style="margin: 0; padding: 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; background-color: #080F1E;">
  <table role="presentation" style="width: 100%; border-collapse: collapse; background-color: #080F1E;">
    <tr>
      <td align="center" style="padding: 40px 20px;">
        <table role="presentation" style="max-width: 600px; width: 100%; border-collapse: collapse; background-color: #0D1A30; border-radius: 12px; box-shadow: 0 4px 24px rgba(0, 0, 0, 0.5), 0 0 1px rgba(201, 150, 63, 0.2);">
          <!-- Header -->
          <tr>
            <td style="padding: 40px 40px 30px; text-align: center; background: linear-gradient(135deg, #0D1A30 0%, #162540 50%, #0D1A30 100%); border-top: 3px solid #C9963F; border-radius: 12px 12px 0 0;">
              <h1 style="margin: 0; color: #F5E6C8; font-size: 32px; font-weight: 700; letter-spacing: -0.5px;">${t('email.jobs.jobReferralHeader')}</h1>
            </td>
          </tr>
          
          <!-- Content -->
          <tr>
            <td style="padding: 40px;">
              <h2 style="margin: 0 0 20px; color: #F5E6C8; font-size: 24px; font-weight: 600;">${e(t('email.jobs.jobReferralGreeting', { candidateName }))} 👋</h2>
              <p style="margin: 0 0 24px; color: #B8A88A; font-size: 16px; line-height: 1.6;">
                ${e(t('email.jobs.jobReferralMessage', { employerName, employerEmail }))}
              </p>
              
              <!-- Job Details Card -->
              <div style="margin: 32px 0; padding: 24px; background-color: #0E1B32; border-radius: 8px; border-left: 4px solid #C9963F;">
                <h3 style="margin: 0 0 16px; color: #F5E6C8; font-size: 20px; font-weight: 600;">${e(job.title)}</h3>
                
                ${job.category ? `<p style="margin: 0 0 12px; color: #B8A88A; font-size: 15px;"><strong>${e(t('email.jobs.category'))}:</strong> ${e(job.category.name)}</p>` : ''}
                
                <p style="margin: 0 0 12px; color: #B8A88A; font-size: 15px;"><strong>${e(t('email.jobs.location'))}:</strong> ${e(locationText)}</p>
                
                ${job.rateAmount ? `<p style="margin: 0 0 12px; color: #B8A88A; font-size: 15px;"><strong>${e(t('email.jobs.rate'))}:</strong> ${e(rateText)}</p>` : ''}
                
                
                <div style="margin-top: 16px; padding-top: 16px; border-top: 1px solid #1E3048;">
                  <p style="margin: 0 0 8px; color: #F5E6C8; font-size: 15px; font-weight: 600;">${e(t('email.jobs.description'))}:</p>
                  <p style="margin: 0; color: #B8A88A; font-size: 14px; line-height: 1.6; white-space: pre-wrap;">${e(job.description)}</p>
                </div>
              </div>
              
              <!-- CTA Button -->
              <table role="presentation" style="width: 100%; border-collapse: collapse; margin: 32px 0;">
                <tr>
                  <td align="center" style="padding: 0;">
                    <a href="${e(jobLink)}" style="display: inline-block; padding: 16px 32px; background: linear-gradient(135deg, #C9963F 0%, #D4A853 50%, #C9963F 100%); color: #0A1628; text-decoration: none; border-radius: 8px; font-weight: 600; font-size: 16px; box-shadow: 0 4px 6px rgba(201, 150, 63, 0.35);">${e(t('email.jobs.viewAndApplyButton'))}</a>
                  </td>
                </tr>
              </table>
              
              <p style="margin: 32px 0 0; color: #8B7A5E; font-size: 14px; line-height: 1.6; text-align: center;">
                ${e(t('email.jobs.jobReferralFooter', { employerName }))}
              </p>
            </td>
          </tr>
          
          <!-- Footer -->
          <tr>
            <td style="padding: 30px 40px; text-align: center; background-color: #0E1B32; border-radius: 0 0 12px 12px; border-top: 1px solid #1E3048;">
              <p style="margin: 0; color: #8B7A5E; font-size: 14px;">
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
            'Email is not configured (missing POSTMARK_API_TOKEN and/or POSTMARK_FROM_EMAIL). Skipping email sends.',
          );
        }
        return false;
      }

      const apiToken = this.config.get<string>('POSTMARK_API_TOKEN') || '';
      const fromEmail = this.config.get<string>('POSTMARK_FROM_EMAIL') || '';

      // Dynamic import of Postmark SDK
      const postmark = await import('postmark');
      const client = new postmark.ServerClient(apiToken);

      const result = await client.sendEmail({
        From: fromEmail,
        To: to,
        Subject: subject,
        TextBody: text,
        HtmlBody: html || '',
      });

      this.logger.log(
        `Email sent to ${to} via Postmark (MessageID: ${result.MessageID}): ${subject}`,
      );

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
<body style="margin: 0; padding: 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; background-color: #080F1E;">
  <table role="presentation" style="width: 100%; border-collapse: collapse; background-color: #080F1E;">
    <tr>
      <td align="center" style="padding: 40px 20px;">
        <table role="presentation" style="max-width: 600px; width: 100%; border-collapse: collapse; background-color: #0D1A30; border-radius: 12px; box-shadow: 0 4px 24px rgba(0, 0, 0, 0.5), 0 0 1px rgba(201, 150, 63, 0.2);">
          <!-- Header -->
          <tr>
            <td style="padding: 40px 40px 30px; text-align: center; background: linear-gradient(135deg, #0D1A30 0%, #162540 50%, #0D1A30 100%); border-top: 3px solid #C9963F; border-radius: 12px 12px 0 0;">
              <h1 style="margin: 0; color: #F5E6C8; font-size: 32px; font-weight: 700; letter-spacing: -0.5px;">${t('email.auth.welcomeHeader')}</h1>
            </td>
          </tr>
          
          <!-- Content -->
          <tr>
            <td style="padding: 40px;">
              <h2 style="margin: 0 0 20px; color: #F5E6C8; font-size: 24px; font-weight: 600;">${t('email.auth.welcomeGreeting', { firstName })} 👋</h2>
              <p style="margin: 0 0 24px; color: #B8A88A; font-size: 16px; line-height: 1.6;">
                ${t('email.auth.welcomeMessage1')}
              </p>
              
              <p style="margin: 0 0 24px; color: #B8A88A; font-size: 16px; line-height: 1.6;">
                ${t('email.auth.welcomeMessage2')}
              </p>
              
              <!-- CTA Button - Uses HTTPS Universal Link (email-safe) -->
              <table role="presentation" style="width: 100%; border-collapse: collapse; margin: 32px 0;">
                <tr>
                  <td align="center" style="padding: 0;">
                    <a href="${universalLink}" style="display: inline-block; padding: 16px 32px; background: linear-gradient(135deg, #C9963F 0%, #D4A853 50%, #C9963F 100%); color: #0A1628; text-decoration: none; border-radius: 8px; font-weight: 600; font-size: 16px; box-shadow: 0 4px 6px rgba(201, 150, 63, 0.35);">${t('email.auth.verifyEmailButton')}</a>
                  </td>
                </tr>
              </table>

              <!-- Verification Code Fallback -->
              <div style="margin: 0 0 32px; padding: 20px; background-color: #0E1B32; border-radius: 8px; border-left: 4px solid #C9963F;">
                <p style="margin: 0 0 8px; color: #D4A853; font-size: 14px; font-weight: 600;">${t('email.auth.alternativeCode')}</p>
                <p style="margin: 0; color: #F5E6C8; font-size: 18px; font-weight: 700; font-family: 'Courier New', monospace; letter-spacing: 2px;">${token}</p>
              </div>
              
              <!-- Features -->
              <div style="margin: 40px 0 0; padding: 24px; background-color: #0E1B32; border-radius: 8px;">
                <h3 style="margin: 0 0 16px; color: #F5E6C8; font-size: 18px; font-weight: 600;">${t('email.auth.whatsNext')}</h3>
                <ul style="margin: 0; padding-left: 20px; color: #B8A88A; font-size: 15px; line-height: 1.8;">
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
            <td style="padding: 30px 40px; background-color: #0E1B32; border-radius: 0 0 12px 12px; border-top: 1px solid #1E3048;">
              <p style="margin: 0 0 12px; color: #8B7A5E; font-size: 14px; line-height: 1.6;">
                ${t('email.auth.ignoreEmail')}
              </p>
              <p style="margin: 0; color: #5C4F3A; font-size: 12px; line-height: 1.6;">
                ${t('email.auth.verificationExpiry')}
              </p>
            </td>
          </tr>
        </table>
        
        <!-- Footer Text -->
        <p style="margin: 24px 0 0; color: #5C4F3A; font-size: 12px; text-align: center;">
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
<body style="margin: 0; padding: 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; background-color: #080F1E;">
  <table role="presentation" style="width: 100%; border-collapse: collapse; background-color: #080F1E;">
    <tr>
      <td align="center" style="padding: 40px 20px;">
        <table role="presentation" style="max-width: 600px; width: 100%; border-collapse: collapse; background-color: #0D1A30; border-radius: 12px; box-shadow: 0 4px 24px rgba(0, 0, 0, 0.5), 0 0 1px rgba(201, 150, 63, 0.2);">
          <!-- Header -->
          <tr>
            <td style="padding: 40px 40px 30px; text-align: center; background: linear-gradient(135deg, #0D1A30 0%, #162540 50%, #0D1A30 100%); border-top: 3px solid #C9963F; border-radius: 12px 12px 0 0;">
              <h1 style="margin: 0; color: #F5E6C8; font-size: 32px; font-weight: 700; letter-spacing: -0.5px;">${t('email.common.brandName')}</h1>
            </td>
          </tr>
          
          <!-- Content -->
          <tr>
            <td style="padding: 40px;">
              <h2 style="margin: 0 0 20px; color: #F5E6C8; font-size: 24px; font-weight: 600;">${t('email.auth.verifyEmailWelcome')}</h2>
              <p style="margin: 0 0 24px; color: #B8A88A; font-size: 16px; line-height: 1.6;">
                ${t('email.auth.verifyEmailMessage')}
              </p>
              
              <!-- CTA Button - Uses HTTPS Universal Link (email-safe) -->
              <table role="presentation" style="width: 100%; border-collapse: collapse; margin: 32px 0;">
                <tr>
                  <td align="center" style="padding: 0;">
                    <a href="${universalLink}" style="display: inline-block; padding: 16px 32px; background: linear-gradient(135deg, #C9963F 0%, #D4A853 50%, #C9963F 100%); color: #0A1628; text-decoration: none; border-radius: 8px; font-weight: 600; font-size: 16px; box-shadow: 0 4px 6px rgba(201, 150, 63, 0.35);">${t('email.auth.verifyEmailButton')}</a>
                  </td>
                </tr>
              </table>
              
              <!-- Alternative Link -->
              <p style="margin: 32px 0 0; color: #8B7A5E; font-size: 14px; line-height: 1.6; text-align: center;">
                ${t('email.auth.alternativeLink')}<br>
                <a href="${universalLink}" style="color: #C9963F; text-decoration: none; word-break: break-all;">${universalLink}</a>
              </p>
              
              <!-- Token Fallback -->
              <div style="margin: 32px 0 0; padding: 20px; background-color: #0E1B32; border-radius: 8px; border-left: 4px solid #C9963F;">
                <p style="margin: 0 0 8px; color: #D4A853; font-size: 14px; font-weight: 600;">${t('email.auth.alternativeCode')}</p>
                <p style="margin: 0; color: #F5E6C8; font-size: 18px; font-weight: 700; font-family: 'Courier New', monospace; letter-spacing: 2px;">${token}</p>
              </div>
            </td>
          </tr>
          
          <!-- Footer -->
          <tr>
            <td style="padding: 30px 40px; background-color: #0E1B32; border-radius: 0 0 12px 12px; border-top: 1px solid #1E3048;">
              <p style="margin: 0 0 12px; color: #8B7A5E; font-size: 14px; line-height: 1.6;">
                ${t('email.auth.ignoreEmail')}
              </p>
              <p style="margin: 0; color: #5C4F3A; font-size: 12px; line-height: 1.6;">
                ${t('email.auth.verificationExpiry')}
              </p>
            </td>
          </tr>
        </table>
        
        <!-- Footer Text -->
        <p style="margin: 24px 0 0; color: #5C4F3A; font-size: 12px; text-align: center;">
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
<body style="margin: 0; padding: 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; background-color: #080F1E;">
  <table role="presentation" style="width: 100%; border-collapse: collapse; background-color: #080F1E;">
    <tr>
      <td align="center" style="padding: 40px 20px;">
        <table role="presentation" style="max-width: 600px; width: 100%; border-collapse: collapse; background-color: #0D1A30; border-radius: 12px; box-shadow: 0 4px 24px rgba(0, 0, 0, 0.5), 0 0 1px rgba(201, 150, 63, 0.2);">
          <!-- Header -->
          <tr>
            <td style="padding: 40px 40px 30px; text-align: center; background: linear-gradient(135deg, #0D1A30 0%, #162540 50%, #0D1A30 100%); border-top: 3px solid #C9963F; border-radius: 12px 12px 0 0;">
              <h1 style="margin: 0; color: #F5E6C8; font-size: 32px; font-weight: 700; letter-spacing: -0.5px;">${t('email.common.brandName')}</h1>
            </td>
          </tr>
          
          <!-- Content -->
          <tr>
            <td style="padding: 40px;">
              <h2 style="margin: 0 0 20px; color: #F5E6C8; font-size: 24px; font-weight: 600;">${t('email.kyc.documentRequiredHeader')}</h2>
              <p style="margin: 0 0 24px; color: #B8A88A; font-size: 16px; line-height: 1.6;">
                ${t('email.kyc.documentRequiredGreeting', { firstName })}
              </p>
              <p style="margin: 0 0 24px; color: #B8A88A; font-size: 16px; line-height: 1.6;">
                ${t('email.kyc.documentRequiredMessage')}
              </p>
              
              <!-- Document Details Card -->
              <div style="margin: 32px 0; padding: 24px; background: linear-gradient(135deg, rgba(201, 150, 63, 0.08) 0%, rgba(212, 168, 83, 0.08) 100%); border-radius: 8px; border-left: 4px solid #C9963F;">
                <p style="margin: 0 0 12px; color: #F5E6C8; font-size: 16px; font-weight: 600;">
                  <strong>${t('email.kyc.document')}:</strong> ${documentName}
                </p>
                <p style="margin: 0; color: #B8A88A; font-size: 14px; line-height: 1.6;">
                  <strong>${t('email.kyc.reason')}:</strong> ${reason}
                </p>
              </div>
              
              <!-- Instructions -->
              <div style="margin: 32px 0; padding: 20px; background-color: #0E1B32; border-radius: 8px;">
                <p style="margin: 0 0 12px; color: #F5E6C8; font-size: 16px; font-weight: 600;">
                  ${t('email.kyc.whatToDoNext')}:
                </p>
                <ol style="margin: 0; padding-left: 20px; color: #B8A88A; font-size: 14px; line-height: 1.8;">
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
            <td style="padding: 30px 40px; background-color: #0E1B32; border-radius: 0 0 12px 12px; border-top: 1px solid #1E3048;">
              <p style="margin: 0; color: #8B7A5E; font-size: 14px; line-height: 1.6;">
                ${t('email.common.supportMessage')}
              </p>
            </td>
          </tr>
        </table>
        
        <!-- Footer Text -->
        <p style="margin: 24px 0 0; color: #5C4F3A; font-size: 12px; text-align: center;">
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
<body style="margin: 0; padding: 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; background-color: #080F1E;">
  <table role="presentation" style="width: 100%; border-collapse: collapse; background-color: #080F1E;">
    <tr>
      <td align="center" style="padding: 40px 20px;">
        <table role="presentation" style="max-width: 600px; width: 100%; border-collapse: collapse; background-color: #0D1A30; border-radius: 12px; box-shadow: 0 4px 24px rgba(0, 0, 0, 0.5), 0 0 1px rgba(201, 150, 63, 0.2);">
          <!-- Header -->
          <tr>
            <td style="padding: 40px 40px 30px; text-align: center; background: linear-gradient(135deg, #0D1A30 0%, #162540 50%, #0D1A30 100%); border-top: 3px solid #C9963F; border-radius: 12px 12px 0 0;">
              <h1 style="margin: 0; color: #F5E6C8; font-size: 32px; font-weight: 700; letter-spacing: -0.5px;">${t('email.common.brandName')}</h1>
            </td>
          </tr>
          
          <!-- Content -->
          <tr>
            <td style="padding: 40px;">
              <h2 style="margin: 0 0 20px; color: #F5E6C8; font-size: 24px; font-weight: 600;">${t('email.auth.emailVerifiedHeader')}</h2>
              <p style="margin: 0 0 24px; color: #B8A88A; font-size: 16px; line-height: 1.6;">
                ${t('email.auth.emailVerifiedGreeting', { firstName })}
              </p>
              <p style="margin: 0 0 24px; color: #B8A88A; font-size: 16px; line-height: 1.6;">
                ${t('email.auth.emailVerifiedMessage')}
              </p>
              
              <!-- Success Icon/Message -->
              <div style="margin: 32px 0; padding: 24px; background: linear-gradient(135deg, rgba(201, 150, 63, 0.08) 0%, rgba(212, 168, 83, 0.08) 100%); border-radius: 8px; border-left: 4px solid #C9963F;">
                <p style="margin: 0; color: #F5E6C8; font-size: 16px; font-weight: 600; text-align: center;">
                  ✓ ${t('email.auth.accountActivated')}
                </p>
              </div>
              
              <!-- Next Steps -->
              <div style="margin: 40px 0 0; padding: 24px; background-color: #0E1B32; border-radius: 8px;">
                <h3 style="margin: 0 0 16px; color: #F5E6C8; font-size: 18px; font-weight: 600;">${t('email.auth.whatsNext')}</h3>
                <ul style="margin: 0; padding-left: 20px; color: #B8A88A; font-size: 15px; line-height: 1.8;">
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
            <td style="padding: 30px 40px; background-color: #0E1B32; border-radius: 0 0 12px 12px; border-top: 1px solid #1E3048;">
              <p style="margin: 0; color: #8B7A5E; font-size: 14px; line-height: 1.6;">
                ${t('email.common.supportMessage')}
              </p>
            </td>
          </tr>
        </table>
        
        <!-- Footer Text -->
        <p style="margin: 24px 0 0; color: #5C4F3A; font-size: 12px; text-align: center;">
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
            `Invalid SMS sender name: ${from}. Set SMS_FROM to something like "Nasta".`,
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

  async emitDeletionRequestReviewed(event: {
    userId: string;
    requestId: string;
    ticketNumber: string;
    decision: 'APPROVED' | 'DENIED';
    adminNotes?: string;
  }) {
    this.logger.debug(
      `DeletionRequestReviewed user=${event.userId} decision=${event.decision} ticket=${event.ticketNumber}`,
    );
    try {
      const user = await this.prisma.user.findUnique({
        where: { id: event.userId },
        select: { email: true, firstName: true },
      });
      if (user?.email) {
        const t = await this.emailTranslations.getTranslatorForUser(
          event.userId,
        );
        const firstName = user.firstName || t('email.common.there');
        if (event.decision === 'APPROVED') {
          const subject = t('email.deletion.requestApprovedSubject', {
            ticketNumber: event.ticketNumber,
          });
          const text = t('email.deletion.requestApprovedText', {
            firstName,
            ticketNumber: event.ticketNumber,
          });
          await this.sendEmail(user.email, subject, text);
        } else {
          const subject = t('email.deletion.requestDeniedSubject', {
            ticketNumber: event.ticketNumber,
          });
          const text = t('email.deletion.requestDeniedText', {
            firstName,
            ticketNumber: event.ticketNumber,
            adminNotes: event.adminNotes || t('email.common.na'),
          });
          await this.sendEmail(user.email, subject, text);
        }
      }

      const tNotif = await this.emailTranslations.getTranslatorForUser(
        event.userId,
      );
      const title =
        event.decision === 'APPROVED'
          ? tNotif('notifications.templates.accountDeletionApprovedTitle')
          : tNotif('notifications.templates.accountDeletionDeniedTitle');
      const body =
        event.decision === 'APPROVED'
          ? tNotif('notifications.templates.accountDeletionApprovedBody', { ticketNumber: event.ticketNumber })
          : tNotif('notifications.templates.accountDeletionDeniedBody', { ticketNumber: event.ticketNumber });

      await this.createNotification({
        userId: event.userId,
        type: 'SYSTEM',
        title,
        body,
      });
    } catch (err) {
      this.logger.warn(
        `Send deletion review email failed: ${(err as Error).message}`,
      );
    }
  }

  onBackgroundCheckSubmitted(
    listener: (e: BackgroundCheckSubmittedEvent) => void,
  ) {
    this.emitter.on('backgroundCheck.submitted', listener);
  }

  async emitDeletionRequestCreated(event: DeletionRequestCreatedEvent) {
    this.logger.debug(
      `DeletionRequestCreated user=${event.userId} request=${event.requestId} ticket=${event.ticketNumber}`,
    );
    this.emitter.emit('deletion.request.created', event);

    try {
      const user = await this.prisma.user.findUnique({
        where: { id: event.userId },
        select: { email: true, firstName: true },
      });

      const t = await this.emailTranslations.getTranslatorForUser(event.userId);

      if (user?.email) {
        const firstName = user.firstName || t('email.common.there');
        const ticket = event.ticketNumber || event.requestId;
        const reason = event.reason || t('email.common.na');
        const subject = t('email.deletion.requestCreatedSubject', {
          ticketNumber: ticket,
        });
        const text = t('email.deletion.requestCreatedText', {
          firstName,
          ticketNumber: ticket,
          reason,
        });
        const language = this.normalizeHtmlLang(
          await this.emailTranslations.getUserLanguage(event.userId),
        );
        const html = this.getDeletionRequestCreatedHtml(
          firstName,
          ticket,
          reason,
          t,
          language,
        );
        await this.sendEmail(user.email, subject, text, html);
      }

      const ticketNumber = event.ticketNumber || event.requestId || '';
      await this.createNotification({
        userId: event.userId,
        type: 'SYSTEM',
        title: t('notifications.templates.accountDeletionRequestTitle'),
        body: t('notifications.templates.accountDeletionRequestBody', {
          ticketNumber,
        }),
      });
    } catch (err) {
      this.logger.warn(
        `Send deletion request email failed: ${(err as Error).message}`,
      );
    }
  }

  private getDeletionRequestCreatedHtml(
    firstName: string,
    ticketNumber: string,
    reason: string,
    t: (key: string, params?: any) => string,
    language: 'en' | 'pt' = 'en',
  ): string {
    return `
<!DOCTYPE html>
<html lang="${language}">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${t('email.deletion.requestCreatedSubject', { ticketNumber })}</title>
</head>
<body style="margin: 0; padding: 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; background-color: #080F1E;">
  <table role="presentation" style="width: 100%; border-collapse: collapse; background-color: #080F1E;">
    <tr>
      <td align="center" style="padding: 40px 20px;">
        <table role="presentation" style="max-width: 600px; width: 100%; border-collapse: collapse; background-color: #0D1A30; border-radius: 12px; box-shadow: 0 4px 24px rgba(0, 0, 0, 0.5), 0 0 1px rgba(201, 150, 63, 0.2);">
          <!-- Header -->
          <tr>
            <td style="padding: 40px 40px 30px; text-align: center; background: linear-gradient(135deg, #0D1A30 0%, #162540 50%, #0D1A30 100%); border-top: 3px solid #C9963F; border-radius: 12px 12px 0 0;">
              <h1 style="margin: 0; color: #F5E6C8; font-size: 32px; font-weight: 700; letter-spacing: -0.5px;">${t('email.common.brandName')}</h1>
            </td>
          </tr>
          
          <!-- Content -->
          <tr>
            <td style="padding: 40px;">
              <h2 style="margin: 0 0 20px; color: #F5E6C8; font-size: 24px; font-weight: 600;">${t('email.deletion.htmlHeader')}</h2>
              <p style="margin: 0 0 24px; color: #B8A88A; font-size: 16px; line-height: 1.6;">
                ${t('email.deletion.htmlGreeting', { firstName })}
              </p>
              <p style="margin: 0 0 24px; color: #B8A88A; font-size: 16px; line-height: 1.6;">
                ${t('email.deletion.htmlMessage')}
              </p>
              
              <!-- Ticket Info -->
              <div style="margin: 32px 0; padding: 24px; background-color: #0E1B32; border-radius: 8px; border-left: 4px solid #C9963F;">
                <table role="presentation" style="width: 100%; border-collapse: collapse;">
                  <tr>
                    <td style="padding: 6px 0; color: #D4A853; font-size: 14px; font-weight: 600; width: 120px;">${t('email.deletion.htmlReference')}</td>
                    <td style="padding: 6px 0; color: #F5E6C8; font-size: 14px; font-family: 'Courier New', monospace;">${ticketNumber}</td>
                  </tr>
                  <tr>
                    <td style="padding: 6px 0; color: #D4A853; font-size: 14px; font-weight: 600;">${t('email.deletion.htmlReason')}</td>
                    <td style="padding: 6px 0; color: #F5E6C8; font-size: 14px;">${reason}</td>
                  </tr>
                  <tr>
                    <td style="padding: 6px 0; color: #D4A853; font-size: 14px; font-weight: 600;">${t('email.deletion.htmlStatus')}</td>
                    <td style="padding: 6px 0; color: #eab308; font-size: 14px; font-weight: 600;">${t('email.deletion.htmlStatusPending')}</td>
                  </tr>
                </table>
              </div>
              
              <p style="margin: 0 0 24px; color: #B8A88A; font-size: 16px; line-height: 1.6;">
                ${t('email.deletion.htmlNextSteps')}
              </p>
              
              <!-- Warning Box -->
              <div style="margin: 32px 0; padding: 20px; background: rgba(234, 179, 8, 0.08); border-radius: 8px; border-left: 4px solid #eab308;">
                <p style="margin: 0; color: #eab308; font-size: 14px; font-weight: 600;">
                  ⚠️ ${t('email.deletion.htmlChangeMind')}
                </p>
                <p style="margin: 8px 0 0; color: #B8A88A; font-size: 14px; line-height: 1.5;">
                  ${t('email.deletion.htmlChangeMindMessage', { supportEmail: t('email.common.supportEmail') })}
                </p>
              </div>
              
              <p style="margin: 24px 0 0; color: #B8A88A; font-size: 16px; line-height: 1.6;">
                ${t('email.common.bestRegards')}<br>
                <strong style="color: #F5E6C8;">${t('email.common.nestaTeam')}</strong>
              </p>
            </td>
          </tr>
          
          <!-- Footer -->
          <tr>
            <td style="padding: 30px 40px; background-color: #0E1B32; border-radius: 0 0 12px 12px; border-top: 1px solid #1E3048;">
              <p style="margin: 0; color: #8B7A5E; font-size: 14px; line-height: 1.6;">
                ${t('email.common.supportMessage')}
              </p>
            </td>
          </tr>
        </table>
        
        <!-- Footer Text -->
        <p style="margin: 24px 0 0; color: #5C4F3A; font-size: 12px; text-align: center;">
          ${t('email.common.copyright', { year: new Date().getFullYear().toString() })}
        </p>
      </td>
    </tr>
  </table>
</body>
</html>
    `.trim();
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
        const deepLink = `nasta://verify-email?token=${token}`;

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
        const deepLink = `nasta://verify-email?token=${event.token}`;

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

  /**
   * Start a Vonage Verify v2 verification request (sends OTP via SMS automatically).
   * Returns the request_id to be stored and used for checking the code later.
   */
  async requestVonageVerify(
    phone: string,
    userId?: string,
  ): Promise<{ requestId: string } | null> {
    const apiKey = this.config.get<string>('VONAGE_API_KEY');
    const apiSecret = this.config.get<string>('VONAGE_API_SECRET');
    if (!apiKey || !apiSecret) {
      this.logger.warn('Vonage Verify: missing API key/secret');
      return null;
    }

    // Resolve user language for the SMS locale
    let locale = 'en-us';
    if (userId) {
      try {
        const lang = await this.emailTranslations.getUserLanguage(userId);
        if (lang?.toLowerCase().startsWith('pt')) {
          locale = 'pt-pt';
        }
      } catch {
        // fallback to en-us
      }
    }

    // Vonage Verify v2 wants numbers without leading '+' in E.164
    const to = phone.startsWith('+') ? phone.slice(1) : phone;
    const auth = Buffer.from(`${apiKey}:${apiSecret}`).toString('base64');

    try {
      const res = await fetch('https://api.nexmo.com/v2/verify/', {
        method: 'POST',
        headers: {
          Authorization: `Basic ${auth}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          brand: 'Nasta',
          locale,
          code_length: 6,
          channel_timeout: 120,
          workflow: [{ channel: 'sms', to }],
        }),
      });

      if (res.status === 202) {
        const data = (await res.json()) as { request_id: string };
        this.logger.log(
          `Vonage Verify request created: ${data.request_id} for ${to}`,
        );
        return { requestId: data.request_id };
      }

      const errBody = await res.text();
      this.logger.error(
        `Vonage Verify request failed (${res.status}): ${errBody}`,
      );
      return null;
    } catch (err) {
      this.logger.error(
        `Vonage Verify request error: ${(err as Error).message}`,
      );
      return null;
    }
  }

  /**
   * Check a user-supplied code against a Vonage Verify v2 request.
   * Returns true if the code is correct.
   */
  async checkVonageVerify(requestId: string, code: string): Promise<boolean> {
    const apiKey = this.config.get<string>('VONAGE_API_KEY');
    const apiSecret = this.config.get<string>('VONAGE_API_SECRET');
    if (!apiKey || !apiSecret) return false;

    const auth = Buffer.from(`${apiKey}:${apiSecret}`).toString('base64');

    try {
      const res = await fetch(
        `https://api.nexmo.com/v2/verify/${encodeURIComponent(requestId)}`,
        {
          method: 'POST',
          headers: {
            Authorization: `Basic ${auth}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ code }),
        },
      );

      if (res.status === 200) {
        this.logger.log(`Vonage Verify code accepted for ${requestId}`);
        return true;
      }

      const errBody = await res.text();
      this.logger.warn(
        `Vonage Verify check failed (${res.status}) for ${requestId}: ${errBody}`,
      );
      return false;
    } catch (err) {
      this.logger.error(`Vonage Verify check error: ${(err as Error).message}`);
      return false;
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
<body style="margin: 0; padding: 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; background-color: #080F1E;">
  <table role="presentation" style="width: 100%; border-collapse: collapse; background-color: #080F1E;">
    <tr>
      <td align="center" style="padding: 40px 20px;">
        <table role="presentation" style="max-width: 600px; width: 100%; border-collapse: collapse; background-color: #0D1A30; border-radius: 12px; box-shadow: 0 4px 24px rgba(0, 0, 0, 0.5), 0 0 1px rgba(201, 150, 63, 0.2);">
          <!-- Header -->
          <tr>
            <td style="padding: 40px 40px 30px; text-align: center; background: linear-gradient(135deg, #0D1A30 0%, #162540 50%, #0D1A30 100%); border-top: 3px solid #C9963F; border-radius: 12px 12px 0 0;">
              <h1 style="margin: 0; color: #F5E6C8; font-size: 32px; font-weight: 700; letter-spacing: -0.5px;">${t('email.common.brandName')}</h1>
            </td>
          </tr>
          
          <!-- Content -->
          <tr>
            <td style="padding: 40px;">
              <h2 style="margin: 0 0 20px; color: #F5E6C8; font-size: 24px; font-weight: 600;">${t('email.jobs.applicationSubmittedHeader')}</h2>
              <p style="margin: 0 0 24px; color: #B8A88A; font-size: 16px; line-height: 1.6;">
                ${t('email.jobs.applicationSubmittedGreeting', { firstName })}
              </p>
              <p style="margin: 0 0 24px; color: #B8A88A; font-size: 16px; line-height: 1.6;">
                ${t('email.jobs.applicationSubmittedMessage')}
              </p>
              
              <!-- Job Details Card -->
              <div style="margin: 32px 0; padding: 24px; background: linear-gradient(135deg, rgba(201, 150, 63, 0.08) 0%, rgba(212, 168, 83, 0.08) 100%); border-radius: 8px; border-left: 4px solid #C9963F;">
                <h3 style="margin: 0 0 12px; color: #F5E6C8; font-size: 18px; font-weight: 600;">${jobTitle}</h3>
                <p style="margin: 0 0 8px; color: #B8A88A; font-size: 14px;">
                  <strong>${t('email.jobs.employer')}:</strong> ${employerName}
                </p>
                <p style="margin: 0; color: #B8A88A; font-size: 14px;">
                  <strong>${t('email.jobs.location')}:</strong> ${jobLocation}
                </p>
              </div>
              
              <!-- Status Info -->
              <div style="margin: 32px 0; padding: 20px; background-color: #0E1B32; border-radius: 8px;">
                <p style="margin: 0 0 12px; color: #F5E6C8; font-size: 16px; font-weight: 600;">
                  ✓ ${t('email.jobs.applicationStatusPending')}
                </p>
                <p style="margin: 0; color: #B8A88A; font-size: 14px; line-height: 1.6;">
                  ${t('email.jobs.applicationStatusMessage')}
                </p>
              </div>
              
              <!-- Next Steps -->
              <div style="margin: 40px 0 0; padding: 24px; background-color: #0E1B32; border-radius: 8px;">
                <h3 style="margin: 0 0 16px; color: #F5E6C8; font-size: 18px; font-weight: 600;">${t('email.auth.whatsNext')}</h3>
                <ul style="margin: 0; padding-left: 20px; color: #B8A88A; font-size: 15px; line-height: 1.8;">
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
            <td style="padding: 30px 40px; background-color: #0E1B32; border-radius: 0 0 12px 12px; border-top: 1px solid #1E3048;">
              <p style="margin: 0; color: #8B7A5E; font-size: 14px; line-height: 1.6;">
                ${t('email.common.supportMessage')}
              </p>
            </td>
          </tr>
        </table>
        
        <!-- Footer Text -->
        <p style="margin: 24px 0 0; color: #5C4F3A; font-size: 12px; text-align: center;">
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
<body style="margin: 0; padding: 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; background-color: #080F1E;">
  <table role="presentation" style="width: 100%; border-collapse: collapse; background-color: #080F1E;">
    <tr>
      <td align="center" style="padding: 40px 20px;">
        <table role="presentation" style="max-width: 600px; width: 100%; border-collapse: collapse; background-color: #0D1A30; border-radius: 12px; box-shadow: 0 4px 24px rgba(0, 0, 0, 0.5), 0 0 1px rgba(201, 150, 63, 0.2);">
          <!-- Header -->
          <tr>
            <td style="padding: 40px 40px 30px; text-align: center; background: linear-gradient(135deg, #0D1A30 0%, #162540 50%, #0D1A30 100%); border-top: 3px solid #C9963F; border-radius: 12px 12px 0 0;">
              <h1 style="margin: 0; color: #F5E6C8; font-size: 32px; font-weight: 700; letter-spacing: -0.5px;">${t('email.common.brandName')}</h1>
            </td>
          </tr>
          
          <!-- Content -->
          <tr>
            <td style="padding: 40px;">
              <h2 style="margin: 0 0 20px; color: #F5E6C8; font-size: 24px; font-weight: 600;">${t('email.jobs.applicationAcceptedHeader')}</h2>
              <p style="margin: 0 0 24px; color: #B8A88A; font-size: 16px; line-height: 1.6;">
                ${t('email.jobs.applicationAcceptedGreeting', { firstName })}
              </p>
              <p style="margin: 0 0 24px; color: #B8A88A; font-size: 16px; line-height: 1.6;">
                ${t('email.jobs.applicationAcceptedMessage', { jobTitle, employerName })}
              </p>
              
              <!-- Success Card -->
              <div style="margin: 32px 0; padding: 24px; background: linear-gradient(135deg, rgba(34, 197, 94, 0.1) 0%, rgba(16, 185, 129, 0.1) 100%); border-radius: 8px; border-left: 4px solid #22c55e;">
                <p style="margin: 0; color: #F5E6C8; font-size: 18px; font-weight: 700; text-align: center;">
                  ✓ ${t('email.jobs.applicationAcceptedBadge')}
                </p>
              </div>
              
              ${
                message
                  ? `
              <!-- Employer Message -->
              <div style="margin: 32px 0; padding: 20px; background-color: #0E1B32; border-radius: 8px;">
                <p style="margin: 0 0 12px; color: #F5E6C8; font-size: 16px; font-weight: 600;">${t('email.jobs.messageFromEmployer')}:</p>
                <p style="margin: 0; color: #B8A88A; font-size: 15px; line-height: 1.6;">${message}</p>
              </div>
              `
                  : ''
              }
              
              <!-- Next Steps -->
              <div style="margin: 40px 0 0; padding: 24px; background-color: #0E1B32; border-radius: 8px;">
                <h3 style="margin: 0 0 16px; color: #F5E6C8; font-size: 18px; font-weight: 600;">${t('email.auth.whatsNext')}</h3>
                <ul style="margin: 0; padding-left: 20px; color: #B8A88A; font-size: 15px; line-height: 1.8;">
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
            <td style="padding: 30px 40px; background-color: #0E1B32; border-radius: 0 0 12px 12px; border-top: 1px solid #1E3048;">
              <p style="margin: 0; color: #8B7A5E; font-size: 14px; line-height: 1.6;">
                ${t('email.common.supportMessage')}
              </p>
            </td>
          </tr>
        </table>
        
        <!-- Footer Text -->
        <p style="margin: 24px 0 0; color: #5C4F3A; font-size: 12px; text-align: center;">
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
<body style="margin: 0; padding: 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; background-color: #080F1E;">
  <table role="presentation" style="width: 100%; border-collapse: collapse; background-color: #080F1E;">
    <tr>
      <td align="center" style="padding: 40px 20px;">
        <table role="presentation" style="max-width: 600px; width: 100%; border-collapse: collapse; background-color: #0D1A30; border-radius: 12px; box-shadow: 0 4px 24px rgba(0, 0, 0, 0.5), 0 0 1px rgba(201, 150, 63, 0.2);">
          <!-- Header -->
          <tr>
            <td style="padding: 40px 40px 30px; text-align: center; background: linear-gradient(135deg, #0D1A30 0%, #162540 50%, #0D1A30 100%); border-top: 3px solid #C9963F; border-radius: 12px 12px 0 0;">
              <h1 style="margin: 0; color: #F5E6C8; font-size: 32px; font-weight: 700; letter-spacing: -0.5px;">${t('email.common.brandName')}</h1>
            </td>
          </tr>
          
          <!-- Content -->
          <tr>
            <td style="padding: 40px;">
              <h2 style="margin: 0 0 20px; color: #F5E6C8; font-size: 24px; font-weight: 600;">${t('email.jobs.applicationUpdateHeader')}</h2>
              <p style="margin: 0 0 24px; color: #B8A88A; font-size: 16px; line-height: 1.6;">
                ${t('email.jobs.applicationUpdateGreeting', { firstName })}
              </p>
              <p style="margin: 0 0 24px; color: #B8A88A; font-size: 16px; line-height: 1.6;">
                ${t('email.jobs.applicationRejectedMessage', { jobTitle, employerName })}
              </p>
              
              ${
                message
                  ? `
              <!-- Employer Message -->
              <div style="margin: 32px 0; padding: 20px; background-color: #0E1B32; border-radius: 8px;">
                <p style="margin: 0 0 12px; color: #F5E6C8; font-size: 16px; font-weight: 600;">${t('email.jobs.messageFromEmployer')}:</p>
                <p style="margin: 0; color: #B8A88A; font-size: 15px; line-height: 1.6;">${message}</p>
              </div>
              `
                  : ''
              }
              
              <!-- Encouragement -->
              <div style="margin: 32px 0; padding: 24px; background-color: #0E1B32; border-radius: 8px;">
                <h3 style="margin: 0 0 16px; color: #F5E6C8; font-size: 18px; font-weight: 600;">${t('email.jobs.keepGoing')}</h3>
                <p style="margin: 0 0 12px; color: #B8A88A; font-size: 15px; line-height: 1.6;">
                  ${t('email.jobs.keepGoingMessage')}
                </p>
                <ul style="margin: 0; padding-left: 20px; color: #B8A88A; font-size: 15px; line-height: 1.8;">
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
            <td style="padding: 30px 40px; background-color: #0E1B32; border-radius: 0 0 12px 12px; border-top: 1px solid #1E3048;">
              <p style="margin: 0; color: #8B7A5E; font-size: 14px; line-height: 1.6;">
                ${t('email.common.supportMessage')}
              </p>
            </td>
          </tr>
        </table>
        
        <!-- Footer Text -->
        <p style="margin: 24px 0 0; color: #5C4F3A; font-size: 12px; text-align: center;">
          ${t('email.common.copyright', { year: new Date().getFullYear().toString() })}
        </p>
      </td>
    </tr>
  </table>
</body>
</html>
    `.trim();
  }

  getInstantJobRequestHtml(
    data: {
      providerName: string;
      jobTitle: string;
      category: string;
      location: string;
      startDate: string;
      payment: string;
      employerName: string;
      ctaUrl: string;
    },
    t: (key: string, params?: any) => string,
    language: 'en' | 'pt' = 'en',
  ): string {
    const e = (s: string) => s.replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
    return `
<!DOCTYPE html>
<html lang="${language}">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${e(t('email.instantJobRequest.newRequestSubject', { jobTitle: data.jobTitle }))}</title>
</head>
<body style="margin: 0; padding: 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; background-color: #080F1E;">
  <table role="presentation" style="width: 100%; border-collapse: collapse; background-color: #080F1E;">
    <tr>
      <td align="center" style="padding: 40px 20px;">
        <table role="presentation" style="max-width: 600px; width: 100%; border-collapse: collapse; background-color: #0D1A30; border-radius: 12px; box-shadow: 0 4px 24px rgba(0, 0, 0, 0.5), 0 0 1px rgba(201, 150, 63, 0.2);">
          <!-- Header -->
          <tr>
            <td style="padding: 40px 40px 30px; text-align: center; background: linear-gradient(135deg, #0D1A30 0%, #162540 50%, #0D1A30 100%); border-top: 3px solid #C9963F; border-radius: 12px 12px 0 0;">
              <h1 style="margin: 0 0 8px; color: #F5E6C8; font-size: 32px; font-weight: 700; letter-spacing: -0.5px;">${e(t('email.common.brandName'))}</h1>
              <p style="margin: 0; color: #C9963F; font-size: 16px; font-weight: 500;">⚡ ${e(t('email.instantJobRequest.newRequestHeader'))}</p>
            </td>
          </tr>
          
          <!-- Greeting -->
          <tr>
            <td style="padding: 40px 40px 0;">
              <p style="margin: 0 0 16px; color: #F5E6C8; font-size: 18px; font-weight: 600;">${e(t('email.instantJobRequest.newRequestGreeting', { providerName: data.providerName }))}</p>
              <p style="margin: 0 0 32px; color: #B8A88A; font-size: 16px; line-height: 1.6;">
                ${e(t('email.instantJobRequest.newRequestIntro'))}
              </p>
            </td>
          </tr>

          <!-- Job Details Card -->
          <tr>
            <td style="padding: 0 40px;">
              <table role="presentation" style="width: 100%; border-collapse: collapse; background: linear-gradient(135deg, rgba(201, 150, 63, 0.08) 0%, rgba(212, 168, 83, 0.05) 100%); border-radius: 8px; border: 1px solid rgba(201, 150, 63, 0.2);">
                <tr>
                  <td style="padding: 24px;">
                    <h3 style="margin: 0 0 16px; color: #C9963F; font-size: 16px; font-weight: 600; text-transform: uppercase; letter-spacing: 1px;">📋 ${e(t('email.instantJobRequest.jobDetailsTitle'))}</h3>
                    <table role="presentation" style="width: 100%; border-collapse: collapse;">
                      <tr>
                        <td style="padding: 8px 0; color: #8B7A5E; font-size: 14px; width: 120px; vertical-align: top;">${e(t('email.instantJobRequest.jobTitle'))}</td>
                        <td style="padding: 8px 0; color: #F5E6C8; font-size: 14px; font-weight: 600;">${e(data.jobTitle)}</td>
                      </tr>
                      <tr>
                        <td style="padding: 8px 0; color: #8B7A5E; font-size: 14px; vertical-align: top;">${e(t('email.instantJobRequest.category'))}</td>
                        <td style="padding: 8px 0; color: #F5E6C8; font-size: 14px;">${e(data.category)}</td>
                      </tr>
                      <tr>
                        <td style="padding: 8px 0; color: #8B7A5E; font-size: 14px; vertical-align: top;">📍 ${e(t('email.instantJobRequest.location'))}</td>
                        <td style="padding: 8px 0; color: #F5E6C8; font-size: 14px;">${e(data.location)}</td>
                      </tr>
                      <tr>
                        <td style="padding: 8px 0; color: #8B7A5E; font-size: 14px; vertical-align: top;">📅 ${e(t('email.instantJobRequest.startDate'))}</td>
                        <td style="padding: 8px 0; color: #F5E6C8; font-size: 14px;">${e(data.startDate)}</td>
                      </tr>
                      <tr>
                        <td style="padding: 8px 0; color: #8B7A5E; font-size: 14px; vertical-align: top;">💰 ${e(t('email.instantJobRequest.payment'))}</td>
                        <td style="padding: 8px 0; color: #C9963F; font-size: 14px; font-weight: 600;">${e(data.payment)}</td>
                      </tr>
                    </table>
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          <!-- Employer Info -->
          <tr>
            <td style="padding: 16px 40px 0;">
              <table role="presentation" style="width: 100%; border-collapse: collapse; background-color: #0E1B32; border-radius: 8px;">
                <tr>
                  <td style="padding: 20px 24px;">
                    <h3 style="margin: 0 0 8px; color: #C9963F; font-size: 14px; font-weight: 600; text-transform: uppercase; letter-spacing: 1px;">👤 ${e(t('email.instantJobRequest.employerTitle'))}</h3>
                    <p style="margin: 0; color: #F5E6C8; font-size: 15px;">${e(data.employerName)}</p>
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          <!-- Action Required -->
          <tr>
            <td style="padding: 24px 40px 0;">
              <div style="padding: 20px 24px; background: linear-gradient(135deg, rgba(96, 165, 250, 0.1) 0%, rgba(96, 165, 250, 0.05) 100%); border-radius: 8px; border-left: 4px solid #60A5FA;">
                <h3 style="margin: 0 0 8px; color: #60A5FA; font-size: 16px; font-weight: 600;">🔔 ${e(t('email.instantJobRequest.actionRequired'))}</h3>
                <p style="margin: 0; color: #B8A88A; font-size: 14px; line-height: 1.6;">${e(t('email.instantJobRequest.actionDescription'))}</p>
              </div>
            </td>
          </tr>

          <!-- CTA Button -->
          <tr>
            <td align="center" style="padding: 32px 40px 0;">
              <a href="${e(data.ctaUrl)}" style="display: inline-block; padding: 16px 40px; background: linear-gradient(135deg, #C9963F 0%, #D4A853 50%, #C9963F 100%); color: #0A1628; text-decoration: none; border-radius: 8px; font-weight: 600; font-size: 16px; box-shadow: 0 4px 6px rgba(201, 150, 63, 0.35);">${e(t('email.instantJobRequest.openAppButton'))}</a>
            </td>
          </tr>

          <!-- Note -->
          <tr>
            <td style="padding: 32px 40px;">
              <div style="padding: 16px 20px; background-color: #0E1B32; border-radius: 8px; border-left: 4px solid #C9963F;">
                <p style="margin: 0 0 4px; color: #D4A853; font-size: 13px; font-weight: 600;">💡 ${e(t('email.instantJobRequest.noteTitle'))}</p>
                <p style="margin: 0; color: #8B7A5E; font-size: 13px; line-height: 1.5;">${e(t('email.instantJobRequest.noteText'))}</p>
              </div>
            </td>
          </tr>
          
          <!-- Footer -->
          <tr>
            <td style="padding: 24px 40px 30px; background-color: #0E1B32; border-radius: 0 0 12px 12px; border-top: 1px solid #1E3048;">
              <p style="margin: 0 0 8px; color: #8B7A5E; font-size: 13px; line-height: 1.6;">${e(t('email.instantJobRequest.footerText'))}</p>
              <p style="margin: 0; color: #8B7A5E; font-size: 13px;">${e(t('email.common.supportMessage'))}</p>
            </td>
          </tr>
        </table>
        
        <!-- Copyright -->
        <p style="margin: 24px 0 0; color: #5C4F3A; font-size: 12px; text-align: center;">
          ${t('email.common.copyright', { year: new Date().getFullYear().toString() })}
        </p>
      </td>
    </tr>
  </table>
</body>
</html>
    `.trim();
  }

  getInstantJobRequestAcceptedHtml(
    data: {
      employerName: string;
      providerName: string;
      jobTitle: string;
      category: string;
      location: string;
      startDate: string;
      payment: string;
      ctaUrl: string;
    },
    t: (key: string, params?: any) => string,
    language: 'en' | 'pt' = 'en',
  ): string {
    const e = (s: string) => s.replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
    return `
<!DOCTYPE html>
<html lang="${language}">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${e(t('email.instantJobRequest.acceptedSubject', { jobTitle: data.jobTitle }))}</title>
</head>
<body style="margin: 0; padding: 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; background-color: #080F1E;">
  <table role="presentation" style="width: 100%; border-collapse: collapse; background-color: #080F1E;">
    <tr>
      <td align="center" style="padding: 40px 20px;">
        <table role="presentation" style="max-width: 600px; width: 100%; border-collapse: collapse; background-color: #0D1A30; border-radius: 12px; box-shadow: 0 4px 24px rgba(0, 0, 0, 0.5), 0 0 1px rgba(201, 150, 63, 0.2);">
          <!-- Header -->
          <tr>
            <td style="padding: 40px 40px 30px; text-align: center; background: linear-gradient(135deg, #0D1A30 0%, #162540 50%, #0D1A30 100%); border-top: 3px solid #22C55E; border-radius: 12px 12px 0 0;">
              <h1 style="margin: 0 0 8px; color: #F5E6C8; font-size: 32px; font-weight: 700; letter-spacing: -0.5px;">${e(t('email.common.brandName'))}</h1>
              <p style="margin: 0; color: #22C55E; font-size: 18px; font-weight: 600;">✅ ${e(t('email.instantJobRequest.acceptedHeader'))}</p>
            </td>
          </tr>
          
          <!-- Greeting -->
          <tr>
            <td style="padding: 40px 40px 0;">
              <p style="margin: 0 0 16px; color: #F5E6C8; font-size: 18px; font-weight: 600;">${e(t('email.instantJobRequest.acceptedGreeting', { employerName: data.employerName }))}</p>
              <p style="margin: 0 0 32px; color: #B8A88A; font-size: 16px; line-height: 1.6;">
                ${e(t('email.instantJobRequest.acceptedIntro', { providerName: data.providerName }))}
              </p>
            </td>
          </tr>

          <!-- Job Details Card -->
          <tr>
            <td style="padding: 0 40px;">
              <table role="presentation" style="width: 100%; border-collapse: collapse; background: linear-gradient(135deg, rgba(34, 197, 94, 0.08) 0%, rgba(34, 197, 94, 0.03) 100%); border-radius: 8px; border: 1px solid rgba(34, 197, 94, 0.2);">
                <tr>
                  <td style="padding: 24px;">
                    <h3 style="margin: 0 0 16px; color: #22C55E; font-size: 16px; font-weight: 600; text-transform: uppercase; letter-spacing: 1px;">📋 ${e(t('email.instantJobRequest.jobDetailsTitle'))}</h3>
                    <table role="presentation" style="width: 100%; border-collapse: collapse;">
                      <tr>
                        <td style="padding: 8px 0; color: #8B7A5E; font-size: 14px; width: 120px; vertical-align: top;">${e(t('email.instantJobRequest.jobTitle'))}</td>
                        <td style="padding: 8px 0; color: #F5E6C8; font-size: 14px; font-weight: 600;">${e(data.jobTitle)}</td>
                      </tr>
                      <tr>
                        <td style="padding: 8px 0; color: #8B7A5E; font-size: 14px; vertical-align: top;">${e(t('email.instantJobRequest.category'))}</td>
                        <td style="padding: 8px 0; color: #F5E6C8; font-size: 14px;">${e(data.category)}</td>
                      </tr>
                      <tr>
                        <td style="padding: 8px 0; color: #8B7A5E; font-size: 14px; vertical-align: top;">📍 ${e(t('email.instantJobRequest.location'))}</td>
                        <td style="padding: 8px 0; color: #F5E6C8; font-size: 14px;">${e(data.location)}</td>
                      </tr>
                      <tr>
                        <td style="padding: 8px 0; color: #8B7A5E; font-size: 14px; vertical-align: top;">📅 ${e(t('email.instantJobRequest.startDate'))}</td>
                        <td style="padding: 8px 0; color: #F5E6C8; font-size: 14px;">${e(data.startDate)}</td>
                      </tr>
                      <tr>
                        <td style="padding: 8px 0; color: #8B7A5E; font-size: 14px; vertical-align: top;">💰 ${e(t('email.instantJobRequest.payment'))}</td>
                        <td style="padding: 8px 0; color: #C9963F; font-size: 14px; font-weight: 600;">${e(data.payment)}</td>
                      </tr>
                    </table>
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          <!-- Provider Info -->
          <tr>
            <td style="padding: 16px 40px 0;">
              <table role="presentation" style="width: 100%; border-collapse: collapse; background-color: #0E1B32; border-radius: 8px;">
                <tr>
                  <td style="padding: 20px 24px;">
                    <h3 style="margin: 0 0 8px; color: #22C55E; font-size: 14px; font-weight: 600; text-transform: uppercase; letter-spacing: 1px;">👤 ${e(t('email.instantJobRequest.providerTitle'))}</h3>
                    <p style="margin: 0; color: #F5E6C8; font-size: 15px;">${e(data.providerName)}</p>
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          <!-- Next Steps -->
          <tr>
            <td style="padding: 24px 40px 0;">
              <div style="padding: 24px; background-color: #0E1B32; border-radius: 8px;">
                <h3 style="margin: 0 0 16px; color: #F5E6C8; font-size: 18px; font-weight: 600;">🚀 ${e(t('email.instantJobRequest.nextStepsTitle'))}</h3>
                <ul style="margin: 0; padding-left: 20px; color: #B8A88A; font-size: 15px; line-height: 1.8;">
                  <li style="margin-bottom: 8px;">${e(t('email.instantJobRequest.nextStep1'))}</li>
                  <li style="margin-bottom: 8px;">${e(t('email.instantJobRequest.nextStep2'))}</li>
                  <li>${e(t('email.instantJobRequest.nextStep3'))}</li>
                </ul>
              </div>
            </td>
          </tr>

          <!-- CTA Button -->
          <tr>
            <td align="center" style="padding: 32px 40px;">
              <a href="${e(data.ctaUrl)}" style="display: inline-block; padding: 16px 40px; background: linear-gradient(135deg, #22C55E 0%, #16A34A 100%); color: #FFFFFF; text-decoration: none; border-radius: 8px; font-weight: 600; font-size: 16px; box-shadow: 0 4px 6px rgba(34, 197, 94, 0.35);">${e(t('email.instantJobRequest.viewApplicationButton'))}</a>
            </td>
          </tr>
          
          <!-- Footer -->
          <tr>
            <td style="padding: 24px 40px 30px; background-color: #0E1B32; border-radius: 0 0 12px 12px; border-top: 1px solid #1E3048;">
              <p style="margin: 0; color: #8B7A5E; font-size: 13px; line-height: 1.6;">${e(t('email.common.supportMessage'))}</p>
            </td>
          </tr>
        </table>
        
        <!-- Copyright -->
        <p style="margin: 24px 0 0; color: #5C4F3A; font-size: 12px; text-align: center;">
          ${t('email.common.copyright', { year: new Date().getFullYear().toString() })}
        </p>
      </td>
    </tr>
  </table>
</body>
</html>
    `.trim();
  }

  getInstantJobRequestRejectedHtml(
    data: {
      employerName: string;
      providerName: string;
      jobTitle: string;
      category: string;
      location: string;
      reason: string;
      ctaUrl: string;
    },
    t: (key: string, params?: any) => string,
    language: 'en' | 'pt' = 'en',
  ): string {
    const e = (s: string) => s.replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
    return `
<!DOCTYPE html>
<html lang="${language}">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${e(t('email.instantJobRequest.rejectedSubject', { jobTitle: data.jobTitle }))}</title>
</head>
<body style="margin: 0; padding: 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; background-color: #080F1E;">
  <table role="presentation" style="width: 100%; border-collapse: collapse; background-color: #080F1E;">
    <tr>
      <td align="center" style="padding: 40px 20px;">
        <table role="presentation" style="max-width: 600px; width: 100%; border-collapse: collapse; background-color: #0D1A30; border-radius: 12px; box-shadow: 0 4px 24px rgba(0, 0, 0, 0.5), 0 0 1px rgba(201, 150, 63, 0.2);">
          <!-- Header -->
          <tr>
            <td style="padding: 40px 40px 30px; text-align: center; background: linear-gradient(135deg, #0D1A30 0%, #162540 50%, #0D1A30 100%); border-top: 3px solid #EF4444; border-radius: 12px 12px 0 0;">
              <h1 style="margin: 0 0 8px; color: #F5E6C8; font-size: 32px; font-weight: 700; letter-spacing: -0.5px;">${e(t('email.common.brandName'))}</h1>
              <p style="margin: 0; color: #EF4444; font-size: 18px; font-weight: 600;">${e(t('email.instantJobRequest.rejectedHeader'))}</p>
            </td>
          </tr>
          
          <!-- Greeting -->
          <tr>
            <td style="padding: 40px 40px 0;">
              <p style="margin: 0 0 16px; color: #F5E6C8; font-size: 18px; font-weight: 600;">${e(t('email.instantJobRequest.rejectedGreeting', { employerName: data.employerName }))}</p>
              <p style="margin: 0 0 32px; color: #B8A88A; font-size: 16px; line-height: 1.6;">
                ${e(t('email.instantJobRequest.rejectedIntro', { providerName: data.providerName }))}
              </p>
            </td>
          </tr>

          <!-- Job Info -->
          <tr>
            <td style="padding: 0 40px;">
              <table role="presentation" style="width: 100%; border-collapse: collapse; background-color: #0E1B32; border-radius: 8px;">
                <tr>
                  <td style="padding: 24px;">
                    <h3 style="margin: 0 0 12px; color: #C9963F; font-size: 16px; font-weight: 600;">📋 ${e(t('email.instantJobRequest.jobDetailsTitle'))}</h3>
                    <table role="presentation" style="width: 100%; border-collapse: collapse;">
                      <tr>
                        <td style="padding: 6px 0; color: #8B7A5E; font-size: 14px; width: 120px;">${e(t('email.instantJobRequest.jobTitle'))}</td>
                        <td style="padding: 6px 0; color: #F5E6C8; font-size: 14px; font-weight: 600;">${e(data.jobTitle)}</td>
                      </tr>
                      <tr>
                        <td style="padding: 6px 0; color: #8B7A5E; font-size: 14px;">${e(t('email.instantJobRequest.category'))}</td>
                        <td style="padding: 6px 0; color: #F5E6C8; font-size: 14px;">${e(data.category)}</td>
                      </tr>
                      <tr>
                        <td style="padding: 6px 0; color: #8B7A5E; font-size: 14px;">📍 ${e(t('email.instantJobRequest.location'))}</td>
                        <td style="padding: 6px 0; color: #F5E6C8; font-size: 14px;">${e(data.location)}</td>
                      </tr>
                    </table>
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          <!-- Rejection Reason -->
          <tr>
            <td style="padding: 16px 40px 0;">
              <div style="padding: 20px 24px; background: linear-gradient(135deg, rgba(239, 68, 68, 0.08) 0%, rgba(239, 68, 68, 0.03) 100%); border-radius: 8px; border-left: 4px solid #EF4444;">
                <h3 style="margin: 0 0 8px; color: #EF4444; font-size: 14px; font-weight: 600; text-transform: uppercase; letter-spacing: 1px;">${e(t('email.instantJobRequest.reasonTitle'))}</h3>
                <p style="margin: 0; color: #F5E6C8; font-size: 15px; line-height: 1.6;">${e(data.reason)}</p>
              </div>
            </td>
          </tr>

          <!-- What's Next -->
          <tr>
            <td style="padding: 24px 40px 0;">
              <div style="padding: 24px; background-color: #0E1B32; border-radius: 8px;">
                <h3 style="margin: 0 0 12px; color: #F5E6C8; font-size: 18px; font-weight: 600;">${e(t('email.instantJobRequest.whatNextTitle'))}</h3>
                <p style="margin: 0; color: #B8A88A; font-size: 15px; line-height: 1.6;">${e(t('email.instantJobRequest.whatNextText'))}</p>
              </div>
            </td>
          </tr>

          <!-- CTA Button -->
          <tr>
            <td align="center" style="padding: 32px 40px;">
              <a href="${e(data.ctaUrl)}" style="display: inline-block; padding: 16px 40px; background: linear-gradient(135deg, #C9963F 0%, #D4A853 50%, #C9963F 100%); color: #0A1628; text-decoration: none; border-radius: 8px; font-weight: 600; font-size: 16px; box-shadow: 0 4px 6px rgba(201, 150, 63, 0.35);">${e(t('email.instantJobRequest.browseProvidersButton'))}</a>
            </td>
          </tr>
          
          <!-- Footer -->
          <tr>
            <td style="padding: 24px 40px 30px; background-color: #0E1B32; border-radius: 0 0 12px 12px; border-top: 1px solid #1E3048;">
              <p style="margin: 0; color: #8B7A5E; font-size: 13px; line-height: 1.6;">${e(t('email.common.supportMessage'))}</p>
            </td>
          </tr>
        </table>
        
        <!-- Copyright -->
        <p style="margin: 24px 0 0; color: #5C4F3A; font-size: 12px; text-align: center;">
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
      // Remove this token from any other user to prevent cross-account notifications
      await this.prisma.user.updateMany({
        where: {
          pushToken,
          id: { not: userId },
        },
        data: {
          pushToken: null,
          pushTokenPlatform: null,
        },
      });

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

  async unregisterPushToken(userId: string) {
    try {
      await this.prisma.user.update({
        where: { id: userId },
        data: {
          pushToken: null,
          pushTokenPlatform: null,
        },
      });
      this.logger.log(`Push token unregistered for user ${userId}`);
      return { success: true, message: 'Push token unregistered' };
    } catch (err) {
      this.logger.warn(
        `Failed to unregister push token: ${(err as Error).message}`,
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
        const result = (await response.json()) as any;
        // Clean up invalid tokens
        if (
          result?.data?.status === 'error' &&
          result?.data?.details?.error === 'DeviceNotRegistered'
        ) {
          this.logger.warn(
            `Push token for user ${userId} is no longer valid, clearing`,
          );
          await this.prisma.user.update({
            where: { id: userId },
            data: { pushToken: null, pushTokenPlatform: null },
          });
          return false;
        }
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
<body style="margin: 0; padding: 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; background-color: #080F1E;">
  <table role="presentation" style="width: 100%; border-collapse: collapse; background-color: #080F1E;">
    <tr>
      <td align="center" style="padding: 40px 20px;">
        <table role="presentation" style="max-width: 600px; width: 100%; border-collapse: collapse; background-color: #0D1A30; border-radius: 12px; box-shadow: 0 4px 24px rgba(0, 0, 0, 0.5), 0 0 1px rgba(201, 150, 63, 0.2);">
          <!-- Header -->
          <tr>
            <td style="padding: 40px 40px 30px; text-align: center; background: linear-gradient(135deg, #0D1A30 0%, #162540 50%, #0D1A30 100%); border-top: 3px solid #C9963F; border-radius: 12px 12px 0 0;">
              <h1 style="margin: 0; color: #F5E6C8; font-size: 28px; font-weight: 700; letter-spacing: -0.5px;">${title}</h1>
            </td>
          </tr>
          
          <!-- Content -->
          <tr>
            <td style="padding: 40px;">
              <p style="margin: 0 0 24px; color: #F5E6C8; font-size: 16px; line-height: 1.6; font-weight: 500;">${greeting}</p>
              <div style="color: #B8A88A; font-size: 16px; line-height: 1.7;">
                ${content}
              </div>
              ${
                footerNote
                  ? `
              <div style="margin-top: 32px; padding: 20px; background-color: #0E1B32; border-radius: 8px; border-left: 4px solid #C9963F;">
                <p style="margin: 0; color: #8B7A5E; font-size: 14px; line-height: 1.6;">${footerNote}</p>
              </div>
              `
                  : ''
              }
            </td>
          </tr>
          
          <!-- Footer -->
          <tr>
            <td style="padding: 30px 40px; background-color: #0E1B32; border-radius: 0 0 12px 12px; border-top: 1px solid #1E3048;">
              <p style="margin: 0 0 12px; color: #8B7A5E; font-size: 14px; line-height: 1.6;">
                <a href="mailto:${translator('email.common.supportEmail')}" style="color: #C9963F; text-decoration: none;">${translator('email.common.supportEmail')}</a>
              </p>
              <p style="margin: 0; color: #5C4F3A; font-size: 12px; line-height: 1.6;">
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
