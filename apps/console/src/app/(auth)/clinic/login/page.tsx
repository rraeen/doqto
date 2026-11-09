import { redirect } from 'next/navigation';
import { loginPath } from '@/lib/app-config';

// Older links pointed here; there is one sign-in for every workspace type now.
export default function LegacyLogin() {
  return redirect(loginPath);
}
