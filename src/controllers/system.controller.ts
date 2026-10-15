import { Request, Response, NextFunction } from 'express';
import prisma from '../services/prisma';

const DEFAULT_SYSTEM_SETTINGS: Record<string, string> = {
  whatsappBotEnabled: 'true',
  whatsappWebhookUrl: '',
  twilioAccountSid: '',
  twilioAuthToken: '',
  twilioPhoneNumber: '',
  geminiApiKey: '',
  geminiModel: 'gemini-2.5-flash',
  geofenceEnabled: 'true',
  geofenceLatitude: '21.34153721641272',
  geofenceLongitude: '40.43970895038688',
  geofenceRadiusMeters: '200',
  currencyCode: 'SAR',
  currencySymbol: 'ر.س',
  defaultBranchName: 'راحتي للشقق المخدومة'
};

export class SystemController {
  public static getSettings = async (req: Request, res: Response, next: NextFunction) => {
    try {
      let settingsList: Array<{ key: string; value: string }> = [];
      try {
        settingsList = await prisma.systemSetting.findMany();
      } catch {
        settingsList = [];
      }

      const mergedSettings: Record<string, string> = { ...DEFAULT_SYSTEM_SETTINGS };
      for (const item of settingsList) {
        if (item && item.key) {
          mergedSettings[item.key] = item.value;
        }
      }

      res.status(200).json({
        success: true,
        data: mergedSettings,
        integrations: {
          whatsapp: {
            enabled: mergedSettings.whatsappBotEnabled === 'true',
            webhookUrl: mergedSettings.whatsappWebhookUrl,
            phoneNumber: mergedSettings.twilioPhoneNumber
          },
          gemini: {
            configured: Boolean(mergedSettings.geminiApiKey),
            model: mergedSettings.geminiModel
          },
          geofence: {
            enabled: mergedSettings.geofenceEnabled === 'true',
            latitude: parseFloat(mergedSettings.geofenceLatitude),
            longitude: parseFloat(mergedSettings.geofenceLongitude),
            radiusMeters: parseInt(mergedSettings.geofenceRadiusMeters, 10)
          }
        }
      });
    } catch (error) {
      next(error);
    }
  };

  public static updateSettings = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const rawPayload = req.body?.settings || req.body || {};
      const entries = Object.entries(rawPayload).filter(
        ([key, val]) => key && typeof val !== 'object' && val !== undefined
      );

      for (const [key, value] of entries) {
        await prisma.systemSetting.upsert({
          where: { key },
          update: { value: String(value ?? '') },
          create: { key, value: String(value ?? '') }
        });
      }

      res.status(200).json({
        success: true,
        message: 'تم حفظ وتحديث إعدادات الربط والنظام بنجاح'
      });
    } catch (error) {
      next(error);
    }
  };
}
