import prisma from './prisma';

export class RealKPIsService {
  /**
   * تجميع كافة مؤشرات الأداء الحقيقية لجميع الإدارات في استعلام متوازٍ واحد
   */
  public static async getAllDepartmentsKPIs(branchId?: string, daysWindow: number = 30) {
    const cleanBranchId = branchId && branchId !== 'ALL' ? branchId : undefined;

    const [inventory, maintenance, hr, executive] = await Promise.all([
      this.getInventoryKPIs(cleanBranchId, daysWindow),
      this.getMaintenanceKPIs(cleanBranchId, daysWindow),
      this.getHRAndAttendanceKPIs(cleanBranchId, daysWindow),
      this.getExecutiveMultiBranchKPIs(daysWindow),
    ]);

    return {
      generatedAt: new Date().toISOString(),
      currency: 'ر.س',
      daysWindow,
      branchId: cleanBranchId || 'ALL',
      inventory,
      maintenance,
      hr,
      executive,
    };
  }

  /**
   * 1. مؤشرات أداء المخزون والمستودعات والمشتريات (Inventory & Warehouse KPIs)
   */
  public static async getInventoryKPIs(branchId?: string, daysWindow: number = 30) {
    const sinceDate = new Date(Date.now() - daysWindow * 24 * 60 * 60 * 1000);

    const [items, purchaseRequests] = await Promise.all([
      prisma.inventoryItem.findMany({
        where: branchId ? { warehouse: { branchId } } : {},
        include: { warehouse: { include: { branch: true } }, category: true },
      }),
      prisma.request.findMany({
        where: {
          type: 'PURCHASE',
          createdAt: { gte: sinceDate },
          ...(branchId ? { user: { branchId } } : {}),
        },
      }),
    ]);

    const totalItemsCount = items.length;
    const totalUnitsInStock = items.reduce((sum, item) => sum + item.quantity, 0);
    const totalInventoryValueSAR = items.reduce(
      (sum, item) => sum + item.quantity * (item.unitPrice || 0),
      0
    );

    const outOfStockItems = items.filter((i) => i.quantity <= 0);
    const lowStockItems = items.filter((i) => i.quantity > 0 && i.quantity <= i.minQuantity);
    const healthyStockItems = items.filter((i) => i.quantity > i.minQuantity);

    // 1. نسبة توفر الأصناف المخزنية (Stock Availability Rate %)
    const stockAvailabilityRate =
      totalItemsCount > 0
        ? Number((((totalItemsCount - outOfStockItems.length) / totalItemsCount) * 100).toFixed(1))
        : 100;

    // 2. نسبة الأصناف الحرجة التي وصلت لحد إعادة الطلب (Critical Reorder Rate %)
    const criticalReorderRate =
      totalItemsCount > 0
        ? Number((((outOfStockItems.length + lowStockItems.length) / totalItemsCount) * 100).toFixed(1))
        : 0;

    // 3. مؤشرات دورة المشتريات (نسبة الاعتماد وزمن الدورة بالساعات)
    const approvedPOs = purchaseRequests.filter(
      (r) => r.status === 'APPROVED' || r.status === 'COMPLETED'
    );
    const pendingPOs = purchaseRequests.filter((r) => r.status === 'PENDING');
    const rejectedPOs = purchaseRequests.filter((r) => r.status === 'REJECTED');

    const totalApprovedPurchaseAmountSAR = approvedPOs.reduce(
      (sum, r) => sum + (r.amount || 0),
      0
    );

    const avgApprovalHours =
      approvedPOs.length > 0
        ? Number(
            (
              approvedPOs.reduce(
                (sum, r) =>
                  sum + (new Date(r.updatedAt).getTime() - new Date(r.createdAt).getTime()) / 3600000,
                0
              ) / approvedPOs.length
            ).toFixed(1)
          )
        : 0;

    // 4. توزيع قيمة المخزون حسب الفئة (Category Valuation Breakdown)
    const categoryMap = new Map<string, { name: string; count: number; valueSAR: number }>();
    for (const item of items) {
      const catName = item.category?.name || 'أصناف عامة';
      const current = categoryMap.get(catName) || { name: catName, count: 0, valueSAR: 0 };
      current.count += 1;
      current.valueSAR += item.quantity * (item.unitPrice || 0);
      categoryMap.set(catName, current);
    }

    return {
      currency: 'ر.س',
      totalItemsCount,
      totalUnitsInStock,
      totalInventoryValueSAR: Number(totalInventoryValueSAR.toFixed(2)),
      outOfStockCount: outOfStockItems.length,
      lowStockCount: lowStockItems.length,
      healthyStockCount: healthyStockItems.length,
      stockAvailabilityRate,
      criticalReorderRate,
      categoryBreakdown: Array.from(categoryMap.values()).map((c) => ({
        ...c,
        valueSAR: Number(c.valueSAR.toFixed(2)),
        sharePercent:
          totalInventoryValueSAR > 0
            ? Number(((c.valueSAR / totalInventoryValueSAR) * 100).toFixed(1))
            : 0,
      })),
      procurement: {
        totalRequests: purchaseRequests.length,
        approvedCount: approvedPOs.length,
        pendingCount: pendingPOs.length,
        rejectedCount: rejectedPOs.length,
        approvalRatePercent:
          purchaseRequests.length > 0
            ? Number(((approvedPOs.length / purchaseRequests.length) * 100).toFixed(1))
            : 0,
        totalApprovedAmountSAR: Number(totalApprovedPurchaseAmountSAR.toFixed(2)),
        avgApprovalHours,
      },
      criticalItemsList: [...outOfStockItems, ...lowStockItems].map((i) => ({
        id: i.id,
        name: i.name,
        sku: i.sku,
        categoryName: i.category?.name || 'عام',
        currentQty: i.quantity,
        minQty: i.minQuantity,
        deficitQty: Math.max(0, i.minQuantity * 2 - i.quantity),
        unitPriceSAR: i.unitPrice || 0,
        estimatedRestockCostSAR: Number(
          (Math.max(0, i.minQuantity * 2 - i.quantity) * (i.unitPrice || 0)).toFixed(2)
        ),
        warehouseName: i.warehouse?.name || 'المستودع الرئيسي',
      })),
    };
  }

