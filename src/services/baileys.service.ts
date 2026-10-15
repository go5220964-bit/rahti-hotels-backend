import makeWASocket, {
  DisconnectReason,
  useMultiFileAuthState,
  fetchLatestBaileysVersion,
  makeCacheableSignalKeyStore,
} from '@whiskeysockets/baileys';
import QRCode from 'qrcode';
import fs from 'fs';
import path from 'path';
import prisma from './prisma';
import { WhatsAppService } from './whatsapp.service';
import { GroupReportService } from './group-report.service';

const DB_CREDS_KEY = 'whatsapp_baileys_creds_backup';

export class BaileysService {
  private static sock: any = null;
  private static qrCodeData: string | null = null;
  private static isConnected = false;
  private static isConnecting = false;
  private static connectedNumber: string | null = null;
  private static reconnectAttempts = 0;

  // طابور إرسال متسلسل لحماية الرقم من الحظر عند بث التعاميم والإشعارات
  private static sendQueue: Promise<void> = Promise.resolve();

  private static getAuthFolder(): string {
    return path.join(__dirname, '../../baileys_auth');
  }

  /**
   * استرجاع بيانات جلسة الواتساب من قاعدة البيانات PostgreSQL
   * في حال قام خادم Render بمسح القرص المحلي بعد إعادة التشغيل
   */
  private static async restoreCredsFromDatabase(authFolder: string): Promise<void> {
    try {
      if (!fs.existsSync(authFolder)) {
        fs.mkdirSync(authFolder, { recursive: true });
      }
      const credsPath = path.join(authFolder, 'creds.json');
      if (fs.existsSync(credsPath)) {
        return; // الملف موجود محلياً بالفعل
      }

      const savedRecord = await prisma.systemSetting.findUnique({
        where: { key: DB_CREDS_KEY },
      });

      if (savedRecord?.value) {
        fs.writeFileSync(credsPath, savedRecord.value, 'utf-8');
        console.log('🔄 Restored WhatsApp Baileys credentials from PostgreSQL database.');
      }
    } catch (error) {
      console.warn('⚠️ Could not restore Baileys creds from DB:', error);
    }
  }

  /**
   * حفظ نسخة احتياطية من creds.json داخل قاعدة بيانات PostgreSQL
   */
  private static async backupCredsToDatabase(authFolder: string): Promise<void> {
    try {
      const credsPath = path.join(authFolder, 'creds.json');
      if (!fs.existsSync(credsPath)) return;

      const rawCreds = fs.readFileSync(credsPath, 'utf-8');
      if (!rawCreds) return;

      await prisma.systemSetting.upsert({
        where: { key: DB_CREDS_KEY },
        update: { value: rawCreds },
        create: { key: DB_CREDS_KEY, value: rawCreds },
      });
    } catch (error) {
      console.warn('⚠️ Failed to backup Baileys creds to DB:', error);
    }
  }

