"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.InventoryController = exports.getInventoryQuerySchema = exports.updateInventorySchema = exports.createInventorySchema = void 0;
const zod_1 = require("zod");
const inventory_service_1 = require("../services/inventory.service");
exports.createInventorySchema = zod_1.z.object({
    body: zod_1.z.object({
        name: zod_1.z.string().min(1, 'Item name is required'),
        category: zod_1.z.string().min(1, 'Category is required'),
        stockLevel: zod_1.z.number().int().nonnegative(),
        reorderLevel: zod_1.z.number().int().nonnegative(),
        branchId: zod_1.z.string().min(1, 'Branch ID is required'),
        status: zod_1.z.enum(['Available', 'Out_of_Stock']).optional()
    })
});
exports.updateInventorySchema = zod_1.z.object({
    body: zod_1.z.object({
        name: zod_1.z.string().min(1).optional(),
        category: zod_1.z.string().min(1).optional(),
        stockLevel: zod_1.z.number().int().nonnegative().optional(),
        reorderLevel: zod_1.z.number().int().nonnegative().optional(),
        status: zod_1.z.enum(['Available', 'Out_of_Stock']).optional(),
        branchId: zod_1.z.string().min(1).optional()
    })
});
exports.getInventoryQuerySchema = zod_1.z.object({
    query: zod_1.z.object({
        status: zod_1.z.enum(['Available', 'Out_of_Stock']).optional(),
        branchId: zod_1.z.string().optional(),
        category: zod_1.z.string().optional()
    })
});
class InventoryController {
    /**
     * POST /api/inventory
     */
    static create = async (req, res, next) => {
        try {
            const newItem = await inventory_service_1.InventoryService.createItem(req.body);
            const response = {
                success: true,
                data: newItem
            };
            res.status(201).json(response);
        }
        catch (error) {
            next(error);
        }
    };
    /**
     * GET /api/inventory
     */
    static getAll = async (req, res, next) => {
        try {
            const items = await inventory_service_1.InventoryService.getAllItems(req.query);
            const response = {
                success: true,
                data: items
            };
            res.status(200).json(response);
        }
        catch (error) {
            next(error);
        }
    };
    /**
     * GET /api/inventory/:id
     */
    static getById = async (req, res, next) => {
        try {
            const { id } = req.params;
            const item = await inventory_service_1.InventoryService.getItemById(id);
            const response = {
                success: true,
                data: item
            };
            res.status(200).json(response);
        }
        catch (error) {
            next(error);
        }
    };
    /**
     * PATCH /api/inventory/:id
     */
    static update = async (req, res, next) => {
        try {
            const { id } = req.params;
            const updatedItem = await inventory_service_1.InventoryService.updateItem(id, req.body);
            const response = {
                success: true,
                data: updatedItem
            };
            res.status(200).json(response);
        }
        catch (error) {
            next(error);
        }
    };
    /**
     * DELETE /api/inventory/:id
     */
    static delete = async (req, res, next) => {
        try {
            const { id } = req.params;
            await inventory_service_1.InventoryService.deleteItem(id);
            const response = {
                success: true,
                data: { id, message: 'Inventory item successfully deleted' }
            };
            res.status(200).json(response);
        }
        catch (error) {
            next(error);
        }
    };
}
exports.InventoryController = InventoryController;
