import { Injectable, Logger } from '@nestjs/common';
import { existsSync, readFileSync } from 'fs';
import { join } from 'path';
import { PrismaService } from '../prisma/prisma.service';

type Language = 'en' | 'pt';
type TranslationKey = string;
type TranslationParams = Record<string, string | number>;

@Injectable()
export class EmailTranslationsService {
  private readonly logger = new Logger(EmailTranslationsService.name);
  private translations: {
    en: Record<string, any>;
    pt: Record<string, any>;
  } = {
    en: {},
    pt: {},
  };

  constructor(private readonly prisma: PrismaService) {
    this.loadTranslations();
  }

  private deepMerge(target: Record<string, any>, source: Record<string, any>) {
    for (const [key, value] of Object.entries(source)) {
      const targetValue = target[key];
      const isObject = (v: unknown) =>
        v !== null && typeof v === 'object' && Array.isArray(v) === false;

      if (isObject(targetValue) && isObject(value)) {
        this.deepMerge(targetValue, value as Record<string, any>);
      } else {
        target[key] = value;
      }
    }
  }

  private loadTranslations() {
    try {
      // Load translations from the server's locales directory.
      // __dirname at runtime is dist/src/notifications/ (tsc preserves src/ prefix).
      // NestJS assets copy to dist/notifications/locales/ by default.
      // We search multiple locations to handle any CWD or build layout.
      const serverRoot = join(__dirname, '..', '..', '..');
      const localeDirs = [
        join(__dirname, 'locales'),
        join(__dirname, '..', '..', 'notifications', 'locales'),
        join(serverRoot, 'src', 'notifications', 'locales'),
        join(serverRoot, 'dist', 'notifications', 'locales'),
        join(serverRoot, 'dist', 'src', 'notifications', 'locales'),
        join(process.cwd(), 'src', 'notifications', 'locales'),
        join(process.cwd(), 'dist', 'notifications', 'locales'),
        join(process.cwd(), 'dist', 'src', 'notifications', 'locales'),
      ];

      const findLocalePath = (fileName: string) => {
        for (const dir of localeDirs) {
          const candidate = join(dir, fileName);
          if (existsSync(candidate)) return candidate;
        }
        return null;
      };

      const enPath = findLocalePath('en.json');
      const ptPath = findLocalePath('pt.json');

      if (!enPath || !ptPath) {
        throw new Error('Missing server locales (en.json/pt.json)');
      }

      this.translations.en = JSON.parse(readFileSync(enPath, 'utf-8'));
      this.translations.pt = JSON.parse(readFileSync(ptPath, 'utf-8'));

      this.logger.log('Email translations loaded successfully');
    } catch (error) {
      this.logger.error(
        `Failed to load email translations: ${(error as Error).message}`,
      );
      // Use empty objects as fallback
      this.translations.en = {};
      this.translations.pt = {};
    }
  }

  /**
   * Get user's language preference
   * Uses user.language field if available, otherwise falls back to English
   */
  async getUserLanguage(
    userId?: string,
    localeHint?: string,
  ): Promise<Language> {
    if (userId) {
      try {
        // Try to get language from user model
        const user = await this.prisma.user.findUnique({
          where: { id: userId },
          select: {
            language: true,
          },
        });

        const userLang = (user as any)?.language;
        if (userLang) {
          return this.getLanguageFromLocale(userLang);
        }
      } catch (error) {
        // Field doesn't exist or query failed - fall back to English
        this.logger.debug(
          `User language field not available for ${userId}, using English fallback`,
        );
      }
    }

    if (localeHint) {
      return this.getLanguageFromLocale(localeHint);
    }

    // Fallback to English (as per requirements: fallback to English ONLY if user.language is missing)
    return 'en';
  }

  /**
   * Get language from locale string
   * Falls back to Portuguese if locale starts with "pt", otherwise English
   */
  getLanguageFromLocale(locale?: string): Language {
    if (!locale) {
      return 'en';
    }
    return locale.toLowerCase().startsWith('pt') ? 'pt' : 'en';
  }

  /**
   * Translate a key with optional parameters
   * NEVER returns raw keys - always falls back to English or provides a safe default
   */
  t(
    key: TranslationKey,
    params?: TranslationParams,
    language: Language = 'en',
  ): string {
    const translations = this.translations[language] || this.translations.en;
    const keys = key.split('.');
    let value: any = translations;

    for (const k of keys) {
      if (value && typeof value === 'object' && k in value) {
        value = value[k];
      } else {
        // Key not found, try English fallback
        if (language !== 'en') {
          return this.t(key, params, 'en');
        }
        // Even English doesn't have it - log error and return safe fallback
        this.logger.error(
          `CRITICAL: Translation key not found: ${key}. This will cause raw keys in emails!`,
        );
        // Return a neutral placeholder (no raw key content)
        return '…';
      }
    }

    if (typeof value !== 'string') {
      // Value is not a string, try English fallback
      if (language !== 'en') {
        return this.t(key, params, 'en');
      }
      this.logger.error(
        `CRITICAL: Translation value is not a string for key: ${key}. This will cause raw keys in emails!`,
      );
      // Return a neutral placeholder (no raw key content)
      return '…';
    }

    // Replace parameters in the translation
    if (params) {
      return value.replace(/\{\{(\w+)\}\}/g, (match, paramKey) => {
        return params[paramKey]?.toString() || match;
      });
    }

    return value;
  }

  /**
   * Get translation function for a specific language
   */
  getTranslator(language: Language) {
    return (key: TranslationKey, params?: TranslationParams) =>
      this.t(key, params, language);
  }

  /**
   * Get translation function for a user
   */
  async getTranslatorForUser(userId?: string) {
    const language = await this.getUserLanguage(userId);
    return this.getTranslator(language);
  }
}
