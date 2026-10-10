"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.WarehouseController = void 0;
const warehouse_service_1 = require("../services/warehouse.service");
const prisma_1 = __importDefault(require("../services/prisma"));
class WarehouseController {
    // Category Routes
    static getCategories = async (req, res, next) => {
        try {
            const categories = await prisma_1.default.itemCategory.findMany({
                orderBy: { name: 'asc' }
            });
            const response = {
                success: true,
                data: categories
            };
            res.status(200).json(response);
        }
        catch (error) {
            next(error);
        }
    };
    // Item Routes
    static getItems = async (req, res, next) => {
        try {
            const { categoryId, search } = req.query;
            const items = await warehouse_service_1.WarehouseService.getItems({
                categoryId: categoryId,
                search: search
            });
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
    static getItemById = async (req, res, next) => {
        try {
            const { id } = req.params;
            const item = await warehouse_service_1.WarehouseService.getItemById(id);
            if (!item) {
                res.status(404).json({ success: false, error: 'Item not found' });
                return;
            }
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
    static createItem = async (req, res, next) => {
        try {
            const { name, unit, categoryId, description } = req.body;
            const item = await warehouse_service_1.WarehouseService.createItem({ name, unit, categoryId, description });
            const response = {
                success: true,
                data: item
            };
            res.status(201).json(response);
        }
        catch (error) {
            next(error);
        }
    };
    static updateItem = async (req, res, next) => {
        try {
            const { id } = req.params;
            const { name, unit, categoryId, description } = req.body;
            const item = await warehouse_service_1.WarehouseService.updateItem(id, { name, unit, categoryId, description });
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
    // Stock Routes
    static getStockByBranch = async (req, res, next) => {
        try {
            const { branchId } = req.params;
            const stock = await warehouse_service_1.WarehouseService.getStockByBranch(branchId);
            const response = {
                success: true,
                data: stock
            };
            res.status(200).json(response);
        }
        catch (error) {
            next(error);
        }
    };
    static adjustStock = async (req, res, next) => {
        try {
            const { itemId, branchId, quantity, type, reason, performedBy, note, referenceId } = req.body;
            const entry = await warehouse_service_1.WarehouseService.adjustStock(itemId, branchId, quantity, type, reason, performedBy, note, referenceId);
            const response = {
                success: true,
                data: entry
            };
            res.status(200).json(response);
        }
        catch (error) {
            next(error);
        }
    };
    // Warehouse Request Routes
    static getWarehouseRequests = async (req, res, next) => {
        try {
            const { status, branchId, itemId } = req.query;
            const requests = await warehouse_service_1.WarehouseService.getWarehouseRequests({
                status: status,
                branchId: branchId,
                itemId: itemId
            });
            const response = {
                success: true,
                data: requests
            };
            res.status(200).json(response);
        }
        catch (error) {
            next(error);
        }
    };
    static createWarehouseRequest = async (req, res, next) => {
        try {
            const { requestedBy, branchId, itemId, quantityRequested, purpose } = req.body;
            const request = await warehouse_service_1.WarehouseService.createWarehouseRequest({
                requestedBy,
                branchId,
                itemId,
                quantityRequested,
                purpose
            });
            const response = {
                success: true,
                data: request
            };
            res.status(201).json(response);
        }
        catch (error) {
            next(error);
        }
    };
    static approveWarehouseRequest = async (req, res, next) => {
        try {
            const { id } = req.params;
            const { approverId, quantityIssued } = req.body;
            const request = await warehouse_service_1.WarehouseService.approveWarehouseRequest(id, approverId, quantityIssued);
            const response = {
                success: true,
                data: request
            };
            res.status(200).json(response);
        }
        catch (error) {
            next(error);
        }
    };
    static rejectWarehouseRequest = async (req, res, next) => {
        try {
            const { id } = req.params;
            const { approverId, rejectionReason } = req.body;
            const request = await warehouse_service_1.WarehouseService.rejectWarehouseRequest(id, approverId, rejectionReason);
            const response = {
                success: true,
                data: request
            };
            res.status(200).json(response);
        }
        catch (error) {
            next(error);
        }
    };
    // Stats Routes
    static getWarehouseStats = async (req, res, next) => {
        try {
            const { branchId } = req.query;
            const stats = await warehouse_service_1.WarehouseService.getWarehouseStats(branchId);
            const response = {
                success: true,
                data: stats
            };
            res.status(200).json(response);
        }
        catch (error) {
            next(error);
        }
    };
    // Procurement Routes
    static getProcurementRequests = async (req, res, next) => {
        try {
            const { status, branchId, source } = req.query;
            const requests = await warehouse_service_1.WarehouseService.getProcurementRequests({
                status: status,
                branchId: branchId,
                source: source
            });
            const response = {
                success: true,
                data: requests
            };
            res.status(200).json(response);
        }
        catch (error) {
            next(error);
        }
    };
    static getProcurementById = async (req, res, next) => {
        try {
            const { id } = req.params;
            const request = await warehouse_service_1.WarehouseService.getProcurementById(id);
            if (!request) {
                res.status(404).json({ success: false, error: 'Procurement request not found' });
                return;
            }
            const response = {
                success: true,
                data: request
            };
            res.status(200).json(response);
        }
        catch (error) {
            next(error);
        }
    };
    static reviewProcurement = async (req, res, next) => {
        try {
            const { id } = req.params;
            const { reviewerId, note, estimatedPrice, supplierId, paymentMethod } = req.body;
            const request = await warehouse_service_1.WarehouseService.reviewProcurement(id, reviewerId, note, estimatedPrice, supplierId, paymentMethod);
            const response = {
                success: true,
                data: request
            };
            res.status(200).json(response);
        }
        catch (error) {
            next(error);
        }
    };
    static financiallyApproveProcurement = async (req, res, next) => {
        try {
            const { id } = req.params;
            const { approverId, note } = req.body;
            const request = await warehouse_service_1.WarehouseService.financiallyApproveProcurement(id, approverId, note);
            const response = {
                success: true,
                data: request
            };
            res.status(200).json(response);
        }
        catch (error) {
            next(error);
        }
    };
    static rejectProcurement = async (req, res, next) => {
        try {
            const { id } = req.params;
            const { approverId, reason } = req.body;
            const request = await warehouse_service_1.WarehouseService.rejectProcurement(id, approverId, reason);
            const response = {
                success: true,
                data: request
            };
            res.status(200).json(response);
        }
        catch (error) {
            next(error);
        }
    };
    static markPurchased = async (req, res, next) => {
        try {
            const { id } = req.params;
            const { purchaserId, actualPrice, paymentMethod, receiptPhotoUrl } = req.body;
            const request = await warehouse_service_1.WarehouseService.markPurchased(id, purchaserId, actualPrice, paymentMethod, receiptPhotoUrl);
            const response = {
                success: true,
                data: request
            };
            res.status(200).json(response);
        }
        catch (error) {
            next(error);
        }
    };
    static receiveInWarehouse = async (req, res, next) => {
        try {
            const { id } = req.params;
            const { receiverId, quantityReceived } = req.body;
            const request = await warehouse_service_1.WarehouseService.receiveInWarehouse(id, receiverId, quantityReceived);
            const response = {
                success: true,
                data: request
            };
            res.status(200).json(response);
        }
        catch (error) {
            next(error);
        }
    };
    // Supplier Routes
    static getSuppliers = async (req, res, next) => {
        try {
            const suppliers = await warehouse_service_1.WarehouseService.getSuppliers();
            const response = {
                success: true,
                data: suppliers
            };
            res.status(200).json(response);
        }
        catch (error) {
            next(error);
        }
    };
    static createSupplier = async (req, res, next) => {
        try {
            const { name, contactName, phone, email, address, category, rating } = req.body;
            const supplier = await warehouse_service_1.WarehouseService.createSupplier({
                name,
                contactName,
                phone,
                email,
                address,
                category,
                rating
            });
            const response = {
                success: true,
                data: supplier
            };
            res.status(201).json(response);
        }
        catch (error) {
            next(error);
        }
    };
    static updateSupplier = async (req, res, next) => {
        try {
            const { id } = req.params;
            const { name, contactName, phone, email, address, category, rating, isActive } = req.body;
            const supplier = await warehouse_service_1.WarehouseService.updateSupplier(id, {
                name,
                contactName,
                phone,
                email,
                address,
                category,
                rating,
                isActive
            });
            const response = {
                success: true,
                data: supplier
            };
            res.status(200).json(response);
        }
        catch (error) {
            next(error);
        }
    };
    // Measurement Units CRUD
    static getUnits = async (req, res, next) => {
        try {
            const units = await prisma_1.default.unitOfMeasure.findMany({
                orderBy: { name: 'asc' }
            });
            const response = {
                success: true,
                data: units
            };
            res.status(200).json(response);
        }
        catch (error) {
            next(error);
        }
    };
    static createUnit = async (req, res, next) => {
        try {
            const { name, abbreviation } = req.body;
            const caller = req.user || { id: 'system' };
            const unit = await prisma_1.default.unitOfMeasure.create({
                data: { name, abbreviation }
            });
            const { ActivityLogService } = require('../services/activity-log.service');
            await ActivityLogService.log(caller.id, 'CREATE_UNIT_OF_MEASURE', 'UnitOfMeasure', unit.id, { name, abbreviation }, req.ip);
            const response = {
                success: true,
                data: unit
            };
            res.status(201).json(response);
        }
        catch (error) {
            next(error);
        }
    };
    // Add Stock quantity
    static addStock = async (req, res, next) => {
        try {
            const { id } = req.params;
            const { quantity, notes, supplierInvoiceNo } = req.body;
            const caller = req.user || { id: 'system' };
            const item = await prisma_1.default.inventoryItem.findUnique({ where: { id } });
            if (!item) {
                res.status(404).json({ success: false, error: 'Inventory Item not found' });
                return;
            }
            const addition = await prisma_1.default.stockAddition.create({
                data: {
                    itemId: id,
                    quantity: parseInt(quantity, 10),
                    notes,
                    supplierInvoiceNo,
                    addedBy: caller.id
                }
            });
            const updatedItem = await prisma_1.default.inventoryItem.update({
                where: { id },
                data: {
                    stockLevel: item.stockLevel + parseInt(quantity, 10),
                    status: (item.stockLevel + parseInt(quantity, 10)) > 0 ? 'Available' : 'Out_of_Stock'
                }
            });
            const { ActivityLogService } = require('../services/activity-log.service');
            await ActivityLogService.log(caller.id, 'ADD_STOCK', 'InventoryItem', id, { quantity, supplierInvoiceNo, previousStock: item.stockLevel, newStock: updatedItem.stockLevel }, req.ip);
            const response = {
                success: true,
                data: { addition, item: updatedItem }
            };
            res.status(200).json(response);
        }
        catch (error) {
            next(error);
        }
    };
}
exports.WarehouseController = WarehouseController;
