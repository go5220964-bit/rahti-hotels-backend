import prisma from './prisma';
import { AppError } from '../middleware/error.middleware';

export class GeoService {
  /**
   * Calculate geodetic distance in meters using Haversine formula
   */
  public static haversineDistance(lat1: number, lng1: number, lat2: number, lng2: number): number {
    const R = 6371e3; // Earth radius in meters
    const phi1 = lat1 * Math.PI / 180;
    const phi2 = lat2 * Math.PI / 180;
    const deltaPhi = (lat2 - lat1) * Math.PI / 180;
    const deltaLambda = (lng2 - lng1) * Math.PI / 180;

    const a = Math.sin(deltaPhi / 2) * Math.sin(deltaPhi / 2) +
              Math.cos(phi1) * Math.cos(phi2) *
              Math.sin(deltaLambda / 2) * Math.sin(deltaLambda / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

    return R * c; // distance in meters
  }

  /**
   * Register attendance check-in or check-out
   */
  public static async recordAttendance(
    userId: string,
    type: 'CheckIn' | 'CheckOut',
    employeeLat: number,
    employeeLng: number
  ) {
    // 1. Get user details
    const user = await prisma.user.findUnique({
      where: { id: userId },
      include: { branch: true }
    });

    if (!user) {
      throw new AppError(404, 'USER_NOT_FOUND', `الموظف غير موجود في النظام.`);
    }

    const employeeType = user.employeeType || 'Fixed';
    let targetBranchId: string;
    let targetBranchName: string;
    let radiusLimit: number;
    let distanceMeters: number;

    // 2. Validate coordinates based on Employee Type
    if (employeeType === 'Fixed') {
      const branch = user.branch;
      if (!branch) {
        throw new AppError(400, 'NO_BRANCH_ASSIGNED', 'الموظف غير معين على أي فرع حالياً.');
      }
      if (branch.lat === null || branch.lng === null) {
        throw new AppError(400, 'MISSING_BRANCH_COORDINATES', 
          `❌ لم يتم تسجيل الحضور\n` +
          `لم يتم تحديد الموقع الجغرافي لفرعك بعد.\n` +
          `يرجى مراجعة إدارة الموارد البشرية أو مدير الفرع.`
        );
      }

      targetBranchId = branch.id;
      targetBranchName = branch.name;
      radiusLimit = branch.radiusMeters;
      distanceMeters = this.haversineDistance(employeeLat, employeeLng, branch.lat, branch.lng);
    } else {
      // Mobile Employee: check closest branch with coordinates
      const branches = await prisma.branch.findMany({
        where: {
          lat: { not: null },
          lng: { not: null }
        }
      });

      if (branches.length === 0) {
        throw new AppError(400, 'MISSING_BRANCH_COORDINATES', 
          `❌ لم يتم تسجيل الحضور\n` +
          `لم يتم تحديد الموقع الجغرافي لفرعك بعد.\n` +
          `يرجى مراجعة إدارة الموارد البشرية أو مدير الفرع.`
        );
      }

      let closestBranch = branches[0];
      let minDistance = this.haversineDistance(employeeLat, employeeLng, closestBranch.lat!, closestBranch.lng!);

      for (let i = 1; i < branches.length; i++) {
        const b = branches[i];
        const dist = this.haversineDistance(employeeLat, employeeLng, b.lat!, b.lng!);
        if (dist < minDistance) {
          minDistance = dist;
          closestBranch = b;
        }
      }

      targetBranchId = closestBranch.id;
      targetBranchName = closestBranch.name;
      radiusLimit = closestBranch.radiusMeters;
      distanceMeters = minDistance;
    }

    // 3. Strict 200m geofence check
    const isValid = distanceMeters <= 200; // strictly 200m as requested
    if (!isValid) {
      throw new AppError(400, 'OUT_OF_GEOFENCE', `❌ فشل تسجيل الحضور: أنت خارج النطاق الجغرافي المسموح به للفرع (تبعد ${Math.round(distanceMeters)} متر، والحد الأقصى هو 200 متر).`);
    }

    // 4. Match Shift and determine status
    const matched = await this.matchShift(targetBranchId, new Date());
    const shift = matched?.shift;
    const buffer = matched?.bufferMinutes || 30;
    const diff = matched?.diffMinutes || 0;

    let status = '✅ On time';
    if (type === 'CheckIn') {
      if (diff > buffer) {
        status = '⚠️ Late (>30 min)';
      }
    } else {
      if (diff > buffer) {
        status = '⚠️ Early departure (>30 min before end)';
      } else {
        status = '✅ Completed';
      }
    }

    const startOfToday = new Date();
    startOfToday.setHours(0, 0, 0, 0);
    const endOfToday = new Date();
    endOfToday.setHours(23, 59, 59, 999);

    if (shift) {
      let record = await prisma.attendanceRecord.findFirst({
        where: {
          employeeId: userId,
          branchId: targetBranchId,
          shiftId: shift.id,
          createdAt: {
            gte: startOfToday,
            lte: endOfToday
          }
        }
      });

      if (type === 'CheckIn') {
        if (!record) {
          await prisma.attendanceRecord.create({
            data: {
              employeeId: userId,
              branchId: targetBranchId,
              shiftId: shift.id,
              checkIn: new Date(),
              checkInLat: employeeLat,
              checkInLng: employeeLng,
              status,
              notes: 'تسجيل دخول تلقائي'
            }
          });
        } else {
          await prisma.attendanceRecord.update({
            where: { id: record.id },
            data: {
              checkIn: new Date(),
              checkInLat: employeeLat,
              checkInLng: employeeLng,
              status,
              notes: 'تحديث تسجيل دخول تلقائي'
            }
          });
        }
      } else {
        if (record) {
          await prisma.attendanceRecord.update({
            where: { id: record.id },
            data: {
              checkOut: new Date(),
              checkOutLat: employeeLat,
              checkOutLng: employeeLng,
              status: record.status.includes('Late') ? '⚠️ Late & ' + status : status,
              notes: (record.notes || '') + ' | تسجيل خروج تلقائي'
            }
          });
        } else {
          await prisma.attendanceRecord.create({
            data: {
              employeeId: userId,
              branchId: targetBranchId,
              shiftId: shift.id,
              checkOut: new Date(),
              checkOutLat: employeeLat,
              checkOutLng: employeeLng,
              status,
              notes: 'تسجيل خروج بدون دخول مسبق'
            }
          });
        }
      }
    }

    // 5. Save raw Attendance Log (keeps older views / reception stats working)
    const log = await prisma.attendanceLog.create({
      data: {
        userId: user.id,
        branchId: targetBranchId,
        type,
        lat: employeeLat,
        lng: employeeLng,
        distanceMeters,
        isValid,
        rejectionReason: null
      },
      include: {
        user: {
          select: { id: true, name: true, role: true, employeeType: true }
        },
        branch: true
      }
    });

    return {
      log,
      isValid,
      branchName: targetBranchName,
      distanceMeters,
      radiusLimit: 200,
      timestamp: log.timestamp
    };
  }

  /**
   * Shift matching algorithm
   */
  public static async matchShift(branchId: string, timestamp: Date) {
    const shifts = await prisma.shift.findMany({
      where: {
        OR: [
          { branchId },
          { branchId: null }
        ],
        isActive: true
      }
    });

    if (shifts.length === 0) {
      return null;
    }

    const bufferSetting = await prisma.systemSetting.findUnique({
      where: { key: 'attendance_buffer_minutes' }
    });
    const bufferMinutes = bufferSetting ? parseInt(bufferSetting.value, 10) : 30;

    const timeHHMM = timestamp.toLocaleTimeString('en-US', { hour12: false, hour: '2-digit', minute: '2-digit' });
    const [currH, currM] = timeHHMM.split(':').map(Number);
    const currMinutes = currH * 60 + currM;

    let bestShift: any = null;
    let minDiff = Infinity;

    for (const shift of shifts) {
      if (shift.isOpen || !shift.startTime || !shift.endTime) {
        continue;
      }
      const [startH, startM] = shift.startTime.split(':').map(Number);
      const [endH, endM] = shift.endTime.split(':').map(Number);
      const startMinutes = startH * 60 + startM;
      const endMinutes = endH * 60 + endM;

      const checkInDiff = Math.abs(currMinutes - startMinutes);
      const checkOutDiff = Math.abs(currMinutes - endMinutes);

      if (checkInDiff < minDiff) {
        minDiff = checkInDiff;
        bestShift = shift;
      }
      if (checkOutDiff < minDiff) {
        minDiff = checkOutDiff;
        bestShift = shift;
      }
    }

    if (!bestShift) {
      bestShift = shifts.find(s => s.isOpen) || shifts[0];
    }

    return {
      shift: bestShift,
      diffMinutes: minDiff,
      bufferMinutes
    };
  }

  /**
   * Get logs registered today
   */
  public static async getTodayAttendance(branchId?: string) {
    const startOfToday = new Date();
    startOfToday.setHours(0, 0, 0, 0);

    const endOfToday = new Date();
    endOfToday.setHours(23, 59, 59, 999);

    const whereClause: any = {
      timestamp: {
        gte: startOfToday,
        lte: endOfToday
      }
    };

    if (branchId) {
      whereClause.branchId = branchId;
    }

    return await prisma.attendanceLog.findMany({
      where: whereClause,
      include: {
        user: {
          select: { id: true, name: true, role: true, employeeType: true }
        },
        branch: true
      },
      orderBy: { timestamp: 'desc' }
    });
  }

  /**
   * Fetch historical logs for user
   */
  public static async getEmployeeAttendanceHistory(userId: string, days: number = 30) {
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - days);

    return await prisma.attendanceLog.findMany({
      where: {
        userId,
        timestamp: {
          gte: startDate
        }
      },
      include: {
        user: {
          select: { id: true, name: true, role: true, employeeType: true }
        },
        branch: true
      },
      orderBy: { timestamp: 'desc' }
    });
  }

