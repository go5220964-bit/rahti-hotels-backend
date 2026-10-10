"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.InventoryService = void 0;
const prisma_1 = __importDefault(require("./prisma"));
const error_middleware_1 = require("../middleware/error.middleware");
class InventoryService {
    /**
     * Get all inventory items matching filters
     */
    static async getAllItems(filters) {
        const where = {};
        if (filters?.status)
            where.status = filters.status;
        if (filters?.branchId)
            where.branchId = filters.branchId;
        if (filters?.category)
            where.category = filters.category;
        return await prisma_1.default.inventoryItem.findMany({
            where,
            include: {
                branch: {
                    select: { id: true, name: true }
                }
            },
            orderBy: { createdAt: 'desc' }
        });
    }
    /**
     * Find item by ID
     */
    static async getItemById(id) {
        const item = await prisma_1.default.inventoryItem.findUnique({
            where: { id },
            include: { branch: true }
        });
        if (!item) {
            throw new error_middleware_1.AppError(404, 'INVENTORY_ITEM_NOT_FOUND', `Inventory item with ID ${id} does not exist.`);
        }
        return item;
    }
    /**
     * Create an inventory item
     */
    static async createItem(input) {
        // Verify branch exists
        const branch = await prisma_1.default.branch.findUnique({ where: { id: input.branchId } });
        if (!branch) {
            throw new error_middleware_1.AppError(404, 'BRANCH_NOT_FOUND', `Branch with ID ${input.branchId} does not exist.`);
        }
        return await prisma_1.default.inventoryItem.create({
            data: {
                name: input.name,
                category: input.category,
                stockLevel: input.stockLevel,
                reorderLevel: input.reorderLevel,
                status: (input.status || 'Available'),
                branchId: input.branchId
            },
            include: { branch: true }
        });
    }
    /**
     * Update an inventory item
     */
    static async updateItem(id, input) {
        await this.getItemById(id);
        const data = {};
        if (input.name !== undefined)
            data.name = input.name;
        if (input.category !== undefined)
            data.category = input.category;
        if (input.stockLevel !== undefined) {
            data.stockLevel = input.stockLevel;
            // Auto toggle status to Out_of_Stock if stock level drops to 0
            if (input.stockLevel <= 0) {
                data.status = 'Out_of_Stock';
            }
            else if (input.status === undefined) {
                data.status = 'Available'; // Auto-restore if stock level increases
            }
        }
        if (input.reorderLevel !== undefined)
            data.reorderLevel = input.reorderLevel;
        if (input.status !== undefined)
            data.status = input.status;
        if (input.branchId !== undefined) {
            const branch = await prisma_1.default.branch.findUnique({ where: { id: input.branchId } });
            if (!branch) {
                throw new error_middleware_1.AppError(404, 'BRANCH_NOT_FOUND', `Branch with ID ${input.branchId} does not exist.`);
            }
            data.branchId = input.branchId;
        }
        return await prisma_1.default.inventoryItem.update({
            where: { id },
            data,
            include: { branch: true }
        });
    }
    /**
     * Delete an inventory item
     */
    static async deleteItem(id) {
        await this.getItemById(id);
        return await prisma_1.default.inventoryItem.delete({ where: { id } });
    }
}
exports.InventoryService = InventoryService;
