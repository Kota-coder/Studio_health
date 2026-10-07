import { NextResponse } from 'next/server';
import { getCurrentStaff } from '@/lib/supabase/server';
import { configuredGateways } from '@/lib/payments/gateways.server';

// GET -> the online payment providers that are connected (none until one is added).
export async function GET() {
  if (!(await getCurrentStaff())) return NextResponse.json({ error: 'Not signed in.' }, { status: 401 });
  return NextResponse.json({ gateways: configuredGateways().map(({ id, label }) => ({ id, label })) });
}