  /**
   * Get attendance record grid for HR
   */
  public static async getAttendanceGrid(branchId: string, dateStr?: string) {
    const targetDate = dateStr ? new Date(dateStr) : new Date();
    const startOfDay = new Date(targetDate);
    startOfDay.setHours(0, 0, 0, 0);
    const endOfDay = new Date(targetDate);
    endOfDay.setHours(23, 59, 59, 999);

    return await prisma.attendanceRecord.findMany({
      where: {
        branchId,
        createdAt: {
          gte: startOfDay,
          lte: endOfDay
        }
      },
      include: {
        employee: {
          select: { id: true, name: true, role: true }
        },
        shift: true
      }
    });
  }

  /**
   * Calculate summary present/absent stats for today
   */
  public static async getAttendanceSummary() {
    const startOfToday = new Date();
    startOfToday.setHours(0, 0, 0, 0);

    const endOfToday = new Date();
    endOfToday.setHours(23, 59, 59, 999);

    // Get active employee users
    const allUsers = await prisma.user.findMany({
      include: { branch: true }
    });

    const todayLogs = await prisma.attendanceLog.findMany({
      where: {
        timestamp: {
          gte: startOfToday,
          lte: endOfToday
        }
      }
    });

    // Users with at least one valid check-in today are present
    const presentUserIds = new Set(
      todayLogs.filter(log => log.type === 'CheckIn' && log.isValid).map(log => log.userId)
    );

    const outOfRangeCount = todayLogs.filter(log => !log.isValid).length;
    const totalEmployees = allUsers.length;
    const presentCount = presentUserIds.size;
    const absentCount = totalEmployees - presentCount;

    // Branch breakdowns
    const branchStatsMap = new Map<string, { branchId: string; branchName: string; present: number; absent: number }>();

    for (const user of allUsers) {
      const bId = user.branchId;
      const bName = user.branch?.name;

      if (!bId || !bName) continue;

      if (!branchStatsMap.has(bId)) {
        branchStatsMap.set(bId, { branchId: bId, branchName: bName, present: 0, absent: 0 });
      }

      const stats = branchStatsMap.get(bId)!;
      if (presentUserIds.has(user.id)) {
        stats.present++;
      } else {
        stats.absent++;
      }
    }

    const branchSummaries = Array.from(branchStatsMap.values());

    return {
      presentCount,
      absentCount,
      outOfRangeCount,
      totalEmployees,
      branchSummaries
    };
  }
}
