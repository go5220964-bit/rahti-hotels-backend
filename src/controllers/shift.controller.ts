import { Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import { ShiftService } from '../services/shift.service';
import { ApiResponse } from '../types';

export const createShiftSchema = z.object({
  body: z.object({
    name: z.string().min(1, 'Shift name is required'),
    startTime: z.string(),
    endTime: z.string(),
    branchId: z.string().nullable().optional(),
    isOpen: z.boolean().optional(),
  })
});

export const updateShiftSchema = z.object({
  body: z.object({
    name: z.string().min(1).optional(),
    startTime: z.string().optional(),
    endTime: z.string().optional(),
    branchId: z.string().nullable().optional(),
    isOpen: z.boolean().optional(),
    isActive: z.boolean().optional(),
  })
});

export class ShiftController {
  public static create = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const newShift = await ShiftService.createShift(req.body);
      const response: ApiResponse = {
        success: true,
        data: newShift
      };
      res.status(201).json(response);
    } catch (error) {
      next(error);
    }
  };

  public static getAll = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { branchId } = req.query;
      const shifts = await ShiftService.getAllShifts(branchId as string);
      const response: ApiResponse = {
        success: true,
        data: shifts
      };
      res.status(200).json(response);
    } catch (error) {
      next(error);
    }
  };

  public static getByBranch = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { branchId } = req.params;
      const shifts = await ShiftService.getShiftsForBranch(branchId);
      const response: ApiResponse = {
        success: true,
        data: shifts
      };
      res.status(200).json(response);
    } catch (error) {
      next(error);
    }
  };

  public static update = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { id } = req.params;
      const updatedShift = await ShiftService.updateShift(id, req.body);
      const response: ApiResponse = {
        success: true,
        data: updatedShift
      };
      res.status(200).json(response);
    } catch (error) {
      next(error);
    }
  };

  public static delete = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { id } = req.params;
      await ShiftService.deleteShift(id);
      const response: ApiResponse = {
        success: true,
        data: { id, message: 'Shift successfully deleted (soft-delete)' }
      };
      res.status(200).json(response);
    } catch (error) {
      next(error);
    }
  };
}
