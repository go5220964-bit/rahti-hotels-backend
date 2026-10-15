import { Request, Response, NextFunction } from 'express';
import prisma from '../services/prisma';

export class AttendanceController {
  public static getAttendanceLogs = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { branchId, userId, date } = req.query;
      const whereClause: any = {};

      if (userId) {
        whereClause.userId = String(userId);
      }
      if (branchId) {
        whereClause.user = { branchId: String(branchId) };
      }
      if (date) {
        const parsed = new Date(String(date));
        if (!isNaN(parsed.getTime())) {
          const start = new Date(parsed);
          start.setHours(0, 0, 0, 0);
          const end = new Date(parsed);
          end.setHours(23, 59, 59, 999);
          whereClause.checkIn = { gte: start, lte: end };
        }
      }

      const logs = await prisma.attendanceLog.findMany({
        where: whereClause,
        include: {
          user: {
            select: {
              id: true,
              name: true,
              position: true,
              branchId: true,
              branch: { select: { id: true, name: true, code: true } }
            }
          }
        },
        orderBy: { checkIn: 'desc' }
      });

      res.status(200).json({ success: true, data: logs });
    } catch (error) {
      next(error);
    }
  };

  public static getDailyGrid = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { date, branchId } = req.query;
      const resolvedBranchId = branchId ? String(branchId) : (req as any).user?.branchId;

      const baseDate = date ? new Date(String(date)) : new Date();
      const validDate = isNaN(baseDate.getTime()) ? new Date() : baseDate;

      const startOfDay = new Date(validDate);
      startOfDay.setHours(0, 0, 0, 0);

      const endOfDay = new Date(validDate);
      endOfDay.setHours(23, 59, 59, 999);

      const userFilter: any = {};
      if (resolvedBranchId) {
        userFilter.branchId = resolvedBranchId;
      }

      const [employees, logs, activeBranch] = await Promise.all([
        prisma.user.findMany({
          where: userFilter,
          include: { branch: true },
          orderBy: { name: 'asc' }
        }),
        prisma.attendanceLog.findMany({
          where: {
            checkIn: { gte: startOfDay, lte: endOfDay },
            ...(resolvedBranchId ? { user: { branchId: resolvedBranchId } } : {})
          },
          include: {
            user: { select: { id: true, name: true, position: true, branch: true } }
          }
        }),
        resolvedBranchId
          ? prisma.branch.findUnique({ where: { id: resolvedBranchId } })
          : prisma.branch.findFirst()
      ]);

      const logByUserId = new Map(logs.map((log) => [log.userId, log]));

      const grid = employees.map((emp) => {
        const log = logByUserId.get(emp.id);
        return {
          employeeId: emp.id,
          userId: emp.id,
          name: emp.name || 'موظف',
          position: emp.position || emp.role,
          branchId: emp.branchId,
          branchName: emp.branch?.name || activeBranch?.name || 'راحتي للشقق المخدومة',
          date: startOfDay.toISOString().split('T')[0],
          status: log ? log.status : 'ABSENT',
          checkIn: log?.checkIn || null,
          checkOut: log?.checkOut || null,
          logId: log?.id || null
        };
      });

      res.status(200).json({
        success: true,
        branch: activeBranch || { name: 'راحتي للشقق المخدومة' },
        date: startOfDay.toISOString().split('T')[0],
        data: grid,
        logs
      });
    } catch (error) {
      next(error);
    }
  };
}
