import prisma from './prisma';
import { Prisma } from '@prisma/client';
import { RequestType, RequestStatus, ApprovalStatus } from '../types';
import { AppError } from '../middleware/error.middleware';

export interface CreateRequestInput {
  requestType: RequestType;
  branchId: String;
  description: string;
  reporterId: string;
  assignedToId?: string;
  estimatedCost?: number;
  actualCost?: number;
  beforeImageUrl?: string;
  afterImageUrl?: string;
  invoiceImageUrl?: string;
  rating?: number;
  rejectionReason?: string;
  rejectionCount?: number;
  approvalStatus?: ApprovalStatus;
}

export interface UpdateRequestInput {
  status?: RequestStatus;
  assignedToId?: string;
  estimatedCost?: number;
  actualCost?: number;
  beforeImageUrl?: string;
  afterImageUrl?: string;
  invoiceImageUrl?: string;
  approvalStatus?: ApprovalStatus;
  description?: string;
  rating?: number;
  rejectionReason?: string;
  rejectionCount?: number;
}

export interface RequestFilters {
  requestType?: RequestType;
  status?: RequestStatus;
  approvalStatus?: ApprovalStatus;
  branchId?: string;
  reporterId?: string;
  assignedToId?: string;
}

export class RequestService {
  /**
   * Helper to fetch the system procurement approval threshold
   */
  private static async getProcurementThreshold(): Promise<number> {
    try {
      const settings = await prisma.systemSettings.findUnique({
        where: { id: 'global' },
      });
      return settings?.procurementApprovalThreshold ?? 5000.0;
    } catch {
      return 5000.0;
    }
  }

  /**
   * Determine the appropriate approval status for a request based on cost
   */
  private static async determineApprovalStatus(
    type: RequestType,
    cost: number = 0
  ): Promise<ApprovalStatus> {
    if (type !== RequestType.Procurement) {
      return ApprovalStatus.Approved; // Maintenance & Warehouse requests don't require cost routing by default
    }

    const threshold = await this.getProcurementThreshold();
    if (cost > threshold) {
      return ApprovalStatus.Pending_CEO; // Higher cost goes directly to CEO approval
    }
    return ApprovalStatus.Pending_Finance; // Under or equal to threshold requires Finance approval
  }

  /**
   * Create a new Request
   */
  public static async createRequest(input: CreateRequestInput) {
    // 1. Verify reporter exists
    const reporter = await prisma.user.findUnique({
      where: { id: input.reporterId },
    });
    if (!reporter) {
      throw new AppError(404, 'USER_NOT_FOUND', `Reporter user with ID ${input.reporterId} does not exist.`);
    }

    // 2. Verify branch exists
    const branch = await prisma.branch.findUnique({
      where: { id: input.branchId as string },
    });
    if (!branch) {
      throw new AppError(404, 'BRANCH_NOT_FOUND', `Branch with ID ${input.branchId} does not exist.`);
    }

    // 3. Determine approval status if Procurement
    const approvalStatus = input.approvalStatus !== undefined
      ? input.approvalStatus
      : await this.determineApprovalStatus(
          input.requestType,
          input.estimatedCost || 0
        );

    // 4. Create the request in the database
    return await prisma.request.create({
      data: {
        requestType: input.requestType,
        status: RequestStatus.Pending,
        branchId: input.branchId as string,
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
  public static async getAllRequests(filters: RequestFilters) {
    const whereClause: Prisma.RequestWhereInput = {};

    if (filters.requestType) whereClause.requestType = filters.requestType;
    if (filters.status) whereClause.status = filters.status;
    if (filters.approvalStatus) whereClause.approvalStatus = filters.approvalStatus;
    if (filters.branchId) whereClause.branchId = filters.branchId;
    if (filters.reporterId) whereClause.reporterId = filters.reporterId;
    if (filters.assignedToId) whereClause.assignedToId = filters.assignedToId;

    return await prisma.request.findMany({
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
  public static async getRequestById(id: string) {
    const request = await prisma.request.findUnique({
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
      throw new AppError(404, 'REQUEST_NOT_FOUND', `Request with ID ${id} was not found.`);
    }

    return request;
  }

  /**
   * Update request fields
   */
  public static async updateRequest(id: string, input: UpdateRequestInput) {
    // Check if request exists
    const request = await this.getRequestById(id);

    const updateData: Prisma.RequestUpdateInput = {};

    if (input.status !== undefined) updateData.status = input.status;
    if (input.description !== undefined) updateData.description = input.description;
    if (input.beforeImageUrl !== undefined) updateData.beforeImageUrl = input.beforeImageUrl;
    if (input.afterImageUrl !== undefined) updateData.afterImageUrl = input.afterImageUrl;
    if (input.invoiceImageUrl !== undefined) updateData.invoiceImageUrl = input.invoiceImageUrl;
    if (input.approvalStatus !== undefined) updateData.approvalStatus = input.approvalStatus;
    if (input.rating !== undefined) updateData.rating = input.rating;
    if (input.rejectionReason !== undefined) updateData.rejectionReason = input.rejectionReason;
    if (input.rejectionCount !== undefined) updateData.rejectionCount = input.rejectionCount;

    if (input.assignedToId !== undefined) {
      if (input.assignedToId === null) {
        updateData.assignedTo = { disconnect: true };
      } else {
        // Validate technician/assignee exists
        const user = await prisma.user.findUnique({ where: { id: input.assignedToId } });
        if (!user) {
          throw new AppError(404, 'USER_NOT_FOUND', `Assigned user with ID ${input.assignedToId} does not exist.`);
        }
        updateData.assignedTo = { connect: { id: input.assignedToId } };
      }
    }

    // Handle costs updates and re-route approval if procurement
    if (input.estimatedCost !== undefined) {
      updateData.estimatedCost = input.estimatedCost;
      if (request.requestType === RequestType.Procurement && input.approvalStatus === undefined) {
        // Recalculate approval routing if cost changed
        updateData.approvalStatus = await this.determineApprovalStatus(
          request.requestType as any,
          input.estimatedCost
        );
      }
    }

    if (input.actualCost !== undefined) {
      updateData.actualCost = input.actualCost;
    }

    return await prisma.request.update({
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
  public static async deleteRequest(id: string) {
    await this.getRequestById(id);
    return await prisma.request.delete({
      where: { id },
    });
  }
}
