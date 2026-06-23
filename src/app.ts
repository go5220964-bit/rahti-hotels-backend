import express from 'express';
import cors from 'cors';
import env from './config/environment';
import { RequestController, createRequestSchema, updateRequestSchema, getRequestsQuerySchema } from './controllers/request.controller';
import { InventoryController, createInventorySchema, updateInventorySchema, getInventoryQuerySchema } from './controllers/inventory.controller';
import { WebhookController } from './controllers/webhook.controller';
import { BranchController, createBranchSchema, updateBranchSchema } from './controllers/branch.controller';
import { UserController, createUserSchema, updateUserSchema, transferBranchSchema } from './controllers/user.controller';
import { SystemController } from './controllers/system.controller';
import { ShiftReportController, createShiftReportSchema, approveShiftReportSchema, rejectShiftReportSchema, updateShiftReportSchema } from './controllers/shiftReport.controller';
import { ShiftController, createShiftSchema, updateShiftSchema } from './controllers/shift.controller';
import { AttendanceController, attendanceRecordSchema } from './controllers/attendance.controller';
import { LoanController, createLoanSchema, reviewLoanSchema } from './controllers/loan.controller';
import { LeaveController, createLeaveSchema, reviewLeaveSchema, adjustBalanceSchema } from './controllers/leave.controller';
import { MaintenanceController } from './controllers/maintenance.controller';
import { WarehouseController } from './controllers/warehouse.controller';
import {
  LostFoundController,
  createLostItemSchema,
  updateGuestContactSchema,
  claimItemSchema,
  createDamageReportSchema,
  reviewDamageSchema,
  collectPaymentSchema,
  markRefusedSchema,
  waiveDamageSchema
} from './controllers/lostfound.controller';
import { errorHandler } from './middleware/error.middleware';
import { validate } from './middleware/validate.middleware';
import path from 'path';
import ReportsController from './controllers/reports.controller';
import { AuthController } from './controllers/auth.controller';
import { verifyToken } from './middleware/auth.middleware';
import { DocumentController } from './controllers/document.controller';
import { HRController } from './controllers/hr.controller';

const app = express();

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use('/uploads', express.static(path.join(__dirname, '../uploads')));

// Health Check
app.get('/health', (req, res) => {
  res.status(200).json({ status: 'OK', timestamp: new Date().toISOString() });
});

// ✅ Webhook FIRST - no auth middleware
app.get('/webhook', WebhookController.verifyWebhook);
app.post('/webhook', WebhookController.handleWebhook);

// Public Auth Route
app.post('/api/auth/login', AuthController.login);

// Global Authentication Guard for all subsequent routes
app.use(verifyToken);

// Protected Auth Routes
app.post('/api/auth/logout', AuthController.logout);
app.get('/api/auth/me', AuthController.me);

// Request API Routes
app.post('/api/requests', validate(createRequestSchema), RequestController.create);
app.get('/api/requests', validate(getRequestsQuerySchema), RequestController.getAll);
app.get('/api/requests/:id', RequestController.getById);
app.patch('/api/requests/:id', validate(updateRequestSchema), RequestController.update);
app.delete('/api/requests/:id', RequestController.delete);

// Inventory API Routes
app.post('/api/inventory', validate(createInventorySchema), InventoryController.create);
app.get('/api/inventory', validate(getInventoryQuerySchema), InventoryController.getAll);
app.get('/api/inventory/:id', InventoryController.getById);
app.patch('/api/inventory/:id', validate(updateInventorySchema), InventoryController.update);
app.delete('/api/inventory/:id', InventoryController.delete);

// Branch API Routes
app.get('/api/branches', BranchController.getAll);
app.post('/api/branches', validate(createBranchSchema), BranchController.create);
app.patch('/api/branches/:id', validate(updateBranchSchema), BranchController.update);
app.delete('/api/branches/:id', BranchController.delete);

// User/Employee API Routes
app.get('/api/users', UserController.getAll);
app.post('/api/users', validate(createUserSchema), UserController.create);
app.patch('/api/users/:id', validate(updateUserSchema), UserController.update);
app.delete('/api/users/:id', UserController.delete);
app.patch('/api/users/:id/transfer-branch', validate(transferBranchSchema), UserController.transferBranch);
app.patch('/api/users/:id/status', SystemController.toggleUserStatus);

