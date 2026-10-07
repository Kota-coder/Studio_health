
"use client";

import { useState, useEffect } from 'react';
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from "@/components/ui/card";
import { useAuth } from '@/context/AuthContext';
import { LogIn } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useToast } from '@/hooks/use-toast'; // Import useToast

export default function LoginPage() {
  const [identifier, setIdentifier] = useState('');
  const [password, setPassword] = useState('');
  const { login, currentUser, isLoading } = useAuth();
  const router = useRouter();
  const { toast } = useToast(); // Initialize useToast

  // If user is already logged in, redirect to dashboard
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

    // Add default admin if none exists
    const storedStaff = localStorage.getItem('staffMembers');
    if (!storedStaff || JSON.parse(storedStaff).length === 0) {
      const defaultAdmin = {
        id: "admin-1",
        name: "Admin User",
        email: "admin@clinic.com",
        phoneNumber: "1234567890",
        role: "Admin",
        dateJoined: new Date().toISOString()
      };
      localStorage.setItem('staffMembers', JSON.stringify([defaultAdmin]));
    }

    // Check if staff members exist before attempting login
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
          <CardDescription>Enter your email or phone number to access the portal.</CardDescription>
        </CardHeader>
        <form onSubmit={handleSubmit}>
          <CardContent className="grid gap-4">
            <div>
              <Label htmlFor="identifier">Email or Phone Number</Label>
              <Input
                id="identifier"
                type="text"
                placeholder="name@example.com or 1234567890"
                value={identifier}
                onChange={(e) => setIdentifier(e.target.value)}
                required
              />
            </div>
            <div>
              <Label htmlFor="password">Password</Label>
              <Input
                id="password"
                type="password"
                placeholder="********"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
              />
               <p className="text-xs text-muted-foreground mt-1">Note: Password field is for UI demonstration only.</p>
            </div>
          </CardContent>
          <CardFooter>
            <Button type="submit" className="w-full" disabled={isLoading}>
              {isLoading ? 'Logging in...' : 'Login'}
            </Button>
          </CardFooter>
        </form>
      </Card>
    </div>
  );
}
