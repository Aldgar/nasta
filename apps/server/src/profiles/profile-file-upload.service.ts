import { Injectable, BadRequestException, Logger } from '@nestjs/common';
import * as fs from 'fs';
import * as path from 'path';
import { v2 as cloudinary } from 'cloudinary';
import { profileUploadConfig } from './config/file-upload.config';

@Injectable()
export class ProfileFileUploadService {
  private readonly logger = new Logger(ProfileFileUploadService.name);
  private readonly useCloudinary: boolean;

  constructor() {
    // If Cloudinary env vars are set, use Cloudinary; otherwise fall back to local disk
    const cloudName = process.env.CLOUDINARY_CLOUD_NAME;
    const apiKey = process.env.CLOUDINARY_API_KEY;
    const apiSecret = process.env.CLOUDINARY_API_SECRET;

    this.useCloudinary = !!(cloudName && apiKey && apiSecret);

    if (this.useCloudinary) {
      cloudinary.config({
        cloud_name: cloudName,
        api_key: apiKey,
        api_secret: apiSecret,
        secure: true,
      });
      this.logger.log('Cloudinary configured for profile photo uploads');
    } else {
      this.logger.warn(
        'Cloudinary not configured – falling back to local disk storage. ' +
          'Set CLOUDINARY_CLOUD_NAME, CLOUDINARY_API_KEY, CLOUDINARY_API_SECRET for persistent storage.',
      );
      this.ensureUploadDirectoryExists();
    }
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

  async saveAvatar(file: Express.Multer.File): Promise<string> {
    this.validateFile(file);

    if (this.useCloudinary) {
      return this.uploadToCloudinary(file);
    }
    return this.saveToLocalDisk(file);
  }

  private async uploadToCloudinary(file: Express.Multer.File): Promise<string> {
    return new Promise((resolve, reject) => {
      const uploadStream = cloudinary.uploader.upload_stream(
        {
          folder: 'nasta/profiles',
          resource_type: 'image',
          transformation: [
            { width: 500, height: 500, crop: 'fill', gravity: 'face' },
            { quality: 'auto', fetch_format: 'auto' },
          ],
        },
        (error, result) => {
          if (error || !result) {
            this.logger.error('Cloudinary upload failed', error);
            reject(
              new BadRequestException('Failed to upload profile image'),
            );
            return;
          }
          // Return the absolute Cloudinary URL – works on every platform
          resolve(result.secure_url);
        },
      );
      uploadStream.end(file.buffer);
    });
  }

  private async saveToLocalDisk(file: Express.Multer.File): Promise<string> {
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
