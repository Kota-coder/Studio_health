
"use client";

import { useState, useEffect, useMemo, useCallback } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Patient, PatientCondition, AuditLogEntry } from '@/types/patient';
import { StaffMember } from '@/types/staff';
import { Bill } from '@/types/billing';
import { ArrowRight, UserPlus, AlertTriangle, ShieldCheck, Activity, HelpCircle, BriefcaseMedical, ClipboardList, Users as UsersIcon, CheckCircle2, Trash2, PlusCircle, ArrowLeft } from 'lucide-react';
import { bills as billsRepo, patients as patientsRepo, staff as staffRepo } from '@/lib/data';
import { useAuth } from '@/context/AuthContext';
import { useToast } from '@/hooks/use-toast';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from '@/components/ui/label';
import { Input } from "@/components/ui/input";
import { format, parseISO } from 'date-fns';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

const CONDITION_ORDER: PatientCondition[] = ["Critical", "Medium", "Low", "Unassigned", "Discharged"];
const ALL_CONDITIONS_FILTER: (PatientCondition | "All")[] = ["All", ...CONDITION_ORDER];

const CONDITION_CONFIG: Record<PatientCondition, { icon: React.ElementType, colorClasses: string, title: string }> = {
  "Critical": { icon: AlertTriangle, colorClasses: "bg-red-50 border-red-400 hover:bg-red-100", title: "Critical Patients" },
  "Medium": { icon: Activity, colorClasses: "bg-yellow-50 border-yellow-400 hover:bg-yellow-100", title: "Medium Priority Patients" },
  "Low": { icon: ShieldCheck, colorClasses: "bg-green-50 border-green-400 hover:bg-green-100", title: "Low Priority Patients" },
  "Discharged": { icon: CheckCircle2, colorClasses: "bg-sky-50 border-sky-400 hover:bg-sky-100", title: "Discharged Patients" },
  "Unassigned": { icon: HelpCircle, colorClasses: "bg-gray-50 border-gray-300 hover:bg-gray-100", title: "Condition Unassigned" },
};

