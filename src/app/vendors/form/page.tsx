
"use client";

import { useState, useEffect } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from "@/components/ui/card";
import { Textarea } from '@/components/ui/textarea';
import { useToast } from "@/hooks/use-toast";
import { Vendor } from '@/types/vendor';
import { ArrowLeft, Save, Truck } from 'lucide-react';
import { vendors as vendorsRepo } from '@/lib/data';
import { useAuth } from '@/context/AuthContext';
import type { StaffRole } from '@/types/staff';

const ALLOWED_ROLES: StaffRole[] = ["Super Admin", "Admin", "Doctor", "Nurse"];

const isValidEmailOptional = (email?: string): boolean => {
  if (!email || email.trim() === "") return true; // Optional
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email);
};

const isValidPhoneNumberOptional = (number?: string): boolean => {
  if (!number || number.trim() === "") return true; // Optional
  // Basic phone validation, can be made more specific
  const phoneRegex = /^[0-9\s\-()+]{7,15}$/; 
  return phoneRegex.test(number);
};


export default function VendorFormPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { toast } = useToast();
  const { currentUser, isLoading: authIsLoading } = useAuth();

  const vendorIdToEdit = searchParams.get('id');
  const isEditMode = Boolean(vendorIdToEdit);

  const [name, setName] = useState("");
  const [contactPerson, setContactPerson] = useState("");
  const [phoneNumber, setPhoneNumber] = useState("");
  const [email, setEmail] = useState("");
  const [address, setAddress] = useState("");
  const [notes, setNotes] = useState("");
  
  const [emailError, setEmailError] = useState<string | null>(null);
  const [phoneError, setPhoneError] = useState<string | null>(null);
  const [currentVendorId, setCurrentVendorId] = useState<string | null>(null);
  const [formIsLoading, setFormIsLoading] = useState(true);

  useEffect(() => {
    if (!authIsLoading && currentUser && !ALLOWED_ROLES.includes(currentUser.role)) {
      toast({ title: "Access Denied", description: "You do not have permission to access this page.", variant: "destructive" });
      router.replace('/dashboard');
    } else if (!authIsLoading && !currentUser) {
      router.replace('/login');
    }
  }, [authIsLoading, currentUser, router, toast]);

  useEffect(() => {
    if (!currentUser || (currentUser && !ALLOWED_ROLES.includes(currentUser.role) && !authIsLoading )) {
        setFormIsLoading(false);
        return;
    }
    setFormIsLoading(true);

    if (!(isEditMode && vendorIdToEdit)) {
      setFormIsLoading(false);
      return;
    }
    vendorsRepo.get(vendorIdToEdit).then(vendorToEdit => {
        if (vendorToEdit) {
          setCurrentVendorId(vendorToEdit.id);
          setName(vendorToEdit.name);
          setContactPerson(vendorToEdit.contactPerson || "");
          setPhoneNumber(vendorToEdit.phoneNumber || "");
          setEmail(vendorToEdit.email || "");
          setAddress(vendorToEdit.address || "");
          setNotes(vendorToEdit.notes || "");
        } else {
          toast({ title: "Error", description: "Vendor not found.", variant: "destructive" });
          router.push('/vendors');
        }
    }).catch(error => {
      console.error("Error loading vendor:", error);
      toast({ title: "Error", description: "Could not load vendor.", variant: "destructive" });
    }).finally(() => setFormIsLoading(false));
  }, [isEditMode, vendorIdToEdit, router, toast, currentUser, authIsLoading]);

  const handleSubmit = async () => {
    let hasError = false;
    if (!name.trim()) { 
        toast({ title: "Validation Error", description: "Vendor Name is required.", variant: "destructive" }); 
        hasError = true; 
    }
    if (!isValidPhoneNumberOptional(phoneNumber)) { 
        setPhoneError("Please enter a valid phone number if provided."); 
        hasError = true; 
    } else { 
        setPhoneError(null); 
    }
    if (!isValidEmailOptional(email)) { 
        setEmailError("Please enter a valid email address if provided."); 
        hasError = true; 
    } else { 
        setEmailError(null); 
    }


    if (hasError) {
      toast({
            title: "Validation Error",
            description: "Please correct the highlighted fields.",
            variant: "destructive",
        });
      return;
    }

    const vendorData: Omit<Vendor, 'id'> = {
      name: name.trim(),
      contactPerson: contactPerson.trim() || undefined,
      phoneNumber: phoneNumber.trim() || undefined,
      email: email.trim() || undefined,
      address: address.trim() || undefined,
      notes: notes.trim() || undefined,
    };

    try {
      if (isEditMode && currentVendorId) {
        await vendorsRepo.update(currentVendorId, vendorData);
        toast({ title: "Success", description: "Vendor details updated." });
      } else {
        await vendorsRepo.create(vendorData);
        toast({ title: "Success", description: "New vendor added." });
      }
      router.push('/vendors');
    } catch (e) {
      console.error("Failed to save vendor", e);
      toast({
        title: "Save Error",
        description: "Could not save vendor. Please check your connection and try again.",
        variant: "destructive",
      });
    }
  };
  
  if (authIsLoading || formIsLoading) {
    return <div className="flex justify-center items-center min-h-screen"><p>Loading vendor form...</p></div>;
  }

  if (!currentUser || (currentUser && !ALLOWED_ROLES.includes(currentUser.role))) {
    return <div className="flex justify-center items-center min-h-screen"><p>Access Denied. Redirecting...</p></div>;
  }

  return (
    <div className="container mx-auto p-4 sm:p-6 lg:p-8 flex flex-col items-center">
      <Card className="w-full max-w-lg mt-6 shadow-xl">
        <CardHeader>
          <CardTitle className="text-2xl flex items-center">
            <Truck className="mr-3 h-7 w-7 text-primary"/>
            {isEditMode ? "Edit Material Vendor" : "Add New Material Vendor"}
          </CardTitle>
          <CardDescription>
            {isEditMode ? "Update the details for this material vendor." : "Fill in the details to add a new material vendor."}
          </CardDescription>
        </CardHeader>
        <CardContent className="grid gap-5">
          <div>
            <Label htmlFor="name">Vendor Name *</Label>
            <Input id="name" value={name} onChange={(e) => setName(e.target.value)} required 
                   placeholder="e.g., ABC Medical Supplies Inc." />
          </div>
          <div>
            <Label htmlFor="contactPerson">Contact Person (Optional)</Label>
            <Input id="contactPerson" value={contactPerson} onChange={(e) => setContactPerson(e.target.value)} 
                   placeholder="e.g., John Smith" />
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
                <Label htmlFor="phoneNumber">Phone Number (Optional)</Label>
                <Input id="phoneNumber" type="tel" value={phoneNumber} onChange={(e) => {
                    setPhoneNumber(e.target.value);
                    if (e.target.value && !isValidPhoneNumberOptional(e.target.value)) {
                        setPhoneError("Please enter a valid phone number.");
                    } else {
                        setPhoneError(null);
                    }
                }} placeholder="e.g., (555) 123-4567"/>
                {phoneError && <p className="text-destructive text-sm mt-1">{phoneError}</p>}
            </div>
            <div>
                <Label htmlFor="email">Email Address (Optional)</Label>
                <Input id="email" type="email" value={email} onChange={(e) => {
                    setEmail(e.target.value);
                    if (e.target.value && !isValidEmailOptional(e.target.value)) {
                        setEmailError("Please enter a valid email address.");
                    } else {
                        setEmailError(null);
                    }
                }} placeholder="e.g., contact@absupplies.com"/>
                {emailError && <p className="text-destructive text-sm mt-1">{emailError}</p>}
            </div>
          </div>
          <div>
            <Label htmlFor="address">Address (Optional)</Label>
            <Textarea id="address" value={address} 
                      onChange={(e) => setAddress(e.target.value)} 
                      placeholder="e.g., 123 Supply Rd, Medcity, State, Zipcode"/>
          </div>
          <div>
            <Label htmlFor="notes">Additional Notes (Optional)</Label>
            <Textarea id="notes" value={notes} 
                      onChange={(e) => setNotes(e.target.value)} 
                      placeholder="e.g., Preferred payment terms, delivery schedule, specific products specialized in, etc."/>
          </div>
        </CardContent>
        <CardFooter className="flex justify-between mt-4">
          <Button variant="outline" onClick={() => router.push('/vendors')}>
            <ArrowLeft className="mr-2 h-4 w-4" /> Cancel
          </Button>
          <Button onClick={handleSubmit}>
            <Save className="mr-2 h-4 w-4" /> {isEditMode ? "Save Changes" : "Add Vendor"}
          </Button>
        </CardFooter>
      </Card>
    </div>
  );
}
