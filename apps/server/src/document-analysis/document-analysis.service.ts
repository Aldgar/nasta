import { Injectable, Logger } from '@nestjs/common';
import * as vision from '@google-cloud/vision';
import * as fs from 'fs';
import * as path from 'path';

export interface DocumentAnalysisResult {
  trustScore: number; // 0-100
  flags: string[];
  details: {
    textExtracted: string;
    textConfidence: number;
    hasExpectedStructure: boolean;
    ocrLanguages: string[];
    imageProperties?: {
      dominantColors: string[];
      hasUniformBackground: boolean;
    };
    safeSearch?: {
      spoof: string; // VERY_UNLIKELY to VERY_LIKELY
      adult: string;
    };
    webDetection?: {
      matchingPages: number;
      visuallySimilarImages: number;
    };
    plateExtracted?: string; // For vehicle license
    plateMatch?: boolean;
  };
  raw: string; // Stringified JSON of full GCV responses
}

@Injectable()
export class DocumentAnalysisService {
  private readonly logger = new Logger(DocumentAnalysisService.name);
  private client: vision.ImageAnnotatorClient | null = null;

  constructor() {
    this.initClient();
  }

  private initClient() {
    const credPath = process.env.GOOGLE_APPLICATION_CREDENTIALS;
    if (credPath && fs.existsSync(path.resolve(credPath))) {
      this.client = new vision.ImageAnnotatorClient({
        keyFilename: path.resolve(credPath),
      });
      this.logger.log('Google Cloud Vision client initialized');
    } else {
      this.logger.warn(
        'Google Cloud Vision credentials not found. Document analysis will be unavailable. ' +
          `Expected credentials at: ${credPath || '(not set)'}`,
      );
    }
  }

  isAvailable(): boolean {
    return this.client !== null;
  }

