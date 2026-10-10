"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.DigestService = void 0;
const prisma_1 = __importDefault(require("./prisma"));
const reports_service_1 = require("./reports.service");
class DigestService {
    static async generateDailyDigest(branchId, date) {
        const branch = await prisma_1.default.branch.findUnique({ where: { id: branchId } });
        if (!branch) {
            throw new Error(`Branch not found: ${branchId}`);
        }
        const branchNameAr = branch.name === 'Sail Road Branch' ? 'فرع طريق السيل' :
            branch.name === 'Beachside Resort Branch' ? 'فرع منتجع الشاطئ' :
                branch.name;
        const financial = await reports_service_1.ReportsService.getDailyFinancialSummary(branchId, date);
        const maintenance = await reports_service_1.ReportsService.getMaintenanceReport(branchId, date, date);
        const inventory = await reports_service_1.ReportsService.getInventoryReport(branchId);
        const damage = await reports_service_1.ReportsService.getDamageReport(branchId, date, date);
        const attendance = await reports_service_1.ReportsService.getAttendanceSummary(branchId, date, date);
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
    static async sendDailyDigestForBranch(branchId) {
        const dateStr = new Date().toISOString().split('T')[0];
        const digestMsg = await this.generateDailyDigest(branchId, dateStr);
        // Get Branch Manager and Admin users
        const branchManagers = await prisma_1.default.user.findMany({
            where: { role: 'BranchManager', branchId }
        });
        const admins = await prisma_1.default.user.findMany({
            where: { role: 'Admin' }
        });
        const recipients = new Set();
        branchManagers.forEach(u => recipients.add(u.phoneNumber));
        admins.forEach(u => recipients.add(u.phoneNumber));
        const { WhatsAppService } = require('./whatsapp.service');
        for (const phone of recipients) {
            await WhatsAppService.mockSendWhatsAppMessage(phone, digestMsg);
        }
    }
    static async sendDailyDigestToAllBranches() {
        const branches = await prisma_1.default.branch.findMany();
        for (const b of branches) {
            await this.sendDailyDigestForBranch(b.id);
        }
    }
}
exports.DigestService = DigestService;
