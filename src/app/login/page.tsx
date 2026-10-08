
"use client";

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { Eye, EyeOff } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { PageLoading } from '@/components/page';
import { AuthBrandHeader } from '@/components/auth-brand-header';
import { useT } from '@/components/language-provider';
import { useAuth } from '@/context/AuthContext';
import { useToast } from '@/hooks/use-toast';
import { getSupabase } from '@/lib/supabase/client';

export default function LoginPage() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const { login, currentUser, isLoading } = useAuth();
  const { toast } = useToast();
  const t = useT();

  // Invite and reset emails sent with Supabase's default templates put the session in
  // the URL fragment (#access_token=...), which only the browser can read. Sign in with
  // it, then go on to choose a password.
  const [isHandlingEmailLink, setIsHandlingEmailLink] = useState(
    () => typeof window !== 'undefined' && window.location.hash.includes('access_token='),
  );

  useEffect(() => {
    if (!isHandlingEmailLink) return;
    const params = new URLSearchParams(window.location.hash.slice(1));
    const accessToken = params.get('access_token');
    const refreshToken = params.get('refresh_token');
    const type = params.get('type');
    window.history.replaceState(null, '', window.location.pathname);
    if (!accessToken || !refreshToken) {
      setIsHandlingEmailLink(false);
      return;
    }
    getSupabase().auth.setSession({ access_token: accessToken, refresh_token: refreshToken }).then(({ error }) => {
      if (error) {
        toast({ title: "That email link is invalid or has expired", variant: "destructive" });
        setIsHandlingEmailLink(false);
        return;
      }
      window.location.replace(type === 'invite' || type === 'recovery' ? '/set-password' : '/dashboard');
    });
  }, [isHandlingEmailLink, toast]);

  useEffect(() => {
    if (!isLoading && currentUser && !isHandlingEmailLink) {
      window.location.replace('/dashboard');
    }
  }, [isLoading, currentUser, isHandlingEmailLink]);

  useEffect(() => {
    if (new URLSearchParams(window.location.search).get('error') === 'link_invalid' && !window.location.hash.includes('access_token=')) {
      toast({ title: "That email link is invalid or has expired", variant: "destructive" });
    }
  }, [toast]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim() || !password) {
      toast({ title: "Email and password are required", variant: "destructive" });
      return;
    }
    await login(email, password);
  };

  if (isLoading || isHandlingEmailLink || currentUser) return <PageLoading />;

  return (
    <div className="flex min-h-screen items-center justify-center bg-gradient-to-br from-primary/5 via-background to-primary/10 p-4">
      <Card className="w-full max-w-md overflow-hidden border-0 shadow-2xl">
        <CardHeader className="relative bg-primary p-6 pb-10 text-primary-foreground sm:p-8 sm:pb-12">
          <AuthBrandHeader />
        </CardHeader>

        <CardContent className="relative -mt-6 px-4 pb-8 pt-8 sm:px-8">
          <div className="rounded-lg border bg-card p-6 shadow-sm">
            <h2 className="mb-2 text-center text-2xl font-semibold">{t('Login')}</h2>
            <p className="mb-6 text-center text-sm text-muted-foreground">{t('Welcome back! Please login to your account.')}</p>

            <form onSubmit={handleSubmit} className="space-y-5">
              <div className="space-y-2">
                <Label htmlFor="email" className="font-medium">Email</Label>
                <Input id="email" type="email" autoComplete="email" inputMode="email" placeholder="name@example.com"
                  value={email} onChange={e => setEmail(e.target.value)} required className="h-12 px-4" />
              </div>

              <div className="space-y-2">
                <Label htmlFor="password" className="font-medium">Password</Label>
                <div className="relative">
                  <Input id="password" type={showPassword ? 'text' : 'password'} autoComplete="current-password" placeholder="Enter your password"
                    value={password} onChange={e => setPassword(e.target.value)} required className="h-12 px-4 pr-12" />
                  <button type="button" onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-4 top-1/2 -translate-y-1/2 text-muted-foreground transition-colors hover:text-foreground"
                    aria-label={showPassword ? 'Hide password' : 'Show password'}>
                    {showPassword ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}
                  </button>
                </div>
              </div>

              <div className="flex justify-end text-sm">
                <Link href="/forgot-password" className="font-medium text-primary hover:underline">{t('Forgot password?')}</Link>
              </div>

              <Button type="submit" className="h-12 w-full text-base font-semibold">{t('Login')}</Button>
            </form>
          </div>

          <p className="mt-6 text-center text-xs text-muted-foreground">{t('New staff receive an email invite from an admin to set their password.')}</p>
          <p className="mt-2 text-center text-[11px] text-muted-foreground/80">Powered by Seva</p>
        </CardContent>
      </Card>
    </div>
  );
}
