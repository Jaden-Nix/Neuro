import type { Request, Response, NextFunction } from "express";
import { z } from "zod";

// Common validation schemas
export const walletAddressSchema = z.string()
  .min(26, "Wallet address too short")
  .max(64, "Wallet address too long")
  .regex(/^[a-zA-Z0-9]+$/, "Invalid wallet address characters");

export const ethereumAddressSchema = z.string()
  .regex(/^0x[a-fA-F0-9]{40}$/, "Invalid Ethereum address format");

export const solanaAddressSchema = z.string()
  .regex(/^[1-9A-HJ-NP-Za-km-z]{32,44}$/, "Invalid Solana address format");

export const uuidSchema = z.string()
  .uuid("Invalid UUID format");

export const paginationSchema = z.object({
  limit: z.coerce.number().int().min(1).max(1000).optional().default(100),
  offset: z.coerce.number().int().min(0).optional().default(0),
  page: z.coerce.number().int().min(1).optional(),
});

// Sanitize string to prevent XSS
export function sanitizeString(input: string): string {
  return input
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#x27;")
    .replace(/\//g, "&#x2F;");
}

// Validate and sanitize request body
export function validateBody<T extends z.ZodTypeAny>(schema: T) {
  return (req: Request, res: Response, next: NextFunction) => {
    try {
      const result = schema.safeParse(req.body);
      if (!result.success) {
        return res.status(400).json({
          error: "Validation Error",
          details: result.error.errors.map(e => ({
            field: e.path.join("."),
            message: e.message
          }))
        });
      }
      req.body = result.data;
      next();
    } catch (error) {
      return res.status(400).json({
        error: "Validation Error",
        message: "Invalid request body"
      });
    }
  };
}

// Validate query parameters
export function validateQuery<T extends z.ZodTypeAny>(schema: T) {
  return (req: Request, res: Response, next: NextFunction) => {
    try {
      const result = schema.safeParse(req.query);
      if (!result.success) {
        return res.status(400).json({
          error: "Validation Error",
          details: result.error.errors.map(e => ({
            field: e.path.join("."),
            message: e.message
          }))
        });
      }
      req.query = result.data;
      next();
    } catch (error) {
      return res.status(400).json({
        error: "Validation Error",
        message: "Invalid query parameters"
      });
    }
  };
}

// Validate URL parameters
export function validateParams<T extends z.ZodTypeAny>(schema: T) {
  return (req: Request, res: Response, next: NextFunction) => {
    try {
      const result = schema.safeParse(req.params);
      if (!result.success) {
        return res.status(400).json({
          error: "Validation Error",
          details: result.error.errors.map(e => ({
            field: e.path.join("."),
            message: e.message
          }))
        });
      }
      req.params = result.data;
      next();
    } catch (error) {
      return res.status(400).json({
        error: "Validation Error",
        message: "Invalid URL parameters"
      });
    }
  };
}

// Check for common injection patterns
export function detectInjection(input: string): boolean {
  const patterns = [
    // SQL injection patterns
    /(\b(SELECT|INSERT|UPDATE|DELETE|DROP|UNION|ALTER|CREATE|TRUNCATE)\b)/i,
    /(-{2}|;|\|\||&&)/,
    // NoSQL injection patterns  
    /(\$where|\$regex|\$ne|\$gt|\$lt)/i,
    // Command injection patterns
    /[|;&`$()]/,
    // Path traversal
    /(\.\.\/|\.\.\\)/,
  ];
  
  return patterns.some(pattern => pattern.test(input));
}

// Middleware to check for injection attempts
export function preventInjection(req: Request, res: Response, next: NextFunction): void {
  const checkValue = (value: unknown, path: string): boolean => {
    if (typeof value === "string") {
      if (detectInjection(value)) {
        console.warn(`[Security] Potential injection detected in ${path}: ${value.substring(0, 50)}`);
        return true;
      }
    } else if (typeof value === "object" && value !== null) {
      for (const [key, val] of Object.entries(value)) {
        if (checkValue(val, `${path}.${key}`)) {
          return true;
        }
      }
    }
    return false;
  };

  // Check body, query, and params
  if (checkValue(req.body, "body") || 
      checkValue(req.query, "query") || 
      checkValue(req.params, "params")) {
    res.status(400).json({
      error: "Bad Request",
      message: "Invalid characters in request"
    });
    return;
  }

  next();
}

// Validate content type for POST/PUT/PATCH requests
export function validateContentType(req: Request, res: Response, next: NextFunction): void {
  if (["POST", "PUT", "PATCH"].includes(req.method) && req.body) {
    const contentType = req.headers["content-type"];
    if (!contentType?.includes("application/json") && 
        !contentType?.includes("application/x-www-form-urlencoded") &&
        !contentType?.includes("multipart/form-data")) {
      console.warn(`[Security] Invalid content-type: ${contentType}`);
    }
  }
  next();
}
