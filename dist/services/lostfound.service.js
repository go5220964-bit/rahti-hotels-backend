"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.LostFoundService = void 0;
const prisma_1 = __importDefault(require("./prisma"));
const whatsapp_service_1 = require("./whatsapp.service");
class LostFoundService {
    // -------------------------------------------------------------
    // Ticket Generators
    // -------------------------------------------------------------
    static async generateLFTicket() {
        const lastItem = await prisma_1.default.lostFoundItem.findFirst({
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
    static async generateDMGTicket() {
        const lastReport = await prisma_1.default.damageReport.findFirst({
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
    static async createLostItem(data) {
        const ticketNumber = await this.generateLFTicket();
        const item = await prisma_1.default.lostFoundItem.create({
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
        const receptionists = await prisma_1.default.user.findMany({
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
            whatsapp_service_1.WhatsAppService.mockSendWhatsAppMessage(rec.phoneNumber, msg);
        }
        return item;
    }
    static async updateGuestContact(id, guestName, guestPhone) {
        const updateData = { status: 'ContactedGuest' };
        if (guestName)
            updateData.guestName = guestName;
        if (guestPhone)
            updateData.guestPhone = guestPhone;
        return await prisma_1.default.lostFoundItem.update({
            where: { id },
            data: updateData,
            include: { reporter: true, branch: true }
        });
    }
    static async claimItem(id, data) {
        return await prisma_1.default.lostFoundItem.update({
            where: { id },
            data: {
                status: 'Claimed',
                claimedBy: data.claimedBy,
                claimedIdType: data.claimedIdType,
                claimedIdNumber: data.claimedIdNumber,
                handedOverBy: data.handedOverBy,
                claimedAt: new Date()
            },
            include: { reporter: true, branch: true }
        });
    }
    static async archiveItem(id) {
        return await prisma_1.default.lostFoundItem.update({
            where: { id },
            data: {
                status: 'Archived',
                archivedAt: new Date()
            },
            include: { reporter: true, branch: true }
        });
    }
    static async autoArchiveOldItems() {
        const thirtyDaysAgo = new Date();
        thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
        const itemsToArchive = await prisma_1.default.lostFoundItem.findMany({
            where: {
                status: { in: ['Stored', 'ContactedGuest'] },
                createdAt: { lt: thirtyDaysAgo }
            }
        });
        const archivedItems = [];
        for (const item of itemsToArchive) {
            const updated = await prisma_1.default.lostFoundItem.update({
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
    static async getLostItems(filters) {
        const where = {};
        if (filters?.status)
            where.status = filters.status;
        if (filters?.branchId)
            where.branchId = filters.branchId;
        if (filters?.dateFrom || filters?.dateTo) {
            where.createdAt = {};
            if (filters.dateFrom)
                where.createdAt.gte = new Date(filters.dateFrom);
            if (filters.dateTo)
                where.createdAt.lte = new Date(filters.dateTo);
        }
        return await prisma_1.default.lostFoundItem.findMany({
            where,
            include: { reporter: true, branch: true },
            orderBy: { createdAt: 'desc' }
        });
    }
    static async getLostItemById(id) {
        return await prisma_1.default.lostFoundItem.findUnique({
            where: { id },
            include: { reporter: true, branch: true }
        });
    }
    // -------------------------------------------------------------
    // Damage Report Service Methods
    // -------------------------------------------------------------
    static async createDamageReport(data) {
        const ticketNumber = await this.generateDMGTicket();
        const report = (await prisma_1.default.damageReport.create({
            data: {
                ticketNumber,
                reportedBy: data.reportedBy,
                branchId: data.branchId,
                roomNumber: data.roomNumber,
                damageType: data.damageType,
                description: data.description,
                photoUrls: data.photoUrls || '[]',
                reportedDuring: (data.reportedDuring || 'Stay'),
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
        }));
        // Notify BranchManager + BranchSupervisors of branch
        const managersAndSupervisors = await prisma_1.default.user.findMany({
            where: {
                branchId: report.branchId,
                role: { in: ['BranchManager', 'BranchSupervisor', 'HousekeepingSupervisor', 'Admin'] }
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
            whatsapp_service_1.WhatsAppService.mockSendWhatsAppMessage(user.phoneNumber, msg);
        }
        return report;
    }
    static async reviewDamage(id, reviewerId, finalValue, reviewNote) {
        const report = await prisma_1.default.damageReport.update({
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
        const receptionists = await prisma_1.default.user.findMany({
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
            whatsapp_service_1.WhatsAppService.mockSendWhatsAppMessage(rec.phoneNumber, msg);
        }
        return report;
    }
    static async collectPayment(id, data) {
        const collectedAt = new Date();
        const dueDate = data.paymentDueDate ? new Date(data.paymentDueDate) : null;
        return await prisma_1.default.damageReport.update({
            where: { id },
            data: {
                status: 'Paid',
                paymentMethod: data.paymentMethod,
                paymentRef: data.paymentRef || null,
                collectedBy: data.collectedBy,
                paymentDueDate: dueDate,
                collectedAt
            },
            include: { reporter: true, branch: true }
        });
    }
    static async markRefused(id, refusalReason) {
        const report = await prisma_1.default.damageReport.update({
            where: { id },
            data: {
                status: 'Refused',
                refusalReason
            },
            include: { reporter: true, branch: true }
        });
        // Notify BranchManager
        const managers = await prisma_1.default.user.findMany({
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
            whatsapp_service_1.WhatsAppService.mockSendWhatsAppMessage(mgr.phoneNumber, msg);
        }
        return report;
    }
    static async waiveDamage(id, waivedBy, waiverReason) {
        return await prisma_1.default.damageReport.update({
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
    static async getDamageReports(filters) {
        const where = {};
        if (filters?.status)
            where.status = filters.status;
        if (filters?.branchId)
            where.branchId = filters.branchId;
        if (filters?.reservationRef)
            where.reservationRef = filters.reservationRef;
        if (filters?.dateFrom || filters?.dateTo) {
            where.createdAt = {};
            if (filters.dateFrom)
                where.createdAt.gte = new Date(filters.dateFrom);
            if (filters.dateTo)
                where.createdAt.lte = new Date(filters.dateTo);
        }
        return await prisma_1.default.damageReport.findMany({
            where,
            include: { reporter: true, branch: true, reviewer: true },
            orderBy: { createdAt: 'desc' }
        });
    }
    static async getDamageById(id) {
        return await prisma_1.default.damageReport.findUnique({
            where: { id },
            include: { reporter: true, branch: true, reviewer: true }
        });
    }
    static async getDamageStats(branchId) {
        const where = {};
        if (branchId)
            where.branchId = branchId;
        const reports = await prisma_1.default.damageReport.findMany({ where });
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
    static translateDamageType(type) {
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
exports.LostFoundService = LostFoundService;
