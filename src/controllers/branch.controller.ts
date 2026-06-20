import { Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import { BranchService } from '../services/branch.service';
import { ApiResponse } from '../types';

export const createBranchSchema = z.object({
  body: z.object({
    name: z.string().min(1, 'Branch name is required'),
    location: z.string().optional(),
    lat: z.number().nullable().optional(),
    lng: z.number().nullable().optional(),
    radiusMeters: z.number().int().positive().optional()
  })
});

export const updateBranchSchema = z.object({
  body: z.object({
    name: z.string().min(1).optional(),
    location: z.string().optional(),
    lat: z.number().nullable().optional(),
    lng: z.number().nullable().optional(),
    radiusMeters: z.number().int().positive().optional()
  })
});

export class BranchController {
  public static getAll = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const branches = await BranchService.getAll();
      const response: ApiResponse = {
        success: true,
        data: branches
      };
      res.status(200).json(response);
    } catch (error) {
      next(error);
    }
  };

  public static create = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const newBranch = await BranchService.createBranch(req.body);
      const response: ApiResponse = {
        success: true,
        data: newBranch
      };
      res.status(201).json(response);
    } catch (error) {
      next(error);
    }
  };

  public static update = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { id } = req.params;
      const updatedBranch = await BranchService.updateBranch(id, req.body);
      const response: ApiResponse = {
        success: true,
        data: updatedBranch
      };
      res.status(200).json(response);
    } catch (error) {
      next(error);
    }
  };

  public static delete = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { id } = req.params;
      await BranchService.deleteBranch(id);
      const response: ApiResponse = {
        success: true,
        data: { id, message: 'Branch successfully deleted' }
      };
      res.status(200).json(response);
    } catch (error) {
      next(error);
    }
  };
}
