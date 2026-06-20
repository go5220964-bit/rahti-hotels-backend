import { Request, Response, NextFunction } from 'express';
import { ZodError } from 'zod';
import { ApiResponse } from '../types';

export class AppError extends Error {
  public statusCode: number;
  public errorCode: string;
  public details?: any;

  constructor(statusCode: number, errorCode: string, message: string, details?: any) {
    super(message);
    this.statusCode = statusCode;
    this.errorCode = errorCode;
    this.details = details;
    Object.setPrototypeOf(this, new.target.prototype);
  }
}

export const errorHandler = (
  error: Error,
  req: Request,
  res: Response,
  next: NextFunction
) => {
  console.error(`🔴 Error occurred during request: ${req.method} ${req.url}`);
  console.error(error);

  const response: ApiResponse = {
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
  } else if (error instanceof ZodError) {
    statusCode = 400;
    response.error = {
      code: 'VALIDATION_ERROR',
      message: 'Validation failed for the requested payload.',
      details: error.errors.map((err) => ({
        path: err.path.join('.'),
        message: err.message,
      })),
    };
  } else if (error.name === 'PrismaClientKnownRequestError') {
    // Handle Prisma specific errors
    statusCode = 400;
    response.error = {
      code: 'DATABASE_ERROR',
      message: 'A database constraint violation occurred.',
      details: (error as any).meta,
    };
  } else if (error.name === 'PrismaClientValidationError') {
    statusCode = 400;
    response.error = {
      code: 'DATABASE_VALIDATION_ERROR',
      message: 'Invalid data format provided to the database.',
    };
  }

  res.status(statusCode).json(response);
};
