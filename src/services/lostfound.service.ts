import prisma from './prisma';
import { WhatsAppService } from './whatsapp.service';

export class LostFoundService {
  // -------------------------------------------------------------
  // Ticket Generators
  // -------------------------------------------------------------
  public static async generateLFTicket(): Promise<string> {
    const lastItem = await prisma.lostFoundItem.findFirst({
      orderBy: { ticketNumber: 'desc' }
    });
    
    let nextNum = 1;
    if (lastItem && lastItem.ticketNumber) {
      const parts = lastItem.ticketNumber.split('-');
      if (parts.length === 3) {
        const parsed = parseInt(parts[2], 10);
        if (!isNaN(parsed)) {
          nextNum = parsed + 1;
        }
      }
    }
    
    return `LF-2026-${String(nextNum).padStart(4, '0')}`;
  }

  public static async generateDMGTicket(): Promise<string> {
    const lastReport = await prisma.damageReport.findFirst({
      orderBy: { ticketNumber: 'desc' }
    });
    
    let nextNum = 1;
    if (lastReport && lastReport.ticketNumber) {
      const parts = lastReport.ticketNumber.split('-');
      if (parts.length === 3) {
        const parsed = parseInt(parts[2], 10);
        if (!isNaN(parsed)) {
          nextNum = parsed + 1;
        }
      }
    }
    
    return `DMG-2026-${String(nextNum).padStart(4, '0')}`;
  }

  // -------------------------------------------------------------
  // Lost & Found Service Methods
  // -------------------------------------------------------------
  public static async createLostItem(data: {
    reportedBy: string;
    branchId: string;
    location: string;
    description: string;
    photoUrl?: string | null;
    guestName?: string | null;
    guestPhone?: string | null;
    reservationRef?: string | null;
    notes?: string | null;
  }) {
    const ticketNumber = await this.generateLFTicket();
    const item = await prisma.lostFoundItem.create({
      data: {
        ticketNumber,
        reportedBy: data.reportedBy,
        branchId: data.branchId,
        location: data.location,
        description: data.description,
        photoUrl: data.photoUrl || null,
        guestName: data.guestName || null,
        guestPhone: data.guestPhone || null,
        reservationRef: data.reservationRef || null,
        notes: data.notes || null,
        status: 'Stored',
      },
      include: {
        reporter: true,
        branch: true
      }
    });

    // Notify all Receptionists in that branch
    const receptionists = await prisma.user.findMany({
      where: {
        branchId: item.branchId,
        role: 'Receptionist'
      }
    });

    const msg = `🛎️ *غرض مفقود جديد #${item.ticketNumber}*\n\n` +
      `📍 *الموقع*: ${item.location}\n` +
      `📝 *الوصف*: ${item.description}\n` +
      `👤 *أبلغه*: ${item.reporter.name}\n` +
      `🕐 *الوقت*: ${new Date().toLocaleTimeString('ar-EG', { hour: '2-digit', minute: '2-digit' })}\n\n` +
      `[ 📞 تواصلت مع العميل ] (زر: lf_contact_btn_${item.id})`;

    for (const rec of receptionists) {
      WhatsAppService.mockSendWhatsAppMessage(rec.phoneNumber, msg);
    }

    return item;
  }

  public static async updateGuestContact(id: string, guestName?: string | null, guestPhone?: string | null) {
    const updateData: any = { status: 'ContactedGuest' };
    if (guestName) updateData.guestName = guestName;
    if (guestPhone) updateData.guestPhone = guestPhone;

    return await prisma.lostFoundItem.update({
      where: { id },
      data: updateData,
      include: { reporter: true, branch: true }
    });
  }

  public static async claimItem(id: string, data: {
    claimedBy: string;
    claimedIdType: string;
    claimedIdNumber: string;
    handedOverBy: string;
  }) {
    return await prisma.lostFoundItem.update({
      where: { id },
      data: {
        status: 'Claimed',
        claimedBy: data.claimedBy,
        claimedIdType: data.claimedIdType as any,
        claimedIdNumber: data.claimedIdNumber,
        handedOverBy: data.handedOverBy,
        claimedAt: new Date()
      },
      include: { reporter: true, branch: true }
    });
  }

  public static async archiveItem(id: string) {
    return await prisma.lostFoundItem.update({
      where: { id },
      data: {
        status: 'Archived',
        archivedAt: new Date()
      },
      include: { reporter: true, branch: true }
    });
  }

  public static async autoArchiveOldItems() {
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

    const itemsToArchive = await prisma.lostFoundItem.findMany({
      where: {
        status: { in: ['Stored', 'ContactedGuest'] },
        createdAt: { lt: thirtyDaysAgo }
      }
    });

    const archivedItems = [];
    for (const item of itemsToArchive) {
      const updated = await prisma.lostFoundItem.update({
        where: { id: item.id },
        data: {
          status: 'Archived',
          archivedAt: new Date()
        }
      });
      archivedItems.push(updated);
    }
    return archivedItems;
  }

