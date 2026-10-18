import { Request, Response, NextFunction } from 'express';
import { ReceptionScheduleService } from '../services/reception-schedule.service';
import { ApiResponse } from '../types';

export class ReceptionScheduleController {
  public static getSchedule = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { branchId, startDate, endDate } = req.query;
      const data = await ReceptionScheduleService.getSchedule(
        branchId as string,
        startDate as string,
        endDate as string
      );
      const response: ApiResponse = {
        success: true,
        data,
      };
      res.status(200).json(response);
    } catch (error) {
      next(error);
    }
  };

  public static getReceptionists = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { branchId } = req.query;
      const data = await ReceptionScheduleService.getReceptionists(branchId as string);
      const response: ApiResponse = {
        success: true,
        data,
      };
      res.status(200).json(response);
    } catch (error) {
      next(error);
    }
  };

  public static upsertSlot = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const slot = await ReceptionScheduleService.upsertSchedule(req.body);
      const response: ApiResponse = {
        success: true,
        data: slot,
      };
      res.status(200).json(response);
    } catch (error) {
      next(error);
    }
  };

  public static autoGenerate = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { branchId, startDate } = req.body;
      const result = await ReceptionScheduleService.autoGenerateWeeklyRoster(branchId, startDate);
      const response: ApiResponse = {
        success: true,
        data: result,
      };
      res.status(200).json(response);
    } catch (error) {
      next(error);
    }
  };

  public static assignCoverage = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const result = await ReceptionScheduleService.assignCoverage(req.body);
      const response: ApiResponse = {
        success: true,
        data: result,
      };
      res.status(200).json(response);
    } catch (error) {
      next(error);
    }
  };

  public static getMySchedule = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { userId } = req.params;
      const data = await ReceptionScheduleService.getEmployeeSchedule(userId);
      const response: ApiResponse = {
        success: true,
        data,
      };
      res.status(200).json(response);
    } catch (error) {
      next(error);
    }
  };
}
