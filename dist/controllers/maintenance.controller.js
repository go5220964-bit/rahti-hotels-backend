"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.MaintenanceController = void 0;
const maintenance_service_1 = require("../services/maintenance.service");
class MaintenanceController {
    static create = async (req, res, next) => {
        try {
            const { reportedBy, branchId, unitId, assetId, category, location, description, photoUrl, priority } = req.body;
            const request = await maintenance_service_1.MaintenanceService.createRequest({
                reportedBy,
                branchId,
                unitId,
                assetId,
                category,
                location,
                description,
                photoUrl,
                priority
            }, false);
            // Send Telegram notification to Maintenance Supervisor if Telegram platform is active
            try {
                const prisma = require('../services/prisma').default;
                const { WhatsAppService } = require('../services/whatsapp.service');
                const supervisors = await prisma.user.findMany({
                    where: {
                        role: 'MaintenanceSupervisor',
                        isActive: true
                    }
                });
                const branchNameAr = request.branch?.name === 'Sail Road Branch' ? 'فرع طريق السيل' :
                    request.branch?.name === 'Beachside Resort Branch' ? 'فرع منتجع الشاطئ' :
                        request.branch?.name || '';
                const categoryTranslation = {
                    Electrical: 'كهرباء',
                    Plumbing: 'سباكة',
                    AC: 'تكييف',
                    Carpentry: 'نجارة',
                    Cleaning: 'نظافة',
                    General: 'عام'
                };
                const priorityTranslation = {
                    Urgent: 'عاجل 🚨',
                    High: 'مرتفع ⚡',
                    Normal: 'عادي ⏱️',
                    Low: 'منخفض 💤'
                };
                const categoryAr = categoryTranslation[request.category] || request.category;
                const priorityAr = priorityTranslation[request.priority] || request.priority;
                if (process.env.MESSAGING_PLATFORM === 'telegram') {
                    const { TelegramService } = require('../services/telegram.service');
                    const tgText = `🔔 <b>بلاغ صيانة جديد #${request.ticketNumber}</b>\n\n` +
                        `🏨 <b>الفرع</b>: ${branchNameAr}\n` +
                        `🔧 <b>النوع</b>: ${categoryAr}\n` +
                        `📍 <b>الموقع</b>: ${request.location}\n` +
                        `📝 <b>الوصف</b>: ${request.description}\n` +
                        `⚡ <b>الأولوية</b>: ${priorityAr}\n` +
                        `👤 <b>المُبلِّغ</b>: ${request.reporter?.name || ''}\n` +
                        `🕐 <b>الوقت</b>: ${new Date().toLocaleTimeString('ar-EG', { hour: '2-digit', minute: '2-digit' })}`;
                    const replyMarkup = {
                        inline_keyboard: [
                            [{ text: "👨‍🔧 تعيين فني", callback_data: `assign_tech_${request.id}` }]
                        ]
                    };
                    for (const sup of supervisors) {
                        if (sup.branchId && sup.branchId !== request.branchId) {
                            continue;
                        }
                        const chatId = sup.telegramChatId || TelegramService.getChatIdByPhone(sup.phoneNumber);
                        if (chatId) {
                            await TelegramService.sendMessage(chatId, tgText, replyMarkup);
                        }
                    }
                }
                else {
                    // Default: WhatsApp notification
                    const waText = `🔔 *بلاغ صيانة جديد #${request.ticketNumber}*\n\n` +
                        `🏨 *الفرع*: ${branchNameAr}\n` +
                        `🔧 *النوع*: ${categoryAr}\n` +
                        `📍 *الموقع*: ${request.location}\n` +
                        `📝 *الوصف*: ${request.description}\n` +
                        `⚡ *الأولوية*: ${priorityAr}\n` +
                        `👤 *المُبلِّغ*: ${request.reporter?.name || ''}\n` +
                        `🕐 *الوقت*: ${new Date().toLocaleTimeString('ar-EG', { hour: '2-digit', minute: '2-digit' })}\n\n` +
                        `[ 👷 تعيين فني ] (زر: assign_tech_btn_${request.id})`;
                    for (const sup of supervisors) {
                        if (sup.branchId && sup.branchId !== request.branchId) {
                            continue;
                        }
                        await WhatsAppService.sendWhatsAppMessage(sup.phoneNumber, waText);
                    }
                }
            }
            catch (notifyError) {
                console.error('[Maintenance Controller] Failed to send notification:', notifyError.message);
            }
            const response = {
                success: true,
                data: request
            };
            res.status(201).json(response);
        }
        catch (error) {
            next(error);
        }
    };
    static getAll = async (req, res, next) => {
        try {
            const { status, branchId, assignedTo, category, priority, dateFrom, dateTo } = req.query;
            const requests = await maintenance_service_1.MaintenanceService.getRequests({
                status: status,
                branchId: branchId,
                assignedTo: assignedTo,
                category: category,
                priority: priority,
                dateFrom: dateFrom,
                dateTo: dateTo
            });
            const response = {
                success: true,
                data: requests
            };
            res.status(200).json(response);
        }
        catch (error) {
            next(error);
        }
    };
    static getStats = async (req, res, next) => {
        try {
            const stats = await maintenance_service_1.MaintenanceService.getStats();
            const response = {
                success: true,
                data: stats
            };
            res.status(200).json(response);
        }
        catch (error) {
            next(error);
        }
    };
    static getWorkload = async (req, res, next) => {
        try {
            const workload = await maintenance_service_1.MaintenanceService.getTechnicianWorkload();
            const response = {
                success: true,
                data: workload
            };
            res.status(200).json(response);
        }
        catch (error) {
            next(error);
        }
    };
    static getById = async (req, res, next) => {
        try {
            const { id } = req.params;
            const request = await maintenance_service_1.MaintenanceService.getRequestById(id);
            if (!request) {
                res.status(404).json({ success: false, error: 'Request not found' });
                return;
            }
            const response = {
                success: true,
                data: request
            };
            res.status(200).json(response);
        }
        catch (error) {
            next(error);
        }
    };
    static assign = async (req, res, next) => {
        try {
            const { id } = req.params;
            const { technicianId, supervisorId } = req.body;
            const request = await maintenance_service_1.MaintenanceService.assignTechnician(id, technicianId, supervisorId);
            const response = {
                success: true,
                data: request
            };
            res.status(200).json(response);
        }
        catch (error) {
            next(error);
        }
    };
    static start = async (req, res, next) => {
        try {
            const { id } = req.params;
            const { technicianId } = req.body;
            const request = await maintenance_service_1.MaintenanceService.startWork(id, technicianId);
            const response = {
                success: true,
                data: request
            };
            res.status(200).json(response);
        }
        catch (error) {
            next(error);
        }
    };
    static complete = async (req, res, next) => {
        try {
            const { id } = req.params;
            const { technicianId, completionNote, completionPhotoUrl } = req.body;
            const request = await maintenance_service_1.MaintenanceService.submitCompletion(id, technicianId, completionNote, completionPhotoUrl);
            const response = {
                success: true,
                data: request
            };
            res.status(200).json(response);
        }
        catch (error) {
            next(error);
        }
    };
    static approve = async (req, res, next) => {
        try {
            const { id } = req.params;
            const { approverId, supervisorNote } = req.body;
            const request = await maintenance_service_1.MaintenanceService.approveCompletion(id, approverId, supervisorNote);
            const response = {
                success: true,
                data: request
            };
            res.status(200).json(response);
        }
        catch (error) {
            next(error);
        }
    };
    static reject = async (req, res, next) => {
        try {
            const { id } = req.params;
            const { approverId, rejectionReason } = req.body;
            const request = await maintenance_service_1.MaintenanceService.rejectCompletion(id, approverId, rejectionReason);
            const response = {
                success: true,
                data: request
            };
            res.status(200).json(response);
        }
        catch (error) {
            next(error);
        }
    };
    static spareParts = async (req, res, next) => {
        try {
            const { id } = req.params;
            const { technicianId, description, itemId, itemName, quantity } = req.body;
            const request = await maintenance_service_1.MaintenanceService.requestSpareParts(id, technicianId, {
                description: description || itemName || 'طلب قطع غيار',
                itemId,
                itemName,
                quantity: quantity ? Number(quantity) : 1
            });
            const response = {
                success: true,
                data: request
            };
            res.status(200).json(response);
        }
        catch (error) {
            next(error);
        }
    };
    static resume = async (req, res, next) => {
        try {
            const { id } = req.params;
            const { supervisorId } = req.body;
            const request = await maintenance_service_1.MaintenanceService.resumeAfterParts(id, supervisorId);
            const response = {
                success: true,
                data: request
            };
            res.status(200).json(response);
        }
        catch (error) {
            next(error);
        }
    };
}
exports.MaintenanceController = MaintenanceController;
