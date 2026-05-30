export const slugify = (text) =>
  String(text)
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9\s-]/g, '')
    .replace(/[\s_-]+/g, '-')
    .replace(/^-+|-+$/g, '');

/** Append a short suffix to keep slugs unique. */
export const uniqueSlug = (text, suffix) => `${slugify(text)}-${suffix}`;
