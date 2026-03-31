import type { LoaderFunctionArgs, ActionFunctionArgs } from '@remix-run/node';

export async function loader({ request }: LoaderFunctionArgs) {
  return Response.json({ users: [] });
}

export async function action({ request }: ActionFunctionArgs) {
  return Response.json({ created: true });
}
