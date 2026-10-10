"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.ShiftReportService = void 0;
const prisma_1 = __importDefault(require("./prisma"));
const error_middleware_1 = require("../middleware/error.middleware");
class ShiftReportService {
    static async createShiftReport(data) {
        const cashNet = data.cashTotal - data.cashExpenses;
        const grandTotal = cashNet + data.visa + data.mada + data.mastercard + data.gulfNet + data.tabby + data.bankTransfer;
        const createData = {
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
        const report = await prisma_1.default.shiftReport.create({
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
    static async getAllShiftReports(filters) {
        const whereClause = {};
        if (filters) {
            if (filters.branchId)
                whereClause.branchId = filters.branchId;
            if (filters.reporterId)
                whereClause.reporterId = filters.reporterId;
            if (filters.status)
                whereClause.status = filters.status;
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
        const reports = await prisma_1.default.shiftReport.findMany({
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
    static async getShiftReportById(id) {
        const report = await prisma_1.default.shiftReport.findUnique({
            where: { id },
            include: {
                reporter: {
                    select: { id: true, name: true, role: true, phoneNumber: true },
                },
                branch: true,
            },
        });
        if (!report) {
            throw new error_middleware_1.AppError(404, 'SHIFT_REPORT_NOT_FOUND', `Shift report with ID ${id} was not found.`);
        }
        return await this.appendDamageFields(report);
    }
    static async approveShiftReport(id, reviewerId) {
        const reviewer = await prisma_1.default.user.findUnique({
            where: { id: reviewerId },
        });
        const reviewerName = reviewer ? reviewer.name : reviewerId;
        const report = await prisma_1.default.shiftReport.update({
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
    static async rejectShiftReport(id, reviewerId, reason) {
        const reviewer = await prisma_1.default.user.findUnique({
            where: { id: reviewerId },
        });
        const reviewerName = reviewer ? reviewer.name : reviewerId;
        const report = await prisma_1.default.shiftReport.update({
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
    static async updateShiftReport(id, data) {
        const report = await prisma_1.default.shiftReport.findUnique({ where: { id } });
        if (!report) {
            throw new error_middleware_1.AppError(404, 'SHIFT_REPORT_NOT_FOUND', `تقرير الوردية ذو المعرف ${id} غير موجود.`);
        }
        if (report.status !== 'PendingAccountant') {
            throw new error_middleware_1.AppError(403, 'FORBIDDEN', `لا يمكن تعديل تقرير الوردية وحالته الحالية هي: ${report.status}`);
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
        const updateData = {
            ...data,
            cashNet,
            grandTotal
        };
        if (data.shiftId !== undefined)
            updateData.shiftId = data.shiftId;
        if (data.customStartTime !== undefined)
            updateData.customStartTime = data.customStartTime;
        if (data.customEndTime !== undefined)
            updateData.customEndTime = data.customEndTime;
        if (data.isManual !== undefined)
            updateData.isManual = data.isManual;
        if (data.manualEnteredBy !== undefined)
            updateData.manualEnteredBy = data.manualEnteredBy;
        if (data.branchId)
            updateData.branchId = data.branchId;
        if (data.reporterId)
            updateData.reporterId = data.reporterId;
        if (data.shiftLabel)
            updateData.shiftLabel = data.shiftLabel;
        const updatedReport = await prisma_1.default.shiftReport.update({
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
    static async deleteShiftReport(id) {
        const report = await prisma_1.default.shiftReport.findUnique({ where: { id } });
        if (!report) {
            throw new error_middleware_1.AppError(404, 'SHIFT_REPORT_NOT_FOUND', `تقرير الوردية ذو المعرف ${id} غير موجود.`);
        }
        if (report.status !== 'PendingAccountant') {
            throw new error_middleware_1.AppError(403, 'FORBIDDEN', `لا يمكن حذف تقرير الوردية وحالته الحالية هي: ${report.status}`);
        }
        return await prisma_1.default.shiftReport.delete({
            where: { id }
        });
    }
    static async getReporterStats(reporterId, preserveHistory = true) {
        const user = await prisma_1.default.user.findUnique({
            where: { id: reporterId },
        });
        if (!user) {
            throw new error_middleware_1.AppError(404, 'USER_NOT_FOUND', `الموظف ذو المعرف ${reporterId} غير موجود.`);
        }
        const whereClause = { reporterId };
        if (!preserveHistory) {
            whereClause.branchId = user.branchId;
        }
        const reports = await prisma_1.default.shiftReport.findMany({
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
    static async appendDamageFields(report) {
        const dateStart = new Date(report.createdAt);
        dateStart.setHours(0, 0, 0, 0);
        const dateEnd = new Date(report.createdAt);
        dateEnd.setHours(23, 59, 59, 999);
        const paidDamages = await prisma_1.default.damageReport.findMany({
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
exports.ShiftReportService = ShiftReportService;
