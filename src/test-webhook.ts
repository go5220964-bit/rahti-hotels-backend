import app from './app';
import prisma from './services/prisma';
import { RequestStatus, ApprovalStatus, RequestType } from './types';
import { WebhookController } from './controllers/webhook.controller';
import jwt from 'jsonwebtoken';

const PORT = 3006;

// Mock payload generators
const generateTextPayload = (from: string, name: string, body: string, messageId: string) => ({
  object: 'whatsapp_business_account',
  entry: [
    {
      id: 'waba_123',
      changes: [
        {
          field: 'messages',
          value: {
            messaging_product: 'whatsapp',
            metadata: {
              display_phone_number: '16505553333',
              phone_number_id: 'phone_123',
            },
            contacts: [
              {
                profile: { name },
                wa_id: from.replace('+', ''),
              },
            ],
            messages: [
              {
                from,
                id: messageId,
                timestamp: Math.floor(Date.now() / 1000).toString(),
                type: 'text',
                text: { body },
              },
            ],
          },
        },
      ],
    },
  ],
});

const generateButtonPayload = (from: string, name: string, buttonId: string, buttonTitle: string, messageId: string) => ({
  object: 'whatsapp_business_account',
  entry: [
    {
      id: 'waba_123',
      changes: [
        {
          field: 'messages',
          value: {
            messaging_product: 'whatsapp',
            metadata: {
              display_phone_number: '16505553333',
              phone_number_id: 'phone_123',
            },
            contacts: [
              {
                profile: { name },
                wa_id: from.replace('+', ''),
              },
            ],
            messages: [
              {
                from,
                id: messageId,
                timestamp: Math.floor(Date.now() / 1000).toString(),
                type: 'interactive',
                interactive: {
                  type: 'button_reply',
                  button_reply: { id: buttonId, title: buttonTitle },
                },
              },
            ],
          },
        },
      ],
    },
  ],
});

const generateImagePayload = (from: string, name: string, mediaId: string, caption: string, messageId: string) => ({
  object: 'whatsapp_business_account',
  entry: [
    {
      id: 'waba_123',
      changes: [
        {
          field: 'messages',
          value: {
            messaging_product: 'whatsapp',
            metadata: {
              display_phone_number: '16505553333',
              phone_number_id: 'phone_123',
            },
            contacts: [
              {
                profile: { name },
                wa_id: from.replace('+', ''),
              },
            ],
            messages: [
              {
                from,
                id: messageId,
                timestamp: Math.floor(Date.now() / 1000).toString(),
                type: 'image',
                image: {
                  id: mediaId,
                  mime_type: 'image/jpeg',
                  sha256: 'xyz_sha256',
                  caption,
                },
              },
            ],
          },
        },
      ],
    },
  ],
});

