import prisma from './prisma';
import { ReportsService } from './reports.service';

export class DigestService {
  public static async generateDailyDigest(branchId: string, date: string): Promise<string> {
    const branch = await prisma.branch.findUnique({ where: { id: branchId } });
    if (!branch) {
      throw new Error(`Branch not found: ${branchId}`);
    }

    const branchNameAr = branch.name === 'Sail Road Branch' ? 'فرع طريق السيل' :
                         branch.name === 'Beachside Resort Branch' ? 'فرع منتجع الشاطئ' :
                         branch.name;

    const financial = await ReportsService.getDailyFinancialSummary(branchId, date);
    const maintenance = await ReportsService.getMaintenanceReport(branchId, date, date);
    const inventory = await ReportsService.getInventoryReport(branchId);
    const damage = await ReportsService.getDamageReport(branchId, date, date);
    const attendance = await ReportsService.getAttendanceSummary(branchId, date, date);

    // Format Arabic WhatsApp message
    return `📊 *ملخص يوم [${date}] — [${branchNameAr}]*
━━━━━━━━━━━━━━━━━━━━━
💰 *المالية*
  إيرادات الغرف: ${financial.totalRoomRevenue.toFixed(0)} ريال
  إيرادات الخدمات: ${financial.totalServiceRevenue.toFixed(0)} ريال
  تعويضات التلفيات: ${financial.totalDamageCollected.toFixed(0)} ريال
  📈 *الإجمالي: ${financial.totalRevenue.toFixed(0)} ريال*
  💸 المصروفات: ${financial.totalExpenses.toFixed(0)} ريال
  🏦 *صافي الربح: ${financial.netProfit.toFixed(0)} ريال*
━━━━━━━━━━━━━━━━━━━━━
🛠️ *الصيانة*
  طلبات جديدة: ${maintenance.open}
  جارية: ${maintenance.inProgress}
  مكتملة اليوم: ${maintenance.completed + maintenance.approved}
━━━━━━━━━━━━━━━━━━━━━
📦 *المخزون*
  أصناف منخفضة: ${inventory.lowStockCount + inventory.criticalStockCount} ⚠️
  طلبات صرف معلقة: ${inventory.pendingRequests}
━━━━━━━━━━━━━━━━━━━━━
💥 *التلفيات*
  بلاغات اليوم: ${damage.totalReports}
  محصّل: ${damage.collectedValue.toFixed(0)} ريال ✅
━━━━━━━━━━━━━━━━━━━━━
👥 *الحضور*
  حاضرون: ${attendance.presentDays}/${attendance.totalEmployees}
  متأخرون: ${attendance.lateDays}
  غائبون: ${attendance.absentDays}`;
  }

  public static async sendDailyDigestForBranch(branchId: string): Promise<void> {
    const dateStr = new Date().toISOString().split('T')[0];
    const digestMsg = await this.generateDailyDigest(branchId, dateStr);

    // Get Branch Manager and Admin users
    const branchManagers = await prisma.user.findMany({
      where: { role: 'BranchManager', branchId }
    });
    const admins = await prisma.user.findMany({
      where: { role: 'Admin' }
    });

    const recipients = new Set<string>();
    branchManagers.forEach(u => recipients.add(u.phoneNumber));
    admins.forEach(u => recipients.add(u.phoneNumber));

    const { WhatsAppService } = require('./whatsapp.service');
    for (const phone of recipients) {
      await WhatsAppService.mockSendWhatsAppMessage(phone, digestMsg);
    }
  }

  public static async sendDailyDigestToAllBranches(): Promise<void> {
    const branches = await prisma.branch.findMany();
    for (const b of branches) {
      await this.sendDailyDigestForBranch(b.id);
    }
  }
}
