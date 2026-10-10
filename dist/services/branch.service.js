"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.BranchService = void 0;
const prisma_1 = __importDefault(require("./prisma"));
class BranchService {
    static async getAll() {
        return await prisma_1.default.branch.findMany({
            orderBy: { createdAt: 'desc' },
        });
    }
    static async createBranch(data) {
        return await prisma_1.default.branch.create({
            data: {
                name: data.name,
                location: data.location || null,
                lat: data.lat || null,
                lng: data.lng || null,
                radiusMeters: data.radiusMeters !== undefined ? data.radiusMeters : 200,
            },
        });
    }
    static async updateBranch(id, data) {
        const branch = await prisma_1.default.branch.findUnique({ where: { id } });
        if (!branch) {
            throw new Error(`Branch with ID ${id} was not found.`);
        }
        return await prisma_1.default.branch.update({
            where: { id },
            data: {
                name: data.name !== undefined ? data.name : undefined,
                location: data.location !== undefined ? data.location : undefined,
                lat: data.lat !== undefined ? data.lat : undefined,
                lng: data.lng !== undefined ? data.lng : undefined,
                radiusMeters: data.radiusMeters !== undefined ? data.radiusMeters : undefined,
            },
        });
    }
    static async deleteBranch(id) {
        const branch = await prisma_1.default.branch.findUnique({ where: { id } });
        if (!branch) {
            throw new Error(`Branch with ID ${id} was not found.`);
        }
        return await prisma_1.default.branch.delete({
            where: { id },
        });
    }
}
exports.BranchService = BranchService;
