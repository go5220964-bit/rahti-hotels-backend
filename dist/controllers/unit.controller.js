"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.UnitController = void 0;
const unit_service_1 = require("../services/unit.service");
class UnitController {
    static async getAllUnits(req, res) {
        try {
            const { branchId, status, floor, search } = req.query;
            const units = await unit_service_1.UnitService.getAllUnits({
                branchId: branchId,
                status: status,
                floor: floor ? Number(floor) : undefined,
                search: search
            });
            res.json(units);
        }
        catch (error) {
            res.status(500).json({ error: error.message || 'حدث خطأ أثناء جلب الوحدات' });
        }
    }
    static async getUnitById(req, res) {
        try {
            const { id } = req.params;
            const unit = await unit_service_1.UnitService.getUnitById(id);
            res.json(unit);
        }
        catch (error) {
            res.status(404).json({ error: error.message || 'الوحدة غير موجودة' });
        }
    }
    static async getUnitHealthCard(req, res) {
        try {
            const { id } = req.params;
            const healthCard = await unit_service_1.UnitService.getUnitHealthCard(id);
            res.json(healthCard);
        }
        catch (error) {
            res.status(404).json({ error: error.message || 'فشل جلب الملف الصحي للشقة' });
        }
    }
    static async updateUnitStatus(req, res) {
        try {
            const { id } = req.params;
            const updated = await unit_service_1.UnitService.updateUnitStatus(id, req.body);
            res.json(updated);
        }
        catch (error) {
            res.status(400).json({ error: error.message || 'فشل تحديث حالة الوحدة' });
        }
    }
    static async createUnit(req, res) {
        try {
            const unit = await unit_service_1.UnitService.createUnit(req.body);
            res.status(201).json(unit);
        }
        catch (error) {
            res.status(400).json({ error: error.message || 'فشل إضافة الوحدة' });
        }
    }
    static async updateUnit(req, res) {
        try {
            const { id } = req.params;
            const unit = await unit_service_1.UnitService.updateUnit(id, req.body);
            res.json(unit);
        }
        catch (error) {
            res.status(400).json({ error: error.message || 'فشل تعديل الوحدة' });
        }
    }
    static async deleteUnit(req, res) {
        try {
            const { id } = req.params;
            await unit_service_1.UnitService.deleteUnit(id);
            res.json({ message: 'تم حذف الوحدة بنجاح' });
        }
        catch (error) {
            res.status(400).json({ error: error.message || 'فشل حذف الوحدة' });
        }
    }
    static async createAsset(req, res) {
        try {
            const asset = await unit_service_1.UnitService.createAsset(req.body);
            res.status(201).json(asset);
        }
        catch (error) {
            res.status(400).json({ error: error.message || 'فشل إضافة الأصل للشقة' });
        }
    }
    static async updateAsset(req, res) {
        try {
            const { id } = req.params;
            const asset = await unit_service_1.UnitService.updateAsset(id, req.body);
            res.json(asset);
        }
        catch (error) {
            res.status(400).json({ error: error.message || 'فشل تعديل الأصل' });
        }
    }
    static async deleteAsset(req, res) {
        try {
            const { id } = req.params;
            await unit_service_1.UnitService.deleteAsset(id);
            res.json({ message: 'تم حذف الأصل بنجاح' });
        }
        catch (error) {
            res.status(400).json({ error: error.message || 'فشل حذف الأصل' });
        }
    }
    static async seedBranchUnits(req, res) {
        try {
            const { branchId } = req.body;
            if (!branchId) {
                return res.status(400).json({ error: 'branchId مطلوب' });
            }
            const result = await unit_service_1.UnitService.seedBranchUnits(branchId);
            res.json(result);
        }
        catch (error) {
            res.status(500).json({ error: error.message || 'فشل توليد الشقق الافتراضية' });
        }
    }
}
exports.UnitController = UnitController;
