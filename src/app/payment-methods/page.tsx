"use client";

import { useCallback, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { ArrowDown, ArrowLeft, ArrowUp, PlusCircle, Save, Wallet } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { useAuth } from '@/context/AuthContext';
import { useToast } from '@/hooks/use-toast';
import { PAGE_ROLES } from '@/config/permissions';
import { paymentMethods as paymentMethodsRepo } from '@/lib/data';
import type { PaymentMethodOption, PaymentMethodUse } from '@/types/paymentMethod';
import type { StaffRole } from '@/types/staff';

const ALLOWED_ROLES: StaffRole[] = PAGE_ROLES.paymentMethods;
const USES: Array<{ value: PaymentMethodUse; label: string }> = [
  { value: 'Both', label: 'Bills and payments' },
  { value: 'Bills', label: 'Bills (money received)' },
  { value: 'Payments', label: 'Payments (money paid out)' },
];

type Draft = Pick<PaymentMethodOption, 'name' | 'usedFor' | 'active'>;

// Super Admin: the payment methods offered on bills and payments (Cash, UPI, ...).
export default function PaymentMethodsPage() {
  const router = useRouter();
  const { toast } = useToast();
  const { currentUser, isLoading: authIsLoading } = useAuth();
  const [methods, setMethods] = useState<PaymentMethodOption[]>([]);
  const [drafts, setDrafts] = useState<Record<number, Draft>>({});
  const [newMethod, setNewMethod] = useState<Draft>({ name: '', usedFor: 'Both', active: true });
  const [isLoading, setIsLoading] = useState(true);
  const [savingId, setSavingId] = useState<number | 'new' | null>(null);

  const allowed = !!currentUser && ALLOWED_ROLES.includes(currentUser.role);

  useEffect(() => {
    if (!authIsLoading && !currentUser) router.replace('/login');
    else if (!authIsLoading && currentUser && !allowed) router.replace('/dashboard');
  }, [authIsLoading, currentUser, allowed, router]);

  const load = useCallback(async () => {
    try {
      const list = await paymentMethodsRepo.list();
      setMethods(list);
      setDrafts(Object.fromEntries(list.map(m => [m.id, { name: m.name, usedFor: m.usedFor, active: m.active }])));
    } catch (error) {
      toast({ title: 'Error', description: error instanceof Error ? error.message : 'Could not load payment methods.', variant: 'destructive' });
    } finally {
      setIsLoading(false);
    }
  }, [toast]);

  useEffect(() => { if (allowed) load(); }, [allowed, load]);

  const nameProblem = (name: string, id?: number) => {
    const trimmed = name.trim();
    if (!trimmed) return 'Enter a name.';
    if (methods.some(m => m.id !== id && m.name.toLowerCase() === trimmed.toLowerCase())) return 'A method with this name already exists.';
    return null;
  };

  const saveMethod = async (method: PaymentMethodOption) => {
    const draft = drafts[method.id];
    const problem = nameProblem(draft.name, method.id);
    if (problem) { toast({ title: 'Check the name', description: problem, variant: 'destructive' }); return; }
    if (draft.name.trim() !== method.name
        && !confirm(`Rename "${method.name}" to "${draft.name.trim()}"? Bills and payments recorded with "${method.name}" will show the new name.`)) return;
    setSavingId(method.id);
    try {
      await paymentMethodsRepo.update(method.id, { name: draft.name.trim(), usedFor: draft.usedFor, active: draft.active });
      toast({ title: 'Saved', description: `${draft.name.trim()} updated.` });
      await load();
    } catch (error) {
      toast({ title: 'Save Error', description: error instanceof Error ? error.message : 'Could not save.', variant: 'destructive' });
    } finally {
      setSavingId(null);
    }
  };

  const addMethod = async () => {
    const problem = nameProblem(newMethod.name);
    if (problem) { toast({ title: 'Check the name', description: problem, variant: 'destructive' }); return; }
    setSavingId('new');
    try {
      const sortOrder = Math.max(0, ...methods.map(m => m.sortOrder)) + 10;
      await paymentMethodsRepo.create({ ...newMethod, name: newMethod.name.trim(), sortOrder });
      toast({ title: 'Added', description: `${newMethod.name.trim()} is now offered.` });
      setNewMethod({ name: '', usedFor: 'Both', active: true });
      await load();
    } catch (error) {
      toast({ title: 'Save Error', description: error instanceof Error ? error.message : 'Could not add the method.', variant: 'destructive' });
    } finally {
      setSavingId(null);
    }
  };

  // Swap display order with the neighbour above or below.
  const move = async (index: number, direction: -1 | 1) => {
    const a = methods[index];
    const b = methods[index + direction];
    if (!a || !b) return;
    setSavingId(a.id);
    try {
      const [first, second] = a.sortOrder === b.sortOrder ? [b.sortOrder + direction, a.sortOrder] : [b.sortOrder, a.sortOrder];
      await paymentMethodsRepo.update(a.id, { sortOrder: first });
      await paymentMethodsRepo.update(b.id, { sortOrder: second });
      await load();
    } catch (error) {
      toast({ title: 'Error', description: error instanceof Error ? error.message : 'Could not reorder.', variant: 'destructive' });
    } finally {
      setSavingId(null);
    }
  };

  if (authIsLoading || (allowed && isLoading)) {
    return <div className="flex justify-center items-center min-h-screen"><p>Loading payment methods...</p></div>;
  }
  if (!allowed) {
    return <div className="flex justify-center items-center min-h-screen"><p>Access Denied. Redirecting...</p></div>;
  }

  const changed = (m: PaymentMethodOption) => {
    const d = drafts[m.id];
    return !!d && (d.name.trim() !== m.name || d.usedFor !== m.usedFor || d.active !== m.active);
  };

  return (
    <div className="container mx-auto max-w-4xl p-4 sm:p-6 lg:p-8 space-y-6">
      <header className="flex flex-col sm:flex-row justify-between items-center gap-4">
        <div className="flex items-center gap-3">
          <Wallet className="h-8 w-8 text-primary" />
          <h1 className="text-2xl sm:text-3xl font-bold text-foreground">Payment Methods</h1>
        </div>
        <Button variant="outline" onClick={() => router.push('/dashboard')}><ArrowLeft className="mr-2 h-4 w-4" /> Dashboard</Button>
      </header>

      <p className="text-sm text-muted-foreground">
        The choices offered under &quot;Payment Method&quot; on bills (money received) and payments (money paid out), in this
        order. Switch a method off to stop offering it; records that already use it keep it. Renaming a method renames it on
        those records too.
      </p>

      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Add a method</CardTitle>
          <CardDescription>For example a bank&apos;s UPI handle, a card machine, or an insurer.</CardDescription>
        </CardHeader>
        <CardContent className="grid grid-cols-1 gap-3 sm:grid-cols-[1fr_14rem_auto] sm:items-end">
          <div>
            <Label htmlFor="newMethodName">Name</Label>
            <Input id="newMethodName" value={newMethod.name} placeholder="e.g. PhonePe" maxLength={40}
              onChange={e => setNewMethod({ ...newMethod, name: e.target.value })}
              onKeyDown={e => { if (e.key === 'Enter') addMethod(); }} />
          </div>
          <div>
            <Label htmlFor="newMethodUse">Used for</Label>
            <Select value={newMethod.usedFor} onValueChange={v => setNewMethod({ ...newMethod, usedFor: v as PaymentMethodUse })}>
              <SelectTrigger id="newMethodUse"><SelectValue /></SelectTrigger>
              <SelectContent>{USES.map(u => <SelectItem key={u.value} value={u.value}>{u.label}</SelectItem>)}</SelectContent>
            </Select>
          </div>
          <Button onClick={addMethod} disabled={savingId === 'new'}><PlusCircle className="mr-2 h-4 w-4" /> Add</Button>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Methods</CardTitle>
        </CardHeader>
        <CardContent>
          <ul className="divide-y rounded-md border">
            {methods.map((method, index) => {
              const draft = drafts[method.id] ?? method;
              const setDraft = (patch: Partial<Draft>) => setDrafts(prev => ({ ...prev, [method.id]: { ...draft, ...patch } }));
              return (
                <li key={method.id} className="grid grid-cols-1 gap-3 p-3 sm:grid-cols-[auto_1fr_14rem_auto_auto] sm:items-center">
                  <div className="flex gap-1">
                    <Button variant="ghost" size="icon" className="h-8 w-8" aria-label={`Move ${method.name} up`} disabled={index === 0 || savingId !== null} onClick={() => move(index, -1)}><ArrowUp className="h-4 w-4" /></Button>
                    <Button variant="ghost" size="icon" className="h-8 w-8" aria-label={`Move ${method.name} down`} disabled={index === methods.length - 1 || savingId !== null} onClick={() => move(index, 1)}><ArrowDown className="h-4 w-4" /></Button>
                  </div>
                  <div className="flex items-center gap-2">
                    <Input aria-label="Name" value={draft.name} maxLength={40} onChange={e => setDraft({ name: e.target.value })} />
                    {!method.active && <Badge variant="secondary" className="shrink-0">Off</Badge>}
                  </div>
                  <Select value={draft.usedFor} onValueChange={v => setDraft({ usedFor: v as PaymentMethodUse })}>
                    <SelectTrigger aria-label={`${method.name} used for`}><SelectValue /></SelectTrigger>
                    <SelectContent>{USES.map(u => <SelectItem key={u.value} value={u.value}>{u.label}</SelectItem>)}</SelectContent>
                  </Select>
                  <label className="flex items-center gap-2 text-sm">
                    <Switch checked={draft.active} onCheckedChange={active => setDraft({ active })} aria-label={`Offer ${method.name}`} />
                    Offered
                  </label>
                  <Button size="sm" onClick={() => saveMethod(method)} disabled={!changed(method) || savingId !== null}>
                    <Save className="mr-1 h-4 w-4" /> Save
                  </Button>
                </li>
              );
            })}
          </ul>
        </CardContent>
      </Card>
    </div>
  );
}
