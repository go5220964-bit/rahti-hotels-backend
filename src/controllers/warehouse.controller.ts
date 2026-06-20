import { Request, Response, NextFunction } from 'express';
import { WarehouseService } from '../services/warehouse.service';
import { ApiResponse } from '../types';
import prisma from '../services/prisma';

export class WarehouseController {
  // Category Routes
  public static getCategories = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const categories = await prisma.itemCategory.findMany({
        orderBy: { name: 'asc' }
      });
      const response: ApiResponse = {
        success: true,
        data: categories
      };
      res.status(200).json(response);
    } catch (error) {
      next(error);
    }
  };

  // Item Routes
  public static getItems = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { categoryId, search } = req.query;
      const items = await WarehouseService.getItems({
        categoryId: categoryId as string,
        search: search as string
      });
      const response: ApiResponse = {
        success: true,
        data: items
      };
      res.status(200).json(response);
    } catch (error) {
      next(error);
    }
  };

  public static getItemById = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { id } = req.params;
      const item = await WarehouseService.getItemById(id);
      if (!item) {
        res.status(404).json({ success: false, error: 'Item not found' });
        return;
      }
      const response: ApiResponse = {
        success: true,
        data: item
      };
      res.status(200).json(response);
    } catch (error) {
      next(error);
    }
  };

  public static createItem = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { name, unit, categoryId, description } = req.body;
      const item = await WarehouseService.createItem({ name, unit, categoryId, description });
      const response: ApiResponse = {
        success: true,
        data: item
      };
      res.status(201).json(response);
    } catch (error) {
      next(error);
    }
  };

  public static updateItem = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { id } = req.params;
      const { name, unit, categoryId, description } = req.body;
      const item = await WarehouseService.updateItem(id, { name, unit, categoryId, description });
      const response: ApiResponse = {
        success: true,
        data: item
      };
      res.status(200).json(response);
    } catch (error) {
      next(error);
    }
  };

  // Stock Routes
  public static getStockByBranch = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { branchId } = req.params;
      const stock = await WarehouseService.getStockByBranch(branchId);
      const response: ApiResponse = {
        success: true,
        data: stock
      };
      res.status(200).json(response);
    } catch (error) {
      next(error);
    }
  };

  public static adjustStock = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { itemId, branchId, quantity, type, reason, performedBy, note, referenceId } = req.body;
      const entry = await WarehouseService.adjustStock(
        itemId,
        branchId,
        quantity,
        type,
        reason,
        performedBy,
        note,
        referenceId
      );
      const response: ApiResponse = {
        success: true,
        data: entry
      };
      res.status(200).json(response);
    } catch (error) {
      next(error);
    }
  };

  // Warehouse Request Routes
  public static getWarehouseRequests = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { status, branchId, itemId } = req.query;
      const requests = await WarehouseService.getWarehouseRequests({
        status: status as string,
        branchId: branchId as string,
        itemId: itemId as string
      });
      const response: ApiResponse = {
        success: true,
        data: requests
      };
      res.status(200).json(response);
    } catch (error) {
      next(error);
    }
  };

  public static createWarehouseRequest = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { requestedBy, branchId, itemId, quantityRequested, purpose } = req.body;
      const request = await WarehouseService.createWarehouseRequest({
        requestedBy,
        branchId,
        itemId,
        quantityRequested,
        purpose
      });
      const response: ApiResponse = {
        success: true,
        data: request
      };
      res.status(201).json(response);
    } catch (error) {
      next(error);
    }
  };

  public static approveWarehouseRequest = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { id } = req.params;
      const { approverId, quantityIssued } = req.body;
      const request = await WarehouseService.approveWarehouseRequest(id, approverId, quantityIssued);
      const response: ApiResponse = {
        success: true,
        data: request
      };
      res.status(200).json(response);
    } catch (error) {
      next(error);
    }
  };

  public static rejectWarehouseRequest = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { id } = req.params;
      const { approverId, rejectionReason } = req.body;
      const request = await WarehouseService.rejectWarehouseRequest(id, approverId, rejectionReason);
      const response: ApiResponse = {
        success: true,
        data: request
      };
      res.status(200).json(response);
    } catch (error) {
      next(error);
    }
  };

  // Stats Routes
  public static getWarehouseStats = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { branchId } = req.query;
      const stats = await WarehouseService.getWarehouseStats(branchId as string);
      const response: ApiResponse = {
        success: true,
        data: stats
      };
      res.status(200).json(response);
    } catch (error) {
      next(error);
    }
  };

  // Procurement Routes
  public static getProcurementRequests = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { status, branchId, source } = req.query;
      const requests = await WarehouseService.getProcurementRequests({
        status: status as string,
        branchId: branchId as string,
        source: source as string
      });
      const response: ApiResponse = {
        success: true,
        data: requests
      };
      res.status(200).json(response);
    } catch (error) {
      next(error);
    }
  };

  public static getProcurementById = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { id } = req.params;
      const request = await WarehouseService.getProcurementById(id);
      if (!request) {
        res.status(404).json({ success: false, error: 'Procurement request not found' });
        return;
      }
      const response: ApiResponse = {
        success: true,
        data: request
      };
      res.status(200).json(response);
    } catch (error) {
      next(error);
    }
  };

  public static reviewProcurement = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { id } = req.params;
      const { reviewerId, note, estimatedPrice, supplierId, paymentMethod } = req.body;
      const request = await WarehouseService.reviewProcurement(
        id,
        reviewerId,
        note,
        estimatedPrice,
        supplierId,
        paymentMethod
      );
      const response: ApiResponse = {
        success: true,
        data: request
      };
      res.status(200).json(response);
    } catch (error) {
      next(error);
    }
  };

  public static financiallyApproveProcurement = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { id } = req.params;
      const { approverId, note } = req.body;
      const request = await WarehouseService.financiallyApproveProcurement(id, approverId, note);
      const response: ApiResponse = {
        success: true,
        data: request
      };
      res.status(200).json(response);
    } catch (error) {
      next(error);
    }
  };

  public static rejectProcurement = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { id } = req.params;
      const { approverId, reason } = req.body;
      const request = await WarehouseService.rejectProcurement(id, approverId, reason);
      const response: ApiResponse = {
        success: true,
        data: request
      };
      res.status(200).json(response);
    } catch (error) {
      next(error);
    }
  };

  public static markPurchased = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { id } = req.params;
      const { purchaserId, actualPrice, paymentMethod, receiptPhotoUrl } = req.body;
      const request = await WarehouseService.markPurchased(
        id,
        purchaserId,
        actualPrice,
        paymentMethod,
        receiptPhotoUrl
      );
      const response: ApiResponse = {
        success: true,
        data: request
      };
      res.status(200).json(response);
    } catch (error) {
      next(error);
    }
  };

  public static receiveInWarehouse = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { id } = req.params;
      const { receiverId, quantityReceived } = req.body;
      const request = await WarehouseService.receiveInWarehouse(id, receiverId, quantityReceived);
      const response: ApiResponse = {
        success: true,
        data: request
      };
      res.status(200).json(response);
    } catch (error) {
      next(error);
    }
  };

  // Supplier Routes
  public static getSuppliers = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const suppliers = await WarehouseService.getSuppliers();
      const response: ApiResponse = {
        success: true,
        data: suppliers
      };
      res.status(200).json(response);
    } catch (error) {
      next(error);
    }
  };

  public static createSupplier = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { name, contactName, phone, email, address, category, rating } = req.body;
      const supplier = await WarehouseService.createSupplier({
        name,
        contactName,
        phone,
        email,
        address,
        category,
        rating
      });
      const response: ApiResponse = {
        success: true,
        data: supplier
      };
      res.status(201).json(response);
    } catch (error) {
      next(error);
    }
  };

  public static updateSupplier = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { id } = req.params;
      const { name, contactName, phone, email, address, category, rating, isActive } = req.body;
      const supplier = await WarehouseService.updateSupplier(id, {
        name,
        contactName,
        phone,
        email,
        address,
        category,
        rating,
        isActive
      });
      const response: ApiResponse = {
        success: true,
        data: supplier
      };
      res.status(200).json(response);
    } catch (error) {
      next(error);
    }
  };

  // Measurement Units CRUD
  public static getUnits = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const units = await prisma.unitOfMeasure.findMany({
        orderBy: { name: 'asc' }
      });
      const response: ApiResponse = {
        success: true,
        data: units
      };
      res.status(200).json(response);
    } catch (error) {
      next(error);
    }
  };

  public static createUnit = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { name, abbreviation } = req.body;
      const caller = (req as any).user || { id: 'system' };
      const unit = await prisma.unitOfMeasure.create({
        data: { name, abbreviation }
      });

      const { ActivityLogService } = require('../services/activity-log.service');
      await ActivityLogService.log(caller.id, 'CREATE_UNIT_OF_MEASURE', 'UnitOfMeasure', unit.id, { name, abbreviation }, req.ip);

      const response: ApiResponse = {
        success: true,
        data: unit
      };
      res.status(201).json(response);
    } catch (error) {
      next(error);
    }
  };

  // Add Stock quantity
  public static addStock = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { id } = req.params;
      const { quantity, notes, supplierInvoiceNo } = req.body;
      const caller = (req as any).user || { id: 'system' };

      const item = await prisma.inventoryItem.findUnique({ where: { id } });
      if (!item) {
        res.status(404).json({ success: false, error: 'Inventory Item not found' });
        return;
      }

      const addition = await prisma.stockAddition.create({
        data: {
          itemId: id,
          quantity: parseInt(quantity, 10),
          notes,
          supplierInvoiceNo,
          addedBy: caller.id
        }
      });

      const updatedItem = await prisma.inventoryItem.update({
        where: { id },
        data: {
          stockLevel: item.stockLevel + parseInt(quantity, 10),
          status: (item.stockLevel + parseInt(quantity, 10)) > 0 ? 'Available' : 'Out_of_Stock'
        }
      });

      const { ActivityLogService } = require('../services/activity-log.service');
      await ActivityLogService.log(
        caller.id,
        'ADD_STOCK',
        'InventoryItem',
        id,
        { quantity, supplierInvoiceNo, previousStock: item.stockLevel, newStock: updatedItem.stockLevel },
        req.ip
      );

      const response: ApiResponse = {
        success: true,
        data: { addition, item: updatedItem }
      };
      res.status(200).json(response);
    } catch (error) {
      next(error);
    }
  };
}
