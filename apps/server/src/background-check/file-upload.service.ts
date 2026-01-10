import { Injectable, BadRequestException } from '@nestjs/common';
import { fileUploadConfig } from './config/file-upload.config';
import * as fs from 'fs';
import * as path from 'path';

@Injectable()
export class FileUploadService {
  constructor() {
    // Create upload directory if it doesn't exist
    this.ensureUploadDirectoryExists();
  }

  private ensureUploadDirectoryExists() {
    const uploadDir = path.resolve(fileUploadConfig.uploadPath);
    if (!fs.existsSync(uploadDir)) {
      fs.mkdirSync(uploadDir, { recursive: true });
    }
  }

  validateFile(file: Express.Multer.File): void {
    // Check file size
    if (file.size > fileUploadConfig.maxFileSize) {
      throw new BadRequestException(
        `File too large. Maximum size is ${fileUploadConfig.maxFileSize / (1024 * 1024)}MB`,
      );
    }

    // Check MIME type
    if (!fileUploadConfig.allowedMimeTypes.includes(file.mimetype)) {
      throw new BadRequestException(
        `Invalid file type. Only PDF files are allowed.`,
      );
    }

    // Check file extension
    const fileExtension = path.extname(file.originalname).toLowerCase();
    if (!fileUploadConfig.allowedExtensions.includes(fileExtension)) {
      throw new BadRequestException(
        `Invalid file extension. Only .pdf files are allowed.`,
      );
    }
  }

  async saveFile(file: Express.Multer.File): Promise<string> {
    // Validate the file first
    this.validateFile(file);

    // Generate secure filename
    const secureFileName = fileUploadConfig.generateFileName(file.originalname);

    // Full file path
    const filePath = path.join(fileUploadConfig.uploadPath, secureFileName);

    try {
      // Save file to disk
      await fs.promises.writeFile(filePath, file.buffer);

      // Return the relative path for storing in database
      return `uploads/background-checks/${secureFileName}`;
    } catch {
      throw new BadRequestException('Failed to save file');
    }
  }

  async deleteFile(filePath: string): Promise<void> {
    try {
      const fullPath = path.resolve(filePath);
      if (fs.existsSync(fullPath)) {
        await fs.promises.unlink(fullPath);
      }
    } catch (error) {
      console.error('Failed to delete file:', error);
    }
  }

  getFileUrl(filePath: string): string {
    // For now, return local file path
    // Later we can modify this for cloud storage URLs
    return `http://localhost:3001/${filePath}`;
  }
}
