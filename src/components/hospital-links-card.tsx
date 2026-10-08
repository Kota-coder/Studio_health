"use client";

import { useEffect, useState } from 'react';
import { ArrowLeftRight, ExternalLink, PlusCircle, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useT } from '@/components/language-provider';
import { useToast } from '@/hooks/use-toast';
import { hospitalLinks as hospitalLinksRepo } from '@/lib/data';
import type { HospitalLink } from '@/types/hospitalLink';

// "https://hospital2.example.com/dashboard" -> "https://hospital2.example.com", or null.
function cleanUrl(value: string): string | null {
  const text = value.trim();
  try {
    const url = new URL(/^https?:\/\//i.test(text) ? text : `https://${text}`);
    if (url.protocol !== 'https:' && url.hostname !== 'localhost') return null;
    return url.origin;
  } catch {
    return null;
  }
}

// Super Admin: the addresses of the other hospitals they run, for "Switch hospital" in the
// menu. Each hospital is a separate copy with its own data and logins; these are only links.
export function HospitalLinksCard() {
  const t = useT();
  const { toast } = useToast();
  const [links, setLinks] = useState<HospitalLink[] | null>(null);
  const [name, setName] = useState('');
  const [url, setUrl] = useState('');
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    hospitalLinksRepo.list().then(setLinks).catch(() => setLinks([]));
  }, []);

  const add = async () => {
    const address = cleanUrl(url);
    if (!name.trim()) { toast({ title: 'Enter the hospital name', variant: 'destructive' }); return; }
    if (!address) { toast({ title: 'Check the address', description: 'Use the web address of the other hospital, e.g. https://hospital2.example.com', variant: 'destructive' }); return; }
    if (address === window.location.origin) { toast({ title: 'That is this hospital', description: 'Add the address of another hospital.', variant: 'destructive' }); return; }
    setBusy(true);
    try {
      const sortOrder = Math.max(0, ...(links ?? []).map(l => l.sortOrder)) + 10;
      await hospitalLinksRepo.create({ name: name.trim(), url: address, sortOrder });
      setLinks(await hospitalLinksRepo.list());
      setName(''); setUrl('');
      toast({ title: 'Hospital added', description: 'It is now under "Switch hospital" in the menu.' });
    } catch (error) {
      toast({ title: 'Could not add the hospital', description: error instanceof Error ? error.message : undefined, variant: 'destructive' });
    } finally {
      setBusy(false);
    }
  };

  const remove = async (link: HospitalLink) => {
    if (!confirm(`Remove ${link.name} from "Switch hospital"? Its data is not affected.`)) return;
    try {
      await hospitalLinksRepo.remove(link.id);
      setLinks(await hospitalLinksRepo.list());
    } catch (error) {
      toast({ title: 'Could not remove it', description: error instanceof Error ? error.message : undefined, variant: 'destructive' });
    }
  };

  return (
    <Card id="hospitals" className="scroll-mt-20">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-lg"><ArrowLeftRight className="h-5 w-5 text-primary" /> {t('Other hospitals')}</CardTitle>
        <CardDescription>
          If you run more than one hospital on Seva, add the others here. They appear under &quot;Switch hospital&quot; in your
          menu (only you, the Super Admin, see them). Each hospital keeps its own patients, staff and logins; the first time
          you switch, sign in there with that hospital&apos;s login.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {links === null ? (
          <p className="text-sm text-muted-foreground">Loading…</p>
        ) : links.length > 0 && (
          <ul className="divide-y rounded-md border">
            {links.map(link => (
              <li key={link.id} className="flex items-center justify-between gap-3 p-3">
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium">{link.name}</p>
                  <a href={link.url} target="_blank" rel="noopener noreferrer" className="flex items-center gap-1 truncate text-xs text-primary underline">
                    {link.url} <ExternalLink className="h-3 w-3 shrink-0" />
                  </a>
                </div>
                <Button variant="ghost" size="icon" aria-label={`Remove ${link.name}`} onClick={() => remove(link)}><Trash2 className="h-4 w-4" /></Button>
              </li>
            ))}
          </ul>
        )}
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-[1fr_1fr_auto] sm:items-end">
          <div>
            <Label htmlFor="linkName">Hospital name</Label>
            <Input id="linkName" value={name} maxLength={80} onChange={e => setName(e.target.value)} placeholder="e.g. Sri Ram Hospital, Warangal" />
          </div>
          <div>
            <Label htmlFor="linkUrl">Web address</Label>
            <Input id="linkUrl" value={url} maxLength={300} inputMode="url" onChange={e => setUrl(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter') add(); }} placeholder="https://hospital2.example.com" />
          </div>
          <Button onClick={add} disabled={busy}><PlusCircle className="mr-2 h-4 w-4" /> {t('Add')}</Button>
        </div>
      </CardContent>
    </Card>
  );
}
