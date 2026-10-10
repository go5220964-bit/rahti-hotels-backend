"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.LeaveController = exports.adjustBalanceSchema = exports.reviewLeaveSchema = exports.createLeaveSchema = void 0;
const zod_1 = require("zod");
const leave_service_1 = require("../services/leave.service");
const prisma_1 = __importDefault(require("../services/prisma"));
exports.createLeaveSchema = zod_1.z.object({
    body: zod_1.z.object({
        userId: zod_1.z.string().min(1, 'User ID is required'),
        leaveType: zod_1.z.enum(['Annual', 'Sick', 'Emergency', 'Unpaid']),
        startDate: zod_1.z.string().min(1, 'Start date is required'),
        endDate: zod_1.z.string().min(1, 'End date is required'),
        reason: zod_1.z.string().min(1, 'Reason is required')
    })
});
exports.reviewLeaveSchema = zod_1.z.object({
    body: zod_1.z.object({
        status: zod_1.z.enum(['Approved', 'Rejected'], {
            required_error: 'Status is required and must be Approved or Rejected'
        }),
        reviewNote: zod_1.z.string().optional(),
        reviewerId: zod_1.z.string().optional()
    })
});
exports.adjustBalanceSchema = zod_1.z.object({
    body: zod_1.z.object({
        annualLeaveBalance: zod_1.z.number().int().nonnegative(),
        sickLeaveBalance: zod_1.z.number().int().nonnegative()
    })
});
class LeaveController {
    static create = async (req, res, next) => {
        try {
            const { userId, leaveType, startDate, endDate, reason } = req.body;
            const leave = await leave_service_1.LeaveService.createLeaveRequest(userId, leaveType, startDate, endDate, reason);
            const response = {
                success: true,
                data: leave
            };
            res.status(201).json(response);
        }
        catch (error) {
            next(error);
        }
    };
    static getAll = async (req, res, next) => {
        try {
            const { status, userId, branchId, leaveType } = req.query;
            const leaves = await leave_service_1.LeaveService.getLeaveRequests({
                status: status,
                userId: userId,
                branchId: branchId,
                leaveType: leaveType
            });
            const response = {
                success: true,
                data: leaves
            };
            res.status(200).json(response);
        }
        catch (error) {
            next(error);
        }
    };
    static review = async (req, res, next) => {
        try {
            const { id } = req.params;
            const { status, reviewNote, reviewerId } = req.body;
            const actualReviewerId = reviewerId || 'system';
            const leave = await leave_service_1.LeaveService.reviewLeaveRequest(id, actualReviewerId, status, reviewNote);
            const response = {
                success: true,
                data: leave
            };
            res.status(200).json(response);
        }
        catch (error) {
            next(error);
        }
    };
    static getHistory = async (req, res, next) => {
        try {
            const { userId } = req.params;
            const leaves = await leave_service_1.LeaveService.getLeaveHistory(userId);
            const response = {
                success: true,
                data: leaves
            };
            res.status(200).json(response);
        }
        catch (error) {
            next(error);
        }
    };
    static getBalance = async (req, res, next) => {
        try {
            const { userId } = req.params;
            const balance = await leave_service_1.LeaveService.getEmployeeLeaveBalance(userId);
            const response = {
                success: true,
                data: balance
            };
            res.status(200).json(response);
        }
        catch (error) {
            next(error);
        }
    };
    static adjustBalance = async (req, res, next) => {
        try {
            const { userId } = req.params;
            const { annualLeaveBalance, sickLeaveBalance } = req.body;
            const updatedUser = await prisma_1.default.user.update({
                where: { id: userId },
                data: {
                    annualLeaveBalance,
                    sickLeaveBalance
                }
            });
            const response = {
                success: true,
                data: {
                    userId: updatedUser.id,
                    annualLeaveBalance: updatedUser.annualLeaveBalance,
                    sickLeaveBalance: updatedUser.sickLeaveBalance
                }
            };
            res.status(200).json(response);
        }
        catch (error) {
            next(error);
        }
    };
}
exports.LeaveController = LeaveController;