export default function DashboardPage() {
  const { currentUser, isLoading: authIsLoading } = useAuth();
  const router = useRouter();
  const { toast } = useToast();

  const [allPatients, setAllPatients] = useState<Patient[]>([]);
  const [availableStaff, setAvailableStaff] = useState<StaffMember[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const [isDischargeConfirmOpen, setIsDischargeConfirmOpen] = useState(false);
  const [patientForDischargeConfirmation, setPatientForDischargeConfirmation] = useState<Patient | null>(null);
  const [newConditionForConfirmation, setNewConditionForConfirmation] = useState<PatientCondition | null>(null);
  const [outstandingBillsMessage, setOutstandingBillsMessage] = useState<string | null>(null);

  const [searchTerm, setSearchTerm] = useState<string>("");
  const [filterCondition, setFilterCondition] = useState<PatientCondition | "All">("All");

  useEffect(() => {
    if (!authIsLoading && !currentUser) {
      router.replace('/login');
    }
  }, [authIsLoading, currentUser, router]);

  useEffect(() => {
    if (currentUser) {
      setIsLoading(true);
      Promise.all([patientsRepo.list(), staffRepo.list()])
        .then(([patientList, staffList]) => {
          setAllPatients(patientList.map(p => ({ ...p, reasonForVisit: p.reasonForVisit || "Not specified" })));
          setAvailableStaff(staffList);
        })
        .catch(error => {
          console.error("Error loading patients or staff:", error);
          toast({ title: "Error", description: "Could not load patient or staff data.", variant: "destructive" });
        })
        .finally(() => setIsLoading(false));
    } else {
      setAllPatients([]);
      setAvailableStaff([]);
      setIsLoading(false);
    }
  }, [currentUser, toast]);

  const filteredAndGroupedPatients = useMemo(() => {
    let patientsToProcess = [...allPatients];

    if (searchTerm.trim() !== "") {
      patientsToProcess = patientsToProcess.filter(patient =>
        `${patient.firstName} ${patient.lastName}`.toLowerCase().includes(searchTerm.toLowerCase())
      );
    }

    if (filterCondition !== "All") {
      patientsToProcess = patientsToProcess.filter(patient => (patient.condition || "Unassigned") === filterCondition);
    }

    const grouped: Record<PatientCondition, Patient[]> = {
      "Critical": [],
      "Medium": [],
      "Low": [],
      "Discharged": [],
      "Unassigned": [],
    };

    patientsToProcess.forEach(patient => {
      const conditionLevel = patient.condition || "Unassigned";
      if (grouped[conditionLevel]) {
        grouped[conditionLevel].push(patient);
      } else {
        grouped["Unassigned"].push(patient); // Should not happen if condition types are exhaustive
      }
    });
    return grouped;
  }, [allPatients, searchTerm, filterCondition]);

  const proceedWithConditionChange = useCallback(async (patientId: number, newCondition: PatientCondition) => {
    if (!currentUser) return;
    const patientToUpdate = allPatients.find(p => p.id === patientId);
    if (!patientToUpdate) return;

    const oldCondition = patientToUpdate.condition || "Unassigned";
    try {
      await patientsRepo.update(patientId, { condition: newCondition }, {
        actionType: "Condition Changed",
        details: `Condition changed from '${oldCondition}' to '${newCondition}'.`,
      });
      setAllPatients(prev => prev.map(p => p.id === patientId ? { ...p, condition: newCondition } : p));
      toast({
        title: "Condition Updated",
        description: `Patient ${patientToUpdate.firstName} ${patientToUpdate.lastName}'s condition set to ${newCondition}.`,
      });
    } catch (e) {
      console.error("Failed to save condition update", e);
      toast({
        title: "Save Error",
        description: "Could not save condition update.",
        variant: "destructive",
      });
    }
  }, [allPatients, currentUser, toast]);

  const handleConditionChange = useCallback(async (patientId: number, newCondition: PatientCondition) => {
    const patientToDischarge = allPatients.find(p => p.id === patientId);
    if (!patientToDischarge) return;

    if (newCondition === "Discharged") {
      let patientHasOutstandingBills = false;
      let billDetails = "";

      let patientBills: Bill[] = [];
      try {
        patientBills = await billsRepo.list({ patientId });
      } catch (error) {
        console.error("Error checking outstanding bills:", error);
        toast({ title: "Error", description: "Could not check outstanding bills.", variant: "destructive" });
        return;
      }
      const unpaidBills = patientBills.filter(bill => bill.paymentStatus === "Unpaid" || bill.paymentStatus === "Partially Paid");
      if (unpaidBills.length > 0) {
        patientHasOutstandingBills = true;
        const unpaidTotal = unpaidBills.reduce((sum, bill) => sum + bill.totalAmount, 0);
        billDetails = `This patient has ${unpaidBills.length} outstanding bill(s) totaling approximately ₹${unpaidTotal.toFixed(2)}.`;
      }

      if (patientHasOutstandingBills) {
        setPatientForDischargeConfirmation(patientToDischarge);
        setNewConditionForConfirmation(newCondition);
        setOutstandingBillsMessage(`${billDetails} Are you sure you want to discharge this patient?`);
        setIsDischargeConfirmOpen(true);
      } else {
        proceedWithConditionChange(patientId, newCondition);
      }
    } else {
      proceedWithConditionChange(patientId, newCondition);
    }
  }, [allPatients, proceedWithConditionChange, toast]);

  const confirmDischarge = useCallback(() => {
    if (patientForDischargeConfirmation && newConditionForConfirmation) {
      proceedWithConditionChange(patientForDischargeConfirmation.id, newConditionForConfirmation);
    }
    setIsDischargeConfirmOpen(false);
    setPatientForDischargeConfirmation(null);
    setNewConditionForConfirmation(null);
    setOutstandingBillsMessage(null);
  }, [patientForDischargeConfirmation, newConditionForConfirmation, proceedWithConditionChange]);

  const getLatestCareNoteSummary = (patient: Patient): string => {
    if (!patient.careNotes || patient.careNotes.length === 0) {
      return "No recent activity";
    }
    const sortedNotes = [...patient.careNotes].sort((a, b) =>
      parseISO(b.createdAt).getTime() - parseISO(a.createdAt).getTime()
    );
    const latestNote = sortedNotes[0];
    let summary = "";
    if (latestNote.templateName && latestNote.templateName !== 'General Note (No Template)') {
      summary = latestNote.templateName;
    } else if (latestNote.text) {
      summary = latestNote.text.substring(0, 30) + (latestNote.text.length > 30 ? "..." : "");
    } else {
       summary = "General note entry";
    }
    try {
        const formattedDate = format(parseISO(latestNote.createdAt), "dd/MM/yy");
        return `${summary} (on ${formattedDate})`;
    } catch (e) {
        return summary;
    }
  };

  const getAssignedStaffNames = (patient: Patient, staffList: StaffMember[]): string => {
    if (!patient.assignedStaffIds || patient.assignedStaffIds.length === 0 || staffList.length === 0) {
      return "No staff assigned";
    }
    const names = patient.assignedStaffIds
      .map(id => staffList.find(staff => staff.id === id)?.name)
      .filter(Boolean);

    if (names.length === 0) return "No staff assigned";
    if (names.length > 2) return `${names.slice(0, 2).join(', ')} & others`;
    return names.join(', ');
  };

  if (authIsLoading || isLoading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen p-4">
        <p>Loading dashboard...</p>
      </div>
    );
  }

  if (!currentUser) {
    return <div className="flex justify-center items-center min-h-screen"><p>Redirecting to login...</p></div>;
  }

  const totalFilteredPatients = Object.values(filteredAndGroupedPatients).reduce((sum, group) => sum + group.length, 0);

  return (
    <div className="container mx-auto p-4 sm:p-6 lg:p-8">
      <header className="mb-8 flex flex-col sm:flex-row justify-between items-center gap-4">
        <h1 className="text-3xl font-bold text-foreground">Patient Dashboard</h1>
        <div className="flex flex-wrap justify-center sm:justify-end gap-2">
          <Link href="/" passHref>
            <Button>
              <UserPlus className="mr-2 h-4 w-4" />
              Add New Patient
            </Button>
          </Link>
        </div>
      </header>

      <Card className="mb-6 shadow-md">
        <CardHeader>
          <CardTitle className="text-lg">Filters & Search</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col sm:flex-row gap-4 items-end">
          <div className="w-full sm:flex-grow">
            <Label htmlFor="searchPatientName">Search by Patient Name</Label>
            <Input
              id="searchPatientName"
              type="text"
              placeholder="Enter patient name..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="mt-1"
            />
          </div>
          <div className="w-full sm:w-auto min-w-[200px]">
            <Label htmlFor="filterPatientCondition">Filter by Condition</Label>
            <Select value={filterCondition} onValueChange={(value) => setFilterCondition(value as PatientCondition | "All")}>
              <SelectTrigger id="filterPatientCondition" className="mt-1">
                <SelectValue placeholder="Filter by Condition" />
              </SelectTrigger>
              <SelectContent>
                {ALL_CONDITIONS_FILTER.map(conditionOpt => (
                  <SelectItem key={conditionOpt} value={conditionOpt}>
                    {conditionOpt === "All" ? "All Conditions" : conditionOpt}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      {allPatients.length === 0 && !isLoading ? (
        <Card className="text-center shadow-lg">
          <CardHeader>
            <CardTitle>No Patients Found</CardTitle>
          </CardHeader>
          <CardContent>
            <CardDescription className="mb-4">
              There are no patients registered yet. Click "Add New Patient" above to start.
            </CardDescription>
            <img
              src="https://placehold.co/600x300.png"
              alt="No patients placeholder"
              data-ai-hint="empty list medical"
              className="mx-auto rounded-md mt-4 shadow-md"
            />
          </CardContent>
        </Card>
      ) : totalFilteredPatients === 0 ? (
        <Card className="text-center shadow-lg">
          <CardHeader>
            <CardTitle>No Patients Match Criteria</CardTitle>
          </CardHeader>
          <CardContent>
            <CardDescription className="mb-4">
              No patients found matching your current search and filter settings. Try adjusting your filters.
            </CardDescription>
            <img
              src="https://placehold.co/600x300.png"
              alt="No matching patients placeholder"
              data-ai-hint="empty search results"
              className="mx-auto rounded-md mt-4 shadow-md"
            />
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-8">
          {CONDITION_ORDER.map(level => {
            const config = CONDITION_CONFIG[level];
            const patientsInGroup = filteredAndGroupedPatients[level];
            if (patientsInGroup.length === 0) return null;

            return (
              <section key={level}>
                <div className="flex items-center mb-4">
                  <config.icon className={`mr-3 h-7 w-7 text-${config.colorClasses.split(' ')[1].split('-')[0]}-600`} />
                  <h2 className={`text-2xl font-semibold text-foreground`}>{config.title} ({patientsInGroup.length})</h2>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                  {patientsInGroup.map((patient) => (
                    <Link key={patient.id} href={`/patients/${patient.id.toString().padStart(3, '0')}`} passHref className="block group">
                        <Card className={`shadow-lg hover:shadow-xl transition-shadow duration-300 border-2 ${config.colorClasses} h-full flex flex-col cursor-pointer group-hover:border-primary`}>
                        <CardHeader>
                            <CardTitle className="truncate">{`${patient.firstName} ${patient.lastName}`}</CardTitle>
                            <CardDescription className="truncate">
                            Visit: {patient.reasonForVisit || "Not specified"}
                            </CardDescription>
                        </CardHeader>
                        <CardContent className="space-y-3 flex-grow">
                            <div className="flex items-start text-sm text-muted-foreground mb-2">
                            <ClipboardList className="mr-2 h-4 w-4 mt-0.5 shrink-0" />
                            <span className="truncate" title={getLatestCareNoteSummary(patient)}>
                                Latest: {getLatestCareNoteSummary(patient)}
                            </span>
                            </div>
                            <div className="flex items-start text-sm text-muted-foreground mb-2">
                            <UsersIcon className="mr-2 h-4 w-4 mt-0.5 shrink-0" />
                            <span className="truncate" title={getAssignedStaffNames(patient, availableStaff)}>
                                Attending: {getAssignedStaffNames(patient, availableStaff)}
                            </span>
                            </div>

                            <div onClick={(e) => e.stopPropagation()}>
                            <Label htmlFor={`condition-${patient.id}`} className="text-xs text-muted-foreground">Condition:</Label>
                            <Select
                                value={patient.condition || "Unassigned"}
                                onValueChange={(newCond) => {
                                    handleConditionChange(patient.id, newCond as PatientCondition)
                                }}
                            >
                                <SelectTrigger id={`condition-${patient.id}`} className="h-9 text-sm">
                                <SelectValue placeholder="Set Condition" />
                                </SelectTrigger>
                                <SelectContent>
                                {CONDITION_ORDER.map(condLevel => (
                                    <SelectItem key={condLevel} value={condLevel} className="text-sm">
                                    {condLevel}
                                    </SelectItem>
                                ))}
                                </SelectContent>
                            </Select>
                            </div>
                        </CardContent>
                        </Card>
                    </Link>
                  ))}
                </div>
              </section>
            );
          })}
        </div>
      )}
      <AlertDialog open={isDischargeConfirmOpen} onOpenChange={setIsDischargeConfirmOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Confirm Discharge</AlertDialogTitle>
            <AlertDialogDescription>
              {outstandingBillsMessage}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => {
              setIsDischargeConfirmOpen(false);
              setPatientForDischargeConfirmation(null);
              setNewConditionForConfirmation(null);
            }}>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={confirmDischarge}>
              Proceed with Discharge
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
    
