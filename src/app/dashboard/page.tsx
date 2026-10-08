
"use client";

import { useState, useEffect, useMemo, useCallback } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Patient, PatientCondition, AuditLogEntry } from '@/types/patient';
import { StaffMember } from '@/types/staff';
import { Bill } from '@/types/billing';
import { ArrowRight, UserPlus, AlertTriangle, ShieldCheck, Activity, HelpCircle, BriefcaseMedical, ClipboardList, Users as UsersIcon, CheckCircle2, Trash2, PlusCircle, ArrowLeft, Building2 } from 'lucide-react';
import { bills as billsRepo, departments as departmentsRepo, homeSummary, patients as patientsRepo, staff as staffRepo, type HomeSummary } from '@/lib/data';
import { RoleSummary } from '@/components/role-summary';
import { cachedAt, invalidate } from '@/lib/data/cache';
import { RefreshStamp } from '@/components/refresh-stamp';
import { useBranding } from '@/components/branding-provider';
import { isSevaDefault } from '@/lib/branding';
import type { Department } from '@/types/department';
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
  const { profile: hospital } = useBranding();
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
  const [filterDepartment, setFilterDepartment] = useState<string>("All");
  const [departmentList, setDepartmentList] = useState<Department[]>([]);
  const [summary, setSummary] = useState<HomeSummary | null>(null);
  const [filterChosen, setFilterChosen] = useState(false);

  useEffect(() => {
    if (!authIsLoading && !currentUser) {
      router.replace('/login');
    }
  }, [authIsLoading, currentUser, router]);

  const [loadedAt, setLoadedAt] = useState<Date | null>(null);
  const [isRefreshing, setIsRefreshing] = useState(false);

  // Patients, staff and departments come from a short-lived cache (see lib/data/cache.ts);
  // Refresh fetches them again.
  const loadDashboard = useCallback(async (refresh = false) => {
    if (refresh) invalidate('dashboard:', 'staff:', 'departments:', 'summary:home');
    // The summary is optional: the patient list still shows if it fails.
    homeSummary().then(setSummary).catch(error => console.error('Could not load the summary', error));
    try {
      const [patientList, staffList, departmentsLoaded] = await Promise.all([patientsRepo.listForDashboard(), staffRepo.list(), departmentsRepo.list()]);
      setDepartmentList(departmentsLoaded);
      setAllPatients(patientList.map(p => ({ ...p, reasonForVisit: p.reasonForVisit || "Not specified" })));
      setAvailableStaff(staffList);
      setLoadedAt(cachedAt('dashboard:patients'));
    } catch (error) {
      console.error("Error loading patients or staff:", error);
      toast({ title: "Error", description: "Could not load patient or staff data.", variant: "destructive" });
    }
  }, [toast]);

  useEffect(() => {
    if (currentUser) {
      setIsLoading(true);
      loadDashboard().finally(() => setIsLoading(false));
    } else {
      setAllPatients([]);
      setAvailableStaff([]);
      setIsLoading(false);
    }
  }, [currentUser, loadDashboard]);

  // Doctors and nurses start on their own patients, if they have any.
  useEffect(() => {
    if (filterChosen || !summary || !currentUser) return;
    if ((currentUser.role === 'Doctor' || currentUser.role === 'Nurse') && summary.patients.mine > 0) setFilterDepartment('mine');
    setFilterChosen(true);
  }, [summary, currentUser, filterChosen]);

  const showMyPatients = () => {
    setFilterDepartment('mine');
    setFilterChosen(true);
    document.getElementById('patient-list')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  };

  const handleRefresh = () => {
    setIsRefreshing(true);
    loadDashboard(true).finally(() => setIsRefreshing(false));
  };

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
    if (filterDepartment === "none") {
      patientsToProcess = patientsToProcess.filter(patient => !patient.departmentId);
    } else if (filterDepartment === "mine" && currentUser) {
      patientsToProcess = patientsToProcess.filter(patient =>
        patient.attendingDoctorId === currentUser.id || patient.attendingNurseId === currentUser.id || patient.assignedStaffIds?.includes(currentUser.id));
    } else if (filterDepartment !== "All") {
      patientsToProcess = patientsToProcess.filter(patient => String(patient.departmentId) === filterDepartment);
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
  }, [allPatients, searchTerm, filterCondition, filterDepartment, currentUser]);

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
          <Link href="/patients/new" passHref>
            <Button>
              <UserPlus className="mr-2 h-4 w-4" />
              Add New Patient
            </Button>
          </Link>
        </div>
      </header>
      {currentUser?.role === 'Super Admin' && isSevaDefault(hospital) && (
        <Card className="mb-6 border-primary/40 bg-primary/5">
          <CardContent className="flex flex-col gap-3 pt-6 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p className="font-semibold">Set up your hospital&apos;s name and logo</p>
              <p className="text-sm text-muted-foreground">Staff will see them on the login page, the header and printed summaries.</p>
            </div>
            <Button asChild><Link href="/hospital-profile">Set up Hospital Profile</Link></Button>
          </CardContent>
        </Card>
      )}
      <RefreshStamp loadedAt={loadedAt} onRefresh={handleRefresh} isRefreshing={isRefreshing} className="-mt-6 mb-2 justify-end" />
      {summary && <div className="mb-6"><RoleSummary summary={summary} user={currentUser} onShowMine={showMyPatients} /></div>}

      <Card id="patient-list" className="mb-6 shadow-md scroll-mt-20">
        <CardHeader>
          <CardTitle className="text-lg">Filters & Search</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col md:flex-row gap-4 items-end">
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
            <Label htmlFor="filterDepartment">Department</Label>
            <Select value={filterDepartment} onValueChange={v => { setFilterDepartment(v); setFilterChosen(true); }}>
              <SelectTrigger id="filterDepartment" className="mt-1">
                <SelectValue placeholder="All Departments" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="All">All Departments</SelectItem>
                <SelectItem value="mine">My Patients</SelectItem>
                {departmentList.map(d => <SelectItem key={d.id} value={String(d.id)}>{d.name}</SelectItem>)}
                <SelectItem value="none">No Department</SelectItem>
              </SelectContent>
            </Select>
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
                        <Card className={`shadow-lg hover:shadow-xl transition-colors border-2 ${config.colorClasses} h-full flex flex-col cursor-pointer group-hover:border-primary`}>
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
                            {patient.departmentId && (
                            <div className="flex items-start text-sm text-muted-foreground mb-2">
                            <Building2 className="mr-2 h-4 w-4 mt-0.5 shrink-0" />
                            <span className="truncate">
                                {departmentList.find(d => d.id === patient.departmentId)?.name ?? 'Department'}
                                {patient.attendingDoctorId ? ` · ${availableStaff.find(s => s.id === patient.attendingDoctorId)?.name ?? ''}` : ''}
                            </span>
                            </div>
                            )}
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
    
