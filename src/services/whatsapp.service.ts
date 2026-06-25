import prisma from './prisma';
import axios from 'axios';
import twilio from 'twilio';
import { RequestType, RequestStatus, ApprovalStatus, Role } from '../types';
import { WhatsAppWebhookPayload, ParsedWhatsAppMessage } from '../types';
import { RequestService } from './request.service';

export class WhatsAppService {
  // Conversational session states
  private static technicianSessions = new Map<string, string>(); // techPhoneNumber -> requestId (waiting for after image)
  private static ratingSessions = new Map<string, string>();     // reporterPhoneNumber -> requestId (waiting for rating input)
  private static userBranchSessions = new Map<string, string>(); // userPhoneNumber -> selectedBranchId
  private static rejectionSessions = new Map<string, string>();  // reporterPhoneNumber -> requestId (waiting for rejection note)
  private static procurementSessions = new Map<string, { step: number; branchId: string; item?: string; techPhone?: string; techName?: string }>();
  private static shiftReportSessions = new Map<string, {
    step: number;
    branchId: string;
    shiftLabel?: string;
    cashTotal?: number;
    cashExpenses?: number;
    visa?: number;
    mada?: number;
    mastercard?: number;
    gulfNet?: number;
    tabby?: number;
    bankTransfer?: number;
    shiftId?: string | null;
    customStartTime?: string | null;
    customEndTime?: string | null;
    shiftsList?: any[];
  }>();
  private static shiftRejectionSessions = new Map<string, string>(); // accountantPhoneNumber -> shiftReportId
  private static attendanceSessions = new Map<string, 'CheckIn' | 'CheckOut'>(); // userPhoneNumber -> CheckIn/CheckOut
  private static loanSessions = new Map<string, { step: number; amount?: number; reason?: string }>();
  private static leaveSessions = new Map<string, { step: number; leaveType?: string; startDate?: string; endDate?: string; reason?: string; daysCount?: number }>();
  private static loanRejectionSessions = new Map<string, string>(); // accountantPhoneNumber -> loanRequestId
  private static leaveRejectionSessions = new Map<string, string>(); // reviewerPhoneNumber -> leaveRequestId
  private static requestMenuSessions = new Map<string, boolean>(); // userPhoneNumber -> active
  private static adminRequestSessions = new Map<string, boolean>(); // userPhoneNumber -> active
  private static maintenanceSessions = new Map<string, { step: number; branchId: string; category?: string; location?: string; description?: string; priority?: string; photoUrl?: string }>();
  private static supervisorAssignSessions = new Map<string, { requestId: string; techs: any[] }>();
  private static technicianMntSessions = new Map<string, { requestId: string; step: number; photoUrl?: string }>();
  private static sparePartsSessions = new Map<string, string>(); // techPhoneNumber -> requestId
  private static maintenanceApprovalSessions = new Map<string, { requestId: string; action: 'approve' | 'reject' }>();
  private static warehouseSessions = new Map<string, { step: number; itemId?: string; quantity?: number; purpose?: string; itemsList?: any[] }>();
  private static warehouseApprovalSessions = new Map<string, { requestId: string; action: 'issue_full' | 'issue_partial' | 'reject'; quantityIssued?: number }>();
  private static procurementApprovalSessions = new Map<string, { requestId: string; action: 'approve' | 'reject' }>();
  private static procurementReviewSessions = new Map<string, any>();
  private static lfSessions = new Map<string, { step: number; isGuestSearch?: boolean; location?: string; description?: string; photoUrl?: string | null; guestName?: string | null; guestPhone?: string | null }>();
  private static dmgSessions = new Map<string, { step: number; roomNumber?: string; reservationRef?: string | null; damageType?: string; reportedDuring?: string; description?: string; photoUrls?: string[]; guestName?: string | null; guestPhone?: string | null }>();
  private static dmgReviewSessions = new Map<string, { requestId: string; step: number; finalValue?: number; reviewNote?: string | null }>();
  private static dmgPaymentSessions = new Map<string, { requestId: string; step: number; paymentMethod?: string; paymentRef?: string | null; paymentDueDate?: Date | string | null }>();
  private static dmgRefusalSessions = new Map<string, string>();
  private static dmgWaiverSessions = new Map<string, string>();


  /**
   * Parse the raw WhatsApp Cloud API webhook payload into a simplified format.
   */
  public static parseWebhookPayload(payload: WhatsAppWebhookPayload): ParsedWhatsAppMessage[] {
    const messages: ParsedWhatsAppMessage[] = [];

    if (!payload.entry) return messages;

    for (const entry of payload.entry) {
      if (!entry.changes) continue;
      for (const change of entry.changes) {
        const val = change.value;
        if (!val.messages) continue;

        const contactName = val.contacts?.[0]?.profile?.name || 'مستخدم واتساب';

        for (const msg of val.messages) {
          const parsed: ParsedWhatsAppMessage = {
            senderNumber: msg.from,
            senderName: contactName,
            messageId: msg.id,
            timestamp: parseInt(msg.timestamp, 10),
            messageType: 'text',
          };

          if (msg.type === 'text' && msg.text) {
            parsed.messageType = 'text';
            parsed.text = msg.text.body;
          } else if (msg.type === 'interactive' && msg.interactive) {
            parsed.messageType = 'button_reply';
            if (msg.interactive.type === 'button_reply' && msg.interactive.button_reply) {
              parsed.buttonId = msg.interactive.button_reply.id;
              parsed.buttonTitle = msg.interactive.button_reply.title;
            } else if (msg.interactive.type === 'list_reply' && msg.interactive.list_reply) {
              parsed.buttonId = msg.interactive.list_reply.id;
              parsed.buttonTitle = msg.interactive.list_reply.title;
            }
          } else if (msg.type === 'image' && msg.image) {
            parsed.messageType = 'media';
            parsed.mediaId = msg.image.id;
            parsed.mimeType = msg.image.mime_type;
            parsed.caption = msg.image.caption;
          } else if (msg.type === 'document' && msg.document) {
            parsed.messageType = 'media';
            parsed.mediaId = msg.document.id;
            parsed.mimeType = msg.document.mime_type;
            parsed.caption = msg.document.caption;
          } else if (msg.type === 'location' && msg.location) {
            parsed.messageType = 'location';
            parsed.latitude = msg.location.latitude;
            parsed.longitude = msg.location.longitude;
          } else {
            continue;
          }
          messages.push(parsed);
        }
      }
    }

    return messages;
  }

  /**
   * Parse the Twilio URL-encoded webhook payload into a simplified format.
   */
  public static parseTwilioWebhookPayload(body: any): ParsedWhatsAppMessage[] {
    const messages: ParsedWhatsAppMessage[] = [];
    if (!body || !body.MessageSid) return messages;

    let senderNumber = body.From || '';
    if (senderNumber.startsWith('whatsapp:')) {
      senderNumber = senderNumber.replace('whatsapp:', '');
    }

    const contactName = body.ProfileName || 'مستخدم واتساب';
    const messageId = body.MessageSid;
    const timestamp = Math.floor(Date.now() / 1000);

    const parsed: ParsedWhatsAppMessage = {
      senderNumber,
      senderName: contactName,
      messageId,
      timestamp,
      messageType: 'text',
    };

    const textBody = (body.Body || '').trim();

    // Check if body text matches button reply IDs or dynamic patterns
    const staticButtons = [
      'confirm_lf_btn', 'cancel_lf_btn', 'confirm_dmg_btn', 'cancel_dmg_btn', 'confirm_loan_submit',
      'cancel_loan_submit', 'confirm_leave_submit', 'cancel_leave_submit', 'confirm_shift_submit',
      'cancel_shift_submit', 'confirm_maintenance_submit', 'cancel_maintenance_submit', 'confirm_whr_submit',
      'cancel_whr_submit', 'start_shift_report', 'menu_request_maintenance', 'menu_request_warehouse',
      'menu_request_procurement'
    ];

    const buttonPrefixes = [
      'lf_contact_btn_', 'dmg_review_btn_', 'dmg_accept_btn_', 'dmg_refuse_btn_', 'dmg_waive_btn_',
      'approve_loan_req_', 'reject_loan_req_', 'approve_leave_req_', 'reject_leave_req_', 'branch_select_',
      'start_shift_report_', 'approve_shift_', 'reject_shift_', 'start_external_procurement_', 'approve_proc_',
      'reject_proc_', 'menu_req_maintenance_', 'menu_req_warehouse_', 'menu_req_procurement_', 'approve_mnt_completion_',
      'reject_mnt_completion_', 'resume_req_', 'issue_full_', 'issue_partial_', 'reject_whr_',
      'review_procurement_', 'approve_finance_', 'reject_finance_', 'mark_purchased_btn_', 'confirm_receive_btn_',
      'approve_req_', 'reject_req_', 'reporter_confirm_yes_', 'reporter_confirm_no_'
    ];

    const isButton = staticButtons.includes(textBody) || buttonPrefixes.some(prefix => textBody.startsWith(prefix));

    if (isButton) {
      parsed.messageType = 'button_reply';
      parsed.buttonId = textBody;
      parsed.buttonTitle = textBody;
    }
    // Check if location message
    else if (body.Latitude && body.Longitude) {
      parsed.messageType = 'location';
      parsed.latitude = parseFloat(body.Latitude);
      parsed.longitude = parseFloat(body.Longitude);
    } 
    // Check if media message
    else if (body.NumMedia && parseInt(body.NumMedia, 10) > 0) {
      parsed.messageType = 'media';
      parsed.mediaId = body.MediaUrl0; // Use URL directly as mediaId
      parsed.mimeType = body.MediaContentType0 || 'image/jpeg';
      parsed.caption = textBody;
    } 
    // Default text message
    else {
      parsed.messageType = 'text';
      parsed.text = textBody;
    }

    messages.push(parsed);
    return messages;
  }

  /**
   * Process a parsed message, routing it to the appropriate operation.
   */
  public static async processMessage(parsed: ParsedWhatsAppMessage): Promise<string> {
    console.log(`💬 Processing WhatsApp message from ${parsed.senderNumber} (${parsed.senderName})`);

    // 1. Authenticate user by phone number
    const searchNumber = parsed.senderNumber;
    const alternatives = [searchNumber];
    if (searchNumber.startsWith('+')) {
      alternatives.push(searchNumber.substring(1));
    } else {
      alternatives.push('+' + searchNumber);
    }

    const user = await prisma.user.findFirst({
      where: {
        phoneNumber: {
          in: alternatives
        }
      },
      include: { branch: true },
    });

    if (!user) {
      return `مرحباً بك في نظام عمليات فنادق راحتي. الرقم ${parsed.senderNumber} غير مسجل لدينا. يرجى التواصل مع المسؤول لتسجيل رقمك.`;
    }

    if (user.botEnabled === false) {
      console.log(`🚫 WhatsApp bot is disabled for employee ${user.name} (${user.phoneNumber})`);
      return '';
    }

    const text = (parsed.text || '').trim();
    const textLower = text.toLowerCase();
    if (parsed.messageType === 'text' && (text === 'طلب' || text === 'قائمة' || text === 'جاهز' || textLower === 'menu')) {
      this.clearUserSessions(user.phoneNumber);
      const { menuText } = await WhatsAppService.getDynamicMenu(user);
      this.requestMenuSessions.set(user.phoneNumber, true);
      return menuText;
    }

    // 2. Handle button replies (Interactions)
    if (parsed.messageType === 'button_reply') {
      return await this.handleButtonReply(parsed, user);
    }

    // Handle location messages
    if (parsed.messageType === 'location') {
      return `❌ تسجيل الحضور عبر إرسال الموقع الجغرافي مباشرة ملغى لتفادي التزييف. يرجى استخدام الرابط المخصص لتسجيل بصمة الحضور/الانصراف الخاص بك.`;
    }

    // Maintenance Sessions routing
    if (this.maintenanceSessions.has(user.phoneNumber)) {
      return await this.handleMaintenanceSession(parsed, user);
    }
    if (this.technicianMntSessions.has(user.phoneNumber)) {
      return await this.handleTechnicianMntSession(parsed, user);
    }
    if (this.supervisorAssignSessions.has(user.phoneNumber)) {
      return await this.handleSupervisorAssignSession(parsed, user);
    }
    if (this.sparePartsSessions.has(user.phoneNumber)) {
      return await this.handleSparePartsSession(parsed, user);
    }
    if (this.maintenanceApprovalSessions.has(user.phoneNumber)) {
      return await this.handleMaintenanceApprovalSession(parsed, user);
    }
    if (this.warehouseSessions.has(user.phoneNumber)) {
      return await this.handleWarehouseSession(parsed, user);
    }
    if (this.warehouseApprovalSessions.has(user.phoneNumber)) {
      return await this.handleWarehouseApprovalSession(parsed, user);
    }
    if (this.procurementReviewSessions.has(user.phoneNumber)) {
      return await this.handleProcurementReviewSession(parsed, user);
    }
    if (this.procurementApprovalSessions.has(user.phoneNumber)) {
      return await this.handleProcurementApprovalSession(parsed, user);
    }
    if (this.lfSessions.has(user.phoneNumber)) {
      return await this.handleLFSession(parsed, user);
    }
    if (this.dmgSessions.has(user.phoneNumber)) {
      return await this.handleDmgSession(parsed, user);
    }
    if (this.dmgReviewSessions.has(user.phoneNumber)) {
      return await this.handleDmgReviewSession(parsed, user);
    }
    if (this.dmgPaymentSessions.has(user.phoneNumber)) {
      return await this.handleDmgPaymentSession(parsed, user);
    }
    if (this.dmgRefusalSessions.has(user.phoneNumber)) {
      return await this.handleDmgRefusalTextSession(parsed, user);
    }
    if (this.dmgWaiverSessions.has(user.phoneNumber)) {
      return await this.handleDmgWaiverTextSession(parsed, user);
    }

    // 3. Handle media (Images)
    if (parsed.messageType === 'media') {
      return await this.handleMediaMessage(parsed, user);
    }

    // Check if accountant is inputting a rejection reason for a shift report
    if (this.shiftRejectionSessions.has(user.phoneNumber)) {
      return await this.handleShiftRejectionTextSession(parsed, user);
    }

    // Check if user is filling a shift report wizard
    if (this.shiftReportSessions.has(user.phoneNumber)) {
      return await this.handleShiftReportTextSession(parsed, user);
    }

    // Check if user is in a rejection session (waiting for rejection reason text note)
    if (this.rejectionSessions.has(user.phoneNumber)) {
      return await this.handleRejectionTextSession(parsed, user);
    }

    // 4. Check if user is in a rating session (waiting for a rating text input)
    if (this.ratingSessions.has(user.phoneNumber)) {
      return await this.handleRatingTextSession(parsed, user);
    }

    // Check if user is in a procurement session (waiting for item desc or cost estimate)
    if (this.procurementSessions.has(user.phoneNumber)) {
      return await this.handleProcurementTextSession(parsed, user);
    }

    // Check if accountant is inputting a rejection reason for a loan request
    if (this.loanRejectionSessions.has(user.phoneNumber)) {
      return await this.handleLoanRejectionTextSession(parsed, user);
    }

    // Check if manager/admin is inputting a rejection reason for a leave request
    if (this.leaveRejectionSessions.has(user.phoneNumber)) {
      return await this.handleLeaveRejectionTextSession(parsed, user);
    }

    // Check if user is in a loan request wizard
    if (this.loanSessions.has(user.phoneNumber)) {
      return await this.handleLoanTextSession(parsed, user);
    }

    // Check if user is in a leave request wizard
    if (this.leaveSessions.has(user.phoneNumber)) {
      return await this.handleLeaveTextSession(parsed, user);
    }

    // Check if user is in an admin request session (Option 9)
    if (this.adminRequestSessions.has(user.phoneNumber)) {
      return await this.handleAdminRequestTextSession(parsed, user);
    }

    // 5. Default text command parsing
    return await this.handleTextMessage(parsed, user);
  }

