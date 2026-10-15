import { Request, Response, NextFunction } from 'express';
import prisma from '../services/prisma';

export class MaintenanceController {
  public static getTickets = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { branchId, status, priority } = req.query;
      const whereClause: any = {};

      if (branchId) whereClause.branchId = String(branchId);
      if (status && status !== 'ALL') whereClause.status = String(status);
      if (priority && priority !== 'ALL') whereClause.priority = String(priority);

      const tickets = await prisma.maintenanceTicket.findMany({
        where: whereClause,
        include: {
          branch: true,
          createdBy: { select: { id: true, name: true, phone: true } },
          technician: { select: { id: true, name: true, phone: true } }
        },
        orderBy: { createdAt: 'desc' }
      });

      res.status(200).json({ success: true, data: tickets });
    } catch (error) {
      next(error);
    }
  };

  public static createTicket = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { title, description, roomNumber, priority, branchId, createdById, technicianId } = req.body;

      const resolvedBranchId = branchId || (req as any).user?.branchId;
      const resolvedCreatedById = createdById || (req as any).user?.id;

      const ticket = await prisma.maintenanceTicket.create({
        data: {
          title,
          description: description || '',
          roomNumber: roomNumber ? String(roomNumber) : null,
          priority: priority || 'MEDIUM',
          branchId: String(resolvedBranchId),
          createdById: String(resolvedCreatedById),
          ...(technicianId ? { technicianId: String(technicianId) } : {})
        },
        include: {
          branch: true,
          createdBy: { select: { id: true, name: true } },
          technician: { select: { id: true, name: true } }
        }
      });

      res.status(201).json({ success: true, data: ticket });
    } catch (error) {
      next(error);
    }
  };

  public static updateTicket = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { id } = req.params;
      const { status, technicianId, priority, description } = req.body;

      const updateData: any = {};
      if (status) updateData.status = status;
      if (technicianId !== undefined) updateData.technicianId = technicianId || null;
      if (priority) updateData.priority = priority;
      if (description !== undefined) updateData.description = description;

      const ticket = await prisma.maintenanceTicket.update({
        where: { id },
        data: updateData,
        include: {
          branch: true,
          createdBy: { select: { id: true, name: true } },
          technician: { select: { id: true, name: true } }
        }
      });

      res.status(200).json({ success: true, data: ticket });
    } catch (error) {
      next(error);
    }
  };

  public static updateStatus = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { id } = req.params;
      const { status, technicianId } = req.body;
      const ticket = await prisma.maintenanceTicket.update({
        where: { id },
        data: {
          status,
          ...(technicianId ? { technicianId } : {})
        },
        include: {
          branch: true,
          createdBy: { select: { id: true, name: true } },
          technician: { select: { id: true, name: true } }
        }
      });
      res.status(200).json({ success: true, data: ticket });
    } catch (error) {
      next(error);
    }
  };

  public static assignTechnician = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { id } = req.params;
      const { technicianId, status } = req.body;
      const ticket = await prisma.maintenanceTicket.update({
        where: { id },
        data: {
          technicianId,
          ...(status ? { status } : {})
        },
        include: {
          branch: true,
          createdBy: { select: { id: true, name: true } },
          technician: { select: { id: true, name: true } }
        }
      });
      res.status(200).json({ success: true, data: ticket });
    } catch (error) {
      next(error);
    }
  };
}
