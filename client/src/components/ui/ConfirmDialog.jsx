import { AlertTriangle } from 'lucide-react';

/**
 * Confirmation popup. Render when `open` is true.
 * Props: open, title, message, confirmLabel, danger, loading, onConfirm, onClose.
 */
export default function ConfirmDialog({
  open,
  title = 'Are you sure?',
  message,
  confirmLabel = 'Confirm',
  danger = false,
  loading = false,
  onConfirm,
  onClose,
}) {
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={onClose}>
      <div className="w-full max-w-sm rounded-xl bg-white p-5 shadow-xl" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-start gap-3">
          <div className={`rounded-full p-2 ${danger ? 'bg-red-50 text-red-600' : 'bg-brand-50 text-brand-600'}`}>
            <AlertTriangle className="h-5 w-5" />
          </div>
          <div className="flex-1">
            <h3 className="font-semibold">{title}</h3>
            {message && <p className="mt-1 text-sm text-gray-600">{message}</p>}
          </div>
        </div>
        <div className="mt-5 flex justify-end gap-2">
          <button onClick={onClose} disabled={loading} className="btn-outline">Cancel</button>
          <button
            onClick={onConfirm}
            disabled={loading}
            className={`btn ${danger ? 'bg-red-600 text-white hover:bg-red-700' : 'btn-primary'}`}
          >
            {loading ? 'Working...' : confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
