import { WebhookController } from './src/controllers/webhook.controller';
import { Request, Response } from 'express';
import prisma from './src/services/prisma';

async function test() {
  const req = {
    body: {
      MessageSid: 'SM12345',
      From: 'whatsapp:+966563104828',
      Body: 'طلب',
      ProfileName: 'omar otbi'
    }
  } as unknown as Request;

  const res = {
    status: (code: number) => {
      console.log('Status code set:', code);
      return res;
    },
    json: (data: any) => {
      console.log('JSON returned:', JSON.stringify(data, null, 2));
      return res;
    }
  } as unknown as Response;

  console.log('Simulating Twilio webhook call for omar otbi...');
  await WebhookController.handleWebhook(req, res, (err) => {
    if (err) console.error('Next error:', err);
  });
}

test()
  .catch(console.error)
  .finally(async () => {
    await prisma.$disconnect();
  });
