// What crosses between Node and the page: JSON only, so pixels travel as base64. Typed here rather
// than from core, whose types reach React and the DOM, neither of which a Node caller has.
import { decodeSnapshot, encodeSnapshot } from '@weasel-js/core/json';
import { checkPixelRenderRect, pixelRenderSize } from '@weasel-js/core/math';
import type { Rect, View } from '@weasel-js/geom';

/** The page script's global, set once the script has run. */
export const PAGE_GLOBAL = '__weaselHeadless';

/** `renderSceneToPixels`'s arguments that survive JSON: no `drawOne`, `resolveImage`, `alphaFor`,
 *  `colorOverrides` or `trimOverrides`. Each means what it means there. */
export interface SerializableRenderArgs {
  /** Scene-space rect to render. */
  sourceRect: Rect;
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
  /** The camera a parallax layer is placed from, for a capture of what that camera shows. */
  camera?: View;
  /** Which scene layers to draw: `'scene:<layerId>'` for one, `'scene'` for all of them. */
  layers?: readonly string[];
  /** Output pixels per CSS pixel. Default 1. */
  pixelRatio?: number;
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

/** A live scene or its snapshot, as JSON carries it: encoded by core's snapshot codec. A live scene's `toJSON()`,
 *  and a snapshot holding a typed array, are decoded, so they are encoded as they are. Any other snapshot is read as
 *  encoded, as a file holds it, so plain numbers under `coords` or `commands` read as a path's typed arrays. */
export function sceneToWire(scene: object): object {
  if (!isRecord(scene)) refuse('scene', 'an object', scene);
  const toJSON = (scene as { toJSON?: unknown }).toJSON;
  if (typeof toJSON === 'function') return encodeSnapshot(toJSON.call(scene)) as object;
  if (holdsTypedArray(scene)) return encodeSnapshot(scene) as object;
  // Read back first, so arrays the snapshot holds already tagged are tagged once rather than escaped as data.
  return encodeSnapshot(decodeSnapshot(scene)) as object;
}

function holdsTypedArray(value: object): boolean {
  const pending: unknown[] = [value];
  const seen = new Set<object>();
  while (pending.length) {
    const v = pending.pop();
    if (v === null || typeof v !== 'object' || seen.has(v)) continue;
    if (ArrayBuffer.isView(v)) return true;
    seen.add(v);
    pending.push(...(Array.isArray(v) ? v : Object.values(v)));
  }
  return false;
}

/** The snapshot `sceneToWire` sent, its typed arrays restored. */
export function sceneFromWire(wire: object): object {
  return decodeSnapshot(wire) as object;
}

/** The most bytes a result can hold: their base64 crosses inside one protocol message, which Node reads as one
 *  string, and V8 caps a string at 2^29 − 24 characters. 1 MiB of it is left for the message around the base64.
 *  An RGBA render past it is about 10 000 × 10 000 pixels. */
export const MAX_RESULT_BYTES = Math.floor((2 ** 29 - 24 - 2 ** 20) / 4) * 3;

/** Throw unless `bytes` of a `what` fit one result, naming the limit and the way past it. */
export function checkResultBytes(bytes: number, what: string): void {
  if (bytes > MAX_RESULT_BYTES) {
    throw new Error(
      `headless render request: ${what} is ${bytes} bytes, past the ${MAX_RESULT_BYTES} one result can carry `
      + '— lower `scale` or render the source rect in tiles',
    );
  }
}

type UncheckedRect = { x: unknown; y: unknown; width: unknown; height: unknown };
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
  if (!isRecord(value.scale)) refuse('scale', 'an object', value.scale);
  // Refused here as the page's `renderSceneToPixels` refuses it, so such a request never starts a browser.
  checkPixelRenderRect(value.sourceRect as UncheckedRect, value.scale as UncheckedRect, 'headless render request');
  if (value.format !== 'rgba' && value.format !== 'png') refuse('format', `'rgba' or 'png'`, value.format);
  if (value.background !== undefined && typeof value.background !== 'string') refuse('background', 'a CSS color string', value.background);
  if (value.flattenTolerancePx !== undefined) finite('flattenTolerancePx', value.flattenTolerancePx);
  if (value.annotations !== undefined && typeof value.annotations !== 'boolean') refuse('annotations', 'a boolean', value.annotations);
  if (value.overlay !== undefined && !(Array.isArray(value.overlay) && value.overlay.every(isRecord))) {
    refuse('overlay', 'an array of draw commands', value.overlay);
  }
  if (value.camera !== undefined) {
    const { camera } = value;
    if (!isRecord(camera) || !isRecord(camera.scale)) refuse('camera', 'a view', camera);
    const view = camera as Record<string, unknown> & { scale: Record<string, unknown> };
    finite('camera.x', view.x);
    finite('camera.y', view.y);
    for (const axis of ['x', 'y'] as const) {
      const v = view.scale[axis];
      if (typeof v !== 'number' || !Number.isFinite(v) || v === 0) refuse(`camera.scale.${axis}`, 'a finite number other than 0', v);
    }
  }
  if (value.layers !== undefined && !(Array.isArray(value.layers) && value.layers.every((l) => typeof l === 'string'))) {
    refuse('layers', 'an array of layer names', value.layers);
  }
  if (value.pixelRatio !== undefined) {
    const { pixelRatio } = value;
    if (typeof pixelRatio !== 'number' || !Number.isFinite(pixelRatio) || pixelRatio <= 0) refuse('pixelRatio', 'a positive finite number', pixelRatio);
  }
  if (value.screen !== undefined) {
    const { screen } = value;
    if (!Array.isArray(screen) || screen.length !== 9) refuse('screen', 'nine numbers', screen);
    (screen as unknown[]).forEach((n, i) => finite(`screen[${i}]`, n));
  }
  if (value.format === 'rgba') {
    const { width, height } = pixelRenderSize(value.sourceRect as Rect, value.scale as { x: number; y: number });
    checkResultBytes(width * height * 4, `a ${width} × ${height} RGBA render`);
  }
  return value as unknown as PageRequest;
}
