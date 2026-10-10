const localtunnel = require('localtunnel');
const axios = require('axios');

const PORT = 3000;
const SUBDOMAIN = 'rahti-hotels-erp';
const ULTRAMSG_INSTANCE = 'instance193771';
const ULTRAMSG_TOKEN = 'vf3lvjwjjiuioyk6';

let currentTunnel = null;
let isStarting = false;

async function updateUltraMsgWebhook(url) {
  try {
    const webhookUrl = `${url}/webhook`;
    await axios.post(`https://api.ultramsg.com/${ULTRAMSG_INSTANCE}/instance/settings`, {
      token: ULTRAMSG_TOKEN,
      webhook_url: webhookUrl,
      webhook_message_received: 'true',
      webhook_message_create: 'true',
      webhook_message_download_media: 'true'
    }, { timeout: 10000 });
    console.log(`📡 UltraMsg Webhook updated successfully to: ${webhookUrl}`);
  } catch (err) {
    console.error('Failed to update UltraMsg webhook setting:', err.message);
  }
}

async function startTunnel() {
  if (isStarting) return;
  isStarting = true;

  if (currentTunnel) {
    try { currentTunnel.close(); } catch(e) {}
    currentTunnel = null;
  }

  console.log(`🔌 Opening tunnel on port ${PORT} with subdomain "${SUBDOMAIN}"...`);
  try {
    const tunnel = await localtunnel({ port: PORT, subdomain: SUBDOMAIN });
    currentTunnel = tunnel;
    console.log(`🚀 Tunnel active at: ${tunnel.url}`);

    await updateUltraMsgWebhook(tunnel.url);

    tunnel.on('close', () => {
      console.warn('⚠️ Tunnel closed. Reconnecting in 3s...');
      setTimeout(startTunnel, 3000);
    });

    tunnel.on('error', (err) => {
      console.error('❌ Tunnel error:', err.message);
      setTimeout(startTunnel, 3000);
    });
  } catch (err) {
    console.error('❌ Failed to establish tunnel:', err.message);
    setTimeout(startTunnel, 5000);
  } finally {
    isStarting = false;
  }
}

// Active watchdog: Pings public tunnel URL externally every 15 seconds
setInterval(async () => {
  if (!currentTunnel || isStarting) return;
  try {
    const res = await axios.get(`${currentTunnel.url}/webhook?ping=1`, {
      timeout: 8000,
      headers: { 'bypass-tunnel-reminder': 'true' },
      validateStatus: () => true
    });
    // Localtunnel returns 503/504 when cloud session is dropped
    if (res.status === 503 || res.status === 504 || res.status === 502) {
      console.warn(`⚠️ External tunnel check returned ${res.status}. Restarting tunnel...`);
      startTunnel();
    }
  } catch (err) {
    console.warn(`⚠️ External tunnel ping failed (${err.message}). Restarting tunnel...`);
    startTunnel();
  }
}, 15000);

startTunnel();
