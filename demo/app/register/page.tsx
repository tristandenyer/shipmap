'use client';

import { useSignUp } from '@clerk/nextjs';

export default function RegisterPage() {
  const { signUp } = useSignUp();

  return (
    <main>
      <h1>Create Account</h1>
      <form>
        <input type="email" placeholder="Email" />
        <button type="submit">Sign Up</button>
      </form>
    </main>
  );
}
