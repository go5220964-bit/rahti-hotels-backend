import axios from 'axios';
import fs from 'fs';
import path from 'path';
import prisma from './prisma';
import { WhatsAppService } from './whatsapp.service';
import { ParsedWhatsAppMessage } from '../types';

const BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN;
const TELEGRAM_API = `https://api.telegram.org/bot${BOT_TOKEN}`;
const CHATS_FILE = path.join(__dirname, '../../telegram_chats.json');

export class TelegramService {
  private static chatsMap = new Map<number, string>(); // chatId -> phoneNumber

  static {
    // Load persisted chat mapping on startup
    try {
      if (fs.existsSync(CHATS_FILE)) {
        const data = JSON.parse(fs.readFileSync(CHATS_FILE, 'utf8'));
        Object.entries(data).forEach(([chatId, phone]) => {
          this.chatsMap.set(Number(chatId), phone as string);
        });
        console.log(`[Telegram Bot] Loaded ${this.chatsMap.size} authenticated chat mappings from cache.`);
      }
    } catch (e) {
      console.error('[Telegram Bot] Failed to load chat mappings:', e);
    }
  }

  private static saveMappings() {
    try {
      const obj = Object.fromEntries(this.chatsMap.entries());
      fs.writeFileSync(CHATS_FILE, JSON.stringify(obj, null, 2), 'utf8');
    } catch (e) {
      console.error('[Telegram Bot] Failed to persist chat mappings:', e);
    }
  }

  public static getChatIdByPhone(phone: string): number | null {
    const cleanPhone = phone.replace('+', '');
    for (const [chatId, p] of this.chatsMap.entries()) {
      if (p.replace('+', '') === cleanPhone) {
        return chatId;
      }
    }
    return null;
  }

  public static async setWebhook(serverUrl: string): Promise<void> {
    if (!BOT_TOKEN) {
      console.warn('⚠️ TELEGRAM_BOT_TOKEN is missing. Telegram webhook registration skipped.');
      return;
    }
    const webhookUrl = `${serverUrl.replace(/\/$/, '')}/webhook/telegram`;
    console.log(`[Telegram Bot] Registering webhook to: ${webhookUrl}`);
    try {
      const res = await axios.post(`${TELEGRAM_API}/setWebhook`, { url: webhookUrl });
      console.log('[Telegram Bot] Webhook successfully registered:', res.data);
    } catch (error: any) {
      console.error('[Telegram Bot] Failed to set Telegram webhook:', error.response?.data || error.message);
    }
  }

  public static async sendMessage(chatId: number | string, text: string, replyMarkup?: any): Promise<void> {
    if (!BOT_TOKEN) return;
    try {
      const { cleanText, replyMarkup: parsedMarkup } = this.parseButtons(text);
      const finalMarkup = replyMarkup || parsedMarkup;
      const formattedText = this.formatMarkdownToHtml(cleanText);

      await axios.post(`${TELEGRAM_API}/sendMessage`, {
        chat_id: chatId,
        text: formattedText,
        reply_markup: finalMarkup,
        parse_mode: 'HTML'
      });
      console.log(`[Telegram Bot] Outgoing message sent to Chat: ${chatId}`);
    } catch (error: any) {
      console.error('[Telegram Bot] Failed to send Telegram message:', error.response?.data || error.message);
    }
  }

