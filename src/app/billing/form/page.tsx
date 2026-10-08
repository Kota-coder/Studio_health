import { Suspense } from 'react';
import { PageLoading } from '@/components/page';
import BillingForm from './BillingForm';

export default function Page() {
  return (
    <Suspense fallback={<PageLoading />}>
      <BillingForm />
    </Suspense>
  );
}
