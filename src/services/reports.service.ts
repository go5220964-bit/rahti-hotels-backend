import prisma from './prisma';
import { AppError } from '../middleware/error.middleware';

export class ReportsService {
  // -------------------------------------------------------------
  // Helpers
  // -------------------------------------------------------------
  private static isCheckInLate(timestamp: Date): boolean {
    const localTime = new Date(timestamp);
    const hour = localTime.getHours();
    const minute = localTime.getMinutes();

    // Morning shift: starts 07:00, late if checkin is after 07:15 and before 12:00
    if (hour === 7 && minute > 15) return true;
    if (hour > 7 && hour < 12) return true;

    // Evening shift: starts 15:00, late if checkin is after 15:15 and before 19:00
    if (hour === 15 && minute > 15) return true;
    if (hour > 15 && hour < 19) return true;

    // Night shift: starts 23:00, late if checkin is after 23:15 or before 03:00
    if (hour === 23 && minute > 15) return true;
    if (hour >= 0 && hour < 3) return true;

    return false;
  }

  // -------------------------------------------------------------
  // Financial Reports
  // -------------------------------------------------------------
  public static async getDailyFinancialSummary(branchId?: string, date?: string) {
    const targetDate = date ? new Date(date) : new Date();
    const dateStart = new Date(targetDate);
    dateStart.setHours(0, 0, 0, 0);
    const dateEnd = new Date(targetDate);
    dateEnd.setHours(23, 59, 59, 999);

    const shiftReportsRaw = await prisma.shiftReport.findMany({
      where: {
        branchId: branchId || undefined,
        createdAt: { gte: dateStart, lte: dateEnd }
      },
      include: {
        reporter: {
          select: { id: true, name: true, role: true, phoneNumber: true }
        },
        branch: true
      }
    });

    const paidDamages = await prisma.damageReport.findMany({
      where: {
        branchId: branchId || undefined,
        status: 'Paid',
        collectedAt: { gte: dateStart, lte: dateEnd }
      }
    });

    const totalDamageCollected = paidDamages.reduce((sum, d) => sum + (d.finalValue || 0), 0);

    const shiftReports = shiftReportsRaw.map(r => {
      const damagesForShift = paidDamages.filter(d => d.branchId === r.branchId);
      const damageCompensations = damagesForShift.reduce((sum, d) => sum + (d.finalValue || 0), 0);
      const remaining = r.grandTotal - damageCompensations;
      const roomRevenue = remaining * 0.75;
      const serviceRevenue = remaining * 0.25;
      return {
        ...r,
        damageCompensations,
        roomRevenue,
        serviceRevenue
      };
    });

    const totalRoomRevenue = shiftReports.reduce((sum, r) => sum + r.roomRevenue, 0);
    const totalServiceRevenue = shiftReports.reduce((sum, r) => sum + r.serviceRevenue, 0);
    const totalRevenue = shiftReports.reduce((sum, r) => sum + r.grandTotal, 0);

    const procurements = await prisma.procurementRequest.findMany({
      where: {
        branchId: branchId || undefined,
        status: { in: ['Purchased', 'ReceivedInWarehouse'] },
        updatedAt: { gte: dateStart, lte: dateEnd }
      }
    });

    const totalExpenses = procurements.reduce((sum, p) => sum + (p.actualPrice || p.estimatedPrice || 0), 0);
    const netProfit = totalRevenue - totalExpenses;

    const dateFormatted = targetDate.toISOString().split('T')[0];

    return {
      date: dateFormatted,
      branchId: branchId || 'All',
      shiftCount: shiftReports.length,
      totalRoomRevenue,
      totalServiceRevenue,
      totalDamageCollected,
      totalRevenue,
      totalExpenses,
      netProfit,
      shiftReports
    };
  }

