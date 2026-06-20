import prisma from './prisma';
import { AppError } from '../middleware/error.middleware';

export class LoanService {
  public static async createLoanRequest(userId: string, amount: number, reason: string, repaymentMonths?: number) {
    const user = await prisma.user.findUnique({ where: { id: userId } });
    if (!user) {
      throw new AppError(404, 'USER_NOT_FOUND', 'الموظف غير موجود.');
    }
    if (amount <= 0) {
      throw new AppError(400, 'INVALID_AMOUNT', 'يجب أن يكون مبلغ السلفة أكبر من الصفر.');
    }
    const branchId = user.branchId || '';
    if (!branchId) {
      throw new AppError(400, 'BRANCH_REQUIRED', 'الموظف غير مرتبط بفرع.');
    }
    return await prisma.loanRequest.create({
      data: {
        employeeId: userId,
        branchId,
        amount,
        reason,
        status: 'Pending',
        repaymentMonths: repaymentMonths || 1,
      },
      include: {
        user: {
          include: {
            branch: true,
          },
        },
      },
    });
  }

  public static async getLoanRequests(filters: { status?: string; userId?: string; branchId?: string }) {
    const where: any = {};
    if (filters.status) {
      where.status = filters.status;
    }
    if (filters.userId) {
      where.employeeId = filters.userId;
    }
    if (filters.branchId) {
      where.branchId = filters.branchId;
    }
    return await prisma.loanRequest.findMany({
      where,
      include: {
        user: {
          include: {
            branch: true,
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  public static async reviewLoanRequest(id: string, reviewerId: string, status: string, reviewNote?: string) {
    const loan = await prisma.loanRequest.findUnique({
      where: { id },
      include: {
        user: true,
      },
    });
    if (!loan) {
      throw new AppError(404, 'LOAN_NOT_FOUND', 'طلب السلفة غير موجود.');
    }
    if (loan.status !== 'Pending') {
      throw new AppError(400, 'ALREADY_REVIEWED', 'تم مراجعة هذا الطلب مسبقاً.');
    }
    if (status !== 'Approved' && status !== 'Rejected') {
      throw new AppError(400, 'INVALID_STATUS', 'حالة المراجعة يجب أن تكون Approved أو Rejected.');
    }
    if (status === 'Rejected' && (!reviewNote || reviewNote.trim() === '')) {
      throw new AppError(400, 'REVIEW_NOTE_REQUIRED', 'يجب كتابة سبب الرفض.');
    }

    return await prisma.loanRequest.update({
      where: { id },
      data: {
        status,
        approvedBy: reviewerId,
        notes: reviewNote,
        approvedAt: new Date(),
      },
      include: {
        user: {
          include: {
            branch: true,
          },
        },
      },
    });
  }

  public static async getEmployeeLoanHistory(userId: string) {
    return await prisma.loanRequest.findMany({
      where: { employeeId: userId },
      include: {
        user: {
          include: {
            branch: true,
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    });
  }
}
