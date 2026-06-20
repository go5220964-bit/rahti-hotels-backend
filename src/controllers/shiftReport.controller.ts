import { Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import { ShiftReportService } from '../services/shiftReport.service';
import { ApiResponse } from '../types';

export const createShiftReportSchema = z.object({
  body: z.object({
    reporterId: z.string().min(1, 'Reporter ID is required'),
    branchId: z.string().min(1, 'Branch ID is required'),
    shiftLabel: z.string().min(1, 'Shift label is required'),
    cashTotal: z.number().nonnegative(),
    cashExpenses: z.number().nonnegative(),
    visa: z.number().nonnegative(),
    mada: z.number().nonnegative(),
    mastercard: z.number().nonnegative(),
    gulfNet: z.number().nonnegative(),
    tabby: z.number().nonnegative(),
    bankTransfer: z.number().nonnegative(),
    shiftId: z.string().nullable().optional(),
    customStartTime: z.string().nullable().optional(),
    customEndTime: z.string().nullable().optional(),
    isManual: z.boolean().optional(),
    manualEnteredBy: z.string().nullable().optional(),
    createdAt: z.string().optional()
  })
});

export const updateShiftReportSchema = z.object({
  body: z.object({
    reporterId: z.string().min(1).optional(),
    branchId: z.string().min(1).optional(),
    shiftLabel: z.string().min(1).optional(),
    cashTotal: z.number().nonnegative().optional(),
    cashExpenses: z.number().nonnegative().optional(),
    visa: z.number().nonnegative().optional(),
    mada: z.number().nonnegative().optional(),
    mastercard: z.number().nonnegative().optional(),
    gulfNet: z.number().nonnegative().optional(),
    tabby: z.number().nonnegative().optional(),
    bankTransfer: z.number().nonnegative().optional(),
    shiftId: z.string().nullable().optional(),
    customStartTime: z.string().nullable().optional(),
    customEndTime: z.string().nullable().optional(),
    isManual: z.boolean().optional(),
    manualEnteredBy: z.string().nullable().optional()
  })
});

export const approveShiftReportSchema = z.object({
  body: z.object({
    reviewerId: z.string().min(1, 'Reviewer ID is required')
  })
});

export const rejectShiftReportSchema = z.object({
  body: z.object({
    reviewerId: z.string().min(1, 'Reviewer ID is required'),
    reason: z.string().min(1, 'Rejection reason is required')
  })
});

export class ShiftReportController {
  public static create = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const newReport = await ShiftReportService.createShiftReport(req.body);
      const response: ApiResponse = {
        success: true,
        data: newReport
      };
      res.status(201).json(response);
    } catch (error) {
      next(error);
    }
  };

  public static getAll = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { branchId, reporterId, status, startDate, endDate } = req.query;
      const reports = await ShiftReportService.getAllShiftReports({
        branchId: branchId as string,
        reporterId: reporterId as string,
        status: status as string,
        startDate: startDate as string,
        endDate: endDate as string
      });
      const response: ApiResponse = {
        success: true,
        data: reports
      };
      res.status(200).json(response);
    } catch (error) {
      next(error);
    }
  };

  public static getById = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { id } = req.params;
      const report = await ShiftReportService.getShiftReportById(id);
      const response: ApiResponse = {
        success: true,
        data: report
      };
      res.status(200).json(response);
    } catch (error) {
      next(error);
    }
  };

  public static approve = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { id } = req.params;
      const { reviewerId } = req.body;
      const updatedReport = await ShiftReportService.approveShiftReport(id, reviewerId);
      const response: ApiResponse = {
        success: true,
        data: updatedReport
      };
      res.status(200).json(response);
    } catch (error) {
      next(error);
    }
  };

  public static reject = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { id } = req.params;
      const { reviewerId, reason } = req.body;
      const updatedReport = await ShiftReportService.rejectShiftReport(id, reviewerId, reason);
      const response: ApiResponse = {
        success: true,
        data: updatedReport
      };
      res.status(200).json(response);
    } catch (error) {
      next(error);
    }
  };

  public static update = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { id } = req.params;
      const updatedReport = await ShiftReportService.updateShiftReport(id, req.body);
      const response: ApiResponse = {
        success: true,
        data: updatedReport
      };
      res.status(200).json(response);
    } catch (error) {
      next(error);
    }
  };

  public static delete = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { id } = req.params;
      await ShiftReportService.deleteShiftReport(id);
      const response: ApiResponse = {
        success: true,
        data: { id, message: 'Shift report successfully deleted' }
      };
      res.status(200).json(response);
    } catch (error) {
      next(error);
    }
  };

  public static getStats = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { reporterId } = req.params;
      const { preserveHistory } = req.query;
      const preserve = preserveHistory !== 'false';
      const stats = await ShiftReportService.getReporterStats(reporterId, preserve);
      const response: ApiResponse = {
        success: true,
        data: stats
      };
      res.status(200).json(response);
    } catch (error) {
      next(error);
    }
  };
}
