import { Request, Response } from 'express';
import { UnitService } from '../services/unit.service';

export class UnitController {
  public static async getAllUnits(req: Request, res: Response) {
    try {
      const { branchId, status, floor, search } = req.query;
      const units = await UnitService.getAllUnits({
        branchId: branchId as string,
        status: status as string,
        floor: floor ? Number(floor) : undefined,
        search: search as string
      });
      res.json(units);
    } catch (error: any) {
      res.status(500).json({ error: error.message || 'حدث خطأ أثناء جلب الوحدات' });
    }
  }

  public static async getUnitById(req: Request, res: Response) {
    try {
      const { id } = req.params;
      const unit = await UnitService.getUnitById(id);
      res.json(unit);
    } catch (error: any) {
      res.status(404).json({ error: error.message || 'الوحدة غير موجودة' });
    }
  }

  public static async getUnitHealthCard(req: Request, res: Response) {
    try {
      const { id } = req.params;
      const healthCard = await UnitService.getUnitHealthCard(id);
      res.json(healthCard);
    } catch (error: any) {
      res.status(404).json({ error: error.message || 'فشل جلب الملف الصحي للشقة' });
    }
  }

  public static async updateUnitStatus(req: Request, res: Response) {
    try {
      const { id } = req.params;
      const updated = await UnitService.updateUnitStatus(id, req.body);
      res.json(updated);
    } catch (error: any) {
      res.status(400).json({ error: error.message || 'فشل تحديث حالة الوحدة' });
    }
  }

  public static async createUnit(req: Request, res: Response) {
    try {
      const unit = await UnitService.createUnit(req.body);
      res.status(201).json(unit);
    } catch (error: any) {
      res.status(400).json({ error: error.message || 'فشل إضافة الوحدة' });
    }
  }

  public static async updateUnit(req: Request, res: Response) {
    try {
      const { id } = req.params;
      const unit = await UnitService.updateUnit(id, req.body);
      res.json(unit);
    } catch (error: any) {
      res.status(400).json({ error: error.message || 'فشل تعديل الوحدة' });
    }
  }

  public static async deleteUnit(req: Request, res: Response) {
    try {
      const { id } = req.params;
      await UnitService.deleteUnit(id);
      res.json({ message: 'تم حذف الوحدة بنجاح' });
    } catch (error: any) {
      res.status(400).json({ error: error.message || 'فشل حذف الوحدة' });
    }
  }

  public static async createAsset(req: Request, res: Response) {
    try {
      const asset = await UnitService.createAsset(req.body);
      res.status(201).json(asset);
    } catch (error: any) {
      res.status(400).json({ error: error.message || 'فشل إضافة الأصل للشقة' });
    }
  }

  public static async updateAsset(req: Request, res: Response) {
    try {
      const { id } = req.params;
      const asset = await UnitService.updateAsset(id, req.body);
      res.json(asset);
    } catch (error: any) {
      res.status(400).json({ error: error.message || 'فشل تعديل الأصل' });
    }
  }

  public static async deleteAsset(req: Request, res: Response) {
    try {
      const { id } = req.params;
      await UnitService.deleteAsset(id);
      res.json({ message: 'تم حذف الأصل بنجاح' });
    } catch (error: any) {
      res.status(400).json({ error: error.message || 'فشل حذف الأصل' });
    }
  }

  public static async seedBranchUnits(req: Request, res: Response) {
    try {
      const { branchId } = req.body;
      if (!branchId) {
        return res.status(400).json({ error: 'branchId مطلوب' });
      }
      const result = await UnitService.seedBranchUnits(branchId);
      res.json(result);
    } catch (error: any) {
      res.status(500).json({ error: error.message || 'فشل توليد الشقق الافتراضية' });
    }
  }
}
