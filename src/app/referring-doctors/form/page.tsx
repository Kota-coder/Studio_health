
"use client";

import { useState, useEffect } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from "@/components/ui/card";
import { Textarea } from '@/components/ui/textarea'; // Textarea is not used for location anymore, but kept for potential notes later
import { useToast } from "@/hooks/use-toast";
import { ReferringDoctor } from '@/types/referringDoctor';
import { ArrowLeft, Save, HeartHandshake } from 'lucide-react';
import { useAuth } from '@/context/AuthContext';
import type { StaffRole } from '@/types/staff';

const LOCAL_STORAGE_KEY = 'referringDoctorsData';
const ID_COUNTER_KEY = 'nextReferringDoctorId';
const ALLOWED_ROLES: StaffRole[] = ["Admin", "Doctor", "Nurse", "Receptionist"];

const isValidEmailOptional = (email?: string): boolean => {
  if (!email || email.trim() === "") return true;
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email);
};

const isValidPhoneNumberOptional = (number?: string): boolean => {
  if (!number || number.trim() === "") return true;
  const phoneRegex = /^[0-9\s\-()+]{7,15}$/;
  return phoneRegex.test(number);
};

export default function ReferringDoctorFormPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { toast } = useToast();
  const { currentUser, isLoading: authIsLoading } = useAuth();

  const doctorIdToEdit = searchParams.get('id');
  const isEditMode = Boolean(doctorIdToEdit);

  const [name, setName] = useState("");
  const [hospitalClinicName, setHospitalClinicName] = useState(""); // Changed from location
  const [phoneNumber, setPhoneNumber] = useState("");
  const [email, setEmail] = useState("");

  const [emailError, setEmailError] = useState<string | null>(null);
  const [phoneError, setPhoneError] = useState<string | null>(null);
  const [currentDoctorId, setCurrentDoctorId] = useState<number | null>(null);
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
    if (isEditMode && doctorIdToEdit) {
      const storedData = localStorage.getItem(LOCAL_STORAGE_KEY);
      if (storedData) {
        const doctors: ReferringDoctor[] = JSON.parse(storedData);
        const doctorToEdit = doctors.find(doc => doc.id === parseInt(doctorIdToEdit, 10));
        if (doctorToEdit) {
          setCurrentDoctorId(doctorToEdit.id);
          setName(doctorToEdit.name);
          setHospitalClinicName(doctorToEdit.location); // Map 'location' to 'hospitalClinicName'
          setPhoneNumber(doctorToEdit.phoneNumber || "");
          setEmail(doctorToEdit.email || "");
        } else {
          toast({ title: "Error", description: "Referring doctor profile not found.", variant: "destructive" });
          router.push('/referring-doctors');
        }
      }
    }
    setFormIsLoading(false);
  }, [isEditMode, doctorIdToEdit, router, toast, currentUser, authIsLoading]);

  const handleSubmit = () => {
    let hasError = false;
    if (!name.trim()) { toast({ title: "Validation Error", description: "Name is required.", variant: "destructive" }); hasError = true; }
    if (!hospitalClinicName.trim()) { toast({ title: "Validation Error", description: "Hospital/Clinic Name is required.", variant: "destructive" }); hasError = true; }
    if (phoneNumber && !isValidPhoneNumberOptional(phoneNumber)) { setPhoneError("Please enter a valid phone number if provided."); hasError = true; } else { setPhoneError(null); }
    if (email && !isValidEmailOptional(email)) { setEmailError("Please enter a valid email address if provided."); hasError = true; } else { setEmailError(null); }

    if (hasError) {
      toast({
            title: "Validation Error",
            description: "Please correct the highlighted fields.",
            variant: "destructive",
        });
      return;
    }

    const doctorData: Omit<ReferringDoctor, 'id'> = {
      name: name.trim(),
      location: hospitalClinicName.trim(), // Save hospitalClinicName to location
      phoneNumber: phoneNumber.trim() || "",
      email: email.trim() || "",
    };

    try {
      const storedData = localStorage.getItem(LOCAL_STORAGE_KEY);
      let doctors: ReferringDoctor[] = storedData ? JSON.parse(storedData) : [];

      if (isEditMode && currentDoctorId !== null) {
        doctors = doctors.map(doc => doc.id === currentDoctorId ? { ...doctorData, id: currentDoctorId } : doc);
        toast({ title: "Success", description: "Referring doctor profile updated." });
      } else {
        const nextIdStr = localStorage.getItem(ID_COUNTER_KEY) || '1';
        let nextId = parseInt(nextIdStr, 10);
        const newDoctor: ReferringDoctor = { ...doctorData, id: nextId };
        doctors.push(newDoctor);
        localStorage.setItem(ID_COUNTER_KEY, (nextId + 1).toString());
        toast({ title: "Success", description: "New referring doctor profile added." });
      }

      localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(doctors));
      router.push('/referring-doctors');

    } catch (e) {
      console.error("Failed to save referring doctor to localStorage", e);
      toast({
        title: "Storage Error",
        description: "Could not save referring doctor data.",
        variant: "destructive",
      });
    }
  };

  if (authIsLoading || formIsLoading) {
    return <div className="flex justify-center items-center min-h-screen"><p>Loading form...</p></div>;
  }

  if (!currentUser || (currentUser && !ALLOWED_ROLES.includes(currentUser.role))) {
    return <div className="flex justify-center items-center min-h-screen"><p>Access Denied. Redirecting...</p></div>;
  }


  return (
    <div className="container mx-auto p-4 sm:p-6 lg:p-8 flex flex-col items-center">
      <Card className="w-full max-w-lg mt-6 shadow-xl">
        <CardHeader>
          <CardTitle className="text-2xl flex items-center">
            <HeartHandshake className="mr-3 h-7 w-7 text-primary"/>
            {isEditMode ? "Edit Referring Doctor Profile" : "Add New Referring Doctor Profile"}
          </CardTitle>
          <CardDescription>
            {isEditMode ? "Update the details for this referring doctor." : "Fill in the details to add a new referring doctor."}
          </CardDescription>
        </CardHeader>
        <CardContent className="grid gap-5">
          <div>
            <Label htmlFor="name">Full Name *</Label>
            <Input id="name" value={name} onChange={(e) => setName(e.target.value)} required
                   placeholder="Dr. Jane Doe" />
          </div>
          <div>
            <Label htmlFor="hospitalClinicName">Hospital/Clinic Name *</Label>
            <Input id="hospitalClinicName" value={hospitalClinicName} onChange={(e) => setHospitalClinicName(e.target.value)} required
                      placeholder="e.g., City General Hospital, Community Clinic"/>
          </div>
          <div>
            <Label htmlFor="phoneNumber">Phone Number (Optional)</Label>
            <Input id="phoneNumber" type="tel" value={phoneNumber} onChange={(e) => {
                setPhoneNumber(e.target.value);
                if (e.target.value && !isValidPhoneNumberOptional(e.target.value)) {
                    setPhoneError("Please enter a valid phone number.");
                } else {
                    setPhoneError(null);
                }
            }} placeholder="(555) 123-4567"/>
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
            }} placeholder="name@example.com"/>
            {emailError && <p className="text-destructive text-sm mt-1">{emailError}</p>}
          </div>
        </CardContent>
        <CardFooter className="flex justify-between mt-4">
          <Button variant="outline" onClick={() => router.push('/referring-doctors')}>
            <ArrowLeft className="mr-2 h-4 w-4" /> Cancel
          </Button>
          <Button onClick={handleSubmit}>
            <Save className="mr-2 h-4 w-4" /> {isEditMode ? "Save Changes" : "Add Profile"}
          </Button>
        </CardFooter>
      </Card>
    </div>
  );
}
