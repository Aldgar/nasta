import { Injectable, BadRequestException } from '@nestjs/common';
import * as fs from 'fs';
import * as path from 'path';
import { chatUploadConfig } from './config/file-upload.config';

@Injectable()
export class ChatFileUploadService {
  constructor() {
    this.ensureUploadDirectoryExists();
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
      const imageTypes = [
        'image/jpeg',
        'image/png',
        'image/gif',
        'image/webp',
      ];
      if (!imageTypes.includes(file.mimetype)) {
        throw new BadRequestException(
          'Invalid file type. Allowed: JPEG, PNG, GIF, WEBP',
        );
      }
    } else {
      // For documents, allow all configured types
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

