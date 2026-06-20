import { Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import { LeaveService } from '../services/leave.service';
import { ApiResponse } from '../types';
import prisma from '../services/prisma';

export const createLeaveSchema = z.object({
  body: z.object({
    userId: z.string().min(1, 'User ID is required'),
    leaveType: z.enum(['Annual', 'Sick', 'Emergency', 'Unpaid']),
    startDate: z.string().min(1, 'Start date is required'),
    endDate: z.string().min(1, 'End date is required'),
    reason: z.string().min(1, 'Reason is required')
  })
});

export const reviewLeaveSchema = z.object({
  body: z.object({
    status: z.enum(['Approved', 'Rejected'], {
      required_error: 'Status is required and must be Approved or Rejected'
    }),
    reviewNote: z.string().optional(),
    reviewerId: z.string().optional()
  })
});

export const adjustBalanceSchema = z.object({
  body: z.object({
    annualLeaveBalance: z.number().int().nonnegative(),
    sickLeaveBalance: z.number().int().nonnegative()
  })
});

export class LeaveController {
  public static create = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { userId, leaveType, startDate, endDate, reason } = req.body;
      const leave = await LeaveService.createLeaveRequest(userId, leaveType, startDate, endDate, reason);
      const response: ApiResponse = {
        success: true,
        data: leave
      };
      res.status(201).json(response);
    } catch (error) {
      next(error);
    }
  };

  public static getAll = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { status, userId, branchId, leaveType } = req.query;
      const leaves = await LeaveService.getLeaveRequests({
        status: status as string,
        userId: userId as string,
        branchId: branchId as string,
        leaveType: leaveType as string
      });
      const response: ApiResponse = {
        success: true,
        data: leaves
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
      const leave = await LeaveService.reviewLeaveRequest(id, actualReviewerId, status, reviewNote);
      const response: ApiResponse = {
        success: true,
        data: leave
      };
      res.status(200).json(response);
    } catch (error) {
      next(error);
    }
  };

  public static getHistory = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { userId } = req.params;
      const leaves = await LeaveService.getLeaveHistory(userId);
      const response: ApiResponse = {
        success: true,
        data: leaves
      };
      res.status(200).json(response);
    } catch (error) {
      next(error);
    }
  };

  public static getBalance = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { userId } = req.params;
      const balance = await LeaveService.getEmployeeLeaveBalance(userId);
      const response: ApiResponse = {
        success: true,
        data: balance
      };
      res.status(200).json(response);
    } catch (error) {
      next(error);
    }
  };

  public static adjustBalance = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { userId } = req.params;
      const { annualLeaveBalance, sickLeaveBalance } = req.body;
      
      const updatedUser = await prisma.user.update({
        where: { id: userId },
        data: {
          annualLeaveBalance,
          sickLeaveBalance
        }
      });

      const response: ApiResponse = {
        success: true,
        data: {
          userId: updatedUser.id,
          annualLeaveBalance: updatedUser.annualLeaveBalance,
          sickLeaveBalance: updatedUser.sickLeaveBalance
        }
      };
      res.status(200).json(response);
    } catch (error) {
      next(error);
    }
  };
}
