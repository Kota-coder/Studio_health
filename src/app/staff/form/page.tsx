"use client";

import { useEffect, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { Save, UserCog } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardFooter } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { PageBody, PageHeader, PageLoading } from '@/components/page';
import { DateField, parseDMY } from '@/components/date-field';
import { useT } from '@/components/language-provider';
import { useToast } from '@/hooks/use-toast';
import { useStaff } from '@/context/AuthContext';
import { ALL_ROLES } from '@/config/permissions';
import { staff as staffRepo } from '@/lib/data';
import { parseStoredDate, toDMY } from '@/lib/format';
import type { StaffMember, StaffRole } from '@/types/staff';

const isValidEmail = (email: string) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
const isValidPhoneNumber = (number: string) => /^[0-9]{10}$/.test(number);

// Add or edit a staff member (?id=). New staff are emailed an invite to set their password.
export default function StaffFormPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { toast } = useToast();
  const t = useT();
  const currentUser = useStaff();

  const staffIdToEdit = searchParams.get('id');
  const isEditMode = Boolean(staffIdToEdit);
  const isSelf = isEditMode && Number(staffIdToEdit) === currentUser.id;

  const [name, setName] = useState('');
  const [phoneNumber, setPhoneNumber] = useState('');
  const [email, setEmail] = useState('');
  const [role, setRole] = useState<StaffRole | ''>('');
  const [hireDate, setHireDate] = useState('');
  const [salary, setSalary] = useState('');
  const [isLoading, setIsLoading] = useState(isEditMode);
  const [isSaving, setIsSaving] = useState(false);

  const phoneError = phoneNumber && !isValidPhoneNumber(phoneNumber) ? 'Phone number must be 10 digits.' : null;
  const emailError = email && !isValidEmail(email) ? 'Please enter a valid email address.' : null;

  useEffect(() => {
    if (!staffIdToEdit) return;
    staffRepo.get(parseInt(staffIdToEdit, 10)).then(member => {
      if (!member) {
        toast({ title: 'Staff member not found', variant: 'destructive' });
        router.push('/staff');
        return;
      }
      setName(member.name);
      setPhoneNumber(member.phoneNumber);
      setEmail(member.email);
      setRole(member.role);
      setSalary(member.salary !== undefined ? String(member.salary) : '');
      const hired = parseStoredDate(member.hireDate);
      setHireDate(hired ? toDMY(hired) : member.hireDate ?? '');
    }).catch(() => {
      toast({ title: 'Could not load staff member', variant: 'destructive' });
    }).finally(() => setIsLoading(false));
  }, [staffIdToEdit, router, toast]);

  const handleSubmit = async () => {
    const problems: string[] = [];
    if (!name.trim()) problems.push('Name is required.');
    if (!isValidPhoneNumber(phoneNumber)) problems.push('Phone number must be 10 digits.');
    if (!isValidEmail(email)) problems.push('Please enter a valid email address.');
    if (!role) problems.push('Role is required.');
    const hired = parseDMY(hireDate);
    if (!hired) problems.push(hireDate ? 'Hire Date must be in dd/mm/yyyy format.' : 'Hire Date is required.');
    const numericSalary = salary.trim() === '' ? undefined : Number(salary);
    if (numericSalary !== undefined && (!Number.isFinite(numericSalary) || numericSalary < 0)) {
      problems.push('Salary must be a valid non-negative number if provided.');
    }
    if (problems.length) {
      toast({ title: 'Please check the form', description: problems.join(' '), variant: 'destructive' });
      return;
    }

    const member: Omit<StaffMember, 'id'> = {
      name: name.trim(),
      phoneNumber,
      email: email.trim(),
      role: role as StaffRole,
      hireDate: toDMY(hired!),
      salary: numericSalary,
    };

    setIsSaving(true);
    try {
      if (isEditMode) {
        await staffRepo.update(Number(staffIdToEdit), member);
        toast({ title: 'Staff member updated' });
      } else {
        const { failures } = await staffRepo.createMany([member]);
        if (failures.length > 0) {
          toast({ title: 'Could not add staff member', description: failures.join(' '), variant: 'destructive' });
          return;
        }
        toast({ title: 'Staff member added', description: `An invite to set a password was emailed to ${member.email}.` });
      }
      router.push('/staff');
    } catch (e) {
      toast({ title: 'Could not save', description: e instanceof Error ? e.message : 'Could not save staff data.', variant: 'destructive' });
    } finally {
      setIsSaving(false);
    }
  };

  if (isLoading) return <PageLoading />;

  return (
    <PageBody width="narrow">
      <PageHeader icon={UserCog} back={{ href: '/staff' }}
        title={isEditMode ? t('Edit Staff Member') : t('Add Staff Member')}
        description={isEditMode ? undefined : t('They will be emailed an invite to set their password.')} />
      <Card>
        <CardContent className="grid gap-4 pt-6">
          <div>
            <Label htmlFor="name">Full Name *</Label>
            <Input id="name" value={name} onChange={e => setName(e.target.value)} required />
          </div>
          <div>
            <Label htmlFor="phoneNumber">Phone Number *</Label>
            <Input id="phoneNumber" type="tel" inputMode="numeric" value={phoneNumber} onChange={e => setPhoneNumber(e.target.value)} required />
            {phoneError && <p className="mt-1 text-sm text-destructive">{phoneError}</p>}
          </div>
          <div>
            <Label htmlFor="email">Email Address * (used to log in)</Label>
            <Input id="email" type="email" value={email} onChange={e => setEmail(e.target.value)} required disabled={isSelf} />
            {emailError && <p className="mt-1 text-sm text-destructive">{emailError}</p>}
            {isSelf && <p className="mt-1 text-xs text-muted-foreground">Your login email cannot be changed here.</p>}
          </div>
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            <div>
              <Label htmlFor="role">Role *</Label>
              <Select onValueChange={value => setRole(value as StaffRole)} value={role} required>
                <SelectTrigger id="role"><SelectValue placeholder="Select Role" /></SelectTrigger>
                <SelectContent>
                  {ALL_ROLES.filter(r => r !== 'Super Admin' || currentUser.role === 'Super Admin').map(r => <SelectItem key={r} value={r}>{t(r)}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label htmlFor="salary">Salary (₹) (Optional)</Label>
              <Input id="salary" type="number" value={salary} onChange={e => setSalary(e.target.value)} placeholder="e.g., 50000" min="0" step="any" />
            </div>
          </div>
          <div>
            <Label htmlFor="hireDate">Hire Date *</Label>
            <DateField id="hireDate" value={hireDate} onChange={setHireDate} required />
          </div>
        </CardContent>
        <CardFooter className="flex justify-end gap-2">
          <Button variant="outline" onClick={() => router.push('/staff')}>{t('Cancel')}</Button>
          <Button onClick={handleSubmit} disabled={isSaving}>
            <Save className="mr-2 h-4 w-4" /> {isSaving ? t('Saving…') : isEditMode ? t('Save') : t('Add Staff Member')}
          </Button>
        </CardFooter>
      </Card>
    </PageBody>
  );
}
