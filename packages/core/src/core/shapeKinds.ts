/**
 * The kit's built-in shape kinds — one table, every other spelling derived.
 *
 * Lives in `core/` rather than beside the shape tools because both layers ask
 * questions of the same set: the interactions layer decides whether
 * `insertAction` can paint a live preview for a kind, and the canvas layer
 * decides which shape tools `useBuiltinShapeTools` mounts and what
 * `BUNDLE_TOOLS` / `defaultNodeRouting` / `defaultNodeProperties` enumerate.
 *
 * This module imports nothing on purpose: `useBuiltinShapeTools` imports the
 * package barrel, so anything barrel-reachable that needs these lists at
 * module-evaluation time must not route through it.
 */

/** What the kit knows about one built-in shape kind. */
export interface ShapeKindDescriptor {
  /** Mounted as a built-in shape tool by `useBuiltinShapeTools`, and so a
   *  member of `BuiltinShapeToolId` / `KIT_SHAPE_KINDS`. `image` is false:
   *  `useImageTool` needs a `src` and can't be auto-mounted. */
  readonly tool: boolean;
  /** `insertAction` emits an `insertPreview` overlay for this kind, and the
   *  dispatcher overlay layer knows how to draw it. Kinds without one still
   *  commit; they just have no live drag preview (`pen` and `lasso` don't
   *  route through `insertAction` at all). */
  readonly insertPreview: boolean;
}

/**
 * Declaration order is the enumeration order of every derived list —
 * `KIT_SHAPE_KINDS`, and through it `defaultNodeRouting` /
 * `defaultNodeProperties` / `BUNDLE_TOOLS.exhaustive`.
 */
export const SHAPE_KINDS = {
  rect: { tool: true, insertPreview: true },
  ellipse: { tool: true, insertPreview: true },
  line: { tool: true, insertPreview: true },
  polygon: { tool: true, insertPreview: true },
  star: { tool: true, insertPreview: true },
  pen: { tool: true, insertPreview: false },
  pencil: { tool: true, insertPreview: true },
  lasso: { tool: true, insertPreview: false },
  text: { tool: true, insertPreview: true },
  image: { tool: false, insertPreview: true },
} as const satisfies Record<string, ShapeKindDescriptor>;

/** Every kind in the table, tool or not. */
export type ShapeKind = keyof typeof SHAPE_KINDS;

/** The keys of a shape-kind table whose descriptor sets `F` to `true`. */
export type ShapeKindsWhere<T, F extends keyof ShapeKindDescriptor> = {
  [K in keyof T]: T[K] extends Record<F, true> ? K : never;
}[keyof T];

/**
 * Built-in shape tool ids handled by `useBuiltinShapeTools`. Each maps to a
 * kit tool hook + a default `create` that produces a leaf node compatible
 * with `PATH_PAINTER`.
 */
export type BuiltinShapeToolId = ShapeKindsWhere<typeof SHAPE_KINDS, 'tool'>;

/** The insert kinds the kit's dispatcher overlay layer knows how to render.
 *  Consumer-defined kinds fall outside it: no live preview, commit unaffected. */
export type KitInsertShape = ShapeKindsWhere<typeof SHAPE_KINDS, 'insertPreview'>;

/** Kinds in `table` whose descriptor sets `field`, in declaration order. */
export function shapeKindsWhere<T extends Record<string, ShapeKindDescriptor>>(
  table: T,
  field: keyof ShapeKindDescriptor,
): (keyof T & string)[] {
  return (Object.keys(table) as (keyof T & string)[]).filter((k) => table[k][field]);
}

/** The descriptor for `kind`, or `undefined` for a kind the kit doesn't ship.
 *  The one accessor: ask it rather than testing membership of a derived list. */
export function shapeKindInfo(kind: string): ShapeKindDescriptor | undefined {
  return (SHAPE_KINDS as Record<string, ShapeKindDescriptor>)[kind];
}

/** Runtime, iterable list of the shape-tool ids in `BuiltinShapeToolId`.
 *  Surfaced so consumers (e.g. the Bundle Inspector) can enumerate the
 *  builtin shape kinds without re-encoding the union. */
export const KIT_SHAPE_KINDS: readonly BuiltinShapeToolId[] =
  shapeKindsWhere(SHAPE_KINDS, 'tool') as BuiltinShapeToolId[];
