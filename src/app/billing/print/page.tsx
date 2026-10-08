import { Suspense } from 'react';
import BillPrint from './BillPrint';

export default function Page() {
  return (
    <Suspense fallback={<div className="flex justify-center items-center min-h-screen"><p>Loading bill...</p></div>}>
      <BillPrint />
    </Suspense>
  );
}
