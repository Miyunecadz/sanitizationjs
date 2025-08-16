import { Request, Response, NextFunction } from "express";
import { SanitizationEngine } from "../core/sanitization-engine";
import { SanitizationConfig, RequestContext } from "../types";

export interface ExpressSanitizationOptions {
  sanitizeBody?: boolean;
  sanitizeQuery?: boolean;
  sanitizeParams?: boolean;
  sanitizeHeaders?: boolean;
  rules?: string[];
  onViolation?: (violations: string[], req: Request) => void;
}

export function createSanitizationMiddleware(
  config: SanitizationConfig,
  options: ExpressSanitizationOptions = {}
) {
  const sanitizationEngine = new SanitizationEngine(config);

  const {
    sanitizeBody = true,
    sanitizeQuery = true,
    sanitizeParams = true,
    sanitizeHeaders = false,
    rules = config.rules,
    onViolation,
  } = options;

  return (req: Request, res: Response, next: NextFunction) => {
    if (!config.enabled) {
      return next();
    }

    try {
      let hasViolations = false;
      const allViolations: string[] = [];

      if (sanitizeBody && req.body) {
        const result = sanitizationEngine.sanitize(req.body, rules);
        req.body = result.sanitized;
        if (result.violations.length > 0) {
          hasViolations = true;
          allViolations.push(...result.violations);
        }
      }

      if (sanitizeQuery && req.query) {
        const result = sanitizationEngine.sanitize(req.query, rules);
        req.query = result.sanitized;
        if (result.violations.length > 0) {
          hasViolations = true;
          allViolations.push(...result.violations);
        }
      }

      if (sanitizeParams && req.params) {
        const result = sanitizationEngine.sanitize(req.params, rules);
        req.params = result.sanitized;
        if (result.violations.length > 0) {
          hasViolations = true;
          allViolations.push(...result.violations);
        }
      }

      if (sanitizeHeaders && req.headers) {
        const sensitiveHeaders = ["authorization", "cookie", "set-cookie"];
        const headersToSanitize = Object.fromEntries(
          Object.entries(req.headers).filter(
            ([key]) => !sensitiveHeaders.includes(key.toLowerCase())
          )
        );

        const result = sanitizationEngine.sanitize(headersToSanitize, rules);
        Object.assign(req.headers, result.sanitized);
        if (result.violations.length > 0) {
          hasViolations = true;
          allViolations.push(...result.violations);
        }
      }

      if (hasViolations) {
        if (onViolation) {
          onViolation(allViolations, req);
        }

        if (config.strictMode && config.rejectOnViolation) {
          return res.status(400).json({
            success: false,
            error: {
              code: "SANITIZATION_VIOLATION",
              message: "Input validation failed",
              violations: allViolations,
              timestamp: new Date().toISOString(),
              requestId: req.headers["x-request-id"] || "unknown",
            },
          });
        }
      }

      next();
    } catch (error) {
      if (config.strictMode) {
        return res.status(500).json({
          success: false,
          error: {
            code: "SANITIZATION_ERROR",
            message: "Internal sanitization error",
            timestamp: new Date().toISOString(),
            requestId: req.headers["x-request-id"] || "unknown",
          },
        });
      }

      next();
    }
  };
}

export class ExpressSanitizationMiddleware {
  private sanitizationEngine: SanitizationEngine;

  constructor(
    private config: SanitizationConfig,
    private options: ExpressSanitizationOptions = {}
  ) {
    this.sanitizationEngine = new SanitizationEngine(config);
  }

  middleware() {
    return createSanitizationMiddleware(this.config, this.options);
  }

  updateConfig(newConfig: Partial<SanitizationConfig>) {
    Object.assign(this.config, newConfig);
    this.sanitizationEngine = new SanitizationEngine(this.config);
  }

  addCustomRule(rule: any) {
    this.sanitizationEngine.addCustomRule(rule);
  }
}
