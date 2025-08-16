import { Injectable } from '@nestjs/common';
import { v4 as uuidv4 } from 'uuid';
import { 
  SuccessResponse, 
  ErrorResponse, 
  ResponseMetadata, 
  PaginationMeta,
  NormalizationConfig,
  RequestContext
} from '../types';

@Injectable()
export class NormalizationEngine {
  constructor(private readonly config: NormalizationConfig) {}

  normalizeSuccess<T>(
    data: T, 
    context: RequestContext,
    pagination?: PaginationMeta
  ): SuccessResponse<T> {
    const metadata = this.createMetadata(context);
    
    const response: SuccessResponse<T> = {
      success: true,
      data,
      metadata
    };

    if (pagination) {
      response.pagination = this.normalizePagination(pagination);
    }

    return this.applyFormatting(response) as SuccessResponse<T>;
  }

  normalizeError(
    error: Error | string | any,
    context: RequestContext,
    code?: string,
    details?: any
  ): ErrorResponse {
    const metadata = this.createMetadata(context);
    const timestamp = new Date().toISOString();

    let errorMessage: string;
    let errorCode: string;
    let stack: string | undefined;

    if (error instanceof Error) {
      errorMessage = error.message;
      errorCode = code || error.name || 'INTERNAL_ERROR';
      stack = this.config.includeDebugInfo ? error.stack : undefined;
    } else if (typeof error === 'string') {
      errorMessage = error;
      errorCode = code || 'VALIDATION_ERROR';
    } else {
      errorMessage = error?.message || 'An unexpected error occurred';
      errorCode = code || error?.code || 'UNKNOWN_ERROR';
    }

    const response: ErrorResponse = {
      success: false,
      error: {
        code: errorCode,
        message: errorMessage,
        details: this.sanitizeErrorDetails(details),
        timestamp,
        requestId: context.requestId,
        ...(stack && { stack })
      },
      metadata
    };

    return this.applyErrorFormatting(response);
  }

  private createMetadata(context: RequestContext): ResponseMetadata {
    const processingTime = context.startTime ? Date.now() - context.startTime : undefined;

    const metadata: ResponseMetadata = {
      timestamp: new Date().toISOString(),
      requestId: context.requestId,
      version: 'v1'
    };

    if (this.config.includeMetadata && processingTime !== undefined) {
      metadata.processingTime = processingTime;
    }

    return metadata;
  }

  private normalizePagination(pagination: PaginationMeta): PaginationMeta {
    const normalized: PaginationMeta = {
      page: Math.max(1, pagination.page),
      limit: Math.max(1, Math.min(100, pagination.limit)),
      total: Math.max(0, pagination.total),
      totalPages: Math.max(1, Math.ceil(pagination.total / pagination.limit)),
      hasNext: pagination.page < Math.ceil(pagination.total / pagination.limit),
      hasPrev: pagination.page > 1
    };

    if (this.config.includeLinks && pagination.links) {
      normalized.links = pagination.links;
    }

    return normalized;
  }

  private applyFormatting<T>(response: SuccessResponse<T>): SuccessResponse<T> {
    switch (this.config.format) {
      case 'minimal':
        return {
          success: response.success,
          data: response.data
        } as SuccessResponse<T>;

      case 'detailed':
        return {
          ...response,
          metadata: {
            ...response.metadata,
            server: process.env.NODE_ENV || 'development',
            nodeVersion: process.version
          }
        };

      case 'standard':
      default:
        return response;
    }
  }

  private applyErrorFormatting(response: ErrorResponse): ErrorResponse {
    switch (this.config.errorFormat) {
      case 'simple':
        return {
          success: false,
          error: {
            code: response.error.code,
            message: response.error.message,
            timestamp: response.error.timestamp,
            requestId: response.error.requestId
          },
          metadata: response.metadata
        };

      case 'detailed':
        return {
          ...response,
          error: {
            ...response.error,
            helpUrl: this.generateHelpUrl(response.error.code),
            possibleCauses: this.getPossibleCauses(response.error.code)
          },
          metadata: {
            ...response.metadata,
            server: process.env.NODE_ENV || 'development',
            nodeVersion: process.version
          }
        };

      case 'standard':
      default:
        return response;
    }
  }

  private sanitizeErrorDetails(details: any): any {
    if (!details) return undefined;

    if (typeof details === 'string') return details;

    if (Array.isArray(details)) {
      return details.map(item => this.sanitizeErrorDetails(item));
    }

    if (typeof details === 'object') {
      const sanitized: any = {};
      for (const [key, value] of Object.entries(details)) {
        if (this.isSensitiveField(key)) {
          sanitized[key] = '[REDACTED]';
        } else {
          sanitized[key] = this.sanitizeErrorDetails(value);
        }
      }
      return sanitized;
    }

    return details;
  }

  private isSensitiveField(fieldName: string): boolean {
    const sensitiveFields = [
      'password',
      'token',
      'secret',
      'key',
      'authorization',
      'auth',
      'credential',
      'ssn',
      'social',
      'credit',
      'card'
    ];

    return sensitiveFields.some(field => 
      fieldName.toLowerCase().includes(field)
    );
  }

  private generateHelpUrl(errorCode: string): string {
    const baseUrl = 'https://docs.example.com/errors';
    return `${baseUrl}/${errorCode.toLowerCase()}`;
  }

  private getPossibleCauses(errorCode: string): string[] {
    const causesMap: Record<string, string[]> = {
      'VALIDATION_ERROR': [
        'Invalid input format',
        'Missing required fields',
        'Field length constraints violated'
      ],
      'AUTHENTICATION_ERROR': [
        'Invalid credentials',
        'Expired token',
        'Insufficient permissions'
      ],
      'NOT_FOUND': [
        'Resource does not exist',
        'Incorrect resource ID',
        'Resource has been deleted'
      ],
      'INTERNAL_ERROR': [
        'Server configuration issue',
        'Database connection problem',
        'Third-party service unavailable'
      ]
    };

    return causesMap[errorCode] || ['Unknown error cause'];
  }

  createRequestContext(requestId?: string): RequestContext {
    return {
      requestId: requestId || uuidv4(),
      timestamp: new Date(),
      startTime: Date.now()
    };
  }

  updateConfig(newConfig: Partial<NormalizationConfig>): void {
    Object.assign(this.config, newConfig);
  }
}