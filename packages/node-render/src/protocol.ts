// What crosses between Node and the page: JSON only, so pixels travel as base64. Typed here rather
// than from core, whose types reach React and the DOM, neither of which a Node caller has.
import { reviveTypedArrays, tagTypedArrays } from '@weasel-js/geom';

/** The page script's global, set once the script has run. */
export const PAGE_GLOBAL = '__weaselNodeRender';

/** `renderSceneToPixels`'s arguments that survive JSON: no `drawOne`, `resolveImage`, `alphaFor`
 *  or `colorOverrides`. Each means what it means there. */
export interface SerializableRenderArgs {
  /** Scene-space rect to render. */
  sourceRect: { x: number; y: number; width: number; height: number };
  /** Output pixels per scene unit, per axis. */
  scale: { x: number; y: number };
  /** Background fill, any CSS color. Default: transparent. */
  background?: string;
  /** Max curve-flattening error in output pixels. Default 0.25. */
  flattenTolerancePx?: number;
  /** Draw commands over the scene in output-pixel space, as `renderSceneToPixels` takes them. */
  overlay?: readonly object[];
  /** Draw the scene's annotation layers. Default `false`. */
  annotations?: boolean;
}

export interface PageRequest extends SerializableRenderArgs {
  /** A `scene.toJSON()` snapshot. */
  scene: object;
  screen?: readonly number[];
  format: 'rgba' | 'png';
}

export interface PageResult {
  width: number;
  height: number;
  base64: string;
}

export interface PageApi {
  render(req: PageRequest): Promise<PageResult>;
}

/** A live scene or its snapshot, as JSON carries it: a path's typed arrays tagged, as
 *  `tagTypedArrays` writes them. A snapshot already saved that way passes through unchanged. */
export function sceneToWire(scene: object): object {
  const toJSON = (scene as { toJSON?: unknown }).toJSON;
  return tagTypedArrays(typeof toJSON === 'function' ? toJSON.call(scene) : scene) as object;
}

/** The snapshot `sceneToWire` sent, its typed arrays restored. */
export function sceneFromWire(wire: object): object {
  return reviveTypedArrays(wire) as object;
}
