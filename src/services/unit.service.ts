import prisma from './prisma';

export interface UnitFilters {
  branchId?: string;
  status?: string;
  floor?: number;
  search?: string;
}

export class UnitService {
  /**
   * Get all units with optional filters (branch, status, floor, search query)
   */
  public static async getAllUnits(filters: UnitFilters = {}) {
    const where: any = {};

    if (filters.branchId && filters.branchId !== 'all') {
      where.branchId = filters.branchId;
    }

    if (filters.status && filters.status !== 'all') {
      where.status = filters.status;
    }

    if (filters.floor) {
      where.floor = Number(filters.floor);
    }

    if (filters.search) {
      where.OR = [
        { unitNumber: { contains: filters.search, mode: 'insensitive' } },
        { guestName: { contains: filters.search, mode: 'insensitive' } },
        { guestPhone: { contains: filters.search } }
      ];
    }

    const units = await prisma.unit.findMany({
      where,
      include: {
        branch: { select: { id: true, name: true } },
        assets: true,
        maintenanceRequests: {
          where: { status: { notIn: ['Closed', 'Rejected'] } },
          select: {
            id: true,
            ticketNumber: true,
            category: true,
            status: true,
            priority: true,
            description: true,
            assignedTo: true,
            technician: { select: { name: true, phoneNumber: true } },
            createdAt: true
          }
        },
        damageReports: {
          where: { status: { in: ['New', 'UnderReview', 'PendingGuestDecision'] } },
          select: {
            id: true,
            ticketNumber: true,
            damageType: true,
            status: true,
            estimatedValue: true,
            createdAt: true
          }
        }
      },
      orderBy: [
        { floor: 'asc' },
        { unitNumber: 'asc' }
      ]
    });

    return units;
  }

  /**
   * Get single unit by ID
   */
  public static async getUnitById(id: string) {
    const unit = await prisma.unit.findUnique({
      where: { id },
      include: {
        branch: true,
        assets: true,
        maintenanceRequests: {
          orderBy: { createdAt: 'desc' },
          take: 10,
          include: {
            technician: { select: { name: true, phoneNumber: true } },
            timeline: { orderBy: { createdAt: 'desc' }, take: 3 }
          }
        },
        damageReports: {
          orderBy: { createdAt: 'desc' },
          take: 10
        }
      }
    });

    if (!unit) {
      throw new Error('الوحدة الفندقية غير موجودة');
    }

    return unit;
  }

  /**
   * Transformation #1: Get full Health & Financial Card for a unit
   */
  public static async getUnitHealthCard(unitId: string) {
    const unit = await prisma.unit.findUnique({
      where: { id: unitId },
      include: {
        branch: true,
        assets: {
          include: {
            maintenanceRequests: {
              select: { id: true, ticketNumber: true, status: true, createdAt: true }
            }
          }
        },
        maintenanceRequests: {
          include: {
            technician: { select: { id: true, name: true, phoneNumber: true } },
            sparePartItem: { select: { id: true, name: true, unit: true } }
          },
          orderBy: { createdAt: 'desc' }
        },
        damageReports: {
          orderBy: { createdAt: 'desc' }
        }
      }
    });

    if (!unit) {
      throw new Error('الوحدة غير موجودة');
    }

    // Calculate Maintenance Metrics
    const totalMaintenanceTickets = unit.maintenanceRequests.length;
    const activeMaintenanceTickets = unit.maintenanceRequests.filter(
      r => !['Closed', 'Rejected'].includes(r.status)
    );
    const categoryBreakdown: Record<string, number> = {};
    unit.maintenanceRequests.forEach(r => {
      categoryBreakdown[r.category] = (categoryBreakdown[r.category] || 0) + 1;
    });

    // Calculate Damage Metrics
    const totalDamageReports = unit.damageReports.length;
    const activeDamageReports = unit.damageReports.filter(
      d => ['New', 'UnderReview', 'PendingGuestDecision'].includes(d.status)
    );
    const totalDamageEstimated = unit.damageReports.reduce((sum, d) => sum + (d.estimatedValue || 0), 0);
    const totalDamageCollected = unit.damageReports.reduce((sum, d) => sum + (d.finalValue || 0), 0);

    // Calculate Asset Warranties
    const now = new Date();
    const assetsWithWarrantyStatus = unit.assets.map(asset => {
      const isUnderWarranty = asset.warrantyExpiry ? new Date(asset.warrantyExpiry) > now : false;
      return {
        ...asset,
        isUnderWarranty
      };
    });

    // Calculate 0-100 Unit Health Score
    let healthScore = 100;
    // Penalty for open maintenance tickets: -25 each
    healthScore -= activeMaintenanceTickets.length * 25;
    // Penalty for active damages: -15 each
    healthScore -= activeDamageReports.length * 15;
    // Penalty for recent tickets within last 30 days: -5 each
    const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
    const recentTickets = unit.maintenanceRequests.filter(r => new Date(r.createdAt) >= thirtyDaysAgo);
    healthScore -= recentTickets.length * 5;
    if (healthScore < 0) healthScore = 0;

    const isReadyForCheckin = unit.status === 'Available' && activeMaintenanceTickets.length === 0;

    return {
      unit: {
        id: unit.id,
        unitNumber: unit.unitNumber,
        floor: unit.floor,
        unitType: unit.unitType,
        status: unit.status,
        branchId: unit.branchId,
        branchName: unit.branch.name,
        guestName: unit.guestName,
        guestPhone: unit.guestPhone,
        checkInDate: unit.checkInDate,
        checkOutDate: unit.checkOutDate,
        nazeelReservationId: unit.nazeelReservationId,
        notes: unit.notes
      },
      healthScore,
      isReadyForCheckin,
      assets: assetsWithWarrantyStatus,
      maintenanceSummary: {
        totalTickets: totalMaintenanceTickets,
        activeTicketsCount: activeMaintenanceTickets.length,
        activeTickets: activeMaintenanceTickets,
        categoryBreakdown,
        recentHistory: unit.maintenanceRequests.slice(0, 5)
      },
      damageSummary: {
        totalReports: totalDamageReports,
        activeReportsCount: activeDamageReports.length,
        activeReports: activeDamageReports,
        totalDamageEstimated,
        totalDamageCollected,
        history: unit.damageReports
      }
    };
  }

