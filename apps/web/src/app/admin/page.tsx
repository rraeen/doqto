import { redirect } from 'next/navigation';

// Verification is the only admin tool so far (FE-07); reviews and notifications come later.
export default function AdminHomePage() {
  redirect('/admin/doctors');
}
