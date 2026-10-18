import prisma from './prisma';
import { AppError } from '../middleware/error.middleware';

export interface ScheduleSlotInput {
  branchId: string;
  employeeId: string;
  date: string; // YYYY-MM-DD
  shiftType: 'Morning' | 'Evening' | 'Night' | 'Off';
  shiftName?: string;
  status?: 'Scheduled' | 'Off' | 'Leave' | 'Covered';
  isCoverage?: boolean;
  coveredForId?: string | null;
  notes?: string | null;
}

export class ReceptionScheduleService {
  /**
   * Shift metadata presets
   */
  public static readonly SHIFT_PRESETS: Record<string, { labelAr: string; time: string; badgeColor: string }> = {
    Morning: { labelAr: 'الوردية الصباحية', time: '07:00 - 15:00', badgeColor: '#10b981' },
    Evening: { labelAr: 'الوردية المسائية', time: '15:00 - 23:00', badgeColor: '#f59e0b' },
    Night: { labelAr: 'الوردية الليلية', time: '23:00 - 07:00', badgeColor: '#3b82f6' },
    Off: { labelAr: 'راحة أسبوعية (أوف)', time: '-', badgeColor: '#9ca3af' },
  };

  /**
   * Get receptionists for a branch
   */
  public static async getReceptionists(branchId?: string) {
    const where: any = {
      role: 'Receptionist',
      isActive: true,
    };
    if (branchId && branchId !== 'ALL') {
      where.branchId = branchId;
    }
    return await prisma.user.findMany({
      where,
      select: {
        id: true,
        name: true,
        phoneNumber: true,
        role: true,
        branchId: true,
        branch: { select: { id: true, name: true } },
      },
      orderBy: { name: 'asc' },
    });
  }

  /**
   * Get schedule grid with leaves and coverages
   */
  public static async getSchedule(branchId: string, startDateStr?: string, endDateStr?: string) {
    // Default to current week (7 days starting from previous Saturday or specified start)
    let start: Date;
    if (startDateStr) {
      start = new Date(startDateStr);
    } else {
      const now = new Date();
      const day = now.getDay(); // 0 is Sunday, 6 is Saturday
      // Align to Saturday
      const diffToSaturday = (day + 1) % 7;
      start = new Date(now);
      start.setDate(now.getDate() - diffToSaturday);
    }
    start.setHours(0, 0, 0, 0);

    let end: Date;
    if (endDateStr) {
      end = new Date(endDateStr);
    } else {
      end = new Date(start);
      end.setDate(start.getDate() + 6);
    }
    end.setHours(23, 59, 59, 999);

    const branchWhere = branchId && branchId !== 'ALL' ? { branchId } : {};

    // 1. Fetch receptionists
    const receptionists = await prisma.user.findMany({
      where: {
        role: 'Receptionist',
        isActive: true,
        ...branchWhere,
      },
      select: {
        id: true,
        name: true,
        phoneNumber: true,
        branchId: true,
        branch: { select: { id: true, name: true } },
      },
      orderBy: { name: 'asc' },
    });

    // 2. Fetch existing schedules
    const schedules = await prisma.receptionSchedule.findMany({
      where: {
        ...branchWhere,
        date: {
          gte: start,
          lte: end,
        },
      },
      include: {
        employee: { select: { id: true, name: true, phoneNumber: true } },
        coveredFor: { select: { id: true, name: true } },
        branch: { select: { id: true, name: true } },
      },
      orderBy: { date: 'asc' },
    });

    // 3. Fetch approved leaves for these receptionists during this range
    const userIds = receptionists.map((r) => r.id);
    const approvedLeaves = await prisma.leaveRequest.findMany({
      where: {
        userId: { in: userIds },
        status: 'Approved',
        startDate: { lte: end },
        endDate: { gte: start },
      },
      include: {
        user: { select: { id: true, name: true } },
      },
    });

    return {
      startDate: start.toISOString().split('T')[0],
      endDate: end.toISOString().split('T')[0],
      receptionists,
      schedules,
      approvedLeaves,
      shiftPresets: this.SHIFT_PRESETS,
    };
  }

  /**
   * Upsert a schedule slot
   */
  public static async upsertSchedule(input: ScheduleSlotInput) {
    const targetDate = new Date(input.date);
    targetDate.setHours(0, 0, 0, 0);

    const shiftPreset = this.SHIFT_PRESETS[input.shiftType];
    const shiftName = input.shiftName || (shiftPreset ? `${shiftPreset.labelAr} (${shiftPreset.time})` : input.shiftType);

    let status = input.status || (input.shiftType === 'Off' ? 'Off' : 'Scheduled');
    if (input.isCoverage) {
      status = 'Covered';
    }

    return await prisma.receptionSchedule.upsert({
      where: {
        branchId_employeeId_date: {
          branchId: input.branchId,
          employeeId: input.employeeId,
          date: targetDate,
        },
      },
      update: {
        shiftType: input.shiftType,
        shiftName,
        status,
        isCoverage: !!input.isCoverage,
        coveredForId: input.coveredForId || null,
        notes: input.notes || null,
      },
      create: {
        branchId: input.branchId,
        employeeId: input.employeeId,
        date: targetDate,
        shiftType: input.shiftType,
        shiftName,
        status,
        isCoverage: !!input.isCoverage,
        coveredForId: input.coveredForId || null,
        notes: input.notes || null,
      },
      include: {
        employee: { select: { id: true, name: true } },
        coveredFor: { select: { id: true, name: true } },
      },
    });
  }

