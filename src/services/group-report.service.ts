import prisma from './prisma';
import axios from 'axios';
import { WhatsAppService } from './whatsapp.service';

export interface MonitoredGroupConfig {
  id: string;
  name: string;
  category: 'reception' | 'housekeeping' | 'maintenance';
  displayName: string;
}

export const MONITORED_GROUPS: Record<string, MonitoredGroupConfig> = {
  // 1. الاستقبال
  '120363404864363274@g.us': {
    id: '120363404864363274@g.us',
    name: 'استقبال فندق راحتي',
    category: 'reception',
    displayName: '🏨 قسم الاستقبال'
  },
  '120363402076413422@g.us': {
    id: '120363402076413422@g.us',
    name: 'مدراء و إستقبال فروع مجموعه فنادق راحتي',
    category: 'reception',
    displayName: '🏨 قسم الاستقبال والإدارة'
  },
  '120363402365049981@g.us': {
    id: '120363402365049981@g.us',
    name: 'مدراء و إستقبال فروع مجموعه فنادق راحتي (2)',
    category: 'reception',
    displayName: '🏨 قسم الاستقبال والإدارة'
  },

  // 2. الهاوسكيبنج
  '120363421459926069@g.us': {
    id: '120363421459926069@g.us',
    name: 'هاوسكيبنج راحتي',
    category: 'housekeeping',
    displayName: '🧹 قسم الهاوسكيبنج والنظافة'
  },

  // 3. الصيانة
  '120363408437888341@g.us': {
    id: '120363408437888341@g.us',
    name: 'صيانة راحتي',
    category: 'maintenance',
    displayName: '🔧 قسم الصيانة والتشغيل'
  }
};

export class GroupReportService {
  public static readonly TARGET_ADMIN_PHONE = process.env.REPORT_TARGET_PHONE || '966563104828';
  private static lastReportDateSent = '';

  /**
   * تسجيل رسالة واردة من أحد قروبات الواتساب المراقبة
   */
  public static async recordIncomingGroupMessage(data: any): Promise<boolean> {
    try {
      if (!data) return false;
      const groupId = (data.from || '').trim();
      if (!groupId.includes('@g.us')) return false;

      // هل القروب ضمن القروبات المراقبة؟
      const groupConfig = MONITORED_GROUPS[groupId];
      if (!groupConfig) {
        // فحص بالاسم في حال تغير الـ ID
        return false;
      }

      // تجاهل الرسائل الصادرة من البوت نفسه
      if (data.fromMe === true || data.fromMe === 'true') {
        return false;
      }

      const body = (data.body || data.caption || '').trim();
      if (!body) {
        // رسالة فارغة أو وسائط بدون تعليق
        return false;
      }

      let senderPhone = (data.author || data.from || '').replace('@c.us', '').replace('@g.us', '').replace('+', '').trim();
      const senderName = data.pushname || data.senderName || 'موظف';
      const messageTime = data.time ? new Date(parseInt(data.time, 10) * 1000) : new Date();

      // فحص عدم التكرار (خلال 30 ثانية لنفس الشخص والنص)
      const recentDuplicate = await prisma.groupMessage.findFirst({
        where: {
          groupId,
          body,
          createdAt: {
            gte: new Date(Date.now() - 30 * 1000)
          }
        }
      });

      if (recentDuplicate) {
        return false;
      }

      await prisma.groupMessage.create({
        data: {
          groupId,
          groupName: groupConfig.name,
          category: groupConfig.category,
          senderPhone,
          senderName,
          body,
          messageTime
        }
      });

      console.log(`📥 [GroupReport] تم حفظ رسالة من قروب [${groupConfig.name}] بواسطة [${senderName}]: ${body.slice(0, 40)}...`);
      return true;
    } catch (err: any) {
      console.error('❌ [GroupReport] خطأ أثناء تسجيل رسالة القروب:', err.message);
      return false;
    }
  }

