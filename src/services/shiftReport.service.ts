import prisma from './prisma';
import { AppError } from '../middleware/error.middleware';

export interface CreateShiftReportInput {
  reporterId: string;
  branchId: string;
  shiftLabel: string;
  cashTotal: number;
  cashExpenses: number;
  visa: number;
  mada: number;
  mastercard: number;
  gulfNet: number;
  tabby: number;
  bankTransfer: number;
  shiftId?: string | null;
  customStartTime?: string | null;
  customEndTime?: string | null;
  isManual?: boolean;
  manualEnteredBy?: string | null;
  createdAt?: string | Date;
}

export interface ShiftReportFilters {
  branchId?: string;
  reporterId?: string;
  status?: string;
  startDate?: string;
  endDate?: string;
}

export class ShiftReportService {
  public static async createShiftReport(data: CreateShiftReportInput) {
    const cashNet = data.cashTotal - data.cashExpenses;
    const grandTotal = cashNet + data.visa + data.mada + data.mastercard + data.gulfNet + data.tabby + data.bankTransfer;

    const createData: any = {
      reporterId: data.reporterId,
      branchId: data.branchId,
      shiftLabel: data.shiftLabel,
      cashTotal: data.cashTotal,
      cashExpenses: data.cashExpenses,
      cashNet,
      visa: data.visa,
      mada: data.mada,
      mastercard: data.mastercard,
      gulfNet: data.gulfNet,
      tabby: data.tabby,
      bankTransfer: data.bankTransfer,
      grandTotal,
      shiftId: data.shiftId || null,
      customStartTime: data.customStartTime || null,
      customEndTime: data.customEndTime || null,
      isManual: data.isManual ?? false,
      manualEnteredBy: data.manualEnteredBy || null,
      status: 'PendingAccountant',
    };

    if (data.createdAt) {
      createData.createdAt = new Date(data.createdAt);
    }

    const report = await prisma.shiftReport.create({
      data: createData,
      include: {
        reporter: {
          select: { id: true, name: true, role: true, phoneNumber: true },
        },
        branch: true,
      },
    });
    return await this.appendDamageFields(report);
  }

  public static async getAllShiftReports(filters?: ShiftReportFilters) {
    const whereClause: any = {};

    if (filters) {
      if (filters.branchId) whereClause.branchId = filters.branchId;
      if (filters.reporterId) whereClause.reporterId = filters.reporterId;
      if (filters.status) whereClause.status = filters.status;
      if (filters.startDate || filters.endDate) {
        whereClause.createdAt = {};
        if (filters.startDate) {
          whereClause.createdAt.gte = new Date(filters.startDate);
        }
        if (filters.endDate) {
          const end = new Date(filters.endDate);
          end.setHours(23, 59, 59, 999);
          whereClause.createdAt.lte = end;
        }
      }
    }

    const reports = await prisma.shiftReport.findMany({
      where: whereClause,
      include: {
        reporter: {
          select: { id: true, name: true, role: true, phoneNumber: true },
        },
        branch: true,
      },
      orderBy: { createdAt: 'desc' },
    });
    const results = [];
    for (const r of reports) {
      results.push(await this.appendDamageFields(r));
    }
    return results;
  }

  public static async getShiftReportById(id: string) {
    const report = await prisma.shiftReport.findUnique({
      where: { id },
      include: {
        reporter: {
          select: { id: true, name: true, role: true, phoneNumber: true },
        },
        branch: true,
      },
    });

    if (!report) {
      throw new AppError(404, 'SHIFT_REPORT_NOT_FOUND', `Shift report with ID ${id} was not found.`);
    }

    return await this.appendDamageFields(report);
  }

  public static async approveShiftReport(id: string, reviewerId: string) {
    const reviewer = await prisma.user.findUnique({
      where: { id: reviewerId },
    });
    const reviewerName = reviewer ? reviewer.name : reviewerId;

    const report = await prisma.shiftReport.update({
      where: { id },
      data: {
        status: 'Approved',
        reviewedBy: reviewerName,
        reviewedAt: new Date(),
      },
      include: {
        reporter: true,
        branch: true,
      },
    });
    return await this.appendDamageFields(report);
  }

  public static async rejectShiftReport(id: string, reviewerId: string, reason: string) {
    const reviewer = await prisma.user.findUnique({
      where: { id: reviewerId },
    });
    const reviewerName = reviewer ? reviewer.name : reviewerId;

    const report = await prisma.shiftReport.update({
      where: { id },
      data: {
        status: 'Rejected',
        rejectionReason: reason,
        reviewedBy: reviewerName,
        reviewedAt: new Date(),
      },
      include: {
        reporter: true,
        branch: true,
      },
    });
    return await this.appendDamageFields(report);
  }

