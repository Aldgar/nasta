import * as path from 'path';

const baseUploads = process.env.UPLOADS_DIR || 'uploads';

export const chatUploadConfig = {
  uploadPath: path.join(baseUploads, 'chat'),
  maxFileSize: 10 * 1024 * 1024, // 10MB
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
  allowedExtensions: [
    '.jpg',
    '.jpeg',
    '.png',
    '.gif',
    '.webp',
    '.pdf',
    '.doc',
    '.docx',
    '.xls',
    '.xlsx',
    '.txt',
  ],
  generateFileName(original: string, type: 'image' | 'document') {
    const ext = original.includes('.')
      ? original.split('.').pop()
      : type === 'image'
        ? 'jpg'
        : 'pdf';
    const stamp = Date.now();
    const rand = Math.random().toString(16).slice(2, 10);
    const prefix = type === 'image' ? 'img' : 'doc';
    return `${prefix}_${stamp}_${rand}.${ext}`;
  },
};

