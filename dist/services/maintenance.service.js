"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.MaintenanceService = void 0;
const prisma_1 = __importDefault(require("./prisma"));
const whatsapp_service_1 = require("./whatsapp.service");
class MaintenanceService {
    /**
     * Generates a ticket number: MNT-2026-XXXX by finding the last ticket number suffix and incrementing it.
     */
    static async generateTicketNumber() {
        const lastRequest = await prisma_1.default.maintenanceRequest.findFirst({
            orderBy: { createdAt: 'desc' }
        });
        let nextNum = 1;
        if (lastRequest && lastRequest.ticketNumber) {
            const parts = lastRequest.ticketNumber.split('-');
            if (parts.length === 3) {
                const parsed = parseInt(parts[2], 10);
                if (!isNaN(parsed)) {
                    nextNum = parsed + 1;
                }
            }
        }
        return `MNT-2026-${String(nextNum).padStart(4, '0')}`;
    }
    /**
     * Creates a new maintenance request, generates the ticket number, and creates the first timeline entry.
     */
    static async createRequest(data, notifySupervisor = true) {
        const ticketNumber = await this.generateTicketNumber();
        let targetBranchId = data.branchId;
        if (!targetBranchId) {
            const defaultBranch = await prisma_1.default.branch.findFirst();
            targetBranchId = defaultBranch?.id || '';
        }
        let resolvedUnitId = data.unitId || null;
        let resolvedAssetId = data.assetId || null;
        // If unitId was not explicitly given, try matching location (e.g. "305", "شقة 305") with existing units
        if (!resolvedUnitId && data.location) {
            const cleanedRoom = data.location.replace(/[^0-9]/g, '');
            if (cleanedRoom) {
                const foundUnit = await prisma_1.default.unit.findFirst({
                    where: {
                        branchId: targetBranchId,
                        unitNumber: cleanedRoom
                    }
                });
                if (foundUnit) {
                    resolvedUnitId = foundUnit.id;
                }
            }
        }
        const request = (await prisma_1.default.maintenanceRequest.create({
            data: {
                ticketNumber,
                reportedBy: data.reportedBy,
                branchId: targetBranchId,
                unitId: resolvedUnitId,
                assetId: resolvedAssetId,
                category: data.category,
                location: data.location,
                description: data.description,
                photoUrl: data.photoUrl || null,
                priority: (data.priority || 'Normal'),
                status: 'New'
            },
            include: {
                reporter: true,
                branch: true
            }
        }));
        // Update linked Unit status to MaintenanceNeeded
        if (resolvedUnitId) {
            try {
                await prisma_1.default.unit.update({
                    where: { id: resolvedUnitId },
                    data: { status: 'MaintenanceNeeded' }
                });
            }
            catch (e) { }
        }
        // Create "Created" timeline entry
        await prisma_1.default.maintenanceTimeline.create({
            data: {
                requestId: request.id,
                action: 'Created',
                performedBy: data.reportedBy,
                note: 'تم إنشاء بلاغ الصيانة الجديد بنجاح.'
            }
        });
        // Notify all MaintenanceSupervisors & Admins
        const supervisors = await prisma_1.default.user.findMany({
            where: {
                role: { in: ['MaintenanceSupervisor', 'Admin'] }
            }
        });
        const branchNameAr = request.branch?.name === 'Sail Road Branch' ? 'فرع طريق السيل' :
            request.branch?.name === 'Beachside Resort Branch' ? 'فرع منتجع الشاطئ' :
                (request.branch?.name || 'الفرع الرئيسي');
        const notifyMsg = `🔔 *بلاغ صيانة جديد #${request.ticketNumber}*\n\n` +
            `🏨 *الفرع*: ${branchNameAr}\n` +
            `🔧 *النوع*: ${this.translateCategory(request.category)}\n` +
            `📍 *الموقع*: ${request.location}\n` +
            `📝 *الوصف*: ${request.description}\n` +
            `⚡ *الأولوية*: ${this.translatePriority(request.priority)}\n` +
            `👤 *المُبلِّغ*: ${request.reporter?.name || 'موظف'}\n` +
            `🕐 *الوقت*: ${new Date().toLocaleTimeString('ar-EG', { hour: '2-digit', minute: '2-digit' })}\n\n` +
            `👷 *لتعيين فني، أرسل كلمة "تعيين" أو الكود أدناه:*\n` +
            `assign_tech_btn_${request.id}`;
        if (notifySupervisor) {
            for (const sup of supervisors) {
                try {
                    // If MaintenanceSupervisor has branchId set, only notify for that branch (Admins receive all)
                    if (sup.role !== 'Admin' && sup.branchId && sup.branchId !== request.branchId) {
                        continue;
                    }
                    // Skip notifying the reporter themselves if they are an admin or supervisor (they receive the response directly)
                    if (sup.id === request.reportedBy) {
                        continue;
                    }
                    if (process.env.MESSAGING_PLATFORM === 'telegram') {
                        const { TelegramService } = require('./telegram.service');
                        const chatId = sup.telegramChatId || TelegramService.getChatIdByPhone(sup.phoneNumber);
                        if (chatId) {
                            const categoryAr = this.translateCategory(request.category);
                            const priorityAr = this.translatePriority(request.priority);
                            const text = `🔔 <b>بلاغ صيانة جديد #${request.ticketNumber}</b>\n\n` +
                                `🏨 <b>الفرع</b>: ${branchNameAr}\n` +
                                `🔧 <b>النوع</b>: ${categoryAr}\n` +
                                `📍 <b>الموقع</b>: ${request.location}\n` +
                                `📝 <b>الوصف</b>: ${request.description}\n` +
                                `⚡ <b>الأولوية</b>: ${priorityAr}\n` +
                                `👤 <b>المُبلِّغ</b>: ${request.reporter?.name || 'موظف'}\n` +
                                `🕐 <b>الوقت</b>: ${new Date().toLocaleTimeString('ar-EG', { hour: '2-digit', minute: '2-digit' })}`;
                            const replyMarkup = {
                                inline_keyboard: [
                                    [{ text: "👨‍🔧 تعيين فني", callback_data: `assign_tech_${request.id}` }]
                                ]
                            };
                            await TelegramService.sendMessage(chatId, text, replyMarkup);
                            continue;
                        }
                    }
                    if (sup.phoneNumber) {
                        await whatsapp_service_1.WhatsAppService.sendWhatsAppMessage(sup.phoneNumber, notifyMsg);
                    }
                }
                catch (supErr) {
                    console.error(`⚠️ Failed to notify supervisor ${sup.phoneNumber} for ticket ${request.ticketNumber}:`, supErr?.message || supErr);
                }
            }
        }
        return request;
    }
    /**
     * Assigns a technician to a request, updates request status, creates a timeline entry, and notifies the technician.
     */
    static async assignTechnician(requestId, technicianId, supervisorId) {
        const request = await prisma_1.default.maintenanceRequest.findFirst({
            where: {
                OR: [{ id: requestId }, { ticketNumber: requestId }]
            },
            include: { branch: true, technician: true }
        });
        if (!request) {
            throw new Error('Maintenance request not found');
        }
        const actualId = request.id;
        // If there was a previously assigned technician, mark them available
        if (request.assignedTo && request.assignedTo !== technicianId) {
            await prisma_1.default.user.update({
                where: { id: request.assignedTo },
                data: { isAvailable: true }
            });
        }
        // Update technician availability to busy
        await prisma_1.default.user.update({
            where: { id: technicianId },
            data: { isAvailable: false }
        });
        const updatedRequest = await prisma_1.default.maintenanceRequest.update({
            where: { id: actualId },
            data: {
                status: 'AssignedToTechnician',
                assignedTo: technicianId,
                assignedAt: new Date()
            },
            include: {
                technician: true,
                reporter: true,
                branch: true
            }
        });
        // Create timeline entry
        await prisma_1.default.maintenanceTimeline.create({
            data: {
                requestId: actualId,
                action: 'Assigned',
                performedBy: supervisorId,
                note: `تم تعيين الفني ${updatedRequest.technician?.name || ''} لمباشرة العطل.`
            }
        });
        // Notify technician via WhatsApp
        const branchNameAr = updatedRequest.branch.name === 'Sail Road Branch' ? 'فرع طريق السيل' :
            updatedRequest.branch.name === 'Beachside Resort Branch' ? 'فرع منتجع الشاطئ' :
                updatedRequest.branch.name;
        const techMsg = `🔧 *تم تعيينك في بلاغ صيانة جديد*\n\n` +
            `🎫 *رقم البلاغ*: #${updatedRequest.ticketNumber}\n` +
            `🏨 *الفرع*: ${branchNameAr}\n` +
            `🔧 *النوع*: ${this.translateCategory(updatedRequest.category)}\n` +
            `📍 *الموقع*: ${updatedRequest.location}\n` +
            `📝 *الوصف*: ${updatedRequest.description}\n` +
            `⚡ *الأولوية*: ${this.translatePriority(updatedRequest.priority)}\n\n` +
            `[ ▶️ بدء العمل ] (زر: start_work_req_${updatedRequest.id})\n` +
            `[ ℹ️ تفاصيل أكثر ] (زر: info_req_${updatedRequest.id})`;
        if (updatedRequest.technician) {
            whatsapp_service_1.WhatsAppService.mockSendWhatsAppMessage(updatedRequest.technician.phoneNumber, techMsg);
        }
        // Notify reporter via WhatsApp
        if (updatedRequest.reporter && updatedRequest.reporter.phoneNumber) {
            const reporterMsg = `👨‍🔧 *تحديث بلاغ الصيانة #${updatedRequest.ticketNumber}*\n\n` +
                `تم تعيين الفني *${updatedRequest.technician?.name || 'المختص'}* لمباشرة بلاغك.\n` +
                `سيتم البدء في العمل قريباً.`;
            whatsapp_service_1.WhatsAppService.mockSendWhatsAppMessage(updatedRequest.reporter.phoneNumber, reporterMsg);
        }
        return updatedRequest;
    }
    /**
     * Updates request status to InProgress and creates a timeline entry.
     */
    static async startWork(requestId, technicianId) {
        const existing = await prisma_1.default.maintenanceRequest.findFirst({
            where: {
                OR: [{ id: requestId }, { ticketNumber: requestId }]
            }
        });
        if (!existing) {
            throw new Error('Maintenance request not found');
        }
        const request = await prisma_1.default.maintenanceRequest.update({
            where: { id: existing.id },
            data: {
                status: 'InProgress'
            }
        });
        await prisma_1.default.maintenanceTimeline.create({
            data: {
                requestId: existing.id,
                action: 'Started',
                performedBy: technicianId,
                note: 'بدأ الفني العمل الميداني على إصلاح العطل.'
            }
        });
        return request;
    }
    /**
     * Submits request completion, updates status to PendingInternalApproval, and notifies BranchManager/MaintenanceSupervisors.
     */
    static async submitCompletion(requestId, technicianId, completionNote, completionPhotoUrl) {
        if (!completionPhotoUrl || completionPhotoUrl.trim() === '') {
            throw new Error('إرفاق صورة بعد الإصلاح إلزامي، ولن يقبل النظام إغلاق البلاغ أو اعتماده بدونها.');
        }
        const request = await prisma_1.default.maintenanceRequest.update({
            where: { id: requestId },
            data: {
                status: 'PendingInternalApproval',
                completedAt: new Date(),
                completionNote,
                completionPhotoUrl: completionPhotoUrl || null
            },
            include: {
                reporter: true,
                branch: true,
                technician: true
            }
        });
        await prisma_1.default.maintenanceTimeline.create({
            data: {
                requestId,
                action: 'CompletionSubmitted',
                performedBy: technicianId,
                note: completionNote,
                photoUrl: completionPhotoUrl || null
            }
        });
        // Notify BranchManager of that branch
        const branchManagers = await prisma_1.default.user.findMany({
            where: {
                role: 'BranchManager',
                branchId: request.branchId
            }
        });
        const managerMsg = `✅ *الفني ${request.technician?.name || 'فني'} أنهى إصلاح البلاغ #${request.ticketNumber}*\n\n` +
            `📍 *الموقع*: ${request.location}\n` +
            `📝 *ملاحظة الفني*: ${completionNote}\n\n` +
            `[ ✅ تأكيد الإصلاح ] (زر: approve_mnt_completion_${request.id})\n` +
            `[ ❌ الإصلاح غير مكتمل ] (زر: reject_mnt_completion_${request.id})`;
        for (const manager of branchManagers) {
            whatsapp_service_1.WhatsAppService.mockSendWhatsAppMessage(manager.phoneNumber, managerMsg);
        }
        // Also notify central supervisors
        const supervisors = await prisma_1.default.user.findMany({
            where: {
                role: 'MaintenanceSupervisor'
            }
        });
        for (const sup of supervisors) {
            if (sup.branchId && sup.branchId !== request.branchId) {
                continue;
            }
            whatsapp_service_1.WhatsAppService.mockSendWhatsAppMessage(sup.phoneNumber, managerMsg);
        }
        return request;
    }
    /**
     * Approves completion, updates status to Closed, sets the technician as available,
     * restores Unit status to Available/Occupied, and notifies reporter/technician.
     */
    static async approveCompletion(requestId, approverId, supervisorNote) {
        const request = await prisma_1.default.maintenanceRequest.findUnique({
            where: { id: requestId },
            include: { reporter: true, technician: true }
        });
        if (!request) {
            throw new Error('Maintenance request not found');
        }
        // Make technician available again
        if (request.assignedTo) {
            await prisma_1.default.user.update({
                where: { id: request.assignedTo },
                data: { isAvailable: true }
            });
        }
        const updatedRequest = await prisma_1.default.maintenanceRequest.update({
            where: { id: requestId },
            data: {
                status: 'Closed',
                closedAt: new Date(),
                closedBy: approverId,
                supervisorNote: supervisorNote || null
            }
        });
        // Auto-update linked Unit status if no other active maintenance requests remain
        if (request.unitId) {
            try {
                const remainingOpen = await prisma_1.default.maintenanceRequest.count({
                    where: {
                        unitId: request.unitId,
                        id: { not: requestId },
                        status: { notIn: ['Closed', 'Rejected'] }
                    }
                });
                if (remainingOpen === 0) {
                    const linkedUnit = await prisma_1.default.unit.findUnique({ where: { id: request.unitId } });
                    if (linkedUnit && linkedUnit.status === 'MaintenanceNeeded') {
                        await prisma_1.default.unit.update({
                            where: { id: request.unitId },
                            data: { status: linkedUnit.guestName ? 'Occupied' : 'Available' }
                        });
                    }
                }
            }
            catch (err) {
                console.error('Failed to update linked unit status on maintenance close:', err);
            }
        }
        await prisma_1.default.maintenanceTimeline.create({
            data: {
                requestId,
                action: 'Closed',
                performedBy: approverId,
                note: supervisorNote || 'تم تأكيد وإغلاق بلاغ الصيانة بنجاح.'
            }
        });
        // Notify reporter
        whatsapp_service_1.WhatsAppService.mockSendWhatsAppMessage(request.reporter.phoneNumber, `✅ تم إغلاق بلاغ الصيانة #${updatedRequest.ticketNumber} بنجاح.`);
        // Notify technician
        if (request.technician) {
            whatsapp_service_1.WhatsAppService.mockSendWhatsAppMessage(request.technician.phoneNumber, `🏆 تم اعتماد إنجازك في البلاغ #${updatedRequest.ticketNumber}.`);
        }
        return updatedRequest;
    }
    /**
     * Rejects completion, updates status to Rejected, and notifies supervisor/technician.
     */
    static async rejectCompletion(requestId, approverId, rejectionReason) {
        const request = await prisma_1.default.maintenanceRequest.findUnique({
            where: { id: requestId },
            include: { reporter: true, technician: true, branch: true }
        });
        if (!request) {
            throw new Error('Maintenance request not found');
        }
        const updatedRequest = await prisma_1.default.maintenanceRequest.update({
            where: { id: requestId },
            data: {
                status: 'Rejected',
                rejectionReason,
                rejectionCount: { increment: 1 }
            }
        });
        await prisma_1.default.maintenanceTimeline.create({
            data: {
                requestId,
                action: 'Rejected',
                performedBy: approverId,
                note: rejectionReason
            }
        });
        // Notify MaintenanceSupervisors
        const supervisors = await prisma_1.default.user.findMany({
            where: { role: 'MaintenanceSupervisor' }
        });
        const supMsg = `❌ *تم رفض إغلاق البلاغ #${updatedRequest.ticketNumber}*\n\n` +
            `⚠️ *السبب*: ${rejectionReason}\n` +
            `يرجى متابعة الفني أو إعادة تعيين فني آخر لمباشرة العمل.\n\n` +
            `[ 👷 إعادة تعيين فني ] (زر: reassign_tech_btn_${updatedRequest.id})`;
        for (const sup of supervisors) {
            if (sup.branchId && sup.branchId !== request.branchId) {
                continue;
            }
            whatsapp_service_1.WhatsAppService.mockSendWhatsAppMessage(sup.phoneNumber, supMsg);
        }
        // Notify technician
        if (request.technician) {
            whatsapp_service_1.WhatsAppService.mockSendWhatsAppMessage(request.technician.phoneNumber, `❌ تم رفض إنجازك في البلاغ #${updatedRequest.ticketNumber}. السبب: ${rejectionReason}`);
        }
        return updatedRequest;
    }
    /**
     * Transformation #2: Automated State Machine for Spare Parts & Warehouse.
     * Auto-checks branch warehouse stock:
     * - If available: Sets status 'PendingDispense' & creates WarehouseRequest
     * - If stock is 0: Auto-generates urgent ProcurementRequest
     */
    static async requestSpareParts(requestId, technicianId, dataOrDescription) {
        const desc = typeof dataOrDescription === 'string' ? dataOrDescription : dataOrDescription.description;
        const rawItemId = typeof dataOrDescription === 'object' ? dataOrDescription.itemId : undefined;
        const rawItemName = typeof dataOrDescription === 'object' ? (dataOrDescription.itemName || desc) : desc;
        const qty = typeof dataOrDescription === 'object' && dataOrDescription.quantity ? dataOrDescription.quantity : 1;
        const request = await prisma_1.default.maintenanceRequest.findUnique({
            where: { id: requestId },
            include: { branch: true }
        });
        if (!request) {
            throw new Error('Maintenance request not found');
        }
        let matchedItem = null;
        if (rawItemId) {
            matchedItem = await prisma_1.default.item.findUnique({ where: { id: rawItemId } });
        }
        else {
            matchedItem = await prisma_1.default.item.findFirst({
                where: {
                    name: { contains: rawItemName.trim(), mode: 'insensitive' }
                }
            });
        }
        let warehouseStatus = 'PendingDispense';
        let procurementId = null;
        let whRequestId = null;
        let currentStock = 0;
        if (matchedItem) {
            const stockEntry = await prisma_1.default.stockEntry.findUnique({
                where: {
                    itemId_branchId: {
                        itemId: matchedItem.id,
                        branchId: request.branchId
                    }
                }
            });
            currentStock = stockEntry ? stockEntry.quantity : 0;
        }
        if (matchedItem && currentStock >= qty) {
            // Stock is available in warehouse
            warehouseStatus = 'PendingDispense';
            const lastWhr = await prisma_1.default.warehouseRequest.findFirst({ orderBy: { createdAt: 'desc' } });
            let nextWhrNum = 1;
            if (lastWhr && lastWhr.ticketNumber) {
                const parts = lastWhr.ticketNumber.split('-');
                if (parts.length === 3) {
                    const parsed = parseInt(parts[2], 10);
                    if (!isNaN(parsed))
                        nextWhrNum = parsed + 1;
                }
            }
            const whrTicket = `WHR-2026-${String(nextWhrNum).padStart(4, '0')}`;
            const whReq = await prisma_1.default.warehouseRequest.create({
                data: {
                    ticketNumber: whrTicket,
                    requestedBy: technicianId,
                    branchId: request.branchId,
                    itemId: matchedItem.id,
                    quantityRequested: qty,
                    status: 'Pending',
                    purpose: `طلب قطع غيار لبلاغ صيانة #${request.ticketNumber}`
                }
            });
            whRequestId = whReq.id;
        }
        else {
            // Stock is zero or not enough: auto-generate urgent ProcurementRequest
            warehouseStatus = 'ProcurementCreated';
            const lastPro = await prisma_1.default.procurementRequest.findFirst({ orderBy: { createdAt: 'desc' } });
            let nextProNum = 1;
            if (lastPro && lastPro.ticketNumber) {
                const parts = lastPro.ticketNumber.split('-');
                if (parts.length === 3) {
                    const parsed = parseInt(parts[2], 10);
                    if (!isNaN(parsed))
                        nextProNum = parsed + 1;
                }
            }
            const proTicket = `PRO-2026-${String(nextProNum).padStart(4, '0')}`;
            const procurement = await prisma_1.default.procurementRequest.create({
                data: {
                    ticketNumber: proTicket,
                    requestedBy: technicianId,
                    branchId: request.branchId,
                    itemId: matchedItem?.id || null,
                    itemName: matchedItem?.name || rawItemName,
                    quantityNeeded: qty,
                    unit: matchedItem?.unit || 'قطعة',
                    source: 'MaintenanceSpareParts',
                    status: 'Pending',
                    procurementNote: `طلب شراء عاجل آلي لبلاغ صيانة #${request.ticketNumber}: ${desc}`
                }
            });
            procurementId = procurement.id;
        }
        const updatedRequest = await prisma_1.default.maintenanceRequest.update({
            where: { id: requestId },
            data: {
                status: 'SpareParts',
                sparePartsNeeded: true,
                sparePartItemId: matchedItem?.id || null,
                sparePartQuantity: qty,
                warehouseStatus,
                warehouseRequestId: whRequestId,
                procurementId
            },
            include: { branch: true }
        });
        const timelineNote = warehouseStatus === 'PendingDispense'
            ? `طلب قطعة غيار (${rawItemName} × ${qty}) متوفرة بالمستودع (${currentStock}) - بانتظار تسليم المستودع`
            : `طلب قطعة غيار (${rawItemName} × ${qty}) رصيد المستودع (0) - تم إنشاء أمر شراء عاجل آلياً #${procurementId}`;
        await prisma_1.default.maintenanceTimeline.create({
            data: {
                requestId,
                action: 'SparePartsRequested',
                performedBy: technicianId,
                note: timelineNote
            }
        });
        // Notify MaintenanceSupervisors & Warehouse/Procurement
        const supervisors = await prisma_1.default.user.findMany({
            where: { role: { in: ['MaintenanceSupervisor', 'BranchManager', 'Admin'] } }
        });
        const statusBadge = warehouseStatus === 'PendingDispense'
            ? `✅ القطعة متوفرة بالمستودع (الرصيد: ${currentStock}) - بانتظار الصرف`
            : `⚠️ رصيد المستودع صفري! تم رفع طلب شراء عاجل آلياً إلى قسم المشتريات`;
        const supMsg = `⏸️ *البلاغ #${request.ticketNumber} موقوف لقطع غيار*\n\n` +
            `📦 *القطعة*: ${rawItemName} (الكمية: ${qty})\n` +
            `📊 *حالة التوفر*: ${statusBadge}\n\n` +
            `[ ▶️ استئناف البلاغ ] (زر: resume_req_${request.id})`;
        for (const sup of supervisors) {
            if (sup.branchId && sup.branchId !== request.branchId) {
                continue;
            }
            whatsapp_service_1.WhatsAppService.mockSendWhatsAppMessage(sup.phoneNumber, supMsg);
        }
        return updatedRequest;
    }
    /**
     * Resumes request from SpareParts back to InProgress.
     */
    static async resumeAfterParts(requestId, supervisorId) {
        const request = await prisma_1.default.maintenanceRequest.update({
            where: { id: requestId },
            data: {
                status: 'InProgress',
                sparePartsNeeded: false
            },
            include: { technician: true }
        });
        await prisma_1.default.maintenanceTimeline.create({
            data: {
                requestId,
                action: 'Started',
                performedBy: supervisorId,
                note: 'تم استئناف العمل على البلاغ بعد توفر قطع الغيار اللازمة.'
            }
        });
        // Notify technician
        if (request.technician) {
            whatsapp_service_1.WhatsAppService.mockSendWhatsAppMessage(request.technician.phoneNumber, `▶️ تم استئناف العمل على البلاغ #${request.ticketNumber} بعد وصول قطع الغيار.`);
        }
        return request;
    }
    /**
     * Gets maintenance requests with multiple filters.
     */
    static async getRequests(filters) {
        const where = {};
        if (filters.status)
            where.status = filters.status;
        if (filters.branchId)
            where.branchId = filters.branchId;
        if (filters.assignedTo)
            where.assignedTo = filters.assignedTo;
        if (filters.category)
            where.category = filters.category;
        if (filters.priority)
            where.priority = filters.priority;
        if (filters.dateFrom || filters.dateTo) {
            where.createdAt = {};
            if (filters.dateFrom)
                where.createdAt.gte = new Date(filters.dateFrom);
            if (filters.dateTo)
                where.createdAt.lte = new Date(filters.dateTo);
        }
        return prisma_1.default.maintenanceRequest.findMany({
            where,
            include: {
                reporter: true,
                branch: true,
                technician: true
            },
            orderBy: { createdAt: 'desc' }
        });
    }
    /**
     * Gets single request by ID with full chronological timeline.
     */
    static async getRequestById(id) {
        return prisma_1.default.maintenanceRequest.findUnique({
            where: { id },
            include: {
                reporter: true,
                branch: true,
                technician: true,
                timeline: {
                    orderBy: { createdAt: 'asc' }
                }
            }
        });
    }
    /**
     * Calculates overall maintenance statistics.
     */
    static async getStats() {
        const all = await prisma_1.default.maintenanceRequest.findMany({
            include: { branch: true }
        });
        const total = all.length;
        const byStatus = {};
        const byCategory = {};
        const byBranch = {};
        all.forEach(req => {
            byStatus[req.status] = (byStatus[req.status] || 0) + 1;
            byCategory[req.category] = (byCategory[req.category] || 0) + 1;
            byBranch[req.branch.name] = (byBranch[req.branch.name] || 0) + 1;
        });
        // Avg resolution hours
        const closed = all.filter(r => r.status === 'Closed' && r.closedAt);
        let avgResolutionHours = 0;
        if (closed.length > 0) {
            const totalMs = closed.reduce((sum, req) => {
                return sum + (req.closedAt.getTime() - req.createdAt.getTime());
            }, 0);
            avgResolutionHours = totalMs / (1000 * 60 * 60 * closed.length);
        }
        return {
            total,
            byStatus,
            byCategory,
            byBranch,
            avgResolutionHours
        };
    }
    /**
     * Gets technicians workload (list of Technicians with open request counts).
     */
    static async getTechnicianWorkload() {
        const technicians = await prisma_1.default.user.findMany({
            where: { role: 'Technician' },
            include: {
                assignedMaintenance: {
                    where: {
                        status: { in: ['AssignedToTechnician', 'InProgress', 'SpareParts', 'Rejected'] }
                    }
                }
            }
        });
        return technicians.map(tech => ({
            id: tech.id,
            name: tech.name,
            phoneNumber: tech.phoneNumber,
            isAvailable: tech.isAvailable,
            openTicketsCount: tech.assignedMaintenance.length
        }));
    }
    // --- Helpers for translations in bot notifications ---
    static translateCategory(category) {
        switch (category) {
            case 'Electrical': return 'كهرباء ⚡';
            case 'Plumbing': return 'سباكة 🚿';
            case 'AC': return 'تكييف ❄️';
            case 'Carpentry': return 'نجارة 🪚';
            case 'Cleaning': return 'نظافة وتجهيز 🧹';
            case 'General': return 'عام 🔧';
            default: return category;
        }
    }
    static translatePriority(priority) {
        switch (priority) {
            case 'Urgent': return 'عاجل جداً 🔴';
            case 'High': return 'عالية 🟠';
            case 'Normal': return 'عادية 🟡';
            case 'Low': return 'منخفضة 🟢';
            default: return priority;
        }
    }
}
exports.MaintenanceService = MaintenanceService;
