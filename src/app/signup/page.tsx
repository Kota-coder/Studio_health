"use client";

import Link from 'next/link';
import { UserPlus } from 'lucide-react';
import { AuthBrandHeader } from '@/components/auth-brand-header';
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader } from "@/components/ui/card";

// Staff accounts are created by an admin in Staff Management, which emails the
// new staff member an invite to set their password. There is no self sign-up.
export default function SignupPage() {
  return (
    <div className="flex items-center justify-center min-h-screen bg-gradient-to-br from-primary/5 via-background to-primary/10 p-4">
      <Card className="w-full max-w-md shadow-2xl border-0 overflow-hidden">
        <CardHeader className="bg-primary text-primary-foreground p-6 sm:p-8">
          <AuthBrandHeader />
        </CardHeader>
        <CardContent className="p-6 sm:p-8 text-center space-y-4">
          <UserPlus className="mx-auto h-10 w-10 text-primary" />
          <h2 className="text-2xl font-semibold text-gray-800">Need an account?</h2>
          <p className="text-gray-500 text-sm">
            Staff accounts are created by a clinic admin. Ask them to add you in Staff Management;
            you&apos;ll get an email to set your password.
          </p>
          <Button asChild className="w-full h-12">
            <Link href="/login">Back to Login</Link>
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
