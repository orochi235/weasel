import type { GLImageCache } from './cache/GLImageCache';
import type { GLMeshCache } from './cache/GLMeshCache';
import type { GLTextureCache } from './cache/GLTextureCache';
import type { GradientRampAtlas } from './cache/GradientRampAtlas';
import type { DrawBatch } from './drawBatch';
import type { BatchVariantPrograms } from './shaders/builtinPrograms';
import type { GroupState } from './state/GroupState';
import type { WeaselRenderer } from './WeaselRenderer';

/** The parts of a renderer that this package's tests and testing helpers reach into. Not package surface: no
 *  entry exports this module but `test-seams`, and that only `_setBatchCutsForTests`. */
export interface RendererParts {
  drawBatch: DrawBatch;
  batchVariants: BatchVariantPrograms;
  meshCache: GLMeshCache;
  textureCache: GLTextureCache;
  imageCache: GLImageCache;
  gradRamps: GradientRampAtlas;
  groupState: GroupState;
}

const PARTS = new WeakMap<object, () => RendererParts>();

/** Called by the renderer's constructor; `read` answers the parts as they are now, since a restored context
 *  replaces them. */
export function registerRendererParts(renderer: object, read: () => RendererParts): void {
  PARTS.set(renderer, read);
}

export function rendererParts(renderer: WeaselRenderer): RendererParts {
  const read = PARTS.get(renderer);
  if (!read) throw new Error('rendererParts: not a constructed WeaselRenderer');
  return read();
}

/** Turn the batch's CPU cuts on or off, for a test that needs a stroke stenciled rather than cut. */
export function _setBatchCutsForTests(renderer: WeaselRenderer, on: boolean): void {
  Object.defineProperty(rendererParts(renderer).batchVariants, 'cuts', { value: on });
}
