import type { CanvasBackend } from '@weasel-js/core';

const BACKENDS: readonly CanvasBackend[] = ['webgl2', 'webgpu', 'auto'];

/** The backend `?backend=` names, which every canvas on the site paints with. Default `'webgl2'`. */
export function backendFromUrl(search = typeof window === 'undefined' ? '' : window.location.search): CanvasBackend {
  const asked = new URLSearchParams(search).get('backend');
  return BACKENDS.find((b) => b === asked) ?? 'webgl2';
}
