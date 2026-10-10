"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.LoanService = void 0;
const prisma_1 = __importDefault(require("./prisma"));
const error_middleware_1 = require("../middleware/error.middleware");
class LoanService {
    static async createLoanRequest(userId, amount, reason, repaymentMonths) {
        const user = await prisma_1.default.user.findUnique({ where: { id: userId } });
        if (!user) {
            throw new error_middleware_1.AppError(404, 'USER_NOT_FOUND', 'الموظف غير موجود.');
        }
        if (amount <= 0) {
            throw new error_middleware_1.AppError(400, 'INVALID_AMOUNT', 'يجب أن يكون مبلغ السلفة أكبر من الصفر.');
        }
        const branchId = user.branchId || '';
        if (!branchId) {
            throw new error_middleware_1.AppError(400, 'BRANCH_REQUIRED', 'الموظف غير مرتبط بفرع.');
        }
        return await prisma_1.default.loanRequest.create({
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
    static async getLoanRequests(filters) {
        const where = {};
        if (filters.status) {
            where.status = filters.status;
        }
        if (filters.userId) {
            where.employeeId = filters.userId;
        }
        if (filters.branchId) {
            where.branchId = filters.branchId;
        }
        return await prisma_1.default.loanRequest.findMany({
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
    static async reviewLoanRequest(id, reviewerId, status, reviewNote) {
        const loan = await prisma_1.default.loanRequest.findUnique({
            where: { id },
            include: {
                user: true,
            },
        });
        if (!loan) {
            throw new error_middleware_1.AppError(404, 'LOAN_NOT_FOUND', 'طلب السلفة غير موجود.');
        }
        if (loan.status !== 'Pending') {
            throw new error_middleware_1.AppError(400, 'ALREADY_REVIEWED', 'تم مراجعة هذا الطلب مسبقاً.');
        }
        if (status !== 'Approved' && status !== 'Rejected') {
            throw new error_middleware_1.AppError(400, 'INVALID_STATUS', 'حالة المراجعة يجب أن تكون Approved أو Rejected.');
        }
        if (status === 'Rejected' && (!reviewNote || reviewNote.trim() === '')) {
            throw new error_middleware_1.AppError(400, 'REVIEW_NOTE_REQUIRED', 'يجب كتابة سبب الرفض.');
        }
        return await prisma_1.default.loanRequest.update({
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
    static async getEmployeeLoanHistory(userId) {
        return await prisma_1.default.loanRequest.findMany({
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
exports.LoanService = LoanService;
