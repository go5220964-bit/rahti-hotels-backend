"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const cors_1 = __importDefault(require("cors"));
const request_controller_1 = require("./controllers/request.controller");
const inventory_controller_1 = require("./controllers/inventory.controller");
const webhook_controller_1 = require("./controllers/webhook.controller");
const branch_controller_1 = require("./controllers/branch.controller");
const user_controller_1 = require("./controllers/user.controller");
const system_controller_1 = require("./controllers/system.controller");
const shiftReport_controller_1 = require("./controllers/shiftReport.controller");
const shift_controller_1 = require("./controllers/shift.controller");
const attendance_controller_1 = require("./controllers/attendance.controller");
const loan_controller_1 = require("./controllers/loan.controller");
const leave_controller_1 = require("./controllers/leave.controller");
const maintenance_controller_1 = require("./controllers/maintenance.controller");
const warehouse_controller_1 = require("./controllers/warehouse.controller");
const lostfound_controller_1 = require("./controllers/lostfound.controller");
const error_middleware_1 = require("./middleware/error.middleware");
const validate_middleware_1 = require("./middleware/validate.middleware");
const path_1 = __importDefault(require("path"));
const reports_controller_1 = __importDefault(require("./controllers/reports.controller"));
const auth_controller_1 = require("./controllers/auth.controller");
const auth_middleware_1 = require("./middleware/auth.middleware");
const document_controller_1 = require("./controllers/document.controller");
const hr_controller_1 = require("./controllers/hr.controller");
const app = (0, express_1.default)();
// Middleware
// Global Request Logger Middleware for Webhook Diagnostics
app.use((req, res, next) => {
    const logEntry = {
        time: new Date().toISOString(),
        method: req.method,
        path: req.path,
        headers: req.headers,
        query: req.query,
        body: req.body
    };
    try {
        const { WebhookController } = require('./controllers/webhook.controller');
        WebhookController.incomingPayloads.push(logEntry);
        if (WebhookController.incomingPayloads.length > 50) {
            WebhookController.incomingPayloads.shift();
        }
    }
    catch (e) { }
    next();
});
app.use((0, cors_1.default)());
app.use(express_1.default.json());
app.use(express_1.default.urlencoded({ extended: true }));
app.use('/uploads', express_1.default.static(path_1.default.join(__dirname, '../uploads')));
// Health Check
app.get('/health', (req, res) => {
    res.status(200).json({ status: 'OK', timestamp: new Date().toISOString() });
});
// ✅ Webhook FIRST - no auth middleware
app.get('/webhook', webhook_controller_1.WebhookController.verifyWebhook);
app.post('/webhook', webhook_controller_1.WebhookController.handleWebhook);
app.post('/webhook/telegram', webhook_controller_1.WebhookController.handleTelegramWebhook);
app.get('/webhook/telegram-info', async (req, res) => {
    try {
        const axios = require('axios');
        const response = await axios.get(`https://api.telegram.org/bot${process.env.TELEGRAM_BOT_TOKEN}/getWebhookInfo`);
        res.json(response.data);
    }
    catch (err) {
        res.status(500).json({ error: err.message, details: err.response?.data });
    }
});
app.get('/webhook/diagnose', async (req, res) => {
    try {
        const axios = require('axios');
        const mask = (str) => {
            if (!str)
                return 'undefined';
            if (str.length <= 8)
                return '***';
            return str.substring(0, 4) + '...' + str.substring(str.length - 4);
        };
        const info = {
            PORT: process.env.PORT,
            NODE_ENV: process.env.NODE_ENV,
            DATABASE_URL_PRESENT: !!process.env.DATABASE_URL,
            WEBHOOK_VERIFY_TOKEN_PRESENT: !!process.env.WEBHOOK_VERIFY_TOKEN,
            WHATSAPP_VERIFY_TOKEN: mask(process.env.WHATSAPP_VERIFY_TOKEN),
            WHATSAPP_API_TOKEN: mask(process.env.WHATSAPP_API_TOKEN),
            WHATSAPP_TOKEN: mask(process.env.WHATSAPP_TOKEN),
            PHONE_NUMBER_ID: mask(process.env.PHONE_NUMBER_ID),
            WHATSAPP_PROVIDER: process.env.WHATSAPP_PROVIDER,
            TWILIO_ACCOUNT_SID: mask(process.env.TWILIO_ACCOUNT_SID),
            TWILIO_AUTH_TOKEN: mask(process.env.TWILIO_AUTH_TOKEN),
            TWILIO_WHATSAPP_NUMBER: process.env.TWILIO_WHATSAPP_NUMBER,
            MESSAGING_PLATFORM: process.env.MESSAGING_PLATFORM,
            TELEGRAM_BOT_TOKEN: mask(process.env.TELEGRAM_BOT_TOKEN),
            BACKEND_URL: process.env.BACKEND_URL,
            RAILWAY_STATIC_URL: process.env.RAILWAY_STATIC_URL,
            sentMessages: webhook_controller_1.WebhookController.sentMessages,
        };
        res.status(200).json({
            info
        });
    }
    catch (error) {
        res.status(500).json({ error: error.message });
    }
});
app.get('/webhook/payloads', (req, res) => {
    res.json(webhook_controller_1.WebhookController.incomingPayloads);
});
app.get('/webhook/send-template', async (req, res) => {
    try {
        const axios = require('axios');
        const phoneId = process.env.PHONE_NUMBER_ID;
        const token = process.env.WHATSAPP_TOKEN;
        console.log(`Sending template message to 966563104828. PhoneID: ${phoneId}`);
        const response = await axios.post(`https://graph.facebook.com/v18.0/${phoneId}/messages`, {
            messaging_product: 'whatsapp',
            to: '966563104828',
            type: 'template',
            template: {
                name: 'hello_world',
                language: { code: 'en_US' }
            }
        }, {
            headers: {
                Authorization: `Bearer ${token}`,
                'Content-Type': 'application/json'
            }
        });
        res.status(200).json({
            success: true,
            status: response.status,
            data: response.data
        });
    }
    catch (error) {
        try {
            const axios = require('axios');
            const phoneId = process.env.PHONE_NUMBER_ID;
            const token = process.env.WHATSAPP_TOKEN;
            const response = await axios.post(`https://graph.facebook.com/v18.0/${phoneId}/messages`, {
                messaging_product: 'whatsapp',
                to: '966563104828',
                type: 'template',
                template: {
                    name: '3p_direct_integration_test_template',
                    language: { code: 'en_US' }
                }
            }, {
                headers: {
                    Authorization: `Bearer ${token}`,
                    'Content-Type': 'application/json'
                }
            });
            res.status(200).json({
                success: true,
                fallbackUsed: true,
                status: response.status,
                data: response.data
            });
        }
        catch (fallbackError) {
            res.status(500).json({
                success: false,
                error: error.message,
                fallbackError: fallbackError.message,
                data: fallbackError.response?.data || error.response?.data
            });
        }
    }
});
app.get('/webhook/debug-msg-status', async (req, res) => {
    try {
        const axios = require('axios');
        const token = process.env.WHATSAPP_TOKEN;
        const msgId = req.query.msgId || 'wamid.HBgMOTY2NTYzMTA0ODI4FQIAERgSRjk5RkU3MjM5N0UxOEVDM0I2AA==';
        console.log(`Querying message status for ID: ${msgId}`);
        const response = await axios.get(`https://graph.facebook.com/v18.0/${msgId}`, {
            headers: {
                Authorization: `Bearer ${token}`
            }
        });
        res.status(200).json({
            success: true,
            data: response.data
        });
    }
    catch (error) {
        res.status(500).json({
            success: false,
            error: error.message,
            data: error.response?.data
        });
    }
});
app.get('/webhook/subscribe-app', async (req, res) => {
    try {
        const axios = require('axios');
        const phoneId = process.env.PHONE_NUMBER_ID;
        const token = process.env.WHATSAPP_TOKEN;
        console.log(`Subscribing app to phoneId: ${phoneId}`);
        const response = await axios.post(`https://graph.facebook.com/v18.0/${phoneId}/subscribed_apps`, {}, {
            headers: {
                Authorization: `Bearer ${token}`
            }
        });
        res.status(200).json({
            success: true,
            status: response.status,
            data: response.data
        });
    }
    catch (error) {
        res.status(500).json({
            success: false,
            error: error.message,
            data: error.response?.data
        });
    }
});
// Public Auth Route
app.post('/api/auth/login', auth_controller_1.AuthController.login);
// Public Geolocation Attendance & Profile Routes
app.post('/api/attendance/check-in', (0, validate_middleware_1.validate)(attendance_controller_1.attendanceRecordSchema), attendance_controller_1.AttendanceController.checkIn);
app.post('/api/attendance/check-out', (0, validate_middleware_1.validate)(attendance_controller_1.attendanceRecordSchema), attendance_controller_1.AttendanceController.checkOut);
app.get('/api/users/:id/public-profile', user_controller_1.UserController.getPublicProfile);
// Global Authentication Guard for all subsequent routes
app.use(auth_middleware_1.verifyToken);
// Protected Auth Routes
app.post('/api/auth/logout', auth_controller_1.AuthController.logout);
app.get('/api/auth/me', auth_controller_1.AuthController.me);
// Request API Routes
app.post('/api/requests', (0, validate_middleware_1.validate)(request_controller_1.createRequestSchema), request_controller_1.RequestController.create);
app.get('/api/requests', (0, validate_middleware_1.validate)(request_controller_1.getRequestsQuerySchema), request_controller_1.RequestController.getAll);
app.get('/api/requests/:id', request_controller_1.RequestController.getById);
app.patch('/api/requests/:id', (0, validate_middleware_1.validate)(request_controller_1.updateRequestSchema), request_controller_1.RequestController.update);
app.delete('/api/requests/:id', request_controller_1.RequestController.delete);
// Inventory API Routes
app.post('/api/inventory', (0, validate_middleware_1.validate)(inventory_controller_1.createInventorySchema), inventory_controller_1.InventoryController.create);
app.get('/api/inventory', (0, validate_middleware_1.validate)(inventory_controller_1.getInventoryQuerySchema), inventory_controller_1.InventoryController.getAll);
app.get('/api/inventory/:id', inventory_controller_1.InventoryController.getById);
app.patch('/api/inventory/:id', (0, validate_middleware_1.validate)(inventory_controller_1.updateInventorySchema), inventory_controller_1.InventoryController.update);
app.delete('/api/inventory/:id', inventory_controller_1.InventoryController.delete);
// Branch API Routes
app.get('/api/branches', branch_controller_1.BranchController.getAll);
app.post('/api/branches', (0, validate_middleware_1.validate)(branch_controller_1.createBranchSchema), branch_controller_1.BranchController.create);
app.patch('/api/branches/:id', (0, validate_middleware_1.validate)(branch_controller_1.updateBranchSchema), branch_controller_1.BranchController.update);
app.delete('/api/branches/:id', branch_controller_1.BranchController.delete);
// User/Employee API Routes
app.get('/api/users', user_controller_1.UserController.getAll);
app.post('/api/users', (0, validate_middleware_1.validate)(user_controller_1.createUserSchema), user_controller_1.UserController.create);
app.patch('/api/users/:id', (0, validate_middleware_1.validate)(user_controller_1.updateUserSchema), user_controller_1.UserController.update);
app.delete('/api/users/:id', user_controller_1.UserController.delete);
app.patch('/api/users/:id/transfer-branch', (0, validate_middleware_1.validate)(user_controller_1.transferBranchSchema), user_controller_1.UserController.transferBranch);
app.patch('/api/users/:id/status', system_controller_1.SystemController.toggleUserStatus);
// System Management API Routes
app.get('/api/system/settings', system_controller_1.SystemController.getSettings);
app.post('/api/system/settings', system_controller_1.SystemController.updateSettings);
app.get('/api/system/logs', system_controller_1.SystemController.getLogs);
app.get('/api/system/roles', system_controller_1.SystemController.getRolePermissions);
app.post('/api/system/roles', system_controller_1.SystemController.updateRolePermissions);
// Shift Report API Routes
app.post('/api/shift-reports', (0, validate_middleware_1.validate)(shiftReport_controller_1.createShiftReportSchema), shiftReport_controller_1.ShiftReportController.create);
app.get('/api/shift-reports', shiftReport_controller_1.ShiftReportController.getAll);
app.get('/api/shift-reports/:id', shiftReport_controller_1.ShiftReportController.getById);
app.patch('/api/shift-reports/:id', (0, validate_middleware_1.validate)(shiftReport_controller_1.updateShiftReportSchema), shiftReport_controller_1.ShiftReportController.update);
app.delete('/api/shift-reports/:id', shiftReport_controller_1.ShiftReportController.delete);
app.patch('/api/shift-reports/:id/approve', (0, validate_middleware_1.validate)(shiftReport_controller_1.approveShiftReportSchema), shiftReport_controller_1.ShiftReportController.approve);
app.patch('/api/shift-reports/:id/reject', (0, validate_middleware_1.validate)(shiftReport_controller_1.rejectShiftReportSchema), shiftReport_controller_1.ShiftReportController.reject);
app.get('/api/shift-reports/stats/:reporterId', shiftReport_controller_1.ShiftReportController.getStats);
// Shift API Routes
app.post('/api/shifts', (0, validate_middleware_1.validate)(shift_controller_1.createShiftSchema), shift_controller_1.ShiftController.create);
app.get('/api/shifts', shift_controller_1.ShiftController.getAll);
app.get('/api/shifts/branch/:branchId', shift_controller_1.ShiftController.getByBranch);
app.patch('/api/shifts/:id', (0, validate_middleware_1.validate)(shift_controller_1.updateShiftSchema), shift_controller_1.ShiftController.update);
app.delete('/api/shifts/:id', shift_controller_1.ShiftController.delete);
// Attendance API Routes
app.get('/api/attendance/today', attendance_controller_1.AttendanceController.getToday);
app.get('/api/attendance/history/:userId', attendance_controller_1.AttendanceController.getHistory);
app.get('/api/attendance/summary', attendance_controller_1.AttendanceController.getSummary);
app.get('/api/attendance/grid', attendance_controller_1.AttendanceController.getGrid);
// Loan API Routes
app.post('/api/loans', (0, validate_middleware_1.validate)(loan_controller_1.createLoanSchema), loan_controller_1.LoanController.create);
app.get('/api/loans', loan_controller_1.LoanController.getAll);
app.patch('/api/loans/:id/review', (0, validate_middleware_1.validate)(loan_controller_1.reviewLoanSchema), loan_controller_1.LoanController.review);
app.get('/api/loans/user/:userId', loan_controller_1.LoanController.getHistory);
// HR API Routes
app.post('/api/hr/announcements', hr_controller_1.HRController.broadcastAnnouncement);
app.get('/api/hr/transfers/:userId', hr_controller_1.HRController.getTransferHistory);
app.get('/api/finance/loans/metrics', hr_controller_1.HRController.getFinanceLoanMetrics);
// Leave API Routes
app.post('/api/leaves', (0, validate_middleware_1.validate)(leave_controller_1.createLeaveSchema), leave_controller_1.LeaveController.create);
app.get('/api/leaves', leave_controller_1.LeaveController.getAll);
app.patch('/api/leaves/:id/review', (0, validate_middleware_1.validate)(leave_controller_1.reviewLeaveSchema), leave_controller_1.LeaveController.review);
app.get('/api/leaves/user/:userId', leave_controller_1.LeaveController.getHistory);
app.get('/api/leaves/balance/:userId', leave_controller_1.LeaveController.getBalance);
app.patch('/api/leaves/balance/:userId', (0, validate_middleware_1.validate)(leave_controller_1.adjustBalanceSchema), leave_controller_1.LeaveController.adjustBalance);
// Maintenance API Routes
app.post('/api/maintenance', maintenance_controller_1.MaintenanceController.create);
app.get('/api/maintenance', maintenance_controller_1.MaintenanceController.getAll);
app.get('/api/maintenance/stats', maintenance_controller_1.MaintenanceController.getStats);
app.get('/api/maintenance/workload', maintenance_controller_1.MaintenanceController.getWorkload);
app.get('/api/maintenance/:id', maintenance_controller_1.MaintenanceController.getById);
app.patch('/api/maintenance/:id/assign', maintenance_controller_1.MaintenanceController.assign);
app.patch('/api/maintenance/:id/start', maintenance_controller_1.MaintenanceController.start);
app.patch('/api/maintenance/:id/complete', maintenance_controller_1.MaintenanceController.complete);
app.patch('/api/maintenance/:id/approve', maintenance_controller_1.MaintenanceController.approve);
app.patch('/api/maintenance/:id/reject', maintenance_controller_1.MaintenanceController.reject);
app.patch('/api/maintenance/:id/spare-parts', maintenance_controller_1.MaintenanceController.spareParts);
app.patch('/api/maintenance/:id/resume', maintenance_controller_1.MaintenanceController.resume);
// Warehouse & Inventory API Routes
app.get('/api/warehouse/categories', warehouse_controller_1.WarehouseController.getCategories);
app.get('/api/warehouse/items', warehouse_controller_1.WarehouseController.getItems);
app.get('/api/warehouse/items/:id', warehouse_controller_1.WarehouseController.getItemById);
app.post('/api/warehouse/items', warehouse_controller_1.WarehouseController.createItem);
app.patch('/api/warehouse/items/:id', warehouse_controller_1.WarehouseController.updateItem);
app.get('/api/warehouse/stock/:branchId', warehouse_controller_1.WarehouseController.getStockByBranch);
app.post('/api/warehouse/stock/adjust', warehouse_controller_1.WarehouseController.adjustStock);
app.get('/api/warehouse/requests', warehouse_controller_1.WarehouseController.getWarehouseRequests);
app.post('/api/warehouse/requests', warehouse_controller_1.WarehouseController.createWarehouseRequest);
app.patch('/api/warehouse/requests/:id/approve', warehouse_controller_1.WarehouseController.approveWarehouseRequest);
app.patch('/api/warehouse/requests/:id/reject', warehouse_controller_1.WarehouseController.rejectWarehouseRequest);
app.get('/api/warehouse/stats', warehouse_controller_1.WarehouseController.getWarehouseStats);
app.get('/api/warehouse/procurement', warehouse_controller_1.WarehouseController.getProcurementRequests);
app.get('/api/warehouse/procurement/:id', warehouse_controller_1.WarehouseController.getProcurementById);
app.patch('/api/warehouse/procurement/:id/review', warehouse_controller_1.WarehouseController.reviewProcurement);
app.patch('/api/warehouse/procurement/:id/approve', warehouse_controller_1.WarehouseController.financiallyApproveProcurement);
app.patch('/api/warehouse/procurement/:id/reject', warehouse_controller_1.WarehouseController.rejectProcurement);
app.patch('/api/warehouse/procurement/:id/purchased', warehouse_controller_1.WarehouseController.markPurchased);
app.patch('/api/warehouse/procurement/:id/receive', warehouse_controller_1.WarehouseController.receiveInWarehouse);
app.get('/api/warehouse/suppliers', warehouse_controller_1.WarehouseController.getSuppliers);
app.post('/api/warehouse/suppliers', warehouse_controller_1.WarehouseController.createSupplier);
app.patch('/api/warehouse/suppliers/:id', warehouse_controller_1.WarehouseController.updateSupplier);
app.get('/api/warehouse/units', warehouse_controller_1.WarehouseController.getUnits);
app.post('/api/warehouse/units', warehouse_controller_1.WarehouseController.createUnit);
app.post('/api/warehouse/items/:id/add-stock', warehouse_controller_1.WarehouseController.addStock);
// Lost & Found API Routes
app.get('/api/lostfound', lostfound_controller_1.LostFoundController.getAllLost);
app.post('/api/lostfound', (0, validate_middleware_1.validate)(lostfound_controller_1.createLostItemSchema), lostfound_controller_1.LostFoundController.createLost);
app.get('/api/lostfound/:id', lostfound_controller_1.LostFoundController.getLostById);
app.patch('/api/lostfound/:id/contact', (0, validate_middleware_1.validate)(lostfound_controller_1.updateGuestContactSchema), lostfound_controller_1.LostFoundController.contactGuest);
app.patch('/api/lostfound/:id/claim', (0, validate_middleware_1.validate)(lostfound_controller_1.claimItemSchema), lostfound_controller_1.LostFoundController.claimLost);
app.patch('/api/lostfound/:id/archive', lostfound_controller_1.LostFoundController.archiveLost);
// Damage Report API Routes
app.get('/api/damage', lostfound_controller_1.LostFoundController.getAllDamage);
app.post('/api/damage', (0, validate_middleware_1.validate)(lostfound_controller_1.createDamageReportSchema), lostfound_controller_1.LostFoundController.createDamage);
app.get('/api/damage/stats', lostfound_controller_1.LostFoundController.getStats);
app.get('/api/damage/:id', lostfound_controller_1.LostFoundController.getDamageById);
app.patch('/api/damage/:id/review', (0, validate_middleware_1.validate)(lostfound_controller_1.reviewDamageSchema), lostfound_controller_1.LostFoundController.reviewDamage);
app.patch('/api/damage/:id/collect', (0, validate_middleware_1.validate)(lostfound_controller_1.collectPaymentSchema), lostfound_controller_1.LostFoundController.collectPayment);
app.patch('/api/damage/:id/refuse', (0, validate_middleware_1.validate)(lostfound_controller_1.markRefusedSchema), lostfound_controller_1.LostFoundController.markRefused);
app.patch('/api/damage/:id/waive', (0, validate_middleware_1.validate)(lostfound_controller_1.waiveDamageSchema), lostfound_controller_1.LostFoundController.waiveDamage);
// Document API Routes
app.post('/api/documents/upload', document_controller_1.DocumentController.upload);
app.get('/api/documents', document_controller_1.DocumentController.getAll);
app.delete('/api/documents/:id', document_controller_1.DocumentController.delete);
// Reports API Routes
app.use('/api/reports', reports_controller_1.default);
// Group Operational Daily Report API Routes
app.post('/api/reports/groups/send-now', async (req, res) => {
    try {
        const { GroupReportService } = require('./services/group-report.service');
        const result = await GroupReportService.sendDailyReportToManager(req.body.phone, req.body.date);
        res.json(result);
    }
    catch (err) {
        res.status(500).json({ success: false, error: err.message });
    }
});
app.get('/api/reports/groups/preview', async (req, res) => {
    try {
        const { GroupReportService } = require('./services/group-report.service');
        const report = await GroupReportService.generateDailyReport(req.query.date);
        res.json({ success: true, report });
    }
    catch (err) {
        res.status(500).json({ success: false, error: err.message });
    }
});
// Centralized Error Handling Middleware
app.use(error_middleware_1.errorHandler);
// Start Server if not imported by tests
if (process.env.NODE_ENV !== 'test') {
    const PORT = parseInt(process.env.PORT || '3000', 10);
    app.listen(PORT, '0.0.0.0', () => {
        console.log(`🚀 Rahti Hotels Operations Server is running on port ${PORT}`);
        console.log(`📡 WhatsApp Webhook URL: http://0.0.0.0:${PORT}/webhook`);
        console.log(`⚙️  Verify Token is set to: "${process.env.WEBHOOK_VERIFY_TOKEN}"`);
        // Start automated daily timer for group report (11:00 PM KSA = 23:00 KSA)
        setInterval(() => {
            try {
                const { GroupReportService } = require('./services/group-report.service');
                GroupReportService.checkAndTriggerScheduledReport();
            }
            catch (err) {
                console.error('❌ Error in group report scheduler:', err);
            }
        }, 60 * 1000);
        // Initialize Telegram Webhook if Messaging Platform is set to telegram
        if (process.env.MESSAGING_PLATFORM === 'telegram') {
            const { TelegramService } = require('./services/telegram.service');
            const backendUrl = process.env.BACKEND_URL ||
                (process.env.RAILWAY_STATIC_URL ? `https://${process.env.RAILWAY_STATIC_URL}` : `http://localhost:${PORT}`);
            TelegramService.setWebhook(backendUrl);
        }
    });
}
exports.default = app;
