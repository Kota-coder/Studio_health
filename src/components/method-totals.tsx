// "Cash ₹1,200 · UPI ₹3,400" for the records currently listed.
export function MethodTotals({ label, rows }: { label: string; rows: Array<{ method?: string | null; amount: number }> }) {
  const totals = new Map<string, number>();
  for (const { method, amount } of rows) {
    const key = method?.trim() || 'Not recorded';
    totals.set(key, (totals.get(key) ?? 0) + amount);
  }
  if (totals.size === 0) return null;
  const money = (n: number) => `₹${n.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  return (
    <div className="flex w-full flex-wrap items-center gap-x-2 gap-y-1 text-sm">
      <span className="text-muted-foreground">{label}:</span>
      {[...totals.entries()].sort((a, b) => b[1] - a[1]).map(([method, amount]) => (
        <span key={method} className="rounded-md border bg-muted/40 px-2 py-0.5 tabular-nums">
          {method} <span className="font-medium">{money(amount)}</span>
        </span>
      ))}
    </div>
  );
}
