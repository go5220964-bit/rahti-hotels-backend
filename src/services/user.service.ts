import prisma from './prisma';
import { AppError } from '../middleware/error.middleware';

export class UserService {
  public static async getAll() {
    return await prisma.user.findMany({
      include: {
        branch: true,
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  public static async createUser(data: { name: string; role: string; phoneNumber: string; branchId: string; employeeType?: string; email?: string }) {
    // Check if phone number is unique
    const existing = await prisma.user.findUnique({
      where: { phoneNumber: data.phoneNumber },
    });
    if (existing) {
      throw new AppError(400, 'PHONE_NUMBER_TAKEN', `رقم الهاتف ${data.phoneNumber} مسجل مسبقاً لموظف آخر.`);
    }

    // Verify branch exists if provided
    if (data.branchId) {
      const branch = await prisma.branch.findUnique({ where: { id: data.branchId } });
      if (!branch) {
        throw new AppError(404, 'BRANCH_NOT_FOUND', `الفرع المحدد غير موجود.`);
      }
    }

    return await prisma.user.create({
      data: {
        name: data.name,
        role: data.role as any,
        phoneNumber: data.phoneNumber,
        branchId: data.branchId || null,
        employeeType: (data.employeeType || 'Fixed') as any,
        email: data.email || null,
        botEnabled: true,
        isActive: true
      },
      include: {
        branch: true,
      },
    });
  }

  public static async updateUser(id: string, data: { name?: string; role?: string; phoneNumber?: string; branchId?: string; employeeType?: string; email?: string; botEnabled?: boolean; isActive?: boolean }) {
    const user = await prisma.user.findUnique({ where: { id } });
    if (!user) {
      throw new AppError(404, 'USER_NOT_FOUND', `الموظف ذو المعرف ${id} غير موجود.`);
    }

    const updateData: any = {};
    if (data.name !== undefined) updateData.name = data.name;
    if (data.role !== undefined) updateData.role = data.role;
    if (data.employeeType !== undefined) updateData.employeeType = data.employeeType;
    if (data.email !== undefined) updateData.email = data.email;
    if (data.botEnabled !== undefined) updateData.botEnabled = data.botEnabled;
    if (data.isActive !== undefined) updateData.isActive = data.isActive;
    
    if (data.phoneNumber !== undefined && data.phoneNumber !== user.phoneNumber) {
      const existing = await prisma.user.findUnique({
        where: { phoneNumber: data.phoneNumber },
      });
      if (existing) {
        throw new AppError(400, 'PHONE_NUMBER_TAKEN', `رقم الهاتف ${data.phoneNumber} مسجل مسبقاً لموظف آخر.`);
      }
      updateData.phoneNumber = data.phoneNumber;
    }

    if (data.branchId !== undefined) {
      if (data.branchId) {
        const branch = await prisma.branch.findUnique({ where: { id: data.branchId } });
        if (!branch) {
          throw new AppError(404, 'BRANCH_NOT_FOUND', `الفرع المحدد غير موجود.`);
        }
        updateData.branchId = data.branchId;
      } else {
        updateData.branchId = null;
      }
    }

    return await prisma.user.update({
      where: { id },
      data: updateData,
      include: { branch: true }
    });
  }

  public static async deleteUser(id: string) {
    const user = await prisma.user.findUnique({ where: { id } });
    if (!user) {
      throw new AppError(404, 'USER_NOT_FOUND', `الموظف ذو المعرف ${id} غير موجود.`);
    }

    return await prisma.user.delete({
      where: { id },
    });
  }

  public static async transferBranch(userId: string, newBranchId: string, reason: string, createdBy: string) {
    const user = await prisma.user.findUnique({ where: { id: userId } });
    if (!user) {
      throw new AppError(404, 'USER_NOT_FOUND', `الموظف ذو المعرف ${userId} غير موجود.`);
    }

    const branch = await prisma.branch.findUnique({ where: { id: newBranchId } });
    if (!branch) {
      throw new AppError(404, 'BRANCH_NOT_FOUND', `الفرع المحدد غير موجود.`);
    }

    const fromBranchId = user.branchId || '';

    // Create historical EmployeeTransfer record
    await prisma.employeeTransfer.create({
      data: {
        employeeId: userId,
        fromBranchId,
        toBranchId: newBranchId,
        transferDate: new Date(),
        reason: reason || 'نقل إداري',
        createdBy: createdBy || 'system'
      }
    });

    return await prisma.user.update({
      where: { id: userId },
      data: { branchId: newBranchId },
      include: { branch: true }
    });
  }

  public static async getUserById(id: string) {
    const user = await prisma.user.findUnique({
      where: { id },
      include: { branch: true }
    });
    if (!user) {
      throw new AppError(404, 'USER_NOT_FOUND', 'المستخدم غير موجود.');
    }
    return user;
  }
}
