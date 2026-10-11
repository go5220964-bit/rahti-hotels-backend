import makeWASocket, {
  DisconnectReason,
  useMultiFileAuthState,
  WASocket,
  Browsers
} from '@whiskeysockets/baileys';
import QRCode from 'qrcode';
import path from 'path';
import fs from 'fs';
import pino from 'pino';

export class BaileysService {
  private static sock: WASocket | null = null;
  public static qrCodeDataUrl: string | null = null;
  public static rawQr: string | null = null;
  public static isConnected: boolean = false;
  public static isConnecting: boolean = false;
  public static connectedNumber: string | null = null;
  private static authDir = path.join(process.cwd(), 'baileys_auth');

  /**
   * تهيئة وبدء تشغيل خدمة الواتساب المباشرة المجانية
   */
  public static async init(): Promise<void> {
    if (this.isConnecting || this.isConnected) {
      return;
    }

    try {
      this.isConnecting = true;
      console.log('🔄 [Baileys] جاري تهيئة الاتصال المجاني بالواتساب...');

      if (!fs.existsSync(this.authDir)) {
        fs.mkdirSync(this.authDir, { recursive: true });
      }

      const { state, saveCreds } = await useMultiFileAuthState(this.authDir);

      const silentLogger = pino({ level: 'silent' });

      const sock = makeWASocket({
        auth: state,
        printQRInTerminal: true,
        logger: silentLogger,
        browser: Browsers.macOS('Desktop'),
        connectTimeoutMs: 60000,
        defaultQueryTimeoutMs: 60000,
        keepAliveIntervalMs: 30000
      });

      this.sock = sock;

      // 1. مراقبة حالة الاتصال والباركود
      sock.ev.on('connection.update', async (update) => {
        const { connection, lastDisconnect, qr } = update;

        if (qr) {
          this.rawQr = qr;
          try {
            this.qrCodeDataUrl = await QRCode.toDataURL(qr);
            console.log('\n======================================================');
            console.log('📲 [Baileys] تم إنشاء باركود الواتساب المجاني!');
            console.log('افتح المتصفح على: /whatsapp/qr لمسح الباركود بجوالك');
            console.log('======================================================\n');
          } catch (err: any) {
            console.error('Error generating QR data URL:', err.message);
          }
        }

        if (connection === 'close') {
          this.isConnected = false;
          this.isConnecting = false;
          this.qrCodeDataUrl = null;

          const statusCode = (lastDisconnect?.error as any)?.output?.statusCode;
          const shouldReconnect = statusCode !== DisconnectReason.loggedOut;

          console.log(`🔌 [Baileys] انقطع اتصال الواتساب (الكود: ${statusCode}). إعادة المحاولة: ${shouldReconnect}`);

          if (shouldReconnect) {
            setTimeout(() => {
              this.isConnecting = false;
              this.init();
            }, 5000);
          } else {
            console.log('⚠️ [Baileys] تم تسجيل الخروج من الواتساب. يلزم مسح الباركود مجدداً.');
            this.logout();
          }
        } else if (connection === 'open') {
          this.isConnected = true;
          this.isConnecting = false;
          this.qrCodeDataUrl = null;
          this.rawQr = null;

          const userJid = sock.user?.id || '';
          this.connectedNumber = userJid.split(':')[0] || userJid.split('@')[0];

          console.log('\n======================================================');
          console.log(`✅ [Baileys] متصل بالواتساب بنجاح! رقم البوت: +${this.connectedNumber}`);
          console.log('======================================================\n');
        }
      });

      // 2. حفظ ملفات الاعتماد والجلسة تلقائياً
      sock.ev.on('creds.update', saveCreds);

      // 3. الاستماع للرسائل الواردة (قروبات ومحادثات فردية)
      sock.ev.on('messages.upsert', async ({ messages, type }) => {
        if (type !== 'notify') return;

        for (const msg of messages) {
          try {
            if (msg.key.fromMe) continue;

            const jid = msg.key.remoteJid || '';
            const text = (
              msg.message?.conversation ||
              msg.message?.extendedTextMessage?.text ||
              msg.message?.imageMessage?.caption ||
              ''
            ).trim();

            if (!text && !msg.message?.imageMessage) continue;

            // أ) الرسائل الواردة من قروبات الواتساب
            if (jid.endsWith('@g.us')) {
              const data = {
                from: jid,
                author: (msg.key.participant || '').replace('@s.whatsapp.net', '@c.us'),
                pushname: msg.pushName || 'موظف',
                body: text,
                time: msg.messageTimestamp ? String(msg.messageTimestamp) : String(Math.floor(Date.now() / 1000)),
                fromMe: false
              };

              const { GroupReportService } = require('./group-report.service');
              GroupReportService.recordIncomingGroupMessage(data).catch((err: any) => {
                console.error('Error recording group message via Baileys:', err);
              });
            }

            // ب) الرسائل الفردية من الموظفين أو الإدارة
            else if (jid.endsWith('@s.whatsapp.net')) {
              let senderNumber = '+' + jid.split('@')[0];
              const parsed = {
                senderNumber,
                senderName: msg.pushName || 'مستخدم واتساب',
                messageId: msg.key.id || `msg_${Date.now()}`,
                timestamp: typeof msg.messageTimestamp === 'number' ? msg.messageTimestamp : Math.floor(Date.now() / 1000),
                messageType: 'text',
                text
              };

              const { WhatsAppService } = require('./whatsapp.service');
              const reply = await WhatsAppService.processMessage(parsed as any);

              if (reply && reply.trim()) {
                await BaileysService.sendMessage(jid, reply);
              }
            }
          } catch (msgErr: any) {
            console.error('❌ [Baileys] خطأ أثناء معالجة الرسالة الواردة:', msgErr.message);
          }
        }
      });
    } catch (err: any) {
      this.isConnecting = false;
      this.isConnected = false;
      console.error('❌ [Baileys] فشل بدء خدمة الواتساب:', err.message);
    }
  }

