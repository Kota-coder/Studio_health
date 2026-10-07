import 'server-only';
import { createServerClient } from '@supabase/ssr';
import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { cookies } from 'next/headers';

// Server-side client acting as the signed-in user (route handlers, server actions).
export async function getServerSupabase(): Promise<SupabaseClient> {
  const cookieStore = await cookies();
  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll: () => cookieStore.getAll(),
        setAll: (cookiesToSet) => {
          try {
            cookiesToSet.forEach(({ name, value, options }) => cookieStore.set(name, value, options));
          } catch {
            // Called from a server component, where cookies are read-only; middleware refreshes them.
          }
        },
      },
    },
  );
}

// Service-role client: bypasses row level security. Only for trusted server code
// that has already checked the caller's role (e.g. creating staff logins).
export function getAdminSupabase(): SupabaseClient {
  return createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}

export interface StaffCaller {
  id: number;
  name: string;
  role: string;
}

// Returns the active staff record for the current session, or null.
export async function getCurrentStaff(): Promise<StaffCaller | null> {
  const supabase = await getServerSupabase();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;
  const { data } = await supabase
    .from('staff')
    .select('id, name, role')
    .eq('auth_user_id', user.id)
    .eq('active', true)
    .maybeSingle();
  return data;
}