  public static async handleWebhook(body: any): Promise<void> {
    if (!body) return;

    // 1. Handle callback queries (Inline Keyboard clicks)
    if (body.callback_query) {
      const chatId = body.callback_query.message.chat.id;
      const callbackData = body.callback_query.data;
      const phoneNumber = this.chatsMap.get(chatId);

      // Acknowledge the callback query immediately to stop the loading indicator
      try {
        await axios.post(`${TELEGRAM_API}/answerCallbackQuery`, {
          callback_query_id: body.callback_query.id
        });
      } catch (err: any) {
        console.error('[Telegram Bot] Failed to answer callback query:', err.message);
      }

      if (!phoneNumber) {
        await this.sendAuthPrompt(chatId);
        return;
      }

      // Handle "assign_tech_${ticketId}"
      if (callbackData.startsWith('assign_tech_')) {
        const ticketId = callbackData.replace('assign_tech_', '');
        try {
          const ticket = await prisma.maintenanceRequest.findUnique({
            where: { id: ticketId },
            include: { branch: true, reporter: true }
          });

          if (!ticket) {
            await this.sendMessage(chatId, '❌ عذراً، لم يتم العثور على بلاغ الصيانة هذا في النظام.');
            return;
          }

          const technicians = await prisma.user.findMany({
            where: {
              role: 'Technician',
              isActive: true
            }
          });

          if (technicians.length === 0) {
            await this.sendMessage(chatId, '❌ عذراً، لا يوجد فنيين نشطين في النظام حالياً لتعيينهم.');
            return;
          }

          const branchNameAr = ticket.branch.name === 'Sail Road Branch' ? 'فرع طريق السيل' :
                               ticket.branch.name === 'Beachside Resort Branch' ? 'فرع منتجع الشاطئ' :
                               ticket.branch.name;

          const categoryTranslation: Record<string, string> = {
            Electrical: 'كهرباء',
            Plumbing: 'سباكة',
            AC: 'تكييف',
            Carpentry: 'نجارة',
            Cleaning: 'نظافة',
            General: 'عام'
          };
          const priorityTranslation: Record<string, string> = {
            Urgent: 'عاجل 🚨',
            High: 'مرتفع ⚡',
            Normal: 'عادي ⏱️',
            Low: 'منخفض 💤'
          };

          const categoryAr = categoryTranslation[ticket.category] || ticket.category;
          const priorityAr = priorityTranslation[ticket.priority] || ticket.priority;

          const text = `🔔 <b>بلاغ صيانة جديد #${ticket.ticketNumber}</b>\n\n` +
            `🏨 <b>الفرع</b>: ${branchNameAr}\n` +
            `🔧 <b>النوع</b>: ${categoryAr}\n` +
            `📍 <b>الموقع</b>: ${ticket.location}\n` +
            `📝 <b>الوصف</b>: ${ticket.description}\n` +
            `⚡ <b>الأولوية</b>: ${priorityAr}\n` +
            `👤 <b>المُبلِّغ</b>: ${ticket.reporter.name}\n\n` +
            `📥 <b>يرجى اختيار الفني لتعيينه لمباشرة العمل:</b>`;

          const inlineKeyboard: any[][] = [];
          for (let i = 0; i < technicians.length; i += 2) {
            const row = technicians.slice(i, i + 2).map(tech => ({
              text: `👷 ${tech.name}`,
              callback_data: `tech_${tech.id}_${ticketId}`
            }));
            inlineKeyboard.push(row);
          }

          const messageId = body.callback_query.message.message_id;
          await axios.post(`${TELEGRAM_API}/editMessageText`, {
            chat_id: chatId,
            message_id: messageId,
            text: text,
            reply_markup: { inline_keyboard: inlineKeyboard },
            parse_mode: 'HTML'
          });

        } catch (err: any) {
          console.error('[Telegram Bot] Error in assign_tech handler:', err.message);
          await this.sendMessage(chatId, '❌ حدث خطأ أثناء محاولة تعيين الفني.');
        }
        return;
      }

      // Handle "tech_${techId}_${ticketId}"
      if (callbackData.startsWith('tech_')) {
        const parts = callbackData.split('_');
        if (parts.length >= 3) {
          const techId = parts[1];
          const ticketId = parts[2];

          try {
            const supervisor = await prisma.user.findFirst({
              where: { phoneNumber: phoneNumber }
            });

            if (!supervisor) {
              await this.sendMessage(chatId, '❌ عذراً، لم نتمكن من العثور على حساب المشرف الخاص بك.');
              return;
            }

            const { MaintenanceService } = require('./maintenance.service');
            const updatedRequest = await MaintenanceService.assignTechnician(ticketId, techId, supervisor.id);

            const branchNameAr = updatedRequest.branch.name === 'Sail Road Branch' ? 'فرع طريق السيل' :
                                 updatedRequest.branch.name === 'Beachside Resort Branch' ? 'فرع منتجع الشاطئ' :
                                 updatedRequest.branch.name;

            const categoryTranslation: Record<string, string> = {
              Electrical: 'كهرباء',
              Plumbing: 'سباكة',
              AC: 'تكييف',
              Carpentry: 'نجارة',
              Cleaning: 'نظافة',
              General: 'عام'
            };
            const categoryAr = categoryTranslation[updatedRequest.category] || updatedRequest.category;

            const text = `🔔 <b>بلاغ صيانة #${updatedRequest.ticketNumber}</b>\n\n` +
              `🏨 <b>الفرع</b>: ${branchNameAr}\n` +
              `🔧 <b>النوع</b>: ${categoryAr}\n` +
              `📍 <b>الموقع</b>: ${updatedRequest.location}\n` +
              `📝 <b>الوصف</b>: ${updatedRequest.description}\n` +
              `👤 <b>المُبلِّغ</b>: ${updatedRequest.reporter.name}\n` +
              `👷 <b>الفني المعين</b>: ${updatedRequest.technician?.name || ''}\n\n` +
              `✅ <b>تم تعيين الفني بنجاح ومباشرة العمل!</b>`;

            const messageId = body.callback_query.message.message_id;
            await axios.post(`${TELEGRAM_API}/editMessageText`, {
              chat_id: chatId,
              message_id: messageId,
              text: text,
              reply_markup: { inline_keyboard: [] },
              parse_mode: 'HTML'
            });

          } catch (err: any) {
            console.error('[Telegram Bot] Error in tech assignment handler:', err.message);
            await this.sendMessage(chatId, '❌ فشل تعيين الفني للبلاغ. يرجى المحاولة مرة أخرى.');
          }
          return;
        }
      }

      const parsed: ParsedWhatsAppMessage = {
        senderNumber: phoneNumber,
        senderName: body.callback_query.from?.first_name || 'مستخدم تليجرام',
        messageId: `tg_cb_${body.callback_query.id}`,
        timestamp: Math.floor(Date.now() / 1000),
        messageType: 'button_reply',
        buttonId: callbackData,
        buttonTitle: callbackData
      };

      const responseText = await WhatsAppService.processMessage(parsed);
      if (responseText && responseText.trim() !== '') {
        await this.sendMessage(chatId, responseText);
      }
      return;
    }

    // 2. Handle message updates
    if (body.message) {
      const chatId = body.message.chat.id;
      const text = body.message.text || '';
      const contact = body.message.contact;
      const location = body.message.location;
      const photo = body.message.photo;
      const document = body.message.document;

      // Handle "/start" or unauthenticated chats
      if (text === '/start') {
        await this.sendAuthPrompt(chatId);
        return;
      }

      // Handle shared contact (authentication)
      if (contact) {
        let phone = contact.phone_number || '';
        if (!phone.startsWith('+')) {
          phone = '+' + phone;
        }
        await this.authenticateChat(chatId, phone);
        return;
      }

      // Check if user is authenticated
      const phoneNumber = this.chatsMap.get(chatId);
      if (!phoneNumber) {
        await this.sendAuthPrompt(chatId);
        return;
      }

      // Handle location messages
      if (location) {
        const parsed: ParsedWhatsAppMessage = {
          senderNumber: phoneNumber,
          senderName: body.message.from?.first_name || 'مستخدم تليجرام',
          messageId: `tg_${body.message.message_id}`,
          timestamp: body.message.date,
          messageType: 'location',
          latitude: location.latitude,
          longitude: location.longitude
        };
        const responseText = await WhatsAppService.processMessage(parsed);
        if (responseText && responseText.trim() !== '') {
          await this.sendMessage(chatId, responseText);
        }
        return;
      }

      // Handle photo messages
      if (photo && photo.length > 0) {
        const largestPhoto = photo[photo.length - 1];
        const parsed: ParsedWhatsAppMessage = {
          senderNumber: phoneNumber,
          senderName: body.message.from?.first_name || 'مستخدم تليجرام',
          messageId: `tg_${body.message.message_id}`,
          timestamp: body.message.date,
          messageType: 'media',
          mediaId: largestPhoto.file_id,
          mimeType: 'image/jpeg',
          caption: body.message.caption || ''
        };
        const responseText = await WhatsAppService.processMessage(parsed);
        if (responseText && responseText.trim() !== '') {
          await this.sendMessage(chatId, responseText);
        }
        return;
      }

      // Handle document messages
      if (document) {
        const parsed: ParsedWhatsAppMessage = {
          senderNumber: phoneNumber,
          senderName: body.message.from?.first_name || 'مستخدم تليجرام',
          messageId: `tg_${body.message.message_id}`,
          timestamp: body.message.date,
          messageType: 'media',
          mediaId: document.file_id,
          mimeType: document.mime_type || 'application/octet-stream',
          caption: body.message.caption || ''
        };
        const responseText = await WhatsAppService.processMessage(parsed);
        if (responseText && responseText.trim() !== '') {
          await this.sendMessage(chatId, responseText);
        }
        return;
      }

      // Handle standard text messages
      if (text) {
        const parsed: ParsedWhatsAppMessage = {
          senderNumber: phoneNumber,
          senderName: body.message.from?.first_name || 'مستخدم تليجرام',
          messageId: `tg_${body.message.message_id}`,
          timestamp: body.message.date,
          messageType: 'text',
          text: text
        };
        const responseText = await WhatsAppService.processMessage(parsed);
        if (responseText && responseText.trim() !== '') {
          await this.sendMessage(chatId, responseText);
        }
      }
    }
  }

