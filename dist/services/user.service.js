"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.UserService = void 0;
const prisma_1 = __importDefault(require("./prisma"));
const error_middleware_1 = require("../middleware/error.middleware");
class UserService {
    static async getAll() {
        return await prisma_1.default.user.findMany({
            include: {
                branch: true,
            },
            orderBy: { createdAt: 'desc' },
        });
    }
    static async createUser(data) {
        // Check if phone number is unique
        const existing = await prisma_1.default.user.findUnique({
            where: { phoneNumber: data.phoneNumber },
        });
        if (existing) {
            throw new error_middleware_1.AppError(400, 'PHONE_NUMBER_TAKEN', `رقم الهاتف ${data.phoneNumber} مسجل مسبقاً لموظف آخر.`);
        }
        // Verify branch exists if provided
        if (data.branchId) {
            const branch = await prisma_1.default.branch.findUnique({ where: { id: data.branchId } });
            if (!branch) {
                throw new error_middleware_1.AppError(404, 'BRANCH_NOT_FOUND', `الفرع المحدد غير موجود.`);
            }
        }
        return await prisma_1.default.user.create({
            data: {
                name: data.name,
                role: data.role,
                phoneNumber: data.phoneNumber,
                branchId: data.branchId || null,
                employeeType: (data.employeeType || 'Fixed'),
                email: data.email || null,
                botEnabled: true,
                isActive: true
            },
            include: {
                branch: true,
            },
        });
    }
    static async updateUser(id, data) {
        const user = await prisma_1.default.user.findUnique({ where: { id } });
        if (!user) {
            throw new error_middleware_1.AppError(404, 'USER_NOT_FOUND', `الموظف ذو المعرف ${id} غير موجود.`);
        }
        const updateData = {};
        if (data.name !== undefined)
            updateData.name = data.name;
        if (data.role !== undefined)
            updateData.role = data.role;
        if (data.employeeType !== undefined)
            updateData.employeeType = data.employeeType;
        if (data.email !== undefined)
            updateData.email = data.email;
        if (data.botEnabled !== undefined)
            updateData.botEnabled = data.botEnabled;
        if (data.isActive !== undefined)
            updateData.isActive = data.isActive;
        if (data.phoneNumber !== undefined && data.phoneNumber !== user.phoneNumber) {
            const existing = await prisma_1.default.user.findUnique({
                where: { phoneNumber: data.phoneNumber },
            });
            if (existing) {
                throw new error_middleware_1.AppError(400, 'PHONE_NUMBER_TAKEN', `رقم الهاتف ${data.phoneNumber} مسجل مسبقاً لموظف آخر.`);
            }
            updateData.phoneNumber = data.phoneNumber;
        }
        if (data.branchId !== undefined) {
            if (data.branchId) {
                const branch = await prisma_1.default.branch.findUnique({ where: { id: data.branchId } });
                if (!branch) {
                    throw new error_middleware_1.AppError(404, 'BRANCH_NOT_FOUND', `الفرع المحدد غير موجود.`);
                }
                updateData.branchId = data.branchId;
            }
            else {
                updateData.branchId = null;
            }
        }
        return await prisma_1.default.user.update({
            where: { id },
            data: updateData,
            include: { branch: true }
        });
    }
    static async deleteUser(id) {
        const user = await prisma_1.default.user.findUnique({ where: { id } });
        if (!user) {
            throw new error_middleware_1.AppError(404, 'USER_NOT_FOUND', `الموظف ذو المعرف ${id} غير موجود.`);
        }
        return await prisma_1.default.user.delete({
            where: { id },
        });
    }
    static async transferBranch(userId, newBranchId, reason, createdBy) {
        const user = await prisma_1.default.user.findUnique({ where: { id: userId } });
        if (!user) {
            throw new error_middleware_1.AppError(404, 'USER_NOT_FOUND', `الموظف ذو المعرف ${userId} غير موجود.`);
        }
        const branch = await prisma_1.default.branch.findUnique({ where: { id: newBranchId } });
        if (!branch) {
            throw new error_middleware_1.AppError(404, 'BRANCH_NOT_FOUND', `الفرع المحدد غير موجود.`);
        }
        const fromBranchId = user.branchId || '';
        // Create historical EmployeeTransfer record
        await prisma_1.default.employeeTransfer.create({
            data: {
                employeeId: userId,
                fromBranchId,
                toBranchId: newBranchId,
                transferDate: new Date(),
                reason: reason || 'نقل إداري',
                createdBy: createdBy || 'system'
            }
        });
        return await prisma_1.default.user.update({
            where: { id: userId },
            data: { branchId: newBranchId },
            include: { branch: true }
        });
    }
    static async getUserById(id) {
        const user = await prisma_1.default.user.findUnique({
            where: { id },
            include: { branch: true }
        });
        if (!user) {
            throw new error_middleware_1.AppError(404, 'USER_NOT_FOUND', 'المستخدم غير موجود.');
        }
        return user;
    }
}
exports.UserService = UserService;