  /**
   * إرسال رسالة واتساب عبر Baileys
   */
  public static async sendMessage(to: string, text: string): Promise<boolean> {
    try {
      if (!this.sock || !this.isConnected) {
        console.warn('⚠️ [Baileys] لا يمكن الإرسال؛ البوت غير متصل حالياً بالواتساب.');
        return false;
      }

      let jid = to.trim();
      if (jid.endsWith('@g.us')) {
        // Group JID
      } else if (jid.endsWith('@s.whatsapp.net')) {
        // Valid WhatsApp JID
      } else if (jid.endsWith('@c.us')) {
        jid = jid.replace('@c.us', '@s.whatsapp.net');
      } else {
        const cleanNumber = jid.replace('+', '').replace(/\D/g, '');
        jid = `${cleanNumber}@s.whatsapp.net`;
      }

      await this.sock.sendMessage(jid, { text });
      console.log(`✅ [Baileys] تم إرسال رسالة بنجاح إلى: ${jid}`);
      return true;
    } catch (err: any) {
      console.error('❌ [Baileys] خطأ أثناء إرسال الرسالة:', err.message);
      return false;
    }
  }

  /**
   * تسجيل الخروج وإعادة تعيين الجلسة
   */
  public static async logout(): Promise<void> {
    try {
      if (this.sock) {
        await this.sock.logout().catch(() => {});
        this.sock = null;
      }
      this.isConnected = false;
      this.isConnecting = false;
      this.qrCodeDataUrl = null;
      this.rawQr = null;

      if (fs.existsSync(this.authDir)) {
        fs.rmSync(this.authDir, { recursive: true, force: true });
      }
      console.log('🔄 [Baileys] تم مسح جلسة الواتساب القديمة.');
      this.init();
    } catch (err: any) {
      console.error('Error during logout:', err.message);
    }
  }
}
