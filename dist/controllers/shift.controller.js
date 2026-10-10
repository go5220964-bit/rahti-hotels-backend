"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ShiftController = exports.updateShiftSchema = exports.createShiftSchema = void 0;
const zod_1 = require("zod");
const shift_service_1 = require("../services/shift.service");
exports.createShiftSchema = zod_1.z.object({
    body: zod_1.z.object({
        name: zod_1.z.string().min(1, 'Shift name is required'),
        startTime: zod_1.z.string(),
        endTime: zod_1.z.string(),
        branchId: zod_1.z.string().nullable().optional(),
        isOpen: zod_1.z.boolean().optional(),
    })
});
exports.updateShiftSchema = zod_1.z.object({
    body: zod_1.z.object({
        name: zod_1.z.string().min(1).optional(),
        startTime: zod_1.z.string().optional(),
        endTime: zod_1.z.string().optional(),
        branchId: zod_1.z.string().nullable().optional(),
        isOpen: zod_1.z.boolean().optional(),
        isActive: zod_1.z.boolean().optional(),
    })
});
class ShiftController {
    static create = async (req, res, next) => {
        try {
            const newShift = await shift_service_1.ShiftService.createShift(req.body);
            const response = {
                success: true,
                data: newShift
            };
            res.status(201).json(response);
        }
        catch (error) {
            next(error);
        }
    };
    static getAll = async (req, res, next) => {
        try {
            const { branchId } = req.query;
            const shifts = await shift_service_1.ShiftService.getAllShifts(branchId);
            const response = {
                success: true,
                data: shifts
            };
            res.status(200).json(response);
        }
        catch (error) {
            next(error);
        }
    };
    static getByBranch = async (req, res, next) => {
        try {
            const { branchId } = req.params;
            const shifts = await shift_service_1.ShiftService.getShiftsForBranch(branchId);
            const response = {
                success: true,
                data: shifts
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
            const updatedShift = await shift_service_1.ShiftService.updateShift(id, req.body);
            const response = {
                success: true,
                data: updatedShift
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
            await shift_service_1.ShiftService.deleteShift(id);
            const response = {
                success: true,
                data: { id, message: 'Shift successfully deleted (soft-delete)' }
            };
            res.status(200).json(response);
        }
        catch (error) {
            next(error);
        }
    };
}
exports.ShiftController = ShiftController;
