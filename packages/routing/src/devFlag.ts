/**
 * Whether to emit development diagnostics. Dev is the default when nothing
 * says otherwise.
 *
 * `process` is absent in a browser loading the published ESM directly: a
 * `<script type="module">` from a CDN, or a bundler run with no `--define` for
 * it. A bare `process.env.NODE_ENV` read there is a ReferenceError, not a
 * falsy value, and it escapes through whatever called it.
 */
export function isDev(): boolean {
  return typeof process !== 'undefined'
    ? process.env?.NODE_ENV !== 'production'
    : true;
}
