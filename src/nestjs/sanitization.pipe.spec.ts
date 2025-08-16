import { BadRequestException } from '@nestjs/common';
import { SanitizationPipe } from './sanitization.pipe';
import { SanitizationEngine } from '../core/sanitization-engine';
import { SanitizationConfig } from '../types';

describe('SanitizationPipe', () => {
  let pipe: SanitizationPipe;
  let mockConfig: SanitizationConfig;
  let mockSanitizationEngine: jest.Mocked<SanitizationEngine>;

  beforeEach(() => {
    mockConfig = {
      enabled: true,
      rules: ['html', 'script', 'xss', 'trim'],
      customRules: [],
      strictMode: false,
      logViolations: true,
      rejectOnViolation: false,
    };

    mockSanitizationEngine = {
      sanitize: jest.fn().mockImplementation((input) => ({
        sanitized: typeof input === 'string' ? input.replace(/<[^>]*>/g, '').trim() : input,
        violations: [],
        appliedRules: ['html', 'trim']
      }))
    } as any;

    pipe = new SanitizationPipe(mockSanitizationEngine, mockConfig);
  });

  describe('transform', () => {
    it('should sanitize input data', async () => {
      const input = {
        name: '<script>alert("xss")</script>John Doe',
        email: '  john@example.com  ',
        bio: '<div>Developer</div>'
      };

      mockSanitizationEngine.sanitize.mockReturnValue({
        sanitized: {
          name: 'John Doe',
          email: 'john@example.com',
          bio: 'Developer'
        },
        violations: [],
        appliedRules: ['html', 'trim']
      });

      const result = await pipe.transform(input, { type: 'body' });

      expect(result.name).toBe('John Doe');
      expect(result.email).toBe('john@example.com');
      expect(result.bio).toBe('Developer');
    });

    it('should handle string inputs', async () => {
      const input = '<script>alert("test")</script>Hello World';
      
      mockSanitizationEngine.sanitize.mockReturnValue({
        sanitized: 'Hello World',
        violations: [],
        appliedRules: ['html']
      });
      
      const result = await pipe.transform(input, { type: 'body' });

      expect(result).toBe('Hello World');
    });

    it('should handle array inputs', async () => {
      const input = [
        '<script>test</script>Item 1',
        '  Item 2  ',
        { name: '<div>Item 3</div>' }
      ];

      mockSanitizationEngine.sanitize.mockReturnValue({
        sanitized: [
          'Item 1',
          'Item 2',
          { name: 'Item 3' }
        ],
        violations: [],
        appliedRules: ['html', 'trim']
      });

      const result = await pipe.transform(input, { type: 'body' });

      expect(result[0]).toBe('Item 1');
      expect(result[1]).toBe('Item 2');
      expect(result[2].name).toBe('Item 3');
    });

    it('should return null/undefined unchanged', async () => {
      expect(await pipe.transform(null, { type: 'body' })).toBeNull();
      expect(await pipe.transform(undefined, { type: 'body' })).toBeUndefined();
    });

    it('should handle primitive values', async () => {
      expect(await pipe.transform(123, { type: 'body' })).toBe(123);
      expect(await pipe.transform(true, { type: 'body' })).toBe(true);
    });
  });

  describe('with strict mode and rejection enabled', () => {
    beforeEach(() => {
      mockConfig.strictMode = true;
      mockConfig.rejectOnViolation = true;
      pipe = new SanitizationPipe(mockSanitizationEngine, mockConfig);
    });

    it('should throw BadRequestException on violations', async () => {
      const input = '<script>alert("xss")</script>';
      
      mockSanitizationEngine.sanitize.mockImplementation(() => {
        throw new Error('Security violation detected');
      });

      await expect(pipe.transform(input, { type: 'body' })).rejects.toThrow(BadRequestException);
    });

    it('should include error details in exception', async () => {
      const input = '<script>alert("xss")</script>';
      
      mockSanitizationEngine.sanitize.mockImplementation(() => {
        throw new Error('Security violation');
      });

      try {
        await pipe.transform(input, { type: 'body' });
      } catch (error: any) {
        expect(error).toBeInstanceOf(BadRequestException);
        expect(error.message).toContain('sanitization failed');
      }
    });
  });

  describe('with disabled sanitization', () => {
    beforeEach(() => {
      mockConfig.enabled = false;
      pipe = new SanitizationPipe(mockSanitizationEngine, mockConfig);
    });

    it('should return input unchanged when disabled', async () => {
      const input = '<script>alert("xss")</script>';
      const result = await pipe.transform(input, { type: 'body' });

      expect(result).toBe(input);
    });
  });

  describe('error handling', () => {
    it('should handle sanitization engine errors gracefully', async () => {
      const input = { toString: () => { throw new Error('Test error'); } };
      
      mockSanitizationEngine.sanitize.mockImplementation(() => {
        throw new Error('Test error');
      });

      await expect(pipe.transform(input, { type: 'body' })).rejects.toThrow(BadRequestException);
    });
  });
});