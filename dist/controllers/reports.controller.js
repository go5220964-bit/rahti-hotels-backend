"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ReportsController = void 0;
const reports_service_1 = require("../services/reports.service");
class ReportsController {
    static getDailyFinancial = async (req, res, next) => {
        try {
            const { branchId, date } = req.query;
            const data = await reports_service_1.ReportsService.getDailyFinancialSummary(branchId || undefined, date || undefined);
            const response = { success: true, data };
            res.status(200).json(response);
        }
        catch (error) {
            next(error);
        }
    };
    static getPeriodFinancial = async (req, res, next) => {
        try {
            const { branchId, from, to } = req.query;
            const data = await reports_service_1.ReportsService.getPeriodFinancialSummary(branchId || undefined, from, to);
            const response = { success: true, data };
            res.status(200).json(response);
        }
        catch (error) {
            next(error);
        }
    };
    static getMonthlyFinancial = async (req, res, next) => {
        try {
            const { branchId, year, month } = req.query;
            const data = await reports_service_1.ReportsService.getMonthlyFinancialSummary(branchId || undefined, year ? parseInt(year) : undefined, month ? parseInt(month) : undefined);
            const response = { success: true, data };
            res.status(200).json(response);
        }
        catch (error) {
            next(error);
        }
    };
    static getAttendance = async (req, res, next) => {
        try {
            const { branchId, from, to } = req.query;
            const data = await reports_service_1.ReportsService.getAttendanceSummary(branchId || undefined, from, to);
            const response = { success: true, data };
            res.status(200).json(response);
        }
        catch (error) {
            next(error);
        }
    };
    static getLeaves = async (req, res, next) => {
        try {
            const { branchId, from, to } = req.query;
            const data = await reports_service_1.ReportsService.getLeaveReport(branchId || undefined, from, to);
            const response = { success: true, data };
            res.status(200).json(response);
        }
        catch (error) {
            next(error);
        }
    };
    static getLoans = async (req, res, next) => {
        try {
            const { branchId } = req.query;
            const data = await reports_service_1.ReportsService.getLoanReport(branchId || undefined);
            const response = { success: true, data };
            res.status(200).json(response);
        }
        catch (error) {
            next(error);
        }
    };
    static getMaintenance = async (req, res, next) => {
        try {
            const { branchId, from, to } = req.query;
            const data = await reports_service_1.ReportsService.getMaintenanceReport(branchId || undefined, from, to);
            const response = { success: true, data };
            res.status(200).json(response);
        }
        catch (error) {
            next(error);
        }
    };
    static getInventory = async (req, res, next) => {
        try {
            const { branchId } = req.query;
            const data = await reports_service_1.ReportsService.getInventoryReport(branchId || undefined);
            const response = { success: true, data };
            res.status(200).json(response);
        }
        catch (error) {
            next(error);
        }
    };
    static getProcurement = async (req, res, next) => {
        try {
            const { branchId, from, to } = req.query;
            const data = await reports_service_1.ReportsService.getProcurementReport(branchId || undefined, from, to);
            const response = { success: true, data };
            res.status(200).json(response);
        }
        catch (error) {
            next(error);
        }
    };
    static getDamage = async (req, res, next) => {
        try {
            const { branchId, from, to } = req.query;
            const data = await reports_service_1.ReportsService.getDamageReport(branchId || undefined, from, to);
            const response = { success: true, data };
            res.status(200).json(response);
        }
        catch (error) {
            next(error);
        }
    };
    static getLostFound = async (req, res, next) => {
        try {
            const { branchId, from, to } = req.query;
            const data = await reports_service_1.ReportsService.getLostFoundReport(branchId || undefined, from, to);
            const response = { success: true, data };
            res.status(200).json(response);
        }
        catch (error) {
            next(error);
        }
    };
    static getExecutive = async (req, res, next) => {
        try {
            const { from, to } = req.query;
            const data = await reports_service_1.ReportsService.getExecutiveSummary(from, to);
            const response = { success: true, data };
            res.status(200).json(response);
        }
        catch (error) {
            next(error);
        }
    };
    static triggerDigest = async (req, res, next) => {
        try {
            const { branchId } = req.body;
            const { DigestService } = require('../services/digest.service');
            if (branchId) {
                await DigestService.sendDailyDigestForBranch(branchId);
            }
            else {
                await DigestService.sendDailyDigestToAllBranches();
            }
            res.status(200).json({ success: true, message: 'Daily digest triggered successfully' });
        }
        catch (error) {
            next(error);
        }
    };
}
exports.ReportsController = ReportsController;
const express_1 = require("express");
const router = (0, express_1.Router)();
router.get('/financial/daily', ReportsController.getDailyFinancial);
router.get('/financial/period', ReportsController.getPeriodFinancial);
router.get('/financial/monthly', ReportsController.getMonthlyFinancial);
router.get('/attendance', ReportsController.getAttendance);
router.get('/leave', ReportsController.getLeaves);
router.get('/loans', ReportsController.getLoans);
router.get('/maintenance', ReportsController.getMaintenance);
router.get('/inventory', ReportsController.getInventory);
router.get('/procurement', ReportsController.getProcurement);
router.get('/damage', ReportsController.getDamage);
router.get('/lostfound', ReportsController.getLostFound);
router.get('/executive', ReportsController.getExecutive);
router.post('/digest', ReportsController.triggerDigest);
exports.default = router;
