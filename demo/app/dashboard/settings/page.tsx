'use client';

import posthog from 'posthog-js';

export default function SettingsPage() {
  const handleSave = () => {
    posthog.capture('settings_saved');
  };

  return (
    <main>
      <h1>Settings</h1>
      <button onClick={handleSave}>Save</button>
    </main>
  );
}
