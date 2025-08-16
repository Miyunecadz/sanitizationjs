import { SanitizationRule, SecurityViolationType } from '../types';

export const DEFAULT_SANITIZATION_RULES: Record<string, SanitizationRule> = {
  html: {
    name: 'html',
    pattern: /<[^>]*>/g,
    transform: (value: string) => value.replace(/<[^>]*>/g, ''),
    validate: (value: string) => !/<[^>]*>/.test(value),
    description: 'Removes HTML tags from input'
  },

  script: {
    name: 'script',
    pattern: /<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi,
    transform: (value: string) => value.replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, ''),
    validate: (value: string) => !/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi.test(value),
    description: 'Removes script tags to prevent XSS'
  },

  sql: {
    name: 'sql',
    pattern: /(\b(ALTER|CREATE|DELETE|DROP|EXEC(UTE)?|INSERT|SELECT|UNION|UPDATE)\b)/gi,
    validate: (value: string) => !/(\b(ALTER|CREATE|DELETE|DROP|EXEC(UTE)?|INSERT|SELECT|UNION|UPDATE)\b)/gi.test(value),
    description: 'Detects potential SQL injection patterns'
  },

  xss: {
    name: 'xss',
    pattern: /(javascript:|vbscript:|onload|onerror|onclick|onmouseover)/gi,
    transform: (value: string) => value.replace(/(javascript:|vbscript:|onload|onerror|onclick|onmouseover)/gi, ''),
    validate: (value: string) => !/(javascript:|vbscript:|onload|onerror|onclick|onmouseover)/gi.test(value),
    description: 'Removes common XSS attack vectors'
  },

  trim: {
    name: 'trim',
    transform: (value: string) => value.trim(),
    validate: () => true,
    description: 'Removes leading and trailing whitespace'
  },

  'email-normalize': {
    name: 'email-normalize',
    pattern: /^[^\s@]+@[^\s@]+\.[^\s@]+$/,
    transform: (value: string) => value.toLowerCase().trim(),
    validate: (value: string) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value),
    description: 'Normalizes email addresses to lowercase'
  },

  'phone-normalize': {
    name: 'phone-normalize',
    pattern: /^\+?[\d\s\-\(\)]+$/,
    transform: (value: string) => value.replace(/[\s\-\(\)]/g, ''),
    validate: (value: string) => /^\+?[\d]+$/.test(value.replace(/[\s\-\(\)]/g, '')),
    description: 'Normalizes phone numbers by removing formatting'
  },

  'url-validate': {
    name: 'url-validate',
    pattern: /^https?:\/\/(www\.)?[-a-zA-Z0-9@:%._\+~#=]{1,256}\.[a-zA-Z0-9()]{1,6}\b([-a-zA-Z0-9()@:%_\+.~#?&//=]*)$/,
    validate: (value: string) => /^https?:\/\/(www\.)?[-a-zA-Z0-9@:%._\+~#=]{1,256}\.[a-zA-Z0-9()]{1,6}\b([-a-zA-Z0-9()@:%_\+.~#?&//=]*)$/.test(value),
    description: 'Validates URL format'
  },

  'path-traversal': {
    name: 'path-traversal',
    pattern: /(\.\.[\/\\]|\.\.%2f|\.\.%5c)/gi,
    validate: (value: string) => !/(\.\.[\/\\]|\.\.%2f|\.\.%5c)/gi.test(value),
    description: 'Detects path traversal attempts'
  },

  'command-injection': {
    name: 'command-injection',
    pattern: /[;&|`$(){}[\]]/g,
    transform: (value: string) => value.replace(/[;&|`$(){}[\]]/g, ''),
    validate: (value: string) => !/[;&|`$(){}[\]]/.test(value),
    description: 'Removes command injection characters'
  }
};

export function getSecurityViolationType(ruleName: string): SecurityViolationType {
  const typeMap: Record<string, SecurityViolationType> = {
    'html': SecurityViolationType.HTML_INJECTION,
    'script': SecurityViolationType.SCRIPT_INJECTION,
    'xss': SecurityViolationType.XSS,
    'sql': SecurityViolationType.SQL_INJECTION,
    'path-traversal': SecurityViolationType.PATH_TRAVERSAL,
    'command-injection': SecurityViolationType.COMMAND_INJECTION
  };

  return typeMap[ruleName] || SecurityViolationType.XSS;
}

export function getViolationSeverity(violationType: SecurityViolationType): 'low' | 'medium' | 'high' | 'critical' {
  const severityMap: Record<SecurityViolationType, 'low' | 'medium' | 'high' | 'critical'> = {
    [SecurityViolationType.XSS]: 'high',
    [SecurityViolationType.SQL_INJECTION]: 'critical',
    [SecurityViolationType.HTML_INJECTION]: 'medium',
    [SecurityViolationType.SCRIPT_INJECTION]: 'critical',
    [SecurityViolationType.PATH_TRAVERSAL]: 'high',
    [SecurityViolationType.COMMAND_INJECTION]: 'critical'
  };

  return severityMap[violationType] || 'medium';
}