"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ReceptionScheduleController = void 0;
const reception_schedule_service_1 = require("../services/reception-schedule.service");
class ReceptionScheduleController {
    static getSchedule = async (req, res, next) => {
        try {
            const { branchId, startDate, endDate } = req.query;
            const data = await reception_schedule_service_1.ReceptionScheduleService.getSchedule(branchId, startDate, endDate);
            const response = {
                success: true,
                data,
            };
            res.status(200).json(response);
        }
        catch (error) {
            next(error);
        }
    };
    static getReceptionists = async (req, res, next) => {
        try {
            const { branchId } = req.query;
            const data = await reception_schedule_service_1.ReceptionScheduleService.getReceptionists(branchId);
            const response = {
                success: true,
                data,
            };
            res.status(200).json(response);
        }
        catch (error) {
            next(error);
        }
    };
    static upsertSlot = async (req, res, next) => {
        try {
            const slot = await reception_schedule_service_1.ReceptionScheduleService.upsertSchedule(req.body);
            const response = {
                success: true,
                data: slot,
            };
            res.status(200).json(response);
        }
        catch (error) {
            next(error);
        }
    };
    static autoGenerate = async (req, res, next) => {
        try {
            const { branchId, startDate } = req.body;
            const result = await reception_schedule_service_1.ReceptionScheduleService.autoGenerateWeeklyRoster(branchId, startDate);
            const response = {
                success: true,
                data: result,
            };
            res.status(200).json(response);
        }
        catch (error) {
            next(error);
        }
    };
    static assignCoverage = async (req, res, next) => {
        try {
            const result = await reception_schedule_service_1.ReceptionScheduleService.assignCoverage(req.body);
            const response = {
                success: true,
                data: result,
            };
            res.status(200).json(response);
        }
        catch (error) {
            next(error);
        }
    };
    static getMySchedule = async (req, res, next) => {
        try {
            const { userId } = req.params;
            const data = await reception_schedule_service_1.ReceptionScheduleService.getEmployeeSchedule(userId);
            const response = {
                success: true,
                data,
            };
            res.status(200).json(response);
        }
        catch (error) {
            next(error);
        }
    };
}
exports.ReceptionScheduleController = ReceptionScheduleController;
