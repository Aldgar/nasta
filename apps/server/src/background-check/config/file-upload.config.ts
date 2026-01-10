export const fileUploadConfig = {
  // File size limit (10MB)
  maxFileSize: 10 * 1024 * 1024,

  // Allowed file types
  allowedMimeTypes: ['application/pdf'],

  // File extensions
  allowedExtensions: ['.pdf'],

  // Upload directory (we'll use local storage for now)
  uploadPath: './uploads/background-checks',

  // File naming
  generateFileName: (originalName: string): string => {
    const timestamp = Date.now();
    const randomString = Math.random().toString(36).substring(7);
    const extension = originalName.split('.').pop();
    return `cert-${timestamp}-${randomString}.${extension}`;
  },
};
