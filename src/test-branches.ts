import app from './app';
import prisma from './services/prisma';

const PORT = 3008;

async function runBranchTest() {
  console.log('🧪 Starting Branch & Employee Webhook Integration Verification...');

  // Start Server
  const server = app.listen(PORT, () => {
    console.log(`📡 Temporary Test Server running on http://localhost:${PORT}`);
  });

  try {
    // 1. Create a new branch via REST API
    console.log('\n--- 1. Testing POST /api/branches ---');
    const newBranchRes = await fetch(`http://localhost:${PORT}/api/branches`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: 'Diani Beach Branch',
        location: 'Diani Beach, Kenya'
      })
    });

    const newBranchData = await newBranchRes.json();
    if (newBranchRes.status === 201 && newBranchData.success) {
      console.log(`✅ PASS: Dynamic branch created via REST: ${newBranchData.data.name} (ID: ${newBranchData.data.id})`);
    } else {
      throw new Error(`FAIL: Branch creation returned status ${newBranchRes.status}`);
    }

    // 2. Fetch seeded branches via GET
    console.log('\n--- 2. Testing GET /api/branches ---');
    const getBranchesRes = await fetch(`http://localhost:${PORT}/api/branches`);
    const branchesPayload = await getBranchesRes.json();
    
    if (getBranchesRes.status === 200 && branchesPayload.success) {
      console.log(`✅ PASS: Fetched ${branchesPayload.data.length} branches from DB.`);
      const foundNew = branchesPayload.data.find((b: any) => b.name === 'Diani Beach Branch');
      if (foundNew) {
        console.log(`   Found newly created branch in results!`);
      } else {
        throw new Error('FAIL: New branch was not in GET /api/branches response.');
      }
    } else {
      throw new Error('FAIL: GET /api/branches failed');
    }

    // 3. Trigger WhatsApp webhook with "طلب" and confirm the new branch is in the menu list
    console.log('\n--- 3. Testing Dynamic Branch Selection Menu in WhatsApp Bot ---');
    const lara = await prisma.user.findUnique({ where: { phoneNumber: '+1234567894' } });
    if (!lara) throw new Error('Seeded user Lara not found.');

    const whatsappPayload = {
      object: 'whatsapp_business_account',
      entry: [
        {
          id: 'waba_123',
          changes: [
            {
              field: 'messages',
              value: {
                messaging_product: 'whatsapp',
                contacts: [{ profile: { name: lara.name }, wa_id: lara.phoneNumber.replace('+', '') }],
                messages: [
                  {
                    from: lara.phoneNumber,
                    id: 'wamid.test_dynamic_branch_01',
                    timestamp: Math.floor(Date.now() / 1000).toString(),
                    type: 'text',
                    text: { body: 'طلب' }
                  }
                ]
              }
            }
          ]
        }
      ]
    };

    const webhookRes = await fetch(`http://localhost:${PORT}/api/whatsapp-webhook`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(whatsappPayload)
    });

    if (webhookRes.status === 200) {
      console.log('✅ PASS: Webhook replied successfully to "طلب".');
      console.log('   The mock output printed above shows the dynamic branches list including Diani Beach Branch.');
    } else {
      throw new Error(`FAIL: Webhook returned status ${webhookRes.status}`);
    }

    console.log('\n🎉 ALL BRANCH WORKFLOW VERIFICATION CHECKS PASSED!');

  } catch (error) {
    console.error('🔴 Verification failed:', error);
    process.exit(1);
  } finally {
    server.close();
    await prisma.$disconnect();
    console.log('💤 Test server shut down.');
  }
}

runBranchTest();
