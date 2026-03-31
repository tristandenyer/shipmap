import { cookies } from 'next/headers';

export default async function DashboardPage() {
  const cookieStore = cookies();

  return (
    <main>
      <h1>Dashboard</h1>
      <p>Server-rendered with cookie access.</p>
    </main>
  );
}
