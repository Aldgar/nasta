import {
  Injectable,
  BadRequestException,
  NotFoundException,
  ForbiddenException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { KycFileUploadService } from './file-upload.service';
import { NotificationsService } from '../notifications/notifications.service';
import { EmailTranslationsService } from '../notifications/email-translations.service';

type VerificationType =
  | 'GOVERNMENT_ID'
  | 'PASSPORT'
  | 'DRIVERS_LICENSE'
  | 'NATIONAL_ID'
  | 'RESIDENCE_PERMIT';

@Injectable()
export class KycService {
  constructor(
    private prisma: PrismaService,
    private uploads: KycFileUploadService,
    private notifications: NotificationsService,
    private emailTranslations: EmailTranslationsService,
  ) {}

  async initiate(
    userId: string,
    verificationType: VerificationType,
    consent?: { accepted: boolean; version?: string; textHash?: string },
    documentType?: string,
  ) {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user) throw new NotFoundException('User not found');
    if (!consent || consent.accepted !== true) {
      throw new BadRequestException('Consent is required to initiate KYC');
    }

    // Check for existing verifications in progress (exclude VERIFIED to allow re-verification)
    const existing = await this.prisma.idVerification.findFirst({
      where: {
        userId,
        status: { in: ['PENDING', 'IN_PROGRESS', 'MANUAL_REVIEW'] },
      },
      orderBy: { createdAt: 'desc' },
    });
    if (existing) {
      throw new BadRequestException(
        'You already have an ID verification in progress',
      );
    }

    const created = await this.prisma.idVerification.create({
      data: {
        userId,
        verificationType,
        documentType: (documentType as any) || null,
        status: 'PENDING',
        consentAcceptedAt: new Date(),
        consentVersion: consent.version || null,
        consentTextHash: consent.textHash || null,
      },
      select: {
        id: true,
        status: true,
        verificationType: true,
        createdAt: true,
      },
    });

    await this.prisma.user.update({
      where: { id: userId },
      data: { idVerificationStatus: 'PENDING' },
    });

    return { ...created, message: 'KYC initiated. Upload your ID and selfie.' };
  }

  async uploadDocuments(
    verificationId: string,
    userId: string,
    files: {
      documentFront?: Express.Multer.File;
      documentBack?: Express.Multer.File;
      selfie?: Express.Multer.File;
    },
  ) {
    const kyc = await this.prisma.idVerification.findUnique({
      where: { id: verificationId },
    });
    if (!kyc) throw new NotFoundException('Verification not found');
    if (kyc.userId !== userId)
      throw new ForbiddenException('Not your verification');
    if (!files.documentFront && !files.documentBack && !files.selfie) {
      throw new BadRequestException('No files uploaded');
    }

    const updates: Record<string, unknown> = {};
    if (files.documentFront) {
      const p = await this.uploads.saveFile(files.documentFront, 'front');
      updates.documentFrontUrl = p;
    }
    if (files.documentBack) {
      const p = await this.uploads.saveFile(files.documentBack, 'back');
      updates.documentBackUrl = p;
    }
    if (files.selfie) {
      const p = await this.uploads.saveFile(files.selfie, 'selfie');
      updates.selfieUrl = p;
    }

    // Only update status to MANUAL_REVIEW if it's currently PENDING or IN_PROGRESS
    // This allows re-uploads without changing status if already reviewed
    const shouldUpdateStatus =
      kyc.status === 'PENDING' || kyc.status === 'IN_PROGRESS';
    if (shouldUpdateStatus) {
      updates.status = 'MANUAL_REVIEW';
    }

    const updated = await this.prisma.idVerification.update({
      where: { id: verificationId },
      data: updates,
      select: {
        id: true,
        status: true,
        documentFrontUrl: true,
        documentBackUrl: true,
        selfieUrl: true,
      },
    });

    // Only update user status if we updated the verification status
    if (shouldUpdateStatus) {
      await this.prisma.user.update({
        where: { id: userId },
        data: { idVerificationStatus: 'MANUAL_REVIEW' },
      });
    }

    return { ...updated, message: 'Documents uploaded. Awaiting review.' };
  }

  async uploadCertification(
    verificationId: string,
    userId: string,
    file: Express.Multer.File,
  ) {
    const kyc = await this.prisma.idVerification.findUnique({
      where: { id: verificationId },
    });
    if (!kyc) throw new NotFoundException('Verification not found');
    if (kyc.userId !== userId)
      throw new ForbiddenException('Not your verification');
    if (!file) {
      throw new BadRequestException('No file uploaded');
    }

    const fileUrl = await this.uploads.saveFile(file, 'certification');

    // Get existing certifications or initialize empty array
    const existingCerts = (kyc.certifications as any[]) || [];

    // Add new certification
    const newCert = {
      url: fileUrl,
      status: 'PENDING',
      uploadedAt: new Date().toISOString(),
    };

    const updatedCerts = [...existingCerts, newCert];

    // Update document statuses
    const documentStatuses =
      (kyc.documentStatuses as Record<string, any>) || {};
    const certStatuses = documentStatuses.certifications || [];
    certStatuses.push('PENDING');
    documentStatuses.certifications = certStatuses;

    const updated = await this.prisma.idVerification.update({
      where: { id: verificationId },
      data: {
        certifications: updatedCerts as any,
        documentStatuses: documentStatuses as any,
        status:
          kyc.status === 'PENDING' || kyc.status === 'IN_PROGRESS'
            ? 'MANUAL_REVIEW'
            : kyc.status,
      },
      select: {
        id: true,
        certifications: true,
      },
    });

    if (kyc.status === 'PENDING' || kyc.status === 'IN_PROGRESS') {
      await this.prisma.user.update({
        where: { id: userId },
        data: { idVerificationStatus: 'MANUAL_REVIEW' },
      });
    }

    return {
      url: fileUrl,
      message: 'Certification uploaded. Awaiting review.',
    };
  }

  async uploadCv(
    verificationId: string,
    userId: string,
    file: Express.Multer.File,
  ) {
    const kyc = await this.prisma.idVerification.findUnique({
      where: { id: verificationId },
    });
    if (!kyc) throw new NotFoundException('Verification not found');
    if (kyc.userId !== userId)
      throw new ForbiddenException('Not your verification');
    if (!file) {
      throw new BadRequestException('No file uploaded');
    }

    const fileUrl = await this.uploads.saveFile(file, 'cv');

    // Get existing CV documents or initialize empty array
    const existingCvs = (kyc.cvDocuments as any[]) || [];

    // Add new CV
    const newCv = {
      url: fileUrl,
      status: 'PENDING',
      uploadedAt: new Date().toISOString(),
    };

    const updatedCvs = [...existingCvs, newCv];

    // Update document statuses
    const documentStatuses =
      (kyc.documentStatuses as Record<string, any>) || {};
    const cvStatuses = documentStatuses.cvDocuments || [];
    cvStatuses.push('PENDING');
    documentStatuses.cvDocuments = cvStatuses;

    const updated = await this.prisma.idVerification.update({
      where: { id: verificationId },
      data: {
        cvDocuments: updatedCvs as any,
        documentStatuses: documentStatuses as any,
        status:
          kyc.status === 'PENDING' || kyc.status === 'IN_PROGRESS'
            ? 'MANUAL_REVIEW'
            : kyc.status,
      },
      select: {
        id: true,
        cvDocuments: true,
      },
    });

    if (kyc.status === 'PENDING' || kyc.status === 'IN_PROGRESS') {
      await this.prisma.user.update({
        where: { id: userId },
        data: { idVerificationStatus: 'MANUAL_REVIEW' },
      });
    }

    return { url: fileUrl, message: 'CV uploaded. Awaiting review.' };
  }

  // Optional: allow users to set document details (number/country/expiry/type) for manual review context
  async setDocumentDetails(
    verificationId: string,
    userId: string,
    details: {
      documentNumber?: string;
      documentCountry?: string;
      documentExpiry?: string | Date;
      documentType?: string;
    },
  ) {
    const kyc = await this.prisma.idVerification.findUnique({
      where: { id: verificationId },
      select: { userId: true },
    });
    if (!kyc) throw new NotFoundException('Verification not found');
    if (kyc.userId !== userId)
      throw new ForbiddenException('Not your verification');
    const data: Record<string, any> = {};
    if (typeof details.documentNumber === 'string')
      data.documentNumber = details.documentNumber.trim();
    if (typeof details.documentCountry === 'string')
      data.documentCountry = details.documentCountry.trim().toUpperCase();
    if (details.documentExpiry) {
      const expDate = new Date(details.documentExpiry);
      if (isNaN(expDate.getTime()))
        throw new BadRequestException('Invalid documentExpiry');
      data.documentExpiry = expDate;
    }
    if (typeof details.documentType === 'string' && details.documentType) {
      const validTypes = [
        'DRIVERS_LICENSE',
        'PASSPORT',
        'NATIONAL_ID',
        'RESIDENCE_PERMIT',
      ];
      if (validTypes.includes(details.documentType)) {
        data.documentType = details.documentType;
      }
    }
    const updated = await this.prisma.idVerification.update({
      where: { id: verificationId },
      data,
      select: {
        id: true,
        documentNumber: true,
        documentCountry: true,
        documentExpiry: true,
        documentType: true,
      },
    });
    return { ...updated, message: 'Document details saved' };
  }

  async myStatus(userId: string) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { id: true, isIdVerified: true, idVerificationStatus: true },
    });
    if (!user) throw new NotFoundException('User not found');
    const current = await this.prisma.idVerification.findFirst({
      where: { userId },
      orderBy: { createdAt: 'desc' },
      select: {
        id: true,
        status: true,
        verificationType: true,
        documentType: true,
        documentFrontUrl: true,
        documentBackUrl: true,
        selfieUrl: true,
        certifications: true,
        cvDocuments: true,
        documentStatuses: true,
        createdAt: true,
      },
    });

    // Get all verifications for this user (including driver's license)
    const allVerifications = await this.prisma.idVerification.findMany({
      where: { userId },
      select: {
        id: true,
        verificationType: true,
        documentType: true,
        status: true,
        documentFrontUrl: true,
        documentBackUrl: true,
        selfieUrl: true,
        documentStatuses: true,
        createdAt: true,
      },
      orderBy: { createdAt: 'desc' },
    });

    return { user, current: current || undefined, allVerifications };
  }

  async adminList(
    statuses: Array<'PENDING' | 'IN_PROGRESS' | 'MANUAL_REVIEW'>,
  ) {
    // Query without user relation to avoid Prisma error on orphaned records
    const verifications = await this.prisma.idVerification.findMany({
      where: { status: { in: statuses } },
      orderBy: { createdAt: 'asc' },
      select: {
        id: true,
        status: true,
        verificationType: true,
        createdAt: true,
        documentFrontUrl: true,
        documentBackUrl: true,
        selfieUrl: true,
        documentNumber: true,
        documentCountry: true,
        documentExpiry: true,
        userId: true,
      },
    });

    // Batch-fetch users and filter out orphaned records
    const userIds = [...new Set(verifications.map((v) => v.userId))];
    const users = await this.prisma.user.findMany({
      where: { id: { in: userIds } },
      select: { id: true, firstName: true, lastName: true, email: true },
    });
    const userMap = new Map(users.map((u) => [u.id, u]));

    return verifications
      .filter((v) => userMap.has(v.userId))
      .map(({ userId, ...rest }) => ({
        ...rest,
        user: userMap.get(userId)!,
      }));
  }

  async adminListVehicles(
    statuses: Array<'PENDING' | 'VERIFIED' | 'REJECTED'>,
  ) {
    const vehicles = await this.prisma.vehicle.findMany({
      where: { status: { in: statuses } },
      orderBy: { createdAt: 'asc' },
      select: {
        id: true,
        userId: true,
        vehicleType: true,
        make: true,
        model: true,
        year: true,
        color: true,
        licensePlate: true,
        capacity: true,
        status: true,
        photoFrontUrl: true,
        photoBackUrl: true,
        photoLeftUrl: true,
        photoRightUrl: true,
        vehicleLicenseUrl: true,
        adminNotes: true,
        reviewedBy: true,
        reviewedAt: true,
        createdAt: true,
      },
    });

    const userIds = [...new Set(vehicles.map((v) => v.userId))];
    const users = await this.prisma.user.findMany({
      where: { id: { in: userIds } },
      select: { id: true, firstName: true, lastName: true, email: true },
    });
    const userMap = new Map(users.map((u) => [u.id, u]));

    return vehicles
      .filter((v) => userMap.has(v.userId))
      .map(({ userId, ...rest }) => ({
        ...rest,
        user: userMap.get(userId)!,
      }));
  }

  async adminReviewVehicle(
    vehicleId: string,
    adminId: string,
    decision: 'VERIFIED' | 'REJECTED',
    adminNotes?: string,
  ) {
    const vehicle = await this.prisma.vehicle.findUnique({
      where: { id: vehicleId },
    });
    if (!vehicle) throw new NotFoundException('Vehicle not found');

    return this.prisma.vehicle.update({
      where: { id: vehicleId },
      data: {
        status: decision,
        adminNotes: adminNotes || undefined,
        reviewedBy: adminId,
        reviewedAt: new Date(),
      },
    });
  }

  async adminGetVehicle(vehicleId: string) {
    const vehicle = await this.prisma.vehicle.findUnique({
      where: { id: vehicleId },
    });
    if (!vehicle) throw new NotFoundException('Vehicle not found');

    const user = await this.prisma.user.findUnique({
      where: { id: vehicle.userId },
      select: {
        id: true,
        firstName: true,
        lastName: true,
        email: true,
        phone: true,
      },
    });

    return { ...vehicle, user };
  }

  async adminGetVerification(verificationId: string) {
    const verification = await this.prisma.idVerification.findUnique({
      where: { id: verificationId },
      select: {
        id: true,
        status: true,
        verificationType: true,
        createdAt: true,
        updatedAt: true,
        documentFrontUrl: true,
        documentBackUrl: true,
        selfieUrl: true,
        certifications: true,
        cvDocuments: true,
        documentNumber: true,
        documentCountry: true,
        documentExpiry: true,
        documentStatuses: true,
        confidence: true,
        faceMatch: true,
        livenessCheck: true,
        extractedData: true,
        extractedBy: true,
        extractedAt: true,
        userId: true,
        user: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            email: true,
            phone: true,
            avatar: true,
            role: true,
            country: true,
            isIdVerified: true,
            idVerificationStatus: true,
          },
        },
      },
    });
    if (!verification) throw new NotFoundException('Verification not found');

    // Get all verifications for this user (including driver's license)
    const allVerifications = await this.prisma.idVerification.findMany({
      where: { userId: verification.userId },
      select: {
        id: true,
        verificationType: true,
        status: true,
        documentFrontUrl: true,
        documentBackUrl: true,
        selfieUrl: true,
        documentStatuses: true,
        createdAt: true,
      },
      orderBy: { createdAt: 'desc' },
    });

    // Get background check for this user
    const backgroundCheck = await this.prisma.backgroundCheck.findFirst({
      where: { userId: verification.userId },
      select: {
        id: true,
        status: true,
        uploadedDocument: true,
        certificateNumber: true,
        submittedAt: true,
        createdAt: true,
      },
      orderBy: { createdAt: 'desc' },
    });

    // Get vehicles for this user
    const vehicles = await this.prisma.vehicle.findMany({
      where: { userId: verification.userId },
      orderBy: { createdAt: 'desc' },
    });

    return {
      ...verification,
      allVerifications,
      backgroundCheck: backgroundCheck || undefined,
      vehicles,
    };
  }

  async saveExtractedData(
    verificationId: string,
    adminId: string,
    extractedData: {
      legalFirstName?: string;
      legalLastName?: string;
      dateOfBirth?: string;
      gender?: string;
      nationality?: string;
      placeOfBirth?: string;
      documentNumber?: string;
      documentType?: string;
      issueDate?: string;
      expiryDate?: string;
      issuingCountry?: string;
      issuingAuthority?: string;
      bsnNumber?: string;
      address?: string;
      mrzLine1?: string;
      mrzLine2?: string;
      photoMatchConfirmed?: boolean;
      workAuthorization?: string;
      adminNotes?: string;
      isEuCitizen?: boolean;
      citizenshipCountry?: string;
    },
  ) {
    const kyc = await this.prisma.idVerification.findUnique({
      where: { id: verificationId },
    });
    if (!kyc) throw new NotFoundException('Verification not found');

    // Sync documentExpiry and documentCountry from extracted data
    const syncData: Record<string, unknown> = {
      extractedData: extractedData as any,
      extractedBy: adminId,
      extractedAt: new Date(),
    };

    if (extractedData.expiryDate) {
      const exp = new Date(extractedData.expiryDate);
      if (!isNaN(exp.getTime())) {
        syncData.documentExpiry = exp;
      }
    }
    if (extractedData.issuingCountry) {
      syncData.documentCountry = extractedData.issuingCountry;
    }

    // If new expiry date is set and is in the future, clear any existing restriction
    if (extractedData.expiryDate) {
      const exp = new Date(extractedData.expiryDate);
      if (!isNaN(exp.getTime()) && exp > new Date()) {
        syncData.documentExpiryNotifiedAt = null;
        syncData.documentExpiryRestricted = false;

        // Also clear the restriction on the user's idVerificationData if it was set
        const user = await this.prisma.user.findUnique({
          where: { id: kyc.userId },
          select: { idVerificationData: true },
        });
        const verificationData = (user?.idVerificationData as any) || {};
        if (
          verificationData?.restricted &&
          verificationData?.restrictions?.documentExpired
        ) {
          const { documentExpired, ...restRestrictions } =
            verificationData.restrictions;
          const hasOtherRestrictions = Object.values(restRestrictions).some(
            (v) => v === false,
          );
          await this.prisma.user.update({
            where: { id: kyc.userId },
            data: {
              idVerificationData: hasOtherRestrictions
                ? { ...verificationData, restrictions: restRestrictions }
                : {},
            },
          });
        }
      }
    }

    const updated = await this.prisma.idVerification.update({
      where: { id: verificationId },
      data: syncData,
      select: {
        id: true,
        extractedData: true,
        extractedBy: true,
        extractedAt: true,
      },
    });

    return { ...updated, message: 'Document data saved successfully' };
  }

  async adminReview(
    verificationId: string,
    adminId: string,
    data: {
      decision: 'VERIFIED' | 'FAILED';
      notes?: string;
      confidence?: number;
    },
  ) {
    const kyc = await this.prisma.idVerification.findUnique({
      where: { id: verificationId },
    });
    if (!kyc) throw new NotFoundException('Verification not found');
    if (!['MANUAL_REVIEW', 'IN_PROGRESS', 'PENDING'].includes(kyc.status)) {
      throw new BadRequestException(
        'Only pending/in-progress/manual-review can be reviewed',
      );
    }
    const verified = data.decision === 'VERIFIED';
    const updated = await this.prisma.idVerification.update({
      where: { id: verificationId },
      data: {
        status: verified ? 'VERIFIED' : 'FAILED',
        confidence: data.confidence ?? null,
      } as unknown as { status: any; confidence?: number | null },
      select: { id: true, status: true },
    });
    await this.prisma.user.update({
      where: { id: kyc.userId },
      data: {
        isIdVerified: verified,
        // Cast limited to this assignment to satisfy current Prisma enum typing
        idVerificationStatus: updated.status as unknown as
          | 'PENDING'
          | 'IN_PROGRESS'
          | 'VERIFIED'
          | 'FAILED'
          | 'EXPIRED'
          | 'MANUAL_REVIEW',
      },
    });
    return {
      id: updated.id,
      status: updated.status,
      message: verified ? 'ID verified' : 'ID failed',
    };
  }

  async requestAdditionalDocuments(
    verificationId: string,
    adminId: string,
    data: {
      requestedDocument: string;
      reason: string;
    },
  ) {
    const verification = await this.prisma.idVerification.findUnique({
      where: { id: verificationId },
      include: { user: true },
    });
    if (!verification) throw new NotFoundException('Verification not found');

    const user = verification.user;
    if (!user) throw new NotFoundException('User not found');

    // Send email notification with branded template
    const t = await this.emailTranslations.getTranslatorForUser(user.id);
    const emailSubject = t('email.kyc.additionalDocumentsRequiredSubject');
    const emailHtml = await this.notifications.getDocumentRequestHtml(
      user.firstName || t('email.common.there'),
      data.requestedDocument,
      data.reason,
      user.id,
    );

    await this.notifications.sendEmail(
      user.email,
      emailSubject,
      `Additional Documents Required: ${data.requestedDocument}. Reason: ${data.reason}. Please log in to upload.`,
      emailHtml,
    );

    // Send push notification
    await this.notifications.sendPushNotification(
      user.id,
      t('notifications.templates.kycAdditionalDocsTitle'),
      t('notifications.templates.kycAdditionalDocsBody', {
        document: data.requestedDocument,
      }),
      {
        type: 'KYC_ADDITIONAL_DOCUMENTS',
        verificationId,
        requestedDocument: data.requestedDocument,
        reason: data.reason,
      },
    );

    // Create in-app notification
    await this.notifications.createNotification({
      userId: user.id,
      type: 'SYSTEM',
      title: t('notifications.templates.kycAdditionalDocsTitle'),
      body: t('notifications.templates.kycAdditionalDocsBody', {
        document: data.requestedDocument,
      }),
      payload: {
        type: 'KYC_ADDITIONAL_DOCUMENTS',
        verificationId,
        requestedDocument: data.requestedDocument,
        reason: data.reason,
      },
    });

    return {
      message: 'Additional documents request sent successfully',
      verificationId,
    };
  }

  async reviewDocument(
    verificationId: string,
    documentType: string,
    adminId: string,
    data: {
      decision: 'APPROVED' | 'REJECTED';
      notes?: string;
    },
  ) {
    const verification = await this.prisma.idVerification.findUnique({
      where: { id: verificationId },
      include: { user: true },
    });
    if (!verification) throw new NotFoundException('Verification not found');

    const validDocumentTypes = ['documentFront', 'documentBack', 'selfie'];
    const isCertification = documentType.startsWith('certification-');
    const isCv = documentType.startsWith('cv-');

    if (
      !validDocumentTypes.includes(documentType) &&
      !isCertification &&
      !isCv
    ) {
      throw new BadRequestException(
        `Invalid document type. Must be one of: ${validDocumentTypes.join(', ')}, certification-{index}, or cv-{index}`,
      );
    }

    // Get current document statuses or initialize
    const currentStatuses =
      (verification.documentStatuses as Record<string, string>) || {};

    // Handle certifications and CV documents
    if (isCertification) {
      const index = parseInt(documentType.split('-')[1]);
      const certifications = (verification.certifications as any[]) || [];
      if (index >= 0 && index < certifications.length) {
        certifications[index].status = data.decision;
        const certStatuses = Array.isArray(currentStatuses.certifications)
          ? (currentStatuses.certifications as string[])
          : [];
        certStatuses[index] = data.decision;
        currentStatuses.certifications = certStatuses as any;
      } else {
        throw new BadRequestException('Invalid certification index');
      }
    } else if (isCv) {
      const index = parseInt(documentType.split('-')[1]);
      const cvDocuments = (verification.cvDocuments as any[]) || [];
      if (index >= 0 && index < cvDocuments.length) {
        cvDocuments[index].status = data.decision;
        const cvStatuses = Array.isArray(currentStatuses.cvDocuments)
          ? (currentStatuses.cvDocuments as string[])
          : [];
        cvStatuses[index] = data.decision;
        currentStatuses.cvDocuments = cvStatuses as any;
      } else {
        throw new BadRequestException('Invalid CV index');
      }
    } else {
      currentStatuses[documentType] = data.decision;
    }

    // Update verification with new document status
    const updateData: any = {
      documentStatuses: currentStatuses,
    };

    if (isCertification) {
      updateData.certifications = verification.certifications as any[];
    } else if (isCv) {
      updateData.cvDocuments = verification.cvDocuments as any[];
    }

    await this.prisma.idVerification.update({
      where: { id: verificationId },
      data: updateData,
    });

    // Send notification to user
    const user = verification.user;
    if (user) {
      let documentName: string;
      if (isCertification) {
        const index = parseInt(documentType.split('-')[1]);
        documentName = `Certification ${index + 1}`;
      } else if (isCv) {
        const index = parseInt(documentType.split('-')[1]);
        documentName = `CV ${index + 1}`;
      } else {
        documentName =
          documentType === 'documentFront'
            ? 'Front of ID'
            : documentType === 'documentBack'
              ? 'Back of ID'
              : 'Selfie';
      }

      // Send email notification
      const t = await this.emailTranslations.getTranslatorForUser(user.id);
      const language = await this.emailTranslations.getUserLanguage(user.id);
      const normalizedLang = language?.toLowerCase().startsWith('pt')
        ? 'pt'
        : 'en';

      const emailSubject =
        data.decision === 'APPROVED'
          ? t('email.kyc.documentApprovedSubject', { documentName })
          : t('email.kyc.documentRejectedSubject', { documentName });

      const emailContent =
        data.decision === 'APPROVED'
          ? `<p style="color: #D4A853; font-size: 15px; line-height: 1.6; margin-bottom: 20px;">${t('email.kyc.documentApprovedMessage', { documentName })}</p>
           <div style="background-color: rgba(16, 185, 129, 0.08); padding: 20px; border-radius: 8px; border-left: 4px solid #22c55e; margin: 20px 0;">
             <p style="margin: 0; color: #34d399; font-size: 16px; font-weight: 600;">✓ ${t('email.kyc.documentStatusApproved')}</p>
           </div>
           <p style="color: #D4A853; font-size: 14px; line-height: 1.6; margin-top: 20px;">${t('email.kyc.verificationProgressing')}</p>`
          : `<p style="color: #D4A853; font-size: 15px; line-height: 1.6; margin-bottom: 20px;">${t('email.kyc.documentRejectedMessage', { documentName })}</p>
           <div style="background-color: rgba(239, 68, 68, 0.08); padding: 20px; border-radius: 8px; border-left: 4px solid #ef4444; margin: 20px 0;">
             <p style="margin: 0; color: #f87171; font-size: 16px; font-weight: 600;">✗ ${t('email.kyc.documentStatusRejected')}</p>
           </div>
           <p style="color: #D4A853; font-size: 14px; line-height: 1.6; margin-top: 20px;">${t('email.kyc.uploadNewDocument')}</p>`;

      const emailHtml = this.notifications.getBrandedEmailTemplate(
        emailSubject,
        t('email.kyc.documentReviewGreeting', {
          firstName: user.firstName || t('email.common.there'),
        }),
        emailContent,
        t('email.common.supportMessage'),
        t,
        normalizedLang,
      );

      const emailText =
        data.decision === 'APPROVED'
          ? t('email.kyc.documentApprovedText', { documentName })
          : t('email.kyc.documentRejectedText', { documentName });

      await this.notifications.sendEmail(
        user.email,
        emailSubject,
        emailText,
        emailHtml,
      );

      // Send in-app notification
      await this.notifications.createNotification({
        userId: user.id,
        type: 'SYSTEM',
        title:
          data.decision === 'APPROVED'
            ? t('email.kyc.documentApprovedNotificationTitle')
            : t('email.kyc.documentRejectedNotificationTitle'),
        body: t('email.kyc.documentStatusNotificationBody', {
          documentName,
          decision: data.decision.toLowerCase(),
        }),
        payload: {
          type: 'KYC_DOCUMENT_REVIEW',
          verificationId,
          documentType,
          decision: data.decision,
        },
      });
    }

    return {
      message: `Document ${data.decision.toLowerCase()} successfully`,
      verificationId,
      documentType,
      decision: data.decision,
    };
  }

  async requestDocument(
    verificationId: string,
    documentType: string,
    adminId: string,
    data: {
      reason: string;
    },
  ) {
    const verification = await this.prisma.idVerification.findUnique({
      where: { id: verificationId },
      include: { user: true },
    });
    if (!verification) throw new NotFoundException('Verification not found');

    const validDocumentTypes = ['documentFront', 'documentBack', 'selfie'];
    const isCertification = documentType.startsWith('certification-');
    const isCv = documentType.startsWith('cv-');

    if (
      !validDocumentTypes.includes(documentType) &&
      !isCertification &&
      !isCv
    ) {
      throw new BadRequestException(
        `Invalid document type. Must be one of: ${validDocumentTypes.join(', ')}, certification-{index}, or cv-{index}`,
      );
    }

    const user = verification.user;
    if (!user) throw new NotFoundException('User not found');

    let documentName: string;
    if (isCertification) {
      const index = parseInt(documentType.split('-')[1]);
      documentName = `Certification ${index + 1}`;
    } else if (isCv) {
      const index = parseInt(documentType.split('-')[1]);
      documentName = `CV ${index + 1}`;
    } else {
      documentName =
        documentType === 'documentFront'
          ? 'Front of ID'
          : documentType === 'documentBack'
            ? 'Back of ID'
            : 'Selfie';
    }

    // Send email notification with branded template
    const t = await this.emailTranslations.getTranslatorForUser(user.id);
    const emailSubject = t('email.kyc.documentRequiredSubject', {
      documentName,
    });
    const emailHtml = await this.notifications.getDocumentRequestHtml(
      user.firstName || t('email.common.there'),
      documentName,
      data.reason,
      user.id,
    );

    await this.notifications.sendEmail(
      user.email,
      emailSubject,
      t('email.kyc.documentRequiredText', {
        documentName,
        reason: data.reason,
      }),
      emailHtml,
    );

    // Send push notification
    await this.notifications.sendPushNotification(
      user.id,
      t('email.kyc.documentRequiredTitle'),
      t('email.kyc.documentRequiredBody', { documentName }),
      {
        type: 'KYC_DOCUMENT_REQUEST',
        verificationId,
        documentType,
        reason: data.reason,
      },
    );

    // Create in-app notification
    await this.notifications.createNotification({
      userId: user.id,
      type: 'SYSTEM',
      title: t('email.kyc.documentRequiredTitle'),
      body: t('email.kyc.documentRequiredBody', { documentName }),
      payload: {
        type: 'KYC_DOCUMENT_REQUEST',
        verificationId,
        documentType,
        reason: data.reason,
      },
    });

    return {
      message: 'Document request sent successfully',
      verificationId,
      documentType,
    };
  }
}
