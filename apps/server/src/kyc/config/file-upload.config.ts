export const kycUploadConfig = {
  // File size limit (10MB per file)
  maxFileSize: 10 * 1024 * 1024,

  // Allowed file types: images and PDFs (front/back can be image or PDF; selfie is image)
  allowedMimeTypes: ['image/jpeg', 'image/png', 'application/pdf'],

  // File extensions
  allowedExtensions: ['.jpg', '.jpeg', '.png', '.pdf'],

  // Upload directory (local storage for now)
  uploadPath: './uploads/kyc',

  // File naming
  generateFileName: (prefix: string, originalName: string): string => {
    const timestamp = Date.now();
    const randomString = Math.random().toString(36).substring(7);
    const extension = originalName.split('.').pop();
    return `${prefix}-${timestamp}-${randomString}.${extension}`;
  },
};
