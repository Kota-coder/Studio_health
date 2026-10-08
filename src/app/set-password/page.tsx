"use client";

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { KeyRound } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from '@/components/ui/card';
import { PageLoading } from '@/components/page';
import { useT } from '@/components/language-provider';
import { useToast } from '@/hooks/use-toast';
import { getSupabase } from '@/lib/supabase/client';

const MIN_PASSWORD_LENGTH = 8;

// Reached from an invite or password-reset email (via /auth/confirm), which signs the user in.
export default function SetPasswordPage() {
  const t = useT();
  const { toast } = useToast();
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [hasSession, setHasSession] = useState<boolean | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    getSupabase().auth.getUser().then(({ data: { user } }) => setHasSession(!!user));
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (password.length < MIN_PASSWORD_LENGTH) {
      toast({ title: 'Password too short', description: `Use at least ${MIN_PASSWORD_LENGTH} characters.`, variant: 'destructive' });
      return;
    }
    if (password !== confirmPassword) {
      toast({ title: "Passwords don't match", description: 'Please re-enter the same password.', variant: 'destructive' });
      return;
    }
    setIsSaving(true);
    const { error } = await getSupabase().auth.updateUser({ password });
    setIsSaving(false);
    if (error) {
      toast({ title: 'Could not set the password', description: error.message, variant: 'destructive' });
      return;
    }
    toast({ title: 'Password set', description: 'You can now use this password to log in.' });
    window.location.assign('/dashboard');
  };

  if (hasSession === null) return <PageLoading />;

  if (!hasSession) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-background p-4">
        <Card className="w-full max-w-sm shadow-xl">
          <CardHeader className="text-center">
            <CardTitle className="text-2xl">{t('Link expired')}</CardTitle>
            <CardDescription>{t('This link is invalid or has expired. Ask an admin to resend your invite, or use "Forgot password?" on the login page.')}</CardDescription>
          </CardHeader>
          <CardFooter>
            <Button className="w-full" asChild><Link href="/login">{t('Go to Login')}</Link></Button>
          </CardFooter>
        </Card>
      </div>
    );
  }

  return (
    <div className="flex items-center justify-center min-h-screen bg-background p-4">
      <Card className="w-full max-w-sm shadow-xl">
        <CardHeader className="text-center">
          <KeyRound className="mx-auto h-10 w-10 text-primary mb-3" />
          <CardTitle className="text-2xl">{t('Set your password')}</CardTitle>
          <CardDescription>{t('Choose a password for your staff account.')}</CardDescription>
        </CardHeader>
        <form onSubmit={handleSubmit}>
          <CardContent className="grid gap-4">
            <div>
              <Label htmlFor="password">New Password</Label>
              <Input id="password" type="password" autoComplete="new-password" value={password} onChange={(e) => setPassword(e.target.value)} required />
            </div>
            <div>
              <Label htmlFor="confirmPassword">Confirm Password</Label>
              <Input id="confirmPassword" type="password" autoComplete="new-password" value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)} required />
            </div>
          </CardContent>
          <CardFooter>
            <Button type="submit" className="w-full" disabled={isSaving}>
              {isSaving ? t('Saving…') : t('Set password')}
            </Button>
          </CardFooter>
        </form>
      </Card>
    </div>
  );
}
