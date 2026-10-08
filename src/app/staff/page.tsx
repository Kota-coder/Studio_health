"use client";

import { useEffect, useState } from 'react';
import Link from '@/components/app-link';
import { Edit3, PlusCircle, Users } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { PageBody, PageHeader, PageLoading } from '@/components/page';
import { CsvImport } from '@/components/csv-import';
import { parseDMY } from '@/components/date-field';
import { useT } from '@/components/language-provider';
import { useToast } from '@/hooks/use-toast';
import { ALL_ROLES } from '@/config/permissions';
import { staff as staffRepo } from '@/lib/data';
import { formatDate, formatINR, toDMY } from '@/lib/format';
import type { StaffMember, StaffRole } from '@/types/staff';

const isEmail = (text: string) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(text);

// Everyone with a login. Access is checked by PageGuard (src/config/navigation.ts).
export default function StaffPage() {
  const t = useT();
  const { toast } = useToast();
  const [staffMembers, setStaffMembers] = useState<StaffMember[] | null>(null);

  useEffect(() => {
    staffRepo.listWithSalaries()
      .then(setStaffMembers)
      .catch(() => {
        toast({ title: 'Could not load staff', variant: 'destructive' });
        setStaffMembers([]);
      });
  }, [toast]);

  const importRows = async (rows: Record<string, string>[]) => {
    const emails = new Set((staffMembers ?? []).map(s => s.email.toLowerCase()));
    const valid: Omit<StaffMember, 'id'>[] = [];
    for (const r of rows) {
      const email = r.email?.toLowerCase() ?? '';
      const role = ALL_ROLES.find(x => x.toLowerCase() === r.role?.toLowerCase()) as StaffRole | undefined;
      const hired = parseDMY(r.hiredate ?? '');
      const salary = r.salary ? Number(r.salary) : undefined;
      if (!r.name || !/^\d{10}$/.test(r.phonenumber ?? '') || !isEmail(email) || emails.has(email) || !role || !hired
        || (salary !== undefined && (!Number.isFinite(salary) || salary < 0))) continue;
      emails.add(email);
      valid.push({ name: r.name, phoneNumber: r.phonenumber, email, role, hireDate: toDMY(hired), salary });
    }
    let created = 0;
    if (valid.length) {
      const result = await staffRepo.createMany(valid);
      created = result.created.length;
      if (result.failures.length) toast({ title: 'Some staff were not added', description: result.failures.join(' '), variant: 'destructive' });
      setStaffMembers(await staffRepo.listWithSalaries());
    }
    return { imported: created, skipped: rows.length - created };
  };

  if (!staffMembers) return <PageLoading />;

  return (
    <PageBody>
      <PageHeader icon={Users} title={t('Staff')} description={t('Everyone who can log in. New staff are emailed an invite to set their password.')}
        actions={<>
          <CsvImport what={t('staff members')} importRows={importRows}
            columns={[
              { name: 'Name', required: true },
              { name: 'PhoneNumber', required: true, hint: '10 digits' },
              { name: 'Email', required: true, hint: 'used to log in; must be new' },
              { name: 'Role', required: true, hint: ALL_ROLES.join(', ') },
              { name: 'HireDate', required: true, hint: 'dd/mm/yyyy' },
              { name: 'Salary', hint: 'monthly, e.g. 65000' },
            ]}
            example={'Name,PhoneNumber,Email,Role,HireDate,Salary\nDr. John Doe,9876543210,john.doe@example.com,Doctor,01/08/2023,120000'} />
          <Button asChild><Link href="/staff/form"><PlusCircle className="mr-2 h-4 w-4" /> {t('Add Staff Member')}</Link></Button>
        </>} />

      <Card>
        <CardContent className="pt-6">
          {staffMembers.length === 0 ? (
            <p className="text-sm text-muted-foreground">{t('No staff yet. Add one, or import a list from a CSV file.')}</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>{t('Name')}</TableHead>
                  <TableHead className="hidden sm:table-cell">{t('Email')}</TableHead>
                  <TableHead className="hidden md:table-cell">{t('Phone')}</TableHead>
                  <TableHead>{t('Role')}</TableHead>
                  <TableHead className="hidden lg:table-cell">{t('Hire Date')}</TableHead>
                  <TableHead className="hidden lg:table-cell text-right">{t('Salary')}</TableHead>
                  <TableHead className="text-right">{t('Actions')}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {[...staffMembers].sort((a, b) => a.name.localeCompare(b.name)).map(member => (
                  <TableRow key={member.id}>
                    <TableCell className="font-medium">{member.name}</TableCell>
                    <TableCell className="hidden sm:table-cell break-all">{member.email}</TableCell>
                    <TableCell className="hidden md:table-cell">{member.phoneNumber}</TableCell>
                    <TableCell>{t(member.role)}</TableCell>
                    <TableCell className="hidden lg:table-cell">{formatDate(member.hireDate, 'dd/MM/yyyy')}</TableCell>
                    <TableCell className="hidden lg:table-cell text-right">{member.salary == null ? '—' : formatINR(member.salary)}</TableCell>
                    <TableCell className="text-right">
                      <Button variant="outline" size="sm" asChild aria-label={t('Edit {name}', { name: member.name })}>
                        <Link href={`/staff/form?id=${member.id}`}><Edit3 className="h-4 w-4" /></Link>
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </PageBody>
  );
}
