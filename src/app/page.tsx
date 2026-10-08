import { redirect } from 'next/navigation';

// The app opens on the Patient Dashboard (signed-out visitors go to /login first).
export default function Home() {
  redirect('/dashboard');
}
