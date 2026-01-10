import { Injectable } from '@nestjs/common';

export type AiProvider = 'anthropic' | 'openai' | 'azure-openai' | 'none';

@Injectable()
export class AiService {
  get provider(): AiProvider {
    const val = (process.env.AI_PROVIDER || 'none').toLowerCase();
    if (val === 'anthropic') return 'anthropic';
    if (val === 'openai') return 'openai';
    if (val === 'azure-openai') return 'azure-openai';
    return 'none';
  }

  get model(): string | null {
    return process.env.AI_MODEL || null;
  }

  get configured(): boolean {
    if (this.provider === 'anthropic')
      return !!process.env.ANTHROPIC_API_KEY && !!this.model;
    if (this.provider === 'openai')
      return !!process.env.OPENAI_API_KEY && !!this.model;
    if (this.provider === 'azure-openai')
      return (
        !!process.env.AZURE_OPENAI_API_KEY &&
        !!process.env.AZURE_OPENAI_ENDPOINT &&
        !!this.model
      );
    return false;
  }

  health() {
    return {
      provider: this.provider,
      model: this.model,
      configured: this.configured,
    };
  }
}