  /**
   * Assign a coverage shift
   */
  public static async assignCoverage(params: {
    branchId: string;
    date: string;
    shiftType: 'Morning' | 'Evening' | 'Night';
    coveringEmployeeId: string;
    absentEmployeeId: string;
    notes?: string;
  }) {
    const targetDate = new Date(params.date);
    targetDate.setHours(0, 0, 0, 0);

    const coveringUser = await prisma.user.findUnique({ where: { id: params.coveringEmployeeId } });
    const absentUser = await prisma.user.findUnique({ where: { id: params.absentEmployeeId } });

    if (!coveringUser || !absentUser) {
      throw new AppError(404, 'USER_NOT_FOUND', 'بيانات الموظف غير صحيحة.');
    }

    const shiftPreset = this.SHIFT_PRESETS[params.shiftType];
    const shiftName = shiftPreset ? `${shiftPreset.labelAr} (${shiftPreset.time})` : params.shiftType;
    const noteText = params.notes || `تغطية وردية للزميل/ة ${absentUser.name}`;

    return await prisma.receptionSchedule.upsert({
      where: {
        branchId_employeeId_date: {
          branchId: params.branchId,
          employeeId: params.coveringEmployeeId,
          date: targetDate,
        },
      },
      update: {
        shiftType: params.shiftType,
        shiftName,
        status: 'Covered',
        isCoverage: true,
        coveredForId: params.absentEmployeeId,
        notes: noteText,
      },
      create: {
        branchId: params.branchId,
        employeeId: params.coveringEmployeeId,
        date: targetDate,
        shiftType: params.shiftType,
        shiftName,
        status: 'Covered',
        isCoverage: true,
        coveredForId: params.absentEmployeeId,
        notes: noteText,
      },
      include: {
        employee: { select: { id: true, name: true } },
        coveredFor: { select: { id: true, name: true } },
      },
    });
  }

  /**
   * Auto-generate a balanced 7-day schedule rotating 3 receptionists
   * across Morning, Evening, Night with weekly rest days.
   */
  public static async autoGenerateWeeklyRoster(branchId: string, startDateStr: string) {
    const start = new Date(startDateStr);
    start.setHours(0, 0, 0, 0);

    const receptionists = await prisma.user.findMany({
      where: {
        role: 'Receptionist',
        isActive: true,
        branchId,
      },
      orderBy: { name: 'asc' },
    });

    if (receptionists.length === 0) {
      throw new AppError(400, 'NO_RECEPTIONISTS', 'لا يوجد موظفو استقبال نشطون في هذا الفرع لإنشاء الجدول.');
    }

    const shiftsOrder: Array<'Morning' | 'Evening' | 'Night'> = ['Morning', 'Evening', 'Night'];
    const createdSlots = [];

    // For 7 days
    for (let dayOffset = 0; dayOffset < 7; dayOffset++) {
      const currentDate = new Date(start);
      currentDate.setDate(start.getDate() + dayOffset);

      // Check approved leaves for that day
      for (let rIndex = 0; rIndex < receptionists.length; rIndex++) {
        const emp = receptionists[rIndex];

        const hasLeave = await prisma.leaveRequest.findFirst({
          where: {
            userId: emp.id,
            status: 'Approved',
            startDate: { lte: currentDate },
            endDate: { gte: currentDate },
          },
        });

        if (hasLeave) {
          const slot = await this.upsertSchedule({
            branchId,
            employeeId: emp.id,
            date: currentDate.toISOString().split('T')[0],
            shiftType: 'Off',
            shiftName: 'إجازة معتمدة 🏖️',
            status: 'Leave',
            notes: `إجازة ${hasLeave.leaveType === 'Annual' ? 'سنوية' : 'مرضية'} معتمدة`,
          });
          createdSlots.push(slot);
          continue;
        }

        // Rotate shifts across 3 receptionists:
        // Day off rotation: e.g. emp 0 off on Friday (day 6), emp 1 off on Thursday (day 5), emp 2 off on Saturday (day 0)
        const offDayForEmp = (rIndex * 2 + 5) % 7;
        const isOffDay = (dayOffset % 7) === offDayForEmp;

        if (isOffDay && receptionists.length > 2) {
          const slot = await this.upsertSchedule({
            branchId,
            employeeId: emp.id,
            date: currentDate.toISOString().split('T')[0],
            shiftType: 'Off',
            shiftName: 'راحة أسبوعية (أوف) ⚪',
            status: 'Off',
          });
          createdSlots.push(slot);
        } else {
          const shiftIdx = (rIndex + dayOffset) % 3;
          const shiftType = shiftsOrder[shiftIdx];
          const preset = this.SHIFT_PRESETS[shiftType];
          const slot = await this.upsertSchedule({
            branchId,
            employeeId: emp.id,
            date: currentDate.toISOString().split('T')[0],
            shiftType,
            shiftName: `${preset.labelAr} (${preset.time})`,
            status: 'Scheduled',
          });
          createdSlots.push(slot);
        }
      }
    }

    return {
      success: true,
      count: createdSlots.length,
      startDate: start.toISOString().split('T')[0],
    };
  }

