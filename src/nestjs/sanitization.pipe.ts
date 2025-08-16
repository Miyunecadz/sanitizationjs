import { 
  Injectable, 
  PipeTransform, 
  ArgumentMetadata, 
  BadRequestException,
  Inject
} from '@nestjs/common';
import { SanitizationEngine } from '../core/sanitization-engine';
import { SanitizationOptions, SanitizationConfig } from '../types';
import { SANITIZATION_CONFIG_TOKEN } from './constants';

@Injectable()
export class SanitizationPipe implements PipeTransform {
  constructor(
    private readonly sanitizationEngine: SanitizationEngine,
    @Inject(SANITIZATION_CONFIG_TOKEN) private readonly config: SanitizationConfig,
    private readonly options?: SanitizationOptions
  ) {}

  async transform(value: any, metadata: ArgumentMetadata): Promise<any> {
    if (!this.config.enabled) {
      return value;
    }

    if (value === null || value === undefined) {
      return value;
    }

    const rules = this.options?.rules || this.config.rules;
    
    try {
      const result = this.sanitizationEngine.sanitize(value, rules);
      
      if (this.config.strictMode && result.violations.length > 0) {
        throw new BadRequestException({
          message: 'Input validation failed',
          violations: result.violations,
          code: 'SANITIZATION_VIOLATION'
        });
      }

      return result.sanitized;
    } catch (error) {
      if (error instanceof BadRequestException) {
        throw error;
      }
      
      throw new BadRequestException({
        message: 'Input sanitization failed',
        error: error instanceof Error ? error.message : String(error),
        code: 'SANITIZATION_ERROR'
      });
    }
  }
}

@Injectable()
export class GlobalSanitizationPipe extends SanitizationPipe {
  constructor(
    sanitizationEngine: SanitizationEngine,
    @Inject(SANITIZATION_CONFIG_TOKEN) config: SanitizationConfig
  ) {
    super(sanitizationEngine, config);
  }
}