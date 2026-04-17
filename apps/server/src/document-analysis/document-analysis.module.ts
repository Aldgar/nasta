import { Module } from '@nestjs/common';
import { DocumentAnalysisService } from './document-analysis.service';

@Module({
  providers: [DocumentAnalysisService],
  exports: [DocumentAnalysisService],
})
export class DocumentAnalysisModule {}
