import { Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import { LostFoundService } from '../services/lostfound.service';
import { ApiResponse } from '../types';

export const createLostItemSchema = z.object({
  body: z.object({
    reportedBy: z.string().min(1, 'Reporter ID is required'),
    branchId: z.string().min(1, 'Branch ID is required'),
    location: z.string().min(1, 'Location is required'),
    description: z.string().min(1, 'Description is required'),
    photoUrl: z.string().nullable().optional(),
    guestName: z.string().nullable().optional(),
    guestPhone: z.string().nullable().optional(),
    reservationRef: z.string().nullable().optional(),
    notes: z.string().nullable().optional(),
  })
});

export const updateGuestContactSchema = z.object({
  body: z.object({
    guestName: z.string().nullable().optional(),
    guestPhone: z.string().nullable().optional(),
  })
});

export const claimItemSchema = z.object({
  body: z.object({
    claimedBy: z.string().min(1, 'Claimed by name is required'),
    claimedIdType: z.string().min(1, 'ID Type is required'),
    claimedIdNumber: z.string().min(1, 'ID Number is required'),
    handedOverBy: z.string().min(1, 'Handed over by userId is required'),
  })
});

export const createDamageReportSchema = z.object({
  body: z.object({
    reportedBy: z.string().min(1, 'Reporter ID is required'),
    branchId: z.string().min(1, 'Branch ID is required'),
    roomNumber: z.string().min(1, 'Room number is required'),
    damageType: z.string().min(1, 'Damage type is required'),
    description: z.string().min(1, 'Description is required'),
    photoUrls: z.string().optional(),
    reportedDuring: z.string().optional(),
    reservationRef: z.string().nullable().optional(),
    guestName: z.string().nullable().optional(),
    guestPhone: z.string().nullable().optional(),
    estimatedValue: z.number().nullable().optional(),
  })
});

export const reviewDamageSchema = z.object({
  body: z.object({
    reviewerId: z.string().min(1, 'Reviewer ID is required'),
    finalValue: z.number().nonnegative('Final compensation value must be positive'),
    reviewNote: z.string().nullable().optional(),
  })
});

export const collectPaymentSchema = z.object({
  body: z.object({
    paymentMethod: z.string().min(1, 'Payment method is required'),
    paymentRef: z.string().nullable().optional(),
    collectedBy: z.string().min(1, 'Collector ID is required'),
    paymentDueDate: z.string().nullable().optional(),
  })
});

export const markRefusedSchema = z.object({
  body: z.object({
    refusalReason: z.string().min(1, 'Refusal reason is required'),
  })
});

export const waiveDamageSchema = z.object({
  body: z.object({
    waivedBy: z.string().min(1, 'Waiver authorized by is required'),
    waiverReason: z.string().min(1, 'Waiver reason is required'),
  })
});

export class LostFoundController {
  // -------------------------------------------------------------
  // Lost & Found Handlers
  // -------------------------------------------------------------
  public static getAllLost = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { status, branchId, dateFrom, dateTo } = req.query;
      const items = await LostFoundService.getLostItems({
        status: status as string,
        branchId: branchId as string,
        dateFrom: dateFrom as string,
        dateTo: dateTo as string
      });
      const response: ApiResponse = { success: true, data: items };
      res.status(200).json(response);
    } catch (error) {
      next(error);
    }
  };

  public static createLost = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const item = await LostFoundService.createLostItem(req.body);
      const response: ApiResponse = { success: true, data: item };
      res.status(201).json(response);
    } catch (error) {
      next(error);
    }
  };

  public static getLostById = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { id } = req.params;
      const item = await LostFoundService.getLostItemById(id);
      if (!item) {
        res.status(404).json({ success: false, error: { code: 'NOT_FOUND', message: 'Lost item not found' } });
        return;
      }
      const response: ApiResponse = { success: true, data: item };
      res.status(200).json(response);
    } catch (error) {
      next(error);
    }
  };

  public static contactGuest = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { id } = req.params;
      const { guestName, guestPhone } = req.body;
      const item = await LostFoundService.updateGuestContact(id, guestName, guestPhone);
      const response: ApiResponse = { success: true, data: item };
      res.status(200).json(response);
    } catch (error) {
      next(error);
    }
  };

  public static claimLost = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { id } = req.params;
      const item = await LostFoundService.claimItem(id, req.body);
      const response: ApiResponse = { success: true, data: item };
      res.status(200).json(response);
    } catch (error) {
      next(error);
    }
  };

  public static archiveLost = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { id } = req.params;
      const item = await LostFoundService.archiveItem(id);
      const response: ApiResponse = { success: true, data: item };
      res.status(200).json(response);
    } catch (error) {
      next(error);
    }
  };

  // -------------------------------------------------------------
  // Damage Report Handlers
  // -------------------------------------------------------------
  public static getAllDamage = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { status, branchId, reservationRef, dateFrom, dateTo } = req.query;
      const reports = await LostFoundService.getDamageReports({
        status: status as string,
        branchId: branchId as string,
        reservationRef: reservationRef as string,
        dateFrom: dateFrom as string,
        dateTo: dateTo as string
      });
      const response: ApiResponse = { success: true, data: reports };
      res.status(200).json(response);
    } catch (error) {
      next(error);
    }
  };

  public static createDamage = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const report = await LostFoundService.createDamageReport(req.body);
      const response: ApiResponse = { success: true, data: report };
      res.status(201).json(response);
    } catch (error) {
      next(error);
    }
  };

  public static getDamageById = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { id } = req.params;
      const report = await LostFoundService.getDamageById(id);
      if (!report) {
        res.status(404).json({ success: false, error: { code: 'NOT_FOUND', message: 'Damage report not found' } });
        return;
      }
      const response: ApiResponse = { success: true, data: report };
      res.status(200).json(response);
    } catch (error) {
      next(error);
    }
  };

  public static reviewDamage = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { id } = req.params;
      const { reviewerId, finalValue, reviewNote } = req.body;
      const report = await LostFoundService.reviewDamage(id, reviewerId, finalValue, reviewNote);
      const response: ApiResponse = { success: true, data: report };
      res.status(200).json(response);
    } catch (error) {
      next(error);
    }
  };

  public static collectPayment = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { id } = req.params;
      const report = await LostFoundService.collectPayment(id, req.body);
      const response: ApiResponse = { success: true, data: report };
      res.status(200).json(response);
    } catch (error) {
      next(error);
    }
  };

  public static markRefused = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { id } = req.params;
      const { refusalReason } = req.body;
      const report = await LostFoundService.markRefused(id, refusalReason);
      const response: ApiResponse = { success: true, data: report };
      res.status(200).json(response);
    } catch (error) {
      next(error);
    }
  };

  public static waiveDamage = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { id } = req.params;
      const { waivedBy, waiverReason } = req.body;
      const report = await LostFoundService.waiveDamage(id, waivedBy, waiverReason);
      const response: ApiResponse = { success: true, data: report };
      res.status(200).json(response);
    } catch (error) {
      next(error);
    }
  };

  public static getStats = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { branchId } = req.query;
      const stats = await LostFoundService.getDamageStats(branchId as string);
      const response: ApiResponse = { success: true, data: stats };
      res.status(200).json(response);
    } catch (error) {
      next(error);
    }
  };
}
