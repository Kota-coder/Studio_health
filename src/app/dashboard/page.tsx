"use client";

import { useCallback, useEffect, useMemo, useState } from 'react';
import Link from '@/components/app-link';
import { Activity, AlertTriangle, Building2, CheckCircle2, ClipboardList, HelpCircle, LayoutDashboard, ShieldCheck, UserPlus, Users as UsersIcon } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';
import { PageBody, PageHeader, PageLoading } from '@/components/page';
import { RoleSummary } from '@/components/role-summary';
import { RefreshStamp } from '@/components/refresh-stamp';
import { useBranding } from '@/components/branding-provider';
import { useT } from '@/components/language-provider';
import { useStaff } from '@/context/AuthContext';
import { useFeatures } from '@/hooks/use-features';
import { useToast } from '@/hooks/use-toast';
import { isSevaDefault } from '@/lib/branding';
import { DISCHARGED_DAYS, bills as billsRepo, departments as departmentsRepo, homeSummary, patients as patientsRepo, staff as staffRepo, type HomeSummary } from '@/lib/data';
import { cachedAt, invalidate } from '@/lib/data/cache';
import { formatDate, formatINR, patientDisplayId } from '@/lib/format';
import type { Department } from '@/types/department';
import type { Patient, PatientCondition } from '@/types/patient';
import type { StaffMember } from '@/types/staff';

const CONDITION_ORDER: PatientCondition[] = ["Critical", "Medium", "Low", "Unassigned", "Discharged"];

const CONDITION_CONFIG: Record<PatientCondition, { icon: React.ElementType; colorClasses: string; iconClass: string; title: string }> = {
  Critical: { icon: AlertTriangle, colorClasses: "bg-red-50 border-red-400 hover:bg-red-100", iconClass: "text-red-600", title: "Critical Patients" },
  Medium: { icon: Activity, colorClasses: "bg-yellow-50 border-yellow-400 hover:bg-yellow-100", iconClass: "text-yellow-600", title: "Medium Priority Patients" },
  Low: { icon: ShieldCheck, colorClasses: "bg-green-50 border-green-400 hover:bg-green-100", iconClass: "text-green-600", title: "Low Priority Patients" },
  Discharged: { icon: CheckCircle2, colorClasses: "bg-sky-50 border-sky-400 hover:bg-sky-100", iconClass: "text-sky-600", title: "Discharged Patients" },
  Unassigned: { icon: HelpCircle, colorClasses: "bg-gray-50 border-gray-300 hover:bg-gray-100", iconClass: "text-gray-600", title: "Condition Unassigned" },
};

// The latest care note: its template name or the start of its text, with the date.
function latestCareNoteSummary(patient: Patient): string {
  const latest = patient.careNotes?.at(-1); // notes come sorted oldest first
  if (!latest) return "No recent activity";
  const summary = latest.templateName && latest.templateName !== 'General Note (No Template)'
    ? latest.templateName
    : latest.text ? latest.text.substring(0, 30) + (latest.text.length > 30 ? "..." : "") : "General note entry";
  return `${summary} (on ${formatDate(latest.createdAt, 'dd/MM/yy')})`;
}

function assignedStaffNames(patient: Patient, staffList: StaffMember[]): string {
  const names = (patient.assignedStaffIds ?? []).map(id => staffList.find(s => s.id === id)?.name).filter(Boolean);
  if (names.length === 0) return "No staff assigned";
  return names.length > 2 ? `${names.slice(0, 2).join(', ')} & others` : names.join(', ');
}

