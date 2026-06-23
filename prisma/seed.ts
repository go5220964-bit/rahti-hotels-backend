import { PrismaClient } from '@prisma/client';
import { Role, RequestType, RequestStatus, ApprovalStatus } from '../src/types';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

async function main() {
  console.log('🌱 Starting database seeding...');
  const passwordHash = bcrypt.hashSync('Rahti@2026', 10);

  // 1. Clean existing database records
  await prisma.document.deleteMany({});
  await prisma.lostFoundItem.deleteMany({});
  await prisma.damageReport.deleteMany({});
  await prisma.maintenanceTimeline.deleteMany({});
  await prisma.maintenanceRequest.deleteMany({});
  await prisma.procurementRequest.deleteMany({});
  await prisma.supplier.deleteMany({});
  await prisma.warehouseRequest.deleteMany({});
  await prisma.stockMovement.deleteMany({});
  await prisma.stockEntry.deleteMany({});
  await prisma.item.deleteMany({});
  await prisma.itemCategory.deleteMany({});
  await prisma.leaveRequest.deleteMany({});
  await prisma.loanRequest.deleteMany({});
  await prisma.systemSettings.deleteMany({});
  await prisma.request.deleteMany({});
  await prisma.shiftReport.deleteMany({});
  await prisma.attendanceLog.deleteMany({});
  await prisma.shift.deleteMany({});
  await prisma.user.deleteMany({});
  await prisma.inventoryItem.deleteMany({});
  await prisma.branch.deleteMany({});
  
  await prisma.systemSetting.deleteMany({});
  await prisma.activityLog.deleteMany({});
  await prisma.employeeTransfer.deleteMany({});
  await prisma.attendanceRecord.deleteMany({});
  await prisma.stockAddition.deleteMany({});
  await prisma.unitOfMeasure.deleteMany({});

  console.log('🧹 Cleaned existing database tables.');

  // 2. Create Global System Settings
  const settings = await prisma.systemSettings.create({
    data: {
      id: 'global',
      procurementApprovalThreshold: 5000.0,
    },
  });
  console.log('⚙️ Created SystemSettings:', settings);

  // 3. Create Branches
  const sailRoadBranch = await prisma.branch.create({
    data: {
      name: 'Sail Road Branch',
      location: 'Mombasa, Kenya',
      lat: 21.4858,
      lng: 39.1925,
      radiusMeters: 200,
    },
  });

  const beachsideBranch = await prisma.branch.create({
    data: {
      name: 'Beachside Resort Branch',
      location: 'Diani Beach, Kenya',
      lat: 21.4925,
      lng: 39.1775,
      radiusMeters: 200,
    },
  });
  console.log('🏨 Created Branches:', { sailRoadBranch, beachsideBranch });

  // 3b. Create System Setting for Attendance Buffer
  await prisma.systemSetting.create({
    data: {
      key: 'attendance_buffer_minutes',
      value: '30',
    },
  });

  // Seed Units of Measure
  const unitKg = await prisma.unitOfMeasure.create({ data: { name: 'كيلوغرام', abbreviation: 'كغ' } });
  const unitL = await prisma.unitOfMeasure.create({ data: { name: 'لتر', abbreviation: 'ل' } });
  const unitPiece = await prisma.unitOfMeasure.create({ data: { name: 'قطعة', abbreviation: 'قطعة' } });
  const unitBox = await prisma.unitOfMeasure.create({ data: { name: 'علبة', abbreviation: 'علبة' } });
  const unitCarton = await prisma.unitOfMeasure.create({ data: { name: 'كرتون', abbreviation: 'كرتون' } });
  const unitPack = await prisma.unitOfMeasure.create({ data: { name: 'طرد', abbreviation: 'طرد' } });

  // Seed Shifts (Global)
  const shiftMorning = await prisma.shift.create({
    data: { name: 'صباحي', startTime: '07:00', endTime: '15:00', isOpen: false, branchId: null, isActive: true }
  });
  const shiftEvening = await prisma.shift.create({
    data: { name: 'مسائي', startTime: '15:00', endTime: '23:00', isOpen: false, branchId: null, isActive: true }
  });
  const shiftNight = await prisma.shift.create({
    data: { name: 'ليلي', startTime: '23:00', endTime: '07:00', isOpen: false, branchId: null, isActive: true }
  });
  const shiftOpen = await prisma.shift.create({
    data: { name: 'مفتوحة', startTime: '', endTime: '', isOpen: true, branchId: null, isActive: true }
  });
  console.log('🕒 Seeded shifts:', { shiftMorning, shiftEvening, shiftNight, shiftOpen });

  // 4. Create Users for Sail Road Branch
  const adminUser = await prisma.user.create({
    data: {
      name: 'Aman Al-Saeed',
      role: Role.Admin,
      phoneNumber: '+1234567890',
      password: passwordHash,
      branchId: sailRoadBranch.id,
    },
  });

  const ceoUser = await prisma.user.create({
    data: {
      name: 'Elena Petrova',
      role: Role.CEO,
      phoneNumber: '+1234567891',
      password: passwordHash,
      branchId: sailRoadBranch.id,
    },
  });

  const financeUser = await prisma.user.create({
    data: {
      name: 'Sarah Conners',
      role: Role.FinanceManager,
      phoneNumber: '+1234567892',
      password: passwordHash,
      branchId: sailRoadBranch.id,
    },
  });

  const technicianUser = await prisma.user.create({
    data: {
      name: 'Thomas Miller',
      role: Role.Technician,
      phoneNumber: '+1234567893',
      password: passwordHash,
      branchId: sailRoadBranch.id,
    },
  });

  const technicianMurad = await prisma.user.create({
    data: {
      name: 'مراد عبد الرحمن',
      role: Role.Technician,
      phoneNumber: '+1234567899',
      password: passwordHash,
      branchId: sailRoadBranch.id,
      employeeType: 'Mobile',
    },
  });

  const receptionistUser = await prisma.user.create({
    data: {
      name: 'Lara Croft',
      role: Role.Receptionist,
      phoneNumber: '+1234567894',
      password: passwordHash,
      branchId: sailRoadBranch.id,
      annualLeaveBalance: 21,
      sickLeaveBalance: 12, // 14 - 2 (since 2 days sick leave are approved)
    },
  });

  const warehouseUser = await prisma.user.create({
    data: {
      name: 'Marcus Vance',
      role: Role.WarehouseManager,
      phoneNumber: '+1234567895',
      password: passwordHash,
      branchId: sailRoadBranch.id,
    },
  });

  const accountantUser = await prisma.user.create({
    data: {
      name: 'محاسب الفندق',
      role: Role.Accountant,
      phoneNumber: '+1234567896',
      password: passwordHash,
      branchId: sailRoadBranch.id,
    },
  });

  const procurementOfficer = await prisma.user.create({
    data: {
      name: 'مسؤول المشتريات',
      role: 'ProcurementOfficer',
      phoneNumber: '+1234567897',
      password: passwordHash,
      branchId: sailRoadBranch.id,
    },
  });

  const branchManager = await prisma.user.create({
    data: {
      name: 'Branch Manager',
      role: Role.BranchManager,
      phoneNumber: '+966501111004',
      password: passwordHash,
      branchId: sailRoadBranch.id,
    },
  });

  const housekeepingFatima = await prisma.user.create({
    data: {
      name: 'Fatima',
      role: 'HousekeepingStaff',
      phoneNumber: '+966501111005',
      password: passwordHash,
      branchId: sailRoadBranch.id,
    },
  });

  const existingTestUser = await prisma.user.findUnique({
    where: { phoneNumber: '966563104828' }
  });

  if (!existingTestUser) {
    await prisma.user.create({
      data: {
        name: 'Test WhatsApp User',
        role: Role.Receptionist,
        phoneNumber: '966563104828',
        password: passwordHash,
        branchId: sailRoadBranch.id,
      },
    });
  }

  console.log('👤 Created Users for Sail Road Branch:');

  // 5. Create Inventory Items for Sail Road Branch
  const item1 = await prisma.inventoryItem.create({
    data: {
      name: 'صابون حمام فاخر',
      category: 'مستلزمات الغرف',
      stockLevel: 250,
      reorderLevel: 50,
      status: 'Available',
      branchId: sailRoadBranch.id,
    },
  });
  
  const item2 = await prisma.inventoryItem.create({
    data: {
      name: 'مناشف قطنية بيضاء',
      category: 'مستلزمات الغرف',
      stockLevel: 120,
      reorderLevel: 20,
      status: 'Available',
      branchId: sailRoadBranch.id,
    },
  });

  const item3 = await prisma.inventoryItem.create({
    data: {
      name: 'شامبو للشعر',
      category: 'مستلزمات الغرف',
      stockLevel: 0,
      reorderLevel: 40,
      status: 'Out_of_Stock',
      branchId: sailRoadBranch.id,
    },
  });

  const item4 = await prisma.inventoryItem.create({
    data: {
      name: 'أغطية سرير مزدوجة',
      category: 'البياضات',
      stockLevel: 80,
      reorderLevel: 15,
      status: 'Available',
      branchId: sailRoadBranch.id,
    },
  });

  console.log('📦 Created Warehouse Inventory Items:', [item1.name, item2.name, item3.name, item4.name]);

  // 6. Create some initial sample requests
  const req1 = await prisma.request.create({
    data: {
      requestType: RequestType.Maintenance,
      status: RequestStatus.Pending,
      branchId: sailRoadBranch.id,
      description: 'AC blower motor in Room 104 is noisy.',
      reporterId: receptionistUser.id,
      assignedToId: technicianUser.id,
      estimatedCost: 150.0,
      approvalStatus: ApprovalStatus.Approved,
    },
  });

  const req2 = await prisma.request.create({
    data: {
      requestType: RequestType.Procurement,
      status: RequestStatus.Pending,
      branchId: sailRoadBranch.id,
      description: 'Purchase 10x replacement smart TVs for junior suites',
      reporterId: adminUser.id,
      estimatedCost: 4500.0,
      approvalStatus: ApprovalStatus.Pending_Finance, // Under 5000 threshold
    },
  });

  const req3 = await prisma.request.create({
    data: {
      requestType: RequestType.Procurement,
      status: RequestStatus.Pending,
      branchId: sailRoadBranch.id,
      description: 'Replacing commercial chiller unit on rooftop',
      reporterId: adminUser.id,
      estimatedCost: 12000.0,
      approvalStatus: ApprovalStatus.Pending_CEO, // Over 5000 threshold
    },
  });

  // Seed Completed Requests with Ratings for dynamic reports
  const req4 = await prisma.request.create({
    data: {
      requestType: RequestType.Maintenance,
      status: RequestStatus.Completed,
      branchId: sailRoadBranch.id,
      description: 'Fix leak in room 305 bathroom toilet.',
      reporterId: receptionistUser.id,
      assignedToId: technicianUser.id,
      estimatedCost: 80.0,
      actualCost: 80.0,
      approvalStatus: ApprovalStatus.Approved,
      rating: 5,
    },
  });

  const req5 = await prisma.request.create({
    data: {
      requestType: RequestType.Maintenance,
      status: RequestStatus.Completed,
      branchId: sailRoadBranch.id,
      description: 'Repair AC unit in room 204.',
      reporterId: receptionistUser.id,
      assignedToId: technicianMurad.id,
      estimatedCost: 150.0,
      actualCost: 150.0,
      approvalStatus: ApprovalStatus.Approved,
      rating: 5,
    },
  });

  const req6 = await prisma.request.create({
    data: {
      requestType: RequestType.Maintenance,
      status: RequestStatus.Completed,
      branchId: sailRoadBranch.id,
      description: 'Fix lobby lighting dimmer switch.',
      reporterId: receptionistUser.id,
      assignedToId: technicianMurad.id,
      estimatedCost: 120.0,
      actualCost: 100.0,
      approvalStatus: ApprovalStatus.Approved,
      rating: 4,
    },
  });

  const req7 = await prisma.request.create({
    data: {
      requestType: RequestType.Maintenance,
      status: RequestStatus.Completed,
      branchId: sailRoadBranch.id,
      description: 'Install exhaust fan in main kitchen.',
      reporterId: receptionistUser.id,
      assignedToId: technicianUser.id,
      estimatedCost: 60.0,
      actualCost: 60.0,
      approvalStatus: ApprovalStatus.Approved,
      rating: 4,
    },
  });

  const req8 = await prisma.request.create({
    data: {
      requestType: RequestType.Warehouse,
      status: RequestStatus.Completed,
      branchId: sailRoadBranch.id,
      description: 'Request 5x double bed sheets from warehouse.',
      reporterId: receptionistUser.id,
      estimatedCost: 0,
      approvalStatus: ApprovalStatus.Approved,
    },
  });

  console.log('📋 Seeded Sample Requests:', [req1.id, req2.id, req3.id, req4.id, req5.id, req6.id, req7.id, req8.id]);

  // 7. Seed Shift Reports
  const sr1 = await prisma.shiftReport.create({
    data: {
      reporterId: receptionistUser.id,
      branchId: sailRoadBranch.id,
      shiftLabel: 'صباحي',
      shiftId: shiftMorning.id,
      cashTotal: 1200.0,
      cashExpenses: 150.0,
      cashNet: 1050.0,
      visa: 450.0,
      mada: 600.0,
      mastercard: 150.0,
      gulfNet: 0.0,
      tabby: 100.0,
      bankTransfer: 300.0,
      grandTotal: 2650.0,
      status: 'PendingAccountant',
    },
  });

  const sr2 = await prisma.shiftReport.create({
    data: {
      reporterId: receptionistUser.id,
      branchId: sailRoadBranch.id,
      shiftLabel: 'مسائي',
      shiftId: shiftEvening.id,
      cashTotal: 2000.0,
      cashExpenses: 100.0,
      cashNet: 1900.0,
      visa: 800.0,
      mada: 1200.0,
      mastercard: 300.0,
      gulfNet: 50.0,
      tabby: 200.0,
      bankTransfer: 500.0,
      grandTotal: 4950.0,
      status: 'Approved',
      reviewedBy: accountantUser.name,
      reviewedAt: new Date(),
    },
  });

  const sr3 = await prisma.shiftReport.create({
    data: {
      reporterId: receptionistUser.id,
      branchId: sailRoadBranch.id,
      shiftLabel: 'ليلي',
      shiftId: shiftNight.id,
      cashTotal: 800.0,
      cashExpenses: 50.0,
      cashNet: 750.0,
      visa: 200.0,
      mada: 300.0,
      mastercard: 100.0,
      gulfNet: 0.0,
      tabby: 0.0,
      bankTransfer: 150.0,
      grandTotal: 1500.0,
      status: 'Rejected',
      rejectionReason: 'يوجد عجز في الكاش بمقدار 50 ريال',
      reviewedBy: accountantUser.name,
      reviewedAt: new Date(),
    },
  });

  console.log('📋 Seeded Shift Reports:', [sr1.id, sr2.id, sr3.id]);

  // 8. Seed Mock Attendance Logs
  const log1 = await prisma.attendanceLog.create({
    data: {
      userId: receptionistUser.id,
      branchId: sailRoadBranch.id,
      type: 'CheckIn',
      timestamp: new Date(),
      lat: 21.4857,
      lng: 39.1924,
      distanceMeters: 15.0,
      isValid: true
    }
  });

  const log2 = await prisma.attendanceLog.create({
    data: {
      userId: technicianUser.id,
      branchId: sailRoadBranch.id,
      type: 'CheckIn',
      timestamp: new Date(),
      lat: 21.4861,
      lng: 39.1922,
      distanceMeters: 45.0,
      isValid: true
    }
  });

  const log3 = await prisma.attendanceLog.create({
    data: {
      userId: technicianMurad.id,
      branchId: sailRoadBranch.id,
      type: 'CheckIn',
      timestamp: new Date(),
      lat: 21.5122,
      lng: 39.1620,
      distanceMeters: 3500.0,
      isValid: false,
      rejectionReason: 'خارج النطاق الجغرافي للفرع'
    }
  });
  console.log('📍 Seeded Attendance Logs:', { log1, log2, log3 });

  // 9. Seed Mock Loans
  const loan1 = await prisma.loanRequest.create({
    data: {
      employeeId: receptionistUser.id,
      branchId: receptionistUser.branchId || sailRoadBranch.id,
      amount: 500,
      reason: 'مصاريف شخصية طارئة',
      status: 'Pending'
    }
  });

  const loan2 = await prisma.loanRequest.create({
    data: {
      employeeId: receptionistUser.id,
      branchId: receptionistUser.branchId || sailRoadBranch.id,
      amount: 1000,
      reason: 'إصلاح سيارة',
      status: 'Approved',
      approvedBy: accountantUser.id,
      approvedAt: new Date()
    }
  });

  const loan3 = await prisma.loanRequest.create({
    data: {
      employeeId: receptionistUser.id,
      branchId: receptionistUser.branchId || sailRoadBranch.id,
      amount: 2000,
      reason: 'شراء جهاز',
      status: 'Rejected',
      approvedBy: accountantUser.id,
      notes: 'المبلغ يتجاوز الحد المسموح',
      approvedAt: new Date()
    }
  });

  console.log('💰 Seeded Loan Requests:', { loan1, loan2, loan3 });

  // 10. Seed Mock Leaves
  const nextWeekStart = new Date();
  nextWeekStart.setDate(nextWeekStart.getDate() + 7);
  const nextWeekEnd = new Date();
  nextWeekEnd.setDate(nextWeekEnd.getDate() + 9); // 3 days: 7, 8, 9

  const leave1 = await prisma.leaveRequest.create({
    data: {
      userId: receptionistUser.id,
      leaveType: 'Annual',
      startDate: nextWeekStart,
      endDate: nextWeekEnd,
      daysCount: 3,
      reason: 'إجازة عائلية',
      status: 'Pending'
    }
  });

  const sickStart = new Date();
  sickStart.setDate(sickStart.getDate() - 10);
  const sickEnd = new Date();
  sickEnd.setDate(sickEnd.getDate() - 9);

  const leave2 = await prisma.leaveRequest.create({
    data: {
      userId: receptionistUser.id,
      leaveType: 'Sick',
      startDate: sickStart,
      endDate: sickEnd,
      daysCount: 2,
      reason: 'نزلة برد شديدة',
      status: 'Approved',
      reviewedBy: adminUser.id,
      reviewedAt: new Date()
    }
  });

  const emergencyStart = new Date();
  emergencyStart.setDate(emergencyStart.getDate() + 14);
  const emergencyEnd = new Date();
  emergencyEnd.setDate(emergencyEnd.getDate() + 18);

  const leave3 = await prisma.leaveRequest.create({
    data: {
      userId: receptionistUser.id,
      leaveType: 'Emergency',
      startDate: emergencyStart,
      endDate: emergencyEnd,
      daysCount: 5,
      reason: 'حالة وفاة طارئة',
      status: 'Rejected',
      reviewedBy: adminUser.id,
      reviewNote: 'لا يوجد تغطية كافية',
      reviewedAt: new Date()
    }
  });

  console.log('🏖️ Seeded Leave Requests:', { leave1, leave2, leave3 });

  // 11. Seed Maintenance Module Data
  const techAhmed = await prisma.user.create({
    data: {
      name: 'أحمد',
      role: Role.Technician,
      phoneNumber: '+966501111001',
      password: passwordHash,
      branchId: sailRoadBranch.id,
      isAvailable: true,
    },
  });

  const techKhalid = await prisma.user.create({
    data: {
      name: 'خالد',
      role: Role.Technician,
      phoneNumber: '+966501111002',
      password: passwordHash,
      branchId: sailRoadBranch.id,
      isAvailable: true,
    },
  });

  const supervisorOmar = await prisma.user.create({
    data: {
      name: 'Omar Maintenance',
      role: Role.MaintenanceSupervisor,
      phoneNumber: '+966501111003',
      password: passwordHash,
      branchId: null, // central
      isAvailable: true,
    },
  });

  console.log('👷 Seeded Maintenance Users:', { techAhmed, techKhalid, supervisorOmar });

  // Request #1: New, Electrical, "غرفة 101 - تعطل المكيف", Urgent
  const mnt1 = await prisma.maintenanceRequest.create({
    data: {
      ticketNumber: 'MNT-2026-0001',
      reportedBy: receptionistUser.id,
      branchId: sailRoadBranch.id,
      category: 'Electrical',
      location: 'غرفة 101',
      description: 'تعطل المكيف بالكامل وصدور رائحة حريق خفيفة',
      priority: 'Urgent',
      status: 'New',
    }
  });

  await prisma.maintenanceTimeline.create({
    data: {
      requestId: mnt1.id,
      action: 'Created',
      performedBy: receptionistUser.id,
      note: 'تم إنشاء بلاغ الصيانة الجديد بنجاح.'
    }
  });

  // Request #2: InProgress, Plumbing, "الحمام الرئيسي - تسريب", High, assigned to Ahmed
  const mnt2 = await prisma.maintenanceRequest.create({
    data: {
      ticketNumber: 'MNT-2026-0002',
      reportedBy: receptionistUser.id,
      branchId: sailRoadBranch.id,
      category: 'Plumbing',
      location: 'الحمام الرئيسي',
      description: 'تسريب مياه تحت المغسلة وتجمع المياه على الأرض',
      priority: 'High',
      status: 'InProgress',
      assignedTo: techAhmed.id,
      assignedAt: new Date(Date.now() - 2 * 60 * 60 * 1000), // 2 hours ago
    }
  });

  await prisma.user.update({
    where: { id: techAhmed.id },
    data: { isAvailable: false }
  });

  await prisma.maintenanceTimeline.createMany({
    data: [
      {
        requestId: mnt2.id,
        action: 'Created',
        performedBy: receptionistUser.id,
        note: 'تم إنشاء بلاغ الصيانة الجديد بنجاح.',
        createdAt: new Date(Date.now() - 3 * 60 * 60 * 1000)
      },
      {
        requestId: mnt2.id,
        action: 'Assigned',
        performedBy: supervisorOmar.id,
        note: `تم تعيين الفني أحمد لمباشرة العطل.`,
        createdAt: new Date(Date.now() - 2 * 60 * 60 * 1000)
      },
      {
        requestId: mnt2.id,
        action: 'Started',
        performedBy: techAhmed.id,
        note: 'بدأ الفني العمل الميداني على إصلاح العطل.',
        createdAt: new Date(Date.now() - 1.5 * 60 * 60 * 1000)
      }
    ]
  });

  // Request #3: PendingInternalApproval, General, "مدخل الفندق - كسر في الباب", Normal, assigned to Khalid, has completionNote
  const mnt3 = await prisma.maintenanceRequest.create({
    data: {
      ticketNumber: 'MNT-2026-0003',
      reportedBy: receptionistUser.id,
      branchId: sailRoadBranch.id,
      category: 'General',
      location: 'مدخل الفندق',
      description: 'كسر في المقبض الخارجي للباب الرئيسي وصعوبة في الإغلاق',
      priority: 'Normal',
      status: 'PendingInternalApproval',
      assignedTo: techKhalid.id,
      assignedAt: new Date(Date.now() - 5 * 60 * 60 * 1000),
      completedAt: new Date(Date.now() - 1 * 60 * 60 * 1000),
      completionNote: 'تم إصلاح قفل الباب وضبط المفصلات واستبدال المقبض التالف',
    }
  });

  await prisma.user.update({
    where: { id: techKhalid.id },
    data: { isAvailable: false }
  });

  await prisma.maintenanceTimeline.createMany({
    data: [
      {
        requestId: mnt3.id,
        action: 'Created',
        performedBy: receptionistUser.id,
        note: 'تم إنشاء بلاغ الصيانة الجديد بنجاح.',
        createdAt: new Date(Date.now() - 6 * 60 * 60 * 1000)
      },
      {
        requestId: mnt3.id,
        action: 'Assigned',
        performedBy: supervisorOmar.id,
        note: `تم تعيين الفني خالد لمباشرة العطل.`,
        createdAt: new Date(Date.now() - 5 * 60 * 60 * 1000)
      },
      {
        requestId: mnt3.id,
        action: 'Started',
        performedBy: techKhalid.id,
        note: 'بدأ الفني العمل الميداني على إصلاح العطل.',
        createdAt: new Date(Date.now() - 4.5 * 60 * 60 * 1000)
      },
      {
        requestId: mnt3.id,
        action: 'CompletionSubmitted',
        performedBy: techKhalid.id,
        note: 'تم إصلاح قفل الباب وضبط المفصلات واستبدال المقبض التالف',
        createdAt: new Date(Date.now() - 1 * 60 * 60 * 1000)
      }
    ]
  });

  // Request #4: Closed, AC, "غرفة 205 - ضوضاء المكيف", Normal, closed yesterday
  const mnt4 = await prisma.maintenanceRequest.create({
    data: {
      ticketNumber: 'MNT-2026-0004',
      reportedBy: receptionistUser.id,
      branchId: sailRoadBranch.id,
      category: 'AC',
      location: 'غرفة 205',
      description: 'ضوضاء عالية جداً عند تشغيل المكيف على السرعة العالية',
      priority: 'Normal',
      status: 'Closed',
      assignedTo: techAhmed.id,
      assignedAt: new Date(Date.now() - 30 * 60 * 60 * 1000),
      completedAt: new Date(Date.now() - 25 * 60 * 60 * 1000),
      closedAt: new Date(Date.now() - 24 * 60 * 60 * 1000), // closed yesterday
      closedBy: adminUser.id,
      completionNote: 'تم تنظيف مرشح الهواء وحل مشكلة الضوضاء.',
      supervisorNote: 'تم تأكيد الإصلاح واختبار الجهاز.',
    }
  });

  await prisma.maintenanceTimeline.createMany({
    data: [
      {
        requestId: mnt4.id,
        action: 'Created',
        performedBy: receptionistUser.id,
        note: 'تم إنشاء بلاغ الصيانة الجديد بنجاح.',
        createdAt: new Date(Date.now() - 32 * 60 * 60 * 1000)
      },
      {
        requestId: mnt4.id,
        action: 'Assigned',
        performedBy: supervisorOmar.id,
        note: `تم تعيين الفني أحمد لمباشرة العطل.`,
        createdAt: new Date(Date.now() - 30 * 60 * 60 * 1000)
      },
      {
        requestId: mnt4.id,
        action: 'Started',
        performedBy: techAhmed.id,
        note: 'بدأ الفني العمل الميداني على إصلاح العطل.',
        createdAt: new Date(Date.now() - 29 * 60 * 60 * 1000)
      },
      {
        requestId: mnt4.id,
        action: 'CompletionSubmitted',
        performedBy: techAhmed.id,
        note: 'تم تنظيف مرشح الهواء وحل مشكلة الضوضاء.',
        createdAt: new Date(Date.now() - 25 * 60 * 60 * 1000)
      },
      {
        requestId: mnt4.id,
        action: 'Closed',
        performedBy: adminUser.id,
        note: 'تم تأكيد وإغلاق بلاغ الصيانة بنجاح.',
        createdAt: new Date(Date.now() - 24 * 60 * 60 * 1000)
      }
    ]
  });

  // Request #5: SpareParts, Electrical, "مولد الكهرباء - عطل", Urgent, waiting for parts
  const mnt5 = await prisma.maintenanceRequest.create({
    data: {
      ticketNumber: 'MNT-2026-0005',
      reportedBy: receptionistUser.id,
      branchId: sailRoadBranch.id,
      category: 'Electrical',
      location: 'مولد الكهرباء',
      description: 'عطل في المولد الرئيسي وتوقف نظام الطاقة الاحتياطي',
      priority: 'Urgent',
      status: 'SpareParts',
      assignedTo: techAhmed.id,
      assignedAt: new Date(Date.now() - 10 * 60 * 60 * 1000),
      sparePartsNeeded: true,
    }
  });

  await prisma.maintenanceTimeline.createMany({
    data: [
      {
        requestId: mnt5.id,
        action: 'Created',
        performedBy: receptionistUser.id,
        note: 'تم إنشاء بلاغ الصيانة الجديد بنجاح.',
        createdAt: new Date(Date.now() - 12 * 60 * 60 * 1000)
      },
      {
        requestId: mnt5.id,
        action: 'Assigned',
        performedBy: supervisorOmar.id,
        note: `تم تعيين الفني أحمد لمباشرة العطل.`,
        createdAt: new Date(Date.now() - 10 * 60 * 60 * 1000)
      },
      {
        requestId: mnt5.id,
        action: 'Started',
        performedBy: techAhmed.id,
        note: 'بدأ الفني العمل الميداني على إصلاح العطل.',
        createdAt: new Date(Date.now() - 9.5 * 60 * 60 * 1000)
      },
      {
        requestId: mnt5.id,
        action: 'SparePartsRequested',
        performedBy: techAhmed.id,
        note: 'طلب قطع غيار: لوحة تحكم كهربائية للمولد الرئيسي',
        createdAt: new Date(Date.now() - 8 * 60 * 60 * 1000)
      }
    ]
  });

  console.log('🔧 Seeded 5 maintenance requests with timelines!');

  // 12. Seed Warehouse Categories & Items
  console.log('📦 Seeding Warehouse Module...');

  const cat1 = await prisma.itemCategory.create({ data: { id: 'cat-1', name: 'مناشف', description: 'جميع أنواع المناشف والشراشف الفندقية' } });
  const cat2 = await prisma.itemCategory.create({ data: { id: 'cat-2', name: 'أدوات نظافة', description: 'منظفات وسوائل ومطهرات للغرف والمرافق' } });
  const cat3 = await prisma.itemCategory.create({ data: { id: 'cat-3', name: 'قطع غيار', description: 'قطع صيانة وتجهيزات كهربائية وسباكة' } });
  const cat4 = await prisma.itemCategory.create({ data: { id: 'cat-4', name: 'مستلزمات مكتبية', description: 'قرطاسية وأوراق طباعة وأقلام للمكاتب والاستقبال' } });
  const cat5 = await prisma.itemCategory.create({ data: { id: 'cat-5', name: 'أغذية ومشروبات', description: 'مأكولات ومشروبات وضيافة للنزلاء' } });
  const cat6 = await prisma.itemCategory.create({ data: { id: 'cat-6', name: 'عام', description: 'مستلزمات عامة أخرى' } });

  const itemW1 = await prisma.item.create({ data: { id: 'item-1', name: 'منشفة يد صغيرة', unit: 'قطعة', categoryId: 'cat-1' } });
  const itemW2 = await prisma.item.create({ data: { id: 'item-2', name: 'مفرش حمام قطني', unit: 'قطعة', categoryId: 'cat-1' } });
  const itemW3 = await prisma.item.create({ data: { id: 'item-3', name: 'منظف زجاج', unit: 'علبة', categoryId: 'cat-2' } });
  const itemW4 = await prisma.item.create({ data: { id: 'item-4', name: 'صابون سائل للأيدي', unit: 'لتر', categoryId: 'cat-2' } });
  const itemW5 = await prisma.item.create({ data: { id: 'item-5', name: 'مصباح إضاءة LED 12W', unit: 'قطعة', categoryId: 'cat-3' } });
  const itemW6 = await prisma.item.create({ data: { id: 'item-6', name: 'مفصلة باب معدنية', unit: 'قطعة', categoryId: 'cat-3' } });
  const itemW7 = await prisma.item.create({ data: { id: 'item-7', name: 'ورق طباعة A4', unit: 'علبة', categoryId: 'cat-4' } });
  const itemW8 = await prisma.item.create({ data: { id: 'item-8', name: 'أقلام حبر زرقاء', unit: 'علبة', categoryId: 'cat-4' } });
  const itemW9 = await prisma.item.create({ data: { id: 'item-9', name: 'بن قهوة عربي', unit: 'كيلو', categoryId: 'cat-5' } });
  const itemW10 = await prisma.item.create({ data: { id: 'item-10', name: 'مياه معدنية 330 مل', unit: 'علبة', categoryId: 'cat-5' } });

  // Stock Entries
  const branchIds = [sailRoadBranch.id, beachsideBranch.id];
  const itemsData = [
    { itemId: 'item-1', qty: 50, min: 10, max: 100 },
    { itemId: 'item-2', qty: 30, min: 10, max: 100 },
    { itemId: 'item-3', qty: 15, min: 5, max: 50 },
    { itemId: 'item-4', qty: 25, min: 5, max: 50 },
    { itemId: 'item-5', qty: 2, min: 5, max: 50 },
    { itemId: 'item-6', qty: 8, min: 5, max: 30 },
    { itemId: 'item-7', qty: 12, min: 5, max: 40 },
    { itemId: 'item-8', qty: 6, min: 3, max: 20 },
    { itemId: 'item-9', qty: 10, min: 4, max: 30 },
    { itemId: 'item-10', qty: 150, min: 50, max: 500 },
  ];

  for (const bId of branchIds) {
    for (const item of itemsData) {
      await prisma.stockEntry.create({
        data: {
          itemId: item.itemId,
          branchId: bId,
          quantity: item.qty,
          minThreshold: item.min,
          maxCapacity: item.max,
        }
      });
    }
  }

  // Suppliers
  const sup1 = await prisma.supplier.create({
    data: {
      id: 'sup-1',
      name: 'شركة التوريدات الفندقية السريعة',
      contactName: 'أحمد سالم',
      phone: '+966555111222',
      isActive: true,
      category: 'مستلزمات فندقية',
      rating: 5
    }
  });

  const sup2 = await prisma.supplier.create({
    data: {
      id: 'sup-2',
      name: 'مؤسسة الغيار الحديثة للكهرباء',
      contactName: 'خالد العتيبي',
      phone: '+966555333444',
      isActive: true,
      category: 'قطع غيار',
      rating: 4
    }
  });

  const sup3 = await prisma.supplier.create({
    data: {
      id: 'sup-3',
      name: 'مكتبة النجاح للمستلزمات المكتبية',
      contactName: 'يوسف الحربي',
      phone: '+966555555666',
      isActive: true,
      category: 'قرطاسية',
      rating: 3
    }
  });

  // Warehouse Requests
  const whr1 = await prisma.warehouseRequest.create({
    data: {
      id: 'whr-1',
      ticketNumber: 'WHR-2026-0001',
      itemId: 'item-1',
      requestedBy: receptionistUser.id,
      branchId: sailRoadBranch.id,
      quantityRequested: 10,
      quantityIssued: 0,
      status: 'Pending',
      purpose: 'تغيير مناشف الغرف الطابق الثاني'
    }
  });

  const whr2 = await prisma.warehouseRequest.create({
    data: {
      id: 'whr-2',
      ticketNumber: 'WHR-2026-0002',
      itemId: 'item-3',
      requestedBy: receptionistUser.id,
      branchId: sailRoadBranch.id,
      quantityRequested: 5,
      quantityIssued: 5,
      status: 'Approved',
      purpose: 'تنظيف زجاج البهو الرئيسي',
      approvedBy: warehouseUser.id
    }
  });

  const whr3 = await prisma.warehouseRequest.create({
    data: {
      id: 'whr-3',
      ticketNumber: 'WHR-2026-0003',
      itemId: 'item-5',
      requestedBy: techAhmed.id,
      branchId: sailRoadBranch.id,
      quantityRequested: 3,
      quantityIssued: 0,
      status: 'Rejected',
      purpose: 'صيانة إنارة الممر الطابق الثالث',
      approvedBy: warehouseUser.id,
      rejectionReason: 'المخزون منخفض جداً، يرجى تقديم طلب شراء'
    }
  });

  const whr4 = await prisma.warehouseRequest.create({
    data: {
      id: 'whr-4',
      ticketNumber: 'WHR-2026-0004',
      itemId: 'item-10',
      requestedBy: receptionistUser.id,
      branchId: sailRoadBranch.id,
      quantityRequested: 50,
      quantityIssued: 30,
      status: 'PartiallyApproved',
      purpose: 'توزيع مياه للنزلاء',
      approvedBy: warehouseUser.id
    }
  });

  // Procurement Requests
  const pro1 = await prisma.procurementRequest.create({
    data: {
      id: 'pro-1',
      ticketNumber: 'PRO-2026-0001',
      itemId: 'item-5',
      itemName: 'مصباح إضاءة LED 12W',
      requestedBy: warehouseUser.id,
      branchId: sailRoadBranch.id,
      quantityNeeded: 48,
      unit: 'قطعة',
      source: 'LowStock',
      status: 'Pending'
    }
  });

  const pro2 = await prisma.procurementRequest.create({
    data: {
      id: 'pro-2',
      ticketNumber: 'PRO-2026-0002',
      itemId: 'item-6',
      itemName: 'مفصلة باب معدنية',
      requestedBy: techAhmed.id,
      branchId: sailRoadBranch.id,
      quantityNeeded: 10,
      unit: 'قطعة',
      source: 'MaintenanceSpareParts',
      status: 'ReviewedByProcurement',
      reviewedBy: procurementOfficer.id,
      estimatedPrice: 150.0,
      supplierId: 'sup-2',
      paymentMethod: 'Cash',
      procurementNote: 'تسعير معتمد من مؤسسة الغيار'
    }
  });

  const pro3 = await prisma.procurementRequest.create({
    data: {
      id: 'pro-3',
      ticketNumber: 'PRO-2026-0003',
      itemId: 'item-9',
      itemName: 'بن قهوة عربي',
      requestedBy: warehouseUser.id,
      branchId: sailRoadBranch.id,
      quantityNeeded: 20,
      unit: 'كيلو',
      source: 'LowStock',
      status: 'FinanciallyApproved',
      reviewedBy: procurementOfficer.id,
      approvedBy: accountantUser.id,
      estimatedPrice: 800.0,
      supplierId: 'sup-1',
      paymentMethod: 'BankTransfer',
      procurementNote: 'بن هرري درجة أولى',
      financialNote: 'معتمد للصرف'
    }
  });

  // Stock Movement Logs
  await prisma.stockMovement.createMany({
    data: [
      {
        itemId: 'item-3',
        branchId: sailRoadBranch.id,
        type: 'Out',
        quantity: -5,
        reason: 'EmployeeRequest',
        referenceId: whr2.id,
        performedBy: warehouseUser.id,
        note: 'صرف طلب تنظيف زجاج'
      },
      {
        itemId: 'item-10',
        branchId: sailRoadBranch.id,
        type: 'Out',
        quantity: -30,
        reason: 'EmployeeRequest',
        referenceId: whr4.id,
        performedBy: warehouseUser.id,
        note: 'صرف جزئي لطلب توزيع مياه'
      }
    ]
  });

  // Seed Lost & Found Items
  const lf1 = await prisma.lostFoundItem.create({
    data: {
      ticketNumber: 'LF-2026-0001',
      description: 'محفظة جلدية سوداء تحتوي على بطاقات وبطاقة هوية',
      location: 'غرفة 203',
      reportedBy: housekeepingFatima.id,
      branchId: sailRoadBranch.id,
      status: 'Stored'
    }
  });

  const lf2 = await prisma.lostFoundItem.create({
    data: {
      ticketNumber: 'LF-2026-0002',
      description: 'ساعة يد ذكية لون فضي ماركة آبل',
      location: 'اللوبي',
      reportedBy: receptionistUser.id,
      branchId: sailRoadBranch.id,
      guestName: 'أحمد العتيبي',
      guestPhone: '+966509999888',
      status: 'ContactedGuest'
    }
  });

  const lf3 = await prisma.lostFoundItem.create({
    data: {
      ticketNumber: 'LF-2026-0003',
      description: 'هاتف جوال آيفون 15 برو ماكس',
      location: 'غرفة 115',
      reportedBy: housekeepingFatima.id,
      branchId: sailRoadBranch.id,
      guestName: 'سليمان الحربي',
      guestPhone: '+966502223344',
      status: 'Claimed',
      claimedBy: 'سليمان الحربي',
      claimedIdType: 'NationalId',
      claimedIdNumber: '1023456789',
      claimedAt: new Date(Date.now() - 24 * 3600 * 1000),
      handedOverBy: receptionistUser.id
    }
  });

  const lf4 = await prisma.lostFoundItem.create({
    data: {
      ticketNumber: 'LF-2026-0004',
      description: 'نظارة شمسية ماركة ريبان',
      location: 'المطعم',
      reportedBy: receptionistUser.id,
      branchId: sailRoadBranch.id,
      status: 'Archived',
      archivedAt: new Date(Date.now() - 24 * 3600 * 1000),
      createdAt: new Date(Date.now() - 31 * 24 * 3600 * 1000)
    }
  });

  // Seed Damage Reports
  const dmg1 = await prisma.damageReport.create({
    data: {
      ticketNumber: 'DMG-2026-0001',
      reportedBy: branchManager.id,
      branchId: sailRoadBranch.id,
      roomNumber: 'غرفة 302',
      damageType: 'Electronics',
      description: 'تلف شاشة التلفزيون وكسر في الإطار الخارجي',
      reportedDuring: 'Stay',
      status: 'New'
    }
  });

  const dmg2 = await prisma.damageReport.create({
    data: {
      ticketNumber: 'DMG-2026-0002',
      reportedBy: receptionistUser.id,
      branchId: sailRoadBranch.id,
      roomNumber: 'غرفة 108',
      damageType: 'Fixture',
      description: 'كسر مرآة الحمام الرئيسية وسقوطها',
      reportedDuring: 'Checkout',
      status: 'UnderReview'
    }
  });

  const dmg3 = await prisma.damageReport.create({
    data: {
      ticketNumber: 'DMG-2026-0003',
      reportedBy: housekeepingFatima.id,
      branchId: sailRoadBranch.id,
      roomNumber: 'غرفة 205',
      damageType: 'Fixture',
      description: 'تلف فتحة التكييف وتساقط الماء منها',
      reportedDuring: 'Stay',
      estimatedValue: 1000.0,
      finalValue: 800.0,
      status: 'PendingGuestDecision',
      reviewedBy: branchManager.id,
      reviewNote: 'تم الاتفاق على تعويض 800 ريال بدلاً من 1000',
      reviewedAt: new Date(Date.now() - 24 * 3600 * 1000)
    }
  });

  const dmg4 = await prisma.damageReport.create({
    data: {
      ticketNumber: 'DMG-2026-0004',
      reportedBy: receptionistUser.id,
      branchId: sailRoadBranch.id,
      roomNumber: 'غرفة 401',
      damageType: 'Linen',
      description: 'تمزيق شرشف السرير الفاخر بالكامل',
      reportedDuring: 'Checkout',
      estimatedValue: 150.0,
      finalValue: 150.0,
      status: 'Paid',
      reviewedBy: branchManager.id,
      reviewedAt: new Date(Date.now() - 24 * 3600 * 1000),
      paymentMethod: 'Cash',
      paymentRef: 'REC-998877',
      collectedBy: receptionistUser.id,
      collectedAt: new Date()
    }
  });

  const dmg5 = await prisma.damageReport.create({
    data: {
      ticketNumber: 'DMG-2026-0005',
      reportedBy: housekeepingFatima.id,
      branchId: sailRoadBranch.id,
      roomNumber: 'غرفة 312',
      damageType: 'Furniture',
      description: 'تلف وكسر في رجل كرسي الخشب بالصالة',
      reportedDuring: 'Stay',
      estimatedValue: 300.0,
      finalValue: 300.0,
      status: 'Refused',
      reviewedBy: branchManager.id,
      reviewedAt: new Date(Date.now() - 24 * 3600 * 1000),
      refusalReason: 'العميل ينفي المسؤولية'
    }
  });

  console.log('✅ Seeded categories, items, stock entries, suppliers, and requests!');

  // 13. Seed Documents
  console.log('📄 Seeding sample documents...');
  await prisma.document.create({
    data: {
      title: 'رخصة الدفاع المدني - السيل',
      type: 'FIRE_PERMIT',
      department: 'BRANCH',
      branchId: sailRoadBranch.id,
      fileUrl: '/uploads/documents/fire_permit_sail_road.pdf',
      fileName: 'fire_permit_sail_road.pdf',
      fileSize: 102450,
      mimeType: 'application/pdf',
      issuer: 'الدفاع المدني السعودي',
      issueDate: new Date(Date.now() - 300 * 24 * 3600 * 1000),
      expiryDate: new Date(Date.now() + 65 * 24 * 3600 * 1000),
      isExpired: false,
      uploadedById: adminUser.id
    }
  });

  await prisma.document.create({
    data: {
      title: 'عقد صيانة المصاعد الذكية',
      type: 'CONTRACT',
      department: 'MAINTENANCE',
      branchId: sailRoadBranch.id,
      fileUrl: '/uploads/documents/elevator_maintenance_contract.pdf',
      fileName: 'elevator_maintenance_contract.pdf',
      fileSize: 450000,
      mimeType: 'application/pdf',
      issuer: 'شركة ميتسوبيشي للمصاعد',
      issueDate: new Date(Date.now() - 340 * 24 * 3600 * 1000),
      expiryDate: new Date(Date.now() + 25 * 24 * 3600 * 1000),
      isExpired: false,
      uploadedById: adminUser.id
    }
  });

  await prisma.document.create({
    data: {
      title: 'التأمين الطبي الشامل للموظفين',
      type: 'INSURANCE',
      department: 'HR',
      branchId: sailRoadBranch.id,
      fileUrl: '/uploads/documents/bupa_insurance_2026.pdf',
      fileName: 'bupa_insurance_2026.pdf',
      fileSize: 1200000,
      mimeType: 'application/pdf',
      issuer: 'شركة بوبا للتأمين',
      issueDate: new Date(Date.now() - 360 * 24 * 3600 * 1000),
      expiryDate: new Date(Date.now() + 5 * 24 * 3600 * 1000),
      isExpired: false,
      uploadedById: adminUser.id
    }
  });

  await prisma.document.create({
    data: {
      title: 'الرخصة البلدية التشغيلية - الشاطئ',
      type: 'LICENSE',
      department: 'BRANCH',
      branchId: beachsideBranch.id,
      fileUrl: '/uploads/documents/municipality_permit_beachside.pdf',
      fileName: 'municipality_permit_beachside.pdf',
      fileSize: 85000,
      mimeType: 'application/pdf',
      issuer: 'أمانة منطقة مكة المكرمة',
      issueDate: new Date(Date.now() - 400 * 24 * 3600 * 1000),
      expiryDate: new Date(Date.now() - 35 * 24 * 3600 * 1000),
      isExpired: true,
      uploadedById: adminUser.id
    }
  });

  await prisma.document.create({
    data: {
      title: 'شهادة تسجيل ضريبة القيمة المضافة',
      type: 'CERTIFICATE',
      department: 'BRANCH',
      branchId: sailRoadBranch.id,
      fileUrl: '/uploads/documents/vat_registration_cert.pdf',
      fileName: 'vat_registration_cert.pdf',
      fileSize: 180000,
      mimeType: 'application/pdf',
      issuer: 'الهيئة العامة للزكاة والدخل',
      issueDate: new Date(Date.now() - 730 * 24 * 3600 * 1000),
      expiryDate: new Date(Date.now() + 365 * 24 * 3600 * 1000),
      isExpired: false,
      uploadedById: adminUser.id
    }
  });

  console.log('✅ Seeded 5 sample documents.');
  console.log('🌿 Seeding completed successfully!');
}

main()
  .catch((e) => {
    console.error('🔴 Seeding failed with error:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
