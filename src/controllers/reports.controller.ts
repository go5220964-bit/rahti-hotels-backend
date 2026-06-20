import { Request, Response, NextFunction } from 'express';
import { ReportsService } from '../services/reports.service';
import { ApiResponse } from '../types';

export class ReportsController {
  public static getDailyFinancial = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { branchId, date } = req.query;
      const data = await ReportsService.getDailyFinancialSummary(
        branchId as string || undefined,
        date as string || undefined
      );
      const response: ApiResponse = { success: true, data };
      res.status(200).json(response);
    } catch (error) {
      next(error);
    }
  };

  public static getPeriodFinancial = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { branchId, from, to } = req.query;
      const data = await ReportsService.getPeriodFinancialSummary(
        branchId as string || undefined,
        from as string,
        to as string
      );
      const response: ApiResponse = { success: true, data };
      res.status(200).json(response);
    } catch (error) {
      next(error);
    }
  };

  public static getMonthlyFinancial = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { branchId, year, month } = req.query;
      const data = await ReportsService.getMonthlyFinancialSummary(
        branchId as string || undefined,
        year ? parseInt(year as string) : undefined,
        month ? parseInt(month as string) : undefined
      );
      const response: ApiResponse = { success: true, data };
      res.status(200).json(response);
    } catch (error) {
      next(error);
    }
  };

  public static getAttendance = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { branchId, from, to } = req.query;
      const data = await ReportsService.getAttendanceSummary(
        branchId as string || undefined,
        from as string,
        to as string
      );
      const response: ApiResponse = { success: true, data };
      res.status(200).json(response);
    } catch (error) {
      next(error);
    }
  };

  public static getLeaves = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { branchId, from, to } = req.query;
      const data = await ReportsService.getLeaveReport(
        branchId as string || undefined,
        from as string,
        to as string
      );
      const response: ApiResponse = { success: true, data };
      res.status(200).json(response);
    } catch (error) {
      next(error);
    }
  };

  public static getLoans = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { branchId } = req.query;
      const data = await ReportsService.getLoanReport(branchId as string || undefined);
      const response: ApiResponse = { success: true, data };
      res.status(200).json(response);
    } catch (error) {
      next(error);
    }
  };

  public static getMaintenance = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { branchId, from, to } = req.query;
      const data = await ReportsService.getMaintenanceReport(
        branchId as string || undefined,
        from as string,
        to as string
      );
      const response: ApiResponse = { success: true, data };
      res.status(200).json(response);
    } catch (error) {
      next(error);
    }
  };

  public static getInventory = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { branchId } = req.query;
      const data = await ReportsService.getInventoryReport(branchId as string || undefined);
      const response: ApiResponse = { success: true, data };
      res.status(200).json(response);
    } catch (error) {
      next(error);
    }
  };

  public static getProcurement = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { branchId, from, to } = req.query;
      const data = await ReportsService.getProcurementReport(
        branchId as string || undefined,
        from as string,
        to as string
      );
      const response: ApiResponse = { success: true, data };
      res.status(200).json(response);
    } catch (error) {
      next(error);
    }
  };

  public static getDamage = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { branchId, from, to } = req.query;
      const data = await ReportsService.getDamageReport(
        branchId as string || undefined,
        from as string,
        to as string
      );
      const response: ApiResponse = { success: true, data };
      res.status(200).json(response);
    } catch (error) {
      next(error);
    }
  };

  public static getLostFound = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { branchId, from, to } = req.query;
      const data = await ReportsService.getLostFoundReport(
        branchId as string || undefined,
        from as string,
        to as string
      );
      const response: ApiResponse = { success: true, data };
      res.status(200).json(response);
    } catch (error) {
      next(error);
    }
  };

  public static getExecutive = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { from, to } = req.query;
      const data = await ReportsService.getExecutiveSummary(
        from as string,
        to as string
      );
      const response: ApiResponse = { success: true, data };
      res.status(200).json(response);
    } catch (error) {
      next(error);
    }
  };

  public static triggerDigest = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { branchId } = req.body;
      const { DigestService } = require('../services/digest.service');
      if (branchId) {
        await DigestService.sendDailyDigestForBranch(branchId);
      } else {
        await DigestService.sendDailyDigestToAllBranches();
      }
      res.status(200).json({ success: true, message: 'Daily digest triggered successfully' });
    } catch (error) {
      next(error);
    }
  };
}

import { Router } from 'express';
const router = Router();

router.get('/financial/daily', ReportsController.getDailyFinancial);
router.get('/financial/period', ReportsController.getPeriodFinancial);
router.get('/financial/monthly', ReportsController.getMonthlyFinancial);
router.get('/attendance', ReportsController.getAttendance);
router.get('/leave', ReportsController.getLeaves);
router.get('/loans', ReportsController.getLoans);
router.get('/maintenance', ReportsController.getMaintenance);
router.get('/inventory', ReportsController.getInventory);
router.get('/procurement', ReportsController.getProcurement);
router.get('/damage', ReportsController.getDamage);
router.get('/lostfound', ReportsController.getLostFound);
router.get('/executive', ReportsController.getExecutive);
router.post('/digest', ReportsController.triggerDigest);

export default router;
