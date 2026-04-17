import { Injectable, Logger, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../prisma/prisma.service';
import { NotificationsService } from '../notifications/notifications.service';
import * as crypto from 'crypto';

/** Didit V3 webhook payload (status.updated) */
interface DiditWebhookPayload {
  session_id: string;
  status: string; // "Approved" | "Declined" | "In Progress" | "In Review" | "Abandoned"
  webhook_type: string; // "status.updated" | "data.updated"
  created_at: number;
  timestamp: number;
  workflow_id?: string;
  workflow_version?: number;
  vendor_data?: string; // We store our userId here
  metadata?: Record<string, unknown>;
  decision?: DiditDecision;
}

interface DiditDecision {
  session_id: string;
  status: string;
  features: string[];
  id_verifications?: DiditIdVerification[];
  liveness_checks?: DiditLivenessCheck[];
  face_matches?: DiditFaceMatch[];
  aml_screenings?: DiditAmlScreening[];
  [key: string]: unknown;
}

interface DiditIdVerification {
  node_id: string;
  status: string;
  document_type?: string;
  document_number?: string;
  first_name?: string;
  last_name?: string;
  full_name?: string;
  date_of_birth?: string;
  expiration_date?: string;
  issuing_state?: string;
  issuing_state_name?: string;
  nationality?: string;
  gender?: string;
  portrait_image?: string;
  front_image?: string;
  back_image?: string;
  warnings?: Array<{ risk: string; short_description: string }>;
  [key: string]: unknown;
}

interface DiditLivenessCheck {
  node_id: string;
  status: string;
  method?: string;
  score?: number;
  warnings?: Array<{ risk: string; short_description: string }>;
}

interface DiditFaceMatch {
  node_id: string;
  status: string;
  score?: number;
  warnings?: Array<{ risk: string; short_description: string }>;
}

interface DiditAmlScreening {
  node_id: string;
  status: string;
  total_hits?: number;
  score?: number;
  hits?: unknown[];
  warnings?: Array<{ risk: string; short_description: string }>;
}

@Injectable()
export class DiditWebhookService {
  private readonly logger = new Logger(DiditWebhookService.name);
  private readonly webhookSecret: string;

  constructor(
    private readonly config: ConfigService,
    private readonly prisma: PrismaService,
    private readonly notifications: NotificationsService,
  ) {
    this.webhookSecret = this.config.get<string>('DIDIT_WEBHOOK_SECRET', '');
  }

  // ─── Signature verification ───────────────────────────────────────────

  /**
   * Verify X-Signature-V2 (recommended by Didit).
   * Works even if Express re-encodes Unicode characters.
   */
  verifySignatureV2(
    jsonBody: Record<string, unknown>,
    signatureHeader: string,
    timestampHeader: string,
  ): boolean {
    if (!this.webhookSecret) {
      this.logger.warn('DIDIT_WEBHOOK_SECRET not configured');
      return false;
    }

    // Check timestamp freshness (within 5 minutes)
    const currentTime = Math.floor(Date.now() / 1000);
    const incomingTime = parseInt(timestampHeader, 10);
    if (
      Number.isNaN(incomingTime) ||
      Math.abs(currentTime - incomingTime) > 300
    ) {
      this.logger.warn('Stale or invalid webhook timestamp');
      return false;
    }

    // Process floats and create sorted canonical JSON
    const processedData = this.shortenFloats(jsonBody);
    const sortedData = this.sortKeysRecursive(processedData);
    const canonicalJson = JSON.stringify(sortedData);

    const hmac = crypto.createHmac('sha256', this.webhookSecret);
    const expectedSignature = hmac.update(canonicalJson, 'utf8').digest('hex');

    try {
      return crypto.timingSafeEqual(
        Buffer.from(expectedSignature, 'utf8'),
        Buffer.from(signatureHeader, 'utf8'),
      );
    } catch {
      return false; // length mismatch
    }
  }

  /**
   * Fallback: verify X-Signature-Simple (core fields only).
   */
  verifySignatureSimple(
    jsonBody: Record<string, unknown>,
    signatureHeader: string,
    timestampHeader: string,
  ): boolean {
    if (!this.webhookSecret) return false;

    const currentTime = Math.floor(Date.now() / 1000);
    const incomingTime = parseInt(timestampHeader, 10);
    if (
      Number.isNaN(incomingTime) ||
      Math.abs(currentTime - incomingTime) > 300
    ) {
      return false;
    }

    const canonicalString = [
      jsonBody.timestamp ?? '',
      jsonBody.session_id ?? '',
      jsonBody.status ?? '',
      jsonBody.webhook_type ?? '',
    ].join(':');

    const hmac = crypto.createHmac('sha256', this.webhookSecret);
    const expectedSignature = hmac.update(canonicalString).digest('hex');

    try {
      return crypto.timingSafeEqual(
        Buffer.from(expectedSignature, 'utf8'),
        Buffer.from(signatureHeader, 'utf8'),
      );
    } catch {
      return false;
    }
  }

  /**
   * Validate an incoming webhook request. Throws on failure.
   */
  validateWebhook(
    body: Record<string, unknown>,
    headers: {
      signatureV2?: string;
      signatureSimple?: string;
      timestamp?: string;
    },
  ): void {
    const { signatureV2, signatureSimple, timestamp } = headers;

    if (!timestamp) {
      throw new UnauthorizedException('Missing X-Timestamp header');
    }

    // Try V2 first (recommended)
    if (signatureV2 && this.verifySignatureV2(body, signatureV2, timestamp)) {
      this.logger.debug('Webhook verified with X-Signature-V2');
      return;
    }

    // Fallback to Simple
    if (
      signatureSimple &&
      this.verifySignatureSimple(body, signatureSimple, timestamp)
    ) {
      this.logger.debug('Webhook verified with X-Signature-Simple (fallback)');
      return;
    }

    throw new UnauthorizedException('Invalid webhook signature');
  }

  // ─── Event processing ─────────────────────────────────────────────────

  async handleWebhook(payload: DiditWebhookPayload): Promise<void> {
    const { session_id, status, webhook_type, vendor_data, decision } = payload;

    this.logger.log(
      `Didit webhook: type=${webhook_type} session=${session_id} status=${status}`,
    );

    if (webhook_type === 'status.updated') {
      await this.handleStatusUpdated(session_id, status, vendor_data, decision);
    } else if (webhook_type === 'data.updated') {
      // Data corrections — update extracted data if decision included
      if (decision) {
        await this.updateExtractedData(session_id, decision);
      }
    }
  }

  private async handleStatusUpdated(
    sessionId: string,
    diditStatus: string,
    vendorData?: string,
    decision?: DiditDecision,
  ): Promise<void> {
    // Find our IdVerification by providerReference (session_id)
    const verification = await this.prisma.idVerification.findFirst({
      where: { providerReference: sessionId },
      include: { user: { select: { id: true, email: true, firstName: true } } },
    });

    if (!verification) {
      // Might be a session we don't track, or vendor_data lookup
      if (vendorData) {
        this.logger.warn(
          `No verification found for session ${sessionId}, vendor_data=${vendorData}`,
        );
      }
      return;
    }

    const mappedStatus = this.mapDiditStatus(diditStatus);
    const updates: Record<string, unknown> = {
      status: mappedStatus,
    };

    // Extract verification results from decision
    if (decision) {
      const idv = decision.id_verifications?.[0];
      const liveness = decision.liveness_checks?.[0];
      const faceMatch = decision.face_matches?.[0];

      if (liveness?.score != null) {
        updates.livenessCheck = liveness.status === 'Approved';
      }

      if (faceMatch?.score != null) {
        updates.faceMatch = faceMatch.score;
      }

      // Confidence: use face match score or liveness score
      if (faceMatch?.score != null) {
        updates.confidence = faceMatch.score / 100;
      }

      // Extract document data
      if (idv) {
        updates.extractedData = {
          firstName: idv.first_name,
          lastName: idv.last_name,
          fullName: idv.full_name,
          dateOfBirth: idv.date_of_birth,
          documentNumber: idv.document_number,
          documentType: idv.document_type,
          expirationDate: idv.expiration_date,
          issuingState: idv.issuing_state,
          issuingStateName: idv.issuing_state_name,
          nationality: idv.nationality,
          gender: idv.gender,
        };

        if (idv.document_number) {
          updates.documentNumber = idv.document_number;
        }
        if (idv.issuing_state) {
          updates.documentCountry = idv.issuing_state;
        }
        if (idv.expiration_date) {
          updates.documentExpiry = new Date(idv.expiration_date);
        }
      }

      // Store fraud check warnings
      const allWarnings = [
        ...(idv?.warnings ?? []),
        ...(liveness?.warnings ?? []),
        ...(faceMatch?.warnings ?? []),
        ...(decision.aml_screenings?.[0]?.warnings ?? []),
      ];
      if (allWarnings.length > 0) {
        updates.fraudChecks = allWarnings;
      }
    }

    // Update verification record
    await this.prisma.idVerification.update({
      where: { id: verification.id },
      data: updates as any,
    });

    // Update user status
    const userStatus =
      mappedStatus === 'VERIFIED'
        ? 'VERIFIED'
        : mappedStatus === 'FAILED'
          ? 'FAILED'
          : mappedStatus;

    await this.prisma.user.update({
      where: { id: verification.userId },
      data: {
        idVerificationStatus: userStatus,
        ...(mappedStatus === 'VERIFIED' ? { isIdVerified: true } : {}),
      },
    });

    // Send notification
    try {
      if (mappedStatus === 'VERIFIED') {
        await this.notifications.createNotification({
          userId: verification.userId,
          type: 'SYSTEM',
          title: 'ID Verification Approved',
          body: 'Your identity has been verified successfully. You can now start working!',
        });
      } else if (mappedStatus === 'FAILED') {
        await this.notifications.createNotification({
          userId: verification.userId,
          type: 'SYSTEM',
          title: 'ID Verification Failed',
          body: 'Your identity verification was not successful. Please try again or contact support.',
        });
      }
    } catch (e) {
      this.logger.warn(`Failed to send notification: ${e}`);
    }

    this.logger.log(
      `Updated verification ${verification.id} → ${mappedStatus} for user ${verification.userId}`,
    );
  }

  private async updateExtractedData(
    sessionId: string,
    decision: DiditDecision,
  ): Promise<void> {
    const verification = await this.prisma.idVerification.findFirst({
      where: { providerReference: sessionId },
    });
    if (!verification) return;

    const idv = decision.id_verifications?.[0];
    if (!idv) return;

    await this.prisma.idVerification.update({
      where: { id: verification.id },
      data: {
        extractedData: {
          firstName: idv.first_name,
          lastName: idv.last_name,
          fullName: idv.full_name,
          dateOfBirth: idv.date_of_birth,
          documentNumber: idv.document_number,
          documentType: idv.document_type,
          expirationDate: idv.expiration_date,
          issuingState: idv.issuing_state,
          nationality: idv.nationality,
        },
      },
    });
  }

  // ─── Helpers ──────────────────────────────────────────────────────────

  private mapDiditStatus(
    diditStatus: string,
  ): 'PENDING' | 'IN_PROGRESS' | 'VERIFIED' | 'FAILED' | 'MANUAL_REVIEW' {
    switch (diditStatus) {
      case 'Approved':
        return 'VERIFIED';
      case 'Declined':
        return 'FAILED';
      case 'In Review':
        return 'MANUAL_REVIEW';
      case 'In Progress':
        return 'IN_PROGRESS';
      case 'Abandoned':
        return 'FAILED';
      default:
        return 'PENDING';
    }
  }

  /**
   * Convert floats that are whole numbers to integers (matches Didit's server-side behavior).
   */
  private shortenFloats(data: unknown): unknown {
    if (Array.isArray(data)) {
      return data.map((item) => this.shortenFloats(item));
    }
    if (data !== null && typeof data === 'object') {
      return Object.fromEntries(
        Object.entries(data as Record<string, unknown>).map(([key, value]) => [
          key,
          this.shortenFloats(value),
        ]),
      );
    }
    if (typeof data === 'number' && !Number.isInteger(data) && data % 1 === 0) {
      return Math.trunc(data);
    }
    return data;
  }

  /**
   * Recursively sort object keys for canonical JSON.
   */
  private sortKeysRecursive(data: unknown): unknown {
    if (Array.isArray(data)) {
      return data.map((item) => this.sortKeysRecursive(item));
    }
    if (data !== null && typeof data === 'object') {
      return Object.keys(data as Record<string, unknown>)
        .sort()
        .reduce(
          (result, key) => {
            result[key] = this.sortKeysRecursive(
              (data as Record<string, unknown>)[key],
            );
            return result;
          },
          {} as Record<string, unknown>,
        );
    }
    return data;
  }
}
