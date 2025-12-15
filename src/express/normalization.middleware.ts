import { Request, Response, NextFunction } from 'express';
import { NormalizationEngine } from '../core/normalization-engine';
import { NormalizationConfig, RequestContext, PaginationMeta } from '../types';

export interface ExpressNormalizationOptions {
  autoDetectPagination?: boolean;
  extractRequestId?: (req: Request) => string;
  extractMetadata?: (req: Request, res: Response) => Record<string, unknown>;
  onError?: (error: unknown, req: Request, res: Response) => void;
}

export function createNormalizationMiddleware(
  config: NormalizationConfig,
  options: ExpressNormalizationOptions = {}
) {
  const normalizationEngine = new NormalizationEngine(config);

  const {
    autoDetectPagination = true,
    extractRequestId,
    extractMetadata,
    onError,
  } = options;

  return (req: Request, res: Response, next: NextFunction) => {
    if (!config.enabled) {
      return next();
    }

    const originalSend = res.send;
    const originalJson = res.json;
    const startTime = Date.now();

    const createRequestContext = (): RequestContext => ({
      requestId: extractRequestId
        ? extractRequestId(req)
        : (req.headers['x-request-id'] as string) ||
          (req.headers['x-correlation-id'] as string) ||
          normalizationEngine.createRequestContext().requestId,
      timestamp: new Date(),
      startTime,
      userAgent: req.get('User-Agent'),
      ip: req.ip || req.connection.remoteAddress || 'unknown',
    });

    res.send = function (data: unknown) {
      if (res.headersSent) {
        return originalSend.call(this, data);
      }

      try {
        const context = createRequestContext();

        if (res.statusCode >= 400) {
          const errorResponse = normalizationEngine.normalizeError(
            typeof data === 'string' ? { message: data } : data,
            context,
            `HTTP_${res.statusCode}`
          );

          res.set('Content-Type', 'application/json');
          return originalSend.call(this, JSON.stringify(errorResponse));
        }

        if (typeof data === 'string') {
          try {
            data = JSON.parse(data);
          } catch {
            return originalSend.call(this, data);
          }
        }

        if (isAlreadyNormalized(data)) {
          return originalSend.call(this, JSON.stringify(data));
        }

        let pagination: PaginationMeta | undefined;
        if (autoDetectPagination) {
          pagination = extractPagination(data);
        }

        const successResponse = normalizationEngine.normalizeSuccess(
          data,
          context,
          pagination
        );

        res.set('Content-Type', 'application/json');
        return originalSend.call(this, JSON.stringify(successResponse));
      } catch (error) {
        console.error('Normalization middleware error:', error);

        if (onError) {
          onError(error, req, res);
        }

        return originalSend.call(this, data);
      }
    };

    res.json = function (data: unknown) {
      if (res.headersSent) {
        return originalJson.call(this, data);
      }

      try {
        const context = createRequestContext();

        if (res.statusCode >= 400) {
          const errorResponse = normalizationEngine.normalizeError(
            data,
            context,
            `HTTP_${res.statusCode}`
          );

          return originalJson.call(this, errorResponse);
        }

        if (isAlreadyNormalized(data)) {
          return originalJson.call(this, data);
        }

        let pagination: PaginationMeta | undefined;
        if (autoDetectPagination) {
          pagination = extractPagination(data);
        }

        const successResponse = normalizationEngine.normalizeSuccess(
          data,
          context,
          pagination
        );

        return originalJson.call(this, successResponse);
      } catch (error) {
        console.error('Normalization middleware error:', error);

        if (onError) {
          onError(error, req, res);
        }

        return originalJson.call(this, data);
      }
    };

    next();
  };
}

function isAlreadyNormalized(data: unknown): boolean {
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

function extractPagination(data: unknown): PaginationMeta | undefined {
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

export class ExpressNormalizationMiddleware {
  private normalizationEngine: NormalizationEngine;

  constructor(
    private config: NormalizationConfig,
    private options: ExpressNormalizationOptions = {}
  ) {
    this.normalizationEngine = new NormalizationEngine(config);
  }

  middleware() {
    return createNormalizationMiddleware(this.config, this.options);
  }

  updateConfig(newConfig: Partial<NormalizationConfig>) {
    Object.assign(this.config, newConfig);
    this.normalizationEngine = new NormalizationEngine(this.config);
  }

  createErrorHandler() {
    return (
      error: unknown,
      req: Request,
      res: Response,
      next: NextFunction
    ) => {
      if (res.headersSent) {
        return next(error);
      }

      const context: RequestContext = {
        requestId: (req.headers['x-request-id'] as string) || 'unknown',
        timestamp: new Date(),
        startTime: Date.now(),
        userAgent: req.get('User-Agent'),
        ip: req.ip || req.connection.remoteAddress || 'unknown',
      };

      const errorObj = error as Record<string, unknown>;
      const errorResponse = this.normalizationEngine.normalizeError(
        error,
        context,
        (errorObj.code as string) || 'INTERNAL_ERROR'
      );

      res
        .status(
          (errorObj.status as number) || (errorObj.statusCode as number) || 500
        )
        .json(errorResponse);
    };
  }
}