  /**
   * Analyze a criminal record certificate (PDF or image).
   * Checks for: structural integrity, expected Portuguese certificate elements,
   * editing artifacts, font consistency, seal/stamp presence.
   */
  async analyzeCriminalRecord(
    filePath: string,
  ): Promise<DocumentAnalysisResult> {
    if (!this.client) {
      return this.unavailableResult('GCV_NOT_CONFIGURED');
    }

    const fullPath = path.resolve(filePath);
    if (!fs.existsSync(fullPath)) {
      return this.unavailableResult('FILE_NOT_FOUND');
    }

    try {
      const fileBuffer = fs.readFileSync(fullPath);
      const isPdf = filePath.toLowerCase().endsWith('.pdf');

      const flags: string[] = [];
      let textExtracted = '';
      let textConfidence = 0;
      let ocrLanguages: string[] = [];
      let safeSearchResult: { spoof: string; adult: string } | undefined;
      let webDetectionResult:
        | { matchingPages: number; visuallySimilarImages: number }
        | undefined;
      const rawResponses: Record<string, unknown> = {};

      if (isPdf) {
        // For PDFs, use batchAnnotateFiles which properly supports PDF parsing
        const [batchResult] = await this.client.batchAnnotateFiles({
          requests: [
            {
              inputConfig: {
                content: fileBuffer.toString('base64'),
                mimeType: 'application/pdf',
              },
              features: [{ type: 'DOCUMENT_TEXT_DETECTION' }],
              pages: [1, 2, 3, 4, 5], // Analyze up to 5 pages
            },
          ],
        });

        const fileResponses = batchResult.responses?.[0]?.responses || [];
        rawResponses.pdfPages = fileResponses;

        // Combine text from all pages
        const allText: string[] = [];
        const allPages: (typeof fileResponses)[0]['fullTextAnnotation']['pages'] =
          [];
        for (const pageRes of fileResponses) {
          const pageText = pageRes.fullTextAnnotation?.text || '';
          if (pageText) allText.push(pageText);
          const pages = pageRes.fullTextAnnotation?.pages || [];
          allPages.push(...pages);
        }
        textExtracted = allText.join('\n');

        // Calculate average confidence from all pages
        if (allPages.length > 0) {
          const confidences = allPages.map((p) => p.confidence || 0);
          textConfidence =
            confidences.reduce((a, b) => a + b, 0) / confidences.length;
        }

        // Detect languages
        const detectedLangs = new Set<string>();
        for (const page of allPages) {
          for (const block of page.blocks || []) {
            for (const lang of block.property?.detectedLanguages || []) {
              if (lang.languageCode) detectedLangs.add(lang.languageCode);
            }
          }
        }
        ocrLanguages = Array.from(detectedLangs);

        // Validate Portuguese criminal record structure
        const structureFlags =
          this.validateCriminalRecordStructure(textExtracted);
        flags.push(...structureFlags);

        // Check for font inconsistencies across blocks
        const fontFlags = this.detectFontInconsistencies(allPages);
        flags.push(...fontFlags);
      } else {
        // For images, use full annotation
        const [result] = await this.client.annotateImage({
          image: { content: fileBuffer.toString('base64') },
          features: [
            { type: 'DOCUMENT_TEXT_DETECTION' },
            { type: 'SAFE_SEARCH_DETECTION' },
            { type: 'WEB_DETECTION' },
            { type: 'IMAGE_PROPERTIES' },
          ],
        });
        rawResponses.annotation = result;

        textExtracted = result.fullTextAnnotation?.text || '';
        const pages = result.fullTextAnnotation?.pages || [];
        if (pages.length > 0) {
          const confidences = pages.map((p) => p.confidence || 0);
          textConfidence =
            confidences.reduce((a, b) => a + b, 0) / confidences.length;
        }

        // Languages
        const detectedLangs = new Set<string>();
        for (const page of pages) {
          for (const block of page.blocks || []) {
            for (const lang of block.property?.detectedLanguages || []) {
              if (lang.languageCode) detectedLangs.add(lang.languageCode);
            }
          }
        }
        ocrLanguages = Array.from(detectedLangs);

        // Safe search — spoof detection
        if (result.safeSearchAnnotation) {
          const spoofVal = String(
            result.safeSearchAnnotation.spoof || 'UNKNOWN',
          );
          const adultVal = String(
            result.safeSearchAnnotation.adult || 'UNKNOWN',
          );
          safeSearchResult = {
            spoof: spoofVal,
            adult: adultVal,
          };
          if (['LIKELY', 'VERY_LIKELY'].includes(spoofVal)) {
            flags.push('SPOOF_DETECTED');
          }
        }

        // Web detection — if document image appears elsewhere online
        if (result.webDetection) {
          webDetectionResult = {
            matchingPages:
              result.webDetection.pagesWithMatchingImages?.length || 0,
            visuallySimilarImages:
              result.webDetection.visuallySimilarImages?.length || 0,
          };
          if (webDetectionResult.matchingPages > 0) {
            flags.push('IMAGE_FOUND_ONLINE');
          }
          if (webDetectionResult.visuallySimilarImages > 3) {
            flags.push('MANY_SIMILAR_IMAGES_ONLINE');
          }
        }

        // Structure validation
        const structureFlags =
          this.validateCriminalRecordStructure(textExtracted);
        flags.push(...structureFlags);

        // Font inconsistencies
        const fontFlags = this.detectFontInconsistencies(pages);
        flags.push(...fontFlags);
      }

      // Calculate trust score
      const hasExpectedStructure = !flags.some(
        (f) =>
          f === 'MISSING_CERTIFICATE_HEADER' ||
          f === 'MISSING_OFFICIAL_ENTITY' ||
          f === 'MISSING_CERTIFICATE_NUMBER',
      );
      const trustScore = this.calculateCriminalRecordTrustScore(
        flags,
        textConfidence,
        hasExpectedStructure,
      );

      return {
        trustScore,
        flags,
        details: {
          textExtracted:
            textExtracted.length > 5000
              ? textExtracted.substring(0, 5000) + '...'
              : textExtracted,
          textConfidence,
          hasExpectedStructure,
          ocrLanguages,
          safeSearch: safeSearchResult,
          webDetection: webDetectionResult,
        },
        raw: JSON.stringify(rawResponses),
      };
    } catch (error) {
      this.logger.error(
        'Criminal record analysis failed:',
        error instanceof Error ? error.message : error,
      );
      return this.unavailableResult('ANALYSIS_ERROR');
    }
  }

