import type { MetaFunction, LoaderFunctionArgs } from '@remix-run/node';

export const meta: MetaFunction = () => [{ title: 'Home' }];

export async function loader({ request }: LoaderFunctionArgs) {
  return { message: 'hello' };
}

export default function Index() {
  return <div>Home</div>;
}
