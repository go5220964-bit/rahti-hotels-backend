import twilio from 'twilio';
console.log('Type of twilio:', typeof twilio);
try {
  const client = twilio('AC123', 'token123');
  console.log('Successfully called twilio()');
} catch (e: any) {
  console.log('Error calling twilio():', e.message);
}
