import { NextResponse } from 'next/server';
import { getAdminSupabase } from '@/lib/supabase/server';
import { findGateway } from '@/lib/payments/gateways.server';

// POST from the payment provider when a payment succeeds, fails or is refunded. The provider's
// signature is checked before anything is recorded; a confirmed payment marks the bill Paid.
// Providers retry webhooks, so handling the same message twice must be harmless.
export async function POST(request: Request, { params }: { params: Promise<{ provider: string }> }) {
  const gateway = findGateway((await params).provider);
  if (!gateway) return NextResponse.json({ error: 'Unknown provider.' }, { status: 404 });

  const rawBody = await request.text();
  const event = await gateway.parseWebhook(rawBody, request.headers).catch(() => null);
  if (!event) return NextResponse.json({ error: 'Invalid signature.' }, { status: 401 });

  const admin = getAdminSupabase();
  const { data: transaction } = await admin.from('payment_transactions').select('id, bill_id, status, amount, created_by_staff_id')
    .eq('provider', gateway.id).eq('provider_order_id', event.providerOrderId).maybeSingle();
  if (!transaction) return NextResponse.json({ error: 'Unknown order.' }, { status: 404 });
  if (event.amount != null && Math.abs(event.amount - Number(transaction.amount)) > 0.01) {
    return NextResponse.json({ error: 'Amount does not match the order.' }, { status: 400 });
  }

  const { error } = await admin.from('payment_transactions').update({
    status: event.status, provider_payment_id: event.providerPaymentId ?? null, method: event.method ?? null,
    details: event.details ?? {}, updated_at: new Date().toISOString(),
  }).eq('id', transaction.id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  if (event.status === 'paid' && transaction.status !== 'paid' && transaction.bill_id) {
    const today = new Intl.DateTimeFormat('en-GB', { timeZone: 'Asia/Kolkata' }).format(new Date()); // dd/MM/yyyy
    const method = await methodNameFor(gateway.id, event.method);
    // Recorded as processed by the staff member who started the online payment.
    await admin.from('bills').update({
      payment_status: 'Paid', payment_date: today, payment_method: method,
      ...(transaction.created_by_staff_id ? { processed_by_staff_id: transaction.created_by_staff_id } : {}),
    })
      .eq('id', transaction.bill_id).neq('payment_status', 'Paid');
    await admin.from('audit_log').insert({
      entity_type: 'bill', entity_id: transaction.bill_id, action_type: 'Paid Online',
      change_details: `Paid online via ${gateway.label}${event.method ? ` (${event.method})` : ''}, ref ${event.providerPaymentId ?? event.providerOrderId}.`,
      staff_name: gateway.label,
    });
  }
  return NextResponse.json({ ok: true });
}

// The payment method to show on the bill: one linked to this provider, else UPI for UPI
// payments, else "Online/Card".
async function methodNameFor(provider: string, method?: string): Promise<string> {
  const { data } = await getAdminSupabase().from('payment_methods').select('name').eq('gateway', provider).eq('active', true).limit(1);
  if (data?.[0]?.name) return data[0].name;
  return method?.toLowerCase() === 'upi' ? 'UPI' : 'Online/Card';
}
