"use client";

import { useEffect, useMemo, useRef, useState } from 'react';
import { Check, Hospital, ImageUp, LayoutList, Palette, Save } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Textarea } from '@/components/ui/textarea';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { PageBody, PageHeader } from '@/components/page';
import { useT } from '@/components/language-provider';
import { useToast } from '@/hooks/use-toast';
import { MODULES, blockedBy } from '@/config/modules';
import { hospitalProfile as profileRepo } from '@/lib/data';
import { invalidate } from '@/lib/data/cache';
import { useBranding } from '@/components/branding-provider';
import {
  BRAND_COLORS, brandingUrls, contrastWithWhite, initialsFor, monogramSvg,
  type HospitalProfile, type MonogramEmblem, type MonogramShape,
} from '@/lib/branding';
import { brandingFiles, readFileAsDataUrl, svgToDataUrl } from '@/lib/logo-render';
import { cn } from '@/lib/utils';
import { HospitalLinksCard } from '@/components/hospital-links-card';
import { ResponsibilitiesCard } from '@/components/responsibilities-card';
import type { Responsibilities } from '@/config/responsibilities';

const SHAPES: Array<{ value: MonogramShape; label: string }> = [
  { value: 'shield', label: 'Shield' }, { value: 'circle', label: 'Circle' },
  { value: 'rounded', label: 'Square' }, { value: 'hexagon', label: 'Hexagon' },
];
const EMBLEMS: Array<{ value: MonogramEmblem; label: string }> = [
  { value: 'cross', label: 'Medical cross' }, { value: 'heart', label: 'Heart' },
  { value: 'leaf', label: 'Leaf' }, { value: 'none', label: 'None' },
];
const HEX = /^#[0-9a-fA-F]{6}$/;

type Details = Pick<HospitalProfile, 'name' | 'shortName' | 'tagline' | 'address' | 'phone' | 'email' | 'website' | 'registrationNumber' | 'brandColor'>;
type LogoChoice = 'keep' | 'design' | 'upload';

