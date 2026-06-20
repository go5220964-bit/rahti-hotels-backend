import { Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import { LoanService } from '../services/loan.service';
import { ApiResponse } from '../types';

export const createLoanSchema = z.object({
  body: z.object({
    userId: z.string().min(1, 'User ID is required'),
    amount: z.number().positive('Amount must be positive'),
    reason: z.string().min(1, 'Reason is required'),
    repaymentMonths: z.number().int().positive().optional()
  })
});

export const reviewLoanSchema = z.object({
  body: z.object({
    status: z.enum(['Approved', 'Rejected'], {
      required_error: 'Status is required and must be Approved or Rejected'
    }),
    reviewNote: z.string().optional(),
    reviewerId: z.string().optional()
  })
});

export class LoanController {
  public static create = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { userId, amount, reason, repaymentMonths } = req.body;
      const loan = await LoanService.createLoanRequest(userId, amount, reason, repaymentMonths);
      const response: ApiResponse = {
        success: true,
        data: loan
      };
      res.status(201).json(response);
    } catch (error) {
      next(error);
    }
  };

  public static getAll = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { status, userId, branchId } = req.query;
      const loans = await LoanService.getLoanRequests({
        status: status as string,
        userId: userId as string,
        branchId: branchId as string
      });
      const response: ApiResponse = {
        success: true,
        data: loans
      };
      res.status(200).json(response);
    } catch (error) {
      next(error);
    }
  };

  public static review = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { id } = req.params;
      const { status, reviewNote, reviewerId } = req.body;
      const actualReviewerId = reviewerId || 'system';
      const loan = await LoanService.reviewLoanRequest(id, actualReviewerId, status, reviewNote);
      const response: ApiResponse = {
        success: true,
        data: loan
      };
      res.status(200).json(response);
    } catch (error) {
      next(error);
    }
  };

  public static getHistory = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { userId } = req.params;
      const loans = await LoanService.getEmployeeLoanHistory(userId);
      const response: ApiResponse = {
        success: true,
        data: loans
      };
      res.status(200).json(response);
    } catch (error) {
      next(error);
    }
  };
}
