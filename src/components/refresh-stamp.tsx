"use client";

import { format } from 'date-fns';
import { RefreshCw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

// "Updated 10:42 · Refresh" for pages that show briefly cached data.
export function RefreshStamp({ loadedAt, onRefresh, isRefreshing, className }: {
  loadedAt: Date | null;
  onRefresh: () => void;
  isRefreshing?: boolean;
  className?: string;
}) {
  return (
    <div className={cn('flex items-center gap-1 text-xs text-muted-foreground print:hidden', className)}>
      {loadedAt && <span>Updated {format(loadedAt, 'HH:mm')}</span>}
      <Button variant="ghost" size="sm" className="h-8 px-2" onClick={onRefresh} disabled={isRefreshing} aria-label="Refresh data">
        <RefreshCw className={cn('mr-1 h-3.5 w-3.5', isRefreshing && 'animate-spin')} /> Refresh
      </Button>
    </div>
  );
}