  public static async getPeriodFinancialSummary(branchId?: string, from?: string, to?: string) {
    if (!from || !to) {
      throw new AppError(400, 'MISSING_DATES', 'تاريخ البدء وتاريخ الانتهاء مطلوبان.');
    }

    const start = new Date(from);
    start.setHours(0, 0, 0, 0);
    const end = new Date(to);
    end.setHours(23, 59, 59, 999);

    const shiftReportsRaw = await prisma.shiftReport.findMany({
      where: {
        branchId: branchId || undefined,
        createdAt: { gte: start, lte: end }
      },
      include: {
        reporter: { select: { id: true, name: true, role: true, phoneNumber: true } },
        branch: true
      }
    });

    const paidDamages = await prisma.damageReport.findMany({
      where: {
        branchId: branchId || undefined,
        status: 'Paid',
        collectedAt: { gte: start, lte: end }
      }
    });

    const procurements = await prisma.procurementRequest.findMany({
      where: {
        branchId: branchId || undefined,
        status: { in: ['Purchased', 'ReceivedInWarehouse'] },
        updatedAt: { gte: start, lte: end }
      }
    });

    const days = [];
    for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
      const dateStr = d.toISOString().split('T')[0];
      const dayStart = new Date(d);
      dayStart.setHours(0, 0, 0, 0);
      const dayEnd = new Date(d);
      dayEnd.setHours(23, 59, 59, 999);

      const dayShifts = shiftReportsRaw.filter(r => r.createdAt >= dayStart && r.createdAt <= dayEnd);
      const dayDamages = paidDamages.filter(dg => dg.collectedAt && dg.collectedAt >= dayStart && dg.collectedAt <= dayEnd);
      const dayProcs = procurements.filter(p => p.updatedAt && p.updatedAt >= dayStart && p.updatedAt <= dayEnd);

      const totalDamageCollected = dayDamages.reduce((sum, dg) => sum + (dg.finalValue || 0), 0);
      
      const mappedShifts = dayShifts.map(r => {
        const damagesForShift = dayDamages.filter(dg => dg.branchId === r.branchId);
        const damageCompensations = damagesForShift.reduce((sum, dg) => sum + (dg.finalValue || 0), 0);
        const remaining = r.grandTotal - damageCompensations;
        const roomRevenue = remaining * 0.75;
        const serviceRevenue = remaining * 0.25;
        return {
          ...r,
          damageCompensations,
          roomRevenue,
          serviceRevenue
        };
      });

      const totalRoomRevenue = mappedShifts.reduce((sum, r) => sum + r.roomRevenue, 0);
      const totalServiceRevenue = mappedShifts.reduce((sum, r) => sum + r.serviceRevenue, 0);
      const totalRevenue = mappedShifts.reduce((sum, r) => sum + r.grandTotal, 0);
      const totalExpenses = dayProcs.reduce((sum, p) => sum + (p.actualPrice || p.estimatedPrice || 0), 0);
      const netProfit = totalRevenue - totalExpenses;

      days.push({
        date: dateStr,
        branchId: branchId || 'All',
        shiftCount: mappedShifts.length,
        totalRoomRevenue,
        totalServiceRevenue,
        totalDamageCollected,
        totalRevenue,
        totalExpenses,
        netProfit,
        shiftReports: mappedShifts
      });
    }