  public static async getLostItems(filters?: {
    status?: string;
    branchId?: string;
    dateFrom?: string;
    dateTo?: string;
  }) {
    const where: any = {};
    if (filters?.status) where.status = filters.status;
    if (filters?.branchId) where.branchId = filters.branchId;
    if (filters?.dateFrom || filters?.dateTo) {
      where.createdAt = {};
      if (filters.dateFrom) where.createdAt.gte = new Date(filters.dateFrom);
      if (filters.dateTo) where.createdAt.lte = new Date(filters.dateTo);
    }

    return await prisma.lostFoundItem.findMany({
      where,
      include: { reporter: true, branch: true },
      orderBy: { createdAt: 'desc' }
    });
  }

  public static async getLostItemById(id: string) {
    return await prisma.lostFoundItem.findUnique({
      where: { id },
      include: { reporter: true, branch: true }
    });
  }

  // -------------------------------------------------------------
  // Damage Report Service Methods
  // -------------------------------------------------------------
  public static async createDamageReport(data: {
    reportedBy: string;
    branchId: string;
    roomNumber: string;
    damageType: string;
    description: string;
    photoUrls?: string;
    reportedDuring?: string;
    reservationRef?: string | null;
    guestName?: string | null;
    guestPhone?: string | null;
    estimatedValue?: number | null;
  }) {
    const ticketNumber = await this.generateDMGTicket();
    const report = (await prisma.damageReport.create({
      data: {
        ticketNumber,
        reportedBy: data.reportedBy,
        branchId: data.branchId,
        roomNumber: data.roomNumber,
        damageType: data.damageType as any,
        description: data.description,
        photoUrls: data.photoUrls || '[]',
        reportedDuring: (data.reportedDuring || 'Stay') as any,
        reservationRef: data.reservationRef || null,
        guestName: data.guestName || null,
        guestPhone: data.guestPhone || null,
        estimatedValue: data.estimatedValue || null,
        status: 'New'
      },
      include: {
        reporter: true,
        branch: true
      }
    })) as any;

    // Notify BranchManager + BranchSupervisors of branch
    const managersAndSupervisors = await prisma.user.findMany({
      where: {
        branchId: report.branchId,
        role: { in: ['BranchManager', 'BranchSupervisor'] as any }
      }
    });

    const typeAr = this.translateDamageType(report.damageType);
    const msg = `💥 *بلاغ تلفيات جديد #${report.ticketNumber}*\n\n` +
      `🏨 *الفرع*: ${report.branch.name === 'Sail Road Branch' ? 'فرع طريق السيل' : report.branch.name}\n` +
      `🛏️ *الغرفة*: ${report.roomNumber}\n` +
      `🔧 *النوع*: ${typeAr}\n` +
      `📝 *الوصف*: ${report.description}\n` +
      `👤 *العميل*: ${report.guestName || 'غير معروف'}\n` +
      `📋 *الحجز*: ${report.reservationRef || 'تخطي'}\n` +
      `👤 *أبلغه*: ${report.reporter.name}\n\n` +
      `[ 🔍 مراجعة التلف وتحديد التعويض ] (زر: dmg_review_btn_${report.id})`;

    for (const user of managersAndSupervisors) {
      WhatsAppService.mockSendWhatsAppMessage(user.phoneNumber, msg);
    }

    return report;
  }

  public static async reviewDamage(id: string, reviewerId: string, finalValue: number, reviewNote?: string | null) {
    const report = await prisma.damageReport.update({
      where: { id },
      data: {
        status: 'PendingGuestDecision',
        reviewedBy: reviewerId,
        finalValue,
        reviewNote: reviewNote || null,
        reviewedAt: new Date()
      },
      include: { reporter: true, branch: true, reviewer: true }
    });

    // Notify Receptionist in branch
    const receptionists = await prisma.user.findMany({
      where: {
        branchId: report.branchId,
        role: 'Receptionist'
      }
    });

    const msg = `💰 *تم تحديد تعويض التلف #${report.ticketNumber}*\n\n` +
      `🛏️ *الغرفة*: ${report.roomNumber}\n` +
      `💵 *القيمة المقترحة*: ${report.finalValue} ريال\n` +
      `📝 *ملاحظة المراجع*: ${report.reviewNote || 'لا يوجد'}\n\n` +
      `يرجى إبلاغ العميل والحصول على موافقته.\n\n` +
      `[ ✅ العميل وافق وسيدفع ] (زر: dmg_accept_btn_${report.id})\n` +
      `[ ❌ العميل رفض الدفع ] (زر: dmg_refuse_btn_${report.id})\n` +
      `[ 🤝 إسقاط المطالبة ] (زر: dmg_waive_btn_${report.id})`;

    for (const rec of receptionists) {
      WhatsAppService.mockSendWhatsAppMessage(rec.phoneNumber, msg);
    }

    return report;
  }

