import { Injectable, BadRequestException } from '@nestjs/common';
import { kycUploadConfig } from './config/file-upload.config';
import * as fs from 'fs';
import * as path from 'path';

@Injectable()
export class KycFileUploadService {
  constructor() {
    this.ensureUploadDirectoryExists();
  }

  private ensureUploadDirectoryExists() {
    const uploadDir = path.resolve(kycUploadConfig.uploadPath);
    if (!fs.existsSync(uploadDir)) {
      fs.mkdirSync(uploadDir, { recursive: true });
    }
  }

  validateFile(file: Express.Multer.File, kind: 'front' | 'back' | 'selfie' | 'certification' | 'cv') {
    if (file.size > kycUploadConfig.maxFileSize) {
      throw new BadRequestException(
        `File too large. Maximum size is ${kycUploadConfig.maxFileSize / (1024 * 1024)}MB`,
      );
    }

    if (!kycUploadConfig.allowedMimeTypes.includes(file.mimetype)) {
      throw new BadRequestException(
        `Invalid file type for ${kind}. Allowed: JPEG, PNG, PDF`,
      );
    }

    const fileExtension = path.extname(file.originalname).toLowerCase();
    if (!kycUploadConfig.allowedExtensions.includes(fileExtension)) {
      throw new BadRequestException(
        `Invalid file extension for ${kind}. Allowed: ${kycUploadConfig.allowedExtensions.join(', ')}`,
      );
    }
  }

  async saveFile(file: Express.Multer.File, kind: 'front' | 'back' | 'selfie' | 'certification' | 'cv') {
    this.validateFile(file, kind);
    const secureFileName = kycUploadConfig.generateFileName(
      kind,
      file.originalname,
    );
    const filePath = path.join(kycUploadConfig.uploadPath, secureFileName);
    try {
      await fs.promises.writeFile(filePath, file.buffer);
      return `uploads/kyc/${secureFileName}`;
    } catch {
      throw new BadRequestException('Failed to save file');
    }
  }
}
