"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.AttendanceController = exports.attendanceRecordSchema = void 0;
const zod_1 = require("zod");
const geo_service_1 = require("../services/geo.service");
exports.attendanceRecordSchema = zod_1.z.object({
    body: zod_1.z.object({
        userId: zod_1.z.string().min(1, 'User ID is required'),
        lat: zod_1.z.number({ required_error: 'Latitude is required' }),
        lng: zod_1.z.number({ required_error: 'Longitude is required' }),
    })
});
class AttendanceController {
    static checkIn = async (req, res, next) => {
        try {
            const { userId, lat, lng } = req.body;
            const result = await geo_service_1.GeoService.recordAttendance(userId, 'CheckIn', lat, lng);
            if (!result.isValid) {
                res.status(400).json({
                    success: false,
                    message: '❌ لم يتم تسجيل البصمة: أنت خارج النطاق الجغرافي للفرع. تواصل مع الإدارة.',
                    error: {
                        code: 'OUT_OF_GEOFENCE',
                        message: '❌ لم يتم تسجيل البصمة: أنت خارج النطاق الجغرافي للفرع. تواصل مع الإدارة.'
                    },
                    data: result
                });
                return;
            }
            const response = {
                success: true,
                data: result
            };
            res.status(201).json(response);
        }
        catch (error) {
            next(error);
        }
    };
    static checkOut = async (req, res, next) => {
        try {
            const { userId, lat, lng } = req.body;
            const result = await geo_service_1.GeoService.recordAttendance(userId, 'CheckOut', lat, lng);
            if (!result.isValid) {
                res.status(400).json({
                    success: false,
                    message: '❌ لم يتم تسجيل البصمة: أنت خارج النطاق الجغرافي للفرع. تواصل مع الإدارة.',
                    error: {
                        code: 'OUT_OF_GEOFENCE',
                        message: '❌ لم يتم تسجيل البصمة: أنت خارج النطاق الجغرافي للفرع. تواصل مع الإدارة.'
                    },
                    data: result
                });
                return;
            }
            const response = {
                success: true,
                data: result
            };
            res.status(201).json(response);
        }
        catch (error) {
            next(error);
        }
    };
    static getToday = async (req, res, next) => {
        try {
            const { branchId } = req.query;
            const logs = await geo_service_1.GeoService.getTodayAttendance(branchId);
            const response = {
                success: true,
                data: logs
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
            const logs = await geo_service_1.GeoService.getEmployeeAttendanceHistory(userId);
            const response = {
                success: true,
                data: logs
            };
            res.status(200).json(response);
        }
        catch (error) {
            next(error);
        }
    };
    static getSummary = async (req, res, next) => {
        try {
            const summary = await geo_service_1.GeoService.getAttendanceSummary();
            const response = {
                success: true,
                data: summary
            };
            res.status(200).json(response);
        }
        catch (error) {
            next(error);
        }
    };
    static getGrid = async (req, res, next) => {
        try {
            const { branchId, date } = req.query;
            const records = await geo_service_1.GeoService.getAttendanceGrid(branchId, date);
            const response = {
                success: true,
                data: records
            };
            res.status(200).json(response);
        }
        catch (error) {
            next(error);
        }
    };
    static getLogs = async (req, res, next) => {
        try {
            const { branchId, startDate, endDate, isValid, userId } = req.query;
            const parsedIsValid = isValid !== undefined ? isValid === 'true' : undefined;
            const logs = await geo_service_1.GeoService.getAllAttendanceLogs({
                branchId: branchId,
                startDate: startDate,
                endDate: endDate,
                isValid: parsedIsValid,
                userId: userId
            });
            const response = {
                success: true,
                data: logs
            };
            res.status(200).json(response);
        }
        catch (error) {
            next(error);
        }
    };
}
exports.AttendanceController = AttendanceController;
