import { Request, Response, NextFunction } from 'express';
import { createNormalizationMiddleware } from './normalization.middleware';
import { NormalizationConfig } from '../types';

describe('NormalizationMiddleware', () => {
  let mockConfig: NormalizationConfig;
  let mockReq: Partial<Request>;
  let mockRes: Partial<Response>;
  let mockNext: NextFunction;
  let originalJson: jest.Mock;
  let originalStatus: jest.Mock;

  beforeEach(() => {
    mockConfig = {
      enabled: true,
      format: 'standard',
      includeMetadata: true,
      errorFormat: 'standard',
      includeDebugInfo: false,
      compressResponses: false,
      includeLinks: false,
    };

    originalJson = jest.fn();
    originalStatus = jest.fn().mockImplementation((code: number) => {
      mockRes.statusCode = code;
      return mockRes;
    });

    mockReq = {
      headers: { 'user-agent': 'test-agent' },
      ip: '127.0.0.1',
      method: 'GET',
      path: '/test',
      get: jest.fn((header: string) => {
        if (header === 'user-agent') return 'test-agent';
        if (header === 'x-forwarded-for') return '127.0.0.1';
        if (header === 'set-cookie') return [];
        return undefined;
      }) as any
    };

    mockRes = {
      json: originalJson,
      status: originalStatus,
      locals: {},
      statusCode: 200,
      headersSent: false,
      set: jest.fn()
    };

    mockNext = jest.fn();
  });

  describe('response normalization', () => {
    it('should normalize successful responses', () => {
      const middleware = createNormalizationMiddleware(mockConfig);
      middleware(mockReq as Request, mockRes as Response, mockNext);

      const responseData = { id: 1, name: 'Test User' };
      mockRes.json!(responseData);

      expect(originalJson).toHaveBeenCalledWith(
        expect.objectContaining({
          success: true,
          data: responseData,
          metadata: expect.objectContaining({
            requestId: expect.any(String),
            timestamp: expect.any(String),
            version: expect.any(String)
          })
        })
      );
    });

    it('should handle array responses', () => {
      const middleware = createNormalizationMiddleware(mockConfig);
      middleware(mockReq as Request, mockRes as Response, mockNext);

      const responseData = [{ id: 1 }, { id: 2 }];
      mockRes.json!(responseData);

      expect(originalJson).toHaveBeenCalledWith(
        expect.objectContaining({
          success: true,
          data: responseData,
          metadata: expect.any(Object)
        })
      );
    });

    it('should detect pagination responses', () => {
      const middleware = createNormalizationMiddleware(mockConfig);
      middleware(mockReq as Request, mockRes as Response, mockNext);

      const responseData = {
        data: [{ id: 1 }, { id: 2 }],
        pagination: {
          page: 1,
          limit: 10,
          total: 50,
          totalPages: 5,
          hasNext: true,
          hasPrev: false
        }
      };
      mockRes.json!(responseData);

      expect(originalJson).toHaveBeenCalledWith(
        expect.objectContaining({
          success: true,
          data: expect.any(Object),
          pagination: expect.any(Object),
          metadata: expect.any(Object)
        })
      );
    });

    it('should pass through already normalized responses', () => {
      const middleware = createNormalizationMiddleware(mockConfig);
      middleware(mockReq as Request, mockRes as Response, mockNext);

      const normalizedResponse = {
        success: true,
        data: { id: 1 },
        metadata: {
          timestamp: '2025-01-01T00:00:00Z',
          requestId: 'test-123',
          version: 'v1'
        }
      };
      mockRes.json!(normalizedResponse);

      expect(originalJson).toHaveBeenCalledWith(normalizedResponse);
    });
  });

  describe('error response normalization', () => {
    it('should normalize error responses with status codes', () => {
      const middleware = createNormalizationMiddleware(mockConfig);
      middleware(mockReq as Request, mockRes as Response, mockNext);

      mockRes.status!(400);
      const errorData = { message: 'Validation failed' };
      mockRes.json!(errorData);

      expect(originalJson).toHaveBeenCalledWith(
        expect.objectContaining({
          success: false,
          error: expect.objectContaining({
            code: 'HTTP_400',
            message: 'Validation failed',
            requestId: expect.any(String),
            timestamp: expect.any(String)
          }),
          metadata: expect.any(Object)
        })
      );
    });

    it('should handle different status codes', () => {
      const middleware = createNormalizationMiddleware(mockConfig);
      middleware(mockReq as Request, mockRes as Response, mockNext);

      mockRes.status!(404);
      const errorData = { message: 'Not found' };
      mockRes.json!(errorData);

      expect(originalJson).toHaveBeenCalledWith(
        expect.objectContaining({
          success: false,
          error: expect.objectContaining({
            code: 'HTTP_404',
            message: 'Not found'
          })
        })
      );
    });

    it('should handle server errors', () => {
      const middleware = createNormalizationMiddleware(mockConfig);
      middleware(mockReq as Request, mockRes as Response, mockNext);

      mockRes.status!(500);
      const errorData = { message: 'Internal server error' };
      mockRes.json!(errorData);

      expect(originalJson).toHaveBeenCalledWith(
        expect.objectContaining({
          success: false,
          error: expect.objectContaining({
            code: 'HTTP_500',
            message: 'Internal server error'
          })
        })
      );
    });
  });

  describe('with different formats', () => {
    it('should apply detailed format', () => {
      mockConfig.format = 'detailed';
      const middleware = createNormalizationMiddleware(mockConfig);
      middleware(mockReq as Request, mockRes as Response, mockNext);

      const responseData = { id: 1 };
      mockRes.json!(responseData);

      expect(originalJson).toHaveBeenCalledWith(
        expect.objectContaining({
          success: true,
          data: responseData,
          metadata: expect.objectContaining({
            server: expect.any(String),
            nodeVersion: expect.any(String)
          })
        })
      );
    });

    it('should apply minimal format', () => {
      mockConfig.format = 'minimal';
      mockConfig.includeMetadata = false;
      const middleware = createNormalizationMiddleware(mockConfig);
      middleware(mockReq as Request, mockRes as Response, mockNext);

      const responseData = { id: 1 };
      mockRes.json!(responseData);

      const calledWith = originalJson.mock.calls[0][0];
      expect(calledWith.success).toBe(true);
      expect(calledWith.data).toEqual(responseData);
      // Minimal format might not include metadata
      expect(calledWith).toBeDefined();
    });
  });

  describe('with disabled normalization', () => {
    beforeEach(() => {
      mockConfig.enabled = false;
    });

    it('should pass through responses unchanged when disabled', () => {
      const middleware = createNormalizationMiddleware(mockConfig);
      middleware(mockReq as Request, mockRes as Response, mockNext);

      const responseData = { id: 1, name: 'Test User' };
      mockRes.json!(responseData);

      expect(originalJson).toHaveBeenCalledWith(responseData);
    });
  });

  describe('request context', () => {
    it('should create request context with proper values', () => {
      const middleware = createNormalizationMiddleware(mockConfig);
      middleware(mockReq as Request, mockRes as Response, mockNext);

      const responseData = { id: 1 };
      mockRes.json!(responseData);

      const calledWith = originalJson.mock.calls[0][0];
      expect(calledWith.metadata.requestId).toBeDefined();
      expect(calledWith.metadata.timestamp).toBeDefined();
      expect(calledWith.metadata.processingTime).toBeGreaterThanOrEqual(0);
    });

    it('should handle missing request properties gracefully', () => {
      mockReq = {
        headers: {},
        get: jest.fn().mockReturnValue(undefined),
        ip: undefined,
        connection: { remoteAddress: undefined } as any
      };
      const middleware = createNormalizationMiddleware(mockConfig);
      middleware(mockReq as Request, mockRes as Response, mockNext);

      const responseData = { id: 1 };
      mockRes.json!(responseData);

      const calledWith = originalJson.mock.calls[0][0];
      expect(calledWith.success).toBe(true);
      expect(calledWith.metadata.requestId).toBeDefined();
    });
  });

  describe('middleware behavior', () => {
    it('should call next() to continue middleware chain', () => {
      const middleware = createNormalizationMiddleware(mockConfig);
      middleware(mockReq as Request, mockRes as Response, mockNext);

      expect(mockNext).toHaveBeenCalled();
    });

    it('should preserve original response methods', () => {
      const middleware = createNormalizationMiddleware(mockConfig);
      middleware(mockReq as Request, mockRes as Response, mockNext);

      expect(typeof mockRes.json).toBe('function');
      expect(typeof mockRes.status).toBe('function');
    });
  });
});