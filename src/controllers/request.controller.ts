import { Request, Response, NextFunction } from 'express';
import prisma from '../services/prisma';

export class RequestController {
  public static getRequests = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { type, status } = req.query;
      const whereClause: any = {};

      if (type) whereClause.type = String(type);
      if (status && status !== 'ALL') whereClause.status = String(status);

      const requests = await prisma.request.findMany({
        where: whereClause,
        include: {
          user: {
            select: {
              id: true,
              name: true,
              position: true,
              branch: { select: { id: true, name: true } }
            }
          }
        },
        orderBy: { createdAt: 'desc' }
      });
      res.status(200).json({ success: true, data: requests });
    } catch (error) {
      next(error);
    }
  };

  public static createRequest = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { title, type, amount, userId, notes } = req.body;
      const resolvedUserId = userId || (req as any).user?.id;

      const request = await prisma.request.create({
        data: {
          title,
          type: type || 'PURCHASE',
          amount: amount ? parseFloat(amount) : null,
          userId: String(resolvedUserId),
          notes: notes || ''
        },
        include: {
          user: {
            select: {
              id: true,
              name: true,
              branch: { select: { id: true, name: true } }
            }
          }
        }
      });
      res.status(201).json({ success: true, data: request });
    } catch (error) {
      next(error);
    }
  };

  public static updateRequestStatus = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { id } = req.params;
      const { status, notes } = req.body;

      const updated = await prisma.request.update({
        where: { id },
        data: {
          status,
          ...(notes !== undefined ? { notes } : {})
        },
        include: {
          user: {
            select: {
              id: true,
              name: true,
              branch: { select: { id: true, name: true } }
            }
          }
        }
      });

      res.status(200).json({ success: true, data: updated });
    } catch (error) {
      next(error);
    }
  };
}
