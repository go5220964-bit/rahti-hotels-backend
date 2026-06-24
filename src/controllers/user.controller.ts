import { Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import { UserService } from '../services/user.service';
import { ActivityLogService } from '../services/activity-log.service';
import { ApiResponse } from '../types';

export const createUserSchema = z.object({
  body: z.object({
    name: z.string().min(1, 'Name is required'),
    role: z.string().min(1, 'Role is required'),
    phoneNumber: z.string().min(1, 'Phone number is required'),
    branchId: z.string().nullable().optional(),
    employeeType: z.string().optional(),
    email: z.string().optional()
  })
});

export const updateUserSchema = z.object({
  body: z.object({
    name: z.string().min(1).optional(),
    role: z.string().min(1).optional(),
    phoneNumber: z.string().min(1).optional(),
    branchId: z.string().nullable().optional(),
    employeeType: z.string().optional(),
    email: z.string().optional(),
    botEnabled: z.boolean().optional()
  })
});

export const transferBranchSchema = z.object({
  body: z.object({
    newBranchId: z.string().min(1, 'New Branch ID is required'),
    reason: z.string().optional(),
    preserveHistory: z.boolean().optional()
  })
});

export class UserController {
  public static getAll = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const users = await UserService.getAll();
      const response: ApiResponse = {
        success: true,
        data: users
      };
      res.status(200).json(response);
    } catch (error) {
      next(error);
    }
  };

  public static create = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const newUser = await UserService.createUser(req.body);
      const user = (req as any).user || { id: 'system' };
      await ActivityLogService.log(
        user.id,
        'CREATE_USER',
        'User',
        newUser.id,
        { name: newUser.name, role: newUser.role },
        req.ip
      );
      const response: ApiResponse = {
        success: true,
        data: newUser
      };
      res.status(201).json(response);
    } catch (error) {
      next(error);
    }
  };

  public static update = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { id } = req.params;
      const updatedUser = await UserService.updateUser(id, req.body);
      const user = (req as any).user || { id: 'system' };
      await ActivityLogService.log(
        user.id,
        'UPDATE_USER',
        'User',
        id,
        req.body,
        req.ip
      );
      const response: ApiResponse = {
        success: true,
        data: updatedUser
      };
      res.status(200).json(response);
    } catch (error) {
      next(error);
    }
  };

  public static delete = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { id } = req.params;
      await UserService.deleteUser(id);
      const user = (req as any).user || { id: 'system' };
      await ActivityLogService.log(
        user.id,
        'DELETE_USER',
        'User',
        id,
        null,
        req.ip
      );
      const response: ApiResponse = {
        success: true,
        data: { id, message: 'User successfully deleted' }
      };
      res.status(200).json(response);
    } catch (error) {
      next(error);
    }
  };

  public static transferBranch = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { id } = req.params;
      const { newBranchId, reason } = req.body;
      const user = (req as any).user || { id: 'system' };
      
      const updatedUser = await UserService.transferBranch(id, newBranchId, reason || 'نقل إداري', user.id);
      
      await ActivityLogService.log(
        user.id,
        'TRANSFER_BRANCH',
        'User',
        id,
        { toBranchId: newBranchId, reason: reason || 'نقل إداري' },
        req.ip
      );
      const response: ApiResponse = {
        success: true,
        data: updatedUser
      };
      res.status(200).json(response);
    } catch (error) {
      next(error);
    }
  };

  public static getPublicProfile = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { id } = req.params;
      const user = await UserService.getUserById(id);
      const response: ApiResponse = {
        success: true,
        data: {
          name: user.name,
          role: user.role
        }
      };
      res.status(200).json(response);
    } catch (error) {
      next(error);
    }
  };
}
