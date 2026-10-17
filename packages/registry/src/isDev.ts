/**
 * Whether to emit development diagnostics. Dev is the default when nothing
 * says otherwise.
 *
 * The read is the bare member expression `process.env.NODE_ENV` because that is
 * the only form a bundler's define replaces; a production build then folds this
 * to `false`. A `typeof process` guard or an optional chain would survive the
 * define and read as dev in every browser. Where nothing defined it (published
 * ESM loaded from a CDN, say) `process` is absent, the read throws, and the
 * answer is dev.
 */
export function isDev(): boolean {
  try {
    return process.env.NODE_ENV !== 'production';
  } catch {
    return true;
  }
}
