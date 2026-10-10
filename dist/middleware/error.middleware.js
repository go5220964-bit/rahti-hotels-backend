"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.errorHandler = exports.AppError = void 0;
const zod_1 = require("zod");
class AppError extends Error {
    statusCode;
    errorCode;
    details;
    constructor(statusCode, errorCode, message, details) {
        super(message);
        this.statusCode = statusCode;
        this.errorCode = errorCode;
        this.details = details;
        Object.setPrototypeOf(this, new.target.prototype);
    }
}
exports.AppError = AppError;
const errorHandler = (error, req, res, next) => {
    console.error(`🔴 Error occurred during request: ${req.method} ${req.url}`);
    console.error(error);
    const response = {
        success: false,
        error: {
            code: 'INTERNAL_SERVER_ERROR',
            message: 'An unexpected error occurred on the server.',
        },
    };
    let statusCode = 500;
    if (error instanceof AppError) {
        statusCode = error.statusCode;
        response.error = {
            code: error.errorCode,
            message: error.message,
            details: error.details,
        };
    }
    else if (error instanceof zod_1.ZodError) {
        statusCode = 400;
        response.error = {
            code: 'VALIDATION_ERROR',
            message: 'Validation failed for the requested payload.',
            details: error.errors.map((err) => ({
                path: err.path.join('.'),
                message: err.message,
            })),
        };
    }
    else if (error.name === 'PrismaClientKnownRequestError') {
        // Handle Prisma specific errors
        statusCode = 400;
        response.error = {
            code: 'DATABASE_ERROR',
            message: 'A database constraint violation occurred.',
            details: error.meta,
        };
    }
    else if (error.name === 'PrismaClientValidationError') {
        statusCode = 400;
        response.error = {
            code: 'DATABASE_VALIDATION_ERROR',
            message: 'Invalid data format provided to the database.',
        };
    }
    res.status(statusCode).json(response);
};
exports.errorHandler = errorHandler;