  /**
   * Update Unit Status and Guest Check-in/Check-out
   */
  public static async updateUnitStatus(unitId: string, data: {
    status: any;
    guestName?: string;
    guestPhone?: string;
    checkInDate?: Date | string;
    checkOutDate?: Date | string;
    nazeelReservationId?: string;
    notes?: string;
  }) {
    const updatePayload: any = {
      status: data.status
    };

    if (data.notes !== undefined) updatePayload.notes = data.notes;

    if (data.status === 'Occupied') {
      if (data.guestName !== undefined) updatePayload.guestName = data.guestName;
      if (data.guestPhone !== undefined) updatePayload.guestPhone = data.guestPhone;
      if (data.checkInDate) updatePayload.checkInDate = new Date(data.checkInDate);
      if (data.checkOutDate) updatePayload.checkOutDate = new Date(data.checkOutDate);
      if (data.nazeelReservationId !== undefined) updatePayload.nazeelReservationId = data.nazeelReservationId;
    } else if (data.status === 'Available') {
      // Clear guest info upon check-out / ready
      updatePayload.guestName = null;
      updatePayload.guestPhone = null;
      updatePayload.checkInDate = null;
      updatePayload.checkOutDate = null;
      updatePayload.nazeelReservationId = null;
    }

    return await prisma.unit.update({
      where: { id: unitId },
      data: updatePayload,
      include: { branch: true }
    });
  }

  /**
   * Create a new unit
   */
  public static async createUnit(data: {
    branchId: string;
    unitNumber: string;
    floor?: number;
    unitType?: any;
    notes?: string;
  }) {
    return await prisma.unit.create({
      data: {
        branchId: data.branchId,
        unitNumber: data.unitNumber,
        floor: data.floor || 1,
        unitType: data.unitType || 'Apartment',
        status: 'Available',
        notes: data.notes || null
      }
    });
  }

  /**
   * Update unit configuration
   */
  public static async updateUnit(id: string, data: {
    unitNumber?: string;
    floor?: number;
    unitType?: any;
    notes?: string;
  }) {
    return await prisma.unit.update({
      where: { id },
      data
    });
  }

  /**
   * Delete unit
   */
  public static async deleteUnit(id: string) {
    return await prisma.unit.delete({
      where: { id }
    });
  }

