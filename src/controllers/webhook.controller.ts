import { Request, Response, NextFunction } from 'express';
import env from '../config/environment';
import { WhatsAppService } from '../services/whatsapp.service';
import { WhatsAppWebhookPayload } from '../types';

export class WebhookController {
  /**
   * GET /webhook
   * Verification handshake for Meta WhatsApp Cloud API configuration.
   */
  public static verifyWebhook = (req: Request, res: Response, next: NextFunction): void => {
    try {
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
        } else {
          console.warn('❌ Webhook verification failed. Tokens do not match.');
          res.status(403).send('Forbidden: Token mismatch');
          return;
        }
      }

      res.status(400).send('Bad Request: Missing hub mode or token');
    } catch (error) {
      next(error);
    }
  };

  /**
   * POST /webhook
   * Receives incoming messages, media uploads, and button interactions from WhatsApp users.
   */
  public static handleWebhook = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      console.log('📨 Incoming message:', JSON.stringify(req.body, null, 2));
      WebhookController.incomingPayloads.push({
        time: new Date().toISOString(),
        body: req.body
      });
      if (WebhookController.incomingPayloads.length > 50) {
        WebhookController.incomingPayloads.shift();
      }

      const entry = req.body.entry?.[0];
      const change = entry?.changes?.[0];
      const message = change?.value?.messages?.[0];
      const from = message?.from;
      const text = message?.text?.body;

      const payload = req.body as WhatsAppWebhookPayload;

      // Meta verification: ensure payload is for whatsapp business account
      if (payload.object !== 'whatsapp_business_account') {
        res.status(404).json({ success: false, message: 'Invalid payload origin' });
        return;
      }

      // 1. Parse incoming WhatsApp messages
      const parsedMessages = WhatsAppService.parseWebhookPayload(payload);

      if (parsedMessages.length === 0) {
        // WhatsApp sent a status update (delivered, read, etc.) instead of a new message.
        // Respond with 200 to acknowledge receipt.
        res.status(200).json({ success: true, message: 'Status update acknowledged' });
        return;
      }

      // 2. Process each message asynchronously
      for (const msg of parsedMessages) {
        try {
          const responseText = await WhatsAppService.processMessage(msg);
          
          // 3. Send WhatsApp message back to user via Facebook Graph API
          if (responseText && responseText.trim() !== '') {
            await WhatsAppService.sendWhatsAppMessage(msg.senderNumber, responseText);
          }
        } catch (msgError) {
          console.error(`🔴 Error processing individual message ${msg.messageId} from ${msg.senderNumber}:`, msgError);
          // We continue processing other messages in the payload
        }
      }

      // Meta expects a 200 OK to stop retrying the delivery of the webhook
      res.status(200).json({ success: true, message: 'Messages processed successfully' });
    } catch (error) {
      next(error);
    }
  };

  public static sentMessages: { to: string; text: string }[] = [];
  public static incomingPayloads: any[] = [];

  /**
   * Stub helper mimicking sending a WhatsApp message via Meta Cloud API.
   * In production, this would make an HTTPS call to:
   * POST https://graph.facebook.com/v19.0/${phone_number_id}/messages
   */
  private static mockSendWhatsAppMessage(to: string, text: string): void {
    console.log('\n======================================================');
    console.log(`📤 MOCK SEND WHATSAPP MESSAGE`);
    console.log(`To: ${to}`);
    console.log(`Message:\n${text}`);
    console.log('======================================================\n');
    WebhookController.sentMessages.push({ to, text });
  }
}
