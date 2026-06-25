const axios = require('axios');

async function test() {
  try {
    console.log('Fetching incoming payloads from production server...');
    const res = await axios.get('https://rahti-hotels-backend-production.up.railway.app/webhook/payloads');
    console.log('Status:', res.status);
    console.log('Incoming Payloads:', JSON.stringify(res.data, null, 2));
  } catch (error) {
    if (error.response) {
      console.error('Error Response Status:', error.response.status);
      console.error('Error Response Body:', error.response.data);
    } else {
      console.error('Error Message:', error.message);
    }
  }
}

test();
