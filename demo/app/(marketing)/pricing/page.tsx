'use client';

import { useState } from 'react';

export default function PricingPage() {
  const [annual, setAnnual] = useState(false);

  return (
    <main>
      <h1>Pricing</h1>
      <button onClick={() => setAnnual(!annual)}>
        {annual ? 'Monthly' : 'Annual'}
      </button>
    </main>
  );
}
