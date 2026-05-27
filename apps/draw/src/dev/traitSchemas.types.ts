/**
 * Shared types describing schemas extracted by the trait-schemas Vite plugin
 * from the kit source. The plugin produces a `TraitSchemaIndex` and exposes
 * it through the virtual module `virtual:weasel-trait-schemas`. The Bundle
 * Inspector imports the index and renders the schemas in detail panels.
 *
 * Keep this file framework-free — the plugin reads it at build time via the
 * normal module graph, and the inspector reads it at runtime.
 */

/** A single property of an object literal or interface. */
export interface PropertyDescriptor {
  readonly name: string;
  /** Stringified TypeScript type as ts-morph rendered it. */
  readonly type: string;
  readonly optional: boolean;
  /** Source literal if the property had one (`'PATH_PAINTER'`, `2`, etc.). */
  readonly defaultLiteral?: string;
  /** Trailing-comment / JSDoc description if present at the field. */
  readonly doc?: string;
}

/** Worktree-relative source location. */
export interface SourceRef {
  /** Path relative to the repo root, forward-slash. */
  readonly file: string;
  readonly line: number;
}

export interface ShapeSchema {
  readonly id: string;
  readonly pose: readonly PropertyDescriptor[];
  readonly data: readonly PropertyDescriptor[];
  /** Painter/renderer this kind is routed through, when known. */
  readonly renderer?: string;
  readonly source: SourceRef;
  readonly notes?: string;
}

export interface OpFactorySchema {
  readonly id: string;
  readonly params: readonly PropertyDescriptor[];
  readonly returnType: string;
  readonly jsdoc?: string;
  readonly source: SourceRef;
}

export interface ActionSchema {
  readonly id: string;
  readonly label?: string;
  readonly group?: string;
  readonly shortcut?: string;
  /** Stringified `defaultBinding` literal if available. */
  readonly defaultBinding?: string;
  readonly source: SourceRef;
}

export interface GestureSchema {
  readonly id: string;
  /** Payload property shape when the gesture has one. */
  readonly payload: readonly PropertyDescriptor[];
  readonly source?: SourceRef;
}

export interface SceneNodeVariant {
  readonly kind: string;
  readonly properties: readonly PropertyDescriptor[];
}

export interface SceneNodeSchema {
  /** The discriminator field's possible values, e.g. `['leaf', 'container']`. */
  readonly kinds: readonly string[];
  readonly variants: readonly SceneNodeVariant[];
  readonly source: SourceRef;
}

export interface TraitSchemaIndex {
  readonly shapes: Record<string, ShapeSchema>;
  readonly ops: Record<string, OpFactorySchema>;
  readonly actions: Record<string, ActionSchema>;
  readonly gestures: Record<string, GestureSchema>;
  readonly node: SceneNodeSchema;
  /** Wall-clock ms when the plugin produced this index. */
  readonly extractedAt: number;
}
