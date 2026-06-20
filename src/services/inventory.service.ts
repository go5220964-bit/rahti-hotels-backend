import prisma from './prisma';
import { AppError } from '../middleware/error.middleware';

export interface CreateInventoryInput {
  name: string;
  category: string;
  stockLevel: number;
  reorderLevel: number;
  branchId: string;
  status?: string;
}

export interface UpdateInventoryInput {
  name?: string;
  category?: string;
  stockLevel?: number;
  reorderLevel?: number;
  status?: string;
  branchId?: string;
}

export class InventoryService {
  /**
   * Get all inventory items matching filters
   */
  public static async getAllItems(filters?: { status?: string; branchId?: string; category?: string }) {
    const where: any = {};
    
    if (filters?.status) where.status = filters.status;
    if (filters?.branchId) where.branchId = filters.branchId;
    if (filters?.category) where.category = filters.category;

    return await prisma.inventoryItem.findMany({
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
  public static async getItemById(id: string) {
    const item = await prisma.inventoryItem.findUnique({
      where: { id },
      include: { branch: true }
    });

    if (!item) {
      throw new AppError(404, 'INVENTORY_ITEM_NOT_FOUND', `Inventory item with ID ${id} does not exist.`);
    }

    return item;
  }

  /**
   * Create an inventory item
   */
  public static async createItem(input: CreateInventoryInput) {
    // Verify branch exists
    const branch = await prisma.branch.findUnique({ where: { id: input.branchId } });
    if (!branch) {
      throw new AppError(404, 'BRANCH_NOT_FOUND', `Branch with ID ${input.branchId} does not exist.`);
    }

    return await prisma.inventoryItem.create({
      data: {
        name: input.name,
        category: input.category,
        stockLevel: input.stockLevel,
        reorderLevel: input.reorderLevel,
        status: (input.status || 'Available') as any,
        branchId: input.branchId
      },
      include: { branch: true }
    });
  }

  /**
   * Update an inventory item
   */
  public static async updateItem(id: string, input: UpdateInventoryInput) {
    await this.getItemById(id);

    const data: any = {};
    if (input.name !== undefined) data.name = input.name;
    if (input.category !== undefined) data.category = input.category;
    if (input.stockLevel !== undefined) {
      data.stockLevel = input.stockLevel;
      // Auto toggle status to Out_of_Stock if stock level drops to 0
      if (input.stockLevel <= 0) {
        data.status = 'Out_of_Stock';
      } else if (input.status === undefined) {
        data.status = 'Available'; // Auto-restore if stock level increases
      }
    }
    if (input.reorderLevel !== undefined) data.reorderLevel = input.reorderLevel;
    if (input.status !== undefined) data.status = input.status;
    if (input.branchId !== undefined) {
      const branch = await prisma.branch.findUnique({ where: { id: input.branchId } });
      if (!branch) {
        throw new AppError(404, 'BRANCH_NOT_FOUND', `Branch with ID ${input.branchId} does not exist.`);
      }
      data.branchId = input.branchId;
    }

    return await prisma.inventoryItem.update({
      where: { id },
      data,
      include: { branch: true }
    });
  }

  /**
   * Delete an inventory item
   */
  public static async deleteItem(id: string) {
    await this.getItemById(id);
    return await prisma.inventoryItem.delete({ where: { id } });
  }
}
