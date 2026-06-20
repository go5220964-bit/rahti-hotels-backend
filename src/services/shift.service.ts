import prisma from './prisma';

export interface CreateShiftInput {
  name: string;
  startTime: string;
  endTime: string;
  branchId?: string | null;
  isOpen?: boolean;
}

export class ShiftService {
  public static async createShift(data: CreateShiftInput) {
    return await prisma.shift.create({
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

  public static async getAllShifts(branchId?: string) {
    const whereClause: any = { isActive: true };
    if (branchId) {
      whereClause.OR = [
        { branchId: null },
        { branchId }
      ];
    }
    return await prisma.shift.findMany({
      where: whereClause,
      include: {
        branch: true
      },
      orderBy: { createdAt: 'desc' }
    });
  }

  public static async getShiftsForBranch(branchId: string | null) {
    return await prisma.shift.findMany({
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

  public static async updateShift(id: string, data: Partial<CreateShiftInput> & { isActive?: boolean }) {
    return await prisma.shift.update({
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

  public static async deleteShift(id: string) {
    // Soft delete: set isActive = false
    return await prisma.shift.update({
      where: { id },
      data: { isActive: false }
    });
  }
}