  /**
   * جلب ومزامنة آخر الرسائل مباشرة من UltraMsg API لكل القروبات المراقبة
   * (لضمان عدم ضياع أي رسالة حتى لو كان السيرفر في وضع السكون)
   */
  public static async syncRecentMessagesFromUltraMsg(): Promise<number> {
    const instanceId = process.env.ULTRAMSG_INSTANCE_ID;
    const token = process.env.ULTRAMSG_TOKEN;
    if (!instanceId || !token) return 0;

    let syncedCount = 0;
    for (const [groupId, groupConfig] of Object.entries(MONITORED_GROUPS)) {
      try {
        const url = `https://api.ultramsg.com/${instanceId}/chats/messages?token=${token}&chatId=${groupId}&limit=35`;
        const res = await axios.get(url, { timeout: 8000 });
        const list = Array.isArray(res.data) ? res.data : [];

        for (const item of list) {
          const body = (item.body || '').trim();
          if (!body || item.fromMe === true || item.type === 'notification_template') continue;

          const msgTimestamp = item.timestamp ? new Date(parseInt(item.timestamp, 10) * 1000) : new Date();
          
          // حفظ الرسالة إذا لم تكن موجودة
          const exists = await prisma.groupMessage.findFirst({
            where: {
              groupId,
              body,
              createdAt: {
                gte: new Date(msgTimestamp.getTime() - 60000),
                lte: new Date(msgTimestamp.getTime() + 60000)
              }
            }
          });

          if (!exists) {
            const author = (item.author || '').replace('@c.us', '').replace('+', '').trim();
            await prisma.groupMessage.create({
              data: {
                groupId,
                groupName: groupConfig.name,
                category: groupConfig.category,
                senderPhone: author || 'unknown',
                senderName: author || 'موظف',
                body,
                messageTime: msgTimestamp
              }
            });
            syncedCount++;
          }
        }
      } catch (err: any) {
        console.warn(`⚠️ [GroupReport] تعذر مزامنة القروب ${groupConfig.name}:`, err.message);
      }
    }

    if (syncedCount > 0) {
      console.log(`🔄 [GroupReport] تم مزامنة ${syncedCount} رسالة جديدة من UltraMsg بنجاح.`);
    }
    return syncedCount;
  }

  /**
   * تحليل رسائل اليوم بالذكاء الاصطناعي وتوليد التقرير الشامل
   */
  public static async generateDailyReport(customDateStr?: string): Promise<string> {
    // 1. مزامنة الرسائل الحديثة أولاً
    await this.syncRecentMessagesFromUltraMsg();

    // 2. تحديد نطاق اليوم بتوقيت السعودية (UTC+3)
    const now = new Date();
    // توقيت السعودية KSA
    const ksaOffsetMs = 3 * 60 * 60 * 1000;
    const ksaNow = new Date(now.getTime() + ksaOffsetMs);
    const dateFormatted = customDateStr || ksaNow.toISOString().split('T')[0];

    // بداية اليوم ونهايته بتوقيت السعودية
    const startOfDay = new Date(`${dateFormatted}T00:00:00.000Z`);
    startOfDay.setTime(startOfDay.getTime() - ksaOffsetMs);
    const endOfDay = new Date(`${dateFormatted}T23:59:59.999Z`);
    endOfDay.setTime(endOfDay.getTime() - ksaOffsetMs);

    // 3. جلب الرسائل من قاعدة البيانات
    const messages = await prisma.groupMessage.findMany({
      where: {
        createdAt: {
          gte: startOfDay,
          lte: endOfDay
        }
      },
      orderBy: { createdAt: 'asc' }
    });

    console.log(`📊 [GroupReport] إجمالي الرسائل المسجلة لتاريخ ${dateFormatted}: ${messages.length} رسالة`);

    if (messages.length === 0) {
      return `📊 *التقرير التشغيلي اليومي - مجموعة شقق وفنادق راحتي*
📅 *التاريخ:* ${dateFormatted}

ℹ️ *تنبيه:* لم يتم تسجيل أي محادثات أو بلاغات في قروبات العمل (الاستقبال، الهاوسكيبنج، الصيانة) خلال اليوم حتى الآن.`;
    }

    // تصنيف الرسائل حسب القسم
    const receptionMsgs = messages.filter(m => m.category === 'reception');
    const housekeepingMsgs = messages.filter(m => m.category === 'housekeeping');
    const maintenanceMsgs = messages.filter(m => m.category === 'maintenance');

    const formatMsgsText = (list: typeof messages) => {
      if (list.length === 0) return 'لا توجد رسائل مسجلة اليوم في هذا القسم.';
      return list.map(m => {
        const timeStr = new Date(m.messageTime.getTime() + ksaOffsetMs).toISOString().substring(11, 16);
        return `[${timeStr}] ${m.senderName}: ${m.body}`;
      }).join('\n');
    };

    const promptContext = `
رسائل قروبات العمل ليوم ${dateFormatted} في مجموعة شقق وفنادق راحتي:

==============================
🏨 1. محادثات قسم الاستقبال والإدارة:
==============================
${formatMsgsText(receptionMsgs)}

==============================
🧹 2. محادثات قسم الهاوسكيبنج والنظافة:
==============================
${formatMsgsText(housekeepingMsgs)}

==============================
🔧 3. محادثات قسم الصيانة والتشغيل:
==============================
${formatMsgsText(maintenanceMsgs)}
`;

    const systemInstruction = `
أنت المستشار التشغيلي والذكاء الاصطناعي الخاص بإدارة مجموعة فنادق وشقق «راحتي».
مهمتك إعداد "التقرير التشغيلي اليومي التنفيذي" وتلخيصه للمدير العام (أ. عمر).

تعليمات التقرير:
1. استخرج الحقائق والمهام والأرقام بوضوح (أرقام الشقق، حالات الصيانة، إنجاز النظافة، طلبات النزلاء).
2. تجاهل الرسائل التافهة والتحيات العابرة.
3. اكتب التقرير بأسلوب عربي راقٍ ومنظم ومريح للعين مع استخدام علامات العريض (*) والإيموجي المناسبة لقراءته في واتساب.
4. حافظ على الأقسام الثلاثة:
   - 🏨 قسم الاستقبال
   - 🧹 قسم الهاوسكيبنج
   - 🔧 قسم الصيانة
5. اختم التقرير بقسم: 💡 *أبرز نقاط المتابعة للإدارة غداً* (ملخص سريع في 2-3 نقاط).

إذا لم تكن هناك رسائل في قسم معين، اذكر ببساطة "لا توجد حركات مسجلة اليوم".
`;

    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      throw new Error('GEMINI_API_KEY is not configured in .env');
    }