async function runTests() {
  console.log('🧪 Starting Advanced Arabic Webhook Integration Tests...');

  // Set up fetch interceptor for authentication
  const originalFetch = global.fetch;
  global.fetch = async (input: RequestInfo | URL, init?: RequestInit) => {
    const urlStr = typeof input === 'string' ? input : input.toString();
    
    // Only intercept local API requests (except public endpoints)
    if (urlStr.includes(`/api/`) && !urlStr.includes('/api/whatsapp-webhook') && !urlStr.includes('/api/auth/login')) {
      init = init || {};
      const headers = (init.headers || {}) as any;
      if (headers['X-Bypass-Auth'] === 'true') {
        delete headers['X-Bypass-Auth'];
        init.headers = headers;
        return originalFetch(input, init);
      }

      // Find the user to generate token for
      let targetUser = null;
      
      if (init.body) {
        try {
          const body = JSON.parse(init.body as string);
          const userId = body.userId || body.reportedBy || body.reviewerId || body.changedById || body.requestedBy;
          if (userId) {
            targetUser = await prisma.user.findUnique({ where: { id: userId } });
          }
        } catch (e) {
          // ignore parsing error
        }
      }
      
      // Fallback: If no user found in body, default to Admin
      if (!targetUser) {
        targetUser = await prisma.user.findFirst({
          where: { role: 'Admin' }
        });
      }
      
      if (targetUser) {
        const payload = {
          userId: targetUser.id,
          role: targetUser.role,
          branchId: targetUser.branchId,
          name: targetUser.name,
        };
        const token = jwt.sign(payload, 'rahti-secret-2026', { expiresIn: '7d' });
        
        init.headers = {
          ...headers,
          'Authorization': `Bearer ${token}`
        };
      }
    }
    
    return originalFetch(input, init);
  };

  // Start Express Server
  const server = app.listen(PORT, () => {
    console.log(`📡 Local Test Server running on http://localhost:${PORT}`);
  });

  try {
    // -------------------------------------------------------------
    // Test 1: Verify WhatsApp Webhook Handshake (GET)
    // -------------------------------------------------------------
    console.log('\n--- 1. Testing Webhook Handshake Verification (GET) ---');
    const verifyToken = 'super-secret-verify-token-123';
    const challengeVal = 'test-challenge-12345';
    
    const verifyRes = await fetch(
      `http://localhost:${PORT}/api/whatsapp-webhook?hub.mode=subscribe&hub.verify_token=${verifyToken}&hub.challenge=${challengeVal}`
    );
    const verifyText = await verifyRes.text();
    
    if (verifyRes.status === 200 && verifyText === challengeVal) {
      console.log('✅ PASS: Webhook Handshake verified successfully.');
    } else {
      throw new Error(`FAIL: Handshake failed. Status: ${verifyRes.status}, Text: ${verifyText}`);
    }

    // Fetch seeded users
    const users = await prisma.user.findMany();
    const lara = users.find(u => u.name === 'Lara Croft')!;      // Receptionist (+1234567894)
    const elena = users.find(u => u.name === 'Elena Petrova')!;  // CEO (+1234567891)
    const thomas = users.find(u => u.name === 'Thomas Miller')!; // Technician (+1234567893)

    // -------------------------------------------------------------
    // Test 2: Trigger List Menu by sending keyword "طلب"
    // -------------------------------------------------------------
    console.log('\n--- 2. Testing Interactive Menu Trigger (POST "طلب") ---');
    const menuRes = await fetch(`http://localhost:${PORT}/api/whatsapp-webhook`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(generateTextPayload(lara.phoneNumber, lara.name, 'طلب', 'wamid.test_menu_01')),
    });
    
    if (menuRes.status === 200) {
      console.log('✅ PASS: Interactive List Menu successfully triggered.');
    } else {
      throw new Error(`FAIL: Menu trigger returned ${menuRes.status}`);
    }

    // -------------------------------------------------------------
    // Test 3: Create a Maintenance Request using Arabic prefix
    // -------------------------------------------------------------
    console.log('\n--- 3. Testing Arabic Request Creation (POST text) ---');
    const requestText = 'صيانة: تسريب مياه شديد من صنبور الحمام في الغرفة 502';
    
    const reqCreateRes = await fetch(`http://localhost:${PORT}/api/whatsapp-webhook`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(generateTextPayload(lara.phoneNumber, lara.name, requestText, 'wamid.test_create_02')),
    });

    if (reqCreateRes.status !== 200) {
      throw new Error(`FAIL: Request creation returned status ${reqCreateRes.status}`);
    }

    // Verify request in DB
    const newRequest = await prisma.request.findFirst({
      where: { reporterId: lara.id },
      orderBy: { createdAt: 'desc' }
    });

    if (newRequest && newRequest.description.includes('الغرفة 502')) {
      console.log(`✅ PASS: Request created in DB: ID [${newRequest.id}]`);
      console.log(`   Type: ${newRequest.requestType}, Status: ${newRequest.status}, Approval: ${newRequest.approvalStatus}`);
    } else {
      throw new Error('FAIL: Request was not found in the database.');
    }

    // -------------------------------------------------------------
    // Test 4: Procurement Threshold routing test
    // -------------------------------------------------------------
    console.log('\n--- 4. Testing Procurement Threshold Routing ($7,500) ---');
    const procText = 'مشتريات: أثاث ترقية بهو الاستقبال الرئيسي (سعر: 7500)';
    
    const procCreateRes = await fetch(`http://localhost:${PORT}/api/whatsapp-webhook`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(generateTextPayload(lara.phoneNumber, lara.name, procText, 'wamid.test_proc_03')),
    });

    if (procCreateRes.status !== 200) {
      throw new Error(`FAIL: Procurement returned status ${procCreateRes.status}`);
    }

    // Verify procurement in DB and check CEO escalation
    const procRequest = await prisma.request.findFirst({
      where: { requestType: RequestType.Procurement, estimatedCost: 7500 },
      orderBy: { createdAt: 'desc' }
    });

    if (procRequest && procRequest.approvalStatus === ApprovalStatus.Pending_CEO) {
      console.log(`✅ PASS: Procurement request exceeding $5,000 correctly routed to Pending_CEO.`);
    } else {
      throw new Error(`FAIL: Procurement request not routed correctly. Status: ${procRequest?.approvalStatus}`);
    }

    // -------------------------------------------------------------
    // Test 5: Full Dual-Closure Workflow & Rating Collection
    // -------------------------------------------------------------
    console.log('\n--- 5. Testing Dual-Closure Flow & Rating Collection ( Thomas & Lara ) ---');
    
    // Assign request to Thomas and set status to In_Progress
    await prisma.request.update({
      where: { id: newRequest.id },
      data: { assignedToId: thomas.id, status: RequestStatus.In_Progress }
    });

    // Step 5a: Technician (Thomas) clicks Completed button
    console.log('   Step 5a: Technician clicks complete button...');
    const compButtonRes = await fetch(`http://localhost:${PORT}/api/whatsapp-webhook`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(generateButtonPayload(
        thomas.phoneNumber,
        thomas.name,
        `complete_req_${newRequest.id}`,
        'إتمام المهمة',
        'wamid.test_comp_btn_04'
      )),
    });

    if (compButtonRes.status !== 200) {
      throw new Error(`FAIL: Tech completion click failed: ${compButtonRes.status}`);
    }

    // Step 5b: Technician uploads completion image
    console.log('   Step 5b: Technician uploads image attachment...');
    const imageRes = await fetch(`http://localhost:${PORT}/api/whatsapp-webhook`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(generateImagePayload(
        thomas.phoneNumber,
        thomas.name,
        'media_after_fixture_9988',
        'after',
        'wamid.test_media_05'
      )),
    });

    if (imageRes.status !== 200) {
      throw new Error(`FAIL: Tech image upload failed: ${imageRes.status}`);
    }

    // Verify DB request is now Awaiting_Confirmation
    let updatedRequest = await prisma.request.findUnique({ where: { id: newRequest.id } });
    if (updatedRequest && updatedRequest.status === RequestStatus.Awaiting_Confirmation && updatedRequest.afterImageUrl) {
      console.log(`   └ DB Status: Awaiting_Confirmation | Image attached.`);
    } else {
      throw new Error(`FAIL: DB status did not change to Awaiting_Confirmation. Status: ${updatedRequest?.status}`);
    }

    // Step 5c: Original Reporter (Lara) clicks Yes, Confirmed
    console.log('   Step 5c: Reporter clicks "Yes, Confirmed"...');
    const confirmYesRes = await fetch(`http://localhost:${PORT}/api/whatsapp-webhook`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(generateButtonPayload(
        lara.phoneNumber,
        lara.name,
        `reporter_confirm_yes_${newRequest.id}`,
        'نعم، تم الإصلاح',
        'wamid.test_confirm_yes_06'
      )),
    });

    if (confirmYesRes.status !== 200) {
      throw new Error(`FAIL: Reporter confirmation returned ${confirmYesRes.status}`);
    }

    // Step 5d: Reporter sends rating "5" via text message
    console.log('   Step 5d: Reporter sends rating "5" to close ticket...');
    const ratingRes = await fetch(`http://localhost:${PORT}/api/whatsapp-webhook`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(generateTextPayload(lara.phoneNumber, lara.name, '5', 'wamid.test_rating_07')),
    });

    if (ratingRes.status !== 200) {
      throw new Error(`FAIL: Rating payload returned status ${ratingRes.status}`);
    }

    // Verify request is Completed and has 5 rating
    updatedRequest = await prisma.request.findUnique({ where: { id: newRequest.id } });
    if (updatedRequest && updatedRequest.status === RequestStatus.Completed && updatedRequest.rating === 5) {
      console.log('✅ PASS: Dual-closure flow succeeded. Request closed with 5-star rating.');
    } else {
      throw new Error(`FAIL: Request did not close with rating. Status: ${updatedRequest?.status}, Rating: ${updatedRequest?.rating}`);
    }

    // -------------------------------------------------------------
    // Test 6: Rejection & Reopened State Flow Test
    // -------------------------------------------------------------
    console.log('\n--- 6. Testing Rejection & Reopened State Flow ---');
    
    // Create new request
    const rejectReq = await prisma.request.create({
      data: {
        requestType: RequestType.Maintenance,
        status: RequestStatus.In_Progress,
        branchId: newRequest.branchId,
        description: 'صيانة: العطل في الغلاية رقم 3',
        reporterId: lara.id,
        assignedToId: thomas.id,
      }
    });

    // Step 6a: Technician completes it
    await prisma.request.update({
      where: { id: rejectReq.id },
      data: {
        status: RequestStatus.Awaiting_Confirmation,
        afterImageUrl: 'https://media.rahtihotels.com/media/media_after_boiler.jpeg'
      }
    });

    // Step 6b: Supervisor Lara Croft clicks Rejection Button
    console.log('   Step 6b: Supervisor clicks "❌ طلب إعادة عمل"...');
    const rejectButtonRes = await fetch(`http://localhost:${PORT}/api/whatsapp-webhook`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(generateButtonPayload(
        lara.phoneNumber,
        lara.name,
        `reporter_confirm_no_${rejectReq.id}`,
        '❌ طلب إعادة عمل',
        'wamid.test_reject_btn_08'
      )),
    });

    if (rejectButtonRes.status !== 200) {
      throw new Error(`FAIL: Rejection button click failed: ${rejectButtonRes.status}`);
    }

    // Step 6c: Supervisor sends rejection reason text note
    console.log('   Step 6c: Supervisor sends rejection reason note...');
    const reasonText = 'الماء لا يزال بارداً والغلاية تفصل بعد دقيقة';
    const reasonRes = await fetch(`http://localhost:${PORT}/api/whatsapp-webhook`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(generateTextPayload(lara.phoneNumber, lara.name, reasonText, 'wamid.test_reject_reason_09')),
    });

    if (reasonRes.status !== 200) {
      throw new Error(`FAIL: Rejection reason submission failed: ${reasonRes.status}`);
    }

    // Verify DB request is now Reopened and has count & reason set
    const finalRejectReq = await prisma.request.findUnique({ where: { id: rejectReq.id } });
    if (
      finalRejectReq &&
      finalRejectReq.status === RequestStatus.Reopened &&
      finalRejectReq.rejectionReason === reasonText &&
      finalRejectReq.rejectionCount === 1 &&
      finalRejectReq.assignedToId === thomas.id
    ) {
      console.log('✅ PASS: Rejection & Reopened flow verification succeeded!');
      console.log(`   Status: ${finalRejectReq.status}, Reason: "${finalRejectReq.rejectionReason}", Count: ${finalRejectReq.rejectionCount}`);
    } else {
      throw new Error(
        `FAIL: Request not reopened correctly. Status: ${finalRejectReq?.status}, Reason: "${finalRejectReq?.rejectionReason}", Count: ${finalRejectReq?.rejectionCount}`
      );
    }

    // -------------------------------------------------------------
    // Test 7: 3-Tier External Procurement Workflow
    // -------------------------------------------------------------
    console.log('\n--- 7. Testing 3-Tier External Procurement Workflow ---');

    // Step 7a: Technician Thomas clicks "🛒 طلب شراء خارجي" button
    console.log('   Step 7a: Technician triggers external procurement...');
    const startProcRes = await fetch(`http://localhost:${PORT}/api/whatsapp-webhook`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(generateButtonPayload(
        thomas.phoneNumber,
        thomas.name,
        `start_external_procurement_${lara.branchId}`,
        '🛒 طلب شراء خارجي',
        'wamid.test_start_proc_10'
      )),
    });

    if (startProcRes.status !== 200) {
      throw new Error(`FAIL: Start procurement click failed: ${startProcRes.status}`);
    }

    // Step 7b: Technician Thomas sends item description
    console.log('   Step 7b: Technician sends item description...');
    const itemDesc = 'مضخة مياه إضافية لفرع طريق السيل';
    const itemDescRes = await fetch(`http://localhost:${PORT}/api/whatsapp-webhook`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(generateTextPayload(thomas.phoneNumber, thomas.name, itemDesc, 'wamid.test_item_desc_11')),
    });

    if (itemDescRes.status !== 200) {
      throw new Error(`FAIL: Item description submission failed: ${itemDescRes.status}`);
    }

    // Step 7c: Procurement Officer Marcus Vance (+1234567895) receives it and replies with cost "450"
    const marcus = users.find(u => u.name === 'Marcus Vance')!;
    console.log('   Step 7c: Procurement Officer sends cost estimate...');
    const costRes = await fetch(`http://localhost:${PORT}/api/whatsapp-webhook`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(generateTextPayload(marcus.phoneNumber, marcus.name, '450', 'wamid.test_proc_cost_12')),
    });

    if (costRes.status !== 200) {
      throw new Error(`FAIL: Cost estimate submission failed: ${costRes.status}`);
    }

    // Verify request is created in DB and has estimatedCost 450
    const dbProcReq = await prisma.request.findFirst({
      where: {
        requestType: RequestType.Procurement,
        description: `شراء خارجي: ${itemDesc}`
      },
      orderBy: { createdAt: 'desc' }
    });

    if (!dbProcReq || dbProcReq.estimatedCost !== 450) {
      throw new Error(`FAIL: Request was not created in DB with correct cost. Cost: ${dbProcReq?.estimatedCost}`);
    }
    console.log(`   └ DB Request created: ID [${dbProcReq.id}] | Cost: ${dbProcReq.estimatedCost}`);

    // Step 7d: Financial Manager Sarah Conners (+1234567892) clicks "✅ تعميد مالي"
    const sarah = users.find(u => u.name === 'Sarah Conners')!;
    console.log('   Step 7d: Financial Manager approves the procurement request...');
    const fmApproveRes = await fetch(`http://localhost:${PORT}/api/whatsapp-webhook`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(generateButtonPayload(
        sarah.phoneNumber,
        sarah.name,
        `approve_proc_${dbProcReq.id}`,
        '✅ تعميد مالي',
        'wamid.test_fm_approve_13'
      )),
    });

    if (fmApproveRes.status !== 200) {
      throw new Error(`FAIL: FM approval click failed: ${fmApproveRes.status}`);
    }

    // Verify request status is Approved in DB
    const finalProcReq = await prisma.request.findUnique({ where: { id: dbProcReq.id } });
    if (finalProcReq && finalProcReq.approvalStatus === ApprovalStatus.Approved) {
      console.log('✅ PASS: 3-Tier External Procurement Workflow completed successfully!');
    } else {
      throw new Error(`FAIL: Request not approved by Financial Manager. Status: ${finalProcReq?.approvalStatus}`);
    }

    // -------------------------------------------------------------
    // Test 8: Verify Shift Report Guided Wizard & Accountant Rejection Workflow
    // -------------------------------------------------------------
    console.log('\n--- 8. Testing Shift Report (التقفيلة) Workflow ---');

    // Find Receptionist Lara Croft (+1234567894)
    const laraUser = users.find(u => u.name === 'Lara Croft')!;
    
    // Step 8a: Lara triggers shift report via text "تقفيلة"
    console.log('   Step 8a: Lara triggers shift report...');
    const startShiftRes = await fetch(`http://localhost:${PORT}/api/whatsapp-webhook`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(generateTextPayload(laraUser.phoneNumber, laraUser.name, 'تقفيلة', 'wamid.test_shift_start')),
    });
    if (startShiftRes.status !== 200) {
      throw new Error(`FAIL: Start shift report failed: ${startShiftRes.status}`);
    }

    // Step 8b: Lara selects shift '1' (صباحي)
    console.log('   Step 8b: Lara selects morning shift (1)...');
    const selectShiftRes = await fetch(`http://localhost:${PORT}/api/whatsapp-webhook`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(generateTextPayload(laraUser.phoneNumber, laraUser.name, '1', 'wamid.test_shift_select')),
    });
    if (selectShiftRes.status !== 200) {
      throw new Error(`FAIL: Select shift failed: ${selectShiftRes.status}`);
    }

    // Step 8c: Lara inputs cashTotal '1500'
    console.log('   Step 8c: Lara inputs cashTotal (1500)...');
    const cashTotalRes = await fetch(`http://localhost:${PORT}/api/whatsapp-webhook`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(generateTextPayload(laraUser.phoneNumber, laraUser.name, '1500', 'wamid.test_shift_cash_total')),
    });
    if (cashTotalRes.status !== 200) {
      throw new Error(`FAIL: Cash total input failed: ${cashTotalRes.status}`);
    }

    // Step 8d: Lara inputs cashExpenses '100'
    console.log('   Step 8d: Lara inputs cashExpenses (100)...');
    const cashExpensesRes = await fetch(`http://localhost:${PORT}/api/whatsapp-webhook`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(generateTextPayload(laraUser.phoneNumber, laraUser.name, '100', 'wamid.test_shift_cash_expenses')),
    });
    if (cashExpensesRes.status !== 200) {
      throw new Error(`FAIL: Cash expenses input failed: ${cashExpensesRes.status}`);
    }

    // Step 8e: Lara inputs visa '200'
    console.log('   Step 8e: Lara inputs visa (200)...');
    const visaRes = await fetch(`http://localhost:${PORT}/api/whatsapp-webhook`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(generateTextPayload(laraUser.phoneNumber, laraUser.name, '200', 'wamid.test_shift_visa')),
    });
    if (visaRes.status !== 200) {
      throw new Error(`FAIL: Visa input failed: ${visaRes.status}`);
    }

    // Step 8f: Lara inputs mada '300'
    console.log('   Step 8f: Lara inputs mada (300)...');
    const madaRes = await fetch(`http://localhost:${PORT}/api/whatsapp-webhook`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(generateTextPayload(laraUser.phoneNumber, laraUser.name, '300', 'wamid.test_shift_mada')),
    });
    if (madaRes.status !== 200) {
      throw new Error(`FAIL: Mada input failed: ${madaRes.status}`);
    }

    // Step 8g: Lara inputs mastercard '150'
    console.log('   Step 8g: Lara inputs mastercard (150)...');
    const mcRes = await fetch(`http://localhost:${PORT}/api/whatsapp-webhook`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(generateTextPayload(laraUser.phoneNumber, laraUser.name, '150', 'wamid.test_shift_mc')),
    });
    if (mcRes.status !== 200) {
      throw new Error(`FAIL: Mastercard input failed: ${mcRes.status}`);
    }

    // Step 8h: Lara inputs gulfNet '50'
    console.log('   Step 8h: Lara inputs gulfNet (50)...');
    const gulfNetRes = await fetch(`http://localhost:${PORT}/api/whatsapp-webhook`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(generateTextPayload(laraUser.phoneNumber, laraUser.name, '50', 'wamid.test_shift_gulfnet')),
    });
    if (gulfNetRes.status !== 200) {
      throw new Error(`FAIL: GulfNet input failed: ${gulfNetRes.status}`);
    }

    // Step 8i: Lara inputs tabby '100'
    console.log('   Step 8i: Lara inputs tabby (100)...');
    const tabbyRes = await fetch(`http://localhost:${PORT}/api/whatsapp-webhook`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(generateTextPayload(laraUser.phoneNumber, laraUser.name, '100', 'wamid.test_shift_tabby')),
    });
    if (tabbyRes.status !== 200) {
      throw new Error(`FAIL: Tabby input failed: ${tabbyRes.status}`);
    }

    // Step 8j: Lara inputs bankTransfer '400'
    console.log('   Step 8j: Lara inputs bankTransfer (400) and gets summary...');
    const bankTransferRes = await fetch(`http://localhost:${PORT}/api/whatsapp-webhook`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(generateTextPayload(laraUser.phoneNumber, laraUser.name, '400', 'wamid.test_shift_bank')),
    });
    if (bankTransferRes.status !== 200) {
      throw new Error(`FAIL: Bank transfer input failed: ${bankTransferRes.status}`);
    }

    // Step 8k: Lara clicks "✅ إرسال التقفيلة"
    console.log('   Step 8k: Lara confirms shift report submission...');
    const confirmShiftRes = await fetch(`http://localhost:${PORT}/api/whatsapp-webhook`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(generateButtonPayload(
        laraUser.phoneNumber,
        laraUser.name,
        'confirm_shift_submit',
        '✅ إرسال التقفيلة',
        'wamid.test_shift_confirm'
      )),
    });
    if (confirmShiftRes.status !== 200) {
      throw new Error(`FAIL: Shift confirmation failed: ${confirmShiftRes.status}`);
    }

    // Verify report created in DB
    const dbReport = await prisma.shiftReport.findFirst({
      where: { reporterId: laraUser.id, shiftLabel: 'صباحي' },
      orderBy: { createdAt: 'desc' },
    });
    if (!dbReport || dbReport.grandTotal !== 2600 || dbReport.cashNet !== 1400) {
      throw new Error(`FAIL: Shift report was not created correctly in DB. CashNet: ${dbReport?.cashNet}, GrandTotal: ${dbReport?.grandTotal}`);
    }
    console.log(`   └ DB Shift Report created: ID [${dbReport.id}] | CashNet: ${dbReport.cashNet} | GrandTotal: ${dbReport.grandTotal}`);

    // Step 8l: Accountant (+1234567896) clicks "❌ رفض"
    const accountantUser = users.find(u => u.role === 'Accountant' || u.phoneNumber === '+1234567896')!;
    console.log('   Step 8l: Accountant clicks Reject button...');
    const rejectClickRes = await fetch(`http://localhost:${PORT}/api/whatsapp-webhook`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(generateButtonPayload(
        accountantUser.phoneNumber,
        accountantUser.name,
        `reject_shift_${dbReport.id}`,
        '❌ رفض',
        'wamid.test_shift_reject_click'
      )),
    });
    if (rejectClickRes.status !== 200) {
      throw new Error(`FAIL: Accountant reject click failed: ${rejectClickRes.status}`);
    }

    // Step 8m: Accountant sends rejection reason "يوجد خطأ في مبلغ مدى"
    console.log('   Step 8m: Accountant sends rejection reason text...');
    const srReasonText = 'يوجد خطأ في مبلغ مدى';
    const rejectReasonRes = await fetch(`http://localhost:${PORT}/api/whatsapp-webhook`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(generateTextPayload(
        accountantUser.phoneNumber,
        accountantUser.name,
        srReasonText,
        'wamid.test_shift_reject_reason'
      )),
    });
    if (rejectReasonRes.status !== 200) {
      throw new Error(`FAIL: Rejection reason text input failed: ${rejectReasonRes.status}`);
    }

    // Verify report status in DB is Rejected with rejectionReason
    const finalReport = await prisma.shiftReport.findUnique({ where: { id: dbReport.id } });
    if (finalReport && finalReport.status === 'Rejected' && finalReport.rejectionReason === srReasonText) {
      console.log('✅ PASS: Shift Report (التقفيلة) guided wizard & Accountant Rejection Workflow verified successfully!');
    } else {
      throw new Error(`FAIL: Shift report not marked as Rejected with correct reason. Status: ${finalReport?.status}, Reason: ${finalReport?.rejectionReason}`);
    }

    // -------------------------------------------------------------
    // Test 9: Shift Report API CRUD & Validation Workflow
    // -------------------------------------------------------------
    console.log('\n--- 9. Testing Shift Report API CRUD & Validation Workflow ---');
    const testLara = users.find(u => u.name === 'Lara Croft')!;
    console.log('   Step 9a: Creating a new shift report via API...');
    const createReportRes = await fetch(`http://localhost:${PORT}/api/shift-reports`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        reporterId: testLara.id,
        branchId: testLara.branchId,
        shiftLabel: 'مسائي',
        cashTotal: 1000,
        cashExpenses: 100,
        visa: 200,
        mada: 150,
        mastercard: 50,
        gulfNet: 0,
        tabby: 0,
        bankTransfer: 100
      })
    });
    if (createReportRes.status !== 201) {
      throw new Error(`FAIL: Shift report creation failed: ${createReportRes.status}`);
    }
    const createData = (await createReportRes.json() as any).data;
    if (createData.cashNet !== 900 || createData.grandTotal !== 1400) {
      throw new Error(`FAIL: Created report has incorrect computed values. CashNet: ${createData.cashNet}, GrandTotal: ${createData.grandTotal}`);
    }
    console.log(`   └ Created report ID [${createData.id}] | CashNet: ${createData.cashNet} | GrandTotal: ${createData.grandTotal}`);

    // Edit and verify re-calculations: PATCH /api/shift-reports/:id
    console.log('   Step 9b: Updating shift report via PATCH API...');
    const updateReportRes = await fetch(`http://localhost:${PORT}/api/shift-reports/${createData.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        cashTotal: 1200, // CashNet: 1200 - 100 = 1100
        visa: 300 // GrandTotal: 1100 + 300 + 150 + 50 + 0 + 0 + 100 = 1700
      })
    });
    if (updateReportRes.status !== 200) {
      throw new Error(`FAIL: Shift report update failed: ${updateReportRes.status}`);
    }
    const updateData = (await updateReportRes.json() as any).data;
    if (updateData.cashNet !== 1100 || updateData.grandTotal !== 1700) {
      throw new Error(`FAIL: Updated report has incorrect computed values. CashNet: ${updateData.cashNet}, GrandTotal: ${updateData.grandTotal}`);
    }
    console.log(`   └ Updated report | CashNet: ${updateData.cashNet} | GrandTotal: ${updateData.grandTotal}`);

    // Approve the report so we can test validation constraints (Approved reports cannot be updated)
    console.log('   Step 9c: Approving report via API...');
    const sarahConners = users.find(u => (u.role as string) === 'FinancialManager' || (u.role as string) === 'FinanceManager' || u.name === 'Sarah Conners')!;
    const approveRes = await fetch(`http://localhost:${PORT}/api/shift-reports/${createData.id}/approve`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ reviewerId: sarahConners.id })
    });
    if (approveRes.status !== 200) {
      throw new Error(`FAIL: Shift report approval failed: ${approveRes.status}`);
    }
    console.log('   Step 9d: Attempting to update Approved report (expecting 403)...');
    const updateApprovedRes = await fetch(`http://localhost:${PORT}/api/shift-reports/${createData.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ cashTotal: 1500 })
    });
    if (updateApprovedRes.status !== 403) {
      throw new Error(`FAIL: Allowed updating approved report. Status: ${updateApprovedRes.status}`);
    }
    console.log('   └ Successfully rejected update with 403.');

    // Attempt to delete Approved report (expecting 403)
    console.log('   Step 9e: Attempting to delete Approved report (expecting 403)...');
    const deleteApprovedRes = await fetch(`http://localhost:${PORT}/api/shift-reports/${createData.id}`, {
      method: 'DELETE'
    });
    if (deleteApprovedRes.status !== 403) {
      throw new Error(`FAIL: Allowed deleting approved report. Status: ${deleteApprovedRes.status}`);
    }
    console.log('   └ Successfully rejected deletion with 403.');

    // Now, create another report and delete it while it's still PendingAccountant
    console.log('   Step 9f: Creating temporary report to test deletion...');
    const createTempReportRes = await fetch(`http://localhost:${PORT}/api/shift-reports`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        reporterId: testLara.id,
        branchId: testLara.branchId,
        shiftLabel: 'ليلي',
        cashTotal: 500,
        cashExpenses: 50,
        visa: 0,
        mada: 0,
        mastercard: 0,
        gulfNet: 0,
        tabby: 0,
        bankTransfer: 0
      })
    });
    const tempReportData = (await createTempReportRes.json() as any).data;
    
    console.log('   Step 9g: Deleting PendingAccountant report...');
    const deleteTempRes = await fetch(`http://localhost:${PORT}/api/shift-reports/${tempReportData.id}`, {
      method: 'DELETE'
    });
    if (deleteTempRes.status !== 200) {
      throw new Error(`FAIL: Failed to delete PendingAccountant report. Status: ${deleteTempRes.status}`);
    }
    console.log('   └ Successfully deleted report.');

    // Verify it's gone
    const findDeleted = await prisma.shiftReport.findUnique({ where: { id: tempReportData.id } });
    if (findDeleted) {
      throw new Error('FAIL: Report was not actually deleted from database.');
    }
    console.log('✅ PASS: Shift Report CRUD validation workflow verified successfully!');

    // -------------------------------------------------------------
    // Test 10: Loan Requests Workflow (طلب سلفة)
    // -------------------------------------------------------------
    console.log('\n--- 10. Testing Loan Requests Workflow (طلب سلفة) ---');
    
    // Step 10a: Employee Lara sends "طلب سلفة"
    console.log('   Step 10a: Employee sends "طلب سلفة"...');
    const loanTriggerRes = await fetch(`http://localhost:${PORT}/api/whatsapp-webhook`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(generateTextPayload(lara.phoneNumber, lara.name, 'طلب سلفة', 'wamid.loan_01')),
    });
    if (loanTriggerRes.status !== 200) {
      throw new Error(`FAIL: Loan trigger returned ${loanTriggerRes.status}`);
    }

    // Step 10b: Employee sends amount 500
    console.log('   Step 10b: Employee sends amount 500...');
    const loanAmountRes = await fetch(`http://localhost:${PORT}/api/whatsapp-webhook`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(generateTextPayload(lara.phoneNumber, lara.name, '500', 'wamid.loan_02')),
    });
    if (loanAmountRes.status !== 200) {
      throw new Error(`FAIL: Loan amount returned ${loanAmountRes.status}`);
    }

    // Step 10c: Employee sends reason "مصاريف شخصية طارئة"
    console.log('   Step 10c: Employee sends reason...');
    const loanReasonRes = await fetch(`http://localhost:${PORT}/api/whatsapp-webhook`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(generateTextPayload(lara.phoneNumber, lara.name, 'مصاريف شخصية طارئة', 'wamid.loan_03')),
    });
    if (loanReasonRes.status !== 200) {
      throw new Error(`FAIL: Loan reason returned ${loanReasonRes.status}`);
    }

    // Step 10d: Employee clicks confirm button
    console.log('   Step 10d: Employee confirms request...');
    const loanConfirmRes = await fetch(`http://localhost:${PORT}/api/whatsapp-webhook`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(generateButtonPayload(lara.phoneNumber, lara.name, 'confirm_loan_submit', 'تأكيد', 'wamid.loan_04')),
    });
    if (loanConfirmRes.status !== 200) {
      throw new Error(`FAIL: Loan confirmation returned ${loanConfirmRes.status}`);
    }

    // Verify Pending request in DB
    const pendingLoan = await prisma.loanRequest.findFirst({
      where: { employeeId: lara.id, status: 'Pending', amount: 500 },
      orderBy: { createdAt: 'desc' }
    });
    if (!pendingLoan) {
      throw new Error('FAIL: LoanRequest was not saved as Pending in DB');
    }
    console.log(`   └ LoanRequest saved as Pending with ID [${pendingLoan.id}]`);

    // Step 10e: Accountant rejects the loan request
    console.log('   Step 10e: Accountant clicks reject button...');
    const testAccountant = users.find(u => u.role === 'Accountant')!;
    const loanRejectBtnRes = await fetch(`http://localhost:${PORT}/api/whatsapp-webhook`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(generateButtonPayload(testAccountant.phoneNumber, testAccountant.name, `reject_loan_req_${pendingLoan.id}`, 'رفض', 'wamid.loan_05')),
    });
    if (loanRejectBtnRes.status !== 200) {
      throw new Error(`FAIL: Loan rejection trigger returned ${loanRejectBtnRes.status}`);
    }

    // Step 10f: Accountant inputs rejection reason
    console.log('   Step 10f: Accountant inputs reason "المبلغ يتجاوز الحد المسموح"...');
    const loanRejectReasonRes = await fetch(`http://localhost:${PORT}/api/whatsapp-webhook`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(generateTextPayload(testAccountant.phoneNumber, testAccountant.name, 'المبلغ يتجاوز الحد المسموح', 'wamid.loan_06')),
    });
    if (loanRejectReasonRes.status !== 200) {
      throw new Error(`FAIL: Loan rejection reason submission returned ${loanRejectReasonRes.status}`);
    }

    // Verify Rejected status and note in DB
    const rejectedLoan = await prisma.loanRequest.findUnique({ where: { id: pendingLoan.id } });
    if (!rejectedLoan || rejectedLoan.status !== 'Rejected' || rejectedLoan.notes !== 'المبلغ يتجاوز الحد المسموح') {
      throw new Error(`FAIL: LoanRequest status not updated to Rejected or note mismatch. Status: ${rejectedLoan?.status}, Note: ${rejectedLoan?.notes}`);
    }
    console.log('   └ Successfully updated LoanRequest to Rejected with reason in DB.');


    // -------------------------------------------------------------
    // Test 11: Leave Requests Workflow (طلب إجازة)
    // -------------------------------------------------------------
    console.log('\n--- 11. Testing Leave Requests Workflow (طلب إجازة) ---');

    // Step 11a: Employee sends "طلب إجازة"
    console.log('   Step 11a: Employee sends "طلب إجازة"...');
    const leaveTriggerRes = await fetch(`http://localhost:${PORT}/api/whatsapp-webhook`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(generateTextPayload(lara.phoneNumber, lara.name, 'طلب إجازة', 'wamid.leave_01')),
    });
    if (leaveTriggerRes.status !== 200) {
      throw new Error(`FAIL: Leave trigger returned ${leaveTriggerRes.status}`);
    }

    // Step 11b: Employee chooses Annual (1)
    console.log('   Step 11b: Employee selects Annual (1)...');
    const leaveTypeRes = await fetch(`http://localhost:${PORT}/api/whatsapp-webhook`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(generateTextPayload(lara.phoneNumber, lara.name, '1', 'wamid.leave_02')),
    });
    if (leaveTypeRes.status !== 200) {
      throw new Error(`FAIL: Leave type selection returned ${leaveTypeRes.status}`);
    }

    // Step 11c: Employee inputs start date (YYYY-MM-DD) - next week 2026-06-25
    console.log('   Step 11c: Employee inputs start date "2026-06-25"...');
    const leaveStartRes = await fetch(`http://localhost:${PORT}/api/whatsapp-webhook`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(generateTextPayload(lara.phoneNumber, lara.name, '2026-06-25', 'wamid.leave_03')),
    });
    if (leaveStartRes.status !== 200) {
      throw new Error(`FAIL: Leave start date returned ${leaveStartRes.status}`);
    }

    // Step 11d: Employee inputs end date (YYYY-MM-DD) - next week 2026-06-27 (3 days: 25, 26, 27)
    console.log('   Step 11d: Employee inputs end date "2026-06-27"...');
    const leaveEndRes = await fetch(`http://localhost:${PORT}/api/whatsapp-webhook`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(generateTextPayload(lara.phoneNumber, lara.name, '2026-06-27', 'wamid.leave_04')),
    });
    if (leaveEndRes.status !== 200) {
      throw new Error(`FAIL: Leave end date returned ${leaveEndRes.status}`);
    }

    // Step 11e: Employee inputs reason "إجازة عائلية"
    console.log('   Step 11e: Employee inputs reason...');
    const leaveReasonRes = await fetch(`http://localhost:${PORT}/api/whatsapp-webhook`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(generateTextPayload(lara.phoneNumber, lara.name, 'إجازة عائلية', 'wamid.leave_05')),
    });
    if (leaveReasonRes.status !== 200) {
      throw new Error(`FAIL: Leave reason returned ${leaveReasonRes.status}`);
    }

    // Step 11f: Employee confirms leave request
    console.log('   Step 11f: Employee confirms request...');
    const leaveConfirmRes = await fetch(`http://localhost:${PORT}/api/whatsapp-webhook`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(generateButtonPayload(lara.phoneNumber, lara.name, 'confirm_leave_submit', 'تأكيد', 'wamid.leave_06')),
    });
    if (leaveConfirmRes.status !== 200) {
      throw new Error(`FAIL: Leave confirmation returned ${leaveConfirmRes.status}`);
    }

    // Verify Pending LeaveRequest in DB
    const pendingLeave = await prisma.leaveRequest.findFirst({
      where: { userId: lara.id, status: 'Pending', leaveType: 'Annual', daysCount: 3 },
      orderBy: { createdAt: 'desc' }
    });
    if (!pendingLeave) {
      throw new Error('FAIL: LeaveRequest was not saved as Pending in DB');
    }
    console.log(`   └ LeaveRequest saved as Pending with ID [${pendingLeave.id}]`);


    // -------------------------------------------------------------
    // Test 12: Leave Request Balance Failure
    // -------------------------------------------------------------
    console.log('\n--- 12. Testing Leave Request Balance Failure ---');

    // Step 12a: Employee sends "طلب إجازة"
    await fetch(`http://localhost:${PORT}/api/whatsapp-webhook`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(generateTextPayload(lara.phoneNumber, lara.name, 'طلب إجازة', 'wamid.bal_01')),
    });

    // Step 12b: Employee chooses Annual (1)
    await fetch(`http://localhost:${PORT}/api/whatsapp-webhook`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(generateTextPayload(lara.phoneNumber, lara.name, '1', 'wamid.bal_02')),
    });

    // Step 12c: Employee inputs start date "2026-07-10"
    await fetch(`http://localhost:${PORT}/api/whatsapp-webhook`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(generateTextPayload(lara.phoneNumber, lara.name, '2026-07-10', 'wamid.bal_03')),
    });

    // Step 12d: Employee inputs end date "2026-08-15" (more than 30 days, exceeding Lara's balance of 21)
    console.log('   Step 12d: Employee requests 30+ days (expecting balance check to fail)...');
    WebhookController.sentMessages = []; // Clear sent messages tracker

    const balEndRes = await fetch(`http://localhost:${PORT}/api/whatsapp-webhook`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(generateTextPayload(lara.phoneNumber, lara.name, '2026-08-15', 'wamid.bal_04')),
    });
    
    if (balEndRes.status !== 200) {
      throw new Error(`FAIL: Webhook returned status ${balEndRes.status}`);
    }

    const lastMessage = WebhookController.sentMessages.find(m => m.to === lara.phoneNumber);
    if (!lastMessage) {
      throw new Error('FAIL: No WhatsApp response message was sent back to the employee.');
    }

    const msgText = lastMessage.text;
    if (msgText.includes('رصيد إجازاتك غير كافٍ') || msgText.includes('رصيدك الحالي')) {
      console.log('   └ Correctly rejected with balance warning message.');
    } else {
      throw new Error(`FAIL: Exceeded balance check did not return correct error message. Sent message: "${msgText}"`);
    }

    // -------------------------------------------------------------
    // Test A: Maintenance Request Wizard (New Request)
    // -------------------------------------------------------------
    console.log('\n--- Test A: Testing Maintenance Request Wizard (Lara submits request) ---');
    
    // Fetch newly seeded users for maintenance tests
    const ahmed = users.find(u => u.phoneNumber === '+966501111001')!;
    const khalid = users.find(u => u.phoneNumber === '+966501111002')!;
    const omar = users.find(u => u.phoneNumber === '+966501111003')!;
    const branchManager = users.find(u => u.phoneNumber === '+966501111004')!;

    // Step A1: Lara sends "طلب"
    await fetch(`http://localhost:${PORT}/api/whatsapp-webhook`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(generateTextPayload(lara.phoneNumber, lara.name, 'طلب', 'wamid.mnt_a_01')),
    });

    // Step A2: Lara selects option 1 ( صيانة عامة )
    await fetch(`http://localhost:${PORT}/api/whatsapp-webhook`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(generateTextPayload(lara.phoneNumber, lara.name, '1', 'wamid.mnt_a_02')),
    });

    // Step A3: Lara chooses Category 3 ( AC / تكييف )
    await fetch(`http://localhost:${PORT}/api/whatsapp-webhook`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(generateTextPayload(lara.phoneNumber, lara.name, '3', 'wamid.mnt_a_03')),
    });

    // Step A4: Lara enters Location "غرفة 303"
    await fetch(`http://localhost:${PORT}/api/whatsapp-webhook`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(generateTextPayload(lara.phoneNumber, lara.name, 'غرفة 303', 'wamid.mnt_a_04')),
    });

    // Step A5: Lara enters Description "المكيف ينقط ماء داخل الغرفة"
    await fetch(`http://localhost:${PORT}/api/whatsapp-webhook`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(generateTextPayload(lara.phoneNumber, lara.name, 'المكيف ينقط ماء داخل الغرفة', 'wamid.mnt_a_05')),
    });

    // Step A6: Lara chooses Priority 2 ( High / عالية )
    await fetch(`http://localhost:${PORT}/api/whatsapp-webhook`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(generateTextPayload(lara.phoneNumber, lara.name, '2', 'wamid.mnt_a_06')),
    });

    // Step A7: Lara skips photo upload
    await fetch(`http://localhost:${PORT}/api/whatsapp-webhook`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(generateTextPayload(lara.phoneNumber, lara.name, 'تخطي', 'wamid.mnt_a_07')),
    });

    // Step A8: Lara confirms submission
    WebhookController.sentMessages = []; // Clear notifications log
    const laraConfirmRes = await fetch(`http://localhost:${PORT}/api/whatsapp-webhook`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(generateButtonPayload(lara.phoneNumber, lara.name, 'confirm_maintenance_submit', 'تأكيد البلاغ', 'wamid.mnt_a_08')),
    });

    if (laraConfirmRes.status !== 200) {
      throw new Error(`FAIL: Lara maintenance request confirmation failed with status ${laraConfirmRes.status}`);
    }

    // Verify request in DB
    const mntRequest = await prisma.maintenanceRequest.findFirst({
      where: { reportedBy: lara.id, status: 'New', category: 'AC', location: 'غرفة 303' },
      include: { branch: true }
    });

    if (!mntRequest) {
      throw new Error('FAIL: Maintenance request not saved in database.');
    }
    console.log(`   └ Maintenance request saved successfully as New with ticket number: ${mntRequest.ticketNumber}`);

    // Verify supervisor notification
    const supNotification = WebhookController.sentMessages.find(m => m.to === omar.phoneNumber);
    if (!supNotification) {
      throw new Error('FAIL: MaintenanceSupervisor (Omar) was not notified of the new request.');
    }
    console.log('   └ Supervisor Omar was successfully notified.');

    // -------------------------------------------------------------
    // Test B: Supervisor Assigns Technician & Work Starts
    // -------------------------------------------------------------
    console.log('\n--- Test B: Testing Technician Assignment & Work Start ---');

    // Step B1: Omar clicks assign technician button
    await fetch(`http://localhost:${PORT}/api/whatsapp-webhook`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(generateButtonPayload(omar.phoneNumber, omar.name, `assign_tech_btn_${mntRequest.id}`, 'تعيين فني', 'wamid.mnt_b_01')),
    });

    // Step B2: Omar selects Option 1 (Ahmed)
    WebhookController.sentMessages = [];
    const assignRes = await fetch(`http://localhost:${PORT}/api/whatsapp-webhook`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(generateTextPayload(omar.phoneNumber, omar.name, '1', 'wamid.mnt_b_02')),
    });

    if (assignRes.status !== 200) {
      throw new Error(`FAIL: Technician assignment returned status ${assignRes.status}`);
    }

    // Verify in DB
    let updatedMnt = await prisma.maintenanceRequest.findUnique({
      where: { id: mntRequest.id },
      include: { technician: true }
    });
    if (!updatedMnt || updatedMnt.status !== 'AssignedToTechnician' || !updatedMnt.assignedTo) {
      throw new Error(`FAIL: DB request not updated to AssignedToTechnician or assignee missing. Status: ${updatedMnt?.status}`);
    }
    const assignedTech = updatedMnt.technician!;
    console.log(`   └ DB updated: Status = AssignedToTechnician, AssignedTo = ${assignedTech.name}`);

    // Verify technician notification
    const techNotification = WebhookController.sentMessages.find(m => m.to === assignedTech.phoneNumber);
    if (!techNotification) {
      throw new Error(`FAIL: Technician ${assignedTech.name} was not notified of assignment.`);
    }
    console.log(`   └ Technician ${assignedTech.name} was successfully notified.`);

    // Step B3: Technician starts work
    const startRes = await fetch(`http://localhost:${PORT}/api/whatsapp-webhook`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(generateButtonPayload(assignedTech.phoneNumber, assignedTech.name, `start_work_req_${mntRequest.id}`, 'بدء العمل', 'wamid.mnt_b_03')),
    });

    if (startRes.status !== 200) {
      throw new Error(`FAIL: Start work returned status ${startRes.status}`);
    }

    updatedMnt = await prisma.maintenanceRequest.findUnique({
      where: { id: mntRequest.id },
      include: { technician: true }
    });
    if (!updatedMnt || updatedMnt.status !== 'InProgress') {
      throw new Error(`FAIL: Request status not updated to InProgress. Status: ${updatedMnt?.status}`);
    }
    console.log('   └ DB updated: Status = InProgress');

    // -------------------------------------------------------------
    // Test C: Technician Completion Submission
    // -------------------------------------------------------------
    console.log('\n--- Test C: Testing Technician Completion Submission ---');

    // Step C1: Technician sends "تم MNT-2026-XXXX" (ticketNumber)
    await fetch(`http://localhost:${PORT}/api/whatsapp-webhook`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(generateTextPayload(assignedTech.phoneNumber, assignedTech.name, `تم ${mntRequest.ticketNumber}`, 'wamid.mnt_c_01')),
    });

    // Step C2: Technician sends "بدون صورة"
    await fetch(`http://localhost:${PORT}/api/whatsapp-webhook`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(generateTextPayload(assignedTech.phoneNumber, assignedTech.name, 'بدون صورة', 'wamid.mnt_c_02')),
    });

    // Step C3: Technician sends completion note
    WebhookController.sentMessages = [];
    const completeRes = await fetch(`http://localhost:${PORT}/api/whatsapp-webhook`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(generateTextPayload(assignedTech.phoneNumber, assignedTech.name, 'تم تنظيف خرطوم التصريف وتعبئة الفريون', 'wamid.mnt_c_03')),
    });

    if (completeRes.status !== 200) {
      throw new Error(`FAIL: Submit completion returned status ${completeRes.status}`);
    }

    updatedMnt = await prisma.maintenanceRequest.findUnique({
      where: { id: mntRequest.id },
      include: { technician: true }
    });
    if (!updatedMnt || updatedMnt.status !== 'PendingInternalApproval' || updatedMnt.completionNote !== 'تم تنظيف خرطوم التصريف وتعبئة الفريون') {
      throw new Error(`FAIL: DB request not updated to PendingInternalApproval or note mismatch. Status: ${updatedMnt?.status}, Note: ${updatedMnt?.completionNote}`);
    }
    console.log('   └ DB updated: Status = PendingInternalApproval, completionNote saved');

    // Verify manager notification
    const managerNotification = WebhookController.sentMessages.find(m => m.to === branchManager.phoneNumber);
    if (!managerNotification) {
      throw new Error('FAIL: BranchManager was not notified of completion.');
    }
    console.log('   └ Branch Manager was successfully notified.');

    // -------------------------------------------------------------
    // Test D: BranchManager Approval
    // -------------------------------------------------------------
    console.log('\n--- Test D: Testing BranchManager Approval ---');

    // Step D1: Manager approves completion
    await fetch(`http://localhost:${PORT}/api/whatsapp-webhook`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(generateButtonPayload(branchManager.phoneNumber, branchManager.name, `approve_mnt_completion_${mntRequest.id}`, 'تأكيد الإصلاح', 'wamid.mnt_d_01')),
    });

    // Step D2: Manager inputs "تخطي" for note
    WebhookController.sentMessages = [];
    const approveMntRes = await fetch(`http://localhost:${PORT}/api/whatsapp-webhook`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(generateTextPayload(branchManager.phoneNumber, branchManager.name, 'تخطي', 'wamid.mnt_d_02')),
    });

    if (approveMntRes.status !== 200) {
      throw new Error(`FAIL: Approve completion returned status ${approveMntRes.status}`);
    }

    updatedMnt = await prisma.maintenanceRequest.findUnique({
      where: { id: mntRequest.id },
      include: { technician: true }
    });
    if (!updatedMnt || updatedMnt.status !== 'Closed') {
      throw new Error(`FAIL: DB request status not updated to Closed. Status: ${updatedMnt?.status}`);
    }
    console.log('   └ DB updated: Status = Closed');

    // Verify reporter and technician notifications
    const reporterClosedNotif = WebhookController.sentMessages.find(m => m.to === lara.phoneNumber);
    const techClosedNotif = WebhookController.sentMessages.find(m => m.to === assignedTech.phoneNumber);
    if (!reporterClosedNotif || !techClosedNotif) {
      throw new Error(`FAIL: Parties not notified on closure. Reporter notified: ${!!reporterClosedNotif}, Tech notified: ${!!techClosedNotif}`);
    }
    console.log('   └ Reporter and Technician were successfully notified of closure.');

    // -------------------------------------------------------------
    // Test E: BranchManager Rejection (using Request #3)
    // -------------------------------------------------------------
    console.log('\n--- Test E: Testing BranchManager Rejection ---');

    // Fetch seeded Request #3
    const mnt3 = await prisma.maintenanceRequest.findFirst({
      where: { ticketNumber: 'MNT-2026-0003' }
    });
    if (!mnt3) {
      throw new Error('FAIL: Seeded Maintenance Request MNT-2026-0003 not found in DB');
    }

    // Step E1: Manager clicks reject completion
    await fetch(`http://localhost:${PORT}/api/whatsapp-webhook`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(generateButtonPayload(branchManager.phoneNumber, branchManager.name, `reject_mnt_completion_${mnt3.id}`, 'الإصلاح غير مكتمل', 'wamid.mnt_e_01')),
    });

    // Step E2: Manager inputs rejection reason
    WebhookController.sentMessages = [];
    const rejectRes = await fetch(`http://localhost:${PORT}/api/whatsapp-webhook`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(generateTextPayload(branchManager.phoneNumber, branchManager.name, 'الإصلاح غير مكتمل الباب ما زال يهتز عند الفتح', 'wamid.mnt_e_02')),
    });

    if (rejectRes.status !== 200) {
      throw new Error(`FAIL: Reject completion returned status ${rejectRes.status}`);
    }

    updatedMnt = await prisma.maintenanceRequest.findUnique({
      where: { id: mnt3.id },
      include: { technician: true }
    });
    if (!updatedMnt || updatedMnt.status !== 'Rejected' || updatedMnt.rejectionReason !== 'الإصلاح غير مكتمل الباب ما زال يهتز عند الفتح' || updatedMnt.rejectionCount < 1) {
      throw new Error(`FAIL: DB request not updated to Rejected or properties mismatch. Status: ${updatedMnt?.status}, Reason: ${updatedMnt?.rejectionReason}, Count: ${updatedMnt?.rejectionCount}`);
    }
    console.log('   └ DB updated: Status = Rejected, rejectionReason saved, rejectionCount incremented');

    // Verify supervisor and technician notifications
    const supRejectNotif = WebhookController.sentMessages.find(m => m.to === omar.phoneNumber);
    const techRejectNotif = WebhookController.sentMessages.find(m => m.to === khalid.phoneNumber);
    if (!supRejectNotif || !techRejectNotif) {
      throw new Error(`FAIL: Parties not notified on rejection. Supervisor notified: ${!!supRejectNotif}, Tech notified: ${!!techRejectNotif}`);
    }
    console.log('   └ Supervisor Omar and Technician Khalid were successfully notified of rejection.');

    // =============================================================
    // WAREHOUSE & INVENTORY MODULE INTEGRATION TESTS (Tests F, G, H, I)
    // =============================================================
    console.log('\n=============================================================');
    console.log('📦 RUNNING WAREHOUSE & INVENTORY MANAGEMENT LIFECYCLE TESTS');
    console.log('=============================================================');

    const allUsers = await prisma.user.findMany();
    const whLara = allUsers.find(u => u.phoneNumber === '+1234567894')!;
    const whMarcus = allUsers.find(u => u.phoneNumber === '+1234567895')!;
    const whAccountant = allUsers.find(u => u.phoneNumber === '+1234567896')!;
    const whPO = allUsers.find(u => u.phoneNumber === '+1234567897')!;

    // -------------------------------------------------------------
    // Test F: Employee requests item via WhatsApp wizard
    // -------------------------------------------------------------
    console.log('\n--- Test F: Employee places Warehouse Request ---');
    
    // Step F1: Lara sends "طلب"
    await fetch(`http://localhost:${PORT}/api/whatsapp-webhook`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(generateTextPayload(whLara.phoneNumber, whLara.name, 'طلب', 'wamid.whr_f_01')),
    });

    // Step F2: Lara selects option 3 ( طلب من المستودع )
    await fetch(`http://localhost:${PORT}/api/whatsapp-webhook`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(generateTextPayload(whLara.phoneNumber, whLara.name, '3', 'wamid.whr_f_02')),
    });

    // Step F3: Lara selects item 1 (منشفة يد صغيرة) from the list
    await fetch(`http://localhost:${PORT}/api/whatsapp-webhook`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(generateTextPayload(whLara.phoneNumber, whLara.name, '1', 'wamid.whr_f_03')),
    });

    // Step F4: Lara enters quantity "10"
    await fetch(`http://localhost:${PORT}/api/whatsapp-webhook`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(generateTextPayload(whLara.phoneNumber, whLara.name, '10', 'wamid.whr_f_04')),
    });

    // Step F5: Lara enters purpose "استبدال مناشف الغرف"
    await fetch(`http://localhost:${PORT}/api/whatsapp-webhook`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(generateTextPayload(whLara.phoneNumber, whLara.name, 'استبدال مناشف الغرف', 'wamid.whr_f_05')),
    });

    // Step F6: Lara confirms submission
    WebhookController.sentMessages = [];
    const whrConfirmRes = await fetch(`http://localhost:${PORT}/api/whatsapp-webhook`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(generateButtonPayload(whLara.phoneNumber, whLara.name, 'confirm_whr_submit', 'تأكيد الطلب', 'wamid.whr_f_06')),
    });

    if (whrConfirmRes.status !== 200) {
      throw new Error(`FAIL: Lara warehouse request confirmation failed with status ${whrConfirmRes.status}`);
    }

    // Verify warehouse request in DB
    const whRequest = await prisma.warehouseRequest.findFirst({
      where: { requestedBy: whLara.id, status: 'Pending', itemId: 'item-1', quantityRequested: 10 },
      include: { item: true }
    });

    if (!whRequest) {
      throw new Error('FAIL: Warehouse Request not saved in database.');
    }
    console.log(`   └ Warehouse Request saved successfully as Pending: ${whRequest.ticketNumber}`);

    // Verify Warehouse Manager was notified
    const whManagerNotification = WebhookController.sentMessages.find(m => m.to === whMarcus.phoneNumber);
    if (!whManagerNotification) {
      throw new Error('FAIL: WarehouseManager (Marcus) was not notified of the request.');
    }
    console.log('   └ Warehouse Manager was successfully notified.');

    // -------------------------------------------------------------
    // Test G: Manager full approval + auto-procurement
    // -------------------------------------------------------------
    console.log('\n--- Test G: Manager Full Approval & Low Stock Auto-Procurement ---');

    // Step G1: Marcus clicks approve full quantity
    WebhookController.sentMessages = [];
    const whrApproveRes = await fetch(`http://localhost:${PORT}/api/whatsapp-webhook`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(generateButtonPayload(whMarcus.phoneNumber, whMarcus.name, `issue_full_${whRequest.id}`, 'صرف كامل الكمية', 'wamid.whr_g_01')),
    });

    if (whrApproveRes.status !== 200) {
      throw new Error(`FAIL: Warehouse approval failed with status ${whrApproveRes.status}`);
    }

    // Verify WHR request is Approved and stock is deducted
    const approvedWhr = await prisma.warehouseRequest.findUnique({
      where: { id: whRequest.id }
    });
    if (!approvedWhr || approvedWhr.status !== 'Approved' || approvedWhr.quantityIssued !== 10) {
      throw new Error(`FAIL: WHR Request status is not Approved or quantityIssued incorrect. Status: ${approvedWhr?.status}`);
    }
    
    const sailRoadStockItem1 = await prisma.stockEntry.findUnique({
      where: { itemId_branchId: { itemId: 'item-1', branchId: whLara.branchId! } }
    });
    if (!sailRoadStockItem1 || sailRoadStockItem1.quantity !== 40) {
      throw new Error(`FAIL: Item stock was not deducted. Quantity: ${sailRoadStockItem1?.quantity}`);
    }
    console.log(`   └ DB updated: Status = Approved, Stock level decreased to ${sailRoadStockItem1.quantity}`);

    // Step G2: Marcus triggers manual stock adjustment to test auto-procurement for item-5
    // item-5 is seeded with qty = 2 (min = 5). Let's adjust stock by -1, putting it to 1, triggering auto-procurement.
    WebhookController.sentMessages = [];
    const { WarehouseService } = require('./services/warehouse.service');
    await prisma.procurementRequest.deleteMany({ where: { itemId: 'item-5' } });
    await WarehouseService.adjustStock('item-5', whLara.branchId!, 1, 'Out', 'ManualAdjustment', whMarcus.id);

    // Verify auto-generated procurement request exists
    const autoProc = await prisma.procurementRequest.findFirst({
      where: { itemId: 'item-5', branchId: whLara.branchId!, source: 'LowStock', status: 'Pending' }
    });
    if (!autoProc) {
      throw new Error('FAIL: Auto-procurement request was not generated for low-stock item.');
    }
    console.log(`   └ Auto-procurement generated successfully: ${autoProc.ticketNumber}`);

    // Verify Procurement Officer was notified
    const poNotification = WebhookController.sentMessages.find(m => m.to === whPO.phoneNumber);
    if (!poNotification) {
      throw new Error('FAIL: ProcurementOfficer was not notified of low-stock.');
    }
    console.log('   └ Procurement Officer was successfully notified.');

    // -------------------------------------------------------------
    // Test H: PO review + accountant approval
    // -------------------------------------------------------------
    console.log('\n--- Test H: Procurement Officer Review & Accountant Approval ---');

    // Step H1: PO starts review
    await fetch(`http://localhost:${PORT}/api/whatsapp-webhook`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(generateButtonPayload(whPO.phoneNumber, whPO.name, `review_procurement_${autoProc.id}`, 'مراجعة الطلب', 'wamid.whr_h_01')),
    });

    // Step H2: PO inputs estimated price "300"
    await fetch(`http://localhost:${PORT}/api/whatsapp-webhook`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(generateTextPayload(whPO.phoneNumber, whPO.name, '300', 'wamid.whr_h_02')),
    });

    // Step H3: PO selects supplier option 2 (sup-2)
    await fetch(`http://localhost:${PORT}/api/whatsapp-webhook`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(generateTextPayload(whPO.phoneNumber, whPO.name, '2', 'wamid.whr_h_03')),
    });

    // Step H4: PO selects payment method option 2 (BankTransfer)
    await fetch(`http://localhost:${PORT}/api/whatsapp-webhook`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(generateTextPayload(whPO.phoneNumber, whPO.name, '2', 'wamid.whr_h_04')),
    });

    // Step H5: PO inputs review note "عرض سعر مناسب"
    WebhookController.sentMessages = [];
    const reviewRes = await fetch(`http://localhost:${PORT}/api/whatsapp-webhook`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(generateTextPayload(whPO.phoneNumber, whPO.name, 'عرض سعر مناسب', 'wamid.whr_h_05')),
    });

    if (reviewRes.status !== 200) {
      throw new Error(`FAIL: PO review failed with status ${reviewRes.status}`);
    }

    // Verify DB update
    let updatedProc = await prisma.procurementRequest.findUnique({
      where: { id: autoProc.id }
    });
    if (!updatedProc || updatedProc.status !== 'PendingFinancialApproval' || updatedProc.estimatedPrice !== 300 || updatedProc.supplierId !== 'sup-2') {
      throw new Error(`FAIL: DB request not updated to PendingFinancialApproval or details mismatch. Status: ${updatedProc?.status}`);
    }
    console.log('   └ DB updated: Status = PendingFinancialApproval, supplier and price saved');

    // Verify Accountant was notified
    const accNotification = WebhookController.sentMessages.find(m => m.to === whAccountant.phoneNumber);
    if (!accNotification) {
      throw new Error('FAIL: Accountant was not notified for financial approval.');
    }
    console.log('   └ Accountant was successfully notified.');

    // -------------------------------------------------------------
    // Test I: Purchasing + Manager warehouse receiving
    // -------------------------------------------------------------
    console.log('\n--- Test I: Financial Approval, Purchasing, & Warehouse Receiving ---');

    // Step I1: Accountant approves financially
    WebhookController.sentMessages = [];
    const financeApproveRes = await fetch(`http://localhost:${PORT}/api/whatsapp-webhook`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(generateButtonPayload(whAccountant.phoneNumber, whAccountant.name, `approve_finance_${autoProc.id}`, 'اعتماد مالي', 'wamid.whr_i_01')),
    });

    if (financeApproveRes.status !== 200) {
      throw new Error(`FAIL: Finance approval failed with status ${financeApproveRes.status}`);
    }

    updatedProc = await prisma.procurementRequest.findUnique({ where: { id: autoProc.id } });
    if (!updatedProc || updatedProc.status !== 'FinanciallyApproved') {
      throw new Error(`FAIL: DB request not FinanciallyApproved. Status: ${updatedProc?.status}`);
    }
    console.log('   └ DB updated: Status = FinanciallyApproved');

    // Verify PO was notified to buy
    const poNotificationToBuy = WebhookController.sentMessages.find(m => m.to === whPO.phoneNumber);
    if (!poNotificationToBuy) {
      throw new Error('FAIL: ProcurementOfficer was not notified to complete purchase.');
    }
    console.log('   └ Procurement Officer was successfully notified of financial approval.');

    // Step I2: PO clicks mark purchased button
    await fetch(`http://localhost:${PORT}/api/whatsapp-webhook`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(generateButtonPayload(whPO.phoneNumber, whPO.name, `mark_purchased_btn_${autoProc.id}`, 'تأكيد الشراء', 'wamid.whr_i_02')),
    });

    // Step I3: PO inputs actual price "280"
    await fetch(`http://localhost:${PORT}/api/whatsapp-webhook`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(generateTextPayload(whPO.phoneNumber, whPO.name, '280', 'wamid.whr_i_03')),
    });

    // Step I4: PO selects payment method option 2 (BankTransfer)
    WebhookController.sentMessages = [];
    const markPurchasedRes = await fetch(`http://localhost:${PORT}/api/whatsapp-webhook`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(generateTextPayload(whPO.phoneNumber, whPO.name, '2', 'wamid.whr_i_04')),
    });

    if (markPurchasedRes.status !== 200) {
      throw new Error(`FAIL: Mark purchased failed with status ${markPurchasedRes.status}`);
    }

    updatedProc = await prisma.procurementRequest.findUnique({ where: { id: autoProc.id } });
    if (!updatedProc || updatedProc.status !== 'Purchased' || updatedProc.actualPrice !== 280) {
      throw new Error(`FAIL: DB request not Purchased. Status: ${updatedProc?.status}`);
    }
    console.log('   └ DB updated: Status = Purchased, actualPrice = 280 saved');

    // Verify Warehouse Manager was notified of incoming shipment
    const whNotificationToReceive = WebhookController.sentMessages.find(m => m.to === whMarcus.phoneNumber);
    if (!whNotificationToReceive) {
      throw new Error('FAIL: WarehouseManager was not notified of incoming shipment.');
    }
    console.log('   └ Warehouse Manager was successfully notified of incoming shipment.');

    // Step I5: Warehouse Manager confirms receiving in warehouse
    const receiveRes = await fetch(`http://localhost:${PORT}/api/whatsapp-webhook`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(generateButtonPayload(whMarcus.phoneNumber, whMarcus.name, `confirm_receive_btn_${autoProc.id}`, 'تأكيد الاستلام', 'wamid.whr_i_05')),
    });

    if (receiveRes.status !== 200) {
      throw new Error(`FAIL: Receive in warehouse failed with status ${receiveRes.status}`);
    }

    // Verify DB request status is ReceivedInWarehouse
    updatedProc = await prisma.procurementRequest.findUnique({ where: { id: autoProc.id } });
    if (!updatedProc || updatedProc.status !== 'ReceivedInWarehouse') {
      throw new Error(`FAIL: DB request status is not ReceivedInWarehouse. Status: ${updatedProc?.status}`);
    }

    // Verify stock entry of item-5 is restocked
    // Initial quantity = 2, we adjusted it by -1 so it became 1.
    // The autoProc.quantityNeeded is max(50, 50 - 1) = 50.
    // Restocked stock level should be 1 + 50 = 51.
    const restockedStock = await prisma.stockEntry.findUnique({
      where: { itemId_branchId: { itemId: 'item-5', branchId: whLara.branchId! } }
    });
    if (!restockedStock || restockedStock.quantity !== 51) {
      throw new Error(`FAIL: Stock entry was not restocked correctly. Quantity: ${restockedStock?.quantity}`);
    }
    console.log(`   └ DB updated: Status = ReceivedInWarehouse, Stock level restocked to ${restockedStock.quantity}`);

    console.log('\n🎉 ALL WAREHOUSE & INVENTORY LIFE-CYCLE TESTS PASSED! 🎉\n');

    // =============================================================
    // LOST & FOUND & DAMAGE REPORTS MODULE INTEGRATION TESTS (Tests J, K, L, M, N)
    // =============================================================
    console.log('\n=============================================================');
    console.log('🛎️ RUNNING LOST & FOUND & DAMAGE REPORTS LIFE-CYCLE TESTS');
    console.log('=============================================================');

    const fatima = allUsers.find(u => u.phoneNumber === '+966501111005')!;
    const bmUser = allUsers.find(u => u.phoneNumber === '+966501111004')!;
    const receptionist = allUsers.find(u => u.phoneNumber === '+1234567894')!;

    // -------------------------------------------------------------
    // Test J: HousekeepingStaff reports found item via WhatsApp
    // -------------------------------------------------------------
    console.log('\n--- Test J: HousekeepingStaff reports found item ---');

    // Step J1: Fatima sends "طلب"
    await fetch(`http://localhost:${PORT}/api/whatsapp-webhook`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(generateTextPayload(fatima.phoneNumber, fatima.name, 'طلب', 'wamid.lf_j_01')),
    });

    // Step J2: Fatima selects option 6 (تسجيل مفقودات)
    await fetch(`http://localhost:${PORT}/api/whatsapp-webhook`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(generateTextPayload(fatima.phoneNumber, fatima.name, '6', 'wamid.lf_j_02')),
    });

    // Step J3: Fatima selects option 1 (عثرت على غرض مفقود)
    await fetch(`http://localhost:${PORT}/api/whatsapp-webhook`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(generateTextPayload(fatima.phoneNumber, fatima.name, '1', 'wamid.lf_j_03')),
    });

    // Step J4: Fatima sends Location "غرفة 404"
    await fetch(`http://localhost:${PORT}/api/whatsapp-webhook`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(generateTextPayload(fatima.phoneNumber, fatima.name, 'غرفة 404', 'wamid.lf_j_04')),
    });

    // Step J5: Fatima sends Description "ساعة يد ذهبية رولكس"
    await fetch(`http://localhost:${PORT}/api/whatsapp-webhook`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(generateTextPayload(fatima.phoneNumber, fatima.name, 'ساعة يد ذهبية رولكس', 'wamid.lf_j_05')),
    });

    // Step J6: Fatima sends "تخطي" for photo
    await fetch(`http://localhost:${PORT}/api/whatsapp-webhook`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(generateTextPayload(fatima.phoneNumber, fatima.name, 'تخطي', 'wamid.lf_j_06')),
    });

    // Step J7: Fatima sends guest name "عبدالله محمد"
    await fetch(`http://localhost:${PORT}/api/whatsapp-webhook`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(generateTextPayload(fatima.phoneNumber, fatima.name, 'عبدالله محمد', 'wamid.lf_j_07')),
    });

    // Step J8: Fatima clicks confirm button
    const lfConfirmRes = await fetch(`http://localhost:${PORT}/api/whatsapp-webhook`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(generateButtonPayload(fatima.phoneNumber, fatima.name, 'confirm_lf_btn', 'تأكيد تسجيل المفقودات', 'wamid.lf_j_08')),
    });

    if (lfConfirmRes.status !== 200) {
      throw new Error(`FAIL: Fatima lost item confirmation failed with status ${lfConfirmRes.status}`);
    }

    // Verify item in DB
    const lostItem = await prisma.lostFoundItem.findFirst({
      where: { reportedBy: fatima.id, location: 'غرفة 404', description: 'ساعة يد ذهبية رولكس' }
    });

    if (!lostItem || lostItem.status !== 'Stored' || lostItem.guestName !== 'عبدالله محمد') {
      throw new Error('FAIL: Lost & Found item not saved correctly in database.');
    }
    console.log(`   └ Lost & Found item saved successfully: ${lostItem.ticketNumber}`);

    // -------------------------------------------------------------
    // Test K: Receptionist claims item
    // -------------------------------------------------------------
    console.log('\n--- Test K: Receptionist claims item ---');

    const claimRes = await fetch(`http://localhost:${PORT}/api/lostfound/${lostItem.id}/claim`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        claimedBy: 'عبدالله محمد',
        claimedIdType: 'National ID',
        claimedIdNumber: '1102203304',
        handedOverBy: receptionist.id
      }),
    });

    if (claimRes.status !== 200) {
      throw new Error(`FAIL: Claiming item returned status ${claimRes.status}`);
    }

    const claimedItem = await prisma.lostFoundItem.findUnique({
      where: { id: lostItem.id }
    });

    if (!claimedItem || claimedItem.status !== 'Claimed' || claimedItem.claimedBy !== 'عبدالله محمد') {
      throw new Error('FAIL: Lost & Found item was not updated to Claimed in DB.');
    }
    console.log('   └ Lost & Found item successfully claimed in DB.');

    // -------------------------------------------------------------
    // Test L: Manager reports damage
    // -------------------------------------------------------------
    console.log('\n--- Test L: Manager reports damage ---');

    // Step L1: Manager sends "طلب"
    await fetch(`http://localhost:${PORT}/api/whatsapp-webhook`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(generateTextPayload(bmUser.phoneNumber, bmUser.name, 'طلب', 'wamid.dmg_l_01')),
    });

    // Step L2: Manager selects option 7 (تسجيل تلفيات)
    await fetch(`http://localhost:${PORT}/api/whatsapp-webhook`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(generateTextPayload(bmUser.phoneNumber, bmUser.name, '7', 'wamid.dmg_l_02')),
    });

    // Step L3: Manager sends room number "505"
    await fetch(`http://localhost:${PORT}/api/whatsapp-webhook`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(generateTextPayload(bmUser.phoneNumber, bmUser.name, '505', 'wamid.dmg_l_03')),
    });

    // Step L4: Manager sends reservation ref "RES-2026-99"
    await fetch(`http://localhost:${PORT}/api/whatsapp-webhook`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(generateTextPayload(bmUser.phoneNumber, bmUser.name, 'RES-2026-99', 'wamid.dmg_l_04')),
    });

    // Step L5: Manager selects damage type 2 (Electronics)
    await fetch(`http://localhost:${PORT}/api/whatsapp-webhook`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(generateTextPayload(bmUser.phoneNumber, bmUser.name, '2', 'wamid.dmg_l_05')),
    });

    // Step L6: Manager selects met during stay 1 (Stay)
    await fetch(`http://localhost:${PORT}/api/whatsapp-webhook`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(generateTextPayload(bmUser.phoneNumber, bmUser.name, '1', 'wamid.dmg_l_06')),
    });

    // Step L7: Manager sends description "شاشة التلفزيون مكسورة بالكامل"
    await fetch(`http://localhost:${PORT}/api/whatsapp-webhook`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(generateTextPayload(bmUser.phoneNumber, bmUser.name, 'شاشة التلفزيون مكسورة بالكامل', 'wamid.dmg_l_07')),
    });

    // Step L8: Manager sends "تخطي" for photo
    await fetch(`http://localhost:${PORT}/api/whatsapp-webhook`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(generateTextPayload(bmUser.phoneNumber, bmUser.name, 'تخطي', 'wamid.dmg_l_08')),
    });

    // Step L9: Manager sends guest name "يوسف أحمد"
    await fetch(`http://localhost:${PORT}/api/whatsapp-webhook`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(generateTextPayload(bmUser.phoneNumber, bmUser.name, 'يوسف أحمد', 'wamid.dmg_l_09')),
    });

    // Step L10: Manager clicks confirm button
    const dmgConfirmRes = await fetch(`http://localhost:${PORT}/api/whatsapp-webhook`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(generateButtonPayload(bmUser.phoneNumber, bmUser.name, 'confirm_dmg_btn', 'تأكيد تسجيل التلفيات', 'wamid.dmg_l_10')),
    });

    if (dmgConfirmRes.status !== 200) {
      throw new Error(`FAIL: Manager damage report confirmation failed with status ${dmgConfirmRes.status}`);
    }

    // Verify damage report in DB
    const dmgReport = await prisma.damageReport.findFirst({
      where: { reportedBy: bmUser.id, roomNumber: '505', description: 'شاشة التلفزيون مكسورة بالكامل' }
    });

    if (!dmgReport || dmgReport.status !== 'New' || dmgReport.guestName !== 'يوسف أحمد' || dmgReport.damageType !== 'Electronics') {
      throw new Error('FAIL: Damage report not saved correctly in database.');
    }
    console.log(`   └ Damage report saved successfully: ${dmgReport.ticketNumber}`);

    // -------------------------------------------------------------
    // Test M: Manager reviews damage and receptionist collects payment
    // -------------------------------------------------------------
    console.log('\n--- Test M: Manager reviews damage & receptionist collects payment ---');

    // Step M1: Manager clicks review button
    await fetch(`http://localhost:${PORT}/api/whatsapp-webhook`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(generateButtonPayload(bmUser.phoneNumber, bmUser.name, `dmg_review_btn_${dmgReport.id}`, 'مراجعة التلف', 'wamid.dmg_m_01')),
    });

    // Step M2: Manager sends proposed value "1500"
    await fetch(`http://localhost:${PORT}/api/whatsapp-webhook`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(generateTextPayload(bmUser.phoneNumber, bmUser.name, '1500', 'wamid.dmg_m_02')),
    });

    // Step M3: Manager sends review note "شاشة تلفزيون سامسونج 55 بوصة"
    const reviewDmgRes = await fetch(`http://localhost:${PORT}/api/whatsapp-webhook`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(generateTextPayload(bmUser.phoneNumber, bmUser.name, 'شاشة تلفزيون سامسونج 55 بوصة', 'wamid.dmg_m_03')),
    });

    if (reviewDmgRes.status !== 200) {
      throw new Error(`FAIL: Manager damage review failed with status ${reviewDmgRes.status}`);
    }

    // Verify in DB
    let updatedDmg = await prisma.damageReport.findUnique({
      where: { id: dmgReport.id }
    });

    if (!updatedDmg || updatedDmg.status !== 'PendingGuestDecision' || updatedDmg.finalValue !== 1500) {
      throw new Error(`FAIL: Damage report not updated to PendingGuestDecision. Status: ${updatedDmg?.status}`);
    }
    console.log('   └ Damage report reviewed and set to PendingGuestDecision.');

    // Step M4: Receptionist clicks collect payment
    await fetch(`http://localhost:${PORT}/api/whatsapp-webhook`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(generateButtonPayload(receptionist.phoneNumber, receptionist.name, `dmg_accept_btn_${dmgReport.id}`, 'دفع التعويض', 'wamid.dmg_m_04')),
    });

    // Step M5: Receptionist selects Option 2 (Card)
    await fetch(`http://localhost:${PORT}/api/whatsapp-webhook`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(generateTextPayload(receptionist.phoneNumber, receptionist.name, '2', 'wamid.dmg_m_05')),
    });

    // Step M6: Receptionist sends receipt ref "REC-999-CARD"
    const collectPaymentRes = await fetch(`http://localhost:${PORT}/api/whatsapp-webhook`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(generateTextPayload(receptionist.phoneNumber, receptionist.name, 'REC-999-CARD', 'wamid.dmg_m_06')),
    });

    if (collectPaymentRes.status !== 200) {
      throw new Error(`FAIL: Collect payment returned status ${collectPaymentRes.status}`);
    }

    updatedDmg = await prisma.damageReport.findUnique({
      where: { id: dmgReport.id }
    });

    if (!updatedDmg || updatedDmg.status !== 'Paid' || updatedDmg.paymentMethod !== 'Card' || updatedDmg.paymentRef !== 'REC-999-CARD') {
      throw new Error(`FAIL: Damage report payment collection failed. Status: ${updatedDmg?.status}`);
    }
    console.log('   └ Damage report payment collected successfully.');

    // -------------------------------------------------------------
    // Test N: Receptionist marks damage as Refused
    // -------------------------------------------------------------
    console.log('\n--- Test N: Receptionist marks damage as Refused ---');

    // Create a new damage report via REST API
    const createDmgRes = await fetch(`http://localhost:${PORT}/api/damage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        reportedBy: bmUser.id,
        branchId: bmUser.branchId,
        roomNumber: '506',
        damageType: 'Furniture',
        description: 'كسر في ساق الطاولة الخشبية',
        reportedDuring: 'Checkout',
        guestName: 'خالد عبدالملك',
        guestPhone: '+966555666777'
      }),
    });
    
    if (createDmgRes.status !== 201) {
      throw new Error(`FAIL: Creating damage report 2 returned status ${createDmgRes.status}`);
    }
    
    const createDmgData = await createDmgRes.json();
    const dmgReport2 = createDmgData.data;

    // Review damage report 2 via REST API
    const review2Res = await fetch(`http://localhost:${PORT}/api/damage/${dmgReport2.id}/review`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        reviewerId: bmUser.id,
        finalValue: 400,
        reviewNote: 'سعر إصلاح طاولة خشبية'
      }),
    });

    if (review2Res.status !== 200) {
      throw new Error(`FAIL: Reviewing damage report 2 returned status ${review2Res.status}`);
    }

    // Receptionist clicks refuse via WhatsApp
    await fetch(`http://localhost:${PORT}/api/whatsapp-webhook`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(generateButtonPayload(receptionist.phoneNumber, receptionist.name, `dmg_refuse_btn_${dmgReport2.id}`, 'رفض السداد', 'wamid.dmg_n_01')),
    });

    // Receptionist enters refusal reason
    const refuseRes = await fetch(`http://localhost:${PORT}/api/whatsapp-webhook`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(generateTextPayload(receptionist.phoneNumber, receptionist.name, 'العميل يدعي أن التلف كان سابقاً لدخوله', 'wamid.dmg_n_02')),
    });

    if (refuseRes.status !== 200) {
      throw new Error(`FAIL: Refusal reason submission returned status ${refuseRes.status}`);
    }

    const finalDmgReport2 = await prisma.damageReport.findUnique({
      where: { id: dmgReport2.id }
    });

    if (!finalDmgReport2 || finalDmgReport2.status !== 'Refused' || finalDmgReport2.refusalReason !== 'العميل يدعي أن التلف كان سابقاً لدخوله') {
      throw new Error(`FAIL: Damage report 2 was not updated to Refused. Status: ${finalDmgReport2?.status}`);
    }
    console.log('   └ Damage report 2 successfully marked as Refused.');

    // -------------------------------------------------------------
    // Test O: BranchManager types "ملخص" → receives Daily Digest
    // -------------------------------------------------------------
    console.log('\n--- Test O: BranchManager types "ملخص" → receives Daily Digest ---');
    WebhookController.sentMessages = [];
    const digestBMRes = await fetch(`http://localhost:${PORT}/api/whatsapp-webhook`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(generateTextPayload(bmUser.phoneNumber, bmUser.name, 'ملخص', 'wamid.digest_o_01')),
    });
    if (digestBMRes.status !== 200) {
      throw new Error(`FAIL: BranchManager digest request failed with status ${digestBMRes.status}`);
    }
    const bmMsg = WebhookController.sentMessages.find(m => m.to === bmUser.phoneNumber);
    if (!bmMsg) {
      throw new Error('FAIL: BranchManager did not receive the digest message.');
    }
    console.log('   └ BranchManager successfully received the daily digest.');

    // -------------------------------------------------------------
    // Test P: Admin types "ملخص" → receives digest for all branches
    // -------------------------------------------------------------
    console.log('\n--- Test P: Admin types "ملخص" → receives digest for all branches ---');
    const adminUser = allUsers.find(u => (u.role as string) === 'Admin')!;
    WebhookController.sentMessages = [];
    const digestAdminRes = await fetch(`http://localhost:${PORT}/api/whatsapp-webhook`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(generateTextPayload(adminUser.phoneNumber, adminUser.name, 'ملخص', 'wamid.digest_p_01')),
    });
    if (digestAdminRes.status !== 200) {
      throw new Error(`FAIL: Admin digest request failed with status ${digestAdminRes.status}`);
    }
    const adminMessages = WebhookController.sentMessages.filter(m => m.to === adminUser.phoneNumber);
    if (adminMessages.length < 2) {
      throw new Error(`FAIL: Admin did not receive digests for all branches. Count: ${adminMessages.length}`);
    }
    console.log('   └ Admin successfully received digests for all branches.');

    // -------------------------------------------------------------
    // Test Q: Verify digest contains all 5 sections
    // -------------------------------------------------------------
    console.log('\n--- Test Q: Verify digest contains all 5 sections ---');
    const textToCheck = adminMessages[0].text;
    const requiredSections = [
      '💰 *المالية*',
      '🛠️ *الصيانة*',
      '📦 *المخزون*',
      '💥 *التلفيات*',
      '👥 *الحضور*'
    ];
    for (const sec of requiredSections) {
      if (!textToCheck.includes(sec)) {
        throw new Error(`FAIL: Digest missing section: ${sec}`);
      }
    }
    console.log('   └ Digest verified to contain all 5 sections.');

    // -------------------------------------------------------------
    // Test R: Login with correct credentials returns 200 and token
    // -------------------------------------------------------------
    console.log('\n--- Test R: Login with correct credentials ---');
    const adminUserObj = allUsers.find(u => (u.role as string) === 'Admin')!;
    const loginSuccessRes = await fetch(`http://localhost:${PORT}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        phoneNumber: adminUserObj.phoneNumber,
        password: 'Rahti@2026'
      })
    });
    if (loginSuccessRes.status !== 200) {
      throw new Error(`FAIL: Login with correct credentials failed with status ${loginSuccessRes.status}`);
    }
    const loginSuccessData = await loginSuccessRes.json();
    if (!loginSuccessData.success || !loginSuccessData.data.token || !loginSuccessData.data.user) {
      throw new Error(`FAIL: Login response format invalid: ${JSON.stringify(loginSuccessData)}`);
    }
    console.log('   └ Login succeeded. Token and user info returned.');

    // -------------------------------------------------------------
    // Test S: Login with incorrect password returns 401
    // -------------------------------------------------------------
    console.log('\n--- Test S: Login with incorrect password ---');
    const loginFailRes = await fetch(`http://localhost:${PORT}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        phoneNumber: adminUserObj.phoneNumber,
        password: 'wrong-password'
      })
    });
    if (loginFailRes.status !== 401) {
      throw new Error(`FAIL: Login with incorrect password returned status ${loginFailRes.status} instead of 401`);
    }
    console.log('   └ Login with incorrect password returned 401 as expected.');

    // -------------------------------------------------------------
    // Test T: Query protected API without authorization header returns 401
    // -------------------------------------------------------------
    console.log('\n--- Test T: Query protected API without authorization header ---');
    const protectedRes = await fetch(`http://localhost:${PORT}/api/users`, {
      method: 'GET',
      headers: { 'X-Bypass-Auth': 'true' }
    });
    if (protectedRes.status !== 401) {
      throw new Error(`FAIL: Protected query without auth header returned status ${protectedRes.status} instead of 401`);
    }
    console.log('   └ Protected query without auth header returned 401 as expected.');

    // -------------------------------------------------------------
    // Test U: WhatsApp bot document upload (PDF)
    // -------------------------------------------------------------
    console.log('\n--- Test U: WhatsApp bot document upload (PDF) ---');
    const receptionistUser = allUsers.find(u => u.role === 'Receptionist')!;
    
    // Clear sent messages
    WebhookController.sentMessages = [];
    
    // Simulate incoming webhook payload for document message
    const docPayload = {
      object: 'whatsapp_business_account',
      entry: [{
        id: '12345',
        changes: [{
          value: {
            messaging_product: 'whatsapp',
            metadata: { display_phone_number: '12345', phone_number_id: '12345' },
            contacts: [{ profile: { name: receptionistUser.name }, wa_id: receptionistUser.phoneNumber.replace('+', '') }],
            messages: [{
              from: receptionistUser.phoneNumber,
              id: 'msg-doc-123',
              timestamp: Math.floor(Date.now() / 1000).toString(),
              type: 'document',
              document: {
                id: 'media-pdf-file-789',
                mime_type: 'application/pdf',
                sha256: 'mock-sha256',
                caption: 'رخصة الدفاع المدني لمبنى السيل 2026-12-31'
              }
            }]
          },
          field: 'messages'
        }]
      }]
    };

    const webhookRes = await fetch(`http://localhost:${PORT}/api/whatsapp-webhook`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(docPayload)
    });

    if (webhookRes.status !== 200) {
      throw new Error(`FAIL: Webhook post failed with status ${webhookRes.status}`);
    }

    // Verify response sent back to user (receptionist)
    const replyMessages = WebhookController.sentMessages.filter(m => m.to === receptionistUser.phoneNumber);
    if (replyMessages.length === 0 || !replyMessages[0].text.includes('تم حفظ الوثيقة')) {
      throw new Error(`FAIL: Response to user did not confirm document save: ${JSON.stringify(replyMessages)}`);
    }
    
    // Verify document exists in database
    const savedDoc = await prisma.document.findFirst({
      where: { fileName: 'رخصة الدفاع المدني لمبنى السيل 2026-12-31' }
    });
    if (!savedDoc) {
      throw new Error('FAIL: Document was not saved in the database');
    }
    console.log('   └ WhatsApp bot document upload processed and verified.');

    // -------------------------------------------------------------
    // Test V: Expiry warnings daily scheduler alerts
    // -------------------------------------------------------------
    console.log('\n--- Test V: Expiry warning daily scheduler ---');
    const branchManagerUser = allUsers.find(u => u.role === 'BranchManager')!;
    
    // Create expiring documents for testing
    const doc30 = await prisma.document.create({
      data: {
        title: 'وثيقة اختبار 30 يوم',
        type: 'LICENSE',
        department: 'BRANCH',
        branchId: branchManagerUser.branchId!,
        fileUrl: '/uploads/documents/test30.pdf',
        fileName: 'test30.pdf',
        fileSize: 1024,
        mimeType: 'application/pdf',
        expiryDate: new Date(Date.now() + 30 * 24 * 3600 * 1000),
        alertSent30: false,
        uploadedById: receptionistUser.id
      }
    });

    const doc7 = await prisma.document.create({
      data: {
        title: 'وثيقة اختبار 7 أيام',
        type: 'CONTRACT',
        department: 'HR',
        branchId: branchManagerUser.branchId!,
        fileUrl: '/uploads/documents/test7.pdf',
        fileName: 'test7.pdf',
        fileSize: 1024,
        mimeType: 'application/pdf',
        expiryDate: new Date(Date.now() + 7 * 24 * 3600 * 1000),
        alertSent7: false,
        uploadedById: receptionistUser.id
      }
    });

    const docExp = await prisma.document.create({
      data: {
        title: 'وثيقة اختبار منتهية',
        type: 'INSURANCE',
        department: 'MAINTENANCE',
        branchId: branchManagerUser.branchId!,
        fileUrl: '/uploads/documents/test_exp.pdf',
        fileName: 'test_exp.pdf',
        fileSize: 1024,
        mimeType: 'application/pdf',
        expiryDate: new Date(Date.now() - 1 * 24 * 3600 * 1000),
        isExpired: false,
        uploadedById: receptionistUser.id
      }
    });

    // Clear sent messages
    WebhookController.sentMessages = [];

    // Trigger the expiry checker manually
    const { WhatsAppService } = require('./services/whatsapp.service');
    await WhatsAppService.checkAndAlertExpiringDocuments();

    // Verify DB updates
    const updatedDoc30 = await prisma.document.findUnique({ where: { id: doc30.id } });
    const updatedDoc7 = await prisma.document.findUnique({ where: { id: doc7.id } });
    const updatedDocExp = await prisma.document.findUnique({ where: { id: docExp.id } });

    if (!updatedDoc30?.alertSent30) throw new Error('FAIL: doc30 alertSent30 not set to true');
    if (!updatedDoc7?.alertSent7) throw new Error('FAIL: doc7 alertSent7 not set to true');
    if (!updatedDocExp?.isExpired) throw new Error('FAIL: docExp isExpired not set to true');

    // Verify WhatsApp alerts sent to Branch Manager
    const managerAlerts = WebhookController.sentMessages.filter(m => m.to === branchManagerUser.phoneNumber);
    if (managerAlerts.length < 3) {
      throw new Error(`FAIL: Branch manager did not receive all 3 alerts. Count: ${managerAlerts.length}`);
    }

    const has30Alert = managerAlerts.some(m => m.text.includes('🟡 تنبيه'));
    const has7Alert = managerAlerts.some(m => m.text.includes('⚠️ تحذير عاجل'));
    const hasExpAlert = managerAlerts.some(m => m.text.includes('🔴 انتهت صلاحية'));

    if (!has30Alert || !has7Alert || !hasExpAlert) {
      throw new Error(`FAIL: Missing alerts in Branch Manager notifications: ${JSON.stringify(managerAlerts)}`);
    }

    console.log('   └ Document daily expiration alerts cron verified successfully.');

    // -------------------------------------------------------------
    // Test W: Delete document endpoint access controls
    // -------------------------------------------------------------
    console.log('\n--- Test W: Delete document access controls ---');
    
    // Login as Receptionist (should be forbidden to delete)
    const loginRecepRes = await fetch(`http://localhost:${PORT}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        phoneNumber: receptionistUser.phoneNumber,
        password: 'Rahti@2026'
      })
    });
    const recepToken = (await loginRecepRes.json()).data.token;

    // Login as Admin
    const loginAdminRes = await fetch(`http://localhost:${PORT}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        phoneNumber: adminUserObj.phoneNumber,
        password: 'Rahti@2026'
      })
    });
    const adminToken = (await loginAdminRes.json()).data.token;

    // Create a document to delete
    const deleteTargetDoc = await prisma.document.create({
      data: {
        title: 'عقد تجريبي للحذف',
        type: 'CONTRACT',
        department: 'BRANCH',
        branchId: branchManagerUser.branchId!,
        fileUrl: '/uploads/documents/to_delete.pdf',
        fileName: 'to_delete.pdf',
        fileSize: 100,
        mimeType: 'application/pdf',
        uploadedById: receptionistUser.id
      }
    });

    // Try deleting as Receptionist -> Should fail with 403
    const deleteRecepRes = await fetch(`http://localhost:${PORT}/api/documents/${deleteTargetDoc.id}`, {
      method: 'DELETE',
      headers: {
        'X-Bypass-Auth': 'true',
        'Authorization': `Bearer ${recepToken}`
      }
    });
    if (deleteRecepRes.status !== 403) {
      throw new Error(`FAIL: Non-admin delete should be forbidden (403), got status: ${deleteRecepRes.status}`);
    }

    // Delete as Admin -> Should succeed (200)
    const deleteAdminRes = await fetch(`http://localhost:${PORT}/api/documents/${deleteTargetDoc.id}`, {
      method: 'DELETE',
      headers: {
        'X-Bypass-Auth': 'true',
        'Authorization': `Bearer ${adminToken}`
      }
    });
    if (deleteAdminRes.status !== 200) {
      throw new Error(`FAIL: Admin delete should be allowed (200), got status: ${deleteAdminRes.status}`);
    }

    // Verify it is gone from database
    const deletedDocInDb = await prisma.document.findUnique({
      where: { id: deleteTargetDoc.id }
    });
    if (deletedDocInDb) {
      throw new Error('FAIL: Document is still in database after admin delete');
    }

    console.log('   └ Document delete authorization controls verified successfully.');

    console.log('\n🎉 ALL DOCUMENT MANAGEMENT TESTS PASSED! 🎉\n');

    console.log('\n🎉 ALL ADVANCED ARABIC BACKEND INTEGRATION TESTS PASSED! 🎉\n');
  } catch (error) {
    console.error('\n🔴 BACKEND TESTS FAILED:', error);
    process.exitCode = 1;
  } finally {
    // Clean up
    await prisma.$disconnect();
    server.close(() => {
      console.log('💤 Test server shut down.');
      process.exit();
    });
  }
}

runTests();

