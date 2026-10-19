import prisma from './prisma';
import { WhatsAppService } from './whatsapp.service';

export class MaintenanceService {
  /**
   * Generates a ticket number: MNT-2026-XXXX by finding the last ticket number suffix and incrementing it.
   */
  public static async generateTicketNumber(): Promise<string> {
    const lastRequest = await prisma.maintenanceRequest.findFirst({
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
  public static async createRequest(data: {
    reportedBy: string;
    branchId?: string;
    unitId?: string;
    assetId?: string;
    category: string;
    location: string;
    description: string;
    photoUrl?: string;
    priority?: string;
  }, notifySupervisor = true) {
    const ticketNumber = await this.generateTicketNumber();

    let targetBranchId = data.branchId;
    if (!targetBranchId) {
      const defaultBranch = await prisma.branch.findFirst();
      targetBranchId = defaultBranch?.id || '';
    }

    let resolvedUnitId = data.unitId || null;
    let resolvedAssetId = data.assetId || null;

    // If unitId was not explicitly given, try matching location (e.g. "305", "شقة 305") with existing units
    if (!resolvedUnitId && data.location) {
      const cleanedRoom = data.location.replace(/[^0-9]/g, '');
      if (cleanedRoom) {
        const foundUnit = await prisma.unit.findFirst({
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
    
    const request = (await prisma.maintenanceRequest.create({
      data: {
        ticketNumber,
        reportedBy: data.reportedBy,
        branchId: targetBranchId,
        unitId: resolvedUnitId,
        assetId: resolvedAssetId,
        category: data.category as any,
        location: data.location,
        description: data.description,
        photoUrl: data.photoUrl || null,
        priority: (data.priority || 'Normal') as any,
        status: 'New'
      },
      include: {
        reporter: true,
        branch: true
      }
    })) as any;

    // Update linked Unit status to MaintenanceNeeded
    if (resolvedUnitId) {
      try {
        await prisma.unit.update({
          where: { id: resolvedUnitId },
          data: { status: 'MaintenanceNeeded' }
        });
      } catch (e) {}
    }

    // Create "Created" timeline entry
    await prisma.maintenanceTimeline.create({
      data: {
        requestId: request.id,
        action: 'Created',
        performedBy: data.reportedBy,
        note: 'تم إنشاء بلاغ الصيانة الجديد بنجاح.'
      }
    });

    // Notify all MaintenanceSupervisors & Admins
    const supervisors = await prisma.user.findMany({
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
            await WhatsAppService.sendWhatsAppMessage(sup.phoneNumber, notifyMsg);
          }
        } catch (supErr: any) {
          console.error(`⚠️ Failed to notify supervisor ${sup.phoneNumber} for ticket ${request.ticketNumber}:`, supErr?.message || supErr);
        }
      }
    }

    return request;
  }

  /**
   * Assigns a technician to a request, updates request status, creates a timeline entry, and notifies the technician.
   */
  public static async assignTechnician(requestId: string, technicianId: string, supervisorId: string) {
    const request = await prisma.maintenanceRequest.findFirst({
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
      await prisma.user.update({
        where: { id: request.assignedTo },
        data: { isAvailable: true }
      });
    }

    // Update technician availability to busy
    await prisma.user.update({
      where: { id: technicianId },
      data: { isAvailable: false }
    });

    const updatedRequest = await prisma.maintenanceRequest.update({
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
    await prisma.maintenanceTimeline.create({
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
      WhatsAppService.mockSendWhatsAppMessage(updatedRequest.technician.phoneNumber, techMsg);
    }

    // Notify reporter via WhatsApp
    if (updatedRequest.reporter && updatedRequest.reporter.phoneNumber) {
      const reporterMsg = `👨‍🔧 *تحديث بلاغ الصيانة #${updatedRequest.ticketNumber}*\n\n` +
        `تم تعيين الفني *${updatedRequest.technician?.name || 'المختص'}* لمباشرة بلاغك.\n` +
        `سيتم البدء في العمل قريباً.`;
      WhatsAppService.mockSendWhatsAppMessage(updatedRequest.reporter.phoneNumber, reporterMsg);
    }

    return updatedRequest;
  }

  /**
   * Updates request status to InProgress and creates a timeline entry.
   */
  public static async startWork(requestId: string, technicianId: string) {
    const existing = await prisma.maintenanceRequest.findFirst({
      where: {
        OR: [{ id: requestId }, { ticketNumber: requestId }]
      }
    });
    if (!existing) {
      throw new Error('Maintenance request not found');
    }

    const request = await prisma.maintenanceRequest.update({
      where: { id: existing.id },
      data: {
        status: 'InProgress'
      }
    });

    await prisma.maintenanceTimeline.create({
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
  public static async submitCompletion(
    requestId: string, 
    technicianId: string, 
    completionNote: string, 
    completionPhotoUrl?: string
  ) {
    if (!completionPhotoUrl || completionPhotoUrl.trim() === '') {
      throw new Error('إرفاق صورة بعد الإصلاح إلزامي، ولن يقبل النظام إغلاق البلاغ أو اعتماده بدونها.');
    }

    const request = await prisma.maintenanceRequest.update({
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

    await prisma.maintenanceTimeline.create({
      data: {
        requestId,
        action: 'CompletionSubmitted',
        performedBy: technicianId,
        note: completionNote,
        photoUrl: completionPhotoUrl || null
      }
    });

    // Notify BranchManager of that branch
    const branchManagers = await prisma.user.findMany({
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
      WhatsAppService.mockSendWhatsAppMessage(manager.phoneNumber, managerMsg);
    }

    // Also notify central supervisors
    const supervisors = await prisma.user.findMany({
      where: {
        role: 'MaintenanceSupervisor'
      }
    });

    for (const sup of supervisors) {
      if (sup.branchId && sup.branchId !== request.branchId) {
        continue;
      }
      WhatsAppService.mockSendWhatsAppMessage(sup.phoneNumber, managerMsg);
    }

    return request;
  }

  /**
   * Approves completion, updates status to Closed, sets the technician as available,
   * restores Unit status to Available/Occupied, and notifies reporter/technician.
   */
  public static async approveCompletion(requestId: string, approverId: string, supervisorNote?: string) {
    const request = await prisma.maintenanceRequest.findUnique({
      where: { id: requestId },
      include: { reporter: true, technician: true }
    });

    if (!request) {
      throw new Error('Maintenance request not found');
    }

    // Make technician available again
    if (request.assignedTo) {
      await prisma.user.update({
        where: { id: request.assignedTo },
        data: { isAvailable: true }
      });
    }

    const updatedRequest = await prisma.maintenanceRequest.update({
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
        const remainingOpen = await prisma.maintenanceRequest.count({
          where: {
            unitId: request.unitId,
            id: { not: requestId },
            status: { notIn: ['Closed', 'Rejected'] }
          }
        });

        if (remainingOpen === 0) {
          const linkedUnit = await prisma.unit.findUnique({ where: { id: request.unitId } });
          if (linkedUnit && linkedUnit.status === 'MaintenanceNeeded') {
            await prisma.unit.update({
              where: { id: request.unitId },
              data: { status: linkedUnit.guestName ? 'Occupied' : 'Available' }
            });
          }
        }
      } catch (err) {
        console.error('Failed to update linked unit status on maintenance close:', err);
      }
    }

    await prisma.maintenanceTimeline.create({
      data: {
        requestId,
        action: 'Closed',
        performedBy: approverId,
        note: supervisorNote || 'تم تأكيد وإغلاق بلاغ الصيانة بنجاح.'
      }
    });

    // Notify reporter
    WhatsAppService.mockSendWhatsAppMessage(
      request.reporter.phoneNumber, 
      `✅ تم إغلاق بلاغ الصيانة #${updatedRequest.ticketNumber} بنجاح.`
    );

    // Notify technician
    if (request.technician) {
      WhatsAppService.mockSendWhatsAppMessage(
        request.technician.phoneNumber, 
        `🏆 تم اعتماد إنجازك في البلاغ #${updatedRequest.ticketNumber}.`
      );
    }

    return updatedRequest;
  }

  /**
   * Rejects completion, updates status to Rejected, and notifies supervisor/technician.
   */
  public static async rejectCompletion(requestId: string, approverId: string, rejectionReason: string) {
    const request = await prisma.maintenanceRequest.findUnique({
      where: { id: requestId },
      include: { reporter: true, technician: true, branch: true }
    });

    if (!request) {
      throw new Error('Maintenance request not found');
    }

    const updatedRequest = await prisma.maintenanceRequest.update({
      where: { id: requestId },
      data: {
        status: 'Rejected',
        rejectionReason,
        rejectionCount: { increment: 1 }
      }
    });

    await prisma.maintenanceTimeline.create({
      data: {
        requestId,
        action: 'Rejected',
        performedBy: approverId,
        note: rejectionReason
      }
    });

    // Notify MaintenanceSupervisors
    const supervisors = await prisma.user.findMany({
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
      WhatsAppService.mockSendWhatsAppMessage(sup.phoneNumber, supMsg);
    }

    // Notify technician
    if (request.technician) {
      WhatsAppService.mockSendWhatsAppMessage(
        request.technician.phoneNumber, 
        `❌ تم رفض إنجازك في البلاغ #${updatedRequest.ticketNumber}. السبب: ${rejectionReason}`
      );
    }

    return updatedRequest;
  }

  /**
   * Transformation #2: Automated State Machine for Spare Parts & Warehouse.
   * Auto-checks branch warehouse stock:
   * - If available: Sets status 'PendingDispense' & creates WarehouseRequest
   * - If stock is 0: Auto-generates urgent ProcurementRequest
   */
  public static async requestSpareParts(
    requestId: string, 
    technicianId: string, 
    dataOrDescription: string | { description: string; itemId?: string; itemName?: string; quantity?: number }
  ) {
    const desc = typeof dataOrDescription === 'string' ? dataOrDescription : dataOrDescription.description;
    const rawItemId = typeof dataOrDescription === 'object' ? dataOrDescription.itemId : undefined;
    const rawItemName = typeof dataOrDescription === 'object' ? (dataOrDescription.itemName || desc) : desc;
    const qty = typeof dataOrDescription === 'object' && dataOrDescription.quantity ? dataOrDescription.quantity : 1;

    const request = await prisma.maintenanceRequest.findUnique({
      where: { id: requestId },
      include: { branch: true }
    });

    if (!request) {
      throw new Error('Maintenance request not found');
    }

    let matchedItem: any = null;
    if (rawItemId) {
      matchedItem = await prisma.item.findUnique({ where: { id: rawItemId } });
    } else {
      matchedItem = await prisma.item.findFirst({
        where: {
          name: { contains: rawItemName.trim(), mode: 'insensitive' }
        }
      });
    }

    let warehouseStatus = 'PendingDispense';
    let procurementId: string | null = null;
    let whRequestId: string | null = null;
    let currentStock = 0;

    if (matchedItem) {
      const stockEntry = await prisma.stockEntry.findUnique({
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

      const lastWhr = await prisma.warehouseRequest.findFirst({ orderBy: { createdAt: 'desc' } });
      let nextWhrNum = 1;
      if (lastWhr && lastWhr.ticketNumber) {
        const parts = lastWhr.ticketNumber.split('-');
        if (parts.length === 3) {
          const parsed = parseInt(parts[2], 10);
          if (!isNaN(parsed)) nextWhrNum = parsed + 1;
        }
      }
      const whrTicket = `WHR-2026-${String(nextWhrNum).padStart(4, '0')}`;

      const whReq = await prisma.warehouseRequest.create({
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
    } else {
      // Stock is zero or not enough: auto-generate urgent ProcurementRequest
      warehouseStatus = 'ProcurementCreated';

      const lastPro = await prisma.procurementRequest.findFirst({ orderBy: { createdAt: 'desc' } });
      let nextProNum = 1;
      if (lastPro && lastPro.ticketNumber) {
        const parts = lastPro.ticketNumber.split('-');
        if (parts.length === 3) {
          const parsed = parseInt(parts[2], 10);
          if (!isNaN(parsed)) nextProNum = parsed + 1;
        }
      }
      const proTicket = `PRO-2026-${String(nextProNum).padStart(4, '0')}`;

      const procurement = await prisma.procurementRequest.create({
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

    const updatedRequest = await prisma.maintenanceRequest.update({
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

    await prisma.maintenanceTimeline.create({
      data: {
        requestId,
        action: 'SparePartsRequested',
        performedBy: technicianId,
        note: timelineNote
      }
    });

    // Notify MaintenanceSupervisors & Warehouse/Procurement
    const supervisors = await prisma.user.findMany({
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
      WhatsAppService.mockSendWhatsAppMessage(sup.phoneNumber, supMsg);
    }

    return updatedRequest;
  }

  /**
   * Resumes request from SpareParts back to InProgress.
   */
  public static async resumeAfterParts(requestId: string, supervisorId: string) {
    const request = await prisma.maintenanceRequest.update({
      where: { id: requestId },
      data: {
        status: 'InProgress',
        sparePartsNeeded: false
      },
      include: { technician: true }
    });

    await prisma.maintenanceTimeline.create({
      data: {
        requestId,
        action: 'Started',
        performedBy: supervisorId,
        note: 'تم استئناف العمل على البلاغ بعد توفر قطع الغيار اللازمة.'
      }
    });

    // Notify technician
    if (request.technician) {
      WhatsAppService.mockSendWhatsAppMessage(
        request.technician.phoneNumber, 
        `▶️ تم استئناف العمل على البلاغ #${request.ticketNumber} بعد وصول قطع الغيار.`
      );
    }

    return request;
  }

  /**
   * Gets maintenance requests with multiple filters.
   */
  public static async getRequests(filters: {
    status?: string;
    branchId?: string;
    assignedTo?: string;
    category?: string;
    priority?: string;
    dateFrom?: string;
    dateTo?: string;
  }) {
    const where: any = {};

    if (filters.status) where.status = filters.status;
    if (filters.branchId) where.branchId = filters.branchId;
    if (filters.assignedTo) where.assignedTo = filters.assignedTo;
    if (filters.category) where.category = filters.category;
    if (filters.priority) where.priority = filters.priority;

    if (filters.dateFrom || filters.dateTo) {
      where.createdAt = {};
      if (filters.dateFrom) where.createdAt.gte = new Date(filters.dateFrom);
      if (filters.dateTo) where.createdAt.lte = new Date(filters.dateTo);
    }

    return prisma.maintenanceRequest.findMany({
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
  public static async getRequestById(id: string) {
    return prisma.maintenanceRequest.findUnique({
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
  public static async getStats() {
    const all = await prisma.maintenanceRequest.findMany({
      include: { branch: true }
    });

    const total = all.length;
    const byStatus: { [key: string]: number } = {};
    const byCategory: { [key: string]: number } = {};
    const byBranch: { [key: string]: number } = {};

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
        return sum + (req.closedAt!.getTime() - req.createdAt.getTime());
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
  public static async getTechnicianWorkload() {
    const technicians = await prisma.user.findMany({
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
  private static translateCategory(category: string): string {
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

  private static translatePriority(priority: string): string {
    switch (priority) {
      case 'Urgent': return 'عاجل جداً 🔴';
      case 'High': return 'عالية 🟠';
      case 'Normal': return 'عادية 🟡';
      case 'Low': return 'منخفضة 🟢';
      default: return priority;
    }
  }
}
