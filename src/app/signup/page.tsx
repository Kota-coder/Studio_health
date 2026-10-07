
"use client";

import { useState } from 'react';
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Eye, EyeOff, Heart, Mail, Phone } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useToast } from '@/hooks/use-toast';
import type { StaffMember, StaffRole } from '@/types/staff';
import Link from 'next/link';
import { format } from 'date-fns';
import { STORAGE_KEYS, takeNextNumericId } from '@/lib/storage';

const STAFF_ROLES: StaffRole[] = ["Admin", "Doctor", "Nurse", "Receptionist", "Accounts"];

export default function SignUpPage() {
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    phoneNumber: '',
    role: '' as StaffRole | '',
    password: '',
    confirmPassword: ''
  });
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [verificationMethod, setVerificationMethod] = useState<'email' | 'phone' | null>(null);
  const [verificationCode, setVerificationCode] = useState('');
  const [generatedCode, setGeneratedCode] = useState('');
  const [isVerifying, setIsVerifying] = useState(false);
  const router = useRouter();
  const { toast } = useToast();

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { id, value } = e.target;
    setFormData(prev => ({ ...prev, [id]: value }));
  };

  const handleRoleChange = (value: string) => {
    setFormData(prev => ({ ...prev, role: value as StaffRole }));
  };

  const validateForm = () => {
    if (!formData.name.trim()) {
      toast({ title: "Validation Error", description: "Name is required.", variant: "destructive" });
      return false;
    }

    // At least one contact method required
    const hasEmail = formData.email.trim() !== '';
    const hasPhone = formData.phoneNumber.trim() !== '';

    if (!hasEmail && !hasPhone) {
      toast({ 
        title: "Validation Error", 
        description: "Please provide either an email or phone number.", 
        variant: "destructive" 
      });
      return false;
    }

    // Validate email if provided
    if (hasEmail && !/^\S+@\S+\.\S+$/.test(formData.email)) {
      toast({ title: "Validation Error", description: "Please enter a valid email address.", variant: "destructive" });
      return false;
    }

    // Validate phone if provided
    if (hasPhone && !/^\d{10}$/.test(formData.phoneNumber)) {
      toast({ title: "Validation Error", description: "Phone number must be exactly 10 digits.", variant: "destructive" });
      return false;
    }

    if (!formData.role) {
      toast({ title: "Validation Error", description: "Role is required.", variant: "destructive" });
      return false;
    }
    if (!formData.password || formData.password.length < 6) {
      toast({ title: "Validation Error", description: "Password must be at least 6 characters.", variant: "destructive" });
      return false;
    }
    if (formData.password !== formData.confirmPassword) {
      toast({ title: "Validation Error", description: "Passwords do not match.", variant: "destructive" });
      return false;
    }
    return true;
  };

  const generateVerificationCode = () => {
    return Math.floor(100000 + Math.random() * 900000).toString();
  };

  const sendVerificationCode = (method: 'email' | 'phone') => {
    const code = generateVerificationCode();
    setGeneratedCode(code);
    
    const destination = method === 'email' ? formData.email : formData.phoneNumber;
    
    // Simulate sending verification code
    console.log(`Verification code ${code} sent to ${method}: ${destination}`);
    
    toast({
      title: "Verification Code Sent",
      description: `A 6-digit code has been sent to your ${method}${method === 'email' ? '' : ' number'}.`,
    });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!validateForm()) {
      return;
    }

    setIsLoading(true);

    try {
      // Check if user already exists
      const storedStaff = localStorage.getItem('staffMembers');
      let staffMembers: StaffMember[] = storedStaff ? JSON.parse(storedStaff) : [];

      // Check email if provided
      if (formData.email.trim()) {
        const emailExists = staffMembers.some(staff => 
          staff.email && staff.email.toLowerCase() === formData.email.toLowerCase()
        );
        if (emailExists) {
          toast({ 
            title: "Registration Failed", 
            description: "Email already registered.", 
            variant: "destructive" 
          });
          setIsLoading(false);
          return;
        }
      }

      // Check phone if provided
      if (formData.phoneNumber.trim()) {
        const phoneExists = staffMembers.some(staff => 
          staff.phoneNumber === formData.phoneNumber
        );
        if (phoneExists) {
          toast({ 
            title: "Registration Failed", 
            description: "Phone number already registered.", 
            variant: "destructive" 
          });
          setIsLoading(false);
          return;
        }
      }

      // Determine verification method (prefer email if both provided)
      const method: 'email' | 'phone' = formData.email.trim() ? 'email' : 'phone';
      setVerificationMethod(method);
      sendVerificationCode(method);
      setIsVerifying(true);
      setIsLoading(false);

    } catch (error) {
      console.error("Error during registration:", error);
      toast({ 
        title: "Registration Error", 
        description: "An unexpected error occurred.", 
        variant: "destructive" 
      });
      setIsLoading(false);
    }
  };

  const handleVerifyCode = () => {
    if (verificationCode === generatedCode) {
      // Create new staff member
      const storedStaff = localStorage.getItem('staffMembers');
      let staffMembers: StaffMember[] = storedStaff ? JSON.parse(storedStaff) : [];

      const newStaffMember: StaffMember = {
        id: takeNextNumericId(STORAGE_KEYS.nextStaffId, staffMembers),
        name: formData.name.trim(),
        email: formData.email.trim().toLowerCase(),
        phoneNumber: formData.phoneNumber.trim(),
        role: formData.role as StaffRole,
        hireDate: format(new Date(), 'dd/MM/yyyy'),
        password: formData.password // In production, this should be hashed
      };

      staffMembers.push(newStaffMember);
      localStorage.setItem('staffMembers', JSON.stringify(staffMembers));

      toast({ 
        title: "Registration Successful", 
        description: "Your account has been created. Please login." 
      });

      // Redirect to login page
      setTimeout(() => {
        router.push('/login');
      }, 1000);
    } else {
      toast({
        title: "Verification Failed",
        description: "Invalid verification code. Please try again.",
        variant: "destructive"
      });
    }
  };

  const handleResendCode = () => {
    if (verificationMethod) {
      sendVerificationCode(verificationMethod);
      setVerificationCode('');
    }
  };

  if (isVerifying) {
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
              <div className="text-center mb-6">
                <div className="inline-flex items-center justify-center w-16 h-16 bg-blue-100 rounded-full mb-4">
                  {verificationMethod === 'email' ? (
                    <Mail className="h-8 w-8 text-blue-600" />
                  ) : (
                    <Phone className="h-8 w-8 text-blue-600" />
                  )}
                </div>
                <h2 className="text-2xl font-semibold text-gray-800 mb-2">Verify Your {verificationMethod === 'email' ? 'Email' : 'Phone'}</h2>
                <p className="text-gray-500 text-sm">
                  Enter the 6-digit code sent to{' '}
                  <strong>{verificationMethod === 'email' ? formData.email : formData.phoneNumber}</strong>
                </p>
              </div>

              <div className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="verificationCode" className="text-gray-700 font-medium">
                    Verification Code
                  </Label>
                  <Input
                    id="verificationCode"
                    type="text"
                    placeholder="Enter 6-digit code"
                    value={verificationCode}
                    onChange={(e) => setVerificationCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
                    maxLength={6}
                    className="h-12 px-4 bg-gray-50 border-gray-200 focus:bg-white transition-colors text-center text-lg tracking-widest"
                  />
                </div>

                <Button
                  onClick={handleVerifyCode}
                  className="w-full h-12 bg-gradient-to-r from-blue-600 to-blue-700 hover:from-blue-700 hover:to-blue-800 text-white font-semibold text-base shadow-lg shadow-blue-200 transition-all duration-200"
                  disabled={verificationCode.length !== 6}
                >
                  Verify & Complete Registration
                </Button>

                <div className="text-center">
                  <button
                    type="button"
                    onClick={handleResendCode}
                    className="text-sm text-blue-600 hover:text-blue-700 font-medium transition-colors"
                  >
                    Resend Code
                  </button>
                </div>

                <div className="text-center">
                  <button
                    type="button"
                    onClick={() => {
                      setIsVerifying(false);
                      setVerificationCode('');
                      setGeneratedCode('');
                    }}
                    className="text-sm text-gray-600 hover:text-gray-800 transition-colors"
                  >
                    Change Details
                  </button>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    );
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

        {/* Sign Up Form */}
        <CardContent className="pt-8 pb-8 px-8 -mt-6 relative">
          <div className="bg-white rounded-lg shadow-sm border p-6">
            <h2 className="text-2xl font-semibold text-gray-800 mb-2 text-center">Sign Up</h2>
            <p className="text-gray-500 text-sm mb-6 text-center">Create a new account to get started.</p>
            
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="name" className="text-gray-700 font-medium">
                  Full Name <span className="text-red-500">*</span>
                </Label>
                <Input
                  id="name"
                  type="text"
                  placeholder="Enter your full name"
                  value={formData.name}
                  onChange={handleInputChange}
                  required
                  className="h-11 px-4 bg-gray-50 border-gray-200 focus:bg-white transition-colors"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="email" className="text-gray-700 font-medium">
                  Email <span className="text-gray-400 text-xs">(provide email or phone)</span>
                </Label>
                <Input
                  id="email"
                  type="email"
                  placeholder="Enter your email"
                  value={formData.email}
                  onChange={handleInputChange}
                  className="h-11 px-4 bg-gray-50 border-gray-200 focus:bg-white transition-colors"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="phoneNumber" className="text-gray-700 font-medium">
                  Phone Number <span className="text-gray-400 text-xs">(provide email or phone)</span>
                </Label>
                <Input
                  id="phoneNumber"
                  type="tel"
                  placeholder="Enter 10-digit phone number"
                  value={formData.phoneNumber}
                  onChange={handleInputChange}
                  maxLength={10}
                  pattern="\d{10}"
                  className="h-11 px-4 bg-gray-50 border-gray-200 focus:bg-white transition-colors"
                />
                {formData.phoneNumber && !/^\d{10}$/.test(formData.phoneNumber) && (
                  <p className="text-xs text-amber-600">Phone must be exactly 10 digits</p>
                )}
              </div>

              <div className="space-y-2">
                <Label htmlFor="role" className="text-gray-700 font-medium">
                  Role <span className="text-red-500">*</span>
                </Label>
                <Select onValueChange={handleRoleChange} value={formData.role}>
                  <SelectTrigger className="h-11 bg-gray-50 border-gray-200 focus:bg-white">
                    <SelectValue placeholder="Select your role" />
                  </SelectTrigger>
                  <SelectContent>
                    {STAFF_ROLES.map((role) => (
                      <SelectItem key={role} value={role}>
                        {role}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="password" className="text-gray-700 font-medium">
                  Password <span className="text-red-500">*</span>
                </Label>
                <div className="relative">
                  <Input
                    id="password"
                    type={showPassword ? "text" : "password"}
                    placeholder="Enter password (min 6 characters)"
                    value={formData.password}
                    onChange={handleInputChange}
                    required
                    minLength={6}
                    className="h-11 px-4 pr-12 bg-gray-50 border-gray-200 focus:bg-white transition-colors"
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

              <div className="space-y-2">
                <Label htmlFor="confirmPassword" className="text-gray-700 font-medium">
                  Confirm Password <span className="text-red-500">*</span>
                </Label>
                <div className="relative">
                  <Input
                    id="confirmPassword"
                    type={showConfirmPassword ? "text" : "password"}
                    placeholder="Re-enter your password"
                    value={formData.confirmPassword}
                    onChange={handleInputChange}
                    required
                    className="h-11 px-4 pr-12 bg-gray-50 border-gray-200 focus:bg-white transition-colors"
                  />
                  <button
                    type="button"
                    onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                    className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 transition-colors"
                    aria-label={showConfirmPassword ? "Hide password" : "Show password"}
                  >
                    {showConfirmPassword ? (
                      <EyeOff className="h-5 w-5" />
                    ) : (
                      <Eye className="h-5 w-5" />
                    )}
                  </button>
                </div>
              </div>

              <Button 
                type="submit" 
                className="w-full h-11 bg-gradient-to-r from-blue-600 to-blue-700 hover:from-blue-700 hover:to-blue-800 text-white font-semibold text-base shadow-lg shadow-blue-200 transition-all duration-200 mt-6" 
                disabled={isLoading}
              >
                {isLoading ? 'Processing...' : 'Continue to Verification'}
              </Button>
            </form>

            <div className="mt-6 text-center">
              <p className="text-sm text-gray-500">
                Already have an account?{' '}
                <Link href="/login" className="text-blue-600 hover:text-blue-700 font-medium transition-colors">
                  Login
                </Link>
              </p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