  public static async collectPayment(id: string, data: {
    paymentMethod: string;
    paymentRef?: string | null;
    collectedBy: string;
    paymentDueDate?: Date | string | null;
  }) {
    const collectedAt = new Date();
    const dueDate = data.paymentDueDate ? new Date(data.paymentDueDate) : null;

    return await prisma.damageReport.update({
      where: { id },
      data: {
        status: 'Paid',
        paymentMethod: data.paymentMethod as any,
        paymentRef: data.paymentRef || null,
        collectedBy: data.collectedBy,
        paymentDueDate: dueDate,
        collectedAt
      },
      include: { reporter: true, branch: true }
    });
  }

  public static async markRefused(id: string, refusalReason: string) {
    const report = await prisma.damageReport.update({
      where: { id },
      data: {
        status: 'Refused',
        refusalReason
      },
      include: { reporter: true, branch: true }
    });

    // Notify BranchManager
    const managers = await prisma.user.findMany({
      where: {
        branchId: report.branchId,
        role: 'BranchManager'
      }
    });

    const msg = `⚠️ *رفض تعويض تلفيات #${report.ticketNumber}*\n\n` +
      `🛏️ *الغرفة*: ${report.roomNumber}\n` +
      `👤 *العميل*: ${report.guestName || 'غير معروف'}\n` +
      `📝 *سبب الرفض*: ${refusalReason}`;

    for (const mgr of managers) {
      WhatsAppService.mockSendWhatsAppMessage(mgr.phoneNumber, msg);
    }

    return report;
  }

  public static async waiveDamage(id: string, waivedBy: string, waiverReason: string) {
    return await prisma.damageReport.update({
      where: { id },
      data: {
        status: 'WaivedByManagement',
        waivedBy,
        waiverReason,
        waivedAt: new Date()
      },
      include: { reporter: true, branch: true }
    });
  }

  public static async getDamageReports(filters?: {
    status?: string;
    branchId?: string;
    reservationRef?: string;
    dateFrom?: string;
    dateTo?: string;
  }) {
    const where: any = {};
    if (filters?.status) where.status = filters.status;
    if (filters?.branchId) where.branchId = filters.branchId;
    if (filters?.reservationRef) where.reservationRef = filters.reservationRef;
    if (filters?.dateFrom || filters?.dateTo) {
      where.createdAt = {};
      if (filters.dateFrom) where.createdAt.gte = new Date(filters.dateFrom);
      if (filters.dateTo) where.createdAt.lte = new Date(filters.dateTo);
    }

    return await prisma.damageReport.findMany({
      where,
      include: { reporter: true, branch: true, reviewer: true },
      orderBy: { createdAt: 'desc' }
    });
  }

  public static async getDamageById(id: string) {
    return await prisma.damageReport.findUnique({
      where: { id },
      include: { reporter: true, branch: true, reviewer: true }
    });
  }

  public static async getDamageStats(branchId?: string) {
    const where: any = {};
    if (branchId) where.branchId = branchId;

    const reports = await prisma.damageReport.findMany({ where });

    const total = reports.length;
    const paid = reports.filter(r => r.status === 'Paid').length;
    const refused = reports.filter(r => r.status === 'Refused').length;
    const waived = reports.filter(r => r.status === 'WaivedByManagement').length;
    const pendingReview = reports.filter(r => r.status === 'New' || r.status === 'UnderReview').length;

    const totalCollected = reports
      .filter(r => r.status === 'Paid')
      .reduce((sum, r) => sum + (r.finalValue || 0), 0);

    const totalLost = reports
      .filter(r => r.status === 'Refused')
      .reduce((sum, r) => sum + (r.finalValue || 0), 0);

    return {
      total,
      paid,
      refused,
      waived,
      pendingReview,
      totalCollected,
      totalLost
    };
  }

  // Helper translations
  private static translateDamageType(type: string): string {
    switch (type) {
      case 'Furniture': return 'أثاث 🪑';
      case 'Electronics': return 'أجهزة إلكترونية 📺';
      case 'Fixture': return 'تجهيزات ثابتة 🚿';
      case 'Linen': return 'مفروشات وأغطية 🛏️';
      case 'Door': return 'أبواب ونوافذ 🚪';
      case 'Window': return 'أبواب ونوافذ 🚪';
      case 'Other': return 'أخرى 🔧';
      default: return type;
    }
  }
}
