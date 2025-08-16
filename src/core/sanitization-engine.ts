import { Injectable } from '@nestjs/common';
import * as DOMPurify from 'dompurify';
import { JSDOM } from 'jsdom';
import { 
  SanitizationRule, 
  SanitizationResult, 
  SecurityViolation, 
  SanitizationConfig,
  SecurityViolationType 
} from '../types';
import { 
  DEFAULT_SANITIZATION_RULES, 
  getSecurityViolationType, 
  getViolationSeverity 
} from './sanitization-rules';

@Injectable()
export class SanitizationEngine {
  private readonly window = new JSDOM('').window;
  private readonly purify = DOMPurify.default(this.window);
  private readonly rulesCache = new Map<string, SanitizationRule>();
  private readonly compiledRulesCache = new Map<string, SanitizationRule[]>();

  constructor(private readonly config: SanitizationConfig) {
    this.initializeRules();
  }

  private initializeRules(): void {
    Object.values(DEFAULT_SANITIZATION_RULES).forEach(rule => {
      this.rulesCache.set(rule.name, rule);
    });

    this.config.customRules.forEach(rule => {
      this.rulesCache.set(rule.name, rule);
    });
  }

  sanitize(data: any, rules: string[] = this.config.rules): SanitizationResult {
    const violations: SecurityViolation[] = [];
    const appliedRules: string[] = [];
    const cacheKey = rules.sort().join(',');

    let compiledRules = this.compiledRulesCache.get(cacheKey);
    if (!compiledRules) {
      compiledRules = rules.map(ruleName => this.rulesCache.get(ruleName))
        .filter(rule => rule !== undefined) as SanitizationRule[];
      this.compiledRulesCache.set(cacheKey, compiledRules);
    }

    const sanitized = this.sanitizeValue(data, compiledRules, '', violations, appliedRules);

    if (this.config.strictMode && violations.length > 0) {
      if (this.config.rejectOnViolation) {
        throw new Error(`Sanitization violations detected: ${violations.map(v => v.type).join(', ')}`);
      }
    }

    if (this.config.logViolations && violations.length > 0) {
      console.warn('Sanitization violations detected:', violations);
    }

    return {
      sanitized,
      violations: violations.map(v => `${v.field}: ${v.type}`),
      appliedRules
    };
  }

  private sanitizeValue(
    value: any, 
    rules: SanitizationRule[], 
    fieldPath: string,
    violations: SecurityViolation[],
    appliedRules: string[]
  ): any {
    if (value === null || value === undefined) {
      return value;
    }

    if (typeof value === 'string') {
      return this.sanitizeString(value, rules, fieldPath, violations, appliedRules);
    }

    if (Array.isArray(value)) {
      return value.map((item, index) => 
        this.sanitizeValue(item, rules, `${fieldPath}[${index}]`, violations, appliedRules)
      );
    }

    if (typeof value === 'object') {
      const sanitizedObj: any = {};
      for (const [key, val] of Object.entries(value)) {
        const newFieldPath = fieldPath ? `${fieldPath}.${key}` : key;
        sanitizedObj[key] = this.sanitizeValue(val, rules, newFieldPath, violations, appliedRules);
      }
      return sanitizedObj;
    }

    return value;
  }

  private sanitizeString(
    value: string, 
    rules: SanitizationRule[], 
    fieldPath: string,
    violations: SecurityViolation[],
    appliedRules: string[]
  ): string {
    let sanitized = value;

    for (const rule of rules) {
      const originalValue = sanitized;

      if (rule.validate && !rule.validate(sanitized)) {
        const violationType = getSecurityViolationType(rule.name);
        violations.push({
          type: violationType,
          field: fieldPath,
          originalValue,
          sanitizedValue: sanitized,
          rule: rule.name,
          severity: getViolationSeverity(violationType)
        });
      }

      if (rule.transform) {
        sanitized = rule.transform(sanitized);
        if (sanitized !== originalValue) {
          appliedRules.push(rule.name);
        }
      }

      if (rule.name === 'html' && sanitized.includes('<')) {
        sanitized = this.purify.sanitize(sanitized, { 
          ALLOWED_TAGS: [],
          ALLOWED_ATTR: []
        });
      }
    }

    return sanitized;
  }

  addCustomRule(rule: SanitizationRule): void {
    this.rulesCache.set(rule.name, rule);
    this.compiledRulesCache.clear();
  }

  removeRule(ruleName: string): void {
    this.rulesCache.delete(ruleName);
    this.compiledRulesCache.clear();
  }

  getRules(): SanitizationRule[] {
    return Array.from(this.rulesCache.values());
  }

  validateConfig(config: SanitizationConfig): boolean {
    const availableRules = Array.from(this.rulesCache.keys());
    const invalidRules = config.rules.filter(rule => !availableRules.includes(rule));
    
    if (invalidRules.length > 0) {
      throw new Error(`Invalid sanitization rules: ${invalidRules.join(', ')}`);
    }

    return true;
  }
}