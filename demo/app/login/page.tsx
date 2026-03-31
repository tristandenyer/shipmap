'use client';

import { useSignIn } from '@clerk/nextjs';

export default function LoginPage() {
  const { signIn } = useSignIn();

  return (
    <main>
      <h1>Sign In</h1>
      <form>
        <input type="email" placeholder="Email" />
        <button type="submit">Continue</button>
      </form>
    </main>
  );
}
