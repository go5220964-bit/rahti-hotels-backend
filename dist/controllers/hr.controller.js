"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.HRController = void 0;
const prisma_1 = __importDefault(require("../services/prisma"));
const whatsapp_service_1 = require("../services/whatsapp.service");
const activity_log_service_1 = require("../services/activity-log.service");
class HRController {
    // 3a. Broadcast announcements via WhatsApp bot to target branch(es)
    static broadcastAnnouncement = async (req, res, next) => {
        try {
            const { title, body, branchId, sentViaWhatsApp } = req.body;
            const caller = req.user || { id: 'system' };
            // Find target employees
            const whereClause = {
                isActive: true
            };
            if (branchId && branchId !== 'all') {
                whereClause.branchId = branchId;
            }
            const targetUsers = await prisma_1.default.user.findMany({
                where: whereClause
            });
            // Send WhatsApp notifications if requested
            if (sentViaWhatsApp && targetUsers.length > 0) {
                const messageText = `📢 *تعميم إداري هام: ${title}*\n\n${body}\n\n_صادر عن إدارة الموارد البشرية_`;
                for (const targetUser of targetUsers) {
                    // Check if bot is enabled for user
                    if (targetUser.botEnabled) {
                        await whatsapp_service_1.WhatsAppService.sendWhatsAppMessage(targetUser.phoneNumber, messageText);
                    }
                }
            }
            await activity_log_service_1.ActivityLogService.log(caller.id, 'BROADCAST_ANNOUNCEMENT', 'Announcement', branchId || 'all', { title, body, sentViaWhatsApp, recipientCount: targetUsers.length }, req.ip);
            const response = {
                success: true,
                data: { recipientCount: targetUsers.length, message: 'Announcement successfully broadcasted' }
            };
            res.status(201).json(response);
        }
        catch (error) {
            next(error);
        }
    };
    // 3d. Get Employee Transfer history
    static getTransferHistory = async (req, res, next) => {
        try {
            const { userId } = req.params;
            const transfers = await prisma_1.default.employeeTransfer.findMany({
                where: { employeeId: userId },
                include: {
                    fromBranch: true,
                    toBranch: true
                },
                orderBy: { transferDate: 'desc' }
            });
            const response = {
                success: true,
                data: transfers
            };
            res.status(200).json(response);
        }
        catch (error) {
            next(error);
        }
    };
    // 4a. Finance Loan metrics (total pending amount)
    static getFinanceLoanMetrics = async (req, res, next) => {
        try {
            const pendingLoans = await prisma_1.default.loanRequest.findMany({
                where: { status: 'Pending' }
            });
            const totalPendingAmount = pendingLoans.reduce((sum, loan) => sum + loan.amount, 0);
            const response = {
                success: true,
                data: {
                    totalPendingAmount,
                    count: pendingLoans.length
                }
            };
            res.status(200).json(response);
        }
        catch (error) {
            next(error);
        }
    };
}
exports.HRController = HRController;
