
"use client";

import { useState, useEffect } from 'react';
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { useAuth } from '@/context/AuthContext';
import { Eye, EyeOff, Heart } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useToast } from '@/hooks/use-toast';
import Link from 'next/link';
import { format } from 'date-fns';
import type { StaffMember } from '@/types/staff';

export default function LoginPage() {
  const [identifier, setIdentifier] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const { login, currentUser, isLoading } = useAuth();
  const router = useRouter();
  const { toast } = useToast();

  useEffect(() => {
    if (!isLoading && currentUser) {
      router.replace('/dashboard');
    }
  }, [isLoading, currentUser, router]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const trimmedIdentifier = identifier.trim();
    if (!trimmedIdentifier) {
      toast({ title: "Input Required", description: "Email or Phone Number is required.", variant: "destructive" });
      return;
    }

    const storedStaff = localStorage.getItem('staffMembers');
    if (!storedStaff || JSON.parse(storedStaff).length === 0) {
      const defaultAdmin: StaffMember = {
        id: 1,
        name: "Admin User",
        email: "admin@clinic.com",
        phoneNumber: "1234567890",
        role: "Admin",
        hireDate: format(new Date(), 'dd/MM/yyyy'),
      };
      localStorage.setItem('nextStaffId', '2');
      localStorage.setItem('staffMembers', JSON.stringify([defaultAdmin]));
    }

    if (typeof window !== 'undefined') {
      const storedStaff = localStorage.getItem('staffMembers');
      let staffExists = false;
      if (storedStaff) {
        try {
          const staffArray = JSON.parse(storedStaff);
          if (Array.isArray(staffArray) && staffArray.length > 0) {
            staffExists = true;
          }
        } catch (error) {
          console.error("Error parsing staffMembers from localStorage:", error);
        }
      }
      if (!staffExists) {
        toast({
          title: "No Staff Found",
          description: "There are no staff members registered in the system. Please add staff members first.",
          variant: "destructive",
        });
        return;
      }
    }

    await login(trimmedIdentifier);
  };

  if (isLoading || (!isLoading && currentUser)) {
    return <div className="flex justify-center items-center min-h-screen"><p>Loading...</p></div>;
  }

  return (
    <div className="flex items-center justify-center min-h-screen bg-gradient-to-br from-blue-50 via-white to-blue-50 p-4">
      <Card className="w-full max-w-md shadow-2xl border-0 overflow-hidden">
        {/* Header with branding */}
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

        {/* Login Form */}
        <CardContent className="pt-8 pb-8 px-8 -mt-6 relative">
          <div className="bg-white rounded-lg shadow-sm border p-6">
            <h2 className="text-2xl font-semibold text-gray-800 mb-2 text-center">Login</h2>
            <p className="text-gray-500 text-sm mb-6 text-center">Welcome back! Please login to your account.</p>
            
            <form onSubmit={handleSubmit} className="space-y-5">
              <div className="space-y-2">
                <Label htmlFor="identifier" className="text-gray-700 font-medium">
                  Email or Phone Number
                </Label>
                <Input
                  id="identifier"
                  type="text"
                  placeholder="Enter your email or phone"
                  value={identifier}
                  onChange={(e) => setIdentifier(e.target.value)}
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
                    placeholder="Enter your password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
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
                <p className="text-xs text-gray-400 mt-1.5">
                  Note: Password field is for UI demonstration only.
                </p>
              </div>

              <div className="flex items-center justify-between text-sm">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input type="checkbox" className="rounded border-gray-300 text-blue-600 focus:ring-blue-500" />
                  <span className="text-gray-600">Remember me</span>
                </label>
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
                className="w-full h-12 bg-gradient-to-r from-blue-600 to-blue-700 hover:from-blue-700 hover:to-blue-800 text-white font-semibold text-base shadow-lg shadow-blue-200 transition-all duration-200" 
                disabled={isLoading}
              >
                {isLoading ? 'Logging in...' : 'Login'}
              </Button>
            </form>

            <div className="mt-6 text-center">
              <p className="text-sm text-gray-500">
                Don't have an account?{' '}
                <Link href="/signup" className="text-blue-600 hover:text-blue-700 font-medium transition-colors">
                  Sign Up
                </Link>
              </p>
            </div>
          </div>

          {/* Footer text */}
          <p className="text-xs text-center text-gray-400 mt-6">
            Default login: admin@clinic.com or 1234567890
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
