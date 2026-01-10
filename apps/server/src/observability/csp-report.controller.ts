import { Body, Controller, HttpCode, Post } from '@nestjs/common';

// Accept CSP violation reports in report-only mode
@Controller()
export class CspReportController {
  @Post('csp-report')
  @HttpCode(204)
  report(@Body() body: unknown) {
    // Intentionally minimal: log shape without sensitive data
    try {
      // Some browsers send {"csp-report": {...}}
      const hasCspReport = (obj: unknown): obj is { 'csp-report': unknown } =>
        typeof obj === 'object' &&
        obj !== null &&
        'csp-report' in (obj as Record<string, unknown>);
      const reportObj = hasCspReport(body) ? body['csp-report'] : body;
      const report =
        typeof reportObj === 'object' && reportObj !== null
          ? (reportObj as Record<string, unknown>)
          : {};
      const str = (k: string) =>
        typeof report[k] === 'string' ? String(report[k]) : undefined;
      const summary = {
        'blocked-uri': str('blocked-uri'),
        'violated-directive': str('violated-directive'),
        'effective-directive': str('effective-directive'),
        'document-uri': str('document-uri'),
        referrer: str('referrer'),
        disposition: str('disposition'),
      } as const;

      console.warn('[CSP-REPORT]', JSON.stringify(summary));
    } catch {
      // ignore parse errors
    }
    // 204 No Content
    return;
  }
}
