
"use client";

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { Patient } from '@/types/patient';
import { bills as billsRepo, patients as patientsRepo, type BillFields } from '@/lib/data';
import { format } from 'date-fns';
import { ArrowLeft, Save } from 'lucide-react';

export default function QuickPaymentEntry() {
  const router = useRouter();
  const { toast } = useToast();
  const [patients, setPatients] = useState<Patient[]>([]);
  const [selectedPatientId, setSelectedPatientId] = useState<string>("");
  const [amount, setAmount] = useState<string>("");

  useEffect(() => {
    patientsRepo.listBasic()
      .then(setPatients)
      .catch(error => {
        console.error("Error loading patients:", error);
        toast({ title: "Error", description: "Could not load patients.", variant: "destructive" });
      });
  }, [toast]);

  const handleQuickPayment = async () => {
    if (!selectedPatientId || !amount) {
      toast({ title: "Error", description: "Please select a patient and enter amount", variant: "destructive" });
      return;
    }

    try {
      const patient = patients.find(p => p.id.toString() === selectedPatientId);
      if (!patient) return;

      const newBill: BillFields = {
        patientId: parseInt(selectedPatientId),
        patientName: `${patient.firstName} ${patient.lastName}`,
        billDate: format(new Date(), 'dd/MM/yyyy'),
        billType: "Treatment",
        items: [{
          id: Date.now().toString(),
          description: "Treatment Payment",
          quantity: 1,
          unitPrice: parseFloat(amount),
          originalUnitPrice: parseFloat(amount),
          total: parseFloat(amount)
        }],
        totalAmount: parseFloat(amount),
        paymentMethod: "Cash",
        paymentStatus: "Paid",
        paymentDate: format(new Date(), 'dd/MM/yyyy'),
        notes: "Quick payment entry",
      };

      await billsRepo.create(newBill, "Quick payment entry recorded.");

      toast({ title: "Success", description: "Payment recorded successfully" });
      setSelectedPatientId("");
      setAmount("");
    } catch (error) {
      console.error("Error recording payment:", error);
      toast({ title: "Error", description: "Failed to record payment", variant: "destructive" });
    }
  };

  return (
    <div className="container mx-auto p-4">
      <Button variant="outline" onClick={() => router.push('/dashboard')} className="mb-4">
        <ArrowLeft className="mr-2 h-4 w-4" /> Back to Dashboard
      </Button>
      
      <Card className="max-w-md mx-auto">
        <CardHeader>
          <CardTitle>Quick Payment Entry</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <Label htmlFor="patient">Select Patient</Label>
            <Select onValueChange={setSelectedPatientId} value={selectedPatientId}>
              <SelectTrigger id="patient">
                <SelectValue placeholder="Choose patient" />
              </SelectTrigger>
              <SelectContent>
                {patients.map(patient => (
                  <SelectItem key={patient.id} value={patient.id.toString()}>
                    {patient.firstName} {patient.lastName}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div>
            <Label htmlFor="amount">Amount</Label>
            <Input
              id="amount"
              type="number"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              placeholder="Enter amount"
            />
          </div>

          <Button onClick={handleQuickPayment} className="w-full">
            <Save className="mr-2 h-4 w-4" /> Record Payment
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
