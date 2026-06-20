import { Request, Response, NextFunction } from 'express';
import prisma from '../services/prisma';
import { ActivityLogService } from '../services/activity-log.service';
import { ApiResponse } from '../types';
import { AppError } from '../middleware/error.middleware';

export class SystemController {
  // Settings / Integrations
  public static getSettings = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const settings = await prisma.systemSetting.findMany();
      const response: ApiResponse = {
        success: true,
        data: settings.reduce((acc: any, curr) => {
          acc[curr.key] = curr.value;
          return acc;
        }, {})
      };
      res.status(200).json(response);
    } catch (error) {
      next(error);
    }
  };

  public static updateSettings = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { settings } = req.body; // e.g. { whatsapp_token: '...', gemini_api_key: '...', attendance_buffer_minutes: '30' }
      const user = (req as any).user || { id: 'system' };

      for (const [key, value] of Object.entries(settings)) {
        await prisma.systemSetting.upsert({
          where: { key },
          update: { value: String(value), updatedBy: user.id },
          create: { key, value: String(value), updatedBy: user.id }
        });
      }

      await ActivityLogService.log(
        user.id,
        'UPDATE_SETTINGS',
        'SystemSetting',
        'global',
        settings,
        req.ip
      );

      const response: ApiResponse = {
        success: true,
        data: { message: 'Settings successfully updated' }
      };
      res.status(200).json(response);
    } catch (error) {
      next(error);
    }
  };

  // Activity Logs
  public static getLogs = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const limit = parseInt(req.query.limit as string) || 100;
      const offset = parseInt(req.query.offset as string) || 0;
      const logs = await ActivityLogService.getLogs(limit, offset);
      const response: ApiResponse = {
        success: true,
        data: logs
      };
      res.status(200).json(response);
    } catch (error) {
      next(error);
    }
  };

  // Role Permissions
  public static getRolePermissions = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const setting = await prisma.systemSetting.findUnique({
        where: { key: 'role_permission_matrix' }
      });

      // Default matrix if not set
      const defaultMatrix = {
        Admin: ['overview', 'employees', 'shifts', 'attendance', 'leaves', 'loans', 'shift-reports', 'receptionist-stats', 'maintenance', 'warehouse', 'procurement', 'lost-found', 'documents', 'reports', 'system'],
        CEO: ['overview', 'employees', 'shifts', 'attendance', 'leaves', 'loans', 'shift-reports', 'receptionist-stats', 'maintenance', 'warehouse', 'procurement', 'lost-found', 'documents', 'reports'],
        BranchManager: ['overview', 'employees', 'shifts', 'attendance', 'leaves', 'loans', 'shift-reports', 'maintenance', 'lost-found', 'documents', 'reports'],
        Receptionist: ['overview', 'attendance', 'shift-reports', 'lost-found'],
        Accountant: ['overview', 'shift-reports', 'receptionist-stats', 'loans', 'reports'],
        Supervisor: ['overview', 'maintenance', 'warehouse'], // e.g. MaintenanceSupervisor
        Storekeeper: ['overview', 'warehouse', 'procurement'] // e.g. WarehouseManager
      };

      const matrix = setting ? JSON.parse(setting.value) : defaultMatrix;

      const response: ApiResponse = {
        success: true,
        data: matrix
      };
      res.status(200).json(response);
    } catch (error) {
      next(error);
    }
  };

  public static updateRolePermissions = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { matrix } = req.body;
      const user = (req as any).user || { id: 'system' };

      await prisma.systemSetting.upsert({
        where: { key: 'role_permission_matrix' },
        update: { value: JSON.stringify(matrix), updatedBy: user.id },
        create: { key: 'role_permission_matrix', value: JSON.stringify(matrix), updatedBy: user.id }
      });

      await ActivityLogService.log(
        user.id,
        'UPDATE_ROLE_PERMISSIONS',
        'SystemSetting',
        'role_permission_matrix',
        matrix,
        req.ip
      );

      const response: ApiResponse = {
        success: true,
        data: { message: 'Role permissions matrix successfully updated' }
      };
      res.status(200).json(response);
    } catch (error) {
      next(error);
    }
  };

  // User Activation/Deactivation and System Users CRUD
  public static toggleUserStatus = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { id } = req.params;
      const { isActive } = req.body;
      const user = (req as any).user || { id: 'system' };

      const targetUser = await prisma.user.findUnique({ where: { id } });
      if (!targetUser) {
        throw new AppError(404, 'USER_NOT_FOUND', 'المستخدم غير موجود');
      }

      const updatedUser = await prisma.user.update({
        where: { id },
        data: { isActive }
      });

      await ActivityLogService.log(
        user.id,
        isActive ? 'ACTIVATE_USER' : 'DEACTIVATE_USER',
        'User',
        id,
        { name: targetUser.name, role: targetUser.role },
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
}
