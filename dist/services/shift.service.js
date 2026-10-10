"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.ShiftService = void 0;
const prisma_1 = __importDefault(require("./prisma"));
class ShiftService {
    static async createShift(data) {
        return await prisma_1.default.shift.create({
            data: {
                name: data.name,
                startTime: data.startTime,
                endTime: data.endTime,
                branchId: data.branchId || null,
                isOpen: data.isOpen ?? false,
                isActive: true,
            },
            include: {
                branch: true
            }
        });
    }
    static async getAllShifts(branchId) {
        const whereClause = { isActive: true };
        if (branchId) {
            whereClause.OR = [
                { branchId: null },
                { branchId }
            ];
        }
        return await prisma_1.default.shift.findMany({
            where: whereClause,
            include: {
                branch: true
            },
            orderBy: { createdAt: 'desc' }
        });
    }
    static async getShiftsForBranch(branchId) {
        return await prisma_1.default.shift.findMany({
            where: {
                isActive: true,
                OR: [
                    { branchId: null },
                    { branchId: branchId || undefined }
                ]
            },
            include: {
                branch: true
            },
            orderBy: { createdAt: 'asc' }
        });
    }
    static async updateShift(id, data) {
        return await prisma_1.default.shift.update({
            where: { id },
            data: {
                name: data.name !== undefined ? data.name : undefined,
                startTime: data.startTime !== undefined ? data.startTime : undefined,
                endTime: data.endTime !== undefined ? data.endTime : undefined,
                branchId: data.branchId !== undefined ? data.branchId : undefined,
                isOpen: data.isOpen !== undefined ? data.isOpen : undefined,
                isActive: data.isActive !== undefined ? data.isActive : undefined,
            },
            include: {
                branch: true
            }
        });
    }
    static async deleteShift(id) {
        // Soft delete: set isActive = false
        return await prisma_1.default.shift.update({
            where: { id },
            data: { isActive: false }
        });
    }
}
exports.ShiftService = ShiftService;
