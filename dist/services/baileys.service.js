"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.BaileysService = void 0;
const baileys_1 = __importStar(require("@whiskeysockets/baileys"));
const qrcode_1 = __importDefault(require("qrcode"));
const path_1 = __importDefault(require("path"));
const fs_1 = __importDefault(require("fs"));
const pino_1 = __importDefault(require("pino"));
class BaileysService {
    static sock = null;
    static qrCodeDataUrl = null;
    static rawQr = null;
    static isConnected = false;
    static isConnecting = false;
    static connectedNumber = null;
    static authDir = path_1.default.join(process.cwd(), 'baileys_auth');
    /**
     * تهيئة وبدء تشغيل خدمة الواتساب المباشرة المجانية
     */
    static async init() {
        if (this.isConnecting || this.isConnected) {
            return;
        }
        try {
            this.isConnecting = true;
            console.log('🔄 [Baileys] جاري تهيئة الاتصال المجاني بالواتساب...');
            if (!fs_1.default.existsSync(this.authDir)) {
                fs_1.default.mkdirSync(this.authDir, { recursive: true });
            }
            const { state, saveCreds } = await (0, baileys_1.useMultiFileAuthState)(this.authDir);
            const { version } = await (0, baileys_1.fetchLatestBaileysVersion)().catch(() => ({ version: [2, 3000, 1043857760] }));
            const silentLogger = (0, pino_1.default)({ level: 'silent' });
            const sock = (0, baileys_1.default)({
                version,
                auth: state,
                logger: silentLogger,
                browser: baileys_1.Browsers.macOS('Desktop'),
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
                        this.qrCodeDataUrl = await qrcode_1.default.toDataURL(qr);
                        console.log('\n======================================================');
                        console.log('📲 [Baileys] تم إنشاء باركود الواتساب المجاني!');
                        console.log('افتح المتصفح على: /whatsapp/qr لمسح الباركود بجوالك');
                        console.log('======================================================\n');
                    }
                    catch (err) {
                        console.error('Error generating QR data URL:', err.message);
                    }
                }
                if (connection === 'close') {
                    this.isConnected = false;
                    this.isConnecting = false;
                    this.qrCodeDataUrl = null;
                    const statusCode = lastDisconnect?.error?.output?.statusCode;
                    const shouldReconnect = statusCode !== baileys_1.DisconnectReason.loggedOut;
                    console.log(`🔌 [Baileys] انقطع اتصال الواتساب (الكود: ${statusCode}). إعادة المحاولة: ${shouldReconnect}`);
                    if (shouldReconnect) {
                        setTimeout(() => {
                            this.isConnecting = false;
                            this.init();
                        }, 5000);
                    }
                    else {
                        console.log('⚠️ [Baileys] تم تسجيل الخروج من الواتساب. يلزم مسح الباركود مجدداً.');
                        this.logout();
                    }
                }
                else if (connection === 'open') {
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
                if (type !== 'notify')
                    return;
                for (const msg of messages) {
                    try {
                        if (msg.key.fromMe)
                            continue;
                        const jid = msg.key.remoteJid || '';
                        const text = (msg.message?.conversation ||
                            msg.message?.extendedTextMessage?.text ||
                            msg.message?.imageMessage?.caption ||
                            '').trim();
                        if (!text && !msg.message?.imageMessage)
                            continue;
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
                            GroupReportService.recordIncomingGroupMessage(data).catch((err) => {
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
                            const reply = await WhatsAppService.processMessage(parsed);
                            if (reply && reply.trim()) {
                                await BaileysService.sendMessage(jid, reply);
                            }
                        }
                    }
                    catch (msgErr) {
                        console.error('❌ [Baileys] خطأ أثناء معالجة الرسالة الواردة:', msgErr.message);
                    }
                }
            });
        }
        catch (err) {
            this.isConnecting = false;
            this.isConnected = false;
            console.error('❌ [Baileys] فشل بدء خدمة الواتساب:', err.message);
        }
    }
    /**
     * إرسال رسالة واتساب عبر Baileys
     */
    static async sendMessage(to, text) {
        try {
            if (!this.sock || !this.isConnected) {
                console.warn('⚠️ [Baileys] لا يمكن الإرسال؛ البوت غير متصل حالياً بالواتساب.');
                return false;
            }
            let jid = to.trim();
            if (jid.endsWith('@g.us')) {
                // Group JID
            }
            else if (jid.endsWith('@s.whatsapp.net')) {
                // Valid WhatsApp JID
            }
            else if (jid.endsWith('@c.us')) {
                jid = jid.replace('@c.us', '@s.whatsapp.net');
            }
            else {
                const cleanNumber = jid.replace('+', '').replace(/\D/g, '');
                jid = `${cleanNumber}@s.whatsapp.net`;
            }
            await this.sock.sendMessage(jid, { text });
            console.log(`✅ [Baileys] تم إرسال رسالة بنجاح إلى: ${jid}`);
            return true;
        }
        catch (err) {
            console.error('❌ [Baileys] خطأ أثناء إرسال الرسالة:', err.message);
            return false;
        }
    }
    /**
     * تسجيل الخروج وإعادة تعيين الجلسة
     */
    static async logout() {
        try {
            if (this.sock) {
                await this.sock.logout().catch(() => { });
                this.sock = null;
            }
            this.isConnected = false;
            this.isConnecting = false;
            this.qrCodeDataUrl = null;
            this.rawQr = null;
            if (fs_1.default.existsSync(this.authDir)) {
                fs_1.default.rmSync(this.authDir, { recursive: true, force: true });
            }
            console.log('🔄 [Baileys] تم مسح جلسة الواتساب القديمة.');
            this.init();
        }
        catch (err) {
            console.error('Error during logout:', err.message);
        }
    }
}
exports.BaileysService = BaileysService;
