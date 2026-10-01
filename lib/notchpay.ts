import { NotchpayClient } from 'notchpay-client';

if (!process.env.NOTCHPAY_PUBLIC_KEY) {
  throw new Error('NOTCHPAY_PUBLIC_KEY is not set');
}

export const notchpay = new NotchpayClient({
  publicKey: process.env.NOTCHPAY_PUBLIC_KEY,
  // You can add privateKey and hashKey here if needed for advanced auth,
  privateKey: process.env.NOTCHPAY_PRIVATE_KEY,
  hashKey: process.env.NOTCHPAY_HASH_KEY,
  // but publicKey is sufficient for creating payments.
});