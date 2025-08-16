export * from "./types";
export * from "./core";
export * from "./nestjs";
export * from "./express";
export * from "./decorators";

export {
  SanitizationModuleConfig,
  SanitizationConfig,
  NormalizationConfig,
  SanitizationRule,
  SuccessResponse,
  ErrorResponse,
  ApiResponse,
  PaginationMeta,
  ResponseMetadata,
  RequestContext,
  SanitizationOptions,
  NormalizationOptions,
  SecurityViolationType,
  SecurityViolation,
} from "./types";

export { DEFAULT_SANITIZATION_RULES } from "./core/sanitization-rules";

import { SanitizationModuleConfig } from "./types";

export const DEFAULT_CONFIG: SanitizationModuleConfig = {
  sanitization: {
    enabled: true,
    rules: ["html", "script", "xss", "trim"],
    customRules: [],
    strictMode: false,
    logViolations: true,
    rejectOnViolation: false,
  },
  normalization: {
    enabled: true,
    format: "standard",
    includeMetadata: true,
    errorFormat: "standard",
    includeDebugInfo: false,
    compressResponses: false,
    includeLinks: false,
  },
  performance: {
    enableCaching: true,
    maxCacheSize: 1000,
    enableMetrics: true,
  },
};
