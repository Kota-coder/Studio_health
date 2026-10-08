"use client";

import { useState } from 'react';
import Link from 'next/link';
import { ArrowLeft, CheckCircle, Mail } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { AuthBrandHeader } from '@/components/auth-brand-header';
import { useT } from '@/components/language-provider';
import { useToast } from '@/hooks/use-toast';
import { getSupabase } from '@/lib/supabase/client';

// Emails a link to set a new password. Public page.
export default function ForgotPasswordPage() {
  const t = useT();
  const { toast } = useToast();
  const [email, setEmail] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [emailSent, setEmailSent] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const trimmedEmail = email.trim();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmedEmail)) {
      toast({ title: 'Please enter a valid email address', variant: 'destructive' });
      return;
    }
    setIsLoading(true);
    try {
      // Supabase emails a reset link (if the address belongs to a staff login).
      // The link lands on /auth/confirm, which signs the user in and opens /set-password.
      const { error } = await getSupabase().auth.resetPasswordForEmail(trimmedEmail, {
        redirectTo: `${window.location.origin}/auth/confirm?next=/set-password`,
      });
      if (error) throw error;
      setEmailSent(true);
    } catch (error) {
      toast({ title: 'Could not send the link', description: error instanceof Error ? error.message : 'Please try again.', variant: 'destructive' });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-gradient-to-br from-primary/5 via-background to-primary/10 p-4">
      <Card className="w-full max-w-md overflow-hidden border-0 shadow-2xl">
        <CardHeader className="relative bg-primary p-6 pb-10 text-primary-foreground sm:p-8 sm:pb-12">
          <AuthBrandHeader />
        </CardHeader>

        <CardContent className="relative -mt-6 px-4 pb-8 pt-8 sm:px-8">
          <div className="rounded-lg border bg-card p-6 shadow-sm">
            {!emailSent ? (
              <>
                <div className="mb-4 flex justify-center">
                  <div className="rounded-full bg-primary/10 p-3"><Mail className="h-8 w-8 text-primary" /></div>
                </div>
                <h2 className="mb-2 text-center text-2xl font-semibold">{t('Forgot password?')}</h2>
                <p className="mb-6 text-center text-sm text-muted-foreground">
                  {t("Enter your staff email address and we'll email you a link to set a new password.")}
                </p>
                <form onSubmit={handleSubmit} className="space-y-5">
                  <div className="space-y-2">
                    <Label htmlFor="email" className="font-medium">Email Address</Label>
                    <Input id="email" type="email" autoComplete="email" inputMode="email" placeholder="Enter your registered email"
                      value={email} onChange={e => setEmail(e.target.value)} required className="h-12 px-4" />
                  </div>
                  <Button type="submit" className="h-12 w-full text-base font-semibold" disabled={isLoading}>
                    {isLoading ? t('Sending…') : t('Send reset link')}
                  </Button>
                </form>
                <div className="mt-6 text-center">
                  <Link href="/login" className="inline-flex items-center gap-2 text-sm font-medium text-muted-foreground hover:text-foreground">
                    <ArrowLeft className="h-4 w-4" /> {t('Back to Login')}
                  </Link>
                </div>
              </>
            ) : (
              <div className="py-4 text-center">
                <div className="mb-4 flex justify-center">
                  <div className="rounded-full bg-green-100 p-3"><CheckCircle className="h-12 w-12 text-green-600" /></div>
                </div>
                <h2 className="mb-2 text-2xl font-semibold">{t('Check your email')}</h2>
                <p className="mb-4 break-words text-sm text-muted-foreground">
                  If <strong>{email.trim()}</strong> belongs to a staff account, a link to set a new password is on its way.
                </p>
                <Button variant="outline" asChild><Link href="/login">{t('Back to Login')}</Link></Button>
              </div>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
