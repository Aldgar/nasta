import * as path from 'path';

const baseUploads = process.env.UPLOADS_DIR || 'uploads';

export const fileUploadConfig = {
  // File size limit (10MB)
  maxFileSize: 10 * 1024 * 1024,

  // Allowed file types
  allowedMimeTypes: ['application/pdf'],

  // File extensions
  allowedExtensions: ['.pdf'],

  // Upload directory
  uploadPath: path.join(baseUploads, 'background-checks'),

  // File naming
  generateFileName: (originalName: string): string => {
    const timestamp = Date.now();
    const randomString = Math.random().toString(36).substring(7);
    const extension = originalName.split('.').pop();
    return `cert-${timestamp}-${randomString}.${extension}`;
  },
};
