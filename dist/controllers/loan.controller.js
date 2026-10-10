"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.LoanController = exports.reviewLoanSchema = exports.createLoanSchema = void 0;
const zod_1 = require("zod");
const loan_service_1 = require("../services/loan.service");
exports.createLoanSchema = zod_1.z.object({
    body: zod_1.z.object({
        userId: zod_1.z.string().min(1, 'User ID is required'),
        amount: zod_1.z.number().positive('Amount must be positive'),
        reason: zod_1.z.string().min(1, 'Reason is required'),
        repaymentMonths: zod_1.z.number().int().positive().optional()
    })
});
exports.reviewLoanSchema = zod_1.z.object({
    body: zod_1.z.object({
        status: zod_1.z.enum(['Approved', 'Rejected'], {
            required_error: 'Status is required and must be Approved or Rejected'
        }),
        reviewNote: zod_1.z.string().optional(),
        reviewerId: zod_1.z.string().optional()
    })
});
class LoanController {
    static create = async (req, res, next) => {
        try {
            const { userId, amount, reason, repaymentMonths } = req.body;
            const loan = await loan_service_1.LoanService.createLoanRequest(userId, amount, reason, repaymentMonths);
            const response = {
                success: true,
                data: loan
            };
            res.status(201).json(response);
        }
        catch (error) {
            next(error);
        }
    };
    static getAll = async (req, res, next) => {
        try {
            const { status, userId, branchId } = req.query;
            const loans = await loan_service_1.LoanService.getLoanRequests({
                status: status,
                userId: userId,
                branchId: branchId
            });
            const response = {
                success: true,
                data: loans
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
            const loan = await loan_service_1.LoanService.reviewLoanRequest(id, actualReviewerId, status, reviewNote);
            const response = {
                success: true,
                data: loan
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
            const loans = await loan_service_1.LoanService.getEmployeeLoanHistory(userId);
            const response = {
                success: true,
                data: loans
            };
            res.status(200).json(response);
        }
        catch (error) {
            next(error);
        }
    };
}
exports.LoanController = LoanController;
