"use client";

import { useState, useEffect } from 'react';
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from "@/components/ui/card";
import { useAuth } from '@/context/AuthContext';
import { LogIn } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useToast } from '@/hooks/use-toast';
import { getSupabase } from '@/lib/supabase/client';

export default function LoginPage() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isSendingReset, setIsSendingReset] = useState(false);
  const { login, currentUser, isLoading } = useAuth();
  const router = useRouter();
  const { toast } = useToast();

  // If user is already logged in, redirect to dashboard
  useEffect(() => {
    if (!isLoading && currentUser) {
      router.replace('/dashboard');
    }
  }, [isLoading, currentUser, router]);

  useEffect(() => {
    if (new URLSearchParams(window.location.search).get('error') === 'link_invalid') {
      toast({ title: "Link Expired", description: "That email link is invalid or has expired.", variant: "destructive" });
    }
  }, [toast]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim() || !password) {
      toast({ title: "Input Required", description: "Email and password are required.", variant: "destructive" });
      return;
    }
    await login(email, password);
  };

  const handleForgotPassword = async () => {
    if (!email.trim()) {
      toast({ title: "Email Required", description: "Enter your email address first.", variant: "destructive" });
      return;
    }
    setIsSendingReset(true);
    const { error } = await getSupabase().auth.resetPasswordForEmail(email.trim(), {
      redirectTo: `${window.location.origin}/auth/confirm?next=/set-password`,
    });
    setIsSendingReset(false);
    if (error) {
      toast({ title: "Could Not Send Email", description: error.message, variant: "destructive" });
      return;
    }
    toast({ title: "Check Your Email", description: "If this email belongs to a staff account, a reset link is on its way." });
  };

  // Render loading or null if redirecting, to prevent rendering the form unnecessarily
  if (isLoading || (!isLoading && currentUser)) {
    return <div className="flex justify-center items-center min-h-screen"><p>Loading...</p></div>;
  }

  return (
    <div className="flex items-center justify-center min-h-screen bg-background p-4">
      <Card className="w-full max-w-sm shadow-xl">
        <CardHeader className="text-center">
          <LogIn className="mx-auto h-10 w-10 text-primary mb-3" />
          <CardTitle className="text-2xl">Staff Login</CardTitle>
          <CardDescription>Sign in with your staff email and password.</CardDescription>
        </CardHeader>
        <form onSubmit={handleSubmit}>
          <CardContent className="grid gap-4">
            <div>
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                type="email"
                autoComplete="email"
                placeholder="name@example.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
              />
            </div>
            <div>
              <Label htmlFor="password">Password</Label>
              <Input
                id="password"
                type="password"
                autoComplete="current-password"
                placeholder="********"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
              />
            </div>
          </CardContent>
          <CardFooter className="flex flex-col gap-2">
            <Button type="submit" className="w-full" disabled={isLoading}>
              {isLoading ? 'Logging in...' : 'Login'}
            </Button>
            <Button type="button" variant="link" size="sm" onClick={handleForgotPassword} disabled={isSendingReset}>
              {isSendingReset ? 'Sending...' : 'Forgot password?'}
            </Button>
          </CardFooter>
        </form>
      </Card>
    </div>
  );
}
