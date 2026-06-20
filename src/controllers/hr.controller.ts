import { Request, Response, NextFunction } from 'express';
import prisma from '../services/prisma';
import { WhatsAppService } from '../services/whatsapp.service';
import { ApiResponse } from '../types';
import { ActivityLogService } from '../services/activity-log.service';

export class HRController {
  // 3a. Broadcast announcements via WhatsApp bot to target branch(es)
  public static broadcastAnnouncement = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { title, body, branchId, sentViaWhatsApp } = req.body;
      const caller = (req as any).user || { id: 'system' };

      // Find target employees
      const whereClause: any = {
        isActive: true
      };
      
      if (branchId && branchId !== 'all') {
        whereClause.branchId = branchId;
      }

      const targetUsers = await prisma.user.findMany({
        where: whereClause
      });

      // Send WhatsApp notifications if requested
      if (sentViaWhatsApp && targetUsers.length > 0) {
        const messageText = `📢 *تعميم إداري هام: ${title}*\n\n${body}\n\n_صادر عن إدارة الموارد البشرية_`;
        for (const targetUser of targetUsers) {
          // Check if bot is enabled for user
          if (targetUser.botEnabled) {
            await WhatsAppService.sendWhatsAppMessage(targetUser.phoneNumber, messageText);
          }
        }
      }

      await ActivityLogService.log(
        caller.id,
        'BROADCAST_ANNOUNCEMENT',
        'Announcement',
        branchId || 'all',
        { title, body, sentViaWhatsApp, recipientCount: targetUsers.length },
        req.ip
      );

      const response: ApiResponse = {
        success: true,
        data: { recipientCount: targetUsers.length, message: 'Announcement successfully broadcasted' }
      };
      res.status(201).json(response);
    } catch (error) {
      next(error);
    }
  };

  // 3d. Get Employee Transfer history
  public static getTransferHistory = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { userId } = req.params;
      const transfers = await prisma.employeeTransfer.findMany({
        where: { employeeId: userId },
        include: {
          fromBranch: true,
          toBranch: true
        },
        orderBy: { transferDate: 'desc' }
      });

      const response: ApiResponse = {
        success: true,
        data: transfers
      };
      res.status(200).json(response);
    } catch (error) {
      next(error);
    }
  };

  // 4a. Finance Loan metrics (total pending amount)
  public static getFinanceLoanMetrics = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const pendingLoans = await prisma.loanRequest.findMany({
        where: { status: 'Pending' }
      });

      const totalPendingAmount = pendingLoans.reduce((sum, loan) => sum + loan.amount, 0);

      const response: ApiResponse = {
        success: true,
        data: {
          totalPendingAmount,
          count: pendingLoans.length
        }
      };
      res.status(200).json(response);
    } catch (error) {
      next(error);
    }
  };
}