  /**
   * 2. مؤشرات أداء الصيانة والأصول (Maintenance KPIs: MTTR, Technician SLA, Repeat Rooms)
   */
  public static async getMaintenanceKPIs(branchId?: string, daysWindow: number = 30) {
    const sinceDate = new Date(Date.now() - daysWindow * 24 * 60 * 60 * 1000);

    const tickets = await prisma.maintenanceTicket.findMany({
      where: {
        createdAt: { gte: sinceDate },
        ...(branchId ? { branchId } : {}),
      },
      include: {
        technician: { select: { id: true, name: true } },
        branch: { select: { id: true, name: true } },
      },
    });

    const totalTickets = tickets.length;
    const completedTickets = tickets.filter((t) => t.status === 'COMPLETED');
    const pendingTickets = tickets.filter((t) => t.status !== 'COMPLETED');
    const highPriorityCount = tickets.filter((t) => t.priority === 'HIGH').length;

    const completionRate =
      totalTickets > 0 ? Number(((completedTickets.length / totalTickets) * 100).toFixed(1)) : 100;

    // متوسط زمن الإصلاح الفعلي بالساعات (MTTR)
    const mttrHours =
      completedTickets.length > 0
        ? Number(
            (
              completedTickets.reduce(
                (sum, t) =>
                  sum + (new Date(t.updatedAt).getTime() - new Date(t.createdAt).getTime()) / 3600000,
                0
              ) / completedTickets.length
            ).toFixed(1)
          )
        : 0;

    // الغرف المتكررة الأعطال (Repeat Failure Rooms)
    const roomCounts = new Map<string, { count: number; branchName: string; lastIssue: string }>();
    for (const t of tickets) {
      if (t.roomNumber) {
        const key = `${t.branch?.name || 'الفرع'}-${t.roomNumber}`;
        const prev = roomCounts.get(key) || {
          count: 0,
          branchName: t.branch?.name || 'الفرع الرئيسي',
          lastIssue: t.title,
        };
        prev.count += 1;
        prev.lastIssue = t.title;
        roomCounts.set(key, prev);
      }
    }

    const repeatFailureRooms = Array.from(roomCounts.entries())
      .filter(([, info]) => info.count > 1)
      .sort((a, b) => b[1].count - a[1].count)
      .map(([roomKey, info]) => ({
        roomNumber: roomKey.split('-').pop() || roomKey,
        branchName: info.branchName,
        ticketsCount: info.count,
        lastIssue: info.lastIssue,
      }));

    // لوحة تقييم الفنيين (Technician SLA Leaderboard)
    const techMap = new Map<
      string,
      { name: string; assigned: number; completed: number; totalHours: number }
    >();
    for (const t of tickets) {
      if (!t.technicianId || !t.technician) continue;
      const entry = techMap.get(t.technicianId) || {
        name: t.technician.name,
        assigned: 0,
        completed: 0,
        totalHours: 0,
      };
      entry.assigned += 1;
      if (t.status === 'COMPLETED') {
        entry.completed += 1;
        entry.totalHours +=
          (new Date(t.updatedAt).getTime() - new Date(t.createdAt).getTime()) / 3600000;
      }
      techMap.set(t.technicianId, entry);
    }

    const technicianPerformance = Array.from(techMap.entries()).map(([id, stats]) => ({
      technicianId: id,
      name: stats.name,
      assignedCount: stats.assigned,
      completedCount: stats.completed,
      completionRate: Number(((stats.completed / stats.assigned) * 100).toFixed(1)),
      avgRepairHours:
        stats.completed > 0 ? Number((stats.totalHours / stats.completed).toFixed(1)) : 0,
    }));

    return {
      totalTickets,
      completedCount: completedTickets.length,
      pendingCount: pendingTickets.length,
      highPriorityCount,
      completionRate,
      mttrHours,
      repeatFailureRooms,
      technicianPerformance,
    };
  }

