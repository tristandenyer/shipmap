import { cookies } from 'next/headers';

export default async function Settings() {
  const cookieStore = cookies();
  return <h1>Settings</h1>;
}
