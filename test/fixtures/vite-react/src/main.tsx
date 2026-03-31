import { createBrowserRouter, RouterProvider } from 'react-router-dom';
import Dashboard from './routes/Dashboard';
import Settings from './routes/Settings';

const router = createBrowserRouter([
  { path: '/', element: <div>Home</div> },
  { path: '/dashboard', element: <Dashboard /> },
  { path: '/dashboard/settings', element: <Settings /> },
  { path: '/users/:id', element: <div>User</div> },
  { path: '/about', element: <div>About</div> },
]);

export default function App() {
  return <RouterProvider router={router} />;
}