  private static parseButtons(text: string): { cleanText: string; replyMarkup: any } {
    const buttonRegex = /\[([^\]]+)\]\s*\(زر:\s*([^)]+)\)/g;
    const buttons: { text: string; callback_data: string }[] = [];
    let match;

    buttonRegex.lastIndex = 0;
    while ((match = buttonRegex.exec(text)) !== null) {
      buttons.push({
        text: match[1].trim(),
        callback_data: match[2].trim()
      });
    }

    if (buttons.length === 0) {
      return { cleanText: text, replyMarkup: undefined };
    }

    let cleanText = text.replace(buttonRegex, '').trim();
    cleanText = cleanText.replace(/\n\s*\n/g, '\n').trim();

    if (!cleanText) {
      cleanText = 'يرجى اختيار أحد الخيارات:';
    }

    const keyboard: any[][] = [];
    for (let i = 0; i < buttons.length; i += 2) {
      const row = buttons.slice(i, i + 2);
      keyboard.push(row);
    }

    return {
      cleanText,
      replyMarkup: {
        inline_keyboard: keyboard
      }
    };
  }

  private static formatMarkdownToHtml(text: string): string {
    if (!text) return '';
    const escaped = text
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;');
      
    return escaped
      .replace(/\*([^*]+)\*/g, '<b>$1</b>')
      .replace(/_([^_]+)_/g, '<i>$1</i>')
      .replace(/`([^`]+)`/g, '<code>$1</code>')
      .replace(/~([^~]+)~/g, '<s>$1</s>');
  }

  private static async sendAuthPrompt(chatId: number) {
    const text = 'مرحباً بك في نظام عمليات فنادق راحتي. 🏨\nيرجى الضغط على الزر أدناه لمشاركة رقم هاتفك والتحقق من حسابك وتفعيل البوت:';
    const replyMarkup = {
      keyboard: [
        [{ text: 'مشاركة رقم الهاتف 📱', request_contact: true }]
      ],
      one_time_keyboard: true,
      resize_keyboard: true
    };
    await this.sendMessage(chatId, text, replyMarkup);
  }

  private static async authenticateChat(chatId: number, phone: string) {
    const alternatives = [phone, phone.replace('+', ''), '+' + phone.replace('+', '')];
    
    const user = await prisma.user.findFirst({
      where: {
        phoneNumber: { in: alternatives }
      }
    });

    if (!user) {
      await this.sendMessage(
        chatId,
        `❌ عذراً، رقم الهاتف ${phone} غير مسجل لدينا في النظام. يرجى التواصل مع المسؤول لتسجيل رقمك.`
      );
      return;
    }

    this.chatsMap.set(chatId, user.phoneNumber);
    this.saveMappings();

    const welcomeText = `✅ تم التحقق من حسابك بنجاح يا ${user.name}!\nيمكنك الآن إرسال كلمة "طلب" أو "قائمة" لبدء استخدام نظام العمليات.`;
    const removeKeyboard = { remove_keyboard: true };
    await this.sendMessage(chatId, welcomeText, removeKeyboard);
  }
}