  /**
   * 3. مؤشرات الموارد البشرية والانضباط الجغرافي والسلف (HR & Attendance KPIs)
   */
  public static async getHRAndAttendanceKPIs(branchId?: string, daysWindow: number = 30) {
    const sinceDate = new Date(Date.now() - daysWindow * 24 * 60 * 60 * 1000);

    const [employees, attendanceLogs, loans, leaves] = await Promise.all([
      prisma.user.findMany({
        where: branchId ? { branchId } : {},
        include: { branch: true },
      }),
      prisma.attendanceLog.findMany({
        where: {
          checkIn: { gte: sinceDate },
          ...(branchId ? { user: { branchId } } : {}),
        },
      }),
      prisma.loanRequest.findMany({
        where: branchId ? { user: { branchId } } : {},
      }),
      prisma.leaveRequest.findMany({
        where: {
          createdAt: { gte: sinceDate },
          ...(branchId ? { user: { branchId } } : {}),
        },
      }),
    ]);

    const totalEmployees = employees.length;
    const totalPayrollBaseSAR = employees.reduce((sum, emp) => sum + (emp.salary || 0), 0);

    const approvedLoans = loans.filter((l) => l.status === 'APPROVED');
    const pendingLoans = loans.filter((l) => l.status === 'PENDING');
    const totalActiveLoansSAR = approvedLoans.reduce((sum, l) => sum + l.amount, 0);

    const loanToPayrollRatio =
      totalPayrollBaseSAR > 0
        ? Number(((totalActiveLoansSAR / totalPayrollBaseSAR) * 100).toFixed(1))
        : 0;

    const totalLogs = attendanceLogs.length;
    const onTimeLogs = attendanceLogs.filter((l) => l.status === 'PRESENT').length;
    const lateLogs = attendanceLogs.filter((l) => l.status === 'LATE').length;

    const punctualityRate =
      totalLogs > 0 ? Number(((onTimeLogs / totalLogs) * 100).toFixed(1)) : 0;

    return {
      currency: 'ر.س',
      totalEmployees,
      totalPayrollBaseSAR: Number(totalPayrollBaseSAR.toFixed(2)),
      totalActiveLoansSAR: Number(totalActiveLoansSAR.toFixed(2)),
      pendingLoansCount: pendingLoans.length,
      loanToPayrollRatio,
      attendance: {
        totalCheckIns: totalLogs,
        onTimeCount: onTimeLogs,
        lateCount: lateLogs,
        punctualityRate,
      },
      leaves: {
        totalRequests: leaves.length,
        approvedCount: leaves.filter((l) => l.status === 'APPROVED').length,
        pendingCount: leaves.filter((l) => l.status === 'PENDING').length,
      },
    };
  }

  /**
   * 4. بطاقة الأداء التنفيذي ومقارنة الفروع (Executive Multi-Branch Scorecard)
   */
  public static async getExecutiveMultiBranchKPIs(daysWindow: number = 30) {
    const sinceDate = new Date(Date.now() - daysWindow * 24 * 60 * 60 * 1000);
    const branches = await prisma.branch.findMany({
      include: {
        users: true,
        tickets: { where: { createdAt: { gte: sinceDate } } },
        warehouses: { include: { items: true } },
      },
    });

    const branchScorecards = branches.map((b) => {
      const totalTickets = b.tickets.length;
      const closedTickets = b.tickets.filter((t) => t.status === 'COMPLETED').length;
      const maintenanceScore =
        totalTickets > 0 ? Number(((closedTickets / totalTickets) * 100).toFixed(1)) : 100;

      const allItems = b.warehouses.flatMap((w) => w.items);
      const lowItems = allItems.filter((i) => i.quantity <= i.minQuantity).length;
      const inventoryHealthScore =
        allItems.length > 0
          ? Number((((allItems.length - lowItems) / allItems.length) * 100).toFixed(1))
          : 100;

      const overallHealthScore = Number(((maintenanceScore + inventoryHealthScore) / 2).toFixed(1));

      return {
        branchId: b.id,
        branchName: b.name,
        branchCode: b.code,
        employeesCount: b.users.length,
        openMaintenanceCount: totalTickets - closedTickets,
        maintenanceResolutionRate: maintenanceScore,
        lowStockCount: lowItems,
        inventoryHealthScore,
        overallHealthScore,
      };
    });

    return {
      totalBranches: branches.length,
      branchScorecards,
    };
  }
}
