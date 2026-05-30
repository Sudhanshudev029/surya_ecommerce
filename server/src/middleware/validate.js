import { ApiError } from '../utils/ApiError.js';

/**
 * Validate req against a Zod schema shaped { body?, params?, query? }.
 * Replaces req parts with parsed/coerced values.
 */
export const validate = (schema) => (req, res, next) => {
  const result = schema.safeParse({
    body: req.body,
    params: req.params,
    query: req.query,
  });
  if (!result.success) {
    const details = result.error.flatten().fieldErrors;
    return next(new ApiError(422, 'Validation failed', details));
  }
  if (result.data.body) req.body = result.data.body;
  if (result.data.params) req.params = result.data.params;
  if (result.data.query) req.validatedQuery = result.data.query;
  next();
};
