"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.SystemController = void 0;
const prisma_1 = __importDefault(require("../services/prisma"));
const activity_log_service_1 = require("../services/activity-log.service");
const error_middleware_1 = require("../middleware/error.middleware");
class SystemController {
    // Settings / Integrations
    static getSettings = async (req, res, next) => {
        try {
            const settings = await prisma_1.default.systemSetting.findMany();
            const response = {
                success: true,
                data: settings.reduce((acc, curr) => {
                    acc[curr.key] = curr.value;
                    return acc;
                }, {})
            };
            res.status(200).json(response);
        }
        catch (error) {
            next(error);
        }
    };
    static updateSettings = async (req, res, next) => {
        try {
            const settingsObj = req.body.settings || req.body || {};
            const user = req.user || { id: 'system' };
            for (const [key, value] of Object.entries(settingsObj)) {
                if (typeof value === 'object' && value !== null)
                    continue;
                await prisma_1.default.systemSetting.upsert({
                    where: { key },
                    update: { value: String(value), updatedBy: user.id },
                    create: { key, value: String(value), updatedBy: user.id }
                });
            }
            await activity_log_service_1.ActivityLogService.log(user.id, 'UPDATE_SETTINGS', 'SystemSetting', 'global', settingsObj, req.ip);
            const response = {
                success: true,
                data: { message: 'Settings successfully updated' }
            };
            res.status(200).json(response);
        }
        catch (error) {
            next(error);
        }
    };
    // Activity Logs
    static getLogs = async (req, res, next) => {
        try {
            const limit = parseInt(req.query.limit) || 100;
            const offset = parseInt(req.query.offset) || 0;
            const logs = await activity_log_service_1.ActivityLogService.getLogs(limit, offset);
            const response = {
                success: true,
                data: logs
            };
            res.status(200).json(response);
        }
        catch (error) {
            next(error);
        }
    };
    // Role Permissions
    static getRolePermissions = async (req, res, next) => {
        try {
            const setting = await prisma_1.default.systemSetting.findUnique({
                where: { key: 'role_permission_matrix' }
            });
            // Default matrix if not set
            const defaultMatrix = {
                Admin: ['overview', 'employees', 'shifts', 'attendance', 'leaves', 'loans', 'shift-reports', 'receptionist-stats', 'maintenance', 'warehouse', 'procurement', 'lost-found', 'documents', 'reports', 'system'],
                CEO: ['overview', 'employees', 'shifts', 'attendance', 'leaves', 'loans', 'shift-reports', 'receptionist-stats', 'maintenance', 'warehouse', 'procurement', 'lost-found', 'documents', 'reports'],
                BranchManager: ['overview', 'employees', 'shifts', 'attendance', 'leaves', 'loans', 'shift-reports', 'maintenance', 'lost-found', 'documents', 'reports'],
                Receptionist: ['overview', 'attendance', 'shift-reports', 'lost-found'],
                Accountant: ['overview', 'shift-reports', 'receptionist-stats', 'loans', 'reports'],
                Supervisor: ['overview', 'maintenance', 'warehouse'], // e.g. MaintenanceSupervisor
                Storekeeper: ['overview', 'warehouse', 'procurement'] // e.g. WarehouseManager
            };
            const matrix = setting ? JSON.parse(setting.value) : defaultMatrix;
            const response = {
                success: true,
                data: matrix
            };
            res.status(200).json(response);
        }
        catch (error) {
            next(error);
        }
    };
    static updateRolePermissions = async (req, res, next) => {
        try {
            const { matrix } = req.body;
            const user = req.user || { id: 'system' };
            await prisma_1.default.systemSetting.upsert({
                where: { key: 'role_permission_matrix' },
                update: { value: JSON.stringify(matrix), updatedBy: user.id },
                create: { key: 'role_permission_matrix', value: JSON.stringify(matrix), updatedBy: user.id }
            });
            await activity_log_service_1.ActivityLogService.log(user.id, 'UPDATE_ROLE_PERMISSIONS', 'SystemSetting', 'role_permission_matrix', matrix, req.ip);
            const response = {
                success: true,
                data: { message: 'Role permissions matrix successfully updated' }
            };
            res.status(200).json(response);
        }
        catch (error) {
            next(error);
        }
    };
    // User Activation/Deactivation and System Users CRUD
    static toggleUserStatus = async (req, res, next) => {
        try {
            const { id } = req.params;
            const { isActive } = req.body;
            const user = req.user || { id: 'system' };
            const targetUser = await prisma_1.default.user.findUnique({ where: { id } });
            if (!targetUser) {
                throw new error_middleware_1.AppError(404, 'USER_NOT_FOUND', 'المستخدم غير موجود');
            }
            const updatedUser = await prisma_1.default.user.update({
                where: { id },
                data: { isActive }
            });
            await activity_log_service_1.ActivityLogService.log(user.id, isActive ? 'ACTIVATE_USER' : 'DEACTIVATE_USER', 'User', id, { name: targetUser.name, role: targetUser.role }, req.ip);
            const response = {
                success: true,
                data: updatedUser
            };
            res.status(200).json(response);
        }
        catch (error) {
            next(error);
        }
    };
}
exports.SystemController = SystemController;