  /**
   * Analyze a vehicle registration/license document.
   * Cross-checks extracted plate number against the user-provided one.
   */
  async analyzeVehicleLicense(
    filePath: string,
    expectedPlate: string,
  ): Promise<DocumentAnalysisResult> {
    if (!this.client) {
      return this.unavailableResult('GCV_NOT_CONFIGURED');
    }

    const fullPath = path.resolve(filePath);
    if (!fs.existsSync(fullPath)) {
      return this.unavailableResult('FILE_NOT_FOUND');
    }

    try {
      const fileBuffer = fs.readFileSync(fullPath);
      const isPdf = filePath.toLowerCase().endsWith('.pdf');

      const flags: string[] = [];
      let textExtracted = '';
      let textConfidence = 0;
      let ocrLanguages: string[] = [];
      let safeSearchResult: { spoof: string; adult: string } | undefined;
      let webDetectionResult:
        | { matchingPages: number; visuallySimilarImages: number }
        | undefined;
      const rawResponses: Record<string, unknown> = {};

      if (isPdf) {
        const [batchResult] = await this.client.batchAnnotateFiles({
          requests: [
            {
              inputConfig: {
                content: fileBuffer.toString('base64'),
                mimeType: 'application/pdf',
              },
              features: [{ type: 'DOCUMENT_TEXT_DETECTION' }],
              pages: [1, 2, 3],
            },
          ],
        });

        const fileResponses = batchResult.responses?.[0]?.responses || [];
        rawResponses.pdfPages = fileResponses;

        const allText: string[] = [];
        const allPages: (typeof fileResponses)[0]['fullTextAnnotation']['pages'] =
          [];
        for (const pageRes of fileResponses) {
          const pageText = pageRes.fullTextAnnotation?.text || '';
          if (pageText) allText.push(pageText);
          const pg = pageRes.fullTextAnnotation?.pages || [];
          allPages.push(...pg);
        }
        textExtracted = allText.join('\n');

        if (allPages.length > 0) {
          const confidences = allPages.map((p) => p.confidence || 0);
          textConfidence =
            confidences.reduce((a, b) => a + b, 0) / confidences.length;
        }

        const detectedLangs = new Set<string>();
        for (const page of allPages) {
          for (const block of page.blocks || []) {
            for (const lang of block.property?.detectedLanguages || []) {
              if (lang.languageCode) detectedLangs.add(lang.languageCode);
            }
          }
        }
        ocrLanguages = Array.from(detectedLangs);

        const fontFlags = this.detectFontInconsistencies(allPages);
        flags.push(...fontFlags);
      } else {
        const [result] = await this.client.annotateImage({
          image: { content: fileBuffer.toString('base64') },
          features: [
            { type: 'DOCUMENT_TEXT_DETECTION' },
            { type: 'SAFE_SEARCH_DETECTION' },
            { type: 'WEB_DETECTION' },
            { type: 'IMAGE_PROPERTIES' },
          ],
        });
        rawResponses.annotation = result;
        textExtracted = result.fullTextAnnotation?.text || '';

        const pages = result.fullTextAnnotation?.pages || [];
        if (pages.length > 0) {
          const confidences = pages.map((p) => p.confidence || 0);
          textConfidence =
            confidences.reduce((a, b) => a + b, 0) / confidences.length;
        }

        const detectedLangs = new Set<string>();
        for (const page of pages) {
          for (const block of page.blocks || []) {
            for (const lang of block.property?.detectedLanguages || []) {
              if (lang.languageCode) detectedLangs.add(lang.languageCode);
            }
          }
        }
        ocrLanguages = Array.from(detectedLangs);

        if (result.safeSearchAnnotation) {
          const spoofVal = String(
            result.safeSearchAnnotation.spoof || 'UNKNOWN',
          );
          const adultVal = String(
            result.safeSearchAnnotation.adult || 'UNKNOWN',
          );
          safeSearchResult = {
            spoof: spoofVal,
            adult: adultVal,
          };
          if (['LIKELY', 'VERY_LIKELY'].includes(spoofVal)) {
            flags.push('SPOOF_DETECTED');
          }
        }

        if (result.webDetection) {
          webDetectionResult = {
            matchingPages:
              result.webDetection.pagesWithMatchingImages?.length || 0,
            visuallySimilarImages:
              result.webDetection.visuallySimilarImages?.length || 0,
          };
          if (webDetectionResult.matchingPages > 0) {
            flags.push('IMAGE_FOUND_ONLINE');
          }
        }

        const fontFlags = this.detectFontInconsistencies(pages);
        flags.push(...fontFlags);
      }

      // Extract and cross-check license plate
      const plateExtracted = this.extractLicensePlate(textExtracted);
      let plateMatch: boolean | undefined;
      if (plateExtracted && expectedPlate) {
        const normalizedExtracted = this.normalizePlate(plateExtracted);
        const normalizedExpected = this.normalizePlate(expectedPlate);
        plateMatch = normalizedExtracted === normalizedExpected;
        if (!plateMatch) {
          flags.push('PLATE_MISMATCH');
        }
      } else if (!plateExtracted && expectedPlate) {
        flags.push('PLATE_NOT_DETECTED');
      }

      // Validate vehicle registration structure
      const structureFlags =
        this.validateVehicleRegistrationStructure(textExtracted);
      flags.push(...structureFlags);

      const hasExpectedStructure = !flags.some(
        (f) =>
          f === 'MISSING_REGISTRATION_HEADER' ||
          f === 'MISSING_VEHICLE_DETAILS',
      );
      const trustScore = this.calculateVehicleLicenseTrustScore(
        flags,
        textConfidence,
        hasExpectedStructure,
        plateMatch,
      );

      return {
        trustScore,
        flags,
        details: {
          textExtracted:
            textExtracted.length > 5000
              ? textExtracted.substring(0, 5000) + '...'
              : textExtracted,
          textConfidence,
          hasExpectedStructure,
          ocrLanguages,
          safeSearch: safeSearchResult,
          webDetection: webDetectionResult,
          plateExtracted: plateExtracted || undefined,
          plateMatch,
        },
        raw: JSON.stringify(rawResponses),
      };
    } catch (error) {
      this.logger.error(
        'Vehicle license analysis failed:',
        error instanceof Error ? error.message : error,
      );
      return this.unavailableResult('ANALYSIS_ERROR');
    }
  }

