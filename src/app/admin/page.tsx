'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Database, CheckCircle, AlertCircle, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { useAuth } from '@/context/AuthContext';
import { loadSampleDataIntoDatabase, removeSampleDataFromDatabase } from '@/lib/seedData';

// Super Admin tool for trying the app out: loads demo records into an empty
// database, and removes them again before real use.
export default function AdminPage() {
  const { currentUser, isLoading: authIsLoading } = useAuth();
  const router = useRouter();
  const [progress, setProgress] = useState<string | null>(null);
  const [result, setResult] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!authIsLoading && !currentUser) router.replace('/login');
    else if (!authIsLoading && currentUser?.role !== 'Super Admin') router.replace('/dashboard');
  }, [authIsLoading, currentUser, router]);

  if (authIsLoading || currentUser?.role !== 'Super Admin') {
    return <div className="flex justify-center items-center min-h-screen"><p>{authIsLoading ? 'Loading...' : 'Access Denied. Redirecting...'}</p></div>;
  }

  const run = async (task: () => Promise<string>) => {
    setError(null);
    setResult(null);
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
    setProgress('Starting...');
    run(async () => {
      const s = await loadSampleDataIntoDatabase(currentUser, setProgress);
      return `Loaded ${s.patients} patients (${s.careNotes} care notes, ${s.tests} tests), ${s.bills} bills, ${s.payments} payments, `
        + `${s.staff} staff in ${s.departments} departments (${s.doctorFeePayments} doctor fee and ${s.referralFeePayments} referral fee payments), `
        + `${s.shifts} roster shifts with ${s.attendance} clock-ins, ${s.referringDoctors} referring doctors, ${s.medications} medications, ${s.materials} materials, `
        + `${s.vendors} vendors and ${s.testCatalog} catalog tests.`;
    });
  };

  const handleRemove = () => {
    if (!confirm('Remove all sample data? Records your staff entered are not touched.')) return;
    setProgress('Starting...');
    run(async () => `Removed ${await removeSampleDataFromDatabase(setProgress)} sample records and the sample staff.`);
  };

  const busy = progress !== null;

  return (
    <div className="container mx-auto p-4 sm:p-6 lg:p-8 max-w-3xl">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2"><Database className="h-6 w-6" /> Sample Data</CardTitle>
          <CardDescription>
            For trying the app out. Loads about six months of a small hospital&apos;s activity: three departments (Cardiology, General Medicine,
            Orthopaedics) with their doctors and nurses, 30 patients with care notes, tests, doctor fees and referral fees
            (fixed and percentage), bills, salary, supply, doctor-fee and referral payments, a duty roster (three weeks past
            with clock-ins and two weeks ahead), referring doctors, medications, materials, vendors and a test catalog. It only loads into a database with no patients, and everything it
            adds can be removed again before you start using the app for real.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex flex-col sm:flex-row gap-2">
            <Button onClick={handleLoad} disabled={busy}>
              <Database className="mr-2 h-4 w-4" /> Load Sample Data
            </Button>
            <Button variant="outline" onClick={handleRemove} disabled={busy} className="text-destructive">
              <Trash2 className="mr-2 h-4 w-4" /> Remove Sample Data
            </Button>
          </div>
          <p className="text-xs text-muted-foreground">
            Sample staff appear in Staff Management and can be assigned to patients, but cannot log in. To test what other
            roles see, invite yourself on a second email address from Staff Management.
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
    </div>
  );
}
