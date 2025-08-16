import { NormalizationEngine } from './normalization-engine';
import { NormalizationConfig, RequestContext, PaginationMeta } from '../types';

describe('NormalizationEngine', () => {
  let normalizationEngine: NormalizationEngine;
  let mockConfig: NormalizationConfig;
  let mockContext: RequestContext;

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

    mockContext = {
      requestId: 'test-request-123',
      timestamp: new Date('2025-01-01T00:00:00Z'),
      startTime: Date.now(),
      userAgent: 'test-agent',
      ip: '127.0.0.1'
    };

    normalizationEngine = new NormalizationEngine(mockConfig);
  });

  describe('normalizeSuccess', () => {
    it('should normalize successful response with standard format', () => {
      const data = { id: 1, name: 'Test User' };
      const result = normalizationEngine.normalizeSuccess(data, mockContext);

      expect(result.success).toBe(true);
      expect(result.data).toEqual(data);
      expect(result.metadata).toBeDefined();
      expect(result.metadata.requestId).toBe('test-request-123');
      expect(result.metadata.timestamp).toBeDefined();
      expect(result.metadata.version).toBeDefined();
    });

    it('should include pagination when provided', () => {
      const data = [{ id: 1 }, { id: 2 }];
      const pagination: PaginationMeta = {
        page: 1,
        limit: 10,
        total: 50,
        totalPages: 5,
        hasNext: true,
        hasPrev: false
      };

      const result = normalizationEngine.normalizeSuccess(data, mockContext, pagination);

      expect(result.pagination).toEqual(pagination);
    });

    it('should handle detailed format', () => {
      mockConfig.format = 'detailed';
      normalizationEngine = new NormalizationEngine(mockConfig);

      const data = { id: 1, name: 'Test User' };
      const result = normalizationEngine.normalizeSuccess(data, mockContext);

      expect(result.success).toBe(true);
      expect(result.data).toEqual(data);
      expect(result.metadata.server).toBeDefined();
      expect(result.metadata.nodeVersion).toBeDefined();
    });

    it('should handle minimal format', () => {
      mockConfig.format = 'minimal';
      normalizationEngine = new NormalizationEngine(mockConfig);

      const data = { id: 1, name: 'Test User' };
      const result = normalizationEngine.normalizeSuccess(data, mockContext);

      expect(result.success).toBe(true);
      expect(result.data).toEqual(data);
      // Minimal format may not include metadata
      expect(result).toBeDefined();
    });
  });

  describe('normalizeError', () => {
    it('should normalize error response with standard format', () => {
      const error = new Error('Test error');
      const result = normalizationEngine.normalizeError(error, mockContext, 'VALIDATION_ERROR');

      expect(result.success).toBe(false);
      expect(result.error.code).toBe('VALIDATION_ERROR');
      expect(result.error.message).toBe('Test error');
      expect(result.error.requestId).toBe('test-request-123');
      expect(result.error.timestamp).toBeDefined();
      expect(result.metadata).toBeDefined();
    });

    it('should include stack trace in development', () => {
      mockConfig.includeDebugInfo = true;
      normalizationEngine = new NormalizationEngine(mockConfig);

      const error = new Error('Test error');
      const result = normalizationEngine.normalizeError(error, mockContext, 'TEST_ERROR');

      expect(result.error.stack).toBeDefined();
    });

    it('should handle detailed error format', () => {
      mockConfig.errorFormat = 'detailed';
      normalizationEngine = new NormalizationEngine(mockConfig);

      const error = new Error('Test error');
      const result = normalizationEngine.normalizeError(error, mockContext, 'VALIDATION_ERROR');

      expect(result.error.helpUrl).toBeDefined();
      expect(result.error.possibleCauses).toBeDefined();
      expect(result.metadata.server).toBeDefined();
    });

    it('should handle simple error format', () => {
      mockConfig.errorFormat = 'simple';
      normalizationEngine = new NormalizationEngine(mockConfig);

      const error = new Error('Test error');
      const result = normalizationEngine.normalizeError(error, mockContext, 'TEST_ERROR');

      expect(result.error.code).toBe('TEST_ERROR');
      expect(result.error.message).toBe('Test error');
      expect(result.error.helpUrl).toBeUndefined();
    });

    it('should handle non-Error objects', () => {
      const errorString = 'String error';
      const result = normalizationEngine.normalizeError(errorString, mockContext, 'STRING_ERROR');

      expect(result.error.message).toBe('String error');
      expect(result.error.code).toBe('STRING_ERROR');
    });
  });

  describe('disabled normalization', () => {
    beforeEach(() => {
      mockConfig.enabled = false;
      normalizationEngine = new NormalizationEngine(mockConfig);
    });

    it('should return minimal response when disabled', () => {
      const data = { id: 1, name: 'Test User' };
      const result = normalizationEngine.normalizeSuccess(data, mockContext);

      expect(result.success).toBe(true);
      expect(result.data).toEqual(data);
      expect(result.metadata).toBeDefined();
      expect(result.metadata.requestId).toBeDefined();
      expect(result.metadata.timestamp).toBeDefined();
    });
  });

  describe('createMetadata', () => {
    it('should create metadata with processing time', () => {
      const result = normalizationEngine.normalizeSuccess({ test: 'data' }, mockContext);
      
      expect(result.metadata.processingTime).toBeDefined();
      expect(typeof result.metadata.processingTime).toBe('number');
      expect(result.metadata.processingTime).toBeGreaterThanOrEqual(0);
    });

    it('should include version information', () => {
      const result = normalizationEngine.normalizeSuccess({ test: 'data' }, mockContext);
      
      expect(result.metadata.version).toBeDefined();
      expect(typeof result.metadata.version).toBe('string');
    });
  });
});