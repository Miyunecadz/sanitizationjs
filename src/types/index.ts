export interface SanitizationRule {
  name: string;
  pattern?: RegExp;
  transform?: (value: string) => string;
  validate?: (value: string) => boolean;
  description?: string;
}

export interface SanitizationConfig {
  enabled: boolean;
  rules: string[];
  customRules: SanitizationRule[];
  strictMode: boolean;
  logViolations: boolean;
  rejectOnViolation?: boolean;
}

export interface NormalizationConfig {
  enabled: boolean;
  format: 'minimal' | 'standard' | 'detailed';
  includeMetadata: boolean;
  errorFormat: 'simple' | 'standard' | 'detailed';
  includeDebugInfo?: boolean;
  compressResponses?: boolean;
  includeLinks?: boolean;
}

export interface PerformanceConfig {
  enableCaching: boolean;
  maxCacheSize: number;
  enableMetrics: boolean;
}

export interface SanitizationModuleConfig {
  sanitization: SanitizationConfig;
  normalization: NormalizationConfig;
  performance: PerformanceConfig;
}

export interface PaginationMeta {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
  hasNext: boolean;
  hasPrev: boolean;
  links?: {
    first?: string;
    prev?: string;
    next?: string;
    last?: string;
  };
}

export interface ResponseMetadata {
  timestamp: string;
  requestId: string;
  version: string;
  processingTime?: number;
  server?: string;
  nodeVersion?: string;
}

export interface SuccessResponse<T> {
  success: true;
  data: T;
  metadata: ResponseMetadata;
  pagination?: PaginationMeta;
}

export interface ErrorResponse {
  success: false;
  error: {
    code: string;
    message: string;
    details?: any;
    timestamp: string;
    requestId: string;
    stack?: string;
    helpUrl?: string;
    possibleCauses?: string[];
  };
  metadata: ResponseMetadata;
}

export type ApiResponse<T> = SuccessResponse<T> | ErrorResponse;

export interface SanitizationOptions {
  rules?: string[];
  customRules?: string[];
  strictMode?: boolean;
}

export interface NormalizationOptions {
  format?: 'minimal' | 'standard' | 'detailed';
  includeLinks?: boolean;
  includeMetadata?: boolean;
}

export interface SanitizationResult {
  sanitized: any;
  violations: string[];
  appliedRules: string[];
}

export interface RequestContext {
  requestId: string;
  timestamp: Date;
  startTime: number;
  userAgent?: string;
  ip?: string;
}

export enum SecurityViolationType {
  XSS = 'XSS',
  SQL_INJECTION = 'SQL_INJECTION',
  HTML_INJECTION = 'HTML_INJECTION',
  SCRIPT_INJECTION = 'SCRIPT_INJECTION',
  PATH_TRAVERSAL = 'PATH_TRAVERSAL',
  COMMAND_INJECTION = 'COMMAND_INJECTION'
}

export interface SecurityViolation {
  type: SecurityViolationType;
  field: string;
  originalValue: string;
  sanitizedValue: string;
  rule: string;
  severity: 'low' | 'medium' | 'high' | 'critical';
}