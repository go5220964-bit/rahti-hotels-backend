import { Request, Response, NextFunction } from 'express';
import prisma from '../services/prisma';

export class LoanController {
  public static getLoans = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { branchId, status } = req.query;

      const whereClause: any = {};
      if (status && status !== 'ALL') {
        whereClause.status = String(status);
      }
      if (branchId) {
        whereClause.user = { branchId: String(branchId) };
      }

      const loans = await prisma.loanRequest.findMany({
        where: whereClause,
        include: {
          user: {
            select: {
              id: true,
              name: true,
              email: true,
              phone: true,
              position: true,
              branchId: true,
              branch: { select: { id: true, name: true, code: true } }
            }
          }
        },
        orderBy: { createdAt: 'desc' }
      });

      const formattedLoans = loans.map((loan) => ({
        ...loan,
        employeeId: loan.userId,
        employeeName: loan.user?.name || 'موظف غير محدد',
        employee: loan.user
          ? {
              id: loan.user.id,
              name: loan.user.name,
              fullName: loan.user.name,
              position: loan.user.position,
              branch: loan.user.branch
            }
          : null
      }));

      res.status(200).json({ success: true, data: formattedLoans });
    } catch (error) {
      next(error);
    }
  };

  public static createLoan = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const resolvedUserId =
        req.body.userId ||
        req.body.employeeId ||
        req.body.user_id ||
        req.body.employee_id ||
        (req as any).user?.id;

      const { amount, reason, installments } = req.body;

      if (!resolvedUserId) {
        return res.status(400).json({
          success: false,
          message: 'يرجى تحديد الموظف (userId / employeeId) لطلب السلفة'
        });
      }

      const loan = await prisma.loanRequest.create({
        data: {
          userId: String(resolvedUserId),
          amount: parseFloat(amount),
          reason: reason || '',
          installments: parseInt(installments) || 1
        },
        include: {
          user: {
            select: {
              id: true,
              name: true,
              email: true,
              phone: true,
              position: true,
              branchId: true,
              branch: { select: { id: true, name: true, code: true } }
            }
          }
        }
      });

      res.status(201).json({
        success: true,
        data: {
          ...loan,
          employeeId: loan.userId,
          employeeName: loan.user?.name || 'موظف غير محدد',
          employee: loan.user
        }
      });
    } catch (error) {
      next(error);
    }
  };

  public static updateLoanStatus = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { id } = req.params;
      const { status, reason } = req.body;

      const updateData: any = { status };
      if (reason !== undefined) {
        updateData.reason = reason;
      }

      const loan = await prisma.loanRequest.update({
        where: { id },
        data: updateData,
        include: {
          user: {
            select: {
              id: true,
              name: true,
              email: true,
              position: true,
              branch: { select: { id: true, name: true } }
            }
          }
        }
      });

      res.status(200).json({
        success: true,
        data: {
          ...loan,
          employeeId: loan.userId,
          employeeName: loan.user?.name || 'موظف غير محدد',
          employee: loan.user
        }
      });
    } catch (error) {
      next(error);
    }
  };
}
