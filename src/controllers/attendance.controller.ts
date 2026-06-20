import { Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import { GeoService } from '../services/geo.service';
import { ApiResponse } from '../types';

export const attendanceRecordSchema = z.object({
  body: z.object({
    userId: z.string().min(1, 'User ID is required'),
    lat: z.number({ required_error: 'Latitude is required' }),
    lng: z.number({ required_error: 'Longitude is required' }),
  })
});

export class AttendanceController {
  public static checkIn = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { userId, lat, lng } = req.body;
      const result = await GeoService.recordAttendance(userId, 'CheckIn', lat, lng);
      const response: ApiResponse = {
        success: true,
        data: result
      };
      res.status(201).json(response);
    } catch (error) {
      next(error);
    }
  };

  public static checkOut = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { userId, lat, lng } = req.body;
      const result = await GeoService.recordAttendance(userId, 'CheckOut', lat, lng);
      const response: ApiResponse = {
        success: true,
        data: result
      };
      res.status(201).json(response);
    } catch (error) {
      next(error);
    }
  };

  public static getToday = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { branchId } = req.query;
      const logs = await GeoService.getTodayAttendance(branchId as string);
      const response: ApiResponse = {
        success: true,
        data: logs
      };
      res.status(200).json(response);
    } catch (error) {
      next(error);
    }
  };

  public static getHistory = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { userId } = req.params;
      const logs = await GeoService.getEmployeeAttendanceHistory(userId);
      const response: ApiResponse = {
        success: true,
        data: logs
      };
      res.status(200).json(response);
    } catch (error) {
      next(error);
    }
  };

  public static getSummary = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const summary = await GeoService.getAttendanceSummary();
      const response: ApiResponse = {
        success: true,
        data: summary
      };
      res.status(200).json(response);
    } catch (error) {
      next(error);
    }
  };

  public static getGrid = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { branchId, date } = req.query;
      const records = await GeoService.getAttendanceGrid(branchId as string, date as string);
      const response: ApiResponse = {
        success: true,
        data: records
      };
      res.status(200).json(response);
    } catch (error) {
      next(error);
    }
  };
}
