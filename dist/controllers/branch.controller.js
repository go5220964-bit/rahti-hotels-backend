"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.BranchController = exports.updateBranchSchema = exports.createBranchSchema = void 0;
const zod_1 = require("zod");
const branch_service_1 = require("../services/branch.service");
exports.createBranchSchema = zod_1.z.object({
    body: zod_1.z.object({
        name: zod_1.z.string().min(1, 'Branch name is required'),
        location: zod_1.z.string().optional(),
        lat: zod_1.z.number().nullable().optional(),
        lng: zod_1.z.number().nullable().optional(),
        radiusMeters: zod_1.z.number().int().positive().optional()
    })
});
exports.updateBranchSchema = zod_1.z.object({
    body: zod_1.z.object({
        name: zod_1.z.string().min(1).optional(),
        location: zod_1.z.string().optional(),
        lat: zod_1.z.number().nullable().optional(),
        lng: zod_1.z.number().nullable().optional(),
        radiusMeters: zod_1.z.number().int().positive().optional()
    })
});
class BranchController {
    static getAll = async (req, res, next) => {
        try {
            const branches = await branch_service_1.BranchService.getAll();
            const response = {
                success: true,
                data: branches
            };
            res.status(200).json(response);
        }
        catch (error) {
            next(error);
        }
    };
    static create = async (req, res, next) => {
        try {
            const newBranch = await branch_service_1.BranchService.createBranch(req.body);
            const response = {
                success: true,
                data: newBranch
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
            const updatedBranch = await branch_service_1.BranchService.updateBranch(id, req.body);
            const response = {
                success: true,
                data: updatedBranch
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
            await branch_service_1.BranchService.deleteBranch(id);
            const response = {
                success: true,
                data: { id, message: 'Branch successfully deleted' }
            };
            res.status(200).json(response);
        }
        catch (error) {
            next(error);
        }
    };
}
exports.BranchController = BranchController;
