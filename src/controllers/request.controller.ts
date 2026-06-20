import { Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import { RequestService } from '../services/request.service';
import { ApiResponse, RequestType, RequestStatus, ApprovalStatus } from '../types';

// Zod schemas for input validation
export const createRequestSchema = z.object({
  body: z.object({
    requestType: z.nativeEnum(RequestType),
    branchId: z.string().min(1, 'Branch ID is required'),
    description: z.string().min(3, 'Description must be at least 3 characters long'),
    reporterId: z.string().min(1, 'Reporter ID is required'),
    assignedToId: z.string().optional(),
    estimatedCost: z.number().nonnegative().optional(),
    actualCost: z.number().nonnegative().optional(),
    beforeImageUrl: z.string().url('Invalid before image URL').optional().or(z.literal('')),
    afterImageUrl: z.string().url('Invalid after image URL').optional().or(z.literal('')),
    invoiceImageUrl: z.string().url('Invalid invoice image URL').optional().or(z.literal('')),
    rejectionReason: z.string().optional(),
    rejectionCount: z.number().int().nonnegative().optional(),
    rating: z.number().int().min(1).max(5).optional(),
  }),
});

export const updateRequestSchema = z.object({
  body: z.object({
    status: z.nativeEnum(RequestStatus).optional(),
    assignedToId: z.string().nullable().optional(),
    estimatedCost: z.number().nonnegative().optional(),
    actualCost: z.number().nonnegative().optional(),
    beforeImageUrl: z.string().url('Invalid before image URL').optional().or(z.literal('')),
    afterImageUrl: z.string().url('Invalid after image URL').optional().or(z.literal('')),
    invoiceImageUrl: z.string().url('Invalid invoice image URL').optional().or(z.literal('')),
    approvalStatus: z.nativeEnum(ApprovalStatus).optional(),
    description: z.string().min(3).optional(),
    rejectionReason: z.string().nullable().optional(),
    rejectionCount: z.number().int().nonnegative().optional(),
    rating: z.number().int().min(1).max(5).nullable().optional(),
  }),
});

export const getRequestsQuerySchema = z.object({
  query: z.object({
    requestType: z.nativeEnum(RequestType).optional(),
    status: z.nativeEnum(RequestStatus).optional(),
    approvalStatus: z.nativeEnum(ApprovalStatus).optional(),
    branchId: z.string().optional(),
    reporterId: z.string().optional(),
    assignedToId: z.string().optional(),
  }),
});

export class RequestController {
  /**
   * POST /api/requests
   */
  public static create = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const newRequest = await RequestService.createRequest(req.body);
      const response: ApiResponse = {
        success: true,
        data: newRequest,
      };
      res.status(201).json(response);
    } catch (error) {
      next(error);
    }
  };

  /**
   * GET /api/requests
   */
  public static getAll = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const requests = await RequestService.getAllRequests(req.query);
      const response: ApiResponse = {
        success: true,
        data: requests,
      };
      res.status(200).json(response);
    } catch (error) {
      next(error);
    }
  };

  /**
   * GET /api/requests/:id
   */
  public static getById = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { id } = req.params;
      const request = await RequestService.getRequestById(id);
      const response: ApiResponse = {
        success: true,
        data: request,
      };
      res.status(200).json(response);
    } catch (error) {
      next(error);
    }
  };

  /**
   * PATCH /api/requests/:id
   */
  public static update = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { id } = req.params;
      const updatedRequest = await RequestService.updateRequest(id, req.body);
      const response: ApiResponse = {
        success: true,
        data: updatedRequest,
      };
      res.status(200).json(response);
    } catch (error) {
      next(error);
    }
  };

  /**
   * DELETE /api/requests/:id
   */
  public static delete = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { id } = req.params;
      await RequestService.deleteRequest(id);
      const response: ApiResponse = {
        success: true,
        data: { id, message: 'Request successfully deleted' },
      };
      res.status(200).json(response);
    } catch (error) {
      next(error);
    }
  };
}
