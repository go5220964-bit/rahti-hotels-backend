"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.UserController = exports.transferBranchSchema = exports.updateUserSchema = exports.createUserSchema = void 0;
const zod_1 = require("zod");
const user_service_1 = require("../services/user.service");
const activity_log_service_1 = require("../services/activity-log.service");
exports.createUserSchema = zod_1.z.object({
    body: zod_1.z.object({
        name: zod_1.z.string().min(1, 'Name is required'),
        role: zod_1.z.string().min(1, 'Role is required'),
        phoneNumber: zod_1.z.string().min(1, 'Phone number is required'),
        branchId: zod_1.z.string().nullable().optional(),
        employeeType: zod_1.z.string().optional(),
        email: zod_1.z.string().optional()
    })
});
exports.updateUserSchema = zod_1.z.object({
    body: zod_1.z.object({
        name: zod_1.z.string().min(1).optional(),
        role: zod_1.z.string().min(1).optional(),
        phoneNumber: zod_1.z.string().min(1).optional(),
        branchId: zod_1.z.string().nullable().optional(),
        employeeType: zod_1.z.string().optional(),
        email: zod_1.z.string().optional(),
        botEnabled: zod_1.z.boolean().optional()
    })
});
exports.transferBranchSchema = zod_1.z.object({
    body: zod_1.z.object({
        newBranchId: zod_1.z.string().min(1, 'New Branch ID is required'),
        reason: zod_1.z.string().optional(),
        preserveHistory: zod_1.z.boolean().optional()
    })
});
class UserController {
    static getAll = async (req, res, next) => {
        try {
            const users = await user_service_1.UserService.getAll();
            const response = {
                success: true,
                data: users
            };
            res.status(200).json(response);
        }
        catch (error) {
            next(error);
        }
    };
    static create = async (req, res, next) => {
        try {
            const newUser = await user_service_1.UserService.createUser(req.body);
            const user = req.user || { id: 'system' };
            await activity_log_service_1.ActivityLogService.log(user.id, 'CREATE_USER', 'User', newUser.id, { name: newUser.name, role: newUser.role }, req.ip);
            const response = {
                success: true,
                data: newUser
            };
            res.status(201).json(response);
        }
        catch (error) {
            next(error);
        }
    };
    static update = async (req, res, next) => {
        try {
            const { id } = req.params;
            const updatedUser = await user_service_1.UserService.updateUser(id, req.body);
            const user = req.user || { id: 'system' };
            await activity_log_service_1.ActivityLogService.log(user.id, 'UPDATE_USER', 'User', id, req.body, req.ip);
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
    static delete = async (req, res, next) => {
        try {
            const { id } = req.params;
            await user_service_1.UserService.deleteUser(id);
            const user = req.user || { id: 'system' };
            await activity_log_service_1.ActivityLogService.log(user.id, 'DELETE_USER', 'User', id, null, req.ip);
            const response = {
                success: true,
                data: { id, message: 'User successfully deleted' }
            };
            res.status(200).json(response);
        }
        catch (error) {
            next(error);
        }
    };
    static transferBranch = async (req, res, next) => {
        try {
            const { id } = req.params;
            const { newBranchId, reason } = req.body;
            const user = req.user || { id: 'system' };
            const updatedUser = await user_service_1.UserService.transferBranch(id, newBranchId, reason || 'نقل إداري', user.id);
            await activity_log_service_1.ActivityLogService.log(user.id, 'TRANSFER_BRANCH', 'User', id, { toBranchId: newBranchId, reason: reason || 'نقل إداري' }, req.ip);
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
    static getPublicProfile = async (req, res, next) => {
        try {
            const { id } = req.params;
            const user = await user_service_1.UserService.getUserById(id);
            const response = {
                success: true,
                data: {
                    name: user.name,
                    role: user.role
                }
            };
            res.status(200).json(response);
        }
        catch (error) {
            next(error);
        }
    };
}
exports.UserController = UserController;
