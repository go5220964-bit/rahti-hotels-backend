import { Request, Response, NextFunction } from 'express';
import { MaintenanceService } from '../services/maintenance.service';
import { ApiResponse } from '../types';

export class MaintenanceController {
  public static create = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { reportedBy, branchId, category, location, description, photoUrl, priority } = req.body;
      const request = await MaintenanceService.createRequest({
        reportedBy,
        branchId,
        category,
        location,
        description,
        photoUrl,
        priority
      });
      const response: ApiResponse = {
        success: true,
        data: request
      };
      res.status(201).json(response);
    } catch (error) {
      next(error);
    }
  };

  public static getAll = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { status, branchId, assignedTo, category, priority, dateFrom, dateTo } = req.query;
      const requests = await MaintenanceService.getRequests({
        status: status as string,
        branchId: branchId as string,
        assignedTo: assignedTo as string,
        category: category as string,
        priority: priority as string,
        dateFrom: dateFrom as string,
        dateTo: dateTo as string
      });
      const response: ApiResponse = {
        success: true,
        data: requests
      };
      res.status(200).json(response);
    } catch (error) {
      next(error);
    }
  };

  public static getStats = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const stats = await MaintenanceService.getStats();
      const response: ApiResponse = {
        success: true,
        data: stats
      };
      res.status(200).json(response);
    } catch (error) {
      next(error);
    }
  };

  public static getWorkload = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const workload = await MaintenanceService.getTechnicianWorkload();
      const response: ApiResponse = {
        success: true,
        data: workload
      };
      res.status(200).json(response);
    } catch (error) {
      next(error);
    }
  };

  public static getById = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { id } = req.params;
      const request = await MaintenanceService.getRequestById(id);
      if (!request) {
        res.status(404).json({ success: false, error: 'Request not found' });
        return;
      }
      const response: ApiResponse = {
        success: true,
        data: request
      };
      res.status(200).json(response);
    } catch (error) {
      next(error);
    }
  };

  public static assign = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { id } = req.params;
      const { technicianId, supervisorId } = req.body;
      const request = await MaintenanceService.assignTechnician(id, technicianId, supervisorId);
      const response: ApiResponse = {
        success: true,
        data: request
      };
      res.status(200).json(response);
    } catch (error) {
      next(error);
    }
  };

  public static start = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { id } = req.params;
      const { technicianId } = req.body;
      const request = await MaintenanceService.startWork(id, technicianId);
      const response: ApiResponse = {
        success: true,
        data: request
      };
      res.status(200).json(response);
    } catch (error) {
      next(error);
    }
  };

  public static complete = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { id } = req.params;
      const { technicianId, completionNote, completionPhotoUrl } = req.body;
      const request = await MaintenanceService.submitCompletion(id, technicianId, completionNote, completionPhotoUrl);
      const response: ApiResponse = {
        success: true,
        data: request
      };
      res.status(200).json(response);
    } catch (error) {
      next(error);
    }
  };

  public static approve = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { id } = req.params;
      const { approverId, supervisorNote } = req.body;
      const request = await MaintenanceService.approveCompletion(id, approverId, supervisorNote);
      const response: ApiResponse = {
        success: true,
        data: request
      };
      res.status(200).json(response);
    } catch (error) {
      next(error);
    }
  };

  public static reject = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { id } = req.params;
      const { approverId, rejectionReason } = req.body;
      const request = await MaintenanceService.rejectCompletion(id, approverId, rejectionReason);
      const response: ApiResponse = {
        success: true,
        data: request
      };
      res.status(200).json(response);
    } catch (error) {
      next(error);
    }
  };

  public static spareParts = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { id } = req.params;
      const { technicianId, description } = req.body;
      const request = await MaintenanceService.requestSpareParts(id, technicianId, description);
      const response: ApiResponse = {
        success: true,
        data: request
      };
      res.status(200).json(response);
    } catch (error) {
      next(error);
    }
  };

  public static resume = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { id } = req.params;
      const { supervisorId } = req.body;
      const request = await MaintenanceService.resumeAfterParts(id, supervisorId);
      const response: ApiResponse = {
        success: true,
        data: request
      };
      res.status(200).json(response);
    } catch (error) {
      next(error);
    }
  };
}