    // تجربة الموديلات المتاحة
    const models = ['gemini-3.8-flash', 'gemini-flash-latest'];
    for (const model of models) {
      try {
        const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`;
        const response = await axios.post(
          url,
          {
            contents: [{ role: 'user', parts: [{ text: promptContext }] }],
            systemInstruction: { parts: [{ text: systemInstruction }] },
            generationConfig: { temperature: 0.2 }
          },
          { timeout: 30000 }
        );

        const aiText = response.data?.candidates?.[0]?.content?.parts?.[0]?.text;
        if (aiText && aiText.trim().length > 0) {
          return aiText.trim();
        }
      } catch (err: any) {
        console.warn(`⚠️ [GroupReport] فشل التوليد بالموديل ${model}:`, err.message);
      }
    }

    // Fallback يدوي ملخص في حال تعطل الذكاء الاصطناعي
    return `📊 *التقرير التشغيلي اليومي - مجموعة فنادق راحتي*
📅 *التاريخ:* ${dateFormatted}

🏨 *قسم الاستقبال:*
- إجمالي الرسائل المسجلة: ${receptionMsgs.length} رسالة.

🧹 *قسم الهاوسكيبنج:*
- إجمالي الرسائل المسجلة: ${housekeepingMsgs.length} رسالة.

🔧 *قسم الصيانة:*
- إجمالي البلاغات والمحادثات: ${maintenanceMsgs.length} رسالة.

ℹ️ تم تجميع التقرير الآلي بنجاح.`;
  }

  /**
   * إرسال التقرير اليومي لرقم المدير الخاص
   */
  public static async sendDailyReportToManager(targetPhone?: string, customDateStr?: string): Promise<{ success: boolean; reportText: string; error?: string }> {
    try {
      const recipient = targetPhone || this.TARGET_ADMIN_PHONE;
      console.log(`🚀 [GroupReport] جاري إعداد وإرسال التقرير اليومي إلى: ${recipient}...`);

      const reportText = await this.generateDailyReport(customDateStr);

      await WhatsAppService.sendWhatsAppMessage(recipient, reportText);

      console.log(`✅ [GroupReport] تم إرسال التقرير اليومي بنجاح إلى: ${recipient}`);
      return { success: true, reportText };
    } catch (err: any) {
      console.error('❌ [GroupReport] فشل إرسال التقرير اليومي:', err.message);
      return { success: false, reportText: '', error: err.message };
    }
  }

  /**
   * فحص الموعد اليومي المجدول للإرسال (الساعة 11:00 مساءً بتوقيت السعودية)
   */
  public static checkAndTriggerScheduledReport(): void {
    try {
      const now = new Date();
      // تحويل لتوقيت السعودية (UTC+3)
      const ksaHour = (now.getUTCHours() + 3) % 24;
      const ksaDateStr = new Date(now.getTime() + 3 * 3600 * 1000).toISOString().split('T')[0];

      // الإرسال في تمام الساعة 23 (11:00 مساءً بتوقيت مكة)
      if (ksaHour === 23 && this.lastReportDateSent !== ksaDateStr) {
        console.log(`⏰ [GroupReport Scheduler] حان موعد التقرير اليومي (${ksaDateStr} 11:00 PM KSA)`);
        this.lastReportDateSent = ksaDateStr;
        this.sendDailyReportToManager().catch(err => {
          console.error('❌ [GroupReport Scheduler] خطأ أثناء الإرسال المجدول:', err);
        });
      }
    } catch (err) {
      console.error('❌ [GroupReport Scheduler] خطأ في المؤقت:', err);
    }
  }
}
