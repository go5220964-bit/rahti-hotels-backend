"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.LeaveService = void 0;
const prisma_1 = __importDefault(require("./prisma"));
const error_middleware_1 = require("../middleware/error.middleware");
class LeaveService {
    static async createLeaveRequest(userId, leaveType, startDate, endDate, reason) {
        const user = await prisma_1.default.user.findUnique({ where: { id: userId } });
        if (!user) {
            throw new error_middleware_1.AppError(404, 'USER_NOT_FOUND', 'الموظف غير موجود.');
        }
        const start = new Date(startDate);
        const end = new Date(endDate);
        // Reset hours to midnight for date-only comparison
        const startCompare = new Date(start);
        startCompare.setHours(0, 0, 0, 0);
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        if (startCompare < today) {
            throw new error_middleware_1.AppError(400, 'PAST_START_DATE', 'تاريخ البداية لا يمكن أن يكون في الماضي.');
        }
        const diffTime = end.getTime() - start.getTime();
        if (diffTime < 0) {
            throw new error_middleware_1.AppError(400, 'INVALID_DATES', 'تاريخ النهاية يجب أن يكون مساوياً أو بعد تاريخ البداية.');
        }
        const daysCount = Math.ceil(diffTime / (1000 * 60 * 60 * 24)) + 1;
        // Validate balance for Annual and Sick leaves
        if (leaveType === 'Annual' && daysCount > user.annualLeaveBalance) {
            throw new error_middleware_1.AppError(400, 'INSUFFICIENT_BALANCE', `رصيد إجازاتك السنوية غير كافٍ. رصيدك الحالي: ${user.annualLeaveBalance} يوم فقط.`);
        }
        if (leaveType === 'Sick' && daysCount > user.sickLeaveBalance) {
            throw new error_middleware_1.AppError(400, 'INSUFFICIENT_BALANCE', `رصيد إجازاتك المرضية غير كافٍ. رصيدك الحالي: ${user.sickLeaveBalance} يوم فقط.`);
        }
        // Check for overlapping approved leaves
        const overlapping = await prisma_1.default.leaveRequest.findFirst({
            where: {
                userId,
                status: 'Approved',
                OR: [
                    {
                        startDate: { lte: end },
                        endDate: { gte: start }
                    }
                ]
            }
        });
        if (overlapping) {
            throw new error_middleware_1.AppError(400, 'OVERLAPPING_LEAVE', 'يوجد إجازة معتمدة متداخلة مع هذه الفترة.');
        }
        return await prisma_1.default.leaveRequest.create({
            data: {
                userId,
                leaveType: leaveType,
                startDate: start,
                endDate: end,
                daysCount,
                reason,
                status: 'Pending'
            },
            include: {
                user: {
                    include: {
                        branch: true
                    }
                }
            }
        });
    }
    static async getLeaveRequests(filters) {
        const where = {};
        if (filters.status) {
            where.status = filters.status;
        }
        if (filters.userId) {
            where.userId = filters.userId;
        }
        if (filters.leaveType) {
            where.leaveType = filters.leaveType;
        }
        if (filters.branchId) {
            where.user = {
                branchId: filters.branchId
            };
        }
        return await prisma_1.default.leaveRequest.findMany({
            where,
            include: {
                user: {
                    include: {
                        branch: true
                    }
                }
            },
            orderBy: { createdAt: 'desc' }
        });
    }
    static async reviewLeaveRequest(id, reviewerId, status, reviewNote) {
        const leave = await prisma_1.default.leaveRequest.findUnique({
            where: { id },
            include: { user: true }
        });
        if (!leave) {
            throw new error_middleware_1.AppError(404, 'LEAVE_NOT_FOUND', 'طلب الإجازة غير موجود.');
        }
        if (leave.status !== 'Pending') {
            throw new error_middleware_1.AppError(400, 'ALREADY_REVIEWED', 'تم مراجعة هذا الطلب مسبقاً.');
        }
        if (status !== 'Approved' && status !== 'Rejected') {
            throw new error_middleware_1.AppError(400, 'INVALID_STATUS', 'حالة المراجعة يجب أن تكون Approved أو Rejected.');
        }
        if (status === 'Rejected' && (!reviewNote || reviewNote.trim() === '')) {
            throw new error_middleware_1.AppError(400, 'REVIEW_NOTE_REQUIRED', 'يجب كتابة سبب الرفض.');
        }
        if (status === 'Approved') {
            const user = leave.user;
            if (leave.leaveType === 'Annual') {
                if (user.annualLeaveBalance < leave.daysCount) {
                    throw new error_middleware_1.AppError(400, 'INSUFFICIENT_BALANCE', 'رصيد الإجازات السنوية للموظف غير كافٍ للاعتماد.');
                }
                await prisma_1.default.user.update({
                    where: { id: user.id },
                    data: { annualLeaveBalance: user.annualLeaveBalance - leave.daysCount }
                });
            }
            else if (leave.leaveType === 'Sick') {
                if (user.sickLeaveBalance < leave.daysCount) {
                    throw new error_middleware_1.AppError(400, 'INSUFFICIENT_BALANCE', 'رصيد الإجازات المرضية للموظف غير كافٍ للاعتماد.');
                }
                await prisma_1.default.user.update({
                    where: { id: user.id },
                    data: { sickLeaveBalance: user.sickLeaveBalance - leave.daysCount }
                });
            }
        }
        return await prisma_1.default.leaveRequest.update({
            where: { id },
            data: {
                status,
                reviewedBy: reviewerId,
                reviewNote,
                reviewedAt: new Date()
            },
            include: {
                user: {
                    include: {
                        branch: true
                    }
                }
            }
        });
    }
    static async getEmployeeLeaveBalance(userId) {
        const user = await prisma_1.default.user.findUnique({
            where: { id: userId }
        });
        if (!user) {
            throw new error_middleware_1.AppError(404, 'USER_NOT_FOUND', 'الموظف غير موجود.');
        }
        return {
            annualLeaveBalance: user.annualLeaveBalance,
            sickLeaveBalance: user.sickLeaveBalance
        };
    }
    static async getLeaveHistory(userId) {
        return await prisma_1.default.leaveRequest.findMany({
            where: { userId },
            include: {
                user: {
                    include: {
                        branch: true
                    }
                }
            },
            orderBy: { createdAt: 'desc' }
        });
    }
}
exports.LeaveService = LeaveService;
