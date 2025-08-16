import { Request, Response, NextFunction } from 'express';
import { createSanitizationMiddleware } from './sanitization.middleware';
import { SanitizationConfig } from '../types';

// Mock DOMPurify
jest.mock('dompurify', () => ({
  __esModule: true,
  default: jest.fn(() => ({
    sanitize: (html: string) => html.replace(/<[^>]*>/g, '')
  }))
}));

describe('SanitizationMiddleware', () => {
  let mockConfig: SanitizationConfig;
  let mockReq: Partial<Request>;
  let mockRes: Partial<Response>;
  let mockNext: NextFunction;

  beforeEach(() => {
    mockConfig = {
      enabled: true,
      rules: ['html', 'script', 'xss', 'trim'],
      customRules: [],
      strictMode: false,
      logViolations: false, // Turn off logging for tests
      rejectOnViolation: false,
    };

    mockReq = {
      body: {},
      query: {},
      params: {},
      headers: {
        'x-request-id': 'test-request-123'
      }
    };

    mockRes = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn().mockReturnThis(),
    };

    mockNext = jest.fn();
  });

  describe('body sanitization', () => {
    it('should sanitize request body', () => {
      const middleware = createSanitizationMiddleware(mockConfig);
      mockReq.body = {
        name: '<script>alert("xss")</script>John Doe',
        email: '  john@example.com  ',
        bio: '<div>Developer</div>'
      };

      middleware(mockReq as Request, mockRes as Response, mockNext);

      expect(mockReq.body.name).toBe('alert(\"xss\")John Doe');
      expect(mockReq.body.email).toBe('john@example.com');
      expect(mockReq.body.bio).toBe('Developer');
      expect(mockNext).toHaveBeenCalled();
    });

    it('should handle array bodies', () => {
      const middleware = createSanitizationMiddleware(mockConfig);
      mockReq.body = [
        '<script>test</script>Item 1',
        '  Item 2  ',
        { name: '<div>Item 3</div>' }
      ];

      middleware(mockReq as Request, mockRes as Response, mockNext);

      expect(mockReq.body[0]).toBe('testItem 1');
      expect(mockReq.body[1]).toBe('Item 2');
      expect(mockReq.body[2].name).toBe('Item 3');
      expect(mockNext).toHaveBeenCalled();
    });

    it('should handle empty/null bodies', () => {
      const middleware = createSanitizationMiddleware(mockConfig);
      mockReq.body = null;

      middleware(mockReq as Request, mockRes as Response, mockNext);

      expect(mockReq.body).toBeNull();
      expect(mockNext).toHaveBeenCalled();
    });
  });

  describe('query sanitization', () => {
    it('should sanitize query parameters', () => {
      const middleware = createSanitizationMiddleware(mockConfig);
      mockReq.query = {
        search: '<script>alert("xss")</script>test query',
        filter: '  category  '
      };

      middleware(mockReq as Request, mockRes as Response, mockNext);

      expect(mockReq.query.search).toBe('alert("xss")test query');
      expect(mockReq.query.filter).toBe('category');
      expect(mockNext).toHaveBeenCalled();
    });

    it('should handle array query parameters', () => {
      const middleware = createSanitizationMiddleware(mockConfig);
      mockReq.query = {
        tags: ['<script>tag1</script>', '  tag2  ', '<div>tag3</div>']
      };

      middleware(mockReq as Request, mockRes as Response, mockNext);

      expect((mockReq.query.tags as string[])[0]).toBe('tag1');
      expect((mockReq.query.tags as string[])[1]).toBe('tag2');
      expect((mockReq.query.tags as string[])[2]).toBe('tag3');
      expect(mockNext).toHaveBeenCalled();
    });
  });

  describe('params sanitization', () => {
    it('should sanitize route parameters', () => {
      const middleware = createSanitizationMiddleware(mockConfig);
      mockReq.params = {
        id: '<script>123</script>',
        slug: '  test-slug  '
      };

      middleware(mockReq as Request, mockRes as Response, mockNext);

      expect(mockReq.params.id).toBe('123');
      expect(mockReq.params.slug).toBe('test-slug');
      expect(mockNext).toHaveBeenCalled();
    });
  });

  describe('with strict mode and rejection enabled', () => {
    beforeEach(() => {
      mockConfig.strictMode = true;
      mockConfig.rejectOnViolation = true;
    });

    it('should return 400 error on violations', () => {
      const middleware = createSanitizationMiddleware(mockConfig);
      mockReq.body = {
        content: '<script>alert("xss")</script>'
      };

      middleware(mockReq as Request, mockRes as Response, mockNext);

      expect(mockRes.status).toHaveBeenCalledWith(500);
      expect(mockRes.json).toHaveBeenCalledWith(
        expect.objectContaining({
          success: false,
          error: expect.objectContaining({
            code: 'SANITIZATION_ERROR',
            message: 'Internal sanitization error'
          })
        })
      );
      expect(mockNext).not.toHaveBeenCalled();
    });

    it('should continue processing when no violations found', () => {
      const middleware = createSanitizationMiddleware(mockConfig);
      mockReq.body = {
        content: 'Safe content'
      };

      middleware(mockReq as Request, mockRes as Response, mockNext);

      expect(mockRes.status).not.toHaveBeenCalled();
      expect(mockRes.json).not.toHaveBeenCalled();
      expect(mockNext).toHaveBeenCalled();
    });
  });

  describe('with disabled sanitization', () => {
    beforeEach(() => {
      mockConfig.enabled = false;
    });

    it('should pass through without modification when disabled', () => {
      const middleware = createSanitizationMiddleware(mockConfig);
      const originalBody = {
        content: '<script>alert("xss")</script>'
      };
      mockReq.body = { ...originalBody };

      middleware(mockReq as Request, mockRes as Response, mockNext);

      expect(mockReq.body).toEqual(originalBody);
      expect(mockNext).toHaveBeenCalled();
    });
  });

});