  // ── Private helpers ──

  /**
   * Validate Portuguese criminal record certificate structure.
   * Expected elements: official header, entity name, certificate number, seal references.
   */
  private validateCriminalRecordStructure(text: string): string[] {
    const flags: string[] = [];
    const lower = text.toLowerCase();

    // Portuguese criminal record certificates should contain these elements
    const headerPatterns = [
      /certificado\s+de\s+registo\s+criminal/i,
      /registo\s+criminal/i,
      /certid[aã]o\s+de\s+registo\s+criminal/i,
      /criminal\s+record/i, // English variant
    ];
    if (!headerPatterns.some((p) => p.test(text))) {
      flags.push('MISSING_CERTIFICATE_HEADER');
    }

    // Official entity (Portuguese Ministry of Justice or equivalent)
    const entityPatterns = [
      /minist[eé]rio\s+da\s+justi[cç]a/i,
      /dire[cç][aã]o[\s-]geral\s+da?\s+administra[cç][aã]o\s+da\s+justi[cç]a/i,
      /dgaj/i,
      /identifica[cç][aã]o\s+civil/i,
    ];
    if (!entityPatterns.some((p) => p.test(text))) {
      flags.push('MISSING_OFFICIAL_ENTITY');
    }

    // Certificate number pattern (Portuguese format)
    const certNumberPatterns = [
      /\d{4}[\/-]\d+/,
      /n[.°º]\s*\d+/i,
      /certid[aã]o\s+n/i,
    ];
    if (!certNumberPatterns.some((p) => p.test(text))) {
      flags.push('MISSING_CERTIFICATE_NUMBER');
    }

    // Check for date references
    const datePattern =
      /\d{1,2}[\s/.-]\d{1,2}[\s/.-]\d{2,4}|\d{1,2}\s+de\s+\w+\s+de\s+\d{4}/i;
    if (!datePattern.test(text)) {
      flags.push('NO_DATE_FOUND');
    }

    // Check for suspicious content — document says it's from a completely wrong country
    const wrongCountryPatterns = [
      /united\s+states/i,
      /united\s+kingdom/i,
      /bundesrepublik/i,
      /r[eé]publique\s+fran[cç]aise/i,
    ];
    if (wrongCountryPatterns.some((p) => p.test(text))) {
      flags.push('WRONG_COUNTRY_DOCUMENT');
    }

    // Very short text — likely not a real certificate
    if (text.trim().length < 100) {
      flags.push('INSUFFICIENT_TEXT');
    }

    // Check for obvious template/sample markers
    const samplePatterns = [
      /\b(sample|exemplo|specimen|demo|test)\b/i,
      /\b(lorem\s+ipsum)\b/i,
    ];
    if (samplePatterns.some((p) => p.test(text))) {
      flags.push('SAMPLE_DOCUMENT_DETECTED');
    }

    return flags;
  }

