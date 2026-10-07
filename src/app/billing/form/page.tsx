
import { Suspense } from 'react';
import BillingForm from './BillingForm'; // This will be your client component

export default function Page() {
  return (
    <Suspense fallback={<div className="flex justify-center items-center min-h-screen"><p>Loading form details...</p></div>}>
      <BillingForm />
    </Suspense>
  );
}
