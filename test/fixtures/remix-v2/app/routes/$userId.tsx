import type { LoaderFunctionArgs } from '@remix-run/node';

export async function loader({ params }: LoaderFunctionArgs) {
  return { userId: params.userId };
}

export default function UserProfile() {
  return <div>User Profile</div>;
}
