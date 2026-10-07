import 'server-only';
import { createHmac, timingSafeEqual } from 'node:crypto';

// Online payment providers (Razorpay, PhonePe, Cashfree, Stripe, ...).
//
// None is connected yet. To add one:
//   1. Write an object implementing PaymentGateway below (create an order with the provider's
//      API; check the signature on its webhook and turn the message into a GatewayEvent).
//   2. Add it to GATEWAYS, reading its keys from environment variables (never the database).
//   3. In the provider's dashboard, point its webhook at
//      https://<your-address>/api/payment-gateways/<id>/webhook
//   4. Optionally link a payment method to it (payment_methods.gateway), e.g. "UPI (online)".
// The routes in src/app/api/payment-gateways record each payment in payment_transactions and
// mark the bill Paid when the provider confirms it.

export type GatewayStatus = 'created' | 'pending' | 'paid' | 'failed' | 'refunded' | 'cancelled';

export interface GatewayOrderInput {
  billId: string;
  amount: number; // rupees
  currency: 'INR';
  description: string;
}

export interface GatewayOrder {
  providerOrderId: string;
  // Whatever the browser needs to open the provider's checkout (e.g. key id and order id for
  // Razorpay's checkout script, or a hosted payment page URL).
  checkout: Record<string, unknown>;
}

export interface GatewayEvent {
  providerOrderId: string;
  providerPaymentId?: string;
  status: GatewayStatus;
  method?: string; // e.g. 'upi', 'card', 'netbanking'
  amount?: number;
  details?: Record<string, unknown>; // stored for reference; never card numbers or secrets
}

export interface PaymentGateway {
  id: string; // used in URLs and payment_transactions.provider, e.g. 'razorpay'
  label: string; // shown to staff, e.g. 'Razorpay (UPI, cards)'
  isConfigured(): boolean; // true when its keys are set
  createOrder(input: GatewayOrderInput): Promise<GatewayOrder>;
  // Returns null when the signature doesn't check out (the request is then rejected).
  parseWebhook(rawBody: string, headers: Headers): Promise<GatewayEvent | null>;
}

// For trying the whole flow without a real provider account. Only active when
// SEVA_TEST_GATEWAY_SECRET is set — never set it in production. Webhooks are signed with
// HMAC-SHA256 of the raw body in the x-seva-signature header, like most providers do.
const testGateway: PaymentGateway = {
  id: 'test',
  label: 'Test payments (development only)',
  isConfigured: () => !!process.env.SEVA_TEST_GATEWAY_SECRET,
  async createOrder(input) {
    const providerOrderId = `test_order_${input.billId}_${Date.now()}`;
    return { providerOrderId, checkout: { providerOrderId, amount: input.amount, note: 'Send a signed webhook to complete it.' } };
  },
  async parseWebhook(rawBody, headers) {
    const secret = process.env.SEVA_TEST_GATEWAY_SECRET ?? '';
    const expected = createHmac('sha256', secret).update(rawBody).digest('hex');
    const given = headers.get('x-seva-signature') ?? '';
    if (given.length !== expected.length || !timingSafeEqual(Buffer.from(given), Buffer.from(expected))) return null;
    const body = JSON.parse(rawBody) as { orderId: string; paymentId?: string; status: GatewayStatus; method?: string; amount?: number };
    return { providerOrderId: body.orderId, providerPaymentId: body.paymentId, status: body.status, method: body.method, amount: body.amount };
  },
};

// Add real providers here, e.g. `razorpayGateway`.
const GATEWAYS: PaymentGateway[] = [testGateway];

export const configuredGateways = () => GATEWAYS.filter(g => g.isConfigured());
export const findGateway = (id: string) => configuredGateways().find(g => g.id === id) ?? null;
