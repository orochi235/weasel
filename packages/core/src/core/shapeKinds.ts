/**
 * The kit's built-in shape kinds — one table, every other spelling derived.
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
   *  commit; they just have no live drag preview. */
  readonly insertPreview: boolean;
  /** The tool family a kind with a tool belongs to: which built-in tool set
   *  names it, and so which palette group it sits in. */
  readonly family?: 'shape' | 'draw' | 'select' | 'type';
  /** A node of this kind is a text node: an insert drops into its caret, and
   *  its properties carry the text groups. Absent, it is not. */
  readonly text?: boolean;
}

/**
 * Declaration order is the enumeration order of every derived list —
 * `KIT_SHAPE_KINDS`, and through it `defaultNodeRouting` /
 * `defaultNodeProperties` / `BUILTIN_TOOL_IDS`.
 */
export const SHAPE_KINDS = {
  rect: { tool: true, insertPreview: true, family: 'shape' },
  ellipse: { tool: true, insertPreview: true, family: 'shape' },
  line: { tool: true, insertPreview: true, family: 'shape' },
  polygon: { tool: true, insertPreview: true, family: 'shape' },
  star: { tool: true, insertPreview: true, family: 'shape' },
  pen: { tool: true, insertPreview: false, family: 'draw' },
  pencil: { tool: true, insertPreview: true, family: 'draw' },
  lasso: { tool: true, insertPreview: false, family: 'select' },
  text: { tool: true, insertPreview: true, text: true, family: 'type' },
  sticky: { tool: true, insertPreview: true, text: true, family: 'type' },
  image: { tool: false, insertPreview: true },
} as const satisfies Record<string, ShapeKindDescriptor>;

/** Every kind in the table, tool or not. */
export type ShapeKind = keyof typeof SHAPE_KINDS;

/** The keys of a shape-kind table whose descriptor sets `F` to `true`. */
export type ShapeKindsWhere<T, F extends keyof ShapeKindDescriptor> = {
  [K in keyof T]: T[K] extends Record<F, true> ? K : never;
}[keyof T];

/** Built-in shape tool ids handled by `useBuiltinShapeTools`. */
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

/** Runtime, iterable list of the shape-tool ids in `BuiltinShapeToolId`. */
export const KIT_SHAPE_KINDS: readonly BuiltinShapeToolId[] =
  shapeKindsWhere(SHAPE_KINDS, 'tool') as BuiltinShapeToolId[];

/** The shape-tool ids of one family, in declaration order. */
export function kitShapeKindsOf(family: NonNullable<ShapeKindDescriptor['family']>): BuiltinShapeToolId[] {
  return KIT_SHAPE_KINDS.filter((k) => (SHAPE_KINDS as Record<string, ShapeKindDescriptor>)[k]!.family === family);
}
