"use client";

import { useState } from 'react';
import { KeyRound, Save, UserCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { PageBody, PageHeader } from '@/components/page';
import { LanguageToggle } from '@/components/language-toggle';
import { useT } from '@/components/language-provider';
import { useAuth, useStaff } from '@/context/AuthContext';
import { useToast } from '@/hooks/use-toast';
import { addAuditEntry } from '@/lib/data';
import { invalidate } from '@/lib/data/cache';
import { getSupabase } from '@/lib/supabase/client';

const MIN_PASSWORD_LENGTH = 8;

// Open to every signed-in person (it is not in the menu's page list): their own name, phone
// number, language and password. Email, role, hire date and pay are shown but changed only by
// the people who manage staff. The database lets people change only their own record
// (update_my_profile()).
export default function ProfilePage() {
  const t = useT();
  const { toast } = useToast();
  const user = useStaff();
  const { reloadUser } = useAuth();
  const [name, setName] = useState(user.name);
  const [phone, setPhone] = useState(user.phoneNumber ?? '');
  const [isSaving, setIsSaving] = useState(false);
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [isChanging, setIsChanging] = useState(false);

  const changed = name.trim() !== user.name || phone.trim() !== (user.phoneNumber ?? '');

  const saveDetails = async (e: React.FormEvent) => {
    e.preventDefault();
    if (name.trim().length < 2) { toast({ title: t('Enter your name'), variant: 'destructive' }); return; }
    if (phone && !/^[0-9+()\- ]{6,20}$/.test(phone.trim())) { toast({ title: t('Enter a valid phone number'), variant: 'destructive' }); return; }
    setIsSaving(true);
    try {
      const { error } = await getSupabase().rpc('update_my_profile', { new_name: name.trim(), new_phone: phone.trim() });
      if (error) throw new Error(error.message);
      await addAuditEntry('staff', user.id, 'Profile Updated', 'Updated own name and phone number.').catch(() => undefined);
      invalidate('staff:');
      await reloadUser();
      toast({ title: t('Profile saved') });
    } catch (error) {
      toast({ title: t('Could not save your profile'), description: error instanceof Error ? error.message : undefined, variant: 'destructive' });
    } finally {
      setIsSaving(false);
    }
  };

  const changePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (password.length < MIN_PASSWORD_LENGTH) { toast({ title: t('Password too short'), description: t('Use at least {n} characters.', { n: MIN_PASSWORD_LENGTH }), variant: 'destructive' }); return; }
    if (password !== confirm) { toast({ title: t("Passwords don't match"), variant: 'destructive' }); return; }
    setIsChanging(true);
    const { error } = await getSupabase().auth.updateUser({ password });
    setIsChanging(false);
    if (error) { toast({ title: t('Could not change the password'), description: error.message, variant: 'destructive' }); return; }
    setPassword(''); setConfirm('');
    toast({ title: t('Password changed'), description: t('Use the new password next time you log in.') });
  };

  return (
    <PageBody width="narrow">
      <PageHeader icon={UserCircle} title={t('My Profile')} description={t('Your own details. Your email, role and pay are changed by your administrator.')} />

      <Card>
        <form onSubmit={saveDetails}>
          <CardHeader><CardTitle className="text-lg">{t('My details')}</CardTitle></CardHeader>
          <CardContent className="grid gap-4">
            <div>
              <Label htmlFor="profileName">{t('Full name')} *</Label>
              <Input id="profileName" value={name} onChange={e => setName(e.target.value)} maxLength={100} autoComplete="name" />
            </div>
            <div>
              <Label htmlFor="profilePhone">{t('Phone number')}</Label>
              <Input id="profilePhone" type="tel" inputMode="tel" value={phone} onChange={e => setPhone(e.target.value)} maxLength={20} autoComplete="tel" placeholder="e.g., 9876543210" />
            </div>
            <dl className="grid gap-3 rounded-md border bg-muted/30 p-3 text-sm sm:grid-cols-3">
              <div className="min-w-0"><dt className="text-xs text-muted-foreground">{t('Email (your login)')}</dt><dd className="break-words font-medium">{user.email}</dd></div>
              <div><dt className="text-xs text-muted-foreground">{t('Role')}</dt><dd className="font-medium">{t(user.role)}</dd></div>
              <div><dt className="text-xs text-muted-foreground">{t('Joined')}</dt><dd className="font-medium">{user.hireDate || '—'}</dd></div>
            </dl>
            <div className="flex flex-wrap items-center justify-between gap-2">
              <Label>{t('Language')}</Label>
              <LanguageToggle />
            </div>
          </CardContent>
          <CardFooter className="justify-end">
            <Button type="submit" disabled={isSaving || !changed}><Save className="mr-2 h-4 w-4" /> {isSaving ? t('Saving…') : t('Save')}</Button>
          </CardFooter>
        </form>
      </Card>

      <Card>
        <form onSubmit={changePassword}>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-lg"><KeyRound className="h-5 w-5 text-primary" /> {t('Change password')}</CardTitle>
            <CardDescription>{t('Choose a new password of at least {n} characters.', { n: MIN_PASSWORD_LENGTH })}</CardDescription>
          </CardHeader>
          <CardContent className="grid gap-4">
            <div>
              <Label htmlFor="newPassword">{t('New password')}</Label>
              <Input id="newPassword" type="password" value={password} onChange={e => setPassword(e.target.value)} autoComplete="new-password" />
            </div>
            <div>
              <Label htmlFor="confirmPassword">{t('Confirm new password')}</Label>
              <Input id="confirmPassword" type="password" value={confirm} onChange={e => setConfirm(e.target.value)} autoComplete="new-password" />
            </div>
          </CardContent>
          <CardFooter className="justify-end">
            <Button type="submit" variant="outline" disabled={isChanging || !password}>{isChanging ? t('Saving…') : t('Change password')}</Button>
          </CardFooter>
        </form>
      </Card>
    </PageBody>
  );
}