  /**
   * Create Asset inside a Unit
   */
  public static async createAsset(data: {
    unitId: string;
    name: string;
    category: string;
    brand?: string;
    modelNumber?: string;
    serialNumber?: string;
    purchaseDate?: Date | string;
    warrantyExpiry?: Date | string;
    installationDate?: Date | string;
    cost?: number;
    status?: string;
    notes?: string;
  }) {
    return await prisma.unitAsset.create({
      data: {
        unitId: data.unitId,
        name: data.name,
        category: data.category,
        brand: data.brand || null,
        modelNumber: data.modelNumber || null,
        serialNumber: data.serialNumber || null,
        purchaseDate: data.purchaseDate ? new Date(data.purchaseDate) : null,
        warrantyExpiry: data.warrantyExpiry ? new Date(data.warrantyExpiry) : null,
        installationDate: data.installationDate ? new Date(data.installationDate) : null,
        cost: data.cost || null,
        status: data.status || 'Working',
        notes: data.notes || null
      }
    });
  }

  /**
   * Update Asset
   */
  public static async updateAsset(assetId: string, data: any) {
    const payload = { ...data };
    if (payload.purchaseDate) payload.purchaseDate = new Date(payload.purchaseDate);
    if (payload.warrantyExpiry) payload.warrantyExpiry = new Date(payload.warrantyExpiry);
    if (payload.installationDate) payload.installationDate = new Date(payload.installationDate);

    return await prisma.unitAsset.update({
      where: { id: assetId },
      data: payload
    });
  }

  /**
   * Delete Asset
   */
  public static async deleteAsset(assetId: string) {
    return await prisma.unitAsset.delete({
      where: { id: assetId }
    });
  }

  /**
   * Pre-seed standard units (Floors 1-4, 8 units each = 32 units) with real hotel assets
   */
  public static async seedBranchUnits(branchId: string) {
    const defaultAssetsTemplates = [
      { name: 'مكيف صالة اسبليت جري 24 وحدة', category: 'AC', brand: 'Gree', cost: 2400 },
      { name: 'مكيف غرفة نوم اسبليت جري 18 وحدة', category: 'AC', brand: 'Gree', cost: 1900 },
      { name: 'شاشة سامسونج سمارت 55 بوصة 4K', category: 'Electronics', brand: 'Samsung', cost: 1750 },
      { name: 'سخان ماء الخزف السعودي 50 لتر', category: 'Plumbing', brand: 'Saudi Ceramic', cost: 450 },
      { name: 'ثلاجة جنرال سوبريم بابين 12 قدم', category: 'Appliances', brand: 'General Supreme', cost: 1350 },
      { name: 'غسالة ملابس ميديا 7 كجم أوتوماتيك', category: 'Appliances', brand: 'Midea', cost: 1100 }
    ];

    const results = [];
    const oneYearFromNow = new Date();
    oneYearFromNow.setFullYear(oneYearFromNow.getFullYear() + 2);

    for (let floor = 1; floor <= 4; floor++) {
      for (let num = 1; num <= 8; num++) {
        const unitNumber = `${floor}0${num}`;

        // Check if unit exists
        let unit = await prisma.unit.findUnique({
          where: {
            branchId_unitNumber: {
              branchId,
              unitNumber
            }
          }
        });

        if (!unit) {
          unit = await prisma.unit.create({
            data: {
              branchId,
              unitNumber,
              floor,
              unitType: num <= 2 ? 'Studio' : num <= 6 ? 'OneBedroom' : 'TwoBedroom',
              status: num === 1 ? 'Occupied' : num === 4 ? 'CleaningNeeded' : 'Available',
              guestName: num === 1 ? 'محمد عبد الله العتيبي' : null,
              guestPhone: num === 1 ? '0501234567' : null,
              checkInDate: num === 1 ? new Date() : null,
              nazeelReservationId: num === 1 ? `NZ-${floor}0${num}` : null
            }
          });

          // Create standard assets for this unit
          for (const assetTpl of defaultAssetsTemplates) {
            await prisma.unitAsset.create({
              data: {
                unitId: unit.id,
                name: assetTpl.name,
                category: assetTpl.category,
                brand: assetTpl.brand,
                cost: assetTpl.cost,
                purchaseDate: new Date('2025-01-15'),
                warrantyExpiry: oneYearFromNow,
                status: 'Working'
              }
            });
          }

          results.push(unit);
        }
      }
    }

    return {
      message: `تم إنشاء وربط الوحدات الفندقية وأصولها بنجاح`,
      seededCount: results.length
    };
  }
}
