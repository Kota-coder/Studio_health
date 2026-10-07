
"use client";

import { useState, useEffect } from 'react';
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { useAuth } from '@/context/AuthContext';
import { Eye, EyeOff } from 'lucide-react';
import { SevaLogo } from '@/components/seva-logo';
import { useRouter } from 'next/navigation';
import { useToast } from '@/hooks/use-toast';
import { getSupabase } from '@/lib/supabase/client';

export default function LoginPage() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const { login, currentUser, isLoading } = useAuth();
  const router = useRouter();
  const { toast } = useToast();

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
        toast({ title: "Link Expired", description: "That email link is invalid or has expired.", variant: "destructive" });
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

  if (isLoading || isHandlingEmailLink || (!isLoading && currentUser)) {
    return <div className="flex justify-center items-center min-h-screen"><p>Loading...</p></div>;
  }

  return (
    <div className="flex items-center justify-center min-h-screen bg-gradient-to-br from-blue-50 via-white to-blue-50 p-4">
      <Card className="w-full max-w-md shadow-2xl border-0 overflow-hidden">
        {/* Header with branding */}
        <CardHeader className="bg-gradient-to-r from-blue-600 to-blue-700 text-white p-6 pb-10 sm:p-8 sm:pb-12 relative">
          <div className="flex items-center justify-center gap-3 mb-2">
            <div className="bg-white rounded-full p-2 shadow-sm">
              <SevaLogo className="h-10 w-10" />
            </div>
            <div>
              <h1 className="text-3xl font-bold tracking-tight">Seva</h1>
              <p className="text-blue-100 text-sm">Healthcare Management</p>
            </div>
          </div>
        </CardHeader>

        {/* Login Form */}
        <CardContent className="pt-8 pb-8 px-4 sm:px-8 -mt-6 relative">
          <div className="bg-white rounded-lg shadow-sm border p-6">
            <h2 className="text-2xl font-semibold text-gray-800 mb-2 text-center">Login</h2>
            <p className="text-gray-500 text-sm mb-6 text-center">Welcome back! Please login to your account.</p>
            
            <form onSubmit={handleSubmit} className="space-y-5">
              <div className="space-y-2">
                <Label htmlFor="email" className="text-gray-700 font-medium">
                  Email
                </Label>
                <Input
                  id="email"
                  type="email"
                  autoComplete="email"
                  inputMode="email"
                  placeholder="name@example.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  className="h-12 px-4 bg-gray-50 border-gray-200 focus:bg-white transition-colors"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="password" className="text-gray-700 font-medium">
                  Password
                </Label>
                <div className="relative">
                  <Input
                    id="password"
                    type={showPassword ? "text" : "password"}
                    autoComplete="current-password"
                    placeholder="Enter your password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    required
                    className="h-12 px-4 pr-12 bg-gray-50 border-gray-200 focus:bg-white transition-colors"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 transition-colors"
                    aria-label={showPassword ? "Hide password" : "Show password"}
                  >
                    {showPassword ? (
                      <EyeOff className="h-5 w-5" />
                    ) : (
                      <Eye className="h-5 w-5" />
                    )}
                  </button>
                </div>
              </div>

              <div className="flex items-center justify-end text-sm">
                <button 
                  type="button" 
                  onClick={() => router.push('/forgot-password')}
                  className="text-blue-600 hover:text-blue-700 font-medium transition-colors"
                >
                  Forgot password?
                </button>
              </div>

              <Button 
                type="submit" 
                className="w-full h-12 bg-gradient-to-r from-blue-600 to-blue-700 hover:from-blue-700 hover:to-blue-800 text-white font-semibold text-base shadow-lg shadow-blue-200 transition-colors" 
                disabled={isLoading}
              >
                {isLoading ? 'Logging in...' : 'Login'}
              </Button>
            </form>

          </div>

          <p className="text-xs text-center text-gray-400 mt-6">
            New staff receive an email invite from an admin to set their password.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