// System Management API Routes
app.get('/api/system/settings', SystemController.getSettings);
app.post('/api/system/settings', SystemController.updateSettings);
app.get('/api/system/logs', SystemController.getLogs);
app.get('/api/system/roles', SystemController.getRolePermissions);
app.post('/api/system/roles', SystemController.updateRolePermissions);

// Shift Report API Routes
app.post('/api/shift-reports', validate(createShiftReportSchema), ShiftReportController.create);
app.get('/api/shift-reports', ShiftReportController.getAll);
app.get('/api/shift-reports/:id', ShiftReportController.getById);
app.patch('/api/shift-reports/:id', validate(updateShiftReportSchema), ShiftReportController.update);
app.delete('/api/shift-reports/:id', ShiftReportController.delete);
app.patch('/api/shift-reports/:id/approve', validate(approveShiftReportSchema), ShiftReportController.approve);
app.patch('/api/shift-reports/:id/reject', validate(rejectShiftReportSchema), ShiftReportController.reject);
app.get('/api/shift-reports/stats/:reporterId', ShiftReportController.getStats);

// Shift API Routes
app.post('/api/shifts', validate(createShiftSchema), ShiftController.create);
app.get('/api/shifts', ShiftController.getAll);
app.get('/api/shifts/branch/:branchId', ShiftController.getByBranch);
app.patch('/api/shifts/:id', validate(updateShiftSchema), ShiftController.update);
app.delete('/api/shifts/:id', ShiftController.delete);

// Attendance API Routes
app.post('/api/attendance/check-in', validate(attendanceRecordSchema), AttendanceController.checkIn);
app.post('/api/attendance/check-out', validate(attendanceRecordSchema), AttendanceController.checkOut);
app.get('/api/attendance/today', AttendanceController.getToday);
app.get('/api/attendance/history/:userId', AttendanceController.getHistory);
app.get('/api/attendance/summary', AttendanceController.getSummary);
app.get('/api/attendance/grid', AttendanceController.getGrid);

// Loan API Routes
app.post('/api/loans', validate(createLoanSchema), LoanController.create);
app.get('/api/loans', LoanController.getAll);
app.patch('/api/loans/:id/review', validate(reviewLoanSchema), LoanController.review);
app.get('/api/loans/user/:userId', LoanController.getHistory);

// HR API Routes
app.post('/api/hr/announcements', HRController.broadcastAnnouncement);
app.get('/api/hr/transfers/:userId', HRController.getTransferHistory);
app.get('/api/finance/loans/metrics', HRController.getFinanceLoanMetrics);

// Leave API Routes
app.post('/api/leaves', validate(createLeaveSchema), LeaveController.create);
app.get('/api/leaves', LeaveController.getAll);
app.patch('/api/leaves/:id/review', validate(reviewLeaveSchema), LeaveController.review);
app.get('/api/leaves/user/:userId', LeaveController.getHistory);
app.get('/api/leaves/balance/:userId', LeaveController.getBalance);
app.patch('/api/leaves/balance/:userId', validate(adjustBalanceSchema), LeaveController.adjustBalance);

// Maintenance API Routes
app.post('/api/maintenance', MaintenanceController.create);
app.get('/api/maintenance', MaintenanceController.getAll);
app.get('/api/maintenance/stats', MaintenanceController.getStats);
app.get('/api/maintenance/workload', MaintenanceController.getWorkload);
app.get('/api/maintenance/:id', MaintenanceController.getById);
app.patch('/api/maintenance/:id/assign', MaintenanceController.assign);
app.patch('/api/maintenance/:id/start', MaintenanceController.start);
app.patch('/api/maintenance/:id/complete', MaintenanceController.complete);
app.patch('/api/maintenance/:id/approve', MaintenanceController.approve);
app.patch('/api/maintenance/:id/reject', MaintenanceController.reject);
app.patch('/api/maintenance/:id/spare-parts', MaintenanceController.spareParts);
app.patch('/api/maintenance/:id/resume', MaintenanceController.resume);

