
"use client";

import { useState } from 'react';
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { ArrowLeft, Mail, CheckCircle } from 'lucide-react';
import { SevaLogo } from '@/components/seva-logo';
import { useRouter } from 'next/navigation';
import { useToast } from '@/hooks/use-toast';
import { getSupabase } from '@/lib/supabase/client';

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [emailSent, setEmailSent] = useState(false);
  const router = useRouter();
  const { toast } = useToast();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const trimmedEmail = email.trim();
    
    if (!trimmedEmail) {
      toast({ 
        title: "Email Required", 
        description: "Please enter your email address.", 
        variant: "destructive" 
      });
      return;
    }

    // Email validation
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(trimmedEmail)) {
      toast({ 
        title: "Invalid Email", 
        description: "Please enter a valid email address.", 
        variant: "destructive" 
      });
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
      console.error("Error during password reset request:", error);
      toast({ 
        title: "Error", 
        description: error instanceof Error ? error.message : "An error occurred. Please try again.", 
        variant: "destructive" 
      });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="flex items-center justify-center min-h-screen bg-gradient-to-br from-blue-50 via-white to-blue-50 p-4">
      <Card className="w-full max-w-md shadow-2xl border-0 overflow-hidden">
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

        <CardContent className="pt-8 pb-8 px-4 sm:px-8 -mt-6 relative">
          <div className="bg-white rounded-lg shadow-sm border p-6">
            {!emailSent ? (
              <>
                <div className="flex items-center justify-center mb-4">
                  <div className="bg-blue-100 rounded-full p-3">
                    <Mail className="h-8 w-8 text-blue-600" />
                  </div>
                </div>
                
                <h2 className="text-2xl font-semibold text-gray-800 mb-2 text-center">Forgot Password?</h2>
                <p className="text-gray-500 text-sm mb-6 text-center">
                  Enter your staff email address and we'll email you a link to set a new password.
                </p>
                
                <form onSubmit={handleSubmit} className="space-y-5">
                  <div className="space-y-2">
                    <Label htmlFor="email" className="text-gray-700 font-medium">
                      Email Address
                    </Label>
                    <Input
                      id="email"
                      type="email"
                      placeholder="Enter your registered email"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      required
                      className="h-12 px-4 bg-gray-50 border-gray-200 focus:bg-white transition-colors"
                    />
                  </div>

                  <Button 
                    type="submit" 
                    className="w-full h-12 bg-gradient-to-r from-blue-600 to-blue-700 hover:from-blue-700 hover:to-blue-800 text-white font-semibold text-base shadow-lg shadow-blue-200 transition-all duration-200" 
                    disabled={isLoading}
                  >
                    {isLoading ? 'Sending...' : 'Send Reset Link'}
                  </Button>
                </form>

                <div className="mt-6 text-center">
                  <button 
                    type="button" 
                    onClick={() => router.push('/login')}
                    className="text-sm text-gray-600 hover:text-gray-800 font-medium transition-colors inline-flex items-center gap-2"
                  >
                    <ArrowLeft className="h-4 w-4" />
                    Back to Login
                  </button>
                </div>
              </>
            ) : (
              <div className="text-center py-4">
                <div className="flex items-center justify-center mb-4">
                  <div className="bg-green-100 rounded-full p-3">
                    <CheckCircle className="h-12 w-12 text-green-600" />
                  </div>
                </div>
                <h2 className="text-2xl font-semibold text-gray-800 mb-2">Check Your Email</h2>
                <p className="text-gray-500 text-sm mb-4">
                  If <strong>{email}</strong> belongs to a staff account, a link to set a new password is on its way.
                </p>
                <Button variant="outline" onClick={() => router.push('/login')}>Back to Login</Button>
              </div>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
