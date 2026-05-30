import { Link } from 'react-router-dom';

export default function NotFound() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center text-center">
      <p className="text-6xl font-bold text-brand-600">404</p>
      <p className="mt-2 text-lg text-gray-600">Page not found</p>
      <Link to="/" className="btn-primary mt-6">Go Home</Link>
    </div>
  );
}
