"use client";

import type { StaffMember } from '@/types/staff';
import React, { createContext, useContext, useState, useEffect, useCallback, ReactNode } from 'react';
import { useRouter } from 'next/navigation';
import { useToast } from '@/hooks/use-toast';
import { getSupabase } from '@/lib/supabase/client';

interface AuthContextType {
  currentUser: StaffMember | null;
  login: (email: string, password: string) => Promise<boolean>;
  logout: () => Promise<void>;
  isLoading: boolean;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

// Looks up the active staff record linked to the signed-in Supabase user.
async function loadStaffForUser(authUserId: string): Promise<StaffMember | null> {
  const { data, error } = await getSupabase()
    .from('staff')
    .select('id, name, phone_number, email, role, hire_date, salary')
    .eq('auth_user_id', authUserId)
    .eq('active', true)
    .maybeSingle();
  if (error) {
    console.error('Could not load staff profile', error);
    return null;
  }
  if (!data) return null;
  return {
    id: data.id,
    name: data.name,
    phoneNumber: data.phone_number,
    email: data.email,
    role: data.role,
    hireDate: data.hire_date,
    salary: data.salary ?? undefined,
  };
}

export const AuthProvider = ({ children }: { children: ReactNode }) => {
  const [currentUser, setCurrentUser] = useState<StaffMember | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const router = useRouter();
  const { toast } = useToast();

  useEffect(() => {
    const supabase = getSupabase();
    let cancelled = false;

    const syncSession = async (authUserId: string | undefined) => {
      const staffMember = authUserId ? await loadStaffForUser(authUserId) : null;
      if (!cancelled) {
        setCurrentUser(staffMember);
        setIsLoading(false);
      }
    };

    supabase.auth.getUser().then(({ data: { user } }) => syncSession(user?.id));

    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === 'SIGNED_OUT') {
        setCurrentUser(null);
      } else if (event === 'SIGNED_IN' || event === 'USER_UPDATED') {
        // Defer: Supabase recommends not awaiting other calls inside this callback.
        setTimeout(() => syncSession(session?.user.id), 0);
      }
    });

    return () => {
      cancelled = true;
      subscription.unsubscribe();
    };
  }, []);

  const login = useCallback(async (email: string, password: string): Promise<boolean> => {
    setIsLoading(true);
    const supabase = getSupabase();
    const { data, error } = await supabase.auth.signInWithPassword({ email: email.trim(), password });
    if (error || !data.user) {
      toast({ title: "Login Failed", description: "Incorrect email or password.", variant: "destructive" });
      setIsLoading(false);
      return false;
    }

    const staffMember = await loadStaffForUser(data.user.id);
    if (!staffMember) {
      await supabase.auth.signOut();
      toast({ title: "Access Denied", description: "This account is not linked to an active staff member.", variant: "destructive" });
      setIsLoading(false);
      return false;
    }

    setCurrentUser(staffMember);
    setIsLoading(false);
    toast({ title: "Login Successful", description: `Welcome, ${staffMember.name}!` });
    // Full page load: pages prefetched while signed out (e.g. the header's dashboard
    // link) were cached as redirects to /login, and a client-side push would reuse them.
    window.location.assign('/dashboard');
    return true;
  }, [router, toast]);

  const logout = useCallback(async () => {
    await getSupabase().auth.signOut();
    setCurrentUser(null);
    // Full page load so no signed-in page stays in the client-side cache.
    window.location.assign('/login');
    toast({ title: "Logged Out", description: "You have been successfully logged out." });
  }, [router, toast]);

  return (
    <AuthContext.Provider value={{ currentUser, login, logout, isLoading }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = (): AuthContextType => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