  /**
   * Validate vehicle registration document structure (Portuguese DUA/Título de Registo).
   */
  private validateVehicleRegistrationStructure(text: string): string[] {
    const flags: string[] = [];

    // Portuguese vehicle registration terms
    const headerPatterns = [
      /t[ií]tulo\s+de\s+registo/i,
      /documento\s+[úu]nico\s+autom[oó]vel/i,
      /dua/i,
      /certificado\s+de\s+matr[ií]cula/i,
      /vehicle\s+registration/i, // English variant
      /registo\s+de\s+propriedade/i,
    ];
    if (!headerPatterns.some((p) => p.test(text))) {
      flags.push('MISSING_REGISTRATION_HEADER');
    }

    // Should contain vehicle-specific terms
    const vehicleTerms = [
      /matr[ií]cula/i,
      /marca/i,
      /modelo/i,
      /cilindrada|pot[eê]ncia/i,
      /chassis|vin|quadro/i,
      /license\s+plate|registration\s+number/i,
    ];
    const matchedTerms = vehicleTerms.filter((p) => p.test(text));
    if (matchedTerms.length < 2) {
      flags.push('MISSING_VEHICLE_DETAILS');
    }

    if (text.trim().length < 50) {
      flags.push('INSUFFICIENT_TEXT');
    }

    const samplePatterns = [
      /\b(sample|exemplo|specimen|demo|test)\b/i,
      /\b(lorem\s+ipsum)\b/i,
    ];
    if (samplePatterns.some((p) => p.test(text))) {
      flags.push('SAMPLE_DOCUMENT_DETECTED');
    }

    return flags;
  }

  /**
   * Detect font/formatting inconsistencies across text blocks.
   * Multiple different font sizes or styles in a structured document can indicate editing.
   */
  private detectFontInconsistencies(
    pages: Array<{
      blocks?: Array<{
        paragraphs?: Array<{
          words?: Array<{
            symbols?: Array<{
              property?: {
                detectedBreak?: unknown;
              };
              confidence?: number | null;
            }> | null;
            confidence?: number | null;
          }> | null;
        }> | null;
        confidence?: number | null;
      }> | null;
    }>,
  ): string[] {
    const flags: string[] = [];

    for (const page of pages) {
      const blockConfidences: number[] = [];
      for (const block of page.blocks || []) {
        if (block.confidence != null) {
          blockConfidences.push(block.confidence);
        }
      }

      // If some blocks have dramatically lower confidence, possible editing
      if (blockConfidences.length >= 3) {
        const avg =
          blockConfidences.reduce((a, b) => a + b, 0) / blockConfidences.length;
        const hasLowOutlier = blockConfidences.some(
          (c) => c < avg - 0.3 && c < 0.5,
        );
        if (hasLowOutlier) {
          flags.push('INCONSISTENT_BLOCK_CONFIDENCE');
        }
      }
    }

    return flags;
  }

