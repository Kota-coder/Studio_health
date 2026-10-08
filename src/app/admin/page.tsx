'use client';

import { useState } from 'react';
import { AlertCircle, CheckCircle, Database, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { PageBody, PageHeader } from '@/components/page';
import { useT } from '@/components/language-provider';
import { useStaff } from '@/context/AuthContext';

// Super Admin tool for trying the app out: loads demo records into an empty
// database, and removes them again before real use. Access is checked by PageGuard.
// The sample data (large) is only downloaded when one of the buttons is used.
export default function AdminPage() {
  const t = useT();
  const currentUser = useStaff();
  const [progress, setProgress] = useState<string | null>(null);
  const [result, setResult] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const run = async (task: () => Promise<string>) => {
    setError(null);
    setResult(null);
    setProgress('Starting...');
    try {
      setResult(await task());
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Something went wrong.');
    } finally {
      setProgress(null);
    }
  };

  const handleLoad = () => {
    if (!confirm('Load about six months of sample patients, bills, payments, staff, duty roster and catalogs into the database?')) return;
    run(async () => {
      const { loadSampleDataIntoDatabase } = await import('@/lib/seedData');
      const s = await loadSampleDataIntoDatabase(currentUser, setProgress);
      return `Loaded ${s.patients} patients (${s.careNotes} care notes, ${s.tests} tests), ${s.bills} bills, ${s.payments} payments, `
        + `${s.staff} staff in ${s.departments} departments (${s.doctorFeePayments} doctor fee and ${s.referralFeePayments} referral fee payments), `
        + `${s.shifts} roster shifts with ${s.attendance} clock-ins, ${s.referringDoctors} referring doctors, ${s.medications} medications, ${s.materials} materials, `
        + `${s.vendors} vendors and ${s.testCatalog} catalog tests.`;
    });
  };

  const handleRemove = () => {
    if (!confirm('Remove all sample data? Records your staff entered are not touched.')) return;
    run(async () => {
      const { removeSampleDataFromDatabase } = await import('@/lib/seedData');
      return `Removed ${await removeSampleDataFromDatabase(setProgress)} sample records and the sample staff.`;
    });
  };

  const busy = progress !== null;

  return (
    <PageBody width="medium">
      <PageHeader icon={Database} title={t('Sample Data')}
        description={t("For trying the app out. Loads about six months of a small hospital's activity: three departments with their doctors and nurses, 30 patients with care notes, tests and fees, bills, payments, a duty roster, referring doctors, medicines, materials, vendors and a test catalog. It only loads into a database with no patients, and everything it adds can be removed again before you start using the app for real.")} />
      <Card>
        <CardContent className="space-y-4 pt-6">
          <div className="flex flex-col gap-2 sm:flex-row">
            <Button onClick={handleLoad} disabled={busy}>
              <Database className="mr-2 h-4 w-4" /> {t('Load Sample Data')}
            </Button>
            <Button variant="outline" onClick={handleRemove} disabled={busy} className="text-destructive">
              <Trash2 className="mr-2 h-4 w-4" /> {t('Remove Sample Data')}
            </Button>
          </div>
          <p className="text-xs text-muted-foreground">
            Sample staff appear under Staff and can be assigned to patients, but cannot log in. To test what other
            roles see, invite yourself on a second email address from Staff.
          </p>
          {progress && <p className="text-sm text-muted-foreground" role="status">{progress}</p>}
          {result && (
            <Alert>
              <CheckCircle className="h-4 w-4" />
              <AlertDescription>{result}</AlertDescription>
            </Alert>
          )}
          {error && (
            <Alert variant="destructive">
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}
        </CardContent>
      </Card>
    </PageBody>
  );
}
