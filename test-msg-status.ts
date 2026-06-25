import axios from 'axios';

const token = 'EAASZBpdyBwIQBRz4SY3XwIAnBZBBGZAkxt5G4sFZBZBrYqZAAsPWqItymG23p9VLJZA3IFtJX5QlrBcwvcR8WGfzwY2nxmyVIUsuWH7xK6d2uYX32ZBYDzrImL8EmTM2ZAwX6UMRZAFKqc2PNujrP4IqZBZB8A4pEI8GYmCwJAfWZAtRxooS3x4RpnDl7bQCjPkGVcDXC6MGlkI8MTEAYArb8yJBIaoW0MeTrsKWnlkGZB6x5eZBoZCuq2r3TO7ZCQfOJ0DHxEggFslfkkMsXazbFKJEPaDZARHxgH';
const msgId = 'wamid.HBgMOTY2NTYzMTA0ODI4FQIAERgSRjk5RkU3MjM5N0UxOEVDM0I2AA==';

async function test() {
  try {
    console.log('Querying message status from Meta Graph API...');
    const res = await axios.get(`https://graph.facebook.com/v18.0/${msgId}`, {
      headers: {
        Authorization: `Bearer ${token}`
      }
    });
    console.log('Response:', JSON.stringify(res.data, null, 2));
  } catch (error: any) {
    console.error('Error:', error.response?.status, error.response?.data || error.message);
  }
}

test();