// Super Admin: this hospital's name, logo, colour and contact details.
export default function HospitalProfilePage() {
  const t = useT();
  const { toast } = useToast();
  const { profile: current, setProfile } = useBranding();

  const [details, setDetails] = useState<Details>(() => pickDetails(current));
  const [logoChoice, setLogoChoice] = useState<LogoChoice>(current.logoFolder ? 'keep' : 'design');
  const [initials, setInitials] = useState(() => initialsFor(current.configuredAt ? current.name : ''));
  const [initialsEdited, setInitialsEdited] = useState(false);
  const [shape, setShape] = useState<MonogramShape>('shield');
  const [emblem, setEmblem] = useState<MonogramEmblem>('cross');
  const [upload, setUpload] = useState<string | null>(null);
  const [disabledModules, setDisabledModules] = useState<string[]>(current.disabledModules ?? []);
  const [responsibilities, setResponsibilities] = useState<Responsibilities>(current.responsibilities ?? {});
  const [isSaving, setIsSaving] = useState(false);
  const fileInput = useRef<HTMLInputElement>(null);

  // Load the latest saved profile (the one from the page load may be up to 5 minutes old).
  useEffect(() => {
    profileRepo.get().then(p => {
      setDetails(pickDetails(p));
      setLogoChoice(p.logoFolder ? 'keep' : 'design');
      setDisabledModules(p.disabledModules ?? []);
      setResponsibilities(p.responsibilities ?? {});
      if (!initialsEdited && p.configuredAt) setInitials(initialsFor(p.name));
    }).catch(error => console.error('Could not load the hospital profile', error));
    // eslint-disable-next-line react-hooks/exhaustive-deps -- load once
  }, []);

  const color = HEX.test(details.brandColor) ? details.brandColor : '#2563eb';
  const designed = useMemo(() => monogramSvg(initials || 'H', color, shape, emblem), [initials, color, shape, emblem]);
  const savedUrls = brandingUrls(current);
  const previewSrc = logoChoice === 'upload' ? upload : logoChoice === 'design' ? svgToDataUrl(designed) : savedUrls?.logo ?? svgToDataUrl(designed);
  const contrast = contrastWithWhite(color);

  const set = (patch: Partial<Details>) => {
    setDetails(prev => ({ ...prev, ...patch }));
    if (patch.name !== undefined && !initialsEdited) setInitials(initialsFor(patch.name));
  };

  const handleFile = async (file?: File) => {
    if (!file) return;
    if (!file.type.startsWith('image/')) { toast({ title: 'Not an image', description: 'Choose a PNG, JPG or SVG file.', variant: 'destructive' }); return; }
    if (file.size > 5 * 1024 * 1024) { toast({ title: 'File too large', description: 'Choose an image under 5 MB.', variant: 'destructive' }); return; }
    setUpload(await readFileAsDataUrl(file));
    setLogoChoice('upload');
  };

  const handleSave = async () => {
    if (!details.name.trim()) { toast({ title: 'Name required', description: "Enter the hospital's name.", variant: 'destructive' }); return; }
    if (!HEX.test(details.brandColor)) { toast({ title: 'Check the colour', description: 'Use a colour like #2563eb.', variant: 'destructive' }); return; }
    if (logoChoice === 'upload' && !upload) { toast({ title: 'No logo chosen', description: 'Choose an image to upload, or design a logo.', variant: 'destructive' }); return; }
    setIsSaving(true);
    try {
      const changes: Partial<HospitalProfile> = {
        ...details,
        name: details.name.trim(),
        shortName: details.shortName?.trim() || null,
        tagline: details.tagline?.trim() || null,
        address: details.address?.trim() || null,
        phone: details.phone?.trim() || null,
        email: details.email?.trim() || null,
        website: details.website?.trim() || null,
        registrationNumber: details.registrationNumber?.trim() || null,
        disabledModules: MODULES.map(m => m.key).filter(key => disabledModules.includes(key)),
        responsibilities,
      };
      if (logoChoice !== 'keep') {
        const src = logoChoice === 'upload' ? upload! : svgToDataUrl(designed);
        changes.logoFolder = await profileRepo.uploadBranding(await brandingFiles(src, color));
      }
      const saved = await profileRepo.update(changes);
      setProfile(saved);
      invalidate('branding:');
      setLogoChoice(saved.logoFolder ? 'keep' : 'design');
      setUpload(null);
      // Refresh the server's copy so the page title, icons and colours update for everyone.
      await fetch('/api/hospital-profile', { method: 'POST' }).catch(() => undefined);
      toast({ title: 'Hospital profile saved', description: 'Reload the page to see the new colours and browser icon.' });
    } catch (error) {
      toast({ title: 'Could not save the profile', description: error instanceof Error ? error.message : undefined, variant: 'destructive' });
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <PageBody className="max-w-5xl">
      <PageHeader icon={Hospital} title={t('Hospital Profile')}
        description={t("Your hospital's name, logo and colour, shown on the login page, the header, the browser tab, the phone app icon and printed treatment summaries. Each hospital using Seva has its own separate copy of the app and database, so this only affects your hospital.")} />

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-[1fr_20rem]">
        <div className="space-y-6">
          <Card>
            <CardHeader><CardTitle className="text-lg">{t('Details')}</CardTitle></CardHeader>
            <CardContent className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div className="sm:col-span-2">
                <Label htmlFor="hpName">Hospital name *</Label>
                <Input id="hpName" value={details.name} maxLength={80} onChange={e => set({ name: e.target.value })} placeholder="e.g. Sri Ram Multispeciality Hospital" />
              </div>
              <div>
                <Label htmlFor="hpShort">Short name</Label>
                <Input id="hpShort" value={details.shortName ?? ''} maxLength={24} onChange={e => set({ shortName: e.target.value })} placeholder="e.g. Sri Ram Hospital" />
                <p className="mt-1 text-xs text-muted-foreground">For the header and under the phone app icon (about 12 characters fit there).</p>
              </div>
              <div>
                <Label htmlFor="hpTagline">Tagline</Label>
                <Input id="hpTagline" value={details.tagline ?? ''} maxLength={80} onChange={e => set({ tagline: e.target.value })} placeholder="e.g. Caring for Warangal since 1998" />
              </div>
              <div className="sm:col-span-2">
                <Label htmlFor="hpAddress">Address</Label>
                <Textarea id="hpAddress" rows={2} value={details.address ?? ''} maxLength={200} onChange={e => set({ address: e.target.value })} />
              </div>
              <div>
                <Label htmlFor="hpPhone">Phone</Label>
                <Input id="hpPhone" value={details.phone ?? ''} maxLength={40} onChange={e => set({ phone: e.target.value })} />
              </div>
              <div>
                <Label htmlFor="hpEmail">Email</Label>
                <Input id="hpEmail" type="email" value={details.email ?? ''} maxLength={80} onChange={e => set({ email: e.target.value })} />
              </div>
              <div>
                <Label htmlFor="hpWebsite">Website</Label>
                <Input id="hpWebsite" value={details.website ?? ''} maxLength={80} onChange={e => set({ website: e.target.value })} />
              </div>
              <div>
                <Label htmlFor="hpReg">Registration number</Label>
                <Input id="hpReg" value={details.registrationNumber ?? ''} maxLength={60} onChange={e => set({ registrationNumber: e.target.value })} />
                <p className="mt-1 text-xs text-muted-foreground">Printed on treatment summaries.</p>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-lg"><Palette className="h-5 w-5 text-primary" /> {t('Brand colour')}</CardTitle>
              <CardDescription>Used for buttons, links, the login page and the logo.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="flex flex-wrap gap-2" role="radiogroup" aria-label="Brand colour">
                {BRAND_COLORS.map(c => (
                  <button key={c.hex} type="button" role="radio" aria-checked={details.brandColor.toLowerCase() === c.hex} aria-label={c.name}
                    title={c.name} onClick={() => set({ brandColor: c.hex })}
                    className="flex h-10 w-10 items-center justify-center rounded-full ring-offset-2 ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                    style={{ backgroundColor: c.hex }}>
                    {details.brandColor.toLowerCase() === c.hex && <Check className="h-5 w-5 text-white" />}
                  </button>
                ))}
              </div>
              <div className="flex items-end gap-2">
                <div>
                  <Label htmlFor="hpColor">Or your own colour</Label>
                  <Input id="hpColor" value={details.brandColor} maxLength={7} className="w-32 font-mono" onChange={e => set({ brandColor: e.target.value.trim() })} />
                </div>
                <input type="color" aria-label="Pick a colour" value={color} onChange={e => set({ brandColor: e.target.value })} className="h-10 w-12 cursor-pointer rounded border bg-background p-1" />
              </div>
              {HEX.test(details.brandColor) && contrast < 4.5 && (
                <p className="text-sm text-amber-700 dark:text-amber-400">This colour is light, so white text on it will be hard to read. A darker shade works better.</p>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-lg"><ImageUp className="h-5 w-5 text-primary" /> {t('Logo')}</CardTitle>
              <CardDescription>Design one from your initials, or upload your hospital&apos;s logo (a square PNG with a transparent background works best).</CardDescription>
            </CardHeader>
            <CardContent>
              <Tabs value={logoChoice === 'keep' ? 'keep' : logoChoice} onValueChange={v => setLogoChoice(v as LogoChoice)}>
                <TabsList className="grid h-auto w-full grid-cols-3">
                  <TabsTrigger value="keep" disabled={!current.logoFolder} className="whitespace-normal py-2">{t('Current logo')}</TabsTrigger>
                  <TabsTrigger value="design" className="whitespace-normal py-2">{t('Design a logo')}</TabsTrigger>
                  <TabsTrigger value="upload" className="whitespace-normal py-2">{t('Upload a logo')}</TabsTrigger>
                </TabsList>
                <TabsContent value="keep" className="pt-4 text-sm text-muted-foreground">Your saved logo stays as it is.</TabsContent>
                <TabsContent value="design" className="space-y-4 pt-4">
                  <div className="max-w-[10rem]">
                    <Label htmlFor="hpInitials">Initials</Label>
                    <Input id="hpInitials" value={initials} maxLength={2} className="uppercase"
                      onChange={e => { setInitials(e.target.value.replace(/[^\p{L}\p{N}]/gu, '').toUpperCase()); setInitialsEdited(true); }} />
                  </div>
                  <OptionRow label="Shape" options={SHAPES} value={shape} onChange={setShape}
                    render={o => <span className="h-10 w-10 [&>svg]:h-full [&>svg]:w-full" dangerouslySetInnerHTML={{ __html: monogramSvg(initials || 'H', color, o, emblem) }} />} />
                  <OptionRow label="Emblem" options={EMBLEMS} value={emblem} onChange={setEmblem}
                    render={o => <span className="h-10 w-10 [&>svg]:h-full [&>svg]:w-full" dangerouslySetInnerHTML={{ __html: monogramSvg(initials || 'H', color, shape, o) }} />} />
                </TabsContent>
                <TabsContent value="upload" className="space-y-3 pt-4">
                  <input ref={fileInput} type="file" accept="image/png,image/jpeg,image/webp,image/svg+xml" className="hidden"
                    onChange={e => { handleFile(e.target.files?.[0]); e.target.value = ''; }} />
                  <Button type="button" variant="outline" onClick={() => fileInput.current?.click()}><ImageUp className="mr-2 h-4 w-4" /> {t('Choose image')}</Button>
                  <p className="text-xs text-muted-foreground">PNG, JPG or SVG, up to 5 MB. It is resized and saved as PNG, with app icons made from it.</p>
                </TabsContent>
              </Tabs>
            </CardContent>
          </Card>

          <Card id="menus" className="scroll-mt-20">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-lg"><LayoutList className="h-5 w-5 text-primary" /> {t('Menus and features')}</CardTitle>
              <CardDescription>
                Switch off what your hospital doesn&apos;t use. It disappears for everyone: from the menu, from other screens
                (e.g. Billing off removes bills from the patient page) and its pages show a short notice. Nothing is deleted, and
                you can switch it back on at any time. Patients, Staff and this page are always on.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <ul className="divide-y rounded-md border">
                {MODULES.map(m => {
                  const on = !disabledModules.includes(m.key);
                  const blocked = on ? blockedBy(disabledModules, m.key) : null;
                  return (
                    <li key={m.key} className="flex items-center justify-between gap-4 p-3">
                      <div className="min-w-0">
                        <p className="text-sm font-medium">{t(m.label)}</p>
                        <p className="text-xs text-muted-foreground">{m.description}</p>
                        {blocked && <p className="text-xs text-amber-700 dark:text-amber-400">Off until turned on: {blocked}.</p>}
                      </div>
                      <Switch checked={on} aria-label={`Show ${m.label}`}
                        onCheckedChange={next => setDisabledModules(prev => next ? prev.filter(k => k !== m.key) : [...prev, m.key])} />
                    </li>
                  );
                })}
              </ul>
            </CardContent>
          </Card>

          <ResponsibilitiesCard value={responsibilities} onChange={setResponsibilities} disabledModules={disabledModules} />

          <HospitalLinksCard />
        </div>

        <aside className="space-y-4 lg:sticky lg:top-20 lg:self-start">
          <Card>
            <CardHeader><CardTitle className="text-lg">{t('Preview')}</CardTitle></CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center gap-2 rounded-md border bg-background px-3 py-2">
                {previewSrc && /* eslint-disable-next-line @next/next/no-img-element */ <img src={previewSrc} alt="" className="h-8 w-8 object-contain" />}
                <span className="truncate font-bold">{details.shortName?.trim() || details.name || 'Hospital name'}</span>
              </div>
              <div className="rounded-md p-4 text-white" style={{ backgroundColor: color }}>
                <div className="flex items-center gap-3">
                  <div className="rounded-full bg-white p-1.5">
                    {previewSrc && /* eslint-disable-next-line @next/next/no-img-element */ <img src={previewSrc} alt="" className="h-9 w-9 object-contain" />}
                  </div>
                  <div className="min-w-0">
                    <p className="font-bold leading-tight">{details.name || 'Hospital name'}</p>
                    {details.tagline && <p className="truncate text-xs opacity-80">{details.tagline}</p>}
                  </div>
                </div>
              </div>
              <div className="flex items-end gap-4">
                <div className="flex flex-col items-center gap-1">
                  <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-white shadow">
                    {previewSrc && /* eslint-disable-next-line @next/next/no-img-element */ <img src={previewSrc} alt="" className="h-12 w-12 object-contain" />}
                  </div>
                  <span className="max-w-[5rem] truncate text-xs">{(details.shortName?.trim() || details.name || 'App').slice(0, 12)}</span>
                </div>
                <p className="text-xs text-muted-foreground">Phone home-screen icon</p>
              </div>
            </CardContent>
          </Card>
          <Button className="w-full" size="lg" onClick={handleSave} disabled={isSaving}>
            <Save className="mr-2 h-4 w-4" /> {isSaving ? t('Saving…') : t('Save hospital profile')}
          </Button>
        </aside>
      </div>
    </PageBody>
  );
}

function pickDetails(p: HospitalProfile): Details {
  return {
    name: p.configuredAt ? p.name : '', shortName: p.shortName ?? '', tagline: p.tagline ?? '', address: p.address ?? '',
    phone: p.phone ?? '', email: p.email ?? '', website: p.website ?? '', registrationNumber: p.registrationNumber ?? '',
    brandColor: p.brandColor,
  };
}

function OptionRow<T extends string>({ label, options, value, onChange, render }: {
  label: string;
  options: Array<{ value: T; label: string }>;
  value: T;
  onChange: (value: T) => void;
  render: (value: T) => React.ReactNode;
}) {
  return (
    <div>
      <p className="mb-2 text-sm font-medium">{label}</p>
      <div className="flex flex-wrap gap-2" role="radiogroup" aria-label={label}>
        {options.map(o => (
          <button key={o.value} type="button" role="radio" aria-checked={value === o.value} onClick={() => onChange(o.value)}
            className={cn('flex flex-col items-center gap-1 rounded-md border p-2 text-xs hover:bg-muted/50', value === o.value && 'border-primary ring-1 ring-primary')}>
            {render(o.value)}
            {o.label}
          </button>
        ))}
      </div>
    </div>
  );
}
