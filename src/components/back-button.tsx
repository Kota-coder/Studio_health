
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { ArrowLeft } from 'lucide-react';

interface BackButtonProps {
  href?: string;
  label?: string;
  variant?: 'default' | 'outline' | 'ghost';
}

export function BackButton({ href, label = 'Back', variant = 'outline' }: BackButtonProps) {
  const router = useRouter();

  const handleClick = () => {
    if (href) {
      router.push(href);
    } else {
      router.back();
    }
  };

  return (
    <Button variant={variant} onClick={handleClick}>
      <ArrowLeft className="mr-2 h-4 w-4" />
      {label}
    </Button>
  );
}