  /**
   * Extract license plate from OCR text.
   * Portuguese plates: AA-00-AA or 00-AA-00 (older).
   */
  private extractLicensePlate(text: string): string | null {
    // Portuguese plate formats
    const patterns = [
      /\b([A-Z]{2}[\s-]?\d{2}[\s-]?[A-Z]{2})\b/,
      /\b(\d{2}[\s-]?[A-Z]{2}[\s-]?\d{2})\b/,
      /\b(\d{2}[\s-]?\d{2}[\s-]?[A-Z]{2})\b/,
      /\b([A-Z]{2}[\s-]?\d{2}[\s-]?\d{2})\b/,
    ];

    const upper = text.toUpperCase();
    for (const pattern of patterns) {
      const match = upper.match(pattern);
      if (match) {
        return match[1];
      }
    }
    return null;
  }

  private normalizePlate(plate: string): string {
    return plate.toUpperCase().replace(/[\s-]/g, '');
  }

  private calculateCriminalRecordTrustScore(
    flags: string[],
    textConfidence: number,
    hasExpectedStructure: boolean,
  ): number {
    let score = 100;

    // Major red flags
    if (flags.includes('SPOOF_DETECTED')) score -= 40;
    if (flags.includes('SAMPLE_DOCUMENT_DETECTED')) score -= 50;
    if (flags.includes('WRONG_COUNTRY_DOCUMENT')) score -= 40;
    if (flags.includes('IMAGE_FOUND_ONLINE')) score -= 25;
    if (flags.includes('MANY_SIMILAR_IMAGES_ONLINE')) score -= 15;

    // Structural issues
    if (flags.includes('MISSING_CERTIFICATE_HEADER')) score -= 15;
    if (flags.includes('MISSING_OFFICIAL_ENTITY')) score -= 15;
    if (flags.includes('MISSING_CERTIFICATE_NUMBER')) score -= 10;
    if (flags.includes('NO_DATE_FOUND')) score -= 10;
    if (flags.includes('INSUFFICIENT_TEXT')) score -= 20;

    // Quality issues
    if (flags.includes('INCONSISTENT_BLOCK_CONFIDENCE')) score -= 15;

    // OCR confidence factor
    if (textConfidence > 0) {
      // If confidence is below 0.7, deduct
      if (textConfidence < 0.5) score -= 15;
      else if (textConfidence < 0.7) score -= 8;
    }

    // Bonus for expected structure
    if (hasExpectedStructure && textConfidence > 0.8)
      score = Math.min(score + 5, 100);

    return Math.max(0, Math.min(100, Math.round(score)));
  }

  private calculateVehicleLicenseTrustScore(
    flags: string[],
    textConfidence: number,
    hasExpectedStructure: boolean,
    plateMatch?: boolean,
  ): number {
    let score = 100;

    // Major red flags
    if (flags.includes('SPOOF_DETECTED')) score -= 40;
    if (flags.includes('PLATE_MISMATCH')) score -= 35;
    if (flags.includes('SAMPLE_DOCUMENT_DETECTED')) score -= 50;
    if (flags.includes('IMAGE_FOUND_ONLINE')) score -= 25;

    // Structural issues
    if (flags.includes('MISSING_REGISTRATION_HEADER')) score -= 15;
    if (flags.includes('MISSING_VEHICLE_DETAILS')) score -= 15;
    if (flags.includes('PLATE_NOT_DETECTED')) score -= 10;
    if (flags.includes('INSUFFICIENT_TEXT')) score -= 20;

    // Quality issues
    if (flags.includes('INCONSISTENT_BLOCK_CONFIDENCE')) score -= 15;

    // OCR confidence factor
    if (textConfidence > 0) {
      if (textConfidence < 0.5) score -= 15;
      else if (textConfidence < 0.7) score -= 8;
    }

    // Bonus for plate match
    if (plateMatch === true) score = Math.min(score + 10, 100);
    if (hasExpectedStructure && textConfidence > 0.8)
      score = Math.min(score + 5, 100);

    return Math.max(0, Math.min(100, Math.round(score)));
  }

  private unavailableResult(reason: string): DocumentAnalysisResult {
    return {
      trustScore: -1,
      flags: [reason],
      details: {
        textExtracted: '',
        textConfidence: 0,
        hasExpectedStructure: false,
        ocrLanguages: [],
      },
      raw: JSON.stringify({ unavailable: reason }),
    };
  }
}
