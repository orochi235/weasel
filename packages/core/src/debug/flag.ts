/**
 * Namespaced, opt-in console tracing for the kit.
 *
 * Enable in the browser:
 *
 *   localStorage.setItem('weasel.debug', '*')                 // all namespaces
 *   localStorage.setItem('weasel.debug', 'tools,dispatch')    // specific ones
 *   localStorage.setItem('weasel.debug', '1')                 // legacy "all"
 *
 * Each call site picks a stable namespace string. Off by default; the flag
 * is read once and cached per page session — reload to pick up a change.
 *
 * Known kit namespaces:
 *   - tools           — active-tool + hotkey transitions (useTools)
 *   - dispatch        — gesture start / end / cancel (dispatcher)
 *   - drag-rect       — useDragRect lifecycle
 *   - drag-radial     — useDragRadial lifecycle
 *   - scene           — restored-op replay gaps (history persistence)
 *   - scene-canvas    — SceneCanvas mount / unmount; adapter paste-translation warnings
 *   - history         — applyOps push, no-op suppression, serialize/restore
 *   - clipboard       — OS clipboard write/read failures, malformed payloads
 */
export { dlog, dwarn, isDebugEnabled } from '@weasel-js/routing';
