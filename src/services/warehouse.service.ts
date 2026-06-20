import prisma from './prisma';
import { WhatsAppService } from './whatsapp.service';

export class WarehouseService {
  /**
   * Generates a warehouse request ticket number: WHR-2026-XXXX
   */
  public static async generateWarehouseTicket(): Promise<string> {
    const lastRequest = await prisma.warehouseRequest.findFirst({
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
    
    return `WHR-2026-${String(nextNum).padStart(4, '0')}`;
  }

  /**
   * Generates a procurement request ticket number: PRO-2026-XXXX
   */
  public static async generateProcurementTicket(): Promise<string> {
    const lastRequest = await prisma.procurementRequest.findFirst({
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
    
    return `PRO-2026-${String(nextNum).padStart(4, '0')}`;
  }

  /**
   * Gets items list, optionally filtered by category and search.
   */
  public static async getItems(filters?: { categoryId?: string; search?: string }) {
    const where: any = {};
    if (filters?.categoryId) {
      where.categoryId = filters.categoryId;
    }
    if (filters?.search) {
      where.name = { contains: filters.search };
    }
    return prisma.item.findMany({
      where,
      include: {
        category: true,
        stockEntries: {
          include: { branch: true }
        }
      },
      orderBy: { name: 'asc' }
    });
  }

  /**
   * Gets single item by ID including all branch stock entries.
   */
  public static async getItemById(id: string) {
    return prisma.item.findUnique({
      where: { id },
      include: {
        category: true,
        stockEntries: {
          include: { branch: true }
        }
      }
    });
  }

  /**
   * Creates a new item and initializes StockEntry for all branches.
   */
  public static async createItem(data: { name: string; unit: string; categoryId: string; description?: string }) {
    const item = await prisma.item.create({
      data: {
        name: data.name,
        unit: data.unit,
        categoryId: data.categoryId,
        description: data.description || null
      },
      include: {
        category: true
      }
    });

    // Initialize stock entry for all branches
    const branches = await prisma.branch.findMany();
    for (const b of branches) {
      await prisma.stockEntry.create({
        data: {
          itemId: item.id,
          branchId: b.id,
          quantity: 0,
          minThreshold: 5,
          maxCapacity: 100
        }
      });
    }

    return this.getItemById(item.id);
  }

  /**
   * Updates an item's main attributes.
   */
  public static async updateItem(id: string, data: { name?: string; unit?: string; categoryId?: string; description?: string }) {
    await prisma.item.update({
      where: { id },
      data: {
        name: data.name,
        unit: data.unit,
        categoryId: data.categoryId,
        description: data.description
      }
    });
    return this.getItemById(id);
  }

  /**
   * Gets stock entries by branch.
   */
  public static async getStockByBranch(branchId: string) {
    return prisma.stockEntry.findMany({
      where: { branchId },
      include: {
        item: {
          include: { category: true }
        },
        branch: true
      }
    });
  }

  /**
   * Gets a single stock entry.
   */
  public static async getStockEntry(itemId: string, branchId: string) {
    return prisma.stockEntry.findUnique({
      where: { itemId_branchId: { itemId, branchId } },
      include: { item: true, branch: true }
    });
  }

  /**
   * Adjusts stock level for an item in a branch, creates stock movement log, and checks min threshold.
   */
  public static async adjustStock(
    itemId: string,
    branchId: string,
    quantity: number,
    type: string, // "In" | "Out" | "Transfer" | "Adjustment"
    reason: string, // "EmployeeRequest" | "MaintenanceRequest" | "AutoRestock" | "ManualAdjustment" | "Transfer"
    performedBy: string,
    note?: string,
    referenceId?: string
  ) {
    let entry = await prisma.stockEntry.findUnique({
      where: { itemId_branchId: { itemId, branchId } }
    });

    if (!entry) {
      entry = await prisma.stockEntry.create({
        data: {
          itemId,
          branchId,
          quantity: 0,
          minThreshold: 5,
          maxCapacity: 100
        }
      });
    }

    const oldQty = entry.quantity;
    let change = quantity;
    if (type === 'Out') {
      change = -Math.abs(quantity);
    } else if (type === 'In') {
      change = Math.abs(quantity);
    }

    const newQty = Math.max(0, oldQty + change);

    const updatedEntry = await prisma.stockEntry.update({
      where: { id: entry.id },
      data: {
        quantity: newQty,
        lastUpdated: new Date()
      },
      include: {
        item: true,
        branch: true
      }
    });

    // Create Stock Movement log
    await prisma.stockMovement.create({
      data: {
        itemId,
        branchId,
        type: type as any,
        quantity: change,
        reason: reason as any,
        referenceId: referenceId || null,
        performedBy,
        note: note || null
      }
    });

    // If new qty is below minimum threshold, check and trigger auto-procurement
    if (newQty < updatedEntry.minThreshold) {
      await this.checkAndCreateProcurement(itemId, branchId);
    }

    return updatedEntry;
  }

  /**
   * Checks if active procurement request exists. If not, auto-creates a low-stock request and notifies Procurement Officer.
   */
  public static async checkAndCreateProcurement(itemId: string, branchId: string) {
    // Check for active procurement request (Pending, ReviewedByProcurement, PendingFinancialApproval, FinanciallyApproved, Purchased)
    const existingActive = await prisma.procurementRequest.findFirst({
      where: {
        itemId,
        branchId,
        status: {
          in: ['Pending', 'ReviewedByProcurement', 'PendingFinancialApproval', 'FinanciallyApproved', 'Purchased']
        }
      }
    });

    if (existingActive) {
      return existingActive;
    }

    const item = await prisma.item.findUnique({ where: { id: itemId } });
    const branch = await prisma.branch.findUnique({ where: { id: branchId } });
    const stockEntry = await prisma.stockEntry.findUnique({
      where: { itemId_branchId: { itemId, branchId } }
    });

    if (!item || !branch || !stockEntry) return null;

    const ticketNumber = await this.generateProcurementTicket();
    
    // Auto-request 50 units or maxCapacity - current quantity
    const quantityNeeded = Math.max(50, stockEntry.maxCapacity - stockEntry.quantity);

    // Fallback requester (e.g. system admin u-1)
    const systemRequester = await prisma.user.findFirst({
      where: { role: 'Admin' }
    });
    const requestedBy = systemRequester ? systemRequester.id : 'u-1';

    const req = await prisma.procurementRequest.create({
      data: {
        ticketNumber,
        requestedBy,
        branchId,
        itemId,
        itemName: item.name,
        quantityNeeded,
        unit: item.unit,
        source: 'LowStock',
        status: 'Pending'
      }
    });

    // Notify all Procurement Officers via WhatsApp
    const procurementOfficers = await prisma.user.findMany({
      where: { role: 'ProcurementOfficer' }
    });

    const branchNameAr = branch.name === 'Sail Road Branch' ? 'فرع طريق السيل' :
                         branch.name === 'Beachside Resort Branch' ? 'فرع منتجع الشاطئ' : branch.name;

    const notifyMsg = `⚠️ *تنبيه مخزون منخفض*\n\n` +
      `📦 *الصنف*: ${item.name}\n` +
      `🏨 *الفرع*: ${branchNameAr}\n` +
      `📊 *المتوفر*: ${stockEntry.quantity} ${item.unit} (الحد الأدنى: ${stockEntry.minThreshold})\n` +
      `🎫 *طلب شراء تلقائي*: #${req.ticketNumber}\n\n` +
      `يرجى مراجعة طلب الشراء وإضافة التسعير.\n\n` +
      `[ 📋 مراجعة طلب الشراء ] (زر: review_procurement_${req.id})`;

    for (const po of procurementOfficers) {
      WhatsAppService.mockSendWhatsAppMessage(po.phoneNumber, notifyMsg);
    }

    return req;
  }

  /**
   * Creates a new warehouse request from an employee.
   */
  public static async createWarehouseRequest(data: { requestedBy: string; branchId: string; itemId: string; quantityRequested: number; purpose?: string }) {
    const ticketNumber = await this.generateWarehouseTicket();
    const req = await prisma.warehouseRequest.create({
      data: {
        ticketNumber,
        requestedBy: data.requestedBy,
        branchId: data.branchId,
        itemId: data.itemId,
        quantityRequested: data.quantityRequested,
        purpose: data.purpose || null,
        status: 'Pending'
      },
      include: {
        item: true,
        branch: true,
        requester: true
      }
    });

    // Notify Warehouse Manager
    const managers = await prisma.user.findMany({
      where: {
        role: 'WarehouseManager',
        OR: [
          { branchId: data.branchId },
          { branchId: null }
        ]
      }
    });

    const branchNameAr = req.branch.name === 'Sail Road Branch' ? 'فرع طريق السيل' :
                         req.branch.name === 'Beachside Resort Branch' ? 'فرع منتجع الشاطئ' : req.branch.name;

    const managerMsg = `📦 *طلب صرف مستودع جديد #${req.ticketNumber}*\n\n` +
      `👤 *الطالب*: ${req.requester.name}\n` +
      `📦 *الصنف*: ${req.item.name}\n` +
      `🔢 *الكمية المطلوبة*: ${req.quantityRequested} ${req.item.unit}\n` +
      `📝 *الغرض*: ${req.purpose || 'غير محدد'}\n` +
      `🏨 *الفرع*: ${branchNameAr}\n\n` +
      `[ ✅ صرف الكمية كاملة ] (زر: issue_full_${req.id})\n` +
      `[ 🔢 صرف كمية جزئية ] (زر: issue_partial_${req.id})\n` +
      `[ ❌ رفض الطلب ] (زر: reject_whr_${req.id})`;

    for (const mgr of managers) {
      WhatsAppService.mockSendWhatsAppMessage(mgr.phoneNumber, managerMsg);
    }

    return req;
  }

  /**
   * Approves a warehouse request and deducts stock.
   */
  public static async approveWarehouseRequest(requestId: string, approverId: string, quantityIssued: number) {
    const request = await prisma.warehouseRequest.findUnique({
      where: { id: requestId },
      include: { item: true, requester: true }
    });

    if (!request) {
      throw new Error('Warehouse request not found');
    }

    const isFull = quantityIssued >= request.quantityRequested;
    const status = isFull ? 'Approved' : 'PartiallyApproved';

    const updated = await prisma.warehouseRequest.update({
      where: { id: requestId },
      data: {
        status,
        quantityIssued,
        approvedBy: approverId
      },
      include: { item: true, branch: true, requester: true }
    });

    // Deduct stock
    await this.adjustStock(
      request.itemId,
      request.branchId,
      quantityIssued,
      'Out',
      'EmployeeRequest',
      approverId,
      `صرف طلب #${request.ticketNumber}`,
      requestId
    );

    // Notify requester
    const msg = `✅ *تم اعتماد طلبك للمستودع #${updated.ticketNumber}*\n\n` +
      `📦 *الصنف*: ${updated.item.name}\n` +
      `🔢 *الكمية المصروفة*: ${quantityIssued} ${updated.item.unit} ${!isFull ? `(الطلبية الأصلية: ${request.quantityRequested})` : ''}\n` +
      `يمكنك الآن استلامها من أمين المستودع.`;

    WhatsAppService.mockSendWhatsAppMessage(updated.requester.phoneNumber, msg);

    return updated;
  }

  /**
   * Rejects a warehouse request.
   */
  public static async rejectWarehouseRequest(requestId: string, approverId: string, rejectionReason: string) {
    const request = await prisma.warehouseRequest.findUnique({
      where: { id: requestId },
      include: { requester: true, item: true }
    });

    if (!request) {
      throw new Error('Warehouse request not found');
    }

    const updated = await prisma.warehouseRequest.update({
      where: { id: requestId },
      data: {
        status: 'Rejected',
        rejectionReason,
        approvedBy: approverId
      },
      include: { item: true, branch: true, requester: true }
    });

    // Notify requester
    const msg = `❌ *تم رفض طلبك للمستودع #${updated.ticketNumber}*\n\n` +
      `📦 *الصنف*: ${updated.item.name}\n` +
      `⚠️ *السبب*: ${rejectionReason}`;

    WhatsAppService.mockSendWhatsAppMessage(updated.requester.phoneNumber, msg);

    return updated;
  }

  /**
   * Gets list of warehouse requests.
   */
  public static async getWarehouseRequests(filters?: { status?: string; branchId?: string; itemId?: string }) {
    const where: any = {};
    if (filters?.status) where.status = filters.status;
    if (filters?.branchId) where.branchId = filters.branchId;
    if (filters?.itemId) where.itemId = filters.itemId;

    return prisma.warehouseRequest.findMany({
      where,
      include: {
        item: true,
        branch: true,
        requester: true,
        approver: true
      },
      orderBy: { createdAt: 'desc' }
    });
  }

  /**
   * Gets stats for the warehouse.
   */
  public static async getWarehouseStats(branchId?: string) {
    const where: any = {};
    if (branchId) {
      where.branchId = branchId;
    }

    const stockEntries = await prisma.stockEntry.findMany({
      where,
      include: { item: true }
    });

    const totalItems = stockEntries.length;
    // Mock standard item value: 15 per quantity
    const totalValue = stockEntries.reduce((sum, entry) => sum + (entry.quantity * 15), 0);
    const lowStockCount = stockEntries.filter(entry => entry.quantity < entry.minThreshold).length;

    const requestWhere: any = {};
    if (branchId) {
      requestWhere.branchId = branchId;
    }
    requestWhere.status = 'Pending';
    const pendingRequests = await prisma.warehouseRequest.count({ where: requestWhere });

    const movementWhere: any = {};
    if (branchId) {
      movementWhere.branchId = branchId;
    }
    const today = new Date();
    today.setHours(0,0,0,0);
    movementWhere.createdAt = { gte: today };
    const todayMovements = await prisma.stockMovement.count({ where: movementWhere });

    return {
      totalItems,
      totalValue,
      lowStockCount,
      pendingRequests,
      todayMovements
    };
  }

  /**
   * Gets procurement requests list.
   */
  public static async getProcurementRequests(filters?: { status?: string; branchId?: string; source?: string }) {
    const where: any = {};
    if (filters?.status) where.status = filters.status;
    if (filters?.branchId) where.branchId = filters.branchId;
    if (filters?.source) where.source = filters.source;

    return prisma.procurementRequest.findMany({
      where,
      include: {
        item: true,
        branch: true,
        requester: true,
        reviewer: true,
        approver: true,
        purchaser: true,
        supplier: true
      },
      orderBy: { createdAt: 'desc' }
    });
  }

  /**
   * Gets single procurement request by ID.
   */
  public static async getProcurementById(id: string) {
    return prisma.procurementRequest.findUnique({
      where: { id },
      include: {
        item: true,
        branch: true,
        requester: true,
        reviewer: true,
        approver: true,
        purchaser: true,
        supplier: true
      }
    });
  }

  /**
   * Procurement Officer reviews procurement and submits estimate & supplier choice.
   */
  public static async reviewProcurement(
    id: string,
    reviewerId: string,
    note: string,
    estimatedPrice: number,
    supplierId?: string,
    paymentMethod?: string
  ) {
    const req = (await prisma.procurementRequest.update({
      where: { id },
      data: {
        status: 'PendingFinancialApproval',
        estimatedPrice,
        supplierId: supplierId || null,
        paymentMethod: (paymentMethod || null) as any,
        reviewedBy: reviewerId,
        procurementNote: note
      },
      include: { item: true, branch: true, supplier: true }
    })) as any;

    // Notify Accountants & Admins for financial approval
    const accountants = await prisma.user.findMany({
      where: {
        role: { in: ['Accountant', 'Admin'] }
      }
    });

    const supName = req.supplier ? req.supplier.name : 'مورد غير محدد';
    const payMethodAr = paymentMethod === 'Cash' ? 'كاش 💵' :
                         paymentMethod === 'BankTransfer' ? 'تحويل بنكي 🏦' :
                         paymentMethod === 'Card' ? 'شبكة/مدى 💳' :
                         paymentMethod === 'Credit' ? 'آجل ⏰' : paymentMethod || 'غير محدد';

    const notifyMsg = `💰 *طلب شراء يحتاج اعتماد مالي #${req.ticketNumber}*\n\n` +
      `📦 *الصنف*: ${req.itemName} × ${req.quantityNeeded} ${req.unit}\n` +
      `💵 *السعر التقديري*: ${estimatedPrice} ريال\n` +
      `💳 *طريقة الدفع*: ${payMethodAr}\n` +
      `🏢 *المورد*: ${supName}\n\n` +
      `[ ✅ اعتماد مالي ] (زر: approve_finance_${req.id})\n` +
      `[ ❌ رفض مالي ] (زر: reject_finance_${req.id})`;

    for (const acc of accountants) {
      WhatsAppService.mockSendWhatsAppMessage(acc.phoneNumber, notifyMsg);
    }

    return this.getProcurementById(id);
  }

  /**
   * Financially approves procurement request.
   */
  public static async financiallyApproveProcurement(id: string, approverId: string, note?: string) {
    const req = await prisma.procurementRequest.update({
      where: { id },
      data: {
        status: 'FinanciallyApproved',
        approvedBy: approverId,
        financialNote: note || null
      },
      include: { reviewer: true }
    });

    // Notify Procurement Officer
    const officers = await prisma.user.findMany({
      where: { role: 'ProcurementOfficer' }
    });

    const notifyMsg = `✅ *تم الاعتماد المالي لطلب الشراء #${req.ticketNumber}*\n` +
      `يمكنك المضي قدماً في عملية الشراء.\n\n` +
      `[ 🛒 تأكيد الشراء ] (زر: mark_purchased_btn_${req.id})`;

    for (const po of officers) {
      WhatsAppService.mockSendWhatsAppMessage(po.phoneNumber, notifyMsg);
    }

    return this.getProcurementById(id);
  }

  /**
   * Rejects procurement request.
   */
  public static async rejectProcurement(id: string, approverId: string, reason: string) {
    const req = await prisma.procurementRequest.update({
      where: { id },
      data: {
        status: 'Rejected',
        rejectionReason: reason,
        approvedBy: approverId
      },
      include: { requester: true }
    });

    // Notify requester (and PO if they reviewed it)
    const msg = `❌ *تم رفض طلب الشراء #${req.ticketNumber}*\n\n` +
      `⚠️ *السبب*: ${reason}`;

    WhatsAppService.mockSendWhatsAppMessage(req.requester.phoneNumber, msg);

    return this.getProcurementById(id);
  }

  /**
   * Marks procurement request as purchased.
   */
  public static async markPurchased(id: string, purchaserId: string, actualPrice: number, paymentMethod: string, receiptPhotoUrl?: string) {
    const req = (await prisma.procurementRequest.update({
      where: { id },
      data: {
        status: 'Purchased',
        actualPrice,
        paymentMethod: paymentMethod as any,
        receiptPhotoUrl: receiptPhotoUrl || null,
        purchasedBy: purchaserId
      },
      include: { branch: true }
    })) as any;

    // Notify Warehouse Manager
    const managers = await prisma.user.findMany({
      where: {
        role: 'WarehouseManager',
        OR: [
          { branchId: req.branchId },
          { branchId: null }
        ]
      }
    });

    const notifyMsg = `📦 *الطلب #${req.ticketNumber} تم شراؤه وبانتظار الاستلام*\n\n` +
      `📦 *الصنف*: ${req.itemName}\n` +
      `🔢 *الكمية*: ${req.quantityNeeded} ${req.unit}\n` +
      `💵 *القيمة الفعلية*: ${actualPrice} ريال\n` +
      `يرجى تأكيد الاستلام وتخزينها في المستودع فور وصولها.\n\n` +
      `[ ✅ تأكيد الاستلام في المستودع ] (زر: confirm_receive_btn_${req.id})`;

    for (const mgr of managers) {
      WhatsAppService.mockSendWhatsAppMessage(mgr.phoneNumber, notifyMsg);
    }

    return this.getProcurementById(id);
  }

  /**
   * Receives items into stock.
   */
  public static async receiveInWarehouse(id: string, receiverId: string, quantityReceived: number) {
    const req = await prisma.procurementRequest.findUnique({
      where: { id },
      include: { requester: true }
    });

    if (!req) {
      throw new Error('Procurement request not found');
    }

    const updated = await prisma.procurementRequest.update({
      where: { id },
      data: {
        status: 'ReceivedInWarehouse'
      },
      include: { item: true, branch: true }
    });

    if (req.itemId) {
      // Restock the item
      await this.adjustStock(
        req.itemId,
        req.branchId,
        quantityReceived,
        'In',
        'AutoRestock',
        receiverId,
        `استلام طلب شراء #${req.ticketNumber}`,
        id
      );
    }

    // Notify original requester
    const msg = `🎉 *تم استلام وتخزين الكمية المشتراة لطلب الشراء #${req.ticketNumber}*\n\n` +
      `📦 *الصنف*: ${req.itemName}\n` +
      `🔢 *الكمية المستلمة*: ${quantityReceived} ${req.unit}\n` +
      `تم إدخالها إلى مخزون المستودع بنجاح.`;

    WhatsAppService.mockSendWhatsAppMessage(req.requester.phoneNumber, msg);

    return this.getProcurementById(id);
  }

  /**
   * Gets list of suppliers.
   */
  public static async getSuppliers() {
    return prisma.supplier.findMany({
      orderBy: { name: 'asc' }
    });
  }

  /**
   * Creates a new supplier.
   */
  public static async createSupplier(data: { name: string; contactName?: string; phone?: string; email?: string; address?: string; category?: string; rating?: number }) {
    return prisma.supplier.create({
      data: {
        name: data.name,
        contactName: data.contactName || null,
        phone: data.phone || null,
        email: data.email || null,
        address: data.address || null,
        category: data.category || null,
        rating: data.rating || 3
      }
    });
  }

  /**
   * Updates supplier information.
   */
  public static async updateSupplier(id: string, data: { name?: string; contactName?: string; phone?: string; email?: string; address?: string; category?: string; rating?: number; isActive?: boolean }) {
    return prisma.supplier.update({
      where: { id },
      data: {
        name: data.name,
        contactName: data.contactName,
        phone: data.phone,
        email: data.email,
        address: data.address,
        category: data.category,
        rating: data.rating,
        isActive: data.isActive
      }
    });
  }
}
