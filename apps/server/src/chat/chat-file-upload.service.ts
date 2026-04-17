import { Injectable, BadRequestException, Logger } from '@nestjs/common';
import * as fs from 'fs';
import * as path from 'path';
import { v2 as cloudinary } from 'cloudinary';
import { chatUploadConfig } from './config/file-upload.config';

@Injectable()
export class ChatFileUploadService {
  private readonly logger = new Logger(ChatFileUploadService.name);
  private readonly useCloudinary: boolean;

  constructor() {
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
      this.logger.log('Cloudinary configured for chat file uploads');
    } else {
      this.logger.warn(
        'Cloudinary not configured – falling back to local disk for chat uploads.',
      );
      this.ensureUploadDirectoryExists();
    }
  }

  private ensureUploadDirectoryExists() {
    const uploadDir = path.resolve(chatUploadConfig.uploadPath);
    if (!fs.existsSync(uploadDir)) {
      fs.mkdirSync(uploadDir, { recursive: true });
    }
  }

  validateFile(file: Express.Multer.File, type: 'image' | 'document') {
    if (file.size > chatUploadConfig.maxFileSize) {
      throw new BadRequestException(
        `File too large. Maximum size is ${chatUploadConfig.maxFileSize / (1024 * 1024)}MB`,
      );
    }

    if (type === 'image') {
      const imageTypes = ['image/jpeg', 'image/png', 'image/gif', 'image/webp'];
      if (!imageTypes.includes(file.mimetype)) {
        throw new BadRequestException(
          'Invalid file type. Allowed: JPEG, PNG, GIF, WEBP',
        );
      }
    } else {
      if (!chatUploadConfig.allowedMimeTypes.includes(file.mimetype)) {
        throw new BadRequestException(
          'Invalid file type. Allowed: PDF, DOC, DOCX, XLS, XLSX, TXT, Images',
        );
      }
    }
  }

  async saveFile(
    file: Express.Multer.File,
    type: 'image' | 'document',
  ): Promise<string> {
    this.validateFile(file, type);

    if (this.useCloudinary) {
      return this.uploadToCloudinary(file, type);
    }
    return this.saveToLocalDisk(file, type);
  }

  private async uploadToCloudinary(
    file: Express.Multer.File,
    type: 'image' | 'document',
  ): Promise<string> {
    return new Promise((resolve, reject) => {
      const resourceType = type === 'image' ? 'image' : 'raw';
      const uploadStream = cloudinary.uploader.upload_stream(
        {
          folder: 'nasta/chat',
          resource_type: resourceType,
          ...(type === 'image'
            ? {
                transformation: [{ quality: 'auto', fetch_format: 'auto' }],
              }
            : {}),
        },
        (error, result) => {
          if (error || !result) {
            this.logger.error('Cloudinary chat upload failed', error);
            reject(new BadRequestException('Failed to upload file'));
            return;
          }
          resolve(result.secure_url);
        },
      );
      uploadStream.end(file.buffer);
    });
  }

  private async saveToLocalDisk(
    file: Express.Multer.File,
    type: 'image' | 'document',
  ): Promise<string> {
    const filename = chatUploadConfig.generateFileName(file.originalname, type);
    const filePath = path.join(chatUploadConfig.uploadPath, filename);
    try {
      await fs.promises.writeFile(filePath, file.buffer);
      return `uploads/chat/${filename}`;
    } catch {
      throw new BadRequestException('Failed to save file');
    }
  }
}
