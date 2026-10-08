import { Suspense } from 'react';
import { PageLoading } from '@/components/page';
import BillPrint from './BillPrint';

export default function Page() {
  return (
    <Suspense fallback={<PageLoading />}>
      <BillPrint />
    </Suspense>
  );
}
