
"use client";

import { useState, useEffect, Suspense } from 'react';
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Heart, Eye, EyeOff, ArrowLeft } from 'lucide-react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useToast } from '@/hooks/use-toast';

function ResetPasswordContent() {
  const [verificationCode, setVerificationCode] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [step, setStep] = useState<'verify' | 'reset'>('verify');
  const searchParams = useSearchParams();
  const router = useRouter();
  const { toast } = useToast();

  const email = searchParams.get('email');

  useEffect(() => {
    if (!email) {
      toast({ 
        title: "Invalid Request", 
        description: "Please start the password reset process from the forgot password page.", 
        variant: "destructive" 
      });
      router.push('/forgot-password');
    }
  }, [email, router, toast]);

  const handleVerifyCode = (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);

    try {
      const storedVerification = localStorage.getItem('passwordResetVerification');
      
      if (!storedVerification) {
        toast({ 
          title: "Verification Expired", 
          description: "Your verification code has expired. Please request a new one.", 
          variant: "destructive" 
        });
        router.push('/forgot-password');
        return;
      }

      const verificationData = JSON.parse(storedVerification);
      
      // Check expiry
      if (Date.now() > verificationData.expiry) {
        localStorage.removeItem('passwordResetVerification');
        toast({ 
          title: "Code Expired", 
          description: "Your verification code has expired. Please request a new one.", 
          variant: "destructive" 
        });
        router.push('/forgot-password');
        return;
      }

      // Check attempts
      if (verificationData.attempts >= 5) {
        localStorage.removeItem('passwordResetVerification');
        toast({ 
          title: "Too Many Attempts", 
          description: "You've exceeded the maximum number of attempts. Please request a new code.", 
          variant: "destructive" 
        });
        router.push('/forgot-password');
        return;
      }

      // Verify code
      if (verificationCode.trim() === verificationData.code && email === verificationData.email) {
        toast({ 
          title: "Code Verified", 
          description: "Your verification code is correct. Please set a new password." 
        });
        setStep('reset');
      } else {
        verificationData.attempts += 1;
        localStorage.setItem('passwordResetVerification', JSON.stringify(verificationData));
        toast({ 
          title: "Invalid Code", 
          description: `Incorrect verification code. ${5 - verificationData.attempts} attempts remaining.`, 
          variant: "destructive" 
        });
      }
    } catch (error) {
      console.error("Error verifying code:", error);
      toast({ 
        title: "Error", 
        description: "An error occurred. Please try again.", 
        variant: "destructive" 
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleResetPassword = (e: React.FormEvent) => {
    e.preventDefault();
    
    if (newPassword.length < 8) {
      toast({ 
        title: "Weak Password", 
        description: "Password must be at least 8 characters long.", 
        variant: "destructive" 
      });
      return;
    }

    if (newPassword !== confirmPassword) {
      toast({ 
        title: "Passwords Don't Match", 
        description: "Please make sure both passwords match.", 
        variant: "destructive" 
      });
      return;
    }

    setIsLoading(true);

    try {
      // In a real application, this would update the password via backend API
      // For this demo, we'll just show success and clear verification
      localStorage.removeItem('passwordResetVerification');
      
      toast({ 
        title: "Password Reset Successful", 
        description: "Your password has been updated. Please login with your new password." 
      });

      // Redirect to login after 2 seconds
      setTimeout(() => {
        router.push('/login');
      }, 2000);
    } catch (error) {
      console.error("Error resetting password:", error);
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
            {step === 'verify' ? (
              <>
                <h2 className="text-2xl font-semibold text-gray-800 mb-2 text-center">Enter Verification Code</h2>
                <p className="text-gray-500 text-sm mb-6 text-center">
                  We've sent a 6-digit code to <strong>{email}</strong>
                </p>
                
                <form onSubmit={handleVerifyCode} className="space-y-5">
                  <div className="space-y-2">
                    <Label htmlFor="code" className="text-gray-700 font-medium">
                      Verification Code
                    </Label>
                    <Input
                      id="code"
                      type="text"
                      placeholder="Enter 6-digit code"
                      value={verificationCode}
                      onChange={(e) => setVerificationCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
                      required
                      maxLength={6}
                      className="h-12 px-4 bg-gray-50 border-gray-200 focus:bg-white transition-colors text-center text-2xl tracking-widest"
                    />
                    <p className="text-xs text-gray-400 mt-1.5">
                      Code expires in 10 minutes. Check console for demo code.
                    </p>
                  </div>

                  <Button 
                    type="submit" 
                    className="w-full h-12 bg-gradient-to-r from-blue-600 to-blue-700 hover:from-blue-700 hover:to-blue-800 text-white font-semibold text-base shadow-lg shadow-blue-200 transition-all duration-200" 
                    disabled={isLoading || verificationCode.length !== 6}
                  >
                    {isLoading ? 'Verifying...' : 'Verify Code'}
                  </Button>
                </form>

                <div className="mt-6 text-center">
                  <button 
                    type="button" 
                    onClick={() => router.push('/forgot-password')}
                    className="text-sm text-gray-600 hover:text-gray-800 font-medium transition-colors inline-flex items-center gap-2"
                  >
                    <ArrowLeft className="h-4 w-4" />
                    Request New Code
                  </button>
                </div>
              </>
            ) : (
              <>
                <h2 className="text-2xl font-semibold text-gray-800 mb-2 text-center">Set New Password</h2>
                <p className="text-gray-500 text-sm mb-6 text-center">
                  Choose a strong password for your account
                </p>
                
                <form onSubmit={handleResetPassword} className="space-y-5">
                  <div className="space-y-2">
                    <Label htmlFor="newPassword" className="text-gray-700 font-medium">
                      New Password
                    </Label>
                    <div className="relative">
                      <Input
                        id="newPassword"
                        type={showNewPassword ? "text" : "password"}
                        placeholder="Enter new password"
                        value={newPassword}
                        onChange={(e) => setNewPassword(e.target.value)}
                        required
                        className="h-12 px-4 pr-12 bg-gray-50 border-gray-200 focus:bg-white transition-colors"
                      />
                      <button
                        type="button"
                        onClick={() => setShowNewPassword(!showNewPassword)}
                        className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 transition-colors"
                      >
                        {showNewPassword ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}
                      </button>
                    </div>
                    <p className="text-xs text-gray-400 mt-1.5">
                      Must be at least 8 characters long
                    </p>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="confirmPassword" className="text-gray-700 font-medium">
                      Confirm Password
                    </Label>
                    <div className="relative">
                      <Input
                        id="confirmPassword"
                        type={showConfirmPassword ? "text" : "password"}
                        placeholder="Re-enter new password"
                        value={confirmPassword}
                        onChange={(e) => setConfirmPassword(e.target.value)}
                        required
                        className="h-12 px-4 pr-12 bg-gray-50 border-gray-200 focus:bg-white transition-colors"
                      />
                      <button
                        type="button"
                        onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                        className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 transition-colors"
                      >
                        {showConfirmPassword ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}
                      </button>
                    </div>
                  </div>

                  <Button 
                    type="submit" 
                    className="w-full h-12 bg-gradient-to-r from-blue-600 to-blue-700 hover:from-blue-700 hover:to-blue-800 text-white font-semibold text-base shadow-lg shadow-blue-200 transition-all duration-200" 
                    disabled={isLoading}
                  >
                    {isLoading ? 'Resetting...' : 'Reset Password'}
                  </Button>
                </form>
              </>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

export default function ResetPasswordPage() {
  return (
    <Suspense fallback={<div className="flex justify-center items-center min-h-screen">Loading...</div>}>
      <ResetPasswordContent />
    </Suspense>
  );
}