  private static async handleTextMessage(parsed: ParsedWhatsAppMessage, user: any): Promise<string> {
    const text = (parsed.text || '').trim();
    const textLower = text.toLowerCase();

    // Check for Daily Digest commands
    if (text === 'ملخص' || text === 'تقرير اليوم') {
      const allowedRoles = ['BranchManager', 'Admin', 'CEO'];
      if (!allowedRoles.includes(user.role)) {
        return `❌ عذراً، لا تمتلك صلاحية طلب ملخص اليوم.`;
      }

      const dateStr = new Date().toISOString().split('T')[0];
      const { DigestService } = require('./digest.service');

      if (user.role === 'BranchManager') {
        if (!user.branchId) {
          return `❌ عذراً، هذا الحساب غير مرتبط بأي فرع حالياً.`;
        }
        return await DigestService.generateDailyDigest(user.branchId, dateStr);
      } else {
        // Admin or CEO
        const branches = await prisma.branch.findMany();
        if (branches.length === 0) {
          return `❌ لا يوجد فروع مسجلة بالنظام.`;
        }
        for (let i = 0; i < branches.length - 1; i++) {
          const digest = await DigestService.generateDailyDigest(branches[i].id, dateStr);
          this.mockSendWhatsAppMessage(user.phoneNumber, digest);
        }
        return await DigestService.generateDailyDigest(branches[branches.length - 1].id, dateStr);
      }
    }

    // Intercept Technician Commands
    const completeMatch = text.match(/^(تم الإصلاح|تم)\s*#?(MNT-2026-\d{4})/i);
    if (completeMatch) {
      const ticketNumber = completeMatch[2].toUpperCase();
      const request = await prisma.maintenanceRequest.findUnique({
        where: { ticketNumber }
      });
      if (!request) {
        return `❌ لم يتم العثور على بلاغ الصيانة بالرقم #${ticketNumber}`;
      }
      this.technicianMntSessions.set(user.phoneNumber, { requestId: request.id, step: 1 });
      return `📸 أرسل صورة الإنجاز (أو اكتب 'بدون صورة'):`;
    }

    const sparePartsMatch = text.match(/^قطع غيار\s*#?(MNT-2026-\d{4})/i);
    if (sparePartsMatch) {
      const ticketNumber = sparePartsMatch[1].toUpperCase();
      const request = await prisma.maintenanceRequest.findUnique({
        where: { ticketNumber }
      });
      if (!request) {
        return `❌ لم يتم العثور على بلاغ الصيانة بالرقم #${ticketNumber}`;
      }
      this.sparePartsSessions.set(user.phoneNumber, request.id);
      return `📦 اذكر القطع المطلوبة:`;
    }

    // Check request menu selections (1-10)
    if (this.requestMenuSessions.has(user.phoneNumber)) {
      const selection = text;
      this.requestMenuSessions.delete(user.phoneNumber);

      const { enabledOptions } = await WhatsAppService.getDynamicMenu(user);
      const index = parseInt(selection, 10) - 1;

      if (isNaN(index) || index < 0 || index >= enabledOptions.length) {
        return `⚠️ خيار غير صحيح. يرجى إرسال كلمة "طلب" لعرض قائمة الخيارات الحالية واختيار رقم صحيح.`;
      }

      const actualSelection = enabledOptions[index].id;

      if (actualSelection === '1') {
        this.maintenanceSessions.set(user.phoneNumber, { step: 1, branchId: user.branchId });
        return `🛠️ اختر نوع العطل:\n` +
               `1️⃣ كهرباء ⚡\n` +
               `2️⃣ سباكة 🚿\n` +
               `3️⃣ تكييف ❄️\n` +
               `4️⃣ نجارة 🪚\n` +
               `5️⃣ نظافة وتجهيز 🧹\n` +
               `6️⃣ عام 🔧\n\n` +
               `أرسل رقم الخيار:`;
      } else if (actualSelection === '2') {
        this.maintenanceSessions.set(user.phoneNumber, { step: 2, branchId: user.branchId, category: 'Cleaning' });
        return `📍 أدخل موقع العطل (رقم الغرفة أو وصف المكان):`;
      } else if (actualSelection === '3') {
        const items = await prisma.item.findMany({
          include: { category: true },
          orderBy: { id: 'asc' }
        });
        if (items.length === 0) {
          return `📦 عذراً، لا تتوفر أي أصناف في المستودع حالياً.`;
        }
        this.warehouseSessions.set(user.phoneNumber, {
          step: 1,
          itemsList: items
        });
        let msg = `📦 *طلب صرف من المستودع*\n\nيرجى اختيار الصنف المطلوب بإرسال رقمه:\n`;
        items.forEach((item, idx) => {
          msg += `${idx + 1}️⃣ ${item.name} (${item.unit})\n`;
        });
        return msg;
      } else if (actualSelection === '4') {
        this.procurementSessions.set(user.phoneNumber, { step: 1, branchId: user.branchId });
        return `🛒 يرجى إدخال اسم الصنف أو الوصف المطلوب شراؤه:`;
      } else if (actualSelection === '5') {
        this.adminRequestSessions.set(user.phoneNumber, true);
        return `💻 تم فتح بلاغ دعم فني وتقني. يرجى إدخال تفاصيل المشكلة (مثال: عطل في شبكة الواي فاي بالاستقبال):`;
      } else if (actualSelection === '6') {
        this.lfSessions.set(user.phoneNumber, { step: 1 });
        return `🛎️ ماذا تريد تسجيل؟\n` +
               `1️⃣ عثرت على غرض مفقود\n` +
               `2️⃣ عميل يبحث عن غرض مفقود`;
      } else if (actualSelection === '7') {
        this.dmgSessions.set(user.phoneNumber, { step: 1 });
        return `💥 رقم الغرفة التي حدث فيها التلف:`;
      } else if (actualSelection === '8') {
        this.loanSessions.set(user.phoneNumber, { step: 1 });
        return `أدخل مبلغ السلفة المطلوب (بالريال):`;
      } else if (actualSelection === '9') {
        this.leaveSessions.set(user.phoneNumber, { step: 1 });
        return `اختر نوع الإجازة:\n` +
               `1️⃣ سنوية (رصيدك: ${user.annualLeaveBalance} يوم)\n` +
               `2️⃣ مرضية (رصيدك: ${user.sickLeaveBalance} يوم)\n` +
               `3️⃣ طارئة\n` +
               `4️⃣ بدون راتب`;
      } else if (actualSelection === '10') {
        this.adminRequestSessions.set(user.phoneNumber, true);
        return `📋 يرجى إدخال تفاصيل طلبك الإداري:`;
      }
    }

    if (text === 'حضور') {
      const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:3001';
      return `للتحقق وتسجيل حضورك، يرجى الضغط على الرابط التالي وتأكيد موقعك الجغرافي:\n` +
             `${frontendUrl}/attendance/check-in?userId=${user.id}&type=CheckIn`;
    }

    if (text === 'انصراف') {
      const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:3001';
      return `للتحقق وتسجيل انصرافك، يرجى الضغط على الرابط التالي وتأكيد موقعك الجغرافي:\n` +
             `${frontendUrl}/attendance/check-in?userId=${user.id}&type=CheckOut`;
    }

    if (text === 'تقفيلة' || text === 'تقفيل' || textLower === 'shift') {
      const allowedRoles: Role[] = [Role.Admin, Role.Receptionist];
      if (!allowedRoles.includes(user.role)) {
        return `❌ عذراً، لا تمتلك صلاحية بدء تقفيلة الوردية بصفتك (${user.role}).`;
      }
      
      const branchId = user.branchId;
      const branch = await prisma.branch.findUnique({ where: { id: branchId } });
      const branchName = branch ? branch.name : '';
      const branchNameAr = branchName === 'Sail Road Branch' ? 'فرع طريق السيل' :
                           branchName === 'Beachside Resort Branch' ? 'فرع منتجع الشاطئ' :
                           branchName;

      // Fetch dynamic active shifts
      const { ShiftService } = require('./shift.service');
      const activeShifts = await ShiftService.getShiftsForBranch(branchId);

      if (activeShifts.length === 0) {
        return `❌ عذراً، لا توجد أي ورديات نشطة لفرعك حالياً. يرجى تهيئة الورديات أولاً من لوحة تحكم الإدارة.`;
      }

      this.shiftReportSessions.set(user.phoneNumber, { step: 1, branchId, shiftsList: activeShifts });

      let shiftsListText = '';
      activeShifts.forEach((s: any, idx: number) => {
        const numEmoji = idx === 0 ? '1️⃣' : idx === 1 ? '2️⃣' : idx === 2 ? '3️⃣' : idx === 3 ? '4️⃣' : `${idx + 1}.`;
        const timeInfo = s.isOpen ? 'مفتوحة' : `${s.startTime} - ${s.endTime}`;
        shiftsListText += `\n${numEmoji} ${s.name} (${timeInfo})`;
      });

      return `مرحباً ${user.name} 👋\n` +
        `سنبدأ تقفيلة وردية فندق ${branchNameAr}.\n` +
        `أولاً، ما هي الوردية؟` +
        shiftsListText;
    }

    // Trigger List Menu (Entry Point)
    if (text === 'طلب' || text === 'قائمة' || text === 'جاهز' || textLower === 'menu') {
      this.clearUserSessions(user.phoneNumber);
      const { menuText } = await WhatsAppService.getDynamicMenu(user);
      this.requestMenuSessions.set(user.phoneNumber, true);
      return menuText;
    }

    if (text === 'مساعدة' || textLower === 'help') {
      return `🤖 الأوامر المتاحة في بوت راحتي:\n` +
             `━━━━━━━━━━━━━━━\n` +
             `📍 حضور — تسجيل بصمة الدخول\n` +
             `📍 انصراف — تسجيل بصمة الخروج\n` +
             `📋 تقفيلة — تقفيلة الوردية المالية\n` +
             `📝 طلب — قائمة جميع الطلبات\n` +
             `❓ مساعدة — عرض هذه القائمة\n` +
             `━━━━━━━━━━━━━━━`;
    }

    if (text === 'طلب سلفة') {
      const settings = await prisma.systemSetting.findMany();
      const settingsMap = settings.reduce((acc: Record<string, string>, curr) => {
        acc[curr.key] = curr.value;
        return acc;
      }, {});
      if (settingsMap.bot_menu_loan === 'false') {
        return `❌ عذراً، خدمة طلب السلفة معطلة حالياً من قبل الإدارة.`;
      }
      this.loanSessions.set(user.phoneNumber, { step: 1 });
      return `أدخل مبلغ السلفة المطلوب (بالريال):`;
    }

    if (text === 'طلب إجازة') {
      const settings = await prisma.systemSetting.findMany();
      const settingsMap = settings.reduce((acc: Record<string, string>, curr) => {
        acc[curr.key] = curr.value;
        return acc;
      }, {});
      if (settingsMap.bot_menu_leave === 'false') {
        return `❌ عذراً، خدمة طلب الإجازة معطلة حالياً من قبل الإدارة.`;
      }
      this.leaveSessions.set(user.phoneNumber, { step: 1 });
      return `اختر نوع الإجازة:\n` +
             `1️⃣ سنوية (رصيدك: ${user.annualLeaveBalance} يوم)\n` +
             `2️⃣ مرضية (رصيدك: ${user.sickLeaveBalance} يوم)\n` +
             `3️⃣ طارئة\n` +
             `4️⃣ بدون راتب`;
    }

    if (text === 'بلاغ تلف') {
      const settings = await prisma.systemSetting.findMany();
      const settingsMap = settings.reduce((acc: Record<string, string>, curr) => {
        acc[curr.key] = curr.value;
        return acc;
      }, {});
      if (settingsMap.bot_menu_damage === 'false') {
        return `❌ عذراً، خدمة تسجيل التلفيات معطلة حالياً من قبل الإدارة.`;
      }
      this.dmgSessions.set(user.phoneNumber, { step: 1 });
      return `💥 رقم الغرفة التي حدث فيها التلف:`;
    }

    if (text === 'بلاغ مفقود' || text === 'تسجيل مفقودات') {
      const settings = await prisma.systemSetting.findMany();
      const settingsMap = settings.reduce((acc: Record<string, string>, curr) => {
        acc[curr.key] = curr.value;
        return acc;
      }, {});
      if (settingsMap.bot_menu_lostfound === 'false') {
        return `❌ عذراً، خدمة تسجيل المفقودات معطلة حالياً من قبل الإدارة.`;
      }
      this.lfSessions.set(user.phoneNumber, { step: 1 });
      return `🛎️ ماذا تريد تسجيل؟\n` +
             `1️⃣ عثرت على غرض مفقود\n` +
             `2️⃣ عميل يبحث عن غرض مفقود`;
    }

    // Direct creation via prefix logic
    const creationMatch = text.match(/^(صيانة|مستودع|مشتريات|Maintenance|Warehouse|Procurement):\s*(.+)$/i);
    if (creationMatch) {
      const typeStr = creationMatch[1].trim().toLowerCase();
      const description = creationMatch[2].trim();

      let type: RequestType;
      if (typeStr === 'صيانة' || typeStr === 'maintenance') type = RequestType.Maintenance;
      else if (typeStr === 'مستودع' || typeStr === 'warehouse') type = RequestType.Warehouse;
      else type = RequestType.Procurement;

      // Check role authorization
      const allowedRoles: Role[] = [Role.Admin, Role.Receptionist, Role.WarehouseManager, Role.Technician];
      if (!allowedRoles.includes(user.role)) {
        return `❌ عذراً، لا تمتلك صلاحية إنشاء بلاغات جديدة بصفتك (${user.role}).`;
      }

      let estimatedCost: number | undefined;
      let cleanedDescription = description;

      if (type === RequestType.Procurement) {
        // Look for cost/price
        const costMatch = description.match(/(?:\bcost\b|price|سعر|تكلفة|ميزانية):\s*(\d+(?:\.\d+)?)/i);
        if (costMatch) {
          estimatedCost = parseFloat(costMatch[1]);
          cleanedDescription = description.replace(costMatch[0], '').trim();
        } else {
          return `⚠️ عذراً، لإنشاء طلب شراء خارجي يرجى تحديد التكلفة التقديرية.\nمثال: "مشتريات: أجهزة تلفزيون جديدة (السعر: 4500)"`;
        }
      }

      // Determine branch
      const selectedBranchId = this.userBranchSessions.get(user.phoneNumber) || user.branchId;
      const targetBranch = await prisma.branch.findUnique({ where: { id: selectedBranchId } });
      const targetBranchName = targetBranch ? targetBranch.name : user.branch.name;

      // Create Request
      const req = await RequestService.createRequest({
        requestType: type,
        branchId: selectedBranchId,
        description: cleanedDescription,
        reporterId: user.id,
        estimatedCost,
      });

      // Clear session
      this.userBranchSessions.delete(user.phoneNumber);

      // Output confirmation
      const branchNameAr = targetBranchName === 'Sail Road Branch' ? 'فرع طريق السيل' : 
                           targetBranchName === 'Beachside Resort Branch' ? 'فرع منتجع الشاطئ' : 
                           targetBranchName;

      let response = `✅ *تم إنشاء طلبك بنجاح!* \n\n` +
        `• *رقم التذكرة*: \`${req.id.slice(-6).toUpperCase()}\`\n` +
        `• *نوع الطلب*: ${type === RequestType.Maintenance ? 'صيانة' : type === RequestType.Warehouse ? 'مستودع' : 'شراء خارجي'}\n` +
        `• *الفرع*: ${branchNameAr}\n` +
        `• *البيان*: ${req.description}\n`;

      if (req.estimatedCost) {
        response += `• *التكلفة*: $${req.estimatedCost}\n`;
      }

      // Procurement threshold evaluation
      if (type === RequestType.Procurement) {
        if (req.approvalStatus === ApprovalStatus.Pending_CEO) {
          response += `\n⚠️ *تنبيه*: يتجاوز هذا الطلب الحد المسموح به للفرع ($5,000) وتم توجيهه تلقائياً إلى *الرئيس التنفيذي* للمراجعة والاعتماد.`;
          
          // Send simulated notification to CEO
          this.sendSimulatedApprovalMessage('+1234567891', 'الرئيس التنفيذي', req);
        } else {
          response += `\n⏳ الطلب بانتظار مراجعة واعتماد *المدير المالي* للفندق.`;
          
          // Send simulated notification to Finance Manager
          this.sendSimulatedApprovalMessage('+1234567892', 'المدير المالي', req);
        }
      }

      return response;
    }

    // Display Active requests
    if (text === 'سجل' || text === 'حالة' || textLower === 'status' || textLower === 'list') {
      return await this.listUserRequests(user);
    }

    // Welcome message for first-time users (when no session exists and message is not a known keyword)
    const knownKeywords = [
      'حضور', 'انصراف', 'تقفيلة', 'تقفيل', 'shift', 'طلب', 'جاهز', 
      'menu', 'help', 'مساعدة', 'قائمة', 'طلب سلفة', 'طلب إجازة',
      'بلاغ تلف', 'بلاغ مفقود', 'تسجيل مفقودات'
    ];
    const isKeyword = knownKeywords.includes(text) || 
                      text.startsWith('صيانة:') || 
                      text.startsWith('مستودع:') || 
                      text.startsWith('مشتريات:') ||
                      /^(صيانة|مستودع|مشتريات|Maintenance|Warehouse|Procurement):\s*(.+)$/i.test(text);

    if (!isKeyword) {
      return `مرحباً ${user.name} في بوت راحتي للفنادق 🏨\n` +
             `يمكنك البدء بكتابة:\n` +
             `📍 حضور | انصراف\n` +
             `📋 تقفيلة\n` +
             `📝 طلب\n` +
             `❓ مساعدة`;
    }

    return `⚠️ أمر غير معروف. أرسل كلمة *طلب* لعرض قائمة الخدمات والخيارات المتاحة.`;
  }

  /**
   * Handle Button Replies (Interactions)
   */
  private static async handleButtonReply(parsed: ParsedWhatsAppMessage, user: any): Promise<string> {
    const buttonId = parsed.buttonId || '';

    // Confirm/Cancel Lost & Found
    if (buttonId === 'confirm_lf_btn') {
      const session = this.lfSessions.get(user.phoneNumber);
      if (!session || !session.location || !session.description) {
        return `❌ لا توجد جلسة تسجيل مفقودات نشطة حالياً أو البيانات غير مكتملة.`;
      }
      const { LostFoundService } = require('./lostfound.service');
      await LostFoundService.createLostItem({
        reportedBy: user.id,
        branchId: user.branchId,
        location: session.location,
        description: session.description,
        photoUrl: session.photoUrl,
        guestName: session.guestName === 'غير معروف' ? null : session.guestName,
        guestPhone: session.guestPhone
      });
      this.lfSessions.delete(user.phoneNumber);
      return `✅ تم تسجيل الغرض المفقود بنجاح ونقله إلى المستودع.`;
    }

    if (buttonId === 'cancel_lf_btn') {
      this.lfSessions.delete(user.phoneNumber);
      return `❌ تم إلغاء تسجيل المفقودات.`;
    }

    // Confirm/Cancel Damage Report
    if (buttonId === 'confirm_dmg_btn') {
      const session = this.dmgSessions.get(user.phoneNumber);
      if (!session || !session.roomNumber || !session.damageType || !session.description) {
        return `❌ لا توجد جلسة بلاغ تلفيات نشطة أو البيانات غير مكتملة.`;
      }
      const { LostFoundService } = require('./lostfound.service');
      await LostFoundService.createDamageReport({
        reportedBy: user.id,
        branchId: user.branchId,
        roomNumber: session.roomNumber,
        damageType: session.damageType,
        description: session.description,
        photoUrls: JSON.stringify(session.photoUrls || []),
        reportedDuring: session.reportedDuring,
        reservationRef: session.reservationRef,
        guestName: session.guestName === 'غير معروف' ? null : session.guestName,
        guestPhone: session.guestPhone
      });
      this.dmgSessions.delete(user.phoneNumber);
      return `✅ تم تسجيل بلاغ التلفيات بنجاح وإحالة التذكرة للمدير للمراجعة.`;
    }

    if (buttonId === 'cancel_dmg_btn') {
      this.dmgSessions.delete(user.phoneNumber);
      return `❌ تم إلغاء تسجيل بلاغ التلفيات.`;
    }

    // Contact guest click
    if (buttonId.startsWith('lf_contact_btn_')) {
      const id = buttonId.replace('lf_contact_btn_', '');
      const { LostFoundService } = require('./lostfound.service');
      await LostFoundService.updateGuestContact(id);
      return `📞 تم تحديث الحالة: تم التواصل مع العميل بنجاح.`;
    }

    // Review Damage report click
    if (buttonId.startsWith('dmg_review_btn_')) {
      const id = buttonId.replace('dmg_review_btn_', '');
      this.dmgReviewSessions.set(user.phoneNumber, { requestId: id, step: 1 });
      return `💰 ما قيمة التعويض المقترحة؟ (بالريال):`;
    }

    // Accept payment click
    if (buttonId.startsWith('dmg_accept_btn_')) {
      const id = buttonId.replace('dmg_accept_btn_', '');
      this.dmgPaymentSessions.set(user.phoneNumber, { requestId: id, step: 1 });
      return `💳 طريقة الدفع؟\n` +
             `1️⃣ كاش 💵\n` +
             `2️⃣ شبكة/مدى 💳\n` +
             `3️⃣ تحويل بنكي 🏦\n` +
             `4️⃣ آجل ⏰`;
    }

    // Refuse payment click
    if (buttonId.startsWith('dmg_refuse_btn_')) {
      const id = buttonId.replace('dmg_refuse_btn_', '');
      this.dmgRefusalSessions.set(user.phoneNumber, id);
      return `📝 سبب الرفض:`;
    }

    // Waive damage click
    if (buttonId.startsWith('dmg_waive_btn_')) {
      const id = buttonId.replace('dmg_waive_btn_', '');
      this.dmgWaiverSessions.set(user.phoneNumber, id);
      return `📝 سبب الإسقاط:`;
    }

    // Confirm/Cancel Loan Submit
    if (buttonId === 'confirm_loan_submit') {
      const session = this.loanSessions.get(user.phoneNumber);
      if (!session || !session.amount || !session.reason) {
        return `❌ لا توجد جلسة طلب سلفة نشطة حالياً أو البيانات غير مكتملة.`;
      }
      
      const { LoanService } = require('./loan.service');
      const loan = await LoanService.createLoanRequest(user.id, session.amount, session.reason);
      this.loanSessions.delete(user.phoneNumber);

      // Notify Accountants
      const accountants = await prisma.user.findMany({ where: { role: Role.Accountant } });
      const branchNameAr = user.branch.name === 'Sail Road Branch' ? 'فرع طريق السيل' :
                           user.branch.name === 'Beachside Resort Branch' ? 'فرع منتجع الشاطئ' :
                           user.branch.name;

      const accountantMsg = `💰 *طلب سلفة جديد*\n` +
                            `👤 *الموظف*: ${user.name} | *الفرع*: ${branchNameAr}\n` +
                            `💵 *المبلغ*: ${loan.amount} ريال\n` +
                            `📝 *السبب*: ${loan.reason}\n` +
                            `*الوقت*: ${new Date(loan.createdAt).toLocaleTimeString('ar-EG', { hour: '2-digit', minute: '2-digit' })}\n\n` +
                            `[ ✅ موافقة ] (زر: approve_loan_req_${loan.id})\n` +
                            `[ ❌ رفض ] (زر: reject_loan_req_${loan.id})`;

      for (const accountant of accountants) {
        this.mockSendWhatsAppMessage(accountant.phoneNumber, accountantMsg);
      }

      if (accountants.length === 0) {
        this.mockSendWhatsAppMessage('+1234567896', accountantMsg);
      }

      return `✅ تم إرسال طلب السلفة بمبلغ ${loan.amount} ريال بنجاح.`;
    }

    if (buttonId === 'cancel_loan_submit') {
      this.loanSessions.delete(user.phoneNumber);
      return `❌ تم إلغاء طلب السلفة.`;
    }

    // Confirm/Cancel Leave Submit
    if (buttonId === 'confirm_leave_submit') {
      const session = this.leaveSessions.get(user.phoneNumber);
      if (!session || !session.leaveType || !session.startDate || !session.endDate || !session.reason) {
        return `❌ لا توجد جلسة طلب إجازة نشطة حالياً أو البيانات غير مكتملة.`;
      }

      const { LeaveService } = require('./leave.service');
      const leave = await LeaveService.createLeaveRequest(
        user.id,
        session.leaveType,
        session.startDate,
        session.endDate,
        session.reason
      );
      this.leaveSessions.delete(user.phoneNumber);

      // Notify BranchManager & Admin
      const managers = await prisma.user.findMany({
        where: {
          role: Role.BranchManager,
          branchId: user.branchId
        }
      });
      const admins = await prisma.user.findMany({
        where: {
          role: Role.Admin
        }
      });

      const typeAr = leave.leaveType === 'Annual' ? 'سنوية' :
                     leave.leaveType === 'Sick' ? 'مرضية' :
                     leave.leaveType === 'Emergency' ? 'طارئة' : 'بدون راتب';

      const branchNameAr = user.branch.name === 'Sail Road Branch' ? 'فرع طريق السيل' :
                           user.branch.name === 'Beachside Resort Branch' ? 'فرع منتجع الشاطئ' :
                           user.branch.name;

      const notifyMsg = `🏖️ *طلب إجازة جديد*\n` +
                        `👤 *الموظف*: ${user.name} | *الفرع*: ${branchNameAr}\n` +
                        `📅 *النوع*: ${typeAr} | ${leave.daysCount} أيام\n` +
                        `📆 *من* ${session.startDate} *إلى* ${session.endDate}\n` +
                        `📝 *السبب*: ${leave.reason}\n\n` +
                        `[ ✅ موافقة ] (زر: approve_leave_req_${leave.id})\n` +
                        `[ ❌ رفض ] (زر: reject_leave_req_${leave.id})`;

      const notifiedPhones = new Set<string>();
      for (const m of managers) {
        if (m.phoneNumber) notifiedPhones.add(m.phoneNumber);
      }
      for (const a of admins) {
        if (a.phoneNumber) notifiedPhones.add(a.phoneNumber);
      }

      for (const phone of notifiedPhones) {
        this.mockSendWhatsAppMessage(phone, notifyMsg);
      }

      if (notifiedPhones.size === 0) {
        this.mockSendWhatsAppMessage('+1234567890', notifyMsg);
      }

      return `✅ تم إرسال طلب إجازتك بنجاح (${leave.daysCount} أيام).`;
    }

    if (buttonId === 'cancel_leave_submit') {
      this.leaveSessions.delete(user.phoneNumber);
      return `❌ تم إلغاء طلب الإجازة.`;
    }

    // Accountant/Reviewer approvals/rejections
    const matchApproveLoan = buttonId.match(/^approve_loan_req_(.+)$/);
    if (matchApproveLoan) {
      const loanId = matchApproveLoan[1];
      const loan = await prisma.loanRequest.findUnique({
        where: { id: loanId },
        include: { user: true }
      });
      if (!loan) return '❌ لم يتم العثور على طلب السلفة.';
      
      const { LoanService } = require('./loan.service');
      await LoanService.reviewLoanRequest(loanId, user.id, 'Approved');

      // Notify employee
      this.mockSendWhatsAppMessage(
        loan.user.phoneNumber,
        `✅ تمت الموافقة على طلب سلفتك بمبلغ ${loan.amount} ريال. تواصل مع المحاسب لاستلام المبلغ.`
      );

      return `✅ تم الموافقة على طلب السلفة للموظف ${loan.user.name} بنجاح.`;
    }

    const matchRejectLoan = buttonId.match(/^reject_loan_req_(.+)$/);
    if (matchRejectLoan) {
      const loanId = matchRejectLoan[1];
      this.loanRejectionSessions.set(user.phoneNumber, loanId);
      return `أدخل سبب الرفض:`;
    }

    const matchApproveLeave = buttonId.match(/^approve_leave_req_(.+)$/);
    if (matchApproveLeave) {
      const leaveId = matchApproveLeave[1];
      const leave = await prisma.leaveRequest.findUnique({
        where: { id: leaveId },
        include: { user: true }
      });
      if (!leave) return '❌ لم يتم العثور على طلب الإجازة.';

      const { LeaveService } = require('./leave.service');
      await LeaveService.reviewLeaveRequest(leaveId, user.id, 'Approved');
      const updatedUser = await prisma.user.findUnique({ where: { id: leave.userId } });

      const newBalance = leave.leaveType === 'Annual' ? updatedUser?.annualLeaveBalance :
                         leave.leaveType === 'Sick' ? updatedUser?.sickLeaveBalance : null;
      const balanceStr = newBalance !== null ? `الأيام المتبقية: ${newBalance}` : '';

      const startFormatted = new Date(leave.startDate).toISOString().split('T')[0];
      const endFormatted = new Date(leave.endDate).toISOString().split('T')[0];

      // Notify employee
      this.mockSendWhatsAppMessage(
        leave.user.phoneNumber,
        `✅ تمت الموافقة على إجازتك من ${startFormatted} إلى ${endFormatted}. ${balanceStr}`
      );

      return `✅ تم الموافقة على طلب الإجازة للموظف ${leave.user.name} بنجاح.`;
    }

    const matchRejectLeave = buttonId.match(/^reject_leave_req_(.+)$/);
    if (matchRejectLeave) {
      const leaveId = matchRejectLeave[1];
      this.leaveRejectionSessions.set(user.phoneNumber, leaveId);
      return `أدخل سبب الرفض:`;
    }

    // Handle branch selection
    const matchBranchSelect = buttonId.match(/^branch_select_(.+)$/);
    if (matchBranchSelect) {
      const branchId = matchBranchSelect[1];
      const branch = await prisma.branch.findUnique({ where: { id: branchId } });
      if (!branch) return `❌ الفرع المحدد غير موجود.`;

      // Save branch to session for subsequent text inputs from this user
      this.userBranchSessions.set(user.phoneNumber, branchId);

      const branchNameAr = branch.name === 'Sail Road Branch' ? 'فرع طريق السيل' : 
                           branch.name === 'Beachside Resort Branch' ? 'فرع منتجع الشاطئ' : 
                           branch.name;

      let response = `🏢 *فرع العمليات المختار: ${branchNameAr}*\n\n` +
        `يرجى اختيار الخدمة المطلوبة لهذا الفرع:\n` +
        `[1] 🛠️ طلب صيانة (أرسل زر: menu_req_maintenance_${branch.id})\n` +
        `[2] 📦 طلب مستودع (أرسل زر: menu_req_warehouse_${branch.id})\n` +
        `[3] 🛒 طلب شراء خارجي (أرسل زر: menu_req_procurement_${branch.id})`;

      if (user.role === Role.Receptionist) {
        response += `\n[4] 📋 تقفيلة وردية (أرسل زر: start_shift_report_${branch.id})`;
      }
      return response;
    }

    // Shift Report Initiator
    const matchStartShift = buttonId.match(/^start_shift_report_(.+)$/);
    if (matchStartShift || buttonId === 'start_shift_report') {
      const branchId = matchStartShift ? matchStartShift[1] : user.branchId;
      const branch = await prisma.branch.findUnique({ where: { id: branchId } });
      const branchName = branch ? branch.name : '';
      const branchNameAr = branchName === 'Sail Road Branch' ? 'فرع طريق السيل' :
                           branchName === 'Beachside Resort Branch' ? 'فرع منتجع الشاطئ' :
                           branchName;

      // Fetch dynamic active shifts
      const { ShiftService } = require('./shift.service');
      const activeShifts = await ShiftService.getShiftsForBranch(branchId);

      if (activeShifts.length === 0) {
        return `❌ عذراً، لا توجد أي ورديات نشطة لفرعك حالياً. يرجى تهيئة الورديات أولاً من لوحة تحكم الإدارة.`;
      }

      this.shiftReportSessions.set(user.phoneNumber, { step: 1, branchId, shiftsList: activeShifts });

      let shiftsListText = '';
      activeShifts.forEach((s: any, idx: number) => {
        const numEmoji = idx === 0 ? '1️⃣' : idx === 1 ? '2️⃣' : idx === 2 ? '3️⃣' : idx === 3 ? '4️⃣' : `${idx + 1}.`;
        const timeInfo = s.isOpen ? 'مفتوحة' : `${s.startTime} - ${s.endTime}`;
        shiftsListText += `\n${numEmoji} ${s.name} (${timeInfo})`;
      });

      return `مرحباً ${user.name} 👋\n` +
        `سنبدأ تقفيلة وردية فندق ${branchNameAr}.\n` +
        `أولاً، ما هي الوردية؟` +
        shiftsListText;
    }

    // Confirm/Cancel Shift Report Submit
    if (buttonId === 'confirm_shift_submit') {
      return await this.handleConfirmShiftSubmit(user);
    }
    if (buttonId === 'cancel_shift_submit') {
      return await this.handleCancelShiftSubmit(user);
    }

    // Accountant Shift Report Approval/Rejection
    const matchApproveShift = buttonId.match(/^approve_shift_(.+)$/);
    if (matchApproveShift) {
      const shiftId = matchApproveShift[1];
      return await this.handleApproveShiftReport(shiftId, user);
    }
    const matchRejectShift = buttonId.match(/^reject_shift_(.+)$/);
    if (matchRejectShift) {
      const shiftId = matchRejectShift[1];
      return await this.handleRejectShiftReport(shiftId, user);
    }

    // 3-Tier External Procurement Initiator
    const matchStartProc = buttonId.match(/^start_external_procurement_(.+)$/);
    if (matchStartProc || buttonId === 'start_external_procurement') {
      const branchId = matchStartProc ? matchStartProc[1] : user.branchId;
      this.procurementSessions.set(user.phoneNumber, { step: 1, branchId });
      return `🛒 يرجى إدخال اسم الصنف أو الوصف المطلوب شراؤه:`;
    }

    // Financial Manager Procurement Approval/Rejection
    const matchApproveProc = buttonId.match(/^approve_proc_(.+)$/);
    const matchRejectProc = buttonId.match(/^reject_proc_(.+)$/);

    if (matchApproveProc) {
      const requestId = matchApproveProc[1];
      const request = await prisma.request.findUnique({
        where: { id: requestId },
        include: { reporter: true, branch: true }
      });
      if (!request) return "❌ لم يتم العثور على الطلب.";

      await RequestService.updateRequest(requestId, {
        approvalStatus: ApprovalStatus.Approved,
        status: RequestStatus.Pending
      });

      const branchNameAr = request.branch.name === 'Sail Road Branch' ? 'فرع طريق السيل' :
                           request.branch.name === 'Beachside Resort Branch' ? 'فرع منتجع الشاطئ' :
                           request.branch.name;

      // Notify Procurement Officer
      const officer = await prisma.user.findFirst({ where: { role: Role.WarehouseManager } });
      const officerPhone = officer ? officer.phoneNumber : '+1234567895';
      this.mockSendWhatsAppMessage(officerPhone, `🔔 تم اعتماد شراء (${request.description.replace('شراء خارجي: ', '')}) بتكلفة (${request.estimatedCost}) لفرع (${branchNameAr}). الرجاء البدء في عملية الشراء.`);

      // Notify Technician
      if (request.reporter?.phoneNumber) {
        this.mockSendWhatsAppMessage(request.reporter.phoneNumber, `🔔 طلبك لشراء (${request.description.replace('شراء خارجي: ', '')}) قد تم اعتماده ماليّاً وهو قيد التوفير والطلب الآن.`);
      }

      return "✅ تم تأكيد التعميد المالي للطلب بنجاح.";
    }

    if (matchRejectProc) {
      const requestId = matchRejectProc[1];
      const request = await prisma.request.findUnique({
        where: { id: requestId },
        include: { reporter: true, branch: true }
      });
      if (!request) return "❌ لم يتم العثور على الطلب.";

      await RequestService.updateRequest(requestId, {
        approvalStatus: ApprovalStatus.Rejected,
        status: RequestStatus.Rejected
      });

      const branchNameAr = request.branch.name === 'Sail Road Branch' ? 'فرع طريق السيل' :
                           request.branch.name === 'Beachside Resort Branch' ? 'فرع منتجع الشاطئ' :
                           request.branch.name;

      // Notify Procurement Officer
      const officer = await prisma.user.findFirst({ where: { role: Role.WarehouseManager } });
      const officerPhone = officer ? officer.phoneNumber : '+1234567895';
      this.mockSendWhatsAppMessage(officerPhone, `❌ تم رفض شراء (${request.description.replace('شراء خارجي: ', '')}) لفرع (${branchNameAr}) من قبل الإدارة المالية.`);

      // Notify Technician
      if (request.reporter?.phoneNumber) {
        this.mockSendWhatsAppMessage(request.reporter.phoneNumber, `❌ عذراً، تم رفض طلبك لشراء (${request.description.replace('شراء خارجي: ', '')}) من قبل الإدارة المالية.`);
      }

      return "❌ تم رفض التعميد المالي للطلب.";
    }

    // 1. Menu Selections
    const matchReqMaintenance = buttonId.match(/^menu_req_maintenance_(.+)$/);
    const matchReqWarehouse = buttonId.match(/^menu_req_warehouse_(.+)$/);
    const matchReqProcurement = buttonId.match(/^menu_req_procurement_(.+)$/);

    if (matchReqMaintenance || buttonId === 'menu_request_maintenance') {
      const branchId = matchReqMaintenance ? matchReqMaintenance[1] : user.branchId;
      this.userBranchSessions.set(user.phoneNumber, branchId);
      return `🛠️ لتقديم طلب صيانة جديدة للفرع المختار، يرجى كتابة التفاصيل بالشكل التالي:\n\n*صيانة: [تفاصيل العطل وموقعه]*\n\nمثال:\n_صيانة: تسريب مياه في سقف الغرفة 402_`;
    }
    if (matchReqWarehouse || buttonId === 'menu_request_warehouse') {
      const branchId = matchReqWarehouse ? matchReqWarehouse[1] : user.branchId;
      this.userBranchSessions.set(user.phoneNumber, branchId);

      const availableItems = await prisma.inventoryItem.findMany({
        where: {
          status: 'Available',
        },
        include: {
          branch: true,
        },
      });

      if (availableItems.length === 0) {
        return `📦 عذراً، لا تتوفر أي أصناف حالياً في أي من مستودعات الفندق.\n\n` +
               `[🛒 طلب شراء خارجي] (زر: start_external_procurement_${branchId})`;
      }

      let response = `📦 *الأصناف المتاحة في جميع المستودعات حالياً:*\n\n`;
      availableItems.forEach((item, index) => {
        const branchNameAr = item.branch
          ? (item.branch.name === 'Sail Road Branch' ? 'فرع طريق السيل' :
             item.branch.name === 'Beachside Resort Branch' ? 'فرع منتجع الشاطئ' :
             item.branch.name)
          : '';
        response += `${index + 1}. *${item.name} - ${branchNameAr}* (القسم: ${item.category} | المتوفر: ${item.stockLevel})\n`;
      });
      response += `\nلطلب أي صنف، يرجى كتابة البلاغ بالشكل التالي:\n*مستودع: طلب [اسم الصنف] (الكمية: [العدد])*\n\n` +
                  `أو إذا لم يكن الصنف متوفراً بالقسم:\n` +
                  `[🛒 طلب شراء خارجي] (زر: start_external_procurement_${branchId})`;
      return response;
    }
    if (matchReqProcurement || buttonId === 'menu_request_procurement') {
      const branchId = matchReqProcurement ? matchReqProcurement[1] : user.branchId;
      this.userBranchSessions.set(user.phoneNumber, branchId);
      return `🛒 لتقديم طلب شراء خارجي (مشتريات) للفرع المختار، يرجى الكتابة كالتالي (مع إدراج السعر التقديري):\n\n*مشتريات: [الطلب] (السعر: [القيمة])*\n\nمثال:\n_مشتريات: جهاز ميكروويف للمطبخ الرئيسي (السعر: 350)_`;
    }

    // 2. Executive approvals
    const matchApprove = buttonId.match(/^approve_req_(.+)$/);
    const matchReject = buttonId.match(/^reject_req_(.+)$/);

    if (matchApprove) {
      const requestId = matchApprove[1];
      if (user.role !== Role.CEO && user.role !== Role.FinanceManager && user.role !== Role.Admin) {
        return `❌ غير مصرح: يمتلك المدير المالي والرئيس التنفيذي فقط صلاحية الاعتماد.`;
      }

      const request = await prisma.request.findUnique({ where: { id: requestId } });
      if (!request) return `❌ لم يتم العثور على الطلب.`;

      await RequestService.updateRequest(requestId, {
        approvalStatus: ApprovalStatus.Approved,
        status: RequestStatus.Pending,
      });

      return `✅ *تم اعتماد طلب المشتريات بنجاح*\nرقم التذكرة: \`${requestId.slice(-6).toUpperCase()}\`\nالحالة الآن: *بانتظار التنفيذ*.`;
    }

    if (matchReject) {
      const requestId = matchReject[1];
      if (user.role !== Role.CEO && user.role !== Role.FinanceManager && user.role !== Role.Admin) {
        return `❌ غير مصرح: يمتلك المدير المالي والرئيس التنفيذي فقط صلاحية الرفض.`;
      }

      const request = await prisma.request.findUnique({ where: { id: requestId } });
      if (!request) return `❌ لم يتم العثور على الطلب.`;

      await RequestService.updateRequest(requestId, {
        approvalStatus: ApprovalStatus.Rejected,
        status: RequestStatus.Rejected,
      });

      return `❌ *تم رفض طلب الشراء*\nتمت أرشفة الطلب رقم \`${requestId.slice(-6).toUpperCase()}\` كمرفوض.`;
    }

    // 3. Technician Completed task trigger
    const matchComplete = buttonId.match(/^complete_req_(.+)$/);
    if (matchComplete) {
      const requestId = matchComplete[1];
      if (user.role !== Role.Technician && user.role !== Role.Admin) {
        return `❌ الصلاحية غير كافية: الفنيون فقط هم من يستطيعون إغلاق مهام الصيانة.`;
      }

      // Register session: waiting for technician to upload photo
      this.technicianSessions.set(user.phoneNumber, requestId);

      return `📷 *يرجى إرفاق صورة إثبات الإنجاز الميداني الآن لإكمال إغلاق التذكرة.*`;
    }

    // 4. Reporter Confirm Fix Buttons (Dual-Closure)
    const matchConfirmYes = buttonId.match(/^reporter_confirm_yes_(.+)$/);
    const matchConfirmNo = buttonId.match(/^reporter_confirm_no_(.+)$/);

    if (matchConfirmYes) {
      const requestId = matchConfirmYes[1];
      
      // Register session: waiting for rating input
      this.ratingSessions.set(user.phoneNumber, requestId);

      // Send interactive rating options
      return `🌟 *شكراً لتأكيد الإصلاح!*\n\nيرجى تقييم جودة الخدمة المقدمة وسرعة الفني من خلال اختيار أحد النجوم:\n\n` +
        `[5 ⭐️ ممتازة] (اضغط زر 5)\n` +
        `[4 ⭐️ جيدة جداً] (اضغط زر 4)\n` +
        `[3 ⭐️ أو أقل] (اضغط زر 3)\n\n` +
        `_أو اكتب التقييم كرقم مباشرة (من 1 إلى 5)._`;
    }

    if (matchConfirmNo) {
      const requestId = matchConfirmNo[1];
      const request = await prisma.request.findUnique({
        where: { id: requestId }
      });

      if (!request) return `❌ لم يتم العثور على التذكرة.`;

      // Register session to wait for rejection reason text note from this reporter
      this.rejectionSessions.set(user.phoneNumber, requestId);

      return `❌ *طلب إعادة عمل البلاغ*\n\nيرجى كتابة سبب رفض الإنجاز وتحديد المطلوب لإعادة العمل (مثال: العمل غير مكتمل، يحتاج تنظيف الموقع).`;
    }

    // 5. Rating Selection Button replies
    const matchRating = buttonId.match(/^rating_(\d)_(.+)$/);
    if (matchRating) {
      const ratingVal = parseInt(matchRating[1], 10);
      const requestId = matchRating[2];

      await RequestService.updateRequest(requestId, {
        status: RequestStatus.Completed,
        rating: ratingVal
      });

      this.ratingSessions.delete(user.phoneNumber);

      return `🎉 *تم إغلاق البلاغ بنجاح!*\n\nشكراً لك على تقييم الخدمة بـ (${ratingVal} نجوم). يومك سعيد!`;
    }

    // 6. Maintenance Module Button Replies
    if (buttonId === 'confirm_maintenance_submit') {
      const session = this.maintenanceSessions.get(user.phoneNumber);
      if (!session) return `❌ انتهت الجلسة. يرجى تقديم طلب جديد.`;
      
      const { MaintenanceService } = require('./maintenance.service');
      const req = await MaintenanceService.createRequest({
        reportedBy: user.id,
        branchId: session.branchId,
        category: session.category || 'General',
        location: session.location || '',
        description: session.description || '',
        photoUrl: session.photoUrl,
        priority: session.priority || 'Normal'
      });

      this.maintenanceSessions.delete(user.phoneNumber);

      return `✅ تم إرسال بلاغك بنجاح\n🎫 رقم البلاغ: #${req.ticketNumber}\nسيتم التواصل معك فور تعيين الفني المختص.`;
    }

    if (buttonId === 'cancel_maintenance_submit') {
      this.maintenanceSessions.delete(user.phoneNumber);
      return `❌ تم إلغاء تقديم بلاغ الصيانة.`;
    }

    const matchAssignTechBtn = buttonId.match(/^(assign_tech_btn_|reassign_tech_btn_)(.+)$/);
    if (matchAssignTechBtn) {
      const requestId = matchAssignTechBtn[2];
      const techs = await prisma.user.findMany({
        where: { role: 'Technician', isAvailable: true }
      });
      if (techs.length === 0) {
        return `❌ لا يوجد فنيين متاحين حالياً.`;
      }
      
      const techListWithCounts = [];
      for (const tech of techs) {
        const openCount = await prisma.maintenanceRequest.count({
          where: {
            assignedTo: tech.id,
            status: { in: ['AssignedToTechnician', 'InProgress', 'SpareParts', 'Rejected'] }
          }
        });
        techListWithCounts.push({ ...tech, openCount });
      }

      this.supervisorAssignSessions.set(user.phoneNumber, { requestId, techs: techListWithCounts });

      let msg = `👷 *اختر الفني المناسب لهذا البلاغ:*\n`;
      techListWithCounts.forEach((tech, idx) => {
        const emoji = idx === 0 ? '1️⃣' : idx === 1 ? '2️⃣' : `${idx + 1}.`;
        msg += `${emoji} ${tech.name} - (${tech.openCount} بلاغات مفتوحة)\n`;
      });
      msg += `أرسل رقم الفني:`;
      return msg;
    }

    const matchStart = buttonId.match(/^start_work_req_(.+)$/);
    if (matchStart) {
      const requestId = matchStart[1];
      const { MaintenanceService } = require('./maintenance.service');
      const req = await MaintenanceService.startWork(requestId, user.id);
      return `✅ تم تسجيل بدء العمل على البلاغ #${req.ticketNumber}\nأرسل تقرير الإنجاز عند الانتهاء بكتابة 'تم الإصلاح [رقم البلاغ]'`;
    }

    const matchInfo = buttonId.match(/^info_req_(.+)$/);
    if (matchInfo) {
      const requestId = matchInfo[1];
      const req = await prisma.maintenanceRequest.findUnique({
        where: { id: requestId },
        include: { branch: true }
      });
      if (!req) return `❌ لم يتم العثور على البلاغ.`;
      
      const categoryMapAr: { [key: string]: string } = {
        'Electrical': 'كهرباء ⚡',
        'Plumbing': 'سباكة 🚿',
        'AC': 'تكييف ❄️',
        'Carpentry': 'نجارة 🪚',
        'Cleaning': 'نظافة وتجهيز 🧹',
        'General': 'عام 🔧'
      };
      
      return `🎫 *رقم البلاغ*: #${req.ticketNumber}\n` +
             `🏨 *الفرع*: ${req.branch.name}\n` +
             `🔧 *النوع*: ${categoryMapAr[req.category] || req.category}\n` +
             `📍 *الموقع*: ${req.location}\n` +
             `📝 *الوصف*: ${req.description}\n` +
             `⚡ *الأولوية*: ${req.priority}`;
    }

    const matchApproveMnt = buttonId.match(/^approve_mnt_completion_(.+)$/);
    if (matchApproveMnt) {
      const requestId = matchApproveMnt[1];
      this.maintenanceApprovalSessions.set(user.phoneNumber, { requestId, action: 'approve' });
      return `💬 أضف ملاحظة (اختياري - أو اكتب 'تخطي'):`;
    }

    const matchRejectMnt = buttonId.match(/^reject_mnt_completion_(.+)$/);
    if (matchRejectMnt) {
      const requestId = matchRejectMnt[1];
      this.maintenanceApprovalSessions.set(user.phoneNumber, { requestId, action: 'reject' });
      return `📝 أدخل سبب الرفض:`;
    }

    const matchResume = buttonId.match(/^resume_req_(.+)$/);
    if (matchResume) {
      const requestId = matchResume[1];
      const { MaintenanceService } = require('./maintenance.service');
      const req = await MaintenanceService.resumeAfterParts(requestId, user.id);
      return `✅ تم استئناف البلاغ #${req.ticketNumber} بنجاح وإبلاغ الفني المختص.`;
    }

    // Warehouse & Procurement Module Button Replies
    if (buttonId === 'confirm_whr_submit') {
      const session = this.warehouseSessions.get(user.phoneNumber);
      if (!session || !session.itemId || !session.quantity) {
        return `❌ لا توجد جلسة طلب صرف نشطة أو البيانات غير مكتملة.`;
      }
      const { WarehouseService } = require('./warehouse.service');
      const req = await WarehouseService.createWarehouseRequest({
        requestedBy: user.id,
        branchId: user.branchId,
        itemId: session.itemId,
        quantityRequested: session.quantity,
        purpose: session.purpose
      });
      this.warehouseSessions.delete(user.phoneNumber);
      return `✅ تم تقديم طلب صرف مستودع #${req.ticketNumber} بنجاح وبانتظار اعتماد أمين المستودع.`;
    }

    if (buttonId === 'cancel_whr_submit') {
      this.warehouseSessions.delete(user.phoneNumber);
      return `❌ تم إلغاء طلب الصرف من المستودع.`;
    }

    const matchIssueFull = buttonId.match(/^issue_full_(.+)$/);
    if (matchIssueFull) {
      const whrId = matchIssueFull[1];
      const whr = await prisma.warehouseRequest.findUnique({
        where: { id: whrId },
        include: { item: true, requester: true }
      });
      if (!whr) return '❌ لم يتم العثور على طلب الصرف.';
      
      const stockEntry = await prisma.stockEntry.findUnique({
        where: { itemId_branchId: { itemId: whr.itemId, branchId: whr.branchId } }
      });
      const available = stockEntry ? stockEntry.quantity : 0;
      if (available < whr.quantityRequested) {
        return `❌ لا يمكن صرف الكمية كاملة. المتوفر في المستودع حالياً: ${available} ${whr.item.unit} (المطلوب: ${whr.quantityRequested})`;
      }
      
      const { WarehouseService } = require('./warehouse.service');
      await WarehouseService.approveWarehouseRequest(whrId, user.id, whr.quantityRequested);
      return `✅ تم صرف الكمية كاملة (${whr.quantityRequested} ${whr.item.unit}) لطلب الصرف #${whr.ticketNumber} للموظف ${whr.requester.name} بنجاح.`;
    }

    const matchIssuePartial = buttonId.match(/^issue_partial_(.+)$/);
    if (matchIssuePartial) {
      const whrId = matchIssuePartial[1];
      this.warehouseApprovalSessions.set(user.phoneNumber, { requestId: whrId, action: 'issue_partial' });
      return `🔢 يرجى إدخال الكمية المصروفة لطلب الصرف:`;
    }

    const matchRejectWHR = buttonId.match(/^reject_whr_(.+)$/);
    if (matchRejectWHR) {
      const whrId = matchRejectWHR[1];
      this.warehouseApprovalSessions.set(user.phoneNumber, { requestId: whrId, action: 'reject' });
      return `❌ يرجى إدخال سبب الرفض لطلب الصرف:`;
    }

    const matchReviewProcurement = buttonId.match(/^review_procurement_(.+)$/);
    if (matchReviewProcurement) {
      const proId = matchReviewProcurement[1];
      this.procurementReviewSessions.set(user.phoneNumber, { requestId: proId, step: 1 });
      return `💵 يرجى إدخال السعر التقديري لطلب الشراء (بالريال):`;
    }

    const matchApproveFinance = buttonId.match(/^approve_finance_(.+)$/);
    if (matchApproveFinance) {
      const proId = matchApproveFinance[1];
      const { WarehouseService } = require('./warehouse.service');
      await WarehouseService.financiallyApproveProcurement(proId, user.id);
      const req = await prisma.procurementRequest.findUnique({ where: { id: proId } });
      return `✅ تم الاعتماد المالي لطلب الشراء #${req?.ticketNumber} بنجاح.`;
    }

    const matchRejectFinance = buttonId.match(/^reject_finance_(.+)$/);
    if (matchRejectFinance) {
      const proId = matchRejectFinance[1];
      this.procurementApprovalSessions.set(user.phoneNumber, { requestId: proId, action: 'reject' });
      return `❌ يرجى إدخال سبب الرفض المالي لطلب الشراء:`;
    }

    const matchMarkPurchased = buttonId.match(/^mark_purchased_btn_(.+)$/);
    if (matchMarkPurchased) {
      const proId = matchMarkPurchased[1];
      this.procurementReviewSessions.set(user.phoneNumber, { requestId: proId, step: 3 });
      return `💵 يرجى إدخال السعر الفعلي المدفوع للشراء (بالريال):`;
    }

    const matchConfirmReceive = buttonId.match(/^confirm_receive_btn_(.+)$/);
    if (matchConfirmReceive) {
      const proId = matchConfirmReceive[1];
      const req = await prisma.procurementRequest.findUnique({ where: { id: proId } });
      if (!req) return '❌ لم يتم العثور على طلب الشراء.';
      const { WarehouseService } = require('./warehouse.service');
      await WarehouseService.receiveInWarehouse(proId, user.id, req.quantityNeeded);
      return `✅ تم تأكيد استلام الكمية (${req.quantityNeeded} ${req.unit}) وإدخالها للمستودع لطلب الشراء #${req.ticketNumber} بنجاح.`;
    }

    return `⚠️ أمر تفاعلي غير معتمد.`;
  }

  /**
   * Handle text ratings (e.g. user sends "5" instead of pressing a button)
   */
  /**
   * Handle text rejection note (e.g. supervisor writes 'cleanup required' after rejecting completion)
   */
  private static async handleRejectionTextSession(parsed: ParsedWhatsAppMessage, user: any): Promise<string> {
    const text = (parsed.text || '').trim();
    const requestId = this.rejectionSessions.get(user.phoneNumber)!;
    this.rejectionSessions.delete(user.phoneNumber);

    if (!text) {
      return `⚠️ يرجى كتابة سبب رفض العمل لإعادة توجيهه للفني.`;
    }

    const request = await prisma.request.findUnique({
      where: { id: requestId },
      include: { assignedTo: true }
    });

    if (!request) {
      return `❌ لم يتم العثور على التذكرة المطلوبة.`;
    }

    // Reopen request, record reason, and increment rejectionCount
    const newCount = (request.rejectionCount || 0) + 1;
    await RequestService.updateRequest(requestId, {
      status: RequestStatus.Reopened,
      rejectionReason: text,
      rejectionCount: newCount
    });

    // Notify the technician on WhatsApp
    if (request.assignedTo) {
      this.mockSendWhatsAppMessage(
        request.assignedTo.phoneNumber,
        `⚠️ *إشعار إعادة العمل (Rejection Notice)*:\n\n` +
        `أفاد المشرف برفض إغلاق البلاغ رقم \`${requestId.slice(-6).toUpperCase()}\` (${request.description}).\n\n` +
        `*سبب الرفض*: "${text}"\n\n` +
        `يرجى إعادة العمل على العطل وإنجازه في أقرب وقت.`
      );
    }

    return `🔄 تم تسجيل سبب الرفض وإعادة فتح البلاغ للفني لمتابعته. شكراً لك.`;
  }

  private static async handleProcurementTextSession(parsed: ParsedWhatsAppMessage, user: any): Promise<string> {
    const text = (parsed.text || '').trim();
    const session = this.procurementSessions.get(user.phoneNumber)!;

    if (session.step === 1) {
      if (!text) {
        return `⚠️ يرجى إدخال اسم الصنف أو الوصف المطلوب شراؤه:`;
      }

      // Find Procurement Officer (WarehouseManager)
      const officer = await prisma.user.findFirst({ where: { role: Role.WarehouseManager } });
      const officerPhone = officer ? officer.phoneNumber : '+1234567895';

      session.item = text;
      session.step = 2;
      session.techPhone = user.phoneNumber;
      session.techName = user.name;

      this.procurementSessions.delete(user.phoneNumber);
      this.procurementSessions.set(officerPhone, session);

      this.mockSendWhatsAppMessage(
        officerPhone,
        `الفني ${user.name} يطلب شراء (${text}). الرجاء الرد بكتابة التكلفة التقديرية بالريال لتمريرها للاعتماد...`
      );

      return `⏳ تم إرسال طلب الشراء الخارجي لمسؤول المشتريات لتحديد التكلفة التقديرية. سنقوم بإبلاغك بمجرد اعتماده.`;
    }

    if (session.step === 2) {
      const cost = parseFloat(text);
      if (isNaN(cost) || cost <= 0) {
        return `⚠️ الرجاء إدخال رقم صحيح للتكلفة التقديرية (مثال: 150):`;
      }

      this.procurementSessions.delete(user.phoneNumber);

      // Create Request in database
      const techUser = await prisma.user.findUnique({ where: { phoneNumber: session.techPhone! } });
      const request = await RequestService.createRequest({
        requestType: RequestType.Procurement,
        description: `شراء خارجي: ${session.item}`,
        estimatedCost: cost,
        branchId: session.branchId,
        reporterId: techUser ? techUser.id : user.id,
        approvalStatus: ApprovalStatus.Pending_Finance,
      });

      // Find Financial Manager
      const financeManager = await prisma.user.findFirst({ where: { role: Role.FinanceManager } });
      const financeManagerPhone = financeManager ? financeManager.phoneNumber : '+1234567892';

      // Find Branch Name
      const branch = await prisma.branch.findUnique({ where: { id: session.branchId } });
      const branchNameAr = branch
        ? (branch.name === 'Sail Road Branch' ? 'فرع طريق السيل' :
           branch.name === 'Beachside Resort Branch' ? 'فرع منتجع الشاطئ' :
           branch.name)
        : '';

      this.mockSendWhatsAppMessage(
        financeManagerPhone,
        `طلب تعميد مالي: شراء (${session.item}) بتكلفة (${cost}) ريال لفرع (${branchNameAr}).\n\n` +
        `[ ✅ تعميد مالي ] (زر: approve_proc_${request.id})\n` +
        `[ ❌ رفض ] (زر: reject_proc_${request.id})`
      );

      return `⏳ تم تسجيل التكلفة (${cost} ريال) وتمرير الطلب للمدير المالي للاعتماد.`;
    }

    return `⚠️ حدث خطأ في جلسة المشتريات.`;
  }

  private static async handleRatingTextSession(parsed: ParsedWhatsAppMessage, user: any): Promise<string> {
    const text = (parsed.text || '').trim();
    const ratingVal = parseInt(text, 10);
    const requestId = this.ratingSessions.get(user.phoneNumber)!;

    if (isNaN(ratingVal) || ratingVal < 1 || ratingVal > 5) {
      return `⚠️ يرجى إدخال تقييم صحيح كرقم بين 1 و 5 نجوم.`;
    }

    await RequestService.updateRequest(requestId, {
      status: RequestStatus.Completed,
      rating: ratingVal
    });

    this.ratingSessions.delete(user.phoneNumber);

    return `🎉 *تم إغلاق البلاغ بنجاح!*\n\nشكراً لك على تقييم الخدمة بـ (${ratingVal} نجوم). يومك سعيد!`;
  }

  /**
   * Handle media uploads (technician completions or procurement invoices)
   */
  private static async handleMediaMessage(parsed: ParsedWhatsAppMessage, user: any): Promise<string> {
    const mediaId = parsed.mediaId || '';
    const mimeType = parsed.mimeType || 'image/jpeg';
    const caption = (parsed.caption || '').trim().toLowerCase();

    const mockSavedUrl = `https://media.rahtihotels.com/media/${mediaId}.${mimeType.split('/')[1] || 'jpg'}`;

    // 1. Check if technician has a completion session waiting for a photo
    if (user.role === Role.Technician && this.technicianSessions.has(user.phoneNumber)) {
      const requestId = this.technicianSessions.get(user.phoneNumber)!;
      this.technicianSessions.delete(user.phoneNumber);

      const request = await RequestService.updateRequest(requestId, {
        afterImageUrl: mockSavedUrl,
        status: RequestStatus.Awaiting_Confirmation
      });

      // Send verification notification to the original reporter (receptionist/staff)
      const reporter = await prisma.user.findUnique({ where: { id: request.reporterId } });
      if (reporter) {
        this.mockSendWhatsAppMessage(
          reporter.phoneNumber,
          `🔔 *تأكيد إنجاز أعمال الصيانة*:\n\n` +
          `أفاد فني الصيانة ${user.name} بإصلاح العطل رقم \`${request.id.slice(-6).toUpperCase()}\` (${request.description}).\n\n` +
          `صورة الإنجاز: ${mockSavedUrl}\n\n` +
          `*هل تم إصلاح المشكلة بنجاح؟*\n` +
          `[نعم، تم الإصلاح] (زر: reporter_confirm_yes_${request.id})\n` +
          `[❌ طلب إعادة عمل] (زر: reporter_confirm_no_${request.id})`
        );
      }

      return `✅ تم رفع صورة الإنجاز وتوجيهها للموظف المسؤول لتأكيد جودة الإصلاح وإغلاق التذكرة. شكراً لك!`;
    }

    // 2. Check if invoice upload by Procurement officer or Administrator
    const isProcurementIdMatch = caption.match(/\b([a-z0-9]{25})\b/i); // Matches CUID of request
    if (isProcurementIdMatch && (caption.includes('invoice') || caption.includes('فاتورة'))) {
      const reqId = isProcurementIdMatch[1];
      const updated = await RequestService.updateRequest(reqId, {
        invoiceImageUrl: mockSavedUrl
      });
      return `✅ تم إرفاق الفاتورة للطلب \`${updated.id.slice(-6).toUpperCase()}\` بنجاح.`;
    }

    // 3. Document Management Upload via WhatsApp Bot
    const isDocPdf = mimeType === 'application/pdf';
    const isDocCaption = caption.includes('وثيقة') || caption.includes('مستند') || caption.includes('حفظ') || caption.includes('document') || caption.includes('save');
    const hasActiveTechSession = user.role === Role.Technician && this.technicianSessions.has(user.phoneNumber);

    if (isDocPdf || isDocCaption || (!hasActiveTechSession && (isDocPdf || mimeType.startsWith('image/')))) {
      try {
        const path = require('path');
        const fs = require('fs');
        const { extractDocumentMetadata } = require('../controllers/document.controller');

        const fileName = `${mediaId}.${mimeType.split('/')[1] || 'bin'}`;
        const uploadPath = path.join(__dirname, '../../uploads/documents');
        if (!fs.existsSync(uploadPath)) {
          fs.mkdirSync(uploadPath, { recursive: true });
        }
        const filePath = path.join(uploadPath, fileName);
        
        fs.writeFileSync(filePath, Buffer.from('mock whatsapp file content placeholder'));

        const branchId = user.branchId;
        if (!branchId) {
          return `❌ لا يمكن حفظ الوثيقة لأن حسابك غير مرتبط بفرع محدد. يرجى التواصل مع الإدارة.`;
        }

        const originalName = caption && caption !== 'وثيقة' && caption !== 'مستند' ? caption : fileName;
        const extracted = await extractDocumentMetadata(filePath, originalName, mimeType);

        const isExpired = extracted.expiryDate ? new Date(extracted.expiryDate) < new Date() : false;
        
        const doc = await prisma.document.create({
          data: {
            title: extracted.title || originalName,
            type: extracted.type || 'OTHER',
            department: extracted.department || 'BRANCH',
            branchId: branchId,
            fileUrl: `/uploads/documents/${fileName}`,
            fileName: originalName,
            fileSize: 1024,
            mimeType: mimeType,
            issuer: extracted.issuer || 'واتساب بوت',
            issueDate: extracted.issueDate,
            expiryDate: extracted.expiryDate,
            isExpired,
            aiExtracted: extracted.aiExtracted,
            notes: extracted.notes || 'تم الرفع عبر واتساب',
            uploadedById: user.id
          }
        });

        const expiryStr = doc.expiryDate ? new Date(doc.expiryDate).toLocaleDateString('ar-SA') : 'غير محدد';
        return `✅ تم حفظ الوثيقة: ${doc.title} | تنتهي: ${expiryStr}`;
      } catch (error) {
        console.error('Error saving document from WhatsApp:', error);
        return `❌ حدث خطأ أثناء محاولة حفظ ومعالجة الوثيقة. يرجى المحاولة لاحقاً.`;
      }
    }

    // Fallback logic
    return `📷 تم استلام الصورة، ولكن لم نتمكن من ربطها بجلسة تشغيلية جارية. يرجى إرسال الرموز الصحيحة في الشرح.`;
  }

  /**
   * Helper to send branch selection menu dynamically fetched from DB
   */
  private static async sendBranchSelectionMenu(): Promise<string> {
    const branches = await prisma.branch.findMany({ orderBy: { name: 'asc' } });
    if (branches.length === 0) {
      return `❌ عذراً، لا تتوفر أي فروع مسجلة في النظام حالياً.`;
    }

    let response = `🏨 *بوابة فنادق راحتي الذكية للعمليات* 🏨\n` +
      `يرجى اختيار الفرع لبدء البلاغ التشغيلي:\n\n`;

    branches.forEach((b, index) => {
      response += `[${index + 1}] 🏢 *${b.name === 'Sail Road Branch' ? 'فرع طريق السيل' : b.name === 'Beachside Resort Branch' ? 'فرع منتجع الشاطئ' : b.name}* (أرسل زر: branch_select_${b.id})\n`;
    });

    response += `\n_أو أرسل أمر البلاغ مباشرة إذا كنت تعرف الصيغة المختصرة._`;
    return response;
  }

  /**
   * Helper to send list menu
   */
  private static sendInteractiveListMenu(user: any): string {
    return `🏨 *بوابة فنادق راحتي الذكية للعمليات* 🏨\n` +
      `مرحباً بك ${user.name} (${user.role === 'Admin' ? 'مسؤول النظام' : user.role}).\n\n` +
      `يرجى اختيار الخدمة المطلوبة:\n` +
      `[1] 🛠️ طلب صيانة (أرسل زر: menu_request_maintenance)\n` +
      `[2] 📦 طلب مستودع (أرسل زر: menu_request_warehouse)\n` +
      `[3] 🛒 طلب شراء خارجي (أرسل زر: menu_request_procurement)\n\n` +
      `_أو أدخل رقم الخدمة أو أرسل أمر البلاغ مباشرة._`;
  }

  /**
   * Helper to mock send approval notification to CEO or Finance Manager
   */
  private static sendSimulatedApprovalMessage(to: string, roleName: string, req: any): void {
    const text = `🔔 *اعتماد مشتريات جديد بانتظار موافقتك* (${roleName}):\n\n` +
      `• *التذكرة*: \`${req.id.slice(-6).toUpperCase()}\`\n` +
      `• *التفاصيل*: ${req.description}\n` +
      `• *التكلفة*: $${req.estimatedCost}\n\n` +
      `[اعتماد الطلب] (زر: approve_req_${req.id})\n` +
      `[رفض الطلب] (زر: reject_req_${req.id})`;

    this.mockSendWhatsAppMessage(to, text);
  }

  /**
   * List user's active requests
   */
  private static async listUserRequests(user: any): Promise<string> {
    const filters: any = {};
    if (user.role === Role.Technician) {
      filters.assignedToId = user.id;
    } else if (user.role === Role.FinanceManager || user.role === Role.CEO) {
      filters.approvalStatus = user.role === Role.CEO ? ApprovalStatus.Pending_CEO : ApprovalStatus.Pending_Finance;
    } else {
      filters.reporterId = user.id;
    }

    const requests = await RequestService.getAllRequests(filters);

    if (requests.length === 0) {
      return `📭 ليس لديك أي طلبات نشطة حالياً.`;
    }

    let response = `📋 *قائمة طلباتك النشطة* (${requests.length} طلبات):\n\n`;

    requests.slice(0, 5).forEach((req) => {
      const typeStr = req.requestType === RequestType.Maintenance ? 'صيانة' : req.requestType === RequestType.Warehouse ? 'مستودع' : 'مشتريات';
      const statusStr = req.status === RequestStatus.Pending ? 'قيد الانتظار' : req.status === RequestStatus.In_Progress ? 'قيد التنفيذ' : 'بانتظار التأكيد';
      
      response += `• [\`${req.id.slice(-6).toUpperCase()}\`] *${typeStr}* - ${statusStr}\n` +
        `  _${req.description}_\n`;
      if (req.estimatedCost) {
        response += `  الميزانية: $${req.estimatedCost}\n`;
      }
      response += `\n`;
    });

    if (requests.length > 5) {
      response += `_تم عرض آخر 5 طلبات فقط. يمكنك مراجعة لوحة تحكم الإدارة للمزيد._`;
    }

    return response;
  }

  private static async handleConfirmShiftSubmit(user: any): Promise<string> {
    const session = this.shiftReportSessions.get(user.phoneNumber);
    if (!session) {
      return `❌ لا توجد جلسة تقفيلة وردية نشطة حالياً.`;
    }

    const cashNet = (session.cashTotal || 0) - (session.cashExpenses || 0);
    const grandTotal = cashNet +
      (session.visa || 0) +
      (session.mada || 0) +
      (session.mastercard || 0) +
      (session.gulfNet || 0) +
      (session.tabby || 0) +
      (session.bankTransfer || 0);

    // Create record in DB
    const report = await prisma.shiftReport.create({
      data: {
        reporterId: user.id,
        branchId: session.branchId,
        shiftLabel: session.shiftLabel || 'صباحي',
        shiftId: session.shiftId || null,
        customStartTime: session.customStartTime || null,
        customEndTime: session.customEndTime || null,
        isManual: false,
        cashTotal: session.cashTotal || 0,
        cashExpenses: session.cashExpenses || 0,
        cashNet,
        visa: session.visa || 0,
        mada: session.mada || 0,
        mastercard: session.mastercard || 0,
        gulfNet: session.gulfNet || 0,
        tabby: session.tabby || 0,
        bankTransfer: session.bankTransfer || 0,
        grandTotal,
        status: 'PendingAccountant',
      },
      include: {
        branch: true,
      }
    });

    // Clear session
    this.shiftReportSessions.delete(user.phoneNumber);

    // Find Accountant
    const accountant = await prisma.user.findFirst({
      where: { role: Role.Accountant },
    });
    const accountantPhone = accountant ? accountant.phoneNumber : '+1234567896';

    const branchName = report.branch.name;
    const branchNameAr = branchName === 'Sail Road Branch' ? 'فرع طريق السيل' :
                         branchName === 'Beachside Resort Branch' ? 'فرع منتجع الشاطئ' :
                         branchName;

    // Notify Accountant
    this.mockSendWhatsAppMessage(
      accountantPhone,
      `📋 *تقفيلة جديدة بانتظار المراجعة*\n\n` +
      `الموظف: ${user.name} | الفرع: ${branchNameAr} | الوردية: ${report.shiftLabel}\n` +
      `صافي الكاش: ${report.cashNet} ريال\n` +
      `إجمالي الشبكة: ${report.visa + report.mada + report.mastercard + report.gulfNet + report.tabby} ريال\n` +
      `تحويل بنكي: ${report.bankTransfer} ريال\n` +
      `━━━━━━━━━━━━━━━━━━━\n` +
      `الإجمالي: ${report.grandTotal} ريال\n\n` +
      `[ ✅ قبول ] (زر: approve_shift_${report.id})\n` +
      `[ ❌ رفض ] (زر: reject_shift_${report.id})`
    );

    return `✅ تم إرسال تقفيلة الوردية للمحاسب بنجاح. رقم التقفيلة هو \`${report.id.slice(-6).toUpperCase()}\`.`;
  }

  private static async handleCancelShiftSubmit(user: any): Promise<string> {
    this.shiftReportSessions.delete(user.phoneNumber);
    return `❌ تم إلغاء إرسال تقفيلة الوردية.`;
  }

  private static async handleApproveShiftReport(shiftId: string, user: any): Promise<string> {
    const report = await prisma.shiftReport.findUnique({
      where: { id: shiftId },
      include: { reporter: true }
    });

    if (!report) {
      return `❌ لم يتم العثور على التقفيلة المطلوبة.`;
    }

    await prisma.shiftReport.update({
      where: { id: shiftId },
      data: {
        status: 'Approved',
        reviewedBy: user.name,
        reviewedAt: new Date()
      }
    });

    // Notify Reporter
    if (report.reporter?.phoneNumber) {
      this.mockSendWhatsAppMessage(
        report.reporter.phoneNumber,
        `✅ تمت الموافقة على تقفيلتك | الإجمالي المعتمد: ${report.grandTotal} ريال`
      );
    }

    return `✅ تم اعتماد تقفيلة الوردية بنجاح.`;
  }

  private static async handleRejectShiftReport(shiftId: string, user: any): Promise<string> {
    const report = await prisma.shiftReport.findUnique({
      where: { id: shiftId }
    });

    if (!report) {
      return `❌ لم يتم العثور على التقفيلة المطلوبة.`;
    }

    // Register session for rejection note
    this.shiftRejectionSessions.set(user.phoneNumber, shiftId);

    return `أدخل سبب الرفض:`;
  }

  private static async handleShiftRejectionTextSession(parsed: ParsedWhatsAppMessage, user: any): Promise<string> {
    const text = (parsed.text || '').trim();
    const shiftId = this.shiftRejectionSessions.get(user.phoneNumber)!;
    this.shiftRejectionSessions.delete(user.phoneNumber);

    if (!text) {
      return `⚠️ يرجى كتابة سبب الرفض لتسجيله وإرساله للموظف.`;
    }

    const report = await prisma.shiftReport.findUnique({
      where: { id: shiftId },
      include: { reporter: true }
    });

    if (!report) {
      return `❌ لم يتم العثور على التقفيلة المطلوبة.`;
    }

    await prisma.shiftReport.update({
      where: { id: shiftId },
      data: {
        status: 'Rejected',
        rejectionReason: text,
        reviewedBy: user.name,
        reviewedAt: new Date()
      }
    });

    // Notify Reporter
    if (report.reporter?.phoneNumber) {
      this.mockSendWhatsAppMessage(
        report.reporter.phoneNumber,
        `⚠️ تم رفض تقفيلتك | السبب: ${text} | يرجى مراجعة الأرقام وإعادة الإرسال.`
      );
    }

    return `❌ تم تسجيل رفض التقفيلة بسبب: "${text}" وإشعار الموظف بذلك.`;
  }

  private static async handleShiftReportTextSession(parsed: ParsedWhatsAppMessage, user: any): Promise<string> {
    const text = (parsed.text || '').trim();
    const session = this.shiftReportSessions.get(user.phoneNumber)!;

    if (session.step === 1) {
      const { ShiftService } = require('./shift.service');
      const shifts = session.shiftsList || await ShiftService.getShiftsForBranch(session.branchId);

      const shiftIndex = parseInt(text, 10) - 1;
      let selectedShift = null;

      if (!isNaN(shiftIndex) && shiftIndex >= 0 && shiftIndex < shifts.length) {
        selectedShift = shifts[shiftIndex];
      } else {
        selectedShift = shifts.find((s: any) => text.includes(s.name) || s.name.includes(text));
      }

      if (!selectedShift) {
        let shiftsListText = '';
        shifts.forEach((s: any, idx: number) => {
          const numEmoji = idx === 0 ? '1️⃣' : idx === 1 ? '2️⃣' : idx === 2 ? '3️⃣' : idx === 3 ? '4️⃣' : `${idx + 1}.`;
          const timeInfo = s.isOpen ? 'مفتوحة' : `${s.startTime} - ${s.endTime}`;
          shiftsListText += `\n${numEmoji} ${s.name} (${timeInfo})`;
        });
        return `⚠️ خيار غير صحيح. الرجاء إدخال الرقم المقابل للوردية:` + shiftsListText;
      }

      session.shiftId = selectedShift.id;
      session.shiftLabel = selectedShift.name;

      if (selectedShift.isOpen) {
        session.step = 11;
        this.shiftReportSessions.set(user.phoneNumber, session);
        return `أدخل وقت بداية وردييتك (مثال: 09:00):`;
      } else {
        session.step = 2;
        this.shiftReportSessions.set(user.phoneNumber, session);
        return `💵 أدخل إجمالي الكاش (بالريال):`;
      }
    }

    if (session.step === 11) {
      session.customStartTime = text;
      session.step = 12;
      this.shiftReportSessions.set(user.phoneNumber, session);
      return `أدخل وقت نهاية وردييتك (مثال: 17:00):`;
    }

    if (session.step === 12) {
      session.customEndTime = text;
      session.step = 2;
      this.shiftReportSessions.set(user.phoneNumber, session);
      return `💵 أدخل إجمالي الكاش (بالريال):`;
    }

    // Number parser helper
    const parseNumber = (val: string): number | null => {
      const num = parseFloat(val);
      if (isNaN(num) || num < 0) return null;
      return num;
    };

    if (session.step === 2) {
      const val = parseNumber(text);
      if (val === null) return `⚠️ الرجاء إدخال رقم صحيح لإجمالي الكاش:`;
      session.cashTotal = val;
      session.step = 3;
      this.shiftReportSessions.set(user.phoneNumber, session);
      return `➖ أدخل إجمالي المصروفات من الكاش، إذا لا يوجد أدخل 0:`;
    }

    if (session.step === 3) {
      const val = parseNumber(text);
      if (val === null) return `⚠️ الرجاء إدخال رقم صحيح لإجمالي المصروفات من الكاش:`;
      session.cashExpenses = val;
      session.step = 4;
      this.shiftReportSessions.set(user.phoneNumber, session);
      return `💳 أدخل مبلغ فيزا، إذا لا يوجد أدخل 0:`;
    }

    if (session.step === 4) {
      const val = parseNumber(text);
      if (val === null) return `⚠️ الرجاء إدخال رقم صحيح لمبلغ فيزا:`;
      session.visa = val;
      session.step = 5;
      this.shiftReportSessions.set(user.phoneNumber, session);
      return `💳 أدخل مبلغ مدى، إذا لا يوجد أدخل 0:`;
    }

    if (session.step === 5) {
      const val = parseNumber(text);
      if (val === null) return `⚠️ الرجاء إدخال رقم صحيح لمبلغ مدى:`;
      session.mada = val;
      session.step = 6;
      this.shiftReportSessions.set(user.phoneNumber, session);
      return `💳 أدخل مبلغ ماستر كارد، إذا لا يوجد أدخل 0:`;
    }

    if (session.step === 6) {
      const val = parseNumber(text);
      if (val === null) return `⚠️ الرجاء إدخال رقم صحيح لمبلغ ماستر كارد:`;
      session.mastercard = val;
      session.step = 7;
      this.shiftReportSessions.set(user.phoneNumber, session);
      return `💳 أدخل مبلغ شبكة خليجية، إذا لا يوجد أدخل 0:`;
    }

    if (session.step === 7) {
      const val = parseNumber(text);
      if (val === null) return `⚠️ الرجاء إدخال رقم صحيح لمبلغ شبكة خليجية:`;
      session.gulfNet = val;
      session.step = 8;
      this.shiftReportSessions.set(user.phoneNumber, session);
      return `💳 أدخل مبلغ تابي، إذا لا يوجد أدخل 0:`;
    }

    if (session.step === 8) {
      const val = parseNumber(text);
      if (val === null) return `⚠️ الرجاء إدخال رقم صحيح لمبلغ تابي:`;
      session.tabby = val;
      session.step = 9;
      this.shiftReportSessions.set(user.phoneNumber, session);
      return `🏦 أدخل مبلغ التحويل البنكي، إذا لا يوجد أدخل 0:`;
    }

    if (session.step === 9) {
      const val = parseNumber(text);
      if (val === null) return `⚠️ الرجاء إدخال رقم صحيح لمبلغ التحويل البنكي:`;
      session.bankTransfer = val;
      session.step = 10;
      this.shiftReportSessions.set(user.phoneNumber, session);

      // Compute summary
      const cashNet = (session.cashTotal || 0) - (session.cashExpenses || 0);
      const grandTotal = cashNet +
        (session.visa || 0) +
        (session.mada || 0) +
        (session.mastercard || 0) +
        (session.gulfNet || 0) +
        (session.tabby || 0) +
        session.bankTransfer;

      const branch = await prisma.branch.findUnique({ where: { id: session.branchId } });
      const branchName = branch ? branch.name : '';
      const branchNameAr = branchName === 'Sail Road Branch' ? 'فرع طريق السيل' :
                           branchName === 'Beachside Resort Branch' ? 'فرع منتجع الشاطئ' :
                           branchName;

      return `📋 *ملخص تقفيلة الوردية ${session.shiftLabel}*\n` +
        `فندق: ${branchNameAr}\n\n` +
        `💵 كاش:           ${session.cashTotal} ريال\n` +
        `➖ مصروفات:       ${session.cashExpenses} ريال\n` +
        `= صافي الكاش:     ${cashNet} ريال\n\n` +
        `💳 فيزا:          ${session.visa} ريال\n` +
        `💳 مدى:           ${session.mada} ريال\n` +
        `💳 ماستر كارد:    ${session.mastercard} ريال\n` +
        `💳 شبكة خليجية:   ${session.gulfNet} ريال\n` +
        `💳 تابي:          ${session.tabby} ريال\n\n` +
        `🏦 تحويل بنكي:    ${session.bankTransfer} ريال\n` +
        `━━━━━━━━━━━━━━━━━━━\n` +
        `📊 *الإجمالي الكلي*: ${grandTotal} ريال\n\n` +
        `هل تريد إرسال التقفيلة؟\n` +
        `[ ✅ إرسال التقفيلة ] (زر: confirm_shift_submit)\n` +
        `[ ❌ إلغاء ] (زر: cancel_shift_submit)`;
    }

    return `⚠️ أمر غير معروف في جلسة التقفيلة.`;
  }

  private static async handleAttendanceLocation(parsed: ParsedWhatsAppMessage, user: any): Promise<string> {
    const type = this.attendanceSessions.get(user.phoneNumber)!;
    this.attendanceSessions.delete(user.phoneNumber);

    const lat = parsed.latitude!;
    const lng = parsed.longitude!;

    try {
      const { GeoService } = require('./geo.service');
      const result = await GeoService.recordAttendance(user.id, type, lat, lng);

      const timeStr = new Date(result.timestamp).toLocaleTimeString('ar-EG', { hour: '2-digit', minute: '2-digit' });
      const branchNameAr = result.branchName === 'Sail Road Branch' ? 'فرع طريق السيل' :
                           result.branchName === 'Beachside Resort Branch' ? 'فرع منتجع الشاطئ' :
                           result.branchName;

      if (result.isValid) {
        return `✅ تم تسجيل ${type === 'CheckIn' ? 'حضورك' : 'انصرافك'} بنجاح\n` +
               `📍 الفرع: ${branchNameAr}\n` +
               `🕐 الوقت: ${timeStr}\n` +
               `📏 المسافة: ${Math.round(result.distanceMeters)} متر`;
      } else {
        return `❌ لم يتم تسجيل الحضور\n` +
               `أنت خارج النطاق الجغرافي المحدد.\n` +
               `📏 مسافتك: ${Math.round(result.distanceMeters)} متر (الحد المسموح: ${result.radiusLimit} متر)\n` +
               `يرجى مراجعة إدارة الموارد البشرية أو مدير الفرع لتسجيل الحضور يدوياً.`;
      }
    } catch (error: any) {
      if (error?.code === 'MISSING_BRANCH_COORDINATES' || error?.message?.includes('لم يتم تحديد الموقع الجغرافي لفرعك بعد')) {
        return error.message;
      }
      console.error('Attendance recording error:', error);
      return `❌ حدث خطأ أثناء معالجة تسجيل الحضور: ${error?.message || 'خطأ غير معروف'}`;
    }
  }

  private static async handleAdminRequestTextSession(parsed: ParsedWhatsAppMessage, user: any): Promise<string> {
    const text = (parsed.text || '').trim();
    this.adminRequestSessions.delete(user.phoneNumber);

    if (!text) {
      return `⚠️ تم إلغاء الطلب الإداري لعدم إدخال تفاصيل.`;
    }

    const adminMsg = `📋 *طلب إداري جديد*\n` +
                     `👤 *الموظف*: ${user.name} | *الفرع*: ${user.branch.name}\n` +
                     `📝 *التفاصيل*: ${text}\n` +
                     `*الوقت*: ${new Date().toLocaleTimeString('ar-EG', { hour: '2-digit', minute: '2-digit' })}`;

    const admins = await prisma.user.findMany({ where: { role: Role.Admin } });
    for (const admin of admins) {
      this.mockSendWhatsAppMessage(admin.phoneNumber, adminMsg);
    }
    if (admins.length === 0) {
      this.mockSendWhatsAppMessage('+1234567890', adminMsg);
    }

    return `✅ تم إرسال طلبك الإداري للإدارة بنجاح.`;
  }

  private static async handleLoanTextSession(parsed: ParsedWhatsAppMessage, user: any): Promise<string> {
    const text = (parsed.text || '').trim();
    const session = this.loanSessions.get(user.phoneNumber)!;

    if (session.step === 1) {
      const amount = parseFloat(text);
      if (isNaN(amount) || amount <= 0) {
        return `⚠️ الرجاء إدخال مبلغ صحيح أكبر من الصفر:`;
      }
      session.amount = amount;
      session.step = 2;
      this.loanSessions.set(user.phoneNumber, session);
      return `أدخل سبب طلب السلفة:`;
    }

    if (session.step === 2) {
      if (!text) {
        return `⚠️ الرجاء إدخال سبب طلب السلفة:`;
      }
      session.reason = text;
      session.step = 3;
      this.loanSessions.set(user.phoneNumber, session);

      return `📋 *ملخص طلب السلفة:*\n` +
             `💰 *المبلغ*: ${session.amount} ريال\n` +
             `📝 *السبب*: ${session.reason}\n\n` +
             `هل تريد إرسال الطلب؟\n` +
             `[ ✅ إرسال الطلب ] (زر: confirm_loan_submit)\n` +
             `[ ❌ إلغاء ] (زر: cancel_loan_submit)`;
    }

    return `⚠️ حدث خطأ في جلسة طلب السلفة.`;
  }

  private static async handleLoanRejectionTextSession(parsed: ParsedWhatsAppMessage, user: any): Promise<string> {
    const text = (parsed.text || '').trim();
    const loanId = this.loanRejectionSessions.get(user.phoneNumber)!;
    this.loanRejectionSessions.delete(user.phoneNumber);

    if (!text) {
      return `⚠️ يرجى كتابة سبب الرفض لتسجيله وإرساله للموظف.`;
    }

    const loan = await prisma.loanRequest.findUnique({
      where: { id: loanId },
      include: { user: true }
    });

    if (!loan) {
      return `❌ لم يتم العثور على طلب السلفة.`;
    }

    const { LoanService } = require('./loan.service');
    await LoanService.reviewLoanRequest(loanId, user.id, 'Rejected', text);

    // Notify employee
    this.mockSendWhatsAppMessage(
      loan.user.phoneNumber,
      `❌ تم رفض طلب السلفة. السبب: ${text}`
    );

    return `❌ تم تسجيل رفض السلفة للموظف ${loan.user.name} بسبب: "${text}" وإشعاره بذلك.`;
  }

  private static async handleLeaveTextSession(parsed: ParsedWhatsAppMessage, user: any): Promise<string> {
    const text = (parsed.text || '').trim();
    const session = this.leaveSessions.get(user.phoneNumber)!;

    if (session.step === 1) {
      let leaveType = '';
      if (text === '1' || text.includes('سنوية') || text.includes('Annual')) {
        leaveType = 'Annual';
      } else if (text === '2' || text.includes('مرضية') || text.includes('Sick')) {
        leaveType = 'Sick';
      } else if (text === '3' || text.includes('طارئة') || text.includes('Emergency')) {
        leaveType = 'Emergency';
      } else if (text === '4' || text.includes('بدون راتب') || text.includes('Unpaid')) {
        leaveType = 'Unpaid';
      } else {
        return `⚠️ خيار غير صحيح. اختر نوع الإجازة بإرسال رقم الخيار:\n` +
               `1️⃣ سنوية (رصيدك: ${user.annualLeaveBalance} يوم)\n` +
               `2️⃣ مرضية (رصيدك: ${user.sickLeaveBalance} يوم)\n` +
               `3️⃣ طارئة\n` +
               `4️⃣ بدون راتب`;
      }

      session.leaveType = leaveType;
      session.step = 2;
      this.leaveSessions.set(user.phoneNumber, session);
      return `أدخل تاريخ بداية الإجازة (مثال: 2026-06-20):`;
    }

    if (session.step === 2) {
      const dateRegex = /^\d{4}-\d{2}-\d{2}$/;
      if (!dateRegex.test(text)) {
        return `⚠️ تنسيق التاريخ غير صحيح. يرجى إدخال تاريخ البداية بتنسيق YYYY-MM-DD (مثال: 2026-06-20):`;
      }
      const start = new Date(text);
      if (isNaN(start.getTime())) {
        return `⚠️ تاريخ غير صالح. يرجى إدخال تاريخ البداية بتنسيق YYYY-MM-DD:`;
      }
      
      const startCompare = new Date(start);
      startCompare.setHours(0, 0, 0, 0);
      const today = new Date();
      today.setHours(0, 0, 0, 0);

      if (startCompare < today) {
        return `❌ تاريخ البداية لا يمكن أن يكون في الماضي.`;
      }

      session.startDate = text;
      session.step = 3;
      this.leaveSessions.set(user.phoneNumber, session);
      return `أدخل تاريخ نهاية الإجازة (مثال: 2026-06-25):`;
    }

    if (session.step === 3) {
      const dateRegex = /^\d{4}-\d{2}-\d{2}$/;
      if (!dateRegex.test(text)) {
        return `⚠️ تنسيق التاريخ غير صحيح. يرجى إدخال تاريخ النهاية بتنسيق YYYY-MM-DD (مثال: 2026-06-25):`;
      }
      const end = new Date(text);
      if (isNaN(end.getTime())) {
        return `⚠️ تاريخ غير صالح. يرجى إدخال تاريخ النهاية بتنسيق YYYY-MM-DD:`;
      }

      const start = new Date(session.startDate!);
      const diffTime = end.getTime() - start.getTime();
      if (diffTime < 0) {
        return `⚠️ تاريخ النهاية يجب أن يكون مساوياً أو بعد تاريخ البداية (${session.startDate}). أدخل تاريخ نهاية الإجازة:`;
      }

      const daysCount = Math.ceil(diffTime / (1000 * 60 * 60 * 24)) + 1;

      if (session.leaveType === 'Annual' && daysCount > user.annualLeaveBalance) {
        this.leaveSessions.set(user.phoneNumber, { step: 2, leaveType: session.leaveType });
        return `❌ رصيد إجازاتك غير كافٍ. رصيدك الحالي: ${user.annualLeaveBalance} يوم فقط.\n` +
               `يرجى إدخال تاريخ بداية الإجازة من جديد (مثال: 2026-06-20):`;
      }
      if (session.leaveType === 'Sick' && daysCount > user.sickLeaveBalance) {
        this.leaveSessions.set(user.phoneNumber, { step: 2, leaveType: session.leaveType });
        return `❌ رصيد إجازاتك غير كافٍ. رصيدك الحالي: ${user.sickLeaveBalance} يوم فقط.\n` +
               `يرجى إدخال تاريخ بداية الإجازة من جديد (مثال: 2026-06-20):`;
      }

      session.endDate = text;
      session.daysCount = daysCount;
      session.step = 4;
      this.leaveSessions.set(user.phoneNumber, session);
      return `أدخل سبب الإجازة:`;
    }

    if (session.step === 4) {
      if (!text) {
        return `⚠️ الرجاء إدخال سبب الإجازة:`;
      }
      session.reason = text;
      session.step = 5;
      this.leaveSessions.set(user.phoneNumber, session);

      const typeAr = session.leaveType === 'Annual' ? 'سنوية' :
                     session.leaveType === 'Sick' ? 'مرضية' :
                     session.leaveType === 'Emergency' ? 'طارئة' : 'بدون راتب';

      return `📋 *ملخص طلب الإجازة:*\n` +
             `📅 *النوع*: ${typeAr}\n` +
             `📆 *من*: ${session.startDate} *إلى*: ${session.endDate}\n` +
             `🗓️ *عدد الأيام*: ${session.daysCount}\n` +
             `📝 *السبب*: ${session.reason}\n\n` +
             `هل تريد إرسال الطلب؟\n` +
             `[ ✅ إرسال الطلب ] (زر: confirm_leave_submit)\n` +
             `[ ❌ إلغاء ] (زر: cancel_leave_submit)`;
    }

    return `⚠️ حدث خطأ في جلسة طلب الإجازة.`;
  }

  private static async handleLeaveRejectionTextSession(parsed: ParsedWhatsAppMessage, user: any): Promise<string> {
    const text = (parsed.text || '').trim();
    const leaveId = this.leaveRejectionSessions.get(user.phoneNumber)!;
    this.leaveRejectionSessions.delete(user.phoneNumber);

    if (!text) {
      return `⚠️ يرجى كتابة سبب الرفض لتسجيله وإرساله للموظف.`;
    }

    const leave = await prisma.leaveRequest.findUnique({
      where: { id: leaveId },
      include: { user: true }
    });

    if (!leave) {
      return `❌ لم يتم العثور على طلب الإجازة.`;
    }

    const { LeaveService } = require('./leave.service');
    await LeaveService.reviewLeaveRequest(leaveId, user.id, 'Rejected', text);

    // Notify employee
    this.mockSendWhatsAppMessage(
      leave.user.phoneNumber,
      `❌ تم رفض طلب إجازتك. السبب: ${text}`
    );

    return `❌ تم تسجيل رفض الإجازة للموظف ${leave.user.name} بسبب: "${text}" وإشعاره بذلك.`;
  }

  private static async handleMaintenanceSession(parsed: ParsedWhatsAppMessage, user: any): Promise<string> {
    const session = this.maintenanceSessions.get(user.phoneNumber)!;
    const text = (parsed.text || '').trim();

    if (session.step === 1) {
      if (!['1', '2', '3', '4', '5', '6'].includes(text)) {
        return `🛠️ اختر نوع العطل:\n` +
               `1️⃣ كهرباء ⚡\n` +
               `2️⃣ سباكة 🚿\n` +
               `3️⃣ تكييف ❄️\n` +
               `4️⃣ نجارة 🪚\n` +
               `5️⃣ نظافة وتجهيز 🧹\n` +
               `6️⃣ عام 🔧\n\n` +
               `أرسل رقم الخيار:`;
      }
      const categoryMap: { [key: string]: string } = {
        '1': 'Electrical',
        '2': 'Plumbing',
        '3': 'AC',
        '4': 'Carpentry',
        '5': 'Cleaning',
        '6': 'General'
      };
      session.category = categoryMap[text];
      session.step = 2;
      return `📍 أدخل موقع العطل (رقم الغرفة أو وصف المكان):`;
    }

    if (session.step === 2) {
      if (!text) {
        return `📍 أدخل موقع العطل (رقم الغرفة أو وصف المكان):`;
      }
      session.location = text;
      session.step = 3;
      return `📝 اشرح المشكلة بالتفصيل:`;
    }

    if (session.step === 3) {
      if (!text) {
        return `📝 اشرح المشكلة بالتفصيل:`;
      }
      session.description = text;
      session.step = 4;
      return `⚡ ما مستوى الأولوية؟\n` +
             `1️⃣ عاجل جداً 🔴\n` +
             `2️⃣ عالية 🟠\n` +
             `3️⃣ عادية 🟡\n` +
             `4️⃣ منخفضة 🟢\n\n` +
             `أرسل رقم الخيار:`;
    }

    if (session.step === 4) {
      if (!['1', '2', '3', '4'].includes(text)) {
        return `⚡ ما مستوى الأولوية؟\n` +
               `1️⃣ عاجل جداً 🔴\n` +
               `2️⃣ عالية 🟠\n` +
               `3️⃣ عادية 🟡\n` +
               `4️⃣ منخفضة 🟢\n\n` +
               `أرسل رقم الخيار:`;
      }
      const priorityMap: { [key: string]: string } = {
        '1': 'Urgent',
        '2': 'High',
        '3': 'Normal',
        '4': 'Low'
      };
      session.priority = priorityMap[text];
      session.step = 5;
      return `📸 هل تريد إرفاق صورة؟ أرسلها الآن أو اكتب 'تخطي':`;
    }

    if (session.step === 5) {
      if (parsed.messageType === 'media') {
        session.photoUrl = parsed.mediaId || 'https://images.unsplash.com/photo-1581092160607-ee22621dd758';
      } else if (text !== 'تخطي') {
        return `📸 هل تريد إرفاق صورة؟ أرسلها الآن أو اكتب 'تخطي':`;
      }
      
      session.step = 6;
      const branch = await prisma.branch.findUnique({ where: { id: session.branchId } });
      const branchNameAr = branch
        ? (branch.name === 'Sail Road Branch' ? 'فرع طريق السيل' :
           branch.name === 'Beachside Resort Branch' ? 'فرع منتجع الشاطئ' :
           branch.name)
        : '';

      const categoryMapAr: { [key: string]: string } = {
        'Electrical': 'كهرباء ⚡',
        'Plumbing': 'سباكة 🚿',
        'AC': 'تكييف ❄️',
        'Carpentry': 'نجارة 🪚',
        'Cleaning': 'نظافة وتجهيز 🧹',
        'General': 'عام 🔧'
      };

      const priorityMapAr: { [key: string]: string } = {
        'Urgent': 'عاجل جداً 🔴',
        'High': 'عالية 🟠',
        'Normal': 'عادية 🟡',
        'Low': 'منخفضة 🟢'
      };

      return `📋 *ملخص بلاغ الصيانة:*\n\n` +
             `🔧 *النوع*: ${categoryMapAr[session.category || 'General']}\n` +
             `📍 *الموقع*: ${session.location}\n` +
             `📝 *الوصف*: ${session.description}\n` +
             `⚡ *الأولوية*: ${priorityMapAr[session.priority || 'Normal']}\n` +
             `🏨 *الفرع*: ${branchNameAr}\n\n` +
             `هل تريد إرسال البلاغ؟\n\n` +
             `[ ✅ إرسال البلاغ ] (زر: confirm_maintenance_submit)\n` +
             `[ ❌ إلغاء ] (زر: cancel_maintenance_submit)`;
    }

    return '';
  }

  private static async handleSupervisorAssignSession(parsed: ParsedWhatsAppMessage, user: any): Promise<string> {
    const session = this.supervisorAssignSessions.get(user.phoneNumber)!;
    const text = (parsed.text || '').trim();
    const idx = parseInt(text, 10);

    if (isNaN(idx) || idx < 1 || idx > session.techs.length) {
      return `⚠️ خيار غير صالح. يرجى إدخال رقم الفني من القائمة (1 إلى ${session.techs.length}):`;
    }

    const selectedTech = session.techs[idx - 1];
    
    const { MaintenanceService } = require('./maintenance.service');
    await MaintenanceService.assignTechnician(session.requestId, selectedTech.id, user.id);

    this.supervisorAssignSessions.delete(user.phoneNumber);

    return `✅ تم تعيين الفني *${selectedTech.name}* للبلاغ بنجاح.`;
  }

  private static async handleTechnicianMntSession(parsed: ParsedWhatsAppMessage, user: any): Promise<string> {
    const session = this.technicianMntSessions.get(user.phoneNumber)!;
    const text = (parsed.text || '').trim();

    if (session.step === 1) {
      if (parsed.messageType === 'media') {
        session.photoUrl = parsed.mediaId || 'https://images.unsplash.com/photo-1581092160607-ee22621dd758';
      } else if (text !== 'بدون صورة') {
        return `📸 أرسل صورة الإنجاز (أو اكتب 'بدون صورة'):`;
      }
      session.step = 2;
      return `📝 أضف ملاحظة الإنجاز (اختياري - أو اكتب 'تخطي'):`;
    }

    if (session.step === 2) {
      const note = text === 'تخطي' ? 'تم الإصلاح بنجاح.' : text;
      
      const { MaintenanceService } = require('./maintenance.service');
      await MaintenanceService.submitCompletion(session.requestId, user.id, note, session.photoUrl);

      this.technicianMntSessions.delete(user.phoneNumber);

      return `✅ تم تقديم تقرير إنجاز العمل بنجاح وبانتظار اعتماد الإدارة.`;
    }

    return '';
  }

  private static async handleSparePartsSession(parsed: ParsedWhatsAppMessage, user: any): Promise<string> {
    const requestId = this.sparePartsSessions.get(user.phoneNumber)!;
    const text = (parsed.text || '').trim();

    if (!text) {
      return `📦 اذكر القطع المطلوبة:`;
    }

    const { MaintenanceService } = require('./maintenance.service');
    await MaintenanceService.requestSpareParts(requestId, user.id, text);

    this.sparePartsSessions.delete(user.phoneNumber);

    return `⏸️ تم تسجيل طلب قطع الغيار وإيقاف البلاغ مؤقتاً.`;
  }

  private static async handleMaintenanceApprovalSession(parsed: ParsedWhatsAppMessage, user: any): Promise<string> {
    const session = this.maintenanceApprovalSessions.get(user.phoneNumber)!;
    const text = (parsed.text || '').trim();

    const { MaintenanceService } = require('./maintenance.service');

    if (session.action === 'approve') {
      const note = text === 'تخطي' ? 'تم تأكيد وإغلاق بلاغ الصيانة بنجاح.' : text;
      await MaintenanceService.approveCompletion(session.requestId, user.id, note);
      this.maintenanceApprovalSessions.delete(user.phoneNumber);
      return `✅ تم إغلاق بلاغ الصيانة بنجاح.`;
    }

    if (session.action === 'reject') {
      if (text === 'تخطي' || !text) {
        return `📝 أدخل سبب الرفض:`;
      }
      await MaintenanceService.rejectCompletion(session.requestId, user.id, text);
      this.maintenanceApprovalSessions.delete(user.phoneNumber);
      return `❌ تم رفض إغلاق البلاغ وإعادته للفني.`;
    }

    return '';
  }

  private static async handleWarehouseSession(parsed: ParsedWhatsAppMessage, user: any): Promise<string> {
    const text = (parsed.text || '').trim();
    const session = this.warehouseSessions.get(user.phoneNumber);
    if (!session) return '❌ لا توجد جلسة نشطة.';

    if (session.step === 1) {
      const num = parseInt(text, 10);
      if (isNaN(num) || !session.itemsList || num < 1 || num > session.itemsList.length) {
        return `⚠️ يرجى إرسال رقم صحيح من القائمة (1-${session.itemsList?.length || 1}):`;
      }
      const item = session.itemsList[num - 1];
      session.itemId = item.id;
      session.step = 2;
      this.warehouseSessions.set(user.phoneNumber, session);
      return `🔢 حدد الكمية المطلوبة بالعدد (${item.unit}):`;
    }

    if (session.step === 2) {
      const qty = parseInt(text, 10);
      if (isNaN(qty) || qty <= 0) {
        return `⚠️ يرجى إرسال كمية صالحة (عدد أكبر من 0):`;
      }
      session.quantity = qty;
      session.step = 3;
      this.warehouseSessions.set(user.phoneNumber, session);
      return `📝 اذكر الغرض من الصرف (أو اكتب 'بدون غرض'):`;
    }

    if (session.step === 3) {
      session.purpose = text === 'بدون غرض' ? undefined : text;
      session.step = 4;
      this.warehouseSessions.set(user.phoneNumber, session);

      const item = await prisma.item.findUnique({ where: { id: session.itemId } });
      if (!item) return '❌ الصنف غير موجود.';

      return `📋 *مراجعة طلب الصرف من المستودع*\n\n` +
             `📦 *الصنف*: ${item.name}\n` +
             `🔢 *الكمية*: ${session.quantity} ${item.unit}\n` +
             `📝 *الغرض*: ${session.purpose || 'غير محدد'}\n\n` +
             `[ ✅ تأكيد الطلب ] (زر: confirm_whr_submit)\n` +
             `[ ❌ إلغاء ] (زر: cancel_whr_submit)`;
    }

    return '❌ حالة غير معروفة في الجلسة.';
  }

  private static async handleWarehouseApprovalSession(parsed: ParsedWhatsAppMessage, user: any): Promise<string> {
    const text = (parsed.text || '').trim();
    const session = this.warehouseApprovalSessions.get(user.phoneNumber);
    if (!session) return '❌ لا توجد جلسة اعتماد مستودع نشطة.';

    const { WarehouseService } = require('./warehouse.service');

    if (session.action === 'issue_partial') {
      const qty = parseInt(text, 10);
      if (isNaN(qty) || qty <= 0) {
        return `⚠️ يرجى إدخال كمية صحيحة (عدد أكبر من 0):`;
      }

      const whr = await prisma.warehouseRequest.findUnique({
        where: { id: session.requestId },
        include: { item: true }
      });
      if (!whr) return '❌ لم يتم العثور على طلب الصرف.';

      if (qty > whr.quantityRequested) {
        return `⚠️ لا يمكن صرف كمية أكبر من الكمية المطلوبة (${whr.quantityRequested} ${whr.item.unit}). يرجى إدخال كمية صحيحة:`;
      }

      const stockEntry = await prisma.stockEntry.findUnique({
        where: { itemId_branchId: { itemId: whr.itemId, branchId: whr.branchId } }
      });
      const available = stockEntry ? stockEntry.quantity : 0;
      if (qty > available) {
        return `⚠️ لا يوجد مخزون كافٍ. المتوفر حالياً: ${available} ${whr.item.unit}. يرجى إدخال كمية مناسبة:`;
      }

      await WarehouseService.approveWarehouseRequest(session.requestId, user.id, qty);
      this.warehouseApprovalSessions.delete(user.phoneNumber);
      return `✅ تم صرف كمية جزئية (${qty} ${whr.item.unit}) للطلب #${whr.ticketNumber} بنجاح.`;
    }

    if (session.action === 'reject') {
      if (!text) return `⚠️ يرجى كتابة سبب الرفض:`;
      const whr = await WarehouseService.rejectWarehouseRequest(session.requestId, user.id, text);
      this.warehouseApprovalSessions.delete(user.phoneNumber);
      return `✅ تم رفض طلب الصرف #${whr.ticketNumber} بنجاح.`;
    }

    return '❌ إجراء غير معروف.';
  }

  private static async handleProcurementReviewSession(parsed: ParsedWhatsAppMessage, user: any): Promise<string> {
    const text = (parsed.text || '').trim();
    const session = this.procurementReviewSessions.get(user.phoneNumber);
    if (!session) return '❌ لا توجد جلسة مراجعة مشتريات نشطة.';

    const { WarehouseService } = require('./warehouse.service');

    if (session.step === 1) {
      const price = parseFloat(text);
      if (isNaN(price) || price <= 0) {
        return `⚠️ يرجى إدخال سعر تقديري صالح (رقم أكبر من 0):`;
      }
      session.estimatedPrice = price;
      
      const suppliers = await prisma.supplier.findMany({ where: { isActive: true }, orderBy: { name: 'asc' } });
      session.suppliersList = suppliers;
      session.step = 2;
      this.procurementReviewSessions.set(user.phoneNumber, session);

      let msg = `🏢 *اختر المورد المناسب بإرسال رقمه (أو اكتب 'بدون مورد'):*\n\n`;
      suppliers.forEach((s, idx) => {
        msg += `${idx + 1}️⃣ ${s.name}\n`;
      });
      return msg;
    }

    if (session.step === 2) {
      let supplierId: string | undefined = undefined;
      if (text !== 'بدون مورد') {
        const num = parseInt(text, 10);
        if (isNaN(num) || !session.suppliersList || num < 1 || num > session.suppliersList.length) {
          return `⚠️ يرجى اختيار مورد صحيح من القائمة أو كتابة 'بدون مورد':`;
        }
        supplierId = session.suppliersList[num - 1].id;
      }
      session.supplierId = supplierId;
      session.step = 5; // Go to payment method step
      this.procurementReviewSessions.set(user.phoneNumber, session);

      return `💳 حدد طريقة الدفع المقترحة بإرسال رقم الخيار:\n` +
             `1️⃣ كاش 💵\n` +
             `2️⃣ تحويل بنكي 🏦\n` +
             `3️⃣ شبكة/مدى 💳\n` +
             `4️⃣ آجل ⏰`;
    }

    if (session.step === 5) {
      const opt = text;
      let paymentMethod = '';
      if (opt === '1') paymentMethod = 'Cash';
      else if (opt === '2') paymentMethod = 'BankTransfer';
      else if (opt === '3') paymentMethod = 'Card';
      else if (opt === '4') paymentMethod = 'Credit';
      else {
        return `⚠️ يرجى إرسال رقم صحيح (1-4):`;
      }
      session.paymentMethod = paymentMethod;
      session.step = 6; // Go to review note
      this.procurementReviewSessions.set(user.phoneNumber, session);

      return `📝 اكتب ملاحظة المشتريات (أو اكتب 'بدون ملاحظة'):`;
    }

    if (session.step === 6) {
      const note = text === 'بدون ملاحظة' ? '' : text;
      const pro = await WarehouseService.reviewProcurement(
        session.requestId,
        user.id,
        note,
        session.estimatedPrice!,
        session.supplierId,
        session.paymentMethod
      );
      this.procurementReviewSessions.delete(user.phoneNumber);
      return `✅ تم تقديم المراجعة بنجاح لطلب الشراء #${pro.ticketNumber}.\nتم إحالة الطلب للاعتماد المالي.`;
    }

    if (session.step === 3) {
      // Waiting for actual price during mark purchased
      const price = parseFloat(text);
      if (isNaN(price) || price <= 0) {
        return `⚠️ يرجى إدخال سعر فعلي صالح (رقم أكبر من 0):`;
      }
      session.estimatedPrice = price; // store temporarily in session
      session.step = 4;
      this.procurementReviewSessions.set(user.phoneNumber, session);

      return `💳 حدد طريقة الدفع الفعلية بإرسال رقم الخيار:\n` +
             `1️⃣ كاش 💵\n` +
             `2️⃣ تحويل بنكي 🏦\n` +
             `3️⃣ شبكة/مدى 💳\n` +
             `4️⃣ آجل ⏰`;
    }

    if (session.step === 4) {
      const opt = text;
      let paymentMethod = '';
      if (opt === '1') paymentMethod = 'Cash';
      else if (opt === '2') paymentMethod = 'BankTransfer';
      else if (opt === '3') paymentMethod = 'Card';
      else if (opt === '4') paymentMethod = 'Credit';
      else {
        return `⚠️ يرجى إرسال رقم صحيح (1-4):`;
      }
      const price = session.estimatedPrice!;
      const pro = await WarehouseService.markPurchased(
        session.requestId,
        user.id,
        price,
        paymentMethod
      );
      this.procurementReviewSessions.delete(user.phoneNumber);
      return `✅ تم تسجيل شراء الطلب #${pro.ticketNumber} بنجاح وبانتظار استلام البضاعة وتخزينها في المستودع.`;
    }

    return '❌ حالة غير معروفة.';
  }

  private static async handleProcurementApprovalSession(parsed: ParsedWhatsAppMessage, user: any): Promise<string> {
    const text = (parsed.text || '').trim();
    const session = this.procurementApprovalSessions.get(user.phoneNumber);
    if (!session) return '❌ لا توجد جلسة اعتماد مالي نشطة.';

    const { WarehouseService } = require('./warehouse.service');

    if (session.action === 'reject') {
      if (!text) return `⚠️ يرجى كتابة سبب الرفض المالي:`;
      const pro = await WarehouseService.rejectProcurement(session.requestId, user.id, text);
      this.procurementApprovalSessions.delete(user.phoneNumber);
      return `✅ تم رفض طلب الشراء #${pro.ticketNumber} مالياً بنجاح.`;
    }

    return '❌ إجراء غير معروف.';
  }

  private static clearUserSessions(phoneNumber: string): void {
    this.technicianSessions.delete(phoneNumber);
    this.ratingSessions.delete(phoneNumber);
    this.userBranchSessions.delete(phoneNumber);
    this.rejectionSessions.delete(phoneNumber);
    this.procurementSessions.delete(phoneNumber);
    this.shiftReportSessions.delete(phoneNumber);
    this.shiftRejectionSessions.delete(phoneNumber);
    this.attendanceSessions.delete(phoneNumber);
    this.loanSessions.delete(phoneNumber);
    this.leaveSessions.delete(phoneNumber);
    this.loanRejectionSessions.delete(phoneNumber);
    this.leaveRejectionSessions.delete(phoneNumber);
    this.requestMenuSessions.delete(phoneNumber);
    this.adminRequestSessions.delete(phoneNumber);
    this.maintenanceSessions.delete(phoneNumber);
    this.supervisorAssignSessions.delete(phoneNumber);
    this.technicianMntSessions.delete(phoneNumber);
    this.sparePartsSessions.delete(phoneNumber);
    this.maintenanceApprovalSessions.delete(phoneNumber);
    this.warehouseSessions.delete(phoneNumber);
    this.warehouseApprovalSessions.delete(phoneNumber);
    this.procurementReviewSessions.delete(phoneNumber);
    this.procurementApprovalSessions.delete(phoneNumber);
    this.lfSessions.delete(phoneNumber);
    this.dmgSessions.delete(phoneNumber);
    this.dmgReviewSessions.delete(phoneNumber);
    this.dmgPaymentSessions.delete(phoneNumber);
    this.dmgRefusalSessions.delete(phoneNumber);
    this.dmgWaiverSessions.delete(phoneNumber);
  }

  public static mockSendWhatsAppMessage(to: string, text: string): void {
    console.log('\n======================================================');
    console.log(`📤 MOCK SEND WHATSAPP MESSAGE (Redirecting to Real API)`);
    console.log(`To: ${to}`);
    console.log(`Message:\n${text}`);
    console.log('======================================================\n');
    try {
      const { WebhookController } = require('../controllers/webhook.controller');
      WebhookController.sentMessages.push({ to, text });
    } catch (e) {
      // ignore circular require issues or missing controllers in other modules
    }
    this.sendWhatsAppMessage(to, text).catch(err => {
      console.error('Failed to send real WhatsApp message from mock helper:', err.message);
    });
  }

  private static async handleLFSession(parsed: ParsedWhatsAppMessage, user: any): Promise<string> {
    const session = this.lfSessions.get(user.phoneNumber)!;
    const text = (parsed.text || '').trim();

    if (session.step === 1) {
      if (text === '1') {
        session.isGuestSearch = false;
      } else if (text === '2') {
        session.isGuestSearch = true;
      } else {
        return `🛎️ يرجى اختيار الرقم الصحيح:\n1️⃣ عثرت على غرض مفقود\n2️⃣ عميل يبحث عن غرض مفقود`;
      }
      session.step = 2;
      return `📍 أين عثرت عليه؟ (رقم الغرفة أو الموقع):`;
    }

    if (session.step === 2) {
      session.location = text;
      session.step = 3;
      return `📝 صف الغرض بالتفصيل:`;
    }

    if (session.step === 3) {
      session.description = text;
      session.step = 4;
      return `📸 أرسل صورة (أو اكتب 'تخطي'):`;
    }

    if (session.step === 4) {
      if (parsed.messageType === 'media') {
        const mediaId = parsed.mediaId || '';
        const mimeType = parsed.mimeType || 'image/jpeg';
        session.photoUrl = `https://media.rahtihotels.com/media/${mediaId}.${mimeType.split('/')[1] || 'jpg'}`;
      } else if (text === 'تخطي' || text === 'skip') {
        session.photoUrl = null;
      } else {
        return `📸 أرسل صورة (أو اكتب 'تخطي'):`;
      }
      session.step = 5;
      return `👤 هل تعرف اسم العميل أو رقمه؟ (أو اكتب 'غير معروف'):`;
    }

    if (session.step === 5) {
      session.guestName = text === 'غير معروف' ? 'غير معروف' : text;
      session.guestPhone = text === 'غير معروف' ? null : text;
      session.step = 6;

      const branchNameAr = user.branch?.name === 'Sail Road Branch' ? 'فرع طريق السيل' :
                           user.branch?.name === 'Beachside Resort Branch' ? 'فرع منتجع الشاطئ' :
                           user.branch?.name || '';

      const summary = `📋 *ملخص*:\n` +
        `📍 *الموقع*: ${session.location}\n` +
        `📝 *الوصف*: ${session.description}\n` +
        `👤 *العميل*: ${session.guestName}\n` +
        `🏨 *الفرع*: ${branchNameAr}\n\n` +
        `[ ✅ تسجيل ] (زر: confirm_lf_btn)\n` +
        `[ ❌ إلغاء ] (زر: cancel_lf_btn)`;

      return summary;
    }

    return '';
  }

  private static async handleDmgSession(parsed: ParsedWhatsAppMessage, user: any): Promise<string> {
    const session = this.dmgSessions.get(user.phoneNumber)!;
    const text = (parsed.text || '').trim();

    if (session.step === 1) {
      session.roomNumber = text;
      session.step = 2;
      return `📋 رقم الحجز (اختياري - أو اكتب 'تخطي'):`;
    }

    if (session.step === 2) {
      session.reservationRef = text === 'تخطي' ? null : text;
      session.step = 3;
      return `🔧 نوع التلف:\n` +
             `1️⃣ أثاث 🪑\n` +
             `2️⃣ أجهزة إلكترونية 📺\n` +
             `3️⃣ تجهيزات ثابتة 🚿\n` +
             `4️⃣ مفروشات وأغطية 🛏️\n` +
             `5️⃣ أبواب ونوافذ 🚪\n` +
             `6️⃣ أخرى 🔧`;
    }

    if (session.step === 3) {
      let type = '';
      if (text === '1') type = 'Furniture';
      else if (text === '2') type = 'Electronics';
      else if (text === '3') type = 'Fixture';
      else if (text === '4') type = 'Linen';
      else if (text === '5') type = 'Door';
      else if (text === '6') type = 'Other';
      else {
        return `يرجى اختيار الرقم الصحيح (1-6) لنوع التلف:`;
      }
      session.damageType = type;
      session.step = 4;
      return `⏰ متى اكتُشف التلف؟\n` +
             `1️⃣ خلال الإقامة\n` +
             `2️⃣ عند الإخراج (Check-out)`;
    }

    if (session.step === 4) {
      let during = '';
      if (text === '1') during = 'Stay';
      else if (text === '2') during = 'Checkout';
      else {
        return `يرجى اختيار الرقم الصحيح (1-2):\n1️⃣ خلال الإقامة\n2️⃣ عند الإخراج (Check-out)`;
      }
      session.reportedDuring = during;
      session.step = 5;
      return `📝 صف التلف بالتفصيل:`;
    }

    if (session.step === 5) {
      session.description = text;
      session.step = 6;
      return `📸 أرسل صورة للتلف (أو اكتب 'تخطي'):`;
    }

    if (session.step === 6) {
      if (parsed.messageType === 'media') {
        const mediaId = parsed.mediaId || '';
        const mimeType = parsed.mimeType || 'image/jpeg';
        session.photoUrls = [`https://media.rahtihotels.com/media/${mediaId}.${mimeType.split('/')[1] || 'jpg'}`];
      } else if (text === 'تخطي') {
        session.photoUrls = [];
      } else {
        return `📸 أرسل صورة للتلف (أو اكتب 'تخطي'):`;
      }
      session.step = 7;
      return `👤 اسم العميل ورقمه (أو اكتب 'تخطي'):`;
    }

    if (session.step === 7) {
      if (text !== 'تخطي') {
        session.guestName = text;
        session.guestPhone = text;
      } else {
        session.guestName = 'غير معروف';
        session.guestPhone = null;
      }
      session.step = 8;

      const typeAr = session.damageType === 'Furniture' ? 'أثاث 🪑' :
                     session.damageType === 'Electronics' ? 'أجهزة إلكترونية 📺' :
                     session.damageType === 'Fixture' ? 'تجهيزات ثابتة 🚿' :
                     session.damageType === 'Linen' ? 'مفروشات وأغطية 🛏️' :
                     session.damageType === 'Door' ? 'أبواب ونوافذ 🚪' : 'أخرى 🔧';

      const duringAr = session.reportedDuring === 'Stay' ? 'خلال الإقامة' : 'عند الإخراج (Check-out)';
      const branchNameAr = user.branch?.name === 'Sail Road Branch' ? 'فرع طريق السيل' :
                           user.branch?.name === 'Beachside Resort Branch' ? 'فرع منتجع الشاطئ' :
                           user.branch?.name || '';

      const summary = `📋 *ملخص بلاغ التلف*:\n` +
        `🛏️ *الغرفة*: ${session.roomNumber}\n` +
        `🔧 *النوع*: ${typeAr}\n` +
        `⏰ *الوقت*: ${duringAr}\n` +
        `📝 *الوصف*: ${session.description}\n` +
        `👤 *العميل*: ${session.guestName}\n` +
        `🏨 *الفرع*: ${branchNameAr}\n\n` +
        `[ ✅ تسجيل ] (زر: confirm_dmg_btn)\n` +
        `[ ❌ إلغاء ] (زر: cancel_dmg_btn)`;

      return summary;
    }

    return '';
  }

  private static async handleDmgReviewSession(parsed: ParsedWhatsAppMessage, user: any): Promise<string> {
    const session = this.dmgReviewSessions.get(user.phoneNumber)!;
    const text = (parsed.text || '').trim();

    if (session.step === 1) {
      const val = parseFloat(text);
      if (isNaN(val) || val < 0) {
        return `💰 ما قيمة التعويض المقترحة؟ (بالريال):`;
      }
      session.finalValue = val;
      session.step = 2;
      return `📝 ملاحظة (اختياري - أو 'تخطي'):`;
    }

    if (session.step === 2) {
      const note = text === 'تخطي' ? null : text;
      const { LostFoundService } = require('./lostfound.service');
      await LostFoundService.reviewDamage(session.requestId, user.id, session.finalValue!, note);
      this.dmgReviewSessions.delete(user.phoneNumber);
      return `✅ تم حفظ المراجعة وإشعار موظفي الاستقبال بالقيمة المحددة.`;
    }

    return '';
  }

  private static async handleDmgPaymentSession(parsed: ParsedWhatsAppMessage, user: any): Promise<string> {
    const session = this.dmgPaymentSessions.get(user.phoneNumber)!;
    const text = (parsed.text || '').trim();

    if (session.step === 1) {
      let method = '';
      if (text === '1') method = 'Cash';
      else if (text === '2') method = 'Card';
      else if (text === '3') method = 'BankTransfer';
      else if (text === '4') method = 'Credit';
      else {
        return `يرجى اختيار الرقم الصحيح (1-4):\n1️⃣ كاش 💵\n2️⃣ شبكة/مدى 💳\n3️⃣ تحويل بنكي 🏦\n4️⃣ آجل ⏰`;
      }
      session.paymentMethod = method;

      if (method === 'Credit') {
        session.step = 2;
        return `📅 تاريخ الاستحقاق (YYYY-MM-DD):`;
      } else {
        session.step = 3;
        return `🧾 رقم الإيصال أو مرجع العملية (أو 'تخطي'):`;
      }
    }

    if (session.step === 2) {
      session.paymentDueDate = text;
      session.step = 3;
      return `🧾 رقم الإيصال أو مرجع العملية (أو 'تخطي'):`;
    }

    if (session.step === 3) {
      const ref = text === 'تخطي' ? null : text;
      const { LostFoundService } = require('./lostfound.service');
      await LostFoundService.collectPayment(session.requestId, {
        paymentMethod: session.paymentMethod!,
        paymentRef: ref,
        collectedBy: user.id,
        paymentDueDate: session.paymentDueDate
      });
      this.dmgPaymentSessions.delete(user.phoneNumber);
      return `✅ تم تسجيل السداد بنجاح وإغلاق مطالبة التلفيات.`;
    }

    return '';
  }

  private static async handleDmgRefusalTextSession(parsed: ParsedWhatsAppMessage, user: any): Promise<string> {
    const requestId = this.dmgRefusalSessions.get(user.phoneNumber)!;
    const text = (parsed.text || '').trim();

    const { LostFoundService } = require('./lostfound.service');
    await LostFoundService.markRefused(requestId, text);
    this.dmgRefusalSessions.delete(user.phoneNumber);
    return `✅ تم تسجيل رفض العميل وتنبيه مدير الفرع للمتابعة.`;
  }

  private static async handleDmgWaiverTextSession(parsed: ParsedWhatsAppMessage, user: any): Promise<string> {
    const requestId = this.dmgWaiverSessions.get(user.phoneNumber)!;
    const text = (parsed.text || '').trim();

    const { LostFoundService } = require('./lostfound.service');
    await LostFoundService.waiveDamage(requestId, user.id, text);
    this.dmgWaiverSessions.delete(user.phoneNumber);
    return `🤝 تم إسقاط مطالبة التلفيات وإعفاء العميل بنجاح.`;
  }

  private static schedulerInitialized = false;

  public static scheduleDailyDigest(): void {
    if (this.schedulerInitialized) return;
    this.schedulerInitialized = true;

    const interval = setInterval(async () => {
      try {
        const now = new Date();
        const hours = now.getHours();
        const minutes = now.getMinutes();
        if (hours === 7 && minutes === 0) {
          const { DigestService } = require('./digest.service');
          await DigestService.sendDailyDigestToAllBranches();
        }
        if (hours === 8 && minutes === 0) {
          await this.checkAndAlertExpiringDocuments();
        }
      } catch (err) {
        console.error('Error in scheduled daily digest:', err);
      }
    }, 60000);

    if (interval && typeof interval.unref === 'function') {
      interval.unref();
    }
  }

  public static async checkAndAlertExpiringDocuments(): Promise<void> {
    const now = new Date();
    
    // 1. Mark expired documents
    const expiredDocs = await prisma.document.findMany({
      where: {
        isExpired: false,
        expiryDate: { lt: now }
      },
      include: { branch: true }
    });

    for (const doc of expiredDocs) {
      await prisma.document.update({
        where: { id: doc.id },
        data: { isExpired: true }
      });
      await this.sendExpiryAlert(doc, '🔴 انتهت صلاحية الوثيقة!');
    }

    // 2. 7 days warning
    const sevenDaysFromNow = new Date();
    sevenDaysFromNow.setDate(now.getDate() + 7);
    const expiring7Docs = await prisma.document.findMany({
      where: {
        isExpired: false,
        alertSent7: false,
        expiryDate: { lte: sevenDaysFromNow, gt: now }
      },
      include: { branch: true }
    });

    for (const doc of expiring7Docs) {
      await prisma.document.update({
        where: { id: doc.id },
        data: { alertSent7: true }
      });
      await this.sendExpiryAlert(doc, '⚠️ تحذير عاجل: تنتهي صلاحية الوثيقة خلال 7 أيام أو أقل!');
    }

    // 3. 30 days warning
    const thirtyDaysFromNow = new Date();
    thirtyDaysFromNow.setDate(now.getDate() + 30);
    const expiring30Docs = await prisma.document.findMany({
      where: {
        isExpired: false,
        alertSent30: false,
        expiryDate: { lte: thirtyDaysFromNow, gt: now }
      },
      include: { branch: true }
    });

    for (const doc of expiring30Docs) {
      await prisma.document.update({
        where: { id: doc.id },
        data: { alertSent30: true }
      });
      await this.sendExpiryAlert(doc, '🟡 تنبيه: تنتهي صلاحية الوثيقة خلال 30 يوم أو أقل.');
    }
  }

  private static async sendExpiryAlert(doc: any, prefix: string): Promise<void> {
    const manager = await prisma.user.findFirst({
      where: {
        branchId: doc.branchId,
        role: Role.BranchManager
      }
    });
    
    const recipient = manager || await prisma.user.findFirst({
      where: { role: Role.Admin }
    });

    if (recipient) {
      const expiryStr = doc.expiryDate ? new Date(doc.expiryDate).toLocaleDateString('ar-SA') : 'غير محدد';
      const message = `${prefix}\n\n` +
        `📄 الاسم: ${doc.title}\n` +
        `🏢 القسم: ${doc.department}\n` +
        `🏢 الفرع: ${doc.branch.name}\n` +
        `📅 تاريخ الانتهاء: ${expiryStr}\n` +
        `🔗 يرجى تحديث الوثيقة في أقرب وقت لتفادي أي غرامات أو تعطيل للعمل.`;

      console.log(`[Expiry Cron Alert] Sending WhatsApp to ${recipient.phoneNumber}:\n${message}`);
      const { WebhookController } = require('../controllers/webhook.controller');
      WebhookController.sentMessages.push({ to: recipient.phoneNumber, text: message });
    }
  }

  private static async getDynamicMenu(user: any): Promise<{ menuText: string; enabledOptions: any[] }> {
    const settings = await prisma.systemSetting.findMany();
    const settingsMap = settings.reduce((acc: Record<string, string>, curr) => {
      acc[curr.key] = curr.value;
      return acc;
    }, {});

    const ALL_MENU_OPTIONS = [
      { id: '1', settingKey: 'bot_menu_maintenance', emoji: '🛠️', label: 'طلب صيانة عامة' },
      { id: '2', settingKey: 'bot_menu_cleaning', emoji: '🧹', label: 'نظافة وتجهيز الغرف' },
      { id: '3', settingKey: 'bot_menu_warehouse', emoji: '📦', label: 'طلب من المستودع' },
      { id: '4', settingKey: 'bot_menu_procurement', emoji: '🛒', label: 'طلب شراء خارجي' },
      { id: '5', settingKey: 'bot_menu_techsupport', emoji: '💻', label: 'دعم فني وتقني' },
      { id: '6', settingKey: 'bot_menu_lostfound', emoji: '🛎️', label: 'تسجيل مفقودات' },
      { id: '7', settingKey: 'bot_menu_damage', emoji: '💥', label: 'تسجيل تلفيات' },
      { id: '8', settingKey: 'bot_menu_loan', emoji: '💰', label: 'طلب سلفة' },
      { id: '9', settingKey: 'bot_menu_leave', emoji: '🏖️', label: 'طلب إجازة' },
      { id: '10', settingKey: 'bot_menu_other', emoji: '📋', label: 'طلب آخر (إداري)' },
    ];

    const enabledOptions = ALL_MENU_OPTIONS.filter(opt => settingsMap[opt.settingKey] !== 'false');

    let menuText = `مرحباً ${user.name} 👋\n` +
                   `اختر نوع طلبك:\n\n`;

    const numberEmojis = ['1️⃣', '2️⃣', '3️⃣', '4️⃣', '5️⃣', '6️⃣', '7️⃣', '8️⃣', '9️⃣', '🔟'];

    enabledOptions.forEach((opt, idx) => {
      const numEmoji = numberEmojis[idx] || `${idx + 1}.`;
      menuText += `${numEmoji} ${opt.emoji} ${opt.label}\n`;
    });

    menuText += `\nأرسل رقم الخيار:`;

    return { menuText, enabledOptions };
  }

  public static async sendWhatsAppMessage(to: string, text: string): Promise<void> {
    console.log(`[WhatsApp Bot] Sending REAL message to ${to}:\n${text}`);
    try {
      try {
        const { WebhookController } = require('../controllers/webhook.controller');
        WebhookController.sentMessages.push({ to, text });
      } catch (e) {
        // ignore circular require
      }

      if (process.env.MESSAGING_PLATFORM === 'telegram') {
        const { TelegramService } = require('./telegram.service');
        let chatId = TelegramService.getChatIdByPhone(to);
        if (!chatId) {
          const cleanPhone = to.replace('+', '');
          const alternatives = [to, cleanPhone, '+' + cleanPhone];
          const dbUser = await prisma.user.findFirst({
            where: {
              phoneNumber: { in: alternatives },
              telegramChatId: { not: null }
            },
            select: { telegramChatId: true }
          });
          if (dbUser?.telegramChatId) {
            chatId = dbUser.telegramChatId;
          }
        }
        if (chatId) {
          await TelegramService.sendMessage(chatId, text);
          return;
        } else {
          console.warn(`[Telegram Bot] Cannot send message to ${to}: No authenticated chat ID found in mappings or database.`);
          return;
        }
      }

      if (process.env.WHATSAPP_PROVIDER === 'twilio') {
        const accountSid = process.env.TWILIO_ACCOUNT_SID;
        const authToken = process.env.TWILIO_AUTH_TOKEN;
        const fromNumber = process.env.TWILIO_WHATSAPP_NUMBER || 'whatsapp:+14155238886';

        if (!accountSid || !authToken) {
          throw new Error('Twilio credentials (TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN) are missing');
        }

        const client = twilio(accountSid, authToken);
        const recipient = to.startsWith('whatsapp:') ? to : `whatsapp:${to}`;

        const response = await client.messages.create({
          body: text,
          from: fromNumber,
          to: recipient,
        });

        console.log('✅ Real WhatsApp message sent via Twilio. SID:', response.sid);
        return;
      }

      const response = await axios.post(
        `https://graph.facebook.com/v18.0/${process.env.PHONE_NUMBER_ID}/messages`,
        {
          messaging_product: 'whatsapp',
          to: to,
          type: 'text',
          text: { body: text }
        },
        {
          headers: {
            Authorization: `Bearer ${process.env.WHATSAPP_TOKEN}`,
            'Content-Type': 'application/json'
          }
        }
      );
      console.log('✅ Real WhatsApp message sent. Status:', response.status);
    } catch (error: any) {
      console.error('❌ Error sending WhatsApp message:', error?.response?.data || error.message);
      throw error;
    }
  }
}

WhatsAppService.scheduleDailyDigest();

