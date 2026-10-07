'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Database, CheckCircle, AlertCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { useAuth } from '@/context/AuthContext';
import { loadSampleDataIntoDatabase, type SampleDataSummary } from '@/lib/seedData';

// Super Admin tool for trying the app out: loads demo records into an empty database.
export default function AdminPage() {
  const { currentUser, isLoading: authIsLoading } = useAuth();
  const router = useRouter();
  const [summary, setSummary] = useState<SampleDataSummary | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    if (!authIsLoading && !currentUser) router.replace('/login');
    else if (!authIsLoading && currentUser?.role !== 'Super Admin') router.replace('/dashboard');
  }, [authIsLoading, currentUser, router]);

  if (authIsLoading || currentUser?.role !== 'Super Admin') {
    return <div className="flex justify-center items-center min-h-screen"><p>{authIsLoading ? 'Loading...' : 'Access Denied. Redirecting...'}</p></div>;
  }

  const handleLoad = async () => {
    if (!confirm('Load sample patients, bills, medications and referring doctors into the database?')) return;
    setIsLoading(true);
    setError(null);
    setSummary(null);
    try {
      setSummary(await loadSampleDataIntoDatabase(currentUser));
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not load sample data.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="container mx-auto p-4 sm:p-6 lg:p-8 max-w-3xl">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2"><Database className="h-6 w-6" /> Sample Data</CardTitle>
          <CardDescription>
            For trying the app out. Loads demo patients (with care notes and tests), bills, medications and
            referring doctors. Only works while the database has no patients, so it never mixes with real records.
            Demo patients are assigned to you.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <Button onClick={handleLoad} disabled={isLoading} className="w-full sm:w-auto">
            {isLoading ? 'Loading sample data...' : 'Load Sample Data'}
          </Button>
          {summary && (
            <Alert>
              <CheckCircle className="h-4 w-4" />
              <AlertDescription>
                Loaded {summary.patients} patients ({summary.careNotes} care notes, {summary.tests} tests), {summary.bills} bills,
                {' '}{summary.medications} medications and {summary.referringDoctors} referring doctors.
              </AlertDescription>
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
