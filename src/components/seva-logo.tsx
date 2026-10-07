import { cn } from '@/lib/utils';

// Seva logo: a sprout growing from a heart, for care and recovery.
export function SevaLogo({ className }: { className?: string }) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64" className={cn('h-6 w-6 shrink-0', className)} aria-hidden="true">
      <path d="M32 61 C18 52 6 43.5 6 33 C6 26 11 21.5 17.5 21.5 C24 21.5 29 25.5 32 31 C35 25.5 40 21.5 46.5 21.5 C53 21.5 58 26 58 33 C58 43.5 46 52 32 61 Z" fill="#e11d48" />
      <path d="M13 32 C13 28.5 15.5 26.5 18.5 26.5" fill="none" stroke="#fecdd3" strokeWidth="2.6" strokeLinecap="round" />
      <path d="M32 30 C32 25 32 20 32 14" fill="none" stroke="#15803d" strokeWidth="3.2" strokeLinecap="round" />
      <path d="M32 24 C26.5 25 18 22.5 15 13 C24.5 11 31 15.5 32 24 Z" fill="#22c55e" />
      <path d="M32 18 C34 9.5 40.5 3 51 4 C50.5 14 42 20 32 18 Z" fill="#16a34a" />
    </svg>
  );
}
