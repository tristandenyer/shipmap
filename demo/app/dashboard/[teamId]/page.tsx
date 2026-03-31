export const dynamic = 'force-dynamic';

import { headers } from 'next/headers';

export default async function TeamPage({ params }: { params: { teamId: string } }) {
  const headersList = headers();

  return (
    <main>
      <h1>Team: {params.teamId}</h1>
    </main>
  );
}
