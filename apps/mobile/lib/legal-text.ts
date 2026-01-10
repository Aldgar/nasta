import { TERMS_OF_SERVICE_EN } from './legal-documents/terms-of-service.en';
import { TERMS_OF_SERVICE_PT } from './legal-documents/terms-of-service.pt';
import { PRIVACY_POLICY_EN } from './legal-documents/privacy-policy.en';
import { PLATFORM_RULES_EN } from './legal-documents/platform-rules.en';
import { COOKIES_EN } from './legal-documents/cookies.en';

// Import Portuguese documents
import { PRIVACY_POLICY_PT } from './legal-documents/privacy-policy.pt';
import { PLATFORM_RULES_PT } from './legal-documents/platform-rules.pt';
import { COOKIES_PT } from './legal-documents/cookies.pt';

type Language = 'en' | 'pt';
type DocumentType = 'TERMS_OF_SERVICE' | 'PRIVACY_POLICY' | 'PLATFORM_RULES' | 'COOKIES';

/**
 * Process date placeholders in document content
 * Replaces escaped template strings with actual formatted dates
 */
function processDatePlaceholders(content: string, language: Language): string {
  const locale = language === 'pt' ? 'pt-PT' : 'en-US';
  const formattedDate = new Date().toLocaleDateString(locale, { 
    year: 'numeric', 
    month: 'long', 
    day: 'numeric' 
  });
  
  // Replace date template strings with actual formatted date
  // In template literals, \${ becomes ${ in the actual string
  // Use a simple approach: find the pattern and replace it
  // Look for the start of the pattern
  const patternStart = '${new Date().toLocaleDateString(';
  const patternEnd = ')}';
  
  let result = content;
  let index = result.indexOf(patternStart);
  
  while (index !== -1) {
    // Find the matching closing brace
    let braceCount = 0;
    let foundOpening = false;
    let pos = index + patternStart.length;
    
    // Skip to the opening brace of the options object
    while (pos < result.length && result[pos] !== '{') {
      pos++;
    }
    
    if (pos < result.length && result[pos] === '{') {
      foundOpening = true;
      braceCount = 1;
      pos++;
      
      // Count braces to find the matching closing brace
      while (pos < result.length && braceCount > 0) {
        if (result[pos] === '{') braceCount++;
        if (result[pos] === '}') braceCount--;
        pos++;
      }
    }
    
    // If we found a complete match, replace it
    if (foundOpening && braceCount === 0) {
      // Include the closing )} of the template expression
      const closingPos = result.indexOf(')}', pos - 1);
      if (closingPos !== -1 && closingPos < pos + 2) {
        pos = closingPos + 2; // Include the )}
      }
      
      const fullMatch = result.substring(index, pos);
      // Verify it's a date formatting pattern
      if (fullMatch.includes('year') && fullMatch.includes('month') && 
          fullMatch.includes('day') && (fullMatch.includes('pt-PT') || fullMatch.includes('en-US'))) {
        result = result.substring(0, index) + formattedDate + result.substring(pos);
        // Continue searching from after the replacement
        index = result.indexOf(patternStart, index + formattedDate.length);
      } else {
        // Continue searching from after this match
        index = result.indexOf(patternStart, index + 1);
      }
    } else {
      // Continue searching
      index = result.indexOf(patternStart, index + 1);
    }
  }
  
  return result;
}

/**
 * Get legal document content based on language
 * @param type - Document type
 * @param language - Language code ('en' or 'pt')
 * @returns Document content as string with processed date placeholders
 */
export function getLegalDocument(type: DocumentType, language: Language = 'en'): string {
  const documents: Record<DocumentType, Record<Language, string>> = {
    TERMS_OF_SERVICE: {
      en: TERMS_OF_SERVICE_EN,
      pt: TERMS_OF_SERVICE_PT,
    },
    PRIVACY_POLICY: {
      en: PRIVACY_POLICY_EN,
      pt: PRIVACY_POLICY_PT,
    },
    PLATFORM_RULES: {
      en: PLATFORM_RULES_EN,
      pt: PLATFORM_RULES_PT,
    },
    COOKIES: {
      en: COOKIES_EN,
      pt: COOKIES_PT,
    },
  };

  const content = documents[type][language] || documents[type]['en'];
  return processDatePlaceholders(content, language);
}

/**
 * Legacy export for backward compatibility
 * Returns English documents by default
 * @deprecated Use getLegalDocument() instead
 */
export const LEGAL_TEXT = {
  TERMS_OF_SERVICE: TERMS_OF_SERVICE_EN,
  PRIVACY_POLICY: PRIVACY_POLICY_EN,
  PLATFORM_RULES: PLATFORM_RULES_EN,
  COOKIES: COOKIES_EN,
  TERMS: `This is a legacy page. Please refer to "Terms of Service" for the current terms.`,
  PRIVACY: `This is a legacy page. Please refer to "Privacy Policy" for the current privacy policy.`,
  RULES: `This is a legacy page. Please refer to "Platform Rules" for the current platform rules.`,
};
