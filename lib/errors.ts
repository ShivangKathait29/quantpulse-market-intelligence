/**
 * Centralized custom error classes.
 * Use these instead of `new Error()` so callers can differentiate
 * failure types with `instanceof` checks in catch blocks.
 */

/** Thrown when a database operation fails (connection, query, etc.) */
export class DatabaseError extends Error {
    constructor(message: string) {
        super(message);
        this.name = 'DatabaseError';
    }
}

/** Thrown when user-supplied input fails business-rule validation */
export class ValidationError extends Error {
    constructor(message: string) {
        super(message);
        this.name = 'ValidationError';
    }
}

/** Thrown when a user is not authenticated or not authorized */
export class AuthError extends Error {
    constructor(message: string = 'Unauthorized') {
        super(message);
        this.name = 'AuthError';
    }
}

/** Thrown when an external API call fails */
export class ExternalApiError extends Error {
    statusCode?: number;
    constructor(message: string, statusCode?: number) {
        super(message);
        this.name = 'ExternalApiError';
        this.statusCode = statusCode;
    }
}

/**
 * Maps any caught error to a user-safe message string.
 * - ValidationError → show the message directly to the user
 * - AuthError       → generic auth message
 * - DatabaseError   → hide internals, show generic message
 * - ExternalApiError 429 → rate limit message
 * - Unknown         → generic fallback
 */
export function toUserMessage(error: unknown): string {
    if (error instanceof ValidationError) {
        return error.message;
    }
    if (error instanceof AuthError) {
        return 'You must be signed in to perform this action.';
    }
    if (error instanceof ExternalApiError) {
        if (error.statusCode === 429) return 'Too many requests. Please try again shortly.';
        return 'An external service error occurred. Please try again.';
    }
    if (error instanceof DatabaseError) {
        return 'A database error occurred. Please try again later.';
    }
    if (error instanceof Error) {
        return error.message;
    }
    return 'An unexpected error occurred.';
}