  public static async init(): Promise<void> {
    if (BaileysService.isConnecting || BaileysService.isConnected) {
      return;
    }

    BaileysService.isConnecting = true;
    const authFolder = BaileysService.getAuthFolder();

    try {
      await BaileysService.restoreCredsFromDatabase(authFolder);

      const { state, saveCreds } = await useMultiFileAuthState(authFolder);
      const { version } = await fetchLatestBaileysVersion();

      BaileysService.sock = makeWASocket({
        version,
        auth: {
          creds: state.creds,
          keys: makeCacheableSignalKeyStore(state.keys, console as any),
        },
        printQRInTerminal: true,
        syncFullHistory: false,
      });

      BaileysService.sock.ev.on('creds.update', async () => {
        await saveCreds();
        await BaileysService.backupCredsToDatabase(authFolder);
      });

      BaileysService.sock.ev.on('connection.update', async (update: any) => {
        const { connection, lastDisconnect, qr } = update;

        if (qr) {
          QRCode.toDataURL(qr, (err, url) => {
            if (!err) {
              BaileysService.qrCodeData = url;
            }
          });
        }

        if (connection === 'close') {
          BaileysService.isConnected = false;
          BaileysService.isConnecting = false;
          BaileysService.connectedNumber = null;

          const statusCode = (lastDisconnect?.error as any)?.output?.statusCode;
          const isLoggedOut = statusCode === DisconnectReason.loggedOut;

          if (isLoggedOut) {
            console.warn('🚪 WhatsApp logged out from phone. Clearing session...');
            await BaileysService.clearSessionData();
          } else {
            BaileysService.reconnectAttempts += 1;
            const delayMs = Math.min(30000, 3000 * BaileysService.reconnectAttempts);
            console.log(`🔄 Reconnecting WhatsApp in ${delayMs / 1000}s...`);
            setTimeout(() => {
              BaileysService.init();
            }, delayMs);
          }
        } else if (connection === 'open') {
          BaileysService.isConnected = true;
          BaileysService.isConnecting = false;
          BaileysService.qrCodeData = null;
          BaileysService.reconnectAttempts = 0;

          const rawId = BaileysService.sock?.user?.id || '';
          BaileysService.connectedNumber = rawId.split(':')[0]?.split('@')[0] || null;

          await BaileysService.backupCredsToDatabase(authFolder);
          console.log(`✅ Baileys WhatsApp connected successfully (${BaileysService.connectedNumber})`);
        }
      });

      BaileysService.sock.ev.on('messages.upsert', async (m: any) => {
        if (m.type !== 'notify') return;

        for (const msg of m.messages) {
          if (!msg.message || msg.key.fromMe) continue;

          const jid = msg.key.remoteJid || '';
          const text =
            msg.message.conversation ||
            msg.message.extendedTextMessage?.text ||
            msg.message.buttonsResponseMessage?.selectedDisplayText ||
            msg.message.listResponseMessage?.title ||
            '';

          const locationMsg = msg.message.locationMessage || msg.message.liveLocationMessage;

          if (jid.endsWith('@g.us')) {
            await GroupReportService.recordIncomingGroupMessage({
              groupId: jid,
              sender: msg.key.participant || jid,
              text,
              timestamp: new Date(),
            });
          } else if (jid.endsWith('@s.whatsapp.net')) {
            const senderNumber = jid.replace('@s.whatsapp.net', '');
            const reply = await WhatsAppService.processMessage({
              from: senderNumber,
              senderName: msg.pushName || 'موظف',
              messageId: msg.key.id,
              timestamp: String(msg.messageTimestamp || Date.now()),
              type: locationMsg ? 'location' : 'text',
              text: locationMsg
                ? `LOCATION:${locationMsg.degreesLatitude},${locationMsg.degreesLongitude}`
                : text,
            });

            if (reply) {
              await BaileysService.sendMessage(jid, reply);
            }
          }
        }
      });
    } catch (error) {
      BaileysService.isConnecting = false;
      console.error('❌ Error initializing BaileysService:', error);
    }
  }

  /**
   * إرسال آمن مع فاصل زمني عشوائي ومحاكاة الكتابة لمنع حظر الرقم
   */
  public static async sendMessage(jidOrPhone: string, text: string): Promise<void> {
    if (!BaileysService.sock || !BaileysService.isConnected) {
      console.warn('⚠️ Cannot send WhatsApp message: Bot is not connected.');
      return;
    }

    const formattedJid = jidOrPhone.includes('@')
      ? jidOrPhone
      : `${jidOrPhone.replace(/[^0-9]/g, '')}@s.whatsapp.net`;

    BaileysService.sendQueue = BaileysService.sendQueue.then(async () => {
      try {
        await BaileysService.sock.sendPresenceUpdate('composing', formattedJid);
        const typingDelay = 900 + Math.floor(Math.random() * 900);
        await new Promise((r) => setTimeout(r, typingDelay));

        await BaileysService.sock.sendMessage(formattedJid, { text });
        await BaileysService.sock.sendPresenceUpdate('paused', formattedJid);

        // فاصل أمان بين الرسائل المتتالية (2.5 - 4 ثوانٍ) لحماية الرقم عند بث التعاميم
        const antiBanGap = 2500 + Math.floor(Math.random() * 1500);
        await new Promise((r) => setTimeout(r, antiBanGap));
      } catch (err) {
        console.error(`Failed to send WhatsApp message to ${formattedJid}:`, err);
      }
    });

    return BaileysService.sendQueue;
  }

  public static getQRCode(): string | null {
    return BaileysService.qrCodeData;
  }

  public static getStatus() {
    return {
      isConnected: BaileysService.isConnected,
      isConnecting: BaileysService.isConnecting,
      connectedNumber: BaileysService.connectedNumber,
      hasQr: Boolean(BaileysService.qrCodeData),
      qrCodeDataUrl: BaileysService.qrCodeData,
    };
  }

  private static async clearSessionData(): Promise<void> {
    try {
      const authFolder = BaileysService.getAuthFolder();
      if (fs.existsSync(authFolder)) {
        fs.rmSync(authFolder, { recursive: true, force: true });
      }
      await prisma.systemSetting.deleteMany({
        where: { key: DB_CREDS_KEY },
      });
    } catch (error) {
      console.warn('Error clearing Baileys session data:', error);
    }
  }

  public static async logout(): Promise<void> {
    try {
      if (BaileysService.sock) {
        await BaileysService.sock.logout();
      }
    } catch {
      // ignore logout error if socket already closed
    } finally {
      BaileysService.sock = null;
      BaileysService.isConnected = false;
      BaileysService.isConnecting = false;
      BaileysService.connectedNumber = null;
      BaileysService.qrCodeData = null;
      await BaileysService.clearSessionData();
    }
  }
}
