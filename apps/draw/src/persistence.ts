// WeaselDraw's persistence: the legacy-paint migration layered over the shared snapshot helpers.

import { nodeSpecsFromSnapshot as sharedNodeSpecs, reviveTypedArrays } from '@editor/index';
import type { AddNodeSpec, SceneRegistry, SerializedScene, SerializedSceneV1 } from '@weasel-js/core';
import { solid } from '@weasel-js/core';


/** The `Paint` discriminant values as they were written before 2026-10-12,
 *  when the tag sat under `fill` rather than `kind`. A string under `fill`
 *  naming one of these is that old tag, not a legacy color. */
const LEGACY_KIND_TAGS = new Set([
  'solid', 'pattern', 'linear-gradient', 'radial-gradient', 'conic-gradient', 'mesh-gradient',
]);

/** A string paint that means "no paint at all" rather than a color. */
const NO_PAINT = new Set(['none', 'transparent']);

function paintFromLegacy(color: string): { color: string; opacity?: number } | null {
  return NO_PAINT.has(color.toLowerCase()) ? null : solid(color) as { color: string; opacity?: number };
}

/** Whether `value` is a paint sitting where a `Fill` belongs, as a `fill`
 *  slot held one until 2026-10-12. A `Fill` has a `paint` and none of a
 *  paint's own keys, and so does an `SvgPaint` gradient. */
function isBarePaint(value: unknown): value is Record<string, unknown> {
  if (value === null || typeof value !== 'object' || Array.isArray(value)) return false;
  if ('paint' in value) return false;
  return 'color' in value || 'kind' in value || 'stops' in value;
}

/**
 * Rewrite the pre-2026-08-26 string paint forms — `fill: '#abc'`,
 * `stroke: '#abc'` with a sibling `strokeWidth` — into the `Fill` and
 * `Stroke` objects every reader now expects, a paint's tag from `fill` to
 * `kind`, a pattern's tile up into the paint, and a paint held directly under
 * `fill` into a `Fill`. Walks in place and returns the same node, like
 * `reviveTypedArrays`.
 *
 * Applied to node data and to the node data copied inside a history
 * snapshot's op payloads, so an undo after a reload cannot write a string
 * back into a migrated scene.
 */
export function migrateLegacyPaint<T>(node: T): T {
  if (node == null || typeof node !== 'object') return node;
  if (Array.isArray(node)) {
    for (const item of node) migrateLegacyPaint(item);
    return node;
  }
  const obj = node as Record<string, unknown>;

  if (typeof obj.fill === 'string') {
    if (LEGACY_KIND_TAGS.has(obj.fill)) {
      obj.kind = obj.fill;
      delete obj.fill;
    } else {
      const paint = paintFromLegacy(obj.fill);
      obj.fill = paint === null ? null : { paint };
    }
  }
  if (typeof obj.stroke === 'string') {
    const paint = paintFromLegacy(obj.stroke);
    const width = typeof obj.strokeWidth === 'number' ? obj.strokeWidth : 1;
    obj.stroke = paint === null ? null : { paint, width };
  }
  if ('strokeWidth' in obj) delete obj.strokeWidth;
  liftLegacyPattern(obj);

  for (const k of Object.keys(obj)) migrateLegacyPaint(obj[k]);
  // After the walk, so a paint still wearing its old tag has become one first.
  if (isBarePaint(obj.fill)) obj.fill = { paint: obj.fill };
  return node;
}

/**
 * A pattern paint held its tile one level down until 2026-10-12, as
 * `{ kind: 'hatch', … }`. Each tile is now its own
 * kind with its fields beside the placement, and a consumer-built handle is a
 * `texture` paint.
 */
function liftLegacyPattern(obj: Record<string, unknown>): void {
  const payload = obj.pattern;
  if (obj.kind !== 'pattern' || typeof payload !== 'object' || payload === null) return;
  delete obj.pattern;
  if ('tile' in payload) {
    const { tile, ...rest } = payload as Record<string, unknown>;
    Object.assign(obj, rest, { kind: tile });
  } else {
    obj.kind = 'texture';
    obj.texture = payload;
  }
}

/**
 * The one way to read anything that came out of localStorage: revive the
 * typed arrays, then migrate the legacy string paints. Both the scene and the
 * two history snapshots go through it, so neither pass can be forgotten at a
 * load site.
 */
export function reviveSnapshot<T>(node: T): T {
  return migrateLegacyPaint(reviveTypedArrays(node));
}

/** `JSON.parse`-style reviver for clipboard payloads (the shape
 *  `IngestCtx.clipboard.reviver` expects): one `reviveTypedArrays` pass over
 *  the fully-parsed tree, applied at the reviver's final root call
 *  (`key === ''`). NOT interchangeable with `reviveTypedArrays` itself —
 *  a JSON reviver is `(key, value) => value`, and wiring the one-arg walker
 *  in directly makes it receive each KEY (a string) and return it, collapsing
 *  the whole parse to `''`. */
export function clipboardJsonReviver(key: string, value: unknown): unknown {
  return key === '' ? reviveSnapshot(value) : value;
}

/** The shared `nodeSpecsFromSnapshot` with the legacy-paint migration applied to each node's data. */
export function nodeSpecsFromSnapshot<TData, TLayer extends string, TPose>(
  json: SerializedScene<TData, TLayer, TPose> | SerializedSceneV1<TData, TLayer, TPose>,
  registry?: SceneRegistry<TPose, TData, TLayer>,
): AddNodeSpec<TData, TLayer, TPose>[] {
  return sharedNodeSpecs(json, registry, reviveSnapshot);
}
