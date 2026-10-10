"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.RequestController = exports.getRequestsQuerySchema = exports.updateRequestSchema = exports.createRequestSchema = void 0;
const zod_1 = require("zod");
const request_service_1 = require("../services/request.service");
const types_1 = require("../types");
// Zod schemas for input validation
exports.createRequestSchema = zod_1.z.object({
    body: zod_1.z.object({
        requestType: zod_1.z.nativeEnum(types_1.RequestType),
        branchId: zod_1.z.string().min(1, 'Branch ID is required'),
        description: zod_1.z.string().min(3, 'Description must be at least 3 characters long'),
        reporterId: zod_1.z.string().min(1, 'Reporter ID is required'),
        assignedToId: zod_1.z.string().optional(),
        estimatedCost: zod_1.z.number().nonnegative().optional(),
        actualCost: zod_1.z.number().nonnegative().optional(),
        beforeImageUrl: zod_1.z.string().url('Invalid before image URL').optional().or(zod_1.z.literal('')),
        afterImageUrl: zod_1.z.string().url('Invalid after image URL').optional().or(zod_1.z.literal('')),
        invoiceImageUrl: zod_1.z.string().url('Invalid invoice image URL').optional().or(zod_1.z.literal('')),
        rejectionReason: zod_1.z.string().optional(),
        rejectionCount: zod_1.z.number().int().nonnegative().optional(),
        rating: zod_1.z.number().int().min(1).max(5).optional(),
    }),
});
exports.updateRequestSchema = zod_1.z.object({
    body: zod_1.z.object({
        status: zod_1.z.nativeEnum(types_1.RequestStatus).optional(),
        assignedToId: zod_1.z.string().nullable().optional(),
        estimatedCost: zod_1.z.number().nonnegative().optional(),
        actualCost: zod_1.z.number().nonnegative().optional(),
        beforeImageUrl: zod_1.z.string().url('Invalid before image URL').optional().or(zod_1.z.literal('')),
        afterImageUrl: zod_1.z.string().url('Invalid after image URL').optional().or(zod_1.z.literal('')),
        invoiceImageUrl: zod_1.z.string().url('Invalid invoice image URL').optional().or(zod_1.z.literal('')),
        approvalStatus: zod_1.z.nativeEnum(types_1.ApprovalStatus).optional(),
        description: zod_1.z.string().min(3).optional(),
        rejectionReason: zod_1.z.string().nullable().optional(),
        rejectionCount: zod_1.z.number().int().nonnegative().optional(),
        rating: zod_1.z.number().int().min(1).max(5).nullable().optional(),
    }),
});
exports.getRequestsQuerySchema = zod_1.z.object({
    query: zod_1.z.object({
        requestType: zod_1.z.nativeEnum(types_1.RequestType).optional(),
        status: zod_1.z.nativeEnum(types_1.RequestStatus).optional(),
        approvalStatus: zod_1.z.nativeEnum(types_1.ApprovalStatus).optional(),
        branchId: zod_1.z.string().optional(),
        reporterId: zod_1.z.string().optional(),
        assignedToId: zod_1.z.string().optional(),
    }),
});
class RequestController {
    /**
     * POST /api/requests
     */
    static create = async (req, res, next) => {
        try {
            const newRequest = await request_service_1.RequestService.createRequest(req.body);
            const response = {
                success: true,
                data: newRequest,
            };
            res.status(201).json(response);
        }
        catch (error) {
            next(error);
        }
    };
    /**
     * GET /api/requests
     */
    static getAll = async (req, res, next) => {
        try {
            const requests = await request_service_1.RequestService.getAllRequests(req.query);
            const response = {
                success: true,
                data: requests,
            };
            res.status(200).json(response);
        }
        catch (error) {
            next(error);
        }
    };
    /**
     * GET /api/requests/:id
     */
    static getById = async (req, res, next) => {
        try {
            const { id } = req.params;
            const request = await request_service_1.RequestService.getRequestById(id);
            const response = {
                success: true,
                data: request,
            };
            res.status(200).json(response);
        }
        catch (error) {
            next(error);
        }
    };
    /**
     * PATCH /api/requests/:id
     */
    static update = async (req, res, next) => {
        try {
            const { id } = req.params;
            const updatedRequest = await request_service_1.RequestService.updateRequest(id, req.body);
            const response = {
                success: true,
                data: updatedRequest,
            };
            res.status(200).json(response);
        }
        catch (error) {
            next(error);
        }
    };
    /**
     * DELETE /api/requests/:id
     */
    static delete = async (req, res, next) => {
        try {
            const { id } = req.params;
            await request_service_1.RequestService.deleteRequest(id);
            const response = {
                success: true,
                data: { id, message: 'Request successfully deleted' },
            };
            res.status(200).json(response);
        }
        catch (error) {
            next(error);
        }
    };
}
exports.RequestController = RequestController;
