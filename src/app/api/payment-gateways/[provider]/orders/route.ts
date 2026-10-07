import { NextResponse } from 'next/server';
import { getAdminSupabase, getCurrentStaff } from '@/lib/supabase/server';
import { findGateway } from '@/lib/payments/gateways.server';

// POST { billId } -> starts an online payment for a bill's total with this provider and
// returns what the browser needs to open its checkout.
export async function POST(request: Request, { params }: { params: Promise<{ provider: string }> }) {
  const caller = await getCurrentStaff();
  if (!caller) return NextResponse.json({ error: 'Not signed in.' }, { status: 401 });
  const gateway = findGateway((await params).provider);
  if (!gateway) return NextResponse.json({ error: 'This payment provider is not connected.' }, { status: 404 });

  const { billId } = (await request.json().catch(() => ({}))) as { billId?: string };
  if (!billId) return NextResponse.json({ error: 'billId is required.' }, { status: 400 });
  const admin = getAdminSupabase();
  const { data: bill, error } = await admin.from('bills').select('id, patient_name, total_amount, payment_status').eq('id', billId).maybeSingle();
  if (error || !bill) return NextResponse.json({ error: 'Bill not found.' }, { status: 404 });
  if (bill.payment_status === 'Paid' || bill.payment_status === 'Cancelled') {
    return NextResponse.json({ error: `This bill is ${bill.payment_status.toLowerCase()}.` }, { status: 409 });
  }

  const amount = Number(bill.total_amount);
  const order = await gateway.createOrder({ billId, amount, currency: 'INR', description: `${bill.id} · ${bill.patient_name}` });
  const { error: insertError } = await admin.from('payment_transactions').insert({
    bill_id: billId, provider: gateway.id, provider_order_id: order.providerOrderId,
    amount, currency: 'INR', status: 'created', created_by_staff_id: caller.id,
  });
  if (insertError) return NextResponse.json({ error: insertError.message }, { status: 500 });
  return NextResponse.json({ provider: gateway.id, ...order });
}