// Warehouse & Inventory API Routes
app.get('/api/warehouse/categories', WarehouseController.getCategories);
app.get('/api/warehouse/items', WarehouseController.getItems);
app.get('/api/warehouse/items/:id', WarehouseController.getItemById);
app.post('/api/warehouse/items', WarehouseController.createItem);
app.patch('/api/warehouse/items/:id', WarehouseController.updateItem);
app.get('/api/warehouse/stock/:branchId', WarehouseController.getStockByBranch);
app.post('/api/warehouse/stock/adjust', WarehouseController.adjustStock);
app.get('/api/warehouse/requests', WarehouseController.getWarehouseRequests);
app.post('/api/warehouse/requests', WarehouseController.createWarehouseRequest);
app.patch('/api/warehouse/requests/:id/approve', WarehouseController.approveWarehouseRequest);
app.patch('/api/warehouse/requests/:id/reject', WarehouseController.rejectWarehouseRequest);
app.get('/api/warehouse/stats', WarehouseController.getWarehouseStats);
app.get('/api/warehouse/procurement', WarehouseController.getProcurementRequests);
app.get('/api/warehouse/procurement/:id', WarehouseController.getProcurementById);
app.patch('/api/warehouse/procurement/:id/review', WarehouseController.reviewProcurement);
app.patch('/api/warehouse/procurement/:id/approve', WarehouseController.financiallyApproveProcurement);
app.patch('/api/warehouse/procurement/:id/reject', WarehouseController.rejectProcurement);
app.patch('/api/warehouse/procurement/:id/purchased', WarehouseController.markPurchased);
app.patch('/api/warehouse/procurement/:id/receive', WarehouseController.receiveInWarehouse);
app.get('/api/warehouse/suppliers', WarehouseController.getSuppliers);
app.post('/api/warehouse/suppliers', WarehouseController.createSupplier);
app.patch('/api/warehouse/suppliers/:id', WarehouseController.updateSupplier);
app.get('/api/warehouse/units', WarehouseController.getUnits);
app.post('/api/warehouse/units', WarehouseController.createUnit);
app.post('/api/warehouse/items/:id/add-stock', WarehouseController.addStock);

// Lost & Found API Routes
app.get('/api/lostfound', LostFoundController.getAllLost);
app.post('/api/lostfound', validate(createLostItemSchema), LostFoundController.createLost);
app.get('/api/lostfound/:id', LostFoundController.getLostById);
app.patch('/api/lostfound/:id/contact', validate(updateGuestContactSchema), LostFoundController.contactGuest);
app.patch('/api/lostfound/:id/claim', validate(claimItemSchema), LostFoundController.claimLost);
app.patch('/api/lostfound/:id/archive', LostFoundController.archiveLost);

// Damage Report API Routes
app.get('/api/damage', LostFoundController.getAllDamage);
app.post('/api/damage', validate(createDamageReportSchema), LostFoundController.createDamage);
app.get('/api/damage/stats', LostFoundController.getStats);
app.get('/api/damage/:id', LostFoundController.getDamageById);
app.patch('/api/damage/:id/review', validate(reviewDamageSchema), LostFoundController.reviewDamage);
app.patch('/api/damage/:id/collect', validate(collectPaymentSchema), LostFoundController.collectPayment);
app.patch('/api/damage/:id/refuse', validate(markRefusedSchema), LostFoundController.markRefused);
app.patch('/api/damage/:id/waive', validate(waiveDamageSchema), LostFoundController.waiveDamage);

// Document API Routes
app.post('/api/documents/upload', DocumentController.upload);
app.get('/api/documents', DocumentController.getAll);
app.delete('/api/documents/:id', DocumentController.delete);

// Reports API Routes
app.use('/api/reports', ReportsController);

// Centralized Error Handling Middleware
app.use(errorHandler);

// Start Server if not imported by tests
if (process.env.NODE_ENV !== 'test') {
  const PORT = parseInt(process.env.PORT || '3000', 10);
  app.listen(PORT, '0.0.0.0', () => {
    console.log(`🚀 Rahti Hotels Operations Server is running on port ${PORT}`);
    console.log(`📡 WhatsApp Webhook URL: http://0.0.0.0:${PORT}/webhook`);
    console.log(`⚙️  Verify Token is set to: "${process.env.WEBHOOK_VERIFY_TOKEN}"`);
  });
}


export default app;
