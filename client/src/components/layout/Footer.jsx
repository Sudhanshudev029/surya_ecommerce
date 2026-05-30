export default function Footer() {
  return (
    <footer className="mt-12 border-t border-gray-200 bg-white">
      <div className="mx-auto max-w-7xl px-4 py-8 text-sm text-gray-500">
        <div className="flex flex-col items-center justify-between gap-3 sm:flex-row">
          <p className="font-semibold text-brand-700">🛒 Surya Store</p>
          <p>Daily essentials delivered. Cash on Delivery available.</p>
          <p>© {new Date().getFullYear()} Surya Store</p>
        </div>
      </div>
    </footer>
  );
}
