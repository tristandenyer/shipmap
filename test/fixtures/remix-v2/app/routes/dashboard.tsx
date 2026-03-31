import { Outlet } from '@remix-run/react';
import type { LoaderFunctionArgs } from '@remix-run/node';

export async function loader({ request }: LoaderFunctionArgs) {
  return { user: 'test' };
}

export default function Dashboard() {
  return <div><Outlet /></div>;
}
