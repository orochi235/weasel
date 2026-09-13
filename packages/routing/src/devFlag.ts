/**
 * Whether to emit development diagnostics.
 *
 * Read through a function rather than a module-level constant so a test can
 * observe a runtime with no `process` — and so the read cannot be evaluated at
 * import time in an environment where it would throw.
 *
 * `process` is absent in a browser loading the published ESM directly: a
 * `<script type="module">` from a CDN, or a bundler run with no `--define` for
 * it. A bare `process.env.NODE_ENV` read there is a ReferenceError, not a
 * falsy value, and it escapes through whatever called it — in the dispatcher's
 * case out of the pointerdown listener, losing the press and every subsequent
 * hover. Dev is the default when nothing says otherwise, matching the guarded
 * form the rest of the kit already uses.
 */
export function isDev(): boolean {
  return typeof process !== 'undefined'
    ? process.env?.NODE_ENV !== 'production'
    : true;
}
