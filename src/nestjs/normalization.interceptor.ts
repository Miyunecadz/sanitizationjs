import {
  Injectable,
  NestInterceptor,
  ExecutionContext,
  CallHandler,
  Inject
} from '@nestjs/common';
import { Observable, throwError } from 'rxjs';
import { map, catchError } from 'rxjs/operators';
import { Reflector } from '@nestjs/core';
import { Request } from 'express';
import { NormalizationEngine } from '../core/normalization-engine';
import { 
  NormalizationConfig, 
  NormalizationOptions, 
  RequestContext,
  SuccessResponse,
  ErrorResponse
} from '../types';
import { 
  NORMALIZATION_CONFIG_TOKEN, 
  NORMALIZATION_OPTIONS_METADATA 
} from './constants';

@Injectable()
export class NormalizationInterceptor implements NestInterceptor {
  constructor(
    private readonly normalizationEngine: NormalizationEngine,
    @Inject(NORMALIZATION_CONFIG_TOKEN) private readonly config: NormalizationConfig,
    private readonly reflector: Reflector
  ) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<any> {
    if (!this.config.enabled) {
      return next.handle();
    }

    const request = context.switchToHttp().getRequest<Request>();
    const requestContext = this.createRequestContext(request);

    const options = this.reflector.get<NormalizationOptions>(
      NORMALIZATION_OPTIONS_METADATA,
      context.getHandler()
    ) || {};

    return next.handle().pipe(
      map(data => this.handleSuccess(data, requestContext, options)),
      catchError(error => {
        const errorResponse = this.handleError(error, requestContext, options);
        return throwError(() => errorResponse);
      })
    );
  }

  private createRequestContext(request: Request): RequestContext {
    return {
      requestId: this.extractRequestId(request),
      timestamp: new Date(),
      startTime: Date.now(),
      userAgent: request.get('User-Agent'),
      ip: this.extractClientIp(request)
    };
  }

  private extractRequestId(request: Request): string {
    return (
      request.headers['x-request-id'] as string ||
      request.headers['x-correlation-id'] as string ||
      request.headers['x-trace-id'] as string ||
      this.normalizationEngine.createRequestContext().requestId
    );
  }

  private extractClientIp(request: Request): string {
    return (
      request.headers['x-forwarded-for'] as string ||
      request.headers['x-real-ip'] as string ||
      request.connection.remoteAddress ||
      request.socket.remoteAddress ||
      (request.connection as any)?.socket?.remoteAddress ||
      'unknown'
    );
  }

  private handleSuccess(
    data: any, 
    context: RequestContext, 
    options: NormalizationOptions
  ): SuccessResponse<any> {
    if (this.isAlreadyNormalized(data)) {
      return data;
    }

    const pagination = this.extractPagination(data);
    const actualData = pagination ? data.data || data.items || data : data;

    return this.normalizationEngine.normalizeSuccess(
      actualData,
      context,
      pagination
    );
  }

  private handleError(
    error: any, 
    context: RequestContext, 
    options: NormalizationOptions
  ): ErrorResponse {
    if (this.isAlreadyNormalized(error)) {
      return error;
    }

    let code: string | undefined;
    let details: any;

    if (error.response) {
      code = error.response.code || error.response.error?.code;
      details = error.response.details || error.response.message;
    } else if (error.code) {
      code = error.code;
      details = error.details;
    }

    return this.normalizationEngine.normalizeError(
      error,
      context,
      code,
      details
    );
  }

  private isAlreadyNormalized(data: any): boolean {
    return data && 
           typeof data === 'object' && 
           'success' in data && 
           'metadata' in data &&
           'requestId' in (data.metadata || {});
  }

  private extractPagination(data: any): any {
    if (!data || typeof data !== 'object') {
      return undefined;
    }

    if (data.pagination) {
      return data.pagination;
    }

    const hasPageInfo = data.page !== undefined || 
                       data.limit !== undefined || 
                       data.total !== undefined;

    if (hasPageInfo) {
      return {
        page: data.page || 1,
        limit: data.limit || 10,
        total: data.total || 0,
        totalPages: data.totalPages || Math.ceil((data.total || 0) / (data.limit || 10)),
        hasNext: data.hasNext || false,
        hasPrev: data.hasPrev || false
      };
    }

    return undefined;
  }
}

@Injectable()
export class GlobalNormalizationInterceptor extends NormalizationInterceptor {
  constructor(
    normalizationEngine: NormalizationEngine,
    @Inject(NORMALIZATION_CONFIG_TOKEN) config: NormalizationConfig,
    reflector: Reflector
  ) {
    super(normalizationEngine, config, reflector);
  }
}