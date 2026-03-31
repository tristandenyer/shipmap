'use client';

import posthog from 'posthog-js';
import { UploadButton } from '@uploadthing/react';

export default function SettingsPage() {
  const handleSave = () => {
    posthog.capture('settings_saved');
  };

  return (
    <main>
      <h1>Settings</h1>
      <UploadButton endpoint="avatar" />
      <button onClick={handleSave}>Save</button>
    </main>
  );
}
