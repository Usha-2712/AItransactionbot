// src/utils/errors.js

/**
 * Custom error classes for better error handling
 * Each error type has specific properties for different scenarios
 */

/**
 * ValidationError - Thrown when input validation fails
 * Used for invalid user input (wrong format, missing fields, etc.)
 */
export class ValidationError extends Error {
    constructor(message, field = null) {
      super(message);
      this.name = 'ValidationError';
      this.field = field;  // Which field failed validation
      this.statusCode = 400; // HTTP 400 Bad Request
    }
  }
  
  /**
   * DatabaseError - Thrown when DynamoDB operations fail
   * Used for database connection issues, query errors, etc.
   */
  export class DatabaseError extends Error {
    constructor(message, originalError = null) {
      super(message);
      this.name = 'DatabaseError';
      this.originalError = originalError; // Store the original AWS error
      this.statusCode = 500; // HTTP 500 Internal Server Error
    }
  }
  
  /**
   * LLMError - Thrown when OpenAI API calls fail
   * Used for API errors, rate limits, invalid responses, etc.
   */
  export class LLMError extends Error {
    constructor(message, originalError = null) {
      super(message);
      this.name = 'LLMError';
      this.originalError = originalError; // Store the original OpenAI error
      this.statusCode = 500; // HTTP 500 Internal Server Error
    }
  }
  
  /**
   * OCRError - Thrown when AWS Textract OCR operations fail
   * Used for image processing errors, invalid formats, etc.
   */
  export class OCRError extends Error {
    constructor(message, originalError = null) {
      super(message);
      this.name = 'OCRError';
      this.originalError = originalError; // Store the original AWS error
      this.statusCode = 500; // HTTP 500 Internal Server Error
    }
  }
  
  /**
   * Error handler middleware for Express
   * Catches all errors and returns consistent JSON error responses
   * 
   * Usage in Express:
   * app.use(errorHandler);
   */
  export const errorHandler = (err, req, res, next) => {
    console.error('Error:', err);
  
    // Get status code from error or default to 500
    const statusCode = err.statusCode || 500;
    
    // Get error message
    const message = err.message || 'Internal server error';
  
    // Build error response object
    const errorResponse = {
      success: false,
      error: {
        message,
        type: err.name || 'Error',
        // Include additional details in development mode only
        ...(process.env.NODE_ENV === 'development' && {
          stack: err.stack,           // Stack trace (only in dev)
          field: err.field,           // Which field failed (for ValidationError)
          originalError: err.originalError?.message  // Original error message
        })
      }
    };
  
    // Send error response
    res.status(statusCode).json(errorResponse);
  };
  
  /**
   * Async error wrapper to catch errors in async route handlers
   * Prevents unhandled promise rejections in Express routes
   * 
   * Usage:
   * router.post('/chat', asyncHandler(async (req, res) => {
   *   // Your async code here
   *   // Errors will be automatically caught and passed to errorHandler
   * }));
   */
  export const asyncHandler = (fn) => {
    return (req, res, next) => {
      // Wrap async function in Promise.resolve to catch any errors
      Promise.resolve(fn(req, res, next)).catch(next);
    };
  };