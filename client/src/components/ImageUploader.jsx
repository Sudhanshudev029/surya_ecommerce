import { useRef, useState } from 'react';
import { Upload, X, Loader2 } from 'lucide-react';
import toast from 'react-hot-toast';
import { uploadApi } from '../api/endpoints.js';
import { showApiError } from '../api/axios.js';

/**
 * Single-image uploader. Uploads the chosen file to the backend (Cloudinary)
 * and reports the resulting URL via onChange. `value` is the current image URL.
 */
export default function ImageUploader({ value, onChange, label = 'Product image' }) {
  const inputRef = useRef(null);
  const [uploading, setUploading] = useState(false);

  const pick = () => inputRef.current?.click();

  const handleFile = async (file) => {
    if (!file) return;
    if (!file.type.startsWith('image/')) { toast.error('Please choose an image file'); return; }
    if (file.size > 5 * 1024 * 1024) { toast.error('Image must be under 5 MB'); return; }
    setUploading(true);
    try {
      const { data } = await uploadApi.image(file);
      onChange(data.data.url);
      toast.success('Image uploaded');
    } catch (e) {
      showApiError(e);
    } finally {
      setUploading(false);
      if (inputRef.current) inputRef.current.value = ''; // allow re-picking the same file
    }
  };

  return (
    <div>
      <label className="label">{label}</label>
      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={(e) => handleFile(e.target.files?.[0])}
      />

      {value ? (
        <div className="relative w-40">
          <img src={value} alt="preview" className="aspect-square w-40 rounded-lg border border-gray-200 object-cover" />
          {uploading && (
            <div className="absolute inset-0 flex items-center justify-center rounded-lg bg-white/70">
              <Loader2 className="h-6 w-6 animate-spin text-brand-600" />
            </div>
          )}
          <button
            type="button"
            onClick={() => onChange('')}
            className="absolute -right-2 -top-2 rounded-full border border-gray-200 bg-white p-1 text-gray-500 shadow hover:text-red-600"
            aria-label="Remove image"
          >
            <X className="h-4 w-4" />
          </button>
          <button type="button" onClick={pick} className="mt-2 text-sm font-medium text-brand-700 hover:underline">
            Replace image
          </button>
        </div>
      ) : (
        <button
          type="button"
          onClick={pick}
          disabled={uploading}
          className="flex aspect-square w-40 flex-col items-center justify-center gap-2 rounded-lg border-2 border-dashed border-gray-300 text-gray-400 transition hover:border-brand-400 hover:text-brand-600"
        >
          {uploading ? <Loader2 className="h-6 w-6 animate-spin" /> : <Upload className="h-6 w-6" />}
          <span className="text-xs">{uploading ? 'Uploading…' : 'Click to upload'}</span>
        </button>
      )}
      <p className="mt-1 text-xs text-gray-400">JPG/PNG, up to 5 MB.</p>
    </div>
  );
}
