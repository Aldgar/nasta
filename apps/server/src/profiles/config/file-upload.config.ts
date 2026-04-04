import * as path from 'path';

const baseUploads = process.env.UPLOADS_DIR || 'uploads';

export const profileUploadConfig = {
  uploadPath: path.join(baseUploads, 'profiles'),
  maxFileSize: 5 * 1024 * 1024, // 5MB
  allowedMimeTypes: ['image/jpeg', 'image/png', 'image/webp'],
  allowedExtensions: ['.jpg', '.jpeg', '.png', '.webp'],
  generateFileName(original: string) {
    const ext = original.includes('.') ? original.split('.').pop() : 'jpg';
    const stamp = Date.now();
    const rand = Math.random().toString(16).slice(2, 10);
    return `avatar_${stamp}_${rand}.${ext}`;
  },
};
