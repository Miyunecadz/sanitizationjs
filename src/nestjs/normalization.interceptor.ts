import {
  Injectable,
  NestInterceptor,
  ExecutionContext,
  CallHandler,
  Inject,
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
  ErrorResponse,
  PaginationMeta,
} from '../types';
import {
  NORMALIZATION_CONFIG_TOKEN,
  NORMALIZATION_OPTIONS_METADATA,
} from './constants';

@Injectable()
export class NormalizationInterceptor implements NestInterceptor {
  constructor(
    private readonly normalizationEngine: NormalizationEngine,
    @Inject(NORMALIZATION_CONFIG_TOKEN)
    private readonly config: NormalizationConfig,
    private readonly reflector: Reflector
  ) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<any> {
    if (!this.config.enabled) {
      return next.handle();
    }

    const request = context.switchToHttp().getRequest<Request>();
    const requestContext = this.createRequestContext(request);

    const options =
      this.reflector.get<NormalizationOptions>(
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
      ip: this.extractClientIp(request),
    };
  }

  private extractRequestId(request: Request): string {
    return (
      (request.headers['x-request-id'] as string) ||
      (request.headers['x-correlation-id'] as string) ||
      (request.headers['x-trace-id'] as string) ||
      this.normalizationEngine.createRequestContext().requestId
    );
  }

  private extractClientIp(request: Request): string {
    return (
      (request.headers['x-forwarded-for'] as string) ||
      (request.headers['x-real-ip'] as string) ||
      request.connection.remoteAddress ||
      request.socket.remoteAddress ||
      (request.connection as any)?.socket?.remoteAddress ||
      'unknown'
    );
  }

  private handleSuccess(
    data: unknown,
    context: RequestContext,
    options: NormalizationOptions
  ): SuccessResponse<unknown> {
    if (this.isAlreadyNormalized(data)) {
      return data as SuccessResponse<unknown>;
    }

    const pagination = this.extractPagination(data);
    const actualData = pagination
      ? (data as Record<string, unknown>).data ||
        (data as Record<string, unknown>).items ||
        data
      : data;

    return this.normalizationEngine.normalizeSuccess(
      actualData,
      context,
      pagination
    );
  }

  private handleError(
    error: unknown,
    context: RequestContext,
    options: NormalizationOptions
  ): ErrorResponse {
    if (this.isAlreadyNormalized(error)) {
      return error as ErrorResponse;
    }

    let code: string | undefined;
    let details: unknown;

    const errorObj = error as Record<string, unknown>;
    if (errorObj.response) {
      const response = errorObj.response as Record<string, unknown>;
      code =
        (response.code as string) ||
        ((response.error as Record<string, unknown>)?.code as string);
      details = response.details || response.message;
    } else if (errorObj.code) {
      code = errorObj.code as string;
      details = errorObj.details;
    }

    return this.normalizationEngine.normalizeError(
      error,
      context,
      code,
      details
    );
  }

  private isAlreadyNormalized(data: unknown): boolean {
    if (!data || typeof data !== 'object') {
      return false;
    }
    const dataObj = data as Record<string, unknown>;
    return (
      'success' in dataObj &&
      'metadata' in dataObj &&
      typeof dataObj.metadata === 'object' &&
      dataObj.metadata !== null &&
      'requestId' in (dataObj.metadata as Record<string, unknown>)
    );
  }

  private extractPagination(data: unknown): PaginationMeta | undefined {
    if (!data || typeof data !== 'object') {
      return undefined;
    }

    const dataObj = data as Record<string, unknown>;

    if (dataObj.pagination) {
      return dataObj.pagination as PaginationMeta;
    }

    const hasPageInfo =
      dataObj.page !== undefined ||
      dataObj.limit !== undefined ||
      dataObj.total !== undefined;

    if (hasPageInfo) {
      return {
        page: (dataObj.page as number) || 1,
        limit: (dataObj.limit as number) || 10,
        total: (dataObj.total as number) || 0,
        totalPages:
          (dataObj.totalPages as number) ||
          Math.ceil(
            ((dataObj.total as number) || 0) / ((dataObj.limit as number) || 10)
          ),
        hasNext: (dataObj.hasNext as boolean) || false,
        hasPrev: (dataObj.hasPrev as boolean) || false,
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
