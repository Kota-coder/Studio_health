'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { initializeSeedData, clearAllData, getDataSummary } from '@/lib/seedData';
import { Database, Trash2, RefreshCw, CheckCircle, AlertCircle } from 'lucide-react';
import Link from 'next/link';
import { useAuth } from '@/context/AuthContext';
import { STORAGE_KEYS } from '@/lib/storage';

export default function AdminPage() {
  const { currentUser, isLoading: authIsLoading } = useAuth();
  const router = useRouter();
  const [summary, setSummary] = useState<{ [key: string]: number } | null>(null);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  const handleInitializeSeedData = async () => {
    setIsLoading(true);
    setMessage(null);
    try {
      const userBefore = localStorage.getItem(STORAGE_KEYS.currentUser);
      initializeSeedData();
      if (localStorage.getItem(STORAGE_KEYS.currentUser) !== userBefore) {
        // The logged-in account was renumbered to make room for the sample staff.
        window.location.reload();
        return;
      }
      const newSummary = getDataSummary();
      setSummary(newSummary);
      setMessage({ 
        type: 'success', 
        text: 'Seed data initialized successfully! The application now has sample patients, staff, medications, and bills.' 
      });
    } catch (error) {
      setMessage({ 
        type: 'error', 
        text: `Error initializing seed data: ${error instanceof Error ? error.message : 'Unknown error'}` 
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleClearAllData = () => {
    if (confirm('Are you sure you want to clear ALL data? This action cannot be undone.')) {
      setIsLoading(true);
      setMessage(null);
      try {
        clearAllData();
        setSummary(getDataSummary());
        setMessage({ 
          type: 'success', 
          text: 'All data has been cleared from the application.' 
        });
      } catch (error) {
        setMessage({ 
          type: 'error', 
          text: `Error clearing data: ${error instanceof Error ? error.message : 'Unknown error'}` 
        });
      } finally {
        setIsLoading(false);
      }
    }
  };

  const handleRefreshSummary = () => {
    setSummary(getDataSummary());
  };


  useEffect(() => {
    if (!authIsLoading && !currentUser) router.replace('/login');
    else if (!authIsLoading && currentUser?.role !== 'Admin') router.replace('/dashboard');
  }, [authIsLoading, currentUser, router]);

  if (authIsLoading || currentUser?.role !== 'Admin') {
    return <div className="flex justify-center items-center min-h-screen"><p>{authIsLoading ? 'Loading...' : 'Access Denied. Redirecting...'}</p></div>;
  }

  return (
    <div className="container mx-auto p-6 max-w-4xl">
      <div className="mb-6">
        <Link href="/" className="text-blue-600 hover:underline">
          ← Back to Home
        </Link>
      </div>

      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold mb-2">Admin & Setup</h1>
          <p className="text-gray-600">
            Initialize sample data or manage application data
          </p>
        </div>

        {message && (
          <Alert className={message.type === 'success' ? 'border-green-500 bg-green-50' : 'border-red-500 bg-red-50'}>
            {message.type === 'success' ? (
              <CheckCircle className="h-4 w-4 text-green-600" />
            ) : (
              <AlertCircle className="h-4 w-4 text-red-600" />
            )}
            <AlertDescription className={message.type === 'success' ? 'text-green-800' : 'text-red-800'}>
              {message.text}
            </AlertDescription>
          </Alert>
        )}

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Database className="h-5 w-5" />
              Seed Data Initialization
            </CardTitle>
            <CardDescription>
              Load comprehensive sample data to test and explore all features of the application
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="bg-blue-50 p-4 rounded-lg border border-blue-200">
              <h3 className="font-semibold mb-2">What will be loaded:</h3>
              <ul className="list-disc list-inside space-y-1 text-sm">
                <li>3 sample patients with complete medical records</li>
                <li>Care notes with multiple attachments</li>
                <li>Medical test results (ECG, Blood Panels)</li>
                <li>6 staff members (Doctors, Nurses, Reception)</li>
                <li>8 medications in the catalog</li>
                <li>5 referring doctors</li>
                <li>4 sample bills with attachments</li>
              </ul>
            </div>

            <div className="flex gap-3">
              <Button 
                onClick={handleInitializeSeedData} 
                disabled={isLoading}
                className="flex-1"
              >
                {isLoading ? 'Loading...' : 'Initialize Seed Data'}
              </Button>
              <Button 
                onClick={handleClearAllData} 
                variant="destructive"
                disabled={isLoading}
                className="flex-1"
              >
                <Trash2 className="h-4 w-4 mr-2" />
                Clear All Data
              </Button>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <RefreshCw className="h-5 w-5" />
              Current Data Summary
            </CardTitle>
            <CardDescription>
              View the current state of data in the application
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <Button onClick={handleRefreshSummary} variant="outline" size="sm">
              <RefreshCw className="h-4 w-4 mr-2" />
              Refresh Summary
            </Button>

            {summary && (
              <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                <div className="bg-gray-50 p-4 rounded-lg border">
                  <div className="text-2xl font-bold">{summary.patients}</div>
                  <div className="text-sm text-gray-600">Patients</div>
                </div>
                <div className="bg-gray-50 p-4 rounded-lg border">
                  <div className="text-2xl font-bold">{summary.staff}</div>
                  <div className="text-sm text-gray-600">Staff Members</div>
                </div>
                <div className="bg-gray-50 p-4 rounded-lg border">
                  <div className="text-2xl font-bold">{summary.medications}</div>
                  <div className="text-sm text-gray-600">Medications</div>
                </div>
                <div className="bg-gray-50 p-4 rounded-lg border">
                  <div className="text-2xl font-bold">{summary.referringDoctors}</div>
                  <div className="text-sm text-gray-600">Referring Doctors</div>
                </div>
                <div className="bg-gray-50 p-4 rounded-lg border">
                  <div className="text-2xl font-bold">{summary.bills}</div>
                  <div className="text-sm text-gray-600">Bills</div>
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Quick Actions</CardTitle>
            <CardDescription>
              Navigate to different parts of the application
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <Link href="/patients">
                <Button variant="outline" className="w-full">
                  View Patients
                </Button>
              </Link>
              <Link href="/staff">
                <Button variant="outline" className="w-full">
                  View Staff
                </Button>
              </Link>
              <Link href="/billing">
                <Button variant="outline" className="w-full">
                  View Billing
                </Button>
              </Link>
              <Link href="/medications">
                <Button variant="outline" className="w-full">
                  View Medications
                </Button>
              </Link>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
