
"use client";

import { useState } from 'react';
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Heart, ArrowLeft, Mail, CheckCircle } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useToast } from '@/hooks/use-toast';

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
      // Check if email exists in staff members
      const storedStaff = localStorage.getItem('staffMembers');
      if (storedStaff) {
        const staffMembers = JSON.parse(storedStaff);
        const staffExists = staffMembers.find(
          (staff: any) => staff.email?.toLowerCase() === trimmedEmail.toLowerCase()
        );

        if (staffExists) {
          // Generate verification code
          const verificationCode = Math.floor(100000 + Math.random() * 900000).toString();
          
          // Store verification code with expiry (10 minutes)
          const verificationData = {
            email: trimmedEmail,
            code: verificationCode,
            expiry: Date.now() + 10 * 60 * 1000, // 10 minutes
            attempts: 0
          };
          localStorage.setItem('passwordResetVerification', JSON.stringify(verificationData));

          // In a real application, this would send an email via backend API
          // For now, we'll show the code in console and toast (for demo purposes)
          console.log(`Password Reset Code for ${trimmedEmail}: ${verificationCode}`);
          
          toast({ 
            title: "Verification Code Sent", 
            description: `A 6-digit verification code has been sent to ${trimmedEmail}. Check the console for demo purposes.`,
          });

          setEmailSent(true);
          
          // Redirect to verification page after 2 seconds
          setTimeout(() => {
            router.push(`/reset-password?email=${encodeURIComponent(trimmedEmail)}`);
          }, 2000);
        } else {
          toast({ 
            title: "Email Not Found", 
            description: "No account found with this email address.", 
            variant: "destructive" 
          });
        }
      }
    } catch (error) {
      console.error("Error during password reset request:", error);
      toast({ 
        title: "Error", 
        description: "An error occurred. Please try again.", 
        variant: "destructive" 
      });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="flex items-center justify-center min-h-screen bg-gradient-to-br from-blue-50 via-white to-blue-50 p-4">
      <Card className="w-full max-w-md shadow-2xl border-0 overflow-hidden">
        <CardHeader className="bg-gradient-to-r from-blue-600 to-blue-700 text-white p-8 pb-12 relative">
          <div className="flex items-center justify-center gap-3 mb-2">
            <div className="bg-white/20 backdrop-blur-sm rounded-full p-3">
              <Heart className="h-8 w-8 text-white fill-white" />
            </div>
            <div>
              <h1 className="text-3xl font-bold tracking-tight">CardioCare</h1>
              <p className="text-blue-100 text-sm">Healthcare Management</p>
            </div>
          </div>
        </CardHeader>

        <CardContent className="pt-8 pb-8 px-8 -mt-6 relative">
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
                  Enter your email address and we'll send you a verification code to reset your password.
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
                    {isLoading ? 'Sending...' : 'Send Verification Code'}
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
                  We've sent a 6-digit verification code to <strong>{email}</strong>
                </p>
                <p className="text-gray-400 text-xs">
                  Redirecting to verification page...
                </p>
              </div>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