  public static async updateShiftReport(id: string, data: Partial<CreateShiftReportInput>) {
    const report = await prisma.shiftReport.findUnique({ where: { id } });
    if (!report) {
      throw new AppError(404, 'SHIFT_REPORT_NOT_FOUND', `تقرير الوردية ذو المعرف ${id} غير موجود.`);
    }

    if (report.status !== 'PendingAccountant') {
      throw new AppError(403, 'FORBIDDEN', `لا يمكن تعديل تقرير الوردية وحالته الحالية هي: ${report.status}`);
    }

    const cashTotal = data.cashTotal !== undefined ? data.cashTotal : report.cashTotal;
    const cashExpenses = data.cashExpenses !== undefined ? data.cashExpenses : report.cashExpenses;
    const cashNet = cashTotal - cashExpenses;

    const visa = data.visa !== undefined ? data.visa : report.visa;
    const mada = data.mada !== undefined ? data.mada : report.mada;
    const mastercard = data.mastercard !== undefined ? data.mastercard : report.mastercard;
    const gulfNet = data.gulfNet !== undefined ? data.gulfNet : report.gulfNet;
    const tabby = data.tabby !== undefined ? data.tabby : report.tabby;
    const bankTransfer = data.bankTransfer !== undefined ? data.bankTransfer : report.bankTransfer;

    const grandTotal = cashNet + visa + mada + mastercard + gulfNet + tabby + bankTransfer;

    const updateData: any = {
      ...data,
      cashNet,
      grandTotal
    };

    if (data.shiftId !== undefined) updateData.shiftId = data.shiftId;
    if (data.customStartTime !== undefined) updateData.customStartTime = data.customStartTime;
    if (data.customEndTime !== undefined) updateData.customEndTime = data.customEndTime;
    if (data.isManual !== undefined) updateData.isManual = data.isManual;
    if (data.manualEnteredBy !== undefined) updateData.manualEnteredBy = data.manualEnteredBy;
    if (data.branchId) updateData.branchId = data.branchId;
    if (data.reporterId) updateData.reporterId = data.reporterId;
    if (data.shiftLabel) updateData.shiftLabel = data.shiftLabel;

    const updatedReport = await prisma.shiftReport.update({
      where: { id },
      data: updateData,
      include: {
        reporter: {
          select: { id: true, name: true, role: true, phoneNumber: true },
        },
        branch: true,
      },
    });
    return await this.appendDamageFields(updatedReport);
  }

  public static async deleteShiftReport(id: string) {
    const report = await prisma.shiftReport.findUnique({ where: { id } });
    if (!report) {
      throw new AppError(404, 'SHIFT_REPORT_NOT_FOUND', `تقرير الوردية ذو المعرف ${id} غير موجود.`);
    }

    if (report.status !== 'PendingAccountant') {
      throw new AppError(403, 'FORBIDDEN', `لا يمكن حذف تقرير الوردية وحالته الحالية هي: ${report.status}`);
    }

    return await prisma.shiftReport.delete({
      where: { id }
    });
  }

  public static async getReporterStats(reporterId: string, preserveHistory: boolean = true) {
    const user = await prisma.user.findUnique({
      where: { id: reporterId },
    });
    if (!user) {
      throw new AppError(404, 'USER_NOT_FOUND', `الموظف ذو المعرف ${reporterId} غير موجود.`);
    }

    const whereClause: any = { reporterId };
    if (!preserveHistory) {
      whereClause.branchId = user.branchId;
    }

    const reports = await prisma.shiftReport.findMany({
      where: whereClause,
    });

    const totalSubmitted = reports.length;
    const approved = reports.filter(r => r.status === 'Approved').length;
    const rejected = reports.filter(r => r.status === 'Rejected').length;
    const rejectionRate = totalSubmitted > 0 ? (rejected / totalSubmitted) * 100 : 0;

    return {
      totalSubmitted,
      approved,
      rejected,
      rejectionRate: parseFloat(rejectionRate.toFixed(2)),
    };
  }

  private static async appendDamageFields(report: any) {
    const dateStart = new Date(report.createdAt);
    dateStart.setHours(0, 0, 0, 0);
    const dateEnd = new Date(report.createdAt);
    dateEnd.setHours(23, 59, 59, 999);

    const paidDamages = await prisma.damageReport.findMany({
      where: {
        branchId: report.branchId,
        status: 'Paid',
        collectedAt: {
          gte: dateStart,
          lte: dateEnd
        }
      }
    });

    const damageCompensations = paidDamages.reduce((sum, d) => sum + (d.finalValue || 0), 0);
    const remaining = report.grandTotal - damageCompensations;
    const roomRevenue = remaining * 0.75;
    const serviceRevenue = remaining * 0.25;

    return {
      ...report,
      damageCompensations,
      roomRevenue,
      serviceRevenue
    };
  }
}
