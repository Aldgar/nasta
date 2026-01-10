import { Injectable, BadRequestException } from '@nestjs/common';
import * as fs from 'fs';
import * as path from 'path';
import { profileUploadConfig } from './config/file-upload.config';

@Injectable()
export class ProfileFileUploadService {
  constructor() {
    this.ensureUploadDirectoryExists();
  }

  private ensureUploadDirectoryExists() {
    const uploadDir = path.resolve(profileUploadConfig.uploadPath);
    if (!fs.existsSync(uploadDir)) {
      fs.mkdirSync(uploadDir, { recursive: true });
    }
  }

  validateFile(file: Express.Multer.File) {
    if (file.size > profileUploadConfig.maxFileSize) {
      throw new BadRequestException(
        `File too large. Maximum size is ${profileUploadConfig.maxFileSize / (1024 * 1024)}MB`,
      );
    }
    if (!profileUploadConfig.allowedMimeTypes.includes(file.mimetype)) {
      throw new BadRequestException(
        'Invalid file type. Allowed: JPEG, PNG, WEBP',
      );
    }
  }

  async saveAvatar(file: Express.Multer.File) {
    this.validateFile(file);
    const filename = profileUploadConfig.generateFileName(file.originalname);
    const filePath = path.join(profileUploadConfig.uploadPath, filename);
    try {
      await fs.promises.writeFile(filePath, file.buffer);
      return `uploads/profiles/${filename}`;
    } catch {
      throw new BadRequestException('Failed to save profile image');
    }
  }
}