// Patients grouped by condition, with filters, quick condition changes and the role summary.
export default function DashboardPage() {
  const { profile: hospital } = useBranding();
  const currentUser = useStaff();
  const { isOn } = useFeatures();
  const { toast } = useToast();
  const t = useT();

  const [allPatients, setAllPatients] = useState<Patient[]>([]);
  const [availableStaff, setAvailableStaff] = useState<StaffMember[]>([]);
  const [departmentList, setDepartmentList] = useState<Department[]>([]);
  const [summary, setSummary] = useState<HomeSummary | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [loadedAt, setLoadedAt] = useState<Date | null>(null);
  const [isRefreshing, setIsRefreshing] = useState(false);

  // A discharge waiting for confirmation because the patient has unpaid bills.
  const [pendingDischarge, setPendingDischarge] = useState<{ patientId: number; message: string } | null>(null);

  const [searchTerm, setSearchTerm] = useState("");
  const [filterCondition, setFilterCondition] = useState<PatientCondition | "All">("All");
  const [filterDepartment, setFilterDepartment] = useState("All");
  const [filterChosen, setFilterChosen] = useState(false);
  // Patients discharged more than DISCHARGED_DAYS ago: loaded on request, or found by name.
  const [olderDischarged, setOlderDischarged] = useState<Patient[] | null>(null);
  const [olderMatches, setOlderMatches] = useState<Patient[]>([]);

  // Patients, staff and departments come from a short-lived cache (see lib/data/cache.ts);
  // Refresh fetches them again.
  const loadDashboard = useCallback(async (refresh = false) => {
    if (refresh) invalidate('dashboard:', 'staff:', 'departments:', 'summary:home');
    // The summary is optional: the patient list still shows if it fails.
    homeSummary().then(setSummary).catch(error => console.error('Could not load the summary', error));
    try {
      const [patientList, staffList, departmentsLoaded] = await Promise.all([patientsRepo.listForDashboard(), staffRepo.list(), departmentsRepo.list()]);
      setDepartmentList(departmentsLoaded);
      setAllPatients(patientList);
      setAvailableStaff(staffList);
      setLoadedAt(cachedAt('dashboard:patients'));
    } catch (error) {
      console.error("Error loading patients or staff:", error);
      toast({ title: "Error", description: "Could not load patient or staff data.", variant: "destructive" });
    }
  }, [toast]);

  useEffect(() => {
    loadDashboard().finally(() => setIsLoading(false));
  }, [loadDashboard]);

  // Doctors and nurses start on their own patients, if they have any.
  useEffect(() => {
    if (filterChosen || !summary) return;
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

  useEffect(() => {
    const term = searchTerm.trim();
    if (olderDischarged || term.length < 2) { setOlderMatches([]); return; }
    const timer = setTimeout(() => {
      patientsRepo.listOlderDischarged(term).then(setOlderMatches).catch(() => setOlderMatches([]));
    }, 400);
    return () => clearTimeout(timer);
  }, [searchTerm, olderDischarged]);

  const showOlderDischarged = () => {
    patientsRepo.listOlderDischarged().then(setOlderDischarged)
      .catch(() => toast({ title: 'Could not load discharged patients', variant: 'destructive' }));
  };

  const groupedPatients = useMemo(() => {
    const search = searchTerm.trim().toLowerCase();
    const matches = (patient: Patient) => {
      if (search && !`${patient.firstName} ${patient.lastName}`.toLowerCase().includes(search)) return false;
      if (filterCondition !== "All" && (patient.condition || "Unassigned") !== filterCondition) return false;
      if (filterDepartment === "none") return !patient.departmentId;
      if (filterDepartment === "mine") {
        return patient.attendingDoctorId === currentUser.id || patient.attendingNurseId === currentUser.id || !!patient.assignedStaffIds?.includes(currentUser.id);
      }
      return filterDepartment === "All" || String(patient.departmentId) === filterDepartment;
    };
    const grouped: Record<PatientCondition, Patient[]> = { Critical: [], Medium: [], Low: [], Discharged: [], Unassigned: [] };
    const loaded = new Set(allPatients.map(p => p.id));
    const extra = (olderDischarged ?? olderMatches).filter(p => !loaded.has(p.id));
    for (const patient of [...allPatients, ...extra].filter(matches)) {
      (grouped[patient.condition || "Unassigned"] ?? grouped.Unassigned).push(patient);
    }
    return grouped;
  }, [allPatients, olderDischarged, olderMatches, searchTerm, filterCondition, filterDepartment, currentUser]);

  const changeCondition = useCallback(async (patientId: number, newCondition: PatientCondition) => {
    const patient = allPatients.find(p => p.id === patientId);
    if (!patient) return;
    try {
      await patientsRepo.update(patientId, { condition: newCondition }, {
        actionType: "Condition Changed",
        details: `Condition changed from '${patient.condition || "Unassigned"}' to '${newCondition}'.`,
      });
      setAllPatients(prev => prev.map(p => p.id === patientId ? { ...p, condition: newCondition } : p));
      toast({ title: "Condition updated", description: `Patient ${patient.firstName} ${patient.lastName}'s condition set to ${newCondition}.` });
    } catch (e) {
      console.error("Failed to save condition update", e);
      toast({ title: "Save error", description: "Could not save condition update.", variant: "destructive" });
    }
  }, [allPatients, toast]);

  // Discharging a patient with unpaid bills asks for confirmation first (when Billing is used).
  const handleConditionChange = async (patientId: number, newCondition: PatientCondition) => {
    if (newCondition !== "Discharged" || !isOn('billing')) {
      changeCondition(patientId, newCondition);
      return;
    }
    try {
      const unpaid = (await billsRepo.list({ patientId, brief: true })).filter(bill => bill.paymentStatus === "Unpaid" || bill.paymentStatus === "Partially Paid");
      if (unpaid.length === 0) {
        changeCondition(patientId, newCondition);
        return;
      }
      const total = unpaid.reduce((sum, bill) => sum + bill.totalAmount, 0);
      setPendingDischarge({
        patientId,
        message: `This patient has ${unpaid.length} outstanding bill(s) totaling approximately ${formatINR(total)}. Are you sure you want to discharge this patient?`,
      });
    } catch (error) {
      console.error("Error checking outstanding bills:", error);
      toast({ title: "Error", description: "Could not check outstanding bills.", variant: "destructive" });
    }
  };

  if (isLoading) return <PageLoading />;

  const totalFiltered = Object.values(groupedPatients).reduce((sum, group) => sum + group.length, 0);
  const departmentName = (id: number) => departmentList.find(d => d.id === id)?.name ?? 'Department';
  const staffName = (id: number) => availableStaff.find(s => s.id === id)?.name ?? '';

  const emptyCard = (title: string, text: string) => (
    <Card className="text-center">
      <CardHeader><CardTitle>{title}</CardTitle></CardHeader>
      <CardContent><CardDescription>{text}</CardDescription></CardContent>
    </Card>
  );

  return (
    <PageBody>
      <PageHeader icon={LayoutDashboard} title={t('Patient Dashboard')}
        actions={<Button asChild><Link href="/patients/new"><UserPlus className="mr-2 h-4 w-4" /> {t('Register Patient')}</Link></Button>} />

      {currentUser.role === 'Super Admin' && isSevaDefault(hospital) && (
        <Card className="border-primary/40 bg-primary/5">
          <CardContent className="flex flex-col gap-3 pt-6 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p className="font-semibold">{t("Set up your hospital's name and logo")}</p>
              <p className="text-sm text-muted-foreground">Staff will see them on the login page, the header and printed summaries.</p>
            </div>
            <Button asChild><Link href="/hospital-profile">{t('Set up Hospital Profile')}</Link></Button>
          </CardContent>
        </Card>
      )}

      <div className="space-y-2">
        <RefreshStamp loadedAt={loadedAt} onRefresh={handleRefresh} isRefreshing={isRefreshing} className="justify-end" />
        {summary && <RoleSummary summary={summary} user={currentUser} onShowMine={showMyPatients} />}
      </div>

      <Card id="patient-list" className="scroll-mt-20">
        <CardHeader>
          <CardTitle className="text-lg">{t('Filters & Search')}</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-4 md:flex-row md:items-end">
          <div className="w-full md:flex-grow">
            <Label htmlFor="searchPatientName">Search by Patient Name</Label>
            <Input id="searchPatientName" placeholder="Enter patient name..." value={searchTerm} onChange={e => setSearchTerm(e.target.value)} className="mt-1" />
          </div>
          <div className="w-full md:w-52">
            <Label htmlFor="filterDepartment">Department</Label>
            <Select value={filterDepartment} onValueChange={v => { setFilterDepartment(v); setFilterChosen(true); }}>
              <SelectTrigger id="filterDepartment" className="mt-1"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="All">All Departments</SelectItem>
                <SelectItem value="mine">My Patients</SelectItem>
                {departmentList.map(d => <SelectItem key={d.id} value={String(d.id)}>{d.name}</SelectItem>)}
                <SelectItem value="none">No Department</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="w-full md:w-52">
            <Label htmlFor="filterPatientCondition">Filter by Condition</Label>
            <Select value={filterCondition} onValueChange={v => setFilterCondition(v as PatientCondition | "All")}>
              <SelectTrigger id="filterPatientCondition" className="mt-1"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="All">All Conditions</SelectItem>
                {CONDITION_ORDER.map(c => <SelectItem key={c} value={c}>{t(c)}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      {allPatients.length === 0
        ? emptyCard(t('No Patients Found'), 'There are no patients registered yet. Click "Register Patient" above to start.')
        : totalFiltered === 0
          ? emptyCard(t('No Patients Match Criteria'), 'No patients found matching your current search and filter settings. Try adjusting your filters.')
          : (
            <div className="space-y-8">
              {CONDITION_ORDER.map(level => {
                const config = CONDITION_CONFIG[level];
                const group = groupedPatients[level];
                const moreDischarged = level === 'Discharged' && !olderDischarged && (filterCondition === 'All' || filterCondition === 'Discharged');
                if (group.length === 0 && !moreDischarged) return null;
                return (
                  <section key={level}>
                    <h2 className="mb-4 flex items-center text-xl font-semibold text-foreground sm:text-2xl">
                      <config.icon className={`mr-3 h-7 w-7 shrink-0 ${config.iconClass}`} />
                      {t(config.title)} ({group.length})
                    </h2>
                    <div className="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-3">
                      {group.map(patient => {
                        const staffNames = assignedStaffNames(patient, availableStaff);
                        const noteSummary = latestCareNoteSummary(patient);
                        return (
                          <Link key={patient.id} href={`/patients/${patientDisplayId(patient.id)}`} className="group block min-w-0">
                            <Card className={`flex h-full cursor-pointer flex-col border-2 shadow-lg transition-colors hover:shadow-xl group-hover:border-primary ${config.colorClasses}`}>
                              <CardHeader>
                                <CardTitle className="truncate">{patient.firstName} {patient.lastName}</CardTitle>
                                <CardDescription className="truncate">Visit: {patient.reasonForVisit || "Not specified"}</CardDescription>
                              </CardHeader>
                              <CardContent className="flex-grow space-y-3 text-sm text-muted-foreground">
                                <div className="flex items-start">
                                  <ClipboardList className="mr-2 mt-0.5 h-4 w-4 shrink-0" />
                                  <span className="truncate" title={noteSummary}>Latest: {noteSummary}</span>
                                </div>
                                {patient.departmentId && (
                                  <div className="flex items-start">
                                    <Building2 className="mr-2 mt-0.5 h-4 w-4 shrink-0" />
                                    <span className="truncate">
                                      {departmentName(patient.departmentId)}
                                      {patient.attendingDoctorId ? ` · ${staffName(patient.attendingDoctorId)}` : ''}
                                    </span>
                                  </div>
                                )}
                                <div className="flex items-start">
                                  <UsersIcon className="mr-2 mt-0.5 h-4 w-4 shrink-0" />
                                  <span className="truncate" title={staffNames}>Attending: {staffNames}</span>
                                </div>
                                <div onClick={e => e.stopPropagation()}>
                                  <Label htmlFor={`condition-${patient.id}`} className="text-xs text-muted-foreground">Condition:</Label>
                                  <Select value={patient.condition || "Unassigned"} onValueChange={c => handleConditionChange(patient.id, c as PatientCondition)}>
                                    <SelectTrigger id={`condition-${patient.id}`} className="h-9 text-sm"><SelectValue /></SelectTrigger>
                                    <SelectContent>
                                      {CONDITION_ORDER.map(c => <SelectItem key={c} value={c} className="text-sm">{t(c)}</SelectItem>)}
                                    </SelectContent>
                                  </Select>
                                </div>
                              </CardContent>
                            </Card>
                          </Link>
                        );
                      })}
                    </div>
                    {moreDischarged && (
                      <Button variant="outline" className="mt-4" onClick={showOlderDischarged}>
                        {t('Show patients discharged more than {days} days ago', { days: DISCHARGED_DAYS })}
                      </Button>
                    )}
                  </section>
                );
              })}
            </div>
          )}

      <AlertDialog open={!!pendingDischarge} onOpenChange={open => { if (!open) setPendingDischarge(null); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t('Confirm Discharge')}</AlertDialogTitle>
            <AlertDialogDescription>{pendingDischarge?.message}</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{t('Cancel')}</AlertDialogCancel>
            <AlertDialogAction onClick={() => { if (pendingDischarge) changeCondition(pendingDischarge.patientId, "Discharged"); setPendingDischarge(null); }}>
              {t('Proceed with Discharge')}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </PageBody>
  );
}
