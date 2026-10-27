/**
 * Refcounted registration of the kit's default content handlers.
 * Each mounted `<SceneCanvas>` calls this on mount and disposes on unmount;
 * the kit handlers stay registered while at least one canvas is up. (A naive
 * skip-if-present would break the two-canvas case: if the mount that
 * registered `kit:image` unmounts first, the survivor would lose its image
 * handler.)
 */
import { registerContentHandler } from './contentHandlers';
import { kitImageHandler } from './imageHandler';
import { kitSvgHandler } from './svgHandler';
import { kitWeaselJsonHandler } from './weaselJsonHandler';

let refs = 0;
let dispose: (() => void) | null = null;

export function acquireKitContentHandlers(): () => void {
  refs++;
  if (refs === 1) {
    const disposers = [kitImageHandler, kitSvgHandler, kitWeaselJsonHandler].map(registerContentHandler);
    dispose = () => { for (const d of disposers) d(); };
  }
  let released = false;
  return () => {
    if (released) return;
    released = true;
    refs--;
    if (refs === 0) {
      dispose?.();
      dispose = null;
    }
  };
}

/** @internal test seam. */
export function _resetKitContentHandlersForTests(): void {
  refs = 0;
  dispose = null;
}
