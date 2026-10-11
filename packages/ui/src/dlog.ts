/**
 * Namespaced, opt-in console tracing. Off by default; production builds
 * may strip the calls entirely depending on the bundler.
 *
 * Enable in the browser:
 *
 *   localStorage.setItem('weasel.debug', '*')               // all namespaces
 *   localStorage.setItem('weasel.debug', 'curve-editor')    // just curve editor
 *   localStorage.setItem('weasel.debug', 'curve-editor,layer-stack')
 *
 * Each component picks a stable namespace and calls `dlog(namespace, ...)`.
 * Useful for tracing pointer/event flows that are hard to capture
 * post-hoc (drag handlers, gesture sequences, selection mutations).
 *
 * The flag is read once and cached for the page session — reload to
 * pick up changes. Cheap hot-path checks (one nullish-coalesce + Set
 * lookup) so leaving calls in place is fine.
 *
 * Known weasel-ui namespaces:
 *   - plot2d        — Plot2D mount / unmount
 *   - curve-editor  — CurveEditor pointer flow
 */
export { dlog, isDebugEnabled } from '@weasel-js/core';