  /**
   * Get employee's schedule (today and next 7 days)
   */
  public static async getEmployeeSchedule(userId: string) {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const nextWeek = new Date(today);
    nextWeek.setDate(today.getDate() + 7);
    nextWeek.setHours(23, 59, 59, 999);

    const user = await prisma.user.findUnique({
      where: { id: userId },
      include: { branch: true },
    });

    if (!user) return null;

    const schedules = await prisma.receptionSchedule.findMany({
      where: {
        employeeId: userId,
        date: {
          gte: today,
          lte: nextWeek,
        },
      },
      include: {
        coveredFor: { select: { id: true, name: true } },
      },
      orderBy: { date: 'asc' },
    });

    const approvedLeaves = await prisma.leaveRequest.findMany({
      where: {
        userId,
        status: 'Approved',
        startDate: { lte: nextWeek },
        endDate: { gte: today },
      },
    });

    return {
      user,
      schedules,
      approvedLeaves,
    };
  }

  /**
   * Format schedule for WhatsApp bot message
   */
  public static async formatScheduleForWhatsApp(userId: string): Promise<string> {
    const data = await this.getEmployeeSchedule(userId);
    if (!data || !data.user) {
      return '❌ لم يتم العثور على بيانات الموظف.';
    }

    const { user, schedules, approvedLeaves } = data;
    const branchName = user.branch ? user.branch.name : 'الفرع الرئيسي';
    const branchNameAr = branchName === 'Sail Road Branch' ? 'فرع طريق السيل' :
                         branchName === 'Beachside Resort Branch' ? 'فرع منتجع الشاطئ' : branchName;

    const daysAr = ['الأحد', 'الإثنين', 'الثلاثاء', 'الأربعاء', 'الخميس', 'الجمعة', 'السبت'];

    let message = `📋 *جدول مناوبات الاستقبال - ${user.name}*\n` +
                  `🏨 الفرع: ${branchNameAr}\n` +
                  `━━━━━━━━━━━━━━━━━━━\n\n`;

    if (schedules.length === 0 && approvedLeaves.length === 0) {
      message += `لم يتم إدراج جدول مناوباتك لهذا الأسبوع بعد.\nيرجى مراجعة إدارة الفرع لتحديد الورديات.`;
      return message;
    }

    schedules.forEach((slot) => {
      const slotDate = new Date(slot.date);
      const dayName = daysAr[slotDate.getDay()];
      const dateStr = slotDate.toLocaleDateString('ar-EG', { month: 'numeric', day: 'numeric' });

      let icon = '🟢';
      let statusStr = slot.shiftName || slot.shiftType;

      if (slot.status === 'Off' || slot.shiftType === 'Off') {
        icon = '⚪';
        statusStr = 'راحة أسبوعية (أوف)';
      } else if (slot.status === 'Leave') {
        icon = '🏖️';
        statusStr = 'إجازة معتمدة';
      } else if (slot.isCoverage) {
        icon = '🟣';
        statusStr = `تغطية وردية (بديل عن ${slot.coveredFor?.name || 'زميل'})`;
      } else if (slot.shiftType === 'Morning') {
        icon = '🌅';
      } else if (slot.shiftType === 'Evening') {
        icon = '🌇';
      } else if (slot.shiftType === 'Night') {
        icon = '🌙';
      }

      message += `${icon} *${dayName}* (${dateStr}):\n   └ ${statusStr}\n`;
      if (slot.notes) {
        message += `   └ ملاحظة: ${slot.notes}\n`;
      }
      message += '\n';
    });

    message += `━━━━━━━━━━━━━━━━━━━\n` +
               `💡 للتسجيل في بداية الوردية، أرسل كلمة *حضور*.\n` +
               `💡 للتسجيل عند نهاية الوردية، أرسل كلمة *انصراف*.`;

    return message;
  }
}
