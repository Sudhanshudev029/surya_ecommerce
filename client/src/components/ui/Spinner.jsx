export default function Spinner({ className = 'h-6 w-6' }) {
  return (
    <div
      className={`${className} animate-spin rounded-full border-2 border-gray-300 border-t-brand-600`}
      role="status"
      aria-label="Loading"
    />
  );
}