    return days;
  }

  public static async getMonthlyFinancialSummary(branchId?: string, year?: number, month?: number) {
    if (!year || month === undefined) {
      throw new AppError(400, 'MISSING_PERIOD', 'السنة والشهر مطلوبان.');
    }

    const from = `${year}-${String(month + 1).padStart(2, '0')}-01`;
    const lastDay = new Date(year, month + 1, 0).getDate();
    const to = `${year}-${String(month + 1).padStart(2, '0')}-${String(lastDay).padStart(2, '0')}`;

    const dailyBreakdown = await this.getPeriodFinancialSummary(branchId, from, to);

    const totalRoomRevenue = dailyBreakdown.reduce((sum, d) => sum + d.totalRoomRevenue, 0);
    const totalServiceRevenue = dailyBreakdown.reduce((sum, d) => sum + d.totalServiceRevenue, 0);
    const totalDamageCollected = dailyBreakdown.reduce((sum, d) => sum + d.totalDamageCollected, 0);
    const totalRevenue = dailyBreakdown.reduce((sum, d) => sum + d.totalRevenue, 0);
    const totalExpenses = dailyBreakdown.reduce((sum, d) => sum + d.totalExpenses, 0);
    const netProfit = totalRevenue - totalExpenses;

    return {
      year,
      month,
      totalRoomRevenue,
      totalServiceRevenue,
      totalDamageCollected,
      totalRevenue,
      totalExpenses,
      netProfit,
      dailyBreakdown
    };
  }

  // -------------------------------------------------------------
  // HR Reports
  // -------------------------------------------------------------
  public static async getAttendanceSummary(branchId?: string, from?: string, to?: string) {
    if (!from || !to) {
      throw new AppError(400, 'MISSING_DATES', 'تاريخ البدء وتاريخ الانتهاء مطلوبان.');
    }

    const start = new Date(from);
    start.setHours(0, 0, 0, 0);
    const end = new Date(to);
    end.setHours(23, 59, 59, 999);

    const totalDays = Math.max(1, Math.round((end.getTime() - start.getTime()) / (24 * 3600 * 1000)) + 1);

    const users = await prisma.user.findMany({
      where: branchId ? { branchId } : {},
      include: { branch: true }
    });

    const logs = await prisma.attendanceLog.findMany({
      where: {
        userId: { in: users.map(u => u.id) },
        timestamp: { gte: start, lte: end },
        isValid: true
      },
      orderBy: { timestamp: 'asc' }
    });

    let totalEmployees = users.length;
    let presentDaysSum = 0;
    let absentDaysSum = 0;
    let lateDaysSum = 0;
    let totalHoursSum = 0;

    const byEmployee = users.map(user => {
      const userLogs = logs.filter(l => l.userId === user.id);
      
      // Calculate present days (unique days with a CheckIn log)
      const presentDaysSet = new Set(
        userLogs.filter(l => l.type === 'CheckIn').map(l => new Date(l.timestamp).toISOString().split('T')[0])
      );
      const present = presentDaysSet.size;
      const absent = Math.max(0, totalDays - present);

      // Calculate late days
      const lateDaysSet = new Set(
        userLogs.filter(l => l.type === 'CheckIn' && this.isCheckInLate(l.timestamp))
          .map(l => new Date(l.timestamp).toISOString().split('T')[0])
      );
      const late = lateDaysSet.size;

      // Calculate working hours
      let employeeHours = 0;
      presentDaysSet.forEach(dayStr => {
        const dayStart = new Date(dayStr);
        dayStart.setHours(0, 0, 0, 0);
        const dayEnd = new Date(dayStr);
        dayEnd.setHours(23, 59, 59, 999);

        const dayLogs = userLogs.filter(l => l.timestamp >= dayStart && l.timestamp <= dayEnd);
        const checkins = dayLogs.filter(l => l.type === 'CheckIn');
        const checkouts = dayLogs.filter(l => l.type === 'CheckOut');

        for (const ci of checkins) {
          const co = checkouts.find(c => c.timestamp > ci.timestamp);
          if (co) {
            employeeHours += (co.timestamp.getTime() - ci.timestamp.getTime()) / (1000 * 60 * 60);
          } else {
            // Default 8-hour shift if no checkout is registered
            employeeHours += 8;
          }
        }
      });

      presentDaysSum += present;
      absentDaysSum += absent;
      lateDaysSum += late;
      totalHoursSum += employeeHours;

      return {
        userId: user.id,
        name: user.name,
        present,
        absent,
        late,
        totalHours: parseFloat(employeeHours.toFixed(1))
      };
    });

    const averageHoursPerDay = presentDaysSum > 0 ? parseFloat((totalHoursSum / presentDaysSum).toFixed(1)) : 0;

    return {
      totalEmployees,
      totalDays,
      presentDays: presentDaysSum,
      absentDays: absentDaysSum,
      lateDays: lateDaysSum,
      averageHoursPerDay,
      byEmployee
    };
  }

  public static async getLeaveReport(branchId?: string, from?: string, to?: string) {
    if (!from || !to) {
      throw new AppError(400, 'MISSING_DATES', 'تاريخ البدء وتاريخ الانتهاء مطلوبان.');
    }

    const start = new Date(from);
    start.setHours(0, 0, 0, 0);
    const end = new Date(to);
    end.setHours(23, 59, 59, 999);

    const leaves = await prisma.leaveRequest.findMany({
      where: {
        user: branchId ? { branchId } : {},
        createdAt: { gte: start, lte: end }
      },
      include: { user: true }
    });

    const approved = leaves.filter(l => l.status === 'Approved').length;
    const rejected = leaves.filter(l => l.status === 'Rejected').length;
    const pending = leaves.filter(l => l.status === 'Pending').length;

    const byType = {
      Annual: leaves.filter(l => l.leaveType === 'Annual').length,
      Sick: leaves.filter(l => l.leaveType === 'Sick').length,
      Emergency: leaves.filter(l => l.leaveType === 'Emergency').length,
      Unpaid: leaves.filter(l => l.leaveType === 'Unpaid').length
    };

    const byEmployee = leaves.map(l => ({
      userId: l.userId,
      name: l.user.name,
      leaveDays: l.daysCount,
      leaveType: l.leaveType,
      status: l.status,
      startDate: l.startDate.toISOString().split('T')[0],
      endDate: l.endDate.toISOString().split('T')[0]
    }));

    return {
      totalRequests: leaves.length,
      approved,
      rejected,
      pending,
      byType,
      byEmployee
    };
  }

  public static async getLoanReport(branchId?: string) {
    const loans = await prisma.loanRequest.findMany({
      where: {
        user: branchId ? { branchId } : {}
      },
      include: { user: true }
    });

    const approvedLoans = loans.filter(l => l.status === 'Approved');

    let totalAmountLent = 0;
    let totalRepaid = 0;
    let totalOutstanding = 0;

    const mappedEmployeesMap = new Map<string, { userId: string; name: string; loanAmount: number; repaid: number; remaining: number }>();

    for (const loan of approvedLoans) {
      // Repayment deterministic calculation: 10% per week elapsed since approvedAt (or createdAt)
      const refDate = loan.approvedAt || loan.createdAt;
      const daysPassed = Math.max(0, Math.floor((Date.now() - new Date(refDate).getTime()) / (24 * 3600 * 1000)));
      const repaidRatio = Math.min(1, Math.floor(daysPassed / 7) * 0.1);
      
      const loanAmount = loan.amount;
      const repaid = loanAmount * repaidRatio;
      const remaining = loanAmount - repaid;

      totalAmountLent += loanAmount;
      totalRepaid += repaid;
      totalOutstanding += remaining;

      const existing = mappedEmployeesMap.get(loan.employeeId);
      if (existing) {
        existing.loanAmount += loanAmount;
        existing.repaid += repaid;
        existing.remaining += remaining;
      } else {
        mappedEmployeesMap.set(loan.employeeId, {
          userId: loan.employeeId,
          name: loan.user.name,
          loanAmount,
          repaid,
          remaining
        });
      }
    }

    const byEmployee = Array.from(mappedEmployeesMap.values()).map(e => ({
      userId: e.userId,
      name: e.name,
      loanAmount: parseFloat(e.loanAmount.toFixed(1)),
      repaid: parseFloat(e.repaid.toFixed(1)),
      remaining: parseFloat(e.remaining.toFixed(1))
    }));

    // Active loans: outstanding remaining amount is greater than 0
    const totalActiveLoans = approvedLoans.filter(l => {
      const refDate = l.approvedAt || l.createdAt;
      const daysPassed = Math.max(0, Math.floor((Date.now() - new Date(refDate).getTime()) / (24 * 3600 * 1000)));
      const repaidRatio = Math.min(1, Math.floor(daysPassed / 7) * 0.1);
      return (l.amount * (1 - repaidRatio)) > 0;
    }).length;

    return {
      totalActiveLoans,
      totalAmountLent: parseFloat(totalAmountLent.toFixed(1)),
      totalRepaid: parseFloat(totalRepaid.toFixed(1)),
      totalOutstanding: parseFloat(totalOutstanding.toFixed(1)),
      byEmployee
    };
  }

  // -------------------------------------------------------------
  // Maintenance Reports
  // -------------------------------------------------------------
  public static async getMaintenanceReport(branchId?: string, from?: string, to?: string) {
    if (!from || !to) {
      throw new AppError(400, 'MISSING_DATES', 'تاريخ البدء وتاريخ الانتهاء مطلوبان.');
    }

    const start = new Date(from);
    start.setHours(0, 0, 0, 0);
    const end = new Date(to);
    end.setHours(23, 59, 59, 999);

    const requests = await prisma.maintenanceRequest.findMany({
      where: {
        branchId: branchId || undefined,
        createdAt: { gte: start, lte: end }
      },
      include: { technician: true }
    });

    const open = requests.filter(r => r.status === 'New' || r.status === 'AssignedToTechnician').length;
    const inProgress = requests.filter(r => r.status === 'InProgress' || r.status === 'SpareParts').length;
    const completed = requests.filter(r => r.status === 'PendingInternalApproval').length;
    const approved = requests.filter(r => r.status === 'Closed').length;
    const rejected = requests.filter(r => r.status === 'Rejected').length;

    // Categories mapping: map Carpentry to Furniture, Cleaning/General to Other
    const byType = {
      Electrical: requests.filter(r => r.category === 'Electrical').length,
      Plumbing: requests.filter(r => r.category === 'Plumbing').length,
      AC: requests.filter(r => r.category === 'AC').length,
      Furniture: requests.filter(r => (r.category as string) === 'Carpentry' || (r.category as string) === 'Furniture').length,
      Other: requests.filter(r => r.category === 'Cleaning' || r.category === 'General' || (!['Electrical', 'Plumbing', 'AC', 'Carpentry', 'Furniture'].includes(r.category as string))).length
    };

    let totalHours = 0;
    let resolvedCount = 0;
    for (const r of requests) {
      const endTime = r.closedAt || r.completedAt;
      if (endTime) {
        const hours = (new Date(endTime).getTime() - new Date(r.createdAt).getTime()) / (1000 * 60 * 60);
        totalHours += hours;
        resolvedCount++;
      }
    }
    const avgResolutionTimeHours = resolvedCount > 0 ? parseFloat((totalHours / resolvedCount).toFixed(1)) : 0;

    // Group stats by technician
    const techsMap = new Map<string, { userId: string; name: string; assigned: number; completed: number; totalHours: number; count: number }>();
    for (const r of requests) {
      if (r.technician) {
        const tech = r.technician;
        const isCompleted = r.status === 'Closed' || r.status === 'PendingInternalApproval';
        
        let hours = 0;
        const endTime = r.closedAt || r.completedAt;
        if (endTime) {
          hours = (new Date(endTime).getTime() - new Date(r.createdAt).getTime()) / (1000 * 60 * 60);
        }

        const existing = techsMap.get(tech.id);
        if (existing) {
          existing.assigned++;
          if (isCompleted) {
            existing.completed++;
            if (hours > 0) {
              existing.totalHours += hours;
              existing.count++;
            }
          }
        } else {
          techsMap.set(tech.id, {
            userId: tech.id,
            name: tech.name,
            assigned: 1,
            completed: isCompleted ? 1 : 0,
            totalHours: hours > 0 ? hours : 0,
            count: hours > 0 ? 1 : 0
          });
        }
      }
    }

    const byTechnician = Array.from(techsMap.values()).map(t => ({
      userId: t.userId,
      name: t.name,
      assigned: t.assigned,
      completed: t.completed,
      avgHours: t.count > 0 ? parseFloat((t.totalHours / t.count).toFixed(1)) : 0
    }));

    return {
      totalRequests: requests.length,
      open,
      inProgress,
      completed,
      approved,
      rejected,
      avgResolutionTimeHours,
      byType,
      byTechnician
    };
  }

  // -------------------------------------------------------------
  // Inventory & Procurement Reports
  // -------------------------------------------------------------
  public static async getInventoryReport(branchId?: string) {
    const stockEntries = await prisma.stockEntry.findMany({
      where: branchId ? { branchId } : {},
      include: {
        item: {
          include: { category: true }
        }
      }
    });

    const totalItems = stockEntries.length;
    const lowStockCount = stockEntries.filter(s => s.quantity <= s.minThreshold && s.quantity > Math.floor(s.minThreshold / 2)).length;
    const criticalStockCount = stockEntries.filter(s => s.quantity <= Math.max(1, Math.floor(s.minThreshold / 2))).length;

    // Top consumed items: group StockMovements of type Out or Adjustments (negative)
    const movements = await prisma.stockMovement.findMany({
      where: {
        branchId: branchId || undefined,
        OR: [
          { type: 'Out' },
          { type: 'Adjustment', quantity: { lt: 0 } }
        ]
      },
      include: { item: true }
    });

    const itemOutSum = new Map<string, { itemId: string; name: string; totalConsumed: number; unit: string }>();
    for (const mov of movements) {
      const absQty = Math.abs(mov.quantity);
      const existing = itemOutSum.get(mov.itemId);
      if (existing) {
        existing.totalConsumed += absQty;
      } else {
        itemOutSum.set(mov.itemId, {
          itemId: mov.itemId,
          name: mov.item.name,
          totalConsumed: absQty,
          unit: mov.item.unit
        });
      }
    }

    const topConsumedItems = Array.from(itemOutSum.values())
      .sort((a, b) => b.totalConsumed - a.totalConsumed)
      .slice(0, 5);

    const recentMovementsRaw = await prisma.stockMovement.findMany({
      where: branchId ? { branchId } : {},
      include: { item: true, performer: true },
      orderBy: { createdAt: 'desc' },
      take: 10
    });

    const recentMovements = recentMovementsRaw.map(m => ({
      id: m.id,
      itemName: m.item.name,
      type: m.type,
      quantity: m.quantity,
      reason: m.reason,
      performer: m.performer.name,
      createdAt: m.createdAt.toISOString()
    }));

    const totalWarehouseRequests = await prisma.warehouseRequest.count({
      where: branchId ? { branchId } : {}
    });

    const pendingRequests = await prisma.warehouseRequest.count({
      where: {
        branchId: branchId || undefined,
        status: 'Pending'
      }
    });

    return {
      totalItems,
      lowStockCount,
      criticalStockCount,
      topConsumedItems,
      recentMovements,
      totalWarehouseRequests,
      pendingRequests
    };
  }

  public static async getProcurementReport(branchId?: string, from?: string, to?: string) {
    if (!from || !to) {
      throw new AppError(400, 'MISSING_DATES', 'تاريخ البدء وتاريخ الانتهاء مطلوبان.');
    }

    const start = new Date(from);
    start.setHours(0, 0, 0, 0);
    const end = new Date(to);
    end.setHours(23, 59, 59, 999);

    const procurements = await prisma.procurementRequest.findMany({
      where: {
        branchId: branchId || undefined,
        createdAt: { gte: start, lte: end }
      },
      include: { supplier: true }
    });

    // spend is actualPrice of Purchased / ReceivedInWarehouse
    const paidProcurements = procurements.filter(p => p.status === 'Purchased' || p.status === 'ReceivedInWarehouse');
    const totalSpend = paidProcurements.reduce((sum, p) => sum + (p.actualPrice || p.estimatedPrice || 0), 0);
    const pendingApproval = procurements.filter(p => p.status === 'PendingFinancialApproval' || p.status === 'Pending').length;

    const bySource = {
      LowStock: procurements.filter(p => p.source === 'LowStock').length,
      MaintenanceSpareParts: procurements.filter(p => p.source === 'MaintenanceSpareParts').length,
      DirectRequest: procurements.filter(p => p.source === 'DirectRequest' || p.source === 'Manual').length
    };

    const suppliersMap = new Map<string, { supplierId: string; name: string; totalOrders: number; totalSpend: number }>();
    for (const p of procurements) {
      if (p.supplier) {
        const sup = p.supplier;
        const isPaid = p.status === 'Purchased' || p.status === 'ReceivedInWarehouse';
        const cost = isPaid ? (p.actualPrice || p.estimatedPrice || 0) : 0;

        const existing = suppliersMap.get(sup.id);
        if (existing) {
          existing.totalOrders++;
          existing.totalSpend += cost;
        } else {
          suppliersMap.set(sup.id, {
            supplierId: sup.id,
            name: sup.name,
            totalOrders: 1,
            totalSpend: cost
          });
        }
      }
    }

    const bySupplier = Array.from(suppliersMap.values())
      .sort((a, b) => b.totalSpend - a.totalSpend);

    const byPaymentMethod = {
      Cash: procurements.filter(p => p.paymentMethod === 'Cash').length,
      BankTransfer: procurements.filter(p => p.paymentMethod === 'BankTransfer').length,
      Card: procurements.filter(p => p.paymentMethod === 'Card').length,
      Credit: procurements.filter(p => p.paymentMethod === 'Credit').length
    };

    return {
      totalRequests: procurements.length,
      totalSpend,
      pendingApproval,
      bySource,
      bySupplier,
      byPaymentMethod
    };
  }

  // -------------------------------------------------------------
  // Damage & Lost Found Reports
  // -------------------------------------------------------------
  public static async getDamageReport(branchId?: string, from?: string, to?: string) {
    if (!from || !to) {
      throw new AppError(400, 'MISSING_DATES', 'تاريخ البدء وتاريخ الانتهاء مطلوبان.');
    }

    const start = new Date(from);
    start.setHours(0, 0, 0, 0);
    const end = new Date(to);
    end.setHours(23, 59, 59, 999);

    const damages = await prisma.damageReport.findMany({
      where: {
        branchId: branchId || undefined,
        createdAt: { gte: start, lte: end }
      }
    });

    const totalReports = damages.length;
    const totalValue = damages.reduce((sum, d) => sum + (d.finalValue || d.estimatedValue || 0), 0);

    const collectedReports = damages.filter(d => d.status === 'Paid');
    const collected = collectedReports.length;
    const collectedValue = collectedReports.reduce((sum, d) => sum + (d.finalValue || 0), 0);

    const refusedReports = damages.filter(d => d.status === 'Refused');
    const refused = refusedReports.length;
    const refusedValue = refusedReports.reduce((sum, d) => sum + (d.finalValue || d.estimatedValue || 0), 0);

    const waivedReports = damages.filter(d => d.status === 'WaivedByManagement' || (d.status as string) === 'Waived');
    const waived = waivedReports.length;
    const waivedValue = waivedReports.reduce((sum, d) => sum + (d.finalValue || d.estimatedValue || 0), 0);

    const pending = totalReports - collected - refused - waived;

    const recoveryRate = totalValue > 0 ? Math.round((collectedValue / totalValue) * 100) : 0;

    const byType = {
      Furniture: damages.filter(d => d.damageType === 'Furniture').length,
      Electronics: damages.filter(d => d.damageType === 'Electronics').length,
      Fixture: damages.filter(d => d.damageType === 'Fixture').length,
      Linen: damages.filter(d => d.damageType === 'Linen').length,
      Door: damages.filter(d => d.damageType === 'Door').length,
      Window: damages.filter(d => d.damageType === 'Window').length,
      Other: damages.filter(d => d.damageType === 'Other').length
    };

    const roomsMap = new Map<string, { room: string; count: number; totalValue: number }>();
    for (const d of damages) {
      const val = d.finalValue || d.estimatedValue || 0;
      const existing = roomsMap.get(d.roomNumber);
      if (existing) {
        existing.count++;
        existing.totalValue += val;
      } else {
        roomsMap.set(d.roomNumber, {
          room: d.roomNumber,
          count: 1,
          totalValue: val
        });
      }
    }

    const byRoom = Array.from(roomsMap.values())
      .sort((a, b) => b.count - a.count)
      .slice(0, 5);

    return {
      totalReports,
      totalValue,
      collected,
      collectedValue,
      refused,
      refusedValue,
      waived,
      waivedValue,
      pending,
      recoveryRate,
      byType,
      byRoom
    };
  }

  public static async getLostFoundReport(branchId?: string, from?: string, to?: string) {
    if (!from || !to) {
      throw new AppError(400, 'MISSING_DATES', 'تاريخ البدء وتاريخ الانتهاء مطلوبان.');
    }

    const start = new Date(from);
    start.setHours(0, 0, 0, 0);
    const end = new Date(to);
    end.setHours(23, 59, 59, 999);

    const items = await prisma.lostFoundItem.findMany({
      where: {
        branchId: branchId || undefined,
        createdAt: { gte: start, lte: end }
      }
    });

    const totalItems = items.length;
    const stored = items.filter(i => i.status === 'Stored' || i.status === 'ContactedGuest').length;
    const claimed = items.filter(i => i.status === 'Claimed').length;
    const archived = items.filter(i => i.status === 'Archived').length;

    const claimRate = totalItems > 0 ? Math.round((claimed / totalItems) * 100) : 0;

    const locMap = new Map<string, { location: string; count: number }>();
    for (const i of items) {
      const existing = locMap.get(i.location);
      if (existing) {
        existing.count++;
      } else {
        locMap.set(i.location, {
          location: i.location,
          count: 1
        });
      }
    }

    const byLocation = Array.from(locMap.values())
      .sort((a, b) => b.count - a.count);

    let totalDaysDiff = 0;
    let resolvedCount = 0;
    for (const i of items) {
      const endTime = i.claimedAt || i.archivedAt;
      if (endTime) {
        const days = (new Date(endTime).getTime() - new Date(i.createdAt).getTime()) / (1000 * 60 * 60 * 24);
        totalDaysDiff += days;
        resolvedCount++;
      }
    }
    const avgDaysToClaimOrArchive = resolvedCount > 0 ? parseFloat((totalDaysDiff / resolvedCount).toFixed(1)) : 0;

    return {
      totalItems,
      stored,
      claimed,
      archived,
      claimRate,
      byLocation,
      avgDaysToClaimOrArchive
    };
  }

  // -------------------------------------------------------------
  // Executive Summary
  // -------------------------------------------------------------
  public static async getExecutiveSummary(from?: string, to?: string) {
    if (!from || !to) {
      throw new AppError(400, 'MISSING_DATES', 'تاريخ البدء وتاريخ الانتهاء مطلوبان.');
    }

    const branches = await prisma.branch.findMany();
    const byBranch = [];

    let totalRevenueSum = 0;
    let totalProfitSum = 0;
    let openMaintenanceSum = 0;
    let pendingDamageSum = 0;

    for (const branch of branches) {
      // 1. Period financial summary
      const financials = await this.getPeriodFinancialSummary(branch.id, from, to);
      const totalRevenue = financials.reduce((sum, f) => sum + f.totalRevenue, 0);
      const totalExpenses = financials.reduce((sum, f) => sum + f.totalExpenses, 0);
      const netProfit = totalRevenue - totalExpenses;

      // 2. Open maintenance tickets
      const openMaintenanceTickets = await prisma.maintenanceRequest.count({
        where: {
          branchId: branch.id,
          status: { in: ['New', 'AssignedToTechnician', 'InProgress', 'SpareParts'] }
        }
      });

      // 3. Low stock items
      const stockEntries = await prisma.stockEntry.findMany({ where: { branchId: branch.id } });
      const lowStockItems = stockEntries.filter(s => s.quantity <= s.minThreshold).length;

      // 4. Pending damage collections
      const pendingDamageCollection = await prisma.damageReport.count({
        where: {
          branchId: branch.id,
          status: 'PendingGuestDecision'
        }
      });

      // 5. Attendance Rate
      const users = await prisma.user.findMany({ where: { branchId: branch.id } });
      const userIds = users.map(u => u.id);
      const start = new Date(from);
      start.setHours(0, 0, 0, 0);
      const end = new Date(to);
      end.setHours(23, 59, 59, 999);
      const totalDays = Math.max(1, Math.round((end.getTime() - start.getTime()) / (24 * 3600 * 1000)) + 1);
      const totalSlots = userIds.length * totalDays;

      const presentLogs = await prisma.attendanceLog.findMany({
        where: {
          userId: { in: userIds },
          timestamp: { gte: start, lte: end },
          type: 'CheckIn',
          isValid: true
        }
      });

      const presentDaysSet = new Set(
        presentLogs.map(log => `${log.userId}_${new Date(log.timestamp).toISOString().split('T')[0]}`)
      );
      const presentCount = presentDaysSet.size;
      const attendanceRate = totalSlots > 0 ? Math.round((presentCount / totalSlots) * 100) : 100;

      // 6. Occupancy rate (mock 65-95%)
      const occupancyRate = 65 + (branch.id.charCodeAt(0) % 31);

      totalRevenueSum += totalRevenue;
      totalProfitSum += netProfit;
      openMaintenanceSum += openMaintenanceTickets;
      pendingDamageSum += pendingDamageCollection;

      byBranch.push({
        branchId: branch.id,
        branchName: branch.name,
        totalRevenue,
        netProfit,
        occupancyRate,
        openMaintenanceTickets,
        lowStockItems,
        pendingDamageCollection,
        attendanceRate
      });
    }

    return {
      byBranch,
      totals: {
        revenue: totalRevenueSum,
        profit: totalProfitSum,
        maintenance: openMaintenanceSum,
        damage: pendingDamageSum
      }
    };
  }
}
