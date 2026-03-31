import type { LoaderFunctionArgs, ActionFunctionArgs } from '@remix-run/node';

export async function loader({ request }: LoaderFunctionArgs) {
  return { settings: {} };
}

export async function action({ request }: ActionFunctionArgs) {
  return { ok: true };
}

export default function Settings() {
  return <div>Settings</div>;
}
