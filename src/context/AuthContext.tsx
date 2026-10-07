
"use client";

import type { StaffMember } from '@/types/staff';
import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { useRouter } from 'next/navigation';
import { useToast } from '@/hooks/use-toast';

interface AuthContextType {
  currentUser: StaffMember | null;
  login: (identifier: string) => Promise<boolean>;
  logout: () => void;
  isLoading: boolean;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider = ({ children }: { children: ReactNode }) => {
  const [currentUser, setCurrentUser] = useState<StaffMember | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const router = useRouter();
  const { toast } = useToast();

  useEffect(() => {
    try {
      const storedUser = localStorage.getItem('currentUser');
      if (storedUser) {
        setCurrentUser(JSON.parse(storedUser));
      }
    } catch (error) {
        console.error("Error reading currentUser from localStorage", error);
        localStorage.removeItem('currentUser'); 
    }
    setIsLoading(false);
  }, []);

  const login = async (identifier: string): Promise<boolean> => {
    setIsLoading(true);
    const trimmedIdentifier = identifier.trim(); // Trim here as well, just in case
    const lowercasedIdentifier = trimmedIdentifier.toLowerCase();

    try {
      const storedStaff = localStorage.getItem('staffMembers');
      if (storedStaff) {
        const staffMembers: StaffMember[] = JSON.parse(storedStaff);
        
        if (staffMembers && staffMembers.length > 0) {
            // Try to find by email first
            let foundStaff = staffMembers.find(staff =>
              staff.email && staff.email.trim().toLowerCase() === lowercasedIdentifier
            );
            
            // If not found by email, try to find by phone number
            if (!foundStaff) {
              foundStaff = staffMembers.find(staff =>
                staff.phoneNumber && staff.phoneNumber.trim() === trimmedIdentifier // Phone numbers typically don't need lowercasing
              );
            }
            
            if (foundStaff) {
              localStorage.setItem('currentUser', JSON.stringify(foundStaff));
              setCurrentUser(foundStaff);
              toast({ title: "Login Successful", description: `Welcome, ${foundStaff.name}!` });
              router.push('/dashboard');
              setIsLoading(false);
              return true;
            }
        }
      }
      // If no storedStaff, staffMembers array is empty, or no match found
      toast({ title: "Login Failed", description: "Invalid email/phone or staff member not found.", variant: "destructive" });
    } catch (error) {
        console.error("Error during login:", error);
        toast({ title: "Login Error", description: "An unexpected error occurred during login.", variant: "destructive" });
    }
    setIsLoading(false);
    return false;
  };

  const logout = () => {
    localStorage.removeItem('currentUser');
    setCurrentUser(null);
    router.push('/login');
    toast({ title: "Logged Out", description: "You have been successfully logged out." });
  };

  return (
    <AuthContext.Provider value={{ currentUser, login, logout, isLoading }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = (): AuthContextType => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
