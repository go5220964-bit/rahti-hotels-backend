import { Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import { InventoryService } from '../services/inventory.service';
import { ApiResponse } from '../types';

export const createInventorySchema = z.object({
  body: z.object({
    name: z.string().min(1, 'Item name is required'),
    category: z.string().min(1, 'Category is required'),
    stockLevel: z.number().int().nonnegative(),
    reorderLevel: z.number().int().nonnegative(),
    branchId: z.string().min(1, 'Branch ID is required'),
    status: z.enum(['Available', 'Out_of_Stock']).optional()
  })
});

export const updateInventorySchema = z.object({
  body: z.object({
    name: z.string().min(1).optional(),
    category: z.string().min(1).optional(),
    stockLevel: z.number().int().nonnegative().optional(),
    reorderLevel: z.number().int().nonnegative().optional(),
    status: z.enum(['Available', 'Out_of_Stock']).optional(),
    branchId: z.string().min(1).optional()
  })
});

export const getInventoryQuerySchema = z.object({
  query: z.object({
    status: z.enum(['Available', 'Out_of_Stock']).optional(),
    branchId: z.string().optional(),
    category: z.string().optional()
  })
});

export class InventoryController {
  /**
   * POST /api/inventory
   */
  public static create = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const newItem = await InventoryService.createItem(req.body);
      const response: ApiResponse = {
        success: true,
        data: newItem
      };
      res.status(201).json(response);
    } catch (error) {
      next(error);
    }
  };

  /**
   * GET /api/inventory
   */
  public static getAll = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const items = await InventoryService.getAllItems(req.query);
      const response: ApiResponse = {
        success: true,
        data: items
      };
      res.status(200).json(response);
    } catch (error) {
      next(error);
    }
  };

  /**
   * GET /api/inventory/:id
   */
  public static getById = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { id } = req.params;
      const item = await InventoryService.getItemById(id);
      const response: ApiResponse = {
        success: true,
        data: item
      };
      res.status(200).json(response);
    } catch (error) {
      next(error);
    }
  };

  /**
   * PATCH /api/inventory/:id
   */
  public static update = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { id } = req.params;
      const updatedItem = await InventoryService.updateItem(id, req.body);
      const response: ApiResponse = {
        success: true,
        data: updatedItem
      };
      res.status(200).json(response);
    } catch (error) {
      next(error);
    }
  };

  /**
   * DELETE /api/inventory/:id
   */
  public static delete = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { id } = req.params;
      await InventoryService.deleteItem(id);
      const response: ApiResponse = {
        success: true,
        data: { id, message: 'Inventory item successfully deleted' }
      };
      res.status(200).json(response);
    } catch (error) {
      next(error);
    }
  };
}
