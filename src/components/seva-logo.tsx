import { cn } from '@/lib/utils';

// Seva logo: a sprout growing from a bowl, for nourishment and recovery.
export function SevaLogo({ className }: { className?: string }) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64" className={cn('h-6 w-6 shrink-0', className)} aria-hidden="true">
      <path d="M32 40 C32 32 32 26 32 20" fill="none" stroke="#15803d" strokeWidth="3.2" strokeLinecap="round" />
      <path d="M32 30 C26 31 17 28 14 18 C24 16 31 21 32 30 Z" fill="#22c55e" />
      <path d="M32 24 C34 15 41 8 52 9 C51 20 42 26 32 24 Z" fill="#16a34a" />
      <path d="M8 38 H56 C56 50 45 58 32 58 C19 58 8 50 8 38 Z" fill="#f59e0b" />
      <path d="M8 38 H56" stroke="#d97706" strokeWidth="3" strokeLinecap="round" />
      <path d="M17 44 C20 50 25 52 30 52" fill="none" stroke="#fde68a" strokeWidth="2.4" strokeLinecap="round" opacity="0.9" />
    </svg>
  );
}
