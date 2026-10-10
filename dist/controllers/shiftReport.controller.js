"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ShiftReportController = exports.rejectShiftReportSchema = exports.approveShiftReportSchema = exports.updateShiftReportSchema = exports.createShiftReportSchema = void 0;
const zod_1 = require("zod");
const shiftReport_service_1 = require("../services/shiftReport.service");
exports.createShiftReportSchema = zod_1.z.object({
    body: zod_1.z.object({
        reporterId: zod_1.z.string().min(1, 'Reporter ID is required'),
        branchId: zod_1.z.string().min(1, 'Branch ID is required'),
        shiftLabel: zod_1.z.string().min(1, 'Shift label is required'),
        cashTotal: zod_1.z.number().nonnegative(),
        cashExpenses: zod_1.z.number().nonnegative(),
        visa: zod_1.z.number().nonnegative(),
        mada: zod_1.z.number().nonnegative(),
        mastercard: zod_1.z.number().nonnegative(),
        gulfNet: zod_1.z.number().nonnegative(),
        tabby: zod_1.z.number().nonnegative(),
        bankTransfer: zod_1.z.number().nonnegative(),
        shiftId: zod_1.z.string().nullable().optional(),
        customStartTime: zod_1.z.string().nullable().optional(),
        customEndTime: zod_1.z.string().nullable().optional(),
        isManual: zod_1.z.boolean().optional(),
        manualEnteredBy: zod_1.z.string().nullable().optional(),
        createdAt: zod_1.z.string().optional()
    })
});
exports.updateShiftReportSchema = zod_1.z.object({
    body: zod_1.z.object({
        reporterId: zod_1.z.string().min(1).optional(),
        branchId: zod_1.z.string().min(1).optional(),
        shiftLabel: zod_1.z.string().min(1).optional(),
        cashTotal: zod_1.z.number().nonnegative().optional(),
        cashExpenses: zod_1.z.number().nonnegative().optional(),
        visa: zod_1.z.number().nonnegative().optional(),
        mada: zod_1.z.number().nonnegative().optional(),
        mastercard: zod_1.z.number().nonnegative().optional(),
        gulfNet: zod_1.z.number().nonnegative().optional(),
        tabby: zod_1.z.number().nonnegative().optional(),
        bankTransfer: zod_1.z.number().nonnegative().optional(),
        shiftId: zod_1.z.string().nullable().optional(),
        customStartTime: zod_1.z.string().nullable().optional(),
        customEndTime: zod_1.z.string().nullable().optional(),
        isManual: zod_1.z.boolean().optional(),
        manualEnteredBy: zod_1.z.string().nullable().optional()
    })
});
exports.approveShiftReportSchema = zod_1.z.object({
    body: zod_1.z.object({
        reviewerId: zod_1.z.string().min(1, 'Reviewer ID is required')
    })
});
exports.rejectShiftReportSchema = zod_1.z.object({
    body: zod_1.z.object({
        reviewerId: zod_1.z.string().min(1, 'Reviewer ID is required'),
        reason: zod_1.z.string().min(1, 'Rejection reason is required')
    })
});
class ShiftReportController {
    static create = async (req, res, next) => {
        try {
            const newReport = await shiftReport_service_1.ShiftReportService.createShiftReport(req.body);
            const response = {
                success: true,
                data: newReport
            };
            res.status(201).json(response);
        }
        catch (error) {
            next(error);
        }
    };
    static getAll = async (req, res, next) => {
        try {
            const { branchId, reporterId, status, startDate, endDate } = req.query;
            const reports = await shiftReport_service_1.ShiftReportService.getAllShiftReports({
                branchId: branchId,
                reporterId: reporterId,
                status: status,
                startDate: startDate,
                endDate: endDate
            });
            const response = {
                success: true,
                data: reports
            };
            res.status(200).json(response);
        }
        catch (error) {
            next(error);
        }
    };
    static getById = async (req, res, next) => {
        try {
            const { id } = req.params;
            const report = await shiftReport_service_1.ShiftReportService.getShiftReportById(id);
            const response = {
                success: true,
                data: report
            };
            res.status(200).json(response);
        }
        catch (error) {
            next(error);
        }
    };
    static approve = async (req, res, next) => {
        try {
            const { id } = req.params;
            const { reviewerId } = req.body;
            const updatedReport = await shiftReport_service_1.ShiftReportService.approveShiftReport(id, reviewerId);
            const response = {
                success: true,
                data: updatedReport
            };
            res.status(200).json(response);
        }
        catch (error) {
            next(error);
        }
    };
    static reject = async (req, res, next) => {
        try {
            const { id } = req.params;
            const { reviewerId, reason } = req.body;
            const updatedReport = await shiftReport_service_1.ShiftReportService.rejectShiftReport(id, reviewerId, reason);
            const response = {
                success: true,
                data: updatedReport
            };
            res.status(200).json(response);
        }
        catch (error) {
            next(error);
        }
    };
    static update = async (req, res, next) => {
        try {
            const { id } = req.params;
            const updatedReport = await shiftReport_service_1.ShiftReportService.updateShiftReport(id, req.body);
            const response = {
                success: true,
                data: updatedReport
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
            await shiftReport_service_1.ShiftReportService.deleteShiftReport(id);
            const response = {
                success: true,
                data: { id, message: 'Shift report successfully deleted' }
            };
            res.status(200).json(response);
        }
        catch (error) {
            next(error);
        }
    };
    static getStats = async (req, res, next) => {
        try {
            const { reporterId } = req.params;
            const { preserveHistory } = req.query;
            const preserve = preserveHistory !== 'false';
            const stats = await shiftReport_service_1.ShiftReportService.getReporterStats(reporterId, preserve);
            const response = {
                success: true,
                data: stats
            };
            res.status(200).json(response);
        }
        catch (error) {
            next(error);
        }
    };
}
exports.ShiftReportController = ShiftReportController;
