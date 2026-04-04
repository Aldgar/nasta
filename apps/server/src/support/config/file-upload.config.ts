import * as path from 'path';

const baseUploads = process.env.UPLOADS_DIR || 'uploads';

export const supportUploadConfig = {
  uploadPath: path.join(baseUploads, 'support'),
  maxFileSize: 10 * 1024 * 1024, // 10MB
  maxFiles: 5,
  allowedMimeTypes: [
    'image/jpeg',
    'image/png',
    'image/gif',
    'image/webp',
    'application/pdf',
    'application/msword',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'application/vnd.ms-excel',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    'text/plain',
  ],
  generateFileName(original: string) {
    const ext = original.includes('.') ? original.split('.').pop() : 'bin';
    const stamp = Date.now();
    const rand = Math.random().toString(16).slice(2, 10);
    return `att_${stamp}_${rand}.${ext}`;
  },
};
