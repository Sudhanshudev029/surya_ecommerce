import { Router } from 'express';
import multer from 'multer';
import { asyncHandler } from '../../utils/asyncHandler.js';
import { ok } from '../../utils/response.js';
import { ApiError } from '../../utils/ApiError.js';
import { requireAuth } from '../../middleware/auth.js';
import { requireAdmin } from '../../middleware/requireRole.js';
import { cloudinary, cloudinaryEnabled } from '../../config/cloudinary.js';

const router = Router();

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 5 * 1024 * 1024 }, // 5 MB
  fileFilter: (req, file, cb) => {
    if (/^image\//.test(file.mimetype)) cb(null, true);
    else cb(ApiError.badRequest('Only image files are allowed'));
  },
});

// POST /api/upload  (multipart field: "image")
router.post('/', requireAuth, requireAdmin, upload.single('image'), asyncHandler(async (req, res) => {
  if (!req.file) throw ApiError.badRequest('No image provided');
  if (!cloudinaryEnabled) {
    throw new ApiError(503, 'Image upload is not configured (set CLOUDINARY_* env vars)');
  }

  const result = await new Promise((resolve, reject) => {
    const stream = cloudinary.uploader.upload_stream(
      { folder: 'surya-store/products', resource_type: 'image' },
      (err, res2) => (err ? reject(err) : resolve(res2)),
    );
    stream.end(req.file.buffer);
  });

  ok(res, { url: result.secure_url, publicId: result.public_id }, 'Uploaded');
}));

export default router;
