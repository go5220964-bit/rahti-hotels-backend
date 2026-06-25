import { WhatsAppService } from './src/services/whatsapp.service';
import prisma from './src/services/prisma';

async function run() {
  console.log('🧪 Simulating webhook message "طلب" from +966563104828...');
  try {
    const response1 = await WhatsAppService.processMessage({
      senderNumber: '966563104828',
      senderName: 'omar otbi',
      messageId: 'test-msg-1',
      timestamp: Math.floor(Date.now() / 1000),
      messageType: 'text',
      text: 'طلب'
    });
    console.log('✅ Response for "طلب":');
    console.log(response1);

    console.log('\n🧪 Simulating webhook selection "1" (Maintenance)...');
    const response2 = await WhatsAppService.processMessage({
      senderNumber: '966563104828',
      senderName: 'omar otbi',
      messageId: 'test-msg-2',
      timestamp: Math.floor(Date.now() / 1000),
      messageType: 'text',
      text: '1'
    });
    console.log('✅ Response for "1":');
    console.log(response2);

    console.log('\n🧪 Simulating direct location share rejection...');
    const response3 = await WhatsAppService.processMessage({
      senderNumber: '966563104828',
      senderName: 'omar otbi',
      messageId: 'test-msg-3',
      timestamp: Math.floor(Date.now() / 1000),
      messageType: 'location',
      latitude: 21.43,
      longitude: 39.82
    });
    console.log('✅ Response for location:');
    console.log(response3);

    console.log('\n🧪 Simulating keyword "حضور"...');
    const response4 = await WhatsAppService.processMessage({
      senderNumber: '966563104828',
      senderName: 'omar otbi',
      messageId: 'test-msg-4',
      timestamp: Math.floor(Date.now() / 1000),
      messageType: 'text',
      text: 'حضور'
    });
    console.log('✅ Response for "حضور":');
    console.log(response4);

  } catch (err) {
    console.error('🔴 CRITICAL: WhatsAppService.processMessage failed with error:', err);
  }
}

run()
  .catch(console.error)
  .finally(async () => {
    await prisma.$disconnect();
  });
