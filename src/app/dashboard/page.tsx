
"use client";

import { useState, useEffect, useMemo, useCallback } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Patient, PatientCondition, AuditLogEntry } from '@/types/patient';
import { StaffMember } from '@/types/staff';
import { Bill } from '@/types/billing';
import { ArrowRight, UserPlus, AlertTriangle, ShieldCheck, Activity, HelpCircle, BriefcaseMedical, ClipboardList, Users as UsersIcon, CheckCircle2, Trash2 } from 'lucide-react';
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

// Helper function to add audit log entries
function addAuditLogEntry(
  patientToUpdate: Patient,
  actionType: string,
  changeDetails: string,
  currentUser: StaffMember | null
): Patient {
  if (!currentUser) return patientToUpdate;

  const newLogEntry: AuditLogEntry = {
    id: Date.now().toString() + Math.random().toString(36).substring(2, 7),
    timestamp: new Date().toISOString(),
    staffId: currentUser.id,
    staffName: currentUser.name,
    actionType,
    changeDetails,
  };

  return {
    ...patientToUpdate,
    auditLog: [...(patientToUpdate.auditLog || []), newLogEntry],
  };
}

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
      try {
        const storedPatients = localStorage.getItem('patients');
        if (storedPatients) {
          let rawPatients = JSON.parse(storedPatients);
          const sanitizedPatients: Patient[] = rawPatients.map((p: any) => ({
            ...p,
            id: parseInt(p.id, 10), // Ensure ID is a number
            careNotes: Array.isArray(p.careNotes) ? p.careNotes.map((cn: any) => ({...cn, templateFieldsData: cn.templateFieldsData || {}, medicationsMentioned: cn.medicationsMentioned || [] })) : [],
            assignedStaffIds: Array.isArray(p.assignedStaffIds) ? p.assignedStaffIds.map(Number) : [],
            tests: Array.isArray(p.tests) ? p.tests : [],
            condition: p.condition || "Unassigned",
            reasonForVisit: p.reasonForVisit || "Not specified",
            auditLog: Array.isArray(p.auditLog) ? p.auditLog : [],
          }));
          setAllPatients(sanitizedPatients);
        }

        const storedStaff = localStorage.getItem('staffMembers');
        if (storedStaff) {
          setAvailableStaff(JSON.parse(storedStaff));
        }

      } catch (error) {
        console.error("Error loading data from localStorage:", error);
        toast({ title: "Error", description: "Could not load patient or staff data.", variant: "destructive" });
      }
      setIsLoading(false);
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


  const proceedWithConditionChange = useCallback((patientId: number, newCondition: PatientCondition) => {
    if (!currentUser) return;

    let patientToUpdate: Patient | undefined;
    let updatedPatientsForStorage: Patient[] = [];

    setAllPatients(prevPatients => {
      const foundPatient = prevPatients.find(p => p.id === patientId);
      if (!foundPatient) return prevPatients;
      patientToUpdate = foundPatient;

      const oldCondition = patientToUpdate.condition || "Unassigned";
      let updatedPatientWithLog = addAuditLogEntry(
        patientToUpdate,
        "Condition Changed",
        `Condition changed from '${oldCondition}' to '${newCondition}'.`,
        currentUser
      );
      updatedPatientWithLog = { ...updatedPatientWithLog, condition: newCondition };

      updatedPatientsForStorage = prevPatients.map(p =>
        p.id === patientId ? updatedPatientWithLog : p
      );
      return updatedPatientsForStorage;
    });
    
    if (patientToUpdate && updatedPatientsForStorage.length > 0) {
      try {
        localStorage.setItem('patients', JSON.stringify(updatedPatientsForStorage));
        toast({
          title: "Condition Updated",
          description: `Patient ${patientToUpdate.firstName} ${patientToUpdate.lastName}'s condition set to ${newCondition}.`,
        });
      } catch (e: any) {
        if (e.name === 'QuotaExceededError') {
          toast({
            title: "Storage Full",
            description: "Cannot save condition update. Local storage is full, likely due to image attachments. Please remove some images or contact support.",
            variant: "destructive",
          });
          // Revert state update if localStorage fails
          setAllPatients(prev => prev.map(p => p.id === patientId ? patientToUpdate! : p));
        } else {
          console.error("Failed to save updated patients to localStorage", e);
          toast({
            title: "Storage Error",
            description: "Could not save condition update.",
            variant: "destructive",
          });
          setAllPatients(prev => prev.map(p => p.id === patientId ? patientToUpdate! : p));
        }
      }
    }
  }, [currentUser, toast]);

  const handleConditionChange = useCallback((patientId: number, newCondition: PatientCondition) => {
    const patientToDischarge = allPatients.find(p => p.id === patientId);
    if (!patientToDischarge) return;

    if (newCondition === "Discharged") {
      const storedBills = localStorage.getItem('bills');
      let patientHasOutstandingBills = false;
      let billDetails = "";

      if (storedBills) {
        const allBillsData: Bill[] = JSON.parse(storedBills);
        const patientBills = allBillsData.filter(bill => bill.patientId === patientId);
        const unpaidBills = patientBills.filter(bill => bill.paymentStatus === "Unpaid" || bill.paymentStatus === "Partially Paid");
        if (unpaidBills.length > 0) {
          patientHasOutstandingBills = true;
          const unpaidTotal = unpaidBills.reduce((sum, bill) => sum + bill.totalAmount, 0);
          billDetails = `This patient has ${unpaidBills.length} outstanding bill(s) totaling approximately ₹${unpaidTotal.toFixed(2)}.`;
        }
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
  }, [allPatients, proceedWithConditionChange]);

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
        <div className="flex gap-2">
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
    
