import { Injectable, BadRequestException } from '@nestjs/common';
import { vehicleUploadConfig } from './config/file-upload.config';
import * as fs from 'fs';
import * as path from 'path';

export type VehicleFileKind =
  | 'front'
  | 'back'
  | 'left'
  | 'right'
  | 'vehicle-license';

@Injectable()
export class VehicleFileUploadService {
  constructor() {
    this.ensureUploadDirectoryExists();
  }

  private ensureUploadDirectoryExists() {
    const uploadDir = path.resolve(vehicleUploadConfig.uploadPath);
    if (!fs.existsSync(uploadDir)) {
      fs.mkdirSync(uploadDir, { recursive: true });
    }
  }

  validateFile(file: Express.Multer.File, kind: VehicleFileKind) {
    if (file.size > vehicleUploadConfig.maxFileSize) {
      throw new BadRequestException(
        `File too large. Maximum size is ${vehicleUploadConfig.maxFileSize / (1024 * 1024)}MB`,
      );
    }
    if (!vehicleUploadConfig.allowedMimeTypes.includes(file.mimetype)) {
      throw new BadRequestException(
        `Invalid file type for ${kind}. Allowed: JPEG, PNG, PDF`,
      );
    }
    const fileExtension = path.extname(file.originalname).toLowerCase();
    if (!vehicleUploadConfig.allowedExtensions.includes(fileExtension)) {
      throw new BadRequestException(
        `Invalid file extension for ${kind}. Allowed: ${vehicleUploadConfig.allowedExtensions.join(', ')}`,
      );
    }
  }

  async saveFile(file: Express.Multer.File, kind: VehicleFileKind) {
    this.validateFile(file, kind);
    const secureFileName = vehicleUploadConfig.generateFileName(
      kind,
      file.originalname,
    );
    const filePath = path.join(vehicleUploadConfig.uploadPath, secureFileName);
    try {
      await fs.promises.writeFile(filePath, file.buffer);
      return `uploads/vehicles/${secureFileName}`;
    } catch {
      throw new BadRequestException('Failed to save file');
    }
  }
}
