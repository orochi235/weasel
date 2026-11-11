// What crosses between Node and the page: JSON only, so pixels travel as base64. Typed here rather
// than from core, whose types reach React and the DOM, neither of which a Node caller has.
import { reviveTypedArrays, tagTypedArrays } from '@weasel-js/geom';

/** The page script's global, set once the script has run. */
export const PAGE_GLOBAL = '__weaselHeadless';

/** `renderSceneToPixels`'s arguments that survive JSON: no `drawOne`, `resolveImage`, `alphaFor`,
 *  `colorOverrides` or `trimOverrides`. Each means what it means there. */
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
  if (!isRecord(scene)) refuse('scene', 'an object', scene);
  const toJSON = (scene as { toJSON?: unknown }).toJSON;
  // Read back first, so arrays the snapshot holds already tagged are tagged once rather than escaped as data.
  return tagTypedArrays(reviveTypedArrays(typeof toJSON === 'function' ? toJSON.call(scene) : scene)) as object;
}

/** The snapshot `sceneToWire` sent, its typed arrays restored. */
export function sceneFromWire(wire: object): object {
  return reviveTypedArrays(wire) as object;
}

const isRecord = (v: unknown): v is Record<string, unknown> => v !== null && typeof v === 'object' && !Array.isArray(v);
const shown = (v: unknown): string => {
  try {
    return JSON.stringify(v) ?? String(v);
  } catch {
    return String(v);
  }
};
const refuse = (field: string, want: string, got: unknown): never => {
  throw new Error(`headless render request: ${field} must be ${want}, got ${shown(got)}`);
};
const finite = (field: string, v: unknown): void => {
  if (typeof v !== 'number' || !Number.isFinite(v)) refuse(field, 'a finite number', v);
};

/**
 * `value` as a {@link PageRequest}, or an `Error` naming the first field that is not one: a request
 * crosses as JSON, which turns `NaN` into `null` and drops an `undefined`. Fields it does not know pass
 * through for `renderSceneToPixels` to read.
 */
export function readPageRequest(value: unknown): PageRequest {
  if (!isRecord(value)) return refuse('the request', 'an object', value);
  if (!isRecord(value.scene)) refuse('scene', 'an object', value.scene);
  if (!isRecord(value.sourceRect)) refuse('sourceRect', 'an object', value.sourceRect);
  for (const k of ['x', 'y', 'width', 'height'] as const) finite(`sourceRect.${k}`, (value.sourceRect as Record<string, unknown>)[k]);
  if (!isRecord(value.scale)) refuse('scale', 'an object', value.scale);
  for (const k of ['x', 'y'] as const) finite(`scale.${k}`, (value.scale as Record<string, unknown>)[k]);
  if (value.format !== 'rgba' && value.format !== 'png') refuse('format', `'rgba' or 'png'`, value.format);
  if (value.background !== undefined && typeof value.background !== 'string') refuse('background', 'a CSS color string', value.background);
  if (value.flattenTolerancePx !== undefined) finite('flattenTolerancePx', value.flattenTolerancePx);
  if (value.annotations !== undefined && typeof value.annotations !== 'boolean') refuse('annotations', 'a boolean', value.annotations);
  if (value.overlay !== undefined && !(Array.isArray(value.overlay) && value.overlay.every(isRecord))) {
    refuse('overlay', 'an array of draw commands', value.overlay);
  }
  if (value.screen !== undefined) {
    const { screen } = value;
    if (!Array.isArray(screen) || screen.length !== 9) refuse('screen', 'nine numbers', screen);
    (screen as unknown[]).forEach((n, i) => finite(`screen[${i}]`, n));
  }
  return value as unknown as PageRequest;
}
