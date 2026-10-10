"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.LostFoundController = exports.waiveDamageSchema = exports.markRefusedSchema = exports.collectPaymentSchema = exports.reviewDamageSchema = exports.createDamageReportSchema = exports.claimItemSchema = exports.updateGuestContactSchema = exports.createLostItemSchema = void 0;
const zod_1 = require("zod");
const lostfound_service_1 = require("../services/lostfound.service");
exports.createLostItemSchema = zod_1.z.object({
    body: zod_1.z.object({
        reportedBy: zod_1.z.string().min(1, 'Reporter ID is required'),
        branchId: zod_1.z.string().min(1, 'Branch ID is required'),
        location: zod_1.z.string().min(1, 'Location is required'),
        description: zod_1.z.string().min(1, 'Description is required'),
        photoUrl: zod_1.z.string().nullable().optional(),
        guestName: zod_1.z.string().nullable().optional(),
        guestPhone: zod_1.z.string().nullable().optional(),
        reservationRef: zod_1.z.string().nullable().optional(),
        notes: zod_1.z.string().nullable().optional(),
    })
});
exports.updateGuestContactSchema = zod_1.z.object({
    body: zod_1.z.object({
        guestName: zod_1.z.string().nullable().optional(),
        guestPhone: zod_1.z.string().nullable().optional(),
    })
});
exports.claimItemSchema = zod_1.z.object({
    body: zod_1.z.object({
        claimedBy: zod_1.z.string().min(1, 'Claimed by name is required'),
        claimedIdType: zod_1.z.string().min(1, 'ID Type is required'),
        claimedIdNumber: zod_1.z.string().min(1, 'ID Number is required'),
        handedOverBy: zod_1.z.string().min(1, 'Handed over by userId is required'),
    })
});
exports.createDamageReportSchema = zod_1.z.object({
    body: zod_1.z.object({
        reportedBy: zod_1.z.string().min(1, 'Reporter ID is required'),
        branchId: zod_1.z.string().min(1, 'Branch ID is required'),
        roomNumber: zod_1.z.string().min(1, 'Room number is required'),
        damageType: zod_1.z.string().min(1, 'Damage type is required'),
        description: zod_1.z.string().min(1, 'Description is required'),
        photoUrls: zod_1.z.string().optional(),
        reportedDuring: zod_1.z.string().optional(),
        reservationRef: zod_1.z.string().nullable().optional(),
        guestName: zod_1.z.string().nullable().optional(),
        guestPhone: zod_1.z.string().nullable().optional(),
        estimatedValue: zod_1.z.number().nullable().optional(),
    })
});
exports.reviewDamageSchema = zod_1.z.object({
    body: zod_1.z.object({
        reviewerId: zod_1.z.string().min(1, 'Reviewer ID is required'),
        finalValue: zod_1.z.number().nonnegative('Final compensation value must be positive'),
        reviewNote: zod_1.z.string().nullable().optional(),
    })
});
exports.collectPaymentSchema = zod_1.z.object({
    body: zod_1.z.object({
        paymentMethod: zod_1.z.string().min(1, 'Payment method is required'),
        paymentRef: zod_1.z.string().nullable().optional(),
        collectedBy: zod_1.z.string().min(1, 'Collector ID is required'),
        paymentDueDate: zod_1.z.string().nullable().optional(),
    })
});
exports.markRefusedSchema = zod_1.z.object({
    body: zod_1.z.object({
        refusalReason: zod_1.z.string().min(1, 'Refusal reason is required'),
    })
});
exports.waiveDamageSchema = zod_1.z.object({
    body: zod_1.z.object({
        waivedBy: zod_1.z.string().min(1, 'Waiver authorized by is required'),
        waiverReason: zod_1.z.string().min(1, 'Waiver reason is required'),
    })
});
class LostFoundController {
    // -------------------------------------------------------------
    // Lost & Found Handlers
    // -------------------------------------------------------------
    static getAllLost = async (req, res, next) => {
        try {
            const { status, branchId, dateFrom, dateTo } = req.query;
            const items = await lostfound_service_1.LostFoundService.getLostItems({
                status: status,
                branchId: branchId,
                dateFrom: dateFrom,
                dateTo: dateTo
            });
            const response = { success: true, data: items };
            res.status(200).json(response);
        }
        catch (error) {
            next(error);
        }
    };
    static createLost = async (req, res, next) => {
        try {
            const item = await lostfound_service_1.LostFoundService.createLostItem(req.body);
            const response = { success: true, data: item };
            res.status(201).json(response);
        }
        catch (error) {
            next(error);
        }
    };
    static getLostById = async (req, res, next) => {
        try {
            const { id } = req.params;
            const item = await lostfound_service_1.LostFoundService.getLostItemById(id);
            if (!item) {
                res.status(404).json({ success: false, error: { code: 'NOT_FOUND', message: 'Lost item not found' } });
                return;
            }
            const response = { success: true, data: item };
            res.status(200).json(response);
        }
        catch (error) {
            next(error);
        }
    };
    static contactGuest = async (req, res, next) => {
        try {
            const { id } = req.params;
            const { guestName, guestPhone } = req.body;
            const item = await lostfound_service_1.LostFoundService.updateGuestContact(id, guestName, guestPhone);
            const response = { success: true, data: item };
            res.status(200).json(response);
        }
        catch (error) {
            next(error);
        }
    };
    static claimLost = async (req, res, next) => {
        try {
            const { id } = req.params;
            const item = await lostfound_service_1.LostFoundService.claimItem(id, req.body);
            const response = { success: true, data: item };
            res.status(200).json(response);
        }
        catch (error) {
            next(error);
        }
    };
    static archiveLost = async (req, res, next) => {
        try {
            const { id } = req.params;
            const item = await lostfound_service_1.LostFoundService.archiveItem(id);
            const response = { success: true, data: item };
            res.status(200).json(response);
        }
        catch (error) {
            next(error);
        }
    };
    // -------------------------------------------------------------
    // Damage Report Handlers
    // -------------------------------------------------------------
    static getAllDamage = async (req, res, next) => {
        try {
            const { status, branchId, reservationRef, dateFrom, dateTo } = req.query;
            const reports = await lostfound_service_1.LostFoundService.getDamageReports({
                status: status,
                branchId: branchId,
                reservationRef: reservationRef,
                dateFrom: dateFrom,
                dateTo: dateTo
            });
            const response = { success: true, data: reports };
            res.status(200).json(response);
        }
        catch (error) {
            next(error);
        }
    };
    static createDamage = async (req, res, next) => {
        try {
            const report = await lostfound_service_1.LostFoundService.createDamageReport(req.body);
            const response = { success: true, data: report };
            res.status(201).json(response);
        }
        catch (error) {
            next(error);
        }
    };
    static getDamageById = async (req, res, next) => {
        try {
            const { id } = req.params;
            const report = await lostfound_service_1.LostFoundService.getDamageById(id);
            if (!report) {
                res.status(404).json({ success: false, error: { code: 'NOT_FOUND', message: 'Damage report not found' } });
                return;
            }
            const response = { success: true, data: report };
            res.status(200).json(response);
        }
        catch (error) {
            next(error);
        }
    };
    static reviewDamage = async (req, res, next) => {
        try {
            const { id } = req.params;
            const { reviewerId, finalValue, reviewNote } = req.body;
            const report = await lostfound_service_1.LostFoundService.reviewDamage(id, reviewerId, finalValue, reviewNote);
            const response = { success: true, data: report };
            res.status(200).json(response);
        }
        catch (error) {
            next(error);
        }
    };
    static collectPayment = async (req, res, next) => {
        try {
            const { id } = req.params;
            const report = await lostfound_service_1.LostFoundService.collectPayment(id, req.body);
            const response = { success: true, data: report };
            res.status(200).json(response);
        }
        catch (error) {
            next(error);
        }
    };
    static markRefused = async (req, res, next) => {
        try {
            const { id } = req.params;
            const { refusalReason } = req.body;
            const report = await lostfound_service_1.LostFoundService.markRefused(id, refusalReason);
            const response = { success: true, data: report };
            res.status(200).json(response);
        }
        catch (error) {
            next(error);
        }
    };
    static waiveDamage = async (req, res, next) => {
        try {
            const { id } = req.params;
            const { waivedBy, waiverReason } = req.body;
            const report = await lostfound_service_1.LostFoundService.waiveDamage(id, waivedBy, waiverReason);
            const response = { success: true, data: report };
            res.status(200).json(response);
        }
        catch (error) {
            next(error);
        }
    };
    static getStats = async (req, res, next) => {
        try {
            const { branchId } = req.query;
            const stats = await lostfound_service_1.LostFoundService.getDamageStats(branchId);
            const response = { success: true, data: stats };
            res.status(200).json(response);
        }
        catch (error) {
            next(error);
        }
    };
}
exports.LostFoundController = LostFoundController;
