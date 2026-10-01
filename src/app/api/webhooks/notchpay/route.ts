import { NextResponse } from 'next/server';
import crypto from 'crypto';

// Helper to verify the webhook signature
function verifySignature(payload: string, signature: string, hash: string): boolean {
  const hmac = crypto.createHmac('sha256', hash);
  const expectedSignature = hmac.update(payload).digest('hex');
  
  // Use timingSafeEqual to prevent timing attacks
  try {
    return crypto.timingSafeEqual(
      new Uint8Array(Buffer.from(signature)),
      new Uint8Array(Buffer.from(expectedSignature))
    );
  } catch {
    return false;
  }
}

export async function POST(request: Request) {
  const body = await request.text(); // Get raw body for signature verification
  const signature = request.headers.get('x-notch-signature') || '';
  const hash = process.env.NOTCHPAY_HASH_KEY!;

  // 1. Verify the signature
  if (!verifySignature(body, signature, hash)) {
    console.error('Invalid webhook signature');
    return NextResponse.json({ error: 'Invalid signature' }, { status: 403 });
  }

  // 2. Parse the event
  const event = JSON.parse(body);
  const eventType = event.type;
  const eventData = event.data;

  // 3. Handle the event asynchronously (respond fast)
  if (eventType === 'payment.complete') {
    // Payment was successful!
    const transactionReference = eventData.reference;
    
    // TODO: Update your database
    // await db.orders.update({ 
    //   where: { reference: transactionReference }, 
    //   data: { status: 'PAID' } 
    // });
    
    console.log(`✅ Payment verified for order: ${transactionReference}`);
  } else if (eventType === 'payment.failed') {
    // Payment failed
    console.log(`❌ Payment failed for order: ${eventData.reference}`);
  }

  // 4. Always respond with 200 to acknowledge receipt
  return NextResponse.json({ received: true });
}