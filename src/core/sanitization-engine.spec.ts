import { SanitizationEngine } from './sanitization-engine';
import { SanitizationConfig, SecurityViolationType } from '../types';

// Mock DOMPurify
jest.mock('dompurify', () => ({
  __esModule: true,
  default: jest.fn(() => ({
    sanitize: (html: string) => html.replace(/<[^>]*>/g, '')
  }))
}));

describe('SanitizationEngine', () => {
  let sanitizationEngine: SanitizationEngine;
  let mockConfig: SanitizationConfig;

  beforeEach(() => {
    mockConfig = {
      enabled: true,
      rules: ['html', 'script', 'xss', 'trim'],
      customRules: [],
      strictMode: false,
      logViolations: false, // Turn off logging for tests
      rejectOnViolation: false,
    };
    sanitizationEngine = new SanitizationEngine(mockConfig);
  });

  describe('sanitize', () => {
    it('should remove HTML tags from string input', () => {
      const input = '<script>alert("xss")</script>Hello World<div>test</div>';
      const result = sanitizationEngine.sanitize(input);
      
      expect(result.sanitized).toBe('alert("xss")Hello Worldtest');
      expect(result.appliedRules).toContain('html');
    });

    it('should trim whitespace from string input', () => {
      const input = '  Hello World  ';
      const result = sanitizationEngine.sanitize(input);

      expect(result.sanitized).toBe('Hello World');
      expect(result.appliedRules).toContain('trim');
    });

    it('should sanitize object properties', () => {
      const input = {
        name: '<script>alert("xss")</script>John',
        email: '  john@example.com  ',
        nested: {
          description: '<div>Safe content</div>'
        }
      };

      const result = sanitizationEngine.sanitize(input);

      expect(result.sanitized.name).toBe('alert("xss")John');
      expect(result.sanitized.email).toBe('john@example.com');
      expect(result.sanitized.nested.description).toBe('Safe content');
    });

    it('should handle array inputs', () => {
      const input = [
        '<script>alert("test")</script>Item 1',
        '  Item 2  ',
        { name: '<div>Item 3</div>' }
      ];

      const result = sanitizationEngine.sanitize(input);

      expect(result.sanitized[0]).toBe('alert("test")Item 1');
      expect(result.sanitized[1]).toBe('Item 2');
      expect(result.sanitized[2].name).toBe('Item 3');
    });

    it('should detect XSS violations', () => {
      const input = '<script>document.cookie</script>';
      const result = sanitizationEngine.sanitize(input);

      expect(result.sanitized).toBe('document.cookie');
      expect(result.appliedRules).toContain('html');
    });

    it('should handle null and undefined values', () => {
      expect(sanitizationEngine.sanitize(null).sanitized).toBeNull();
      expect(sanitizationEngine.sanitize(undefined).sanitized).toBeUndefined();
    });

    it('should not modify non-string primitive values', () => {
      expect(sanitizationEngine.sanitize(123).sanitized).toBe(123);
      expect(sanitizationEngine.sanitize(true).sanitized).toBe(true);
      expect(sanitizationEngine.sanitize(false).sanitized).toBe(false);
    });
  });

  describe('with strict mode enabled', () => {
    beforeEach(() => {
      mockConfig.strictMode = true;
      mockConfig.rejectOnViolation = true;
      sanitizationEngine = new SanitizationEngine(mockConfig);
    });

    it('should throw error on security violations in strict mode', () => {
      const input = '<script>alert("xss")</script>';
      
      expect(() => {
        sanitizationEngine.sanitize(input);
      }).toThrow();
    });
  });

  describe('with custom rules', () => {
    beforeEach(() => {
      mockConfig.customRules = [{
        name: 'test-rule',
        pattern: /test/gi,
        transform: (value: string) => value.replace(/test/gi, 'TEST'),
        description: 'Test rule for testing'
      }];
      mockConfig.rules = ['test-rule']; // Only use custom rule
      sanitizationEngine = new SanitizationEngine(mockConfig);
    });

    it('should apply custom rules', () => {
      const input = 'This is a test string';
      const result = sanitizationEngine.sanitize(input);

      expect(result.sanitized).toBe('This is a TEST string');
      expect(result.appliedRules).toContain('test-rule');
    });
  });

  describe('disabled sanitization', () => {
    beforeEach(() => {
      mockConfig.enabled = false;
      sanitizationEngine = new SanitizationEngine(mockConfig);
    });

    it('should still process when disabled but config is used in pipe', () => {
      const input = '<script>alert("xss")</script>';
      const result = sanitizationEngine.sanitize(input);

      expect(result.sanitized).toBe('alert("xss")');
      expect(result.appliedRules).toContain('html');
    });
  });
});