import { cookies } from 'next/headers';
import * as Sentry from '@sentry/nextjs';

export default async function DashboardPage() {
  const cookieStore = cookies();

  Sentry.addBreadcrumb({ category: 'navigation', message: 'Dashboard loaded' });

  return (
    <main>
      <h1>Dashboard</h1>
      <p>Server-rendered with cookie access.</p>
    </main>
  );
}
