"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.RequestService = void 0;
const prisma_1 = __importDefault(require("./prisma"));
const types_1 = require("../types");
const error_middleware_1 = require("../middleware/error.middleware");
class RequestService {
    /**
     * Helper to fetch the system procurement approval threshold
     */
    static async getProcurementThreshold() {
        try {
            const settings = await prisma_1.default.systemSettings.findUnique({
                where: { id: 'global' },
            });
            return settings?.procurementApprovalThreshold ?? 5000.0;
        }
        catch {
            return 5000.0;
        }
    }
    /**
     * Determine the appropriate approval status for a request based on cost
     */
    static async determineApprovalStatus(type, cost = 0) {
        if (type !== types_1.RequestType.Procurement) {
            return types_1.ApprovalStatus.Approved; // Maintenance & Warehouse requests don't require cost routing by default
        }
        const threshold = await this.getProcurementThreshold();
        if (cost > threshold) {
            return types_1.ApprovalStatus.Pending_CEO; // Higher cost goes directly to CEO approval
        }
        return types_1.ApprovalStatus.Pending_Finance; // Under or equal to threshold requires Finance approval
    }
    /**
     * Create a new Request
     */
    static async createRequest(input) {
        // 1. Verify reporter exists
        const reporter = await prisma_1.default.user.findUnique({
            where: { id: input.reporterId },
        });
        if (!reporter) {
            throw new error_middleware_1.AppError(404, 'USER_NOT_FOUND', `Reporter user with ID ${input.reporterId} does not exist.`);
        }
        // 2. Verify branch exists
        const branch = await prisma_1.default.branch.findUnique({
            where: { id: input.branchId },
        });
        if (!branch) {
            throw new error_middleware_1.AppError(404, 'BRANCH_NOT_FOUND', `Branch with ID ${input.branchId} does not exist.`);
        }
        // 3. Determine approval status if Procurement
        const approvalStatus = input.approvalStatus !== undefined
            ? input.approvalStatus
            : await this.determineApprovalStatus(input.requestType, input.estimatedCost || 0);
        // 4. Create the request in the database
        return await prisma_1.default.request.create({
            data: {
                requestType: input.requestType,
                status: types_1.RequestStatus.Pending,
                branchId: input.branchId,
                description: input.description,
                reporterId: input.reporterId,
                assignedToId: input.assignedToId || null,
                estimatedCost: input.estimatedCost || null,
                actualCost: input.actualCost || null,
                beforeImageUrl: input.beforeImageUrl || null,
                afterImageUrl: input.afterImageUrl || null,
                invoiceImageUrl: input.invoiceImageUrl || null,
                approvalStatus: approvalStatus,
                rating: input.rating || null,
                rejectionReason: input.rejectionReason || null,
                rejectionCount: input.rejectionCount || 0,
            },
            include: {
                reporter: {
                    select: { id: true, name: true, role: true, phoneNumber: true },
                },
                assignedTo: {
                    select: { id: true, name: true, role: true, phoneNumber: true },
                },
                branch: true,
            },
        });
    }
    /**
     * Get all requests matching the filter criteria
     */
    static async getAllRequests(filters) {
        const whereClause = {};
        if (filters.requestType)
            whereClause.requestType = filters.requestType;
        if (filters.status)
            whereClause.status = filters.status;
        if (filters.approvalStatus)
            whereClause.approvalStatus = filters.approvalStatus;
        if (filters.branchId)
            whereClause.branchId = filters.branchId;
        if (filters.reporterId)
            whereClause.reporterId = filters.reporterId;
        if (filters.assignedToId)
            whereClause.assignedToId = filters.assignedToId;
        return await prisma_1.default.request.findMany({
            where: whereClause,
            include: {
                reporter: {
                    select: { id: true, name: true, role: true, phoneNumber: true },
                },
                assignedTo: {
                    select: { id: true, name: true, role: true, phoneNumber: true },
                },
                branch: {
                    select: { id: true, name: true, location: true },
                },
            },
            orderBy: { createdAt: 'desc' },
        });
    }
    /**
     * Get request details by ID
     */
    static async getRequestById(id) {
        const request = await prisma_1.default.request.findUnique({
            where: { id },
            include: {
                reporter: {
                    select: { id: true, name: true, role: true, phoneNumber: true },
                },
                assignedTo: {
                    select: { id: true, name: true, role: true, phoneNumber: true },
                },
                branch: true,
            },
        });
        if (!request) {
            throw new error_middleware_1.AppError(404, 'REQUEST_NOT_FOUND', `Request with ID ${id} was not found.`);
        }
        return request;
    }
    /**
     * Update request fields
     */
    static async updateRequest(id, input) {
        // Check if request exists
        const request = await this.getRequestById(id);
        const updateData = {};
        if (input.status !== undefined)
            updateData.status = input.status;
        if (input.description !== undefined)
            updateData.description = input.description;
        if (input.beforeImageUrl !== undefined)
            updateData.beforeImageUrl = input.beforeImageUrl;
        if (input.afterImageUrl !== undefined)
            updateData.afterImageUrl = input.afterImageUrl;
        if (input.invoiceImageUrl !== undefined)
            updateData.invoiceImageUrl = input.invoiceImageUrl;
        if (input.approvalStatus !== undefined)
            updateData.approvalStatus = input.approvalStatus;
        if (input.rating !== undefined)
            updateData.rating = input.rating;
        if (input.rejectionReason !== undefined)
            updateData.rejectionReason = input.rejectionReason;
        if (input.rejectionCount !== undefined)
            updateData.rejectionCount = input.rejectionCount;
        if (input.assignedToId !== undefined) {
            if (input.assignedToId === null) {
                updateData.assignedTo = { disconnect: true };
            }
            else {
                // Validate technician/assignee exists
                const user = await prisma_1.default.user.findUnique({ where: { id: input.assignedToId } });
                if (!user) {
                    throw new error_middleware_1.AppError(404, 'USER_NOT_FOUND', `Assigned user with ID ${input.assignedToId} does not exist.`);
                }
                updateData.assignedTo = { connect: { id: input.assignedToId } };
            }
        }
        // Handle costs updates and re-route approval if procurement
        if (input.estimatedCost !== undefined) {
            updateData.estimatedCost = input.estimatedCost;
            if (request.requestType === types_1.RequestType.Procurement && input.approvalStatus === undefined) {
                // Recalculate approval routing if cost changed
                updateData.approvalStatus = await this.determineApprovalStatus(request.requestType, input.estimatedCost);
            }
        }
        if (input.actualCost !== undefined) {
            updateData.actualCost = input.actualCost;
        }
        return await prisma_1.default.request.update({
            where: { id },
            data: updateData,
            include: {
                reporter: {
                    select: { id: true, name: true, role: true, phoneNumber: true },
                },
                assignedTo: {
                    select: { id: true, name: true, role: true, phoneNumber: true },
                },
                branch: true,
            },
        });
    }
    /**
     * Delete request
     */
    static async deleteRequest(id) {
        await this.getRequestById(id);
        return await prisma_1.default.request.delete({
            where: { id },
        });
    }
}
exports.RequestService = RequestService;
