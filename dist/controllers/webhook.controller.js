"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.WebhookController = void 0;
const whatsapp_service_1 = require("../services/whatsapp.service");
class WebhookController {
    /**
     * GET /webhook
     * Verification handshake for Meta WhatsApp Cloud API configuration.
     */
    static verifyWebhook = (req, res, next) => {
        try {
            if (req.query.ping) {
                res.status(200).send('pong');
                return;
            }
            const mode = req.query['hub.mode'];
            const token = req.query['hub.verify_token'];
            const challenge = req.query['hub.challenge'];
            console.log('🔍 WhatsApp Webhook verification requested');
            console.log(`hub.mode: ${mode}, hub.verify_token: ${token}`);
            if (mode && token) {
                if (mode === 'subscribe' && token === process.env.WEBHOOK_VERIFY_TOKEN) {
                    console.log('✅ Webhook verified successfully!');
                    res.status(200).send(challenge);
                    return;
                }
                else {
                    console.warn('❌ Webhook verification failed. Tokens do not match.');
                    res.status(403).send('Forbidden: Token mismatch');
                    return;
                }
            }
            res.status(400).send('Bad Request: Missing hub mode or token');
        }
        catch (error) {
            next(error);
        }
    };
    /**
     * POST /webhook
     * Receives incoming messages, media uploads, and button interactions from WhatsApp users.
     */
    static handleWebhook = async (req, res, next) => {
        try {
            console.log('📨 Incoming message:', JSON.stringify(req.body, null, 2));
            WebhookController.incomingPayloads.push({
                time: new Date().toISOString(),
                body: req.body
            });
            if (WebhookController.incomingPayloads.length > 50) {
                WebhookController.incomingPayloads.shift();
            }
            const isTwilio = !!req.body.MessageSid || process.env.WHATSAPP_PROVIDER === 'twilio';
            const isUltraMsg = !!req.body.event_type || !!req.body.data?.from || (req.body.data && req.body.data.body !== undefined) || process.env.WHATSAPP_PROVIDER === 'ultramsg';
            let parsedMessages = [];
            if (isTwilio) {
                parsedMessages = whatsapp_service_1.WhatsAppService.parseTwilioWebhookPayload(req.body);
            }
            else if (isUltraMsg && (req.body.data || req.body.from)) {
                parsedMessages = whatsapp_service_1.WhatsAppService.parseUltraMsgWebhookPayload(req.body);
            }
            else {
                const payload = req.body;
                // Meta verification: ensure payload is for whatsapp business account
                if (payload.object === 'whatsapp_business_account') {
                    parsedMessages = whatsapp_service_1.WhatsAppService.parseWebhookPayload(payload);
                }
                else if (req.body.data || req.body.from || req.body.body) {
                    parsedMessages = whatsapp_service_1.WhatsAppService.parseUltraMsgWebhookPayload(req.body);
                }
                else {
                    res.status(200).json({ success: true, message: 'Payload acknowledged' });
                    return;
                }
            }
            if (parsedMessages.length === 0) {
                // WhatsApp/Twilio sent a status update or empty message.
                // Respond with 200 to acknowledge receipt.
                res.status(200).json({ success: true, message: 'Status update/empty payload acknowledged' });
                return;
            }
            // 2. Process each message asynchronously
            for (const msg of parsedMessages) {
                try {
                    const responseText = await whatsapp_service_1.WhatsAppService.processMessage(msg);
                    // 3. Send WhatsApp message back to user
                    if (responseText && responseText.trim() !== '') {
                        await whatsapp_service_1.WhatsAppService.sendWhatsAppMessage(msg.senderNumber, responseText);
                    }
                }
                catch (msgError) {
                    console.error(`🔴 Error processing individual message ${msg.messageId} from ${msg.senderNumber}:`, msgError);
                    // We continue processing other messages in the payload
                }
            }
            // Respond with 200 OK to stop retrying the delivery of the webhook
            res.status(200).json({ success: true, message: 'Messages processed successfully' });
        }
        catch (error) {
            next(error);
        }
    };
    /**
     * POST /webhook/telegram
     * Receives incoming messages, contact sharing, media, and buttons from Telegram.
     */
    static handleTelegramWebhook = async (req, res, next) => {
        try {
            console.log('📨 Incoming Telegram update:', JSON.stringify(req.body, null, 2));
            WebhookController.incomingPayloads.push({
                time: new Date().toISOString(),
                platform: 'telegram',
                body: req.body
            });
            if (WebhookController.incomingPayloads.length > 50) {
                WebhookController.incomingPayloads.shift();
            }
            // Process update in background to respond to Telegram immediately
            const { TelegramService } = require('../services/telegram.service');
            TelegramService.handleWebhook(req.body).catch((err) => {
                console.error('🔴 Error handling Telegram webhook update:', err);
            });
            res.status(200).json({ success: true, message: 'Telegram update received' });
        }
        catch (error) {
            next(error);
        }
    };
    static sentMessages = [];
    static incomingPayloads = [];
    /**
     * Stub helper mimicking sending a WhatsApp message via Meta Cloud API.
     * In production, this would make an HTTPS call to:
     * POST https://graph.facebook.com/v19.0/${phone_number_id}/messages
     */
    static mockSendWhatsAppMessage(to, text) {
        console.log('\n======================================================');
        console.log(`📤 MOCK SEND WHATSAPP MESSAGE`);
        console.log(`To: ${to}`);
        console.log(`Message:\n${text}`);
        console.log('======================================================\n');
        WebhookController.sentMessages.push({ to, text });
    }
}
exports.WebhookController = WebhookController;
