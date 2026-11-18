/** What builds a node for an `insert` of a kind: the contract between the tools that insert, the canvas's
 *  `insertNodeFactories` and presets' traits, and the `insert` dep that mints the node. */
import type { DepRegistry } from '@weasel-js/routing/react';
import type { InsertExtras } from 'interactions/actions/depSchema';
import type { SceneBatchOptions } from 'core/scene/recorder';
import type { Rect } from '@weasel-js/geom';

/**
 * Consumer-supplied node factory for one insert `kind`. Given the drag AABB
 * and the tool's `extras`, returns the node's `data` (in the consumer's own
 * data shape) plus an optional `pose` override — the dep supplies id, layer,
 * and the undoable insert op. Return `null` to reject the insert.
 *
 * A factory registered for a kit kind (`rect`, `line`, …) fully replaces the
 * kit's default `{ path, fill }` factory for that kind; a factory for a novel
 * kind adds support the kit doesn't ship (`@weasel-js/text-tools`' `text`). The paint of a kit
 * shape comes from the insert's `extras.style`: its tool's style options. See
 * `SceneCanvas`'s `insertNodeFactories` prop. It is also asked on every frame
 * of an insert's drag, inserting nothing, so a preview can show where the
 * scene's quantize rule lands the node: it must not count or mint anything.
 */
export type InsertNodeFactory<E extends InsertExtras = InsertExtras> = {
  // Method syntax makes `extras` bivariant, so a factory typed for one kind's extras fits the map's string index.
  factory(
    bounds: Rect,
    extras: E,
  ): InsertedNode | null;
}['factory'];

/** What an {@link InsertNodeFactory} builds: the node's `data`, an optional `pose`, and what its commit does
 *  beyond inserting it. */
export interface InsertedNode {
  data: unknown;
  pose?: unknown;
  /** Options for the batch the commit applies, given the minted id: a node made to be filled in right away, an
   *  empty text box, opens a run its first edit joins, so one undo takes both. */
  batch?: (id: string) => SceneBatchOptions;
  /** Runs once the commit has applied, with the canvas's deps: to open the new node for editing, say. */
  inserted?: (id: string, deps: Pick<DepRegistry, 'get'>) => void;
}

/** The kinds the kit's tools insert with extras of their own shape. */
export type KitInsertKind = InsertExtras extends infer E
  ? E extends { kind: infer K extends string } ? (string extends K ? never : K) : never
  : never;

/** `<SceneCanvas insertNodeFactories>`: a factory per insert `kind`. A kit kind's entry
 *  receives that kind's extras (`pencil` gets `samples`); any other kind gets the open shape. */
export type InsertNodeFactories =
  & { [K in KitInsertKind]?: InsertNodeFactory<Extract<InsertExtras, { kind: K }>> }
  & { [kind: string]: InsertNodeFactory | undefined };
