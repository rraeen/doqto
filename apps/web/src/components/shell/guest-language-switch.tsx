'use client';

import { useMe } from '@/lib/session';
import { LanguageSwitch } from './language-switch';

/** Language switch for visitors who are not signed in; signed-in users change it in their profile. */
export function GuestLanguageSwitch() {
  const me = useMe();
  if (me.isPending || me.data) return null;
  return <LanguageSwitch compact />;
}
