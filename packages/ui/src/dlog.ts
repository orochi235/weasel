/**
 * Namespaced, opt-in console tracing. Off by default.
 *
 * Enable in the browser:
 *
 *   localStorage.setItem('weasel.debug', '*')               // all namespaces
 *   localStorage.setItem('weasel.debug', 'curve-editor,layer-stack')
 *
 * The flag is read once and cached for the page session — reload to
 * pick up changes.
 *
 * @packageDocumentation
 */
export { dlog, isDebugEnabled } from '@weasel-js/core';
