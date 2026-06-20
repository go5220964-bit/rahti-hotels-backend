import prisma from './prisma';

export class BranchService {
  public static async getAll() {
    return await prisma.branch.findMany({
      orderBy: { createdAt: 'desc' },
    });
  }

  public static async createBranch(data: { name: string; location?: string; lat?: number | null; lng?: number | null; radiusMeters?: number }) {
    return await prisma.branch.create({
      data: {
        name: data.name,
        location: data.location || null,
        lat: data.lat || null,
        lng: data.lng || null,
        radiusMeters: data.radiusMeters !== undefined ? data.radiusMeters : 200,
      },
    });
  }

  public static async updateBranch(id: string, data: { name?: string; location?: string; lat?: number | null; lng?: number | null; radiusMeters?: number }) {
    const branch = await prisma.branch.findUnique({ where: { id } });
    if (!branch) {
      throw new Error(`Branch with ID ${id} was not found.`);
    }

    return await prisma.branch.update({
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

  public static async deleteBranch(id: string) {
    const branch = await prisma.branch.findUnique({ where: { id } });
    if (!branch) {
      throw new Error(`Branch with ID ${id} was not found.`);
    }

    return await prisma.branch.delete({
      where: { id },
    });
  }
}
